"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mic, Square } from "lucide-react";
import { ROLE_HOME, type UserRole } from "@/lib/auth";

const REMEMBER_KEY = "crm.remember_login";
const LAST_LOGIN_KEY = "crm.last_login";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const maybeCtor = (window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }).SpeechRecognition
    ?? (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
  return maybeCtor ?? null;
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [listeningField, setListeningField] = useState<"email" | "password" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rememberEnabled = window.localStorage.getItem(REMEMBER_KEY) === "1";
    setRememberLogin(rememberEnabled);
    if (!rememberEnabled) return;

    const raw = window.localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { email?: string; password?: string };
      setEmail(parsed.email ?? "");
      setPassword(parsed.password ?? "");
    } catch {
      window.localStorage.removeItem(LAST_LOGIN_KEY);
    }
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "Неверный email или пароль");
        return;
      }

      if (rememberLogin && typeof window !== "undefined") {
        window.localStorage.setItem(REMEMBER_KEY, "1");
        window.localStorage.setItem(
          LAST_LOGIN_KEY,
          JSON.stringify({ email: normalizedEmail, password }),
        );
      } else if (typeof window !== "undefined") {
        window.localStorage.removeItem(REMEMBER_KEY);
        window.localStorage.removeItem(LAST_LOGIN_KEY);
      }

      // Decode role from JWT to redirect correctly
      const payload = JSON.parse(atob(data.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const role = payload.role as UserRole;
      router.push(ROLE_HOME[role] ?? "/");
    } catch {
      setError("Ошибка соединения с сервером. Проверьте, что backend запущен на порту 8000.");
    } finally {
      setLoading(false);
    }
  }

  function startVoiceInput(field: "email" | "password") {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setError("Голосовой ввод не поддерживается в этом браузере.");
      return;
    }
    setError("");
    const recognition = new RecognitionCtor();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    setListeningField(field);
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      if (field === "email") {
        const normalized = transcript
          .replace(/\s+/g, "")
          .replace(/собака/gi, "@")
          .replace(/точка/gi, ".");
        setEmail(normalized.toLowerCase());
      } else {
        setPassword(transcript);
      }
    };
    recognition.onerror = () => {
      setError("Не удалось распознать голос. Разрешите доступ к микрофону и попробуйте снова.");
      setListeningField(null);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListeningField(null);
      recognitionRef.current = null;
    };
    recognition.start();
  }

  function VoiceButton({ field }: { field: "email" | "password" }) {
    const active = listeningField === field;
    return (
      <button
        type="button"
        onClick={() => {
          if (active) {
            recognitionRef.current?.stop();
            setListeningField(null);
            return;
          }
          startVoiceInput(field);
        }}
        className="absolute inset-y-0 right-3 inline-flex items-center text-slate-500 hover:text-slate-700"
        aria-label={active ? "Идет запись голоса" : "Надиктовать значение"}
        title={active ? "Идет запись..." : "Надиктовать"}
      >
        {active ? <Square size={16} className="text-red-500" /> : <Mic size={16} />}
      </button>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Вход в систему</h1>
        <p className="text-sm text-slate-500 mb-6">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-brand-navy hover:underline font-medium">
            Зарегистрироваться
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pr-10"
                placeholder="you@example.com"
              />
              <VoiceButton field="email" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-20"
                placeholder="••••••••"
              />
              <div className="absolute inset-y-0 right-10 flex items-center">
                <VoiceButton field="password" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 inline-flex items-center text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-navy focus:ring-brand-navy"
            />
            Запомнить вход
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
