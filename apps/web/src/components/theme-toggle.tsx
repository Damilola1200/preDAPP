"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() {
 const [dark, setDark] = useState(false);
 useEffect(() => { const value = localStorage.getItem("northstar-theme"); const isDark = value === "dark"; setDark(isDark); document.documentElement.dataset.theme = isDark ? "dark" : "light"; }, []);
 function toggle() { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; localStorage.setItem("northstar-theme", next ? "dark" : "light"); }
 return <button className="icon-btn" aria-label={`Switch to ${dark ? "light" : "dark"} theme`} onClick={toggle}>{dark ? "☼" : "◐"}</button>;
}
