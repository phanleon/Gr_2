const { app, BrowserWindow, ipcMain, session, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const PARTITION = "persist:auto-lesson-autosave-v4";

let controlWindow = null;
let lessonWindow = null;

let outputDir = "";
let historyFile = "";
let history = { version: 2, items: [] };

let autoSaveEnabled = true;
let pauseAfterDetect = true;
let autoNextEnabled = true;
let nextText = "Bài sau";
let nextSelector = "";

let lastUserClickAt = 0;
let clickArmUntil = 0;
let lastClick = null;

let playlists = [];
let preparing = false;
let lastQueuedSignature = "";
let queuedIds = new Set();

let queue = [];
let queueRunning = false;
let activeFfmpeg = null;

// Full-auto state
let fullAutoRunning = false;
let stopFullAutoRequested = false;
let sessionSequence = 1;
let sessionVisitedIds = new Set();
let lastCompletedLesson = null;

function send(channel, data) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(channel, data);
  }
}

function safeName(name) {
  return String(name || "lesson")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "lesson";
}

function lessonId(info) {
  const key = [
    String(info.title || "").trim(),
    String(info.url || "").split("#")[0],
    String(info.src || ""),
    Math.round(Number(info.duration || 0))
  ].join("|");

  return {
    id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 16),
    signature: key
  };
}

function extractLessonNumber(title) {
  const text = String(title || "");
  const patterns = [
    /\bbài\s*[:#-]?\s*(\d{1,5})\b/i,
    /\blesson\s*[:#-]?\s*(\d{1,5})\b/i,
    /^\s*(\d{1,5})[\s._\-:]/
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function orderedBaseName(title, sequenceOverride = null) {
  const lessonNo = extractLessonNumber(title);
  const order =
    lessonNo ??
    (Number.isFinite(sequenceOverride) && sequenceOverride > 0
      ? sequenceOverride
      : sessionSequence);

  return `${String(order).padStart(3, "0")}_${safeName(title)}`;
}

function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      const data = JSON.parse(fs.readFileSync(historyFile, "utf8"));
      if (data && Array.isArray(data.items)) {
        history = data;
        return;
      }
    }
  } catch (e) {
    console.error("History load error:", e);
  }
  history = { version: 2, items: [] };
}

function saveHistory() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf8");
}

function upsertHistory(item) {
  const i = history.items.findIndex(x => x.id === item.id);
  if (i >= 0) history.items[i] = { ...history.items[i], ...item };
  else history.items.unshift(item);

  history.items = history.items.slice(0, 3000);
  saveHistory();
  send("history-updated", history.items);
}

function doneAndExists(id) {
  const item = history.items.find(x => x.id === id);
  return !!(
    item &&
    item.status === "done" &&
    item.outputPath &&
    fs.existsSync(item.outputPath)
  );
}

function uniqueOutput(baseName) {
  fs.mkdirSync(outputDir, { recursive: true });

  let p = path.join(outputDir, `${safeName(baseName)}.mp4`);
  let n = 2;

  while (fs.existsSync(p)) {
    p = path.join(outputDir, `${safeName(baseName)}_${n}.mp4`);
    n++;
  }

  return p;
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1040,
    height: 940,
    minWidth: 900,
    minHeight: 720,
    title: "Auto Lesson Downloader V4 - Full Auto",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  controlWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function createLessonWindow() {
  if (lessonWindow && !lessonWindow.isDestroyed()) return lessonWindow;

  lessonWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    title: "Lesson Browser",
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, "lesson_preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  lessonWindow.on("closed", () => {
    lessonWindow = null;
    playlists = [];
    clickArmUntil = 0;
    stopFullAutoRequested = true;
  });

  return lessonWindow;
}

function rememberPlaylist(details, source, contentType = "") {
  const url = String(details.url || "");
  if (!url) return;

  const old = playlists.find(x => x.url === url);
  if (old) {
    old.lastSeen = Date.now();
    if (contentType) old.contentType = contentType;
    return;
  }

  const item = {
    url,
    source,
    contentType,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    pageUrl:
      lessonWindow && !lessonWindow.isDestroyed()
        ? lessonWindow.webContents.getURL()
        : ""
  };

  playlists.push(item);
  if (playlists.length > 120) playlists.shift();

  send("playlist-detected", item);
}

function installNetworkMonitor() {
  const ses = session.fromPartition(PARTITION);

  ses.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      if (/\.m3u8(?:$|[?#])/i.test(details.url || "")) {
        rememberPlaylist(details, "url");
      }
      callback({ cancel: false });
    }
  );

  ses.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      let contentType = "";
      const headers = details.responseHeaders || {};

      // Electron versions differ: support object/map and array-like shapes.
      if (Array.isArray(headers)) {
        for (const h of headers) {
          if (String(h?.name || "").toLowerCase() === "content-type") {
            contentType = String(h?.value || "");
            break;
          }
        }
      } else if (headers && typeof headers === "object") {
        for (const [name, value] of Object.entries(headers)) {
          if (String(name).toLowerCase() !== "content-type") continue;
          contentType = Array.isArray(value)
            ? String(value[0] || "")
            : String(value || "");
          break;
        }
      }

      if (/mpegurl/i.test(contentType)) {
        rememberPlaylist(details, "content-type", contentType);
      }

      callback({ responseHeaders: details.responseHeaders });
    }
  );
}

async function execLesson(script) {
  if (!lessonWindow || lessonWindow.isDestroyed()) {
    throw new Error("Cửa sổ bài học chưa mở.");
  }
  return lessonWindow.webContents.executeJavaScript(script, true);
}

async function getLessonInfo() {
  return execLesson(`
  (() => {
    const video =
      document.querySelector("#main_video_html5_api") ||
      document.querySelector("video");

    const visible = (el) => {
      if (!el) return "";
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return "";
      return (el.innerText || el.textContent || "")
        .trim()
        .replace(/\\s+/g, " ");
    };

    const selectors = [
      "[data-lesson-title]",
      "[data-title]",
      ".lesson-title",
      ".course-lesson-title",
      ".lecture-title",
      ".video-title",
      ".main-video h1",
      ".main-video h2",
      ".main-video h3",
      "h1", "h2", "h3"
    ];

    const titles = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const t = visible(el);
        if (t && t.length <= 240) titles.push(t);
      }
    }

    const title =
      titles.find(t => /\\bbài\\s*\\d+/i.test(t)) ||
      titles.find(t => t.length >= 4) ||
      document.title ||
      "Bài học";

    return {
      title,
      pageTitle: document.title,
      url: location.href,
      hasVideo: !!video,
      readyState: video ? Number(video.readyState || 0) : 0,
      duration:
        video && Number.isFinite(video.duration)
          ? Number(video.duration)
          : 0,
      currentTime: video ? Number(video.currentTime || 0) : 0,
      paused: video ? !!video.paused : true,
      src: video ? String(video.currentSrc || video.src || "") : ""
    };
  })()
  `);
}

async function waitForVideoReady(timeout = 60000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (stopFullAutoRequested) {
      throw new Error("Đã dừng Full Auto.");
    }

    try {
      const info = await getLessonInfo();
      if (info.hasVideo && info.readyState >= 1) return info;
    } catch {}

    await new Promise(r => setTimeout(r, 600));
  }

  throw new Error("Không tìm thấy video sẵn sàng.");
}

async function triggerStream() {
  return execLesson(`
  (async () => {
    const video =
      document.querySelector("#main_video_html5_api") ||
      document.querySelector("video");

    if (!video) {
      return { ok: false, reason: "Không tìm thấy video." };
    }

    try {
      video.muted = true;

      if (video.readyState < 1) {
        await new Promise(resolve => {
          const done = () => resolve();
          video.addEventListener("loadedmetadata", done, { once: true });
          setTimeout(done, 12000);
        });
      }

      try {
        if (Number(video.currentTime || 0) > 1) video.currentTime = 0;
      } catch {}

      try {
        await video.play();
        await new Promise(r => setTimeout(r, 900));
      } catch {}

      if (${pauseAfterDetect ? "true" : "false"}) {
        try { video.pause(); } catch {}
        try { video.currentTime = 0; } catch {}
      }

      return {
        ok: true,
        duration: Number.isFinite(video.duration)
          ? Number(video.duration)
          : 0,
        src: String(video.currentSrc || video.src || "")
      };
    } catch (e) {
      return {
        ok: false,
        reason: String(e && e.message ? e.message : e)
      };
    }
  })()
  `);
}

function playlistScore(p) {
  const u = String(p.url || "").toLowerCase();
  let score = 0;

  if (u.includes("master")) score += 100;
  if (u.includes("manifest")) score += 90;
  if (u.includes("playlist")) score += 55;
  if (u.includes("index")) score += 35;
  if (u.includes("audio")) score -= 40;
  if (u.includes("subtitle") || u.includes("caption")) score -= 100;
  if (p.source === "content-type") score += 10;

  return score;
}

async function waitPlaylist(afterTs, timeout = 18000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const list = playlists
      .filter(x => x.lastSeen >= afterTs - 1500)
      .sort((a, b) => {
        const d = playlistScore(b) - playlistScore(a);
        return d || a.firstSeen - b.firstSeen;
      });

    if (list.length) return list[0];

    if (stopFullAutoRequested) {
      throw new Error("Đã dừng Full Auto.");
    }

    await new Promise(r => setTimeout(r, 350));
  }

  return null;
}

async function authHeaders(url, referer) {
  const ses = lessonWindow.webContents.session;
  const cookies = await ses.cookies.get({ url });
  const cookie = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  const ua = lessonWindow.webContents.getUserAgent();

  const object = {};
  if (ua) object["User-Agent"] = ua;
  if (referer) object["Referer"] = referer;
  if (cookie) object["Cookie"] = cookie;

  return {
    object,
    ffmpeg: Object.entries(object)
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join("")
  };
}

async function playlistLooksProtected(url, headers) {
  try {
    const r = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow"
    });

    if (!r.ok) return false;

    const text = (await r.text()).slice(0, 512000);

    return text
      .split(/\r?\n/)
      .some(line =>
        /^#EXT-X-KEY:/i.test(line) &&
        !/METHOD=NONE/i.test(line)
      );
  } catch {
    return false;
  }
}

function parseHms(value) {
  const m = String(value || "").match(
    /(\d+):(\d+):(\d+(?:\.\d+)?)/
  );

  if (!m) return 0;

  return Number(m[1]) * 3600 +
    Number(m[2]) * 60 +
    Number(m[3]);
}

function ffmpegDownload(job, retryAudio = false) {
  return new Promise(resolve => {
    let duration = 0;

    const args = [
      "-hide_banner",
      "-y",
      "-loglevel", "info"
    ];

    if (job.headers) args.push("-headers", job.headers);

    args.push(
      "-i", job.playlistUrl,
      "-map", "0:v:0?",
      "-map", "0:a:0?"
    );

    if (retryAudio) {
      args.push(
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k"
      );
    } else {
      args.push("-c", "copy");
    }

    args.push("-movflags", "+faststart", job.outputPath);

    const child = spawn(ffmpegPath, args, {
      windowsHide: true
    });

    activeFfmpeg = child;

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => {
      const text = String(chunk);

      const dm = text.match(
        /Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/
      );
      if (dm) duration = parseHms(dm[1]);

      const times = [
        ...text.matchAll(
          /time=(\d+:\d+:\d+(?:\.\d+)?)/g
        )
      ];

      if (times.length) {
        const current =
          parseHms(times[times.length - 1][1]);

        send("download-progress", {
          id: job.id,
          title: job.title,
          current,
          duration,
          percent:
            duration > 0
              ? Math.max(
                  0,
                  Math.min(100, current / duration * 100)
                )
              : null
        });
      }
    });

    child.on("error", err => {
      activeFfmpeg = null;
      resolve({ ok: false, error: err.message });
    });

    child.on("close", code => {
      activeFfmpeg = null;
      resolve({
        ok: code === 0,
        error: code === 0
          ? ""
          : `FFmpeg thoát với mã ${code}`
      });
    });
  });
}

async function downloadOne(job) {
  upsertHistory({
    id: job.id,
    order: job.order,
    title: job.title,
    url: job.pageUrl,
    duration: job.duration,
    playlistUrl: job.playlistUrl,
    outputPath: job.outputPath,
    status: "downloading",
    updatedAt: new Date().toISOString()
  });

  send("download-started", job);

  let result = await ffmpegDownload(job, false);

  if (!result.ok) {
    try {
      if (fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
    } catch {}

    send("download-log", {
      message:
        "Ghép trực tiếp thất bại, thử lại với audio AAC..."
    });

    result = await ffmpegDownload(job, true);
  }

  if (!result.ok) {
    try {
      if (fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
    } catch {}

    upsertHistory({
      id: job.id,
      order: job.order,
      title: job.title,
      url: job.pageUrl,
      duration: job.duration,
      playlistUrl: job.playlistUrl,
      outputPath: "",
      status: "failed",
      error: result.error,
      updatedAt: new Date().toISOString()
    });

    send("download-failed", {
      title: job.title,
      error: result.error
    });

    return false;
  }

  upsertHistory({
    id: job.id,
    order: job.order,
    title: job.title,
    url: job.pageUrl,
    duration: job.duration,
    playlistUrl: job.playlistUrl,
    outputPath: job.outputPath,
    status: "done",
    downloadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  lastCompletedLesson = {
    id: job.id,
    title: job.title,
    pageUrl: job.pageUrl,
    src: job.src,
    outputPath: job.outputPath,
    order: job.order
  };

  send("download-finished", {
    title: job.title,
    outputPath: job.outputPath,
    order: job.order
  });

  return true;
}

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;

  try {
    while (queue.length) {
      const job = queue.shift();
      send("queue-updated", queue);

      try {
        await downloadOne(job);
      } finally {
        queuedIds.delete(job.id);
      }
    }
  } finally {
    queueRunning = false;
    send("queue-idle", {});
  }
}

async function prepareCurrent(force = false, sequenceOverride = null) {
  if (preparing) return null;
  if (!lessonWindow || lessonWindow.isDestroyed()) return null;

  preparing = true;

  try {
    const info = await waitForVideoReady();
    const ident = lessonId(info);

    if (!force && Date.now() > clickArmUntil && !fullAutoRunning) return null;

    if (sessionVisitedIds.has(ident.id) && fullAutoRunning) {
      send("download-log", {
        message: `Đã gặp lại bài "${info.title}", dừng để tránh vòng lặp.`
      });
      return { loopDetected: true, info, ident };
    }

    sessionVisitedIds.add(ident.id);

    if (!force && doneAndExists(ident.id)) {
      send("lesson-skipped", {
        title: info.title,
        reason: "Đã lưu trước đó."
      });

      lastCompletedLesson = {
        id: ident.id,
        title: info.title,
        pageUrl: info.url,
        src: info.src,
        outputPath: history.items.find(x => x.id === ident.id)?.outputPath || "",
        order: history.items.find(x => x.id === ident.id)?.order || extractLessonNumber(info.title) || sessionSequence
      };

      clickArmUntil = 0;

      return {
        skipped: true,
        info,
        ident,
        order: lastCompletedLesson.order
      };
    }

    if (queuedIds.has(ident.id)) return null;
    if (!force && ident.signature === lastQueuedSignature) return null;

    send("lesson-detected", {
      title: info.title,
      duration: info.duration,
      url: info.url,
      click: lastClick
    });

    const afterTs = Date.now();
    const trigger = await triggerStream();

    if (!trigger.ok) {
      send("download-log", {
        message:
          `Không tự kích hoạt player: ${trigger.reason || "không rõ"}`
      });
    }

    const playlist = await waitPlaylist(afterTs, 18000);

    if (!playlist) {
      send("download-failed", {
        title: info.title,
        error:
          "Không phát hiện HLS/M3U8. Có thể player không dùng HLS hoặc stream được bảo vệ."
      });
      return { failed: true, info, ident };
    }

    const auth = await authHeaders(
      playlist.url,
      info.url
    );

    if (await playlistLooksProtected(
      playlist.url,
      auth.object
    )) {
      upsertHistory({
        id: ident.id,
        title: info.title,
        url: info.url,
        duration: info.duration,
        playlistUrl: playlist.url,
        outputPath: "",
        status: "protected",
        updatedAt: new Date().toISOString()
      });

      send("download-failed", {
        title: info.title,
        error:
          "Playlist có dấu hiệu mã hóa/protected media. V4 không lấy khóa hoặc vượt cơ chế bảo vệ."
      });
      return { protected: true, info, ident };
    }

    const lessonNo = extractLessonNumber(info.title);
    const order =
      lessonNo ??
      (Number.isFinite(sequenceOverride) && sequenceOverride > 0
        ? sequenceOverride
        : sessionSequence);

    const baseName = orderedBaseName(info.title, order);

    const job = {
      id: ident.id,
      order,
      title: info.title || `lesson_${ident.id}`,
      pageUrl: info.url,
      src: info.src,
      duration: info.duration,
      playlistUrl: playlist.url,
      headers: auth.ffmpeg,
      outputPath: uniqueOutput(baseName)
    };

    queuedIds.add(ident.id);
    queue.push(job);
    lastQueuedSignature = ident.signature;
    clickArmUntil = 0;

    upsertHistory({
      id: job.id,
      order: job.order,
      title: job.title,
      url: job.pageUrl,
      duration: job.duration,
      playlistUrl: job.playlistUrl,
      outputPath: job.outputPath,
      status: "queued",
      queuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    send("queue-updated", queue);
    runQueue();

    return { queued: true, job, info, ident };
  } catch (err) {
    send("download-log", {
      message:
        `Auto-detect lỗi: ${String(err?.message || err)}`
    });
    return { failed: true, error: String(err?.message || err) };
  } finally {
    preparing = false;
  }
}

async function waitUntilJobDone(id, timeout = 12 * 60 * 60 * 1000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (stopFullAutoRequested) return false;

    const item = history.items.find(x => x.id === id);

    if (item?.status === "done") return true;
    if (item?.status === "failed" || item?.status === "protected") return false;

    await new Promise(r => setTimeout(r, 700));
  }

  return false;
}

async function clickNextLesson() {
  const selector = nextSelector;
  const text = nextText || "Bài sau";

  return execLesson(`
  (() => {
    const selector = ${JSON.stringify(selector)};
    const wanted = ${JSON.stringify(text)}.trim().toLowerCase();

    const usable = el => {
      if (!el) return false;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      return true;
    };

    let target = null;

    if (selector) {
      const c = document.querySelector(selector);
      if (usable(c)) target = c;
    }

    if (!target) {
      const els = Array.from(
        document.querySelectorAll(
          "button, a, [role='button'], input[type='button'], input[type='submit']"
        )
      );

      target = els.find(el => {
        if (!usable(el)) return false;

        const label = (
          el.innerText ||
          el.textContent ||
          el.value ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          ""
        ).trim().replace(/\\s+/g, " ").toLowerCase();

        return label.includes(wanted);
      });
    }

    if (!target) {
      return {
        ok: false,
        reason: "Không tìm thấy nút bài tiếp theo."
      };
    }

    const label = (
      target.innerText ||
      target.textContent ||
      target.value ||
      target.getAttribute("aria-label") ||
      target.getAttribute("title") ||
      ""
    ).trim();

    target.scrollIntoView({
      block: "center",
      behavior: "instant"
    });

    target.click();

    return {
      ok: true,
      label
    };
  })()
  `);
}

async function waitForLessonChange(previous, timeout = 90000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (stopFullAutoRequested) {
      throw new Error("Đã dừng Full Auto.");
    }

    try {
      const info = await getLessonInfo();
      const changed =
        (info.title && info.title !== previous.title) ||
        (info.url && info.url !== previous.url) ||
        (info.src && info.src !== previous.src);

      if (changed && info.hasVideo && info.readyState >= 1) {
        return info;
      }
    } catch {}

    await new Promise(r => setTimeout(r, 650));
  }

  throw new Error("Đã bấm Bài sau nhưng chưa nhận được bài mới.");
}

async function fullAutoLoop() {
  if (fullAutoRunning) return;

  fullAutoRunning = true;
  stopFullAutoRequested = false;
  sessionVisitedIds = new Set();

  send("full-auto-state", {
    running: true,
    message: "Full Auto đang chạy..."
  });

  try {
    while (!stopFullAutoRequested) {
      const current = await waitForVideoReady();
      const ident = lessonId(current);

      let result;

      if (doneAndExists(ident.id)) {
        send("lesson-skipped", {
          title: current.title,
          reason: "Đã lưu trước đó."
        });

        sessionVisitedIds.add(ident.id);
        result = {
          skipped: true,
          info: current,
          ident,
          order:
            history.items.find(x => x.id === ident.id)?.order ??
            extractLessonNumber(current.title) ??
            sessionSequence
        };
      } else {
        result = await prepareCurrent(true, sessionSequence);
      }

      if (!result) {
        throw new Error("Không chuẩn bị được bài hiện tại.");
      }

      if (result.loopDetected) {
        send("download-log", {
          message: "Phát hiện vòng lặp bài học. Full Auto dừng."
        });
        break;
      }

      if (result.failed || result.protected) {
        send("download-log", {
          message: "Bài hiện tại không tải được. Full Auto dừng để tránh bỏ sót."
        });
        break;
      }

      if (result.queued && result.job) {
        const ok = await waitUntilJobDone(result.job.id);

        if (!ok) {
          send("download-log", {
            message: `Bài "${result.job.title}" không hoàn tất. Full Auto dừng.`
          });
          break;
        }
      }

      if (stopFullAutoRequested) break;
      if (!autoNextEnabled) break;

      const previous = result.info || current;

      send("full-auto-state", {
        running: true,
        message: "Tải xong. Đang chuyển sang bài tiếp theo..."
      });

      const click = await clickNextLesson();

      if (!click.ok) {
        send("full-auto-state", {
          running: false,
          message: "Không còn nút Bài sau. Đã hoàn tất chuỗi bài."
        });
        break;
      }

      send("download-log", {
        message: `Đã bấm "${click.label || nextText}".`
      });

      await waitForLessonChange(previous);
      sessionSequence += 1;

      // Allow the new lesson/player to finish its initial page work.
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err) {
    send("download-log", {
      message: `Full Auto lỗi: ${String(err?.message || err)}`
    });
  } finally {
    fullAutoRunning = false;
    stopFullAutoRequested = false;

    send("full-auto-state", {
      running: false,
      message: "Full Auto đã dừng."
    });
  }
}

async function monitor() {
  if (!lessonWindow || lessonWindow.isDestroyed()) return;

  try {
    const info = await getLessonInfo();

    if (!info.hasVideo) return;

    send("current-lesson", info);

    if (
      autoSaveEnabled &&
      !fullAutoRunning &&
      Date.now() <= clickArmUntil
    ) {
      await prepareCurrent(false);
    }
  } catch {}
}

app.whenReady().then(() => {
  outputDir =
    path.join(
      app.getPath("downloads"),
      "AutoLessonAutoSave"
    );

  historyFile =
    path.join(outputDir, "history.json");

  fs.mkdirSync(outputDir, { recursive: true });
  loadHistory();

  createControlWindow();
  installNetworkMonitor();

  setInterval(monitor, 800);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on(
  "lesson-user-click",
  (_event, data) => {
    lastUserClickAt = Date.now();
    clickArmUntil = Date.now() + 20000;

    lastClick = {
      text: String(data?.text || ""),
      href: String(data?.href || ""),
      tag: String(data?.tag || ""),
      at: lastUserClickAt
    };

    send("user-click-detected", lastClick);
  }
);

ipcMain.handle(
  "open-url",
  async (_event, rawUrl) => {
    let url = String(rawUrl || "").trim();

    if (!url) {
      throw new Error("Bạn chưa nhập URL.");
    }

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const win = createLessonWindow();

    playlists = [];
    clickArmUntil = 0;
    lastQueuedSignature = "";
    sessionSequence = 1;
    sessionVisitedIds = new Set();

    await win.loadURL(url);
    win.show();
    win.focus();

    return true;
  }
);

ipcMain.handle("focus-lesson", () => {
  if (
    lessonWindow &&
    !lessonWindow.isDestroyed()
  ) {
    lessonWindow.show();
    lessonWindow.focus();
    return true;
  }
  return false;
});

ipcMain.handle(
  "set-auto-save",
  (_e, v) => {
    autoSaveEnabled = !!v;
    return autoSaveEnabled;
  }
);

ipcMain.handle(
  "set-pause-after-detect",
  (_e, v) => {
    pauseAfterDetect = !!v;
    return pauseAfterDetect;
  }
);

ipcMain.handle(
  "set-auto-next",
  (_e, payload) => {
    autoNextEnabled = !!payload?.enabled;
    nextText = String(payload?.nextText || "Bài sau").trim() || "Bài sau";
    nextSelector = String(payload?.nextSelector || "").trim();

    return {
      enabled: autoNextEnabled,
      nextText,
      nextSelector
    };
  }
);

ipcMain.handle(
  "start-full-auto",
  async (_e, payload) => {
    autoNextEnabled = payload?.autoNext !== false;
    nextText = String(payload?.nextText || "Bài sau").trim() || "Bài sau";
    nextSelector = String(payload?.nextSelector || "").trim();

    const startNumber = Number(payload?.startNumber);
    sessionSequence =
      Number.isFinite(startNumber) && startNumber > 0
        ? Math.floor(startNumber)
        : 1;

    fullAutoLoop();
    return true;
  }
);

ipcMain.handle(
  "stop-full-auto",
  () => {
    stopFullAutoRequested = true;

    if (activeFfmpeg) {
      try { activeFfmpeg.kill("SIGTERM"); } catch {}
    }

    return true;
  }
);

ipcMain.handle(
  "save-current-now",
  async () => {
    lastUserClickAt = Date.now();
    clickArmUntil = Date.now() + 20000;
    await prepareCurrent(false, sessionSequence);
    return true;
  }
);

ipcMain.handle(
  "redownload-current",
  async () => {
    const info = await getLessonInfo();
    const ident = lessonId(info);

    history.items =
      history.items.filter(
        x => x.id !== ident.id
      );
    saveHistory();

    queuedIds.delete(ident.id);
    lastQueuedSignature = "";
    sessionVisitedIds.delete(ident.id);

    lastUserClickAt = Date.now();
    clickArmUntil = Date.now() + 20000;

    await prepareCurrent(true, sessionSequence);
    return true;
  }
);

ipcMain.handle(
  "cancel-download",
  () => {
    if (!activeFfmpeg) return false;

    try {
      activeFfmpeg.kill("SIGTERM");
      return true;
    } catch {
      return false;
    }
  }
);

ipcMain.handle(
  "open-output-folder",
  async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    const err = await shell.openPath(outputDir);
    return { ok: !err, error: err || "" };
  }
);

ipcMain.handle(
  "show-file",
  (_e, p) => {
    const file = String(p || "");
    if (!file || !fs.existsSync(file)) {
      return false;
    }
    shell.showItemInFolder(file);
    return true;
  }
);

ipcMain.handle(
  "get-output-folder",
  () => outputDir
);

ipcMain.handle(
  "get-history",
  () => history.items
);

ipcMain.handle(
  "clear-failed-history",
  () => {
    history.items =
      history.items.filter(
        x =>
          x.status !== "failed" &&
          x.status !== "protected"
      );

    saveHistory();
    send("history-updated", history.items);
    return history.items;
  }
);
