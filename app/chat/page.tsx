"use client";

import AuthGate from "@/components/AuthGate";
import Chat from "@/components/Chat";

export default function ChatPage() {
  return (
    <AuthGate>
      <Chat />
    </AuthGate>
  );
}