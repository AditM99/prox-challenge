"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  MessageSquare,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from "lucide-react";

interface PreviewData {
  productName: string;
  totalChunks: number;
  totalImages: number;
  source: string;
  documentType: "pdf" | "web" | "none";
  sourceUrl: string | null;
  hasOriginalFile: boolean;
}

interface ContentPreviewProps {
  sessionId: string;
  productName: string;
  onStartChat: () => void;
  onBack: () => void;
}

export default function ContentPreview({
  sessionId,
  productName,
  onStartChat,
  onBack,
}: ContentPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/session-preview?id=${sessionId}`);
        if (!res.ok) throw new Error("Failed to load preview");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-mesh items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin mb-3" />
        <p className="text-sm text-white/40">Loading document...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full bg-mesh items-center justify-center p-6">
        <p className="text-sm text-red-400 mb-4">{error || "No data available"}</p>
        <button
          onClick={onBack}
          className="text-sm text-brand-300/60 hover:text-brand-300 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  const documentUrl = data.hasOriginalFile
    ? `/api/session-document?id=${sessionId}`
    : data.sourceUrl;

  const canRenderPdf = data.documentType === "pdf" && documentUrl;

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex-shrink-0 glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-brand-300/50 hover:text-brand-300 p-1.5 -ml-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{data.productName}</p>
                <p className="text-[10px] text-white/30">
                  {data.totalChunks} sections extracted
                  {data.sourceUrl && " · from web"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-300/50 hover:text-brand-300 text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
            <button
              onClick={onStartChat}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl px-4 py-2 transition-all shadow-lg shadow-brand-600/20"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Start Chat
            </button>
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 overflow-hidden">
        {canRenderPdf ? (
          <PdfViewer url={documentUrl!} />
        ) : data.documentType === "web" && data.sourceUrl ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <p className="text-sm text-white/40 mb-4">
              This is a web page. Click below to view the source.
            </p>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm rounded-xl px-5 py-3 border border-white/10 transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Open Source Page
            </a>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            <p className="text-sm text-white/30">No document preview available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PDF Viewer ───

function PdfViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<unknown>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (cancelled) return;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;

    async function renderPage() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = await (pdf as any).getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("Failed to render page:", err);
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, currentPage, scale]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex-shrink-0 flex items-center justify-center gap-4 py-2 px-4 border-b border-white/[0.06] bg-black/20">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm text-white/60 min-w-[100px] text-center">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/10" />

        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          disabled={scale <= 0.5}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs text-white/40 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          disabled={scale >= 3}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-black/10">
        <canvas
          ref={canvasRef}
          className="shadow-2xl rounded-sm"
          style={{ maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
