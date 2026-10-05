import { describe, expect, it, vi } from "vitest";
import { AppError, errorResponse, toErrorBody } from "@/lib/api/errors";

describe("API error envelope", () => {
  it("serializes AppError into the standard shape", () => {
    const { status, body } = toErrorBody(new AppError("RESOURCE_NOT_FOUND", "Agent not found"));
    expect(status).toBe(404);
    expect(body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Agent not found" } });
  });

  it("never leaks internal error details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error('relation "users" does not exist at /srv/app/db.ts:42'));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
    expect(JSON.stringify(json)).not.toMatch(/relation|\/srv|db\.ts/);
    spy.mockRestore();
  });
});
