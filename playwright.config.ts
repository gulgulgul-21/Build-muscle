import { defineConfig } from "@playwright/test";
const base = process.env.VITE_BASE_PATH || "/";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 10000,
    baseURL: `http://127.0.0.1:4173${base}`,
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: `http://127.0.0.1:4173${base}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
