import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoodPeople Agency — Подбор домашнего персонала в Москве",
  description:
    "Профессиональный подбор домашнего персонала: няни, домработницы, водители, повара, гувернантки и VIP-сервис. Опыт, образование, рекомендации.",
  keywords: "подбор персонала, няня, домработница, кадровое агентство, Москва",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
