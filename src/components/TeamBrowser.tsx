"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/components/favorites";

type T = { id: number; school: string; conference?: string; color?: string };

export default function TeamBrowser({ teams }: { teams: T[] }) {
  const [q, setQ] = useState("");
  const { favs, toggle, has } = useFavorites();
  const confs = useMemo(
    () => [...new Set(teams.map((t) => t.conference).filter(Boolean))].sort() as string[],
    [teams],
  );
  const [conf, setConf] = useState("");

  const filtered = teams.filter(
    (t) =>
      (!conf || t.conference === conf) &&
      t.school.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      {favs.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <p className="label">Your teams</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {favs.map((f) => (
              <Link key={f} href={`/teams/${encodeURIComponent(f)}`} className="pill" style={{ background: "var(--ink)", color: "#fff" }}>
                {f}
              </Link>
            ))}
            <Link href="/briefing" className="pill high">personalized briefing →</Link>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input style={{ maxWidth: 260 }} placeholder="Search teams…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ maxWidth: 220 }} value={conf} onChange={(e) => setConf(e.target.value)}>
          <option value="">All conferences</option>
          {confs.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid g3">
        {filtered.map((t) => (
          <div key={t.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href={`/teams/${encodeURIComponent(t.school)}`}>
              <div style={{ fontWeight: 600 }}>{t.school}</div>
              <div className="label">{t.conference}</div>
            </Link>
            <button
              onClick={() => toggle(t.school)}
              title="favorite"
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: has(t.school) ? "var(--amber)" : "var(--line)" }}
            >
              ★
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
