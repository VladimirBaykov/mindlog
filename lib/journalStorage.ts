import type { JournalSession } from "@/types/journal";

const STORAGE_KEY = "mindlog:sessions";

export function getAllSessions(): JournalSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    return JSON.parse(raw) as JournalSession[];
  } catch {
    return [];
  }
}

export function getSessionById(id: string): JournalSession | null {
  const sessions = getAllSessions();
  return sessions.find((s) => s.id === id) || null;
}

export function saveSession(session: JournalSession) {
  const sessions = getAllSessions();

  const updated = [session, ...sessions.filter((s) => s.id !== session.id)];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteSession(id: string) {
  const sessions = getAllSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
