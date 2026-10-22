const express = require('express');
const db = require('../database');
const { authenticate, checkClientId } = require('../middleware/auth');
const { validateObjectBounds } = require('../utils/validation');

const router = express.Router();

/**
 * @swagger
 * /api/objects/board/{boardId}:
 *   get:
 *     summary: Получение всех объектов доски
 *     tags: [Objects]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: boardId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID доски
 *     responses:
 *       200:
 *         description: Список объектов доски
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BoardObject'
 *       404:
 *         description: Доска не найдена или нет доступа
 *       401:
 *         description: Требуется авторизация
 */
router.get('/board/:boardId', checkClientId, authenticate, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const userId = req.user.id;

    const board = await db.get(`
      SELECT b.* FROM boards b
      LEFT JOIN board_access ba ON b.id = ba.board_id
      WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
    `, [boardId, userId, userId]);

    if (!board) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    const objects = await db.all(
      'SELECT * FROM board_objects WHERE board_id = ? ORDER BY id',
      [boardId]
    );

    res.json(objects.map(obj => ({
      id: obj.id,
      type: obj.type,
      data: JSON.parse(obj.data)
    })));
  } catch (error) {
    console.error('Get objects error:', error);
    res.status(500).json({ error: 'Failed to get objects' });
  }
});

/**
 * @swagger
 * /api/objects/{id}:
 *   put:
 *     summary: Обновление объекта
 *     description: "Сохраняет изменения объекта в базу данных. Валидирует границы холста (1600x900)"
 *     tags: [Objects]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID объекта
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateObjectRequest'
 *     responses:
 *       200:
 *         description: Объект успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Object updated successfully
 *       400:
 *         description: Ошибка валидации или объект выходит за границы холста
 *       403:
 *         description: Нет доступа к доске
 *       404:
 *         description: Объект не найден
 *       401:
 *         description: Требуется авторизация
 */
router.put('/:id', checkClientId, authenticate, async (req, res) => {
  try {
    const objectId = req.params.id;
    const { data } = req.body;
    const userId = req.user.id;

    const object = await db.get('SELECT * FROM board_objects WHERE id = ?', [objectId]);
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }

    const board = await db.get(`
      SELECT b.* FROM boards b
      LEFT JOIN board_access ba ON b.id = ba.board_id
      WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
    `, [object.board_id, userId, userId]);

    if (!board) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid object data' });
    }

    const boundsErrors = validateObjectBounds(data, object.type);
    if (boundsErrors.length > 0) {
      return res.status(400).json({ error: 'Object out of canvas bounds', details: boundsErrors });
    }

    await db.run(
      'UPDATE board_objects SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(data), objectId]
    );

    await db.run(
      'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [object.board_id]
    );

    res.json({ message: 'Object updated successfully' });
  } catch (error) {
    console.error('Update object error:', error);
    res.status(500).json({ error: 'Failed to update object' });
  }
});

/**
 * @swagger
 * /api/objects:
 *   post:
 *     summary: Создание нового объекта на доске
 *     description: "Создает объект на доске. Валидирует границы холста (1600x900). Поддерживаемые типы: text, image, rectangle, circle, line"
 *     tags: [Objects]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateObjectRequest'
 *     responses:
 *       201:
 *         description: Объект успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BoardObject'
 *       400:
 *         description: Ошибка валидации или объект выходит за границы холста
 *       404:
 *         description: Доска не найдена или нет доступа
 *       401:
 *         description: Требуется авторизация
 */
router.post('/', checkClientId, authenticate, async (req, res) => {
  try {
    const { board_id, type, data } = req.body;
    const userId = req.user.id;

    const board = await db.get(`
      SELECT b.* FROM boards b
      LEFT JOIN board_access ba ON b.id = ba.board_id
      WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
    `, [board_id, userId, userId]);

    if (!board) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    const validTypes = ['text', 'image', 'rectangle', 'circle', 'line'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid object type' });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid object data' });
    }

    const boundsErrors = validateObjectBounds(data, type);
    if (boundsErrors.length > 0) {
      return res.status(400).json({ error: 'Object out of canvas bounds', details: boundsErrors });
    }

    const result = await db.run(
      'INSERT INTO board_objects (board_id, type, data) VALUES (?, ?, ?)',
      [board_id, type, JSON.stringify(data)]
    );

    await db.run(
      'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [board_id]
    );

    res.status(201).json({
      id: result.lastID,
      type,
      data
    });
  } catch (error) {
    console.error('Create object error:', error);
    res.status(500).json({ error: 'Failed to create object' });
  }
});

/**
 * @swagger
 * /api/objects/{id}:
 *   delete:
 *     summary: Удаление объекта
 *     tags: [Objects]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID объекта
 *     responses:
 *       200:
 *         description: Объект успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Object deleted successfully
 *       403:
 *         description: Нет доступа к доске
 *       404:
 *         description: Объект не найден
 *       401:
 *         description: Требуется авторизация
 */
router.delete('/:id', checkClientId, authenticate, async (req, res) => {
  try {
    const objectId = req.params.id;
    const userId = req.user.id;

    const object = await db.get('SELECT * FROM board_objects WHERE id = ?', [objectId]);
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }

    const board = await db.get(`
      SELECT b.* FROM boards b
      LEFT JOIN board_access ba ON b.id = ba.board_id
      WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
    `, [object.board_id, userId, userId]);

    if (!board) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.run('DELETE FROM board_objects WHERE id = ?', [objectId]);

    await db.run(
      'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [object.board_id]
    );

    res.json({ message: 'Object deleted successfully' });
  } catch (error) {
    console.error('Delete object error:', error);
    res.status(500).json({ error: 'Failed to delete object' });
  }
});

module.exports = router;
