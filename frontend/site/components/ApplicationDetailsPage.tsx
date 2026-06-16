"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type StickyTask = {
  id: string;
  text: string;
  done: boolean;
  remindAt: string | null;
  color: "yellow" | "pink" | "blue" | "green";
};

type StructuredRequirements = {
  position: string;
  schedule: string;
  salary: string;
  location: string;
  age: string;
  experience: string;
  kids_age: string;
  home_area: string;
  passport: string;
  citizenship: string;
  extra: string;
};

type TemplateStat = { sent: number; answered: number; liked: number };
type VacancyType = "nanny" | "cook" | "driver" | "other";
type TemplateV2 = {
  text: string;
  vacancyType: VacancyType;
  createdAt: string;
};
type TemplateSendEvent = {
  text: string;
  sentAt: string;
  stage: ApplicationStatus;
  vacancyType: VacancyType;
};
type TemplateStatByStage = TemplateStat & {
  stage: ApplicationStatus;
  vacancyType: VacancyType;
};
type TemplateSettings = {
  minConfidenceSends: number;
  hardRecommendation: boolean;
};
type ApplicationDocument = {
  id: string;
  filename: string;
  category: string;
  notes: string;
  parsed?: { detected_type?: string; size?: number; extension?: string };
  uploaded_at: string;
  uploaded_by_name: string;
};
type ApplicationCompliance = {
  offer_accepted: boolean;
  pdn_accepted: boolean;
  verification_method: string | null;
  verification_status: string | null;
  ip?: string | null;
  user_agent?: string | null;
  email_duplicate_sent?: boolean;
};
type SecurityCheckItem = {
  id: string;
  status: string;
  notes: string;
  candidate_id?: string | null;
  filename: string;
  uploaded_at: string;
  uploaded_by_name: string;
};
type MeetingItem = {
  id: string;
  title: string;
  candidate_id?: string | null;
  starts_at?: string | null;
  meeting_link: string;
  status: string;
  transcript?: string;
  manager_summary?: string;
  ai_analysis?: string;
  share_ai_to_client?: boolean;
  created_at: string;
};
type ClientPortalMirror = {
  documents?: ApplicationDocument[];
  compliance?: ApplicationCompliance;
  security_checks?: SecurityCheckItem[];
  meetings?: MeetingItem[];
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

const VACANCY_TYPE_LABEL: Record<VacancyType, string> = {
  nanny: "няня",
  cook: "повар",
  driver: "водитель",
  other: "другое",
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
  const [aiSummary, setAiSummary] = useState("");
  const [aiRequirements, setAiRequirements] = useState("");
  const [aiNextStep, setAiNextStep] = useState("");
  const [aiFollowUp, setAiFollowUp] = useState("");
  const [aiStructured, setAiStructured] = useState<StructuredRequirements>({
    position: "",
    schedule: "",
    salary: "",
    location: "",
    age: "",
    experience: "",
    kids_age: "",
    home_area: "",
    passport: "",
    citizenship: "",
    extra: "",
  });
  const [stickyDraft, setStickyDraft] = useState("");
  const [stickyRemindAt, setStickyRemindAt] = useState("");
  const [stickies, setStickies] = useState<StickyTask[]>([]);
  const [quickTemplates, setQuickTemplates] = useState<string[]>([]);
  const [quickTemplatesV2, setQuickTemplatesV2] = useState<TemplateV2[]>([]);
  const [templateEvents, setTemplateEvents] = useState<TemplateSendEvent[]>([]);
  const [likedMessages, setLikedMessages] = useState<string[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>({
    minConfidenceSends: 2,
    hardRecommendation: false,
  });
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [docCategoryDraft, setDocCategoryDraft] = useState("general");
  const [docNotesDraft, setDocNotesDraft] = useState("");
  const [compliance, setCompliance] = useState<ApplicationCompliance>({
    offer_accepted: false,
    pdn_accepted: false,
    verification_method: null,
    verification_status: "pending",
    email_duplicate_sent: false,
  });
  const [securityChecks, setSecurityChecks] = useState<SecurityCheckItem[]>([]);
  const [securityStatusDraft, setSecurityStatusDraft] = useState("pending");
  const [securityNotesDraft, setSecurityNotesDraft] = useState("");
  const [securityCandidateDraft, setSecurityCandidateDraft] = useState("");
  const [uploadingSecurity, setUploadingSecurity] = useState(false);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [meetingTitleDraft, setMeetingTitleDraft] = useState("Онлайн встреча");
  const [meetingAtDraft, setMeetingAtDraft] = useState("");
  const [meetingCandidateDraft, setMeetingCandidateDraft] = useState("");
  const [meetingPermanentDraft, setMeetingPermanentDraft] = useState(false);
  const [sendingMeetingDraft, setSendingMeetingDraft] = useState(true);
  const [clientMirror, setClientMirror] = useState<ClientPortalMirror | null>(null);
  const [calcInput, setCalcInput] = useState("");
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [calcListening, setCalcListening] = useState(false);
  const [paymentAmountDraft, setPaymentAmountDraft] = useState("");
  const [paymentDescriptionDraft, setPaymentDescriptionDraft] = useState("Оплата услуг агентства");
  const [paymentPreviewUrl, setPaymentPreviewUrl] = useState("");

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
      const aiS = sp.ai_structured as Partial<StructuredRequirements> | undefined;
      if (aiS) {
        setAiStructured((prev) => ({ ...prev, ...aiS }));
      }
      const workspace = (sp.ai_workspace as {
        stickies?: StickyTask[];
        quick_templates?: string[];
        quick_templates_v2?: TemplateV2[];
        template_events?: TemplateSendEvent[];
        liked_messages?: string[];
        template_settings?: Partial<TemplateSettings>;
      } | undefined) ?? {};
      if (Array.isArray(workspace.stickies)) setStickies(workspace.stickies);
      if (Array.isArray(workspace.quick_templates)) setQuickTemplates(workspace.quick_templates);
      if (Array.isArray(workspace.quick_templates_v2)) setQuickTemplatesV2(workspace.quick_templates_v2);
      if (Array.isArray(workspace.template_events)) setTemplateEvents(workspace.template_events);
      if (Array.isArray(workspace.liked_messages)) setLikedMessages(workspace.liked_messages);
      if (workspace.template_settings) {
        setTemplateSettings((prev) => ({
          minConfidenceSends: Number(workspace.template_settings?.minConfidenceSends ?? prev.minConfidenceSends) || 2,
          hardRecommendation: Boolean(workspace.template_settings?.hardRecommendation ?? prev.hardRecommendation),
        }));
      }
    }
  }

  async function loadMessages() {
    const res = await fetch(`/api/crm/applications/${applicationId}/messages`, { cache: "no-store" });
    if (!res.ok) throw new Error("messages-load-failed");
    setMessages((await res.json()) as BotMessage[]);
  }

  async function loadDocuments() {
    setDocumentsLoading(true);
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/documents`, { cache: "no-store" });
      if (!res.ok) throw new Error("documents-load-failed");
      setDocuments((await res.json()) as ApplicationDocument[]);
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function loadCompliance() {
    const res = await fetch(`/api/crm/applications/${applicationId}/compliance`, { cache: "no-store" });
    if (!res.ok) throw new Error("compliance-load-failed");
    setCompliance(await res.json());
  }

  async function loadSecurityChecks() {
    const res = await fetch(`/api/crm/applications/${applicationId}/security-checks`, { cache: "no-store" });
    if (!res.ok) throw new Error("security-checks-load-failed");
    setSecurityChecks(await res.json());
  }

  async function loadMeetings() {
    const res = await fetch(`/api/crm/applications/${applicationId}/meetings`, { cache: "no-store" });
    if (!res.ok) throw new Error("meetings-load-failed");
    setMeetings(await res.json());
  }

  async function loadClientMirror() {
    const res = await fetch(`/api/crm/applications/${applicationId}/client-portal`, { cache: "no-store" });
    if (!res.ok) throw new Error("client-mirror-load-failed");
    setClientMirror(await res.json());
  }

  async function logAiAction(action: string, details?: Record<string, unknown>) {
    if (!application) return;
    await fetch("/api/crm/history/ai-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: application.id,
        action,
        details: details || {},
      }),
    });
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

  async function mergeAndSaveSearchParams(patch: Record<string, unknown>) {
    const current = (application?.search_params as Record<string, unknown> | null) ?? {};
    const merged = { ...current, ...patch };
    await updateApplication({ search_params: merged });
    return merged;
  }

  async function persistWorkspace(next: {
    stickies?: StickyTask[];
    quickTemplates?: string[];
    quickTemplatesV2?: TemplateV2[];
    templateEvents?: TemplateSendEvent[];
    likedMessages?: string[];
    templateSettings?: TemplateSettings;
  }) {
    await mergeAndSaveSearchParams({
      ai_workspace: {
        stickies: next.stickies ?? stickies,
        quick_templates: next.quickTemplates ?? quickTemplates,
        quick_templates_v2: next.quickTemplatesV2 ?? quickTemplatesV2,
        template_events: next.templateEvents ?? templateEvents,
        liked_messages: next.likedMessages ?? likedMessages,
        template_settings: next.templateSettings ?? templateSettings,
      },
    });
  }

  function detectVacancyType(text: string): VacancyType {
    const t = text.toLowerCase();
    if (/(няня|гуверн|babysitter|nanny)/i.test(t)) return "nanny";
    if (/(повар|chef|cook)/i.test(t)) return "cook";
    if (/(водитель|driver|шоф[её]р)/i.test(t)) return "driver";
    return "other";
  }

  function currentVacancyType(): VacancyType {
    const source = [
      aiStructured.position,
      searchParams.specialization,
      application?.description ?? "",
      application?.manager_notes ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    return detectVacancyType(source);
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadApplication(),
        loadMessages(),
        loadMatches(),
        loadDocuments(),
        loadCompliance(),
        loadSecurityChecks(),
        loadMeetings(),
        loadClientMirror(),
      ]);
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
      if (application) {
        const event: TemplateSendEvent = {
          text,
          sentAt: new Date().toISOString(),
          stage: application.status,
          vacancyType: currentVacancyType(),
        };
        setTemplateEvents((prev) => {
          const next = [event, ...prev].slice(0, 600);
          persistWorkspace({ templateEvents: next }).catch(() => {});
          return next;
        });
      }
      if (text.length > 8) {
        setQuickTemplates((prev) => {
          const unique = [text, ...prev.filter((x) => x !== text)].slice(0, 12);
          persistWorkspace({ quickTemplates: unique }).catch(() => {});
          return unique;
        });
        const vType = currentVacancyType();
        setQuickTemplatesV2((prev) => {
          const filtered = prev.filter((x) => x.text !== text);
          const next = [{ text, vacancyType: vType, createdAt: new Date().toISOString() }, ...filtered].slice(0, 40);
          persistWorkspace({ quickTemplatesV2: next }).catch(() => {});
          return next;
        });
      }
    } catch {
      setError("Не удалось отправить сообщение");
      setChatInput(text); // возвращаем текст обратно
    } finally {
      setSendingMessage(false);
    }
  }

  function extractByPatterns(text: string, patterns: RegExp[]): string {
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]) return m[1].trim();
    }
    return "";
  }

  function extractNumber(text: string): string {
    const m = text.match(/\d{1,3}(?:[\s.]\d{3})*|\d+/);
    return m ? m[0].replace(/\s+/g, "") : "";
  }

  function inferStructuredRequirements(sourceText: string) {
    const text = sourceText.replace(/\s+/g, " ");
    const position = extractByPatterns(text, [
      /(?:позици[яи]|нужен|требуется)\s*[:\-]?\s*([^|,.!\n]{3,80})/i,
      /(няня|гувернантка|домработница|повар|водитель|помощник(?:\sпо\sхоз)?|охранник)/i,
    ]);
    const schedule = extractByPatterns(text, [
      /(\d{1,2}\/\d{1,2}(?:\s*(?:вахта|приходящая|с проживанием))?)/i,
      /((?:вахта|приходящая|с проживанием|без проживания)[^|,.!\n]{0,60})/i,
    ]);
    const salary = extractByPatterns(text, [
      /((?:\d[\d\s.]{2,}\s*(?:-\s*\d[\d\s.]*)?\s*(?:₽|руб|р|в день|в месяц)?))/i,
      /(зарплат[аы]\s*[:\-]?\s*[^|,.!\n]{3,60})/i,
    ]);
    const location = extractByPatterns(text, [
      /(?:локаци[яи]|метро|город|район)\s*[:\-]?\s*([^|,.!\n]{3,80})/i,
      /(?:м\.?\s*[А-Яа-яA-Za-z\- ]{3,40})/i,
    ]);
    const age = extractByPatterns(text, [
      /(?:возраст|лет)\s*[:\-]?\s*([^|,.!\n]{1,40})/i,
      /(\d{2}\s*-\s*\d{2}\s*лет)/i,
    ]);
    const experience = extractByPatterns(text, [
      /(?:опыт|стаж)\s*[:\-]?\s*([^|,.!\n]{1,50})/i,
      /(\d+\+?\s*лет\s*опыта?)/i,
    ]);
    const kidsAge = extractByPatterns(text, [
      /(?:дет[еи]|ребенок|ребёнок)[^|,.!\n]{0,25}(?:возраст|лет)?\s*[:\-]?\s*([^|,.!\n]{1,40})/i,
    ]);
    const homeArea = extractByPatterns(text, [
      /(?:метраж|площадь|дом)\s*[:\-]?\s*([^|,.!\n]{1,50})/i,
      /(\d{2,4}\s*м2)/i,
    ]);
    const passport = extractByPatterns(text, [
      /(?:загран(?:паспорт)?|паспорт)\s*[:\-]?\s*([^|,.!\n]{1,50})/i,
    ]);
    const citizenship = extractByPatterns(text, [
      /(?:гражданств[оа]|второе гражданство)\s*[:\-]?\s*([^|,.!\n]{1,50})/i,
    ]);
    const extra = extractByPatterns(text, [
      /(?:дополнительно|важно|требования)\s*[:\-]?\s*([^|]{5,120})/i,
    ]);
    return {
      position,
      schedule,
      salary,
      location,
      age,
      experience,
      kids_age: kidsAge,
      home_area: homeArea,
      passport,
      citizenship,
      extra,
    };
  }

  async function insertAiIntoManagerNotes() {
    const block = [
      "=== AI резюме ===",
      aiSummary || "Сводка не сгенерирована",
      "",
      "=== AI требования ===",
      aiRequirements || "Требования не сгенерированы",
      "",
      "=== AI следующий шаг ===",
      aiNextStep || "Следующий шаг не сгенерирован",
      "",
      "=== AI структура ===",
      `Позиция: ${aiStructured.position || "—"}`,
      `График: ${aiStructured.schedule || "—"}`,
      `Зарплата: ${aiStructured.salary || "—"}`,
      `Локация: ${aiStructured.location || "—"}`,
      `Возраст: ${aiStructured.age || "—"}`,
      `Опыт: ${aiStructured.experience || "—"}`,
      `Возраст детей: ${aiStructured.kids_age || "—"}`,
      `Метраж/дом: ${aiStructured.home_area || "—"}`,
      `Паспорт/загран: ${aiStructured.passport || "—"}`,
      `Гражданство: ${aiStructured.citizenship || "—"}`,
      `Дополнительно: ${aiStructured.extra || "—"}`,
    ].join("\n");
    const nextNotes = notesDraft?.trim() ? `${notesDraft}\n\n${block}` : block;
    setNotesDraft(nextNotes);
    setSaving(true);
    try {
      await updateApplication({ manager_notes: nextNotes });
      logAiAction("ai_insert_to_manager_notes", { chars: nextNotes.length }).catch(() => {});
    } catch {
      setError("Не удалось вставить AI блок в заметки");
    } finally {
      setSaving(false);
    }
  }

  function applyStructuredToSearch() {
    const ageMin = extractNumber(aiStructured.age);
    const expMin = extractNumber(aiStructured.experience);
    const salaryMax = extractNumber(aiStructured.salary);
    setSearchParams((prev) => ({
      ...prev,
      specialization: aiStructured.position || prev.specialization,
      age_min: ageMin || prev.age_min,
      experience_min: expMin || prev.experience_min,
      salary_max: salaryMax || prev.salary_max,
    }));
    mergeAndSaveSearchParams({
      specialization: aiStructured.position || searchParams.specialization,
      age_min: ageMin ? parseInt(ageMin) : searchParams.age_min ? parseInt(searchParams.age_min) : null,
      experience_min: expMin ? parseInt(expMin) : searchParams.experience_min ? parseInt(searchParams.experience_min) : null,
      salary_max: salaryMax ? parseFloat(salaryMax) : searchParams.salary_max ? parseFloat(searchParams.salary_max) : null,
      ai_structured: aiStructured,
    }).catch(() => {
      setError("Не удалось применить структурные поля в поиск");
    });
    logAiAction("ai_apply_structured_to_search", {
      position: aiStructured.position,
      schedule: aiStructured.schedule,
      salary: aiStructured.salary,
      location: aiStructured.location,
    }).catch(() => {});
  }

  function insertFollowUpToChatInput() {
    const next = aiFollowUp || "Добрый день! Подскажите, пожалуйста, актуальны ли условия заявки? Готовы прислать релевантных кандидатов сегодня.";
    setChatInput(next);
    logAiAction("ai_followup_inserted", { chars: next.length }).catch(() => {});
  }

  async function uploadDocuments(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingDocument(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("category", docCategoryDraft || "general");
        form.append("notes", docNotesDraft || "");
        const res = await fetch(`/api/crm/applications/${applicationId}/documents`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("upload-failed");
      }
      setDocNotesDraft("");
      await loadDocuments();
    } catch {
      setError("Не удалось загрузить документы");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function patchDocument(docId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/crm/applications/${applicationId}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("doc-patch-failed");
    await loadDocuments();
  }

  async function removeDocument(docId: string) {
    const res = await fetch(`/api/crm/applications/${applicationId}/documents/${docId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("doc-delete-failed");
    await loadDocuments();
  }

  async function saveCompliancePatch(patch: Partial<ApplicationCompliance>) {
    const res = await fetch(`/api/crm/applications/${applicationId}/compliance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...patch,
        ip: typeof window !== "undefined" ? "captured-by-server-side-or-proxy" : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    });
    if (!res.ok) {
      setError("Не удалось сохранить чекбоксы оферты/ПДн");
      return;
    }
    setCompliance(await res.json());
    loadClientMirror().catch(() => {});
  }

  async function uploadSecurityFile(file: File | null) {
    if (!file) return;
    setUploadingSecurity(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("status", securityStatusDraft);
      form.append("notes", securityNotesDraft);
      form.append("candidate_id", securityCandidateDraft);
      const res = await fetch(`/api/crm/applications/${applicationId}/security-checks`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("security-upload-failed");
      setSecurityNotesDraft("");
      await Promise.all([loadSecurityChecks(), loadClientMirror()]);
    } catch {
      setError("Не удалось прикрепить файл проверки СБ");
    } finally {
      setUploadingSecurity(false);
    }
  }

  async function createMeeting() {
    try {
      const res = await fetch(`/api/crm/applications/${applicationId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitleDraft || "Онлайн встреча",
          candidate_id: meetingCandidateDraft || null,
          starts_at: meetingAtDraft || null,
          use_permanent_link: meetingPermanentDraft,
          send_to_client: sendingMeetingDraft,
          send_to_candidate: Boolean(meetingCandidateDraft),
        }),
      });
      if (!res.ok) throw new Error("meeting-create-failed");
      await Promise.all([loadMeetings(), loadClientMirror(), loadMessages()]);
    } catch {
      setError("Не удалось создать онлайн-встречу");
    }
  }

  async function patchMeeting(meetingId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/crm/applications/${applicationId}/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("meeting-patch-failed");
    await Promise.all([loadMeetings(), loadClientMirror()]);
  }

  function calcNow() {
    const safe = calcInput.replace(",", ".").replace(/[^0-9+\-*/(). ]/g, "");
    if (!safe.trim()) {
      setCalcResult(null);
      return;
    }
    try {
      // eslint-disable-next-line no-new-func
      const value = Number(Function(`"use strict"; return (${safe});`)());
      setCalcResult(Number.isFinite(value) ? Math.round(value * 100) / 100 : null);
    } catch {
      setCalcResult(null);
    }
  }

  function startVoiceCalc() {
    const W = window as Window & {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
      };
    };
    const R = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!R) {
      setError("Голосовой ввод не поддерживается в этом браузере");
      return;
    }
    const rec = new R();
    setCalcListening(true);
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || "";
      const normalized = text
        .toLowerCase()
        .replace(/плюс/g, "+")
        .replace(/минус/g, "-")
        .replace(/умножить на|умножить|икс/g, "*")
        .replace(/разделить на|делить на|делить/g, "/");
      setCalcInput((prev) => (prev ? `${prev} ${normalized}` : normalized));
    };
    rec.onerror = () => setCalcListening(false);
    rec.onend = () => setCalcListening(false);
    rec.start();
  }

  async function buildRobokassaPreview() {
    const amount = Number(paymentAmountDraft.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Введите корректную сумму для Robokassa");
      return;
    }
    const res = await fetch(`/api/crm/applications/${applicationId}/payments/robokassa-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description: paymentDescriptionDraft }),
    });
    if (!res.ok) {
      setError("Не удалось сгенерировать ссылку Robokassa");
      return;
    }
    const data = await res.json();
    setPaymentPreviewUrl(data.payment_url || "");
  }

  function addSticky() {
    const text = stickyDraft.trim();
    if (!text) return;
    const colors: StickyTask["color"][] = ["yellow", "pink", "blue", "green"];
    const next: StickyTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      done: false,
      remindAt: stickyRemindAt || null,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    const updated = [next, ...stickies].slice(0, 20);
    setStickies(updated);
    setStickyDraft("");
    setStickyRemindAt("");
    persistWorkspace({ stickies: updated }).catch(() => {});
  }

  function toggleStickyDone(id: string) {
    const updated = stickies.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    setStickies(updated);
    persistWorkspace({ stickies: updated }).catch(() => {});
  }

  function removeSticky(id: string) {
    const updated = stickies.filter((s) => s.id !== id);
    setStickies(updated);
    persistWorkspace({ stickies: updated }).catch(() => {});
  }

  function likeRealMessage(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setQuickTemplates((prev) => {
      const unique = [clean, ...prev.filter((x) => x !== clean)].slice(0, 20);
      persistWorkspace({ quickTemplates: unique }).catch(() => {});
      return unique;
    });
    const vType = currentVacancyType();
    setQuickTemplatesV2((prev) => {
      const filtered = prev.filter((x) => x.text !== clean);
      const next = [{ text: clean, vacancyType: vType, createdAt: new Date().toISOString() }, ...filtered].slice(0, 40);
      persistWorkspace({ quickTemplatesV2: next }).catch(() => {});
      return next;
    });
    setLikedMessages((prev) => {
      const unique = [clean, ...prev.filter((x) => x !== clean)].slice(0, 50);
      persistWorkspace({ likedMessages: unique }).catch(() => {});
      return unique;
    });
  }

  const templateStats = useMemo<Record<string, TemplateStat>>(() => {
    const stats: Record<string, TemplateStat> = {};
    const allTemplates = Array.from(new Set([...quickTemplates, ...likedMessages]));
    for (const t of allTemplates) {
      stats[t] = { sent: 0, answered: 0, liked: likedMessages.includes(t) ? 1 : 0 };
    }
    const outgoing = messages.filter((m) => m.direction === "outgoing");
    const incoming = messages.filter((m) => m.direction === "incoming");
    for (const m of outgoing) {
      const t = allTemplates.find((x) => x === m.text.trim());
      if (!t) continue;
      stats[t].sent += 1;
      const sentAt = new Date(m.created_at).getTime();
      const hasReply = incoming.some((im) => new Date(im.created_at).getTime() > sentAt);
      if (hasReply) stats[t].answered += 1;
    }
    return stats;
  }, [messages, quickTemplates, likedMessages]);

  const templateStatsByStage = useMemo<Record<string, TemplateStatByStage>>(() => {
    const stats: Record<string, TemplateStatByStage> = {};
    const byTextType = new Map<string, VacancyType>();
    for (const t of quickTemplatesV2) {
      byTextType.set(t.text.trim(), t.vacancyType);
    }
    for (const t of quickTemplates) {
      const clean = t.trim();
      if (!byTextType.has(clean)) byTextType.set(clean, "other");
    }
    const incomingTimes = messages
      .filter((m) => m.direction === "incoming")
      .map((m) => new Date(m.created_at).getTime())
      .sort((a, b) => a - b);

    for (const ev of templateEvents) {
      const clean = ev.text.trim();
      if (!clean) continue;
      const vType = byTextType.get(clean) ?? ev.vacancyType ?? "other";
      const key = `${ev.stage}::${vType}::${clean}`;
      if (!stats[key]) {
        stats[key] = {
          stage: ev.stage,
          vacancyType: vType,
          sent: 0,
          answered: 0,
          liked: likedMessages.includes(clean) ? 1 : 0,
        };
      }
      stats[key].sent += 1;
      const sentAt = new Date(ev.sentAt).getTime();
      const hasReply = incomingTimes.some((ts) => ts > sentAt);
      if (hasReply) stats[key].answered += 1;
    }
    return stats;
  }, [templateEvents, messages, quickTemplatesV2, quickTemplates, likedMessages]);

  const bestTemplateNow = useMemo(() => {
    if (!application) return null;
    const stage = application.status;
    const vacancyType = currentVacancyType();
    const candidates = Object.entries(templateStatsByStage)
      .filter(
        ([key, st]) =>
          key.includes(`::${vacancyType}::`) &&
          st.stage === stage &&
          st.sent >= Math.max(templateSettings.minConfidenceSends, 1)
      )
      .map(([key, st]) => {
        const tpl = key.split("::").slice(2).join("::");
        const conv = st.answered / Math.max(st.sent, 1);
        const confidenceBoost = Math.min(st.sent / 5, 1) * 0.15;
        const likeBoost = st.liked ? 0.05 : 0;
        return { tpl, st, score: conv + confidenceBoost + likeBoost };
      })
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) return candidates[0];

    const fallback = quickTemplatesV2.find((x) => x.vacancyType === vacancyType) ?? quickTemplatesV2[0];
    if (!fallback) return null;
    return {
      tpl: fallback.text,
      st: { sent: 0, answered: 0, liked: likedMessages.includes(fallback.text) ? 1 : 0 },
      score: 0,
    };
  }, [application, templateStatsByStage, quickTemplatesV2, likedMessages, aiStructured.position, searchParams.specialization]);

  useEffect(() => {
    if (!templateSettings.hardRecommendation) return;
    if (!bestTemplateNow) return;
    if (chatInput.trim()) return;
    setChatInput(bestTemplateNow.tpl);
  }, [templateSettings.hardRecommendation, bestTemplateNow]);

  function runAiAssistant() {
    if (!application) return;
    const incoming = messages.filter((m) => m.direction === "incoming").map((m) => m.text).join(" ");
    const outgoing = messages.filter((m) => m.direction === "outgoing").map((m) => m.text).join(" ");
    const desc = application.description || "";
    const notes = application.manager_notes || "";

    const keyPhrases = [desc, incoming, notes]
      .join(" ")
      .split(/[|,.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 6)
      .slice(0, 6);
    const structured = inferStructuredRequirements([desc, incoming, notes].join(" | "));
    setAiStructured(structured);

    setAiSummary(
      [
        "Кратко по заявке:",
        `- Статус: ${STATUS_META.find((s) => s.key === application.status)?.title ?? application.status}`,
        keyPhrases[0] ? `- Контекст: ${keyPhrases[0]}` : "- Контекст: уточнить детали у клиента",
        incoming ? "- Клиент уже отвечал боту, есть данные для подбора." : "- Ответов клиента пока мало, нужен уточняющий контакт.",
      ].join("\n")
    );

    setAiRequirements(
      [
        "Извлеченные требования:",
        keyPhrases[1] ? `- ${keyPhrases[1]}` : "- Специализация: не выделена явно",
        keyPhrases[2] ? `- ${keyPhrases[2]}` : "- График: требуется уточнение",
        keyPhrases[3] ? `- ${keyPhrases[3]}` : "- Бюджет: требуется уточнение",
        notes ? `- Из заметок менеджера: ${notes.slice(0, 160)}` : "- Заметки менеджера пока пустые",
      ].join("\n")
    );

    setAiNextStep(
      [
        "Рекомендуемый следующий шаг:",
        matches.some((m) => m.status === "accepted")
          ? "- Отправить клиенту согласившихся кандидатов."
          : "- Запустить/уточнить поиск и отправить 3-5 релевантных кандидатов.",
        outgoing
          ? "- Проверить, есть ли ответ клиента на последние сообщения."
          : "- Отправить клиенту короткое уточняющее сообщение по критичным параметрам.",
      ].join("\n")
    );
    setAiFollowUp(
      [
        "Здравствуйте! Уточняю детали по заявке, чтобы ускорить подбор.",
        structured.position ? `1) Подтверждаем позицию: ${structured.position}?` : "1) Подтвердите, пожалуйста, точную позицию специалиста.",
        structured.schedule ? `2) График: ${structured.schedule}?` : "2) Подскажите удобный график работы (например 5/2, вахта и т.д.).",
        structured.salary ? `3) Бюджет: ${structured.salary}?` : "3) Какой актуальный бюджет по зарплате?",
        structured.location ? `4) Локация: ${structured.location}?` : "4) Уточните локацию/метро.",
        "После подтверждения пришлю вам подходящих кандидатов.",
      ].join("\n")
    );
  }

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!application) return;
    const firedKey = `crm.sticky.reminded.${application.id}`;
    const fired: string[] = (() => {
      try {
        const raw = localStorage.getItem(firedKey);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();

    const now = Date.now();
    const due = stickies.filter((s) => !s.done && s.remindAt && new Date(s.remindAt).getTime() <= now && !fired.includes(s.id));
    if (due.length === 0) return;

    due.forEach((s) => {
      fetch("/api/crm/notifications/sticky-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: application.id,
          sticky_id: s.id,
          text: s.text,
          remind_at: s.remindAt,
        }),
      }).catch(() => {});
    });

    const nextFired = [...fired, ...due.map((x) => x.id)];
    localStorage.setItem(firedKey, JSON.stringify(nextFired));
  }, [stickies, application]);

  useEffect(() => {
    loadAll();
  }, [applicationId]);

  useEffect(() => {
    calcNow();
  }, [calcInput]);

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
          <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-indigo-900">AI-ассистент заявки</h2>
              <button
                onClick={runAiAssistant}
                data-guide="Собирает краткое резюме заявки, требования и рекомендуемый следующий шаг."
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Сгенерировать AI-подсказки
              </button>
            </div>
            <div className="mt-3 grid md:grid-cols-3 gap-3">
              <div className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-xs font-medium text-slate-700 mb-1">Сводка</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap">{aiSummary || "Нажмите кнопку генерации."}</pre>
              </div>
              <div className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-xs font-medium text-slate-700 mb-1">Требования</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap">{aiRequirements || "Нажмите кнопку генерации."}</pre>
              </div>
              <div className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-xs font-medium text-slate-700 mb-1">Следующий шаг</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap">{aiNextStep || "Нажмите кнопку генерации."}</pre>
              </div>
            </div>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Структурированные требования</p>
                <div className="text-xs text-slate-700 space-y-1">
                  <p><span className="text-slate-500">Позиция:</span> {aiStructured.position || "—"}</p>
                  <p><span className="text-slate-500">График:</span> {aiStructured.schedule || "—"}</p>
                  <p><span className="text-slate-500">Зарплата:</span> {aiStructured.salary || "—"}</p>
                  <p><span className="text-slate-500">Локация:</span> {aiStructured.location || "—"}</p>
                  <p><span className="text-slate-500">Возраст:</span> {aiStructured.age || "—"}</p>
                  <p><span className="text-slate-500">Опыт:</span> {aiStructured.experience || "—"}</p>
                  <p><span className="text-slate-500">Возраст детей:</span> {aiStructured.kids_age || "—"}</p>
                  <p><span className="text-slate-500">Метраж/дом:</span> {aiStructured.home_area || "—"}</p>
                  <p><span className="text-slate-500">Паспорт/загран:</span> {aiStructured.passport || "—"}</p>
                  <p><span className="text-slate-500">Гражданство:</span> {aiStructured.citizenship || "—"}</p>
                  <p><span className="text-slate-500">Дополнительно:</span> {aiStructured.extra || "—"}</p>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Follow-up шаблон</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap">{aiFollowUp || "Нажмите кнопку генерации."}</pre>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs font-medium text-slate-700 mb-2">Sticky-напоминалки (чеклист)</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  value={stickyDraft}
                  onChange={(e) => setStickyDraft(e.target.value)}
                  className="input-field text-xs py-2 flex-1 min-w-[220px]"
                  placeholder="Добавить задачу/напоминалку..."
                />
                <input
                  type="datetime-local"
                  value={stickyRemindAt}
                  onChange={(e) => setStickyRemindAt(e.target.value)}
                  className="input-field text-xs py-2"
                />
                <button onClick={addSticky} className="btn-secondary text-xs py-2 px-3">+ Добавить</button>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {stickies.map((s) => {
                  const palette =
                    s.color === "yellow"
                      ? "bg-yellow-100 border-yellow-300"
                      : s.color === "pink"
                        ? "bg-pink-100 border-pink-300"
                        : s.color === "blue"
                          ? "bg-sky-100 border-sky-300"
                          : "bg-emerald-100 border-emerald-300";
                  return (
                    <div key={s.id} className={`rounded-lg border p-2 ${palette}`}>
                      <label className="flex items-start gap-2 text-xs">
                        <input type="checkbox" checked={s.done} onChange={() => toggleStickyDone(s.id)} className="mt-0.5" />
                        <span className={s.done ? "line-through text-slate-500" : "text-slate-800"}>{s.text}</span>
                      </label>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">
                          {s.remindAt ? `Напомнить: ${new Date(s.remindAt).toLocaleString("ru-RU")}` : "Без напоминания"}
                        </span>
                        <button onClick={() => removeSticky(s.id)} className="text-[10px] text-slate-500 hover:text-red-600">Удалить</button>
                      </div>
                    </div>
                  );
                })}
                {stickies.length === 0 && <p className="text-xs text-slate-400">Добавьте первую sticky-задачу.</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={insertAiIntoManagerNotes}
                data-guide="Вставляет AI-сводку, требования и следующий шаг в заметки менеджера и сразу сохраняет."
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Вставить в заметки менеджера
              </button>
              <button
                onClick={insertFollowUpToChatInput}
                data-guide="Подставляет готовый follow-up текст в поле чата, чтобы отправить клиенту в 1 клик."
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Подставить follow-up в чат
              </button>
              {aiFollowUp && (
                <button
                  onClick={() => {
                    setQuickTemplates((prev) => {
                      const unique = [aiFollowUp, ...prev.filter((x) => x !== aiFollowUp)].slice(0, 12);
                      persistWorkspace({ quickTemplates: unique }).catch(() => {});
                      return unique;
                    });
                    const vType = currentVacancyType();
                    setQuickTemplatesV2((prev) => {
                      const filtered = prev.filter((x) => x.text !== aiFollowUp);
                      const next = [{ text: aiFollowUp, vacancyType: vType, createdAt: new Date().toISOString() }, ...filtered].slice(0, 40);
                      persistWorkspace({ quickTemplatesV2: next }).catch(() => {});
                      return next;
                    });
                  }}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  ⭐ Лайкнуть и запомнить шаблон
                </button>
              )}
              <button
                onClick={applyStructuredToSearch}
                data-guide="Переносит распознанную позицию в параметры поиска соискателей."
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Применить требования в поиск
              </button>
            </div>
            {quickTemplates.length > 0 && (
              <div className="mt-3 rounded-xl border border-indigo-100 bg-white p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Быстрые обученные шаблоны компании</p>
                <div className="space-y-2">
                  {quickTemplates.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChatInput(t)}
                      className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(templateStats).length > 0 && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">Рейтинг эффективности шаблонов</p>
                <div className="space-y-2">
                  {(Object.entries(templateStats) as [string, TemplateStat][])
                    .sort((a, b) => (b[1].answered / Math.max(b[1].sent, 1)) - (a[1].answered / Math.max(a[1].sent, 1)))
                    .slice(0, 6)
                    .map(([tpl, st]) => {
                      const conv = Math.round((st.answered / Math.max(st.sent, 1)) * 100);
                      return (
                        <div key={tpl} className="rounded-lg border border-slate-200 p-2">
                          <p className="text-xs text-slate-700">{tpl}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Отправлено: {st.sent} · Ответы: {st.answered} · Конверсия: {conv}% {st.liked ? "· ⭐" : ""}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            {Object.keys(templateStatsByStage).length > 0 && (
              <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
                <p className="text-xs font-medium text-slate-700 mb-2">A/B рейтинг по этапу сделки и типу вакансии</p>
                <div className="space-y-2">
                  {Object.entries(templateStatsByStage)
                    .sort((a, b) => {
                      const sa = a[1];
                      const sb = b[1];
                      const ra = sa.answered / Math.max(sa.sent, 1);
                      const rb = sb.answered / Math.max(sb.sent, 1);
                      return rb - ra;
                    })
                    .slice(0, 8)
                    .map(([key, st], idx) => {
                      const tpl = key.split("::").slice(2).join("::");
                      const conv = Math.round((st.answered / Math.max(st.sent, 1)) * 100);
                      const stageTitle = STATUS_META.find((s) => s.key === st.stage)?.title ?? st.stage;
                      const abLabel = idx % 2 === 0 ? "A" : "B";
                      return (
                        <div key={key} className="rounded-lg border border-slate-200 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-slate-700">{tpl}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${abLabel === "A" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                              {abLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Этап: {stageTitle} · Вакансия: {VACANCY_TYPE_LABEL[st.vacancyType]} · Отправлено: {st.sent} · Ответы: {st.answered} · A/B: {conv}% {st.liked ? "· ⭐" : ""}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

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

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Документы заявки (менеджер)</h2>
          <p className="text-xs text-slate-500 mb-3">
            Загрузка с компьютера, скачивание и корректировка доступны менеджеру. Клиент/соискатель не могут править эти файлы.
          </p>
          <div className="grid md:grid-cols-4 gap-2 mb-3">
            <input
              value={docCategoryDraft}
              onChange={(e) => setDocCategoryDraft(e.target.value)}
              className="input-field text-sm"
              placeholder="Категория (passport, sb, resume...)"
            />
            <input
              value={docNotesDraft}
              onChange={(e) => setDocNotesDraft(e.target.value)}
              className="input-field text-sm md:col-span-2"
              placeholder="Комментарий к файлам"
            />
            <label className="btn-secondary text-sm py-2 px-3 text-center cursor-pointer">
              {uploadingDocument ? "Загрузка..." : "Загрузить файлы"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => uploadDocuments(e.target.files)}
                disabled={uploadingDocument}
              />
            </label>
          </div>
          {documentsLoading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-500">Файлов пока нет.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.filename}</p>
                      <p className="text-xs text-slate-500">
                        {d.category} · {d.parsed?.detected_type || "file"} · {d.parsed?.extension || ""} ·{" "}
                        {d.parsed?.size ? `${Math.round(d.parsed.size / 1024)} KB` : "—"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Загружен: {new Date(d.uploaded_at).toLocaleString("ru-RU")} · {d.uploaded_by_name}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/api/crm/applications/${applicationId}/documents/${d.id}/download`}
                        className="text-xs text-indigo-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Скачать
                      </a>
                      <button
                        onClick={() => removeDocument(d.id).catch(() => setError("Не удалось удалить файл"))}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid md:grid-cols-3 gap-2">
                    <input
                      defaultValue={d.filename}
                      className="input-field text-xs"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.filename) patchDocument(d.id, { filename: v }).catch(() => setError("Не удалось обновить имя"));
                      }}
                    />
                    <input
                      defaultValue={d.category}
                      className="input-field text-xs"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.category) patchDocument(d.id, { category: v }).catch(() => setError("Не удалось обновить категорию"));
                      }}
                    />
                    <input
                      defaultValue={d.notes}
                      className="input-field text-xs"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (d.notes || "")) patchDocument(d.id, { notes: v }).catch(() => setError("Не удалось обновить комментарий"));
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Оферта и ПДн (Phase 1)</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(compliance.offer_accepted)}
                onChange={(e) => saveCompliancePatch({ offer_accepted: e.target.checked })}
              />
              Принята оферта
            </label>
            <label className="text-sm text-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(compliance.pdn_accepted)}
                onChange={(e) => saveCompliancePatch({ pdn_accepted: e.target.checked })}
              />
              Получено согласие на обработку ПДн
            </label>
            <select
              value={compliance.verification_method || ""}
              onChange={(e) => saveCompliancePatch({ verification_method: e.target.value || null })}
              className="input-field text-sm"
            >
              <option value="">Метод верификации</option>
              <option value="sms_otp">SMS-код</option>
              <option value="call_4digits">Звонок + 4 цифры</option>
            </select>
            <select
              value={compliance.verification_status || "pending"}
              onChange={(e) => saveCompliancePatch({ verification_status: e.target.value })}
              className="input-field text-sm"
            >
              <option value="pending">Ожидает</option>
              <option value="verified">Подтверждено</option>
              <option value="failed">Ошибка</option>
            </select>
            <label className="text-sm text-slate-700 flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(compliance.email_duplicate_sent)}
                onChange={(e) => saveCompliancePatch({ email_duplicate_sent: e.target.checked })}
              />
              Дубликаты документов отправлены по email
            </label>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Проверка СБ (обязательный файл)</h2>
          <div className="grid md:grid-cols-4 gap-2 mb-3">
            <select
              value={securityStatusDraft}
              onChange={(e) => setSecurityStatusDraft(e.target.value)}
              className="input-field text-sm"
            >
              <option value="pending">Ожидает</option>
              <option value="passed">Пройдена</option>
              <option value="failed">Не пройдена</option>
            </select>
            <select
              value={securityCandidateDraft}
              onChange={(e) => setSecurityCandidateDraft(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Привязка к соискателю (опционально)</option>
              {matches.map((m) => (
                <option key={m.candidate_id} value={m.candidate_id}>
                  {m.candidate.full_name}
                </option>
              ))}
            </select>
            <input
              value={securityNotesDraft}
              onChange={(e) => setSecurityNotesDraft(e.target.value)}
              className="input-field text-sm md:col-span-2"
              placeholder="Комментарий СБ"
            />
          </div>
          <label className="btn-secondary text-sm py-2 px-3 inline-block cursor-pointer">
            {uploadingSecurity ? "Загрузка..." : "Прикрепить файл СБ"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => uploadSecurityFile(e.target.files?.[0] ?? null)}
              disabled={uploadingSecurity}
            />
          </label>
          <div className="mt-3 space-y-2">
            {securityChecks.length === 0 ? (
              <p className="text-sm text-slate-500">Проверок пока нет.</p>
            ) : (
              securityChecks.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 p-2">
                  <p className="text-sm text-slate-800">
                    {s.filename} · <span className="font-medium">{s.status}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.uploaded_at).toLocaleString("ru-RU")} · {s.uploaded_by_name}
                    {s.candidate_id ? ` · candidate: ${s.candidate_id}` : ""}
                  </p>
                  {s.notes && <p className="text-xs text-slate-600 mt-1">{s.notes}</p>}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Онлайн-встречи и AI аналитика</h2>
          <div className="grid md:grid-cols-3 gap-2 mb-3">
            <input
              value={meetingTitleDraft}
              onChange={(e) => setMeetingTitleDraft(e.target.value)}
              className="input-field text-sm"
              placeholder="Название встречи"
            />
            <input
              type="datetime-local"
              value={meetingAtDraft}
              onChange={(e) => setMeetingAtDraft(e.target.value)}
              className="input-field text-sm"
            />
            <select
              value={meetingCandidateDraft}
              onChange={(e) => setMeetingCandidateDraft(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">Без привязки к соискателю</option>
              {matches.map((m) => (
                <option key={m.candidate_id} value={m.candidate_id}>
                  {m.candidate.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="text-xs text-slate-700 flex items-center gap-2">
              <input type="checkbox" checked={meetingPermanentDraft} onChange={(e) => setMeetingPermanentDraft(e.target.checked)} />
              Постоянная ссылка
            </label>
            <label className="text-xs text-slate-700 flex items-center gap-2">
              <input type="checkbox" checked={sendingMeetingDraft} onChange={(e) => setSendingMeetingDraft(e.target.checked)} />
              Сразу отправить ссылку клиенту в чат
            </label>
            <button onClick={createMeeting} className="btn-secondary text-xs py-1.5 px-3">Создать встречу</button>
          </div>
          <div className="space-y-2">
            {meetings.length === 0 ? (
              <p className="text-sm text-slate-500">Встреч пока нет.</p>
            ) : (
              meetings.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs text-slate-500">
                        {m.starts_at ? new Date(m.starts_at).toLocaleString("ru-RU") : "без даты"} · статус: {m.status}
                      </p>
                      <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                        {m.meeting_link}
                      </a>
                    </div>
                    <select
                      value={m.status}
                      onChange={(e) => patchMeeting(m.id, { status: e.target.value }).catch(() => setError("Не удалось обновить статус встречи"))}
                      className="input-field text-xs max-w-[150px]"
                    >
                      <option value="planned">planned</option>
                      <option value="done">done</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 mt-2">
                    <textarea
                      defaultValue={m.manager_summary || ""}
                      className="input-field text-xs min-h-[70px]"
                      placeholder="Итог встречи для карточки клиента"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (m.manager_summary || "")) patchMeeting(m.id, { manager_summary: v }).catch(() => setError("Не удалось сохранить итог"));
                      }}
                    />
                    <textarea
                      defaultValue={m.ai_analysis || ""}
                      className="input-field text-xs min-h-[70px]"
                      placeholder="AI аналитика (психопортрет/релевантность к ТЗ)"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (m.ai_analysis || "")) patchMeeting(m.id, { ai_analysis: v }).catch(() => setError("Не удалось сохранить AI аналитику"));
                      }}
                    />
                  </div>
                  <label className="text-xs text-slate-700 flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(m.share_ai_to_client)}
                      onChange={(e) => patchMeeting(m.id, { share_ai_to_client: e.target.checked }).catch(() => setError("Не удалось обновить флаг отправки AI клиенту"))}
                    />
                    Менеджер подтверждает отправку AI-аналитики клиенту
                  </label>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Зеркало аккаунта клиента (read-only превью)</h2>
          <p className="text-xs text-slate-500 mb-3">
            Здесь видно, что транслируется клиенту: документы, согласия, СБ, встречи и уведомления.
          </p>
          <div className="text-xs text-slate-700 space-y-1">
            <p>Документы: {clientMirror?.documents?.length ?? 0}</p>
            <p>Проверки СБ: {clientMirror?.security_checks?.length ?? 0}</p>
            <p>Встречи: {clientMirror?.meetings?.length ?? 0}</p>
            <p>Оферта: {clientMirror?.compliance?.offer_accepted ? "принята" : "не принята"}</p>
            <p>ПДн: {clientMirror?.compliance?.pdn_accepted ? "получено" : "не получено"}</p>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Калькулятор менеджера + Robokassa</h2>
          <div className="grid md:grid-cols-4 gap-2 mb-3">
            <input
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              className="input-field text-sm md:col-span-2"
              placeholder="Например: 120000*0.5 + 3500"
            />
            <button onClick={startVoiceCalc} className="btn-secondary text-xs py-2 px-3">
              {calcListening ? "Слушаю..." : "Голосовой ввод"}
            </button>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Итог: {calcResult != null ? calcResult.toLocaleString("ru-RU") : "—"}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <input
              value={paymentAmountDraft}
              onChange={(e) => setPaymentAmountDraft(e.target.value)}
              className="input-field text-sm"
              placeholder="Сумма для оплаты"
            />
            <input
              value={paymentDescriptionDraft}
              onChange={(e) => setPaymentDescriptionDraft(e.target.value)}
              className="input-field text-sm md:col-span-2"
              placeholder="Описание платежа"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={buildRobokassaPreview} className="btn-secondary text-xs py-1.5 px-3">
              Сгенерировать ссылку Robokassa
            </button>
            {paymentPreviewUrl && (
              <a href={paymentPreviewUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
                Открыть платежную ссылку
              </a>
            )}
          </div>
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
                      <div className={`text-[10px] mt-1 flex items-center justify-end gap-2 ${isOut ? "text-blue-200" : "text-slate-400"}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                        {isOut && (
                          <button
                            onClick={() => likeRealMessage(m.text)}
                            className="hover:text-yellow-300"
                            title="Лайкнуть сообщение и запомнить как удачный шаблон"
                          >
                            ⭐
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesBottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 flex gap-2 shrink-0">
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-[11px] text-slate-700 flex items-center gap-2">
                  Мин. порог доверия:
                  <select
                    value={templateSettings.minConfidenceSends}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      const next = { ...templateSettings, minConfidenceSends: v };
                      setTemplateSettings(next);
                      persistWorkspace({ templateSettings: next }).catch(() => {});
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px]"
                  >
                    <option value={1}>1 отправка</option>
                    <option value={2}>2 отправки</option>
                    <option value={3}>3 отправки</option>
                    <option value={5}>5 отправок</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={templateSettings.hardRecommendation}
                    onChange={(e) => {
                      const next = { ...templateSettings, hardRecommendation: e.target.checked };
                      setTemplateSettings(next);
                      persistWorkspace({ templateSettings: next }).catch(() => {});
                    }}
                  />
                  Жесткая рекомендация (автоподстановка при открытии чата)
                </label>
              </div>
            </div>
            {bestTemplateNow && (
              <div className="w-full mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] text-emerald-800">
                  Подсказка AI: сейчас лучше сработает шаблон для «{VACANCY_TYPE_LABEL[currentVacancyType()]}» на этапе
                  {" "}
                  «{STATUS_META.find((s) => s.key === (application?.status ?? "new"))?.title ?? application?.status}».
                </p>
                <button
                  onClick={() => setChatInput(bestTemplateNow.tpl)}
                  className="mt-1 text-xs text-emerald-900 underline underline-offset-2"
                >
                  Подставить рекомендованный шаблон
                </button>
              </div>
            )}
            {!bestTemplateNow && (
              <div className="w-full mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] text-amber-800">
                  Недостаточно данных для уверенной рекомендации при текущем пороге ({templateSettings.minConfidenceSends}+ отправки на шаблон).
                </p>
              </div>
            )}
          </div>
          <div className="px-4 pb-3 flex gap-2 shrink-0">
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
