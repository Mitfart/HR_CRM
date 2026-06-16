import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Globe2,
  KeyRound,
  Plane,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import LuxuryBriefForm from "@/components/LuxuryBriefForm";

const heroImage =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85";

const trustItems = [
  {
    title: "NDA-first",
    text: "Конфиденциальность до раскрытия деталей семьи, резиденции и вакансии.",
    icon: KeyRound,
  },
  {
    title: "Private shortlist",
    text: "Не поток резюме, а короткий список кандидатов, которых готовы рекомендовать лично.",
    icon: UserRoundCheck,
  },
  {
    title: "Worldwide search",
    text: "Подбор для Москвы, Европы, ОАЭ, Великобритании, сезонных вилл и нескольких резиденций.",
    icon: Globe2,
  },
  {
    title: "Aftercare",
    text: "Контроль адаптации, обратная связь и замена в рамках условий договора.",
    icon: ShieldCheck,
  },
];

const roleGroups = [
  {
    title: "Private Residence",
    roles: ["Estate manager", "House manager", "Butler / valet", "Executive housekeeper", "Domestic couple"],
  },
  {
    title: "Family & Children",
    roles: ["Nanny", "Governess", "Tutor", "Maternity nurse", "Travel nanny"],
  },
  {
    title: "Lifestyle & Executive",
    roles: ["Personal assistant", "Lifestyle PA", "Private chef", "Wardrobe specialist", "Family driver"],
  },
  {
    title: "International Setup",
    roles: ["Seasonal villa team", "Relocation staff", "Yacht-adjacent staff", "Security-aware driver", "Full household team"],
  },
];

const process = [
  ["01", "Confidential brief", "Уточняем роль, географию, состав семьи, режим приватности, график и ожидания к сервису."],
  ["02", "Search strategy", "Фиксируем профиль, salary benchmark, каналы закрытого поиска и критерии культурной совместимости."],
  ["03", "Discreet sourcing", "Ищем через проверенную сеть private service, рекомендации и кандидатов, которые не всегда выходят на открытый рынок."],
  ["04", "Vetting & shortlist", "Проверяем опыт, рекомендации, документы, биографию и профессиональную зрелость кандидатов."],
  ["05", "Interviews & trial", "Организуем интервью, пробные дни, travel-fit и согласование финального формата работы."],
  ["06", "Placement & aftercare", "Сопровождаем выход, адаптацию, обратную связь 7/30/90 и замену при необходимости."],
];

const geographies = [
  "Москва",
  "Дубай",
  "Лондон",
  "Монако",
  "Женева",
  "Цюрих",
  "Париж",
  "Милан",
  "Ницца",
  "Лиссабон",
  "Марбелья",
  "Нью-Йорк",
];

const scenarios = [
  "семья с несколькими резиденциями",
  "family office или личный ассистент принципала",
  "публичный предприниматель или инвестор",
  "сезонная вилла, yacht schedule или переезд",
  "срочная конфиденциальная замена сотрудника",
];

export default function LuxurySegmentPage() {
  return (
    <main className="bg-[#f8f6f1] text-[#171717]">
      <section
        className="relative min-h-[calc(100svh-9rem)] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(12,17,24,0.82) 0%, rgba(12,17,24,0.58) 48%, rgba(12,17,24,0.2) 100%), url(${heroImage})`,
        }}
      >
        <div className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="w-full min-w-0 max-w-3xl">
            <h1 className="max-w-[10ch] text-4xl font-semibold leading-[1.04] text-white sm:max-w-none md:text-6xl lg:text-7xl">
              Конфиденциальный подбор частного персонала по всему миру
            </h1>
            <p className="mt-6 max-w-[20.5rem] text-lg leading-8 text-white/80 sm:max-w-2xl md:text-xl">
              GoodPeople подбирает private staff для семей уровня Forbes, family office, резиденций, вилл и международного образа жизни. Мы ищем людей, которым можно доверить дом, детей, приватность и привычный ритм семьи.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#private-brief"
                className="inline-flex w-full max-w-[22rem] items-center justify-center gap-2 rounded-md bg-[#d8b56d] px-5 py-3.5 text-center text-sm font-semibold text-[#15110a] transition hover:bg-[#e8ca84] sm:w-auto sm:px-6"
              >
                Оставить конфиденциальную заявку
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#roles"
                className="inline-flex w-full max-w-[22rem] items-center justify-center gap-2 rounded-md border border-white/40 px-5 py-3.5 text-center text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto sm:px-6"
              >
                Направления подбора
              </Link>
            </div>
            <p className="mt-5 max-w-[20.5rem] text-sm leading-6 text-white/60 sm:max-w-xl">
              Без публикации вакансии. Без передачи данных кандидатам до согласования. С отдельным процессом для ассистентов и family offices.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-300 bg-[#f8f6f1]">
        <div className="mx-auto grid max-w-7xl gap-px px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-[#f8f6f1] p-5">
                <Icon className="h-5 w-5 text-[#96733b]" />
                <h2 className="mt-4 text-base font-semibold text-[#171717]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-[#171717] md:text-5xl">
            Private household talent office
          </h2>
          <p className="mt-6 text-lg leading-8 text-stone-700">
            В luxury-сегменте ошибка найма стоит дороже времени: сотрудник входит в личное пространство семьи, видит график, детей, гостей, дом и детали образа жизни. Поэтому мы строим подбор как закрытый executive search, а не как массовую выдачу анкет.
          </p>
          <p className="mt-5 text-base leading-7 text-stone-600">
            Мы учитываем профессиональные навыки, границы, стиль коммуникации, психологическую зрелость, готовность к travel schedule и умение работать в доме, где сервис должен быть точным и незаметным.
          </p>
        </div>
        <div className="grid gap-3">
          {scenarios.map((item) => (
            <div key={item} className="flex items-start gap-4 border-t border-stone-300 py-4">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#96733b]" />
              <p className="text-lg text-stone-800">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="bg-[#111827] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Кого подбираем для частных семей и резиденций
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/70">
              Закрываем точечные роли и собираем команды под дом, виллу, загородную резиденцию, яхтенный сезон, переезд или family office.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roleGroups.map((group) => (
              <article key={group.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-xl font-semibold text-[#e8ca84]">{group.title}</h3>
                <ul className="mt-5 space-y-3 text-sm text-white/75">
                  {group.roles.map((role) => (
                    <li key={role} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8b56d]" />
                      {role}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Private search process</h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              Процесс построен вокруг приватности клиента, качества короткого списка и контролируемого выхода кандидата.
            </p>
          </div>
          <div className="grid gap-0 border-y border-stone-300">
            {process.map(([number, title, text]) => (
              <div key={number} className="grid gap-4 border-b border-stone-300 py-6 last:border-b-0 md:grid-cols-[90px_220px_1fr]">
                <div className="font-mono text-sm text-[#96733b]">{number}</div>
                <h3 className="text-lg font-semibold text-[#171717]">{title}</h3>
                <p className="text-sm leading-6 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#ece7dc] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div
            className="min-h-[420px] rounded-lg bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(17,24,39,0.04), rgba(17,24,39,0.2)), url(https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=82)",
            }}
            aria-label="Современная частная резиденция"
          />
          <div className="flex flex-col justify-center">
            <ShieldCheck className="h-7 w-7 text-[#96733b]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              Конфиденциальность встроена в сервис
            </h2>
            <div className="mt-7 grid gap-4 text-stone-700">
              {[
                "NDA до детального раскрытия задачи.",
                "Клиентская идентичность защищена до согласованного этапа.",
                "Вакансия не публикуется открыто без разрешения.",
                "Кандидату раскрывается только необходимая информация.",
                "Отдельный поток коммуникации для family office, ассистента или представителя семьи.",
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#96733b]" />
                  <p className="leading-7">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-2xl">
            <Plane className="h-7 w-7 text-[#96733b]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              Работаем там, где живет семья
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              Подбор домашнего персонала премиум-класса может идти для Москвы, Европы, ОАЭ, Великобритании, Швейцарии, сезонной виллы, яхты или новой резиденции после переезда. Мы заранее учитываем языки, документы, формат проживания и готовность к travel schedule.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
            {geographies.map((city) => (
              <div key={city} className="rounded-md border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700">
                {city}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-stone-300 bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <BriefcaseBusiness className="h-7 w-7 text-[#96733b]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              SEO-текст, который работает как luxury-позиционирование
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-stone-700">
            <p>
              GoodPeople выполняет конфиденциальный подбор домашнего персонала премиум-класса для частных семей, предпринимателей, публичных клиентов, резиденций и family office. Мы закрываем роли estate manager, house manager, private chef, nanny, governess, executive housekeeper, personal assistant, chauffeur, domestic couple и full household team.
            </p>
            <p>
              International private staff recruitment строится вокруг точного брифа, закрытого поиска, проверки рекомендаций и культурной совместимости. Клиент получает не десятки анкет, а curated shortlist кандидатов, подходящих под уклад семьи, стандарты private service и долгосрочные ожидания.
            </p>
            <p>
              Для запросов с высоким уровнем приватности мы работаем через ассистента, представителя семьи или family office, не раскрываем детали вакансии без согласования и сопровождаем адаптацию после выхода сотрудника.
            </p>
          </div>
        </div>
      </section>

      <section id="private-brief" className="bg-[#111827] py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Private Staffing Brief
            </h2>
            <p className="mt-5 text-lg leading-8 text-white/70">
              Первый шаг занимает меньше минуты. Детальные данные семьи, адреса, состав дома и условия раскрываются только после личного контакта и согласования режима конфиденциальности.
            </p>
          </div>
          <LuxuryBriefForm />
        </div>
      </section>
    </main>
  );
}
