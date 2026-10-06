import { test, expect, type Page, type Route } from "@playwright/test";
import { DateTime } from "luxon";
import { localClients, createTestUser } from "./helpers/local-supabase";
async function fixture(page: Page) {
  const clients = localClients(),
    account = await createTestUser(clients);
  const semester = crypto.randomUUID(),
    course = crypto.randomUUID(),
    event = crypto.randomUUID();
  await account.client.rpc("save_profile", {
    p_name: "Verification",
    p_timezone: "Asia/Riyadh",
    p_revision: 0,
  });
  await account.client.rpc("create_semester", {
    p_id: semester,
    p_name: "First term",
    p_start: "2026-01-01",
    p_end: "2027-12-31",
  });
  const courseArgs = {
    p_id: course,
    p_semester: semester,
    p_revision: 0,
    p_code: "C101",
    p_name: "Test course",
    p_instructor: "",
    p_color: "#79c5ab",
  };
  await account.client.rpc("save_course", courseArgs);
  const start = DateTime.now()
    .setZone("Asia/Riyadh")
    .minus({ days: DateTime.now().setZone("Asia/Riyadh").weekday % 7 })
    .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  const eventArgs = {
    p_id: event,
    p_semester: semester,
    p_revision: 0,
    p_title: "Original event",
    p_start: start.toISO()!,
    p_end: start.plus({ hours: 1 }).toISO()!,
    p_course: course,
    p_color: "#79c5ab",
  };
  await account.client.rpc("save_event", eventArgs);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".fc-timegrid-event")).toBeVisible();
  return { clients, account, semester, course, event, courseArgs, eventArgs };
}
test("failed gestures roll back; stale event and course edits retain drafts", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    const block = page.locator(".fc-timegrid-event");
    const before = await block.boundingBox();
    const gridBefore = await page.locator(".fc-timegrid-slots").boundingBox();
    for (const resize of [false, true]) {
      await expect(page.locator(".calendar-feedback")).toHaveText(
        "Click a time to add an event",
      );
      const record = (
        await f.account.client.from("calendar_events").select("*").single()
      ).data!;
      // Other features also POST server-action reads. Fail this event mutation only.
      const isMutation = (request: import("@playwright/test").Request) =>
        request.method() === "POST" && !!request.postData()?.includes(f.event);
      const rejectMutation = (route: Route) =>
        isMutation(route.request()) ? route.abort() : route.continue();
      await page.route("http://127.0.0.1:3001/", rejectMutation);
      await block.hover();
      if (resize)
        await expect(block.locator(".fc-event-resizer-end")).toBeVisible();
      // WebKit can finish the calendar's initial scroll after hover. Wait for
      // centering to settle before measuring; never drag beyond the viewport.
      await expect
        .poll(async () => {
          await block.evaluate(async (el) => {
            el.scrollIntoView({
              block: "center",
              inline: "nearest",
              behavior: "instant",
            });
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
          });
          const eventBox = await block.boundingBox();
          const scrollBox = await page
            .locator(".fc-scroller-liquid-absolute")
            .boundingBox();
          const bottom = Math.min(
            page.viewportSize()!.height,
            scrollBox!.y + scrollBox!.height,
          );
          return (
            eventBox!.y > Math.max(0, scrollBox!.y) + 10 &&
            eventBox!.y + eventBox!.height + 60 < bottom - 10
          );
        })
        .toBe(true);
      await block.hover();
      if (resize)
        await expect(block.locator(".fc-event-resizer-end")).toBeVisible();
      const b = await (
        resize ? block.locator(".fc-event-resizer-end") : block
      ).boundingBox();
      expect(b).not.toBeNull();
      const x = b!.x + 10,
        y = b!.y + (resize ? b!.height / 2 : 12);
      const viewport = page.viewportSize()!;
      const scroller = await page
        .locator(".fc-scroller-liquid-absolute")
        .boundingBox();
      expect(y).toBeGreaterThan(Math.max(0, scroller!.y));
      expect(y + 60).toBeLessThan(
        Math.min(viewport.height, scroller!.y + scroller!.height) - 10,
      );
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 60, { steps: 20 });
      const failedRequest = page.waitForEvent("requestfailed", {
        predicate: isMutation,
        timeout: 5000,
      });
      await page.mouse.up();
      await failedRequest;
      await page.unroute("http://127.0.0.1:3001/", rejectMutation);
      await expect(page.locator(".form-error")).toContainText(
        "Connection interrupted",
      );
      expect(
        (await f.account.client.from("calendar_events").select("*").single())
          .data,
      ).toEqual(record);
      await expect(block).toHaveCount(1);
      const after = await block.boundingBox();
      const gridAfter = await page.locator(".fc-timegrid-slots").boundingBox();
      expect(
        Math.abs(after!.y - gridAfter!.y - (before!.y - gridBefore!.y)),
      ).toBeLessThan(2);
      expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
    }
    await block.click();
    await page.getByLabel("Title", { exact: true }).fill("Unsaved event");
    await f.account.client.rpc("save_event", {
      ...f.eventArgs,
      p_revision: 1,
      p_title: "Remote event",
    });
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await expect(page.getByRole("dialog").locator(".form-error")).toContainText(
      "changed in another session",
    );
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Unsaved event",
    );
    await page.getByRole("button", { name: "Close editor" }).click();
    await page.goto("/courses");
    await page.getByRole("button", { name: "Edit C101" }).click();
    await page
      .getByLabel("Course name", { exact: true })
      .fill("Unsaved course");
    await f.account.client.rpc("save_course", {
      ...f.courseArgs,
      p_revision: 1,
      p_name: "Remote course",
    });
    await page
      .getByRole("button", { name: "Save course", exact: true })
      .click();
    await expect(page.locator(".form-error")).toContainText(
      "changed in another session",
    );
    await expect(page.getByLabel("Course name", { exact: true })).toHaveValue(
      "Unsaved course",
    );
  } finally {
    await f.account.client.rpc("delete_academic", {
      p_kind: "event",
      p_id: f.event,
      p_semester: f.semester,
      p_revision: 2,
    });
    await f.account.client.rpc("delete_academic", {
      p_kind: "course",
      p_id: f.course,
      p_semester: f.semester,
      p_revision: 2,
    });
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("semester switching isolates data, linked color defaults and historical details remain accessible", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.getByRole("button", { name: "New event", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Course", exact: true })
      .selectOption(f.course);
    await expect(
      page.getByRole("dialog").locator("input[name=color]"),
    ).toHaveValue("#79c5ab");
    await page.getByRole("button", { name: "Close editor" }).click();
    const other = crypto.randomUUID();
    await f.account.client.rpc("create_semester", {
      p_id: other,
      p_name: "Other term",
      p_start: "2027-01-01",
      p_end: "2027-12-31",
    });
    await page.reload();
    await expect(page.getByLabel("Selected semester")).toHaveValue(other);
    await expect(page.locator(".fc-timegrid-event")).toHaveCount(0);
    await page.goto("/courses");
    await expect(
      page.getByRole("heading", { name: "No courses yet" }),
    ).toBeVisible();
    await page.getByLabel("Selected semester").selectOption(f.semester);
    await expect(
      page.getByRole("heading", { name: "Test course", exact: true }),
    ).toBeVisible();
    await f.account.client.rpc("archive_semester", {
      p_id: f.semester,
      p_revision: 1,
      p_archive: true,
    });
    await page.goto("/calendar");
    await page.locator(".fc-timegrid-event").click();
    await expect(page.getByRole("dialog")).toContainText("Original event");
    await expect(page.getByRole("dialog")).toContainText("Read only");
    await expect(
      page.getByRole("button", { name: "Save event", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Close editor" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await f.account.client.rpc("archive_semester", {
      p_id: f.semester,
      p_revision: 2,
      p_archive: false,
    });
    await f.account.client.rpc("delete_academic", {
      p_kind: "event",
      p_id: f.event,
      p_semester: f.semester,
      p_revision: 1,
    });
    await f.account.client.rpc("delete_academic", {
      p_kind: "course",
      p_id: f.course,
      p_semester: f.semester,
      p_revision: 1,
    });
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
