"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiStatus } from "@/components/api-status";
import { MarketSearch } from "@/components/market-search";
import { MobileMenuToggle } from "@/components/mobile-menu-toggle";
import { SolanaRpcStatus } from "@/components/solana-rpc-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletConnectButton } from "@/components/wallet-connect-button";

const navigation = [
  { icon: "⌂", label: "Explore", href: "/" },
  { icon: "▤", label: "Markets", href: "/markets" },
  { icon: "↗", label: "Trade", href: "/trade" },
  { icon: "⇄", label: "Arbitrage Opportunities", href: "/arbitrage-opportunities" },
  { icon: "◫", label: "Portfolio", href: "/portfolio" },
  { icon: "▥", label: "Analytics", href: "/analytics" },
  { icon: "◉", label: "Liquidity", href: "/liquidity" },
  { icon: "⌘", label: "Developers / API", href: "/developers-api" },
  { icon: "⚙", label: "Settings", href: "/settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const current = navigation.find(item => item.href === pathname)
    ?? (pathname.startsWith("/markets/") ? navigation[1]! : navigation[0]!);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusable = sidebarRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="shell">
      {menuOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation menu" onClick={closeMenu} />}
      <aside id="app-sidebar" ref={sidebarRef} className={`sidebar${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
        <div className="brand"><span className="brand-mark">N</span><span>northstar</span></div>
        <div className="nav-label">Workspace</div>
        <nav className="app-navigation" aria-label="Workspace">
          {navigation.map(item => {
            const active = current.href === item.href;
            return <Link className={`nav-link${active ? " active" : ""}`} href={item.href} key={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className="side-bottom">
          <SolanaRpcStatus />
          <ApiStatus />
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="header-leading">
            <MobileMenuToggle ref={menuButtonRef} isOpen={menuOpen} onToggle={() => setMenuOpen(open => !open)} />
            <div className="crumb"><span>Workspace</span><span aria-hidden="true">/</span><span className="crumb-current">{current.label}</span></div>
          </div>
          <div className="header-controls">
            <div className="header-search"><MarketSearch /></div>
            <ThemeToggle />
            <WalletConnectButton />
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
