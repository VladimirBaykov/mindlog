// src/lib/prompts/stateOverlay.ts

import type { ChatState } from "@/types/chatState";

export function getStateOverlay(state: ChatState): string {
  switch (state) {
    case "listening":
      return `
Right now, your role is mostly to listen.
Keep responses minimal, reflective, and open.
Do not rush to comfort or reframe.
`;

    case "support":
      return `
The user is emotionally open or venting.
Be warmer and more supportive.
Acknowledge feelings gently.
Do not overwhelm with words.
`;

    case "calm_presence":
      return `
Maintain a calm, grounded presence.
Respond clearly but softly.
No urgency. No pressure.
`;

    case "silence":
      return `
The moment calls for quiet.
Short responses are welcome.
Pauses and space are allowed.
`;

    case "boundary":
      return `
Maintain gentle emotional boundaries.
Stay kind, calm, and respectful.
Do not encourage dependency.
`;

    case "closure":
      return `
This moment feels complete.
Help the conversation land softly.
Do not open new emotional threads.
`;

    default:
      return ``;
  }
}
