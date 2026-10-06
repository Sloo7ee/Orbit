import { navigate } from "./helpers/navigation";
import { test, expect, type Page } from "@playwright/test";
import { DateTime } from "luxon";
import AxeBuilder from "@axe-core/playwright";
import { localClients, createTestUser } from "./helpers/local-supabase";
const today = DateTime.now().setZone("Asia/Riyadh").startOf("day");
const day = (n: number) => today.plus({ days: n }).toISODate()!;
async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function fixture(page: Page) {
  const clients = localClients(),
    account = await createTestUser(clients);
  const semester = crypto.randomUUID(),
    course = crypto.randomUUID();
  await account.client.rpc("save_profile", {
    p_name: "Task Tester",
    p_timezone: "Asia/Riyadh",
    p_revision: 0,
  });
  await account.client.rpc("create_semester", {
    p_id: semester,
    p_name: "Task term",
    p_start: day(-30),
    p_end: day(90),
  });
  await account.client.rpc("save_course", {
    p_id: course,
    p_semester: semester,
    p_revision: 0,
    p_code: "PHY101",
    p_name: "Physics",
    p_color: "#79c5ab",
    p_instructor: "",
  });
  await login(page, account);
  return { clients, account, semester, course };
}
async function create(
  page: Page,
  title: string,
  date = "",
  time = "",
  course = "",
) {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description (optional)").fill("Read carefully");
  if (date) await page.getByLabel("Due date", { exact: true }).fill(date);
  if (time) await page.getByLabel("Due time", { exact: true }).fill(time);
  await page
    .getByRole("combobox", { name: "Course", exact: true })
    .selectOption(course);
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
const row = (page: Page, title: string) =>
  page.locator(".task-row").filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
test("task CRUD, optional fields, sections, filters, Home/calendar, themes and session persistence", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/todo");
    await expect(
      page.getByRole("main").getByText("No tasks yet.", { exact: true }),
    ).toBeVisible();
    await create(page, "Read chapter", day(0), "", f.course);
    await create(page, "Office prep", day(0), "13:30");
    await create(page, "Someday");
    await create(page, "Late work", day(-1));
    await create(page, "Next essay", day(3));
    await expect(
      page.getByRole("region", { name: "Today", exact: true }),
    ).toContainText("Read chapter");
    await expect(
      page.getByRole("region", { name: "Overdue", exact: true }),
    ).toContainText("Late work");
    await expect(
      page.getByRole("region", { name: "No due date", exact: true }),
    ).toContainText("Someday");
    await expect(
      page.getByRole("region", { name: "Upcoming", exact: true }),
    ).toContainText("Next essay");
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption(f.course);
    await expect(page.locator(".task-row")).toHaveCount(1);
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption("none");
    await expect(page.locator(".task-row")).toHaveCount(4);
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption("all");
    await page
      .getByRole("button", { name: "Complete Read chapter", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Completed", exact: true }),
    ).toContainText("Read chapter");
    await page
      .getByRole("combobox", { name: "Status filter", exact: true })
      .selectOption("completed");
    await expect(page.locator(".task-row")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Reopen Read chapter", exact: true })
      .click();
    await expect(page.locator(".task-row")).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Status filter", exact: true })
      .selectOption("all");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const mode of ["Light", "Dark"]) {
      await page
        .getByRole("button", { name: `${mode} appearance`, exact: true })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/phase5-${browserName}-${mode.toLowerCase()}.png`,
        fullPage: true,
      });
    }
    await page.goto("/");
    await expect(page.locator(".task-summary .task-row")).toHaveCount(3);
    await expect(page.getByRole("main").locator(".task-summary")).toContainText(
      "Late work",
    );
    await page.screenshot({
      path: `.orbit/screenshots/phase5-home-${browserName}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await navigate(page, "/calendar");
    await expect(
      page
        .locator(".fc-daygrid-event.orbit-task-marker")
        .filter({ hasText: "Read chapter" }),
    ).toBeVisible();
    await expect(
      page
        .locator(".fc-timegrid-event.orbit-task-marker")
        .filter({ hasText: "Office prep" }),
    ).toBeVisible();
    await expect(
      page.locator(".orbit-task-marker").filter({ hasText: "Someday" }),
    ).toHaveCount(0);
    await page
      .locator(".orbit-task-marker")
      .filter({ hasText: "Read chapter" })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("Read revised");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(
      page.locator(".orbit-task-marker").filter({ hasText: "Read revised" }),
    ).toBeVisible();
    await page
      .locator(".orbit-task-marker")
      .filter({ hasText: "Read revised" })
      .click();
    await page
      .getByRole("button", { name: "Mark complete", exact: true })
      .click();
    await expect(
      page.locator(".orbit-task-done").filter({ hasText: "Read revised" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(
      page.locator(".orbit-task-marker").filter({ hasText: "Read revised" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await expect(
      page.locator(".orbit-task-marker").filter({ hasText: "Office prep" }),
    ).toBeVisible();
    for (const mode of ["Light", "Dark"]) {
      await page
        .getByRole("button", { name: `${mode} appearance`, exact: true })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/phase5-calendar-${browserName}-${mode.toLowerCase()}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await page
      .locator(".orbit-task-marker")
      .filter({ hasText: "Office prep" })
      .click();
    await page.getByLabel("Due date", { exact: true }).fill("");
    await expect(page.getByLabel("Due time", { exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(
      page.locator(".orbit-task-marker").filter({ hasText: "Office prep" }),
    ).toHaveCount(0);
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page, f.account);
    await navigate(page, "/todo");
    await expect(
      page.getByRole("region", { name: "Completed", exact: true }),
    ).toContainText("Read revised");
    await row(page, "Someday").locator(".task-details").click();
    await page
      .getByRole("button", { name: "Delete task", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete task", exact: true })
      .click();
    await expect(row(page, "Someday")).toHaveCount(0);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("failed optimistic completion rolls back, failed edits retain drafts, and stale edits are rejected", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/todo");
    await create(page, "Review");
    await page.route("**/*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await page
      .getByRole("button", { name: "Complete Review", exact: true })
      .click();
    await expect(
      page.locator(".task-workspace").getByRole("alert"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete Review", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await row(page, "Review").locator(".task-details").click();
    await page.getByLabel("Title", { exact: true }).fill("Unsaved review");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Unsaved review",
    );
    await page.unroute("**/*");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await row(page, "Unsaved review").locator(".task-details").click();
    const t = (await f.account.client.from("tasks").select("*").single()).data!;
    await f.account.client.rpc("change_task", {
      p_request: crypto.randomUUID(),
      p_id: t.id,
      p_semester: f.semester,
      p_revision: t.revision,
      p_operation: "complete",
      p_payload: { completed: true },
    });
    await page.getByLabel("Title", { exact: true }).fill("Stale draft");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "changed in another session",
    );
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Stale draft",
    );
    expect(
      (await f.account.client.from("tasks").select("*").single()).data!.title,
    ).toBe("Unsaved review");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("semester switching and archived tasks preserve read-only history", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/todo");
    await create(page, "History task", day(0));
    const second = crypto.randomUUID();
    await f.account.client.rpc("create_semester", {
      p_id: second,
      p_name: "Other term",
      p_start: day(100),
      p_end: day(150),
    });
    await page.reload();
    await expect(
      page.getByRole("main").getByText("No tasks yet.", { exact: true }),
    ).toBeVisible();
    await f.account.client.rpc("select_semester", { p_id: f.semester });
    const term = (
      await f.account.client
        .from("semesters")
        .select("*")
        .eq("id", f.semester)
        .single()
    ).data!;
    await f.account.client.rpc("archive_semester", {
      p_id: f.semester,
      p_revision: term.revision,
      p_archive: true,
    });
    await page.reload();
    await expect(row(page, "History task")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New task", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Complete History task", exact: true }),
    ).toBeDisabled();
    await row(page, "History task").locator(".task-details").click();
    await expect(page.getByRole("dialog")).toContainText(
      "Archived semester · Read only",
    );
    await expect(
      page.getByRole("button", { name: "Save task", exact: true }),
    ).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("main").locator(".task-summary")).toContainText(
      "View task history",
    );
    await expect(page.locator(".task-summary .task-row")).toHaveCount(0);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});

test("To-do due times can be typed, changed, cleared and persisted without inventing a time", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/todo");
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Timed assignment");
    const time = page.getByLabel("Due time", { exact: true });
    const date = page.getByLabel("Due date", { exact: true });
    const save = async () => {
      await page
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      try {
        await expect(page.getByRole("dialog")).not.toBeVisible();
      } catch (error) {
        console.log(
          "Task save diagnostic",
          await page.getByRole("dialog").evaluate((el) => ({
            text: el.textContent,
            busy: el.querySelector("fieldset")?.getAttribute("aria-busy"),
            fields: [...el.querySelectorAll("input")].map((i) => ({
              name: i.name,
              value: i.value,
            })),
          })),
        );
        throw error;
      }
      // Let the save-triggered workspace refresh settle before a full navigation.
      await page.waitForLoadState("networkidle");
    };
    const stored = async () =>
      (
        await f.account.client
          .from("tasks")
          .select("*")
          .eq("title", "Timed assignment")
          .single()
      ).data!;
    await expect(time).toBeDisabled();
    await date.fill(day(0));
    await expect(time).toBeEnabled();
    // Exercise normal keyboard entry, rather than native input value injection.
    await time.pressSequentially("14:35");
    await time.focus();
    await expect(page.locator('input[name="due_time"]')).toHaveValue("14:35");
    await page.screenshot({
      path: `.orbit/screenshots/due-time-${browserName}-dark.png`,
      animations: "disabled",
    });
    await save();
    expect((await stored()).due_time).toBe("14:35:00");
    await page
      .getByRole("button", { name: "Light appearance", exact: true })
      .click();
    await row(page, "Timed assignment").locator(".task-details").click();
    await time.focus();
    await expect(page.locator('input[name="due_time"]')).toHaveValue("14:35");
    await time.fill("");
    await time.pressSequentially("16:45");
    await page.screenshot({
      path: `.orbit/screenshots/due-time-${browserName}-light.png`,
      animations: "disabled",
    });
    await save();
    expect((await stored()).due_time).toBe("16:45:00");
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page, f.account);
    await navigate(page, "/todo");
    await row(page, "Timed assignment").locator(".task-details").click();
    await time.focus();
    await expect(page.locator('input[name="due_time"]')).toHaveValue("16:45");
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await navigate(page, "/calendar");
    const marker = page
      .locator(".fc-timegrid-event.orbit-task-marker")
      .filter({ hasText: "Timed assignment" });
    await expect(marker).toContainText("4:45");
    await navigate(page, "/todo");
    await row(page, "Timed assignment").locator(".task-details").click();
    await page
      .getByRole("button", { name: "Remove due time", exact: true })
      .click();
    await expect(time).toHaveValue("");
    await expect(page.locator('input[name="due_date"]')).toHaveValue(day(0));
    await save();
    expect((await stored()).due_time).toBeNull();
    expect((await stored()).due_date).toBe(day(0));
    await page.reload();
    await row(page, "Timed assignment").locator(".task-details").click();
    await expect(time).toHaveValue("");
    await time.pressSequentially("09:15");
    await date.fill("");
    await expect(time).toBeDisabled();
    await date.fill(day(0));
    await expect(time).toHaveValue("");
    await save();
    await navigate(page, "/calendar");
    await expect(marker).toHaveCount(0);
    await expect(
      page
        .locator(".fc-daygrid-event.orbit-task-marker")
        .filter({ hasText: "Timed assignment" }),
    ).toBeVisible();
    // Adding a time to an existing date-only task and deleting it with the keyboard.
    await navigate(page, "/todo");
    await row(page, "Timed assignment").locator(".task-details").click();
    await time.pressSequentially("00:00");
    await save();
    expect((await stored()).due_time).toBe("00:00:00");
    await row(page, "Timed assignment").locator(".task-details").click();
    await time.fill("");
    await save();
    expect((await stored()).due_time).toBeNull();
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
