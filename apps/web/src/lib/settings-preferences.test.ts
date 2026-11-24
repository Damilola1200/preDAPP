import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  readPreferences,
  validatePreferences,
  writePreferences,
} from "./settings-preferences";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("user preferences", () => {
  it("loads safe defaults without inventing account information", () => {
    expect(readPreferences(createStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it("saves and reloads supported preferences", () => {
    const storage = createStorage();
    const preferences = { ...DEFAULT_PREFERENCES, theme: "dark" as const, trading: { slippageTolerancePercent: 2.5, defaultSide: "SELL" as const } };
    writePreferences(storage, preferences);
    expect(readPreferences(storage)).toEqual(preferences);
  });

  it("normalizes malformed or unsupported values", () => {
    expect(normalizePreferences({ displayName: 12, theme: "blue", display: { defaultCurrency: "XYZ" } })).toMatchObject({
      displayName: "",
      theme: "light",
      display: { defaultCurrency: "USD" },
    });
  });

  it("rejects slippage outside the supported range", () => {
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, trading: { ...DEFAULT_PREFERENCES.trading, slippageTolerancePercent: 0 } })).toContain("between 0.1% and 5%");
    expect(validatePreferences({ ...DEFAULT_PREFERENCES, trading: { ...DEFAULT_PREFERENCES.trading, slippageTolerancePercent: 5.1 } })).toContain("between 0.1% and 5%");
    expect(validatePreferences(DEFAULT_PREFERENCES)).toBeNull();
  });
});
