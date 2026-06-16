import type { Metadata } from "next";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LuxurySegmentPage from "@/components/LuxurySegmentPage";

export const metadata: Metadata = {
  title: "GoodPeople — Private Staff Recruitment for HNW Families & Family Offices",
  description:
    "Конфиденциальный подбор частного персонала для HNW и UHNW семей, private residences, family office, вилл и международного образа жизни. Vetted candidates, discreet search, worldwide placements.",
  keywords: [
    "подбор домашнего персонала премиум",
    "подбор персонала для HNW семьи",
    "private staff recruitment",
    "luxury private staffing agency",
    "family office staffing",
    "estate manager recruitment",
    "house manager",
    "private chef recruitment",
    "nanny for UHNW family",
    "конфиденциальный подбор персонала",
  ],
  alternates: {
    canonical: "/luxury",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "GoodPeople Private Staff Recruitment",
  provider: {
    "@type": "Organization",
    name: "GoodPeople Agency",
    url: "https://goodpeople.agency",
  },
  serviceType: "Confidential private staff recruitment",
  areaServed: ["Russia", "Europe", "United Arab Emirates", "United Kingdom", "Switzerland", "Worldwide"],
  audience: {
    "@type": "Audience",
    audienceType: "HNW families, UHNW families, family offices, private residences",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Private household staffing roles",
    itemListElement: [
      "Estate manager",
      "House manager",
      "Private chef",
      "Nanny",
      "Governess",
      "Executive housekeeper",
      "Chauffeur",
      "Personal assistant",
      "Domestic couple",
    ].map((name) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name,
      },
    })),
  },
};

export default function LuxuryPage() {
  return (
    <>
      <Header />
      <LuxurySegmentPage />
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
