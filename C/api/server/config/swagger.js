const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Interactive Boards API",
      version: "1.0.0",
      description: `API для создания и совместного использования интерактивных досок с поддержкой real-time синхронизации.

## WebSocket API

Для real-time синхронизации используется WebSocket (Socket.io). 

**Подключение:** \`ws://localhost:3000\`

**Документация WebSocket:** [GET /api-docs/websocket](/api-docs/websocket)

**Пример подключения:**
\`\`\`javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' },
  extraHeaders: { ClientId: 'your_login' }
});
\`\`\`

Подробная документация WebSocket событий доступна внизу страницы.`,
      contact: {
        name: "API Support",
      },
    },
    tags: [
      {
        name: "Auth",
        description: "Авторизация и регистрация",
      },
      {
        name: "Boards",
        description: "Управление досками",
      },
      {
        name: "Objects",
        description: "Управление объектами на досках",
      },
      {
        name: "WebSocket",
        description: "WebSocket API для real-time синхронизации",
      },
    ],
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT токен авторизации",
        },
        clientId: {
          type: "apiKey",
          in: "header",
          name: "ClientId",
          description: "Ваш логин (обязателен для всех запросов)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Сообщение об ошибке",
            },
            errors: {
              type: "object",
              description: "Объект с ошибками валидации по полям",
              additionalProperties: {
                type: "string",
              },
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "name", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
              description: "Валидный email адрес",
            },
            name: {
              type: "string",
              example: "John",
              pattern: "^[a-zA-Z]+$",
              description: "Имя пользователя (только латиница)",
            },
            password: {
              type: "string",
              minLength: 8,
              example: "password123!",
              description:
                "Пароль (минимум 8 символов, должен содержать цифры и спецсимволы)",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            password: {
              type: "string",
              example: "password123!",
            },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            user: {
              type: "object",
              properties: {
                id: { type: "integer", example: 1 },
                email: { type: "string", example: "user@example.com" },
                name: { type: "string", example: "John" },
              },
            },
          },
        },
        Board: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            title: { type: "string", example: "My Board" },
            owner_id: { type: "integer", example: 1 },
            is_public: { type: "integer", example: 0 },
            public_hash: {
              type: "string",
              nullable: true,
              example: "a1b2c3d4e5f6...",
            },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
            likes_count: { type: "integer", example: 5 },
            is_liked: { type: "integer", example: 0 },
          },
        },
        BoardWithObjects: {
          allOf: [
            { $ref: "#/components/schemas/Board" },
            {
              type: "object",
              properties: {
                objects: {
                  type: "array",
                  items: { $ref: "#/components/schemas/BoardObject" },
                },
              },
            },
          ],
        },
        BoardObject: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            type: {
              type: "string",
              enum: ["text", "image", "rectangle", "circle", "line"],
              example: "text",
            },
            data: {
              type: "object",
              description: "Данные объекта (структура зависит от типа)",
              example: {
                x: 100,
                y: 100,
                text: "Hello World",
                fontSize: 16,
                color: "#000000",
              },
            },
          },
        },
        CreateBoardRequest: {
          type: "object",
          required: ["title"],
          properties: {
            title: {
              type: "string",
              example: "My Board",
              description: "Название доски",
            },
          },
        },
        AddAccessRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "collaborator@example.com",
              description: "Email пользователя для предоставления доступа",
            },
          },
        },
        CreateObjectRequest: {
          type: "object",
          required: ["board_id", "type", "data"],
          properties: {
            board_id: { type: "integer", example: 1 },
            type: {
              type: "string",
              enum: ["text", "image", "rectangle", "circle", "line"],
              example: "text",
            },
            data: {
              type: "object",
              description:
                "Данные объекта (x, y, и другие свойства в зависимости от типа)",
              example: {
                x: 100,
                y: 100,
                text: "Hello",
                fontSize: 16,
                color: "#000000",
                width: 200,
                height: 50,
              },
            },
          },
        },
        UpdateObjectRequest: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              type: "object",
              description: "Обновленные данные объекта",
              example: {
                x: 150,
                y: 150,
                text: "Updated text",
              },
            },
          },
        },
        PublicLinkResponse: {
          type: "object",
          properties: {
            public_hash: { type: "string", example: "a1b2c3d4e5f6..." },
            public_url: { type: "string", example: "/board/a1b2c3d4e5f6..." },
          },
        },
        LikeResponse: {
          type: "object",
          properties: {
            liked: { type: "boolean", example: true },
            message: { type: "string", example: "Like added" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { clientId: [] }],
  },
  apis: [
    "./server/routes/*.js",
    "./server/index.js",
    "./server/routes/websocket-docs.js",
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
