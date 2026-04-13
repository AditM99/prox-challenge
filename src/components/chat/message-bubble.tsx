"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import ArtifactRenderer from "@/components/artifacts/artifact-renderer";
import ImageDisplay from "@/components/artifacts/image-display";
import VoiceOutputButton from "./voice-output-button";
import { User, Zap } from "lucide-react";

interface MessageBubbleProps {
  message: ChatMessage;
  language?: string;
}

export default function MessageBubble({ message, language = "en" }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-white/10 ring-1 ring-white/10"
            : "bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-600/20"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white/70" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block bg-brand-600/20 text-white border border-brand-500/15 rounded-2xl rounded-tr-sm px-4 py-2.5">
            {message.attachedImages && message.attachedImages.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap justify-end">
                {message.attachedImages.map((img, i) => (
                  <img
                    key={i}
                    src={`data:${img.mimeType};base64,${img.base64}`}
                    alt="Attached"
                    className="max-w-[200px] max-h-[200px] object-cover rounded-lg"
                  />
                ))}
              </div>
            )}
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Text content */}
            {message.content && (
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="prose prose-sm max-w-none text-white/80">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {!message.isStreaming && (
                  <div className="flex justify-end mt-1 -mb-1">
                    <VoiceOutputButton text={message.content} isStreaming={!!message.isStreaming} language={language} />
                  </div>
                )}
              </div>
            )}

            {/* Images */}
            {message.images?.map((img, i) => (
              <ImageDisplay
                key={i}
                url={img.url}
                description={img.description}
                pageNumber={img.pageNumber}
              />
            ))}

            {/* Artifacts */}
            {message.artifacts?.map((artifact, i) => (
              <ArtifactRenderer
                key={i}
                type={artifact.type}
                title={artifact.title}
                code={artifact.code}
              />
            ))}

            {/* Streaming indicator */}
            {message.isStreaming && !message.content && (
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-brand-400/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-brand-400/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-brand-400/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
