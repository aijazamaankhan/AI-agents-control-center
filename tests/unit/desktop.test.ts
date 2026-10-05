import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const lib = require("../../desktop/src/lib.cjs") as typeof import("../../desktop/src/lib.cjs");

describe("desktop app helpers", () => {
  it("normalises server addresses and only allows plain http for this computer", () => {
    expect(lib.normalizeServerUrl("localhost:3000")).toEqual({ url: "http://localhost:3000" });
    expect(lib.normalizeServerUrl("agentos.example.com/dashboard")).toEqual({
      url: "https://agentos.example.com",
    });
    expect(lib.normalizeServerUrl("http://agentos.example.com").error).toMatch(/https/);
    expect(lib.normalizeServerUrl("file:///etc/passwd").error).toBeTruthy();
    expect(lib.normalizeServerUrl("https://user:pw@x.com").error).toMatch(/password/);
    expect(lib.normalizeServerUrl("").error).toBeTruthy();
  });

  it("keeps navigation on the server origin and only opens web links externally", () => {
    expect(lib.isSameOrigin("http://localhost:3000/tasks", "http://localhost:3000")).toBe(true);
    expect(lib.isSameOrigin("http://localhost:3001/", "http://localhost:3000")).toBe(false);
    expect(lib.isExternalWebLink("https://example.com")).toBe(true);
    expect(lib.isExternalWebLink("file:///C:/Windows/system32/calc.exe")).toBe(false);
    expect(lib.isExternalWebLink("javascript:alert(1)")).toBe(false);
  });

  it("notifies only about items that appeared after the first poll", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(lib.newItems(items, null)).toEqual([]);
    expect(lib.newItems(items, new Set(["a"]))).toEqual([{ id: "b" }]);
  });

  it("builds tray and notification texts", () => {
    const summary = {
      organization: { name: "Acme" },
      agents: { working: 2, failed: 1 },
      pendingApprovals: 3,
    };
    expect(lib.trayStatus({ kind: "ok", summary })).toBe(
      "AgentOS · Acme — 3 approvals waiting · 2 working · 1 failed",
    );
    expect(lib.trayStatus({ kind: "signed-out" })).toMatch(/signed out/);
    expect(
      lib.approvalNotification({ risk: "high", agentName: "Outreach", action: "Send email" }),
    ).toEqual({ title: "Approval needed · high risk", body: "Outreach: Send email" });
  });
});
