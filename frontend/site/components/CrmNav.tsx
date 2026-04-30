"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, getMe } from "@/lib/auth";
import clsx from "clsx";

type NavItem = { href: string; label: string; icon: string; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/crm", label: "Заявки", icon: "📋", exact: true },
  { href: "/crm/candidates", label: "Соискатели", icon: "🔍" },
  { href: "/crm/calendar", label: "Календарь", icon: "📅" },
  { href: "/crm/contracts", label: "Договоры", icon: "📄" },
  { href: "/crm/notifications", label: "Уведомления", icon: "🔔" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/crm/bot-scripts", label: "Скрипты бота", icon: "🤖" },
  { href: "/crm/admin", label: "Настройки", icon: "⚙️" },
];

export default function CrmNav({ title }: { title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    getMe().then((u) => {
      if (u?.role === "admin") setIsAdmin(true);
    });
    fetch("/api/notifications?unread_only=true&limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: unknown[]) => setUnread(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 text-lg hidden sm:block">GoodPeople CRM</span>
            {title && <span className="text-slate-400 hidden sm:block">/</span>}
            {title && <span className="font-semibold text-slate-700">{title}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/crm/notifications" className="relative p-2 hover:bg-slate-100 rounded-lg transition">
              <span className="text-lg">🔔</span>
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button
              onClick={async () => { await logout(); router.push("/login"); }}
              className="text-sm text-slate-500 hover:text-slate-800 transition py-1.5 px-3"
            >
              Выйти
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-0 -mb-px scrollbar-none">
          {[...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive(item.href, item.exact)
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
