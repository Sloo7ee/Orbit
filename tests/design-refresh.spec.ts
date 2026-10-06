import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { designFixture } from "./helpers/design-fixture";
import { navigate } from "./helpers/navigation";
for (const theme of ["Light", "Dark"]) {
  test(`design review: ${theme} Home, Calendar, Grades, Focus, Notes and narrow layout`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90000);
    const f = await designFixture();
    try {
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(f.account.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill(f.account.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.getByRole("button", { name: theme + " appearance" }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const main = page.getByRole("main");
      await expect(main.locator(".weekly-focus")).toContainText("30m");
      await expect(main.locator(".home-summaries")).toContainText(
        "Midterm exam",
      );
      for (const path of ["/", "/calendar", "/grades", "/focus", "/notes"]) {
        if (path !== "/") await navigate(page, path);
        if (path === "/notes")
          await page.getByRole("button", { name: /^Vector spaces/ }).click();
        if (path === "/notes")
          await expect(
            page.getByRole("textbox", { name: "Note content", exact: true }),
          ).toContainText("vector space");
        await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/" || path === "/calendar")
          await expect(main.locator(".fc-timegrid")).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        expect(
          await main
            .locator(".page-enter")
            .evaluate((el) =>
              parseFloat(getComputedStyle(el).animationDuration),
            ),
        ).toBeLessThanOrEqual(0.00001);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.orbit/screenshots/refresh-${browserName}-${theme}-${path.slice(1) || "home"}.png`,
          fullPage: true,
        });
      }
      await navigate(page, "/calendar");
      const event = main
        .locator(".fc-timegrid-event")
        .filter({ hasText: "Linear algebra" })
        .first();
      await event.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveClass(/anchored-editor/);
      await expect(
        dialog.getByRole("radio", { name: "Lavender", exact: true }),
      ).toBeChecked();
      await dialog
        .getByRole("radio", { name: "Lavender", exact: true })
        .focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        dialog.getByRole("radio", { name: "Sky", exact: true }),
      ).toBeChecked();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
      await page.screenshot({
        path: `.orbit/screenshots/refresh-${browserName}-${theme}-editor.png`,
      });
      await page.setViewportSize({ width: 1000, height: 900 });
      await expect
        .poll(async () => {
          const b = await dialog.boundingBox();
          return b!.x + b!.width;
        })
        .toBeLessThanOrEqual(1000);
      await page.setViewportSize({ width: 820, height: 1000 });
      await expect
        .poll(async () => {
          const b = await dialog.boundingBox();
          return b!.x + b!.width;
        })
        .toBeLessThanOrEqual(820);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await dialog
        .getByRole("button", { name: "Save event", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect
        .poll(
          async () =>
            (
              await f.account.client
                .from("calendar_events")
                .select("color")
                .eq("title", "Linear algebra")
                .single()
            ).data?.color,
        )
        .toBe("#c9e2ff");
      await event.click();
      await expect(
        dialog.getByRole("radio", { name: "Sky", exact: true }),
      ).toBeChecked();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await page.setViewportSize({ width: 820, height: 1000 });
      await navigate(page, "/");
      await expect(main.locator(".weekly-focus")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.orbit/screenshots/refresh-${browserName}-${theme}-narrow.png`,
        fullPage: true,
      });
    } finally {
      await f.clients.admin.auth.admin.deleteUser(f.account.id);
    }
  });
}
