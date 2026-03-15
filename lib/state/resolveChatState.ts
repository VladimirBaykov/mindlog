// lib/state/resolveChatState.ts
import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";

export function resolveChatState(intent: string, messages: ChatMessage[]): ChatState {
  // заглушка: всегда calm_presence
  return "calm_presence";
}
