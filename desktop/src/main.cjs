// AgentOS desktop app — a secure shell around your AgentOS server with a tray icon,
// desktop notifications (approvals, failed tasks) and an approval pop-up.
"use strict";

const path = require("node:path");
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage,
  session,
  shell,
} = require("electron");
const { createConfig } = require("./config.cjs");
const {
  approvalNotification,
  failureNotification,
  isExternalWebLink,
  isSameOrigin,
  newItems,
  normalizeServerUrl,
  trayStatus,
} = require("./lib.cjs");

const APP_ID = "com.velorex.agentos";
const POLL_MS = 15_000;
const ASSETS = path.join(__dirname, "..", "assets");
const CONNECT_PAGE = path.join(__dirname, "connect.html");
const CONNECT_URL = require("node:url").pathToFileURL(CONNECT_PAGE).href;

// Windows can wrongly report a visible window as covered (e.g. under floating toolbars or
// screen-capture overlays), which pauses all page animations. Don't guess — always render.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

let config;
let mainWindow = null;
let popupWindow = null;
let tray = null;
let quitting = false;
let pollTimer = null;
let state = { kind: "starting" };
let seenApprovals = null;
let seenFailures = null;
let toldAboutTray = false;

const server = () => config.get("serverUrl");
const icon = (name) => nativeImage.createFromPath(path.join(ASSETS, name));

const SECURE_PREFS = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  spellcheck: true,
  // Keep the live workforce map animating: Chromium otherwise throttles/pauses animations when
  // it thinks the window is hidden (see the occlusion switch below).
  backgroundThrottling: false,
};

// ---------------------------------------------------------------- windows

function showConnectPage(reason) {
  const win = ensureMainWindow();
  void win.loadFile(CONNECT_PAGE, { query: reason ? { reason } : {} });
  win.show();
}

function openInMain(pathname = "/dashboard") {
  if (!server()) return showConnectPage();
  const win = ensureMainWindow();
  void win.loadURL(new URL(pathname, server()).href);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** Brings the window back as it was, or opens the dashboard the first time. */
function showMain() {
  if (mainWindow && !mainWindow.isDestroyed() && server()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    openInMain("/dashboard");
  }
}

function ensureMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const bounds = config.get("bounds") ?? { width: 1360, height: 860 };
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "AgentOS",
    backgroundColor: "#050607",
    icon: icon("icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: SECURE_PREFS,
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Server unreachable → friendly connect/retry page instead of a blank window.
  mainWindow.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted by a new navigation */) return;
    if (url.startsWith("file:")) return;
    showConnectPage("offline");
  });

  const saveBounds = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized())
      config.set("bounds", mainWindow.getBounds());
  };
  mainWindow.on("resized", saveBounds);
  mainWindow.on("moved", saveBounds);

  mainWindow.on("close", (event) => {
    if (quitting || !config.get("closeToTray") || !tray) return;
    event.preventDefault();
    mainWindow.hide();
    if (!toldAboutTray && Notification.isSupported()) {
      toldAboutTray = true;
      new Notification({
        title: "AgentOS is still running",
        body: "It keeps watching for approvals in the tray. Right-click the tray icon to quit.",
        icon: icon("icon.png"),
      }).show();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function openApprovalsPopup() {
  if (!server()) return showConnectPage();
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.reload();
    popupWindow.show();
    popupWindow.focus();
    return;
  }
  popupWindow = new BrowserWindow({
    width: 460,
    height: 680,
    minWidth: 380,
    minHeight: 400,
    title: "Pending approvals — AgentOS",
    alwaysOnTop: true,
    minimizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#050607",
    icon: icon("icon.png"),
    webPreferences: SECURE_PREFS,
  });
  void popupWindow.loadURL(new URL("/popup/approvals", server()).href);
  popupWindow.on("closed", () => {
    popupWindow = null;
    void poll(); // decisions made in the pop-up update the tray right away
  });
}

// ---------------------------------------------------------------- security

function hardenContents(contents) {
  contents.on("will-attach-webview", (e) => e.preventDefault());
  contents.on("will-navigate", (event, url) => {
    if (url.startsWith(CONNECT_URL) || (server() && isSameOrigin(url, server()))) return;
    event.preventDefault();
    if (isExternalWebLink(url)) void shell.openExternal(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    // Links inside AgentOS open in the main window; everything else in the system browser.
    if (server() && isSameOrigin(url, server())) {
      const target = new URL(url);
      openInMain(target.pathname + target.search);
    } else if (isExternalWebLink(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

function lockDownSession() {
  const ses = session.defaultSession;
  // The app needs no camera, microphone, location, etc. Notifications come from the main process.
  ses.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === "clipboard-sanitized-write"),
  );
  ses.setPermissionCheckHandler((_wc, permission) => permission === "clipboard-sanitized-write");
}

// ---------------------------------------------------------------- polling & notifications

async function poll() {
  clearTimeout(pollTimer);
  if (server()) {
    try {
      const res = await session.defaultSession.fetch(
        new URL("/api/v1/desktop/summary", server()).href,
        { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      if (res.status === 401 || res.status === 403) {
        state = { kind: "signed-out" };
        seenApprovals = seenFailures = null;
      } else if (!res.ok) {
        state = { kind: "offline" };
      } else {
        const { data } = await res.json();
        notifyAbout(data);
        state = { kind: "ok", summary: data };
      }
    } catch {
      state = { kind: "offline" };
    }
  }
  updateTray();
  pollTimer = setTimeout(poll, POLL_MS);
}

function notifyAbout(summary) {
  const freshApprovals = newItems(summary.approvals, seenApprovals);
  const freshFailures = newItems(summary.failedTasks, seenFailures);
  seenApprovals = new Set(summary.approvals.map((a) => a.id));
  seenFailures = new Set(summary.failedTasks.map((t) => t.id));
  if (!config.get("notifications") || !Notification.isSupported()) return;

  for (const a of freshApprovals.slice(0, 3)) {
    const n = new Notification({ ...approvalNotification(a), icon: icon("icon.png") });
    n.on("click", openApprovalsPopup);
    n.show();
  }
  for (const t of freshFailures.slice(0, 3)) {
    const n = new Notification({ ...failureNotification(t), icon: icon("icon.png") });
    n.on("click", () => openInMain(`/tasks/${encodeURIComponent(t.id)}`));
    n.show();
  }
  if (freshApprovals.length && popupWindow && !popupWindow.isDestroyed()) popupWindow.reload();
}

// ---------------------------------------------------------------- tray & menus

function updateTray() {
  if (!tray) return;
  const pending = state.kind === "ok" ? state.summary.pendingApprovals : 0;
  tray.setToolTip(trayStatus(state));
  tray.setImage(icon(pending ? "tray-attention.png" : "tray.png"));
  if (process.platform === "darwin") tray.setTitle(pending ? String(pending) : "");
  app.setBadgeCount(pending);
  if (mainWindow && !mainWindow.isDestroyed() && process.platform === "win32") {
    mainWindow.setOverlayIcon(
      pending ? icon("badge.png") : null,
      pending ? `${pending} approvals waiting` : "",
    );
  }

  const signedIn = state.kind === "ok";
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: trayStatus(state).replace(/^AgentOS · /, ""), enabled: false },
      { type: "separator" },
      { label: "Open AgentOS", click: showMain },
      {
        label: pending ? `Pending approvals (${pending})…` : "Pending approvals…",
        enabled: signedIn,
        click: openApprovalsPopup,
      },
      { label: "Tasks", enabled: signedIn, click: () => openInMain("/tasks") },
      { label: "Costs & Usage", enabled: signedIn, click: () => openInMain("/costs") },
      ...(state.kind === "signed-out"
        ? [{ label: "Sign in…", click: () => openInMain("/login") }]
        : []),
      { type: "separator" },
      {
        label: "Desktop notifications",
        type: "checkbox",
        checked: config.get("notifications"),
        click: (item) => config.set("notifications", item.checked),
      },
      {
        label: "Keep running when the window is closed",
        type: "checkbox",
        checked: config.get("closeToTray"),
        click: (item) => config.set("closeToTray", item.checked),
      },
      {
        label: "Start with my computer",
        type: "checkbox",
        checked: config.get("launchAtLogin"),
        click: (item) => {
          config.set("launchAtLogin", item.checked);
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--hidden"] });
        },
      },
      { label: "Change server…", click: () => showConnectPage("change") },
      { type: "separator" },
      { label: "Quit AgentOS", click: quit },
    ]),
  );
}

function buildAppMenu() {
  const go = (label, p, accelerator) => ({ label, accelerator, click: () => openInMain(p) });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      {
        label: "File",
        submenu: [
          { label: "Change server…", click: () => showConnectPage("change") },
          { type: "separator" },
          { label: "Quit AgentOS", accelerator: "CmdOrCtrl+Q", click: quit },
        ],
      },
      { role: "editMenu" },
      {
        label: "Go",
        submenu: [
          go("Dashboard", "/dashboard", "CmdOrCtrl+1"),
          go("Agents", "/agents", "CmdOrCtrl+2"),
          go("Tasks", "/tasks", "CmdOrCtrl+3"),
          go("Approvals", "/approvals", "CmdOrCtrl+4"),
          go("Costs & Usage", "/costs", "CmdOrCtrl+5"),
          go("Activity", "/activity", "CmdOrCtrl+6"),
          { type: "separator" },
          { label: "Approval pop-up", accelerator: "CmdOrCtrl+Shift+A", click: openApprovalsPopup },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
          ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
        ],
      },
      { role: "windowMenu" },
    ]),
  );
}

function quit() {
  quitting = true;
  app.quit();
}

// ---------------------------------------------------------------- connect page IPC

function fromConnectPage(event) {
  return event.senderFrame?.url?.startsWith(CONNECT_URL);
}

function registerIpc() {
  ipcMain.handle("connect:get", (event) =>
    fromConnectPage(event) ? { serverUrl: server(), version: app.getVersion() } : null,
  );
  ipcMain.handle("connect:test", async (event, input) => {
    if (!fromConnectPage(event)) return { ok: false, error: "Not allowed." };
    const parsed = normalizeServerUrl(input);
    if (parsed.error) return { ok: false, error: parsed.error };
    try {
      const res = await session.defaultSession.fetch(`${parsed.url}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      const body = await res.json().catch(() => null);
      if (!body || !("status" in body))
        return { ok: false, error: "That server answered, but it isn't AgentOS." };
      if (body.status !== "ok")
        return { ok: false, error: "AgentOS is running but its database isn't reachable yet." };
      return { ok: true, url: parsed.url };
    } catch {
      return {
        ok: false,
        error: `Can't reach ${parsed.url}. Is AgentOS running (npm run dev)?`,
      };
    }
  });
  ipcMain.handle("connect:save", (event, input) => {
    if (!fromConnectPage(event)) return { ok: false };
    const parsed = normalizeServerUrl(input);
    if (parsed.error) return { ok: false, error: parsed.error };
    if (parsed.url !== server()) seenApprovals = seenFailures = null;
    config.set("serverUrl", parsed.url);
    openInMain("/dashboard");
    void poll();
    return { ok: true };
  });
}

// ---------------------------------------------------------------- lifecycle

app.setAppUserModelId(APP_ID); // Windows notifications need this
app.on("second-instance", () => showMain());
app.on("web-contents-created", (_e, contents) => hardenContents(contents));
app.on("before-quit", () => {
  quitting = true;
});
app.on("window-all-closed", () => {
  if (!tray) app.quit(); // with a tray the app keeps running
});
app.on("activate", () => showMain());

app.whenReady().then(() => {
  config = createConfig(app.getPath("userData"));
  lockDownSession();
  registerIpc();
  buildAppMenu();

  tray = new Tray(icon("tray.png"));
  tray.on("click", () => {
    if (mainWindow?.isVisible() && mainWindow.isFocused()) mainWindow.hide();
    else showMain();
  });
  updateTray();

  const startHidden = process.argv.includes("--hidden");
  if (!server()) showConnectPage();
  else if (!startHidden) openInMain("/dashboard");
  void poll();
});
