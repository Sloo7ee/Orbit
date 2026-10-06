import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localClients, createTestUser } from "./helpers/local-supabase";
import { navigate } from "./helpers/navigation";
async function fixture(page: Page) {
  const clients = localClients(),
    account = await createTestUser(clients),
    semester = crypto.randomUUID(),
    course = crypto.randomUUID(),
    task = crypto.randomUUID();
  await account.client.rpc("save_profile", {
    p_name: "Focus Tester",
    p_timezone: "Asia/Riyadh",
    p_revision: 0,
  });
  await account.client.rpc("create_semester", {
    p_id: semester,
    p_name: "Study term",
    p_start: "2026-01-01",
    p_end: "2026-12-31",
  });
  await account.client.rpc("save_course", {
    p_id: course,
    p_semester: semester,
    p_revision: 0,
    p_code: "MATH",
    p_name: "Mathematics",
    p_instructor: "",
    p_color: "#79c5ab",
  });
  await account.client.rpc("change_task", {
    p_request: crypto.randomUUID(),
    p_id: task,
    p_semester: semester,
    p_revision: 0,
    p_operation: "save",
    p_payload: {
      title: "Study Major 2",
      description: "",
      priority: "medium",
      course_id: course,
      due_date: "",
      due_time: "",
    },
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await navigate(page, "/focus");
  return { clients, account, semester, course, task };
}
async function elapse(f: Awaited<ReturnType<typeof fixture>>, ms: number) {
  const s = (
    await f.account.client
      .from("focus_sessions")
      .select("*")
      .is("ended_at", null)
      .single()
  ).data!;
  const intervals = (
    await f.account.client
      .from("focus_intervals")
      .select("*")
      .eq("session_id", s.id)
  ).data!;
  for (const i of intervals)
    expect(
      (
        await f.clients.admin
          .from("focus_intervals")
          .update({
            started_at: new Date(Date.parse(i.started_at) - ms).toISOString(),
            ended_at: new Date(Date.parse(i.ended_at) - ms).toISOString(),
          })
          .eq("id", i.id)
      ).error,
    ).toBeNull();
  expect(
    (
      await f.clients.admin
        .from("focus_sessions")
        .update({
          started_at: new Date(Date.parse(s.started_at) - ms).toISOString(),
          segment_started_at: new Date(
            Date.parse(s.segment_started_at!) - ms,
          ).toISOString(),
        })
        .eq("id", s.id)
    ).error,
  ).toBeNull();
}
const timer = (p: Page) => p.getByRole("timer");
test("stopwatch restoration, associations, accurate pauses, Home, themes and saved history", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    // Simulate a suspended renderer: only one delayed interval callback can run.
    await page.evaluate(() => {
      const until = performance.now() + 3200;
      while (performance.now() < until) {
        /* suspended rendering */
      }
    });
    await expect(timer(page)).toHaveText(/^00:0[3-9]$/);
    expect(
      (await f.account.client.from("focus_intervals").select("*")).data,
    ).toHaveLength(0);
    await elapse(f, 90000);
    await page.reload();
    await expect(timer(page)).toHaveText(/01:3\d/);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toContainText(
      "Paused",
    );
    const frozen = await timer(page).innerText();
    await navigate(page, "/calendar");
    await expect(
      page.getByRole("link", { name: "Open active focus session" }),
    ).toContainText("Paused");
    await navigate(page, "/focus");
    await expect(timer(page)).toHaveText(frozen);
    await page
      .getByRole("button", { name: "Change association", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Task (optional)", exact: true })
      .selectOption(f.task);
    await expect(
      dialog.getByRole("combobox", { name: "Course (optional)", exact: true }),
    ).toHaveValue(f.course);
    await expect(
      dialog.getByRole("combobox", { name: "Course (optional)", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByRole("button", { name: "Save association", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("main").locator(".focus-association"),
    ).toContainText("Study Major 2");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", { name: "Resume", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".orbit/screenshots/focus-" + browserName + "-narrow.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: `${theme} appearance` }).click();
      // The route URL can settle while its loading boundary is still visible.
      await expect(
        page
          .getByRole("main")
          .getByRole("heading", { name: "Focus", level: 1, exact: true }),
      ).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/focus-${browserName}-${theme}.png`,
        fullPage: true,
      });
      await navigate(page, "/");
      await expect(
        page.getByRole("main").locator(".focus-summary"),
      ).toContainText("Session paused");
      await page.screenshot({
        path: `.orbit/screenshots/focus-home-${browserName}-${theme}.png`,
        fullPage: true,
      });
      await navigate(page, "/focus");
    }
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Focusing",
    );
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("Study Major 2");
    await expect(page.getByRole("main").locator(".focus-today")).toContainText(
      "1m",
    );
    expect(
      (
        await f.account.client
          .from("tasks")
          .select("completed_at")
          .eq("id", f.task)
          .single()
      ).data?.completed_at,
    ).toBeNull();
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(f.account.email);
    await page.getByLabel("Password", { exact: true }).fill(f.account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await navigate(page, "/focus");
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("Study Major 2");
    await page.getByRole("button", { name: /Delete session from/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete session", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("No completed sessions");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("custom Pomodoro boundaries, pause/resume, skip break, ready state and no unattended cycles", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.getByRole("button", { name: "Pomodoro", exact: true }).click();
    await page.getByLabel("Focus minutes", { exact: true }).fill("1");
    await page.getByLabel("Break minutes", { exact: true }).fill("2");
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toHaveText(/0[01]:\d\d/);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toContainText(
      "Paused · focus",
    );
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Focusing",
    );
    await elapse(f, 75000);
    await page.reload();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Break",
    );
    await expect(timer(page)).toHaveText(/01:4\d/);
    await expect(
      page.getByRole("main").locator(".focus-accounting"),
    ).toContainText("1m focused");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Paused · break",
    );
    await page.getByRole("button", { name: "Skip break", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Focusing",
    );
    await elapse(f, 3600000);
    await page.reload();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Ready for next focus",
    );
    await expect(
      page.getByRole("main").locator(".focus-accounting"),
    ).toContainText("2m focused");
    await expect(timer(page)).toHaveText("01:00");
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("2m");
    expect(
      (
        await f.account.client
          .from("focus_sessions")
          .select("focused_ms")
          .single()
      ).data?.focused_ms,
    ).toBe(120000);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("failed start/pause retains confirmed state, competing tabs and stale actions cannot duplicate sessions", async ({
  page,
  context,
}) => {
  const f = await fixture(page);
  try {
    await page.route("**/focus", (r) =>
      r.request().method() === "POST" ? r.abort() : r.continue(),
    );
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start focus", exact: true }),
    ).toBeVisible();
    expect(
      (await f.account.client.from("focus_sessions").select("*")).data,
    ).toHaveLength(0);
    await page.unroute("**/focus");
    const second = await context.newPage();
    await second.goto("/focus");
    await expect(
      second.getByRole("button", { name: "Start focus", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    await second
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(
      second.getByRole("alert").filter({ hasText: "already have" }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "Refresh Focus", exact: true })
      .click();
    await expect(timer(second)).toBeVisible();
    await page.route("**/focus", (r) =>
      r.request().method() === "POST" ? r.abort() : r.continue(),
    );
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toHaveText(
      "Focusing",
    );
    await page.unroute("**/focus");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("main").locator(".focus-state")).toContainText(
      "Paused",
    );
    await second.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      second.getByRole("alert").filter({ hasText: "changed" }),
    ).toBeVisible();
    expect(
      (
        await f.account.client
          .from("focus_sessions")
          .select("*")
          .is("ended_at", null)
      ).data,
    ).toHaveLength(1);
    await second.close();
    await page
      .getByRole("button", { name: "Discard session", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard session", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start focus", exact: true }),
    ).toBeVisible();
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("semester isolation, active archive guard, and read-only historical sessions", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    expect(
      (
        await f.account.client.rpc("archive_semester", {
          p_id: f.semester,
          p_revision: 1,
          p_archive: true,
        })
      ).error?.message,
    ).toContain("active focus");
    const other = crypto.randomUUID();
    await f.account.client.rpc("create_semester", {
      p_id: other,
      p_name: "Another term",
      p_start: "2027-01-01",
      p_end: "2027-05-01",
    });
    await page.reload();
    await expect(page.getByRole("main")).toContainText(
      "Select that semester to manage it",
    );
    await expect(
      page.getByRole("button", { name: "Start focus", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(f.semester);
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }).locator("li"),
    ).toHaveCount(1);
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(other);
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("No completed sessions");
    expect(
      (
        await f.account.client.rpc("archive_semester", {
          p_id: f.semester,
          p_revision: 1,
          p_archive: true,
        })
      ).error,
    ).toBeNull();
    await page.reload();
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(f.semester);
    await expect(page.getByRole("main")).toContainText(
      "Focus history is read-only",
    );
    await expect(
      page.getByRole("button", { name: /Delete session from/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }).locator("li"),
    ).toHaveCount(1);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("long stopwatch intervals can be reviewed and trimmed without counting discarded time", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    await elapse(f, 7200000);
    await page.reload();
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Review elapsed time" }),
    ).toBeVisible();
    await page
      .getByLabel("Minutes to retain (optional)", { exact: true })
      .fill("10");
    await page
      .getByRole("button", { name: "Confirm and finish", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent focus sessions" }),
    ).toContainText("10m");
    expect(
      (
        await f.account.client
          .from("focus_sessions")
          .select("focused_ms")
          .single()
      ).data?.focused_ms,
    ).toBe(600000);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("a lost start response restores the committed session and allows the next session", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    let lost = false;
    await page.route("**/focus", async (r) => {
      if (r.request().method() === "POST" && !lost) {
        lost = true;
        await r.fetch();
        await r.abort();
      } else await r.continue();
    });
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Connection interrupted" }),
    ).toBeVisible();
    expect(
      (await f.account.client.from("focus_sessions").select("*")).data,
    ).toHaveLength(1);
    await page.unroute("**/focus");
    await page
      .getByRole("button", { name: "Refresh Focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start focus", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Start focus", exact: true })
      .click();
    await expect(timer(page)).toBeVisible();
    expect(
      (await f.account.client.from("focus_sessions").select("*")).data,
    ).toHaveLength(2);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
