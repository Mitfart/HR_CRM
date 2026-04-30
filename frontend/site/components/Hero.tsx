import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const BADGES = [
  "Опыт от 3 лет",
  "Проверка рекомендаций",
  "Замена специалиста",
  "Гарантия результата",
];

export default function Hero() {
  return (
    <section className="bg-brand-navy relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-gold rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-24 w-80 h-80 bg-brand-gold rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div>
            <span className="inline-block bg-brand-gold/20 text-brand-gold text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              Кадровое агентство № 1 в Москве
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white leading-tight mb-6">
              Просто хорошие{" "}
              <span className="text-brand-gold">люди</span>{" "}
              для вашего дома
            </h1>
            <p className="text-white/75 text-lg leading-relaxed mb-8 max-w-lg">
              Профессиональный подбор домашнего персонала в Москве. Няни,
              домработницы, водители, повара и VIP‑сервис — с опытом,
              образованием и рекомендациями.
            </p>

            {/* Badges */}
            <ul className="flex flex-wrap gap-3 mb-10">
              {BADGES.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-1.5 bg-white/10 text-white/90 text-sm px-3.5 py-1.5 rounded-full"
                >
                  <CheckCircle2 size={14} className="text-brand-gold shrink-0" />
                  {b}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link href="#form" className="btn-primary text-base px-8 py-4">
                Оставить заявку
                <ArrowRight size={18} />
              </Link>
              <Link
                href="#services"
                className="btn-secondary text-base px-8 py-4"
              >
                Наши услуги
              </Link>
            </div>
          </div>

          {/* Right: stat cards */}
          <div className="hidden md:grid grid-cols-2 gap-4">
            {[
              { value: "500+", label: "Успешных\nплацирований" },
              { value: "21", label: "Направление\nподбора" },
              { value: "10 лет", label: "На рынке\nдомашнего персонала" },
              { value: "98%", label: "Довольных\nклиентов" },
            ].map((s) => (
              <div
                key={s.value}
                className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/15 transition"
              >
                <div className="text-brand-gold text-3xl font-bold mb-1">
                  {s.value}
                </div>
                <div className="text-white/75 text-sm leading-snug whitespace-pre-line">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
