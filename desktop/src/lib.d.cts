// Types for lib.cjs (used by the repo's unit tests).
type Result = { url: string; error?: undefined } | { url?: undefined; error: string };
type State =
  | { kind: "starting" | "offline" | "signed-out" }
  | {
      kind: "ok";
      summary: {
        organization: { name: string };
        agents: { working: number; failed: number };
        pendingApprovals: number;
      };
    };
export function normalizeServerUrl(input: unknown): Result;
export function isSameOrigin(target: string, serverUrl: string): boolean;
export function isExternalWebLink(target: string): boolean;
export function newItems<T extends { id: string }>(items: T[], seen: Set<string> | null): T[];
export function trayStatus(state: State): string;
export function approvalNotification(a: { risk: string; agentName: string; action: string }): {
  title: string;
  body: string;
};
export function failureNotification(t: { agentName: string; name: string; error: string | null }): {
  title: string;
  body: string;
};
