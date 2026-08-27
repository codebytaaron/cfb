"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function PowerTable() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const retries = useRef(0);

  const load = useCallback(() => {
    fetch("/api/power-rankings")
      .then((r) => r.json())
      .then((j) => {
        if (!j.rows) return setErr(j.error || "unavailable");
        setData(j);
        if (j.degraded && retries.current < 3) {
          retries.current++;
          setTimeout(load, 9000);
        }
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <p className="prose" style={{ color: "var(--red)" }}>Model error: {err}</p>;
  if (!data) return <p><span className="spin" /> computing model &amp; generating explanations…</p>;

  const preseason = data.rows.every((r: any) => r.wins + r.losses === 0);
  const cols = preseason ? 4 : 8;

  return (
    <>
      <p className="prose" style={{ color: "var(--ink-soft)", marginBottom: 14, fontSize: 15 }}>
        {preseason
          ? "Preseason — no games yet. Ranked on carry-over Elo and SP+ from last season; the full model (point differential, strength of schedule, quality wins, bad losses) engages in week 1. "
          : "Model inputs: latest Elo, SP+, win %, per-game point differential, strength of schedule, quality wins, bad losses. "}
        Generated {new Date(data.generatedAt).toLocaleTimeString()}.
        {data.degraded && <span className="pill" style={{ marginLeft: 8, color: "var(--amber)", borderColor: "var(--amber)" }}>AI notes catching up…</span>}
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>Team</th>
              <th>Score</th>
              <th>Rec</th>
              <th>Elo</th>
              {!preseason && <th>Pt Diff</th>}
              {!preseason && <th>SoS</th>}
              {!preseason && <th>Trend</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r: any) => (
              <Fragment key={r.team}>
                <tr style={{ cursor: "pointer" }} onClick={() => setOpenRow(openRow === r.team ? null : r.team)}>
                  <td className="rk">{r.rank}</td>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/teams/${encodeURIComponent(r.team)}`} onClick={(e) => e.stopPropagation()}>
                      {r.team}
                    </Link>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{r.score}</td>
                  <td className="mono">{r.wins}-{r.losses}</td>
                  <td className="mono">{r.elo}</td>
                  {!preseason && (
                    <td className="mono" style={{ color: r.pointDiff >= 0 ? "var(--green)" : "var(--red)" }}>
                      {r.pointDiff > 0 ? "+" : ""}{r.pointDiff}
                    </td>
                  )}
                  {!preseason && <td className="mono">{r.sos || "—"}</td>}
                  {!preseason && (
                    <td className="mono" style={{ color: r.trend > 0 ? "var(--green)" : r.trend < 0 ? "var(--red)" : "var(--ink-soft)" }}>
                      {r.trend > 0 ? "▲" : r.trend < 0 ? "▼" : "–"} {Math.abs(r.trend)}
                    </td>
                  )}
                </tr>
                {openRow === r.team && (
                  <tr>
                    <td colSpan={cols} style={{ background: "var(--paper)" }}>
                      <div className="prose fade-in" style={{ fontSize: 15 }}>
                        {r.note || "Explanation is generating — check back in a moment."}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="label" style={{ marginTop: 10 }}>tap a row for the AI explanation</p>
    </>
  );
}
