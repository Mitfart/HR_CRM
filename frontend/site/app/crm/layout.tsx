import ChatSidebar from "@/components/ChatSidebar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatSidebar />
    </>
  );
}
