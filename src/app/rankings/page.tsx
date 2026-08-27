import Link from "next/link";
import PowerTable from "@/components/PowerTable";
import ExplainButton from "@/components/ExplainButton";
import { seasonContext, latestRankingWeek } from "@/lib/season";

export const revalidate = 600;

export default async function RankingsPage() {
  const ctx = await seasonContext();
  const week = await latestRankingWeek(ctx.year);
  const polls = week?.polls ?? [];

  return (
    <div className="wrap section" style={{ borderTop: "none" }}>
      <p className="label">{ctx.year} · updated continuously</p>
      <h1 style={{ fontFamily: "var(--serif)", fontWeight: 350, fontSize: 40, margin: "6px 0 8px" }}>
        Rankings
      </h1>
      <p className="prose" style={{ maxWidth: 640, color: "var(--ink-soft)" }}>
        Two views: the official human polls, and Gridiron AI&rsquo;s statistical power ranking with a
        one-line AI explanation for every team.
      </p>

      <section style={{ marginTop: 40 }}>
        <p className="label">Gridiron AI power rankings</p>
        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 26, margin: "6px 0 16px" }}>
          The model ranks. The AI explains.
        </h2>
        <PowerTable />
      </section>

      {polls.map((poll) => (
        <section key={poll.poll} style={{ marginTop: 44 }}>
          <p className="label">
            {poll.poll} · week {week?.week} {week?.seasonType}
          </p>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Team</th>
                <th>Conf</th>
                <th>Pts</th>
                <th>1st</th>
              </tr>
            </thead>
            <tbody>
              {poll.ranks.map((r) => (
                <tr key={r.school}>
                  <td className="rk">{r.rank}</td>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/teams/${encodeURIComponent(r.school)}`}>{r.school}</Link>
                  </td>
                  <td style={{ color: "var(--ink-soft)" }}>{r.conference}</td>
                  <td className="mono">{r.points ?? "—"}</td>
                  <td className="mono">{r.firstPlaceVotes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ExplainButton
            topic={`the current ${poll.poll} and how it compares to on-field results`}
            data={{ poll: poll.poll, week: week?.week, ranks: poll.ranks.slice(0, 25) }}
          />
        </section>
      ))}
    </div>
  );
}
