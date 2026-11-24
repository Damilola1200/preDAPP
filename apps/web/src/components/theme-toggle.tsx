"use client";
import { useEffect, useState } from "react";
import { applyTheme, readPreferences, writePreferences, type ThemePreference } from "@/lib/settings-preferences";
export function ThemeToggle() {
 const [dark, setDark] = useState(false);
 useEffect(() => { try { const preferences = readPreferences(window.localStorage); setDark(preferences.theme === "dark"); applyTheme(preferences.theme); } catch { applyTheme("light"); } }, []);
 function toggle() { const theme: ThemePreference = dark ? "light" : "dark"; setDark(theme === "dark"); applyTheme(theme); try { writePreferences(window.localStorage, { ...readPreferences(window.localStorage), theme }); } catch { /* Keep the in-memory theme change even when browser storage is unavailable. */ } }
 return <button className="icon-btn" aria-label={`Switch to ${dark ? "light" : "dark"} theme`} onClick={toggle}>{dark ? "☼" : "◐"}</button>;
}
