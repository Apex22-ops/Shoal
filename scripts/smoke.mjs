// Smoke test (CI, every platform): starts the server with plain Node, opens a conversation in a real
// pseudo-terminal, checks that terminal output arrives over the WebSocket, then stops everything.
// Claude Code does not need to be installed: the shell itself is enough to prove the terminal works.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";

const PORT = 4799, DATA = fs.mkdtempSync(path.join(os.tmpdir(), "shoal-smoke-"));
const server = spawn(process.execPath, ["src/server/server.mjs"], { env: { ...process.env, SHOAL_PORT: String(PORT), SHOAL_DATA: DATA }, stdio: ["ignore", "inherit", "inherit"] });
const fail = (msg) => { console.error("SMOKE FAIL:", msg); try { server.kill(); } catch {} process.exit(1); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => fail("timeout"), 60000).unref();

let health = null;
for (let i = 0; i < 50 && !health; i++) { await wait(200); try { health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json(); } catch {} }
if (health?.app !== "shoal") fail("no /health");
console.log("health ok", health);
if ((await fetch(`http://127.0.0.1:${PORT}/`)).status !== 200) fail("page not served");
const evil = await new Promise((r) => http.get({ host: "127.0.0.1", port: PORT, path: "/", headers: { host: "evil.example" } }, (res) => { res.resume(); r(res.statusCode); }).on("error", () => r(0)));
if (evil !== 421) fail("DNS-rebinding protection missing");

const token = fs.readFileSync(path.join(DATA, "token"), "utf8").trim();
const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${token}`, { headers: { origin: `http://127.0.0.1:${PORT}` } });
let created = null, output = "";
ws.on("message", (raw) => { const m = JSON.parse(raw); if (m.t === "created") created = m.id; if ((m.t === "out" || m.t === "replay") && m.id === created) output += m.data; });
await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
ws.send(JSON.stringify({ t: "new" }));
for (let i = 0; i < 100 && !(created && output.length > 20); i++) await wait(200);
if (!created) fail("no conversation created");
if (output.length <= 20) fail("no terminal output (pseudo-terminal not working)");
console.log(`terminal ok: ${output.length} bytes received`);
ws.send(JSON.stringify({ t: "in", id: created, data: "echo shoal-smoke\r" }));
await wait(1500);
await fetch(`http://127.0.0.1:${PORT}/quit`, { method: "POST", headers: { "x-shoal-token": token, "content-type": "application/json" }, body: "{}" });
await new Promise((r) => { server.on("exit", r); setTimeout(r, 5000); });
console.log("SMOKE OK");
process.exit(0);
