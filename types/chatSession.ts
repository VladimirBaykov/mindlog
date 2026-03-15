import type { ChatMessage } from "./chat";
import type { ChatState } from "./chatState";

export type ChatSession = {
  id: string;
  startedAt: number;
  endedAt: number;
  messages: ChatMessage[];
  finalState: ChatState;
};
