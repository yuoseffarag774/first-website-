const t = {
  en: {
    title: 'Developer Control Panel',
    dashboard: 'Dashboard',
    bots: 'Discord Bots',
    websites: 'Websites',
    unity: 'Unity',
    templates: 'Templates',
    settings: 'Settings',
    logout: 'Logout',
    projects: 'Projects',
    ready: 'Ready',
    inProgress: 'In Progress',
    files: 'Files',
    latest: 'Latest Projects',
    activity: 'Recent Activity',
    quick: 'Quick Actions',
    addProject: 'Add Project',
    addFile: 'Upload File',
    fromTemplate: 'Create from Template',
    reviewMode: 'Review Mode',
    login: 'Login',
    register: 'Register',
    username: 'Username',
    password: 'Password',
    category: 'Category',
    status: 'Status',
    description: 'Description',
    name: 'Name',
    save: 'Save',
    fileName: 'File name',
    fileContent: 'File content',
  },
  ar: {
    title: 'لوحة تحكم المطور',
    dashboard: 'الرئيسية',
    bots: 'بوتات ديسكورد',
    websites: 'المواقع',
    unity: 'يونتي',
    templates: 'القوالب',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    projects: 'المشاريع',
    ready: 'جاهز',
    inProgress: 'قيد التطوير',
    files: 'الملفات',
    latest: 'آخر المشاريع',
    activity: 'نشاطك الأخير',
    quick: 'أزرار سريعة',
    addProject: 'إضافة مشروع',
    addFile: 'رفع ملف',
    fromTemplate: 'إنشاء من قالب',
    reviewMode: 'وضع الاستعراض',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    category: 'التصنيف',
    status: 'الحالة',
    description: 'الوصف',
    name: 'الاسم',
    save: 'حفظ',
    fileName: 'اسم الملف',
    fileContent: 'محتوى الملف',
  },
};

const state = { lang: 'en', me: null, dashboard: null, projects: [], selectedProject: null, files: [], selectedFile: null };
const app = document.getElementById('app');

const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const tr = (k) => t[state.lang][k] || k;

function setLang(lang) {
  state.lang = lang === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
}

async function boot() {
  try {
    const me = await api('/api/me');
    state.me = me;
    setLang(me.preferred_language);
    await loadDashboard();
    await loadProjects();
    renderMain();
  } catch {
    renderAuth();
  }
}

async function loadDashboard() {
  state.dashboard = await api('/api/dashboard');
}

async function loadProjects() {
  state.projects = await api('/api/projects');
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth">
      <div class="glass auth-card">
        <h2>${tr('title')}</h2>
        <div class="form">
          <input id="username" class="input" placeholder="${tr('username')}" />
          <input id="password" type="password" class="input" placeholder="${tr('password')}" />
          <select id="lang" class="select"><option value="en">English</option><option value="ar">العربية</option></select>
          <button id="login" class="btn">${tr('login')}</button>
          <button id="register" class="btn ghost">${tr('register')}</button>
        </div>
      </div>
    </div>`;

  document.getElementById('lang').value = state.lang;
  document.getElementById('lang').onchange = (e) => { setLang(e.target.value); renderAuth(); };

  const readCreds = () => ({
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value.trim(),
  });

  document.getElementById('register').onclick = async () => {
    const creds = readCreds();
    if (!creds.username || !creds.password) return;
    await api('/api/auth/register', 'POST', { ...creds, language: state.lang });
    alert('Account created. You can login now.');
  };

  document.getElementById('login').onclick = async () => {
    const creds = readCreds();
    if (!creds.username || !creds.password) return;
    await api('/api/auth/login', 'POST', creds);
    await boot();
  };
}

function navItems() {
  return [tr('dashboard'), tr('bots'), tr('websites'), tr('unity'), tr('templates'), tr('settings')];
}

function renderMain() {
  const stats = state.dashboard.stats;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">🔮 ${tr('title')}</div>
        ${navItems().map((n, i) => `<button class="nav-btn ${i === 0 ? 'active' : ''}">${n}</button>`).join('')}
        <button id="logout" class="nav-btn">${tr('logout')}</button>
      </aside>
      <main class="content">
        <div class="topbar">
          <h2>${tr('dashboard')}</h2>
          <div class="top-actions">
            <select id="switch-lang" class="select"><option value="en">EN</option><option value="ar">AR</option></select>
            <div class="glass card">${state.me.username}</div>
          </div>
        </div>

        <section class="grid-4">
          <div class="glass card"><div class="muted">${tr('projects')}</div><h3>${stats.projects}</h3></div>
          <div class="glass card"><div class="muted">${tr('ready')}</div><h3>${stats.ready}</h3></div>
          <div class="glass card"><div class="muted">${tr('inProgress')}</div><h3>${stats.inProgress}</h3></div>
          <div class="glass card"><div class="muted">${tr('files')}</div><h3>${stats.files}</h3></div>
        </section>

        <section class="glass section">
          <h3>${tr('quick')}</h3>
          <div class="top-actions">
            <button id="quick-project" class="btn">${tr('addProject')}</button>
            <button id="quick-file" class="btn ghost">${tr('addFile')}</button>
            <button class="btn ghost">${tr('fromTemplate')}</button>
          </div>
        </section>

        <section class="grid-4" style="grid-template-columns: 1fr 1fr; margin-top: 12px;">
          <div class="glass section">
            <h3>${tr('latest')}</h3>
            <div class="list">${state.dashboard.latestProjects.map(p => `<div class="item"><strong>${p.name}</strong><div class="muted">${p.category} • ${p.status}</div></div>`).join('') || '<div class="muted">No projects yet.</div>'}</div>
          </div>
          <div class="glass section">
            <h3>${tr('activity')}</h3>
            <div class="list">${state.dashboard.recentActivity.map(a => `<div class="item"><strong>${a.action}</strong><div class="muted">${a.details}</div></div>`).join('') || '<div class="muted">No activity yet.</div>'}</div>
          </div>
        </section>

        <section class="glass section">
          <h3>${tr('reviewMode')}</h3>
          <div class="top-actions">
            <select id="project-select" class="select">
              <option value="">${tr('projects')}</option>
              ${state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="project-layout">
            <div class="glass card file-tree" id="file-tree"><div class="muted">${tr('files')}</div></div>
            <div class="glass card"><pre id="file-content" class="pre">// ${tr('fileContent')}</pre></div>
          </div>
        </section>
      </main>
    </div>`;

  document.getElementById('switch-lang').value = state.lang;
  document.getElementById('switch-lang').onchange = async (e) => {
    setLang(e.target.value);
    await api('/api/me/language', 'PUT', { language: state.lang });
    await loadDashboard();
    renderMain();
  };

  document.getElementById('logout').onclick = async () => {
    await api('/api/auth/logout', 'POST');
    state.me = null;
    renderAuth();
  };

  document.getElementById('quick-project').onclick = async () => {
    const name = prompt(tr('name'));
    if (!name) return;
    const category = prompt(tr('category'), 'Websites') || 'Websites';
    const status = prompt(`${tr('status')} (ready/in_progress)`, 'in_progress') || 'in_progress';
    const description = prompt(tr('description'), '') || '';
    await api('/api/projects', 'POST', { name, category, status, description });
    await loadDashboard();
    await loadProjects();
    renderMain();
  };

  document.getElementById('quick-file').onclick = async () => {
    const projectId = Number(prompt('Project ID'));
    if (!projectId) return;
    const name = prompt(tr('fileName'));
    if (!name) return;
    const content = prompt(tr('fileContent'), '') || '';
    await api(`/api/projects/${projectId}/files`, 'POST', { name, type: 'txt', content });
    await loadDashboard();
    renderMain();
  };

  document.getElementById('project-select').onchange = async (e) => {
    const id = Number(e.target.value);
    if (!id) return;
    state.selectedProject = id;
    state.files = await api(`/api/projects/${id}/files`);
    renderFiles();
  };
}

function renderFiles() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = state.files.map(f => `<button class="file-btn" data-id="${f.id}">📄 ${f.name}</button>`).join('') || `<div class="muted">${tr('files')}</div>`;

  tree.querySelectorAll('button').forEach((el) => {
    el.onclick = async () => {
      const file = await api(`/api/projects/${state.selectedProject}/files/${el.dataset.id}`);
      state.selectedFile = file;
      document.getElementById('file-content').textContent = file.content;
    };
  });
}

boot();
