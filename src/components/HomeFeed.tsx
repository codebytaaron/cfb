"use client";
import { useEffect, useState } from "react";

export function LiveFeed() {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/events?limit=8")
        .then((r) => r.json())
        .then((j) => setEvents(j.events || []))
        .catch(() => {});
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, []);

  if (!events.length)
    return (
      <p className="prose" style={{ color: "var(--ink-soft)" }}>
        No AI events yet. The pipeline records score changes, finals, ranking moves and
        breaking news the moment the data shifts. Trigger it any time at{" "}
        <span className="mono">/api/cron/refresh</span>.
      </p>
    );

  return (
    <div className="grid" style={{ gap: 12 }}>
      {events.map((e, i) => (
        <div key={i} className="card fade-in">
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span className={`pill ${e.importance?.toLowerCase()}`}>{e.importance}</span>
            {e.team && <span className="label">{e.team}</span>}
            <span className="label" style={{ marginLeft: "auto" }}>
              {new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{e.headline}</div>
          {e.body && <p className="prose" style={{ marginTop: 6 }}>{e.body}</p>}
        </div>
      ))}
    </div>
  );
}

export function HomeRankings() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/power-rankings")
      .then((r) => r.json())
      .then((j) => (j.rows ? setRows(j.rows.slice(0, 10)) : setErr(j.error || "unavailable")))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="prose" style={{ color: "var(--red)" }}>{err}</p>;
  if (!rows.length) return <span className="spin" />;

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Team</th>
          <th>Rec</th>
          <th>Elo</th>
          <th>Why (AI)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.team} className="fade-in">
            <td className="rk">{r.rank}</td>
            <td style={{ fontWeight: 600 }}>{r.team}</td>
            <td className="mono">{r.wins}-{r.losses}</td>
            <td className="mono">{r.elo}</td>
            <td style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>{r.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AskInline() {
  const [q, setQ] = useState("");
  return (
    <form
      action="/chat"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = `/chat?q=${encodeURIComponent(q)}`;
      }}
      style={{ display: "flex", gap: 10, maxWidth: 560, margin: "0 auto" }}
    >
      <input
        placeholder="Ask about any team, game or ranking…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button className="btn" type="submit">
        Ask
      </button>
    </form>
  );
}
