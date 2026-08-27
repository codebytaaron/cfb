"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/rankings", "Rankings"],
  ["/games", "Games"],
  ["/teams", "Teams"],
  ["/briefing", "Briefing"],
  ["/chat", "Ask Gridiron AI"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          Gridiron<b>AI</b>
        </Link>
        <div className="nav-links">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={path.startsWith(href) ? "on" : ""}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
