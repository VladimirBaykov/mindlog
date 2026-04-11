"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trackClientEvent } from "@/lib/analytics-client";

type Props = {
  title: string;
  description: string;
  feature?: string;
  source?: string;
  ctaLabel?: string;
  compact?: boolean;
};

export default function LockedFeatureCard({
  title,
  description,
  feature,
  source,
  ctaLabel = "Unlock with Pro",
  compact = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const viewedRef = useRef(false);

  const trackedFeature =
    feature ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const trackedSource = source || pathname || "unknown_surface";

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;

    trackClientEvent({
      eventName: "premium_lock_viewed",
      page: pathname || "/",
      metadata: {
        feature: trackedFeature,
        source: trackedSource,
      },
    });
  }, [pathname, trackedFeature, trackedSource]);

  async function handleUpgradeClick() {
    await trackClientEvent({
      eventName: "premium_upgrade_clicked",
      page: pathname || "/",
      metadata: {
        feature: trackedFeature,
        source: trackedSource,
      },
    });

    router.push("/upgrade");
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.03]">
      <div className={`${compact ? "px-4 py-4" : "px-5 py-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
              Pro feature
            </div>

            <div className="mt-4 text-sm font-medium text-white">
              {title}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {description}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-neutral-300">
            Locked
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
          <div className="text-sm font-medium text-white">
            Why it matters
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Pro turns MindLog from a limited reflection tool into a deeper,
            cumulative journaling system with more continuity, more meaning,
            and more room to grow.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleUpgradeClick}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
          >
            {ctaLabel}
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
          >
            View current plan
          </button>
        </div>
      </div>
    </div>
  );
}