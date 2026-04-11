export type UsageInfo = {
  plan: "free" | "pro";
  status?: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  canSave: boolean;
  currentPeriodEnd?: string | null;
  ai?: {
    maxMessagesPerConversation: number;
    maxCharactersPerMessage: number;
    maxTotalInputCharacters: number;
  };
};

export type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
};

export type AccountSnapshot = {
  usage: UsageInfo | null;
  subscription: SubscriptionInfo | null;
};

async function fetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${input}`);
  }

  return (await res.json()) as T;
}

export async function fetchUsage(
  signal?: AbortSignal
): Promise<UsageInfo> {
  return fetchJson<UsageInfo>("/api/account/usage", { signal });
}

export async function fetchSubscription(
  signal?: AbortSignal
): Promise<SubscriptionInfo> {
  return fetchJson<SubscriptionInfo>("/api/account/subscription", {
    signal,
  });
}

export async function fetchAccountSnapshot(
  signal?: AbortSignal
): Promise<AccountSnapshot> {
  const [usage, subscription] = await Promise.all([
    fetchUsage(signal),
    fetchSubscription(signal),
  ]);

  return {
    usage,
    subscription,
  };
}