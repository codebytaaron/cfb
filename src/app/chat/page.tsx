"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFavorites } from "@/components/favorites";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Who are the top five teams right now?",
  "What happened in college football today?",
  "Compare Oregon and Penn State.",
  "What does Georgia need to make the playoff?",
];

function Chat() {
  const params = useSearchParams();
  const { favs } = useFavorites();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, favorites: favs }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Error: ${e.message}` }]);
    }
    setBusy(false);
  }

  return (
    <div className="wrap section" style={{ borderTop: "none", maxWidth: 760 }}>
      <p className="label">Conversational · context-aware · retrieval-grounded</p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 40, margin: "6px 0 6px" }}>
        Ask Gridiron <span className="c-red">AI</span>
      </h1>
      <p className="prose" style={{ color: "var(--ink-soft)" }}>
        It pulls current records, rankings and results from the data API before answering, and
        remembers the thread — ask a follow-up with &ldquo;they&rdquo; and it knows who you mean.
      </p>

      <div
        ref={boxRef}
        style={{
          margin: "22px 0 14px",
          maxHeight: "56vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.length === 0 && (
          <div className="grid g2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="fade-in"
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              background: m.role === "user" ? "var(--ink)" : "var(--paper)",
              color: m.role === "user" ? "#fff" : "var(--ink)",
              border: m.role === "user" ? "none" : "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 16px",
            }}
          >
            <div className="prose" style={{ fontSize: 15.5, whiteSpace: "pre-wrap" }}>
              {m.content || (busy && i === messages.length - 1 ? <span className="spin" /> : "")}
            </div>
          </div>
        ))}
      </div>

      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input placeholder="Ask about any team, game, ranking or scenario…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn" disabled={busy}>{busy ? "…" : "Send"}</button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="wrap section"><span className="spin" /></div>}>
      <Chat />
    </Suspense>
  );
}
