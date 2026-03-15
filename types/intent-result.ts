// src/types/intent-result.ts

import type { Intent } from "./intent";

export interface IntentResult {
  intent: Intent;
  confidence: number; // 0–1
}
