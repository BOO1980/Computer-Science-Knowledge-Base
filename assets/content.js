(function () {
  'use strict';

  const STORAGE_KEY = 'ou_progress_v1';

  // ----- Storage helpers -----
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function getMode() {
    const s = loadState();
    return s.__mode || 'light';
  }
  function setMode(mode) {
    const s = loadState();
    s.__mode = mode === 'dark' ? 'dark' : 'light';
    saveState(s);
  }

  // ----- Per-page keys & flags -----
  function pageKey() {
    // pathname is already origin-less; include search to distinguish filtered pages if needed
    return location.pathname + location.search;
  }
  function markVisited(state, key) {
    const now = new Date().toISOString();
    state[key] ||= {};
    state[key].lastOpened = now;
    saveState(state);
  }
  function setFlag(state, key, field, value) {
    state[key] ||= {};
    state[key][field] = !!value;
    saveState(state);
  }
  function getFlag(state, key, field) {
    return !!(state[key] && state[key][field]);
  }

  // ----- Page metadata -----
  function courseFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('content');
    return (i >= 0 && i + 1 < parts.length) ? parts[i + 1] : 'General';
  }
  function filenameFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }
  function titleFromDoc() {
    if (document.title && document.title.trim()) return document.title;
    const h = document.querySelector('h1,h2');
    return h ? h.textContent.trim() : filenameFromPath();
  }

  // ----- Stylesheet injection -----
  function ensureStyles() {
    if (document.querySelector('link[data-ou-styles]')) return;

    // Normalize slashes (defensive)
    const path = location.pathname.replace(/\/+/g, '/');
    const marker = '/content/';
    let prefix = '';
    const idx = path.indexOf(marker);
    if (idx !== -1) {
      const after = path.slice(idx + marker.length);
      const depth = (after.match(/\//g) || []).length;
      // one more level to hop out of the course folder back to site root
      prefix = '../'.repeat(depth + 1);
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = prefix + 'assets/styles.css';
    link.setAttribute('data-ou-styles', '');
    document.head.appendChild(link);
  }

  // ----- Theme / mode -----
  function applyMode(mode) {
    const m = mode || getMode();
    document.documentElement.setAttribute('data-mode', m);
    const btn = document.querySelector('[data-ou-mode-toggle]');
    if (btn) btn.textContent = (m === 'dark') ? '🌙 Dark' : '☀️ Light';
  }
  function toggleMode() {
    const next = getMode() === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyMode(next);
  }

  // ----- Toolbar -----
  function injectToolbar() {
    ensureStyles();

    const state = loadState();
    const key = pageKey();
    markVisited(state, key);

    const bar = document.createElement('div');
    bar.style.position = 'sticky';
    bar.style.top = '0';
    bar.style.zIndex = '9999';
    bar.style.backdropFilter = 'blur(8px)';
    bar.style.borderBottom = '1px solid #1a254a';
    bar.style.background = 'color-mix(in srgb, var(--bg) 75%, transparent)';

    const rootPrefix = (location.pathname.includes('/content/') ? '../../' : '');

    bar.innerHTML = `
      <div class="container" style="display:flex; align-items:center; gap:12px; padding:12px 24px; flex-wrap: wrap;">
        <a class="btn" href="${rootPrefix}index.html">Home</a>
        <a class="btn" href="${rootPrefix}contents.html">Contents</a>
        <a class="btn" href="${rootPrefix}navigation.html">Search</a>
        <span class="badge">Course: ${courseFromPath()}</span>
        <span class="badge">Page: ${titleFromDoc()}</span>
        <label class="btn" style="cursor:pointer; display:flex; align-items:center;">
          <input id="ou_completed" type="checkbox" style="accent-color: currentColor; margin-right:8px;"/> Completed
        </label>
        <label class="btn" style="cursor:pointer; display:flex; align-items:center;">
          <input id="ou_review" type="checkbox" style="accent-color: currentColor; margin-right:8px;"/> Review
        </label>
        <button type="button" class="btn" data-ou-mode-toggle>☀️ Light</button>
      </div>
    `;
    document.body.insertBefore(bar, document.body.firstChild);

    const completed = document.getElementById('ou_completed');
    const review = document.getElementById('ou_review');

    completed.checked = getFlag(state, key, 'completed');
    review.checked = getFlag(state, key, 'review');

    completed.addEventListener('change', () => {
      const s = loadState();
      setFlag(s, key, 'completed', completed.checked);
    });
    review.addEventListener('change', () => {
      const s = loadState();
      setFlag(s, key, 'review', review.checked);
    });

    const modeBtn = bar.querySelector('[data-ou-mode-toggle]');
    modeBtn.addEventListener('click', toggleMode);

    // Breadcrumbs under the toolbar
    const crumbs = document.createElement('div');
    crumbs.className = 'container';
    crumbs.style.padding = '8px 24px';

    const parts = location.pathname.split('/').filter(Boolean);
    let accum = '';
    const links = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accum += '/' + part;
      if (part === 'content') continue;
      const text = part === 'index.html' ? 'Index' : part;
      const href = accum;
      links.push(`<a href="${href}">${text}</a>`);
    }
    crumbs.innerHTML = `<div class="kicker">${links.join(' / ')}</div>`;
    document.body.insertBefore(crumbs, bar.nextSibling);

    // Apply initial mode text
    applyMode();
  }

  // Apply course theme & boot
  document.documentElement.setAttribute('data-theme', courseFromPath());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToolbar, { once: true });
  } else {
    injectToolbar();
  }
})();


// ---------- Module Topics Auto-Fill (helpers) ----------
async function OU_loadModuleManifest(moduleCode) {
  if (window.OU_MODULE_MANIFESTS && window.OU_MODULE_MANIFESTS[moduleCode]) {
    return window.OU_MODULE_MANIFESTS[moduleCode];
  }
  if (location.protocol.startsWith('http')) {
    try {
      const res = await fetch(`manifest.json`, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.module && json.topics) return json;
      }
    } catch (_) {}
  }
  return { module: moduleCode, topics: [] };
}
function OU_renderTopics(manifest, mountId = 'topics') {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const list = document.createElement('ul');
  list.className = 'list';
  (manifest.topics || []).forEach(t => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = t.href;
    a.textContent = t.title || t.href;
    li.appendChild(a);
    list.appendChild(li);
  });
  mount.innerHTML = '';
  mount.appendChild(list);
}
async function OU_fillModuleTopicsFromPath() {
  const parts = location.pathname.replace(/\\/g,'/').split('/').filter(Boolean);
  const i = parts.indexOf('content');
  const moduleCode = (i >= 0 && parts[i+1]) ? parts[i+1] : null;
  if (!moduleCode) return;
  const manifest = await OU_loadModuleManifest(moduleCode);
  OU_renderTopics(manifest, 'topics');
}

/* ========= Progress tracker (per-module) ========= */

(function () {
  const LS_PREFIX = "OU_PROGRESS::";

  function getModuleCodeFromPath() {
    const parts = location.pathname.replace(/\\/g,'/').split('/').filter(Boolean);
    const i = parts.indexOf('content');
    return (i >= 0 && parts[i+1]) ? parts[i+1] : null;
  }

  function getProgress(moduleCode) {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + moduleCode)) || { completed:{}, review:{} };
    } catch {
      return { completed:{}, review:{} };
    }
  }
  function setProgress(moduleCode, data) {
    localStorage.setItem(LS_PREFIX + moduleCode, JSON.stringify(data));
  }

  function stats(manifest, data) {
    const total = (manifest.topics || []).length;
    let complete = 0, review = 0;
    (manifest.topics || []).forEach(t=>{
      if (data.completed[t.href]) complete++;
      if (data.review[t.href]) review++;
    });
    const pct = total ? Math.round((complete/total)*100) : 0;
    return { total, complete, review, pct };
  }

  // ----- UI builders -----
  function ensureCardMount() {
    // Prefer an existing [data-ou-progress-course] card; else create one above Topics
    let card = document.querySelector('[data-ou-progress-course]');
    if (!card) {
      const sec = document.createElement('section');
      sec.className = 'card';
      sec.setAttribute('data-ou-progress-course','');
      sec.innerHTML = '<h2>Progress</h2><div class="ou-progress-body"></div>';
      const main = document.querySelector('main') || document.body;
      const topicsCard = document.getElementById('topics-card') || document.getElementById('topics')?.closest('.card');
      main.insertBefore(sec, topicsCard || main.firstChild);
      card = sec;
    } else if (!card.querySelector('.ou-progress-body')) {
      card.innerHTML = '<h2>Progress</h2><div class="ou-progress-body"></div>';
    }
    return card.querySelector('.ou-progress-body');
  }

  function renderBar(container, s) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;border:1px solid var(--ink-3,#334);border-radius:999px;height:14px;overflow:hidden">
          <div class="ou-progress-bar" style="height:100%;width:${s.pct}%;background:var(--accent,#2f86eb)"></div>
        </div>
        <div class="ou-progress-numbers" style="white-space:nowrap;opacity:.8">
          <strong>${s.pct}%</strong> · ${s.complete}/${s.total} completed · ${s.review} to review
        </div>
      </div>
      <div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn" data-ou-action="mark-all">Mark all complete</button>
        <button class="btn" data-ou-action="clear-complete">Clear completed</button>
        <button class="btn" data-ou-action="clear-review">Clear review</button>
        <button class="btn btn-muted" data-ou-action="reset-all">Reset</button>
      </div>
    `;
  }

  function applyTopicBadges(manifest, data) {
    // Works with your existing Topics renderer (grouped or not)
    const root = document.getElementById('topics');
    if (!root) return;

    // Add badges & toggles
    const links = root.querySelectorAll('a[href]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      // badge container
      let badge = a.parentElement.querySelector('.ou-topic-badges');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ou-topic-badges';
        badge.style.marginLeft = '.5rem';
        a.parentElement.appendChild(badge);
      }
      badge.innerHTML = `
        <a href="#" data-toggle="complete" data-href="${href}" title="Toggle complete" style="margin-right:.25rem;text-decoration:none;">${data.completed[href] ? '✔' : '◻'}</a>
        <a href="#" data-toggle="review" data-href="${href}" title="Toggle review" style="text-decoration:none;">${data.review[href] ? '🔁' : '⟲'}</a>
      `;
    });

    // Delegate clicks
    root.removeEventListener('click', _ouBadgeClick, true);
    root.addEventListener('click', _ouBadgeClick, true);

    function _ouBadgeClick(e){
      const t = e.target.closest('[data-toggle]');
      if (!t) return;
      e.preventDefault();
      const moduleCode = getModuleCodeFromPath();
      const state = getProgress(moduleCode);
      const key = t.getAttribute('data-toggle');             // 'complete' or 'review'
      const href = t.getAttribute('data-href');
      const bag = key === 'complete' ? state.completed : state.review;
      bag[href] = !bag[href];
      setProgress(moduleCode, state);
      // Update only this badge
      if (key === 'complete') t.textContent = bag[href] ? '✔' : '◻';
      if (key === 'review')   t.textContent = bag[href] ? '🔁' : '⟲';
      // Refresh bar
      const s = stats(manifest, state);
      const body = ensureCardMount();
      renderBar(body, s);
    }
  }

  function wireActions(manifest, moduleCode) {
    const body = ensureCardMount();
    body.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-ou-action]');
      if (!btn) return;
      const state = getProgress(moduleCode);
      const act = btn.getAttribute('data-ou-action');
      if (act === 'mark-all') {
        (manifest.topics||[]).forEach(t => state.completed[t.href] = true);
      } else if (act === 'clear-complete') {
        state.completed = {};
      } else if (act === 'clear-review') {
        state.review = {};
      } else if (act === 'reset-all') {
        state.completed = {}; state.review = {};
      }
      setProgress(moduleCode, state);
      renderBar(body, stats(manifest, state));
      applyTopicBadges(manifest, state);
    });
  }

  // Public init: call this after Topics list has been rendered
  window.OU_initProgress = function () {
    const moduleCode = getModuleCodeFromPath();
    if (!moduleCode) return;

    const bag = window.OU_MODULE_MANIFESTS || {};
    const manifest = bag[moduleCode];
    if (!manifest || !Array.isArray(manifest.topics)) return;

    const mount = ensureCardMount();
    const state = getProgress(moduleCode);
    renderBar(mount, stats(manifest, state));
    wireActions(manifest, moduleCode);
    applyTopicBadges(manifest, state);
  };
})();

