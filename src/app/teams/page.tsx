import TeamBrowser from "@/components/TeamBrowser";
import { getTeams } from "@/lib/cfbd";

export const revalidate = 86400;

export default async function TeamsPage() {
  let teams: any[] = [];
  try {
    teams = (await getTeams()).map((t) => ({ id: t.id, school: t.school, conference: t.conference, color: t.color }));
    teams.sort((a, b) => a.school.localeCompare(b.school));
  } catch {}

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <p className="label">FBS · {teams.length} teams</p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 40, margin: "6px 0 8px" }}>Teams</h1>
      <p className="prose" style={{ maxWidth: 620, color: "var(--ink-soft)", marginBottom: 24 }}>
        Star a team to follow it. Every team has an auto-generated AI report — strengths, weaknesses,
        the game that matters most, playoff outlook — refreshed as new data arrives.
      </p>
      <TeamBrowser teams={teams} />
    </div>
  );
}
