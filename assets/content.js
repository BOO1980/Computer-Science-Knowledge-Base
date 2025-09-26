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
