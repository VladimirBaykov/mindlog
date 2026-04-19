import Link from "next/link";
import {
  PUBLIC_EFFECTIVE_DATE,
  PUBLIC_SUPPORT_EMAIL,
} from "@/lib/public-config";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-5 pt-7 pb-12">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/profile"
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            ← Back to profile
          </Link>

          <div className="text-sm text-neutral-500">MindLog</div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-7">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
            Terms of Service
          </div>

          <h1 className="mt-4 text-[30px] font-semibold leading-tight text-white">
            Terms of Service
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Effective date: {PUBLIC_EFFECTIVE_DATE}
          </p>

          <div className="mt-7 space-y-7 text-[14.5px] leading-[1.72] text-neutral-300">
            <section>
              <h2 className="text-lg font-medium text-white">
                1. Acceptance of terms
              </h2>
              <p className="mt-2">
                By accessing or using MindLog, you agree to these Terms of
                Service. If you do not agree, do not use the product.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                2. Nature of the service
              </h2>
              <p className="mt-2">
                MindLog is an AI journaling and reflection product. It is
                intended for personal reflection and productivity. It is not
                medical care, therapy, crisis response, or emergency support.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                3. Accounts
              </h2>
              <p className="mt-2">
                You are responsible for maintaining the security of your
                account and for the activity that occurs under it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                4. Acceptable use
              </h2>
              <p className="mt-2">
                You agree not to misuse the service, attempt unauthorized
                access, interfere with product operation, or use the product
                in ways that violate laws or the rights of others.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                5. AI-generated content
              </h2>
              <p className="mt-2">
                MindLog may generate AI responses, summaries, titles, and
                insights. These outputs may be imperfect and should not be
                relied on as legal, medical, psychological, or financial
                advice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                6. Paid plans and billing
              </h2>
              <p className="mt-2">
                Paid subscriptions are handled through Stripe. Subscription
                access, renewal timing, billing status, and cancellation
                handling may depend on Stripe and related webhook syncs.
              </p>
              <p className="mt-2">
                If a payment fails, premium access may be limited, paused, or
                removed depending on billing status.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                7. Availability
              </h2>
              <p className="mt-2">
                We may change, suspend, or discontinue features at any time.
                We do not guarantee uninterrupted availability.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                8. Termination
              </h2>
              <p className="mt-2">
                We may suspend or terminate access to the service if these
                terms are violated or if continued access creates security,
                legal, or operational risk.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                9. Limitation of liability
              </h2>
              <p className="mt-2">
                To the maximum extent allowed by law, MindLog is provided on
                an “as is” basis without warranties of any kind, and we are
                not liable for indirect, incidental, special, or consequential
                damages arising from use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium text-white">
                10. Contact
              </h2>
              <p className="mt-2">
                For terms or service questions, contact{" "}
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
                11. Changes to the terms
              </h2>
              <p className="mt-2">
                We may update these terms over time. Continued use after
                updates means you accept the revised terms.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
          <Link href="/profile" className="transition hover:text-white">
            Profile
          </Link>
          <Link href="/privacy" className="transition hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/support" className="transition hover:text-white">
            Support
          </Link>
        </div>
      </div>
    </main>
  );
}