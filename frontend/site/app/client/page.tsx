"use client";

import { useEffect, useState } from "react";
import { getMe, logout } from "@/lib/auth";
import { useRouter } from "next/navigation";

type ClientApp = {
  id: string;
  description: string;
  status: string;
  created_at: string;
};

type PortalData = {
  application: { id: string; description: string; status: string; created_at: string };
  mirror: {
    documents?: Array<{ id: string; filename: string; category?: string; uploaded_at?: string }>;
    compliance?: { offer_accepted?: boolean; pdn_accepted?: boolean; verification_status?: string };
    security_checks?: Array<{ id: string; status: string; filename: string; uploaded_at?: string }>;
    meetings?: Array<{ id: string; title: string; meeting_link?: string; status?: string; manager_summary?: string; ai_analysis?: string; share_ai_to_client?: boolean }>;
  };
  notifications: Array<{ id: string; title: string; body?: string; created_at?: string }>;
};

export default function ClientCabinetPage() {
  const router = useRouter();
  const [apps, setApps] = useState<ClientApp[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [error, setError] = useState("");

  async function loadApps() {
    const me = await getMe();
    if (!me) {
      router.push("/login");
      return;
    }
    if (me.role !== "client") {
      router.push("/crm");
      return;
    }
    const res = await fetch("/api/client/applications", { cache: "no-store" });
    if (!res.ok) throw new Error("apps-load-failed");
    const data = (await res.json()) as ClientApp[];
    setApps(data);
    if (data[0] && !selectedId) setSelectedId(data[0].id);
  }

  async function loadPortal(id: string) {
    const res = await fetch(`/api/client/applications/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("portal-load-failed");
    setPortal((await res.json()) as PortalData);
  }

  useEffect(() => {
    loadApps().catch(() => setError("Не удалось загрузить кабинет клиента"));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadPortal(selectedId).catch(() => setError("Не удалось загрузить данные заявки"));
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Кабинет клиента</h1>
            <p className="text-sm text-slate-500">Документы и статус работы по вашим заявкам (read-only).</p>
          </div>
          <button onClick={async () => { await logout(); router.push("/login"); }} className="btn-secondary text-sm py-2 px-3">
            Выйти
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-3 gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="font-semibold text-slate-800 mb-2">Мои заявки</h2>
          <div className="space-y-2">
            {apps.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${selectedId === a.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}
              >
                <p className="font-medium text-slate-800 truncate">{a.description}</p>
                <p className="text-xs text-slate-500">{a.status} · {new Date(a.created_at).toLocaleDateString("ru-RU")}</p>
              </button>
            ))}
            {apps.length === 0 && <p className="text-sm text-slate-500">Заявок пока нет.</p>}
          </div>
        </section>

        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!portal ? (
            <p className="text-sm text-slate-500">Выберите заявку для просмотра.</p>
          ) : (
            <>
              <div>
                <h2 className="font-semibold text-slate-800">Текущий статус</h2>
                <p className="text-sm text-slate-600 mt-1">{portal.application.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Согласия</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Оферта: {portal.mirror.compliance?.offer_accepted ? "принята" : "не принята"} · ПДн: {portal.mirror.compliance?.pdn_accepted ? "получено" : "не получено"} · Верификация: {portal.mirror.compliance?.verification_status || "pending"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Документы</h3>
                <div className="space-y-1 mt-1">
                  {(portal.mirror.documents || []).map((d) => (
                    <p key={d.id} className="text-xs text-slate-600">{d.filename} {d.category ? `· ${d.category}` : ""}</p>
                  ))}
                  {(portal.mirror.documents || []).length === 0 && <p className="text-xs text-slate-500">Пока нет документов.</p>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Онлайн-встречи</h3>
                <div className="space-y-2 mt-1">
                  {(portal.mirror.meetings || []).map((m) => (
                    <div key={m.id} className="rounded border border-slate-200 p-2">
                      <p className="text-xs font-medium text-slate-700">{m.title} · {m.status || "planned"}</p>
                      {m.meeting_link && <a href={m.meeting_link} className="text-xs text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{m.meeting_link}</a>}
                      {m.manager_summary && <p className="text-xs text-slate-600 mt-1">Итог: {m.manager_summary}</p>}
                      {m.share_ai_to_client && m.ai_analysis && <p className="text-xs text-slate-600 mt-1">AI-анализ: {m.ai_analysis}</p>}
                    </div>
                  ))}
                  {(portal.mirror.meetings || []).length === 0 && <p className="text-xs text-slate-500">Встреч пока нет.</p>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Уведомления</h3>
                <div className="space-y-1 mt-1">
                  {portal.notifications.map((n) => (
                    <p key={n.id} className="text-xs text-slate-600">{n.title} — {n.body || ""}</p>
                  ))}
                  {portal.notifications.length === 0 && <p className="text-xs text-slate-500">Пока нет уведомлений.</p>}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
