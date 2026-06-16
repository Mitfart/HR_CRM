import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoodPeople Agency — конфиденциальный подбор private staff по всему миру",
  description:
    "Премиальный подбор домашнего, семейного и private staff персонала: няни, гувернантки, домработницы, повара, водители, управляющие, ассистенты и команды для резиденций.",
  keywords: "private staff, домашний персонал, няня, гувернантка, домработница, family office, подбор персонала, Москва, Дубай, Европа",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
