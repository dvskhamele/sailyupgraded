export const SMTP2GO_VERIFIED_SENDER_DOMAIN = "mail.bluetidefinancial.com";
export const DEFAULT_SMTP2GO_SENDER = `oscar@${SMTP2GO_VERIFIED_SENDER_DOMAIN}`;
export const SMTP2GO_SENDER_DOMAIN_ERROR =
  "The sender domain is not verified in SMTP2GO. Please use an email address from mail.bluetidefinancial.com or verify the desired domain in SMTP2GO.";

export function normalizeSenderEmail(sender?: string | null) {
  return sender?.trim().toLowerCase() || DEFAULT_SMTP2GO_SENDER;
}

export function isAllowedSmtp2GoSender(sender?: string | null) {
  const normalized = normalizeSenderEmail(sender);
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    normalized.endsWith(`@${SMTP2GO_VERIFIED_SENDER_DOMAIN}`)
  );
}
