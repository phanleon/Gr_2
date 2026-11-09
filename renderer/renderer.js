const $ = id => document.getElementById(id);

function log(msg) {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  $("log").textContent += `[${new Date().toLocaleTimeString()}] ${text}\n`;
  $("log").scrollTop = $("log").scrollHeight;
}

function fmt(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  return h
    ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderHistory(items) {
  const body = $("history");
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="4">Chưa có bài nào.</td></tr>`;
    return;
  }

  const sorted = [...list].sort((a, b) => {
    const ao = Number(a.order || 999999);
    const bo = Number(b.order || 999999);
    if (ao !== bo) return ao - bo;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  body.innerHTML = sorted.slice(0, 300).map(item => {
    const st = esc(item.status || "-");
    const file =
      item.status === "done" && item.outputPath
        ? `<button class="fileBtn secondary" data-file="${esc(item.outputPath)}">Hiện file</button>`
        : "-";

    return `
      <tr>
        <td>${item.order ? String(item.order).padStart(3, "0") : "-"}</td>
        <td><strong>${esc(item.title || "Bài học")}</strong><br>${item.duration ? fmt(item.duration) : ""}</td>
        <td><span class="status ${st}">${st}</span></td>
        <td>${file}</td>
      </tr>
    `;
  }).join("");

  body.querySelectorAll("[data-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      window.ALR.showFile(btn.dataset.file);
    });
  });
}

async function syncAutoNextSettings() {
  await window.ALR.setAutoNext({
    enabled: $("autoNext").checked,
    nextText: $("nextText").value.trim() || "Bài sau",
    nextSelector: $("nextSelector").value.trim()
  });
}

$("open").addEventListener("click", async () => {
  try {
    await window.ALR.openUrl($("url").value.trim());
    log("Đã mở website. Đăng nhập và mở bài muốn bắt đầu.");
  } catch (e) {
    log(`Lỗi mở website: ${e.message || e}`);
  }
});

$("focus").addEventListener("click", async () => {
  if (!await window.ALR.focusLesson()) log("Chưa mở cửa sổ bài học.");
});

$("autoSave").addEventListener("change", async () => {
  const on = await window.ALR.setAutoSave($("autoSave").checked);

  $("badge").textContent = on ? "AUTO-SAVE ON" : "AUTO-SAVE OFF";
  $("badge").className = `badge ${on ? "on" : "off"}`;
});

$("pauseAfter").addEventListener("change", async () => {
  await window.ALR.setPauseAfterDetect($("pauseAfter").checked);
});

$("autoNext").addEventListener("change", syncAutoNextSettings);
$("nextText").addEventListener("change", syncAutoNextSettings);
$("nextSelector").addEventListener("change", syncAutoNextSettings);

$("fullAuto").addEventListener("click", async () => {
  try {
    $("fullAuto").disabled = true;
    $("stopFullAuto").disabled = false;

    await window.ALR.startFullAuto({
      autoNext: $("autoNext").checked,
      nextText: $("nextText").value.trim() || "Bài sau",
      nextSelector: $("nextSelector").value.trim(),
      startNumber: Number($("startNumber").value || 1)
    });

    log("FULL AUTO bắt đầu từ bài hiện tại.");
  } catch (e) {
    $("fullAuto").disabled = false;
    $("stopFullAuto").disabled = true;
    log(`Không thể bật Full Auto: ${e.message || e}`);
  }
});

$("stopFullAuto").addEventListener("click", async () => {
  await window.ALR.stopFullAuto();
  $("activity").textContent = "Đang dừng Full Auto...";
  log("Đã yêu cầu dừng Full Auto.");
});

$("saveCurrent").addEventListener("click", async () => {
  try {
    $("activity").textContent = "Đang nhận diện bài hiện tại...";
    await window.ALR.saveCurrentNow();
  } catch (e) {
    log(`Lỗi: ${e.message || e}`);
  }
});

$("redownload").addEventListener("click", async () => {
  try {
    $("activity").textContent = "Đang chuẩn bị tải lại...";
    await window.ALR.redownloadCurrent();
  } catch (e) {
    log(`Lỗi: ${e.message || e}`);
  }
});

$("folder").addEventListener("click", () => window.ALR.openOutputFolder());

$("clearFailed").addEventListener("click", async () => {
  renderHistory(await window.ALR.clearFailedHistory());
});

window.ALR.onUserClick(data => {
  $("activity").textContent =
    `Đã nhận click: ${data.text || data.tag || "bài học"}`;
});

window.ALR.onLesson(data => {
  $("lesson").textContent = data.title || "Bài học";
  $("duration").textContent = data.duration ? fmt(data.duration) : "--:--";
});

window.ALR.onDetected(data => {
  $("activity").textContent = `Đang đọc stream: ${data.title || "Bài học"}`;
  log(`Nhận diện: ${data.title || "Bài học"}`);
});

window.ALR.onPlaylist(data => {
  $("playlist").textContent = data.url || "Chưa phát hiện";
});

window.ALR.onSkipped(data => {
  $("activity").textContent = `${data.title || "Bài"} đã lưu — bỏ qua.`;
  log(`SKIP: ${data.title || "Bài"} (${data.reason || "đã lưu"})`);
});

window.ALR.onQueue(items => {
  $("queue").textContent = String(Array.isArray(items) ? items.length : 0);
});

window.ALR.onStarted(data => {
  $("downloadTitle").textContent =
    `${data.order ? String(data.order).padStart(3, "0") + " - " : ""}${data.title || "Đang tải"}`;

  $("activity").textContent = "Đang tải trực tiếp video + audio...";
  $("percent").textContent = "0%";
  $("bar").style.width = "0%";

  log(`Bắt đầu tải: ${data.outputPath || data.title || ""}`);
});

window.ALR.onProgress(data => {
  if (typeof data.percent === "number") {
    const p = Math.max(0, Math.min(100, data.percent));
    $("percent").textContent = `${p.toFixed(1)}%`;
    $("bar").style.width = `${p}%`;
  } else if (data.current) {
    $("percent").textContent = fmt(data.current);
  }
});

window.ALR.onFinished(data => {
  $("activity").textContent = "Đã tải xong bài hiện tại.";
  $("percent").textContent = "100%";
  $("bar").style.width = "100%";
  log(`HOÀN TẤT: ${data.outputPath || ""}`);
});

window.ALR.onFailed(data => {
  $("activity").textContent = `Không lưu được: ${data.title || "bài hiện tại"}`;
  log(`LỖI: ${data.error || "không rõ"}`);
});

window.ALR.onLog(data => log(data.message || data));
window.ALR.onHistory(renderHistory);

window.ALR.onFullAutoState(data => {
  $("fullAutoState").textContent = data.message || (data.running ? "Đang chạy" : "Đã dừng");
  $("activity").textContent = data.message || "";

  if (!data.running) {
    $("fullAuto").disabled = false;
    $("stopFullAuto").disabled = true;
  }
});

(async () => {
  const folder = await window.ALR.getOutputFolder();
  log(`Thư mục lưu: ${folder}`);
  renderHistory(await window.ALR.getHistory());
  await syncAutoNextSettings();

  log("V4 sẵn sàng. Mở bài bắt đầu → FULL AUTO TỪ BÀI HIỆN TẠI.");
})();
