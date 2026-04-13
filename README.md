# Prox AI — Multimodal Product Support Agent

<img src="product.webp" alt="Vulcan OmniPro 220" width="400" /> <img src="product-inside.webp" alt="Vulcan OmniPro 220 — inside panel" width="400" />

A multimodal AI agent that turns dense product manuals into an interactive support experience. Built for the Vulcan OmniPro 220 multiprocess welder, but designed to work with any uploaded product manual.

## Quick Start

```bash
git clone <your-fork>
cd prox-challenge
cp .env.example .env        # Add your ANTHROPIC_API_KEY
npm install
npm run dev                  # → http://localhost:3000
```

The only required environment variable is `ANTHROPIC_API_KEY`.

## How It Works

### Architecture Overview

```
User Question
     │
     ▼
┌─────────────┐     ┌──────────────────┐
│  Next.js UI │────▶│  /api/chat       │
│  (React 18) │◀────│  (SSE stream)    │
└─────────────┘     └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Claude Sonnet 4 │
                    │  (Vercel AI SDK) │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ search   │  │ show     │  │ render   │
        │ manual  │  │  manual  │  │  artifact│
        │          │  │ image   │  │          │
        └────┬─────┘  └──────────┘  └──────────┘
             │
     ┌───────▼───────┐
     │  2-Stage      │
     │  Retrieval    │
     │  grep → TF-IDF│
     └───────────────┘
```

The system streams responses via Server Sent Events (SSE). Claude calls tools as it reasons, and each tool result (text, images, artifacts) is emitted as a separate SSE event. The frontend renders them in realt ime — text streams in, images appear as they're found, artifacts render in sandboxed iframes.

## Knowledge Extraction & Representation

### How the Manual Becomes Searchable

The 48 page PDF is pre-processed into four structured knowledge layers:

| Layer                | File                                  | What it contains                                                                                                    |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Text chunks**      | `knowledge/text-chunks.json`          | Every page split into semantic sections with keywords extracted per chunk                                           |
| **Image catalog**    | `knowledge/image-catalog.json`        | Manual images tagged with descriptions and searchable metadata (polarity diagrams, weld quality photos, schematics) |
| **Selection charts** | `knowledge/selection-chart-data.json` | Structured welding parameter data: process, material, thickness → wire, gas, voltage, wire speed                    |
| **Duty cycles**      | `knowledge/duty-cycles.json`          | Structured duty cycle matrices: process, input voltage → rated amps, duty cycle %, continuous amps                  |

Pre-processing runs once via `npm run prepare-knowledge`. The structured data means Claude doesn't have to parse tables from raw PDF text at query time itgets clean, queryable data.

### Why This Structure

Separating structured data (selection charts, duty cycles) from free text was a deliberate choice. When someone asks "What settings for 1/8 inch mild steel MIG?", the agent queries the selection chart directly and gets exact numbers. If that same data lived in a text chunk, the model would have to extract values from prose which is slower, less reliable, and prone to hallucination.

The image catalog with semantic tags means the agent can find "the polarity diagram for TIG" without doing image recognition at query time. The tags were created during knowledge preparation, not at runtime.

## 2 Stage Retrieval: Grep → TF-IDF Rerank

This was the most important design decision. Pure keyword search misses conversational queries ("how do I fix spatter" won't match "excessive spatter can be reduced by adjusting voltage"). But embedding based search adds latency, cost, and an external API dependency.

The solution is a two-stage pipeline that runs entirely in-process:

```
Query: "how do I fix spatter"-
         │
         ▼
┌─────────────────────────┐
│  Stage 1: Grep Search   │
│  Regex + keyword match  │
│  → Top 10 chunks        │
│  → Extract page numbers │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Page Expansion         │
│  Grab ALL chunks from   │
│  matched pages          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Stage 2: TF-IDF Rerank │
│  Tokenize → TF → IDF   │
│  → Cosine similarity    │
│  → Return top 5         │
└─────────────────────────┘
```

**Why this works better than grep alone:** Grep finds the right pages (it's good at exact matches). But the best chunk on that page might not contain the exact query terms it might use synonyms or related terminology. TF-IDF reranking scores every chunk from those pages against the query semantically, surfacing the most relevant content even without exact keyword overlap.

**Why not embeddings:** Embedding APIs add ~200ms latency per query, require an API key, and cost money. TF-IDF over 10-20 chunks takes <5ms and runs locally. For a corpus this size, the quality difference is negligible.

The grep search itself is nonbtrivial, it supports quoted phrase matching, stem/partial matching ("volt" matches "voltage"), keyword bonuses, section title bonuses, and density normalization (shorter, focused chunks rank higher than long ones with sparse matches).

## Multimodal Response System

### Artifacts (Interactive Components)

When a text answer isn't enough, Claude generates selfbcontained React components that render in a sandboxed iframe. The sandbox provides React 18, Tailwind CSS, and Lucide icons no build step required. Claude's code is compiled at runtime via Babel Standalone.

Examples of what the agent generates:

- **Polarity questions** → SVG connection diagram with material selector (Steel vs Aluminum toggles change the displayed wiring)
- **Settings questions** → Interactive configurator with dropdowns for process, material, thickness
- **Duty cycle questions** → Visual calculator showing weld/rest times
- **Troubleshooting** → Interactive diagnostic flowcharts with clickable yes/no decision trees

The sandbox handles Claude's code patterns (stripping `import`/`export` statements, discovering components by PascalCase name) so artifacts render reliably.

### Troubleshooting Wizards

Pre built interactive troubleshooting flows for common issues (porosity, wire feed problems, no arc, excessive spatter) render as step by step diagnostic trees. For issues without a pre built flow, Claude generates a custom diagnostic tree on the fly using the `guided_troubleshoot` tool.

### Manual Images

The agent can surface specific images from the manual, polarity diagrams, weld quality reference photos, internal mechanism photos. Images are tagged and searchable, so "show me the TIG polarity setup" finds the right diagram.

## Tools Available to the Agent

| Tool                       | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `search_manual`            | 2 stage retrieval against the knowledge base   |
| `show_manual_image`        | Surface tagged manual images                   |
| `get_selection_chart_data` | Query structured welding parameters            |
| `get_duty_cycle_data`      | Query structured duty cycle data               |
| `render_artifact`          | Generate interactive React/SVG/HTML components |
| `guided_troubleshoot`      | Launch interactive diagnostic flowcharts       |
| `web_search`               | Search the web for info not in the manual      |
| `update_user_memory`       | Persist user preferences across conversations  |

## Beyond the Vulcan: Any Product Manual

The system isn't hardcoded to the Vulcan OmniPro 220. Users can:

1. **Upload a PDF** — extracted, chunked, and indexed in-memory with the same 2 stage retrieval
2. **Paste a product URL** — the web scraper fetches the page, extracts content, and builds a searchable knowledge base
3. **Preview the document** — full PDF viewer with page navigation and zoom before starting a chat

Uploaded products get the same tool suite (search, artifacts, troubleshooting, web search) with a tailored system prompt.

## Image Input in Chat

Users can attach photos directly in the chat snap a picture of a weld bead, machine panel, error indicator, or wire feed issue and ask "what's wrong?" Claude analyzes the image using its vision capabilities alongside the manual knowledge base, enabling visual troubleshooting that text alone can't match.

- Attach multiple images per message (up to 5MB each)
- Images display inline in the conversation
- Works alongside text input — describe what you see while showing the photo

## Voice & Multilingual Support

- **Voice input** — Browser Speech Recognition API for hands free questions (useful when your hands are covered in welding flux)
- **Voice output** — Browser Speech Synthesis with language matched voices (BCP 47 language tags)
- **8 languages** — English, Spanish, French, German, Portuguese, Chinese, Japanese, Korean. The UI, system prompts, and responses adapt. Artifacts render with translated labels while keeping code in JavaScript.

## User Memory

The agent learns about users across conversations:

- **Expertise level** — adjusts language complexity (beginner gets jargon explained, expert gets concise technical answers)
- **Preferred detail level** — concise vs thorough
- **Frequent topics** — personalizes suggestions
- **Custom notes** — remembers context ("works primarily with aluminum", "runs a small fabrication shop")

Memory persists in the browser via localStorage.

## Tech Stack

| Layer          | Technology                                              |
| -------------- | ------------------------------------------------------- |
| Framework      | Next.js 14 (App Router)                                 |
| AI             | Claude Sonnet 4 via Vercel AI SDK (`@ai-sdk/anthropic`) |
| Streaming      | Server-Sent Events (SSE)                                |
| Artifacts      | Sandboxed iframe + Babel Standalone + React 18 UMD      |
| Styling        | Tailwind CSS                                            |
| PDF Processing | `pdf-parse` (server), `pdfjs-dist` (client viewer)      |
| Web Scraping   | `cheerio` for HTML extraction                           |
| Voice          | Web Speech API (Recognition + Synthesis)                |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts           # Main chat endpoint (SSE streaming)
│   │   ├── upload/route.ts         # PDF upload + extraction
│   │   ├── search-product/         # Web scraper endpoints
│   │   ├── session-preview/        # Document preview data
│   │   └── session-document/       # Serve uploaded PDFs
│   └── page.tsx                    # Main app page
├── components/
│   ├── artifacts/
│   │   ├── sandbox-iframe.tsx      # Sandboxed artifact renderer
│   │   ├── artifact-renderer.tsx   # Artifact display wrapper
│   │   └── image-display.tsx       # Manual image display
│   └── chat/
│       ├── chat-container.tsx      # Main chat logic + SSE handling
│       ├── message-bubble.tsx      # Message rendering (markdown + media)
│       ├── content-preview.tsx     # PDF viewer for uploaded docs
│       ├── voice-input-button.tsx  # Speech recognition
│       └── voice-output-button.tsx # Speech synthesis
├── hooks/
│   ├── use-speech-recognition.ts   # Web Speech API wrapper
│   ├── use-speech-synthesis.ts     # TTS with language support
│   ├── use-user-memory.ts          # Persistent user preferences
│   └── use-language.ts             # i18n state management
├── lib/
│   ├── semantic-search.ts          # 2-stage retrieval (grep → TF-IDF)
│   ├── grep-search.ts             # Regex search with scoring
│   ├── knowledge.ts               # Knowledge base access layer
│   ├── tools.ts                   # Tool definitions (Vercel AI SDK)
│   ├── tool-handlers.ts          # Tool execution logic
│   ├── system-prompt.ts          # System prompts (Vulcan + uploaded products)
│   ├── troubleshooting-renderer.ts # React code generator for diagnostic flows
│   ├── web-scraper.ts            # URL content extraction
│   └── session-store.ts          # In-memory session management
└── knowledge/
    ├── text-chunks.json           # Searchable manual text
    ├── image-catalog.json         # Tagged manual images
    ├── selection-chart-data.json  # Structured welding parameters
    ├── duty-cycles.json           # Structured duty cycle data
    └── troubleshooting/           # Pre-built diagnostic flows
```

## Design Decisions & Tradeoffs

**Local TF-IDF over external embeddings.** The corpus is small (~200 chunks). TF-IDF + cosine similarity gives good-enough reranking at zero latency and zero cost. If the corpus grew to thousands of documents, embeddings would be worth the tradeoff.

**Pre-structured data over runtime extraction.** Selection charts and duty cycles are extracted once into clean JSON. This means Claude gets exact numbers instead of parsing tables from PDF text. The cost is a one time preparation step, but the accuracy gain is significant.

**Sandboxed iframes over direct DOM rendering.** Artifacts run in a sandboxed iframe with `allow-scripts` only. This isolates Claude's generated code from the main app, no access to cookies, localStorage, or the parent DOM. Security without sacrificing interactivity.

**SSE over WebSockets.** The chat uses Server-Sent Events, not WebSockets. SSE is simpler, works over standard HTTP, and is sufficient for the unidirectional streaming pattern (server → client). No connection management overhead.

**Browser APIs over cloud services for voice.** Speech recognition and synthesis use the Web Speech API built into browsers. No additional API keys, no per request costs, no latency. The tradeoff is browser compatibility (works in Chrome/Edge, limited in Firefox/Safari), but for a demo this is the right call.

**Single API key.** The entire system runs on one `ANTHROPIC_API_KEY`. No OpenAI, no Pinecone, no external vector DB. This keeps deployment simple and costs predictable.

## Product Demo

**[https://drive.google.com/file/d/1fv4UcYR-L0aIRYSd78Oim_uIvquO40Yb/view?usp=drive_link](https://drive.google.com/file/d/1fv4UcYR-L0aIRYSd78Oim_uIvquO40Yb/view?usp=drive_link)**

## Live Demo

**[https://prox-challenge-five.vercel.app/](https://prox-challenge-five.vercel.app/)**
