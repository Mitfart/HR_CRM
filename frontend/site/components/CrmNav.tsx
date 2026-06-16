"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, getMe } from "@/lib/auth";
import clsx from "clsx";

type NavItem = { href: string; label: string; icon: string; guide: string; exact?: boolean };
type AdminAttention = { kind: string; priority: string; title: string; body: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/crm", label: "Заявки", icon: "📋", guide: "Главная доска заявок: статусы, карточки, быстрые действия.", exact: true },
  { href: "/crm/office", label: "Офис HR", icon: "🏢", guide: "Вакансии, отклики, единая переписка, резюме, договоры, отчеты и контроль удаления." },
  { href: "/crm/deals", label: "Сделки", icon: "💼", guide: "Таблица сделок из Google Sheet с ручным редактированием и комментариями." },
  { href: "/crm/candidates", label: "Соискатели", icon: "🔍", guide: "База кандидатов: поиск, фильтры, просмотр профилей." },
  { href: "/crm/history", label: "История", icon: "📝", guide: "Журнал действий сотрудников и AI-помощника: изменения, удаления, служебные события." },
  { href: "/crm/calendar", label: "Календарь", icon: "📅", guide: "Планирование встреч и контроль расписания." },
  { href: "/crm/contracts", label: "Договоры", icon: "📄", guide: "Создание и управление договорами по заявкам." },
  { href: "/crm/notifications", label: "Уведомления", icon: "🔔", guide: "Все новые события: сообщения, ответы, изменения статусов." },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/crm/bot-scripts", label: "Скрипты бота", icon: "🤖", guide: "Редактор вопросов, которые бот задает клиенту." },
  { href: "/crm/admin", label: "Настройки", icon: "⚙️", guide: "Управление пользователями и системными настройками CRM." },
];

export default function CrmNav({ title }: { title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unread, setUnread] = useState(0);
  const [adminAttention, setAdminAttention] = useState<AdminAttention[]>([]);
  const [showAttention, setShowAttention] = useState(true);
  const [timeState, setTimeState] = useState<{
    active_session: {
      paused?: boolean;
      start_at?: string;
    } | null;
    worked_seconds_current: number;
    worked_seconds_today: number;
    breaks_today: number;
  } | null>(null);
  const [timeActionLoading, setTimeActionLoading] = useState(false);

  useEffect(() => {
    getMe().then((u) => {
      if (u?.role === "admin") {
        setIsAdmin(true);
        fetch("/api/crm/office-operations/admin-attention", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : [])
          .then((d: AdminAttention[]) => setAdminAttention(Array.isArray(d) ? d.slice(0, 3) : []))
          .catch(() => {});
      }
    });
    fetch("/api/notifications?unread_only=true&limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: unknown[]) => setUnread(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  async function loadTimeState() {
    try {
      const res = await fetch("/api/crm/hr-time/status", { cache: "no-store" });
      if (!res.ok) return;
      setTimeState(await res.json());
    } catch {
      // silent
    }
  }

  async function doTimeAction(action: "start" | "pause" | "resume" | "stop") {
    setTimeActionLoading(true);
    try {
      const res = await fetch("/api/crm/hr-time/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      await loadTimeState();
    } finally {
      setTimeActionLoading(false);
    }
  }

  useEffect(() => {
    loadTimeState();
    const t = window.setInterval(loadTimeState, 15000);
    return () => window.clearInterval(t);
  }, []);

  function fmt(sec: number | undefined) {
    const s = Math.max(sec || 0, 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}ч ${m}м`;
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      {isAdmin && showAttention && adminAttention.length > 0 && (
        <div className="fixed right-4 top-16 z-50 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-amber-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-100 px-3 py-2">
            <span className="text-sm font-semibold text-amber-900">Требует внимания</span>
            <button onClick={() => setShowAttention(false)} className="text-xs text-slate-400 hover:text-slate-700">Закрыть</button>
          </div>
          <div className="divide-y divide-slate-100">
            {adminAttention.map((item, idx) => (
              <div key={`${item.kind}-${idx}`} className="px-3 py-2">
                <div className="text-sm font-medium text-slate-900">{item.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 text-lg hidden sm:block">GoodPeople CRM</span>
            {title && <span className="text-slate-400 hidden sm:block">/</span>}
            {title && <span className="font-semibold text-slate-700">{title}</span>}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
              <span className="text-[11px] text-slate-500">Сегодня: {fmt(timeState?.worked_seconds_today)}</span>
              <span className="text-[11px] text-slate-400">|</span>
              <span className="text-[11px] text-slate-500">Перерывы: {timeState?.breaks_today ?? 0}</span>
              {!timeState?.active_session ? (
                <button
                  onClick={() => doTimeAction("start")}
                  disabled={timeActionLoading}
                  className="text-[11px] px-2 py-1 rounded bg-emerald-100 text-emerald-700"
                >
                  Старт
                </button>
              ) : timeState.active_session.paused ? (
                <>
                  <button
                    onClick={() => doTimeAction("resume")}
                    disabled={timeActionLoading}
                    className="text-[11px] px-2 py-1 rounded bg-blue-100 text-blue-700"
                  >
                    Возобновить
                  </button>
                  <button
                    onClick={() => doTimeAction("stop")}
                    disabled={timeActionLoading}
                    className="text-[11px] px-2 py-1 rounded bg-rose-100 text-rose-700"
                  >
                    Стоп
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-indigo-700">Идет: {fmt(timeState?.worked_seconds_current)}</span>
                  <button
                    onClick={() => doTimeAction("pause")}
                    disabled={timeActionLoading}
                    className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-700"
                  >
                    Пауза
                  </button>
                  <button
                    onClick={() => doTimeAction("stop")}
                    disabled={timeActionLoading}
                    className="text-[11px] px-2 py-1 rounded bg-rose-100 text-rose-700"
                  >
                    Стоп
                  </button>
                </>
              )}
            </div>
            <Link
              href="/crm/notifications"
              data-guide="Откройте список уведомлений. Красный бейдж показывает непрочитанные."
              className="relative p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <span className="text-lg">🔔</span>
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button
              onClick={async () => { await logout(); router.push("/login"); }}
              data-guide="Выход из учетной записи. После выхода нужно войти заново."
              className="text-sm text-slate-500 hover:text-slate-800 transition py-1.5 px-3"
            >
              Выйти
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-0 -mb-px scrollbar-none">
          {[...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-guide={item.guide}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive(item.href, item.exact)
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
