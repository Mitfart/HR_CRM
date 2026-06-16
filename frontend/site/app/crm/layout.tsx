import ChatSidebar from "@/components/ChatSidebar";
import GuideTooltipProvider from "@/components/crm/GuideTooltipProvider";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatSidebar />
      <GuideTooltipProvider />
    </>
  );
}
