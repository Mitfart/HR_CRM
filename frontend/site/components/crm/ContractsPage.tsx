"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CrmNav from "@/components/CrmNav";

type ContractTemplate = {
  id: string;
  name: string;
  html_content: string;
  variables: string | null;
  created_at: string;
};

type Contract = {
  id: string;
  application_id: string | null;
  candidate_id: string | null;
  template_id: string | null;
  pdf_url: string | null;
  status: "draft" | "sent" | "signed" | "archived";
  created_at: string;
  sent_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  sent: "Отправлен",
  signed: "Подписан",
  archived: "Архив",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  archived: "bg-slate-100 text-slate-400",
};

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const appId = searchParams.get("app");

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        fetch("/api/contracts", { cache: "no-store" }),
        fetch("/api/contracts/templates", { cache: "no-store" }),
      ]);
      if (cRes.ok) setContracts(await cRes.json());
      if (tRes.ok) {
        const tmplList = await tRes.json();
        setTemplates(tmplList);
        if (tmplList.length > 0) setSelectedTemplateId(tmplList[0].id);
      }
    } catch {
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }

  async function createContract() {
    if (!selectedTemplateId || !appId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: appId, template_id: selectedTemplateId }),
      });
      if (!res.ok) throw new Error("failed");
      await loadData();
    } catch {
      setError("Не удалось создать договор");
    } finally {
      setCreating(false);
    }
  }

  async function sendContract(contractId: string) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      await loadData();
    } catch {
      setError("Не удалось отправить договор");
    }
  }

  useEffect(() => { loadData(); }, []);

  const displayContracts = appId ? contracts.filter((c) => c.application_id === appId) : contracts;

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Договоры" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Create contract (only when app context given) */}
        {appId && templates.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Создать договор для заявки</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Шаблон договора</label>
                <select className="input-field" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={createContract} disabled={creating} className="btn-primary py-2.5 px-5">
                {creating ? "Создание..." : "Создать"}
              </button>
            </div>
          </section>
        )}

        {appId && templates.length === 0 && !loading && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
            Нет шаблонов договоров. Сначала создайте шаблон в разделе администратора.
          </div>
        )}

        {/* Contracts list */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            {appId ? "Договоры по заявке" : "Все договоры"}
            <span className="ml-2 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{displayContracts.length}</span>
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : displayContracts.length === 0 ? (
            <p className="text-sm text-slate-500">Договоров пока нет.</p>
          ) : (
            <div className="space-y-3">
              {displayContracts.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[contract.status]}`}>
                        {STATUS_LABELS[contract.status]}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(contract.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                    {contract.sent_at && (
                      <p className="text-xs text-slate-500">Отправлен: {new Date(contract.sent_at).toLocaleString("ru-RU")}</p>
                    )}
                    {contract.application_id && (
                      <a href={`/crm/applications/${contract.application_id}`} className="text-xs text-indigo-600 hover:underline">
                        Перейти к заявке
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/contracts/${contract.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Скачать PDF
                    </a>
                    {contract.status === "draft" && (
                      <button onClick={() => sendContract(contract.id)} className="btn-primary text-xs py-1.5 px-3">
                        Отправить клиенту
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Templates list */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Шаблоны договоров</h2>
            <a href="/crm/admin" className="text-xs text-indigo-600 hover:underline">Управление шаблонами →</a>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500">Нет шаблонов. Создайте первый шаблон в настройках администратора.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-sm font-medium text-slate-800">{t.name}</p>
                  <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
