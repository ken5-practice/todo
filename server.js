const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TODOS_FILE = path.join(__dirname, 'todos.json');

function readTodos() {
  try {
    const data = fs.readFileSync(TODOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeTodos(todos) {
  fs.writeFileSync(TODOS_FILE, JSON.stringify(todos, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // API routes
  if (url === '/api/todos' && method === 'GET') {
    const todos = readTodos();
    sendJSON(res, 200, todos);
    return;
  }

  if (url === '/api/todos' && method === 'POST') {
    const body = await parseBody(req);
    if (!body.text || !body.text.trim()) {
      sendJSON(res, 400, { error: 'text is required' });
      return;
    }
    const todos = readTodos();
    const todo = {
      id: Date.now().toString(),
      text: body.text.trim(),
      completed: false,
    };
    todos.push(todo);
    writeTodos(todos);
    sendJSON(res, 201, todo);
    return;
  }

  const patchMatch = url.match(/^\/api\/todos\/(.+)$/);

  if (patchMatch && method === 'PATCH') {
    const id = patchMatch[1];
    const body = await parseBody(req);
    const todos = readTodos();
    const index = todos.findIndex(t => t.id === id);
    if (index === -1) {
      sendJSON(res, 404, { error: 'todo not found' });
      return;
    }
    if (body.text !== undefined) todos[index].text = body.text;
    if (body.completed !== undefined) todos[index].completed = body.completed;
    writeTodos(todos);
    sendJSON(res, 200, todos[index]);
    return;
  }

  if (patchMatch && method === 'DELETE') {
    const id = patchMatch[1];
    const todos = readTodos();
    const index = todos.findIndex(t => t.id === id);
    if (index === -1) {
      sendJSON(res, 404, { error: 'todo not found' });
      return;
    }
    const deleted = todos.splice(index, 1)[0];
    writeTodos(todos);
    sendJSON(res, 200, deleted);
    return;
  }

  // Static files
  if (method === 'GET' && !url.startsWith('/api/')) {
    serveStatic(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
