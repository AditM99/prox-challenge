"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, SSEEvent, UserMemory } from "@/lib/types";
import MessageBubble from "./message-bubble";
import FileUpload from "./file-upload";
import SearchResults from "./search-results";
import VoiceInputButton from "./voice-input-button";
import ChatSidebar from "./chat-sidebar";
import ContentPreview from "./content-preview";
import { useUserMemory } from "@/hooks/use-user-memory";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { useLanguage } from "@/hooks/use-language";
import { SUGGESTED_QUESTIONS_I18N, SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n";
import {
  Send,
  RotateCcw,
  Package,
  ChevronRight,
  ArrowLeft,
  Search,
  Upload,
  Globe,
  Loader2,
  Sparkles,
  Zap,
  Languages,
  Menu,
} from "lucide-react";

const DEFAULT_PRODUCT = {
  name: "Vulcan OmniPro 220",
  category: "Multiprocess Welding System",
  image: "/product.webp",
};

interface ActiveProduct {
  name: string;
  category: string;
  image: string | null;
  sessionId: string | null;
}

type Screen = "welcome" | "preview" | "chat";

interface PendingProduct {
  sessionId: string;
  productName: string;
  category: string;
}

export default function ChatContainer() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const { memory: userMemory, updateMemory, incrementInteractionCount, addProduct } = useUserMemory();
  const { language, setLanguage, t } = useLanguage();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    loadMessages,
    saveMessages,
    deleteSession,
  } = useChatSessions();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const startChat = (product: ActiveProduct) => {
    setActiveProduct(product);
    setMessages([]);
    setScreen("chat");
    setShowUpload(false);
    addProduct(product.name);
    createSession(product.name, product.sessionId, product.category, product.image);
  };

  const goToWelcome = () => {
    setScreen("welcome");
    setActiveProduct(null);
    setMessages([]);
    setInput("");
    setToolStatus(null);
    setShowUpload(false);
    setActiveSessionId(null);
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading || !activeProduct || sendingRef.current) return;

    sendingRef.current = true;
    setInput("");
    setIsLoading(true);
    setToolStatus(null);
    incrementInteractionCount();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      images: [],
      artifacts: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: activeProduct.sessionId,
          userMemory,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr) as SSEEvent;

            switch (event.type) {
              case "text":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content += event.content;
                  }
                  return [...updated];
                });
                break;

              case "tool_call":
                setToolStatus(formatToolStatus(event.name));
                break;

              case "image":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.images = [
                      ...(last.images || []),
                      {
                        url: event.url,
                        description: event.description,
                        pageNumber: event.pageNumber,
                      },
                    ];
                  }
                  return [...updated];
                });
                break;

              case "artifact":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.artifacts = [
                      ...(last.artifacts || []),
                      {
                        type: event.artifactType,
                        title: event.title,
                        code: event.code,
                      },
                    ];
                  }
                  return [...updated];
                });
                break;

              case "memory_update":
                updateMemory((event as { type: "memory_update"; memory: Partial<UserMemory> }).memory);
                break;

              case "done":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.isStreaming = false;
                  }
                  return [...updated];
                });
                break;

              case "error":
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    last.content = `Error: ${event.message}`;
                    last.isStreaming = false;
                  }
                  return [...updated];
                });
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") {
          last.content = `Sorry, something went wrong. ${error instanceof Error ? error.message : "Please try again."}`;
          last.isStreaming = false;
        }
        return [...updated];
      });
    } finally {
      sendingRef.current = false;
      setIsLoading(false);
      setToolStatus(null);
      inputRef.current?.focus();
      // Save conversation to history
      if (activeSessionId) {
        setMessages((current) => {
          saveMessages(activeSessionId, current);
          return current;
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setToolStatus(null);
    if (activeProduct) {
      createSession(activeProduct.name, activeProduct.sessionId, activeProduct.category, activeProduct.image);
    }
  };

  const handleSelectSession = (session: import("@/lib/types").ChatSession) => {
    const msgs = loadMessages(session.id);
    setMessages(msgs);
    setActiveProduct({
      name: session.productName,
      category: session.productCategory || "",
      image: session.productImage || null,
      sessionId: session.productSessionId,
    });
    setActiveSessionId(session.id);
    setScreen("chat");
    setSidebarOpen(false);
    setInput("");
    setToolStatus(null);
  };

  const handleSidebarNewChat = () => {
    setSidebarOpen(false);
    goToWelcome();
  };

  const handleProductReady = (session: {
    sessionId: string;
    productName: string;
    filesProcessed?: number;
    chunksCreated: number;
    imagesStored?: number;
    source?: string;
  }) => {
    const category = session.source
      ? `Web manual · ${session.chunksCreated} sections`
      : `${session.filesProcessed} file${(session.filesProcessed || 0) > 1 ? "s" : ""} uploaded`;
    setPendingProduct({
      sessionId: session.sessionId,
      productName: session.productName,
      category,
    });
    setScreen("preview");
  };

  // ─── Preview Screen ───
  if (screen === "preview" && pendingProduct) {
    return (
      <ContentPreview
        sessionId={pendingProduct.sessionId}
        productName={pendingProduct.productName}
        onStartChat={() => {
          startChat({
            name: pendingProduct.productName,
            category: pendingProduct.category,
            image: null,
            sessionId: pendingProduct.sessionId,
          });
          setPendingProduct(null);
        }}
        onBack={() => {
          setPendingProduct(null);
          setScreen("welcome");
        }}
      />
    );
  }

  // ─── Welcome Screen ───
  if (screen === "welcome") {
    return (
      <WelcomeScreen
        onSelectVulcan={() =>
          startChat({
            name: DEFAULT_PRODUCT.name,
            category: DEFAULT_PRODUCT.category,
            image: DEFAULT_PRODUCT.image,
            sessionId: null,
          })
        }
        onProductReady={handleProductReady}
        showUpload={showUpload}
        setShowUpload={setShowUpload}
        t={t}
        language={language}
        setLanguage={setLanguage}
        showLangMenu={showLangMenu}
        setShowLangMenu={setShowLangMenu}
      />
    );
  }

  // ─── Chat Screen ───
  return (
    <div className="flex h-full">
      <ChatSidebar
        open={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onDelete={deleteSession}
        onNewChat={handleSidebarNewChat}
        onClose={() => setSidebarOpen(false)}
        t={t}
      />
      <div className="flex flex-col flex-1 h-full bg-chat min-w-0">
      {/* Top bar */}
      <header className="flex-shrink-0 glass border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-brand-300/60 hover:text-brand-300 p-1.5 -ml-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title={t("conversations")}
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={goToWelcome}
              className="text-brand-300/60 hover:text-brand-300 p-1.5 -ml-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title={t("back")}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            {/* Product badge */}
            <div className="flex items-center gap-2.5">
              {activeProduct?.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeProduct.image}
                  alt={activeProduct.name}
                  className="w-7 h-7 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-brand-600/20 border border-brand-500/20 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-brand-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  {activeProduct?.name}
                </p>
                <p className="text-[11px] text-brand-300/50 leading-tight">
                  {activeProduct?.category}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 text-brand-300/50 hover:text-brand-300 text-xs px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                title={t("language")}
              >
                <Languages className="w-3.5 h-3.5" />
                <span className="hidden sm:inline uppercase">{language}</span>
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 glass border border-white/10 rounded-xl py-1 z-50 min-w-[160px] shadow-xl">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${language === lang.code ? "text-brand-400" : "text-white/60"}`}
                    >
                      {lang.nativeName} <span className="text-white/30">({lang.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 text-brand-300/50 hover:text-brand-300 text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                title={t("newChat")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("newChat")}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.length === 0 ? (
            <ChatEmptyState
              product={activeProduct!}
              onQuestionClick={(q) => handleSend(q)}
              t={t}
              language={language}
            />
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} language={language} />)
          )}

          {toolStatus && isLoading && (
            <div className="flex items-center gap-2 text-sm text-brand-300/50 pl-11 animate-fade-in">
              <div className="w-3 h-3 border-2 border-brand-400/50 border-t-transparent rounded-full animate-spin" />
              {toolStatus}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 glass border-t border-white/[0.06] px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${t("askAnything")} ${activeProduct?.name}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent placeholder:text-white/30 transition-all"
              style={{ maxHeight: "120px" }}
              disabled={isLoading}
            />
            <VoiceInputButton
              onTranscript={(text) => {
                handleSend(text);
              }}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="bg-brand-600 hover:bg-brand-500 disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl p-3 transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 disabled:shadow-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/20 mt-2 text-center">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Chat Empty State (suggested questions) ───

function ChatEmptyState({
  product,
  onQuestionClick,
  t,
  language,
}: {
  product: ActiveProduct;
  onQuestionClick: (q: string) => void;
  t: (key: string) => string;
  language: LanguageCode;
}) {
  const isVulcan = product.sessionId === null;
  const suggestedQuestions = SUGGESTED_QUESTIONS_I18N[language] || SUGGESTED_QUESTIONS_I18N.en;

  return (
    <div className="flex flex-col items-center pt-8 pb-4 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30 animate-glow">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-1">
        {t("howCanIHelp")} {product.name}?
      </h2>
      <p className="text-sm text-white/40 mb-8 text-center max-w-md">
        {isVulcan ? t("vulcanDesc") : t("uploadedDesc")}
      </p>

      {isVulcan && (
        <div className="w-full max-w-lg">
          <p className="text-[11px] font-medium text-brand-300/40 uppercase tracking-wider mb-2.5 px-1">
            {t("tryAsking")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestedQuestions.map((question, i) => (
              <button
                key={i}
                onClick={() => onQuestionClick(question)}
                className="flex items-center justify-between text-left text-[13px] glass rounded-xl px-3.5 py-2.5 hover:bg-white/[0.06] transition-all text-white/60 hover:text-white/80 group"
              >
                <span className="line-clamp-2">{question}</span>
                <ChevronRight className="w-3.5 h-3.5 text-brand-400/30 group-hover:text-brand-400/60 flex-shrink-0 ml-2 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Welcome Screen ───

function WelcomeScreen({
  onSelectVulcan,
  onProductReady,
  showUpload,
  setShowUpload,
  t,
  language,
  setLanguage,
  showLangMenu,
  setShowLangMenu,
}: {
  onSelectVulcan: () => void;
  onProductReady: (session: {
    sessionId: string;
    productName: string;
    filesProcessed?: number;
    chunksCreated: number;
    imagesStored?: number;
    source?: string;
  }) => void;
  showUpload: boolean;
  setShowUpload: (v: boolean) => void;
  t: (key: string) => string;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  showLangMenu: boolean;
  setShowLangMenu: (v: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; snippet: string }[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);

    try {
      const res = await fetch("/api/search-product/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || "Search failed");
        return;
      }

      setSearchResults(data.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (url: string) => {
    setExtracting(true);
    setExtractingUrl(url);
    setExtractError(null);

    try {
      const res = await fetch("/api/search-product/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, productName: searchQuery.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error || "Extraction failed");
        return;
      }

      onProductReady(data);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleBackToSearch = () => {
    setSearchResults(null);
    setExtractError(null);
    setExtractingUrl(null);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  if (showUpload) {
    return (
      <div className="flex flex-col h-full bg-mesh">
        <div className="flex-1 flex items-center justify-center p-6">
          <FileUpload
            onUploadComplete={onProductReady}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      </div>
    );
  }

  // Show search results picker
  if (searchResults !== null) {
    return (
      <div className="flex flex-col h-full bg-mesh">
        <div className="flex-1 flex items-center justify-center p-6">
          <SearchResults
            results={searchResults}
            productName={searchQuery.trim()}
            onSelect={handleSelectResult}
            onBack={handleBackToSearch}
            onUpload={() => { setSearchResults(null); setShowUpload(true); }}
            extracting={extracting}
            extractingUrl={extractingUrl}
            error={extractError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mesh">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl animate-fade-in">
          {/* Logo + tagline */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/30">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-white text-2xl tracking-tight">
                prox
              </span>
            </div>
            <p className="text-white/40 text-sm">
              {t("aiSupport")}
            </p>
          </div>

          {/* Search bar */}
          <div className="mb-8">
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null); }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t("enterProduct")}
                    className="w-full text-sm border border-white/10 rounded-xl pl-10 pr-4 py-3 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent placeholder:text-white/25 transition-all"
                    disabled={searching}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="flex items-center gap-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:bg-white/5 disabled:text-white/20 rounded-xl px-5 py-3 transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 disabled:shadow-none"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {searching ? t("searching") : t("findManual")}
                  </span>
                </button>
              </div>
              {searchError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">
                  {searchError}
                </p>
              )}
              {searching && (
                <p className="text-xs text-brand-300/40 mt-2 px-1">
                  {t("searchingManual")}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/20 font-medium">{t("or")}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Featured product */}
            <button
              onClick={onSelectVulcan}
              className="w-full flex items-center gap-4 glass rounded-2xl p-4 hover:bg-white/[0.06] transition-all group text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DEFAULT_PRODUCT.image}
                alt={DEFAULT_PRODUCT.name}
                className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-brand-300 bg-brand-500/15 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    {t("demo")}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {DEFAULT_PRODUCT.name}
                </p>
                <p className="text-xs text-white/35">
                  {DEFAULT_PRODUCT.category} — {t("fullManual")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-brand-400/60 flex-shrink-0 transition-colors" />
            </button>

            {/* Upload manual */}
            <button
              onClick={() => setShowUpload(true)}
              className="w-full flex items-center gap-4 glass rounded-2xl p-4 hover:bg-white/[0.06] transition-all group text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-brand-600/10 border border-brand-500/15 flex items-center justify-center flex-shrink-0">
                <Upload className="w-6 h-6 text-brand-400/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {t("uploadManual")}
                </p>
                <p className="text-xs text-white/35">
                  {t("uploadFormats")}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-brand-400/60 flex-shrink-0 transition-colors" />
            </button>
          </div>

          {/* Footer */}
          {/* Language selector */}
          <div className="flex justify-center mt-6 mb-2">
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeName}
              </button>
              {showLangMenu && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 glass border border-white/10 rounded-xl py-1 z-50 min-w-[160px] shadow-xl">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${language === lang.code ? "text-brand-400" : "text-white/60"}`}
                    >
                      {lang.nativeName} <span className="text-white/30">({lang.name})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-white/15 text-center">
            {t("poweredBy")} {t("disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatToolStatus(toolName: string): string {
  switch (toolName) {
    case "search_manual":
      return "Searching product manual...";
    case "show_manual_image":
      return "Finding relevant diagrams...";
    case "get_selection_chart_data":
      return "Checking selection chart...";
    case "get_duty_cycle_data":
      return "Looking up duty cycle data...";
    case "render_artifact":
      return "Generating interactive content...";
    case "update_user_memory":
      return "Updating user profile...";
    case "web_search":
      return "Searching the web...";
    case "guided_troubleshoot":
      return "Building troubleshooting guide...";
    default:
      return "Working...";
  }
}
