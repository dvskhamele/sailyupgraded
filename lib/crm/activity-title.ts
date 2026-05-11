type ActivityTitleInput = {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  outcome?: string | null;
  note?: string | null;
  fallback?: string;
};

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  email: "Email",
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleFromText(value: string, maxLength = 72) {
  const compacted = compactText(value);
  if (!compacted) return "";

  const sentence = compacted.split(/[.!?]\s/)[0] ?? compacted;
  if (sentence.length <= maxLength) return sentence;

  return `${sentence.slice(0, maxLength - 1).trim()}...`;
}

export function generateActivityTitle({
  type,
  title,
  description,
  outcome,
  note,
  fallback = "Activity",
}: ActivityTitleInput) {
  const explicitTitle = compactText(title ?? "");
  if (explicitTitle) return titleFromText(explicitTitle);

  const preview =
    titleFromText(description ?? "") ||
    titleFromText(note ?? "") ||
    titleFromText(outcome ?? "");
  const label = TYPE_LABELS[String(type ?? "").toLowerCase()] ?? fallback;

  return preview ? `${label}: ${preview}` : label;
}
