import { fillDateTime } from "./helpers/pickers";
import { navigate } from "./helpers/navigation";
import { test, expect, type Page } from "@playwright/test";
import { DateTime } from "luxon";
import AxeBuilder from "@axe-core/playwright";
import { localClients, createTestUser } from "./helpers/local-supabase";
const now = DateTime.now().setZone("Asia/Riyadh");
const sunday = now.startOf("day").minus({ days: now.weekday % 7 });
const day = (n: number) => sunday.plus({ days: n }).toISODate()!;
async function signIn(
  page: Page,
  account: { email: string; password: string },
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function fixture(page: Page, seed = false) {
  const clients = localClients(),
    account = await createTestUser(clients);
  const semester = crypto.randomUUID(),
    course = crypto.randomUUID(),
    schedule = crypto.randomUUID();
  await account.client.rpc("save_profile", {
    p_name: "Recurring Test",
    p_timezone: "Asia/Riyadh",
    p_revision: 0,
  });
  await account.client.rpc("create_semester", {
    p_id: semester,
    p_name: "Recurring term",
    p_start: day(-7),
    p_end: day(42),
  });
  await account.client.rpc("save_course", {
    p_id: course,
    p_semester: semester,
    p_revision: 0,
    p_code: "PHY101",
    p_name: "Physics",
    p_instructor: "Dr Test",
    p_color: "#79c5ab",
  });
  if (seed)
    expect(
      (
        await account.client.rpc("change_schedule", {
          p_request: crypto.randomUUID(),
          p_id: schedule,
          p_revision: 0,
          p_scope: "create",
          p_original: null,
          p_delete: false,
          p_payload: {
            course_id: course,
            weekdays: [0, 2, 4],
            start_time: "09:00",
            end_time: "10:00",
            location: "Room 101",
            effective_start: day(-7),
            effective_end: day(42),
          },
        })
      ).error,
    ).toBeNull();
  await signIn(page, account);
  return { clients, account, semester, course, schedule };
}
const event = (page: Page, date: string, time = "9:00") =>
  page
    .locator(`.fc-timegrid-col[data-date="${date}"] .fc-timegrid-event`)
    .filter({ hasText: "Physics" })
    .filter({ hasText: time });
async function save(page: Page) {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function scoped(page: Page, scope: string) {
  await page
    .getByRole("combobox", { name: "Apply to", exact: true })
    .selectOption(scope);
  if (scope !== "one")
    await page.getByRole("checkbox", { name: /Apply this schedule/ }).check();
}
test("weekly blocks, single exceptions, future splits/deletes, entire-series changes and session persistence", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const f = await fixture(page);
  try {
    await navigate(page, "/courses");
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await page
      .getByRole("button", { name: "Add weekly schedule", exact: true })
      .click();
    const sundayPill = await page
      .getByRole("checkbox", { name: "Sunday", exact: true })
      .boundingBox();
    const saturdayPill = await page
      .getByRole("checkbox", { name: "Saturday", exact: true })
      .boundingBox();
    expect(Math.abs(sundayPill!.y - saturdayPill!.y)).toBeLessThan(2);
    await page.screenshot({
      animations: "disabled",
      path: `.orbit/screenshots/phase5-weekdays-${testInfo.project.name}.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const picker = await page.locator(".weekday-options").boundingBox();
    const lastPill = await page
      .getByRole("checkbox", { name: "Saturday", exact: true })
      .boundingBox();
    expect(lastPill!.x + lastPill!.width).toBeLessThanOrEqual(
      picker!.x + picker!.width + 1,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('input[name="effective_start"]')).toHaveValue(
      day(-7),
    );
    await expect(
      page.locator('input[name="effective_end"]'),
    ).toHaveValue(day(42));
    await page
      .getByLabel("Location (optional)", { exact: true })
      .fill("Room 101");
    await page
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".schedule-row")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Add weekly schedule", exact: true })
      .click();
    await page.getByRole("checkbox", { name: "Sunday", exact: true }).uncheck();
    await page.getByLabel("Start time", { exact: true }).fill("13:00");
    await page.getByLabel("End time", { exact: true }).fill("14:00");
    await page.getByLabel("Location (optional)", { exact: true }).fill("Lab");
    await page
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".schedule-row")).toHaveCount(2);
    await navigate(page, "/calendar");
    await expect(page.locator(".fc-timegrid-event")).toHaveCount(5);
    await expect(event(page, day(0))).toHaveCSS(
      "background-color",
      "rgb(74, 96, 79)",
    );
    await expect(event(page, day(0))).toContainText("Room 101");
    // A short block must keep its title readable rather than shrink it away.
    const titleBox = await event(page, day(0)).locator("strong").boundingBox();
    expect(titleBox?.height).toBeGreaterThan(10);
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(page.locator(".fc-daygrid-event").first()).toContainText(
      "Physics",
    );
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await expect(page.locator(".fc-timeGridDay-view")).toBeVisible();
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page.locator(".fc-timegrid-event")).toHaveCount(5);
    await expect(page.locator(".calendar-feedback")).toHaveText(
      "Click a time to add an event",
    );
    await event(page, day(0)).click();
    await expect(
      page.getByRole("combobox", { name: "Apply to", exact: true }),
    ).toHaveValue("one");
    await fillDateTime(page, "Start", `${day(1)}T11:00`);
    await fillDateTime(page, "End", `${day(1)}T12:00`);
    await page
      .getByLabel("Location (optional)", { exact: true })
      .fill("Changed room");
    await save(page);
    await expect(event(page, day(1), "11:00")).toBeVisible();
    await expect(event(page, day(0))).toHaveCount(0);
    await expect(event(page, day(2))).toBeVisible();
    await event(page, day(2)).click();
    await page
      .getByRole("button", { name: "Delete recurring meeting", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete meetings", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(event(page, day(2))).toHaveCount(0);
    await event(page, day(4)).click();
    await scoped(page, "future");
    await page.getByLabel("Start time", { exact: true }).fill("10:00");
    await page.getByLabel("End time", { exact: true }).fill("11:00");
    await save(page);
    await expect(event(page, day(4), "10:00")).toBeVisible();
    await expect(event(page, day(1), "11:00")).toBeVisible();
    expect(
      (await f.account.client.from("schedule_exceptions").select("*")).data,
    ).toHaveLength(2);
    expect(
      (await f.account.client.from("course_schedules").select("*")).data,
    ).toHaveLength(3);
    await event(page, day(4), "10:00").click();
    await page
      .getByRole("button", { name: "Delete recurring meeting", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Apply to", exact: true })
      .selectOption("future");
    await page.getByRole("checkbox", { name: /Delete all meetings/ }).check();
    await page
      .getByRole("button", { name: "Delete meetings", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(event(page, day(4), "10:00")).toHaveCount(0);
    await event(page, day(2), "1:00").click();
    await scoped(page, "all");
    await page.getByLabel("Start time", { exact: true }).fill("14:00");
    await page.getByLabel("End time", { exact: true }).fill("15:00");
    await save(page);
    await expect(event(page, day(2), "2:00")).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page
        .getByRole("button", {
          name: theme === "dark" ? "Dark appearance" : "Light appearance",
          exact: true,
        })
        .click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/phase4-${testInfo.project.name}-${theme}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
    await event(page, day(2), "2:00").click();
    await page
      .getByRole("button", { name: "Delete recurring meeting", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Apply to", exact: true })
      .selectOption("all");
    await page.getByRole("checkbox", { name: /Delete all meetings/ }).check();
    await page
      .getByRole("button", { name: "Delete meetings", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator(".fc-timegrid-event")).toHaveCount(1);
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await signIn(page, f.account);
    await expect(event(page, day(1), "11:00")).toContainText("Changed room");
    const context = await browser.newContext();
    const second = await context.newPage();
    await signIn(second, f.account);
    await expect(event(second, day(1), "11:00")).toBeVisible();
    await context.close();
  } finally {
    expect(
      (await f.clients.admin.auth.admin.deleteUser(f.account.id)).error,
    ).toBeNull();
  }
});
test("recurring drag/resize requests scope, cancellation and network failure preserve originals; stale edits and archived history", async ({
  page,
}) => {
  test.setTimeout(90000);
  const f = await fixture(page, true);
  try {
    const block = event(page, day(0));
    await expect(block).toBeVisible();
    let box = await block.boundingBox();
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.mouse.down();
    await page.mouse.move(box!.x + 12, box!.y + 68, { steps: 20 });
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      (await f.account.client.from("schedule_exceptions").select("*")).data,
    ).toHaveLength(0);
    await page.getByRole("button", { name: "Close editor" }).click();
    await expect(block).toBeVisible();
    box = await block.boundingBox();
    await page.mouse.move(box!.x + 12, box!.y + 12);
    await page.mouse.down();
    await page.mouse.move(box!.x + 12, box!.y + 68, { steps: 20 });
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.route(
      "http://127.0.0.1:3001/",
      (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue(),
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog").locator(".form-error")).toContainText(
      "Connection interrupted",
    );
    expect(
      (await f.account.client.from("schedule_exceptions").select("*")).data,
    ).toHaveLength(0);
    await save(page);
    const moved = (
      await f.account.client.from("schedule_exceptions").select("*").single()
    ).data!;
    expect(moved.original_date).toBe(day(0));
    const movedBlock = event(page, day(0), "10:00");
    await expect(movedBlock).toBeVisible();
    await movedBlock.hover();
    const handle = movedBlock.locator(".fc-event-resizer-end");
    await expect(handle).toBeVisible();
    box = await handle.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2 + 56,
      { steps: 20 },
    );
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toBeVisible();
    await save(page);
    const resized = (
      await f.account.client.from("schedule_exceptions").select("*").single()
    ).data!;
    expect(resized.original_date).toBe(day(0));
    expect(Date.parse(resized.ends_at!)).toBeGreaterThan(
      Date.parse(moved.ends_at!),
    );
    await movedBlock.click();
    await page
      .getByLabel("Location (optional)", { exact: true })
      .fill("Unsaved draft");
    const revision = (
      await f.account.client
        .from("course_schedules")
        .select("*")
        .eq("id", f.schedule)
        .single()
    ).data!.revision;
    await f.account.client.rpc("change_schedule", {
      p_request: crypto.randomUUID(),
      p_id: f.schedule,
      p_revision: revision,
      p_scope: "one",
      p_original: day(2),
      p_delete: true,
      p_payload: {},
    });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".form-error")).toContainText(
      "changed in another session",
    );
    await expect(
      page.getByLabel("Location (optional)", { exact: true }),
    ).toHaveValue("Unsaved draft");
    await page.getByRole("button", { name: "Close editor" }).click();
    await f.account.client.rpc("archive_semester", {
      p_id: f.semester,
      p_revision: 1,
      p_archive: true,
    });
    await page.reload();
    await movedBlock.click();
    await expect(page.getByRole("dialog")).toContainText("Read only");
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Close editor" }).click();
    await navigate(page, "/courses");
    await page.getByRole("button", { name: /^Schedule/ }).click();
    await expect(
      page.getByRole("button", { name: "Add weekly schedule", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "View schedule", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Read only");
  } finally {
    expect(
      (await f.clients.admin.auth.admin.deleteUser(f.account.id)).error,
    ).toBeNull();
  }
});

test("a moved meeting appears in a different range exactly once and keeps its original identity when edited again", async ({
  page,
}) => {
  const f = await fixture(page, true);
  try {
    await event(page, day(0)).click();
    await fillDateTime(page, "Start", `${day(15)}T11:00`);
    await fillDateTime(page, "End", `${day(15)}T12:00`);
    await save(page);
    await expect(event(page, day(0))).toHaveCount(0);
    await page
      .getByRole("button", { name: "Next period", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Next period", exact: true })
      .click();
    const moved = event(page, day(15), "11:00");
    await expect(moved).toHaveCount(1);
    await moved.click();
    await page
      .getByLabel("Location (optional)", { exact: true })
      .fill("Moved twice");
    await save(page);
    await expect(moved).toContainText("Moved twice");
    const rows = (
      await f.account.client.from("schedule_exceptions").select("*")
    ).data!;
    expect(rows).toHaveLength(1);
    expect(rows[0].original_date).toBe(day(0));
    await page.reload();
    await expect(event(page, day(0))).toHaveCount(0);
  } finally {
    expect(
      (await f.clients.admin.auth.admin.deleteUser(f.account.id)).error,
    ).toBeNull();
  }
});
