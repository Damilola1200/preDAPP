"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DEFAULT_PREFERENCES, applyTheme, readPreferences, validatePreferences, writePreferences, type UserPreferences } from "@/lib/settings-preferences";

export function SettingsPage() {
  const { connected, connecting, publicKey } = useWallet();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    try {
      const saved = readPreferences(window.localStorage);
      setPreferences(saved);
      applyTheme(saved.theme);
    } catch {
      setNotice({ kind: "error", text: "Saved preferences could not be read. Changes may not persist in this browser." });
    } finally {
      setLoaded(true);
    }
  }, []);

  function update(patch: Partial<UserPreferences>) {
    setPreferences(current => ({ ...current, ...patch }));
    setNotice(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validatePreferences(preferences);
    if (validationError) {
      setNotice({ kind: "error", text: validationError });
      return;
    }
    try {
      const next = { ...preferences, displayName: preferences.displayName.trim() };
      writePreferences(window.localStorage, next);
      applyTheme(next.theme);
      setPreferences(next);
      setNotice({ kind: "success", text: "Preferences saved on this device." });
    } catch {
      setNotice({ kind: "error", text: "Preferences could not be saved. Check this browser’s storage settings and try again." });
    }
  }

  function reset() {
    setPreferences(DEFAULT_PREFERENCES);
    applyTheme(DEFAULT_PREFERENCES.theme);
    setNotice(null);
  }

  return <main className="main settings-page">
    <div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1 className="title">Settings</h1><p className="sub">Manage this browser’s display and trading preferences.</p></div><span className="source-badge mock">SAVED LOCALLY</span></div>
    {!loaded ? <section className="panel settings-loading" role="status">Loading saved preferences…</section> : <form onSubmit={onSubmit}>
      <section className="panel settings-section">
        <div className="settings-section-heading"><h2>Profile and account</h2><p>Identity is shown only when supplied by a connected service or wallet.</p></div>
        <label className="settings-field"><span>Display name <small>Optional · stored on this device</small></span><input autoComplete="nickname" maxLength={40} value={preferences.displayName} onChange={event => update({ displayName: event.target.value })} placeholder="Enter a display name" /></label>
        <div className="settings-account-grid">
          <div className="settings-readonly"><span>Application account</span><strong>Not signed in</strong><small>Account authentication is not connected yet.</small></div>
          <div className="settings-readonly"><span>Solana wallet</span><strong>{connecting ? "Connecting…" : connected && publicKey ? "Connected" : "Not connected"}</strong><small>{connected && publicKey ? publicKey.toBase58() : "Connect a wallet from the header to show its public address here."}</small></div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="settings-section-heading"><h2>Appearance and display</h2><p>Choose how the dashboard is shown on this device.</p></div>
        <label className="settings-field"><span>Theme</span><select value={preferences.theme} onChange={event => update({ theme: event.target.value as UserPreferences["theme"] })}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="settings-check"><input type="checkbox" checked={preferences.display.compactMarkets} onChange={event => update({ display: { ...preferences.display, compactMarkets: event.target.checked } })} /><span><strong>Compact market rows</strong><small>Use a denser layout where market lists support it.</small></span></label>
        <label className="settings-field"><span>Default currency <small>Only USD is supported by current market data.</small></span><select value={preferences.display.defaultCurrency} disabled aria-describedby="currency-support"><option value="USD">USD — US Dollar</option></select></label>
        <p className="settings-help" id="currency-support">Other currencies are unavailable until the app has a validated conversion-rate source.</p>
      </section>

      <section className="panel settings-section">
        <div className="settings-section-heading"><h2>Notifications</h2><p>These choices are saved locally. Notification delivery is not connected yet.</p></div>
        <label className="settings-check"><input type="checkbox" checked={preferences.notifications.marketUpdates} onChange={event => update({ notifications: { ...preferences.notifications, marketUpdates: event.target.checked } })} /><span><strong>Market updates</strong><small>Preference for alerts about markets you follow.</small></span></label>
        <label className="settings-check"><input type="checkbox" checked={preferences.notifications.productUpdates} onChange={event => update({ notifications: { ...preferences.notifications, productUpdates: event.target.checked } })} /><span><strong>Product updates</strong><small>Preference for platform and feature announcements.</small></span></label>
      </section>

      <section className="panel settings-section">
        <div className="settings-section-heading"><h2>Trading preferences</h2><p>Used as defaults for quote planning. Orders are not submitted from these settings.</p></div>
        <label className="settings-field"><span>Default side</span><select value={preferences.trading.defaultSide} onChange={event => update({ trading: { ...preferences.trading, defaultSide: event.target.value as UserPreferences["trading"]["defaultSide"] } })}><option value="BUY">Buy</option><option value="SELL">Sell</option></select></label>
        <label className="settings-field"><span>Slippage tolerance <small>Allowed range: 0.1% to 5%</small></span><div className="settings-number"><input type="number" min="0.1" max="5" step="0.1" required value={preferences.trading.slippageTolerancePercent} onChange={event => update({ trading: { ...preferences.trading, slippageTolerancePercent: event.target.value === "" ? Number.NaN : Number(event.target.value) } })} /><span>%</span></div></label>
      </section>

      <div className="settings-actions"><div className="settings-notice" role="status" aria-live="polite">{notice && <span className={notice.kind}>{notice.text}</span>}</div><button className="settings-reset" type="button" onClick={reset}>Reset form</button><button className="simulate-button" type="submit" disabled={!loaded}>Save preferences</button></div>
      <p className="settings-storage-note">Temporary local storage: these preferences stay in this browser and are not synced to an account or database.</p>
    </form>}
  </main>;
}
