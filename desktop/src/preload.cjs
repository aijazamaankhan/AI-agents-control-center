// Preload for every AgentOS window. Web pages from your server get only a harmless marker —
// no Node.js and no IPC. The app's own local connect page (file://) additionally gets three
// calls to test/save the server address; the main process re-checks the sender for each.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentosDesktop", {
  isDesktop: true,
  platform: process.platform,
});

if (window.location.protocol === "file:") {
  contextBridge.exposeInMainWorld("connectApi", {
    get: () => ipcRenderer.invoke("connect:get"),
    test: (url) => ipcRenderer.invoke("connect:test", String(url)),
    save: (url) => ipcRenderer.invoke("connect:save", String(url)),
  });
}
