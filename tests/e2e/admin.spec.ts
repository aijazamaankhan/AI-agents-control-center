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

  // Motion: "Always animate" overrides the OS reduce-motion setting and survives reloads.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("radiogroup", { name: "Motion" })
    .getByRole("radio", { name: "Always animate" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await page
    .getByRole("radiogroup", { name: "Motion" })
    .getByRole("radio", { name: "System" })
    .click();
  await expect(page.locator("html")).not.toHaveAttribute("data-motion", /.+/);
  await page.emulateMedia({ reducedMotion: null });

  // Settings controls.
  await page.goto("/settings?tab=security");
  await expect(page.getByRole("list", { name: "Active sessions" })).toContainText("This device");
  await page.goto("/settings?tab=profile");
  await page.getByLabel("Full name").fill("Aijaz Khan");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Not an admin yet → sent to the admin login, which explains this account has no access.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText("which has no admin access")).toBeVisible();

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

test("costs & usage: admin adds a price, owners see costs, viewers don't", async ({
  page,
}, testInfo) => {
  execFileSync("node", ["scripts/seed-demo.mjs", "--quiet"], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
  const signIn = async (path: string, email: string, password: string, button: string) => {
    await page.context().clearCookies();
    await page.goto(path);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  };

  // Velorex admin manages the versioned price list.
  await signIn(
    "/admin/login",
    "admin@velorex.test",
    "Velorex-admin-2026",
    "Sign in to admin panel",
  );
  await page.goto("/admin/pricing");
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  const model = `E2E Model ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Provider").fill("Anthropic");
  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Input $ / 1M tokens").fill("3");
  await page.getByLabel("Output $ / 1M tokens").fill("15");
  await page.getByRole("button", { name: "Add price version" }).click();
  await expect(page.getByText(`Saved Anthropic / ${model} v1.`)).toBeVisible();
  await expect(page.getByRole("table", { name: "Price list" })).toContainText(model);

  // Company owner sees the Costs & Usage page.
  await signIn("/login", "demo@agentos.dev", "AgentOS-demo-2026", "Sign in");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/costs?period=7d");
  await expect(page.getByRole("heading", { name: "Costs & Usage" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Usage KPIs" })).toContainText("AI cost");

  // Viewers can't see costs.
  await signIn("/login", "viewer@acme.test", "Acme-viewer-2026", "Sign in");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/costs");
  await expect(page.getByText("Costs are visible to owners, admins and managers")).toBeVisible();
});

test("approvals: an agent waits, a manager approves, the agent sees the decision", async ({
  page,
  request,
}, testInfo) => {
  execFileSync("node", ["scripts/seed-demo.mjs", "--quiet"], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
  // Mint an API key for Acme's "Outreach Writer" (its "Send external email" permission
  // requires approval) straight in the test database.
  const apiKey = execFileSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import pg from "pg"; import { randomBytes, createHash } from "node:crypto";
       const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
       const { rows } = await c.query("SELECT a.id, a.organization_id FROM agents a JOIN memberships m ON m.organization_id = a.organization_id JOIN users u ON u.id = m.user_id WHERE u.email = 'demo@agentos.dev' AND a.name = 'Outreach Writer' LIMIT 1");
       const k = "aos_live_" + randomBytes(32).toString("base64url");
       await c.query("INSERT INTO agent_api_keys (id, organization_id, agent_id, prefix, key_hash) VALUES ($1, $2, $3, $4, $5)", ["key_E2E" + randomBytes(10).toString("hex"), rows[0].organization_id, rows[0].id, k.slice(0, 15), createHash("sha256").update(k).digest("hex")]);
       await c.end(); process.stdout.write(k);`,
    ],
    { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } },
  ).toString();

  const action = `Send 3 external emails (${testInfo.project.name} ${Date.now()})`;
  const post = (body: object) =>
    request.post("/api/agent-events", {
      headers: { Authorization: `Bearer ${apiKey}`, "Idempotency-Key": crypto.randomUUID() },
      data: body,
    });
  const task = (await (await post({ event_type: "task.started", name: "E2E outreach" })).json())
    .data;
  const req = await post({
    event_type: "approval.requested",
    task_id: task.task_id,
    action,
    capability: "send_external_email",
    risk: "high",
  });
  const { approval_id, approval_status } = (await req.json()).data;
  expect(approval_status).toBe("pending");

  await page.goto("/login");
  await page.getByLabel("Email").fill("manager@acme.test");
  await page.getByLabel("Password").fill("Acme-manager-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: /waiting for\s+approval/ })).toBeVisible();

  await page.goto("/approvals");
  const card = page.getByRole("listitem").filter({ hasText: action });
  await card.getByLabel(/Note for/).fill("Only existing customers");
  await card.getByRole("button", { name: "Approve" }).click();
  // Decided → it leaves the Pending list.
  await expect(page.getByRole("listitem").filter({ hasText: action })).toHaveCount(0);

  const poll = await request.get(`/api/agent/approvals/${approval_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  expect((await poll.json()).data).toMatchObject({
    status: "approved",
    decision_note: "Only existing customers",
  });

  await page.goto("/approvals?status=approved");
  await expect(page.getByRole("listitem").filter({ hasText: action })).toContainText(
    "Approved by Mohan Manager",
  );
});
