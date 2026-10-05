import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

async function signUpWithCompany(page: Page, email: string, company: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Velorex Owner");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("e2e-secure-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Company name").fill(company);
  await page.getByLabel("Industry").selectOption("Software & Technology");
  await page.getByLabel("Company size").selectOption("1-10");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByRole("button", { name: "Create company" }).click();
  await expect(page).toHaveURL(/\/onboarding\/departments$/);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("theme mode, settings controls and the Velorex admin panel", async ({ page }, testInfo) => {
  const email = `admin-${testInfo.project.name}-${Date.now()}@example.test`;
  const company = `Admin Test Co ${testInfo.project.name} ${Date.now()}`;
  await signUpWithCompany(page, email, company);

  // Theme: light persists across reloads; system follows the OS.
  await page.goto("/settings?tab=appearance");
  await page.getByRole("main").getByRole("radio", { name: "Light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("main").getByRole("radio", { name: "System theme" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await page.getByRole("main").getByRole("radio", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Settings controls.
  await page.goto("/settings?tab=security");
  await expect(page.getByRole("list", { name: "Active sessions" })).toContainText("This device");
  await page.goto("/settings?tab=profile");
  await page.getByLabel("Full name").fill("Aijaz Khan");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Not an admin yet → the admin area doesn't exist for this user.
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Grant admin the only supported way: the CLI.
  execFileSync("node", ["scripts/admin-grant.mjs", "--email", email], {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Platform KPIs" })).toContainText("Customers");

  await page.goto("/admin/organizations");
  await page.getByLabel("Search by company, owner email or org_ id").fill(email);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: company }).click();
  await expect(page.getByRole("heading", { name: company })).toBeVisible();
  await expect(page.getByRole("main").getByText(email).first()).toBeVisible();

  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("list", { name: "Users" })).toContainText("Platform admin");
  await expect(page.getByRole("list", { name: "Users" })).toContainText("You");

  await page.goto("/admin/audit?action=admin.");
  await expect(page.getByText("admin.platform_admin_granted").first()).toBeVisible();
});

test("separate admin and company logins with the seeded demo accounts", async ({ page }) => {
  execFileSync("node", ["scripts/seed-demo.mjs", "--quiet", "--reset-passwords"], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: process.env.TEST_DATABASE_URL },
  });

  // Not signed in → the admin panel sends you to its own login.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Velorex Studio admin" })).toBeVisible();

  // A company account can't get into the admin panel.
  await page.getByLabel("Email").fill("viewer@acme.test");
  await page.getByLabel("Password").fill("Acme-viewer-2026");
  await page.getByRole("button", { name: "Sign in to admin panel" }).click();
  await expect(page.getByText("no Velorex admin access")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);

  // The platform admin can.
  await page.getByLabel("Email").fill("admin@velorex.test");
  await page.getByLabel("Password").fill("Velorex-admin-2026");
  await page.getByRole("button", { name: "Sign in to admin panel" }).click();
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  await page.context().clearCookies();

  // Company login: a viewer lands on their company's dashboard.
  await page.goto("/login");
  await page.getByLabel("Email").fill("viewer@acme.test");
  await page.getByLabel("Password").fill("Acme-viewer-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/departments");
  await expect(page.getByRole("main").getByText("Customer Support").first()).toBeVisible();
});
