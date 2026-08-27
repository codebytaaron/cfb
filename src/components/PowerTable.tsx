"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

export default function PowerTable() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/power-rankings")
      .then((r) => r.json())
      .then((j) => (j.rows ? setData(j) : setErr(j.error || "unavailable")))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="prose" style={{ color: "var(--red)" }}>Model error: {err}</p>;
  if (!data) return <p><span className="spin" /> computing model & generating explanations…</p>;

  const preseason = data.rows.every((r: any) => r.wins + r.losses === 0);

  return (
    <>
      <p className="prose" style={{ color: "var(--ink-soft)", marginBottom: 14 }}>
        {preseason
          ? "Preseason: no games played yet — ranked on carry-over Elo and SP+ from last season. Full model (point differential, strength of schedule, quality wins, bad losses) kicks in week 1. "
          : "Model inputs: latest Elo, SP+ rating, win %, per-game point differential, strength of schedule, quality wins and bad losses. "}
        Generated {new Date(data.generatedAt).toLocaleString()}.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
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
              <tr
                className="fade-in"
                style={{ cursor: "pointer" }}
                onClick={() => setOpenRow(openRow === r.team ? null : r.team)}
              >
                <td className="rk">{r.rank}</td>
                <td style={{ fontWeight: 600 }}>
                  <Link href={`/teams/${encodeURIComponent(r.team)}`} onClick={(e) => e.stopPropagation()}>
                    {r.team}
                  </Link>
                </td>
                <td className="big-num" style={{ fontSize: 16 }}>{r.score}</td>
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
                  <td colSpan={preseason ? 4 : 8} style={{ background: "var(--paper)" }}>
                    <div className="prose fade-in">{r.note || "No explanation generated for this team."}</div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  );
}
