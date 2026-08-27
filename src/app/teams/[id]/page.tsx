import Link from "next/link";
import TeamReport from "@/components/TeamReport";
import Predictor from "@/components/Predictor";

export const revalidate = 3600;

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = decodeURIComponent(id);

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <Link href="/teams" className="label">← teams</Link>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 44, margin: "10px 0 14px" }}>
        {team}
      </h1>
      <TeamReport team={team} />

      <section style={{ marginTop: 40 }}>
        <p className="label">Matchup predictor · Elo model</p>
        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 24, margin: "6px 0 14px" }}>
          Project a game
        </h2>
        <Predictor home={team} />
      </section>
    </div>
  );
}
