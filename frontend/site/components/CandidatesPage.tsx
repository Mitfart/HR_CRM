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
  gender: "",
  birth_date: "",
  birth_country: "Россия",
  birth_city: "",
  birth_village: "",
  birth_lat: "",
  birth_lng: "",
  birth_place: "",
  metro_station: "",
  city_living: "",
  age: "",
  hide_age: "false",
  age_manual_override: "false",
  specialization: "",
  desired_positions: "",
  desired_position_custom: "",
  questionnaire_answers_json: "{}",
  citizenship: "",
  marital_status: "",
  marital_status_hidden: "false",
  children_json: "[]",
  pets: "",
  allergies_has: "Нет",
  allergies_details: "",
  can_swim: "Нет",
  can_roller: "Нет",
  can_ski: "Нет",
  can_snowboard: "Нет",
  can_bicycle: "Нет",
  can_scooter: "Нет",
  sports_selected: "",
  sports_custom: "",
  height_cm: "",
  weight_kg: "",
  diet: "",
  diet_selected: "",
  diet_custom: "",
  religion: "",
  religion_custom: "",
  relocation_readiness: "Не указано",
  business_trips_readiness: "Не указано",
  career_start_year: "",
  experience_manual_override: "false",
  experience_years: "",
  salary_min: "",
  salary_max: "",
  availability: "",
  phone: "",
  sos_phone: "",
  telegram: "",
  whatsapp: "",
  max_messenger: "",
  email: "",
  actual_address_street: "",
  actual_address_house: "",
  actual_address_building: "",
  actual_address_entrance_code: "",
  actual_address_floor: "",
  actual_address_apartment: "",
  registration_street: "",
  registration_house: "",
  registration_building: "",
  registration_entrance_code: "",
  registration_floor: "",
  registration_apartment: "",
  residence_registration: "",
  photo_data_url: "",
  photo_ai_style: "",
  passport_page_photo_data_url: "",
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

const COUNTRY_CITIES: Record<string, string[]> = {
  Россия: ["Москва", "Санкт-Петербург", "Казань", "Краснодар", "Сочи", "Екатеринбург", "Новосибирск", "Самара", "Ростов-на-Дону"],
  Казахстан: ["Алматы", "Астана", "Шымкент", "Караганда", "Актобе"],
  Беларусь: ["Минск", "Брест", "Гомель", "Гродно", "Витебск", "Могилев"],
};

const METRO_BY_CITY: Record<string, string[]> = {
  Москва: ["Лухмановская", "Некрасовка", "Косино", "Новокосино", "Новогиреево", "Курская", "Таганская", "Парк Культуры", "Юго-Западная", "Белорусская"],
  "Санкт-Петербург": ["Невский проспект", "Маяковская", "Купчино", "Ладожская", "Парнас", "Пионерская"],
  Казань: ["Кремлевская", "Площадь Тукая", "Дубравная", "Северный вокзал"],
  Новосибирск: ["Площадь Ленина", "Заельцовская", "Студенческая", "Речной вокзал"],
};

const EDUCATION_TYPES = [
  "Школа",
  "Лицей",
  "Гимназия",
  "Колледж",
  "Техникум",
  "ПТУ",
  "Университет",
  "Институт",
  "Академия",
] as const;

const EDUCATION_INSTITUTIONS: Record<string, Record<string, string[]>> = {
  Россия: {
    Москва: [
      "МГУ им. М.В. Ломоносова",
      "МГИМО",
      "РЭУ им. Г.В. Плеханова",
      "РАНХиГС",
      "МПГУ",
      "Колледж МГПУ",
    ],
    "Санкт-Петербург": [
      "СПбГУ",
      "СПбПУ Петра Великого",
      "РГПУ им. А.И. Герцена",
      "СПбГЭУ",
    ],
  },
  Казахстан: {
    Алматы: ["КазНУ им. аль-Фараби", "Satbayev University", "КазНПУ им. Абая"],
    Астана: ["ЕНУ им. Л.Н. Гумилева", "Назарбаев Университет"],
  },
  Беларусь: {
    Минск: ["БГУ", "БНТУ", "БГПУ им. Максима Танка"],
  },
};

const COUNTRY_VILLAGES: Record<string, Record<string, string[]>> = {
  Россия: {
    Москва: ["Коммунарка", "Переделкино"],
    "Московская область": ["Ромашково", "Переделкино", "Жаворонки"],
  },
  Казахстан: {
    Алматы: ["Боралдай", "Каскелен"],
  },
  Беларусь: {
    Минск: ["Колодищи", "Ждановичи"],
  },
};

const MANUAL_METRO_STORAGE_KEY = "crm.manual_metro_stations_v1";
const MANUAL_BIRTH_PLACES_STORAGE_KEY = "crm.manual_birth_places_v1";

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

const PROFESSION_OPTIONS = [
  "Няня",
  "Бебиситтер",
  "Домработница",
  "Клинер",
  "Сиделка",
  "Мастер на час",
  "Семейная пара",
  "Водитель",
  "Репетитор",
  "Психолог",
  "Массажист",
  "Зооняня",
  "Повар",
] as const;

const DESIRED_POSITION_OPTIONS = [
  "Няня",
  "Гувернантка",
  "Домработница",
  "Семейная пара",
  "Клинер",
  "Сиделка",
  "Водитель",
  "Репетитор",
  "Повар",
] as const;

const MARITAL_STATUS_OPTIONS = [
  "Не указано",
  "В браке",
  "Не в браке",
  "Гражданский брак",
  "Венчанные",
  "Вдова/вдовец",
  "Разведен(а)",
] as const;

const DIET_OPTIONS = [
  "Без ограничений",
  "Халяль",
  "Кошер",
  "Вегетарианство",
  "Веган",
  "Без лактозы",
  "Без глютена",
  "Без свинины",
  "Без морепродуктов",
  "Детское питание",
  "Диабетическое питание",
] as const;

const RELIGION_OPTIONS = [
  "Не указано",
  "Православие",
  "Католицизм",
  "Ислам",
  "Иудаизм",
  "Буддизм",
  "Атеизм",
] as const;

const EXTRA_SPORT_OPTIONS = [
  "Йога",
  "Бег",
  "Фитнес",
  "Теннис",
  "Верховая езда",
  "Танцы",
] as const;

type ChildItem = {
  gender: "Мальчик" | "Девочка" | "";
  age: string;
};

type EducationItem = {
  country: string;
  city: string;
  institution_type: string;
  institution_name: string;
  diploma_profession: string;
  graduation_year: string;
  diploma_file_data_url: string;
  diploma_file_name: string;
};

type CourseItem = {
  name: string;
  completed_at: string;
  document_file_data_url: string;
  document_file_name: string;
};

type QuestionnaireQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
};

type QuestionnaireSection = {
  position: string;
  title: string;
  questions: QuestionnaireQuestion[];
};

const POSITION_QUESTIONNAIRES: QuestionnaireSection[] = [
  {
    position: "Семейная пара",
    title: "Опросник для семейной пары",
    questions: [
      { id: "fp_full_name", label: "Ф.И.О. (муж/жен)", type: "textarea" },
      { id: "fp_citizenship", label: "Гражданство (муж/жен)", type: "textarea" },
      { id: "fp_contacts", label: "Контактные телефоны", type: "text" },
      { id: "fp_registration", label: "Постоянная регистрация (прописка)", type: "text" },
      { id: "fp_marital", label: "Семейное положение", type: "text" },
      { id: "fp_children", label: "Дети", type: "text" },
      { id: "fp_birth", label: "Дата рождения (муж/жен)", type: "textarea" },
      { id: "fp_education", label: "Образование (муж/жен)", type: "textarea" },
      { id: "fp_personality", label: "Качества личности (муж/жен)", type: "textarea" },
      { id: "fp_family_experience", label: "Опыт работы в семьях", type: "textarea" },
      { id: "fp_duties", label: "Обязанности (мужчина/женщина)", type: "textarea" },
      { id: "fp_references", label: "Рекомендации", type: "textarea" },
      { id: "fp_leave_reason", label: "Причина ухода", type: "textarea" },
      { id: "fp_etiquette", label: "Знание этикета", type: "select", options: ["Да", "Нет", "Частично"] },
      { id: "fp_surfaces", label: "Знание сложных поверхностей", type: "select", options: ["Да", "Нет", "Частично"] },
      { id: "fp_vip_wardrobe", label: "Опыт работы с VIP гардеробом", type: "select", options: ["Да", "Нет", "Частично"] },
      { id: "fp_animals_flowers", label: "Уход за животными, цветами", type: "textarea" },
      { id: "fp_childcare", label: "Возможность присмотра за детьми", type: "select", options: ["Да", "Нет", "По договоренности"] },
      { id: "fp_appliances", label: "Знание бытовой техники", type: "textarea" },
      { id: "fp_garden_tools", label: "Владение садовыми инструментами/техникой", type: "textarea" },
      { id: "fp_passport", label: "Наличие загранпаспорта (муж/жен)", type: "textarea" },
      { id: "fp_driver", label: "Наличие вод. прав и стаж (муж/жен)", type: "textarea" },
      { id: "fp_salary", label: "Ожидаемая зарплата", type: "text" },
      { id: "fp_workbook_exp", label: "Опыт работы по трудовой книжке (муж/жен)", type: "textarea" },
    ],
  },
  {
    position: "Домработница",
    title: "Опросник для домработницы",
    questions: [
      { id: "hk_city_metro", label: "Город проживания и ближайшая станция метро", type: "text" },
      { id: "hk_birth", label: "Полная дата рождения", type: "text" },
      { id: "hk_phone", label: "Номер телефона", type: "text" },
      { id: "hk_email", label: "Электронная почта", type: "text" },
      { id: "hk_exp_period", label: "Опыт работы домработницей (с какого по какой год)", type: "text" },
      { id: "hk_home_type", label: "Квартира/дом, метраж", type: "text" },
      { id: "hk_family", label: "Сколько людей проживало, сколько детей и возраст", type: "textarea" },
      { id: "hk_animals", label: "Домашние животные (сколько, какие)", type: "text" },
      { id: "hk_duties", label: "Ваши обязанности (уборка, стирка, глажка и т.д.)", type: "textarea" },
      { id: "hk_surfaces", label: "Уход за поверхностями (какими)", type: "textarea" },
      { id: "hk_chemicals", label: "С какой химией работали", type: "textarea" },
      { id: "hk_appliances", label: "С какой техникой работали", type: "textarea" },
      { id: "hk_schedule", label: "Ваш график работы", type: "text" },
      { id: "hk_other_exp", label: "Весь опыт работы (помимо домработницы)", type: "textarea" },
      { id: "hk_education", label: "Образование + курсы", type: "textarea" },
      { id: "hk_about", label: "Расскажите о себе", type: "textarea" },
      { id: "hk_medical", label: "Медицинские анализы / вакцина Covid-19", type: "textarea" },
      { id: "hk_abroad", label: "Готовность выезжать за границу / загранпаспорт", type: "textarea" },
      { id: "hk_references", label: "Наличие рекомендаций", type: "textarea" },
    ],
  },
  {
    position: "Няня",
    title: "Опросник для няни",
    questions: [
      { id: "n_city_metro", label: "Город проживания и ближайшая станция метро", type: "text" },
      { id: "n_birth", label: "Полная дата рождения", type: "text" },
      { id: "n_phone", label: "Номер телефона", type: "text" },
      { id: "n_email", label: "Электронная почта", type: "text" },
      { id: "n_nanny_exp", label: "Опыт работы няней (период, возраст детей, обязанности)", type: "textarea" },
      { id: "n_school_exp", label: "Опыт в образовательных учреждениях (когда и кем)", type: "textarea" },
      { id: "n_education", label: "Образование (уровень, учреждение, специальность, год)", type: "textarea" },
      { id: "n_about", label: "Расскажите подробнее о себе", type: "textarea" },
      { id: "n_medical", label: "Медицинские анализы", type: "select", options: ["Да", "Нет", "Частично"] },
      { id: "n_abroad", label: "Готовность выезжать с семьей за границу", type: "select", options: ["Да", "Нет", "По договоренности"] },
      { id: "n_references", label: "Наличие рекомендаций (ФИО и телефон)", type: "textarea" },
    ],
  },
];

const QUESTION_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  POSITION_QUESTIONNAIRES.flatMap((section) => section.questions.map((q) => [q.id, q.label]))
);

function splitCsv(raw: string): string[] {
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function toggleCsv(raw: string, value: string): string {
  const list = splitCsv(raw);
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return next.join(", ");
}

function calculateAgeFromBirthDate(birthDate: string): string {
  if (!birthDate) return "";
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) age -= 1;
  return age >= 0 ? String(age) : "";
}

function zodiacFromBirthDate(birthDate: string): string {
  if (!birthDate) return "";
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "Овен";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "Телец";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "Близнецы";
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "Рак";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "Лев";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "Дева";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "Весы";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "Скорпион";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "Стрелец";
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "Козерог";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "Водолей";
  return "Рыбы";
}

function parseChildren(raw: string | undefined): ChildItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChildItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      gender: item.gender === "Мальчик" || item.gender === "Девочка" ? item.gender : "",
      age: item.age ? String(item.age) : "",
    }));
  } catch {
    return [];
  }
}

function parseQuestionnaireAnswers(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === "string") normalized[k] = v;
    });
    return normalized;
  } catch {
    return {};
  }
}

function parseEducationItems(raw: string | undefined): EducationItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EducationItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => ({
      country: x.country || "Россия",
      city: x.city || "",
      institution_type: x.institution_type || "",
      institution_name: x.institution_name || "",
      diploma_profession: x.diploma_profession || "",
      graduation_year: x.graduation_year || "",
      diploma_file_data_url: x.diploma_file_data_url || "",
      diploma_file_name: x.diploma_file_name || "",
    }));
  } catch {
    return [];
  }
}

function parseCourseItems(raw: string | undefined): CourseItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CourseItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => ({
      name: x.name || "",
      completed_at: x.completed_at || "",
      document_file_data_url: x.document_file_data_url || "",
      document_file_name: x.document_file_name || "",
    }));
  } catch {
    return [];
  }
}

function parseBirthPlace(raw: string | undefined): { country: string; city: string } {
  const value = (raw || "").trim();
  if (!value) return { country: "Россия", city: "" };
  const byComma = value.split(",").map((x) => x.trim()).filter(Boolean);
  if (byComma.length >= 2) {
    return { city: byComma[0], country: byComma[1] };
  }
  return { country: "Россия", city: value };
}

function parseCityMetro(raw: string | undefined): { city: string; station: string } {
  const value = (raw || "").trim();
  if (!value) return { city: "", station: "" };
  const metroMatch = value.match(/(?:м\.|метро)\s*([^\n,;]+)/i);
  if (metroMatch?.[1]) {
    const station = metroMatch[1].trim();
    const city = value
      .replace(metroMatch[0], "")
      .replace(/[—-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*$/, "")
      .trim();
    return { city, station };
  }
  const byComma = value.split(",").map((x) => x.trim()).filter(Boolean);
  if (byComma.length >= 2) return { city: byComma[0], station: byComma[1] };
  return { city: value, station: "" };
}

function getCandidatePhoto(candidate: Candidate): string {
  return candidate.contacts?.photo_data_url || getAvatarUrl(candidate.full_name);
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
  const photoRef = useRef<HTMLInputElement>(null);
  const passportPhotoRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [manualMetroStations, setManualMetroStations] = useState<string[]>([]);
  const [manualMetroDraft, setManualMetroDraft] = useState("");
  const [manualBirthCities, setManualBirthCities] = useState<string[]>([]);
  const [manualBirthVillages, setManualBirthVillages] = useState<string[]>([]);
  const [manualBirthCityDraft, setManualBirthCityDraft] = useState("");
  const [manualBirthVillageDraft, setManualBirthVillageDraft] = useState("");
  const [professionSearchDraft, setProfessionSearchDraft] = useState("");

  // Expanded card notes
  const [expanded, setExpanded] = useState<string | null>(null);

  // Candidate detail view
  const [viewCandidate, setViewCandidate] = useState<Candidate | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAiInterview, setShowAiInterview] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiForm, setAiForm] = useState({
    profession: "",
    candidate_name: "",
    answersText: "",
    telegram: "",
    whatsapp: "",
    email: "",
  });

  const zodiacSign = useMemo(() => zodiacFromBirthDate(form.birth_date), [form.birth_date]);
  const selectedDesiredPositions = useMemo(() => splitCsv(form.desired_positions), [form.desired_positions]);
  const selectedDietOptions = useMemo(() => splitCsv(form.diet_selected), [form.diet_selected]);
  const birthCityOptions = useMemo(
    () => Array.from(new Set([...(COUNTRY_CITIES[form.birth_country] ?? []), ...manualBirthCities])),
    [form.birth_country, manualBirthCities]
  );
  const birthVillageOptions = useMemo(
    () => Array.from(new Set([...(COUNTRY_VILLAGES[form.birth_country]?.[form.birth_city] ?? []), ...manualBirthVillages])),
    [form.birth_country, form.birth_city, manualBirthVillages]
  );
  const professionByDiplomas = useMemo(
    () => Array.from(new Set(educations.map((e) => e.diploma_profession.trim()).filter(Boolean))),
    [educations]
  );
  const professionSuggestions = useMemo(() => {
    const q = professionSearchDraft.trim().toLowerCase();
    const all = Array.from(new Set([...PROFESSION_OPTIONS, ...professionByDiplomas]));
    if (!q) return all;
    return all
      .filter((x) => x.toLowerCase().startsWith(q) || x.toLowerCase().includes(q))
      .sort((a, b) => (a.toLowerCase().startsWith(q) === b.toLowerCase().startsWith(q) ? a.localeCompare(b, "ru") : a.toLowerCase().startsWith(q) ? -1 : 1));
  }, [professionSearchDraft, professionByDiplomas]);
  const metroOptions = useMemo(() => {
    const byCity = METRO_BY_CITY[form.city_living] ?? [];
    const fromCandidates = candidates
      .map((c) => parseCityMetro(c.contacts?.city_living).station)
      .filter(Boolean);
    return Array.from(new Set([...byCity, ...manualMetroStations, ...fromCandidates])).sort((a, b) => a.localeCompare(b, "ru"));
  }, [form.city_living, manualMetroStations, candidates]);
  const dynamicInstitutionMap = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    candidates.forEach((c) => {
      const items = parseEducationItems(c.contacts?.education_items_json);
      items.forEach((it) => {
        if (!it.institution_name) return;
        const country = it.country || "Россия";
        const city = it.city || "Без города";
        map[country] = map[country] || {};
        map[country][city] = map[country][city] || [];
        if (!map[country][city].includes(it.institution_name)) map[country][city].push(it.institution_name);
      });
    });
    return map;
  }, [candidates]);
  const activeQuestionnaires = useMemo(
    () => POSITION_QUESTIONNAIRES.filter((section) => selectedDesiredPositions.includes(section.position)),
    [selectedDesiredPositions]
  );
  const viewQuestionnaireAnswers = useMemo(
    () => parseQuestionnaireAnswers(viewCandidate?.contacts?.questionnaire_answers_json),
    [viewCandidate]
  );

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MANUAL_METRO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) setManualMetroStations(parsed.filter(Boolean));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MANUAL_METRO_STORAGE_KEY, JSON.stringify(manualMetroStations));
    } catch {
      // ignore
    }
  }, [manualMetroStations]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MANUAL_BIRTH_PLACES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { cities?: string[]; villages?: string[] };
      if (Array.isArray(parsed.cities)) setManualBirthCities(parsed.cities.filter(Boolean));
      if (Array.isArray(parsed.villages)) setManualBirthVillages(parsed.villages.filter(Boolean));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        MANUAL_BIRTH_PLACES_STORAGE_KEY,
        JSON.stringify({ cities: manualBirthCities, villages: manualBirthVillages })
      );
    } catch {
      // ignore
    }
  }, [manualBirthCities, manualBirthVillages]);

  useEffect(() => {
    if (form.age_manual_override === "true") return;
    const calculated = calculateAgeFromBirthDate(form.birth_date);
    if (calculated !== form.age) {
      setForm((prev) => ({ ...prev, age: calculated }));
    }
  }, [form.birth_date, form.age, form.age_manual_override]);

  useEffect(() => {
    if (form.experience_manual_override === "true") return;
    if (!form.career_start_year) {
      if (form.experience_years !== "") setForm((prev) => ({ ...prev, experience_years: "" }));
      return;
    }
    const year = Number(form.career_start_year);
    const currentYear = new Date().getFullYear();
    if (!Number.isFinite(year) || year < 1950 || year > currentYear) return;
    const calculated = String(Math.max(0, currentYear - year));
    if (calculated !== form.experience_years) {
      setForm((prev) => ({ ...prev, experience_years: calculated }));
    }
  }, [form.career_start_year, form.experience_manual_override, form.experience_years]);

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
      [c.full_name, c.specialization ?? "", c.availability ?? "", c.contacts?.city_living ?? "", ...(c.tags ?? [])]
        .join(" ").toLowerCase().includes(q)
    );
  }, [candidates, search]);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setChildren([]);
    setQuestionnaireAnswers({});
    setEducations([]);
    setCourses([]);
    setShowForm(true);
  }

  function openEdit(c: Candidate) {
    const birthParsed = parseBirthPlace(c.contacts?.birth_place);
    const cityMetroParsed = parseCityMetro(c.contacts?.city_living);
    setEditId(c.id);
    setForm({
      full_name: c.full_name,
      gender: c.contacts?.gender ?? "",
      birth_date: c.contacts?.birth_date ?? "",
      birth_country: c.contacts?.birth_country ?? birthParsed.country,
      birth_city: c.contacts?.birth_city ?? birthParsed.city,
      birth_village: c.contacts?.birth_village ?? "",
      birth_lat: c.contacts?.birth_lat ?? "",
      birth_lng: c.contacts?.birth_lng ?? "",
      birth_place: c.contacts?.birth_place ?? "",
      metro_station: c.contacts?.metro_station ?? cityMetroParsed.station,
      city_living: c.contacts?.city_living_city ?? cityMetroParsed.city,
      age: c.age?.toString() ?? "",
      hide_age: c.contacts?.hide_age ?? "false",
      age_manual_override: c.contacts?.age_manual_override ?? "false",
      specialization: c.specialization ?? "",
      desired_positions: c.contacts?.desired_positions ?? "",
      desired_position_custom: c.contacts?.desired_position_custom ?? "",
      questionnaire_answers_json: c.contacts?.questionnaire_answers_json ?? "{}",
      citizenship: c.contacts?.citizenship ?? "",
      marital_status: c.contacts?.marital_status ?? "",
      marital_status_hidden: c.contacts?.marital_status_hidden ?? "false",
      children_json: c.contacts?.children_json ?? "[]",
      pets: c.contacts?.pets ?? "",
      allergies_has: c.contacts?.allergies_has ?? "Нет",
      allergies_details: c.contacts?.allergies_details ?? "",
      can_swim: c.contacts?.can_swim ?? "Нет",
      can_roller: c.contacts?.can_roller ?? "Нет",
      can_ski: c.contacts?.can_ski ?? "Нет",
      can_snowboard: c.contacts?.can_snowboard ?? "Нет",
      can_bicycle: c.contacts?.can_bicycle ?? "Нет",
      can_scooter: c.contacts?.can_scooter ?? "Нет",
      sports_selected: c.contacts?.sports_selected ?? "",
      sports_custom: c.contacts?.sports_custom ?? "",
      height_cm: c.contacts?.height_cm ?? "",
      weight_kg: c.contacts?.weight_kg ?? "",
      diet: c.contacts?.diet ?? "",
      diet_selected: c.contacts?.diet_selected ?? "",
      diet_custom: c.contacts?.diet_custom ?? "",
      religion: c.contacts?.religion ?? "Не указано",
      religion_custom: c.contacts?.religion_custom ?? "",
      relocation_readiness: c.contacts?.relocation_readiness ?? "Не указано",
      business_trips_readiness: c.contacts?.business_trips_readiness ?? "Не указано",
      career_start_year: c.contacts?.career_start_year ?? "",
      experience_manual_override: c.contacts?.experience_manual_override ?? "false",
      experience_years: c.experience_years?.toString() ?? "",
      salary_min: c.salary_min?.toString() ?? "",
      salary_max: c.salary_max?.toString() ?? "",
      availability: c.availability ?? "",
      phone: c.contacts?.phone ?? "",
      sos_phone: c.contacts?.sos_phone ?? "",
      telegram: c.contacts?.telegram ?? "",
      whatsapp: c.contacts?.whatsapp ?? "",
      max_messenger: c.contacts?.max_messenger ?? "",
      email: c.contacts?.email ?? "",
      actual_address_street: c.contacts?.actual_address_street ?? "",
      actual_address_house: c.contacts?.actual_address_house ?? "",
      actual_address_building: c.contacts?.actual_address_building ?? "",
      actual_address_entrance_code: c.contacts?.actual_address_entrance_code ?? "",
      actual_address_floor: c.contacts?.actual_address_floor ?? "",
      actual_address_apartment: c.contacts?.actual_address_apartment ?? "",
      registration_street: c.contacts?.registration_street ?? c.contacts?.residence_registration ?? "",
      registration_house: c.contacts?.registration_house ?? "",
      registration_building: c.contacts?.registration_building ?? "",
      registration_entrance_code: c.contacts?.registration_entrance_code ?? "",
      registration_floor: c.contacts?.registration_floor ?? "",
      registration_apartment: c.contacts?.registration_apartment ?? "",
      residence_registration: c.contacts?.residence_registration ?? "",
      photo_data_url: c.contacts?.photo_data_url ?? "",
      photo_ai_style: c.contacts?.photo_ai_style ?? "",
      passport_page_photo_data_url: c.contacts?.passport_page_photo_data_url ?? "",
      tags: (c.tags ?? []).join(", "),
      notes: c.notes ?? "",
    });
    setChildren(parseChildren(c.contacts?.children_json));
    setQuestionnaireAnswers(parseQuestionnaireAnswers(c.contacts?.questionnaire_answers_json));
    setEducations(parseEducationItems(c.contacts?.education_items_json));
    setCourses(parseCourseItems(c.contacts?.course_items_json));
    setShowForm(true);
  }

  async function onSave() {
    if (!form.full_name.trim()) return;
    if (!form.registration_street.trim() || !form.registration_house.trim()) {
      setError("Для прописки заполните минимум улицу и дом");
      return;
    }
    if (!form.passport_page_photo_data_url.trim()) {
      setError("Прикрепите фото страницы паспорта");
      return;
    }
    setFormSaving(true);
    try {
      const contacts: Record<string, string> = {};
      contacts.gender = form.gender.trim();
      contacts.birth_date = form.birth_date.trim();
      contacts.birth_country = form.birth_country.trim();
      contacts.birth_city = form.birth_city.trim();
      contacts.birth_village = form.birth_village.trim();
      contacts.birth_lat = form.birth_lat.trim();
      contacts.birth_lng = form.birth_lng.trim();
      contacts.birth_place = [form.birth_village.trim(), form.birth_city.trim(), form.birth_country.trim()].filter(Boolean).join(", ");
      contacts.city_living_city = form.city_living.trim();
      contacts.metro_station = form.metro_station.trim();
      contacts.city_living = [form.city_living.trim(), form.metro_station.trim() ? `м. ${form.metro_station.trim()}` : ""].filter(Boolean).join(", ");
      contacts.hide_age = form.hide_age;
      contacts.age_manual_override = form.age_manual_override;
      contacts.desired_positions = form.desired_positions.trim();
      contacts.desired_position_custom = form.desired_position_custom.trim();
      contacts.questionnaire_answers_json = JSON.stringify(questionnaireAnswers);
      contacts.education_items_json = JSON.stringify(educations);
      contacts.course_items_json = JSON.stringify(courses);
      contacts.citizenship = form.citizenship.trim();
      contacts.marital_status = form.marital_status.trim();
      contacts.marital_status_hidden = form.marital_status_hidden;
      contacts.children_json = JSON.stringify(children.filter((ch) => ch.gender || ch.age));
      contacts.pets = form.pets.trim();
      contacts.allergies_has = form.allergies_has;
      contacts.allergies_details = form.allergies_details.trim();
      contacts.can_swim = form.can_swim;
      contacts.can_roller = form.can_roller;
      contacts.can_ski = form.can_ski;
      contacts.can_snowboard = form.can_snowboard;
      contacts.can_bicycle = form.can_bicycle;
      contacts.can_scooter = form.can_scooter;
      contacts.sports_selected = form.sports_selected.trim();
      contacts.sports_custom = form.sports_custom.trim();
      contacts.height_cm = form.height_cm.trim();
      contacts.weight_kg = form.weight_kg.trim();
      contacts.diet_selected = form.diet_selected.trim();
      contacts.diet_custom = form.diet_custom.trim();
      contacts.diet = [...splitCsv(form.diet_selected), form.diet_custom.trim()].filter(Boolean).join(", ");
      contacts.religion = form.religion.trim();
      contacts.religion_custom = form.religion_custom.trim();
      contacts.relocation_readiness = form.relocation_readiness.trim();
      contacts.business_trips_readiness = form.business_trips_readiness.trim();
      contacts.career_start_year = form.career_start_year.trim();
      contacts.experience_manual_override = form.experience_manual_override;
      contacts.phone = form.phone.trim();
      contacts.sos_phone = form.sos_phone.trim();
      if (form.telegram.trim()) contacts.telegram = form.telegram.trim();
      if (form.whatsapp.trim()) contacts.whatsapp = form.whatsapp.trim();
      if (form.max_messenger.trim()) contacts.max_messenger = form.max_messenger.trim();
      if (form.email.trim()) contacts.email = form.email.trim();
      contacts.actual_address_street = form.actual_address_street.trim();
      contacts.actual_address_house = form.actual_address_house.trim();
      contacts.actual_address_building = form.actual_address_building.trim();
      contacts.actual_address_entrance_code = form.actual_address_entrance_code.trim();
      contacts.actual_address_floor = form.actual_address_floor.trim();
      contacts.actual_address_apartment = form.actual_address_apartment.trim();
      contacts.registration_street = form.registration_street.trim();
      contacts.registration_house = form.registration_house.trim();
      contacts.registration_building = form.registration_building.trim();
      contacts.registration_entrance_code = form.registration_entrance_code.trim();
      contacts.registration_floor = form.registration_floor.trim();
      contacts.registration_apartment = form.registration_apartment.trim();

      const actualAddressLine = [
        form.actual_address_street.trim(),
        form.actual_address_house.trim() ? `д. ${form.actual_address_house.trim()}` : "",
        form.actual_address_building.trim() ? `корп./дробь ${form.actual_address_building.trim()}` : "",
        form.actual_address_entrance_code.trim() ? `код ${form.actual_address_entrance_code.trim()}` : "",
        form.actual_address_floor.trim() ? `этаж ${form.actual_address_floor.trim()}` : "",
        form.actual_address_apartment.trim() ? `кв. ${form.actual_address_apartment.trim()}` : "",
      ].filter(Boolean).join(", ");
      contacts.actual_address = actualAddressLine;

      const registrationAddressLine = [
        form.registration_street.trim(),
        form.registration_house.trim() ? `д. ${form.registration_house.trim()}` : "",
        form.registration_building.trim() ? `корп./дробь ${form.registration_building.trim()}` : "",
        form.registration_entrance_code.trim() ? `код ${form.registration_entrance_code.trim()}` : "",
        form.registration_floor.trim() ? `этаж ${form.registration_floor.trim()}` : "",
        form.registration_apartment.trim() ? `кв. ${form.registration_apartment.trim()}` : "",
      ].filter(Boolean).join(", ");
      contacts.registration_address = registrationAddressLine;
      contacts.residence_registration = registrationAddressLine;
      contacts.photo_data_url = form.photo_data_url.trim();
      contacts.photo_ai_style = form.photo_ai_style.trim();
      contacts.passport_page_photo_data_url = form.passport_page_photo_data_url.trim();
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

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>, kind: "profile" | "passport") {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("read error"));
        reader.readAsDataURL(file);
      });
      if (kind === "profile") {
        setForm((f) => ({ ...f, photo_data_url: dataUrl }));
      } else {
        setForm((f) => ({ ...f, passport_page_photo_data_url: dataUrl }));
      }
    } catch {
      setError("Не удалось прикрепить фото");
    } finally {
      if (kind === "profile" && photoRef.current) photoRef.current.value = "";
      if (kind === "passport" && passportPhotoRef.current) passportPhotoRef.current.value = "";
    }
  }

  function toggleProfessionSelection(value: string) {
    setForm((f) => ({ ...f, specialization: toggleCsv(f.specialization, value) }));
  }

  function toggleDesiredPosition(value: string) {
    setForm((f) => ({ ...f, desired_positions: toggleCsv(f.desired_positions, value) }));
  }

  function toggleExtraSport(value: string) {
    setForm((f) => ({ ...f, sports_selected: toggleCsv(f.sports_selected, value) }));
  }

  function addManualMetroStation() {
    const station = manualMetroDraft.trim();
    if (!station) return;
    setManualMetroStations((prev) =>
      prev.includes(station) ? prev : [station, ...prev].slice(0, 500)
    );
    setForm((f) => ({ ...f, metro_station: station }));
    setManualMetroDraft("");
  }

  function addManualBirthCity() {
    const v = manualBirthCityDraft.trim();
    if (!v) return;
    setManualBirthCities((prev) => (prev.includes(v) ? prev : [v, ...prev].slice(0, 1000)));
    setForm((f) => ({ ...f, birth_city: v }));
    setManualBirthCityDraft("");
  }

  function addManualBirthVillage() {
    const v = manualBirthVillageDraft.trim();
    if (!v) return;
    setManualBirthVillages((prev) => (prev.includes(v) ? prev : [v, ...prev].slice(0, 1000)));
    setForm((f) => ({ ...f, birth_village: v }));
    setManualBirthVillageDraft("");
  }

  function applyProfessionSuggestion(value: string) {
    setForm((f) => ({ ...f, desired_positions: toggleCsv(f.desired_positions, value) }));
  }

  function educationWarning(ed: EducationItem): string {
    if (!ed.diploma_file_name) return "Нет прикрепленного диплома/документа.";
    const name = ed.diploma_file_name.toLowerCase();
    const hints: string[] = [];
    if (ed.graduation_year && !name.includes(ed.graduation_year)) hints.push("год в названии файла не найден");
    const firstWord = (ed.institution_name || "").split(/\s+/)[0]?.toLowerCase();
    if (firstWord && firstWord.length > 3 && !name.includes(firstWord)) hints.push("название учебного заведения не похоже на файл");
    if (ed.diploma_profession && !name.includes(ed.diploma_profession.split(/\s+/)[0]?.toLowerCase())) hints.push("профессия из диплома не распознана в имени файла");
    return hints.length ? `Проверьте диплом: ${hints.join("; ")}.` : "Базовая проверка пройдена.";
  }

  async function openCameraCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setError("Не удалось открыть камеру. Проверьте разрешение браузера.");
    }
  }

  function closeCameraCapture() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  }

  function takePhotoFromCamera() {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setForm((f) => ({ ...f, photo_data_url: dataUrl }));
    closeCameraCapture();
  }

  function requestAiPhotoStyle() {
    if (!form.photo_data_url.trim()) {
      setError("Сначала добавьте фото кандидата (из файла или камеры).");
      return;
    }
    setForm((f) => ({
      ...f,
      photo_ai_style: "white_shirt_agency_logo_bg_requested",
    }));
  }

  function addChild() {
    setChildren((prev) => [...prev, { gender: "", age: "" }]);
  }

  function removeChild(index: number) {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  }

  function updateChild(index: number, patch: Partial<ChildItem>) {
    setChildren((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateQuestionnaireAnswer(questionId: string, value: string) {
    setQuestionnaireAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function addEducation() {
    setEducations((prev) => [
      ...prev,
      {
        country: "Россия",
        city: "",
        institution_type: "",
        institution_name: "",
        diploma_profession: "",
        graduation_year: "",
        diploma_file_data_url: "",
        diploma_file_name: "",
      },
    ]);
  }

  function removeEducation(index: number) {
    setEducations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    setEducations((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  function addCourse() {
    setCourses((prev) => [...prev, { name: "", completed_at: "", document_file_data_url: "", document_file_name: "" }]);
  }

  function removeCourse(index: number) {
    setCourses((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCourse(index: number, patch: Partial<CourseItem>) {
    setCourses((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  async function attachEducationDocument(index: number, file: File | null, kind: "education" | "course") {
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("file-read-failed"));
        r.readAsDataURL(file);
      });
      if (kind === "education") {
        updateEducation(index, { diploma_file_data_url: dataUrl, diploma_file_name: file.name });
      } else {
        updateCourse(index, { document_file_data_url: dataUrl, document_file_name: file.name });
      }
    } catch {
      setError("Не удалось прикрепить документ");
    }
  }

  async function onCreateByAiInterview() {
    if (!aiForm.profession.trim() || !aiForm.candidate_name.trim()) {
      setError("Укажите профессию и имя кандидата");
      return;
    }
    const answers: Record<string, string> = {};
    aiForm.answersText.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const q = line.slice(0, idx).trim();
        const a = line.slice(idx + 1).trim();
        if (q && a) answers[q] = a;
      }
    });
    setAiSaving(true);
    try {
      const res = await fetch("/api/crm/candidates/ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profession: aiForm.profession.trim(),
          candidate_name: aiForm.candidate_name.trim(),
          answers,
          contacts: {
            telegram: aiForm.telegram.trim() || undefined,
            whatsapp: aiForm.whatsapp.trim() || undefined,
            email: aiForm.email.trim() || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("create failed");
      setShowAiInterview(false);
      setAiForm({
        profession: "",
        candidate_name: "",
        answersText: "",
        telegram: "",
        whatsapp: "",
        email: "",
      });
      await loadCandidates();
    } catch {
      setError("Не удалось создать резюме по AI-анкетированию");
    } finally {
      setAiSaving(false);
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
            <button onClick={() => setShowAiInterview(true)} className="btn-secondary text-sm py-2 px-4">
              AI-анкетирование
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
                          src={getCandidatePhoto(c)}
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
                      {c.contacts?.hide_age === "true" ? (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Возраст</span>
                          <span>скрыт</span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Возраст</span>
                          <span>{c.age ?? "—"}</span>
                        </div>
                      )}
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
                <img src={getCandidatePhoto(viewCandidate)} alt="" width={48} height={48}
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
                  <p className="text-slate-800">{viewCandidate.contacts?.hide_age === "true" ? "скрыт" : (viewCandidate.age ?? "—")}</p>
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
                <div>
                  <p className="text-xs text-slate-400">Пол</p>
                  <p className="text-slate-800">{viewCandidate.contacts?.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Дата рождения</p>
                  <p className="text-slate-800">{viewCandidate.contacts?.birth_date || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Гороскоп</p>
                  <p className="text-slate-800">{zodiacFromBirthDate(viewCandidate.contacts?.birth_date ?? "") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Гражданство</p>
                  <p className="text-slate-800">{viewCandidate.contacts?.citizenship || "—"}</p>
                </div>
              </div>

              {/* Contacts */}
              {viewCandidate.contacts && Object.keys(viewCandidate.contacts).length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Контакты</p>
                  <div className="space-y-1 text-sm">
                    {viewCandidate.contacts.phone && (
                      <p><span className="text-slate-400">Телефон: </span><span className="text-slate-700">{viewCandidate.contacts.phone}</span></p>
                    )}
                    {viewCandidate.contacts.sos_phone && (
                      <p><span className="text-slate-400">SOS номер: </span><span className="text-slate-700">{viewCandidate.contacts.sos_phone}</span></p>
                    )}
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
                    {viewCandidate.contacts.max_messenger && (
                      <p><span className="text-slate-400">МАХ: </span><span className="text-slate-700">{viewCandidate.contacts.max_messenger}</span></p>
                    )}
                    {viewCandidate.contacts.email && (
                      <p>
                        <span className="text-slate-400">Email: </span>
                        <a href={`mailto:${viewCandidate.contacts.email}`} className="text-slate-700 hover:underline">
                          {viewCandidate.contacts.email}
                        </a>
                      </p>
                    )}
                    {viewCandidate.contacts.city_living && (
                      <p><span className="text-slate-400">Проживает: </span><span className="text-slate-700">{viewCandidate.contacts.city_living}</span></p>
                    )}
                    {viewCandidate.contacts.actual_address && (
                      <p><span className="text-slate-400">Фактический адрес: </span><span className="text-slate-700">{viewCandidate.contacts.actual_address}</span></p>
                    )}
                    {viewCandidate.contacts.residence_registration && (
                      <p><span className="text-slate-400">Место прописки: </span><span className="text-slate-700">{viewCandidate.contacts.residence_registration}</span></p>
                    )}
                    {viewCandidate.contacts.relocation_readiness && (
                      <p><span className="text-slate-400">Переезд: </span><span className="text-slate-700">{viewCandidate.contacts.relocation_readiness}</span></p>
                    )}
                    {viewCandidate.contacts.business_trips_readiness && (
                      <p><span className="text-slate-400">Командировки: </span><span className="text-slate-700">{viewCandidate.contacts.business_trips_readiness}</span></p>
                    )}
                  </div>
                </div>
              )}

              {Object.keys(viewQuestionnaireAnswers).some((key) => (viewQuestionnaireAnswers[key] ?? "").trim()) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Дополнительный опросник</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(viewQuestionnaireAnswers)
                      .filter(([, value]) => value.trim())
                      .map(([key, value]) => (
                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-slate-500">{QUESTION_LABEL_BY_ID[key] ?? key}</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {(parseEducationItems(viewCandidate.contacts?.education_items_json).length > 0 ||
                parseCourseItems(viewCandidate.contacts?.course_items_json).length > 0) && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Образование и курсы</p>
                  <div className="space-y-2">
                    {parseEducationItems(viewCandidate.contacts?.education_items_json).map((ed, idx) => (
                      <div key={`view-edu-${idx}`} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <p className="text-sm text-slate-700">
                          {[ed.institution_type, ed.institution_name, ed.city, ed.country, ed.graduation_year ? `выпуск ${ed.graduation_year}` : ""].filter(Boolean).join(" · ")}
                        </p>
                        {ed.diploma_file_name && (
                          <p className="text-[11px] text-slate-500 mt-0.5">Документ: {ed.diploma_file_name}</p>
                        )}
                      </div>
                    ))}
                    {parseCourseItems(viewCandidate.contacts?.course_items_json).map((c, idx) => (
                      <div key={`view-course-${idx}`} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <p className="text-sm text-slate-700">
                          {[c.name, c.completed_at ? `дата: ${c.completed_at}` : ""].filter(Boolean).join(" · ")}
                        </p>
                        {c.document_file_name && (
                          <p className="text-[11px] text-slate-500 mt-0.5">Документ: {c.document_file_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Family */}
              {viewCandidate.contacts && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Семья</p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-slate-400">Семейное положение: </span>
                      <span className="text-slate-700">
                        {viewCandidate.contacts.marital_status_hidden === "true"
                          ? "скрыто решением HR"
                          : (viewCandidate.contacts.marital_status || "—")}
                      </span>
                    </p>
                    <p><span className="text-slate-400">Дети: </span><span className="text-slate-700">{parseChildren(viewCandidate.contacts.children_json).length || "нет"}</span></p>
                    {parseChildren(viewCandidate.contacts.children_json).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parseChildren(viewCandidate.contacts.children_json).map((child, idx) => (
                          <span key={`${child.gender}-${child.age}-${idx}`} className="bg-slate-100 text-slate-600 text-xs rounded-full px-2.5 py-1">
                            {child.gender || "Ребенок"} {child.age ? `• ${child.age} лет` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Health */}
              {viewCandidate.contacts && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Здоровье</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-slate-400">Аллергии: </span><span className="text-slate-700">{viewCandidate.contacts.allergies_has || "—"}{viewCandidate.contacts.allergies_has === "Да" && viewCandidate.contacts.allergies_details ? ` (${viewCandidate.contacts.allergies_details})` : ""}</span></p>
                    <p><span className="text-slate-400">Рост / вес: </span><span className="text-slate-700">{viewCandidate.contacts.height_cm || "—"} / {viewCandidate.contacts.weight_kg || "—"}</span></p>
                    <p><span className="text-slate-400">Питание: </span><span className="text-slate-700">{viewCandidate.contacts.diet || "—"}</span></p>
                  </div>
                </div>
              )}

              {/* Sport */}
              {viewCandidate.contacts && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Спорт</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      viewCandidate.contacts.can_swim === "Да" ? "Плавание" : "",
                      viewCandidate.contacts.can_roller === "Да" ? "Ролики" : "",
                      viewCandidate.contacts.can_ski === "Да" ? "Лыжи" : "",
                      viewCandidate.contacts.can_snowboard === "Да" ? "Сноуборд" : "",
                      viewCandidate.contacts.can_bicycle === "Да" ? "Велосипед" : "",
                      viewCandidate.contacts.can_scooter === "Да" ? "Самокат" : "",
                      ...splitCsv(viewCandidate.contacts.sports_selected || ""),
                      ...splitCsv(viewCandidate.contacts.sports_custom || ""),
                    ].filter(Boolean).map((sport) => (
                      <span key={sport} className="bg-slate-100 text-slate-600 text-xs rounded-full px-2.5 py-1">{sport}</span>
                    ))}
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
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Персональные данные</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">ФИО *</label>
                <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="input-field mt-1" placeholder="Иванова Мария Петровна" />
              </div>
              {/* Avatar preview */}
              {form.full_name.trim() && (
                <div className="flex items-center gap-3 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.photo_data_url || getAvatarUrl(form.full_name)} alt="" width={40} height={40} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                  <span className="text-xs text-slate-400">{form.photo_data_url ? "Фото кандидата прикреплено" : "Аватар (генерируется автоматически)"}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Пол</label>
                  <select className="input-field mt-1" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Не указано</option>
                    <option value="Мужчина">Мужчина</option>
                    <option value="Женщина">Женщина</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Дата рождения</label>
                  <input value={form.birth_date} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                    type="date" className="input-field mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Возраст (авто)</label>
                  <input
                    value={form.age}
                    onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                    disabled={form.age_manual_override !== "true"}
                    type="number"
                    min="16"
                    max="90"
                    className="input-field mt-1 disabled:bg-slate-100"
                  />
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={form.age_manual_override === "true"} onChange={(e) => setForm((f) => ({ ...f, age_manual_override: e.target.checked ? "true" : "false" }))} />
                    HR: вручную скорректировать возраст
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={form.hide_age === "true"} onChange={(e) => setForm((f) => ({ ...f, hide_age: e.target.checked ? "true" : "false" }))} />
                    Скрыть возраст для карточки
                  </label>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Гороскоп</label>
                  <div className="input-field mt-1 bg-slate-50 text-slate-600">{zodiacSign || "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Страна рождения</label>
                  <input
                    list="birth-country-options"
                    value={form.birth_country}
                    onChange={(e) => setForm((f) => ({ ...f, birth_country: e.target.value, birth_city: "" }))}
                    className="input-field mt-1"
                    placeholder="Страна"
                  />
                  <datalist id="birth-country-options">
                    {Object.keys(COUNTRY_CITIES).map((country) => <option key={country} value={country} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Город рождения</label>
                  <input
                    list="birth-city-options"
                    value={form.birth_city}
                    onChange={(e) => setForm((f) => ({ ...f, birth_city: e.target.value }))}
                    className="input-field mt-1"
                    placeholder="Город"
                  />
                  <datalist id="birth-city-options">
                    {birthCityOptions.map((city) => <option key={city} value={city} />)}
                  </datalist>
                  <div className="mt-2 flex gap-2">
                    <input value={manualBirthCityDraft} onChange={(e) => setManualBirthCityDraft(e.target.value)} className="input-field text-xs" placeholder="Добавить город вручную" />
                    <button type="button" onClick={addManualBirthCity} className="btn-secondary text-xs px-2 py-1.5">Добавить</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Село / деревня рождения</label>
                  <input
                    list="birth-village-options"
                    value={form.birth_village}
                    onChange={(e) => setForm((f) => ({ ...f, birth_village: e.target.value }))}
                    className="input-field mt-1"
                    placeholder="Село / деревня"
                  />
                  <datalist id="birth-village-options">
                    {birthVillageOptions.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  <div className="mt-2 flex gap-2">
                    <input value={manualBirthVillageDraft} onChange={(e) => setManualBirthVillageDraft(e.target.value)} className="input-field text-xs" placeholder="Добавить село/деревню вручную" />
                    <button type="button" onClick={addManualBirthVillage} className="btn-secondary text-xs px-2 py-1.5">Добавить</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Точка на карте (lat/lng)</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input value={form.birth_lat} onChange={(e) => setForm((f) => ({ ...f, birth_lat: e.target.value }))} className="input-field" placeholder="Широта" />
                    <input value={form.birth_lng} onChange={(e) => setForm((f) => ({ ...f, birth_lng: e.target.value }))} className="input-field" placeholder="Долгота" />
                  </div>
                  {form.birth_lat && form.birth_lng && (
                    <a
                      className="text-xs text-indigo-600 hover:underline mt-2 inline-block"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(form.birth_lat)}&mlon=${encodeURIComponent(form.birth_lng)}#map=14/${encodeURIComponent(form.birth_lat)}/${encodeURIComponent(form.birth_lng)}`}
                    >
                      Открыть точку на карте
                    </a>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Город проживания</label>
                  <input
                    value={form.city_living}
                    onChange={(e) => setForm((f) => ({ ...f, city_living: e.target.value }))}
                    className="input-field mt-1"
                    list="city-living-options"
                    placeholder="Москва"
                  />
                  <datalist id="city-living-options">
                    {Object.values(COUNTRY_CITIES).flat().map((city) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Станция метро (скролл + ручное добавление)</label>
                  <select
                    value={form.metro_station}
                    onChange={(e) => setForm((f) => ({ ...f, metro_station: e.target.value }))}
                    className="input-field mt-1"
                  >
                    <option value="">Выберите станцию</option>
                    {metroOptions.map((station) => (
                      <option key={station} value={station}>{station}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={manualMetroDraft}
                      onChange={(e) => setManualMetroDraft(e.target.value)}
                      className="input-field text-xs"
                      placeholder="Добавить новую станцию вручную"
                    />
                    <button type="button" onClick={addManualMetroStation} className="btn-secondary text-xs px-2 py-1.5">
                      Добавить
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Желаемая должность</label>
                <div className="mt-1 rounded-xl border border-slate-200 p-2 space-y-2">
                  <input
                    value={professionSearchDraft}
                    onChange={(e) => setProfessionSearchDraft(e.target.value)}
                    className="input-field text-sm"
                    placeholder="Начните с буквы профессии..."
                  />
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {professionSuggestions.map((position) => (
                      <button
                        type="button"
                        key={position}
                        onClick={() => applyProfessionSuggestion(position)}
                        className="w-full text-left text-sm px-2 py-1 rounded hover:bg-slate-100"
                      >
                        {position}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {splitCsv(form.desired_positions).map((p) => (
                      <span key={p} className="bg-slate-100 text-slate-600 text-xs rounded-full px-2 py-1">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <input value={form.desired_position_custom} onChange={(e) => setForm((f) => ({ ...f, desired_position_custom: e.target.value }))}
                  className="input-field mt-2" placeholder="Другой вариант (проверяет менеджер)" />
                <datalist id="profession-hints">
                  {[...PROFESSION_OPTIONS, ...professionByDiplomas].map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              {activeQuestionnaires.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2">
                    <p className="text-xs font-semibold text-indigo-700">Дополнительные опросники по выбранной должности</p>
                    <p className="text-[11px] text-indigo-500 mt-0.5">Поля появляются автоматически. Можно выбирать из списка или заполнять вручную.</p>
                  </div>
                  {activeQuestionnaires.map((section) => (
                    <div key={section.position} className="rounded-xl border border-slate-200 bg-white">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-700">{section.title}</p>
                      </div>
                      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                        {section.questions.map((q) => (
                          <div key={q.id}>
                            <label className="text-xs text-slate-500">{q.label}</label>
                            {q.type === "select" ? (
                              <select
                                className="input-field mt-1"
                                value={questionnaireAnswers[q.id] ?? ""}
                                onChange={(e) => updateQuestionnaireAnswer(q.id, e.target.value)}
                              >
                                <option value="">Выберите</option>
                                {(q.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : q.type === "textarea" ? (
                              <textarea
                                rows={3}
                                className="input-field mt-1 resize-y"
                                value={questionnaireAnswers[q.id] ?? ""}
                                onChange={(e) => updateQuestionnaireAnswer(q.id, e.target.value)}
                                placeholder="Ответ в свободной форме"
                              />
                            ) : (
                              <input
                                className="input-field mt-1"
                                value={questionnaireAnswers[q.id] ?? ""}
                                onChange={(e) => updateQuestionnaireAnswer(q.id, e.target.value)}
                                placeholder="Введите ответ"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Образование и квалификация</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Учебные заведения</p>
                  <button type="button" className="text-xs text-brand-navy hover:underline" onClick={addEducation}>+ Добавить место обучения</button>
                </div>
                {educations.length === 0 ? (
                  <p className="text-xs text-slate-400">Не добавлено.</p>
                ) : (
                  educations.map((ed, idx) => {
                    const country = ed.country || "Россия";
                    const institutions = Array.from(
                      new Set([
                        ...(EDUCATION_INSTITUTIONS[country]?.[ed.city] ?? []),
                        ...(dynamicInstitutionMap[country]?.[ed.city] ?? []),
                      ])
                    );
                    return (
                      <div key={`edu-${idx}`} className="rounded-lg border border-slate-200 p-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select className="input-field" value={ed.country} onChange={(e) => updateEducation(idx, { country: e.target.value, city: "", institution_name: "" })}>
                            {Object.keys(COUNTRY_CITIES).map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input
                            list={`edu-cities-${idx}`}
                            className="input-field"
                            value={ed.city}
                            onChange={(e) => updateEducation(idx, { city: e.target.value })}
                            placeholder="Город"
                          />
                          <datalist id={`edu-cities-${idx}`}>
                            {(COUNTRY_CITIES[country] ?? []).map((city) => <option key={city} value={city} />)}
                          </datalist>
                          <select className="input-field" value={ed.institution_type} onChange={(e) => updateEducation(idx, { institution_type: e.target.value })}>
                            <option value="">Тип заведения</option>
                            {EDUCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input
                            list={`edu-inst-${idx}`}
                            className="input-field"
                            value={ed.institution_name}
                            onChange={(e) => updateEducation(idx, { institution_name: e.target.value })}
                            placeholder="Название (можно вручную)"
                          />
                          <datalist id={`edu-inst-${idx}`}>
                            {institutions.map((name) => <option key={name} value={name} />)}
                          </datalist>
                          <input
                            list="profession-hints"
                            className="input-field"
                            value={ed.diploma_profession}
                            onChange={(e) => updateEducation(idx, { diploma_profession: e.target.value })}
                            placeholder="Профессия по диплому"
                          />
                          <input
                            className="input-field"
                            type="number"
                            min="1950"
                            max={new Date().getFullYear() + 10}
                            value={ed.graduation_year}
                            onChange={(e) => updateEducation(idx, { graduation_year: e.target.value })}
                            placeholder="Год окончания"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="btn-secondary text-xs py-1.5 px-2 cursor-pointer">
                            Прикрепить диплом/документ
                            <input type="file" className="hidden" onChange={(e) => attachEducationDocument(idx, e.target.files?.[0] ?? null, "education")} />
                          </label>
                          {ed.diploma_file_name && <span className="text-xs text-slate-500">{ed.diploma_file_name}</span>}
                          <button type="button" className="text-xs text-red-500 hover:text-red-700 ml-auto" onClick={() => removeEducation(idx)}>Удалить</button>
                        </div>
                        <p className="text-[11px] text-slate-500">{educationWarning(ed)}</p>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Курсы и повышение квалификации</p>
                  <button type="button" className="text-xs text-brand-navy hover:underline" onClick={addCourse}>+ Добавить курс</button>
                </div>
                {courses.length === 0 ? (
                  <p className="text-xs text-slate-400">Не добавлено.</p>
                ) : (
                  courses.map((c, idx) => (
                    <div key={`course-${idx}`} className="rounded-lg border border-slate-200 p-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input-field" value={c.name} onChange={(e) => updateCourse(idx, { name: e.target.value })} placeholder="Название курса" />
                        <input className="input-field" type="date" value={c.completed_at} onChange={(e) => updateCourse(idx, { completed_at: e.target.value })} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="btn-secondary text-xs py-1.5 px-2 cursor-pointer">
                          Прикрепить документ
                          <input type="file" className="hidden" onChange={(e) => attachEducationDocument(idx, e.target.files?.[0] ?? null, "course")} />
                        </label>
                        {c.document_file_name && <span className="text-xs text-slate-500">{c.document_file_name}</span>}
                        <button type="button" className="text-xs text-red-500 hover:text-red-700 ml-auto" onClick={() => removeCourse(idx)}>Удалить</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Семья</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Гражданство</label>
                  <input value={form.citizenship} onChange={(e) => setForm((f) => ({ ...f, citizenship: e.target.value }))}
                    className="input-field mt-1" placeholder="Россия / Казахстан / другое" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Семейное положение</label>
                  <select value={form.marital_status} onChange={(e) => setForm((f) => ({ ...f, marital_status: e.target.value }))}
                    className="input-field mt-1">
                    {MARITAL_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s === "Не указано" ? "" : s}>{s}</option>
                    ))}
                  </select>
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={form.marital_status_hidden === "true"}
                      onChange={(e) => setForm((f) => ({ ...f, marital_status_hidden: e.target.checked ? "true" : "false" }))}
                    />
                    Скрыть семейный статус (решение HR)
                  </label>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Дети (пол и возраст)</p>
                  <button type="button" className="text-xs text-brand-navy hover:underline" onClick={addChild}>+ Добавить ребенка</button>
                </div>
                {children.length === 0 ? (
                  <p className="text-xs text-slate-400">Детей нет</p>
                ) : children.map((child, idx) => (
                  <div key={`${idx}-${child.gender}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <select className="input-field" value={child.gender} onChange={(e) => updateChild(idx, { gender: e.target.value as ChildItem["gender"] })}>
                      <option value="">Пол</option>
                      <option value="Мальчик">Мальчик</option>
                      <option value="Девочка">Девочка</option>
                    </select>
                    <input className="input-field" type="number" min="0" value={child.age} onChange={(e) => updateChild(idx, { age: e.target.value })} placeholder="Возраст" />
                    <button type="button" onClick={() => removeChild(idx)} className="text-xs text-red-500 hover:text-red-700">Удалить</button>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Здоровье и образ жизни</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Рост (см)</label>
                  <input value={form.height_cm} onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                    className="input-field mt-1" type="number" min="120" max="230" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Вес (кг)</label>
                  <input value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                    className="input-field mt-1" type="number" min="35" max="200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Домашние животные</label>
                  <input value={form.pets} onChange={(e) => setForm((f) => ({ ...f, pets: e.target.value }))}
                    className="input-field mt-1" placeholder="есть/нет, какие" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Аллергии</label>
                  <select value={form.allergies_has} onChange={(e) => setForm((f) => ({ ...f, allergies_has: e.target.value }))}
                    className="input-field mt-1">
                    <option value="Нет">Нет</option>
                    <option value="Да">Да</option>
                  </select>
                </div>
              </div>
              {form.allergies_has === "Да" && (
                <div>
                  <label className="text-xs text-slate-500">Какие аллергии</label>
                  <input value={form.allergies_details} onChange={(e) => setForm((f) => ({ ...f, allergies_details: e.target.value }))}
                    className="input-field mt-1" placeholder="Опишите аллергии" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-600">Спорт и активность</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["can_swim", "Плавание"],
                    ["can_roller", "Ролики"],
                    ["can_ski", "Лыжи"],
                    ["can_snowboard", "Сноуборд"],
                    ["can_bicycle", "Велосипед"],
                    ["can_scooter", "Самокат"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[key as keyof typeof form] === "Да"}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked ? "Да" : "Нет" }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-2 max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                  {EXTRA_SPORT_OPTIONS.map((sport) => (
                    <label key={sport} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={splitCsv(form.sports_selected).includes(sport)} onChange={() => toggleExtraSport(sport)} />
                      {sport}
                    </label>
                  ))}
                </div>
                <input value={form.sports_custom} onChange={(e) => setForm((f) => ({ ...f, sports_custom: e.target.value }))}
                  className="input-field mt-2" placeholder="Другие виды спорта (вручную)" />
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Условия работы и переезд</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Пищевые предпочтения</label>
                  <div className="mt-1 max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                    {DIET_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedDietOptions.includes(opt)}
                          onChange={() => setForm((f) => ({ ...f, diet_selected: toggleCsv(f.diet_selected, opt) }))}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    value={form.diet_custom}
                    onChange={(e) => setForm((f) => ({ ...f, diet_custom: e.target.value }))}
                    className="input-field mt-2"
                    placeholder="Дополнительно вручную"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Религия</label>
                  <select value={form.religion} onChange={(e) => setForm((f) => ({ ...f, religion: e.target.value }))}
                    className="input-field mt-1">
                    {RELIGION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value="Другое">Другое</option>
                  </select>
                  {(form.religion === "Другое" || form.religion_custom) && (
                    <input value={form.religion_custom} onChange={(e) => setForm((f) => ({ ...f, religion_custom: e.target.value }))}
                      className="input-field mt-2" placeholder="Уточните религию" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Переезд</label>
                  <select value={form.relocation_readiness} onChange={(e) => setForm((f) => ({ ...f, relocation_readiness: e.target.value }))}
                    className="input-field mt-1">
                    <option value="Не указано">Не указано</option>
                    <option value="Не готов(а) к переезду">Не готов(а) к переезду</option>
                    <option value="Готов(а) к переезду в другую страну">Готов(а) к переезду в другую страну</option>
                    <option value="Готов(а) переехать ближе к клиенту">Готов(а) переехать ближе к клиенту</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Командировки</label>
                  <select value={form.business_trips_readiness} onChange={(e) => setForm((f) => ({ ...f, business_trips_readiness: e.target.value }))}
                    className="input-field mt-1">
                    <option value="Не указано">Не указано</option>
                    <option value="Готов(а) к командировкам">Готов(а) к командировкам</option>
                    <option value="Не готов(а) к командировкам">Не готов(а) к командировкам</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Год начала опыта (авто расчёт)</label>
                  <input value={form.career_start_year} onChange={(e) => setForm((f) => ({ ...f, career_start_year: e.target.value }))}
                    className="input-field mt-1" type="number" min="1950" max={new Date().getFullYear()} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Опыт (лет)</label>
                  <input value={form.experience_years} onChange={(e) => setForm((f) => ({ ...f, experience_years: e.target.value }))}
                    type="number" min="0" className="input-field mt-1 disabled:bg-slate-100" disabled={form.experience_manual_override !== "true"} />
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <input type="checkbox" checked={form.experience_manual_override === "true"} onChange={(e) => setForm((f) => ({ ...f, experience_manual_override: e.target.checked ? "true" : "false" }))} />
                    HR: вручную исправить опыт
                  </label>
                </div>
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
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">Контакты и документы</p>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Контакты</p>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-field" placeholder="Телефон (+7…)" />
                <input value={form.sos_phone} onChange={(e) => setForm((f) => ({ ...f, sos_phone: e.target.value }))}
                  className="input-field" placeholder="Второй номер SOS" />
                <input value={form.telegram} onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                  className="input-field" placeholder="Telegram (@username)" />
                <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  className="input-field" placeholder="WhatsApp (+7…)" />
                <input value={form.max_messenger} onChange={(e) => setForm((f) => ({ ...f, max_messenger: e.target.value }))}
                  className="input-field" placeholder="МАХ" />
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field" placeholder="Email" />
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Фактическое место проживания</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.actual_address_street} onChange={(e) => setForm((f) => ({ ...f, actual_address_street: e.target.value }))} className="input-field" placeholder="Улица" />
                    <input value={form.actual_address_house} onChange={(e) => setForm((f) => ({ ...f, actual_address_house: e.target.value }))} className="input-field" placeholder="Дом" />
                    <input value={form.actual_address_building} onChange={(e) => setForm((f) => ({ ...f, actual_address_building: e.target.value }))} className="input-field" placeholder="Корпус / дробь" />
                    <input value={form.actual_address_entrance_code} onChange={(e) => setForm((f) => ({ ...f, actual_address_entrance_code: e.target.value }))} className="input-field" placeholder="Код подъезда" />
                    <input value={form.actual_address_floor} onChange={(e) => setForm((f) => ({ ...f, actual_address_floor: e.target.value }))} className="input-field" placeholder="Этаж" />
                    <input value={form.actual_address_apartment} onChange={(e) => setForm((f) => ({ ...f, actual_address_apartment: e.target.value }))} className="input-field" placeholder="Квартира" />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Прописка (обязательно)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.registration_street} onChange={(e) => setForm((f) => ({ ...f, registration_street: e.target.value }))} className="input-field" placeholder="Улица *" />
                    <input value={form.registration_house} onChange={(e) => setForm((f) => ({ ...f, registration_house: e.target.value }))} className="input-field" placeholder="Дом *" />
                    <input value={form.registration_building} onChange={(e) => setForm((f) => ({ ...f, registration_building: e.target.value }))} className="input-field" placeholder="Корпус / дробь" />
                    <input value={form.registration_entrance_code} onChange={(e) => setForm((f) => ({ ...f, registration_entrance_code: e.target.value }))} className="input-field" placeholder="Код подъезда" />
                    <input value={form.registration_floor} onChange={(e) => setForm((f) => ({ ...f, registration_floor: e.target.value }))} className="input-field" placeholder="Этаж" />
                    <input value={form.registration_apartment} onChange={(e) => setForm((f) => ({ ...f, registration_apartment: e.target.value }))} className="input-field" placeholder="Квартира" />
                  </div>
                </div>
                <input ref={passportPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoSelected(e, "passport")} />
                <button type="button" onClick={() => passportPhotoRef.current?.click()} className="btn-secondary text-sm py-2 px-3 w-fit">📎 Фото страницы паспорта *</button>
                {form.passport_page_photo_data_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.passport_page_photo_data_url} alt="Паспорт" className="w-24 h-16 rounded-lg object-cover border border-slate-200" />
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhotoSelected(e, "profile")} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => photoRef.current?.click()} className="btn-secondary text-sm py-2 px-3 w-fit">📎 Фото кандидата</button>
                  <button type="button" onClick={openCameraCapture} className="btn-secondary text-sm py-2 px-3 w-fit">
                    📷 Сфотографировать через сайт
                  </button>
                  <button type="button" onClick={requestAiPhotoStyle} className="btn-secondary text-sm py-2 px-3 w-fit">
                    🤖 AI: белая рубашка + фон логотипа
                  </button>
                </div>
                {form.photo_ai_style && (
                  <p className="text-[11px] text-indigo-600">
                    Запрос AI-стиля зафиксирован: {form.photo_ai_style}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500">Теги (через запятую)</label>
                <p className="text-[11px] text-slate-400 mt-1">Видно только HR внутри CRM, клиент и соискатель теги не видят.</p>
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
              <button onClick={onSave} disabled={formSaving || !form.full_name.trim() || !form.registration_street.trim() || !form.registration_house.trim() || !form.passport_page_photo_data_url.trim()}
                className="btn-primary text-sm py-2.5 px-4">
                {formSaving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Сделайте фото кандидата</h3>
            <video ref={cameraVideoRef} autoPlay playsInline className="w-full rounded-xl border border-slate-200 bg-black" />
            <canvas ref={cameraCanvasRef} className="hidden" />
            <div className="mt-3 flex gap-2 justify-end">
              <button type="button" onClick={closeCameraCapture} className="btn-secondary text-sm py-2 px-3">Отмена</button>
              <button type="button" onClick={takePhotoFromCamera} className="btn-primary text-sm py-2 px-3">Сфотографировать</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Interview modal */}
      {showAiInterview && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowAiInterview(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold text-slate-900">AI-анкетирование по профессии</h2>
              <button onClick={() => setShowAiInterview(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <input className="input-field" placeholder="Профессия (например: няня)" value={aiForm.profession} onChange={(e) => setAiForm((f) => ({ ...f, profession: e.target.value }))} />
              <input className="input-field" placeholder="ФИО кандидата" value={aiForm.candidate_name} onChange={(e) => setAiForm((f) => ({ ...f, candidate_name: e.target.value }))} />
              <textarea
                rows={8}
                className="input-field resize-y"
                placeholder={"Вставьте ответы в формате:\nВозраст: 34\nОпыт: 7 лет\nЗарплата: 180000-220000\nГрафик: 5/2"}
                value={aiForm.answersText}
                onChange={(e) => setAiForm((f) => ({ ...f, answersText: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-2">
                <input className="input-field" placeholder="Telegram" value={aiForm.telegram} onChange={(e) => setAiForm((f) => ({ ...f, telegram: e.target.value }))} />
                <input className="input-field" placeholder="WhatsApp" value={aiForm.whatsapp} onChange={(e) => setAiForm((f) => ({ ...f, whatsapp: e.target.value }))} />
                <input className="input-field" placeholder="Email" value={aiForm.email} onChange={(e) => setAiForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowAiInterview(false)} className="btn-secondary text-sm py-2.5 px-4">Отмена</button>
              <button onClick={onCreateByAiInterview} disabled={aiSaving} className="btn-primary text-sm py-2.5 px-4">
                {aiSaving ? "Создание..." : "Создать резюме"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
