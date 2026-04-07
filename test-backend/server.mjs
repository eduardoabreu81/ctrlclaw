#!/usr/bin/env node
/**
 * Mock NanoClaw Backend - Fase 6: Chat Funcional
 * 
 * Porta: 3001 (padrão)
 * 
 * Endpoints Auth:
 *   GET  /                    → Info page
 *   GET  /api/health          → Health check
 *   POST /api/auth/login      → Login
 *   GET  /api/auth/me         → Validate session
 *   GET  /api/agents          → List agents
 * 
 * Endpoints Chat (Fase 6):
 *   POST /api/conversations              → Criar conversa
 *   GET  /api/conversations              → Listar conversas
 *   GET  /api/conversations/:id/messages → Histórico
 *   POST /api/conversations/:id/messages → Enviar mensagem
 * 
 * WebSocket:
 *   /                       → WS endpoint
 *   Eventos: auth_required, auth_success, message, ping/pong
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';

const PORT = process.env.PORT || 3001;

// ============================================
// Estado em Memória (Fase 6 - Chat)
// ============================================
const db = {
  conversations: new Map(),
  messages: new Map(),
  clients: new Set() // WebSocket clients
};

// Helper: Gerar UUID simples
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper: Verificar auth
function getAuthUser(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    // Simplificado: qualquer token válido retorna admin
    return { username: 'admin', permissions: ['read', 'write', 'admin'] };
  }
  return null;
}

// ============================================
// CORS Configuration
// ============================================
const CORS_ORIGIN = '*';
const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, X-Requested-With, Accept, Origin';
const CORS_CREDENTIALS = 'true';
const CORS_MAX_AGE = '86400';

// ============================================
// HTTP Server
// ============================================
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
  res.setHeader('Access-Control-Allow-Credentials', CORS_CREDENTIALS);
  res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE);

  const parsedUrl = url.parse(req.url, true);
  console.log(`[HTTP] ${req.method} ${parsedUrl.pathname}`);

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Preflight request handled');
    res.writeHead(204);
    res.end();
    return;
  }

  // ============================================
  // Routes
  // ============================================

  // Root - Info page
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>CtrlClaw Test Backend - Fase 6</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1 { color: #2563eb; }
    h2 { color: #374151; margin-top: 30px; }
    .endpoint { background: #f3f4f6; padding: 12px; margin: 10px 0; border-radius: 6px; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    .status { color: #16a34a; font-weight: bold; }
    .new { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <h1>🚀 CtrlClaw Test Backend - Fase 6</h1>
  <p class="status">✅ Running on port ${PORT}</p>
  
  <h2>🔐 Auth Endpoints</h2>
  
  <div class="endpoint">
    <strong>POST <code>/api/auth/login</code></strong>
    <p>Login endpoint</p>
    <p>Body: <code>{"username": "admin", "password": "admin"}</code></p>
  </div>
  
  <div class="endpoint">
    <strong>GET <code>/api/auth/me</code></strong>
    <p>Validate session (requires Authorization header)</p>
  </div>
  
  <div class="endpoint">
    <strong>GET <code>/api/agents</code></strong>
    <p>List agents</p>
  </div>

  <h2>💬 Chat Endpoints <span class="new">NEW Fase 6</span></h2>
  
  <div class="endpoint">
    <strong>POST <code>/api/conversations</code></strong>
    <p>Create new conversation</p>
    <p>Body: <code>{"title": "Nova conversa", "agentId": "optional"}</code></p>
  </div>
  
  <div class="endpoint">
    <strong>GET <code>/api/conversations</code></strong>
    <p>List all conversations</p>
  </div>
  
  <div class="endpoint">
    <strong>GET <code>/api/conversations/:id/messages</code></strong>
    <p>Get conversation history</p>
  </div>
  
  <div class="endpoint">
    <strong>POST <code>/api/conversations/:id/messages</code></strong>
    <p>Send message</p>
    <p>Body: <code>{"content": "Olá!"}</code></p>
  </div>
  
  <h2>🔌 WebSocket</h2>
  <div class="endpoint">
    <strong>WS <code>/</code></strong>
    <p>WebSocket endpoint</p>
    <p>Events: <code>auth_required</code>, <code>auth_success</code>, <code>message</code>, <code>ping/pong</code></p>
  </div>

  <h2>⚙️ Configuration</h2>
  <ul>
    <li>CORS Origin: <code>${CORS_ORIGIN}</code></li>
    <li>Methods: <code>${CORS_METHODS}</code></li>
  </ul>
</body>
</html>
    `);
    return;
  }

  // Health Check
  if (parsedUrl.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'nanoclaw',
      status: 'healthy',
      version: '1.0.0-fase6',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Login
  if (parsedUrl.pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        
        if (username === 'admin' && password === 'admin') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            token: 'test-token-' + Date.now(),
            username: username,
            expiresIn: 86400,
            user: {
              username: username,
              permissions: ['read', 'write', 'admin']
            }
          }));
          console.log(`[AUTH] Login: ${username}`);
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Validate Session
  if (parsedUrl.pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (user) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(user));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    return;
  }

  // List Agents
  if (parsedUrl.pathname === '/api/agents' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([
      {
        id: 'agent-1',
        name: 'Claw Assistant',
        description: 'General purpose assistant',
        status: 'idle',
        capabilities: ['chat', 'help'],
        createdAt: new Date().toISOString()
      }
    ]));
    return;
  }

  // ============================================
  // FASE 6: CHAT ENDPOINTS
  // ============================================

  // POST /api/conversations - Criar conversa
  if (parsedUrl.pathname === '/api/conversations' && req.method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const conversation = {
          id: generateId(),
          title: data.title || 'Nova conversa',
          agentId: data.agentId || null,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          createdBy: user.username
        };
        
        db.conversations.set(conversation.id, conversation);
        db.messages.set(conversation.id, []);
        
        console.log(`[CHAT] Conversation created: ${conversation.id}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ conversation }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // GET /api/conversations - Listar conversas
  if (parsedUrl.pathname === '/api/conversations' && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const conversations = Array.from(db.conversations.values())
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ conversations }));
    return;
  }

  // GET /api/conversations/:id/messages - Histórico
  const messagesMatch = parsedUrl.pathname.match(/^\/api\/conversations\/([^\/]+)\/messages$/);
  if (messagesMatch && req.method === 'GET') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const conversationId = messagesMatch[1];
    const conversation = db.conversations.get(conversationId);
    
    if (!conversation) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Conversation not found' }));
      return;
    }

    const messages = db.messages.get(conversationId) || [];
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      messages,
      hasMore: false
    }));
    return;
  }

  // POST /api/conversations/:id/messages - Enviar mensagem
  const sendMessageMatch = parsedUrl.pathname.match(/^\/api\/conversations\/([^\/]+)\/messages$/);
  if (sendMessageMatch && req.method === 'POST') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const conversationId = sendMessageMatch[1];
    const conversation = db.conversations.get(conversationId);
    
    if (!conversation) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Conversation not found' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Criar mensagem do usuário
        const message = {
          id: generateId(),
          conversationId,
          sender: 'user',
          senderName: user.username,
          content: data.content,
          timestamp: new Date().toISOString(),
          status: 'sent',
          type: 'text'
        };
        
        // Salvar mensagem
        const messages = db.messages.get(conversationId) || [];
        messages.push(message);
        db.messages.set(conversationId, messages);
        
        // Atualizar lastActivity
        conversation.lastActivity = new Date().toISOString();
        
        console.log(`[CHAT] Message sent: ${message.id} in ${conversationId}`);
        
        // Responder imediatamente
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message, accepted: true }));
        
        // Simular resposta do agente via WebSocket (após delay)
        setTimeout(() => {
          const agentMessage = {
            id: generateId(),
            conversationId,
            sender: 'agent',
            senderName: conversation.agentId ? 'Agent' : 'Claw',
            content: `Recebi: "${data.content}"`,
            timestamp: new Date().toISOString(),
            status: 'delivered',
            type: 'text'
          };
          
          messages.push(agentMessage);
          db.messages.set(conversationId, messages);
          
          // Broadcast para todos os clients conectados
          db.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify({
                type: 'message',
                data: agentMessage
              }));
            }
          });
          
          console.log(`[CHAT] Agent response: ${agentMessage.id}`);
        }, 1000 + Math.random() * 1000); // 1-2s delay
        
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404 - Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    error: 'Not found',
    path: parsedUrl.pathname,
    method: req.method,
    available: [
      '/api/health',
      '/api/auth/login',
      '/api/auth/me',
      '/api/agents',
      '/api/conversations (GET, POST)',
      '/api/conversations/:id/messages (GET, POST)',
      '/ws'
    ]
  }));
});

// ============================================
// WebSocket Server
// ============================================
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('[WS] Client connected from', req.socket.remoteAddress);
  
  // Registrar client
  db.clients.add(ws);
  
  // Send auth_required immediately
  ws.send(JSON.stringify({ type: 'auth_required' }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log('[WS] Received:', msg.type);

      if (msg.type === 'authenticate') {
        if (msg.token) {
          ws.send(JSON.stringify({ type: 'auth_success' }));
          ws.send(JSON.stringify({ 
            type: 'connection_status', 
            data: { status: 'online', serverTime: Date.now() }
          }));
        } else {
          ws.send(JSON.stringify({ type: 'auth_failed', error: 'No token' }));
        }
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      
      // Fase 6: Mensagens de chat podem ser enviadas via WS também
      if (msg.type === 'message') {
        // Acknowledge receipt
        ws.send(JSON.stringify({
          type: 'message_ack',
          data: { received: true, timestamp: Date.now() }
        }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    db.clients.delete(ws);
  });
  
  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
    db.clients.delete(ws);
  });
});

// ============================================
// Start
// ============================================
server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Mock NanoClaw Backend - Fase 6: Chat            ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  HTTP:  http://localhost:${PORT}`);
  console.log(`║  WS:    ws://localhost:${PORT}`);
  console.log('║                                                   ║');
  console.log('║  Auth:                                            ║');
  console.log('║    POST /api/auth/login                           ║');
  console.log('║    GET  /api/auth/me                              ║');
  console.log('║    GET  /api/agents                               ║');
  console.log('║                                                   ║');
  console.log('║  Chat (NEW Fase 6):                               ║');
  console.log('║    POST /api/conversations              (create)  ║');
  console.log('║    GET  /api/conversations              (list)    ║');
  console.log('║    GET  /api/conversations/:id/messages (history) ║');
  console.log('║    POST /api/conversations/:id/messages (send)    ║');
  console.log('║                                                   ║');
  console.log('║  WebSocket Events: auth, message, ping/pong       ║');
  console.log('╚═══════════════════════════════════════════════════╝');
});
