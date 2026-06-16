"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "client" | "candidate";

const ROLE_LABELS: Record<Role, string> = {
  client: "Клиент — ищу персонал",
  candidate: "Соискатель — ищу работу",
};

const CAPTCHA_EMOJIS = ["🚀", "🌟", "🎯", "🧩", "🍀", "🎉"] as const;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("candidate");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePersonalData, setAgreePersonalData] = useState(false);
  const [captchaTarget, setCaptchaTarget] = useState<(typeof CAPTCHA_EMOJIS)[number]>("🚀");
  const [captchaOptions, setCaptchaOptions] = useState<string[]>(() => shuffle([...CAPTCHA_EMOJIS]));
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const captchaHint = useMemo(
    () => `Нажмите на эмодзи ${captchaTarget}, чтобы подтвердить, что вы не робот`,
    [captchaTarget],
  );

  function regenerateCaptcha() {
    const nextOptions = shuffle([...CAPTCHA_EMOJIS]);
    setCaptchaOptions(nextOptions);
    setCaptchaTarget(nextOptions[Math.floor(Math.random() * nextOptions.length)]);
    setCaptchaPassed(false);
  }

  function handleCaptchaPick(emoji: string) {
    if (emoji === captchaTarget) {
      setCaptchaPassed(true);
      setError("");
      return;
    }
    setCaptchaPassed(false);
    setError("Почти! Выберите эмодзи, который указан в задании капчи.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreeTerms || !agreePersonalData) {
      setError("Для регистрации необходимо принять условия пользования и согласие на обработку персональных данных.");
      return;
    }
    if (!captchaPassed) {
      setError("Подтвердите капчу перед регистрацией.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, phone, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Ошибка регистрации");
        return;
      }
      // Registration successful → redirect to login
      router.push("/login?registered=1");
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Регистрация</h1>
        <p className="text-sm text-slate-500 mb-6">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-brand-navy hover:underline font-medium">
            Войти
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Я регистрируюсь как</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-left ${
                    role === r
                      ? "border-brand-navy bg-brand-navy/5 text-brand-navy"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Полное имя</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Иван Иванов"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Номер телефона</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              placeholder="+7 (999) 123-45-67"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Минимум 8 символов"
            />
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Я согласен с условиями пользования</span>
              </label>
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer select-none text-slate-700 hover:text-brand-navy">
                  Показать условия пользования
                </summary>
                <div className="mt-2 space-y-1 leading-relaxed">
                  <p>Регистрируясь, вы подтверждаете, что предоставляете достоверные данные и используете сервис законно.</p>
                  <p>Вы несёте ответственность за сохранность доступа к аккаунту и действия, совершённые под вашей учётной записью.</p>
                  <p>Сервис может ограничить доступ при нарушении правил, мошеннических действиях или попытках несанкционированного доступа.</p>
                </div>
              </details>
            </div>

            <div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={agreePersonalData}
                  onChange={(e) => setAgreePersonalData(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
                />
                <span>Я согласен на обработку персональных данных</span>
              </label>
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer select-none text-slate-700 hover:text-brand-navy">
                  Показать согласие на обработку данных
                </summary>
                <div className="mt-2 space-y-1 leading-relaxed">
                  <p>Вы даёте согласие на сбор, хранение и обработку персональных данных для регистрации, авторизации и работы сервиса.</p>
                  <p>Данные могут использоваться для связи с вами, исполнения заявок и улучшения качества услуг в рамках законодательства.</p>
                  <p>Вы можете отозвать согласие, обратившись в поддержку; отзыв может ограничить возможность использования сервиса.</p>
                </div>
              </details>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">Быстрая капча</p>
              <button
                type="button"
                onClick={regenerateCaptcha}
                className="text-xs font-medium text-brand-navy hover:underline"
              >
                Обновить
              </button>
            </div>
            <p className="text-sm text-slate-700 mb-3">{captchaHint}</p>
            <div className="grid grid-cols-3 gap-2">
              {captchaOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleCaptchaPick(emoji)}
                  className={`rounded-lg border bg-white px-3 py-2 text-xl transition ${
                    captchaPassed && emoji === captchaTarget
                      ? "border-emerald-400 ring-2 ring-emerald-200"
                      : "border-slate-200 hover:border-brand-navy/40"
                  }`}
                  aria-label={`Выбрать ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {captchaPassed && (
              <p className="mt-2 text-xs text-emerald-700">Отлично! Проверка пройдена.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Регистрация..." : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
