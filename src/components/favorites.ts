"use client";
import { useEffect, useState } from "react";

const KEY = "gridiron.favorites";

export function useFavorites() {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {}
  }, []);
  function toggle(team: string) {
    setFavs((prev) => {
      const next = prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return { favs, toggle, has: (t: string) => favs.includes(t) };
}
