import { Conversation } from "./types";

const conversations = new Map<string, Conversation>();

export function getConversation(id: string) {
  return conversations.get(id);
}

export function saveConversation(conversation: Conversation) {
  conversations.set(conversation.id, conversation);
}

export function getClosedConversations() {
  return Array.from(conversations.values()).filter(
    c => c.closedAt !== null
  );
}
