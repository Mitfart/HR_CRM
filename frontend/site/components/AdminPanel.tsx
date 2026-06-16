"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logout } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = "admin" | "manager" | "client" | "candidate";

type CrmUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

type ScriptStep = {
  step: number;
  question: string;
};

type HrRow = {
  user_id: string;
  name: string;
  hours_estimate: number;
  breaks_count: number;
  touches: number;
  applications_updates: number;
  status_changes: number;
  notes_updates: number;
  candidate_actions: number;
  calls_made: number;
  calls_answered: number;
  messages_answered: number;
  responses_processed: number;
  resumes_made: number;
  kpi_points: number;
  game_level: number;
  badge: string;
};

type VacancyRow = {
  vacancy: string;
  applications_count: number;
  responses_processed: number;
  calls_made: number;
  calls_answered: number;
  messages_answered: number;
  resumes_made: number;
};

type HrStatsPayload = {
  period_days: number;
  generated_at: string;
  leaderboard: HrRow[];
  vacancy_table: VacancyRow[];
  totals: {
    hours: number;
    touches: number;
    applications_updates: number;
    status_changes: number;
    calls_made: number;
    messages_answered: number;
    responses_processed: number;
    resumes_made: number;
  };
};

type QuestionnairesMap = Record<string, string[]>;

type DeletionEvent = {
  created_at: string;
  actor_user_id: string | null;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details?: Record<string, unknown>;
};

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  client: "Клиент",
  candidate: "Соискатель",
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  client: "bg-green-100 text-green-800",
  candidate: "bg-amber-100 text-amber-800",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "manager" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить пользователей");
      setUsers(await res.json());
    } catch {
      setError("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error ?? "Ошибка создания пользователя");
        return;
      }
      setCreating(false);
      setForm({ email: "", full_name: "", password: "", role: "manager" });
      await loadUsers();
    } catch {
      setFormError("Ошибка создания пользователя");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: CrmUser) {
    try {
      const res = await fetch(`/api/crm/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Ошибка обновления");
        return;
      }
      const updated: CrmUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError("Ошибка обновления пользователя");
    }
  }

  useEffect(() => { loadUsers(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Загрузка пользователей...</p>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Пользователи системы</h2>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm py-2 px-4">
          + Добавить пользователя
        </button>
      </div>

      {creating && (
        <form onSubmit={createUser} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-slate-800">Новый пользователь</h3>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              type="email"
              placeholder="Email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              required
              placeholder="Полное имя"
              className="input-field"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
            <input
              required
              type="password"
              placeholder="Пароль"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <select
              className="input-field"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="manager">Менеджер</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4">
              {saving ? "Создание..." : "Создать"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setFormError(""); }} className="btn-secondary text-sm py-2 px-4">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Пользователь</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Роль</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-left px-4 py-3">Дата создания</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-800">{user.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {user.is_active ? "Активен" : "Отключён"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(user.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(user)}
                    className={`text-xs py-1.5 px-3 rounded-lg border transition ${user.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                  >
                    {user.is_active ? "Отключить" : "Активировать"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Scripts Tab ───────────────────────────────────────────────────────────────

function ScriptsTab() {
  const [steps, setSteps] = useState<ScriptStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadScripts() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/bot-scripts", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить скрипты");
      setSteps(await res.json());
    } catch {
      setError("Ошибка загрузки скриптов");
    } finally {
      setLoading(false);
    }
  }

  async function saveScripts() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/bot-scripts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(steps),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Ошибка сохранения скриптов");
    } finally {
      setSaving(false);
    }
  }

  function addStep() {
    const nextStep = steps.length ? steps[steps.length - 1].step + 1 : 1;
    setSteps((prev) => [...prev, { step: nextStep, question: "" }]);
  }

  function updateQuestion(idx: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, question: value } : s)));
  }

  function removeStep(idx: number) {
    setSteps((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }))
    );
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(next.map((s, i) => ({ ...s, step: i + 1 })));
  }

  useEffect(() => { loadScripts(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Загрузка скриптов...</p>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Скрипт вопросов бота</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Бот задаёт вопросы клиенту в указанном порядке.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={addStep} className="btn-secondary text-sm py-2 px-4">
            + Добавить вопрос
          </button>
          <button onClick={saveScripts} disabled={saving} className="btn-primary text-sm py-2 px-4">
            {saving ? "Сохранение..." : saved ? "Сохранено ✓" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="flex gap-3 items-start bg-white border border-slate-200 rounded-2xl p-4">
            <span className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
              {step.step}
            </span>
            <textarea
              rows={2}
              className="input-field flex-1 resize-y text-sm"
              placeholder="Текст вопроса..."
              value={step.question}
              onChange={(e) => updateQuestion(idx, e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => moveStep(idx, -1)}
                disabled={idx === 0}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition text-xs px-2 py-1 border border-slate-200 rounded-lg"
              >
                ▲
              </button>
              <button
                onClick={() => moveStep(idx, 1)}
                disabled={idx === steps.length - 1}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition text-xs px-2 py-1 border border-slate-200 rounded-lg"
              >
                ▼
              </button>
              <button
                onClick={() => removeStep(idx)}
                className="text-red-400 hover:text-red-600 transition text-xs px-2 py-1 border border-red-100 rounded-lg"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {steps.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            Нет вопросов. Нажмите «+ Добавить вопрос».
          </p>
        )}
      </div>
    </div>
  );
}

function HrAnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<HrStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStats(period = days) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/admin/hr-stats?days=${period}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setData(await res.json());
    } catch {
      setError("Не удалось загрузить HR-аналитику");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Загрузка HR-аналитики...</p>;

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">HR Статистика и KPI</h2>
          <p className="text-sm text-slate-500">Геймификация, производительность и касания по вакансиям</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input-field text-sm py-2"
            value={days}
            onChange={(e) => {
              const next = parseInt(e.target.value);
              setDays(next);
              loadStats(next);
            }}
          >
            <option value={7}>7 дней</option>
            <option value={14}>14 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
          <button onClick={() => loadStats(days)} className="btn-secondary text-sm py-2 px-4">
            Обновить
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Отработано часов</p>
              <p className="text-2xl font-semibold text-slate-800">{data.totals.hours}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Касаний CRM</p>
              <p className="text-2xl font-semibold text-slate-800">{data.totals.touches}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Звонков</p>
              <p className="text-2xl font-semibold text-slate-800">{data.totals.calls_made}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Разобрано откликов</p>
              <p className="text-2xl font-semibold text-slate-800">{data.totals.responses_processed}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Лидерборд HR (игровая мотивация)</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.leaderboard.map((row, idx) => {
                const maxPoints = Math.max(...data.leaderboard.map((r) => r.kpi_points), 1);
                const progress = Math.round((row.kpi_points / maxPoints) * 100);
                return (
                  <div key={row.user_id} className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          #{idx + 1} {row.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Уровень {row.game_level} · Бейдж: {row.badge}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-indigo-700">{row.kpi_points} очков</p>
                        <p className="text-xs text-slate-500">
                          {row.hours_estimate} ч · перерывы: {row.breaks_count}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs min-w-[1250px]">
              <thead className="bg-sky-100 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">HR</th>
                  <th className="text-left px-3 py-2">Часы</th>
                  <th className="text-left px-3 py-2">Перерывы</th>
                  <th className="text-left px-3 py-2">Касания</th>
                  <th className="text-left px-3 py-2">Обновл. заявок</th>
                  <th className="text-left px-3 py-2">Смена статуса</th>
                  <th className="text-left px-3 py-2">Звонков</th>
                  <th className="text-left px-3 py-2">Ответов на звонки</th>
                  <th className="text-left px-3 py-2">Ответов в сообщениях</th>
                  <th className="text-left px-3 py-2">Разобрано откликов</th>
                  <th className="text-left px-3 py-2">Сделано резюме</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leaderboard.map((r) => (
                  <tr key={r.user_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                    <td className="px-3 py-2">{r.hours_estimate}</td>
                    <td className="px-3 py-2">{r.breaks_count}</td>
                    <td className="px-3 py-2">{r.touches}</td>
                    <td className="px-3 py-2">{r.applications_updates}</td>
                    <td className="px-3 py-2">{r.status_changes}</td>
                    <td className="px-3 py-2">{r.calls_made}</td>
                    <td className="px-3 py-2">{r.calls_answered}</td>
                    <td className="px-3 py-2">{r.messages_answered}</td>
                    <td className="px-3 py-2">{r.responses_processed}</td>
                    <td className="px-3 py-2">{r.resumes_made}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-emerald-100 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">Вакансия</th>
                  <th className="text-left px-3 py-2">Разобрано откликов</th>
                  <th className="text-left px-3 py-2">Звонков</th>
                  <th className="text-left px-3 py-2">Ответов на звонки</th>
                  <th className="text-left px-3 py-2">Ответов в сообщениях</th>
                  <th className="text-left px-3 py-2">Сделано резюме</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.vacancy_table.map((v) => (
                  <tr key={v.vacancy} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{v.vacancy}</td>
                    <td className="px-3 py-2">{v.responses_processed}</td>
                    <td className="px-3 py-2">{v.calls_made}</td>
                    <td className="px-3 py-2">{v.calls_answered}</td>
                    <td className="px-3 py-2">{v.messages_answered}</td>
                    <td className="px-3 py-2">{v.resumes_made}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DeletionsTab() {
  const [items, setItems] = useState<DeletionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/deletions?scope=all&limit=500", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setItems(await res.json());
    } catch {
      setError("Не удалось загрузить историю удалений");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-sm text-slate-500">Загрузка истории удалений...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">История удалений CRM</h2>
          <p className="text-sm text-slate-500">Только чтение. Кто удалил и когда.</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm py-2 px-4">Обновить</button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Когда</th>
              <th className="text-left px-3 py-2">Кто</th>
              <th className="text-left px-3 py-2">Действие</th>
              <th className="text-left px-3 py-2">Сущность</th>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Детали</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => (
              <tr key={`${it.entity_id}-${it.created_at}-${idx}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-600">{new Date(it.created_at).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">{it.actor_name}</td>
                <td className="px-3 py-2">{it.action}</td>
                <td className="px-3 py-2">{it.entity_type}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{it.entity_id}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{JSON.stringify(it.details || {})}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-sm text-slate-400 text-center">Событий удаления пока нет.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionnairesTab() {
  const [items, setItems] = useState<QuestionnairesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profession, setProfession] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/crm/admin/questionnaires", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setItems(await res.json());
    } catch {
      setError("Не удалось загрузить опросники");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const prof = profession.trim().toLowerCase();
    const questions = questionsText.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!prof || questions.length === 0) {
      setError("Укажите профессию и минимум 1 вопрос");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/admin/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profession: prof, questions }),
      });
      if (!res.ok) throw new Error("save failed");
      setProfession("");
      setQuestionsText("");
      await load();
    } catch {
      setError("Не удалось сохранить опросник");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { load(); }, []);
  if (loading) return <p className="text-sm text-slate-500">Загрузка AI-опросников...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">AI-опросники по профессиям</h2>
        <p className="text-sm text-slate-500">AI использует эти вопросы для анкетирования и авто-резюме.</p>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <input
          value={profession}
          onChange={(e) => setProfession(e.target.value)}
          className="input-field"
          placeholder="Профессия (например: няня)"
        />
        <textarea
          value={questionsText}
          onChange={(e) => setQuestionsText(e.target.value)}
          rows={6}
          className="input-field resize-y"
          placeholder={"Вопрос 1\nВопрос 2\nВопрос 3"}
        />
        <button onClick={save} disabled={saving} className="btn-primary text-sm py-2 px-4">
          {saving ? "Сохранение..." : "Сохранить опросник"}
        </button>
      </div>

      <div className="space-y-2">
        {Object.entries(items).map(([prof, qs]) => (
          <div key={prof} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800">{prof}</p>
            <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc pl-5">
              {qs.map((q) => <li key={q}>{q}</li>)}
            </ul>
            <button
              className="mt-2 text-xs text-indigo-600 hover:underline"
              onClick={() => {
                setProfession(prof);
                setQuestionsText(qs.join("\n"));
              }}
            >
              Редактировать
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = "users" | "scripts" | "hr_analytics" | "deletions" | "questionnaires";

export default function AdminPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
            <p className="text-sm text-slate-500">Этап 8: управление пользователями и скриптами бота</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/crm" className="btn-secondary text-sm py-2.5 px-4">
              ← CRM
            </Link>
            <button
              onClick={async () => { await logout(); router.push("/login"); }}
              className="text-sm text-slate-500 hover:text-slate-800 transition py-2.5 px-3"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit mb-6">
          {(["users", "scripts", "questionnaires", "hr_analytics", "deletions"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition ${
                tab === t
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "users"
                ? "Пользователи"
                : t === "scripts"
                  ? "Скрипты бота"
                  : t === "questionnaires"
                    ? "AI опросники"
                    : t === "hr_analytics"
                      ? "HR аналитика"
                      : "Удаления"}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          {tab === "users"
            ? <UsersTab />
            : tab === "scripts"
              ? <ScriptsTab />
              : tab === "questionnaires"
                ? <QuestionnairesTab />
              : tab === "hr_analytics"
                ? <HrAnalyticsTab />
                : <DeletionsTab />}
        </div>
      </main>
    </div>
  );
}
