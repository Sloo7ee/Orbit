import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localClients, createTestUser } from "./helpers/local-supabase";
import { navigate } from "./helpers/navigation";
import { emptyNote } from "../src/lib/domain/notes";
async function login(
  page: Page,
  a: Awaited<ReturnType<typeof createTestUser>>,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}
async function fixture(page: Page) {
  const clients = localClients(),
    account = await createTestUser(clients),
    semester = crypto.randomUUID(),
    course = crypto.randomUUID(),
    secondCourse = crypto.randomUUID();
  await account.client.rpc("save_profile", {
    p_name: "Notes Tester",
    p_timezone: "Asia/Riyadh",
    p_revision: 0,
  });
  await account.client.rpc("create_semester", {
    p_id: semester,
    p_name: "Writing term",
    p_start: "2026-01-01",
    p_end: "2026-12-31",
  });
  for (const [id, code, name] of [
    [course, "SCI", "Science"],
    [secondCourse, "ENG", "English"],
  ])
    await account.client.rpc("save_course", {
      p_id: id,
      p_semester: semester,
      p_revision: 0,
      p_code: code,
      p_name: name,
      p_instructor: "",
      p_color: "#79c5ab",
    });
  await login(page, account);
  await navigate(page, "/notes");
  return { clients, account, semester, course, secondCourse };
}
const title = (p: Page) =>
  p.getByRole("textbox", { name: "Note title", exact: true });
const editor = (p: Page) =>
  p.getByRole("textbox", { name: "Note content", exact: true });
const saved = async (p: Page) => {
  await expect(
    p
      .getByRole("region", { name: "Note editor", exact: true })
      .locator(".note-save-status"),
  ).toHaveText("Saved");
};
async function create(p: Page, name: string) {
  await p.getByRole("button", { name: "New note", exact: true }).click();
  await title(p).fill(name);
  await saved(p);
}
test("Notes writing, formatting, filters, navigation, persistence and visual accessibility", async ({
  page,
  browserName,
}) => {
  const f = await fixture(page);
  try {
    await expect(
      page.getByText("No notes yet.", { exact: true }),
    ).toBeVisible();
    await create(page, "Lecture one");
    await editor(page).fill("Important idea");
    await editor(page).press("ControlOrMeta+a");
    for (const name of ["Bold", "Italic", "Underline"])
      await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("combobox", { name: "Text style", exact: true })
      .selectOption("2");
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await page
      .getByLabel("Link address", { exact: true })
      .fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Apply link", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await page
      .getByLabel("Link address", { exact: true })
      .fill("https://example.com/lecture");
    await page.getByRole("button", { name: "Apply link", exact: true }).click();
    await expect(editor(page).locator("h2 a strong em u")).toHaveCount(1);
    await saved(page);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(editor(page).locator("a")).toHaveCount(0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(editor(page).locator("a")).toHaveCount(1);
    await saved(page);
    await page
      .getByRole("combobox", { name: "Note course", exact: true })
      .selectOption(f.course);
    await saved(page);
    await page
      .getByRole("combobox", { name: "Note course", exact: true })
      .selectOption(f.secondCourse);
    await saved(page);
    await page
      .getByRole("combobox", { name: "Note course", exact: true })
      .selectOption("");
    await saved(page);
    await page
      .getByRole("combobox", { name: "Note course", exact: true })
      .selectOption(f.course);
    await saved(page);
    await create(page, "Reading list");
    await editor(page).fill("Read chapter");
    await page
      .getByRole("button", { name: "Bullet list", exact: true })
      .click();
    await expect(editor(page).locator("ul li")).toHaveCount(1);
    await saved(page);
    await page
      .getByRole("button", { name: "Numbered list", exact: true })
      .click();
    await expect(editor(page).locator("ol li")).toHaveCount(1);
    await saved(page);
    await page.reload();
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Reading list" })
      .click();
    await expect(editor(page).locator("ol li")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Numbered list", exact: true })
      .click();
    await page.getByRole("button", { name: "Blockquote", exact: true }).click();
    await expect(editor(page).locator("blockquote")).toHaveCount(1);
    await saved(page);
    await editor(page).press("ControlOrMeta+a");
    await page
      .getByRole("button", { name: "Inline code", exact: true })
      .click();
    await expect(editor(page).locator("code")).toHaveCount(1);
    await saved(page);
    await page
      .getByRole("searchbox", { name: "Search note titles" })
      .fill("lecture");
    await expect(page.getByRole("main").locator(".note-list-item")).toHaveCount(
      1,
    );
    await page.getByRole("searchbox", { name: "Search note titles" }).fill("");
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption(f.course);
    await expect(page.getByRole("main").locator(".note-list-item")).toHaveCount(
      1,
    );
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption("none");
    await expect(page.getByRole("main").locator(".note-list-item")).toHaveCount(
      1,
    );
    await page
      .getByRole("combobox", { name: "Course filter", exact: true })
      .selectOption("all");
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Lecture one" })
      .click();
    await title(page).fill("Latest lecture");
    await navigate(page, "/courses");
    await navigate(page, "/notes");
    await expect(title(page)).toHaveValue("Latest lecture");
    await expect(
      page.getByRole("main").locator(".note-list-item").first(),
    ).toContainText("Latest lecture");
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const mode of ["Light", "Dark"]) {
      await page
        .getByRole("button", { name: `${mode} appearance`, exact: true })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.orbit/screenshots/phase8-${browserName}-${mode}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 580, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.orbit/screenshots/phase8-${browserName}-narrow.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(page, "/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await login(page, f.account);
    await navigate(page, "/notes");
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Latest lecture" })
      .click();
    await expect(editor(page).locator("h2 a")).toHaveAttribute(
      "href",
      "https://example.com/lecture",
    );
    await page
      .getByRole("button", { name: "Delete note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await expect(
      page
        .getByRole("main")
        .locator(".note-list-item")
        .filter({ hasText: "Latest lecture" }),
    ).toHaveCount(0);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("Autosave debounce, failed navigation, retry, pending typing and stale conflicts retain drafts", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await create(page, "Draft");
    const row = async () =>
      (await f.account.client.from("notes").select("*").single()).data!;
    let posts = 0;
    await page.route("**/notes", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await new Promise((r) => setTimeout(r, 500));
      }
      await route.continue();
    });
    await title(page).fill("First typing");
    await page.waitForTimeout(150);
    await title(page).fill("Second typing");
    await page.waitForTimeout(150);
    expect(posts).toBe(0);
    await saved(page);
    expect(posts).toBe(1);
    await title(page).fill("In flight");
    await expect(
      page
        .getByRole("region", { name: "Note editor" })
        .locator(".note-save-status"),
    ).toHaveText("Saving…");
    await title(page).fill("Newer typing");
    await saved(page);
    expect((await row()).title).toBe("Newer typing");
    await page.unroute("**/notes");
    await page.route("**/*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await title(page).fill("Keep my draft");
    await page.getByRole("link", { name: "Courses", exact: true }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(
      page.getByRole("region", { name: "Note editor" }).getByRole("alert"),
    ).toBeVisible();
    await expect(title(page)).toHaveValue("Keep my draft");
    await page.unroute("**/*");
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await saved(page);
    expect((await row()).title).toBe("Keep my draft");
    const n = await row();
    expect(
      (
        await f.account.client.rpc("change_note", {
          p_request: crypto.randomUUID(),
          p_id: n.id,
          p_semester: f.semester,
          p_course: null,
          p_revision: n.revision,
          p_delete: false,
          p_title: "Other device",
          p_content: emptyNote,
        })
      ).error,
    ).toBeNull();
    await title(page).fill("Local stale draft");
    await expect(
      page.getByRole("region", { name: "Note editor" }).getByRole("alert"),
    ).toContainText("changed in another session");
    expect((await row()).title).toBe("Other device");
    await expect(title(page)).toHaveValue("Local stale draft");
    await page
      .getByRole("button", { name: "Reload saved note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Discard draft and reload", exact: true })
      .click();
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Other device" })
      .click();
    await expect(title(page)).toHaveValue("Other device");
    // Back navigation cannot discard the layout-owned draft while a save is in flight.
    await title(page).fill("Back navigation text");
    await page.goBack();
    await savedAfterBack();
    async function savedAfterBack() {
      await expect
        .poll(async () => (await row()).title)
        .toBe("Back navigation text");
    }
    await navigate(page, "/notes");
    await expect(title(page)).toHaveValue("Back navigation text");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
test("Notes semester switching, course deletion and archived read-only history", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await create(page, "Historical notes");
    await page
      .getByRole("combobox", { name: "Note course", exact: true })
      .selectOption(f.course);
    await saved(page);
    await navigate(page, "/courses");
    expect(
      (
        await f.account.client.rpc("delete_academic", {
          p_id: f.course,
          p_semester: f.semester,
          p_revision: 1,
          p_kind: "course",
        })
      ).error,
    ).toBeNull();
    await navigate(page, "/notes");
    await page
      .getByRole("button", { name: "Load latest version", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Note course", exact: true }),
    ).toHaveValue("");
    const second = crypto.randomUUID();
    await f.account.client.rpc("create_semester", {
      p_id: second,
      p_name: "Next term",
      p_start: "2027-01-01",
      p_end: "2027-12-31",
    });
    await f.account.client.rpc("select_semester", { p_id: f.semester });
    await page.reload();
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Historical notes" })
      .click();
    await title(page).fill("Saved before switching");
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(second);
    await expect(
      page.getByText("No notes yet.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Selected semester", exact: true })
      .selectOption(f.semester);
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Saved before switching" })
      .click();
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
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Saved before switching" })
      .click();
    await expect(title(page)).toHaveAttribute("readonly", "");
    await expect(editor(page)).toHaveAttribute("contenteditable", "false");
    await expect(
      page.getByRole("button", { name: "New note", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Text formatting" }),
    ).toHaveCount(0);
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});

test("Back navigation keeps failed drafts and sign-out waits for their save", async ({
  page,
}) => {
  const f = await fixture(page);
  try {
    await navigate(page, "/settings");
    await navigate(page, "/notes");
    await create(page, "Before leaving");
    await page.route("**/*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await title(page).fill("Preserved across back navigation");
    await page.goBack();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator(".draft-banner")).toContainText("draft is kept");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Your note is not saved",
    );
    await expect(page).toHaveURL(/\/settings$/);
    await page.unroute("**/*");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await login(page, f.account);
    await navigate(page, "/notes");
    await page
      .getByRole("main")
      .locator(".note-list-item")
      .filter({ hasText: "Preserved across back navigation" })
      .click();
    await expect(title(page)).toHaveValue("Preserved across back navigation");
    const n = (await f.account.client.from("notes").select("*").single()).data!;
    expect(
      (
        await f.account.client.rpc("change_note", {
          p_request: crypto.randomUUID(),
          p_id: n.id,
          p_semester: n.semester_id,
          p_course: null,
          p_revision: n.revision,
          p_delete: true,
          p_title: n.title,
          p_content: n.content,
        })
      ).error,
    ).toBeNull();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("main").locator(".note-list-item")).toHaveCount(
      0,
    );
    await expect(
      page.getByText("This note was deleted in another session.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(title(page)).toHaveAttribute("readonly", "");
    await expect(editor(page)).toHaveAttribute("contenteditable", "false");
  } finally {
    await f.clients.admin.auth.admin.deleteUser(f.account.id);
  }
});
