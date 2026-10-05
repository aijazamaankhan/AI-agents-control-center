# AgentOS desktop app

A secure Electron shell around your AgentOS server, for Windows, macOS and Linux. It shows the
same AgentOS you use in the browser, plus:

- **Tray icon**: pending-approval count, quick links (Dashboard, approval pop-up, Tasks,
  Costs), and options (notifications, keep running when closed, start with your computer,
  change server). The icon gets an orange dot when something is waiting for you.
- **Desktop notifications**: new approval requests and failed tasks. Click one to open the
  approval pop-up or the failed task.
- **Approval pop-up**: a small always-on-top window to approve or reject requests quickly
  (`Ctrl/Cmd+Shift+A`).
- **Connect screen**: choose the server on first start, and a friendly retry screen when the
  server is unreachable.

## Run it (development)

Start AgentOS first (`npm run dev` in the project folder), then in a second terminal:

```bash
npm run desktop          # installs the desktop app's dependencies on first run, then opens it
```

Enter `http://localhost:3000`, sign in (for example `demo@agentos.dev` / `AgentOS-demo-2026`,
see `docs/LOGINS.md`) and the app remembers both the server and your session.

## Build an installer

Run this on the operating system you're building for:

```bash
npm run desktop:build    # Windows: desktop/dist/AgentOS Setup 0.1.0.exe + a portable .exe
                         # macOS: .dmg · Linux: .AppImage
```

The builds aren't code-signed yet, so Windows SmartScreen shows "Windows protected your PC".
Click **More info → Run anyway**. macOS: right-click the app and choose **Open**. Signing
certificates are a release task.

## Security

- Web pages run with `contextIsolation`, `sandbox` and no Node.js. The preload exposes only
  `window.agentosDesktop = { isDesktop, platform }`. The local connect page also gets
  test/save calls for the server address, and the main process re-checks the sender of each.
- Navigation is locked to your AgentOS server's origin. Every other link opens in your
  browser (`http`, `https` and `mailto` only); `<webview>` is blocked; permission requests
  (camera, microphone, location…) are denied.
- Plain `http://` is accepted only for `localhost`; other servers must use `https://`.
- Your session is the usual HTTP-only AgentOS cookie, stored in Electron's cookie store (like
  a browser). The settings file (`agentos-desktop.json` in the app's user-data folder) holds no
  secrets.
- Notifications contain names and short action texts only, never prompts or results.

## How it works

`src/main.cjs` runs the windows, tray, menu and notifications. Every 15 s it polls
`GET /api/v1/desktop/summary` with your session, and only items that appear after the first
poll trigger notifications. `src/lib.cjs` holds the pure helpers, unit-tested in
`tests/unit/desktop.test.ts`. The compact approval pop-up is the web page `/popup/approvals`.
