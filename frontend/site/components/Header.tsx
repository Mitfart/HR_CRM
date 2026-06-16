"use client";

import { useState } from "react";
import { Menu, X, Phone, MessageCircle } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

const NAV_LINKS = [
  { label: "О нас", href: "/#about" },
  { label: "Услуги", href: "/#services" },
  { label: "Luxury", href: "/luxury" },
  { label: "Условия", href: "/#conditions" },
  { label: "Контакты", href: "/#contacts" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-brand-navy sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col leading-none">
              <span className="text-brand-gold font-bold text-xl tracking-tight">
                GoodPeople
              </span>
              <span className="text-white text-xs tracking-widest uppercase opacity-80">
                Agency
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-white/90 hover:text-brand-gold transition-colors text-sm font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Contacts + CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:+79266111000"
              className="flex items-center gap-2 text-white/90 hover:text-brand-gold transition-colors text-sm"
            >
              <Phone size={15} />
              +7 926 611-10-00
            </a>
            <a
              href="https://wa.me/79850227777"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white/80 hover:text-brand-gold transition-colors"
              aria-label="WhatsApp"
            >
              <MessageCircle size={18} />
            </a>
            <Link href="/#form" className="btn-primary text-sm py-2.5 px-5">
              Оставить заявку
            </Link>
            <Link
              href="/login"
              className="text-white/80 hover:text-brand-gold transition-colors text-sm font-medium"
            >
              Личный кабинет
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Меню"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={clsx(
          "md:hidden bg-brand-navy-dark border-t border-white/10 overflow-hidden transition-all duration-300",
          menuOpen ? "max-h-96 py-4" : "max-h-0"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="text-white/90 hover:text-brand-gold text-base font-medium py-1"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="tel:+79266111000"
            className="flex items-center gap-2 text-white/90 text-sm py-1"
          >
            <Phone size={15} /> +7 926 611-10-00
          </a>
          <Link
            href="/#form"
            onClick={() => setMenuOpen(false)}
            className="btn-primary text-sm w-full text-center mt-2"
          >
            Оставить заявку
          </Link>
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="text-white/80 hover:text-brand-gold text-sm py-1 font-medium"
          >
            Личный кабинет
          </Link>
        </div>
      </div>
    </header>
  );
}
