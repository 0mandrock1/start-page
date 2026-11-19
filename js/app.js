(() => {
  'use strict';

  const PI = '31415926535897932384626433832795';
  const piDigit = (i) => +PI[i % PI.length];
  const $ = (id) => document.getElementById(id);

  // ---------- сховище: chrome.storage.local, запасний варіант — localStorage ----------
  const store = {
    async get(key, fallback) {
      try {
        if (globalThis.chrome && chrome.storage && chrome.storage.local) {
          const r = await chrome.storage.local.get(key);
          return r[key] === undefined ? fallback : r[key];
        }
      } catch {}
      try {
        const v = localStorage.getItem('sp:' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    async set(key, value) {
      try {
        if (globalThis.chrome && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ [key]: value });
          return;
        }
      } catch {}
      try { localStorage.setItem('sp:' + key, JSON.stringify(value)); } catch {}
    }
  };

  // ---------- годинник ----------
  const pad = (n) => String(n).padStart(2, '0');
  function greeting(h) {
    if (h < 5) return '// доброї ночі';
    if (h < 12) return '// доброго ранку';
    if (h < 18) return '// доброго дня';
    return '// доброго вечора';
  }
  // П'ять окремих ефектів: один випадковий на відкриття вкладки.
  const CLOCK_GLITCHES = ['shear', 'prism', 'scan', 'phase', 'static'];
  const clockGlitchIndex = (() => {
    try {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return bytes[0] % CLOCK_GLITCHES.length;
    } catch {
      return Math.floor(Math.random() * CLOCK_GLITCHES.length);
    }
  })();
  const clockGlitch = CLOCK_GLITCHES[clockGlitchIndex];
  $('hm').dataset.clockGlitch = clockGlitch;
  console.debug('[start-page] clock glitch selected', { glitch: clockGlitch });

  function tick() {
    const d = new Date();
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const el = $('hm');
    if (el.textContent !== hm) {
      el.textContent = hm;
      el.dataset.t = hm; // копії не відстають після зміни хвилини
    }
    $('sec').textContent = ':' + pad(d.getSeconds());
    $('greet').textContent = greeting(d.getHours());
    $('dateWeekday').textContent = d.toLocaleDateString('uk-UA', { weekday: 'long' });
    $('dateFull').textContent = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    $('date').setAttribute('aria-label', d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }
  tick();
  setInterval(tick, 1000);

  // ---------- debris: шкала з цифр π ----------
  const ruler = $('ruler');
  for (let i = 0; i < 48; i++) {
    const tickEl = document.createElement('i');
    tickEl.style.width = (3 + piDigit(i) * 1.3) + 'px';
    ruler.appendChild(tickEl);
  }

  // ---------- поля вводу ----------
  const URL_LIKE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;
  document.querySelectorAll('form.row').forEach((form, i) => {
    form.style.setProperty('--n', piDigit(i));
    const input = form.querySelector('input');
    const encodeQuery = (q) => form.dataset.path ? encodeURIComponent(q).replace(/%2F/gi, '/') : encodeURIComponent(q);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      let url;
      if (form.dataset.smart === 'url' && URL_LIKE.test(q)) {
        url = /^https?:\/\//i.test(q) ? q : 'https://' + q;
      } else {
        url = form.dataset.url.replace('%s', encodeQuery(q));
      }
      location.assign(url);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const url = form.dataset.smart === 'url' && URL_LIKE.test(q)
          ? (/^https?:\/\//i.test(q) ? q : 'https://' + q)
          : form.dataset.url.replace('%s', encodeQuery(q));
        window.open(url, '_blank', 'noopener');
      }
    });
  });

  // ---------- лінки ----------
  const DEFAULT_LINKS = [
    { n: 'Google Translate', u: 'https://translate.google.com/' },
    { n: 'xHamster', u: 'https://xhamster.com/' },
    { n: 'Gmail', u: 'https://mail.google.com/' },
    { n: 'Proton Mail', u: 'https://mail.proton.me/' },
    { n: 'tools.mandrock.me', u: 'https://tools.mandrock.me/' },
    { n: 'articles.mandrock.me', u: 'https://articles.mandrock.me/' }
  ];
  let links = DEFAULT_LINKS.slice();
  let editing = false;
  const tiles = $('tiles');
  let draggedLink = null;

  function moveLink(from, to) {
    if (from === to || from < 0 || to < 0 || from >= links.length || to >= links.length) return;
    const [link] = links.splice(from, 1);
    links.splice(to, 0, link);
    store.set('links', links);
    renderLinks();
    $('linksStatus').textContent = link.n + ': ' + (to + 1) + ' / ' + links.length;
  }

  // favicon: локальний кеш браузера (_favicon), запасний варіант — літера
  function favicon(l) {
    const letter = () => {
      const s = document.createElement('span');
      s.className = 'fav fb'; s.setAttribute('aria-hidden', 'true');
      s.textContent = (l.n || '?').trim().charAt(0);
      return s;
    };
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.getURL)) return letter();
    const img = document.createElement('img');
    img.className = 'fav'; img.alt = ''; img.width = 20; img.height = 20;
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', l.u);
    u.searchParams.set('size', '32');
    img.src = u.toString();
    img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
    return img;
  }

  function renderLinks() {
    tiles.textContent = '';
    links.forEach((l, i) => {
      const li = document.createElement('li');
      li.className = 'tile';
      li.style.setProperty('--n', piDigit(i + 7));
      const a = document.createElement('a');
      a.href = l.u;
      const left = document.createElement('span');
      left.style.cssText = 'display:flex;align-items:center;min-width:0';
      left.appendChild(favicon(l));
      const name = document.createElement('span');
      name.className = 'nm';
      name.textContent = l.n;
      left.appendChild(name);
      a.appendChild(left);
      if (i < 9) {
        const k = document.createElement('span');
        k.className = 'k'; k.setAttribute('aria-hidden', 'true');
        k.textContent = '[' + (i + 1) + ']';
        a.appendChild(k);
      }
      li.appendChild(a);
      if (editing) {
        li.draggable = true;
        a.draggable = false;
        li.addEventListener('dragstart', (e) => {
          draggedLink = i;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
          li.classList.add('dragging');
        });
        li.addEventListener('dragover', (e) => {
          if (draggedLink === null || draggedLink === i) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.classList.add('drop-target');
        });
        li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
        li.addEventListener('drop', (e) => {
          if (draggedLink === null) return;
          e.preventDefault();
          const from = draggedLink;
          draggedLink = null;
          moveLink(from, i);
        });
        li.addEventListener('dragend', () => {
          draggedLink = null;
          tiles.querySelectorAll('.dragging, .drop-target').forEach((el) => el.classList.remove('dragging', 'drop-target'));
        });
        const controls = document.createElement('div');
        controls.className = 'tile-move';
        [[-1, '←', 'Перемістити ліворуч '], [1, '→', 'Перемістити праворуч ']].forEach(([step, symbol, label]) => {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = symbol;
          button.setAttribute('aria-label', label + l.n);
          button.disabled = i + step < 0 || i + step >= links.length;
          button.addEventListener('click', () => {
            const target = i + step;
            moveLink(i, target);
            const moved = tiles.children[target];
            const next = moved.querySelectorAll('.tile-move button')[step < 0 ? 0 : 1];
            (next.disabled ? moved.querySelector('a') : next).focus();
          });
          controls.appendChild(button);
        });
        li.appendChild(controls);
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'x';
        x.setAttribute('aria-label', 'Видалити лінк ' + l.n);
        x.textContent = '×';
        x.addEventListener('click', () => { links.splice(i, 1); store.set('links', links); renderLinks(); });
        li.appendChild(x);
      }
      tiles.appendChild(li);
    });
  }

  $('editLinks').addEventListener('click', (e) => {
    editing = !editing;
    e.currentTarget.setAttribute('aria-pressed', String(editing));
    e.currentTarget.textContent = editing ? 'готово' : 'змінити';
    $('addLink').hidden = !editing;
    renderLinks();
  });
  $('addLink').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('nl-name').value.trim();
    let u = $('nl-url').value.trim();
    if (!n || !u) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try { new URL(u); } catch { return; }
    if (!/^https?:/i.test(u)) return;
    links.push({ n, u });
    store.set('links', links);
    $('nl-name').value = ''; $('nl-url').value = '';
    renderLinks();
  });

  // ---------- часто відвідувані ----------
  try {
    if (globalThis.chrome && chrome.topSites) {
      chrome.topSites.get((sites) => {
        const list = (sites || []).slice(0, 8);
        if (!list.length) return;
        const ul = $('top');
        list.forEach((s) => {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = s.url;
          let host = s.title || s.url;
          try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
          a.textContent = host;
          li.appendChild(a);
          ul.appendChild(li);
        });
        ul.hidden = false;
      });
    }
  } catch {}

  // ---------- задачі ----------
  let tasks = [];
  const tasksEl = $('tasks');
  function renderTasks() {
    tasksEl.textContent = '';
    tasks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'task' + (t.done ? ' done' : '');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 't';
      b.setAttribute('aria-pressed', String(!!t.done));
      b.textContent = t.text;
      b.addEventListener('click', () => { t.done = !t.done; store.set('tasks', tasks); renderTasks(); });
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'd';
      d.setAttribute('aria-label', 'Видалити задачу ' + t.text);
      d.textContent = '×';
      d.addEventListener('click', () => { tasks.splice(i, 1); store.set('tasks', tasks); renderTasks(); });
      li.append(b, d);
      tasksEl.appendChild(li);
    });
    $('tasksEmpty').hidden = tasks.length > 0;
    $('tasksCount').textContent = tasks.length ? 'активні: ' + tasks.filter((t) => !t.done).length : '';
    $('clearDone').hidden = !tasks.some((t) => t.done);
  }
  $('clearDone').addEventListener('click', () => {
    tasks = tasks.filter((t) => !t.done);
    store.set('tasks', tasks);
    renderTasks();
    $('task-in').focus();
  });
  $('addTask').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('task-in').value.trim();
    if (!v) return;
    tasks.unshift({ text: v, done: false });
    $('task-in').value = '';
    store.set('tasks', tasks);
    renderTasks();
  });

  // ---------- нотатка ----------
  const note = $('note');
  let noteTimer = 0;
  function updateNoteCount() { $('noteCount').textContent = Array.from(note.value).length + ' символів'; }
  note.addEventListener('input', () => {
    updateNoteCount();
    clearTimeout(noteTimer);
    $('saved').textContent = '…';
    noteTimer = setTimeout(async () => {
      await store.set('note', note.value);
      $('saved').textContent = 'збережено';
    }, 400);
  });

  // ---------- акцент ----------
  const ACCENTS = ['crimson', 'purple', 'cyan', 'lime'];
  function setAccent(name) {
    document.documentElement.dataset.accent = name;
    $('accentName').textContent = name;
  }
  const accentButton = $('accent');
  accentButton.addEventListener('click', () => {
    const cur = document.documentElement.dataset.accent;
    const next = ACCENTS[(ACCENTS.indexOf(cur) + 1) % ACCENTS.length];
    setAccent(next);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      accentButton.classList.remove('accent-switch');
      void accentButton.offsetWidth; // повторний клік перезапускає короткий глітч
      accentButton.classList.add('accent-switch');
    }
    store.set('accent', next);
    console.debug('[start-page] accent changed', { from: cur, to: next });
  });
  accentButton.addEventListener('animationend', (e) => {
    if (e.animationName === 'accent-shear') accentButton.classList.remove('accent-switch');
  });

  // ---------- гарячі клавіші ----------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (e.key === 'Escape') t.blur();
      return;
    }
    const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    if (key === 'a') { e.preventDefault(); (tasksEl.querySelector('.task .t') || $('task-in')).focus(); return; }
    if (key === 'n') { e.preventDefault(); note.focus(); return; }
    const form = /^[a-z]$/.test(key) ? document.querySelector('form.row[data-key="' + key + '"]') : null;
    if (form) { e.preventDefault(); form.querySelector('input').focus(); return; }
    if (/^[1-9]$/.test(key)) {
      const a = tiles.querySelectorAll('a')[+key - 1];
      if (a) a.click();
    }
  });

  // ---------- старт ----------
  (async () => {
    const [l, t, n, a] = await Promise.all([
      store.get('links', DEFAULT_LINKS),
      store.get('tasks', []),
      store.get('note', ''),
      store.get('accent', 'crimson')
    ]);
    links = Array.isArray(l) ? l : DEFAULT_LINKS.slice();
    tasks = Array.isArray(t) ? t : [];
    note.value = typeof n === 'string' ? n : '';
    updateNoteCount();
    setAccent(ACCENTS.includes(a) ? a : 'crimson');
    renderLinks();
    renderTasks();
  })();
})();
