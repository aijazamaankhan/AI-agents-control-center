import { expect, test } from "@playwright/test";

const password = "e2e-secure-password";

test("signup → create company → dashboard → settings → sign out → sign in", async ({
  page,
}, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@example.test`;

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your AI workforce. One control center." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start Free" }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("Full name").fill("Aijaz Khan");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: /Create your company/ })).toBeVisible();
  await page.getByRole("button", { name: "Create company" }).click();
  await expect(page.getByText("Enter your company name")).toBeVisible();
  await expect(page.getByLabel("Timezone")).not.toHaveValue("");

  await page.getByLabel("Company name").fill("Acme Corporation");
  await page.getByLabel("Industry").selectOption("Software & Technology");
  await page.getByLabel("Company size").selectOption("51-200");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByLabel("Timezone").selectOption("UTC");
  await page.getByRole("button", { name: "Create company" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aijaz/ }),
  ).toBeVisible();
  await expect(page.getByText("Your AI workforce is empty.")).toBeVisible();
  await expect(page.getByText("Company created")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByLabel("Company name")).toHaveValue("Acme Corporation");
  await page.getByLabel("Company name").fill("Acme Global");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Organization settings saved.")).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  // Regression: React resets forms after actions; the typed email must survive a failed attempt.
  await expect(page.getByLabel("Email")).toHaveValue(email);

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Acme Global").first()).toBeAttached();
});

test("health endpoint reports database status", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", checks: { database: { status: "ok" } } });
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});
