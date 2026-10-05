// Local connect page: test the server address, then hand it to the main process.
"use strict";

const $ = (id) => document.getElementById(id);
const reason = new URLSearchParams(location.search).get("reason");

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = !message;
}

async function connect(url) {
  showError("");
  $("connect").disabled = true;
  $("connect").textContent = "Connecting…";
  try {
    const test = await window.connectApi.test(url);
    if (!test.ok) return showError(test.error);
    const saved = await window.connectApi.save(test.url);
    if (!saved.ok) showError(saved.error ?? "Could not save the address.");
  } finally {
    $("connect").disabled = false;
    $("connect").textContent = "Connect";
  }
}

async function init() {
  const info = await window.connectApi.get();
  if (info?.serverUrl) $("url").value = info.serverUrl;
  if (info?.version) $("version").textContent = `AgentOS desktop ${info.version}`;
  if (reason === "offline" && info?.serverUrl) {
    $("intro").hidden = true;
    $("problem").hidden = false;
    $("problem").textContent =
      `Can't reach AgentOS at ${info.serverUrl}. Make sure it's running (npm run dev), then try again — or enter a different address.`;
    $("retry").hidden = false;
  }
  $("url").focus();
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  void connect($("url").value);
});
$("retry").addEventListener("click", () => void connect($("url").value));
$("use-local").addEventListener("click", () => {
  $("url").value = "http://localhost:3000";
  $("url").focus();
});
void init();
