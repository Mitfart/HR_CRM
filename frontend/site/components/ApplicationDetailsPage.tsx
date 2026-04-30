"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ApplicationStatus =
  | "new"
  | "bot_done"
  | "interview_scheduled"
  | "interviewed"
  | "matched"
  | "contract_sent"
  | "closed";

type Application = {
  id: string;
  description: string;
  telegram_username: string | null;
  whatsapp_phone: string | null;
  max_contact: string | null;
  email: string | null;
  status: ApplicationStatus;
  interview_at: string | null;
  video_link: string | null;
  video_service: string | null;
  manager_notes: string | null;
  search_params: Record<string, unknown> | null;
  contract_id: string | null;
  created_at: string;
  updated_at: string;
};

type BotMessage = {
  id: string;
  application_id: string;
  channel: string;
  direction: "incoming" | "outgoing";
  text: string;
  created_at: string;
};

type Candidate = {
  id: string;
  full_name: string;
  age: number | null;
  specialization: string | null;
  experience_years: number | null;
  salary_min: number | null;
  salary_max: number | null;
  availability: string | null;
  contacts: Record<string, string> | null;
  tags: string[] | null;
};

type Match = {
  id: string;
  application_id: string;
  candidate_id: string;
  status: "sent" | "accepted" | "declined" | "client_approved";
  sent_at: string;
  responded_at: string | null;
  candidate: Candidate;
};

const STATUS_META: Array<{ key: ApplicationStatus; title: string }> = [
  { key: "new", title: "Новая" },
  { key: "bot_done", title: "Бот опросил" },
  { key: "interview_scheduled", title: "Собес назначен" },
  { key: "interviewed", title: "Собес прошёл" },
  { key: "matched", title: "Кандидат подобран" },
  { key: "contract_sent", title: "Договор отправлен" },
  { key: "closed", title: "Закрыта" },
];

const VIDEO_SERVICE_LABELS: Record<string, string> = {
  tolk: "Толк",
  yandex: "Яндекс Телемост",
  most: "Мост",
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  sent: "Отправлено",
  accepted: "Согласен",
  declined: "Отказал",
  client_approved: "Одобрен клиентом",
};

const MATCH_STATUS_COLOR: Record<string, string> = {
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-700",
  client_approved: "bg-purple-50 text-purple-700",
};

export default function ApplicationDetailsPage({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Search params state
  const [searchParams, setSearchParams] = useState({
    specialization: "",
    age_min: "",
    age_max: "",
    salary_max: "",
    experience_min: "",
  });
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingOffer, setSendingOffer] = useState(false);

  // Matches state
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [updatingMatchId, setUpdatingMatchId] = useState<string | null>(null);
  const [sendingToClient, setSendingToClient] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesBottomRef = useRef<HTMLDivElement>(null);

  async function loadApplication() {
    const res = await fetch(`/api/crm/applications/${applicationId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("app-load-failed");
    const data = (await res.json()) as Application;
    setApplication(data);
    setNotesDraft(data.manager_notes ?? "");
    // Pre-fill search params from saved search_params
    if (data.search_params) {
      const sp = data.search_params as Record<string, unknown>;
      setSearchParams({
        specialization: (sp.specialization as string) ?? "",
        age_min: sp.age_min != null ? String(sp.age_min) : "",
        age_max: sp.age_max != null ? String(sp.age_max) : "",
        salary_max: sp.salary_max != null ? String(sp.salary_max) : "",
        experience_min: sp.experience_min != null ? String(sp.experience_min) : "",
      });
    }
  }

  async function loadMessages() {
    const res = await fetch(`/api/crm/applications/${applicationId}/messages`, { cache: "no-store" });
    if (!res.ok) throw new Error("messages-load-failed");
    setMessages((await res.json()) as BotMessage[]);
  }

  async function loadMatches() {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/matches`, { cache: "no-store" });
      if (res.ok) setMatches((await res.json()) as Match[]);
    } finally {
      setMatchesLoading(false);
    }
  }

  async function updateApplication(payload: Partial<Application>) {
    const res = await fetch(`/api/crm/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("app-update-failed");
    const updated = (await res.json()) as Application;
    setApplication(updated);
    return updated;
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadApplication(), loadMessages(), loadMatches()]);
    } catch {
      setError("Не удалось загрузить карточку заявки");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveNotes() {
    setSaving(true);
    try {
      await updateApplication({ manager_notes: notesDraft });
    } catch {
      setError("Не удалось сохранить заметки");
    } finally {
      setSaving(false);
    }
  }

  async function onStatusChange(status: ApplicationStatus) {
    try {
      await updateApplication({ status });
    } catch {
      setError("Не удалось обновить статус");
    }
  }

  async function onSearch() {
    setSearching(true);
    setSearchResults([]);
    setSelectedIds(new Set());
    try {
      // Save search params to application
      const sp: Record<string, unknown> = {};
      if (searchParams.specialization) sp.specialization = searchParams.specialization;
      if (searchParams.age_min) sp.age_min = parseInt(searchParams.age_min);
      if (searchParams.age_max) sp.age_max = parseInt(searchParams.age_max);
      if (searchParams.salary_max) sp.salary_max = parseFloat(searchParams.salary_max);
      if (searchParams.experience_min) sp.experience_min = parseInt(searchParams.experience_min);

      await updateApplication({ search_params: sp });

      const res = await fetch(`/api/crm/applications/${applicationId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialization: searchParams.specialization || null,
          age_min: searchParams.age_min ? parseInt(searchParams.age_min) : null,
          age_max: searchParams.age_max ? parseInt(searchParams.age_max) : null,
          salary_max: searchParams.salary_max ? parseFloat(searchParams.salary_max) : null,
          experience_min: searchParams.experience_min ? parseInt(searchParams.experience_min) : null,
        }),
      });
      if (!res.ok) throw new Error("search failed");
      setSearchResults(await res.json());
    } catch {
      setError("Ошибка поиска соискателей");
    } finally {
      setSearching(false);
    }
  }

  async function onUpdateMatchStatus(matchId: string, newStatus: string) {
    setUpdatingMatchId(matchId);
    try {
      const res = await fetch(`/api/crm/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("update failed");
      await loadMatches();
    } catch {
      setError("Не удалось обновить статус");
    } finally {
      setUpdatingMatchId(null);
    }
  }

  async function onSendAllToClient() {
    setSendingToClient(true);
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/send-all-to-client`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "send failed");
      await Promise.all([loadApplication(), loadMatches()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Не удалось отправить клиенту");
    } finally {
      setSendingToClient(false);
    }
  }

  async function onSendOffers() {
    if (selectedIds.size === 0) return;
    setSendingOffer(true);
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("send failed");
      setSelectedIds(new Set());
      setSearchResults([]);
      await loadMatches();
    } catch {
      setError("Не удалось отправить предложения");
    } finally {
      setSendingOffer(false);
    }
  }

  function toggleCandidate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSendMessage() {
    const text = chatInput.trim();
    if (!text || sendingMessage) return;
    setSendingMessage(true);
    setChatInput("");
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("send-failed");
      await loadMessages();
    } catch {
      setError("Не удалось отправить сообщение");
      setChatInput(text); // возвращаем текст обратно
    } finally {
      setSendingMessage(false);
    }
  }

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadAll();
  }, [applicationId]);

  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws/applications/${applicationId}`);
    const ping = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 20000);

    ws.onmessage = async () => {
      try {
        await Promise.all([loadApplication(), loadMessages()]);
      } catch {
        // ignore transient websocket refresh errors
      }
    };

    return () => {
      window.clearInterval(ping);
      ws.close();
    };
  }, [applicationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-slate-500 text-sm">Загрузка карточки...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-red-600 text-sm mb-3">Заявка не найдена или недоступна.</p>
          <Link href="/crm" className="text-sm text-brand-navy hover:underline">
            Назад к доске
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Карточка заявки</h1>
            <p className="text-sm text-slate-500">ID: {application.id}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/crm/candidates" className="btn-secondary text-sm py-2.5 px-4">
              База соискателей
            </Link>
            <Link href="/crm" className="btn-primary text-sm py-2.5 px-5">
              К доске
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Row 1: Description + Contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-3">Описание заявки</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{application.description}</p>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Статус</label>
                <select
                  value={application.status}
                  onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
                  className="input-field mt-1"
                >
                  {STATUS_META.map((s) => (
                    <option key={s.key} value={s.key}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Создана</label>
                <p className="text-sm text-slate-700 mt-2">{new Date(application.created_at).toLocaleString("ru-RU")}</p>
              </div>
            </div>

            {/* Interview & video */}
            {application.interview_at && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-semibold text-amber-800 mb-1">📅 Собеседование</p>
                <p className="text-sm text-amber-700">{new Date(application.interview_at).toLocaleString("ru-RU")}</p>
                {application.video_link && (
                  <a href={application.video_link} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                    🎥 Перейти к видеовстрече ({VIDEO_SERVICE_LABELS[application.video_service ?? ""] ?? application.video_service})
                  </a>
                )}
              </div>
            )}

            {/* Contract */}
            {application.contract_id && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-semibold text-emerald-800 mb-1">📄 Договор создан</p>
                <div className="flex gap-3 mt-2">
                  <a href={`/api/contracts/${application.contract_id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="btn-secondary text-xs py-1.5 px-3">Скачать PDF</a>
                  <Link href={`/crm/contracts?app=${application.id}`} className="text-xs text-indigo-600 hover:underline py-1.5">
                    Управление договором →
                  </Link>
                </div>
              </div>
            )}

            {!application.contract_id && (
              <div className="mt-4">
                <Link href={`/crm/contracts?app=${application.id}`} className="btn-secondary text-sm py-2 px-4">
                  Создать договор
                </Link>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Заметки менеджера</h3>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={5}
                className="input-field resize-y"
                placeholder="Фиксируйте договоренности, требования и уточнения..."
              />
              <button onClick={onSaveNotes} disabled={saving} className="btn-secondary mt-3 text-sm py-2.5 px-4">
                {saving ? "Сохранение..." : "Сохранить заметки"}
              </button>
            </div>
          </section>

          <aside className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-3">Контакты клиента</h2>
            <div className="space-y-2 text-sm text-slate-700">
              {application.telegram_username ? (
                <p>
                  <span className="text-slate-500">Telegram: </span>
                  <a href={`https://t.me/${application.telegram_username.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline">
                    {application.telegram_username}
                  </a>
                </p>
              ) : <p className="text-slate-400">Telegram: —</p>}
              {application.whatsapp_phone ? (
                <p>
                  <span className="text-slate-500">WhatsApp: </span>
                  <a href={`https://wa.me/${application.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline">
                    {application.whatsapp_phone}
                  </a>
                </p>
              ) : <p className="text-slate-400">WhatsApp: —</p>}
              <p className="text-slate-400">MAX: {application.max_contact ?? "—"}</p>
              {application.email ? (
                <p>
                  <span className="text-slate-500">Email: </span>
                  <a href={`mailto:${application.email}`} className="text-brand-navy hover:underline">{application.email}</a>
                </p>
              ) : <p className="text-slate-400">Email: —</p>}
            </div>
          </aside>
        </div>

        {/* Search params + results */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Поиск соискателей</h2>
          <div className="grid sm:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500">Специализация</label>
              <input
                value={searchParams.specialization}
                onChange={(e) => setSearchParams((p) => ({ ...p, specialization: e.target.value }))}
                className="input-field mt-1"
                placeholder="няня, повар..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Возраст от</label>
              <input
                type="number" min="16"
                value={searchParams.age_min}
                onChange={(e) => setSearchParams((p) => ({ ...p, age_min: e.target.value }))}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Возраст до</label>
              <input
                type="number" min="16"
                value={searchParams.age_max}
                onChange={(e) => setSearchParams((p) => ({ ...p, age_max: e.target.value }))}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Макс. зарплата (₽)</label>
              <input
                type="number" min="0"
                value={searchParams.salary_max}
                onChange={(e) => setSearchParams((p) => ({ ...p, salary_max: e.target.value }))}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Опыт от (лет)</label>
              <input
                type="number" min="0"
                value={searchParams.experience_min}
                onChange={(e) => setSearchParams((p) => ({ ...p, experience_min: e.target.value }))}
                className="input-field mt-1"
              />
            </div>
          </div>
          <button onClick={onSearch} disabled={searching} className="btn-primary text-sm py-2.5 px-5">
            {searching ? "Поиск..." : "Найти соискателей"}
          </button>

          {searchResults.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-slate-700">
                  Найдено: <span className="font-semibold">{searchResults.length}</span>. Выберите и отправьте предложение.
                </p>
                <button
                  onClick={onSendOffers}
                  disabled={selectedIds.size === 0 || sendingOffer}
                  className="btn-primary text-sm py-2 px-4"
                >
                  {sendingOffer ? "Отправка..." : `Отправить предложение (${selectedIds.size})`}
                </button>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {searchResults.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <label key={c.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCandidate(c.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{c.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[
                            c.specialization,
                            c.age ? `${c.age} лет` : null,
                            c.experience_years != null ? `опыт ${c.experience_years} л.` : null,
                            c.salary_min != null ? `от ${c.salary_min.toLocaleString()} ₽` : null,
                            c.availability,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.tags.map((t) => (
                              <span key={t} className="bg-slate-100 text-slate-500 text-xs rounded-full px-2 py-0.5">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {!searching && searchResults.length === 0 && application.search_params && (
            <p className="mt-3 text-xs text-slate-400">Нажмите «Найти соискателей» чтобы запустить поиск по сохранённым параметрам.</p>
          )}
        </section>

        {/* Matches */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-slate-800">
              Предложения соискателям
              {matches.length > 0 && <span className="ml-2 text-slate-400 font-normal text-sm">({matches.length})</span>}
            </h2>
            <div className="flex gap-2 items-center">
              {matches.some((m) => m.status === "accepted") && (
                <button
                  onClick={onSendAllToClient}
                  disabled={sendingToClient}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  {sendingToClient ? "Отправка..." : `Отправить клиенту (${matches.filter((m) => m.status === "accepted").length})`}
                </button>
              )}
              <button onClick={loadMatches} className="text-xs text-slate-500 hover:text-slate-800">
                Обновить
              </button>
            </div>
          </div>
          {matchesLoading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-slate-500">Предложений пока нет. Найдите соискателей и отправьте предложение.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {matches.map((m) => {
                const isUpdating = updatingMatchId === m.id;
                return (
                  <div key={m.id} className="flex items-start justify-between p-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{m.candidate.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[
                          m.candidate.specialization,
                          m.candidate.age ? `${m.candidate.age} лет` : null,
                          m.candidate.experience_years != null ? `опыт ${m.candidate.experience_years} л.` : null,
                          m.candidate.salary_min != null ? `от ${m.candidate.salary_min.toLocaleString()} ₽` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Отправлено: {new Date(m.sent_at).toLocaleString("ru-RU")}
                        {m.responded_at && ` · Ответ: ${new Date(m.responded_at).toLocaleString("ru-RU")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${MATCH_STATUS_COLOR[m.status]}`}>
                        {MATCH_STATUS_LABEL[m.status]}
                      </span>
                      {/* Status action buttons */}
                      {m.status === "sent" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onUpdateMatchStatus(m.id, "accepted")}
                            disabled={isUpdating}
                            className="text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg px-2 py-1 transition"
                          >
                            Согласен
                          </button>
                          <button
                            onClick={() => onUpdateMatchStatus(m.id, "declined")}
                            disabled={isUpdating}
                            className="text-xs text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-2 py-1 transition"
                          >
                            Отказал
                          </button>
                        </div>
                      )}
                      {m.status === "accepted" && (
                        <button
                          onClick={() => onUpdateMatchStatus(m.id, "declined")}
                          disabled={isUpdating}
                          className="text-xs text-slate-500 border border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1 transition"
                        >
                          Отказал
                        </button>
                      )}
                      {m.status === "declined" && (
                        <button
                          onClick={() => onUpdateMatchStatus(m.id, "accepted")}
                          disabled={isUpdating}
                          className="text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg px-2 py-1 transition"
                        >
                          Согласен
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Chat */}
        <section className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden" style={{ height: "520px" }}>
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Чат с клиентом</h2>
              {application.telegram_username ? (
                <p className="text-xs text-slate-500">{application.telegram_username} · Telegram</p>
              ) : (
                <p className="text-xs text-slate-400">Telegram не указан</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-slate-400">Сообщений пока нет. Напишите первым!</p>
              </div>
            ) : (
              messages.map((m) => {
                const isOut = m.direction === "outgoing";
                return (
                  <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl ${
                      isOut
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      <p className={`text-[10px] mt-1 text-right ${isOut ? "text-blue-200" : "text-slate-400"}`}>
                        {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesBottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 flex gap-2 shrink-0">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              disabled={!application.telegram_username || sendingMessage}
              className="input-field flex-1 text-sm"
              placeholder={
                application.telegram_username
                  ? "Написать сообщение... (Enter для отправки)"
                  : "Telegram-контакт не указан"
              }
            />
            <button
              onClick={onSendMessage}
              disabled={!chatInput.trim() || !application.telegram_username || sendingMessage}
              className="btn-primary px-4 text-sm shrink-0"
            >
              {sendingMessage ? "..." : "Отправить"}
            </button>
          </div>
        </section>
      </main>

      {error && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>
        </div>
      )}
    </div>
  );
}
