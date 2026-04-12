"use client";

import type { ChatSession } from "@/lib/types";
import { Plus, Trash2, X, MessageSquare } from "lucide-react";

interface ChatSidebarProps {
  open: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  t: (key: string) => string;
}

function groupSessions(sessions: ChatSession[]): { label: string; sessions: ChatSession[] }[] {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups: Record<string, ChatSession[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const s of sessions) {
    if (s.updatedAt >= todayStart.getTime()) groups.today.push(s);
    else if (s.updatedAt >= yesterdayStart.getTime()) groups.yesterday.push(s);
    else if (s.updatedAt >= weekStart.getTime()) groups.previous7Days.push(s);
    else groups.older.push(s);
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ label: key, sessions: list }));
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ChatSidebar({
  open,
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewChat,
  onClose,
  t,
}: ChatSidebarProps) {
  const groups = groupSessions(sessions);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-full flex flex-col bg-surface-900/95 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 ${
          open ? "w-72 translate-x-0" : "w-0 -translate-x-full md:translate-x-0"
        } overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
            {t("conversations")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewChat}
              className="p-1.5 rounded-lg text-brand-300/50 hover:text-brand-300 hover:bg-white/5 transition-colors"
              title={t("newChat")}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-white/20 text-xs">
              <MessageSquare className="w-5 h-5 mb-2" />
              {t("noHistory")}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] font-medium text-white/25 uppercase tracking-wider px-4 py-1">
                  {t(group.label)}
                </p>
                {group.sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelect(session)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-2 group transition-colors ${
                      activeSessionId === session.id
                        ? "bg-brand-600/10 text-white"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/70"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{session.title}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">
                        {session.productName} · {relativeTime(session.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                      title={t("deleteChat")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
