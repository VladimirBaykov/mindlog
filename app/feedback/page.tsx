import Link from "next/link";

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/profile"
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            ← Back to profile
          </Link>

          <div className="text-sm text-neutral-500">MindLog</div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
              Early feedback
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-white">
              Feedback collection
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
              This page is a simple placeholder for early-user feedback
              collection. Before launch, replace the placeholder links below
              with your real Typeform, Google Form, Tally, or other feedback
              channel.
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-6 py-6">
            <div className="text-sm font-medium text-white">
              Replace these placeholders before launch
            </div>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                Feedback form URL:
                <span className="ml-2 text-white">
                  https://your-form-link.example
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                Feedback email:
                <span className="ml-2 text-white">
                  feedback@mindlog.app
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              What to ask first users
            </h2>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                1. What felt immediately clear or valuable?
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                2. Where did you hesitate, get confused, or stop?
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                3. Did saving the conversation feel meaningful?
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                4. Did stats and premium features feel understandable?
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                5. Would you come back tomorrow to use this again?
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              Suggested launch approach
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Start with a very small number of users, watch the core flow,
              and collect concrete feedback before trying to scale feature
              scope or traffic.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}