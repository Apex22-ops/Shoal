// Builds Shoal for Windows (x64) and zips it for a GitHub release.
// Runs on Windows (CI) or macOS. The .exe icon is only set when building on Windows
// (elsewhere it would need Wine). The app is not code-signed: Windows SmartScreen warns on first launch.
import { packager } from "@electron/packager";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const out = path.join(root, "dist");
const [appDir] = await packager({
  dir: root, out, name: "Shoal", platform: "win32", arch: "x64", overwrite: true, asar: false, prune: true,
  appVersion: version, executableName: "Shoal",
  ...(process.platform === "win32" ? { icon: path.join(root, "build", "icon.ico") } : {}),
  win32metadata: { CompanyName: "Shoal contributors", ProductName: "Shoal", FileDescription: "Shoal", OriginalFilename: "Shoal.exe" },
  ignore: [/^\/(dist|scripts|docs|build|\.github)($|\/)/, /\.md$/, /__pycache__/],
});
// node-pty ships prebuilt binaries for every platform: keep only this one
const pb = path.join(appDir, "resources", "app", "node_modules", "node-pty", "prebuilds");
for (const d of fs.readdirSync(pb)) if (d !== "win32-x64") fs.rmSync(path.join(pb, d), { recursive: true, force: true });
const zip = path.join(out, `Shoal-${version}-win-x64.zip`);
fs.rmSync(zip, { force: true });
if (process.platform === "win32") execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${appDir}' -DestinationPath '${zip}'`], { stdio: "inherit" });
else execFileSync("zip", ["-qry", zip, path.basename(appDir)], { cwd: out, stdio: "inherit" });
console.log("→", path.relative(root, zip));
