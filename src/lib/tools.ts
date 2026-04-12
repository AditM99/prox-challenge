import { z } from "zod";
import { tool } from "ai";
import { executeToolHandler, executeUploadedToolHandler } from "./tool-handlers";
import type { UploadedProduct } from "./types";

// ─── Default Vulcan tools ───

export function getDefaultTools() {
  return {
    search_manual: tool({
      description:
        "Search the Vulcan OmniPro 220 owner's manual for information. Always use this before answering technical questions to ground your response in the actual manual content.",
      inputSchema: z.object({
        query: z.string().describe("Search query describing what information you need from the manual"),
        section: z.string().optional().describe("Optional: filter to a specific section"),
      }),
      execute: async (args) => {
        return executeToolHandler("search_manual", args);
      },
    }),

    show_manual_image: tool({
      description:
        "Retrieve and display an image from the manual. Use when visual content would help the user understand setup, connections, weld quality diagnosis, or mechanical parts.",
      inputSchema: z.object({
        query: z.string().describe("Description of the image needed"),
      }),
      execute: async (args) => {
        return executeToolHandler("show_manual_image", args);
      },
    }),

    get_selection_chart_data: tool({
      description:
        "Query the welding selection chart for recommended settings based on process type, material, and thickness.",
      inputSchema: z.object({
        process: z.string().optional().describe("Welding process: MIG, Flux-Cored, TIG, or Stick"),
        material: z.string().optional().describe("Material type"),
        thickness: z.string().optional().describe("Material thickness"),
      }),
      execute: async (args) => {
        return executeToolHandler("get_selection_chart_data", args);
      },
    }),

    get_duty_cycle_data: tool({
      description:
        "Get duty cycle information for a specific welding process and input voltage.",
      inputSchema: z.object({
        process: z.string().optional().describe("Welding process: MIG, Flux-Cored, TIG, or Stick"),
        voltage: z.string().optional().describe("Input voltage: 120 or 240"),
      }),
      execute: async (args) => {
        return executeToolHandler("get_duty_cycle_data", args);
      },
    }),

    render_artifact: tool({
      description:
        "Render an interactive artifact for the user. Use for calculators, configurators, flowcharts, diagrams, or any visual content that helps explain a concept better than text alone.",
      inputSchema: z.object({
        type: z.enum(["react", "html", "svg"]).describe("The rendering type"),
        title: z.string().describe("Display title for the artifact"),
        code: z.string().describe("The full source code."),
      }),
      execute: async (args) => {
        return executeToolHandler("render_artifact", args);
      },
    }),

    update_user_memory: tool({
      description:
        "Update what you know about this user to personalize future interactions. Call this when you learn about their expertise level, preferences, or interests. This persists across conversations.",
      inputSchema: z.object({
        expertiseLevel: z.enum(["beginner", "intermediate", "expert"]).optional().describe("User's welding/technical expertise level"),
        addTopics: z.array(z.string()).optional().describe("Topics to add to their frequent topics list"),
        preferredDetailLevel: z.enum(["concise", "detailed"]).optional().describe("Whether user prefers brief or thorough answers"),
        addNote: z.string().optional().describe("A freeform observation about the user (e.g., 'works primarily with aluminum', 'runs a small fabrication shop')"),
      }),
      execute: async (args) => {
        return executeToolHandler("update_user_memory", args);
      },
    }),

    web_search: tool({
      description:
        "Search the web for information not in the product manual. Use for prices, accessories, comparisons, community tips, troubleshooting forums, or any question the manual doesn't cover.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        num_results: z.number().optional().describe("Number of results to fetch (default 3, max 5)"),
      }),
      execute: async (args) => {
        return executeToolHandler("web_search", args);
      },
    }),

    guided_troubleshoot: tool({
      description:
        "Launch an interactive troubleshooting wizard for common welding issues. Use when the user describes a problem like porosity, wire feed issues, no arc, or excessive spatter. If no pre-built flow exists, create a custom_flow based on your knowledge.",
      inputSchema: z.object({
        issue: z.string().describe("The issue to troubleshoot (e.g., 'porosity', 'wire feed problems', 'no arc', 'excessive spatter')"),
        custom_flow: z.object({
          title: z.string(),
          steps: z.record(z.string(), z.object({
            question: z.string().optional(),
            options: z.array(z.object({ label: z.string(), next: z.string() })).optional(),
            type: z.string().optional(),
            title: z.string().optional(),
            fix: z.string().optional(),
            reference: z.string().optional(),
          })),
        }).optional().describe("Optional: provide a custom troubleshooting flow for issues not in the pre-built knowledge base"),
      }),
      execute: async (args) => {
        return executeToolHandler("guided_troubleshoot", args);
      },
    }),
  };
}

// ─── Uploaded product tools ───

export function getUploadedProductTools(session: UploadedProduct) {
  return {
    search_manual: tool({
      description:
        "Search the uploaded product manual for information. Always use this before answering technical questions.",
      inputSchema: z.object({
        query: z.string().describe("Search query describing what information you need from the manual"),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("search_manual", args, session);
      },
    }),

    show_manual_image: tool({
      description:
        "Show an uploaded image from the product manual.",
      inputSchema: z.object({
        query: z.string().describe("Description of the image needed"),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("show_manual_image", args, session);
      },
    }),

    render_artifact: tool({
      description:
        "Render an interactive artifact for the user.",
      inputSchema: z.object({
        type: z.enum(["react", "html", "svg"]).describe("The rendering type"),
        title: z.string().describe("Display title for the artifact"),
        code: z.string().describe("The full source code."),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("render_artifact", args, session);
      },
    }),

    update_user_memory: tool({
      description:
        "Update what you know about this user to personalize future interactions. Call this when you learn about their expertise level, preferences, or interests.",
      inputSchema: z.object({
        expertiseLevel: z.enum(["beginner", "intermediate", "expert"]).optional().describe("User's technical expertise level"),
        addTopics: z.array(z.string()).optional().describe("Topics to add to their frequent topics list"),
        preferredDetailLevel: z.enum(["concise", "detailed"]).optional().describe("Whether user prefers brief or thorough answers"),
        addNote: z.string().optional().describe("A freeform observation about the user"),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("update_user_memory", args, session);
      },
    }),

    web_search: tool({
      description:
        "Search the web for information not in the product manual. Use for prices, accessories, comparisons, community tips, troubleshooting forums, or any question the manual doesn't cover.",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        num_results: z.number().optional().describe("Number of results to fetch (default 3, max 5)"),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("web_search", args, session);
      },
    }),

    guided_troubleshoot: tool({
      description:
        "Launch an interactive troubleshooting wizard. Use when the user describes a problem. For pre-built flows (porosity, wire feed, no arc, spatter), the system has data. For other issues, provide a custom_flow.",
      inputSchema: z.object({
        issue: z.string().describe("The issue to troubleshoot"),
        custom_flow: z.object({
          title: z.string(),
          steps: z.record(z.string(), z.object({
            question: z.string().optional(),
            options: z.array(z.object({ label: z.string(), next: z.string() })).optional(),
            type: z.string().optional(),
            title: z.string().optional(),
            fix: z.string().optional(),
            reference: z.string().optional(),
          })),
        }).optional().describe("Optional: provide a custom troubleshooting flow"),
      }),
      execute: async (args) => {
        return executeUploadedToolHandler("guided_troubleshoot", args, session);
      },
    }),
  };
}
