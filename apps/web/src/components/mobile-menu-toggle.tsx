"use client";

import { forwardRef } from "react";

type MobileMenuToggleProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export const MobileMenuToggle = forwardRef<HTMLButtonElement, MobileMenuToggleProps>(function MobileMenuToggle({ isOpen, onToggle }, ref) {
  return <button
    ref={ref}
    className="mobile-menu"
    type="button"
    aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
    aria-expanded={isOpen}
    aria-controls="app-sidebar"
    onClick={onToggle}
  >{isOpen ? "×" : "☰"}</button>;
});
