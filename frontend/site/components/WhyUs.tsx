import { ShieldCheck, Clock, RefreshCw, UserCheck } from "lucide-react";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Проверенные специалисты",
    text: "Каждый кандидат проходит личное собеседование, проверку документов, рекомендаций и службы безопасности.",
  },
  {
    icon: Clock,
    title: "Быстрый подбор",
    text: "Первые кандидаты в течение 24 часов. Экстренный подбор за 3–4 часа для постоянных клиентов.",
  },
  {
    icon: RefreshCw,
    title: "Бесплатная замена",
    text: "Если специалист не подошёл — заменим бесплатно. Гарантийный период 3 месяца.",
  },
  {
    icon: UserCheck,
    title: "Персональный менеджер",
    text: "Один менеджер ведёт вас от первого звонка до выхода специалиста и остаётся на связи.",
  },
];

export default function WhyUs() {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title">Почему выбирают нас</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            10 лет на рынке, более 500 успешных размещений и рекомендации
            лучших семей Москвы
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-brand-light rounded-2xl p-7 flex flex-col gap-4 hover:shadow-card transition"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-navy flex items-center justify-center">
                <Icon size={24} className="text-brand-gold" />
              </div>
              <h3 className="font-bold text-brand-navy text-lg leading-snug">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
