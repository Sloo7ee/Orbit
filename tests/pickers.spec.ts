import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DateTime } from "luxon";
import { designFixture } from "./helpers/design-fixture";
import { navigate } from "./helpers/navigation";
for (const theme of ["Light", "Dark"])
  test(`pickers: ${theme} staged date/time, keyboard, boundaries and persistence`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60000);
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
      await navigate(page, "/todo");
      await page.getByRole("button", { name: "New task", exact: true }).click();
      const parent = page.getByRole("dialog", {
        name: "New task",
        exact: true,
      });
      await parent.getByLabel("Title", { exact: true }).fill("Picker task");
      await parent.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
      await parent.getByLabel("Due date", { exact: true }).focus();
      await page.keyboard.press("Alt+ArrowDown");
      await expect(page.getByRole("dialog", { name: "Due date picker", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(parent.getByLabel("Due date", { exact: true })).toBeFocused();
      const before = await parent.boundingBox();
      const chooseDate = page.getByRole("button", {
        name: "Choose due date",
        exact: true,
      });
      await chooseDate.click();
      const date = page.getByRole("dialog", {
        name: "Due date picker",
        exact: true,
      });
      await expect(date).toBeVisible();
      expect(await parent.boundingBox()).toEqual(before);
      await date
        .getByRole("button", { name: "Next month", exact: true })
        .click();
      await date
        .getByRole("button", { name: "Previous month", exact: true })
        .click();
      const today = DateTime.now().setZone("Asia/Riyadh");
      await date.getByRole("button", { name: "Today", exact: true }).click();
      await date.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(chooseDate).toBeFocused();
      await expect(parent.locator('input[name="due_date"]')).toHaveValue("");
      await chooseDate.click();
      await date.getByRole("button", { name: "Today", exact: true }).click();
      await page.keyboard.press("ArrowRight");
      await date.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(parent.locator('input[name="due_date"]')).toHaveValue(
        today.plus({ days: 1 }).toISODate()!,
      );
      await chooseDate.click();
      await date
        .getByRole("button", { name: "Next month", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await expect(parent).toBeVisible();
      await expect(chooseDate).toBeFocused();
      await expect(parent.locator('input[name="due_date"]')).toHaveValue(
        today.plus({ days: 1 }).toISODate()!,
      );
      await page
        .getByRole("button", { name: "Choose due time", exact: true })
        .click();
      const time = page.getByRole("dialog", {
        name: "Due time picker",
        exact: true,
      });
      await time.getByLabel("Hour", { exact: true }).fill("12");
      await time.getByLabel("Minute", { exact: true }).fill("00");
      await time.getByLabel("AM", { exact: true }).check();
      await time.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(parent.locator('input[name="due_time"]')).toHaveValue(
        "00:00",
      );
      await page
        .getByRole("button", { name: "Choose due time", exact: true })
        .click();
      await time.getByLabel("PM", { exact: true }).check();
      await time.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(parent.locator('input[name="due_time"]')).toHaveValue(
        "00:00",
      );
      await page
        .getByRole("button", { name: "Choose due time", exact: true })
        .click();
      await time.getByLabel("PM", { exact: true }).check();
      await time.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(parent.locator('input[name="due_time"]')).toHaveValue(
        "12:00",
      );
      await page
        .getByRole("button", { name: "Choose due time", exact: true })
        .click();
      await time.getByLabel("Hour", { exact: true }).fill("10");
      await time
        .getByRole("button", { name: "45 minutes", exact: true })
        .click();
      await time.getByLabel("Minute", { exact: true }).fill("47");
      await time.getByLabel("AM", { exact: true }).check();
      await time.getByLabel("Minute", { exact: true }).press("Enter");
      await expect(time).toBeVisible();
      await expect(parent).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/picker-${browserName}-${theme}-time.png`,
      });
      await time.getByRole("button", { name: "Apply", exact: true }).click();
      await chooseDate.click();
      await page.setViewportSize({ width: 820, height: 700 });
      await expect
        .poll(async () => {
          const r = await date.boundingBox();
          return r!.x + r!.width;
        })
        .toBeLessThanOrEqual(820);
      const b = await date.boundingBox();
      expect(b!.x).toBeGreaterThanOrEqual(0);
      expect(b!.y).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width).toBeLessThanOrEqual(820);
      expect(b!.y + b!.height).toBeLessThanOrEqual(700);
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await date.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/picker-${browserName}-${theme}-date.png`,
      });
      await date.getByRole("button", { name: "Cancel", exact: true }).click();
      await parent
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(parent).not.toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: /^Picker task/ }).click();
      const edit = page.getByRole("dialog", {
        name: "Task details",
        exact: true,
      });
      await expect(edit.locator('input[name="due_time"]')).toHaveValue("10:47");
      const row = (
        await f.account.client
          .from("tasks")
          .select("*")
          .eq("title", "Picker task")
          .single()
      ).data!;
      expect(row.due_time).toBe("10:47:00");
      expect(row.due_date).toBe(today.plus({ days: 1 }).toISODate());
      await edit
        .getByRole("button", { name: "Remove due time", exact: true })
        .click();
      await edit
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(edit).not.toBeVisible();
      expect(
        (
          await f.account.client
            .from("tasks")
            .select("*")
            .eq("id", row.id)
            .single()
        ).data?.due_time,
      ).toBeNull();
      await page.getByRole("button", { name: /^Picker task/ }).click();
      await chooseDate.click();
      await date.getByRole("button", { name: "Clear", exact: true }).click();
      await date.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(edit.getByLabel("Due time", { exact: true })).toBeDisabled();
      await edit
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(edit).not.toBeVisible();
      expect(
        (
          await f.account.client
            .from("tasks")
            .select("*")
            .eq("id", row.id)
            .single()
        ).data?.due_date,
      ).toBeNull();
    } finally {
      await f.clients.admin.auth.admin.deleteUser(f.account.id);
    }
  });
