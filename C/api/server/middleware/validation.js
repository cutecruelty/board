const { body, validationResult } = require("express-validator");

const validateRegister = [
  body("email").isEmail().withMessage("Невалидный email").normalizeEmail(),
  body("name")
    .matches(/^[a-zA-Z]+$/)
    .withMessage("Имя может состоять только из латиницы")
    .isLength({ min: 1 })
    .withMessage("Имя обязательно"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Пароль должен содержать миниум 8 символов")
    .matches(/[0-9]/)
    .withMessage("Пароль должен содержать хотябы одну цифру")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Пароль должен содержать хоятбы один из спец символов"),
];

const validateLogin = [
  body("email").isEmail().withMessage("Invalid email format").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const validateCreateBoard = [
  body("title").trim().isLength({ min: 1 }).withMessage("Title is required"),
];

const validateAddAccess = [
  body("email").isEmail().withMessage("Invalid email format").normalizeEmail(),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().reduce((acc, err) => {
        acc[err.path || err.param] = err.msg;
        return acc;
      }, {}),
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateBoard,
  validateAddAccess,
  handleValidationErrors,
};
