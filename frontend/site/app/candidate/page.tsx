"use client";

import { useEffect } from "react";
import { getMe, logout } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function CandidateCabinetPage() {
  const router = useRouter();

  useEffect(() => {
    getMe().then((me) => {
      if (!me) router.push("/login");
      else if (me.role !== "candidate") router.push("/crm");
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Кабинет соискателя</h1>
            <p className="text-sm text-slate-500">Раздел в разработке. Ссылки на встречи вы будете получать в ваш канал связи.</p>
          </div>
          <button onClick={async () => { await logout(); router.push("/login"); }} className="btn-secondary text-sm py-2 px-3">
            Выйти
          </button>
        </div>
      </header>
    </div>
  );
}
