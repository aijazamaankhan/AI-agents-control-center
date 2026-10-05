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
  await page.getByRole("link", { name: "Start Free" }).first().click();

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

  // Step 2: departments — keep defaults, remove one, add a custom one.
  await expect(page).toHaveURL(/\/onboarding\/departments$/);
  await page.getByRole("button", { name: "Remove Analytics" }).click();
  await page.getByLabel("Add a custom department").fill("Inventory");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Create 8 departments" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening), Aijaz/ }),
  ).toBeVisible();
  await expect(page.getByText("Your AI workforce is empty.")).toBeVisible();
  await expect(page.getByText("Company created")).toBeVisible();

  // Workforce map preview: clearly labelled sample, drill-down and pause control.
  const map = page.getByRole("region", { name: "Workforce map" });
  await expect(map.getByText("Sample workforce · simulated")).toBeVisible();
  await map.getByRole("button", { name: /^Sales:/ }).click();
  await expect(map.getByRole("heading", { name: "Sales", level: 3 })).toBeVisible();
  await map.getByRole("button", { name: /^Lead Research Agent,/ }).click();
  await expect(map.getByText("Execution trace")).toBeVisible();
  await map.getByRole("button", { name: "Pause live activity" }).click();
  await expect(map.getByRole("button", { name: "Resume live activity" })).toBeVisible();

  // Departments CRUD.
  await page.goto("/departments");
  const list = page.getByRole("list", { name: "Departments" });
  await expect(list.getByRole("listitem")).toHaveCount(8);
  await expect(list.getByText("Inventory")).toBeVisible();
  await expect(list.getByText("Analytics")).toHaveCount(0);
  await page.getByLabel("Department name").fill("Legal");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Legal created.")).toBeVisible();
  await page.getByLabel("Department name").fill("legal");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("A department with this name already exists.")).toBeVisible();

  await list.getByRole("link", { name: /Legal/ }).click();
  await expect(page.getByRole("heading", { name: "Legal", level: 1 })).toBeVisible();
  await expect(page.getByText("No agents in Legal yet.")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Legal & Compliance");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Department saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legal & Compliance", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Delete department" }).click();
  await page.getByRole("button", { name: "Delete department" }).click();
  await expect(page).toHaveURL(/\/departments$/);
  await expect(list.getByRole("listitem")).toHaveCount(8);

  // JSON API for desktop/mobile clients: session-authenticated, CSRF-protected.
  const api = await page.request.get("/api/v1/departments");
  expect(api.status()).toBe(200);
  expect((await api.json()).data).toHaveLength(8);
  const forged = await page.request.post("/api/v1/departments", {
    data: { name: "Forged" },
    headers: { origin: "https://evil.example" },
  });
  expect(forged.status()).toBe(403);
  expect(await forged.json()).toEqual({
    error: { code: "FORBIDDEN", message: "Cross-site request blocked." },
  });

  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Reading the workforce map" })).toBeVisible();

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

test("landing: Book Demo and Velorex Studio enquiry popups submit", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Everything to run an AI workforce" }),
  ).toBeVisible();

  // Book Demo
  await page.getByRole("button", { name: "Book Demo" }).first().click();
  const demo = page.getByRole("dialog", { name: "Book an AgentOS demo" });
  await expect(demo).toBeVisible();
  await demo.getByRole("button", { name: "Request demo" }).click();
  await expect(demo.getByText("Enter your company")).toBeVisible();
  await demo.getByLabel("Your name").fill("Sam Lee");
  await demo.getByLabel("Work email").fill("sam@acme.io");
  await demo.getByLabel("Company", { exact: true }).fill("Acme");
  await demo.getByRole("button", { name: "Request demo" }).click();
  await expect(demo.getByText("Request sent")).toBeVisible();
  await demo.getByRole("button", { name: "Close" }).first().click();
  await expect(demo).toBeHidden();

  // Footer: Velorex Studio IT services enquiry
  await page.getByRole("button", { name: /Velorex Studio — IT Services/ }).click();
  const inquiry = page.getByRole("dialog", { name: "Work with Velorex Studio" });
  await expect(inquiry).toBeVisible();
  await expect(inquiry.getByRole("link", { name: /velorexdesign@gmail.com/ })).toBeVisible();
  await inquiry.getByLabel("Your name").fill("Priya Sharma");
  await inquiry.getByLabel("Email").fill("priya@example.com");
  await inquiry.getByLabel("What do you need?").selectOption("UI / UX design");
  await inquiry
    .getByLabel("Project details")
    .fill("Redesign our booking app with a modern dark theme.");
  await inquiry.getByRole("button", { name: "Send request" }).click();
  await expect(inquiry.getByText(/Your request has been received/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inquiry).toBeHidden();
});
