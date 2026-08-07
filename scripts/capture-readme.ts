import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.CODEX_USAGE_SCREENSHOT_URL ?? "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "docs", "assets");

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(`${baseUrl}/?demo=1&theme=${theme}`, { waitUntil: "networkidle" });
      await page.locator("[data-demo-ready='true']").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: path.join(outputDir, `dashboard-${theme}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`Đã tạo screenshot tại ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
