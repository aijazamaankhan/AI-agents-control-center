// Pure helpers for the AgentOS desktop app (no Electron imports → unit-tested from the repo).
"use strict";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Validates and normalises the AgentOS server address the user typed.
 * Returns { url } (origin only, e.g. "https://agentos.example.com") or { error }.
 * Plain http is only accepted for this computer — sessions would otherwise travel unencrypted.
 */
function normalizeServerUrl(input) {
  let raw = String(input ?? "").trim();
  if (!raw) return { error: "Enter the address of your AgentOS server." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    const host = raw.split(/[/:]/)[0].toLowerCase();
    raw = `${LOCAL_HOSTS.has(host) ? "http" : "https"}://${raw}`;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "That doesn't look like a web address." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { error: "Use an http:// or https:// address." };
  if (url.username || url.password)
    return { error: "Don't put a username or password in the address." };
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname))
    return { error: "Use https:// for servers other than this computer (localhost)." };
  return { url: url.origin };
}

/** True when `target` is on the same origin as the AgentOS server (stays inside the app). */
function isSameOrigin(target, serverUrl) {
  try {
    return new URL(target).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

/** Only real web links may be handed to the system browser. */
function isExternalWebLink(target) {
  try {
    const { protocol } = new URL(target);
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

/**
 * Items in `items` whose id isn't in `seen`. On the first poll (`seen` null) nothing is "new" —
 * we don't spam notifications for things that were already waiting when the app started.
 */
function newItems(items, seen) {
  if (!seen) return [];
  return items.filter((i) => !seen.has(i.id));
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Tray tooltip / menu header text from a summary (or the connection state). */
function trayStatus(state) {
  if (state.kind === "offline") return "AgentOS — can't reach the server";
  if (state.kind === "signed-out") return "AgentOS — signed out";
  if (state.kind !== "ok") return "AgentOS";
  const s = state.summary;
  const parts = [
    s.pendingApprovals
      ? `${plural(s.pendingApprovals, "approval")} waiting`
      : "No approvals waiting",
    `${s.agents.working} working`,
  ];
  if (s.agents.failed) parts.push(`${s.agents.failed} failed`);
  return `AgentOS · ${s.organization.name} — ${parts.join(" · ")}`;
}

/** Notification texts for new items (kept short; never includes prompts or results). */
function approvalNotification(a) {
  return {
    title: `Approval needed${a.risk === "high" ? " · high risk" : ""}`,
    body: `${a.agentName}: ${a.action}`.slice(0, 200),
  };
}

function failureNotification(t) {
  return {
    title: `Task failed · ${t.agentName}`,
    body: `${t.name}${t.error ? ` — ${t.error}` : ""}`.slice(0, 200),
  };
}

module.exports = {
  normalizeServerUrl,
  isSameOrigin,
  isExternalWebLink,
  newItems,
  trayStatus,
  approvalNotification,
  failureNotification,
};
