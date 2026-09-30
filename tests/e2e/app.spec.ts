import { test, expect } from "@playwright/test";
test("beta onboarding, note create/edit, export, resources and privacy", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "오늘도, 수고하셨습니다 🌱" }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "사진 찍기", exact: true }).click();
  await page.getByLabel("휴대전화 번호").fill("123");
  await page.getByRole("button", { name: "체험 시작하기" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("휴대전화 번호를 확인");
  await page.getByLabel("이름 또는 별명").fill("검증 농부");
  await page.getByLabel("휴대전화 번호").fill("01012345678");
  await page.getByRole("button", { name: "체험 시작하기" }).click();
  await page.getByLabel("지역", { exact: true }).fill("전남 나주시");
  await page.getByLabel("작물", { exact: true }).fill("고추");
  await page.getByRole("button", { name: "재배지 등록하기" }).click();
  await page
    .getByRole("button", { name: "글로 기록하기 잊기 전에 짧게 남기는 메모" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("textbox", { name: "오늘의 영농작업", exact: true })
    .fill("고추밭에 복합비료 2kg을 사용했습니다.");
  await page.getByRole("button", { name: "체험 노트에 남기기" }).click();
  await expect(
    page.getByRole("heading", { name: "전남 나주시 / 고추" }),
  ).toBeVisible();
  await expect(
    page.getByText("고추밭에 복합비료 2kg을 사용했습니다.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "기록 수정", exact: true }).click();
  await page
    .getByRole("textbox", { name: "오늘의 영농작업", exact: true })
    .fill("고추밭에 복합비료 3kg을 사용했습니다.");
  await page.getByRole("button", { name: "체험 노트에 남기기" }).click();
  await expect(
    page.getByText("고추밭에 복합비료 3kg을 사용했습니다.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/note-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const resources = page.getByRole("button", { name: "농사자료", exact: true });
  await resources.filter({ visible: true }).click();
  await expect(
    page.getByRole("link", { name: /농약안전정보시스템/ }),
  ).toHaveAttribute("href", "https://psis.rda.go.kr/");
  const community = page.getByRole("button", {
    name: "친구 소식",
    exact: true,
  });
  await community.filter({ visible: true }).click();
  await expect(page.getByText("첫 번째 농사 이야기를 기다려요")).toBeVisible();
  await expect(
    page.getByText("고추밭에 복합비료 3kg을 사용했습니다.", { exact: true }),
  ).toHaveCount(0);
  const settings = page.getByRole("button", { name: /^(설정 및 도움말|더보기)$/ });
  await settings.filter({ visible: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:/노트 내려받기/}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^K영농일지_.*\.txt$/);
  expect(errors).toEqual([]);
});
test("unconfigured AI never returns fabricated results and cleanup is protected", async ({
  request,
}) => {
  const ai = await request.post("/api/ai");
  expect([401, 503]).toContain(ai.status());
  const cleanup = await request.get("/api/cleanup");
  expect(cleanup.status()).toBe(401);
});
