const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const db = require('./database');
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const objectRoutes = require('./routes/objects');
const { JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const { validateObjectBounds } = require('./utils/validation');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const activeFocuses = new Map();

const boardRooms = new Map();

db.connect().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

const websocketDocs = require('./config/websocket-docs');
const websocketDocsRoute = require('./routes/websocket-docs');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Interactive Boards API Documentation',
  customJs: '/api-docs/websocket-docs.js'
}));

app.use('/api-docs/websocket', websocketDocsRoute);

app.get('/api-docs/websocket-docs.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    window.addEventListener('load', function() {
      const wsDocs = ${JSON.stringify(websocketDocs, null, 2)};
      
      setTimeout(function() {
        const swaggerUI = document.querySelector('.swagger-ui');
        if (swaggerUI) {
          const wsSection = document.createElement('div');
          wsSection.className = 'websocket-docs';
          wsSection.innerHTML = \`
            <div style="padding: 20px; background: #f8f8f8; border-top: 2px solid #667eea; margin-top: 30px;">
              <h2 style="color: #667eea; margin-bottom: 20px;">📡 WebSocket API</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3>Подключение</h3>
                <p><strong>URL:</strong> ws://localhost:3000</p>
                <p><strong>Библиотека:</strong> WebSocket (native)</p>
                <pre style="background: #f5f5f5; padding: 15px; border-radius: 6px; overflow-x: auto;"><code>const socket = new WebSocket('ws://localhost:3000?token=your_jwt_token&amp;clientId=your_login');

socket.onopen = () => {
  console.log('Connected');
};

socket.onmessage = (event) => {
  const { event: name, data } = JSON.parse(event.data);
  console.log('Received', name, data);
};

socket.onclose = () => {
  console.log('Disconnected');
};</code></pre>
              </div>

              <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3>События клиента → сервера</h3>
                <div id="ws-client-events"></div>
              </div>

              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h3>События сервера → клиента</h3>
                <div id="ws-server-events"></div>
              </div>
            </div>
          \`;
          
          swaggerUI.appendChild(wsSection);
          
          renderEvents(wsDocs.events.clientToServer, 'ws-client-events');
          renderEvents(wsDocs.events.serverToClient, 'ws-server-events');
        }
      }, 1000);
      
      function renderEvents(events, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        events.forEach(event => {
          const eventDiv = document.createElement('div');
          eventDiv.style.marginBottom = '20px';
          eventDiv.style.padding = '15px';
          eventDiv.style.border = '1px solid #e0e0e0';
          eventDiv.style.borderRadius = '6px';
          eventDiv.innerHTML = \`
            <h4 style="color: #333; margin-bottom: 10px;">
              <code style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px;">\${event.name}</code>
            </h4>
            <p style="color: #666; margin-bottom: 10px;">\${event.description}</p>
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #667eea; font-weight: 500;">Показать пример</summary>
              <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px; overflow-x: auto;"><code>\${JSON.stringify(event.example || event.payload, null, 2)}</code></pre>
            </details>
          \`;
          container.appendChild(eventDiv);
        });
      }
    });
  `);
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/objects', objectRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

function send(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

function broadcastToBoard(boardId, event, data, exceptWs = null) {
  const room = boardRooms.get(boardId);
  if (!room) return;

  for (const client of room) {
    if (client !== exceptWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }
}

let nextSocketId = 1;

wss.on('connection', async (ws, request) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token') || undefined;
    const clientId = url.searchParams.get('clientId') || request.headers.clientid;

    if (!clientId) {
      ws.close(1008, 'ClientId is required');
      return;
    }

    ws.id = nextSocketId++;
    ws.clientId = clientId;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [decoded.userId]);
        if (user) {
          ws.user = user;
        }
      } catch (err) {
      }
    }

    console.log(`Client connected: ${ws.id} (ClientId: ${ws.clientId})`);
  } catch (error) {
    console.error('Authentication error:', error);
    ws.close(1011, 'Authentication error');
    return;
  }

  ws.on('message', async (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch (e) {
      send(ws, 'error', { message: 'Invalid JSON' });
      return;
    }

    const { event, data } = message;

    if (!event) {
      send(ws, 'error', { message: 'Event name is required' });
      return;
    }

    switch (event) {
      case 'join_board': {
        const { boardId: initialBoardId, boardHash } = data || {};
        let boardId = initialBoardId;
        try {
          let board;
          
          if (boardHash) {
            board = await db.get(
              'SELECT * FROM boards WHERE public_hash = ? AND is_public = 1',
              [boardHash]
            );
            if (board) {
              boardId = board.id;
            }
          } else if (boardId) {
            if (ws.user) {
              board = await db.get(`
                SELECT b.* FROM boards b
                LEFT JOIN board_access ba ON b.id = ba.board_id
                WHERE b.id = ? AND (b.owner_id = ? OR ba.user_id = ?)
              `, [boardId, ws.user.id, ws.user.id]);
            }
          }

          if (!board && boardId) {
            send(ws, 'error', { message: 'Board not found or access denied' });
            return;
          }

          if (board) {
            ws.currentBoardId = board.id;

            if (!boardRooms.has(board.id)) {
              boardRooms.set(board.id, new Set());
            }
            boardRooms.get(board.id).add(ws);

            const objects = await db.all(
              'SELECT * FROM board_objects WHERE board_id = ? ORDER BY id',
              [board.id]
            );

            send(ws, 'board_state', {
              board: {
                id: board.id,
                title: board.title,
                is_public: board.is_public
              },
              objects: objects.map(obj => ({
                id: obj.id,
                type: obj.type,
                data: JSON.parse(obj.data)
              })),
              focuses: Array.from(activeFocuses.entries())
                .filter(([key]) => key.startsWith(`${board.id}_`))
                .map(([key, value]) => ({
                  objectId: parseInt(key.split('_')[1]),
                  userId: value.userId,
                  userName: value.userName
                }))
            });

            broadcastToBoard(
              board.id,
              'user_joined',
              {
                userId: ws.user?.id,
                userName: ws.user?.name || 'Guest'
              },
              ws
            );
          }
        } catch (error) {
          console.error('Join board error:', error);
          send(ws, 'error', { message: 'Failed to join board' });
        }
        break;
      }
      case 'focus_object': {
        const { objectId } = data || {};
        if (!objectId) {
          send(ws, 'error', { message: 'objectId is required' });
          return;
        }

    try {
      if (!ws.currentBoardId) {
        return;
      }

      if (!ws.user) {
        send(ws, 'error', { message: 'Authentication required to edit' });
        return;
      }

      const focusKey = `${ws.currentBoardId}_${objectId}`;
      const existingFocus = activeFocuses.get(focusKey);

      if (existingFocus && existingFocus.userId !== ws.user.id) {
        send(ws, 'focus_error', {
          objectId,
          message: 'Object is being edited by another user',
          currentUser: existingFocus.userName
        });
        return;
      }

      activeFocuses.set(focusKey, {
        userId: ws.user.id,
        userName: ws.user.name
      });

      broadcastToBoard(ws.currentBoardId, 'object_focused', {
        objectId,
        userId: ws.user.id,
        userName: ws.user.name
      }, ws);

      send(ws, 'focus_success', { objectId });
    } catch (error) {
      console.error('Focus object error:', error);
      send(ws, 'error', { message: 'Failed to focus object' });
    }
        break;
      }
      case 'unfocus_object': {
        const { objectId, data: objectData } = data || {};
        if (!objectId) {
          send(ws, 'error', { message: 'objectId is required' });
          return;
        }

    try {
      if (!ws.currentBoardId) {
        return;
      }

      const focusKey = `${ws.currentBoardId}_${objectId}`;
      const focus = activeFocuses.get(focusKey);

      if (focus && ws.user && focus.userId === ws.user.id) {
      if (objectData) {
        const object = await db.get('SELECT type FROM board_objects WHERE id = ?', [objectId]);
        if (object) {
          const boundsErrors = validateObjectBounds(objectData, object.type);
          if (boundsErrors.length > 0) {
            send(ws, 'error', { message: 'Object out of canvas bounds', details: boundsErrors });
            return;
          }
        }

        await db.run(
          'UPDATE board_objects SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [JSON.stringify(objectData), objectId]
        );

          await db.run(
            'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [ws.currentBoardId]
          );
        }

        activeFocuses.delete(focusKey);

        broadcastToBoard(ws.currentBoardId, 'object_unfocused', {
          objectId,
          data: objectData ? JSON.parse(JSON.stringify(objectData)) : null
        }, ws);
      }
    } catch (error) {
      console.error('Unfocus object error:', error);
      send(ws, 'error', { message: 'Failed to unfocus object' });
    }
        break;
      }
      case 'create_object': {
        const { type, data: objectData } = data || {};
        if (!type || !objectData) {
          send(ws, 'error', { message: 'type and data are required' });
          return;
        }

    try {
      if (!ws.currentBoardId) {
        return;
      }

      if (!ws.user) {
        send(ws, 'error', { message: 'Authentication required' });
        return;
      }

      const validTypes = ['text', 'image', 'rectangle', 'circle', 'line'];
      if (!validTypes.includes(type)) {
        send(ws, 'error', { message: 'Invalid object type' });
        return;
      }

      const boundsErrors = validateObjectBounds(objectData, type);
      if (boundsErrors.length > 0) {
        send(ws, 'error', { message: 'Object out of canvas bounds', details: boundsErrors });
        return;
      }

      const result = await db.run(
        'INSERT INTO board_objects (board_id, type, data) VALUES (?, ?, ?)',
        [ws.currentBoardId, type, JSON.stringify(objectData)]
      );

      await db.run(
        'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ws.currentBoardId]
      );

      const newObject = {
        id: result.lastID,
        type,
        data: objectData
      };

      broadcastToBoard(ws.currentBoardId, 'object_created', newObject);
    } catch (error) {
      console.error('Create object error:', error);
      send(ws, 'error', { message: 'Failed to create object' });
    }
        break;
      }
      case 'delete_object': {
        const { objectId } = data || {};
        if (!objectId) {
          send(ws, 'error', { message: 'objectId is required' });
          return;
        }

    try {
      if (!ws.currentBoardId) {
        return;
      }

      if (!ws.user) {
        send(ws, 'error', { message: 'Authentication required' });
        return;
      }

      const object = await db.get('SELECT * FROM board_objects WHERE id = ?', [objectId]);
      if (!object || object.board_id !== ws.currentBoardId) {
        send(ws, 'error', { message: 'Object not found' });
        return;
      }

      await db.run('DELETE FROM board_objects WHERE id = ?', [objectId]);

      const focusKey = `${ws.currentBoardId}_${objectId}`;
      activeFocuses.delete(focusKey);

      await db.run(
        'UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ws.currentBoardId]
      );

      broadcastToBoard(ws.currentBoardId, 'object_deleted', { objectId });
    } catch (error) {
      console.error('Delete object error:', error);
      send(ws, 'error', { message: 'Failed to delete object' });
    }
        break;
      }
      default:
        send(ws, 'error', { message: `Unknown event: ${event}` });
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${ws.id}`);

    if (ws.currentBoardId) {
      if (boardRooms.has(ws.currentBoardId)) {
        const room = boardRooms.get(ws.currentBoardId);
        room.delete(ws);
        if (room.size === 0) {
          boardRooms.delete(ws.currentBoardId);
        }
      }

      if (ws.user) {
        for (const [key, focus] of activeFocuses.entries()) {
          if (focus.userId === ws.user.id && key.startsWith(`${ws.currentBoardId}_`)) {
            activeFocuses.delete(key);
            broadcastToBoard(ws.currentBoardId, 'object_unfocused', {
              objectId: parseInt(key.split('_')[1]),
              data: null
            }, ws);
          }
        }
      }

      broadcastToBoard(ws.currentBoardId, 'user_left', {
        userId: ws.user?.id,
        userName: ws.user?.name || 'Guest'
      }, ws);
    }
  });
});

let isShuttingDown = false;
process.on('SIGINT', async () => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log('\nShutting down gracefully...');
  try {
    await db.close();
  } catch (error) {
    console.error('Error closing database:', error.message);
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Forcing exit...');
    process.exit(1);
  }, 5000);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});
