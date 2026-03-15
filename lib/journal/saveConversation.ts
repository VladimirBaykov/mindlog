import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  messages: Message[];
  mood?: string;
  title: string;
  highlights: string[];
  createdAt: number;
};

function generateTitle(messages: Message[]) {
  const firstUserMessage = messages.find(
    (m) => m.role === "user"
  )?.content;

  if (!firstUserMessage) return "Conversation";

  return firstUserMessage
    .split(" ")
    .slice(0, 7)
    .join(" ");
}

function generateHighlights(messages: Message[]) {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .slice(0, 2);
}

export function saveConversation({
  messages,
  mood = "neutral",
  summary,
}: {
  messages: Message[];
  mood?: string;
  summary?: string;
}) {
  const journalPath = path.join(process.cwd(), "data", "journal.json");

  const allConversations: Conversation[] = fs.existsSync(journalPath)
    ? JSON.parse(fs.readFileSync(journalPath, "utf-8"))
    : [];

  const newConversation: Conversation = {
    id: uuid(),
    messages,
    mood,
    title: summary || generateTitle(messages),
    highlights: generateHighlights(messages),
    createdAt: Date.now(),
  };

  allConversations.push(newConversation);

  fs.writeFileSync(
    journalPath,
    JSON.stringify(allConversations, null, 2),
    "utf-8"
  );

  return newConversation;
}
