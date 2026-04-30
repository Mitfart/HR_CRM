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

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = "users" | "scripts";

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
          {(["users", "scripts"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition ${
                tab === t
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "users" ? "Пользователи" : "Скрипты бота"}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          {tab === "users" ? <UsersTab /> : <ScriptsTab />}
        </div>
      </main>
    </div>
  );
}
