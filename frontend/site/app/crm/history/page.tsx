"use client";

import { useEffect, useState } from "react";
import CrmNav from "@/components/CrmNav";
import { getMe } from "@/lib/auth";

type HistoryEvent = {
  source: "activity" | "deletion" | "audit";
  created_at: string;
  actor_user_id: string | null;
  actor_name: string;
  category: "employee" | "ai" | "deletion" | "system";
  entity_type: string;
  entity_id: string;
  action: string;
  details?: Record<string, unknown>;
};

export const dynamic = "force-dynamic";

export default function CrmHistoryPage() {
  const [items, setItems] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [category, setCategory] = useState<"all" | "employee" | "ai" | "deletion" | "audit">("all");
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/history?scope=${scope}&category=${category}&limit=400`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setItems(await res.json());
    } catch {
      setError("Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getMe().then((u) => setIsAdmin(u?.role === "admin")).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [scope, category]);

  function categoryBadge(cat: HistoryEvent["category"]) {
    if (cat === "ai") return "bg-violet-100 text-violet-700";
    if (cat === "deletion") return "bg-rose-100 text-rose-700";
    if (cat === "employee") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="История" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h1 className="text-lg font-semibold text-slate-800 mb-1">Единая история действий</h1>
          <p className="text-sm text-slate-500 mb-4">Действия сотрудников, AI-помощника и удаления в одном журнале (только чтение).</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="text-sm rounded-lg border border-slate-300 px-3 py-1.5"
            >
              <option value="all">Все события</option>
              <option value="employee">Действия сотрудников</option>
              <option value="ai">Действия AI</option>
              <option value="deletion">Удаления</option>
              <option value="audit">Аудит-лог</option>
            </select>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "mine" | "all")}
              className="text-sm rounded-lg border border-slate-300 px-3 py-1.5"
              disabled={!isAdmin}
            >
              <option value="mine">Мои события</option>
              <option value="all">Все сотрудники (admin)</option>
            </select>
          </div>
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">Событий пока нет.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Когда</th>
                    <th className="text-left px-3 py-2">Кто</th>
                    <th className="text-left px-3 py-2">Категория</th>
                    <th className="text-left px-3 py-2">Действие</th>
                    <th className="text-left px-3 py-2">Сущность</th>
                    <th className="text-left px-3 py-2">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={`${it.entity_id}-${it.created_at}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">{new Date(it.created_at).toLocaleString("ru-RU")}</td>
                      <td className="px-3 py-2 text-slate-700">{it.actor_name}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${categoryBadge(it.category)}`}>
                          {it.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.action}</td>
                      <td className="px-3 py-2 text-slate-600">{it.entity_type} · {it.entity_id}</td>
                      <td className="px-3 py-2 text-slate-500">{JSON.stringify(it.details || {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
