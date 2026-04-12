"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, File, Loader2, Search, Globe } from "lucide-react";

interface UploadResult {
  sessionId: string;
  productName: string;
  filesProcessed: number;
  chunksCreated: number;
  imagesStored: number;
}

interface SearchResult {
  sessionId: string;
  productName: string;
  source: string;
  chunksCreated: number;
}

interface FileUploadProps {
  onUploadComplete: (session: UploadResult | SearchResult) => void;
  onCancel: () => void;
}

type Mode = "search" | "upload";

const ACCEPTED_EXTENSIONS = [
  ".pdf", ".txt", ".md", ".html", ".htm", ".csv",
  ".docx", ".jpg", ".jpeg", ".png", ".webp", ".gif",
];

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    return <Image className="w-4 h-4 text-purple-400" />;
  }
  if (["pdf", "docx", "txt", "md", "html", "csv"].includes(ext || "")) {
    return <FileText className="w-4 h-4 text-brand-400" />;
  }
  return <File className="w-4 h-4 text-white/30" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function FileUpload({ onUploadComplete, onCancel }: FileUploadProps) {
  const [mode, setMode] = useState<Mode>("search");
  const [files, setFiles] = useState<File[]>([]);
  const [productName, setProductName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const unique = arr.filter((f) => !names.has(f.name));
      return [...prev, ...unique];
    });
    setError(null);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUpload = async () => {
    if (!files.length) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("productName", productName || "Uploaded Product");
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onUploadComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setError(null);

    try {
      const res = await fetch("/api/search-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }

      onUploadComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !searching) {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Add a product
            </h3>
            <p className="text-xs text-white/30 mt-0.5">
              Search the web or upload your manual
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white/30 hover:text-white/60 p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => { setMode("search"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 text-sm py-3 transition-colors ${
              mode === "search"
                ? "text-white font-medium border-b-2 border-brand-500"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            <Globe className="w-4 h-4" />
            Search by name
          </button>
          <button
            onClick={() => { setMode("upload"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 text-sm py-3 transition-colors ${
              mode === "upload"
                ? "text-white font-medium border-b-2 border-brand-500"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload files
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mode === "search" ? (
            <>
              {/* Search by product name */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">
                  Product name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="e.g., DeWalt DWS780 Miter Saw"
                    className="flex-1 text-sm border border-white/10 rounded-lg px-3 py-2 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent placeholder:text-white/25"
                    disabled={searching}
                  />
                </div>
              </div>

              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
                <p className="text-xs text-white/30 leading-relaxed">
                  We&apos;ll search the web for the product manual, download it, and
                  extract the content so you can start chatting. This works best
                  with products that have manuals available online.
                </p>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm text-white/50 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:bg-white/5 disabled:text-white/20 rounded-xl px-4 py-2.5 transition-all"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Find Manual
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Upload mode */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-1.5">
                  Product name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., DeWalt DWS780 Miter Saw"
                  className="w-full text-sm border border-white/10 rounded-lg px-3 py-2 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent placeholder:text-white/25"
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-brand-500/50 bg-brand-500/5"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                }`}
              >
                <Upload
                  className={`w-6 h-6 mx-auto mb-2 ${
                    dragOver ? "text-brand-400" : "text-white/25"
                  }`}
                />
                <p className="text-sm text-white/50">
                  Drop files here or{" "}
                  <span className="text-brand-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-white/25 mt-1">
                  PDF, DOCX, TXT, MD, HTML, CSV, or images &middot; Max 20MB
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]"
                    >
                      {getFileIcon(file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">{file.name}</p>
                        <p className="text-xs text-white/30">{formatSize(file.size)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="text-white/25 hover:text-white/50 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm text-white/50 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!files.length || uploading}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:bg-white/5 disabled:text-white/20 rounded-xl px-4 py-2.5 transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Upload & Start</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
