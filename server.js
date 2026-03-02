const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const dataPath = path.join(__dirname, 'data', 'store.json');

if (!fs.existsSync(path.dirname(dataPath))) fs.mkdirSync(path.dirname(dataPath), { recursive: true });
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify({ users: [], projects: [], files: [], activities: [] }, null, 2));
}

const sessions = new Map();

function loadStore() {
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
function saveStore(store) {
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
}
function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}
function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((cookie) => {
    const [k, ...v] = cookie.trim().split('=');
    if (!k) return;
    cookies[k] = decodeURIComponent(v.join('='));
  });
  return cookies;
}
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}
function id() {
  return crypto.randomBytes(8).toString('hex');
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, saved) {
  const [salt, hash] = saved.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verify;
}
function activity(store, userId, action, details = '') {
  store.activities.unshift({ id: id(), userId, action, details, createdAt: new Date().toISOString() });
}
function getUser(req, store) {
  const token = parseCookies(req).session;
  const userId = sessions.get(token);
  return store.users.find((u) => u.id === userId) || null;
}

async function handleApi(req, res) {
  const store = loadStore();
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const { username, password, language = 'en' } = await parseBody(req);
    if (!username || !password || password.length < 6) return json(res, 400, { error: 'Invalid credentials' });
    if (store.users.some((u) => u.username === username)) return json(res, 409, { error: 'Username already exists' });
    const user = { id: id(), username, passwordHash: hashPassword(password), preferred_language: language === 'ar' ? 'ar' : 'en', createdAt: new Date().toISOString() };
    store.users.push(user);
    activity(store, user.id, 'Account created', username);
    saveStore(store);
    return json(res, 201, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const { username, password } = await parseBody(req);
    const user = store.users.find((u) => u.username === username);
    if (!user || !verifyPassword(password || '', user.passwordHash)) return json(res, 401, { error: 'Invalid username or password' });
    const token = id() + id();
    sessions.set(token, user.id);
    activity(store, user.id, 'Logged in', username);
    saveStore(store);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax` });
    return res.end(JSON.stringify({ id: user.id, username: user.username, preferred_language: user.preferred_language }));
  }

  const user = getUser(req, store);
  if (!user) return json(res, 401, { error: 'Unauthorized' });

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = parseCookies(req).session;
    sessions.delete(token);
    activity(store, user.id, 'Logged out', user.username);
    saveStore(store);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    return json(res, 200, { id: user.id, username: user.username, preferred_language: user.preferred_language, createdAt: user.createdAt });
  }

  if (req.method === 'PUT' && url.pathname === '/api/me/language') {
    const { language } = await parseBody(req);
    user.preferred_language = language === 'ar' ? 'ar' : 'en';
    activity(store, user.id, 'Changed language', user.preferred_language);
    saveStore(store);
    return json(res, 200, { ok: true, preferred_language: user.preferred_language });
  }

  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const projects = store.projects.filter((p) => p.userId === user.id);
    const files = store.files.filter((f) => projects.some((p) => p.id === f.projectId));
    const ready = projects.filter((p) => p.status === 'ready').length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const recentActivity = store.activities.filter((a) => a.userId === user.id).slice(0, 8);
    return json(res, 200, { stats: { projects: projects.length, ready, inProgress, files: files.length }, latestProjects: projects.slice(-5).reverse(), recentActivity });
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    return json(res, 200, store.projects.filter((p) => p.userId === user.id).reverse());
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    const { name, category, status, description = '' } = await parseBody(req);
    if (!name || !category || !status) return json(res, 400, { error: 'Missing fields' });
    const project = { id: id(), userId: user.id, name, category, status, description, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.projects.push(project);
    activity(store, user.id, 'Created project', name);
    saveStore(store);
    return json(res, 201, { id: project.id });
  }

  const projectFilesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/files$/);
  if (projectFilesMatch && req.method === 'GET') {
    const projectId = projectFilesMatch[1];
    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id);
    if (!project) return json(res, 404, { error: 'Project not found' });
    return json(res, 200, store.files.filter((f) => f.projectId === projectId).map((f) => ({ id: f.id, name: f.name, type: f.type, updatedAt: f.updatedAt })));
  }

  if (projectFilesMatch && req.method === 'POST') {
    const projectId = projectFilesMatch[1];
    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id);
    if (!project) return json(res, 404, { error: 'Project not found' });
    const { name, type = 'txt', content = '' } = await parseBody(req);
    if (!name) return json(res, 400, { error: 'File name required' });
    const file = { id: id(), projectId, name, type, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.files.push(file);
    project.updatedAt = new Date().toISOString();
    activity(store, user.id, 'Added file', `${project.name}/${name}`);
    saveStore(store);
    return json(res, 201, { id: file.id });
  }

  const fileReadMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/files\/([^/]+)$/);
  if (fileReadMatch && req.method === 'GET') {
    const [_, projectId, fileId] = fileReadMatch;
    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id);
    if (!project) return json(res, 404, { error: 'Project not found' });
    const file = store.files.find((f) => f.id === fileId && f.projectId === projectId);
    if (!file) return json(res, 404, { error: 'File not found' });
    activity(store, user.id, 'Viewed file', `${project.name}/${file.name}`);
    saveStore(store);
    return json(res, 200, file);
  }

  return json(res, 404, { error: 'Not found' });
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(publicDir, reqPath);
  if (!fullPath.startsWith(publicDir) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    const fallback = path.join(publicDir, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(fallback));
  }

  const ext = path.extname(fullPath);
  const map = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  res.writeHead(200, { 'Content-Type': `${map[ext] || 'text/plain'}; charset=utf-8` });
  res.end(fs.readFileSync(fullPath));
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res).catch(() => json(res, 500, { error: 'Server error' }));
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Control panel running on http://localhost:${PORT}`);
});
