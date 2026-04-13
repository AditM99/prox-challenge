import { NextRequest } from "next/server";
import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt, buildUploadedProductPrompt, buildMemoryContext } from "@/lib/system-prompt";
import type { UserMemory } from "@/lib/types";
import { getDefaultTools, getUploadedProductTools } from "@/lib/tools";
import { getSession } from "@/lib/session-store";

export const maxDuration = 60;

function encodeSSE(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  const { messages: clientMessages, sessionId, userMemory, language } = await req.json();

  const session = sessionId ? getSession(sessionId) : null;
  const basePrompt = session
    ? buildUploadedProductPrompt(session.productName, language)
    : buildSystemPrompt(language);
  const memoryContext = buildMemoryContext((userMemory as UserMemory) || null);
  const systemPrompt = basePrompt + memoryContext;
  const tools = session ? getUploadedProductTools(session) : getDefaultTools();

  const apiMessages: ModelMessage[] = clientMessages.map(
    (msg: { role: string; content: string; attachedImages?: { base64: string; mimeType: string }[] }) => {
      // If the message has attached images, use multipart content
      if (msg.attachedImages && msg.attachedImages.length > 0 && msg.role === "user") {
        const parts: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType: string }> = [];
        for (const img of msg.attachedImages) {
          parts.push({ type: "image", image: img.base64, mimeType: img.mimeType });
        }
        if (msg.content) {
          parts.push({ type: "text", text: msg.content });
        }
        return { role: "user" as const, content: parts };
      }
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      };
    }
  );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = streamText({
          model: anthropic("claude-sonnet-4-20250514"),
          system: systemPrompt,
          messages: apiMessages,
          tools,
          stopWhen: stepCountIs(8),
          experimental_onToolCallFinish: (event) => {
            // Emit tool call event
            controller.enqueue(
              encodeSSE({
                type: "tool_call",
                name: event.toolCall.toolName,
                input: "input" in event.toolCall ? event.toolCall.input : {},
              })
            );

            if (!event.success) return;

            const toolOutput = event.output as {
              result: unknown;
              images?: { url: string; description: string; pageNumber?: number }[];
              artifact?: { artifactType: string; title: string; code: string };
              memoryUpdate?: Partial<UserMemory>;
            } | undefined;

            if (!toolOutput) return;

            // Emit images
            if (toolOutput.images) {
              for (const img of toolOutput.images) {
                controller.enqueue(encodeSSE({ type: "image", ...img }));
              }
            }

            // Emit artifacts
            if (toolOutput.artifact) {
              controller.enqueue(
                encodeSSE({ type: "artifact", ...toolOutput.artifact })
              );
            }

            // Emit memory updates
            if (toolOutput.memoryUpdate) {
              controller.enqueue(
                encodeSSE({ type: "memory_update", memory: toolOutput.memoryUpdate })
              );
            }
          },
        });

        // Stream text chunks
        for await (const chunk of result.textStream) {
          if (chunk) {
            controller.enqueue(encodeSSE({ type: "text", content: chunk }));
          }
        }

        controller.enqueue(encodeSSE({ type: "done" }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An error occurred";
        controller.enqueue(encodeSSE({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
