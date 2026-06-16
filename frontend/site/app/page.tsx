import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BookOpen,
  BriefcaseBusiness,
  ChefHat,
  CheckCircle2,
  Clock3,
  Crown,
  FileCheck2,
  Globe2,
  HeartPulse,
  Home,
  KeyRound,
  Languages,
  MapPin,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

import ApplicationForm from "@/components/ApplicationForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

const heroImage =
  "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=2200&q=88";

const trustItems = [
  {
    icon: KeyRound,
    title: "NDA-first",
    text: "Детали семьи, адреса и стиль жизни раскрываются только после согласования режима приватности.",
  },
  {
    icon: UserRoundCheck,
    title: "Curated shortlist",
    text: "Не поток анкет, а короткий список кандидатов, которых можно лично рекомендовать.",
  },
  {
    icon: Globe2,
    title: "Worldwide search",
    text: "Москва, Европа, ОАЭ, Великобритания, сезонные виллы, переезды и несколько резиденций.",
  },
  {
    icon: Clock3,
    title: "Ответ за 10 минут",
    text: "Быстрый первичный контакт в WhatsApp или Telegram для клиента, ассистента или family office.",
  },
];

const roleGroups = [
  {
    icon: Baby,
    title: "Дети и образование",
    text: "Няни, гувернантки и преподаватели под ритм семьи, языковую среду и travel schedule.",
    roles: [
      "Няня для грудничка",
      "Няня-носитель языка",
      "Гувернантка",
      "Репетитор",
      "Travel nanny",
      "Медицинская няня",
    ],
  },
  {
    icon: Home,
    title: "Дом и резиденция",
    text: "Стабильная команда для квартиры, загородного дома, виллы или нескольких объектов.",
    roles: [
      "Домработница",
      "Executive housekeeper",
      "Семейная пара",
      "Управляющий домом",
      "Садовник",
      "Дворецкий",
    ],
  },
  {
    icon: ChefHat,
    title: "Кухня и сервис",
    text: "Повара и сервисные специалисты, которые понимают диеты, приемы, гостей и приватность.",
    roles: [
      "Private chef",
      "Повар ЗОЖ",
      "Официант",
      "VIP-гардеробщица",
      "Butler / valet",
      "Household service",
    ],
  },
  {
    icon: BriefcaseBusiness,
    title: "Lifestyle и безопасность",
    text: "Личные роли для предпринимателя, семьи, ассистента принципала и family office.",
    roles: [
      "Personal assistant",
      "Семейный водитель",
      "Охрана",
      "Estate manager",
      "Сиделка",
      "Full household team",
    ],
  },
];

const standards = [
  {
    icon: FileCheck2,
    title: "Документы и квалификация",
    text: "Проверяем паспортные данные, профильное образование, сертификаты, опыт с детьми, домом или private service.",
  },
  {
    icon: ShieldCheck,
    title: "Рекомендации и безопасность",
    text: "Собираем рекомендации, смотрим карьерную историю, проверяем риски и соответствие уровню приватности.",
  },
  {
    icon: Languages,
    title: "Языки и культурная совместимость",
    text: "Подбираем русскоязычных, англоязычных, французских, филиппинских и relocation-ready кандидатов.",
  },
  {
    icon: Sparkles,
    title: "Trial day и адаптация",
    text: "Организуем интервью, пробные дни, выход на работу, обратную связь и замену в рамках договора.",
  },
];

const process = [
  ["01", "Confidential brief", "Уточняем роль, географию, состав семьи, график, проживание, бюджет и границы приватности."],
  ["02", "Search strategy", "Формируем профиль кандидата, salary benchmark, каналы закрытого поиска и критерии cultural fit."],
  ["03", "Discreet sourcing", "Ищем в собственной сети, среди рекомендованных специалистов и кандидатов, готовых к переезду."],
  ["04", "Vetting", "Проверяем документы, опыт, рекомендации, образование, безопасность, коммуникацию и зрелость."],
  ["05", "Shortlist & trial", "Даем короткий список, организуем интервью, очную встречу, онлайн-знакомство или пробный день."],
  ["06", "Placement & aftercare", "Сопровождаем выход, адаптацию 7/30/90, обратную связь и замену при необходимости."],
];

const cities = [
  "Москва",
  "Санкт-Петербург",
  "Дубай",
  "Лондон",
  "Монако",
  "Женева",
  "Париж",
  "Милан",
  "Кипр",
  "Ницца",
  "Нью-Йорк",
  "Марбелья",
];

const articles = [
  {
    title: "Сколько стоит няня в Дубае и Европе",
    text: "Как считать бюджет, налоги, проживание, перелеты, график и требования к языкам.",
    tag: "Market guide",
  },
  {
    title: "Няня, гувернантка или private tutor",
    text: "Разница ролей для семьи, где важны воспитание, образование и международная школа.",
    tag: "Family staff",
  },
  {
    title: "Как нанимать персонал без риска для приватности",
    text: "NDA, этапы раскрытия информации, рекомендации, пробные дни и безопасная коммуникация.",
    tag: "Confidentiality",
  },
];

const sampleBriefs = [
  {
    role: "Няня-гувернантка",
    place: "Москва / ОАЭ",
    terms: "6/1, проживание, английский язык",
    budget: "от $3 000 в месяц",
  },
  {
    role: "Семейная пара",
    place: "Загородная резиденция",
    terms: "Дом 700+ м2, отдельное проживание",
    budget: "от 250 000 ₽ в месяц",
  },
  {
    role: "Estate manager",
    place: "Европа / сезонная вилла",
    terms: "Команда дома, подрядчики, travel-ready",
    budget: "по уровню задачи",
  },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="bg-[#f7f4ed] text-[#171717]">
        <section
          className="relative min-h-[calc(88svh-5rem)] overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(11,18,28,0.88) 0%, rgba(11,18,28,0.68) 46%, rgba(11,18,28,0.22) 100%), url(${heroImage})`,
          }}
        >
          <div className="mx-auto flex min-h-[calc(88svh-5rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <h1 className="max-w-5xl text-4xl font-semibold leading-[1.03] text-white sm:text-5xl md:text-7xl">
                Конфиденциальный подбор домашнего персонала по всему миру
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
                GoodPeople находит нянь, гувернанток, управляющих, поваров, водителей,
                ассистентов и команды для частных семей, предпринимателей, резиденций,
                вилл и family office.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="#form" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#d8b56d] px-6 py-4 text-sm font-semibold text-[#17110a] transition hover:bg-[#e8ca84]">
                  Оставить конфиденциальную заявку
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#services" className="inline-flex items-center justify-center gap-2 rounded-md border border-white/45 px-6 py-4 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">
                  Кого подбираем
                </Link>
              </div>
              <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
                {["NDA до деталей", "Shortlist вместо потока", "После выхода остаемся рядом"].map((item) => (
                  <div key={item} className="border-l border-[#d8b56d] pl-4 text-sm font-medium text-white/75">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-stone-300 bg-[#f7f4ed]">
          <div className="mx-auto grid max-w-7xl gap-px px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="p-5">
                  <Icon className="h-5 w-5 text-[#96733b]" />
                  <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="about" className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <Crown className="h-7 w-7 text-[#96733b]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              Private staffing office для людей, у которых цена ошибки выше комиссии
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-stone-700">
            <p>
              В дом входит не резюме, а человек: он видит детей, гостей, график,
              привычки, имущество, поездки и личное пространство семьи. Поэтому
              GoodPeople строит подбор как закрытый executive search, а не как
              массовую выдачу анкет.
            </p>
            <p>
              Мы соединяем домашний персонал, private service, международный поиск,
              проверку рекомендаций и спокойное сопровождение после выхода сотрудника.
              Клиент получает не шум, а ясный короткий список.
            </p>
          </div>
        </section>

        <section id="services" className="bg-[#101827] py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Кого подбираем
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/70">
                  Закрываем точечные роли и собираем команды для квартиры, дома,
                  резиденции, сезонной виллы, переезда или family office.
                </p>
              </div>
              <Link href="#form" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#d8b56d] px-5 py-3 text-sm font-semibold text-[#17110a] transition hover:bg-[#e8ca84]">
                Подобрать специалиста
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {roleGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <article key={group.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                    <Icon className="h-6 w-6 text-[#e8ca84]" />
                    <h3 className="mt-5 text-xl font-semibold text-[#e8ca84]">{group.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/65">{group.text}</p>
                    <ul className="mt-6 space-y-3 text-sm text-white/78">
                      {group.roles.map((role) => (
                        <li key={role} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8b56d]" />
                          {role}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="process" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <MessageCircle className="h-7 w-7 text-[#96733b]" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
                Как мы работаем
              </h2>
              <p className="mt-5 text-lg leading-8 text-stone-700">
                Процесс понятен ассистенту, family office и самой семье: меньше
                лишних касаний, больше контроля качества и приватности.
              </p>
            </div>
            <div className="border-y border-stone-300">
              {process.map(([number, title, text]) => (
                <div key={number} className="grid gap-4 border-b border-stone-300 py-6 last:border-b-0 md:grid-cols-[84px_220px_1fr]">
                  <div className="font-mono text-sm text-[#96733b]">{number}</div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-stone-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="offices" className="bg-[#e7dfd1] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="relative min-h-[430px] overflow-hidden rounded-lg bg-[#101827] p-8 text-white">
              <div className="absolute inset-0 opacity-35" style={{ backgroundImage: "radial-gradient(circle at 22% 34%, #d8b56d 0 2px, transparent 3px), radial-gradient(circle at 62% 42%, #d8b56d 0 2px, transparent 3px), radial-gradient(circle at 78% 58%, #d8b56d 0 2px, transparent 3px)", backgroundSize: "180px 120px" }} />
              <div className="relative">
                <MapPin className="h-7 w-7 text-[#e8ca84]" />
                <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight md:text-5xl">
                  Карта офисов и международного поиска
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-white/72">
                  Московская база, закрытая сеть рекомендаций и поиск локального
                  персонала или кандидатов, готовых к переезду.
                </p>
              </div>
              <div className="relative mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cities.map((city) => (
                  <div key={city} className="rounded-md border border-white/15 bg-white/6 px-4 py-3 text-sm font-medium text-white/82">
                    {city}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <Plane className="h-7 w-7 text-[#96733b]" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
                Работаем там, где живет семья
              </h2>
              <p className="mt-5 text-lg leading-8 text-stone-700">
                Для международных клиентов важны визы, язык, формат проживания,
                перелеты, локальный рынок зарплат и готовность кандидата к travel
                schedule. Мы учитываем это до первого интервью.
              </p>
              <div className="mt-8 grid gap-3">
                {["локальный кандидат в нужной стране", "релокация под заказ семьи", "сезонная команда для виллы или резиденции"].map((item) => (
                  <div key={item} className="flex items-center gap-3 border-t border-stone-300 py-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#96733b]" />
                    <span className="text-stone-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <ShieldCheck className="h-7 w-7 text-[#96733b]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
              Что определяет выбор агентства
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              Дорогой подбор держится не на обещаниях, а на проверке,
              управляемом процессе и способности защитить приватность клиента.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {standards.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="border-t border-stone-300 pt-6">
                  <Icon className="h-6 w-6 text-[#96733b]" />
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="articles" className="border-y border-stone-300 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <BookOpen className="h-7 w-7 text-[#96733b]" />
                <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
                  Статьи и рыночная экспертиза
                </h2>
                <p className="mt-5 text-lg leading-8 text-stone-700">
                  Контент должен помогать клиенту выбрать агентство: зарплаты,
                  страны, форматы найма, безопасность и различия ролей.
                </p>
              </div>
              <Link href="#form" className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-400 px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-900">
                Получить консультацию
              </Link>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {articles.map((article) => (
                <article key={article.title} className="rounded-lg border border-stone-200 bg-[#f7f4ed] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#96733b]">{article.tag}</p>
                  <h3 className="mt-5 text-xl font-semibold">{article.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{article.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="vacancies" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <HeartPulse className="h-7 w-7 text-[#96733b]" />
              <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">
                Примеры закрытых запросов
              </h2>
              <p className="mt-5 text-lg leading-8 text-stone-700">
                Без раскрытия клиентов показываем уровень задач, географию и
                ожидания по бюджету. Это помогает быстро понять рынок.
              </p>
            </div>
            <div className="grid gap-3">
              {sampleBriefs.map((brief) => (
                <article key={brief.role} className="grid gap-4 rounded-lg border border-stone-300 bg-white p-5 md:grid-cols-[1fr_1fr_auto] md:items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{brief.role}</h3>
                    <p className="mt-1 text-sm text-stone-500">{brief.place}</p>
                  </div>
                  <p className="text-sm leading-6 text-stone-600">{brief.terms}</p>
                  <p className="text-sm font-semibold text-[#96733b]">{brief.budget}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ApplicationForm />
      </main>
      <Footer />
    </>
  );
}
