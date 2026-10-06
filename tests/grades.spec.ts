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
async function assessment(
  page: Page,
  name: string,
  weight: string,
  score: string,
  possible: string,
  due = false,
) {
  await page
    .getByRole("button", { name: "Add assessment", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Weight (%)", { exact: true }).fill(weight);
  await page.getByLabel("Score earned", { exact: true }).fill(score);
  await page.getByLabel("Score possible", { exact: true }).fill(possible);
  if (due) {
    await page.getByLabel("Due date", { exact: true }).fill(day(0));
    await page.getByLabel("Due time", { exact: true }).fill("12:30");
  }
  await page
    .getByRole("button", { name: "Save assessment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.waitForLoadState("networkidle");
}
test("weighted grades CRUD, calendar deadlines, themes, persistence and archived history", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/grades");
    await page
      .getByRole("main")
      .locator(`a[href="/grades?course=${f.course}"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`course=${f.course}`));
    await expect(page.getByRole("main")).toContainText("No grades yet");
    await assessment(page, "Major exam", "20", "18", "20", true);
    await assessment(page, "Quiz", "10", "8", "10");
    await assessment(page, "Final exam", "70", "", "50");
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("86.67%");
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("30.00%");
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("26.00");
    await expect(page.getByRole("main")).toContainText("All 100%");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("button", { name: `${theme} appearance` }).click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/grades-${browserName}-${theme}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Edit assessment Major exam", exact: true })
      .click();
    for (const theme of ["Light", "Dark"]) {
      await page
        .getByRole("button", { name: "Close editor", exact: true })
        .click();
      await page.getByRole("button", { name: theme + " appearance" }).click();
      await page
        .getByRole("button", {
          name: "Edit assessment Major exam",
          exact: true,
        })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path:
          ".orbit/screenshots/grade-modal-" +
          browserName +
          "-" +
          theme +
          ".png",
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Clear score", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove due time", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("80.00%");
    await navigate(page, "/calendar");
    const marker = page
      .locator(".orbit-assessment-marker")
      .filter({ hasText: "Major exam" })
      .first();
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.getByLabel("Due time", { exact: true })).toHaveValue("");
    await page.getByLabel("Due time", { exact: true }).fill("12:30");
    await page.getByLabel("Score earned", { exact: true }).fill("19.5");
    await page
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.waitForLoadState("networkidle");
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page, f.account);
    await navigate(page, "/grades");
    await page
      .getByRole("main")
      .locator(`a[href="/grades?course=${f.course}"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`course=${f.course}`));
    await expect(page.getByRole("main")).toContainText("19.5 / 20");
    await page
      .getByRole("button", { name: "Edit assessment Quiz", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete assessment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: "Edit assessment Quiz", exact: true }),
    ).toHaveCount(0);
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
    await expect(
      page.getByRole("button", { name: "Add assessment", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "View assessment Major exam", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Read only");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("failed and stale grade edits retain drafts and committed totals", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await page.goto(`/grades?course=${f.course}`);
    await assessment(page, "Exam", "90", "10", "20");
    await page
      .getByRole("button", { name: "Add assessment", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Overflow");
    await page.getByLabel("Weight (%)", { exact: true }).fill("20");
    await page.getByLabel("Score possible", { exact: true }).fill("10");
    await page
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("100");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Overflow",
    );
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit assessment Exam", exact: true })
      .click();
    const a = (
      await f.account.client
        .from("assessments")
        .select("*")
        .eq("course_id", f.course)
        .single()
    ).data!;
    expect(
      (
        await f.account.client.rpc("change_assessment", {
          p_request: crypto.randomUUID(),
          p_id: a.id,
          p_course: f.course,
          p_semester: f.semester,
          p_revision: a.revision,
          p_delete: false,
          p_payload: {
            name: "Exam",
            weight: "90",
            score_earned: "15",
            score_possible: "20",
            due_date: "",
            due_time: "",
            notes: "",
          },
        })
      ).error,
    ).toBeNull();
    await page.getByLabel("Score earned", { exact: true }).fill("12");
    await page
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(/changed|Reload/i);
    await expect(page.getByLabel("Score earned", { exact: true })).toHaveValue(
      "12",
    );
    await page.reload();
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("75.00%");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("course and semester switching, decimal grades and interrupted saves", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    const second = crypto.randomUUID(),
      other = crypto.randomUUID();
    expect(
      (
        await f.account.client.rpc("save_course", {
          p_id: second,
          p_semester: f.semester,
          p_revision: 0,
          p_code: "MTH",
          p_name: "Mathematics",
          p_color: "#79c5ab",
          p_instructor: "",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await f.account.client.rpc("create_semester", {
          p_id: other,
          p_name: "Other term",
          p_start: day(-10),
          p_end: day(100),
        })
      ).error,
    ).toBeNull();
    await f.account.client.rpc("select_semester", { p_id: f.semester });
    await page.goto(`/grades?course=${f.course}`);
    await assessment(page, "Decimal exam", "25.5", "21.3", "25.25");
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("84.36%");
    await page
      .getByRole("combobox", { name: "Grade course", exact: true })
      .selectOption(second);
    await expect(page.getByRole("main")).toContainText("No grades yet");
    await page
      .getByRole("combobox", { name: "Grade course", exact: true })
      .selectOption(f.course);
    await expect(page.getByRole("main")).toContainText("Decimal exam");
    await page
      .getByRole("button", {
        name: "Edit assessment Decimal exam",
        exact: true,
      })
      .click();
    await page.getByLabel("Score earned", { exact: true }).fill("22");
    await page.route("**/grades*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await page
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Connection",
    );
    await expect(page.getByLabel("Score earned", { exact: true })).toHaveValue(
      "22",
    );
    await expect(
      page.getByRole("main").locator(".grade-metrics-detail"),
    ).toContainText("84.36%");
    await page.screenshot({
      path: `.orbit/screenshots/grade-editor-${browserName}.png`,
      fullPage: true,
    });
    await page.unroute("**/grades*");
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(other);
    await expect(page).toHaveURL(/\/grades$/);
    await expect(page.getByRole("main")).toContainText(
      "No courses in this semester",
    );
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(f.semester);
    await expect(page.getByRole("main")).toContainText("84.36%");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
