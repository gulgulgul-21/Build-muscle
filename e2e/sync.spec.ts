import { test, expect, type BrowserContext } from "@playwright/test";
import type { Backup } from "../src/domain/model";
const account = "33333333-3333-4333-8333-333333333333";
test("email callback restores the session and clears credentials from the URL", async ({
  page,
  baseURL,
}) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    { alg: "HS256", typ: "JWT" },
    { sub: account, exp, role: "authenticated" },
    "signature",
  ]
    .map((x) =>
      typeof x === "string"
        ? x
        : Buffer.from(JSON.stringify(x)).toString("base64url"),
    )
    .join(".");
  await page.route(
    "https://zievvkvcifigwmcvezsb.supabase.co/**",
    async (route) => {
      if (route.request().url().includes("/auth/v1/user"))
        return route.fulfill({
          json: {
            id: account,
            email: "callback@example.invalid",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: { provider: "email" },
            user_metadata: {},
            created_at: "2026-10-18T00:00:00Z",
          },
        });
      return route.fulfill({ json: null });
    },
  );
  await page.goto(
    baseURL +
      `#access_token=${token}&refresh_token=test-refresh&token_type=bearer&expires_in=3600&type=magiclink`,
  );
  await expect(page).toHaveURL(baseURL + "#/settings");
  await expect(
    page.locator("#sync").getByText("callback@example.invalid", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#sync").getByText("เลือกข้อมูลเริ่มต้น", { exact: true }),
  ).toBeVisible();
});
test("two devices sync, resume offline edits, and stop concurrent conflicts", async ({
  browser,
  baseURL,
}) => {
  let cloud: { revision: number; payload: Backup } | null = null;
  const contexts: BrowserContext[] = [];
  async function connect() {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true,
      serviceWorkers: "block",
    });
    contexts.push(context);
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      { alg: "HS256", typ: "JWT" },
      { sub: account, exp, role: "authenticated" },
      "signature",
    ]
      .map((x) =>
        typeof x === "string"
          ? x
          : Buffer.from(JSON.stringify(x)).toString("base64url"),
      )
      .join(".");
    await context.addInitScript(
      ({ token, exp, account }) => {
        localStorage.setItem(
          "sb-zievvkvcifigwmcvezsb-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "test-refresh",
            expires_at: exp,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: account,
              email: "sync@example.invalid",
              aud: "authenticated",
              role: "authenticated",
              app_metadata: { provider: "email" },
              user_metadata: {},
              created_at: "2026-10-18T00:00:00Z",
            },
          }),
        );
      },
      { token, exp, account },
    );
    await context.route(
      "https://zievvkvcifigwmcvezsb.supabase.co/**",
      async (route) => {
        const req = route.request();
        const url = req.url();
        if (url.includes("/rest/v1/form_sync_documents"))
          return route.fulfill({ json: cloud });
        if (url.includes("/rest/v1/rpc/form_sync_write")) {
          const input = req.postDataJSON();
          if (input.expected_revision !== (cloud?.revision ?? 0))
            return route.fulfill({
              status: 409,
              json: { code: "40001", message: "revision_conflict" },
            });
          cloud = {
            revision: (cloud?.revision ?? 0) + 1,
            payload: input.document,
          };
          return route.fulfill({ json: cloud });
        }
        if (url.includes("/auth/v1/logout"))
          return route.fulfill({ status: 204 });
        return route.fulfill({
          status: 400,
          json: { message: "Unexpected auth request" },
        });
      },
    );
    const page = await context.newPage();
    await page.goto(baseURL + "#/settings");
    await expect(
      page.locator("#sync").getByText("เลือกข้อมูลเริ่มต้น", { exact: true }),
    ).toBeVisible();
    return { context, page };
  }
  try {
    const a = await connect();
    a.page.on("dialog", (d) => d.accept());
    await a.page
      .getByRole("button", {
        name: "ใช้ข้อมูลอุปกรณ์นี้บนทุกอุปกรณ์",
        exact: true,
      })
      .click();
    await expect(a.page.locator("#sync").getByText("ซิงก์แล้ว", { exact: true })).toBeVisible();
    await a.page.getByLabel("น้ำหนัก (kg)", { exact: true }).fill("80");
    await a.page
      .getByRole("button", { name: "บันทึกโปรไฟล์", exact: true })
      .click();
    await expect.poll(() => cloud?.payload.data.profile[0].weight).toBe(80);
    const b = await connect();
    b.page.on("dialog", (d) => d.accept());
    await b.page
      .getByRole("button", { name: "ใช้ข้อมูลจากคลาวด์", exact: true })
      .click();
    await expect(
      b.page.getByLabel("น้ำหนัก (kg)", { exact: true }),
    ).toHaveValue("80");
    await b.context.setOffline(true);
    await b.page
      .getByLabel("เป้าหมาย", { exact: true })
      .fill("Offline phone goal");
    await b.page
      .getByRole("button", { name: "บันทึกโปรไฟล์", exact: true })
      .click();
    await expect(
      b.page.locator("#sync").getByText("ออฟไลน์ · จะซิงก์เมื่อเชื่อมต่อ", { exact: true }),
    ).toBeVisible();
    await b.context.setOffline(false);
    await expect
      .poll(() => cloud?.payload.data.profile[0].goals)
      .toBe("Offline phone goal");
    await a.page
      .getByRole("button", { name: "ซิงก์ตอนนี้", exact: true })
      .click();
    await expect(a.page.getByLabel("เป้าหมาย", { exact: true })).toHaveValue(
      "Offline phone goal",
    );
    // A stale offline edit must not overwrite a later cloud edit.
    await b.context.setOffline(true);
    await b.page.getByLabel("น้ำหนัก (kg)", { exact: true }).fill("81");
    await b.page
      .getByRole("button", { name: "บันทึกโปรไฟล์", exact: true })
      .click();
    await a.page.getByLabel("น้ำหนัก (kg)", { exact: true }).fill("82");
    await a.page
      .getByRole("button", { name: "บันทึกโปรไฟล์", exact: true })
      .click();
    await expect.poll(() => cloud?.payload.data.profile[0].weight).toBe(82);
    await b.context.setOffline(false);
    await expect(
      b.page.locator("#sync").getByText("พบข้อมูลขัดแย้ง", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => cloud?.payload.data.profile[0].weight).toBe(82);
    await expect(
      b.page.getByLabel("น้ำหนัก (kg)", { exact: true }),
    ).toHaveValue("81");
    await b.page
      .getByRole("button", { name: "ใช้ข้อมูลจากคลาวด์", exact: true })
      .click();
    await expect(
      b.page.getByLabel("น้ำหนัก (kg)", { exact: true }),
    ).toHaveValue("82");
    await b.page
      .getByRole("button", { name: "ออกจากระบบอุปกรณ์นี้", exact: true })
      .click();
    await expect(
      b.page.locator("#sync").getByText("ยังไม่ได้เข้าสู่ระบบ", { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

