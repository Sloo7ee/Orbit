import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localClients, createTestUser } from "./helpers/local-supabase";
const test = base.extend<{
  account: Awaited<ReturnType<typeof createTestUser>>;
}>({
  account: async ({}, provide) => {
    const clients = localClients();
    const account = await createTestUser(clients);
    try {
      await provide(account);
    } finally {
      await clients.admin.auth.admin.deleteUser(account.id);
    }
  },
});
async function login(
  page: Page,
  account: { email: string; password: string },
  setup = true,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (setup) {
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Display name").fill("Saleh Test");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/semesters$/);
  }
}

test("protects routes and handles invalid credentials", async ({
  page,
  account,
}) => {
  await page.goto("/semesters");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("Wrong-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        /Unable to sign in|invalid or has expired|Connection interrupted/,
    }),
  ).toContainText("Unable to sign in");
  await page.goto("/auth/confirm?token_hash=invalid&type=recovery");
  await expect(
    page.getByRole("alert").filter({
      hasText:
        /Unable to sign in|invalid or has expired|Connection interrupted/,
    }),
  ).toContainText("invalid or has expired");
});

test("onboarding, semester creation, switching, archive, restore, and second-session persistence", async ({
  page,
  browser,
  account,
}) => {
  await login(page, account);
  await page.getByLabel("Semester name").fill("Fall 2026");
  await page.getByLabel("Start date", { exact: true }).fill("2026-09-01");
  await page.getByLabel("End date", { exact: true }).fill("2026-12-31");
  await page
    .getByRole("button", { name: "Create semester", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fall 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Semester created" }),
  ).toContainText("Semester created");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Saleh");
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page
    .getByRole("link", { name: "Manage semesters", exact: true })
    .click();
  await page.getByLabel("Semester name").fill("Spring 2027");
  await page.getByLabel("Start date", { exact: true }).fill("2027-01-01");
  await page.getByLabel("End date", { exact: true }).fill("2027-05-31");
  await page
    .getByRole("button", { name: "Create semester", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Spring 2027", exact: true }),
  ).toBeVisible();
  const fall = page.locator(".semester-item").filter({
    has: page.getByRole("heading", { name: "Fall 2026", exact: true }),
  });
  await fall.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive semester", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Semester history" }),
  ).toContainText("Fall 2026");
  await page
    .getByLabel("Selected semester")
    .selectOption({ label: "Fall 2026" });
  await expect(page.locator(".archive-banner")).toContainText("Fall 2026");
  const second = await browser.newContext();
  const other = await second.newPage();
  await login(other, account, false);
  await expect(other).toHaveURL(/\/$/);
  await expect(other.locator(".archive-banner")).toContainText("Fall 2026");
  await second.close();
  await page.reload();
  await fall.getByRole("button", { name: "Restore", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore semester", exact: true })
    .click();
  await expect(page.locator(".archive-banner")).not.toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("recovers a password using the real local email and one-time link", async ({
  page,
  account,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  let link = "";
  await expect
    .poll(
      async () => {
        const list = await (
          await fetch("http://127.0.0.1:54324/api/v1/messages")
        ).json();
        const message = list.messages?.find(
          (m: { To?: { Address: string }[] }) =>
            m.To?.some((t) => t.Address === account.email),
        );
        if (!message) return false;
        const detail = await (
          await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)
        ).json();
        link =
          (detail.HTML as string)
            .match(/href="([^"]+)"/)?.[1]
            ?.replaceAll("&amp;", "&") ?? "";
        return !!link;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await page.context().clearCookies(); // Recovery must also work in a fresh session.
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password$/);
  const password = "A-new-test-password-2026!";
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in\?reset=success$/);
  expect(
    (
      await localClients().client().auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })
    ).error,
  ).not.toBeNull();
  await login(page, { email: account.email, password });
  await page.goto(link);
  await expect(page).toHaveURL(/\/sign-in\?error=invalid-link$/);
});

test("retains form entries after a failed save and retries", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.getByLabel("Semester name").fill("Retry semester");
  await page.getByLabel("Start date", { exact: true }).fill("2026-09-01");
  await page.getByLabel("End date", { exact: true }).fill("2026-12-31");
  await page.route(
    "**/semesters",
    (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Create semester", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        /Unable to sign in|invalid or has expired|Connection interrupted/,
    }),
  ).toContainText("Connection interrupted");
  await expect(page.getByLabel("Semester name")).toHaveValue("Retry semester");
  await page
    .getByRole("button", { name: "Create semester", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Retry semester", exact: true }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const)
  test(`${theme} appearance, navigation, and accessibility`, async ({
    page,
    account,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-in");
    await page
      .getByRole("button", {
        name: `${theme === "dark" ? "Dark" : "Light"} appearance`,
        exact: true,
      })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await login(page, account);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const path of [
      "courses",
      "calendar",
      "notes",
      "todo",
      "focus",
      "settings",
    ]) {
      await page.goto(`/${path}`);
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
      ).toBeVisible();
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "System appearance", exact: true })
      .first()
      .click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

test("small screens and reduced motion preserve access", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Notes", exact: true }),
  ).toBeVisible();
  expect(
    parseFloat(
      await page
        .locator(".page-enter")
        .evaluate((el) => getComputedStyle(el).animationDuration),
    ),
  ).toBeLessThan(0.01);
});

test("profile edits persist and stale edits do not overwrite another session", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Saleh Updated");
  await page
    .getByRole("combobox", { name: "Timezone", exact: true })
    .selectOption("America/New_York");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Settings saved" }),
  ).toContainText("Settings saved");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Saleh Updated");
  await expect(
    page.getByRole("combobox", { name: "Timezone", exact: true }),
  ).toHaveValue("America/New_York");
  // Keep a dirty local draft while an independent session changes the profile.
  await page.getByLabel("Display name").fill("Unsaved draft");
  const profile = (await account.client.from("profiles").select("*").single())
    .data!;
  const remote = await account.client.rpc("save_profile", {
    p_name: "Remote update",
    p_timezone: "UTC",
    p_revision: profile.revision,
  });
  expect(remote.error).toBeNull();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator(".form-error")).toContainText(
    "changed in another session",
  );
  await expect(page.getByLabel("Display name")).toHaveValue("Unsaved draft");
  expect(
    (await account.client.from("profiles").select("display_name").single()).data
      ?.display_name,
  ).toBe("Remote update");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Remote update");
});
