import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DateTime } from "luxon";
import { designFixture } from "./helpers/design-fixture";
import { navigate } from "./helpers/navigation";
async function signIn(
  page: Page,
  account: Awaited<ReturnType<typeof designFixture>>["account"],
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
for (const theme of ["Light", "Dark"]) {
  test(`polish: ${theme} adaptive calendar cards`, async ({
    page,
    browserName,
  }) => {
    const f = await designFixture();
    try {
      const today = DateTime.now().setZone("Asia/Riyadh").startOf("day");
      expect(
        (
          await f.clients.admin
            .from("calendar_events")
            .delete()
            .eq("owner_id", f.account.id)
            .gte("starts_at", today.toISO()!)
            .lt("starts_at", today.plus({ days: 1 }).toISO()!)
        ).error,
      ).toBeNull();
      for (const [i, minutes] of [15, 60, 180].entries()) {
        const { error } = await f.account.client.rpc("change_schedule", {
          p_request: crypto.randomUUID(),
          p_id: crypto.randomUUID(),
          p_revision: 0,
          p_scope: "create",
          p_original: null,
          p_delete: false,
          p_payload: {
            course_id: f.course,
            weekdays: [today.weekday % 7],
            start_time: `${8 + i * 2}:00`.padStart(5, "0"),
            end_time: today
              .plus({ hours: 8 + i * 2, minutes })
              .toFormat("HH:mm"),
            location: `Room ${minutes}`,
            effective_start: today.toISODate(),
            effective_end: today.plus({ days: 7 }).toISODate(),
          },
        });
        expect(error).toBeNull();
      }
      await signIn(page, f.account);
      await page.getByRole("button", { name: theme + " appearance" }).click();
      await navigate(page, "/calendar");
      await expect(page.locator(".calendar-feedback")).toContainText(
        "Click a time",
      );
      for (const [minutes, metadata] of [
        [15, 0],
        [60, 1],
        [180, 2],
      ]) {
        const card = page.locator(
          `.fc-timegrid-event[aria-label*="Room ${minutes}"]`,
        );
        await expect(card).toHaveCount(1);
        const visible = card.locator("small:visible");
        await expect(visible).toHaveCount(metadata);
        await expect(card.locator("strong")).toBeVisible();
        await expect(card.locator("span")).toBeVisible();
        // Every displayed text line stays inside its card; hidden metadata stays in the accessible label.
        const fits = await card.evaluate((el) => {
          const bounds = el.getBoundingClientRect();
          return [...el.querySelectorAll("strong,span,small")]
            .filter((n) => getComputedStyle(n).display !== "none")
            .every((n) => {
              const r = n.getBoundingClientRect();
              return r.top >= bounds.top && r.bottom <= bounds.bottom + 1;
            });
        });
        expect(fits).toBe(true);
      }
      await page.screenshot({
        path: `.orbit/screenshots/polish-${browserName}-${theme}-calendar.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Day", exact: true }).click();
      await expect(
        page.locator('.fc-timegrid-event[aria-label*="Room 15"] small:visible'),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Month", exact: true }).click();
      await expect(
        page.locator('.fc-daygrid-event[aria-label*="Room 15"]').first(),
      ).toBeVisible();
      await expect(
        page.locator('.fc-daygrid-event[aria-label^="Task due:"]').first(),
      ).toBeVisible();
      await expect(
        page
          .locator('.fc-daygrid-event[aria-label^="Assessment due:"]')
          .first(),
      ).toBeVisible();
      // Scope this review to changed event cards; adjacent-month date dimming predates this pass.
      expect(
        (await new AxeBuilder({ page }).include(".fc-event").analyze())
          .violations,
      ).toEqual([]);
    } finally {
      await f.clients.admin.auth.admin.deleteUser(f.account.id);
    }
  });
  test(`polish: ${theme} action confirmations, stacking, errors and no layout shift`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60000);
    const f = await designFixture();
    try {
      await signIn(page, f.account);
      await page.getByRole("button", { name: theme + " appearance" }).click();
      await navigate(page, "/courses");
      const list = page.locator(".course-list");
      await list.evaluate(async (el) => {
        await Promise.all(
          el
            .closest(".page-enter")!
            .getAnimations()
            .map((a) => a.finished),
        );
      });
      const before = await list.boundingBox();
      await page
        .getByRole("button", { name: "Edit MATH 201", exact: true })
        .click();
      await page
        .getByLabel("Course name", { exact: true })
        .fill("Linear algebra revised");
      await page
        .getByRole("button", { name: "Save course", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      const stack = page.getByRole("complementary", {
        name: "Action confirmations",
      });
      await expect(stack.getByRole("status")).toHaveText(
        "Course updatedMATH 201",
      );
      expect(await list.boundingBox()).toEqual(before);
      expect(
        await stack
          .locator(".action-notice")
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("orbit-notice-in");
      expect(
        await stack.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(false);
      await stack.hover(); // Reading pauses dismissal.
      await page.waitForTimeout(3200);
      await expect(stack.getByRole("status")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/polish-${browserName}-${theme}-notification.png`,
      });
      await stack.getByRole("button").focus();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(3200);
      await expect(stack.getByRole("button")).toBeFocused();
      await page.getByRole("heading", { level: 1 }).evaluate((el) => {
        el.setAttribute("tabindex", "-1");
        el.focus();
      });
      await expect(stack.getByRole("status")).toHaveCount(0, { timeout: 5000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await navigate(page, "/todo");
      for (const name of [
        "Review chapter 4",
        "Finish problem set",
        "Read lecture notes",
      ]) {
        await page
          .getByRole("button", { name: `Complete ${name}`, exact: true })
          .click();
      }
      await expect(stack.getByRole("status")).toHaveCount(3);
      expect(
        await stack
          .locator(".action-notice")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("orbit-notice-fade");
      const boxes = await stack.locator(".action-notice").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        }),
      );
      expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
      expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom);
      await expect(stack.getByRole("status")).toHaveCount(0, { timeout: 5000 });
      await page.getByRole("button", { name: "New task", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("Polish task");
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(stack.getByRole("status")).toContainText("Task added");
      await page.getByRole("button", { name: /^Polish task/ }).click();
      await page
        .getByLabel("Title", { exact: true })
        .fill("Updated polish task");
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(
        stack.getByRole("status").filter({ hasText: "Task updated" }),
      ).toContainText("Updated polish task");
      await page.getByRole("button", { name: /^Updated polish task/ }).click();
      await page
        .getByRole("button", { name: "Delete task", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Delete task", exact: true })
        .click();
      await expect(
        stack.getByRole("status").filter({ hasText: "Task deleted" }),
      ).toContainText("Updated polish task");
      await expect
        .poll(
          async () =>
            (
              await f.account.client
                .from("tasks")
                .select("title")
                .eq("title", "Updated polish task")
            ).data?.length,
        )
        .toBe(0);
      await expect(stack.getByRole("status")).toHaveCount(0, { timeout: 5000 });
      await page.getByRole("button", { name: "New task", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("Unsaved task");
      const fail = async (route: import("@playwright/test").Route) => {
        if (route.request().method() === "POST") await route.abort();
        else await route.continue();
      };
      await page.route("**/todo", fail);
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
        "Connection interrupted",
      );
      await page.waitForTimeout(3200);
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      await expect(stack.getByRole("status")).toHaveCount(0);
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
        "Unsaved task",
      );
      await page.unroute("**/todo", fail);
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(stack.getByRole("status")).toContainText("Task added");
    } finally {
      await f.clients.admin.auth.admin.deleteUser(f.account.id);
    }
  });
}
