"use client";
import { useState } from "react";

export default function Predictor({ home = "" }: { home?: string }) {
  const [h, setH] = useState(home);
  const [a, setA] = useState("");
  const [neutral, setNeutral] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!h || !a) return;
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch(`/api/predict?home=${encodeURIComponent(h)}&away=${encodeURIComponent(a)}&neutral=${neutral ? 1 : 0}`);
      setRes(await r.json());
    } catch (e: any) {
      setRes({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <p className="label">Home {neutral && "(neutral)"}</p>
          <input value={h} onChange={(e) => setH(e.target.value)} placeholder="e.g. Georgia" />
        </div>
        <div>
          <p className="label">Away</p>
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. Alabama" />
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", fontSize: 14 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={neutral} onChange={(e) => setNeutral(e.target.checked)} />
        Neutral site
      </label>
      <button className="btn" onClick={run} disabled={loading}>
        {loading ? "projecting…" : "Project"}
      </button>

      {res?.error && <p style={{ color: "var(--red)", marginTop: 12 }}>{res.error}</p>}
      {res?.model && (
        <div className="fade-in" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div className="big-num c-blue">{res.model.homeWinProbability}%</div>
              <div className="label">{res.model.homeTeam}</div>
            </div>
            <div>
              <div className="big-num c-red">{res.model.awayWinProbability}%</div>
              <div className="label">{res.model.awayTeam}</div>
            </div>
            <div>
              <div className="big-num">{res.model.projectedSpread}</div>
              <div className="label">projected spread</div>
            </div>
          </div>
          {res.explanation && <p className="prose" style={{ marginTop: 12 }}>{res.explanation}</p>}
          <p className="label" style={{ marginTop: 8 }}>{res.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
