"use client";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/favorites";

const FIELDS: [string, string, string][] = [
  ["biggestStrength", "Biggest strength", "c-green"],
  ["biggestWeakness", "Biggest weakness", "c-red"],
  ["playerToWatch", "Player / unit to watch", "c-blue"],
  ["mostImportantGame", "Most important game", "c-amber"],
  ["playoffOutlook", "Playoff outlook", "c-violet"],
];

export default function TeamReport({ team }: { team: string }) {
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState("");
  const { has, toggle } = useFavorites();

  useEffect(() => {
    setR(null);
    fetch(`/api/team-report?team=${encodeURIComponent(team)}`)
      .then((x) => x.json())
      .then((j) => (j.error ? setErr(j.error) : setR(j)))
      .catch((e) => setErr(e.message));
  }, [team]);

  return (
    <>
      <button className="btn ghost" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => toggle(team)}>
        {has(team) ? "★ Following" : "☆ Follow this team"}
      </button>

      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {!r && !err && <p style={{ marginTop: 16 }}><span className="spin" /> generating AI report…</p>}

      {r && (
        <div className="fade-in">
          {r.data?.record && (
            <div style={{ display: "flex", gap: 24, margin: "18px 0" }}>
              <div>
                <div className="big-num">{r.data.record.wins}-{r.data.record.losses}</div>
                <div className="label">record</div>
              </div>
              {r.data.powerRank && (
                <>
                  <div>
                    <div className="big-num">#{r.data.powerRank.rank}</div>
                    <div className="label">power rank</div>
                  </div>
                  <div>
                    <div className="big-num">{r.data.powerRank.elo}</div>
                    <div className="label">Elo</div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="card" style={{ background: "var(--paper)", marginBottom: 16 }}>
            <p className="label">Summary</p>
            <div className="prose serif" style={{ fontSize: 18 }}>{r.summary}</div>
          </div>

          <div className="grid g2">
            {FIELDS.filter(([k]) => r[k]).map(([k, label, cls]) => (
              <div key={k} className="card">
                <p className={`label ${cls}`} style={{ color: undefined }}>{label}</p>
                <div className="prose" style={{ marginTop: 4 }}>{r[k]}</div>
              </div>
            ))}
          </div>

          {r.data?.remainingSchedule?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="label">Remaining schedule</p>
              {r.data.remainingSchedule.map((s: any, i: number) => (
                <div key={i} className="kv">
                  <span>{s.opp}</span>
                  <span className="mono">wk {s.wk} · {String(s.when).slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="label" style={{ marginTop: 18 }}>
            generated {new Date(r.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </>
  );
}
