"use client";

import { useEffect, useState } from "react";
import CrmNav from "@/components/CrmNav";

type ScriptStep = {
  step: number;
  question: string;
};

export default function BotScriptsPage() {
  const [steps, setSteps] = useState<ScriptStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadScripts() {
    setLoading(true);
    try {
      const res = await fetch("/api/bot/scripts", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setSteps(await res.json());
    } catch {
      setError("Не удалось загрузить скрипты");
    } finally {
      setLoading(false);
    }
  }

  async function saveScripts() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/bot/scripts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(steps),
      });
      if (!res.ok) throw new Error("save failed");
      setSuccess("Скрипты сохранены успешно");
    } catch {
      setError("Не удалось сохранить скрипты");
    } finally {
      setSaving(false);
    }
  }

  function updateStep(index: number, question: string) {
    setSteps((prev) => prev.map((s, i) => i === index ? { ...s, question } : s));
  }

  function addStep() {
    setSteps((prev) => [...prev, { step: prev.length + 1, question: "" }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 })));
  }

  function moveStep(index: number, dir: "up" | "down") {
    setSteps((prev) => {
      const next = [...prev];
      const targetIndex = dir === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((s, i) => ({ ...s, step: i + 1 }));
    });
  }

  useEffect(() => { loadScripts(); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Скрипты бота" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">{success}</div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Цепочка вопросов бота</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Вопросы задаются клиенту последовательно при получении заявки
              </p>
            </div>
            <button onClick={saveScripts} disabled={saving} className="btn-primary py-2 px-5 text-sm">
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex flex-col gap-1 mt-1">
                    <button onClick={() => moveStep(index, "up")} disabled={index === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => moveStep(index, "down")} disabled={index === steps.length - 1}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs leading-none">▼</button>
                  </div>
                  <span className="text-xs font-bold text-slate-500 mt-2.5 w-5 text-center">{step.step}</span>
                  <textarea
                    value={step.question}
                    onChange={(e) => updateStep(index, e.target.value)}
                    rows={2}
                    className="flex-1 input-field resize-none text-sm"
                    placeholder="Текст вопроса..."
                  />
                  <button onClick={() => removeStep(index)} className="mt-1 text-red-400 hover:text-red-600 text-sm px-1 transition">✕</button>
                </div>
              ))}

              <button onClick={addStep} className="w-full btn-secondary text-sm py-2.5 border-dashed">
                + Добавить вопрос
              </button>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-2">Как работает бот</h2>
          <div className="text-sm text-slate-600 space-y-1.5">
            <p>1. Клиент заполняет форму на сайте → заявка создаётся в CRM</p>
            <p>2. Бот немедленно пишет клиенту в указанный канал (Telegram / WhatsApp / MAX / Email)</p>
            <p>3. Бот задаёт уточняющие вопросы из цепочки выше</p>
            <p>4. Бот предлагает клиенту выбрать время собеседования из свободных слотов</p>
            <p>5. После подтверждения слот блокируется и менеджер получает уведомление</p>
            <p>6. За 1 час до созвона бот отправляет напоминание с ссылкой на видеовстречу</p>
          </div>
        </section>
      </main>
    </div>
  );
}
