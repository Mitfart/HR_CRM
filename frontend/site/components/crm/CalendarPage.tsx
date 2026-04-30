"use client";

import { useEffect, useState } from "react";
import CrmNav from "@/components/CrmNav";
import clsx from "clsx";

type Slot = {
  id: string;
  manager_id: string;
  starts_at: string;
  ends_at: string;
  is_available: boolean;
  booked_by_application_id: string | null;
  video_service: string | null;
  video_link: string | null;
};

const VIDEO_SERVICE_LABELS: Record<string, string> = {
  tolk: "Толк",
  yandex: "Яндекс Телемост",
  most: "Мост",
};

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadSlots() {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/slots", { cache: "no-store" });
      if (!res.ok) throw new Error("Ошибка загрузки слотов");
      setSlots(await res.json());
    } catch {
      setError("Не удалось загрузить слоты календаря");
    } finally {
      setLoading(false);
    }
  }

  async function createSlot() {
    if (!newStartsAt || !newEndsAt) return;
    setCreating(true);
    try {
      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: newStartsAt, ends_at: newEndsAt }),
      });
      if (!res.ok) throw new Error("Не удалось создать слот");
      setNewStartsAt("");
      setNewEndsAt("");
      await loadSlots();
    } catch {
      setError("Ошибка при создании слота");
    } finally {
      setCreating(false);
    }
  }

  async function deleteSlot(slotId: string) {
    if (!confirm("Удалить этот слот?")) return;
    try {
      await fetch(`/api/calendar/slots/${slotId}`, { method: "DELETE" });
      await loadSlots();
    } catch {
      setError("Не удалось удалить слот");
    }
  }

  useEffect(() => { loadSlots(); }, []);

  const available = slots.filter((s) => s.is_available);
  const booked = slots.filter((s) => !s.is_available);

  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Календарь" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Add new slot */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Добавить доступный слот</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Начало</label>
              <input
                type="datetime-local"
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Конец</label>
              <input
                type="datetime-local"
                value={newEndsAt}
                onChange={(e) => setNewEndsAt(e.target.value)}
                className="input-field"
              />
            </div>
            <button onClick={createSlot} disabled={creating || !newStartsAt || !newEndsAt} className="btn-primary py-2.5">
              {creating ? "Создание..." : "Добавить слот"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Бот автоматически предлагает клиентам доступные слоты при записи на собеседование.
          </p>
        </section>

        {loading ? (
          <p className="text-slate-500 text-sm">Загрузка...</p>
        ) : (
          <>
            {/* Available slots */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                Свободные слоты
                <span className="ml-2 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">{available.length}</span>
              </h2>
              {available.length === 0 ? (
                <p className="text-sm text-slate-500">Нет доступных слотов. Добавьте новые выше.</p>
              ) : (
                <div className="space-y-2">
                  {available.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {new Date(slot.starts_at).toLocaleString("ru-RU")} — {new Date(slot.ends_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <button onClick={() => deleteSlot(slot.id)} className="text-xs text-red-500 hover:text-red-700 transition px-2">
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Booked slots */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                Забронированные слоты
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{booked.length}</span>
              </h2>
              {booked.length === 0 ? (
                <p className="text-sm text-slate-500">Нет забронированных слотов.</p>
              ) : (
                <div className="space-y-2">
                  {booked.map((slot) => (
                    <div key={slot.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(slot.starts_at).toLocaleString("ru-RU")} — {new Date(slot.ends_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {slot.booked_by_application_id && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Заявка:{" "}
                          <a href={`/crm/applications/${slot.booked_by_application_id}`} className="text-indigo-600 hover:underline">
                            открыть
                          </a>
                        </p>
                      )}
                      {slot.video_link && (
                        <a href={slot.video_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-0.5 block">
                          🎥 {VIDEO_SERVICE_LABELS[slot.video_service ?? ""] ?? slot.video_service} — ссылка на встречу
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
