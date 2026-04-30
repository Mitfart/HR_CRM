"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { logout, getMe } from "@/lib/auth";
import { useRouter } from "next/navigation";
import CrmNav from "@/components/CrmNav";

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

const STATUS_META: Array<{ key: ApplicationStatus; title: string; color: string }> = [
  { key: "new", title: "Новая", color: "#94a3b8" },
  { key: "bot_done", title: "Бот опросил", color: "#6366f1" },
  { key: "interview_scheduled", title: "Собес назначен", color: "#f59e0b" },
  { key: "interviewed", title: "Собес прошёл", color: "#3b82f6" },
  { key: "matched", title: "Кандидат подобран", color: "#8b5cf6" },
  { key: "contract_sent", title: "Договор отправлен", color: "#10b981" },
  { key: "closed", title: "Закрыта", color: "#64748b" },
];

const statusLabel = Object.fromEntries(STATUS_META.map((x) => [x.key, x.title])) as Record<ApplicationStatus, string>;

function shortDescription(text: string) {
  return text.length > 110 ? `${text.slice(0, 110)}...` : text;
}

const VIDEO_SERVICE_LABELS: Record<string, string> = {
  tolk: "Толк",
  yandex: "Яндекс Телемост",
  most: "Мост",
};

export default function CrmBoard() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "telegram" | "whatsapp" | "max" | "email">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadApplications() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/applications?limit=200", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить заявки");
      setItems((await res.json()) as Application[]);
    } catch {
      setError("Ошибка загрузки заявок");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(appId: string) {
    try {
      const res = await fetch(`/api/crm/applications/${appId}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      setMessages((await res.json()) as BotMessage[]);
    } catch {
      setMessages([]);
    }
  }

  async function openDetails(app: Application) {
    setSelected(app);
    setNotesDraft(app.manager_notes ?? "");
    await loadMessages(app.id);
  }

  async function updateApplication(appId: string, payload: Partial<Application>) {
    const res = await fetch(`/api/crm/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("update failed");
    return (await res.json()) as Application;
  }

  async function moveStatus(appId: string, status: ApplicationStatus) {
    try {
      const updated = await updateApplication(appId, { status });
      setItems((prev) => prev.map((x) => (x.id === appId ? updated : x)));
      setSelected((prev) => (prev?.id === appId ? updated : prev));
    } catch {
      setError("Не удалось обновить статус");
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateApplication(selected.id, { manager_notes: notesDraft });
      setItems((prev) => prev.map((x) => (x.id === selected.id ? updated : x)));
      setSelected(updated);
    } catch {
      setError("Не удалось сохранить заметки");
    } finally {
      setSaving(false);
    }
  }

  async function createVideoLink(videoService: string) {
    if (!selected) return;
    try {
      const res = await fetch("/api/calendar/video-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: selected.id, video_service: videoService }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const updated = { ...selected, video_link: data.video_link, video_service: videoService };
      setSelected(updated as Application);
      setItems((prev) => prev.map((x) => (x.id === selected.id ? (updated as Application) : x)));
    } catch {
      setError("Не удалось создать ссылку на видеовстречу");
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((app) => {
      const byStatus = statusFilter === "all" || app.status === statusFilter;
      const byChannel =
        channelFilter === "all" ||
        (channelFilter === "telegram" && !!app.telegram_username) ||
        (channelFilter === "whatsapp" && !!app.whatsapp_phone) ||
        (channelFilter === "max" && !!app.max_contact) ||
        (channelFilter === "email" && !!app.email);
      const haystack = [app.description, app.telegram_username ?? "", app.whatsapp_phone ?? "", app.max_contact ?? "", app.email ?? ""]
        .join(" ")
        .toLowerCase();
      return byStatus && byChannel && (q.length === 0 || haystack.includes(q));
    });
  }, [items, search, channelFilter, statusFilter]);

  const columns = useMemo(() => {
    const map = new Map<ApplicationStatus, Application[]>();
    for (const col of STATUS_META) map.set(col.key, []);
    for (const app of filteredItems) map.get(app.status)?.push(app);
    return map;
  }, [filteredItems]);

  useEffect(() => {
    loadApplications();
    getMe().then((me) => { if (me?.role === "admin") setIsAdmin(true); });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws/applications/${selected.id}`);
    const ping = window.setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 20000);
    ws.onmessage = async () => {
      await loadMessages(selected.id);
      await loadApplications();
    };
    return () => { window.clearInterval(ping); ws.close(); };
  }, [selected]);

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Доска заявок" />

      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field" placeholder="Поиск по описанию и контактам..." />
          <select className="input-field" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}>
            <option value="all">Все каналы</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="max">MAX</option>
            <option value="email">Email</option>
          </select>
          <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">Все статусы</option>
            {STATUS_META.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        </div>
      </section>

      {error && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 overflow-x-auto">
        {loading ? (
          <div className="text-slate-500 text-sm">Загрузка заявок...</div>
        ) : (
          <div className="flex gap-4 min-w-[1400px]">
            {STATUS_META.map((col) => {
              const list = columns.get(col.key) ?? [];
              return (
                <section key={col.key} className="bg-white rounded-2xl border border-slate-200 p-3 flex-shrink-0 w-[200px]">
                  <div className="flex items-center justify-between mb-3 gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                      <h2 className="font-semibold text-xs text-slate-800 truncate">{col.title}</h2>
                    </div>
                    <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">{list.length}</span>
                  </div>
                  <div
                    className={clsx("space-y-2 min-h-[120px] rounded-lg transition-colors", draggedId ? "bg-slate-50/70" : "")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const appId = e.dataTransfer.getData("text/plain");
                      setDraggedId(null);
                      if (appId) await moveStatus(appId, col.key);
                    }}
                  >
                    {list.map((app) => (
                      <article
                        key={app.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", app.id); setDraggedId(app.id); }}
                        onDragEnd={() => setDraggedId(null)}
                        className={clsx(
                          "rounded-xl border border-slate-200 p-2.5 hover:border-slate-300 transition cursor-pointer bg-white",
                          draggedId === app.id && "opacity-60"
                        )}
                        onClick={() => openDetails(app)}
                      >
                        <p className="text-[10px] text-slate-400 mb-1">{new Date(app.created_at).toLocaleDateString("ru-RU")}</p>
                        <p className="text-xs text-slate-800 leading-relaxed line-clamp-3">{shortDescription(app.description)}</p>
                        <div className="mt-1.5 text-[10px] text-slate-500 space-y-0.5">
                          {app.telegram_username && <p>TG: {app.telegram_username}</p>}
                          {app.whatsapp_phone && <p>WA: {app.whatsapp_phone}</p>}
                          {app.email && <p>📧 {app.email}</p>}
                        </div>
                        {app.interview_at && (
                          <p className="mt-1 text-[10px] text-amber-600 font-medium">
                            📅 {new Date(app.interview_at).toLocaleString("ru-RU")}
                          </p>
                        )}
                        {app.video_link && (
                          <a href={app.video_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="mt-1 text-[10px] text-indigo-600 hover:underline block truncate">
                            🎥 {VIDEO_SERVICE_LABELS[app.video_service ?? ""] ?? app.video_service}
                          </a>
                        )}
                        {app.contract_id && (
                          <p className="mt-1 text-[10px] text-emerald-600 font-medium">📄 Договор создан</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Side panel */}
      {selected && (
        <aside className="fixed inset-y-0 right-0 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl z-30 overflow-y-auto">
          <div className="p-5 border-b border-slate-200 flex justify-between items-start gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Заявка</p>
              <h3 className="text-lg font-semibold text-slate-900">{statusLabel[selected.status]}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-800 transition">Закрыть</button>
          </div>

          <div className="p-5 space-y-6">
            {/* Status change */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Статус</h4>
              <select
                value={selected.status}
                onChange={(e) => moveStatus(selected.id, e.target.value as ApplicationStatus)}
                className="input-field"
              >
                {STATUS_META.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
            </section>

            {/* Description */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Описание</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{selected.description}</p>
            </section>

            {/* Contacts */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Контакты</h4>
              <div className="text-sm text-slate-600 space-y-1">
                {selected.telegram_username && (
                  <p>
                    Telegram:{" "}
                    <a href={`https://t.me/${selected.telegram_username.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      {selected.telegram_username}
                    </a>
                  </p>
                )}
                {selected.whatsapp_phone && (
                  <p>
                    WhatsApp:{" "}
                    <a href={`https://wa.me/${selected.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                      {selected.whatsapp_phone}
                    </a>
                  </p>
                )}
                {selected.max_contact && <p>MAX: {selected.max_contact}</p>}
                {selected.email && (
                  <p>
                    Email:{" "}
                    <a href={`mailto:${selected.email}`} className="text-indigo-600 hover:underline">{selected.email}</a>
                  </p>
                )}
              </div>
            </section>

            {/* Interview info */}
            {selected.interview_at && (
              <section>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Собеседование</h4>
                <p className="text-sm text-slate-700">
                  {new Date(selected.interview_at).toLocaleString("ru-RU")}
                </p>
                {selected.video_link && (
                  <a href={selected.video_link} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                    🎥 Перейти к видеовстрече ({VIDEO_SERVICE_LABELS[selected.video_service ?? ""] ?? selected.video_service})
                  </a>
                )}
              </section>
            )}

            {/* Create video link */}
            {!selected.video_link && (
              <section>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Создать ссылку на видеовстречу</h4>
                <div className="flex gap-2 flex-wrap">
                  {["tolk", "yandex", "most"].map((svc) => (
                    <button key={svc} onClick={() => createVideoLink(svc)} className="btn-secondary text-xs py-1.5 px-3">
                      {VIDEO_SERVICE_LABELS[svc]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Manager notes */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Заметки менеджера</h4>
              <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={5} className="input-field resize-y"
                placeholder="Уточнения после звонка, условия, договорённости..." />
              <button onClick={saveNotes} disabled={saving} className="btn-secondary mt-3 text-sm py-2.5 px-4">
                {saving ? "Сохранение..." : "Сохранить заметки"}
              </button>
            </section>

            {/* Actions */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Действия</h4>
              <div className="flex flex-wrap gap-2">
                <Link href={`/crm/applications/${selected.id}`} className="btn-secondary text-sm py-2 px-4">
                  Открыть карточку
                </Link>
                <Link href={`/crm/candidates?app=${selected.id}`} className="btn-secondary text-sm py-2 px-4">
                  Найти соискателей
                </Link>
                {!selected.contract_id && (
                  <Link href={`/crm/contracts?app=${selected.id}`} className="btn-secondary text-sm py-2 px-4">
                    Создать договор
                  </Link>
                )}
                {selected.contract_id && (
                  <Link href={`/crm/contracts/${selected.contract_id}`} className="text-sm text-emerald-600 hover:underline py-2 px-4">
                    Открыть договор
                  </Link>
                )}
              </div>
            </section>

            {/* Bot messages */}
            <section>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">История сообщений бота</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока нет сообщений.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={clsx("rounded-lg border p-2.5", m.direction === "incoming" ? "border-indigo-100 bg-indigo-50" : "border-slate-200 bg-white")}>
                      <p className="text-xs text-slate-500 mb-1">
                        {m.channel} · {m.direction === "incoming" ? "клиент" : "бот"} · {new Date(m.created_at).toLocaleString("ru-RU")}
                      </p>
                      <p className="text-sm text-slate-700">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
