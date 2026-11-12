// Shoal desktop app (Electron): its own window, Dock icon, notifications and a badge with the number
// of conversations waiting for you. The server that runs the conversations is a separate background
// process (src/server/server.mjs), started with Electron's own Node.js: nothing else to install.
const { app, BrowserWindow, Menu, ipcMain, shell, screen } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

app.setName("Shoal");
if (process.env.SHOAL_DATA) app.setPath("userData", process.env.SHOAL_DATA); // separate profile (tests, several installs)
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const DATA = app.getPath("userData"); // ~/Library/Application Support/Shoal
const SERVER = path.join(__dirname, "server", "server.mjs");
const VERSION = app.getVersion();
const HOMEPAGE = (() => { try { return require("../package.json").homepage || "https://github.com"; } catch { return "https://github.com"; } })();
let PORT = Number(process.env.SHOAL_PORT || readFile("port") || 4747);
let win = null;
let quitting = false;

function readFile(name) { try { return fs.readFileSync(path.join(DATA, name), "utf8").trim(); } catch { return ""; } }
const settings = () => { try { return JSON.parse(readFile("settings.json") || "{}"); } catch { return {}; } };
const url = () => `http://127.0.0.1:${PORT}/?app=1`;

// What answers on a port: { shoal: version } for a Shoal server, "other" for something else, null if free
function probe(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 800 }, (res) => {
      let b = ""; res.on("data", (d) => (b += d));
      res.on("end", () => { try { const j = JSON.parse(b); resolve(j.app === "shoal" ? { shoal: j.version } : "other"); } catch { resolve("other"); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve("other"); });
  });
}
function post(pathname) {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: pathname, method: "POST", timeout: 1500, headers: { "x-shoal-token": readFile("token"), "content-type": "application/json" } },
      (res) => { res.resume(); res.on("end", resolve); });
    req.on("error", resolve); req.on("timeout", () => { req.destroy(); resolve(); });
    req.end("{}");
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureServer() {
  let p = await probe(PORT);
  // a Shoal server from an older version of the app: ask it to stop (open conversations are resumed)
  if (p && p.shoal && p.shoal !== VERSION) { await post("/quit"); for (let i = 0; i < 30 && (await probe(PORT)); i++) await wait(100); p = await probe(PORT); }
  if (p && p.shoal) return;
  // port taken by another program: use the next free one
  for (let i = 0; p === "other" && i < 20; i++) { PORT++; p = await probe(PORT); }
  if (p && p.shoal) return;
  fs.mkdirSync(DATA, { recursive: true });
  const log = fs.openSync(path.join(DATA, "server.log"), "a");
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", SHOAL_PORT: String(PORT), SHOAL_DATA: DATA };
  const child = spawn(process.execPath, [SERVER], { cwd: app.getPath("home"), env, detached: true, stdio: ["ignore", log, log] });
  child.unref();
  for (let i = 0; i < 100; i++) { const q = await probe(PORT); if (q && q.shoal) return; await wait(100); }
}

function createWindow() {
  // sized and centered on the screen where the pointer is (never larger than that screen)
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const area = { width: wa.width, height: wa.height };
  const w = Math.min(1600, wa.width), h = Math.min(1000, wa.height);
  win = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2),
    width: w, height: h, minWidth: Math.min(900, area.width), minHeight: Math.min(600, area.height),
    title: "Shoal", backgroundColor: ({ amethyst: "#0B0716", amber: "#0F0B05", dark: "#111214", light: "#F4F5F7", "malachite-light": "#EEF7F3", lavender: "#F5F2FB", "amber-light": "#FBF6EE" })[settings().theme] || "#030913",
    titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 12 },
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, zoomFactor: 1 },
  });
  win.loadURL(url());
  // always start at 100 % (Chromium may restore a saved zoom level for the page, which made everything smaller and dimmer)
  win.webContents.on("did-finish-load", () => win.webContents.setZoomLevel(0));
  // Dock badge = number of conversations waiting (the page title starts with "(n)")
  win.on("page-title-updated", (e, title) => {
    e.preventDefault();
    const m = title.match(/^\((\d+)\)/);
    app.dock?.setBadge(m ? m[1] : "");
  });
  // links open in the browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:\/\//.test(u)) shell.openExternal(u); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, u) => { if (!u.startsWith(`http://127.0.0.1:${PORT}/`)) { e.preventDefault(); if (/^https?:\/\//.test(u)) shell.openExternal(u); } });
  win.webContents.session.setPermissionRequestHandler((_wc, perm, cb) => cb(["notifications", "clipboard-sanitized-write"].includes(perm)));
  // the server restarted (or was stopped): start it again and reload
  win.webContents.on("did-fail-load", () => setTimeout(async () => { await ensureServer(); win && win.loadURL(url()); }, 1000));
  // closing the window hides it: conversations keep running
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ label: "Shoal", submenu: [
      { role: "about" }, { type: "separator" },
      { label: "Settings…", accelerator: "Cmd+,", click: () => { win?.show(); win?.webContents.send("shoal:settings"); } },
      { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" },
      { label: "Quit Shoal", accelerator: "Cmd+Q", click: () => app.quit() },
    ] }] : []),
    { role: "editMenu" },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { role: "windowMenu" },
    { role: "help", submenu: [{ label: "Show the tour", click: () => { win?.show(); win?.webContents.send("shoal:tour"); } }, { label: "Shoal on GitHub", click: () => shell.openExternal(HOMEPAGE) }] },
  ]));
}

// the access token is handed to the Shoal window only (it is never served over HTTP)
ipcMain.on("shoal:token", (e) => { e.returnValue = e.senderFrame && e.senderFrame.url.startsWith(`http://127.0.0.1:${PORT}/`) ? readFile("token") : ""; });
ipcMain.on("shoal:focus", () => { if (!win) return; win.show(); win.focus(); app.focus({ steal: true }); });

app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
app.on("activate", () => { if (win) win.show(); });
// ⌘Q: stops the conversations too, unless "Keep conversations running after quitting" is on.
// They are noted and resumed at the next launch either way.
app.on("before-quit", async (e) => {
  if (quitting) return;
  quitting = true;
  if (settings().keepRunning) return;
  e.preventDefault();
  await post("/quit");
  app.quit();
});
app.whenReady().then(async () => { buildMenu(); await ensureServer(); createWindow(); });
