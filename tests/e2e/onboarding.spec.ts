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

  // Phase 3: connect an agent.
  await page.goto("/agents");
  await expect(page.getByText("Your AI workforce is empty.")).toBeVisible();
  await page.getByRole("link", { name: "Connect Your First Agent" }).click();
  await expect(page).toHaveURL(/\/agents\/new$/);
  await page.getByLabel("Agent name").fill("Lead Research Agent");
  await page.getByLabel("Department", { exact: true }).selectOption({ label: "Sales" });
  await page.getByLabel("Model", { exact: true }).fill("Claude Sonnet");
  await page.getByRole("button", { name: "Web research" }).click();
  await page.getByRole("button", { name: "Send external email" }).click();
  // SDK agents have no endpoint: "Test connection" explains how they connect.
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/connects by sending events with its AgentOS API key/)).toBeVisible();
  // A webhook pointing at a private address is refused (SSRF protection), and typed values survive.
  await page.locator("label", { hasText: "Webhook" }).click();
  await page.getByLabel("Agent endpoint").fill("http://169.254.169.254/latest");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/private or local network address/)).toBeVisible();
  await expect(page.getByLabel("Agent name")).toHaveValue("Lead Research Agent");
  await page.locator("label", { hasText: "SDK" }).first().click();
  await page.getByRole("button", { name: "Connect Agent" }).click();
  await expect(page.getByRole("heading", { name: /Lead Research Agent connected/ })).toBeVisible();
  await expect(page.getByTestId("api-key")).toHaveText(/^aos_live_/);
  const apiKey = (await page.getByTestId("api-key").textContent())!.trim();

  // Phase 4: the agent reports work with its API key (same calls the SDK makes).
  const report = (body: object, key = crypto.randomUUID()) =>
    page.request.post("/api/agent-events", {
      headers: { Authorization: `Bearer ${apiKey}`, "Idempotency-Key": key },
      data: body,
    });
  const started = await (
    await report({ event_type: "task.started", name: "Find 50 SaaS companies in India" })
  ).json();
  const llmKey = crypto.randomUUID();
  const llm = {
    event_type: "llm.call",
    task_id: started.data.task_id,
    provider: "anthropic",
    model: "claude-sonnet",
    input_tokens: 12430,
    output_tokens: 2840,
  };
  expect((await report(llm, llmKey)).status()).toBe(201);
  expect((await report(llm, llmKey)).status()).toBe(200); // duplicate → not double-counted
  expect(
    (
      await report({
        event_type: "tool.call",
        task_id: started.data.task_id,
        tool_name: "web_search",
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await report({
        event_type: "task.completed",
        task_id: started.data.task_id,
        result: { leadsFound: 47 },
      })
    ).status(),
  ).toBe(201);

  await page.getByRole("link", { name: "Open agent" }).click();

  await expect(page.getByRole("heading", { name: "Lead Research Agent", level: 1 })).toBeVisible();
  await expect(page.getByText("Online").first()).toBeVisible();
  await page
    .getByRole("navigation", { name: "Agent sections" })
    .getByRole("link", { name: "Permissions" })
    .click();
  await expect(page.getByText("Approval required")).toBeVisible();
  await expect(page.getByText("Send external email").first()).toBeVisible();

  await page
    .getByRole("navigation", { name: "Agent sections" })
    .getByRole("link", { name: "Tasks" })
    .click();
  await expect(page.getByRole("cell", { name: /Find 50 SaaS companies in India/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "15.27K" })).toBeVisible(); // 12,430 + 2,840 counted once

  await page.goto("/dashboard");
  const liveMap = page.getByRole("region", { name: "Workforce map" });
  await expect(liveMap.getByText("Sample workforce · simulated")).toHaveCount(0);
  await expect(liveMap.getByText("Live", { exact: true })).toBeVisible();
  await expect(liveMap.getByRole("button", { name: /^Lead Research Agent, Idle/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Workforce KPIs" })).toContainText(
    "1 completed · 0 failed",
  );

  // Phase 5: tasks list → execution trace, activity stream, global search.
  await page.goto("/tasks");
  await page.getByLabel("Status").selectOption("COMPLETED");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("link", { name: "Find 50 SaaS companies in India" }).click();
  const trace = page.getByRole("list", { name: "Execution trace" });
  await expect(trace.getByText("LLM call", { exact: true })).toBeVisible();
  await expect(trace.getByText("Task completed", { exact: true })).toBeVisible();
  await trace.getByText("claude-sonnet · 12,430 in / 2,840 out").click();
  await expect(trace.getByText("Input tokens")).toBeVisible();
  await expect(page.getByText('"leadsFound": 47')).toBeVisible();

  await page.goto("/activity");
  await expect(page.getByRole("list", { name: "Activity stream" })).toContainText(
    "Called web_search",
  );

  await page
    .getByRole("searchbox", { name: "Search agents, tasks and departments" })
    .fill("Lead Research");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Lead/);
  await expect(page.getByRole("region", { name: "Agents" })).toContainText("Lead Research Agent");

  // A department with agents can't be deleted.
  await page.goto("/departments");
  await page
    .getByRole("list", { name: "Departments" })
    .getByRole("link", { name: /Sales/ })
    .click();
  await expect(page.getByRole("list", { name: "Agents in Sales" })).toContainText(
    "Lead Research Agent",
  );
  await page.getByRole("button", { name: "Delete department" }).click();
  await page.getByRole("button", { name: "Delete department" }).click();
  await expect(page.getByText(/still has 1 agent/)).toBeVisible();

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
  // Regression: invalid nesting (<dialog> inside <p>) broke hydration — any console error fails.
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(e.message));
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
  expect(consoleErrors).toEqual([]);
});
