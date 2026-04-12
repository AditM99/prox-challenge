"use client";

import { useEffect, useRef, useState } from "react";

interface ImageDisplayProps {
  url: string;
  description: string;
  pageNumber?: number;
}

export default function ImageDisplay({
  url,
  description,
  pageNumber,
}: ImageDisplayProps) {
  const isPdfPage = url.includes("/api/pdf-page");

  return (
    <div className="my-3 rounded-xl border border-white/[0.06] overflow-hidden glass animate-fade-in">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">{description}</span>
        {pageNumber !== undefined && pageNumber > 0 && (
          <span className="text-xs text-brand-300/50 bg-brand-500/10 px-2 py-0.5 rounded">
            Page {pageNumber}
          </span>
        )}
      </div>
      <div className="p-2 flex justify-center bg-white/[0.02]">
        {isPdfPage ? (
          <PdfPageViewer url={url} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt={description}
            className="max-w-full h-auto rounded"
            style={{ maxHeight: "500px" }}
          />
        )}
      </div>
    </div>
  );
}

function PdfPageViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const urlObj = new URL(url, window.location.origin);
        const pageNum = parseInt(urlObj.searchParams.get("page") || "1");

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(pageNum);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render PDF page");
          setLoading(false);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4">
        Failed to load PDF page: {error}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-400/50 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded"
        style={{ maxHeight: "600px", display: loading ? "none" : "block" }}
      />
    </div>
  );
}
