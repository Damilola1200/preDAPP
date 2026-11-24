export type ThemePreference = "light" | "dark";
export type TradeSidePreference = "BUY" | "SELL";

export type UserPreferences = {
  displayName: string;
  theme: ThemePreference;
  notifications: {
    marketUpdates: boolean;
    productUpdates: boolean;
  };
  display: {
    compactMarkets: boolean;
    defaultCurrency: "USD";
  };
  trading: {
    slippageTolerancePercent: number;
    defaultSide: TradeSidePreference;
  };
};

export const PREFERENCES_STORAGE_KEY = "northstar-preferences";
const LEGACY_THEME_STORAGE_KEY = "northstar-theme";

export const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: "",
  theme: "light",
  notifications: { marketUpdates: false, productUpdates: false },
  display: { compactMarkets: false, defaultCurrency: "USD" },
  trading: { slippageTolerancePercent: 1, defaultSide: "BUY" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES;
  const notifications = isRecord(value.notifications) ? value.notifications : {};
  const display = isRecord(value.display) ? value.display : {};
  const trading = isRecord(value.trading) ? value.trading : {};
  const slippage = Number(trading.slippageTolerancePercent);

  return {
    displayName: typeof value.displayName === "string" ? value.displayName.slice(0, 40) : "",
    theme: value.theme === "dark" ? "dark" : "light",
    notifications: {
      marketUpdates: notifications.marketUpdates === true,
      productUpdates: notifications.productUpdates === true,
    },
    display: {
      compactMarkets: display.compactMarkets === true,
      defaultCurrency: "USD",
    },
    trading: {
      slippageTolerancePercent: Number.isFinite(slippage) ? slippage : DEFAULT_PREFERENCES.trading.slippageTolerancePercent,
      defaultSide: trading.defaultSide === "SELL" ? "SELL" : "BUY",
    },
  };
}

export function readPreferences(storage: Pick<Storage, "getItem">): UserPreferences {
  const stored = storage.getItem(PREFERENCES_STORAGE_KEY);
  if (stored) return normalizePreferences(JSON.parse(stored));

  const legacyTheme = storage.getItem(LEGACY_THEME_STORAGE_KEY);
  return { ...DEFAULT_PREFERENCES, theme: legacyTheme === "dark" ? "dark" : "light" };
}

export function writePreferences(storage: Pick<Storage, "setItem">, preferences: UserPreferences) {
  const normalized = normalizePreferences(preferences);
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  storage.setItem(LEGACY_THEME_STORAGE_KEY, normalized.theme);
}

export function validatePreferences(preferences: UserPreferences): string | null {
  const name = preferences.displayName.trim();
  if (name.length > 40) return "Display name must be 40 characters or fewer.";
  if (!Number.isFinite(preferences.trading.slippageTolerancePercent)
    || preferences.trading.slippageTolerancePercent < 0.1
    || preferences.trading.slippageTolerancePercent > 5) {
    return "Slippage tolerance must be between 0.1% and 5%.";
  }
  return null;
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
}
