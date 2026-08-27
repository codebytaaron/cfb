"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/components/favorites";

export default function BriefingPage() {
  const { favs } = useFavorites();
  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // wait a tick for localStorage favorites to load
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setB(null);
    setErr("");
    fetch(`/api/briefing?favorites=${encodeURIComponent(favs.join(","))}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setB(j)))
      .catch((e) => setErr(e.message));
  }, [ready, favs.join(",")]);

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <p className="label">Auto-generated daily · {new Date().toLocaleDateString()}</p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 42, margin: "6px 0 6px" }}>
        The Briefing
      </h1>
      <p className="prose" style={{ color: "var(--ink-soft)", maxWidth: 620 }}>
        {favs.length
          ? `Personalized for ${favs.join(", ")}.`
          : "Star teams on the Teams page to personalize this."}
      </p>

      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {!b && !err && <p style={{ marginTop: 20 }}><span className="spin" /> writing today&rsquo;s briefing…</p>}

      {b && (
        <div className="fade-in" style={{ marginTop: 24 }}>
          <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 27 }}>{b.headline}</h2>

          {b.yourTeams?.length > 0 && (
            <div className="card" style={{ background: "var(--paper)", margin: "16px 0" }}>
              <p className="label">Your teams</p>
              {b.yourTeams.map((t: any, i: number) => (
                <p key={i} className="prose" style={{ marginTop: 6 }}>
                  <b>{t.team}.</b> {t.note}
                </p>
              ))}
            </div>
          )}

          <p className="label" style={{ marginTop: 20 }}>Today&rsquo;s biggest stories</p>
          {b.topStories?.map((s: any, i: number) => (
            <div key={i} className="card fade-in" style={{ marginTop: 10 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>
                <span className="c-red">{String(i + 1).padStart(2, "0")}</span> &nbsp;{s.title}
              </div>
              <p className="prose" style={{ marginTop: 4 }}>{s.detail}</p>
            </div>
          ))}

          <p className="label" style={{ marginTop: 24 }}>Games to watch</p>
          <div className="grid g2" style={{ marginTop: 10 }}>
            {b.gamesToWatch?.map((g: any, i: number) => (
              <div key={i} className="card">
                <div style={{ fontWeight: 600 }}>{g.matchup}</div>
                <p className="prose" style={{ marginTop: 4, fontSize: 14.5 }}>{g.why}</p>
              </div>
            ))}
          </div>

          {b.outlook && (
            <div className="card" style={{ marginTop: 24, borderColor: "var(--ink)" }}>
              <p className="label">Outlook</p>
              <p className="prose serif" style={{ fontSize: 17 }}>{b.outlook}</p>
            </div>
          )}

          <p className="label" style={{ marginTop: 20 }}>
            generated {b.generatedAt ? new Date(b.generatedAt).toLocaleString() : "just now"} ·{" "}
            <Link href="/chat">ask a follow-up →</Link>
          </p>
        </div>
      )}
    </div>
  );
}
