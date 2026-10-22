

const websocketDocs = {
  connection: {
    url: 'ws://localhost:3000',
    library: 'Socket.io',
    authentication: {
      token: 'JWT токен (опционально для публичных досок)',
      clientId: 'Обязательный заголовок ClientId'
    },
    example: {
      javascript: `
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token' // опционально
  },
  extraHeaders: {
    ClientId: 'your_login'
  }
});
      `
    }
  },
  events: {
    clientToServer: [
      {
        name: 'join_board',
        description: 'Подключение к доске',
        payload: {
          boardId: 'integer (для приватных досок)',
          boardHash: 'string (для публичных досок)'
        },
        example: {
          boardId: 1,
          boardHash: null
        },
        response: 'board_state'
      },
      {
        name: 'focus_object',
        description: 'Захват фокуса на объект для редактирования',
        payload: {
          objectId: 'integer'
        },
        example: {
          objectId: 1
        },
        responses: ['focus_success', 'focus_error']
      },
      {
        name: 'unfocus_object',
        description: 'Снятие фокуса с объекта (сохранение изменений)',
        payload: {
          objectId: 'integer',
          data: 'object (обновленные данные объекта)'
        },
        example: {
          objectId: 1,
          data: {
            x: 100,
            y: 100,
            text: 'Updated text',
            fontSize: 16
          }
        }
      },
      {
        name: 'create_object',
        description: 'Создание нового объекта на доске',
        payload: {
          type: 'string (text|image|rectangle|circle|line)',
          data: 'object (данные объекта)'
        },
        example: {
          type: 'text',
          data: {
            x: 100,
            y: 100,
            text: 'Hello World',
            fontSize: 16,
            color: '#000000',
            width: 200,
            height: 50
          }
        },
        response: 'object_created'
      },
      {
        name: 'delete_object',
        description: 'Удаление объекта',
        payload: {
          objectId: 'integer'
        },
        example: {
          objectId: 1
        },
        response: 'object_deleted'
      }
    ],
    serverToClient: [
      {
        name: 'board_state',
        description: 'Текущее состояние доски при подключении',
        payload: {
          board: {
            id: 'integer',
            title: 'string',
            is_public: 'boolean'
          },
          objects: 'array (массив объектов)',
          focuses: 'array (активные фокусы)'
        },
        example: {
          board: {
            id: 1,
            title: 'My Board',
            is_public: false
          },
          objects: [
            {
              id: 1,
              type: 'text',
              data: {
                x: 100,
                y: 100,
                text: 'Hello',
                fontSize: 16
              }
            }
          ],
          focuses: [
            {
              objectId: 1,
              userId: 2,
              userName: 'John'
            }
          ]
        }
      },
      {
        name: 'object_focused',
        description: 'Объект взят в фокус другим пользователем',
        payload: {
          objectId: 'integer',
          userId: 'integer',
          userName: 'string'
        },
        example: {
          objectId: 1,
          userId: 2,
          userName: 'John'
        }
      },
      {
        name: 'object_unfocused',
        description: 'Фокус снят с объекта, получены изменения',
        payload: {
          objectId: 'integer',
          data: 'object|null (обновленные данные или null)'
        },
        example: {
          objectId: 1,
          data: {
            x: 150,
            y: 150,
            text: 'Updated'
          }
        }
      },
      {
        name: 'object_created',
        description: 'Создан новый объект',
        payload: {
          id: 'integer',
          type: 'string',
          data: 'object'
        },
        example: {
          id: 1,
          type: 'text',
          data: {
            x: 100,
            y: 100,
            text: 'New text'
          }
        }
      },
      {
        name: 'object_deleted',
        description: 'Удален объект',
        payload: {
          objectId: 'integer'
        },
        example: {
          objectId: 1
        }
      },
      {
        name: 'user_joined',
        description: 'Пользователь подключился к доске',
        payload: {
          userId: 'integer|null',
          userName: 'string'
        },
        example: {
          userId: 2,
          userName: 'John'
        }
      },
      {
        name: 'user_left',
        description: 'Пользователь отключился от доски',
        payload: {
          userId: 'integer|null',
          userName: 'string'
        },
        example: {
          userId: 2,
          userName: 'John'
        }
      },
      {
        name: 'focus_success',
        description: 'Успешный захват фокуса',
        payload: {
          objectId: 'integer'
        },
        example: {
          objectId: 1
        }
      },
      {
        name: 'focus_error',
        description: 'Ошибка захвата фокуса (объект уже редактируется)',
        payload: {
          objectId: 'integer',
          message: 'string',
          currentUser: 'string'
        },
        example: {
          objectId: 1,
          message: 'Object is being edited by another user',
          currentUser: 'John'
        }
      },
      {
        name: 'error',
        description: 'Общая ошибка',
        payload: {
          message: 'string'
        },
        example: {
          message: 'Board not found or access denied'
        }
      }
    ]
  },
  objectTypes: {
    text: {
      description: 'Текстовый объект',
      data: {
        x: 'number (координата X)',
        y: 'number (координата Y)',
        text: 'string (текст)',
        fontSize: 'number (размер шрифта)',
        fontFamily: 'string (семейство шрифта)',
        color: 'string (цвет в формате #RRGGBB)',
        width: 'number (ширина)',
        height: 'number (высота)',
        rotation: 'number (угол поворота в градусах)'
      }
    },
    image: {
      description: 'Изображение',
      data: {
        x: 'number',
        y: 'number',
        url: 'string (URL изображения)',
        width: 'number',
        height: 'number',
        rotation: 'number',
        aspectRatio: 'number (соотношение сторон, сохраняется при изменении размера)'
      }
    },
    rectangle: {
      description: 'Прямоугольник',
      data: {
        x: 'number',
        y: 'number',
        width: 'number',
        height: 'number',
        fill: 'string (цвет заливки)',
        stroke: 'string (цвет обводки)',
        strokeWidth: 'number (толщина обводки)',
        rotation: 'number'
      }
    },
    circle: {
      description: 'Круг',
      data: {
        x: 'number (центр X)',
        y: 'number (центр Y)',
        radius: 'number (радиус)',
        fill: 'string',
        stroke: 'string',
        strokeWidth: 'number'
      }
    },
    line: {
      description: 'Линия',
      data: {
        x1: 'number (начало X)',
        y1: 'number (начало Y)',
        x2: 'number (конец X)',
        y2: 'number (конец Y)',
        stroke: 'string',
        strokeWidth: 'number'
      }
    }
  },
  constraints: {
    canvas: {
      width: 1600,
      height: 900,
      description: 'Все объекты должны находиться в пределах холста'
    },
    focus: {
      description: 'Нельзя взять в фокус объект, который уже редактируется другим пользователем',
      behavior: 'Изменения применяются только после снятия фокуса'
    }
  }
};

module.exports = websocketDocs;
