"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabase-browser";

type Step = 0 | 1 | 2;

type GoalOption =
  | "process_emotions"
  | "build_consistency"
  | "understand_patterns";

type MoodOption =
  | "gentle"
  | "balanced"
  | "direct";

type NotificationOption =
  | "yes"
  | "not_now";

const goalOptions: {
  value: GoalOption;
  title: string;
  description: string;
}[] = [
  {
    value: "process_emotions",
    title: "Process emotions",
    description:
      "Use MindLog as a calm space to unpack what you’re feeling.",
  },
  {
    value: "build_consistency",
    title: "Build consistency",
    description:
      "Create a simple reflective habit you can return to regularly.",
  },
  {
    value: "understand_patterns",
    title: "Understand patterns",
    description:
      "Notice emotional themes, repeating triggers, and inner shifts over time.",
  },
];

const moodOptions: {
  value: MoodOption;
  title: string;
  description: string;
}[] = [
  {
    value: "gentle",
    title: "Gentle",
    description:
      "Softer reflective prompts and calmer conversational tone.",
  },
  {
    value: "balanced",
    title: "Balanced",
    description:
      "A neutral middle ground between support and clarity.",
  },
  {
    value: "direct",
    title: "Direct",
    description:
      "A slightly clearer, more focused reflective style.",
  },
];

const notificationOptions: {
  value: NotificationOption;
  title: string;
  description: string;
}[] = [
  {
    value: "yes",
    title: "Yes, later",
    description:
      "You’d like gentle reminders once notification settings exist.",
  },
  {
    value: "not_now",
    title: "Not now",
    description:
      "You want to keep the experience quiet for now.",
  },
];

export default function WelcomePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [goal, setGoal] = useState<GoalOption | null>(null);
  const [moodPreference, setMoodPreference] =
    useState<MoodOption | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationOption | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (user?.user_metadata?.onboarding_completed) {
        router.replace("/chat");
        return;
      }

      setGoal(
        (user?.user_metadata?.onboarding_goal as GoalOption) ??
          null
      );
      setMoodPreference(
        (user?.user_metadata
          ?.onboarding_mood_preference as MoodOption) ?? null
      );
      setNotifications(
        (user?.user_metadata
          ?.onboarding_notifications as NotificationOption) ??
          null
      );

      setLoading(false);
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  const starterTemplate = useMemo(() => {
    switch (goal) {
      case "process_emotions":
        return "I want to talk through what I’ve been feeling lately, because something feels emotionally heavy and I want to understand it more clearly.";
      case "build_consistency":
        return "I want to start a simple reflection habit, so help me begin with a calm check-in about how today has felt.";
      case "understand_patterns":
        return "I want to understand my recurring emotional patterns better, especially what keeps showing up in my thoughts and reactions.";
      default:
        return "I want to start reflecting, but I’m not fully sure where to begin yet.";
    }
  }, [goal]);

  async function handleComplete() {
    if (!goal || !moodPreference || !notifications || saving) {
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          onboarding_goal: goal,
          onboarding_mood_preference: moodPreference,
          onboarding_notifications: notifications,
          onboarding_completed_at: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      router.push(
        `/chat?starter=${encodeURIComponent(starterTemplate)}`
      );
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to complete onboarding");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving) return;

    try {
      setSaving(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          onboarding_goal: goal,
          onboarding_mood_preference: moodPreference,
          onboarding_notifications: notifications,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_skipped: true,
        },
      });

      if (error) {
        throw error;
      }

      router.push("/chat");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to skip onboarding");
    } finally {
      setSaving(false);
    }
  }

  const canContinue =
    (step === 0 && Boolean(goal)) ||
    (step === 1 && Boolean(moodPreference)) ||
    (step === 2 && Boolean(notifications));

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pt-12 pb-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Welcome to MindLog
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                A short setup to personalize your first reflection.
              </div>
            </div>

            <button
              onClick={handleSkip}
              disabled={saving}
              className="text-sm text-neutral-400 transition hover:text-white disabled:opacity-50"
            >
              Skip
            </button>
          </div>

          <div className="mt-8 flex items-center gap-2">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition ${
                  index <= step
                    ? "bg-white"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>

          <div className="flex flex-1 items-center">
            <div className="w-full">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8">
                  <div className="h-5 w-40 animate-pulse rounded-full bg-white/[0.08]" />
                  <div className="mt-4 h-10 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
                  <div className="mt-8 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8">
                  {step === 0 && (
                    <>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                        Step 1
                      </div>

                      <h1 className="mt-4 text-3xl font-semibold text-white">
                        What are you here for?
                      </h1>

                      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                        Pick the direction that feels closest to what
                        you want from MindLog right now.
                      </p>

                      <div className="mt-8 space-y-3">
                        {goalOptions.map((option) => {
                          const selected = goal === option.value;

                          return (
                            <button
                              key={option.value}
                              onClick={() => setGoal(option.value)}
                              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                selected
                                  ? "border-white/20 bg-white/[0.08]"
                                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="text-sm font-medium text-white">
                                {option.title}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                        Step 2
                      </div>

                      <h1 className="mt-4 text-3xl font-semibold text-white">
                        What tone do you prefer?
                      </h1>

                      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                        This helps shape the feeling of your first
                        reflective session.
                      </p>

                      <div className="mt-8 space-y-3">
                        {moodOptions.map((option) => {
                          const selected =
                            moodPreference === option.value;

                          return (
                            <button
                              key={option.value}
                              onClick={() =>
                                setMoodPreference(option.value)
                              }
                              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                selected
                                  ? "border-white/20 bg-white/[0.08]"
                                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="text-sm font-medium text-white">
                                {option.title}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                        Step 3
                      </div>

                      <h1 className="mt-4 text-3xl font-semibold text-white">
                        Would reminders help later?
                      </h1>

                      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                        This won’t send anything yet — it just helps us
                        understand whether reminders would be useful for
                        you later on.
                      </p>

                      <div className="mt-8 space-y-3">
                        {notificationOptions.map((option) => {
                          const selected =
                            notifications === option.value;

                          return (
                            <button
                              key={option.value}
                              onClick={() =>
                                setNotifications(option.value)
                              }
                              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                selected
                                  ? "border-white/20 bg-white/[0.08]"
                                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="text-sm font-medium text-white">
                                {option.title}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
                        <div className="text-sm font-medium text-white">
                          Your first conversation starter
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                          {starterTemplate}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {!loading && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                onClick={() =>
                  setStep((prev) =>
                    Math.max(0, prev - 1) as Step
                  )
                }
                disabled={step === 0 || saving}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:opacity-40"
              >
                Back
              </button>

              {step < 2 ? (
                <button
                  onClick={() =>
                    setStep((prev) =>
                      Math.min(2, prev + 1) as Step
                    )
                  }
                  disabled={!canContinue || saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={!canContinue || saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
                >
                  {saving
                    ? "Finishing..."
                    : "Start first reflection"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  );
}