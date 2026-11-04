const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ALR", {
  openUrl: (url) => ipcRenderer.invoke("open-url", url),
  focusLesson: () => ipcRenderer.invoke("focus-lesson"),

  setAutoSave: (v) => ipcRenderer.invoke("set-auto-save", v),
  setPauseAfterDetect: (v) => ipcRenderer.invoke("set-pause-after-detect", v),
  setAutoNext: (payload) => ipcRenderer.invoke("set-auto-next", payload),

  startFullAuto: (payload) => ipcRenderer.invoke("start-full-auto", payload),
  stopFullAuto: () => ipcRenderer.invoke("stop-full-auto"),

  saveCurrentNow: () => ipcRenderer.invoke("save-current-now"),
  redownloadCurrent: () => ipcRenderer.invoke("redownload-current"),
  cancelDownload: () => ipcRenderer.invoke("cancel-download"),

  openOutputFolder: () => ipcRenderer.invoke("open-output-folder"),
  showFile: (p) => ipcRenderer.invoke("show-file", p),
  getOutputFolder: () => ipcRenderer.invoke("get-output-folder"),

  getHistory: () => ipcRenderer.invoke("get-history"),
  clearFailedHistory: () => ipcRenderer.invoke("clear-failed-history"),

  onUserClick: (cb) => ipcRenderer.on("user-click-detected", (_e, d) => cb(d)),
  onLesson: (cb) => ipcRenderer.on("current-lesson", (_e, d) => cb(d)),
  onDetected: (cb) => ipcRenderer.on("lesson-detected", (_e, d) => cb(d)),
  onPlaylist: (cb) => ipcRenderer.on("playlist-detected", (_e, d) => cb(d)),
  onSkipped: (cb) => ipcRenderer.on("lesson-skipped", (_e, d) => cb(d)),
  onQueue: (cb) => ipcRenderer.on("queue-updated", (_e, d) => cb(d)),
  onStarted: (cb) => ipcRenderer.on("download-started", (_e, d) => cb(d)),
  onProgress: (cb) => ipcRenderer.on("download-progress", (_e, d) => cb(d)),
  onFinished: (cb) => ipcRenderer.on("download-finished", (_e, d) => cb(d)),
  onFailed: (cb) => ipcRenderer.on("download-failed", (_e, d) => cb(d)),
  onLog: (cb) => ipcRenderer.on("download-log", (_e, d) => cb(d)),
  onHistory: (cb) => ipcRenderer.on("history-updated", (_e, d) => cb(d)),
  onFullAutoState: (cb) => ipcRenderer.on("full-auto-state", (_e, d) => cb(d))
});
