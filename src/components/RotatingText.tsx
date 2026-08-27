"use client";
import { useEffect, useState } from "react";

const WORDS: [string, string][] = [
  ["watching", "c-red"],
  ["explaining", "c-blue"],
  ["ranking", "c-green"],
  ["tracking", "c-amber"],
  ["predicting", "c-violet"],
];

export default function RotatingText() {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setI((n) => (n + 1) % WORDS.length);
        setShow(true);
      }, 380);
    }, 2400);
    return () => clearInterval(t);
  }, []);

  const [word, cls] = WORDS[i];
  return (
    <span className="rot">
      <span
        className={cls}
        style={{ opacity: show ? 1 : 0, transform: show ? "none" : "translateY(10px)" }}
      >
        {word}
      </span>
    </span>
  );
}
