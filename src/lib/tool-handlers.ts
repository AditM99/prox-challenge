import {
  searchTextChunks,
  searchImageCatalog,
  querySelectionChart,
  queryDutyCycles,
  findTroubleshootingFlow,
} from "./knowledge";
import { generateTroubleshootingReactCode } from "./troubleshooting-renderer";
import { semanticSearch } from "./semantic-search";
import { webSearch, fetchPageSnippet } from "./web-scraper";
import type { UploadedProduct, TextChunk, UserMemory, TroubleshootingFlow } from "./types";

interface ToolHandlerResult {
  result: unknown;
  images?: { url: string; description: string; pageNumber?: number }[];
  artifact?: { artifactType: string; title: string; code: string };
  memoryUpdate?: Partial<UserMemory>;
}

export async function executeToolHandler(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<ToolHandlerResult> {
  switch (toolName) {
    case "search_manual": {
      const query = toolInput.query as string;
      const section = toolInput.section as string | undefined;
      const chunks = await searchTextChunks(query, section);
      return {
        result: chunks.map((c) => ({
          section: c.section,
          page: c.pageNumber,
          content: c.content,
        })),
      };
    }

    case "show_manual_image": {
      const query = toolInput.query as string;
      const images = searchImageCatalog(query);
      if (images.length === 0) {
        return { result: "No matching images found." };
      }
      return {
        result: images.map((img) => ({
          description: img.description,
          page: img.pageNumber,
        })),
        images: images.map((img) => ({
          url: img.path,
          description: img.description,
          pageNumber: img.pageNumber,
        })),
      };
    }

    case "get_selection_chart_data": {
      const process = toolInput.process as string | undefined;
      const material = toolInput.material as string | undefined;
      const thickness = toolInput.thickness as string | undefined;
      const data = querySelectionChart(process, material, thickness);
      if (data.length === 0) {
        return {
          result:
            "No matching selection chart data found. Try broadening your search.",
        };
      }
      return { result: data };
    }

    case "get_duty_cycle_data": {
      const process = toolInput.process as string | undefined;
      const voltage = toolInput.voltage as string | undefined;
      const data = queryDutyCycles(process, voltage);
      if (data.length === 0) {
        return { result: "No matching duty cycle data found." };
      }
      return { result: data };
    }

    case "render_artifact": {
      const artifactType = toolInput.type as string;
      const title = toolInput.title as string;
      const code = toolInput.code as string;
      return {
        result: { rendered: true, type: artifactType, title },
        artifact: { artifactType, title, code },
      };
    }

    case "update_user_memory": {
      return buildMemoryUpdateResult(toolInput);
    }

    case "web_search": {
      const query = toolInput.query as string;
      const numResults = Math.min((toolInput.num_results as number) || 3, 5);
      try {
        const searchResults = await webSearch(query);
        const topResults = searchResults.slice(0, numResults);

        const resultsWithContent = await Promise.all(
          topResults.map(async (r) => {
            const content = await fetchPageSnippet(r.url);
            return { title: r.title, url: r.url, snippet: r.snippet, content };
          })
        );

        return { result: { query, results: resultsWithContent } };
      } catch {
        return {
          result: {
            query,
            error: "Web search is temporarily unavailable. Please answer based on your training knowledge.",
          },
        };
      }
    }

    case "guided_troubleshoot": {
      const issue = toolInput.issue as string;
      const customFlow = toolInput.custom_flow as { title: string; steps: Record<string, unknown> } | undefined;

      if (customFlow) {
        const code = generateTroubleshootingReactCode({
          id: "custom",
          title: customFlow.title,
          description: "Custom troubleshooting flow",
          steps: customFlow.steps as TroubleshootingFlow["steps"],
        });
        return {
          result: { flowId: "custom", title: customFlow.title },
          artifact: { artifactType: "react", title: `Troubleshooting: ${customFlow.title}`, code },
        };
      }

      const flow = findTroubleshootingFlow(issue);
      if (!flow) {
        return {
          result: "No pre-built troubleshooting flow found for this issue. Please re-call this tool with a custom_flow parameter containing a step-by-step diagnostic tree for this problem.",
        };
      }

      const code = generateTroubleshootingReactCode(flow);
      return {
        result: { flowId: flow.id, title: flow.title },
        artifact: { artifactType: "react", title: `Troubleshooting: ${flow.title}`, code },
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}

function buildMemoryUpdateResult(toolInput: Record<string, unknown>): ToolHandlerResult {
  const memoryUpdate: Partial<UserMemory> = {};

  if (toolInput.expertiseLevel) {
    memoryUpdate.expertiseLevel = toolInput.expertiseLevel as UserMemory["expertiseLevel"];
  }
  if (toolInput.preferredDetailLevel) {
    memoryUpdate.preferredDetailLevel = toolInput.preferredDetailLevel as UserMemory["preferredDetailLevel"];
  }
  if (toolInput.addTopics) {
    memoryUpdate.frequentTopics = toolInput.addTopics as string[];
  }
  if (toolInput.addNote) {
    memoryUpdate.customNotes = [toolInput.addNote as string];
  }

  return {
    result: { updated: true, fields: Object.keys(memoryUpdate) },
    memoryUpdate,
  };
}

// Search uploaded product chunks — 2-stage grep + embedding rerank
async function searchUploadedChunks(
  chunks: TextChunk[],
  query: string,
  limit: number = 5
): Promise<TextChunk[]> {
  return semanticSearch(chunks, query, { limit });
}

export async function executeUploadedToolHandler(
  toolName: string,
  toolInput: Record<string, unknown>,
  session: UploadedProduct
): Promise<ToolHandlerResult> {
  switch (toolName) {
    case "search_manual": {
      const query = toolInput.query as string;
      const chunks = await searchUploadedChunks(session.chunks, query);
      if (chunks.length === 0) {
        return { result: "No matching content found in the uploaded manual." };
      }
      return {
        result: chunks.map((c) => ({
          source: c.section,
          page: c.pageNumber,
          content: c.content,
        })),
      };
    }

    case "show_manual_image": {
      const query = toolInput.query as string;
      if (!session.uploadedImages || session.uploadedImages.length === 0) {
        return { result: "No images available for this product. Consider generating a diagram artifact instead." };
      }

      // Simple keyword match against image filenames
      const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const matched = session.uploadedImages
        .map((img) => {
          const nameLower = img.name.toLowerCase();
          let score = 0;
          for (const term of queryTerms) {
            if (nameLower.includes(term)) score += 2;
          }
          return { img, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 1);

      // If no keyword matches, return first image
      const images = matched.length > 0
        ? matched.map((m) => m.img)
        : session.uploadedImages.slice(0, 1);

      return {
        result: images.map((img) => ({
          id: img.id,
          name: img.name,
          description: img.name,
        })),
        images: images.map((img) => ({
          url: `/api/uploaded-image?session=${session.sessionId}&id=${img.id}`,
          description: img.name,
        })),
      };
    }

    case "render_artifact": {
      const artifactType = toolInput.type as string;
      const title = toolInput.title as string;
      const code = toolInput.code as string;
      return {
        result: { rendered: true, type: artifactType, title },
        artifact: { artifactType, title, code },
      };
    }

    case "update_user_memory": {
      return buildMemoryUpdateResult(toolInput);
    }

    case "web_search": {
      const query = toolInput.query as string;
      const numResults = Math.min((toolInput.num_results as number) || 3, 5);
      try {
        const searchResults = await webSearch(query);
        const topResults = searchResults.slice(0, numResults);

        const resultsWithContent = await Promise.all(
          topResults.map(async (r) => {
            const content = await fetchPageSnippet(r.url);
            return { title: r.title, url: r.url, snippet: r.snippet, content };
          })
        );

        return { result: { query, results: resultsWithContent } };
      } catch {
        return {
          result: {
            query,
            error: "Web search is temporarily unavailable. Please answer based on your training knowledge.",
          },
        };
      }
    }

    case "guided_troubleshoot": {
      const issue = toolInput.issue as string;
      const customFlow = toolInput.custom_flow as { title: string; steps: Record<string, unknown> } | undefined;

      if (customFlow) {
        const code = generateTroubleshootingReactCode({
          id: "custom",
          title: customFlow.title,
          description: "Custom troubleshooting flow",
          steps: customFlow.steps as TroubleshootingFlow["steps"],
        });
        return {
          result: { flowId: "custom", title: customFlow.title },
          artifact: { artifactType: "react", title: `Troubleshooting: ${customFlow.title}`, code },
        };
      }

      const flow = findTroubleshootingFlow(issue);
      if (!flow) {
        return {
          result: "No pre-built troubleshooting flow found for this issue. Please re-call this tool with a custom_flow parameter containing a step-by-step diagnostic tree for this problem.",
        };
      }

      const code = generateTroubleshootingReactCode(flow);
      return {
        result: { flowId: flow.id, title: flow.title },
        artifact: { artifactType: "react", title: `Troubleshooting: ${flow.title}`, code },
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}
