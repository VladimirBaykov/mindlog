export type JournalSession = {
  id: string;
  createdAt: number;
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
  reflection?: string;
  finalState: "closure" | "boundary" | "silence" | "empty";
};
