import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayKST,
  photoSlot,
  validPhone,
  exportNotes,
  type Photo,
} from "../src/lib/domain";
test("KST midnight separates records independently of UTC", () => {
  assert.equal(todayKST(new Date("2026-09-29T14:59:59Z")), "2026-09-29");
  assert.equal(todayKST(new Date("2026-09-29T15:00:00Z")), "2026-09-30");
});
test("beta phone validation", () => {
  assert.equal(validPhone("010-1234-5678"), true);
  assert.equal(validPhone("01012"), false);
  assert.equal(validPhone("0212345678"), false);
});
const photos: Photo[] = [1, 2, 3].map((slot) => ({
  note_id: "n",
  slot,
  path: "",
  score: slot * 20 + 30,
  description: "",
  pinned: slot === 1,
}));
test("blurred photos never occupy a slot", () =>
  assert.equal(photoSlot([], 20), null));
test("never creates a fourth slot and preserves unchanged or pinned photos", () => {
  assert.equal(photoSlot(photos, 99, false), null);
  assert.equal(photoSlot(photos, 99, true), 2);
  assert.equal(
    photoSlot(
      photos.map((p) => ({ ...p, pinned: true })),
      100,
      true,
    ),
    null,
  );
  assert.equal(photoSlot(photos, 50, true), null);
});
test("fills available slots", () =>
  assert.equal(photoSlot(photos.slice(0, 2), 60), 3));
test("export preserves key quantities", () => {
  const content = exportNotes([
    {
      id: "n",
      site_id: "s",
      note_date: "2026-09-30",
      region: "나주시",
      crop: "고추",
      photos: [],
      entries: [
        {
          id: "e",
          note_id: "n",
          kind: "voice",
          content: "복합비료 2kg 사용",
          keywords: [],
          created_at: "",
        },
      ],
    },
  ]);
  assert.match(content, /복합비료 2kg 사용/);
});
