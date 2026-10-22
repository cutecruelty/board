const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const {
  authenticate,
  checkClientId,
  optionalAuth,
} = require("../middleware/auth");
const {
  validateCreateBoard,
  validateAddAccess,
  handleValidationErrors,
} = require("../middleware/validation");

const router = express.Router();

/**
 * @swagger
 * /api/boards:
 *   post:
 *     summary: Создание новой доски
 *     tags: [Boards]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBoardRequest'
 *     responses:
 *       201:
 *         description: Доска успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Board'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Требуется авторизация
 */
router.post(
  "/",
  checkClientId,
  authenticate,
  validateCreateBoard,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title } = req.body;
      const userId = req.user.id;

      const result = await db.run(
        "INSERT INTO boards (owner_id, title) VALUES (?, ?)",
        [userId, title],
      );

      res.status(201).json({
        id: result.lastID,
        title,
        owner_id: userId,
        is_public: false,
        public_hash: null,
      });
    } catch (error) {
      console.error("Create board error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  },
);

/**
 * @swagger
 * /api/boards/my:
 *   get:
 *     summary: Получение списка досок пользователя
 *     description: Возвращает все доски, созданные пользователем или к которым у него есть доступ
 *     tags: [Boards]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     responses:
 *       200:
 *         description: Список досок
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Board'
 *       401:
 *         description: Требуется авторизация
 */
router.get("/my", checkClientId, authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const boards = await db.all(
      `
  SELECT DISTINCT b.*, 
         (SELECT COUNT(*) FROM board_likes WHERE board_id = b.id) as likes_count,
         (SELECT COUNT(*) FROM board_likes 
          WHERE board_id = b.id AND user_id = ?) as is_liked
  FROM boards b
  LEFT JOIN board_access ba ON b.id = ba.board_id
  WHERE b.owner_id = ? OR ba.user_id = ?
  ORDER BY b.updated_at DESC
`,
      [userId, userId, userId],
    );

    res.json(boards);
  } catch (error) {
    console.error("Get my boards error:", error);
    res.status(500).json({ error: "Failed to get boards" });
  }
});

/**
 * @swagger
 * /api/boards/{id}:
 *   get:
 *     summary: Получение доски по ID
 *     description: Возвращает доску со всеми объектами
 *     tags: [Boards]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID доски
 *     responses:
 *       200:
 *         description: Доска с объектами
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BoardWithObjects'
 *       404:
 *         description: Доска не найдена или нет доступа
 *       401:
 *         description: Требуется авторизация
 */
router.get("/:id", checkClientId, authenticate, async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user.id;

    const board = await db.get(
      `
      SELECT b.* FROM boards b
      LEFT JOIN board_access ba ON b.id = ba.board_id
      WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
    `,
      [boardId, userId, userId],
    );

    if (!board) {
      return res
        .status(404)
        .json({ error: "Board not found or access denied" });
    }

    const objects = await db.all(
      "SELECT * FROM board_objects WHERE board_id = ? ORDER BY id",
      [boardId],
    );

    res.json({
      ...board,
      objects: objects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        data: JSON.parse(obj.data),
      })),
    });
  } catch (error) {
    console.error("Get board error:", error);
    res.status(500).json({ error: "Failed to get board" });
  }
});

/**
 * @swagger
 * /api/boards/{id}/access:
 *   post:
 *     summary: Предоставление доступа к доске по email
 *     description: Только владелец доски может предоставлять доступ
 *     tags: [Boards]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID доски
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddAccessRequest'
 *     responses:
 *       200:
 *         description: Доступ успешно предоставлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Access granted successfully
 *       400:
 *         description: Ошибка валидации или пользователь уже имеет доступ
 *       404:
 *         description: Доска не найдена или вы не владелец
 *       401:
 *         description: Требуется авторизация
 */
router.post(
  "/:id/access",
  checkClientId,
  authenticate,
  validateAddAccess,
  handleValidationErrors,
  async (req, res) => {
    try {
      const boardId = req.params.id;
      const userId = req.user.id;
      const { email } = req.body;

      const board = await db.get(
        "SELECT * FROM boards WHERE id = ? AND owner_id = ?",
        [boardId, userId],
      );
      if (!board) {
        return res
          .status(404)
          .json({ error: "Board not found or you are not the owner" });
      }

      const targetUser = await db.get("SELECT id FROM users WHERE email = ?", [
        email,
      ]);
      if (!targetUser) {
        return res
          .status(404)
          .json({ errors: { email: "User with this email not found" } });
      }

      if (targetUser.id === userId) {
        return res
          .status(400)
          .json({ errors: { email: "Cannot add yourself as collaborator" } });
      }

      const existingAccess = await db.get(
        "SELECT id FROM board_access WHERE board_id = ? AND user_id = ?",
        [boardId, targetUser.id],
      );

      if (existingAccess) {
        return res
          .status(400)
          .json({ errors: { email: "User already has access to this board" } });
      }

      await db.run(
        "INSERT INTO board_access (board_id, user_id) VALUES (?, ?)",
        [boardId, targetUser.id],
      );

      res.json({ message: "Access granted successfully" });
    } catch (error) {
      console.error("Add access error:", error);
      res.status(500).json({ error: "Failed to add access" });
    }
  },
);

/**
 * @swagger
 * /api/boards/{id}/public:
 *   post:
 *     summary: Генерация публичной ссылки на доску
 *     description: Создает hash для публичного доступа к доске
 *     tags: [Boards]
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID доски
 *     responses:
 *       200:
 *         description: Публичная ссылка создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicLinkResponse'
 *       404:
 *         description: Доска не найдена или вы не владелец
 *       401:
 *         description: Требуется авторизация
 */
router.post("/:id/public", checkClientId, authenticate, async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user.id;

    const board = await db.get(
      "SELECT * FROM boards WHERE id = ? AND owner_id = ?",
      [boardId, userId],
    );
    if (!board) {
      return res
        .status(404)
        .json({ error: "Board not found or you are not the owner" });
    }

    let publicHash = board.public_hash;
    if (!publicHash) {
      publicHash = crypto.randomBytes(16).toString("hex");
      await db.run(
        "UPDATE boards SET is_public = 1, public_hash = ? WHERE id = ?",
        [publicHash, boardId],
      );
    }

    res.json({
      public_hash: publicHash,
      public_url: `/board/${publicHash}`,
    });
  } catch (error) {
    console.error("Generate public link error:", error);
    res.status(500).json({ error: "Failed to generate public link" });
  }
});

/**
 * @swagger
 * /api/boards/public/list:
 *   get:
 *     summary: Получение списка публичных досок
 *     description: Возвращает все публичные доски с возможностью сортировки
 *     tags: [Boards]
 *     security:
 *       - clientId: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [likes, date]
 *           default: likes
 *         description: Сортировка (по лайкам или дате)
 *     responses:
 *       200:
 *         description: Список публичных досок
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Board'
 */
router.get("/public/list", checkClientId, optionalAuth, async (req, res) => {
  try {
    const { sort = "likes" } = req.query;

    let orderBy = "likes_count DESC, b.created_at DESC";
    if (sort === "date") {
      orderBy = "b.created_at DESC";
    }

    const boards = await db.all(
      `
      SELECT b.*, 
             (SELECT COUNT(*) FROM board_likes WHERE board_id = b.id) as likes_count,
             ${req.user ? `(SELECT COUNT(*) FROM board_likes WHERE board_id = b.id AND user_id = ?) as is_liked` : "0 as is_liked"}
      FROM boards b
      WHERE b.is_public = 1 AND b.public_hash IS NOT NULL
      ORDER BY ${orderBy}
    `,
      req.user ? [req.user.id] : [],
    );

    res.json(boards);
  } catch (error) {
    console.error("Get public boards error:", error);
    res.status(500).json({ error: "Failed to get public boards" });
  }
});

/**
 * @swagger
 * /api/boards/public/{hash}:
 *   get:
 *     summary: Получение публичной доски по hash
 *     description: Доступно без авторизации
 *     tags: [Boards]
 *     security:
 *       - clientId: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *         description: Публичный hash доски
 *     responses:
 *       200:
 *         description: Публичная доска с объектами
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/BoardWithObjects'
 *                 - type: object
 *                   properties:
 *                     is_liked:
 *                       type: boolean
 *                       description: Поставлен ли лайк (только для авторизованных)
 *       404:
 *         description: Публичная доска не найдена
 */
router.get("/public/:hash", checkClientId, optionalAuth, async (req, res) => {
  try {
    const hash = req.params.hash;

    const board = await db.get(
      "SELECT * FROM boards WHERE public_hash = ? AND is_public = 1",
      [hash],
    );

    if (!board) {
      return res.status(404).json({ error: "Public board not found" });
    }

    const objects = await db.all(
      "SELECT * FROM board_objects WHERE board_id = ? ORDER BY id",
      [board.id],
    );

    let isLiked = false;
    if (req.user) {
      const like = await db.get(
        "SELECT id FROM board_likes WHERE board_id = ? AND user_id = ?",
        [board.id, req.user.id],
      );
      isLiked = !!like;
    }

    const likesCount = await db.get(
      "SELECT COUNT(*) as count FROM board_likes WHERE board_id = ?",
      [board.id],
    );

    res.json({
      ...board,
      likes_count: likesCount.count,
      is_liked: isLiked,
      objects: objects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        data: JSON.parse(obj.data),
      })),
    });
  } catch (error) {
    console.error("Get public board error:", error);
    res.status(500).json({ error: "Failed to get public board" });
  }
});

/**
 * @swagger
 * /api/boards/{id}/like:
 *   post:
 *     summary: Лайк/анлайк доски
 *     description: Доступно без авторизации (для гостей используется IP)
 *     tags: [Boards]
 *     security:
 *       - clientId: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID доски
 *     responses:
 *       200:
 *         description: Лайк переключен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeResponse'
 *       404:
 *         description: Доска не найдена
 */
router.post("/:id/like", checkClientId, optionalAuth, async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user?.id;
    const ipAddress =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown";

    const board = await db.get("SELECT * FROM boards WHERE id = ?", [boardId]);
    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    let existingLike;
    if (userId) {
      existingLike = await db.get(
        "SELECT id FROM board_likes WHERE board_id = ? AND user_id = ?",
        [boardId, userId],
      );
    } else {
      existingLike = await db.get(
        "SELECT id FROM board_likes WHERE board_id = ? AND ip_address = ? AND user_id IS NULL",
        [boardId, ipAddress],
      );
    }

    if (existingLike) {
      await db.run("DELETE FROM board_likes WHERE id = ?", [existingLike.id]);
      res.json({ liked: false, message: "Like removed" });
    } else {
      await db.run(
        "INSERT INTO board_likes (board_id, user_id, ip_address) VALUES (?, ?, ?)",
        [boardId, userId || null, userId ? null : ipAddress],
      );
      res.json({ liked: true, message: "Like added" });
    }
  } catch (error) {
    console.error("Like board error:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

module.exports = router;
