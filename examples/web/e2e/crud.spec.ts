import { test, expect } from "@playwright/test";

// Full CRUD loop driven through the rendered admin UI (schema comes from the Go
// backend; there is no per-resource frontend code).

test.beforeEach(async ({ page }) => {
  // Dev sign-in: mints a token via the Go /dev/login and sets the cookie.
  await page.goto("/api/dev-login");
  await expect(page).toHaveURL(/\/admin$/);
});

test("sidebar and tables render from the backend schema", async ({ page }) => {
  await page.goto("/admin/posts");
  await expect(page.getByRole("link", { name: "Posts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Authors" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(".ag-sidebar")).toHaveCSS("position", "sticky");
  await expect(page.getByRole("link", { name: "Posts" })).toBeVisible();
  const sidebarTop = await page
    .locator(".ag-sidebar")
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(sidebarTop).toBe(0);
  // valueFrom relation column resolves the author name.
  await expect(page.getByRole("cell", { name: "Ada Lovelace" }).first()).toBeVisible();
  // chip-formatted status.
  await expect(page.getByText("published").first()).toBeVisible();

  await page.getByRole("link", { name: "Post number 25 about computing" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/25$/);
  await expect(page.getByRole("heading", { name: "Post number 25 about computing" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Posts" }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test("create → edit → delete a post", async ({ page }) => {
  const title = `E2E post ${Date.now()}`;
  const edited = `${title} (edited)`;

  // CREATE via the RJSF form + ForeignKey author search.
  await page.goto("/admin/posts");
  await page.getByRole("button", { name: "+ Create" }).click();
  await page.getByRole("textbox", { name: "Title*" }).fill(title);
  const author = page.getByRole("textbox", { name: "Author*" });
  await author.click();
  await author.fill("Grace");
  await page.getByRole("button", { name: "Grace Hopper" }).click();
  await page.locator('button[type="submit"]').click();

  // The sheet closes and the new row appears.
  await expect(page.getByRole("cell", { name: title, exact: true })).toBeVisible();

  // EDIT it (prefill then change the title).
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: "Edit" }).click();
  const titleInput = page.getByRole("textbox", { name: "Title*" });
  await expect(titleInput).toHaveValue(title); // prefilled
  await titleInput.fill(edited);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("cell", { name: edited, exact: true })).toBeVisible();

  // DELETE it (confirm dialog).
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("row")
    .filter({ hasText: edited })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("cell", { name: edited, exact: true })).toHaveCount(0);
});

test("validation blocks an incomplete submit", async ({ page }) => {
  await page.goto("/admin/posts");
  await page.getByRole("button", { name: "+ Create" }).click();
  // Submit without choosing a required Author.
  await page.getByRole("textbox", { name: "Title*" }).fill("Incomplete post");
  await page.locator('button[type="submit"]').click();
  // The sheet stays open with a required-field error surfaced.
  await expect(page.getByText(/required/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Posts" })).toBeVisible();
});
