const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");
const {
  validateRegister,
  validateLogin,
  handleValidationErrors,
} = require("../middleware/validation");
const { checkClientId } = require("../middleware/auth");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     security:
 *       - clientId: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 userId:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/register",
  checkClientId,
  validateRegister,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, name, password } = req.body;

      const existingUser = await db.get(
        "SELECT id FROM users WHERE email = ?",
        [email],
      );
      if (existingUser) {
        return res
          .status(400)
          .json({ errors: { email: "User with this email already exists" } });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await db.run(
        "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
        [email, name, passwordHash],
      );

      res.status(201).json({
        message: "User registered successfully",
        userId: result.lastID,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  },
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Авторизация пользователя
 *     tags: [Auth]
 *     security:
 *       - clientId: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Успешная авторизация
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Неверный email или пароль
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/login",
  checkClientId,
  validateLogin,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
      if (!user) {
        return res
          .status(401)
          .json({ errors: { email: "Invalid email or password" } });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ errors: { password: "Invalid email or password" } });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  },
);

module.exports = router;
