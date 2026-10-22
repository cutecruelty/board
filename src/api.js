// Клиент REST API и WebSocket для бэкенда из C/api.
// В dev-режиме запросы идут через прокси Vite (/api и /ws -> localhost:3000),
// поэтому никаких абсолютных адресов и CORS-плясок на фронте нет.

const API_BASE = "/api";
const TOKEN_KEY = "boardly.token";
const CLIENT_ID_KEY = "boardly.clientId";

// --- Токен и ClientId ---------------------------------------------------

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}

// Бэкенд требует заголовок ClientId на каждом запросе (см. checkClientId).
// До логина используем стабильный случайный id, после — логин/имя пользователя.
export function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = `guest-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

export function setClientId(clientId) {
  if (clientId) {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
}

// --- Базовый HTTP-запрос ------------------------------------------------

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { ClientId: getClientId() };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const fieldError =
      data && data.errors ? Object.values(data.errors)[0] : undefined;
    const message =
      (data && (data.error || fieldError)) || `Ошибка запроса: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// --- Auth ---------------------------------------------------------------

export async function register({ email, name, password }) {
  return request("/auth/register", {
    method: "POST",
    auth: false,
    body: { email, name, password },
  });
}

export async function login({ email, password }) {
  const data = await request("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });

  setToken(data.token);
  setClientId(data.user?.name || data.user?.email || "");

  return data.user;
}

// JWT стателесс, отдельного роута /auth/logout на бэкенде нет —
// достаточно забыть токен на клиенте.
export function logout() {
  setToken(null);
}

// --- Boards -------------------------------------------------------------

export function createBoard(title) {
  return request("/boards", { method: "POST", body: { title } });
}

export function getMyBoards() {
  return request("/boards/my");
}

export function getBoard(id) {
  return request(`/boards/${id}`);
}

export function addBoardAccess(id, email) {
  return request(`/boards/${id}/access`, { method: "POST", body: { email } });
}

export function publishBoard(id) {
  return request(`/boards/${id}/public`, { method: "POST" });
}

export function getPublicBoards(sort = "likes") {
  return request(`/boards/public/list?sort=${encodeURIComponent(sort)}`);
}

export function getPublicBoard(hash) {
  return request(`/boards/public/${encodeURIComponent(hash)}`);
}

export function toggleLike(id) {
  return request(`/boards/${id}/like`, { method: "POST" });
}

// --- Objects ------------------------------------------------------------

export function getBoardObjects(boardId) {
  return request(`/objects/board/${boardId}`);
}

export function createObject({ boardId, type, data }) {
  return request("/objects", {
    method: "POST",
    body: { board_id: boardId, type, data },
  });
}

export function updateObject(id, data) {
  return request(`/objects/${id}`, { method: "PUT", body: { data } });
}

export function deleteObject(id) {
  return request(`/objects/${id}`, { method: "DELETE" });
}

// --- WebSocket ----------------------------------------------------------

// Возвращает обёртку над WebSocket: сама шлёт join_board при подключении,
// умеет отправлять события и подписываться на них по имени.
//   const board = createBoardSocket({ boardId: 1 });
//   const off = board.on("object_created", (obj) => ...);
//   board.send("create_object", { type: "text", data: { x: 0, y: 0, text: "hi" } });
export function createBoardSocket({ boardId, boardHash } = {}) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ clientId: getClientId() });

  const token = getToken();
  if (token) {
    params.set("token", token);
  }

  const socket = new WebSocket(
    `${protocol}://${window.location.host}/ws?${params.toString()}`,
  );

  const send = (event, data) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
    }
  };

  const on = (event, handler) => {
    const listener = (messageEvent) => {
      try {
        const message = JSON.parse(messageEvent.data);
        if (message.event === event) {
          handler(message.data);
        }
      } catch {
        // игнорируем не-JSON сообщения
      }
    };

    socket.addEventListener("message", listener);
    return () => socket.removeEventListener("message", listener);
  };

  socket.addEventListener("open", () => {
    send("join_board", { boardId, boardHash });
  });

  return { socket, send, on };
}
