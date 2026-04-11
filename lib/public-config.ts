export const PUBLIC_EFFECTIVE_DATE = "April 11, 2026";

export const PUBLIC_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@mindlog.app";

export const PUBLIC_BILLING_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BILLING_SUPPORT_EMAIL ||
  "billing@mindlog.app";

const placeholderEmails = new Set([
  "support@mindlog.app",
  "billing@mindlog.app",
  "support@example.com",
  "billing@example.com",
]);

export function isPlaceholderSupportEmail(email: string) {
  return placeholderEmails.has(email.trim().toLowerCase());
}

export function getLaunchConfigStatus() {
  return {
    effectiveDate: PUBLIC_EFFECTIVE_DATE,
    supportEmail: PUBLIC_SUPPORT_EMAIL,
    billingSupportEmail: PUBLIC_BILLING_SUPPORT_EMAIL,
    supportEmailReady: !isPlaceholderSupportEmail(PUBLIC_SUPPORT_EMAIL),
    billingSupportEmailReady: !isPlaceholderSupportEmail(
      PUBLIC_BILLING_SUPPORT_EMAIL
    ),
  };
}