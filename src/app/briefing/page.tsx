"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/components/favorites";

export default function BriefingPage() {
  const { favs } = useFavorites();
  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const retries = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(() => {
    setErr("");
    fetch(`/api/briefing?favorites=${encodeURIComponent(favs.join(","))}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) return setErr(j.error);
        setB(j);
        if (j.degraded && retries.current < 3) {
          retries.current++;
          setTimeout(load, 9000);
        }
      })
      .catch((e) => setErr(e.message));
  }, [favs]);

  useEffect(() => {
    if (!ready) return;
    retries.current = 0;
    setB(null);
    load();
  }, [ready, favs.join(","), load]);

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <p className="label">Auto-generated daily · {new Date().toLocaleDateString()}</p>
      <h1 className="page-title">The Briefing</h1>
      <p className="lede">
        {favs.length ? `Personalized for ${favs.join(", ")}.` : "Star teams on the Teams page to personalize this."}
      </p>

      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {!b && !err && (
        <p style={{ marginTop: 20 }}>
          <span className="spin" /> writing today&rsquo;s briefing…
        </p>
      )}

      {b && (
        <div className="fade-in" style={{ marginTop: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 28, margin: 0 }}>{b.headline}</h2>
            {b.degraded && <span className="pill" style={{ color: "var(--amber)", borderColor: "var(--amber)" }}>AI catching up…</span>}
          </div>

          {b.yourTeams?.length > 0 && (
            <div className="card accent" style={{ margin: "18px 0" }}>
              <p className="label">Your teams</p>
              {b.yourTeams.map((t: any, i: number) => (
                <p key={i} className="prose" style={{ marginTop: i ? 8 : 4 }}>
                  <b>{t.team}.</b> {t.note}
                </p>
              ))}
            </div>
          )}

          <p className="label section-label">Today&rsquo;s biggest stories</p>
          <div className="grid" style={{ gap: 12 }}>
            {b.topStories?.map((s: any, i: number) => (
              <div key={i} className="card">
                <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>
                  <span className="mono" style={{ color: "var(--red)", fontSize: 13 }}>{String(i + 1).padStart(2, "0")}</span>
                  &nbsp;&nbsp;{s.title}
                </div>
                <p className="prose" style={{ marginTop: 6, color: "var(--ink-soft)" }}>{s.detail}</p>
              </div>
            ))}
          </div>

          <p className="label section-label">Games to watch</p>
          <div className="grid g2" style={{ gap: 12 }}>
            {b.gamesToWatch?.map((g: any, i: number) => (
              <div key={i} className="card">
                <div style={{ fontWeight: 600 }}>{g.matchup}</div>
                <p className="prose" style={{ marginTop: 4, fontSize: 14.5, color: "var(--ink-soft)" }}>{g.why}</p>
              </div>
            ))}
          </div>

          {b.outlook && (
            <div className="card" style={{ marginTop: 22, borderColor: "var(--ink)" }}>
              <p className="label">Outlook</p>
              <p className="prose serif" style={{ fontSize: 17 }}>{b.outlook}</p>
            </div>
          )}

          <p className="label" style={{ marginTop: 22 }}>
            generated {b.generatedAt ? new Date(b.generatedAt).toLocaleTimeString() : "just now"} ·{" "}
            <Link href="/chat" className="ul">ask a follow-up →</Link>
          </p>
        </div>
      )}
    </div>
  );
}
