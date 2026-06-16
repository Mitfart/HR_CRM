"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  FileSignature,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Trophy,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import CrmNav from "@/components/CrmNav";
import clsx from "clsx";

type Vacancy = {
  id: string;
  title: string;
  client_name?: string | null;
  requirements?: string | null;
  conditions?: string | null;
  source: string;
  status: string;
  responsible_user_id?: string | null;
  created_at: string;
};

type JobResponse = {
  id: string;
  vacancy_id: string;
  candidate_name: string;
  source: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  status: string;
  created_at: string;
};

type UnifiedMessage = {
  id: string;
  channel: string;
  direction: "incoming" | "outgoing";
  text: string;
  cold_outreach?: boolean;
  owner_name?: string;
  created_at: string;
};

type Candidate = {
  id: string;
  full_name: string;
  specialization: string | null;
  contacts: Record<string, string> | null;
};

type ResumeVersion = {
  id: string;
  candidate_id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
};

type ClientTransfer = {
  id: string;
  candidate_id: string;
  resume_version_id: string;
  vacancy_id?: string | null;
  status: string;
  comment?: string | null;
  created_at: string;
};

type WorkerContract = {
  id: string;
  candidate_id: string;
  title: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  rendered_text: string;
  created_at: string;
};

type EmployeeReport = {
  actor_user_id: string;
  actor_name: string;
  responses_processed: number;
  resumes_created: number;
  client_transfers: number;
  incoming_messages: number;
  outgoing_messages: number;
  cold_outreach: number;
  worker_contracts_sent: number;
  quality_index: number;
  engagement_index: number;
  kpi_points: number;
};

type AdminAttention = {
  kind: string;
  priority: "high" | "medium" | "low";
  title: string;
  body: string;
};

type DeletionRequest = {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  status: string;
  actor_name: string;
  created_at: string;
};

type SourceIntegration = {
  id: string;
  source: "pomogatel" | "hh";
  label: string;
  enabled: boolean;
  base_url: string;
  purpose: string;
  last_status?: string | null;
  last_message?: string | null;
  last_run_at?: string | null;
  last_summary?: Record<string, unknown>;
};

type SourceSyncRun = {
  id: string;
  source: string;
  status: string;
  message: string;
  summary: Record<string, unknown>;
  created_at: string;
};

const TABS = [
  { id: "vacancies", label: "Вакансии", icon: BriefcaseBusiness },
  { id: "integrations", label: "Интеграции", icon: RefreshCw },
  { id: "inbox", label: "Сообщения", icon: Inbox },
  { id: "resume", label: "Резюме", icon: UserRoundCheck },
  { id: "contracts", label: "Договоры", icon: FileSignature },
  { id: "reports", label: "Отчёты", icon: Trophy },
  { id: "control", label: "Контроль", icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]["id"];

const responseLabels: Record<string, string> = {
  new: "Новый",
  in_work: "В работе",
  contacted: "Связались",
  waiting: "Ждём ответ",
  fits: "Подходит",
  declined: "Отказ",
  resume_preparing: "Резюме готовится",
  sent_to_client_manager: "У клиентского менеджера",
};

const transferLabels: Record<string, string> = {
  sent_to_client_manager: "У клиентского менеджера",
  in_review: "На проверке",
  needs_revision: "Нужна правка",
  approved: "Одобрено",
  sent_to_client: "Отправлено клиенту",
  client_interested: "Клиент заинтересован",
  client_declined: "Клиент отказал",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/crm/office-operations${path}`, {
    cache: "no-store",
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "blue" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    blue: "bg-blue-100 text-blue-700",
  }[tone];
  return <span className={`text-xs px-2 py-1 rounded-md font-medium ${cls}`}>{children}</span>;
}

export default function OfficeOperationsPage() {
  const [tab, setTab] = useState<TabId>("vacancies");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [responses, setResponses] = useState<JobResponse[]>([]);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [transfers, setTransfers] = useState<ClientTransfer[]>([]);
  const [contracts, setContracts] = useState<WorkerContract[]>([]);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [attention, setAttention] = useState<AdminAttention[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [integrations, setIntegrations] = useState<SourceIntegration[]>([]);
  const [syncRuns, setSyncRuns] = useState<SourceSyncRun[]>([]);
  const [error, setError] = useState("");

  const [vacancyForm, setVacancyForm] = useState({ title: "", client_name: "", requirements: "", conditions: "" });
  const [responseForm, setResponseForm] = useState({ vacancy_id: "", candidate_name: "", phone: "", email: "", message: "" });
  const [messageForm, setMessageForm] = useState({ channel: "whatsapp", direction: "outgoing", text: "", candidate_id: "", vacancy_id: "", cold_outreach: false });
  const [resumeForm, setResumeForm] = useState({ candidate_id: "", title: "Резюме кандидата", content: "" });
  const [transferForm, setTransferForm] = useState({ candidate_id: "", resume_version_id: "", vacancy_id: "", comment: "" });
  const [contractForm, setContractForm] = useState({
    candidate_id: "",
    email: "",
    phone: "",
    template_text: "Договор оферты\n\nСоискатель: {{candidate_name}}\nСпециализация: {{candidate_specialization}}\nТелефон: {{candidate_phone}}\nEmail: {{candidate_email}}\n\nУсловия сотрудничества подтверждаются подписанием данного договора.",
  });
  const [fileForm, setFileForm] = useState<{ candidate_id: string; file_type: string; file: File | null }>({ candidate_id: "", file_type: "document", file: null });
  const [deleteForm, setDeleteForm] = useState({ entity_type: "candidate", entity_id: "", reason: "" });
  const [integrationForm, setIntegrationForm] = useState({
    source: "pomogatel" as "pomogatel" | "hh",
    default_vacancy_id: "",
    rawJson: "",
  });

  async function loadAll() {
    setError("");
    try {
      const [
        vacancyData,
        responseData,
        messageData,
        candidateRes,
        resumeData,
        transferData,
        contractData,
        reportData,
        attentionData,
        deletionData,
        integrationData,
        syncRunData,
      ] = await Promise.all([
        api<Vacancy[]>("/vacancies"),
        api<JobResponse[]>("/responses"),
        api<UnifiedMessage[]>("/messages"),
        fetch("/api/crm/candidates?limit=120", { cache: "no-store" }).then((r) => r.json()),
        api<ResumeVersion[]>("/resume-versions"),
        api<ClientTransfer[]>("/client-transfers"),
        api<WorkerContract[]>("/worker-contracts"),
        api<EmployeeReport[]>("/reports/employees"),
        api<AdminAttention[]>("/admin-attention"),
        api<DeletionRequest[]>("/deletion-requests"),
        api<SourceIntegration[]>("/integrations"),
        api<SourceSyncRun[]>("/integrations/sync-runs"),
      ]);
      setVacancies(vacancyData);
      setResponses(responseData);
      setMessages(messageData);
      setCandidates(Array.isArray(candidateRes) ? candidateRes : []);
      setResumes(resumeData);
      setTransfers(transferData);
      setContracts(contractData);
      setReports(reportData);
      setAttention(attentionData);
      setDeletions(deletionData);
      setIntegrations(integrationData);
      setSyncRuns(syncRunData);
      setResponseForm((f) => ({ ...f, vacancy_id: f.vacancy_id || vacancyData[0]?.id || "" }));
    } catch {
      setError("Не удалось загрузить данные офиса");
    }
  }

  useEffect(() => { loadAll(); }, []);

  const selectedVacancyResponses = useMemo(
    () => responses.filter((r) => !responseForm.vacancy_id || r.vacancy_id === responseForm.vacancy_id),
    [responses, responseForm.vacancy_id],
  );

  async function createVacancy() {
    if (!vacancyForm.title.trim()) return;
    await api("/vacancies", { method: "POST", body: JSON.stringify(vacancyForm) });
    setVacancyForm({ title: "", client_name: "", requirements: "", conditions: "" });
    await loadAll();
  }

  async function createResponse() {
    if (!responseForm.vacancy_id || !responseForm.candidate_name.trim()) return;
    await api(`/vacancies/${responseForm.vacancy_id}/responses`, { method: "POST", body: JSON.stringify(responseForm) });
    setResponseForm((f) => ({ ...f, candidate_name: "", phone: "", email: "", message: "" }));
    await loadAll();
  }

  async function setResponseStatus(id: string, status: string) {
    await api(`/responses/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadAll();
  }

  async function createMessage() {
    if (!messageForm.text.trim()) return;
    await api("/messages", { method: "POST", body: JSON.stringify(messageForm) });
    setMessageForm((f) => ({ ...f, text: "", cold_outreach: false }));
    await loadAll();
  }

  async function createResume() {
    if (!resumeForm.candidate_id || !resumeForm.content.trim()) return;
    await api("/resume-versions", { method: "POST", body: JSON.stringify(resumeForm) });
    setResumeForm((f) => ({ ...f, content: "" }));
    await loadAll();
  }

  async function uploadFile() {
    if (!fileForm.candidate_id || !fileForm.file) return;
    const fd = new FormData();
    fd.set("file_type", fileForm.file_type);
    fd.set("file", fileForm.file);
    await api(`/candidates/${fileForm.candidate_id}/files`, { method: "POST", body: fd });
    setFileForm((f) => ({ ...f, file: null }));
    await loadAll();
  }

  async function createTransfer() {
    if (!transferForm.candidate_id || !transferForm.resume_version_id) return;
    await api("/client-transfers", { method: "POST", body: JSON.stringify(transferForm) });
    setTransferForm((f) => ({ ...f, comment: "" }));
    await loadAll();
  }

  async function updateTransfer(id: string, status: string) {
    await api(`/client-transfers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadAll();
  }

  async function createContract() {
    if (!contractForm.candidate_id || !contractForm.template_text.trim()) return;
    await api("/worker-contracts", { method: "POST", body: JSON.stringify(contractForm) });
    await loadAll();
  }

  async function contractAction(id: string, action: "send-email" | "sms-signature/request") {
    await api(`/worker-contracts/${id}/${action}`, { method: "POST" });
    await loadAll();
  }

  async function createDeletionRequest() {
    if (!deleteForm.entity_id || !deleteForm.reason.trim()) return;
    await api("/deletion-requests", { method: "POST", body: JSON.stringify(deleteForm) });
    setDeleteForm((f) => ({ ...f, entity_id: "", reason: "" }));
    await loadAll();
  }

  async function resolveDeletion(id: string, status: "approved" | "rejected" | "restored") {
    await api(`/deletion-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadAll();
  }

  async function checkIntegration(source: "pomogatel" | "hh") {
    await api(`/integrations/${source}/check`, { method: "POST" });
    await loadAll();
  }

  async function importIntegrationRows() {
    setError("");
    try {
      const parsed = JSON.parse(integrationForm.rawJson);
      const rows = Array.isArray(parsed) ? parsed : parsed.rows;
      if (!Array.isArray(rows)) throw new Error("rows must be an array");
      await api(`/integrations/${integrationForm.source}/import`, {
        method: "POST",
        body: JSON.stringify({
          rows,
          default_vacancy_id: integrationForm.default_vacancy_id || null,
        }),
      });
      setIntegrationForm((f) => ({ ...f, rawJson: "" }));
      await loadAll();
    } catch {
      setError("JSON откликов не распознан");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Офис HR" />
      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {attention.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-2">
              <Bell className="w-4 h-4" /> Требует внимания
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              {attention.slice(0, 3).map((item, idx) => (
                <div key={`${item.kind}-${idx}`} className="rounded-lg bg-white/70 border border-amber-100 p-3">
                  <div className="text-sm font-medium text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-600 mt-1">{item.body}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <nav className="flex gap-2 overflow-x-auto">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium whitespace-nowrap",
                  tab === item.id ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {tab === "vacancies" && (
          <section className="grid xl:grid-cols-[420px_1fr] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Новая вакансия</h2>
              <input className="input-field" placeholder="Название вакансии" value={vacancyForm.title} onChange={(e) => setVacancyForm((f) => ({ ...f, title: e.target.value }))} />
              <input className="input-field" placeholder="Клиент" value={vacancyForm.client_name} onChange={(e) => setVacancyForm((f) => ({ ...f, client_name: e.target.value }))} />
              <textarea className="input-field min-h-24" placeholder="Требования" value={vacancyForm.requirements} onChange={(e) => setVacancyForm((f) => ({ ...f, requirements: e.target.value }))} />
              <textarea className="input-field min-h-20" placeholder="Условия" value={vacancyForm.conditions} onChange={(e) => setVacancyForm((f) => ({ ...f, conditions: e.target.value }))} />
              <button onClick={createVacancy} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" /> Создать</button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select className="input-field max-w-sm" value={responseForm.vacancy_id} onChange={(e) => setResponseForm((f) => ({ ...f, vacancy_id: e.target.value }))}>
                  <option value="">Все вакансии</option>
                  {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
                <Pill tone="blue">{selectedVacancyResponses.length} откликов</Pill>
              </div>
              <div className="grid md:grid-cols-5 gap-2 mb-4">
                <input className="input-field" placeholder="Кандидат" value={responseForm.candidate_name} onChange={(e) => setResponseForm((f) => ({ ...f, candidate_name: e.target.value }))} />
                <input className="input-field" placeholder="Телефон" value={responseForm.phone} onChange={(e) => setResponseForm((f) => ({ ...f, phone: e.target.value }))} />
                <input className="input-field" placeholder="Email" value={responseForm.email} onChange={(e) => setResponseForm((f) => ({ ...f, email: e.target.value }))} />
                <input className="input-field" placeholder="Комментарий" value={responseForm.message} onChange={(e) => setResponseForm((f) => ({ ...f, message: e.target.value }))} />
                <button onClick={createResponse} className="btn-secondary inline-flex items-center justify-center gap-2"><Inbox className="w-4 h-4" /> Отклик</button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm min-w-[850px]">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr><th className="text-left p-2">Кандидат</th><th className="text-left p-2">Источник</th><th className="text-left p-2">Контакты</th><th className="text-left p-2">Статус</th><th className="text-left p-2">Действие</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedVacancyResponses.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-medium text-slate-800">{r.candidate_name}</td>
                        <td className="p-2"><Pill>{r.source}</Pill></td>
                        <td className="p-2 text-slate-600">{r.phone || r.email || "—"}</td>
                        <td className="p-2">{responseLabels[r.status] ?? r.status}</td>
                        <td className="p-2">
                          <select className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={r.status} onChange={(e) => setResponseStatus(r.id, e.target.value)}>
                            {Object.entries(responseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "integrations" && (
          <section className="grid xl:grid-cols-[430px_1fr] gap-4">
            <div className="space-y-4">
              {integrations.map((item) => (
                <div key={item.source} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">{item.label}</h2>
                      <div className="text-xs text-slate-500 mt-1">{item.base_url}</div>
                    </div>
                    <Pill tone={item.last_status === "reachable" || item.last_status === "imported" ? "green" : item.last_status === "blocked" ? "amber" : "slate"}>
                      {item.last_status || "not_checked"}
                    </Pill>
                  </div>
                  {item.last_message && <div className="mt-3 text-sm text-slate-600">{item.last_message}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => checkIntegration(item.source)} className="btn-secondary inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Проверить
                    </button>
                    <button onClick={() => setIntegrationForm((f) => ({ ...f, source: item.source }))} className="btn-secondary text-sm">
                      Выбрать
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input-field max-w-xs" value={integrationForm.source} onChange={(e) => setIntegrationForm((f) => ({ ...f, source: e.target.value as "pomogatel" | "hh" }))}>
                    <option value="pomogatel">Pomogatel.ru</option>
                    <option value="hh">HH.ru</option>
                  </select>
                  <select className="input-field max-w-sm" value={integrationForm.default_vacancy_id} onChange={(e) => setIntegrationForm((f) => ({ ...f, default_vacancy_id: e.target.value }))}>
                    <option value="">Вакансия из данных</option>
                    {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
                <textarea
                  className="input-field min-h-72 font-mono text-xs"
                  placeholder={'[{"external_id":"pmg-123","vacancy_title":"Няня","candidate_name":"Анна Иванова","phone":"+79990000000","message":"Откликнулась на вакансию","source_url":"https://pomogatel.ru/..."}]'}
                  value={integrationForm.rawJson}
                  onChange={(e) => setIntegrationForm((f) => ({ ...f, rawJson: e.target.value }))}
                />
                <button onClick={importIntegrationRows} className="btn-primary inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Импортировать
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                {syncRuns.slice(0, 8).map((run) => (
                  <div key={run.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{run.source} · {run.status}</div>
                      <div className="text-sm text-slate-500">{run.message}</div>
                    </div>
                    <div className="text-xs text-slate-400">{new Date(run.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === "inbox" && (
          <section className="grid lg:grid-cols-[380px_1fr] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Сообщение</h2>
              <select className="input-field" value={messageForm.channel} onChange={(e) => setMessageForm((f) => ({ ...f, channel: e.target.value }))}>
                {["telegram", "whatsapp", "max", "email", "sms", "phone", "pomogatel"].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <select className="input-field" value={messageForm.direction} onChange={(e) => setMessageForm((f) => ({ ...f, direction: e.target.value }))}>
                <option value="outgoing">Исходящее</option><option value="incoming">Входящее</option>
              </select>
              <select className="input-field" value={messageForm.candidate_id} onChange={(e) => setMessageForm((f) => ({ ...f, candidate_id: e.target.value }))}>
                <option value="">Кандидат не выбран</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <select className="input-field" value={messageForm.vacancy_id} onChange={(e) => setMessageForm((f) => ({ ...f, vacancy_id: e.target.value }))}>
                <option value="">Вакансия не выбрана</option>
                {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
              <textarea className="input-field min-h-28" placeholder="Текст" value={messageForm.text} onChange={(e) => setMessageForm((f) => ({ ...f, text: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={messageForm.cold_outreach} onChange={(e) => setMessageForm((f) => ({ ...f, cold_outreach: e.target.checked }))} /> Холодный подбор</label>
              <button onClick={createMessage} className="btn-primary inline-flex items-center gap-2"><MessageSquareText className="w-4 h-4" /> Сохранить</button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {messages.map((m) => (
                <div key={m.id} className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><Pill tone={m.direction === "incoming" ? "blue" : "green"}>{m.direction === "incoming" ? "Входящее" : "Исходящее"}</Pill><Pill>{m.channel}</Pill>{m.cold_outreach && <Pill tone="amber">Холодный подбор</Pill>}</div>
                    <div className="text-sm text-slate-800 whitespace-pre-wrap">{m.text}</div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{new Date(m.created_at).toLocaleString("ru-RU")}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "resume" && (
          <section className="grid xl:grid-cols-[430px_1fr] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Резюме и файлы</h2>
              <select className="input-field" value={resumeForm.candidate_id} onChange={(e) => { setResumeForm((f) => ({ ...f, candidate_id: e.target.value })); setFileForm((f) => ({ ...f, candidate_id: e.target.value })); setTransferForm((f) => ({ ...f, candidate_id: e.target.value })); }}>
                <option value="">Выберите кандидата</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <input className="input-field" value={resumeForm.title} onChange={(e) => setResumeForm((f) => ({ ...f, title: e.target.value }))} />
              <textarea className="input-field min-h-44" placeholder="Готовое резюме" value={resumeForm.content} onChange={(e) => setResumeForm((f) => ({ ...f, content: e.target.value }))} />
              <button onClick={createResume} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" /> Сохранить резюме</button>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <input type="file" onChange={(e) => setFileForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} className="block w-full text-sm" />
                <select className="input-field" value={fileForm.file_type} onChange={(e) => setFileForm((f) => ({ ...f, file_type: e.target.value }))}>
                  <option value="photo">Фото</option><option value="document">Документ</option><option value="recommendation">Рекомендация</option><option value="certificate">Справка</option>
                </select>
                <button onClick={uploadFile} className="btn-secondary inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Прикрепить файл</button>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <select className="input-field" value={transferForm.resume_version_id} onChange={(e) => setTransferForm((f) => ({ ...f, resume_version_id: e.target.value }))}>
                  <option value="">Версия резюме</option>
                  {resumes.filter((r) => !transferForm.candidate_id || r.candidate_id === transferForm.candidate_id).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                <select className="input-field" value={transferForm.vacancy_id} onChange={(e) => setTransferForm((f) => ({ ...f, vacancy_id: e.target.value }))}>
                  <option value="">Вакансия</option>
                  {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
                <input className="input-field" placeholder="Комментарий" value={transferForm.comment} onChange={(e) => setTransferForm((f) => ({ ...f, comment: e.target.value }))} />
                <button onClick={createTransfer} className="btn-secondary inline-flex items-center gap-2"><Send className="w-4 h-4" /> Клиентскому менеджеру</button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Версии резюме</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {resumes.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="font-medium text-slate-800">{r.title}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(r.created_at).toLocaleString("ru-RU")}</div>
                      <div className="flex gap-2 mt-3">
                        <a className="btn-secondary text-xs py-1.5 px-2" href={`/api/crm/office-operations/resume-versions/${r.id}/export?format=pdf`}>PDF</a>
                        <a className="btn-secondary text-xs py-1.5 px-2" href={`/api/crm/office-operations/resume-versions/${r.id}/export?format=docx`}>DOCX</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Передачи во вторую CRM</h3>
                <div className="space-y-2">
                  {transfers.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                      <div><div className="text-sm font-medium text-slate-800">{transferLabels[t.status] ?? t.status}</div><div className="text-xs text-slate-500">{t.comment || t.id}</div></div>
                      <select className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={t.status} onChange={(e) => updateTransfer(t.id, e.target.value)}>
                        {Object.entries(transferLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "contracts" && (
          <section className="grid lg:grid-cols-[420px_1fr] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Договор оферты</h2>
              <select className="input-field" value={contractForm.candidate_id} onChange={(e) => setContractForm((f) => ({ ...f, candidate_id: e.target.value }))}>
                <option value="">Выберите кандидата</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <input className="input-field" placeholder="Email" value={contractForm.email} onChange={(e) => setContractForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="input-field" placeholder="Телефон для SMS" value={contractForm.phone} onChange={(e) => setContractForm((f) => ({ ...f, phone: e.target.value }))} />
              <textarea className="input-field min-h-56" value={contractForm.template_text} onChange={(e) => setContractForm((f) => ({ ...f, template_text: e.target.value }))} />
              <button onClick={createContract} className="btn-primary inline-flex items-center gap-2"><FileSignature className="w-4 h-4" /> Сформировать</button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {contracts.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div><div className="font-medium text-slate-900">{c.title}</div><div className="text-xs text-slate-500">{c.email || "email не указан"} · {c.phone || "телефон не указан"}</div></div>
                    <Pill tone={c.status === "signed" ? "green" : c.status === "awaiting_sms_signature" ? "amber" : "blue"}>{c.status}</Pill>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 max-h-40 overflow-auto">{c.rendered_text}</pre>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => contractAction(c.id, "send-email")} className="btn-secondary text-xs py-1.5 px-2">Отправить на email</button>
                    <button onClick={() => contractAction(c.id, "sms-signature/request")} className="btn-secondary text-xs py-1.5 px-2">SMS-подпись</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "reports" && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900 mb-3">Отчёты сотрудников и KPI</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-slate-100 text-slate-600">
                  <tr><th className="text-left p-2">Сотрудник</th><th className="text-left p-2">Отклики</th><th className="text-left p-2">Резюме</th><th className="text-left p-2">Передачи</th><th className="text-left p-2">Входящие</th><th className="text-left p-2">Исходящие</th><th className="text-left p-2">Холодный подбор</th><th className="text-left p-2">Договоры</th><th className="text-left p-2">Качество</th><th className="text-left p-2">Вовлечённость</th><th className="text-left p-2">KPI</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <tr key={r.actor_user_id}>
                      <td className="p-2 font-medium text-slate-800">{r.actor_name}</td>
                      <td className="p-2">{r.responses_processed}</td><td className="p-2">{r.resumes_created}</td><td className="p-2">{r.client_transfers}</td><td className="p-2">{r.incoming_messages}</td><td className="p-2">{r.outgoing_messages}</td><td className="p-2">{r.cold_outreach}</td><td className="p-2">{r.worker_contracts_sent}</td><td className="p-2">{r.quality_index}</td><td className="p-2">{r.engagement_index}</td><td className="p-2 font-semibold text-indigo-700">{r.kpi_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "control" && (
          <section className="grid lg:grid-cols-[380px_1fr] gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Запрос на удаление</h2>
              <select className="input-field" value={deleteForm.entity_type} onChange={(e) => setDeleteForm((f) => ({ ...f, entity_type: e.target.value }))}>
                <option value="candidate">Кандидат</option><option value="resume">Резюме</option><option value="candidate_file">Файл кандидата</option><option value="worker_contract">Договор</option>
              </select>
              <input className="input-field" placeholder="ID объекта" value={deleteForm.entity_id} onChange={(e) => setDeleteForm((f) => ({ ...f, entity_id: e.target.value }))} />
              <textarea className="input-field min-h-24" placeholder="Причина" value={deleteForm.reason} onChange={(e) => setDeleteForm((f) => ({ ...f, reason: e.target.value }))} />
              <button onClick={createDeletionRequest} className="btn-primary inline-flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Отправить админу</button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {deletions.map((d) => (
                <div key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div><div className="font-medium text-slate-900">{d.entity_type} · {d.entity_id}</div><div className="text-sm text-slate-500">{d.actor_name}: {d.reason}</div></div>
                  <div className="flex items-center gap-2">
                    <Pill tone={d.status === "pending" ? "amber" : d.status === "approved" ? "green" : "slate"}>{d.status}</Pill>
                    {d.status === "pending" && (
                      <>
                        <button onClick={() => resolveDeletion(d.id, "approved")} className="btn-secondary text-xs py-1.5 px-2">Одобрить</button>
                        <button onClick={() => resolveDeletion(d.id, "rejected")} className="btn-secondary text-xs py-1.5 px-2">Отклонить</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
