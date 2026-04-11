import Link from "next/link";
import {
  PUBLIC_EFFECTIVE_DATE,
  PUBLIC_SUPPORT_EMAIL,
} from "@/lib/public-config";

export default function PrivacyPage() {
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

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
            Privacy Policy
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-white">
            Privacy Policy
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Effective date: {PUBLIC_EFFECTIVE_DATE}
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-300">
            <section>
              <h2 className="text-lg font-medium text-white">
                1. What MindLog does
              </h2>
              <p className="mt-2">
                MindLog is a reflective journaling product that helps users
                have private AI-supported conversations, save those
                reflections as journal entries, and review emotional
                patterns over time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                2. Information we collect
              </h2>
              <p className="mt-2">
                We may collect account information such as your email
                address, authentication identifiers, subscription and
                billing state, and the journal content you choose to save
                inside the product.
              </p>
              <p className="mt-2">
                We may also collect limited product analytics, such as
                onboarding completion, feature usage, upgrade clicks, and
                other interaction data needed to improve the product.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                3. How your data is used
              </h2>
              <p className="mt-2">
                We use your information to operate the product, provide
                journaling and reflection features, manage subscriptions,
                improve reliability, understand product usage, and support
                users.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                4. AI processing
              </h2>
              <p className="mt-2">
                Journal and conversation content may be processed by AI
                providers in order to generate responses, titles, mood
                metadata, summaries, and insights.
              </p>
              <p className="mt-2">
                You should avoid using MindLog for emergency, crisis, or
                medical situations. MindLog is a reflective product, not a
                licensed healthcare service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                5. Billing and payments
              </h2>
              <p className="mt-2">
                Payments are handled by Stripe. MindLog does not store full
                payment card details. Billing-related information such as
                subscription status, Stripe customer IDs, and plan state may
                be stored to manage access to premium features.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                6. Data retention
              </h2>
              <p className="mt-2">
                We retain account and journal data for as long as needed to
                operate the service, comply with legal obligations, resolve
                disputes, and enforce agreements, unless a shorter retention
                period is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                7. Your choices
              </h2>
              <p className="mt-2">
                You can manage your account, update your profile and
                subscription status, and delete journal entries from within
                the product where those controls are available.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                8. Security
              </h2>
              <p className="mt-2">
                We use reasonable technical and organizational measures to
                protect user data. No system can guarantee absolute
                security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                9. Contact
              </h2>
              <p className="mt-2">
                For privacy or support questions, contact{" "}
                <a
                  href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}
                  className="text-white underline underline-offset-4"
                >
                  {PUBLIC_SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                10. Changes
              </h2>
              <p className="mt-2">
                We may update this policy over time. Continued use of
                MindLog after updates means the revised policy applies.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
          <Link href="/profile" className="transition hover:text-white">
            Profile
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            Terms of Service
          </Link>
          <Link href="/support" className="transition hover:text-white">
            Support
          </Link>
        </div>
      </div>
    </main>
  );
}