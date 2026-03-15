// src/lib/state/intentToState.ts

import type { ChatState } from "@/types/chatState";

export function intentToState(intent: string): ChatState {
  switch (intent) {
    case "share":
    case "reflect":
      return "listening";

    case "vent":
      return "support";

    case "question":
      return "calm_presence";

    case "silence":
      return "silence";

    case "boundary":
      return "boundary";

    default:
      return "listening";
  }
}
