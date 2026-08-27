"use client";
import { useEffect, useState } from "react";

export default function GameAnalysis({ id }: { id: number }) {
  const [auto, setAuto] = useState("");
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch(`/api/ai/game?id=${id}`)
      .then((r) => r.json())
      .then((j) => setAuto(j.analysis || j.error || ""))
      .catch((e) => setAuto(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function ask(question: string) {
    if (!question.trim()) return;
    setAsking(true);
    setAns("");
    try {
      const r = await fetch(`/api/ai/game?id=${id}&q=${encodeURIComponent(question)}`);
      const j = await r.json();
      setAns(j.analysis || j.error || "");
    } catch (e: any) {
      setAns(e.message);
    }
    setAsking(false);
  }

  return (
    <div className="card" style={{ background: "var(--paper)" }}>
      <p className="label">AI game analyst</p>
      {loading ? (
        <p><span className="spin" /> reading the box score…</p>
      ) : (
        <div className="prose serif" style={{ fontSize: 18 }}>{auto}</div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 8px" }}>
        {["What just happened?", "What's the turning point?", "What does each team need to do?"].map((s) => (
          <button key={s} className="pill" style={{ cursor: "pointer" }} onClick={() => { setQ(s); ask(s); }}>
            {s}
          </button>
        ))}
      </div>
      <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input placeholder="Ask about this game…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" disabled={asking}>{asking ? "…" : "Ask"}</button>
      </form>
      {ans && <div className="prose fade-in" style={{ marginTop: 12 }}>{ans}</div>}
    </div>
  );
}
