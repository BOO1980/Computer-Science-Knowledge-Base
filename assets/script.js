
// ---- Manifest loader (CORS-safe for file://) ----
function ouReady(fn){ if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }
async function ensureManifest(){
  if(window.__OU_MANIFEST__ && window.__OU_MANIFEST__.pages){ return window.__OU_MANIFEST__; }
  // If not defined and we're on http(s), try to fetch; otherwise fallback to empty
  if(location.protocol.startsWith('http')){
    try{
      const res = await fetch('assets/manifest.json');
      const data = await res.json();
      window.__OU_MANIFEST__ = data;
      return data;
    }catch(e){
      console.warn('Failed to fetch manifest over HTTP, falling back to empty.', e);
    }
  } else {
    console.warn('Running from file:// — using embedded manifest.js');
  }
  window.__OU_MANIFEST__ ||= {pages:[]};
  return window.__OU_MANIFEST__;
}

// ---- Utilities ----
function groupBy(list, fn){
  return list.reduce((acc, item)=>{ const k = fn(item); (acc[k] ||= []).push(item); return acc; }, {});
}
function courseBucket(url){
  const parts = url.split('/');
  return parts.length > 2 ? parts[1] : 'General';
}

// ---- Progress helpers ----
const OU_PROGRESS_KEY = 'ou_progress_v1';
function ouLoadProgress(){ try { return JSON.parse(localStorage.getItem(OU_PROGRESS_KEY) || '{}'); } catch(e){ return {}; } }
function ouIsCompleted(url){ const st = ouLoadProgress(); return !!(st[url] && st[url].completed); }
function ouIsReview(url){ const st = ouLoadProgress(); return !!(st[url] && st[url].review); }
function ouCourse(url){ const parts = url.split('/'); return parts.length>2 ? parts[1] : 'General'; }
function ouProgressByCourse(pages){
  const acc = {};
  for(const p of pages){
    const c = ouCourse(p.url);
    acc[c] ||= {total:0, done:0, review:0};
    acc[c].total += 1;
    if(ouIsCompleted(p.url)) acc[c].done += 1;
    if(ouIsReview(p.url)) acc[c].review += 1;
  }
  return acc;
}
function drawProgressBars(){
  const bars = document.querySelectorAll('[data-ou-progress-course]');
  if(!bars.length) return;
  const data = window.__OU_MANIFEST__ || {pages:[]};
  const prog = ouProgressByCourse(data.pages||[]);
  bars.forEach(el => {
    const c = el.getAttribute('data-ou-progress-course');
    const p = prog[c] || {total:0, done:0};
    const pct = p.total ? Math.round((p.done/p.total)*100) : 0;
    el.innerHTML = `
      <div class="kicker">${c} — ${p.done}/${p.total} complete</div>
      <div style="height:10px; border:1px solid #27325f; border-radius:999px; overflow:hidden;">
        <div style="height:100%; width:${pct}%; background: var(--accent);"></div>
      </div>
    `;
  });
}

// ---- Tag helpers ----
function uniqueTags(pages){
  const set = new Set();
  for(const p of pages){ (p.tags||[]).forEach(t => set.add(t)); }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function drawTagChips(pages){
  const mount = document.querySelector('#tag-chips');
  if(!mount) return;
  const tags = uniqueTags(pages);
  tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.className = 'btn';
    chip.type = 'button';
    chip.textContent = '#' + tag;
    chip.dataset.tag = tag;
    chip.addEventListener('click', ()=>{
      chip.classList.toggle('active');
      chip.style.outline = chip.classList.contains('active') ? 'var(--ring)' : '';
      applySearchFilters(pages);
    });
    mount.appendChild(chip);
  });
}
function getActiveTags(){ return Array.from(document.querySelectorAll('#tag-chips .active')).map(el => el.dataset.tag); }

// ---- Search ----
function applySearchFilters(pages){
  const input = document.querySelector('#q');
  const q = (input ? input.value : '').trim().toLowerCase();
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];
  const activeTags = getActiveTags();
  let filtered = pages.slice();
  if(terms.length){
    filtered = filtered.filter(p => terms.every(t => (p.title.toLowerCase().includes(t) || p.url.toLowerCase().includes(t))));
  }
  if(activeTags.length){
    filtered = filtered.filter(p => {
      const t = p.tags || [];
      return activeTags.every(tag => t.includes(tag));
    });
  }
  const results = document.querySelector('#results');
  const count = document.querySelector('#count');
  if(results){
    results.innerHTML = '';
    count.textContent = filtered.length;
    for(const it of filtered.slice(0, 300)){
      const a = document.createElement('a');
      const tags = (it.tags && it.tags.length) ? '  [' + it.tags.join(', ') + ']' : '';
      a.href = it.url;
      a.textContent = it.title + ' — ' + it.url.replace('content/', '') + tags;
      results.appendChild(a);
    }
  }
  return filtered;
}
function wireSearch(pages){
  const input = document.querySelector('#q');
  drawTagChips(pages);
  if(input){ input.addEventListener('input', () => applySearchFilters(pages)); }
  applySearchFilters(pages);
}

// ---- Mode toggle ----
function ouGetMode(){ return localStorage.getItem('ou_mode') || 'dark'; }
function ouApplyMode(){
  const mode = ouGetMode();
  document.documentElement.setAttribute('data-mode', mode);
  document.querySelectorAll('[data-ou-mode-toggle]').forEach(btn => {
    btn.textContent = mode === 'dark' ? '☀️ Light' : '🌙 Dark';
  });
}
function ouToggleMode(){
  const mode = ouGetMode();
  localStorage.setItem('ou_mode', mode === 'dark' ? 'light' : 'dark');
  ouApplyMode();
}
ouReady(ouApplyMode);

// ---- Bootstraps used by pages ----
async function OU_onHome(){
  await ensureManifest();
  const data = window.__OU_MANIFEST__ || {pages:[]};
  // Quick links (modules)
  const courses = new Set((data.pages||[]).map(p => p.url.split('/')[1]).filter(Boolean));
  const mount = document.getElementById('quick-links');
  if(mount){
    mount.innerHTML='';
    [...courses].sort().forEach(c => {
      const a = document.createElement('a');
      a.href = 'contents.html#' + c;
      a.textContent = c;
      mount.appendChild(a);
    });
  }
  drawProgressBars();
}
async function OU_onContents(){
  await ensureManifest();
  const data = window.__OU_MANIFEST__ || {pages:[]};
  const tocMount = document.querySelector('#toc');
  if(tocMount){
    const pages = data.pages||[];
    const groups = groupBy(pages, p => courseBucket(p.url));
    tocMount.innerHTML = '';
    for(const course of Object.keys(groups).sort()){
      const section = document.createElement('section');
      section.className = 'card';
      section.id = course;
      const h2 = document.createElement('h2');
      h2.textContent = course;
      section.appendChild(h2);
      const list = document.createElement('div');
      list.className = 'list';
      for(const p of groups[course]){
        const a = document.createElement('a');
        a.href = p.url;
        a.textContent = p.title;
        list.appendChild(a);
      }
      section.appendChild(list);
      tocMount.appendChild(section);
    }
  }
  drawProgressBars();
}
async function OU_onSearch(){
  await ensureManifest();
  const data = window.__OU_MANIFEST__ || {pages:[]};
  wireSearch(data.pages||[]);
}
