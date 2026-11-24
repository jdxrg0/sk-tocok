"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight, Printer } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/transparency", label: "Finances & Transparency" },
    { href: "/printing", label: "Printing & Tracking" },
    { href: "/cse", label: "Free CSE Subsidy" },
    { href: "/attendance", label: "Attendance" },
  ];

  const isActive = (path: string) => {
    if (!pathname) return path === "/";
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
      {/* Civic Tricolor Micro-Stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-600 via-amber-400 to-brand-800"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand with Civic Header Styling */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full border border-brand-600/60 dark:border-brand-500/70 overflow-hidden bg-[#ffffff] shadow-xs shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <picture>
                <source srcSet="/images/sk-logo-sm.webp" type="image/webp" />
                <img
                  src="/images/sk-logo-sm.png"
                  alt="Sangguniang Kabataan Barangay Tocok Official Seal"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover scale-[1.05]"
                />
              </picture>
            </div>
            <div className="leading-tight">
              <span className="font-black text-sm tracking-tight block">
                <span className="text-brand-600 dark:text-brand-400">Sangguniang</span>{" "}
                <span className="text-brand-800 dark:text-brand-200">Kabataan</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block">
                Barangay Tocok
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action Button: Vibrant Civic Brand */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/printing"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Submit Print</span>
              <ArrowUpRight className="w-3 h-3 text-brand-200" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-xs font-semibold ${
                  active ? "bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-bold" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2">
            <Link
              href="/printing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 text-center w-full px-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Submit Print Request</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
