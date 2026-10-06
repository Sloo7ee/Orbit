import { expect, type Page } from "@playwright/test";
// Use the app router after mutations: hard document navigation can race a
// save-triggered refresh and cause WebKit to restore the previous document.
export async function navigate(page: Page, path: string) {
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .locator(`a.nav-link[href="${path}"]`)
    .click();
  await expect(page).toHaveURL(new URL(path, "http://127.0.0.1:3001").href);
  await expect(page.getByRole("main")).toBeVisible();
}
