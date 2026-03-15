// lib/intent/detectIntent.ts
import type { ChatMessage } from "@/types/chat";

export function detectIntent(messages: ChatMessage[]): string {
  // пока просто возвращаем "default"
  // позже сюда можно вставить анализ сообщений
  return "default";
}
