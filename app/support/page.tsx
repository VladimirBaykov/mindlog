import Link from "next/link";
import {
  PUBLIC_BILLING_SUPPORT_EMAIL,
  PUBLIC_SUPPORT_EMAIL,
} from "@/lib/public-config";

export default function SupportPage() {
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
              Support
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-white">
              MindLog Support
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
              This page is for product questions, billing questions, and
              general support. For urgent mental health or crisis situations,
              do not rely on MindLog. Contact local emergency services or a
              qualified crisis resource immediately.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              Common support topics
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-relaxed text-neutral-300">
              <div>
                <div className="font-medium text-white">
                  Billing and subscription
                </div>
                <p className="mt-1 text-neutral-400">
                  If checkout succeeded but Pro is not visible yet, open your
                  profile and refresh plan status. In most cases the Stripe
                  webhook sync finishes shortly after payment.
                </p>
              </div>

              <div>
                <div className="font-medium text-white">
                  Export and Pro features
                </div>
                <p className="mt-1 text-neutral-400">
                  PDF export, weekly summaries, and premium AI insights are
                  part of the Pro plan.
                </p>
              </div>

              <div>
                <div className="font-medium text-white">
                  Journal and account access
                </div>
                <p className="mt-1 text-neutral-400">
                  Sign-in, sign-up, saved entries, and profile tools are tied
                  to your authenticated account.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-6">
            <h2 className="text-lg font-medium text-white">
              Need help?
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              Set your real public support contacts through env before launch.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-neutral-300">
              <div>
                Support email:{" "}
                <a
                  href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}
                  className="text-white underline underline-offset-4"
                >
                  {PUBLIC_SUPPORT_EMAIL}
                </a>
              </div>
              <div className="mt-2">
                Billing support:{" "}
                <a
                  href={`mailto:${PUBLIC_BILLING_SUPPORT_EMAIL}`}
                  className="text-white underline underline-offset-4"
                >
                  {PUBLIC_BILLING_SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
            <Link href="/profile" className="transition hover:text-white">
              Profile
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}