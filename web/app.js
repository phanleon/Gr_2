let lastEventId = 0;
let currentState = { mode: "disconnected", peers: [] };
let renderedEventIds = new Set();

const $ = (id) => document.getElementById(id);

function toast(message, bad = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.borderColor = bad ? "rgba(255,107,125,.45)" : "rgba(85,214,190,.28)";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3200);
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function postJSON(url, body) {
  return api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function switchTab(name) {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === name));
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.id === `tab-${name}`));

  const titles = {
    network: ["Kết nối mạng", "Tạo mạng hoặc tham gia một Host qua Internet."],
    chat: ["Chat", "Trao đổi tin nhắn giữa các thiết bị."],
    files: ["Truyền file", "Gửi dữ liệu qua kết nối InternetLAN."],
    logs: ["Nhật ký", "Theo dõi hoạt động mạng và lỗi."]
  };
  $("pageTitle").textContent = titles[name][0];
  $("pageSubtitle").textContent = titles[name][1];
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

$("startHostBtn").addEventListener("click", async () => {
  try {
    await postJSON("/api/host/start", {
      name: $("hostName").value,
      port: Number($("hostPort").value || 50000),
      password: $("hostPassword").value
    });
    toast("Đã tạo mạng thành công.");
    await refreshState();
  } catch (e) { toast(e.message, true); }
});

$("joinBtn").addEventListener("click", async () => {
  try {
    const data = await postJSON("/api/client/join", {
      name: $("clientName").value,
      server: $("serverAddress").value,
      port: Number($("clientPort").value || 50000),
      password: $("clientPassword").value
    });
    toast(`Kết nối thành công. Virtual IP: ${data.virtualIp}`);
    await refreshState();
  } catch (e) { toast(e.message, true); }
});

$("disconnectBtn").addEventListener("click", async () => {
  try {
    await postJSON("/api/disconnect", {});
    toast("Đã ngắt kết nối.");
    await refreshState();
  } catch (e) { toast(e.message, true); }
});

$("sendChatBtn").addEventListener("click", sendChat);
$("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendChat();
});

async function sendChat() {
  const text = $("chatInput").value.trim();
  if (!text) return;
  try {
    await postJSON("/api/chat", {
      text,
      target: $("chatTarget").value
    });
    $("chatInput").value = "";
  } catch (e) { toast(e.message, true); }
}

$("sendFileBtn").addEventListener("click", async () => {
  const file = $("fileInput").files[0];
  if (!file) {
    toast("Hãy chọn file trước.", true);
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    toast("File vượt giới hạn 100 MB.", true);
    return;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("target", $("fileTarget").value);

  $("fileProgress").classList.remove("hidden");
  $("progressBar").style.width = "35%";
  $("progressText").textContent = "Đang gửi qua engine Go...";

  try {
    await api("/api/file", { method: "POST", body: form });
    $("progressBar").style.width = "100%";
    $("progressText").textContent = "Hoàn tất.";
    toast("Đã gửi file.");
    $("fileInput").value = "";
  } catch (e) {
    $("progressText").textContent = "Gửi thất bại.";
    toast(e.message, true);
  } finally {
    setTimeout(() => {
      $("fileProgress").classList.add("hidden");
      $("progressBar").style.width = "0%";
    }, 1200);
  }
});

$("clearLogBtn").addEventListener("click", () => {
  $("logList").innerHTML = "";
});

function renderState() {
  const connected = currentState.mode !== "disconnected";
  $("statusDot").className = `dot ${connected ? "online" : "offline"}`;
  $("statusText").textContent = connected
    ? (currentState.mode === "host" ? "Đang làm Host" : "Đã kết nối")
    : "Chưa kết nối";
  $("virtualIpText").textContent = `Virtual IP: ${currentState.virtualIp || "—"}`;
  $("disconnectBtn").classList.toggle("hidden", !connected);

  const peers = currentState.peers || [];
  $("peerCount").textContent = `${peers.length} thiết bị`;

  const list = $("peerList");
  if (!peers.length) {
    list.className = "peer-list empty-state";
    list.textContent = "Chưa có thiết bị.";
  } else {
    list.className = "peer-list";
    list.innerHTML = peers.map(p => `
      <div class="peer">
        <div>
          <strong><span class="online-dot"></span>${escapeHtml(p.name)}</strong>
          <small>${escapeHtml(p.remoteIp || "")}</small>
        </div>
        <code>${escapeHtml(p.virtualIp)}</code>
      </div>
    `).join("");
  }

  updateTargets(peers);
}

function updateTargets(peers) {
  const oldChat = $("chatTarget").value;
  const oldFile = $("fileTarget").value;
  const me = currentState.name;

  const options = [`<option value="*">Tất cả</option>`]
    .concat((peers || [])
      .filter(p => p.name !== me)
      .map(p => `<option value="${escapeAttr(p.name)}">${escapeHtml(p.name)} (${escapeHtml(p.virtualIp)})</option>`))
    .join("");

  $("chatTarget").innerHTML = options;
  $("fileTarget").innerHTML = options;

  if ([...$("chatTarget").options].some(o => o.value === oldChat)) $("chatTarget").value = oldChat;
  if ([...$("fileTarget").options].some(o => o.value === oldFile)) $("fileTarget").value = oldFile;
}

function addChatEvent(ev) {
  if (renderedEventIds.has(ev.id)) return;
  renderedEventIds.add(ev.id);

  const win = $("chatMessages");
  const div = document.createElement("div");

  if (ev.type === "system") {
    div.className = "msg system";
    div.textContent = ev.message;
  } else {
    div.className = "msg";
    const targetText = ev.target && ev.target !== "*" ? ` → ${ev.target}` : "";
    div.innerHTML = `
      <div class="meta">${escapeHtml(ev.from || "SYSTEM")}${escapeHtml(targetText)} · ${formatTime(ev.timestamp)}</div>
      <div>${escapeHtml(ev.message || "")}</div>
    `;
  }

  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function addLog(ev) {
  const div = document.createElement("div");
  div.className = "log";
  div.innerHTML = `<span class="time">${formatTime(ev.timestamp)}</span>${escapeHtml(ev.type.toUpperCase())} — ${escapeHtml(ev.message || "")}`;
  $("logList").prepend(div);
}

function addReceivedFile(ev) {
  const box = $("receivedFiles");
  if (box.classList.contains("empty-state")) {
    box.classList.remove("empty-state");
    box.innerHTML = "";
  }
  const div = document.createElement("div");
  div.className = "file-item";
  div.innerHTML = `<strong>${escapeHtml(ev.fileName || "File")}</strong>
                   <small>Từ: ${escapeHtml(ev.from || "—")} · ${formatTime(ev.timestamp)}</small>
                   <small>Đường dẫn: ${escapeHtml(ev.filePath || "downloads")}</small>`;
  box.prepend(div);
}

async function refreshEvents() {
  try {
    const events = await api(`/api/events?after=${lastEventId}`);
    for (const ev of events) {
      lastEventId = Math.max(lastEventId, ev.id || 0);
      addLog(ev);
      if (ev.type === "chat" || ev.type === "system") addChatEvent(ev);
      if (ev.type === "file_received") addReceivedFile(ev);
    }
  } catch {}
}

async function refreshState() {
  try {
    currentState = await api("/api/state");
    renderState();
  } catch {}
}

async function refreshLocalIPs() {
  try {
    const ips = await api("/api/local-ips");
    $("localIps").innerHTML = ips.length
      ? ips.map(ip => `<div class="ip-chip">${escapeHtml(ip)}</div>`).join("")
      : `<div class="empty-state">Không tìm thấy IPv4 LAN.</div>`;
  } catch {}
}

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString("vi-VN", { hour12: false });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#096;");
}

refreshLocalIPs();
refreshState();
refreshEvents();
setInterval(refreshState, 1200);
setInterval(refreshEvents, 700);
