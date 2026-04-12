"use client";

import { ArrowLeft, ExternalLink, FileText, Loader2, Upload } from "lucide-react";

interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResultsProps {
  results: SearchResultItem[];
  productName: string;
  onSelect: (url: string) => void;
  onBack: () => void;
  onUpload: () => void;
  extracting: boolean;
  extractingUrl: string | null;
  error: string | null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SearchResults({
  results,
  productName,
  onSelect,
  onBack,
  onUpload,
  extracting,
  extractingUrl,
  error,
}: SearchResultsProps) {
  return (
    <div className="w-full max-w-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          disabled={extracting}
          className="text-brand-300/60 hover:text-brand-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-white">
            Manuals found for &ldquo;{productName}&rdquo;
          </h2>
          <p className="text-xs text-white/30">
            Select a source to extract content from
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2.5">
        {results.slice(0, 3).map((result, i) => {
          const isExtracting = extracting && extractingUrl === result.url;
          const isDisabled = extracting && extractingUrl !== result.url;
          const hasFailed = !extracting && error && extractingUrl === result.url;

          return (
            <button
              key={i}
              onClick={() => onSelect(result.url)}
              disabled={extracting}
              className={`w-full text-left glass rounded-xl p-4 transition-all group ${
                isExtracting
                  ? "ring-1 ring-brand-500/30 bg-brand-500/5"
                  : isDisabled
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:bg-white/[0.06] cursor-pointer"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isExtracting ? "bg-brand-500/20" : "bg-white/5"
                }`}>
                  {isExtracting ? (
                    <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-brand-400/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 line-clamp-1 group-hover:text-white transition-colors">
                    {result.title || "Untitled page"}
                  </p>
                  <p className="text-[11px] text-brand-300/40 flex items-center gap-1 mt-0.5">
                    <ExternalLink className="w-3 h-3" />
                    {getDomain(result.url)}
                  </p>
                  {result.snippet && (
                    <p className="text-xs text-white/35 mt-1.5 line-clamp-2 leading-relaxed">
                      {result.snippet}
                    </p>
                  )}
                  {isExtracting && (
                    <p className="text-xs text-brand-300/50 mt-2">
                      Extracting content, this may take a moment...
                    </p>
                  )}
                  {hasFailed && (
                    <p className="text-xs text-red-400 mt-2">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fallback: upload instead */}
      <div className="mt-6 pt-4 border-t border-white/[0.06]">
        <button
          onClick={onUpload}
          disabled={extracting}
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors disabled:opacity-30"
        >
          <Upload className="w-3.5 h-3.5" />
          Can&apos;t find the right one? Upload a manual instead
        </button>
      </div>
    </div>
  );
}
