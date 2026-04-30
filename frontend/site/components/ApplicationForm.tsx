"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send, CheckCircle2, Loader2, MessageCircle, Mail, Phone, AtSign } from "lucide-react";
import clsx from "clsx";

const schema = z
  .object({
    description: z.string().min(10, "Опишите потребность подробнее (мин. 10 символов)"),
    service_type: z.string().min(1, "Выберите тип услуги"),
    telegram_username: z.string().optional(),
    whatsapp_phone: z.string().optional(),
    max_contact: z.string().optional(),
    email: z.string().email("Некорректный email").optional().or(z.literal("")),
    consent: z.boolean().refine((v) => v, "Необходимо дать согласие"),
  })
  .refine(
    (d) =>
      d.telegram_username || d.whatsapp_phone || d.max_contact || d.email,
    {
      message: "Укажите хотя бы один способ связи",
      path: ["telegram_username"],
    }
  );

type FormData = z.infer<typeof schema>;

const SERVICE_TYPES = [
  "Няня для дошкольников",
  "Няня для грудничков",
  "Няня-носитель языка",
  "Гувернантка",
  "Домработница",
  "Водитель",
  "Семейная пара",
  "Семейный повар",
  "Сиделка",
  "Репетитор",
  "Помощник по хозяйству",
  "Садовник",
  "Ассистент",
  "Частная охрана",
  "Управляющий",
  "VIP-сервис",
  "Другое",
];

export default function ApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setServerError("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `[${data.service_type}] ${data.description}`,
          telegram_username: data.telegram_username || undefined,
          whatsapp_phone: data.whatsapp_phone || undefined,
          max_contact: data.max_contact || undefined,
          email: data.email || undefined,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сервера");
      setSubmitted(true);
    } catch {
      setServerError("Не удалось отправить заявку. Попробуйте позже или позвоните нам.");
    }
  }

  if (submitted) {
    return (
      <section id="form" className="py-20 bg-white">
        <div className="max-w-lg mx-auto px-4 text-center">
          <CheckCircle2 size={64} className="text-brand-green mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-brand-navy mb-4">
            Заявка принята!
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Мы уже пишем вам в указанные мессенджеры. Менеджер свяжется
            с&nbsp;вами в&nbsp;ближайшее время.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="form" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left info */}
          <div>
            <h2 className="section-title">Оставьте заявку</h2>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              Заполните форму — наш менеджер свяжется с вами в течение
              15 минут и подберёт идеального специалиста.
            </p>
            <ul className="space-y-4">
              {[
                { icon: MessageCircle, text: "Бот напишет вам сразу после отправки" },
                { icon: Phone, text: "Менеджер перезвонит в удобное время" },
                { icon: CheckCircle2, text: "Подбор начнётся в тот же день" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-brand-dark">
                  <div className="w-9 h-9 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-brand-navy" />
                  </div>
                  <span className="text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-brand-light rounded-3xl p-8 shadow-card"
          >
            {/* Service type */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Тип услуги *
              </label>
              <select
                {...register("service_type")}
                className={clsx("input-field", errors.service_type && "border-red-400 ring-1 ring-red-400")}
              >
                <option value="">— Выберите услугу —</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.service_type && (
                <p className="text-red-500 text-xs mt-1">{errors.service_type.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Опишите вашу потребность *
              </label>
              <textarea
                {...register("description")}
                rows={4}
                placeholder="Например: нужна няня для ребёнка 2 лет, пн–пт с 9 до 18, с опытом работы от 3 лет..."
                className={clsx("input-field resize-none", errors.description && "border-red-400 ring-1 ring-red-400")}
              />
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Contacts block */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-brand-dark mb-3">
                Способы связи{" "}
                <span className="text-gray-400 font-normal">(хотя бы один)</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                    <AtSign size={12} /> Telegram username
                  </label>
                  <input
                    {...register("telegram_username")}
                    placeholder="@username"
                    className={clsx("input-field", errors.telegram_username && "border-red-400")}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                    <MessageCircle size={12} /> WhatsApp
                  </label>
                  <input
                    {...register("whatsapp_phone")}
                    placeholder="+7 900 000-00-00"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                    <MessageCircle size={12} /> MAX (Mail.ru)
                  </label>
                  <input
                    {...register("max_contact")}
                    placeholder="номер или username"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                    <Mail size={12} /> Email
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="your@email.com"
                    className={clsx("input-field", errors.email && "border-red-400")}
                  />
                </div>
              </div>
              {errors.telegram_username?.message?.includes("хотя бы") && (
                <p className="text-red-500 text-xs mt-2">{errors.telegram_username.message}</p>
              )}
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Consent */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer group">
              <input
                {...register("consent")}
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-brand-navy shrink-0"
              />
              <span className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors">
                Я согласен(а) на обработку персональных данных в соответствии
                с&nbsp;политикой конфиденциальности
              </span>
            </label>
            {errors.consent && (
              <p className="text-red-500 text-xs -mt-4 mb-4">{errors.consent.message}</p>
            )}

            {serverError && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-xl px-4 py-3">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full text-base py-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Отправляем...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить заявку
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
