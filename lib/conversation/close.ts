import { getConversation, saveConversation } from "./store";

export function closeConversation(
  id: string,
  summary: string
) {
  const convo = getConversation(id);
  if (!convo) return;

  convo.closedAt = Date.now();
  convo.summary = summary;

  saveConversation(convo);
}
