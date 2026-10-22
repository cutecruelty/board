# Interactive Boards API

Базовый URL: `http://localhost:3000`

## Аутентификация

Все REST-запросы **обязательно** должны содержать заголовок:

```
ClientId: <ваш логин>
```

Для приватных ресурсов дополнительно нужен JWT:

```
Authorization: Bearer <token>
```

JWT выдаётся в `POST /api/auth/login`, живёт 7 дней. Секрет: `process.env.JWT_SECRET` (по умолчанию `your-secret-key-change-in-production`).

Формат ошибок:
- ошибки валидации: `{ "errors": { "поле": "сообщение" } }`
- прочие: `{ "error": "сообщение" }`
- код `400` — нет заголовка `ClientId` (`ClientId header is required`)

---

## Auth

### POST `/api/auth/register`

Регистрация.

**Headers:** `ClientId: <string>`

**Body**
```json
{ "email": "user@example.com", "name": "John", "password": "password123!" }
```

Правила валидации:
- `email` — валидный email
- `name` — только латиница `^[a-zA-Z]+$`, минимум 1 символ
- `password` — минимум 8 символов, минимум 1 цифра, минимум 1 спецсимвол

**Responses**
- `201`
  ```json
  { "message": "User registered successfully", "userId": 1 }
  ```
- `400` — ошибка валидации или email занят
  ```json
  { "errors": { "email": "User with this email already exists" } }
  ```
- `500` — `{ "error": "Registration failed" }`

### POST `/api/auth/login`

Авторизация.

**Headers:** `ClientId: <string>`

**Body**
```json
{ "email": "user@example.com", "password": "password123!" }
```

**Responses**
- `200`
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": 1, "email": "user@example.com", "name": "John" }
  }
  ```
- `401` — `{ "errors": { "email": "Invalid email or password" } }` или `{ "errors": { "password": "Invalid email or password" } }`
- `400` — ошибка валидации
- `500` — `{ "error": "Login failed" }`

---

## Boards

### POST `/api/boards`

Создать доску. Требуется Bearer-токен.

**Headers:** `ClientId`, `Authorization: Bearer <token>`

**Body:** `{ "title": "My Board" }`

**Responses**
- `201`
  ```json
  { "id": 1, "title": "My Board", "owner_id": 1, "is_public": false, "public_hash": null }
  ```
- `400`, `401`, `500`

### GET `/api/boards/my`

Доски пользователя (свои + где есть доступ). Требуется Bearer-токен.

**Responses** `200` — массив досок:
```json
[
  {
    "id": 1,
    "owner_id": 1,
    "title": "My Board",
    "public_hash": null,
    "is_public": 0,
    "created_at": "2026-01-01 12:00:00",
    "updated_at": "2026-01-01 12:00:00",
    "likes_count": 5,
    "is_liked": 0
  }
]
```

### GET `/api/boards/:id`

Доска со всеми объектами. Требуется Bearer-токен и доступ (владелец или `board_access`).

**Responses**
- `200` — доска + объекты
  ```json
  {
    "id": 1,
    "owner_id": 1,
    "title": "My Board",
    "is_public": 0,
    "public_hash": null,
    "objects": [
      { "id": 1, "type": "text", "data": { "x": 100, "y": 100, "text": "Hello" } }
    ]
  }
  ```
- `404` — `{ "error": "Board not found or access denied" }`
- `401`

### POST `/api/boards/:id/access`

Выдать доступ к доске по email. Только владелец.

**Body:** `{ "email": "collaborator@example.com" }`

**Responses**
- `200` — `{ "message": "Access granted successfully" }`
- `400` — валидация / уже есть доступ / самому себе
  ```json
  { "errors": { "email": "User already has access to this board" } }
  ```
- `404` — доска не найдена/не владелец или пользователь не найден
- `401`

### POST `/api/boards/:id/public`

Опубликовать доску, получить публичную ссылку. Только владелец.

**Responses**
- `200`
  ```json
  { "public_hash": "a1b2c3d4e5f6...", "public_url": "/board/a1b2c3d4e5f6..." }
  ```
- `404`, `401`

### GET `/api/boards/public/list`

Список публичных досок.

**Query:** `sort` — `likes` (по умолчанию) | `date`

**Responses** `200` — массив досок (как в `/my`, только публичные), `is_liked` заполняется для авторизованного пользователя.

### GET `/api/boards/public/:hash`

Публичная доска по хэшу. Доступна без авторизации.

**Responses**
- `200`
  ```json
  {
    "id": 1,
    "title": "My Board",
    "is_public": 1,
    "public_hash": "a1b2c3d4e5f6...",
    "likes_count": 5,
    "is_liked": false,
    "objects": [
      { "id": 1, "type": "text", "data": { "x": 100, "y": 100, "text": "Hello" } }
    ]
  }
  ```
- `404` — `{ "error": "Public board not found" }`

### POST `/api/boards/:id/like`

Поставить/снять лайк. Для гостей идентификация по IP, для авторизованных — по `user_id`.

**Responses**
- `200` — `{ "liked": true, "message": "Like added" }` или `{ "liked": false, "message": "Like removed" }`
- `404` — `{ "error": "Board not found" }`

---

## Objects

### GET `/api/objects/board/:boardId`

Все объекты доски. Требуется Bearer-токен и доступ к доске.

**Responses** `200`:
```json
[ { "id": 1, "type": "text", "data": { "x": 100, "y": 100, "text": "Hello" } } ]
```
`404` — нет доски/доступа, `401`.

### POST `/api/objects`

Создать объект на доске. Требуется Bearer-токен и доступ. Валидируются границы холста `1600×900`.

**Body**
```json
{
  "board_id": 1,
  "type": "text",
  "data": { "x": 100, "y": 100, "text": "Hello", "fontSize": 16, "color": "#000000", "width": 200, "height": 50 }
}
```

`type`: `text | image | rectangle | circle | line`

**Responses**
- `201` — `{ "id": 1, "type": "text", "data": { ... } }`
- `400`
  - неверный тип/данные: `{ "error": "Invalid object type" }` / `{ "error": "Invalid object data" }`
  - за границами холста:
    ```json
    { "error": "Object out of canvas bounds", "details": ["Object exceeds canvas width (x + width > 1600)"] }
    ```
- `404` — нет доски/доступа, `401`

### PUT `/api/objects/:id`

Обновить объект. Требуется Bearer-токен и доступ. Валидируются границы.

**Body:** `{ "data": { "x": 150, "y": 150, "text": "Updated" } }`

**Responses**
- `200` — `{ "message": "Object updated successfully" }`
- `400` — невалидные данные / за границами
- `403` — `{ "error": "Access denied" }`
- `404` — `{ "error": "Object not found" }`
- `401`

### DELETE `/api/objects/:id`

Удалить объект. Требуется Bearer-токен и доступ.

**Responses**
- `200` — `{ "message": "Object deleted successfully" }`
- `403`, `404`, `401`

---

# WebSocket API

Real-time синхронизация досок.

**URL:** `ws://localhost:3000`

**Query-параметры:**
- `clientId` — **обязателен** (иначе соединение закрывается с кодом `1008`)
- `token` — JWT, опционален; без него вы гость (можно только смотреть публичные доски)

**Пример подключения**
```js
const socket = new WebSocket("ws://localhost:3000?token=<jwt>&clientId=<login>");

socket.onopen = () => { /* ... */ };

socket.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);
  console.log(event, data);
};
```

**Формат сообщений (в обе стороны):**
```json
{ "event": "имя_события", "data": { } }
```

## События: клиент → сервер

### `join_board`
Подключиться к доске.
```json
{ "boardId": 1, "boardHash": null }
```
- `boardId` — для приватных досок (нужен доступ: владелец или `board_access`)
- `boardHash` — для публичных досок
Ответ: событие `board_state`. При ошибке — `error`.

### `focus_object`
Взять объект в фокус для редактирования (блокировка от других). Требуется авторизация.
```json
{ "objectId": 1 }
```
Ответы: `focus_success` либо `focus_error` (объект уже редактируется другим).

### `unfocus_object`
Снять фокус и сохранить изменения. Требуется авторизация.
```json
{ "objectId": 1, "data": { "x": 100, "y": 100, "text": "Updated text" } }
```
`data` опционально — если передано, объект сохраняется (с валидацией границ).

### `create_object`
Создать объект. Требуется авторизация.
```json
{
  "type": "text",
  "data": { "x": 100, "y": 100, "text": "Hello World", "fontSize": 16, "color": "#000000", "width": 200, "height": 50 }
}
```
Ответ: `object_created`.

### `delete_object`
Удалить объект. Требуется авторизация.
```json
{ "objectId": 1 }
```
Ответ: `object_deleted`.

## События: сервер → клиент

### `board_state`
Полное состояние доски при подключении (`join_board`).
```json
{
  "board": { "id": 1, "title": "My Board", "is_public": false },
  "objects": [ { "id": 1, "type": "text", "data": { "x": 100, "y": 100, "text": "Hello", "fontSize": 16 } } ],
  "focuses": [ { "objectId": 1, "userId": 2, "userName": "John" } ]
}
```

### `object_focused`
Объект взят в фокус другим пользователем.
```json
{ "objectId": 1, "userId": 2, "userName": "John" }
```

### `object_unfocused`
Фокус снят; пришли изменения (или `null`).
```json
{ "objectId": 1, "data": { "x": 150, "y": 150, "text": "Updated" } }
```

### `object_created`
Создан новый объект.
```json
{ "id": 1, "type": "text", "data": { "x": 100, "y": 100, "text": "New text" } }
```

### `object_deleted`
Объект удалён.
```json
{ "objectId": 1 }
```

### `user_joined`
Пользователь подключился.
```json
{ "userId": 2, "userName": "John" }
```

### `user_left`
Пользователь отключился.
```json
{ "userId": 2, "userName": "John" }
```

### `focus_success`
Успешный захват фокуса.
```json
{ "objectId": 1 }
```

### `focus_error`
Объект уже редактируется.
```json
{ "objectId": 1, "message": "Object is being edited by another user", "currentUser": "John" }
```

### `error`
Общая ошибка.
```json
{ "message": "Board not found or access denied" }
```
Возможные сообщения: `Invalid JSON`, `Event name is required`, `Unknown event: <event>`, `Authentication required`, `Authentication required to edit`, `Board not found or access denied`, `objectId is required`, `type and data are required`, `Invalid object type`, `Object out of canvas bounds` (с `details`), `Failed to join board`, `Failed to create object`, `Failed to delete object`, `Failed to focus object`, `Failed to unfocus object`.

---

## Типы объектов (`data`)

**text**
`x`, `y`, `text`, `fontSize`, `fontFamily`, `color` (#RRGGBB), `width`, `height`, `rotation`

**image**
`x`, `y`, `url`, `width`, `height`, `rotation`, `aspectRatio`

**rectangle**
`x`, `y`, `width`, `height`, `fill`, `stroke`, `strokeWidth`, `rotation`

**circle**
`x`, `y` (центр), `radius`, `fill`, `stroke`, `strokeWidth`

**line**
`x1`, `y1`, `x2`, `y2`, `stroke`, `strokeWidth`

## Ограничения

- **Холст:** 1600×900 — все объекты обязаны быть в пределах (`Object out of canvas bounds`)
- **Фокус:** нельзя взять в фокус объект, который уже редактирует другой пользователь; изменения применяются только после `unfocus_object`

## Прочее

- `GET /health` → `{ "status": "ok" }`
- Swagger UI: `http://localhost:3000/api-docs`
- WebSocket-док (JSON): `http://localhost:3000/api-docs/websocket`
