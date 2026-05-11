export type CrmNote = {
  id: string;
  text: string;
  createdAt: string;
  type: "note";
};

function noteId(text: string, index: number) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `note-${hash.toString(36)}-${index}`;
}

export function getNoteText(note: unknown) {
  if (typeof note === "string") return note.trim();
  if (note && typeof note === "object") {
    const candidate =
      (note as { text?: unknown }).text ??
      (note as { content?: unknown }).content ??
      (note as { note?: unknown }).note;
    return typeof candidate === "string" ? candidate.trim() : JSON.stringify(note);
  }
  return note == null ? "" : String(note).trim();
}

export function normalizeContactNotes(notes: unknown, fallbackDate = new Date()): CrmNote[] {
  const rawNotes = Array.isArray(notes)
    ? notes
    : typeof notes === "string"
      ? notes.split(/\r?\n/).filter((line) => line.trim())
      : notes && typeof notes === "object"
        ? [notes]
        : [];

  return rawNotes
    .map((note, index) => {
      const text = getNoteText(note);
      if (!text) return null;
      const existing = note && typeof note === "object" ? note as Partial<CrmNote> : null;
      const createdAt = existing?.createdAt ?? fallbackDate.toISOString();

      return {
        id: existing?.id ?? noteId(text, index),
        text,
        createdAt,
        type: "note" as const,
      };
    })
    .filter((note): note is CrmNote => Boolean(note));
}

export function notesToPlainText(notes: unknown) {
  return normalizeContactNotes(notes)
    .map((note) => note.text)
    .join("\n");
}
