/**
 * Utility functions for WhatsApp Browser Extension integration.
 * The browser extension reads `ext_phone`, `ext_msg`, and `ext_send` URL parameters from WhatsApp Web.
 */

export interface ContactPhoneSource {
  id?: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  mobile_phone?: string | null;
  phone?: string | null;
  office_phone?: string | null;
  [key: string]: any;
}

export interface WhatsAppRecipient {
  id: string;
  name: string;
  rawPhone: string;
  cleanPhone: string;
  contact: ContactPhoneSource;
}

export interface SkippedWhatsAppContact {
  id: string;
  name: string;
  reason: string;
  contact: ContactPhoneSource;
}

export interface ProcessedWhatsAppContacts {
  validRecipients: WhatsAppRecipient[];
  skippedContacts: SkippedWhatsAppContact[];
  uniquePhoneNumbers: string[];
  extPhoneParam: string;
}

/**
 * Cleans and validates a raw phone number for WhatsApp.
 * Removes spaces, '+', '-', '(', ')', '.', and other formatting while preserving country code.
 * Rejects empty, null, or placeholder strings (e.g. 'unavailable', 'null').
 */
export function cleanWhatsAppPhoneNumber(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower === "unavailable" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "extrapolated" ||
    lower === "entry"
  ) {
    return null;
  }

  // Remove spaces, +, -, (, ), ., and any non-digit character
  const digitsOnly = trimmed.replace(/\D/g, "");

  // A valid phone number with country code should have at least 5 digits
  if (digitsOnly.length < 5) {
    return null;
  }

  return digitsOnly;
}

/**
 * Extracts the primary phone number from a contact or lead record.
 * Prioritizes phone, mobile_phone, then office_phone.
 */
export function getContactRawPhone(contact: ContactPhoneSource): string | null {
  const phone =
    contact.mobile_phone ||
    contact.phone ||
    contact.office_phone;
  return phone?.trim() || null;
}

/**
 * Derives a human-readable display name for a contact or lead.
 */
export function getContactDisplayName(contact: ContactPhoneSource): string {
  const firstName = (contact.first_name || contact.firstName || "").trim();
  const lastName = (contact.last_name || contact.lastName || "").trim();
  const combined = [firstName, lastName].filter(Boolean).join(" ");
  if (combined) return combined;
  if (contact.name && contact.name.trim()) return contact.name.trim();
  return "Contact";
}

/**
 * Processes an array of contacts for WhatsApp messaging.
 * Collects valid recipients, skips contacts without valid phone numbers,
 * and builds a deduplicated comma-separated list of phone numbers.
 */
export function processContactsForWhatsApp(
  contacts: ContactPhoneSource[]
): ProcessedWhatsAppContacts {
  const validRecipients: WhatsAppRecipient[] = [];
  const skippedContacts: SkippedWhatsAppContact[] = [];
  const seenNumbers = new Set<string>();
  const uniquePhoneNumbers: string[] = [];

  for (const contact of contacts) {
    const name = getContactDisplayName(contact);
    const id = contact.id || name;
    const rawPhone = getContactRawPhone(contact);
    const cleanPhone = cleanWhatsAppPhoneNumber(rawPhone);

    if (!cleanPhone || !rawPhone) {
      skippedContacts.push({
        id,
        name,
        reason: "No valid phone number",
        contact,
      });
      continue;
    }

    validRecipients.push({
      id,
      name,
      rawPhone,
      cleanPhone,
      contact,
    });

    if (!seenNumbers.has(cleanPhone)) {
      seenNumbers.add(cleanPhone);
      uniquePhoneNumbers.push(cleanPhone);
    }
  }

  return {
    validRecipients,
    skippedContacts,
    uniquePhoneNumbers,
    extPhoneParam: uniquePhoneNumbers.join(","),
  };
}

/**
 * Constructs the WhatsApp Web URL for the browser extension.
 * URL format:
 * https://web.whatsapp.com/?ext_phone={PHONE_NUMBERS}&ext_msg={MESSAGE}&ext_send=true
 *
 * `phoneNumbers` can be an array of cleaned numbers or a comma-separated string.
 * `message` is safely URL encoded using `encodeURIComponent`.
 */
export function buildWhatsAppWebExtensionUrl(
  phoneNumbers: string[] | string,
  message: string
): string {
  const phoneParam = Array.isArray(phoneNumbers)
    ? phoneNumbers.filter(Boolean).join(",")
    : phoneNumbers.trim();

  const encodedMsg = encodeURIComponent(message);

  return `https://web.whatsapp.com/?ext_phone=${phoneParam}&ext_msg=${encodedMsg}&ext_send=true`;
}
