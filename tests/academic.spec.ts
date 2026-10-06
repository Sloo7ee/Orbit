import { fillDateTime } from "./helpers/pickers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DateTime } from "luxon";
import { localClients, createTestUser } from "./helpers/local-supabase";
test("courses and calendar CRUD, gestures, persistence, history and both themes", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  page.on("pageerror", (error) => console.error(error.message));
  const clients = localClients(),
    account = await createTestUser(clients);
  const semester = crypto.randomUUID();
  try {
    await account.client.rpc("save_profile", {
      p_name: "Orbit Test",
      p_timezone: "Asia/Riyadh",
      p_revision: 0,
    });
    await account.client.rpc("create_semester", {
      p_id: semester,
      p_name: "Calendar term",
      p_start: "2026-01-01",
      p_end: "2027-12-31",
    });
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Courses", exact: true }).click();
    await page.getByRole("button", { name: "Add course", exact: true }).click();
    await page.getByLabel("Course code", { exact: true }).fill("M101");
    await page.getByLabel("Course name", { exact: true }).fill("Calculus");
    await page
      .getByLabel("Instructor (optional)", { exact: true })
      .fill("Dr. Test");
    await page
      .getByRole("button", { name: "Save course", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Calculus", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit M101" }).click();
    await page.getByLabel("Course name", { exact: true }).fill("Calculus I");
    await page
      .getByRole("button", { name: "Save course", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Calculus I", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.locator(".fc-timegrid")).toBeVisible();
    await page.getByRole("button", { name: "New event", exact: true }).click();
    const start = DateTime.now()
      .setZone("Asia/Riyadh")
      .minus({ days: DateTime.now().setZone("Asia/Riyadh").weekday % 7 })
      .plus({ days: 1 })
      .startOf("day")
      .set({ hour: 10 });
    await page.getByLabel("Title", { exact: true }).fill("Lecture");
    await fillDateTime(page, "Start", start.toFormat("yyyy-MM-dd'T'HH:mm"));
    await fillDateTime(
      page,
      "End",
      start.plus({ hours: 1 }).toFormat("yyyy-MM-dd'T'HH:mm"),
    );
    await page
      .getByRole("combobox", { name: "Course", exact: true })
      .selectOption({ label: "M101 · Calculus I" });
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const block = page
      .locator(".fc-timegrid-event")
      .filter({ hasText: /lecture/i });
    await expect(block).toBeVisible();
    await expect(block).toContainText("M101");
    await expect(block).toHaveCSS("background-color", "rgb(81, 73, 99)");
    await block.click();
    await page.getByLabel("Title", { exact: true }).fill("Calculus lecture");
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    let record = (
      await account.client.from("calendar_events").select("*").single()
    ).data!;
    const original = record.starts_at;
    // Prior form saves have their own confirmations; observe this gesture separately.
    await expect(
      page.locator(".action-notifications [role=status]"),
    ).toHaveCount(0, { timeout: 10000 });
    const box = await block.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 15, box!.y + 15);
    await page.mouse.down();
    await page.mouse.move(box!.x + 15, box!.y + 75, { steps: 20 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            await account.client
              .from("calendar_events")
              .select("starts_at")
              .single()
          ).data?.starts_at,
      )
      .not.toBe(original);
    await expect(
      page.getByRole("status").filter({ hasText: "Event updated" }),
    ).toBeVisible();
    record = (await account.client.from("calendar_events").select("*").single())
      .data!;
    const originalEnd = record.ends_at;
    const handle = block.locator(".fc-event-resizer-end");
    await expect(block).toHaveCount(1);
    await block.hover();
    const hb = await handle.boundingBox();
    expect(hb).not.toBeNull();
    await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2 + 56, {
      steps: 20,
    });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            await account.client
              .from("calendar_events")
              .select("ends_at")
              .single()
          ).data?.ends_at,
      )
      .not.toBe(originalEnd);
    await page.reload();
    await expect(block).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page
        .getByRole("button", {
          name: theme === "dark" ? "Dark appearance" : "Light appearance",
          exact: true,
        })
        .click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/phase3-${theme}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(page.locator(".fc-dayGridMonth-view")).toBeVisible();
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await expect(page.locator(".fc-timeGridDay-view")).toBeVisible();
    const context = await browser.newContext();
    const second = await context.newPage();
    await second.goto("/sign-in");
    await second.getByLabel("Email", { exact: true }).fill(account.email);
    await second.getByLabel("Password", { exact: true }).fill(account.password);
    await second.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      second
        .locator(".fc-timegrid-event")
        .filter({ hasText: "Calculus lecture" }),
    ).toBeVisible();
    await context.close();
    await account.client.rpc("archive_semester", {
      p_id: semester,
      p_revision: 1,
      p_archive: true,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "New event", exact: true }),
    ).toHaveCount(0);
    await page.goto("/courses");
    await expect(
      page.getByRole("heading", { name: "Calculus I" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add course" })).toHaveCount(
      0,
    );
    await account.client.rpc("archive_semester", {
      p_id: semester,
      p_revision: 2,
      p_archive: false,
    });
    await page.reload();
    await page.getByRole("button", { name: "Delete M101" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "All linked calendar events will remain",
    );
    await page
      .getByRole("button", { name: "Delete course", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
      (await account.client.from("calendar_events").select("*").single()).data
        ?.course_id,
    ).toBeNull();
    await page.goto("/calendar");
    await page
      .locator(".fc-timegrid-event")
      .filter({ hasText: "Calculus lecture" })
      .click();
    await page
      .getByRole("button", { name: "Delete event", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete event", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".fc-timegrid-event")).toHaveCount(0);
  } finally {
    await clients.admin.auth.admin.deleteUser(account.id);
  }
});
