import Link from "next/link";
import { getLaunchConfigStatus } from "@/lib/public-config";

const checklist = [
  {
    title: "Core product flow",
    items: [
      "Sign up, sign in, logout",
      "Protected routes",
      "Chat → close → save to journal",
      "Journal list, detail, rename, delete",
    ],
  },
  {
    title: "Premium flow",
    items: [
      "Upgrade page opens real Stripe Checkout",
      "Billing success page confirms or waits for webhook sync",
      "Profile refresh plan status works",
      "Stripe portal opens correctly",
    ],
  },
  {
    title: "Pro gating",
    items: [
      "Weekly summary locked for free users",
      "AI insights locked for free users",
      "PDF export locked for free users",
      "Pro users see unlocked premium surfaces",
    ],
  },
  {
    title: "Launch basics",
    items: [
      "Privacy Policy is reachable",
      "Terms of Service is reachable",
      "Support page is reachable",
      "Real support emails are set in env",
      "Feedback channel is prepared",
    ],
  },
  {
    title: "Final QA",
    items: [
      "No critical console/server errors",
      "Loading states look intentional",
      "Back navigation feels correct",
      "Empty states and error states feel clean",
    ],
  },
];

function StatusBadge({
  ready,
  label,
}: {
  ready: boolean;
  label: string;
}) {
  return (
    <div
      className={`inline-flex rounded-full border px-3 py-1 text-xs ${
        ready
          ? "border-emerald-500/20 bg-emerald-500/10 text-neutral-100"
          : "border-amber-500/20 bg-amber-500/10 text-neutral-100"
      }`}
    >
      {label}
    </div>
  );
}

export default function LaunchChecklistPage() {
  const config = getLaunchConfigStatus();
  const publicConfigReady =
    config.supportEmailReady && config.billingSupportEmailReady;

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
              Launch checklist
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-white">
              First user readiness
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
              A compact checklist for moving MindLog from internal build
              to first real users.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <StatusBadge
                ready={publicConfigReady}
                label={
                  publicConfigReady
                    ? "Public config looks ready"
                    : "Public config still needs work"
                }
              />

              <Link
                href="/feedback"
                className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-200 transition hover:bg-white/[0.06]"
              >
                Open feedback prep
              </Link>
            </div>
          </div>

          {!publicConfigReady && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-6 py-6">
              <div className="text-sm font-medium text-white">
                Action needed before launch
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                One or more public support emails are still placeholder
                values. Update them in <span className="text-white">.env.local</span>{" "}
                before giving the product to real users.
              </p>
            </div>
          )}

          {checklist.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6"
            >
              <h2 className="text-lg font-medium text-white">
                {section.title}
              </h2>

              <div className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300"
                  >
                    • {item}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              Current public config
            </h2>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                Effective date: {config.effectiveDate}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>Support email: {config.supportEmail}</div>
                <div className="mt-2">
                  <StatusBadge
                    ready={config.supportEmailReady}
                    label={
                      config.supportEmailReady
                        ? "Ready"
                        : "Placeholder detected"
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  Billing support email: {config.billingSupportEmail}
                </div>
                <div className="mt-2">
                  <StatusBadge
                    ready={config.billingSupportEmailReady}
                    label={
                      config.billingSupportEmailReady
                        ? "Ready"
                        : "Placeholder detected"
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              Suggested next steps
            </h2>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                1. Replace public support emails with real addresses.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                2. Prepare your real feedback form or channel.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                3. Re-run a full manual QA pass on auth, journal, stats,
                upgrade, billing success, and export.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                4. Move to first users only when this checklist feels clean
                end to end.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}