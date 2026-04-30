"use client";

import Link from "next/link";

export default function ChatSidebar() {
  return (
    <aside className="fixed right-4 bottom-4 z-20">
      <Link
        href="/crm/notifications"
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 transition"
      >
        <span>💬</span>
        <span>Чат</span>
      </Link>
    </aside>
  );
}
