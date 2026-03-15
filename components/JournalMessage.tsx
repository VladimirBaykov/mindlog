import type { ChatMessage } from "@/types/chat";

export default function JournalMessage({
  message,
}: {
  message: ChatMessage;
}) {
  return (
    <div
      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${
          message.role === "user"
            ? "ml-auto bg-neutral-800 text-white"
            : "mr-auto bg-neutral-900 text-neutral-200"
        }`}
    >
      {message.content}
    </div>
  );
}
