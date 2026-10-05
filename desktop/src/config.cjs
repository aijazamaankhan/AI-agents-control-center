// Small JSON settings file in the app's user-data folder (no secrets are stored here —
// the AgentOS session lives in Electron's cookie store, like a browser).
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  serverUrl: process.env.AGENTOS_URL || "",
  notifications: true,
  closeToTray: true,
  launchAtLogin: false,
  bounds: null,
};

function createConfig(dir) {
  const file = path.join(dir, "agentos-desktop.json");
  let data = { ...DEFAULTS };
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    /* first run */
  }
  return {
    get: (key) => data[key],
    set(key, value) {
      data[key] = value;
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("Could not save settings:", err.message);
      }
    },
  };
}

module.exports = { createConfig };
