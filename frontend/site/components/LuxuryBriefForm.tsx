"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

const roles = [
  "Estate / House Manager",
  "Private Chef",
  "Nanny / Governess",
  "Executive Housekeeper",
  "Chauffeur / Security Driver",
  "Personal Assistant",
  "Full household team",
];

const locations = [
  "Moscow / Russia",
  "Dubai / UAE",
  "London / UK",
  "Monaco / French Riviera",
  "Switzerland",
  "Europe / seasonal residence",
  "Worldwide",
];

export default function LuxuryBriefForm() {
  const [role, setRole] = useState(roles[0]);
  const [location, setLocation] = useState(locations[0]);
  const [urgency, setUrgency] = useState("В течение 2-4 недель");
  const [contact, setContact] = useState("WhatsApp");
  const [details, setDetails] = useState("");

  const message = useMemo(() => {
    const lines = [
      "Здравствуйте, GoodPeople. Хочу обсудить конфиденциальный подбор private staff.",
      `Роль: ${role}`,
      `География: ${location}`,
      `Срок: ${urgency}`,
      `Удобный канал: ${contact}`,
      details ? `Комментарий: ${details}` : "",
    ].filter(Boolean);
    return encodeURIComponent(lines.join("\n"));
  }, [role, location, urgency, contact, details]);

  return (
    <form className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-stone-700">
          Кого ищем
          <select
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#ad8b4f]"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-stone-700">
          География
          <select
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#ad8b4f]"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          >
            {locations.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-stone-700">
          Срочность
          <select
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#ad8b4f]"
            value={urgency}
            onChange={(event) => setUrgency(event.target.value)}
          >
            <option>Срочная замена</option>
            <option>В течение 2-4 недель</option>
            <option>Плановый поиск</option>
            <option>Сбор команды под резиденцию</option>
          </select>
        </label>
        <label className="text-sm text-stone-700">
          Удобный канал
          <select
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#ad8b4f]"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          >
            <option>WhatsApp</option>
            <option>Telegram</option>
            <option>Phone call</option>
            <option>Assistant / family office</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block text-sm text-stone-700">
        Детали, которые можно раскрыть на первом шаге
        <textarea
          className="mt-1 min-h-28 w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-[#ad8b4f]"
          placeholder="Например: несколько резиденций, travel schedule, дети, языки, формат проживания, уровень конфиденциальности."
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a
          href={`https://wa.me/79850227777?text=${message}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#223044]"
        >
          <MessageCircle className="h-4 w-4" />
          Отправить private brief
        </a>
        <a
          href="https://t.me/GoodPeopleAgency_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-[#ad8b4f] hover:text-[#7b5e27]"
        >
          <Send className="h-4 w-4" />
          Telegram
        </a>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-stone-500">
        Заявка обрабатывается конфиденциально. Детали семьи, резиденции и условий раскрываются кандидатам только после согласования с вами.
      </p>
    </form>
  );
}
