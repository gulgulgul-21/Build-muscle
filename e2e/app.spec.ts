import { test, expect, type Page } from "@playwright/test";
test("calendar navigates months and dates, logs make-up sessions, and labels sets and repetitions", async ({
  page,
}) => {
  await openMonday(page);
  await page.getByRole("link", { name: "ฝึก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ปฏิทินการฝึก", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".plan-day").first().locator(".exercise-row").first(),
  ).toContainText("5 เซต × 1–2 ครั้ง");
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("en");
  await expect(
    page.locator(".plan-day").first().locator(".exercise-row").first(),
  ).toContainText("5 sets × 1–2 reps");
  await expect(
    page.locator(".exercise-row").filter({ hasText: "Dead Bug" }),
  ).toContainText("3 sets × 10 reps per side");
  await expect(
    page.locator(".exercise-row").filter({ hasText: "Hollow Hold" }),
  ).toContainText("3 sets × 20–30 seconds");
  const calendar = page.locator(".training-calendar");
  await calendar
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(calendar.locator(".calendar-month h3")).toHaveText(
    "September 2026",
  );
  await calendar
    .getByRole("button", { name: "Next month", exact: true })
    .click();
  await expect(calendar.locator(".calendar-month h3")).toHaveText(
    "October 2026",
  );
  await calendar.getByRole("button", { name: "Today", exact: true }).click();
  const monday = calendar.locator('[data-date="2026-10-19"]');
  await monday.focus();
  await monday.press("ArrowRight");
  await expect(calendar.locator('[data-date="2026-10-20"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(calendar.locator(".calendar-details")).toContainText("Rest day");
  await page.getByRole("link", { name: "Edit plan", exact: true }).click();
  await page
    .getByLabel("Four-week plan start date", { exact: true })
    .fill("2026-10-12");
  await page.getByRole("button", { name: "Save date", exact: true }).click();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.locator('[data-date="2026-10-14"]').click();
  await expect(page.locator('[data-date="2026-10-14"]')).toHaveAttribute(
    "aria-label",
    /Not completed/,
  );
  await page
    .getByRole("button", { name: "Start selected day", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Goblet Squat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByText("Set 2", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Another session in the books" }),
  ).toBeVisible();
  await expect(page.locator(".page-heading")).toContainText("2026-10-14");
  await page.getByRole("link", { name: "Workout", exact: true }).click();
  await page.locator('[data-date="2026-10-14"]').click();
  await expect(page.locator('[data-date="2026-10-14"]')).toHaveAttribute(
    "aria-label",
    /Completed/,
  );
  await expect(page.locator(".calendar-session")).toContainText("B · Legs");
  await page.reload();
  await page.locator('[data-date="2026-10-14"]').click();
  await expect(page.locator(".calendar-session")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const cell = await page.locator('[data-date="2026-10-14"]').boundingBox();
  expect(cell!.width).toBeGreaterThanOrEqual(44);
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("th");
  await expect(
    page.getByRole("heading", { name: "ปฏิทินการฝึก", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".exercise-row").filter({ hasText: "Hollow Hold" }),
  ).toContainText("3 เซต × 20–30 วินาที");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("switches Thai and English across screens, survives refresh and backup, preserves workout input", async ({
  page,
  context,
}) => {
  await openMonday(page);
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Consistency, one step at a time" }),
  ).toBeVisible();
  await expect(page.locator(".page-heading .eyebrow")).toContainText("Monday");
  for (const name of ["Workout", "Progress", "Settings"]) {
    await page.getByRole("link", { name, exact: true }).click();
    if (name === "Workout") {
      for (const destination of ["Exercise library", "Edit plan"]) {
        await page
          .getByRole("link", { name: destination, exact: true })
          .click();
        await expect(page.locator("main")).not.toContainText(/[\u0e00-\u0e7f]/);
        await page.getByRole("link", { name: "Back", exact: true }).click();
      }
    }
    await expect
      .poll(async () =>
        (await page.locator("main").innerText())
          .replaceAll("ภาษา / Language", "")
          .replaceAll("ไทย", ""),
      )
      .not.toMatch(/[\u0e00-\u0e7f]/);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up JSON" }).click();
  const file = await (await exported).path();
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(
    (await readFile(file!, "utf8")).replace(/^\uFEFF/, ""),
  );
  expect(backup.data.settings[0].language).toBe("en");
  await page
    .locator(".brandbar")
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("th");
  await page
    .getByLabel("เลือกไฟล์สำรอง JSON", { exact: false })
    .setInputFiles(file!);
  await page
    .getByRole("combobox", { name: "วิธีนำเข้า", exact: true })
    .selectOption("replace");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ยืนยันนำเข้า", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Repetition count", exact: true })
    .fill("2");
  await page
    .getByRole("textbox", { name: "Workout notes" })
    .fill("โน้ตของฉัน / my note");
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("th");
  await expect(
    page.getByRole("spinbutton", { name: "จำนวนครั้ง", exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("en");
  await expect(
    page.getByRole("spinbutton", { name: "Repetition count", exact: true }),
  ).toHaveValue("2");
  await expect(
    page.getByRole("textbox", { name: "Workout notes" }),
  ).toHaveValue("โน้ตของฉัน / my note");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await expect(page.getByText("Set 2", { exact: true })).toBeVisible();
  await page
    .getByText("Check discomfort during / after training", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Location", exact: true })
    .selectOption("elbow");
  await page
    .getByRole("button", { name: "Save discomfort", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Do not increase intensity",
  );
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("th");
  await expect(page.getByRole("alert")).toContainText("ไม่เพิ่มความหนัก");
  await page
    .getByRole("combobox", { name: "ภาษา / Language" })
    .selectOption("en");
  await expect(page.getByText("Ready offline on this device")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Set 2", { exact: true })).toBeVisible();
});
async function openMonday(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00+07:00"));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "สม่ำเสมอ ทีละนิด" }),
  ).toBeVisible();
}
async function start(page: Page) {
  await openMonday(page);
  await page.getByRole("button", { name: "เริ่มฝึก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pull-up", exact: true }),
  ).toBeVisible();
}
async function finish(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "จบการฝึก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "อีกหนึ่งครั้งที่ได้ฝึก" }),
  ).toBeVisible();
}
test("seed plan, multiple sets, single-set PR, summary and unchanged historical targets", async ({
  page,
}) => {
  await start(page);
  for (const value of [2, 2, 1]) {
    await page
      .getByRole("spinbutton", { name: "จำนวนครั้ง", exact: true })
      .fill(String(value));
    await page.getByRole("button", { name: "บันทึกเซต", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "บันทึกเซต", exact: true }),
    ).toBeEnabled();
  }
  await finish(page);
  await expect(page.getByText("2 / 2 / 1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "หน้าแรก", exact: true }).click();
  await expect(page.locator(".next-session")).toContainText("B · Legs");
  await expect(
    page.getByRole("button", { name: "เริ่มฝึก", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "พัฒนาการ", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ท่าฝึก", exact: true })
    .selectOption({ label: "Pull-up" });
  await expect(page.getByText("3 ครั้ง", { exact: true })).toBeVisible();
  await expect(page.getByText("5 ครั้ง", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "ฝึก", exact: true }).click();
  await page.getByRole("link", { name: "แก้ไขแผน" }).click();
  const editor = page.locator("form.plan-day").first();
  await expect(
    editor.getByRole("heading", { name: "A · Pull + Push", exact: true }),
  ).toBeVisible();
  await editor.locator("summary").first().click();
  await editor.getByLabel("เซต", { exact: true }).first().fill("1");
  page.once("dialog", (d) => d.accept());
  await editor.getByRole("button", { name: "ยืนยันการเปลี่ยนแผน" }).click();
  await expect(editor.getByRole("status")).toHaveText("บันทึกแผนแล้ว");
  await page.getByRole("link", { name: "พัฒนาการ", exact: true }).click();
  await page.locator(".history-row").first().click();
  await expect(
    page.getByText("เป้า 5 เซต × 1–2 ครั้ง", { exact: true }),
  ).toBeVisible();
});
test("refresh resumes a single session, saved sets and absolute timer", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "บันทึกเซต", exact: true }).click();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
  await expect(page.getByText("พักระหว่างเซต", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-19T12:03:00+07:00"));
  await expect(page.getByText("พักครบแล้ว", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "หน้าแรก", exact: true }).click();
  await page.getByRole("button", { name: "ฝึกต่อ", exact: true }).click();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
});
test("elbow pain prevents dip or negative pull-up logging and discourages overload", async ({
  page,
}) => {
  await openMonday(page);
  await page.getByRole("link", { name: "ฝึก", exact: true }).click();
  await page.getByRole("button", { name: "เริ่มฝึก C", exact: true }).click();
  await page.getByText("เช็กอาการระหว่าง / หลังฝึก", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "บริเวณ", exact: true })
    .selectOption("elbow");
  await page.getByRole("button", { name: "บันทึกอาการ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ไม่เพิ่มความหนัก");
  await page.getByText("ดู / แก้ไขเซตทั้งหมด", { exact: false }).click();
  await page.getByRole("button", { name: /^Dip/ }).click();
  await expect(page.getByText("พักท่านี้เพื่อความปลอดภัย")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "บันทึกเซต", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Negative Pull-up/ }).click();
  await expect(page.getByText("พักท่านี้เพื่อความปลอดภัย")).toBeVisible();
});
test("JSON export erase import restores matching session data", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "บันทึกเซต", exact: true }).click();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
  await finish(page);
  await page.getByRole("link", { name: "ตั้งค่า", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "สำรอง JSON", exact: true }).click();
  const downloaded = await downloadPromise;
  const path = await downloaded.path();
  expect(path).toBeTruthy();
  page.on("dialog", (dialog) =>
    dialog.accept(dialog.type() === "prompt" ? "RESET" : undefined),
  );
  await page.getByRole("button", { name: "ล้างข้อมูลและเริ่มใหม่" }).click();
  await expect(
    page.getByRole("heading", { name: "ตั้งค่า", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "พัฒนาการ", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(0);
  await page.getByRole("link", { name: "ตั้งค่า", exact: true }).click();
  await page
    .getByLabel("เลือกไฟล์สำรอง JSON", { exact: false })
    .setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "ตรวจสอบก่อนนำเข้า" }),
  ).toBeVisible();
  await page.getByLabel("วิธีนำเข้า").selectOption("replace");
  await page.getByRole("button", { name: "ยืนยันนำเข้า" }).click();
  await expect(
    page.getByText("นำเข้าข้อมูลสำเร็จ", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "พัฒนาการ", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.locator(".history-row").click();
  await expect(
    page.getByText("เป้า 5 เซต × 1–2 ครั้ง", { exact: true }),
  ).toBeVisible();
});
test("hash navigation, small screens and offline cached shell support workout writes", async ({
  page,
  context,
}) => {
  await openMonday(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect(page.getByText("พร้อมใช้งานออฟไลน์บนอุปกรณ์นี้")).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ["หน้าแรก", "ฝึก", "พัฒนาการ", "ตั้งค่า"]) {
      await page.getByRole("link", { name, exact: true }).click();
      await page.reload();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await context.setOffline(true);
  await page.getByRole("link", { name: "หน้าแรก", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "เริ่มฝึก", exact: true }).click();
  await page.getByRole("button", { name: "บันทึกเซต", exact: true }).click();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("เซตที่ 2", { exact: true })).toBeVisible();
});
