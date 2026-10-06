import type { Page } from "@playwright/test";
export async function fillDateTime(page: Page, label: string, value: string) {
  await page
    .getByLabel(`${label} date`, { exact: true })
    .fill(value.slice(0, 10));
  await page
    .getByLabel(`${label} time`, { exact: true })
    .fill(value.slice(11, 16));
}
