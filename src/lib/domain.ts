export type Site = { id: string; name: string; region: string; crop: string };
export type Entry = {
  id: string;
  note_id: string;
  kind: "text" | "voice" | "photo";
  content: string;
  keywords: string[];
  created_at: string;
};
export type Photo = {
  note_id: string;
  slot: number;
  path: string;
  score: number;
  description: string;
  pinned: boolean;
  url?: string;
};
export type Note = {
  id: string;
  site_id: string;
  note_date: string;
  region: string;
  crop: string;
  entries: Entry[];
  photos: Photo[];
};
export type Post = {
  photo_paths?: string[];
  photo_urls?: string[];
  id: string;
  user_id: string;
  nickname: string;
  region: string;
  crop: string;
  content: string;
  created_at: string;
};
export function todayKST(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function validPhone(value: string) {
  return /^01[016789]\d{7,8}$/.test(value.replace(/\D/g, ""));
}
export function photoSlot(photos: Photo[], score: number, changed = true) {
  if (score < 35) return null;
  const free = [1, 2, 3].find((slot) => !photos.some((p) => p.slot === slot));
  if (free) return free;
  if (!changed) return null;
  const replace = photos
    .filter((p) => !p.pinned)
    .sort((a, b) => a.score - b.score)[0];
  return replace && score > replace.score ? replace.slot : null;
}
export function formatDate(date: string) {
  return date.replaceAll("-", ".");
}
export function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
export function exportNotes(notes: Note[]) {
  return notes
    .map(
      (n) =>
        `${n.note_date} | ${n.region} / ${n.crop}\n${n.entries.map((e) => e.content).join("\n\n")}`,
    )
    .join("\n\n────────────────────\n\n");
}
