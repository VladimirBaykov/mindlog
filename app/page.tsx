// app/page.tsx

import Chat from "@/components/Chat"
import AuthGate from "@/components/AuthGate"

export default function Home() {
  return (
    <AuthGate>
      <main className="h-screen bg-black text-white">
        <Chat />
      </main>
    </AuthGate>
  )
}