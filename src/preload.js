// Minimal bridge between the page and the app: bring the window to the front (click on a notification)
// and open the settings from the app menu.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("shoal", {
  token: ipcRenderer.sendSync("shoal:token"),
  focus: () => ipcRenderer.send("shoal:focus"),
  onOpenSettings: (cb) => ipcRenderer.on("shoal:settings", () => cb()),
  onTour: (cb) => ipcRenderer.on("shoal:tour", () => cb()),
});
