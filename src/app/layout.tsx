import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Ticker from "@/components/Ticker";

export const metadata: Metadata = {
  title: "Gridiron AI — college football, watched in real time",
  description:
    "An AI that continuously monitors college football data and turns it into clear, factual explanations. Powered by CollegeFootballData + Groq.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Ticker />
        <Nav />
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap">
            <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)" }}>
              Gridiron<b style={{ color: "var(--red)" }}>AI</b>
            </div>
            <p style={{ maxWidth: 560 }}>
              Facts from the CollegeFootballData API. Analysis by Groq. The AI never invents a
              score, stat, ranking or result — when the data doesn&rsquo;t have it, it says so.
              Predictions are labeled as predictions.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
