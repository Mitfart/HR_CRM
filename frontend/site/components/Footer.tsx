import Link from "next/link";
import { Phone, MapPin, MessageCircle, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer id="contacts" className="bg-brand-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <span className="text-brand-gold font-bold text-xl">GoodPeople</span>
              <span className="text-white/60 text-xs tracking-widest uppercase ml-1">Agency</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Конфиденциальный подбор домашнего, семейного и private staff персонала для клиентов в России и по всему миру.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold mb-4 text-white/90">Услуги</h4>
            <ul className="space-y-2 text-sm text-white/60">
              {["Private staff", "Няни и гувернантки", "Домработницы", "Водители", "Повара", "Управляющие", "Ассистенты"].map((s) => (
                <li key={s}>
                  <Link href="/#services" className="hover:text-brand-gold transition-colors">{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4 text-white/90">Компания</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <Link href="/#about" className="hover:text-brand-gold transition-colors">О нас</Link>
              </li>
              <li>
                <Link href="/#process" className="hover:text-brand-gold transition-colors">Как мы работаем</Link>
              </li>
              <li>
                <Link href="/#offices" className="hover:text-brand-gold transition-colors">Карта офисов</Link>
              </li>
              <li>
                <Link href="/#articles" className="hover:text-brand-gold transition-colors">Статьи</Link>
              </li>
              <li>
                <Link href="/luxury" className="hover:text-brand-gold transition-colors">Luxury page</Link>
              </li>
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className="font-semibold mb-4 text-white/90">Контакты</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li>
                <a
                  href="tel:+79266111000"
                  className="flex items-center gap-2 hover:text-brand-gold transition-colors"
                >
                  <Phone size={14} /> +7 926 611-10-00
                </a>
              </li>
              <li>
                <a
                  href="tel:+79850227777"
                  className="flex items-center gap-2 hover:text-brand-gold transition-colors"
                >
                  <Phone size={14} /> 8 (985) 022-77-77
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/79850227777"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-brand-gold transition-colors"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/GoodPeopleAgency_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-brand-gold transition-colors"
                >
                  <MessageCircle size={14} /> Telegram
                </a>
              </li>
              <li className="flex items-start gap-2 text-white/50">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>г. Москва, бизнес-центр «Минская Плаза», ул. Минская 2ж</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-white/40 text-xs">
          <p>© {new Date().getFullYear()} GoodPeople Agency. Все права защищены.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white/70 transition-colors">Политика конфиденциальности</Link>
            <Link href="#" className="hover:text-white/70 transition-colors">Условия использования</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
