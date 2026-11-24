"use client";
export function MobileMenuToggle() {
 function toggle() { document.body.classList.toggle("mobile-nav-open"); }
 return <button className="mobile-menu" onClick={toggle} aria-label="Toggle navigation">☰</button>;
}
