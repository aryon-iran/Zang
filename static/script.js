/* ==================== تنظیمات ==================== */

const ADMIN_NAME = "Arian";

const ROOMS = [
  { id: "info",  name: "اطلاع‌رسانی زنگ تفریح", icon: "🛎️", group: "مشترک",  type: "admin" },
  { id: "news",  name: "اخبار مدرسه",         icon: "📰", group: "مشترک",  type: "admin" },
  { id: "grade", name: "پایه نهم",            icon: "💬", group: "مشترک",  type: "public" },
  { id: "901",   name: "کلاس ۹۰۱",            icon: "🏫", group: "کلاس‌ها", type: "class", classId: "901" },
  { id: "902",   name: "کلاس ۹۰۲",            icon: "🏫", group: "کلاس‌ها", type: "class", classId: "902" },
  { id: "903",   name: "کلاس ۹۰۳",            icon: "🏫", group: "کلاس‌ها", type: "class", classId: "903" },
];

/* ==================== وضعیت ==================== */

let currentUser = null;
let currentRoom = null;
let selectedClass = null;
let socket = null;
let allMessages = {};

/* ==================== عناصر ==================== */

const loginScreen  = document.getElementById("login-screen");
const chatScreen   = document.getElementById("chat-screen");
const loginName    = document.getElementById("login-name");
const enterBtn     = document.getElementById("enter-btn");
const roomsNav     = document.getElementById("rooms-nav");
const roomTitle    = document.getElementById("room-title");
const messagesEl   = document.getElementById("messages");
const messageForm  = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const userInfo     = document.getElementById("user-info");
const sidebar      = document.getElementById("sidebar");
const menuBtn      = document.getElementById("menu-btn");
const readonly     = document.getElementById("readonly-notice");

/* ==================== ورود ==================== */

document.querySelectorAll(".class-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".class-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedClass = btn.dataset.class;
    checkLoginReady();
  };
});

loginName.addEventListener("input", checkLoginReady);

function checkLoginReady() {
  const nameOk = loginName.value.trim().length >= 2;
  enterBtn.disabled = !(nameOk && selectedClass);
}

enterBtn.onclick = () => {
  const name = loginName.value.trim();
  if (!name || !selectedClass) return;

  currentUser = {
    name,
    classId: selectedClass,
    isAdmin: name.toLowerCase() === ADMIN_NAME.toLowerCase(),
  };

  localStorage.setItem("zt-user", JSON.stringify(currentUser));
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");

  renderSidebar();
  userInfo.textContent = `${currentUser.name} • ${currentUser.classId}`;
  openRoom(ROOMS[0].id);
};

/* ==================== سایدبار ==================== */

function renderSidebar() {
  roomsNav.innerHTML = "";
  const groups = {};

  ROOMS.forEach((r) => {
    if (!canSeeRoom(r)) return;
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });

  Object.keys(groups).forEach((groupName) => {
    const label = document.createElement("div");
    label.className = "room-group-label";
    label.textContent = groupName;
    roomsNav.appendChild(label);

    groups[groupName].forEach((room) => {
      const btn = document.createElement("button");
      btn.className = "room-btn";
      btn.dataset.room = room.id;

      const icon = document.createElement("span");
      icon.textContent = room.icon;

      const name = document.createElement("span");
      name.textContent = room.name;

      btn.append(icon, name);

      if (room.type === "admin" && !currentUser.isAdmin) {
        const lock = document.createElement("span");
        lock.className = "lock";
        lock.textContent = "🔒";
        btn.appendChild(lock);
      }

      btn.onclick = () => openRoom(room.id);
      roomsNav.appendChild(btn);
    });
  });
}

function canSeeRoom(room) {
  if (room.type === "class") return room.classId === currentUser.classId;
  return true;
}

/* ==================== روم ==================== */

function openRoom(roomId) {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room || !canSeeRoom(room)) return;

  if (socket) {
    socket.close();
    socket = null;
  }

  currentRoom = room;
  roomTitle.textContent = `${room.icon} ${room.name}`;

  document.querySelectorAll(".room-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.room === roomId);
  });

  sidebar.classList.remove("open");

  if (room.type === "admin" && !currentUser.isAdmin) {
    messageInput.disabled = true;
    messageInput.placeholder = "فقط ادمین می‌تونه پیام بذاره";
    readonly.classList.remove("hidden");
  } else {
    messageInput.disabled = false;
    messageInput.placeholder = "پیامت رو بنویس...";
    readonly.classList.add("hidden");
  }

  messagesEl.innerHTML = '<div class="empty-state">در حال اتصال...</div>';
  connectWebSocket(roomId);
  messageInput.focus();
}

function connectWebSocket(roomId) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/ws/${roomId}?user=${encodeURIComponent(currentUser.name)}&class_id=${encodeURIComponent(currentUser.classId)}`;

  socket = new WebSocket(url);

  socket.onopen = () => console.log("✅ وصل شد به", roomId);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "history") {
      allMessages[roomId] = data.messages;
      renderMessages();
    } else if (data.type === "message") {
      if (!allMessages[roomId]) allMessages[roomId] = [];
      allMessages[roomId].push(data.message);
      renderMessages();
    } else if (data.type === "error") {
      alert(data.message);
    }
  };

  socket.onerror = () => {
    messagesEl.innerHTML = '<div class="empty-state">⚠️ خطا در اتصال به سرور</div>';
  };

  socket.onclose = (e) => {
    if (e.code === 4003) {
      messagesEl.innerHTML = '<div class="empty-state">🔒 دسترسی به این روم نداری</div>';
    }
  };
}

/* ==================== پیام‌ها ==================== */

function renderMessages() {
  messagesEl.innerHTML = "";
  const list = allMessages[currentRoom.id] || [];

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "هنوز پیامی نیست. اولین نفر باش! ✨";
    messagesEl.appendChild(empty);
    return;
  }

  list.forEach((msg) => {
    const isOwn = msg.author === currentUser.name && msg.author_class === currentUser.classId;

    const wrap = document.createElement("div");
    wrap.className = "msg" + (isOwn ? " own" : "");

    const author = document.createElement("div");
    author.className = "msg-author";
    author.textContent = isOwn ? "تو" : `${msg.author} • ${msg.author_class}`;

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = msg.text;

    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = formatTime(msg.created_at);

    wrap.append(author, bubble, time);
    messagesEl.appendChild(wrap);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(iso) {
  try {
    const d = new Date(iso + "Z");
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("اتصال به سرور برقرار نیست");
    return;
  }

  if (currentRoom.type === "admin" && !currentUser.isAdmin) return;

  socket.send(JSON.stringify({ text }));
  messageInput.value = "";
});

/* ==================== خروج ==================== */

document.getElementById("logout-btn").onclick = () => {
  if (!confirm("از حساب خارج می‌شی؟")) return;
  localStorage.removeItem("zt-user");
  location.reload();
};

menuBtn.onclick = () => sidebar.classList.toggle("open");

/* ==================== شروع ==================== */

const saved = localStorage.getItem("zt-user");
if (saved) {
  currentUser = JSON.parse(saved);
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  renderSidebar();
  userInfo.textContent = `${currentUser.name} • ${currentUser.classId}`;
  openRoom(ROOMS[0].id);
}