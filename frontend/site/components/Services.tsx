import Link from "next/link";
import {
  Baby, Star, Globe, BookOpen, Home, Car, ChefHat,
  Flower2, UserCheck, Users, Shield, Crown, Heart,
  Briefcase, Sparkles,
} from "lucide-react";

const SERVICES = [
  { icon: Baby,      label: "Няня для дошкольников",  tag: "Популярно" },
  { icon: Baby,      label: "Няня для грудничков" },
  { icon: Globe,     label: "Няня-носитель языка",    tag: "Топ" },
  { icon: BookOpen,  label: "Няни-репетиторы" },
  { icon: Star,      label: "Няни-воспитатели" },
  { icon: Car,       label: "Авто-няня" },
  { icon: Crown,     label: "Гувернантки",            tag: "VIP" },
  { icon: Home,      label: "Домработницы",           tag: "Популярно" },
  { icon: Car,       label: "Водители" },
  { icon: Users,     label: "Семейная пара" },
  { icon: UserCheck, label: "Помощник по хозяйству" },
  { icon: ChefHat,   label: "Семейный повар" },
  { icon: BookOpen,  label: "Репетитор" },
  { icon: Flower2,   label: "Садовник" },
  { icon: Briefcase, label: "Ассистент" },
  { icon: Sparkles,  label: "Филиппинки домработницы" },
  { icon: Baby,      label: "Филиппинки няни" },
  { icon: Shield,    label: "Частная охрана",         tag: "VIP" },
  { icon: Crown,     label: "Управляющий",            tag: "VIP" },
  { icon: Heart,     label: "Сиделка" },
  { icon: Crown,     label: "VIP-Гардеробщица",       tag: "VIP" },
];

export default function Services() {
  return (
    <section id="services" className="py-20 bg-brand-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="section-title">Наши услуги</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            21 направление подбора домашнего персонала — найдём специалиста
            под любые потребности вашей семьи
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {SERVICES.map(({ icon: Icon, label, tag }) => (
            <Link
              key={label}
              href="#form"
              className="relative group bg-white rounded-2xl p-5 flex flex-col items-center text-center gap-3
                         shadow-card hover:shadow-md hover:-translate-y-1 transition-all duration-200
                         border border-transparent hover:border-brand-gold/40"
            >
              {tag && (
                <span className="absolute top-2.5 right-2.5 bg-brand-gold text-brand-dark text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              )}
              <div className="w-11 h-11 rounded-xl bg-brand-navy/8 flex items-center justify-center
                              group-hover:bg-brand-gold/15 transition-colors">
                <Icon size={22} className="text-brand-navy group-hover:text-brand-navy transition-colors" />
              </div>
              <span className="text-sm font-medium text-brand-dark leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link href="#form" className="btn-primary text-base px-10 py-4">
            Подобрать специалиста
          </Link>
        </div>
      </div>
    </section>
  );
}
