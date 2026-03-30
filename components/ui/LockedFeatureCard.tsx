"use client";

import { useRouter } from "next/navigation";

type Props = {
  title: string;
  description: string;
};

export default function LockedFeatureCard({
  title,
  description,
}: Props) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">
            {title}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {description}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-neutral-300">
          Pro
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => router.push("/upgrade")}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
        >
          Unlock with Pro
        </button>
      </div>
    </div>
  );
}