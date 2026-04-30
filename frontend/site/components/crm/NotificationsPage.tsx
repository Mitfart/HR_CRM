"use client";

import { useEffect, useState } from "react";
import CrmNav from "@/components/CrmNav";
import clsx from "clsx";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/notifications?limit=50", { cache: "no-store" });
      setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await fetch(`/api/crm/notifications/${id}/read`, { method: "POST" });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await fetch("/api/crm/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Уведомления" />
      <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            Уведомления {unread > 0 && <span className="text-sm font-normal text-slate-500">({unread} непрочитанных)</span>}
          </h2>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-sm text-indigo-600 hover:underline">Прочитать все</button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-400 py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-3">🔔</div>
            <p>Нет уведомлений</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={clsx(
                  "bg-white rounded-xl border p-4 transition",
                  n.is_read ? "border-slate-100 opacity-70" : "border-indigo-200 shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", n.is_read ? "bg-slate-200" : "bg-indigo-500")} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">{n.title}</div>
                    {n.body && <div className="text-sm text-slate-500 mt-0.5">{n.body}</div>}
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleString("ru-RU")}
                      {n.entity_type && ` · ${n.entity_type}`}
                    </div>
                  </div>
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">
                      Прочитано
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
