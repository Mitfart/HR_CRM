import CrmNav from "@/components/CrmNav";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <CrmNav title="Аналитика" />
      <main className="max-w-[1200px] mx-auto p-4 sm:p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">Аналитика</h1>
          <p className="mt-2 text-sm text-slate-600">
            Раздел аналитики в разработке. Здесь будут метрики по воронке, откликам и найму.
          </p>
        </div>
      </main>
    </div>
  );
}
