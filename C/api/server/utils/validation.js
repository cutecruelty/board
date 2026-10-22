const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

/**
 * Валидация координат и размеров объекта в пределах холста
 * Возвращает массив сообщений об ошибках (пустой массив — объект валиден)
 */
function validateObjectBounds(data, type) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return ["Object data must be an object"];
  }

  const checkRange = (value, min, max, field) => {
    if (value === undefined) {
      return;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${field} must be a finite number`);
      return;
    }
    if (value < min || value > max) {
      errors.push(`${field} is out of canvas bounds (${min}..${max})`);
    }
  };

  switch (type) {
    case "text":
    case "image":
    case "rectangle":
      checkRange(data.x, 0, CANVAS_WIDTH, "x");
      checkRange(data.y, 0, CANVAS_HEIGHT, "y");
      checkRange(data.width, 0, CANVAS_WIDTH, "width");
      checkRange(data.height, 0, CANVAS_HEIGHT, "height");

      if (
        typeof data.x === "number" &&
        typeof data.width === "number" &&
        data.x + data.width > CANVAS_WIDTH
      ) {
        errors.push(`Object exceeds canvas width (x + width > ${CANVAS_WIDTH})`);
      }
      if (
        typeof data.y === "number" &&
        typeof data.height === "number" &&
        data.y + data.height > CANVAS_HEIGHT
      ) {
        errors.push(
          `Object exceeds canvas height (y + height > ${CANVAS_HEIGHT})`,
        );
      }
      break;

    case "circle":
      checkRange(data.x, 0, CANVAS_WIDTH, "x");
      checkRange(data.y, 0, CANVAS_HEIGHT, "y");
      checkRange(
        data.radius,
        0,
        Math.max(CANVAS_WIDTH, CANVAS_HEIGHT),
        "radius",
      );

      if (typeof data.radius === "number" && typeof data.x === "number") {
        if (data.x - data.radius < 0 || data.x + data.radius > CANVAS_WIDTH) {
          errors.push("Circle exceeds canvas width");
        }
      }
      if (typeof data.radius === "number" && typeof data.y === "number") {
        if (data.y - data.radius < 0 || data.y + data.radius > CANVAS_HEIGHT) {
          errors.push("Circle exceeds canvas height");
        }
      }
      break;

    case "line":
      checkRange(data.x1, 0, CANVAS_WIDTH, "x1");
      checkRange(data.y1, 0, CANVAS_HEIGHT, "y1");
      checkRange(data.x2, 0, CANVAS_WIDTH, "x2");
      checkRange(data.y2, 0, CANVAS_HEIGHT, "y2");
      break;

    default:
      errors.push(`Unknown object type: ${type}`);
  }

  return errors;
}

/**
 * Нормализация данных объекта (приведение к границам холста)
 */
function normalizeObjectBounds(data, type) {
  const normalized = { ...data };

  switch (type) {
    case "text":
    case "rectangle":
    case "image":
      if (normalized.x !== undefined) {
        normalized.x = Math.max(0, Math.min(normalized.x, CANVAS_WIDTH));
      }
      if (normalized.y !== undefined) {
        normalized.y = Math.max(0, Math.min(normalized.y, CANVAS_HEIGHT));
      }
      if (normalized.width !== undefined && normalized.x !== undefined) {
        normalized.width = Math.min(
          normalized.width,
          CANVAS_WIDTH - normalized.x,
        );
      }
      if (normalized.height !== undefined && normalized.y !== undefined) {
        normalized.height = Math.min(
          normalized.height,
          CANVAS_HEIGHT - normalized.y,
        );
      }
      break;

    case "circle":
      if (normalized.x !== undefined) {
        normalized.x = Math.max(0, Math.min(normalized.x, CANVAS_WIDTH));
      }
      if (normalized.y !== undefined) {
        normalized.y = Math.max(0, Math.min(normalized.y, CANVAS_HEIGHT));
      }
      if (normalized.radius !== undefined) {
        const maxRadiusX =
          normalized.x !== undefined
            ? Math.min(normalized.x, CANVAS_WIDTH - normalized.x)
            : CANVAS_WIDTH / 2;
        const maxRadiusY =
          normalized.y !== undefined
            ? Math.min(normalized.y, CANVAS_HEIGHT - normalized.y)
            : CANVAS_HEIGHT / 2;
        normalized.radius = Math.min(normalized.radius, maxRadiusX, maxRadiusY);
      }
      break;

    case "line":
      if (normalized.x1 !== undefined) {
        normalized.x1 = Math.max(0, Math.min(normalized.x1, CANVAS_WIDTH));
      }
      if (normalized.y1 !== undefined) {
        normalized.y1 = Math.max(0, Math.min(normalized.y1, CANVAS_HEIGHT));
      }
      if (normalized.x2 !== undefined) {
        normalized.x2 = Math.max(0, Math.min(normalized.x2, CANVAS_WIDTH));
      }
      if (normalized.y2 !== undefined) {
        normalized.y2 = Math.max(0, Math.min(normalized.y2, CANVAS_HEIGHT));
      }
      break;
  }

  return normalized;
}

module.exports = {
  validateObjectBounds,
  normalizeObjectBounds,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
};
