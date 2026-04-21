"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { moodConfig } from "@/lib/journal/moodMap";
import { trackClientEvent } from "@/lib/analytics-client";

type ExportMessage = {
  role: "user" | "assistant";
  content: string;
};

type ExportEntry = {
  id: string;
  title: string;
  mood: keyof typeof moodConfig | string;
  createdAt: string;
  updatedAt: string | null;
  messages: ExportMessage[];
};

type ExportError = {
  error?: string;
  code?: string;
  locked?: boolean;
  feature?: string;
  upgradeUrl?: string;
};

export default function JournalExportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [entry, setEntry] = useState<ExportEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [lockTracked, setLockTracked] = useState(false);

  const id = params.id;

  useEffect(() => {
    setHeader({
      title: "Export report",
      leftSlot: (
        <button
          onClick={() => router.push(`/journal/${id}`)}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Entry
        </button>
      ),
      menuItems: [
        {
          label: "Print / Save PDF",
          highlight: true,
          onClick: async () => {
            if (entry) {
              await trackClientEvent({
                eventName: "journal_export_printed",
                page: `/journal/${id}/export`,
                metadata: {
                  entryId: entry.id,
                  title: entry.title,
                  messageCount: entry.messages.length,
                },
              });
            }

            window.print();
          },
        },
        {
          label: "Upgrade",
          onClick: async () => {
            await trackClientEvent({
              eventName: "premium_upgrade_clicked",
              page: `/journal/${id}/export`,
              metadata: {
                feature: "pdf_export",
                source: "export_header_menu",
                entryId: id,
              },
            });

            router.push("/upgrade");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [entry, id, router, resetHeader, setHeader]);

  useEffect(() => {
    let cancelled = false;

    async function loadExport() {
      try {
        setLoading(true);
        setLocked(false);
        setNotFound(false);

        const res = await fetch(`/api/journal/${id}/export`, {
          cache: "no-store",
        });

        if (res.status === 403) {
          const data = (await res.json()) as ExportError;

          if (!cancelled) {
            setLocked(data.code === "PRO_REQUIRED");
          }

          return;
        }

        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to load export");
        }

        const data = (await res.json()) as ExportEntry;

        if (!cancelled) {
          setEntry(data);
        }

        await trackClientEvent({
          eventName: "journal_export_opened",
          page: `/journal/${id}/export`,
          metadata: {
            entryId: data.id,
            title: data.title,
            messageCount: data.messages.length,
          },
        });
      } catch (error) {
        console.error("Export load failed:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadExport();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!locked || lockTracked) return;

    setLockTracked(true);

    trackClientEvent({
      eventName: "premium_lock_viewed",
      page: `/journal/${id}/export`,
      metadata: {
        feature: "pdf_export",
        source: "export_page_lock",
        entryId: id,
      },
    });
  }, [locked, lockTracked, id]);

  const mood = useMemo(() => {
    if (!entry?.mood) return moodConfig.calm;

    return moodConfig[entry.mood as keyof typeof moodConfig]
      ? moodConfig[entry.mood as keyof typeof moodConfig]
      : moodConfig.calm;
  }, [entry]);

  if (loading) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-3xl px-5 pt-6 pb-8">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-7">
              <div className="h-5 w-40 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="mt-4 h-8 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="mt-7 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-[20px] bg-white/[0.04]"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </AuthGate>
    );
  }

  if (locked) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-xl space-y-5 px-5 pt-6 pb-8">
            <div className="rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.03] px-6 py-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-lg">
                ⌁
              </div>

              <h1 className="mt-4 text-[28px] font-semibold leading-tight text-white">
                PDF export is part of Pro
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                Export turns important reflections into clean, printable
                reports you can keep, review later, or save outside the app.
              </p>

              <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-left">
                <div className="text-sm font-medium text-white">
                  What Pro adds here
                </div>
                <div className="mt-3 space-y-2 text-sm text-neutral-400">
                  <div>• Clean print-ready reflection report</div>
                  <div>• Save as PDF directly from your browser</div>
                  <div>• Keep meaningful entries outside the app</div>
                  <div>• Use export as part of a deeper journaling workflow</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  onClick={async () => {
                    await trackClientEvent({
                      eventName: "premium_upgrade_clicked",
                      page: `/journal/${id}/export`,
                      metadata: {
                        feature: "pdf_export",
                        source: "export_page_lock_primary_cta",
                        entryId: id,
                      },
                    });

                    router.push("/upgrade");
                  }}
                  className="rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Unlock PDF export
                </button>

                <button
                  onClick={() => router.push(`/journal/${id}`)}
                  className="rounded-[18px] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                >
                  Back to entry
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-sm font-medium text-white">
                Why this matters
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                MindLog Pro is designed to make your journal feel cumulative:
                not just chats, but lasting reflections with summaries,
                insights, export, and more depth across the whole product.
              </p>
            </div>
          </div>
        </div>
      </AuthGate>
    );
  }

  if (notFound || !entry) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-xl px-5 pt-6 pb-8">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-lg">
                ⊘
              </div>

              <h1 className="mt-4 text-[28px] font-semibold leading-tight text-white">
                Export unavailable
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                This journal entry could not be found or is no longer
                available.
              </p>

              <button
                onClick={() => router.push("/journal")}
                className="mt-6 rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Back to journal
              </button>
            </div>
          </div>
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <>
        <style jsx global>{`
          @media print {
            .print-hide {
              display: none !important;
            }

            body {
              background: white !important;
            }
          }
        `}</style>

        <div className="min-h-screen bg-black text-white">
          <div className="print-hide mx-auto max-w-3xl px-5 pt-6">
            <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    Reflection export
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    Use print and choose “Save as PDF” in your browser to
                    export this report.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      await trackClientEvent({
                        eventName: "journal_export_printed",
                        page: `/journal/${id}/export`,
                        metadata: {
                          entryId: entry.id,
                          title: entry.title,
                          messageCount: entry.messages.length,
                        },
                      });

                      window.print();
                    }}
                    className="rounded-[18px] bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Print / Save PDF
                  </button>

                  <button
                    onClick={() => router.push(`/journal/${id}`)}
                    className="rounded-[18px] border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-3xl px-5 pb-8 print:pb-0">
            <article className="rounded-[24px] border border-white/10 bg-white text-black shadow-2xl print:rounded-none print:border-0 print:shadow-none">
              <div className="border-b border-black/10 px-8 py-8">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  MindLog Reflection Report
                </div>

                <h1 className="mt-4 text-3xl font-semibold text-black">
                  {entry.title || "Conversation"}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                  <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1">
                    <span
                      className={`h-2 w-2 rounded-full ${mood.color}`}
                    />
                    {mood.label}
                  </span>

                  <span>
                    Created{" "}
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>

                  {entry.updatedAt && (
                    <span>
                      Updated{" "}
                      {new Date(
                        entry.updatedAt
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-8 py-8">
                <section>
                  <h2 className="text-lg font-semibold text-black">
                    Conversation
                  </h2>

                  <div className="mt-6 space-y-4">
                    {entry.messages.length === 0 ? (
                      <div className="rounded-[20px] border border-black/10 bg-black/[0.02] px-5 py-5 text-sm text-neutral-600">
                        No messages found in this reflection.
                      </div>
                    ) : (
                      entry.messages.map((message, index) => {
                        const isUser = message.role === "user";

                        return (
                          <div
                            key={`${message.role}-${index}`}
                            className={`rounded-[20px] border px-5 py-4 ${
                              isUser
                                ? "border-black/10 bg-black/[0.03]"
                                : "border-black/10 bg-white"
                            }`}
                          >
                            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                              {isUser ? "You" : "MindLog"}
                            </div>

                            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-black">
                              {message.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </article>
          </div>
        </div>
      </>
    </AuthGate>
  );
}