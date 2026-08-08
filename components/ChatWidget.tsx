"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 5;

export default function ChatWidget({
  contentId,
  chapterTitle,
  initialRemaining,
  initialMessages,
}: {
  contentId: string;
  chapterTitle: string;
  initialRemaining: number;
  initialMessages: ChatMessage[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const quotaEmpty = remaining <= 0;

  async function send() {
    const text = input.trim();
    if (!text || streaming || quotaEmpty) return;

    setInput("");
    setNotice(null);
    setStreaming(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/chat/${contentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!res.ok || !contentType.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) setRemaining(0);
        setNotice(data.error ?? "Gagal mengirim pesan. Coba lagi ya.");
        setMessages((m) => m.slice(0, -1)); // buang bubble assistant kosong
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          let payload: { delta?: string; done?: boolean; remaining?: number; error?: string };
          try {
            payload = JSON.parse(line.slice(5));
          } catch {
            continue;
          }

          if (payload.delta) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + payload.delta };
              return copy;
            });
          }
          if (payload.error) {
            setNotice(payload.error);
            setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
          }
          if (payload.done && typeof payload.remaining === "number") {
            setRemaining(payload.remaining);
          }
        }
      }
    } catch {
      setNotice("Tidak bisa terhubung ke server. Coba lagi ya.");
      setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
    }
    setStreaming(false);
  }

  return (
    <>
      {/* Tombol floating */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white shadow-2xl shadow-brand-500/40 transition hover:scale-105 hover:bg-brand-600"
        aria-label="Buka chat tutor AI"
      >
        {open ? "✕" : <i className="bi bi-chat-dots-fill"></i>}
      </button>

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[520px] w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-sm bg-white shadow-2xl ring-1 ring-slate-200">
          {/* Header */}
          <div className="bg-ink-900 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                  ✦
                </div>
                <div>
                  <p className="text-sm font-bold text-light">Tutor AI</p>
                  <p className="line-clamp-1 text-[10px] text-light-muted">{chapterTitle}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${quotaEmpty ? "bg-rose-500/20 text-rose-300" : "bg-mint/15 text-mint"
                  }`}
              >
                {remaining}/{MAX_MESSAGES} kuota
              </span>
            </div>
          </div>

          {/* Pesan */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 && (
              <div className="rounded-2xl bg-white p-4 text-xs leading-relaxed text-slate-500 shadow-card">
                👋 Halo! Aku tutor AI untuk bab ini. Tanyakan apa pun seputar materinya —
                kamu punya <b>{remaining} pertanyaan</b>. Kuota reset tiap kamu lulus kuis bab ini.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${m.role === "user"
                  ? "ml-auto bg-brand-500 text-white"
                  : "bg-white text-slate-700 shadow-card"
                  }`}
              >
                {m.content}
                {m.role === "assistant" &&
                  m.content === "" &&
                  streaming &&
                  i === messages.length - 1 && (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:240ms]" />
                    </span>
                  )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Notice + input */}
          <div className="border-t border-slate-100 bg-white p-3">
            {notice && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {notice}
              </p>
            )}
            {quotaEmpty ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-center text-[11px] font-medium text-rose-600">
                <i className="bi bi-lock"></i> Kuota habis — selesaikan kuis bab ini (skor ≥ 70) untuk reset kuota.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  disabled={streaming}
                  placeholder="Tanya seputar materi bab ini..."
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                />
                <button
                  onClick={send}
                  disabled={streaming || !input.trim()}
                  className="rounded-xl bg-brand-500 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  ➤
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
