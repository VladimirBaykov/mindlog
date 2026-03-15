import OpenAI from "openai";

export default function createJournalClassifier(client) {
  return {
    async classify(text) {
      try {
        const response = await client.responses.create({
          model: "gpt-5-mini",
          input: [
            {
              role: "system",
              content: `
You are MindLog — a soft, emotionally aware journal classifier.
Your role is to gently interpret the emotional tone of the user's entry.
You do not judge, instruct, fix, or guide. You simply notice and reflect.

Vibe:
- warm, gentle, slow, human-like  
- emotionally observant  
- soft pastel calmness  
- never clinical, never moralizing  
- quiet presence, not a therapist  

Task:
Analyze the journal entry and produce STRICT JSON with the exact structure:

{
  "primary": "joy | calm | sadness | anxiety | stress | anger | tiredness | confusion | loneliness | emptiness",
  "secondary": ["emotion1", "emotion2"],
  "nuances": "short gentle nuance in 3–7 words",
  "intensity": 0-100,
  "emoji": "🙂|😐|😔|😩|😄|😌|😠",
  "summary": "2–3 warm sentences describing the emotional tone (not repeating the user's text)",
  "suggestion": "one soft open-ended question"
}

Rules:
- ALWAYS return valid JSON only.
- "primary" = the strongest emotional theme.
- "secondary" = 0–2 softer supporting emotions.
- "nuances" must be subtle and human.
- "intensity" is emotional strength (0–100).
- "summary" must not repeat or restate the user's text.
- No advice, no instructions, no therapy wording.
- "suggestion" must be a single gentle open-ended question.
- Keep everything warm, quiet, and human.

This classifier reflects emotional color, not events or facts.
              `,
            },
            { role: "user", content: text },
          ],

          text: { format: { type: "json_object" } },
        });

        const json =
          response?.output?.[0]?.content?.[0]?.json_value ||
          JSON.parse(response?.output_text || "{}");

        return sanitize(json);
      } catch (err) {
        console.error("[JOURNAL CLASSIFIER ERROR]", err);

        return {
          primary: "calm",
          secondary: [],
          nuances: "soft neutral tone",
          intensity: 20,
          emoji: "😐",
          summary:
            "This entry feels quiet and steady.",
          suggestion: "Would you like to explore this feeling a bit more?",
        };
      }
    },
  };
}

// -----------------------------------------
// Sanitize & Fallback Logic
// -----------------------------------------
function sanitize(json) {
  if (!json || typeof json !== "object") {
    return fallback();
  }

  return {
    primary: json.primary || "calm",
    secondary: Array.isArray(json.secondary) ? json.secondary : [],
    nuances: json.nuances || "gentle neutral feeling",
    intensity: clamp(json.intensity, 0, 100),
    emoji: json.emoji || "😐",
    summary:
      json.summary ||
      "This entry carries a quiet, steady tone.",
    suggestion:
      json.suggestion ||
      "What would you like to explore about this feeling?",
  };
}

function clamp(num, min, max) {
  if (typeof num !== "number") return min;
  return Math.max(min, Math.min(max, num));
}

function fallback() {
  return {
    primary: "calm",
    secondary: [],
    nuances: "neutral quiet tone",
    intensity: 20,
    emoji: "😐",
    summary:
      "This entry feels soft and even.",
    suggestion: "Would you like to share a little more?",
  };
}
