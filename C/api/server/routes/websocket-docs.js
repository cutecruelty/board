
/**
 * @swagger
 * /api-docs/websocket:
 *   get:
 *     summary: WebSocket API документация
 *     description: |
 *       Документация WebSocket API для real-time синхронизации досок.
 *       
 *       ## Подключение
 *       - URL: `ws://localhost:3000`
 *       - Библиотека: Socket.io
 *       - Требуется заголовок `ClientId` в extraHeaders
 *       - Токен авторизации опционален (для публичных досок)
 *       
 *       ## Основные события
 *       
 *       ### Клиент → Сервер
 *       - `join_board` - подключение к доске
 *       - `focus_object` - захват фокуса на объект
 *       - `unfocus_object` - снятие фокуса (сохранение изменений)
 *       - `create_object` - создание объекта
 *       - `delete_object` - удаление объекта
 *       
 *       ### Сервер → Клиент
 *       - `board_state` - текущее состояние доски
 *       - `object_focused` - объект взят в фокус
 *       - `object_unfocused` - фокус снят, получены изменения
 *       - `object_created` - создан новый объект
 *       - `object_deleted` - удален объект
 *       - `user_joined` - пользователь подключился
 *       - `user_left` - пользователь отключился
 *       - `focus_success` - успешный захват фокуса
 *       - `focus_error` - ошибка захвата фокуса
 *       - `error` - общая ошибка
 *       
 *       Подробная документация с примерами доступна в JSON формате.
 *     tags: [WebSocket]
 *     responses:
 *       200:
 *         description: WebSocket API документация
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connection:
 *                   type: object
 *                   description: Информация о подключении
 *                 events:
 *                   type: object
 *                   description: Список всех событий
 *                 objectTypes:
 *                   type: object
 *                   description: Типы объектов и их структура данных
 *                 constraints:
 *                   type: object
 *                   description: Ограничения и правила
 */
const express = require('express');
const router = express.Router();
const websocketDocs = require('../config/websocket-docs');

router.get('/', (req, res) => {
  res.json(websocketDocs);
});

module.exports = router;
