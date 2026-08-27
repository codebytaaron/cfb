import Link from "next/link";
import RotatingText from "@/components/RotatingText";
import GameCard from "@/components/GameCard";
import { LiveFeed, HomeRankings, AskInline } from "@/components/HomeFeed";
import { seasonContext } from "@/lib/season";
import { getGames, type Game } from "@/lib/cfbd";

export const revalidate = 60;

export default async function Home() {
  const ctx = await seasonContext();
  let games: Game[] = [];
  try {
    games = await getGames(ctx.year, { seasonType: "both" });
  } catch {}
  const now = Date.now();
  const live = games.filter((g) => !g.completed && +new Date(g.startDate) <= now);
  const recent = games
    .filter((g) => g.completed)
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
    .slice(0, 3);
  const upcoming = games
    .filter((g) => !g.completed && +new Date(g.startDate) > now)
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
    .slice(0, 6);
  const feature = live.length ? live.slice(0, 6) : recent.length ? recent : upcoming.slice(0, 3);

  return (
    <>
      <section className="hero center">
        <div className="wrap">
          <p className="eyebrow">{ctx.year} season · {ctx.phase} · week {ctx.week}</p>
          <h1>
            An AI is <RotatingText />
            <br />
            college football right now.
          </h1>
          <p className="sub">
            Gridiron AI reads the live data feed continuously and turns every meaningful change
            into a clear, factual explanation. The numbers come from the College Football Data
            API — the AI only tells you what they mean.
          </p>
          <div style={{ marginTop: 28 }}>
            <AskInline />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <p className="label">{live.length ? "Live now" : recent.length ? "Latest results" : "Next up"}</p>
          <h2>{live.length ? "Games in progress" : recent.length ? "Most recent games" : "Upcoming games"}</h2>
          <div className="grid g3">
            {feature.map((g) => (
              <GameCard key={g.id} g={g} />
            ))}
          </div>
          <p style={{ marginTop: 16 }}>
            <Link href="/games" className="btn ghost">
              All games →
            </Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <p className="label">Automatic pipeline</p>
          <h2>What the AI has flagged</h2>
          <LiveFeed />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <p className="label">Statistical model · explained by AI</p>
          <h2>Gridiron AI power rankings — top 10</h2>
          <HomeRankings />
          <p style={{ marginTop: 16 }}>
            <Link href="/rankings" className="btn ghost">
              Full rankings & polls →
            </Link>
          </p>
        </div>
      </section>

      <section className="section center">
        <div className="wrap">
          <p className="label">Every stat has a plain-English answer</p>
          <h2 style={{ fontSize: 30 }}>
            &ldquo;Who should I watch this weekend?&rdquo;
            <br />
            &ldquo;Why did Texas fall in the rankings?&rdquo;
          </h2>
          <p>
            <Link href="/chat" className="btn">
              Open Gridiron AI →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
