export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Conversation = {
  id: string;
  createdAt: number;
  closedAt: number | null;
  summary: string;
  messages: Message[];
};
