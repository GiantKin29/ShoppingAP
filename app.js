// ============================================================
// 買い物リストアプリ
// ============================================================

const GH_OWNER  = 'GiantKin29';
const GH_REPO   = 'ShoppingAP';
const GH_PATH   = 'data/shopping-list.json';
const GH_BRANCH = 'main';
const POLL_MS   = 60_000;

let items     = [];
let editingId = null;
let ghSha     = null;
let saveTimer = null;
let pollTimer = null;
let isSaving  = false;

const $ = id => document.getElementById(id);
const itemList        = $('itemList');
const emptyState      = $('emptyState');
const addBtn          = $('addBtn');
const addFirstBtn     = $('addFirstBtn');
const cartBar         = $('cartBar');
const amazonBtn       = $('amazonBtn');
const seiyuBtn        = $('seiyuBtn');
const amazonBadge     = $('amazonBadge');
const seiyuBadge      = $('seiyuBadge');
const modal           = $('modal');
const modalTitle      = $('modalTitle');
const inputName       = $('inputName');
const inputUnit       = $('inputUnit');
const inputAsin       = $('inputAsin');
const inputSeiyuId    = $('inputSeiyuId');
const modalCancelBtn  = $('modalCancelBtn');
const modalSaveBtn    = $('modalSaveBtn');
const settingsModal   = $('settingsModal');
const inputPat        = $('inputPat');
const patStatus       = $('patStatus');
const settingsCancelBtn = $('settingsCancelBtn');
const settingsTestBtn   = $('settingsTestBtn');
const settingsSaveBtn   = $('settingsSaveBtn');
const settingsLink      = $('settingsLink');

const getToken = ()      => localStorage.getItem('gh_pat') || '';
const setToken = token   => localStorage.setItem('gh_pat', token.trim());

// ===== GitHub API =====
async function ghLoad() {
  setSyncState('syncing');
  const token = getToken();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}&_=${Date.now()}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(url, { headers }); } catch { setSyncState('offline'); return null; }
  if (res.status === 404) { setSyncState(token ? 'online' : 'offline'); return null; }
  if (!res.ok) { setSyncState('offline'); return null; }
  const data = await res.json();
  ghSha = data.sha;
  const json = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  setSyncState('online');
  return JSON.parse(json);
}

async function ghSave(itemsData) {
  if (isSaving) return;
  const token = getToken();
  if (!token) return;
  isSaving = true;
  setSyncState('syncing');
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(itemsData, null, 2))));
  const body = { message: '買い物リストを更新', content, branch: GH_BRANCH };
  if (ghSha) body.sha = ghSha;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 409) { const latest = await ghLoad(); if (latest) mergeItems(latest); await ghSave(items); return; }
    if (!res.ok) { setSyncState('offline'); return; }
    ghSha = (await res.json()).content.sha;
    setSyncState('online');
  } catch { setSyncState('offline'); } finally { isSaving = false; }
}

function mergeItems(remote) {
  const localMap = Object.fromEntries(items.map(i => [i.id, i]));
  items = remote.map(r => ({ ...r, orderQty: localMap[r.id]?.orderQty ?? r.orderQty }));
}

async function testToken(token) {
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`,
    { headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}

const localSave = () => localStorage.setItem('shopping_items', JSON.stringify(items));
const localLoad = () => { const s = localStorage.getItem('shopping_items'); return s ? JSON.parse(s) : null; };

function scheduleSave() {
  localSave();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => ghSave(items), 300);
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden) return;
    const remote = await ghLoad();
    if (!remote) return;
    mergeItems(remote); localSave(); renderList();
  }, POLL_MS);
}

async function init() {
  registerSW();
  const cached = localLoad();
  if (cached) { items = cached; renderList(); }
  if (getToken()) {
    const remote = await ghLoad();
    if (remote) { items = remote; localSave(); renderList(); }
    else if (!cached) { items = defaultItems(); renderList(); }
    startPolling();
  } else {
    if (!cached) { items = defaultItems(); renderList(); }
    setSyncState('offline');
  }
}

function defaultItems() {
  return [
    { id: uid(), name: '牛乳',  unit: '本',    orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 0 },
    { id: uid(), name: '卵',    unit: 'パック', orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 1 },
    { id: uid(), name: '食パン',unit: '袋',    orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 2 },
  ];
}

// ===== レンダリング =====
function renderList() {
  if (items.length === 0) {
    itemList.innerHTML = '';
    emptyState.classList.remove('hidden');
    cartBar.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  updateCartBar();

  itemList.innerHTML = '';
  items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'item-card' + (item.orderQty > 0 ? ' has-order' : '');
    li.dataset.id = item.id;
    li.innerHTML = `
      <div class="item-top">
        <span class="item-name">${esc(item.name)}</span>
        ${item.unit ? `<span class="item-unit-badge">${esc(item.unit)}</span>` : ''}
      </div>
      <div class="item-bottom">
        <div class="qty-control">
          <button class="qty-btn qty-btn--minus" data-id="${item.id}" data-action="minus">－</button>
          <span class="qty-display" data-id="${item.id}" data-action="direct">${item.orderQty}</span>
          <button class="qty-btn qty-btn--plus" data-id="${item.id}" data-action="plus">＋</button>
        </div>
        <div class="item-actions">
          <button class="action-btn action-btn--move" data-id="${item.id}" data-action="up" ${idx === 0 ? 'disabled' : ''} title="上へ">↑</button>
          <button class="action-btn action-btn--move" data-id="${item.id}" data-action="down" ${idx === items.length-1 ? 'disabled' : ''} title="下へ">↓</button>
          <button class="action-btn action-btn--edit" data-id="${item.id}" data-action="edit" title="編集">✎</button>
          <button class="action-btn action-btn--delete" data-id="${item.id}" data-action="delete" title="削除">×</button>
        </div>
      </div>`;
    itemList.appendChild(li);
  });
}

function updateCartBar() {
  const order  = items.filter(i => i.orderQty > 0);
  const amazon = order.filter(i => i.amazonASIN);
  const seiyu  = order.filter(i => i.seiyuItemId);
  if (order.length > 0) {
    cartBar.classList.remove('hidden');
    amazonBadge.textContent = amazon.length;
    seiyuBadge.textContent  = seiyu.length;
    amazonBtn.disabled = amazon.length === 0;
    seiyuBtn.disabled  = seiyu.length  === 0;
    amazonBtn.style.opacity = amazon.length === 0 ? '0.45' : '';
    seiyuBtn.style.opacity  = seiyu.length  === 0 ? '0.45' : '';
  } else {
    cartBar.classList.add('hidden');
  }
}

// ===== クリック委譲 =====
itemList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { id, action } = btn.dataset;
  switch (action) {
    case 'plus':   changeQty(id,  1); break;
    case 'minus':  changeQty(id, -1); break;
    case 'direct': startDirectInput(btn, id); break;
    case 'edit':   openEditModal(id); break;
    case 'delete': deleteItem(id);   break;
    case 'up':     moveItem(id, -1); break;
    case 'down':   moveItem(id,  1); break;
  }
});

function changeQty(id, delta) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.orderQty = Math.max(0, item.orderQty + delta);
  const card = itemList.querySelector(`[data-id="${id}"]`)?.closest('.item-card');
  if (card) {
    card.className = 'item-card' + (item.orderQty > 0 ? ' has-order' : '');
    const d = card.querySelector('.qty-display');
    if (d) d.textContent = item.orderQty;
  }
  updateCartBar();
  scheduleSave();
}

function startDirectInput(displayEl, id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  const input = document.createElement('input');
  input.type = 'number'; input.className = 'qty-input';
  input.value = item.orderQty; input.min = 0; input.max = 99;
  displayEl.replaceWith(input);
  input.focus(); input.select();
  const commit = () => { item.orderQty = Math.max(0, Math.min(99, parseInt(input.value) || 0)); scheduleSave(); renderList(); };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = item.orderQty; input.blur(); } });
}

function moveItem(id, dir) {
  const idx = items.findIndex(i => i.id === id);
  const nxt = idx + dir;
  if (nxt < 0 || nxt >= items.length) return;
  [items[idx], items[nxt]] = [items[nxt], items[idx]];
  items.forEach((it, i) => it.sortOrder = i);
  scheduleSave(); renderList();
}

// ===== 削除（確認なし） =====
function deleteItem(id) {
  items = items.filter(i => i.id !== id);
  scheduleSave(); renderList();
}

// ===== 品目追加・編集モーダル =====
function openAddModal() {
  editingId = null;
  modalTitle.textContent = '品目を追加';
  inputName.value = inputUnit.value = inputAsin.value = inputSeiyuId.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 100);
}

function openEditModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  modalTitle.textContent = '品目を編集';
  inputName.value = item.name; inputUnit.value = item.unit || '';
  inputAsin.value = item.amazonASIN || ''; inputSeiyuId.value = item.seiyuItemId || '';
  modal.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 100);
}

function closeModal() { modal.classList.add('hidden'); editingId = null; }

function saveItemModal() {
  const name = inputName.value.trim();
  if (!name) { inputName.focus(); inputName.style.borderColor = '#ef4444'; return; }
  inputName.style.borderColor = '';
  if (editingId) {
    const item = items.find(i => i.id === editingId);
    if (item) {
      item.name = name; item.unit = inputUnit.value.trim();
      item.amazonASIN = inputAsin.value.trim(); item.seiyuItemId = inputSeiyuId.value.trim();
    }
  } else {
    items.push({ id: uid(), name, unit: inputUnit.value.trim(), orderQty: 0,
      amazonASIN: inputAsin.value.trim(), seiyuItemId: inputSeiyuId.value.trim(), sortOrder: items.length });
  }
  closeModal(); scheduleSave(); renderList();
}

addBtn.addEventListener('click', openAddModal);
addFirstBtn.addEventListener('click', openAddModal);
modalCancelBtn.addEventListener('click', closeModal);
modalSaveBtn.addEventListener('click', saveItemModal);
modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
// ※ Enterキーでは保存しない

// ===== 同期設定モーダル =====
settingsLink.addEventListener('click', () => {
  inputPat.value = getToken();
  patStatus.className = 'pat-status hidden';
  settingsModal.classList.remove('hidden');
});
function closeSettings() { settingsModal.classList.add('hidden'); }
settingsCancelBtn.addEventListener('click', closeSettings);
settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);

settingsTestBtn.addEventListener('click', async () => {
  const token = inputPat.value.trim();
  if (!token) { showPatStatus('トークンを入力してください', false); return; }
  settingsTestBtn.disabled = true; settingsTestBtn.textContent = '確認中...';
  const ok = await testToken(token);
  settingsTestBtn.disabled = false; settingsTestBtn.textContent = '接続テスト';
  showPatStatus(ok ? '✓ 接続成功！' : '✗ 接続失敗（トークンを確認してください）', ok);
});

settingsSaveBtn.addEventListener('click', async () => {
  const token = inputPat.value.trim();
  setToken(token); closeSettings();
  if (token) {
    showToast('トークンを保存しました');
    const remote = await ghLoad();
    if (remote) { items = remote; localSave(); renderList(); }
    startPolling();
  } else {
    setSyncState('offline');
    showToast('トークンを削除しました');
  }
});

function showPatStatus(msg, ok) {
  patStatus.textContent = msg;
  patStatus.className = 'pat-status ' + (ok ? 'pat-status--ok' : 'pat-status--ng');
}

// ===== Amazon / 西友 =====
function openAmazonAll() {
  const list = items.filter(i => i.orderQty > 0 && i.amazonASIN);
  if (!list.length) { showToast('AmazonのASINが設定された品目がありません'); return; }
  let url = 'https://www.amazon.co.jp/gp/aws/cart/add.html?';
  list.forEach((it, i) => { url += `ASIN.${i+1}=${encodeURIComponent(it.amazonASIN)}&Quantity.${i+1}=${it.orderQty}&`; });
  window.open(url.slice(0,-1), '_blank');
  showToast(`Amazon: ${list.length}品目をカートに追加`);
}

function openSeiyuAll() {
  const list = items.filter(i => i.orderQty > 0 && i.seiyuItemId);
  if (!list.length) { showToast('西友の商品IDが設定された品目がありません'); return; }
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  list.forEach((it, i) => setTimeout(() => window.open(seiyuUrl(it), '_blank'), i * (mobile ? 800 : 1200)));
  showToast(mobile ? `西友: ${list.length}品目の商品ページを開きました` : `西友: ${list.length}品目を自動カート追加中...`);
}

function seiyuUrl(item) {
  return `https://netsuper.rakuten.co.jp/seiyu/item/${encodeURIComponent(item.seiyuItemId)}/?__autoAdd=1&__qty=${Math.max(1,item.orderQty)}`;
}

amazonBtn.addEventListener('click', openAmazonAll);
seiyuBtn.addEventListener('click', openSeiyuAll);

// ===== ユーティリティ =====
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.animation = 'none'; toast.offsetHeight; toast.style.animation = '';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function setSyncState(state) {
  let el = document.querySelector('.sync-dot');
  if (!el) { el = document.createElement('div'); el.className = 'sync-dot'; document.body.appendChild(el); }
  el.className = 'sync-dot ' + state;
  el.title = { syncing: '同期中...', online: '同期済み', offline: 'オフライン' }[state] || '';
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
