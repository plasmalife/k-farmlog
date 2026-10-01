import { test, expect, type Page } from "@playwright/test";
const uid = "11111111-1111-4111-8111-111111111111",
  sid = "22222222-2222-4222-8222-222222222222";
async function setup(page: Page) {
  const db: Record<string, any[]> = {
    profiles: [{ id: uid, nickname: "검증 농부" }],
    cultivation_sites: [
      {
        id: sid,
        user_id: uid,
        region: "전남 나주시",
        crop: "고추",
        name: "고추밭",
      },
    ],
    notes: [],
    entries: [],
    note_photos: [],
    community_posts: [],
  };
  const calls: string[] = [];
  await page.addInitScript(
    ({ uid }) => {
      const token =
        btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })) +
        "." +
        btoa(
          JSON.stringify({
            sub: uid,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ) +
        ".test";
      localStorage.setItem(
        "sb-cjalujpyghyvyuiqpgdk-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-only",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: uid, aud: "authenticated", role: "authenticated" },
        }),
      );
      class FakeRecorder {
        static isTypeSupported() {
          return true;
        }
        state = "inactive";
        mimeType = "audio/webm";
        onstop: any;
        ondataavailable: any;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob(["synthetic"], { type: "audio/webm" }),
          });
          this.onstop?.();
        }
      }
      Object.defineProperty(window, "MediaRecorder", { value: FakeRecorder });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => ({ getTracks: () => [{ stop() {} }] }),
      });
    },
    { uid },
  );
  await page.route(
    "https://cjalujpyghyvyuiqpgdk.supabase.co/**",
    async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname.includes("/auth/"))
        return route.fulfill({ json: { id: uid, aud: "authenticated" } });
      if (url.pathname.includes("/storage/")) {
        if (url.pathname.includes("/sign/") && req.method() === "POST") {
          const body = req.postDataJSON();
          return route.fulfill({
            json: body.paths
              ? body.paths.map((path: string) => ({
                  path,
                  signedURL:
                    "/object/sign/community-photos/" + path + "?token=test",
                }))
              : { signedURL: "/object/sign/farm-photos/test.jpg?token=test" },
          });
        }
        if (req.method() === "GET")
          return route.fulfill({
            path: "public/samples/cabbage-reference.png",
            contentType: "image/png",
          });
        return route.fulfill({ json: { Key: "test", data: [] } });
      }
      const table = url.pathname.split("/").pop()!,
        rows = db[table];
      if (!rows) return route.fulfill({ json: [] });
      const match = (r: any) =>
        [...url.searchParams].every(
          ([k, v]) => !v.startsWith("eq.") || String(r[k]) === v.slice(3),
        );
      if (req.method() === "POST") {
        const values = req.postDataJSON();
        for (const row of Array.isArray(values) ? values : [values]) {
          const i = rows.findIndex((r) =>
            table === "note_photos"
              ? r.note_id === row.note_id && r.slot === row.slot
              : row.id && r.id === row.id,
          );
          if (i >= 0) rows[i] = { ...rows[i], ...row };
          else
            rows.push({
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ...row,
            });
        }
      }
      if (req.method() === "DELETE") db[table] = rows.filter((r) => !match(r));
      if (req.method() === "PATCH")
        rows.filter(match).forEach((r) => Object.assign(r, req.postDataJSON()));
      const result = db[table].filter(match);
      return route.fulfill({
        json: req.headers().accept?.includes("vnd.pgrst.object")
          ? result[0] || null
          : result,
      });
    },
  );
  await page.route("**/api/ai", async (route) => {
    const body = route.request().postData() || "",
      kind = /name="kind"\r\n\r\n([^\r]+)/.exec(body)?.[1] || "";
    calls.push(
      kind === "photo"
        ? "photo:" + /name="analyze"\r\n\r\n([^\r]+)/.exec(body)?.[1]
        : kind,
    );
    await route.fulfill({
      json:
        kind === "transcribe"
          ? {
              content: "고추밭에 복합비료 2kg 사용",
              transcript: "고추밭에 복합비료 2kg 사용",
              keywords: [],
            }
          : {
              content:
                kind === "photo"
                  ? "[비료 상세]\n복합비료 N-P-K 21-17-17, 2kg"
                  : "[주요 내용]\n고추밭 복합비료 2kg 사용",
              keywords: ["고추", "복합비료", "2kg"],
              region: "",
              crop: "고추",
              date: "",
              score: 80,
              changed: true,
            },
    });
  });
  return { db, calls };
}
test("reference home and three-photo diary persist through reload", async ({
  page,
}, info) => {
  const { db, calls } = await setup(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "내 설정", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("체험 화면입니다.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "친구소식", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "사진찍기", exact: true }).click();
  const files = [
    "public/samples/cabbage-reference.png",
    "public/samples/rice-reference.jpg",
  ];
  await page.getByLabel("사진 파일", { exact: true }).setInputFiles(files);
  await expect(page.getByAltText("사진 2 미리보기")).toBeVisible();
  await page.getByRole("button", { name: "사진 1 삭제", exact: true }).click();
  await page.getByLabel("사진 파일", { exact: true }).setInputFiles(files);
  await expect(page.getByAltText("사진 3 미리보기")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "사진 올리기", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("메모하기", { exact: true })
    .fill("고추밭 복합비료 2kg 사용");
  await page.screenshot({
    path: "artifacts/photo-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "오늘의 일기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 일기", exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["photo:true", "photo:false", "photo:false", "text"]);
  expect(db.note_photos).toHaveLength(3);
  expect(db.entries).toHaveLength(1);
  expect(db.entries[0].content).toContain("21-17-17");
  expect(db.entries[0].content).toContain("[직접 쓴 메모]");
  await page.screenshot({
    path: "artifacts/diary-" + info.project.name + ".png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "내 설정", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "나의노트", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "오늘의 일기", exact: true }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "저장 사진 1 삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "저장 사진 1 삭제", exact: true }),
  ).toHaveCount(0);
  expect(db.note_photos).toHaveLength(2);
  expect(errors).toEqual([]);
});
test("editable STT and community sharing", async ({ page }) => {
  const { db, calls } = await setup(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "내 설정", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "음성으로 기록하기", exact: true })
    .click();
  await page.getByRole("button", { name: "녹음 시작", exact: false }).click();
  await page.getByRole("button", { name: "녹음 마치기", exact: false }).click();
  await expect(page.getByLabel("메모하기", { exact: true })).toHaveValue(
    "고추밭에 복합비료 2kg 사용",
  );
  await page.getByRole("button", { name: "오늘의 일기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 일기", exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["transcribe", "text"]);
  expect(db.entries[0].kind).toBe("voice");
  expect(db.entries[0].content).not.toContain("[직접 쓴 메모]");
  await page
    .getByRole("button", { name: "홈", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "글·사진 올리기", exact: true })
    .click();
  await page.getByLabel("나누고 싶은 이야기").fill("오늘 고추밭 소식입니다.");
  await page
    .getByLabel("사진 파일", { exact: true })
    .setInputFiles("public/samples/rice-reference.jpg");
  await expect(page.getByAltText("사진 1 미리보기")).toBeVisible();
  await page.getByRole("button", { name: "공개하기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("오늘 고추밭 소식입니다.", { exact: true }),
  ).toBeVisible();
  expect(db.community_posts).toHaveLength(1);
  expect(db.community_posts[0].photo_paths).toHaveLength(1);
  await page
    .getByRole("button", { name: "친구 소식", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText("오늘 고추밭 소식입니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".feed-post").first()).not.toContainText(
    "검증 농부",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("unauthenticated AI and cleanup protected", async ({ request }) => {
  expect([401, 503]).toContain((await request.post("/api/ai")).status());
  expect((await request.get("/api/cleanup")).status()).toBe(401);
});
