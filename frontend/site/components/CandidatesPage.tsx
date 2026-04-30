"use client";

import { useEffect, useRef, useState, useMemo } from "react";

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
  notes: string | null;
  created_at: string;
};

const EMPTY_FORM = {
  full_name: "",
  age: "",
  specialization: "",
  experience_years: "",
  salary_min: "",
  salary_max: "",
  availability: "",
  telegram: "",
  whatsapp: "",
  email: "",
  tags: "",
  notes: "",
};

type KeywordRule = {
  query: string;
  mode: "all_words" | "any_word";
  scope: "everywhere" | "resume" | "comments";
};

type CandidateFilters = {
  country: string;
  city: string;
  owner: string;
  rejectReasons: string[];
  sourceMethod: string;
  keywordRules: KeywordRule[];
  period: string;
  tags: string[];
  salaryFrom: string;
  salaryTo: string;
  experience: string[];
  region: string;
  languages: string[];
  ageFrom: string;
  ageTo: string;
  workPlace: string[];
  employmentType: string[];
  schedule: string[];
  gender: "any" | "male" | "female";
  driverLicenses: string[];
};

const DEFAULT_FILTERS: CandidateFilters = {
  country: "Россия",
  city: "",
  owner: "all",
  rejectReasons: [],
  sourceMethod: "all",
  keywordRules: [{ query: "", mode: "all_words", scope: "everywhere" }],
  period: "all_time",
  tags: [],
  salaryFrom: "",
  salaryTo: "",
  experience: [],
  region: "",
  languages: [],
  ageFrom: "",
  ageTo: "",
  workPlace: [],
  employmentType: [],
  schedule: [],
  gender: "any",
  driverLicenses: [],
};

const FILTERS_STORAGE_KEY = "crm_candidates_filters_v1";

const COUNTRY_REGIONS: Record<string, string[]> = {
  Россия: [
    "Москва",
    "Санкт-Петербург",
    "Московская область",
    "Ленинградская область",
    "Краснодарский край",
    "Свердловская область",
    "Татарстан",
    "Новосибирская область",
    "Самарская область",
    "Ростовская область",
  ],
  Казахстан: [
    "Алматы",
    "Астана",
    "Шымкент",
    "Карагандинская область",
    "Актюбинская область",
    "Алматинская область",
  ],
  Беларусь: [
    "Минск",
    "Брестская область",
    "Витебская область",
    "Гомельская область",
    "Гродненская область",
    "Минская область",
    "Могилевская область",
  ],
};

// Gender detection from Russian surnames (end in -а/-я = female)
function isFemale(fullName: string): boolean {
  const lastName = fullName.trim().split(/\s+/)[0] ?? "";
  const last = lastName.slice(-1);
  return last === "\u0430" || last === "\u044F" || last === "\u044C"; // а, я, ь
}

function getAvatarUrl(fullName: string): string {
  const style = isFemale(fullName) ? "lorelei" : "adventurer";
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(fullName)}`;
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "не указана";
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)} тыс.` : `${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)} ₽`;
  if (min) return `от ${fmt(min)} ₽`;
  return `до ${fmt(max!)} ₽`;
}

// Spec colors per specialization keyword
const SPEC_COLORS: [string, string][] = [
  ["няня", "bg-pink-100 text-pink-700"],
  ["гувернант", "bg-violet-100 text-violet-700"],
  ["повар", "bg-orange-100 text-orange-700"],
  ["шеф", "bg-orange-100 text-orange-700"],
  ["горничн", "bg-sky-100 text-sky-700"],
  ["экономк", "bg-teal-100 text-teal-700"],
  ["управляющ", "bg-teal-100 text-teal-700"],
  ["мажордом", "bg-indigo-100 text-indigo-700"],
  ["водитель", "bg-blue-100 text-blue-700"],
  ["помощн", "bg-green-100 text-green-700"],
  ["сиделк", "bg-red-100 text-red-700"],
  ["медицин", "bg-red-100 text-red-700"],
  ["садовник", "bg-lime-100 text-lime-700"],
  ["охранник", "bg-slate-100 text-slate-700"],
  ["репетитор", "bg-yellow-100 text-yellow-700"],
  ["ассистент", "bg-cyan-100 text-cyan-700"],
];

function specColor(spec: string | null): string {
  if (!spec) return "bg-slate-100 text-slate-500";
  const lower = spec.toLowerCase();
  for (const [kw, cls] of SPEC_COLORS) {
    if (lower.includes(kw)) return cls;
  }
  return "bg-slate-100 text-slate-600";
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Client-side search (instant)
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<CandidateFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CandidateFilters>(DEFAULT_FILTERS);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formSaving, setFormSaving] = useState(false);

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  // Expanded card notes
  const [expanded, setExpanded] = useState<string | null>(null);

  // Candidate detail view
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const [copied, setCopied] = useState(false);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CandidateFilters;
      setDraftFilters({ ...DEFAULT_FILTERS, ...parsed });
      setAppliedFilters({ ...DEFAULT_FILTERS, ...parsed });
    } catch {
      // ignore broken localStorage data
    }
  }, []);

  function toggleListValue(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  }

  async function loadCandidates() {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({ limit: "200" });
      if (appliedFilters.salaryFrom) p.set("salary_min", appliedFilters.salaryFrom);
      if (appliedFilters.salaryTo) p.set("salary_max", appliedFilters.salaryTo);
      if (appliedFilters.ageFrom) p.set("age_min", appliedFilters.ageFrom);
      if (appliedFilters.ageTo) p.set("age_max", appliedFilters.ageTo);
      if (appliedFilters.region) p.set("region", appliedFilters.region);
      if (appliedFilters.country) p.set("country", appliedFilters.country);
      if (appliedFilters.city) p.set("city", appliedFilters.city);
      if (appliedFilters.gender) p.set("gender", appliedFilters.gender);
      if (appliedFilters.period) p.set("period", appliedFilters.period);
      if (appliedFilters.sourceMethod) p.set("source_method", appliedFilters.sourceMethod);
      if (appliedFilters.tags.length > 0) appliedFilters.tags.forEach((t) => p.append("tags", t));
      if (appliedFilters.rejectReasons.length > 0) appliedFilters.rejectReasons.forEach((v) => p.append("reject_reasons", v));

      if (appliedFilters.experience.length > 0) {
        const minExp = appliedFilters.experience.includes("6+") ? "6"
          : appliedFilters.experience.includes("3-6") ? "3"
          : appliedFilters.experience.includes("1-3") ? "1"
          : "0";
        p.set("experience_min", minExp);
      }

      appliedFilters.workPlace.forEach((v) => p.append("work_place", v));
      appliedFilters.employmentType.forEach((v) => p.append("employment_type", v));
      appliedFilters.schedule.forEach((v) => p.append("schedule", v));
      appliedFilters.languages.forEach((v) => p.append("languages", v));
      appliedFilters.driverLicenses.forEach((v) => p.append("driver_licenses", v));

      const keywordQuery = appliedFilters.keywordRules.map((r) => r.query.trim()).filter(Boolean).join(" ");
      if (keywordQuery) {
        p.set("keyword_query", keywordQuery);
        p.set("keyword_mode", appliedFilters.keywordRules[0]?.mode ?? "all_words");
      }

      const res = await fetch(`/api/crm/candidates?${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setCandidates(await res.json());
    } catch {
      setError("Не удалось загрузить соискателей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCandidates(); }, [appliedFilters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.full_name, c.specialization ?? "", c.availability ?? "", ...(c.tags ?? [])]
        .join(" ").toLowerCase().includes(q)
    );
  }, [candidates, search]);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(c: Candidate) {
    setEditId(c.id);
    setForm({
      full_name: c.full_name,
      age: c.age?.toString() ?? "",
      specialization: c.specialization ?? "",
      experience_years: c.experience_years?.toString() ?? "",
      salary_min: c.salary_min?.toString() ?? "",
      salary_max: c.salary_max?.toString() ?? "",
      availability: c.availability ?? "",
      telegram: c.contacts?.telegram ?? "",
      whatsapp: c.contacts?.whatsapp ?? "",
      email: c.contacts?.email ?? "",
      tags: (c.tags ?? []).join(", "),
      notes: c.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSave() {
    if (!form.full_name.trim()) return;
    setFormSaving(true);
    try {
      const contacts: Record<string, string> = {};
      if (form.telegram.trim()) contacts.telegram = form.telegram.trim();
      if (form.whatsapp.trim()) contacts.whatsapp = form.whatsapp.trim();
      if (form.email.trim()) contacts.email = form.email.trim();
      const payload = {
        full_name: form.full_name.trim(),
        age: form.age ? parseInt(form.age) : null,
        specialization: form.specialization.trim() || null,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
        salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
        availability: form.availability.trim() || null,
        contacts: Object.keys(contacts).length ? contacts : null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
        notes: form.notes.trim() || null,
      };
      const url = editId ? `/api/crm/candidates/${editId}` : "/api/crm/candidates";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      setShowForm(false);
      await loadCandidates();
    } catch {
      setError("Не удалось сохранить соискателя");
    } finally {
      setFormSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Удалить соискателя?")) return;
    try {
      await fetch(`/api/crm/candidates/${id}`, { method: "DELETE" });
      await loadCandidates();
    } catch {
      setError("Не удалось удалить соискателя");
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/crm/candidates/import", { method: "POST", body: fd });
      setImportResult(await res.json());
      await loadCandidates();
    } catch {
      setError("Ошибка импорта CSV");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearFilters() {
    setSearch("");
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    localStorage.removeItem(FILTERS_STORAGE_KEY);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(draftFilters));
    setShowFilters(false);
  }

  function resetDraftFilters() {
    setDraftFilters(DEFAULT_FILTERS);
  }

  const hasFilters = !!(
    search ||
    JSON.stringify(appliedFilters) !== JSON.stringify(DEFAULT_FILTERS)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <a href="/crm" className="text-slate-400 hover:text-slate-700 text-sm">← Доска</a>
            <h1 className="text-xl font-bold text-slate-900">База соискателей</h1>
            <span className="text-sm text-slate-400 font-normal">
              {loading ? "…" : `${filtered.length} из ${candidates.length}`}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="btn-secondary text-sm py-2 px-3">
              {importing ? "Импорт…" : "CSV"}
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
            <button onClick={openCreate} className="btn-primary text-sm py-2 px-4">
              + Добавить
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field flex-1"
              placeholder="Поиск по имени, тегам, специализации…"
            />
            <button onClick={() => setShowFilters(true)} className="btn-secondary text-sm py-2 px-4">
              Фильтры
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-red-500 px-3 border border-slate-200 rounded-lg transition">
                Сбросить
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Notifications */}
      {importResult && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-800 flex items-center gap-3">
            <span>Импортировано: <b>{importResult.created}</b> соискателей</span>
            {importResult.errors.length > 0 && <span className="text-red-600">ошибок: {importResult.errors.length}</span>}
            <button onClick={() => setImportResult(null)} className="ml-auto text-green-500 hover:text-green-700">✕</button>
          </div>
        </div>
      )}
      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
            {error}
            <button onClick={() => setError("")} className="ml-auto">✕</button>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowFilters(false)}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Фильтр кандидатов</h2>
              <button className="text-slate-400 hover:text-slate-700 text-xl" onClick={() => setShowFilters(false)}>×</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-slate-500">Ответственный</label>
                <select className="input-field mt-1" value={draftFilters.owner} onChange={(e) => setDraftFilters((f) => ({ ...f, owner: e.target.value }))}>
                  <option value="all">Все кандидаты</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Зарплата от</label>
                  <input type="number" className="input-field mt-1" value={draftFilters.salaryFrom} onChange={(e) => setDraftFilters((f) => ({ ...f, salaryFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">до</label>
                  <input type="number" className="input-field mt-1" value={draftFilters.salaryTo} onChange={(e) => setDraftFilters((f) => ({ ...f, salaryTo: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Возраст от</label>
                  <input type="number" className="input-field mt-1" value={draftFilters.ageFrom} onChange={(e) => setDraftFilters((f) => ({ ...f, ageFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">до</label>
                  <input type="number" className="input-field mt-1" value={draftFilters.ageTo} onChange={(e) => setDraftFilters((f) => ({ ...f, ageTo: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Страна</label>
                <input
                  className="input-field mt-1"
                  list="country-options"
                  value={draftFilters.country}
                  placeholder="Начните печатать страну"
                  onChange={(e) => setDraftFilters((f) => ({ ...f, country: e.target.value, region: "" }))}
                />
                <datalist id="country-options">
                  {Object.keys(COUNTRY_REGIONS).map((country) => (
                    <option key={country} value={country} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-slate-500">Регион</label>
                <input
                  className="input-field mt-1"
                  list="region-options"
                  placeholder={draftFilters.country ? "Начните печатать регион" : "Сначала выберите страну"}
                  value={draftFilters.region}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, region: e.target.value }))}
                />
                <datalist id="region-options">
                  {(COUNTRY_REGIONS[draftFilters.country] ?? []).map((region) => (
                    <option key={region} value={region} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-slate-500">Город</label>
                <input
                  className="input-field mt-1"
                  placeholder="Начните печатать город"
                  value={draftFilters.city}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Пол</label>
                <div className="mt-2 flex gap-3 text-sm">
                  {[
                    { v: "any", l: "Не имеет значения" },
                    { v: "male", l: "Мужской" },
                    { v: "female", l: "Женский" },
                  ].map((g) => (
                    <label key={g.v} className="flex items-center gap-1">
                      <input type="radio" checked={draftFilters.gender === g.v} onChange={() => setDraftFilters((f) => ({ ...f, gender: g.v as CandidateFilters["gender"] }))} />
                      {g.l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Опыт работы</label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["0", "Без опыта"],
                    ["1-3", "От 1 до 3 лет"],
                    ["3-6", "От 3 до 6 лет"],
                    ["6+", "Более 6 лет"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-1">
                      <input type="checkbox" checked={draftFilters.experience.includes(value)} onChange={() => setDraftFilters((f) => ({ ...f, experience: toggleListValue(f.experience, value) }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Ключевые слова</label>
                <input className="input-field mt-1" value={draftFilters.keywordRules[0]?.query ?? ""} onChange={(e) => setDraftFilters((f) => ({ ...f, keywordRules: [{ ...f.keywordRules[0], query: e.target.value }] }))} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select className="input-field" value={draftFilters.keywordRules[0]?.mode ?? "all_words"} onChange={(e) => setDraftFilters((f) => ({ ...f, keywordRules: [{ ...f.keywordRules[0], mode: e.target.value as KeywordRule["mode"] }] }))}>
                    <option value="all_words">Все слова встречаются</option>
                    <option value="any_word">Любое слово</option>
                  </select>
                  <select className="input-field" value={draftFilters.keywordRules[0]?.scope ?? "everywhere"} onChange={(e) => setDraftFilters((f) => ({ ...f, keywordRules: [{ ...f.keywordRules[0], scope: e.target.value as KeywordRule["scope"] }] }))}>
                    <option value="everywhere">Везде</option>
                    <option value="resume">В резюме</option>
                    <option value="comments">В комментариях</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Теги</label>
                <input
                  className="input-field mt-1"
                  placeholder="Через запятую: VIP, с проживанием"
                  value={draftFilters.tags.join(", ")}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, tags: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Знание языков</label>
                <input
                  className="input-field mt-1"
                  placeholder="Напр.: ru, en, fr"
                  value={draftFilters.languages.join(", ")}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, languages: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Причины отказа</label>
                <input
                  className="input-field mt-1"
                  placeholder="Через запятую"
                  value={draftFilters.rejectReasons.join(", ")}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, rejectReasons: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Способ занесения</label>
                <select className="input-field mt-1" value={draftFilters.sourceMethod} onChange={(e) => setDraftFilters((f) => ({ ...f, sourceMethod: e.target.value }))}>
                  <option value="all">Все</option>
                  <option value="hh.ru">hh.ru</option>
                  <option value="помогатель">Помогатель</option>
                  <option value="наша няня">Наша Няня</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Период</label>
                <select className="input-field mt-1" value={draftFilters.period} onChange={(e) => setDraftFilters((f) => ({ ...f, period: e.target.value }))}>
                  <option value="all_time">Все время</option>
                  <option value="30d">Последние 30 дней</option>
                  <option value="7d">Последние 7 дней</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Место работы</label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {["У работодателя", "Удаленно", "Неизвестно"].map((v) => (
                    <label key={v} className="flex items-center gap-1">
                      <input type="checkbox" checked={draftFilters.workPlace.includes(v)} onChange={() => setDraftFilters((f) => ({ ...f, workPlace: toggleListValue(f.workPlace, v) }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Тип занятости</label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {["Полная", "Частичная", "Проектная", "Стажировка", "Волонтерство"].map((v) => (
                    <label key={v} className="flex items-center gap-1">
                      <input type="checkbox" checked={draftFilters.employmentType.includes(v)} onChange={() => setDraftFilters((f) => ({ ...f, employmentType: toggleListValue(f.employmentType, v) }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">График работы</label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {["Полный день", "Гибкий график", "Вахтовый метод", "Сменный график", "Неполный график", "Неизвестен"].map((v) => (
                    <label key={v} className="flex items-center gap-1">
                      <input type="checkbox" checked={draftFilters.schedule.includes(v)} onChange={() => setDraftFilters((f) => ({ ...f, schedule: toggleListValue(f.schedule, v) }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Водительские права</label>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {["A", "B", "C", "D", "E"].map((v) => (
                    <label key={v} className="flex items-center gap-1">
                      <input type="checkbox" checked={draftFilters.driverLicenses.includes(v)} onChange={() => setDraftFilters((f) => ({ ...f, driverLicenses: toggleListValue(f.driverLicenses, v) }))} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-2">
              <button className="btn-secondary text-sm py-2 px-4" onClick={resetDraftFilters}>Сбросить</button>
              <button className="btn-primary text-sm py-2 px-4" onClick={applyFilters}>Применить</button>
            </div>
          </aside>
        </div>
      )}

      {/* Card grid */}
      <main className="max-w-7xl mx-auto px-4 py-5">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-slate-100 rounded" />
                  <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm">Соискателей не найдено. Попробуйте изменить фильтры.</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-brand-navy hover:underline">
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((c) => {
              const isExp = expanded === c.id;
              return (
                <article key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition flex flex-col">
                  {/* Avatar + name — clickable */}
                  <div className="p-4 pb-3 cursor-pointer" onClick={() => setViewCandidate(c)}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 bg-slate-50 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAvatarUrl(c.full_name)}
                          alt={c.full_name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">
                          {c.full_name}
                        </p>
                        {c.specialization && (
                          <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${specColor(c.specialization)}`}>
                            {c.specialization}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Возраст</span>
                        <span>{c.age ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Опыт</span>
                        <span>{c.experience_years != null ? `${c.experience_years} лет` : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Зарплата</span>
                        <span className="text-right">{formatSalary(c.salary_min, c.salary_max)}</span>
                      </div>
                      {c.availability && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Когда</span>
                          <span className="text-right max-w-[120px] truncate" title={c.availability}>
                            {c.availability}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {c.tags && c.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {(isExp ? c.tags : c.tags.slice(0, 3)).map((t) => (
                          <span key={t} className="bg-slate-100 text-slate-500 text-xs rounded-full px-2 py-0.5">
                            {t}
                          </span>
                        ))}
                        {!isExp && c.tags.length > 3 && (
                          <button onClick={() => setExpanded(c.id)}
                            className="text-xs text-brand-navy hover:underline px-1">
                            +{c.tags.length - 3}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Contacts */}
                    {c.contacts && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {c.contacts.telegram && (
                          <a href={`https://t.me/${c.contacts.telegram.replace("@", "")}`}
                            target="_blank" rel="noreferrer"
                            title={c.contacts.telegram}
                            className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.496.969z"/>
                            </svg>
                            TG
                          </a>
                        )}
                        {c.contacts.whatsapp && (
                          <a href={`https://wa.me/${c.contacts.whatsapp.replace(/\D/g, "")}`}
                            target="_blank" rel="noreferrer"
                            title={c.contacts.whatsapp}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WA
                          </a>
                        )}
                        {c.contacts.email && (
                          <a href={`mailto:${c.contacts.email}`}
                            title={c.contacts.email}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                            Email
                          </a>
                        )}
                      </div>
                    )}

                    {/* Notes toggle */}
                    {c.notes && (
                      <button onClick={() => setExpanded(isExp ? null : c.id)}
                        className="mt-2.5 text-xs text-slate-400 hover:text-slate-600 text-left w-full">
                        {isExp ? "Скрыть заметки ↑" : "Заметки ↓"}
                      </button>
                    )}
                    {isExp && c.notes && (
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2">
                        {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto border-t border-slate-100 px-4 py-2.5 flex justify-end gap-3">
                    <button onClick={() => openEdit(c)}
                      className="text-xs text-brand-navy hover:underline">
                      Изменить
                    </button>
                    <button onClick={() => onDelete(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline">
                      Удалить
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Candidate detail modal */}
      {viewCandidate && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setViewCandidate(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3 sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(viewCandidate.full_name)} alt="" width={48} height={48}
                  className="w-12 h-12 rounded-full border border-slate-100 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{viewCandidate.full_name}</h2>
                  {viewCandidate.specialization && (
                    <span className={`inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${specColor(viewCandidate.specialization)}`}>
                      {viewCandidate.specialization}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setViewCandidate(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0">×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* ID */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 mb-1">ID соискателя</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-slate-700 font-mono break-all flex-1">{viewCandidate.id}</code>
                  <button
                    onClick={() => copyId(viewCandidate.id)}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-400 transition"
                  >
                    {copied ? "✓" : "Копировать"}
                  </button>
                </div>
              </div>

              {/* Main info */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Возраст</p>
                  <p className="text-slate-800">{viewCandidate.age ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Опыт</p>
                  <p className="text-slate-800">{viewCandidate.experience_years != null ? `${viewCandidate.experience_years} лет` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Зарплата</p>
                  <p className="text-slate-800">{formatSalary(viewCandidate.salary_min, viewCandidate.salary_max)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Доступность</p>
                  <p className="text-slate-800">{viewCandidate.availability ?? "—"}</p>
                </div>
              </div>

              {/* Contacts */}
              {viewCandidate.contacts && Object.keys(viewCandidate.contacts).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Контакты</p>
                  <div className="space-y-1 text-sm">
                    {viewCandidate.contacts.telegram && (
                      <p>
                        <span className="text-slate-400">Telegram: </span>
                        <a href={`https://t.me/${viewCandidate.contacts.telegram.replace("@", "")}`}
                          target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                          {viewCandidate.contacts.telegram}
                        </a>
                      </p>
                    )}
                    {viewCandidate.contacts.whatsapp && (
                      <p><span className="text-slate-400">WhatsApp: </span><span className="text-slate-700">{viewCandidate.contacts.whatsapp}</span></p>
                    )}
                    {viewCandidate.contacts.email && (
                      <p>
                        <span className="text-slate-400">Email: </span>
                        <a href={`mailto:${viewCandidate.contacts.email}`} className="text-slate-700 hover:underline">
                          {viewCandidate.contacts.email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {viewCandidate.tags && viewCandidate.tags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Теги</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewCandidate.tags.map((t) => (
                      <span key={t} className="bg-slate-100 text-slate-600 text-xs rounded-full px-2.5 py-1">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewCandidate.notes && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Заметки</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{viewCandidate.notes}</p>
                </div>
              )}

              {/* Created */}
              <p className="text-xs text-slate-400">
                Добавлен: {new Date(viewCandidate.created_at).toLocaleString("ru-RU")}
              </p>
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => { setViewCandidate(null); openEdit(viewCandidate); }}
                className="btn-secondary text-sm py-2 px-4">Редактировать</button>
              <button onClick={() => setViewCandidate(null)} className="btn-primary text-sm py-2 px-4">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold text-slate-900">
                {editId ? "Редактировать" : "Новый соискатель"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-500">ФИО *</label>
                <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="input-field mt-1" placeholder="Иванова Мария Петровна" />
              </div>
              {/* Avatar preview */}
              {form.full_name.trim() && (
                <div className="flex items-center gap-3 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(form.full_name)} alt="" width={40} height={40} className="w-10 h-10 rounded-full border border-slate-200" />
                  <span className="text-xs text-slate-400">Аватар (генерируется автоматически)</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Возраст</label>
                  <input value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                    type="number" min="16" max="80" className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Опыт (лет)</label>
                  <input value={form.experience_years} onChange={(e) => setForm((f) => ({ ...f, experience_years: e.target.value }))}
                    type="number" min="0" className="input-field mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Специализация</label>
                <input value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                  list="spec-options" className="input-field mt-1" placeholder="няня, повар, горничная…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Зарплата от (₽)</label>
                  <input value={form.salary_min} onChange={(e) => setForm((f) => ({ ...f, salary_min: e.target.value }))}
                    type="number" min="0" className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">до (₽)</label>
                  <input value={form.salary_max} onChange={(e) => setForm((f) => ({ ...f, salary_max: e.target.value }))}
                    type="number" min="0" className="input-field mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Доступность</label>
                <input value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                  className="input-field mt-1" placeholder="сразу, с 1 мая…" />
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Контакты</p>
                <input value={form.telegram} onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                  className="input-field" placeholder="Telegram (@username)" />
                <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  className="input-field" placeholder="WhatsApp (+7…)" />
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field" placeholder="Email" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Теги (через запятую)</label>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className="input-field mt-1" placeholder="уборка, готовка, дети" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Заметки</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3} className="input-field mt-1 resize-y" />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2.5 px-4">Отмена</button>
              <button onClick={onSave} disabled={formSaving || !form.full_name.trim()}
                className="btn-primary text-sm py-2.5 px-4">
                {formSaving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
