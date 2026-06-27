import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

// 即时导航防回归：首页 Hero 链接开了 <Link prefetch>，详情页 export const prefetch = "allow-runtime"，
// 故点击 Hero 卡应「即时」显示详情标题——无需等 getDetail 的网络往返（详情壳本身只是无文本骨架）。
// 若有人去掉 Hero 的 prefetch、详情页的 allow-runtime，或把详情页改成 Block(instant=false)，
// instant() 闭包内的断言会因需要等网络而失败。
test("首页 Hero → 详情页即时显示标题", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('a[href^="/title/"]').first();
  await hero.waitFor({ state: "visible" });
  // Hero 卡首行文本即影片标题（详情页 heading 同名）
  const title = (await hero.innerText()).trim().split("\n")[0].trim();
  expect(title.length).toBeGreaterThan(0);

  await instant(page, async () => {
    await hero.click();
    await expect(page).toHaveURL(/\/title\//);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  });
});
