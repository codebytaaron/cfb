"use client";
import { useState } from "react";

export default function ExplainButton({
  topic,
  data,
}: {
  topic: string;
  data?: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [depth, setDepth] = useState<"quick" | "normal" | "deep">("normal");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(d: typeof depth) {
    setDepth(d);
    setOpen(true);
    setLoading(true);
    setText("");
    try {
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, data, depth: d }),
      });
      const j = await r.json();
      setText(j.text || j.error || "No explanation available.");
    } catch (e: any) {
      setText(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!open && (
        <button className="btn ghost" style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => run("normal")}>
          ✦ Explain this
        </button>
      )}
      {open && (
        <div className="card fade-in" style={{ background: "var(--paper)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["quick", "normal", "deep"] as const).map((d) => (
              <button
                key={d}
                onClick={() => run(d)}
                className="pill"
                style={{
                  cursor: "pointer",
                  background: depth === d ? "var(--ink)" : "transparent",
                  color: depth === d ? "#fff" : "var(--ink-soft)",
                }}
              >
                {d}
              </button>
            ))}
            <button className="pill" style={{ cursor: "pointer", marginLeft: "auto" }} onClick={() => setOpen(false)}>
              close
            </button>
          </div>
          {loading ? <span className="spin" /> : <div className="prose">{text}</div>}
        </div>
      )}
    </div>
  );
}
