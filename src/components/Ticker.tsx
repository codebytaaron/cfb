"use client";
import { useEffect, useState } from "react";

export default function Ticker() {
  const [items, setItems] = useState<string[]>([
    "Gridiron AI is monitoring the CollegeFootballData feed",
    "Event-driven analysis — the AI reacts only when something meaningful changes",
    "Ask the assistant anything about the season",
  ]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/events?limit=14");
        const j = await r.json();
        if (alive && j.events?.length) {
          setItems(
            j.events.map(
              (e: any) =>
                `${e.importance === "BREAKING" ? "🚨 " : ""}${e.headline}`,
            ),
          );
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const row = items.concat(items);
  return (
    <div className="ticker">
      <div className="ticker-track">
        {row.map((t, i) => (
          <span key={i}>
            <span className="dot">●</span> {t}
          </span>
        ))}
      </div>
    </div>
  );
}
