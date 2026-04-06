// ============================================================
// 買い物リストアプリ
// 同期: GitHub Contents API（Personal Access Token使用）
// ============================================================

// ===== GitHub設定 =====
const GH_OWNER  = 'GiantKin29';
const GH_REPO   = 'ShoppingAP';
const GH_PATH   = 'data/shopping-list.json';
const GH_BRANCH = 'main';
const POLL_MS   = 60_000;

// ===== 状態 =====
let items        = [];
let isEditMode   = false;
let editingId    = null;
let deletingId   = null;
let ghSha        = null;
let saveTimer    = null;
let pollTimer    = null;
let isSaving     = false;

// ===== DOM =====
const $  = id => document.getElementById(id);
const itemList       = $('itemList');
const emptyState     = $('emptyState');
const editBtn        = $('editBtn');
const settingsBtn    = $('settingsBtn');
const addBtn         = $('addBtn');
const addFirstBtn    = $('addFirstBtn');
const cartBar        = $('cartBar');
const amazonBtn      = $('amazonBtn');
const seiyuBtn       = $('seiyuBtn');
const amazonBadge    = $('amazonBadge');
const seiyuBadge     = $('seiyuBadge');
const modal          = $('modal');
const modalTitle     = $('modalTitle');
const inputName      = $('inputName');
const inputUnit      = $('inputUnit');
const inputAsin      = $('inputAsin');
const inputSeiyuId   = $('inputSeiyuId');
const modalCancelBtn = $('modalCancelBtn');
const modalSaveBtn   = $('modalSaveBtn');
const deleteModal       = $('deleteModal');
const deleteModalName   = $('deleteModalName');
const deleteCancelBtn   = $('deleteCancelBtn');
const deleteConfirmBtn  = $('deleteConfirmBtn');
const settingsModal     = $('settingsModal');
const inputPat          = $('inputPat');
const patStatus         = $('patStatus');
const settingsCancelBtn = $('settingsCancelBtn');
const settingsTestBtn   = $('settingsTestBtn');
const settingsSaveBtn   = $('settingsSaveBtn');

const getToken = ()      => localStorage.getItem('gh_pat') || '';
const setToken = token   => localStorage.setItem('gh_pat', token.trim());

async function ghLoad() {
  setSyncState('syncing');
  const token = getToken();
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`
            + `?ref=${GH_BRANCH}&_=${Date.now()}`;
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
  const json = JSON.stringify(itemsData, null, 2);
  const content = btoa(unescape(encodeURIComponent(json)));
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
    const result = await res.json();
    ghSha = result.content.sha;
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
    mergeItems(remote);
    localSave();
    renderList();
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

function renderList() {
  itemList.className = isEditMode ? 'edit-mode' : '';
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
    li.className = 'item-row' + (item.orderQty > 0 ? ' has-order' : '');
    li.dataset.id = item.id;
    const hasA = !!item.amazonASIN;
    const hasS = !!item.seiyuItemId;
    li.innerHTML = `
      <div class="drag-handle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="5" width="16" height="2" rx="1"/>
          <rect x="4" y="11" width="16" height="2" rx="1"/>
          <rect x="4" y="17" width="16" height="2" rx="1"/>
        </svg>
      </div>
      <span class="item-name">${esc(item.name)}</span>
      <span class="item-unit">${esc(item.unit || '')}</span>
      <div class="qty-control">
        <button class="qty-btn qty-btn--minus" data-id="${item.id}" data-action="minus">－</button>
        <span class="qty-display" data-id="${item.id}" data-action="direct">${item.orderQty}</span>
        <button class="qty-btn qty-btn--plus" data-id="${item.id}" data-action="plus">＋</button>
      </div>
      <div class="shop-btns">
        <button class="shop-btn shop-btn--amazon${hasA ? '' : ' no-link'}" data-id="${item.id}" data-action="amazon">A</button>
        <button class="shop-btn shop-btn--seiyu${hasS ? '' : ' no-link'}" data-id="${item.id}" data-action="seiyu">西</button>
      </div>
      <div class="item-edit-actions">
        <button class="move-btn" data-id="${item.id}" data-action="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
        <button class="move-btn" data-id="${item.id}" data-action="down" ${idx === items.length-1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn" data-id="${item.id}" data-action="edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn icon-btn--danger" data-id="${item.id}" data-action="delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>`;
    itemList.appendChild(li);
  });
  if (isEditMode) setupDragDrop();
}

function updateCartBar() {
  const order  = items.filter(i => i.orderQty > 0);
  const amazon = order.filter(i => i.amazonASIN);
  const seiyu  = order.filter(i => i.seiyuItemId);
  if (order.length > 0 && !isEditMode) {
    cartBar.classList.remove('hidden');
    amazonBadge.textContent = amazon.length;
    seiyuBadge.textContent  = seiyu.length;
    amazonBtn.disabled = amazon.length === 0;
    seiyuBtn.disabled  = seiyu.length  === 0;
    amazonBtn.style.opacity = amazon.length === 0 ? '0.5' : '';
    seiyuBtn.style.opacity  = seiyu.length  === 0 ? '0.5' : '';
  } else { cartBar.classList.add('hidden'); }
}

itemList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { id, action } = btn.dataset;
  switch (action) {
    case 'plus':   changeQty(id,  1); break;
    case 'minus':  changeQty(id, -1); break;
    case 'direct': startDirectInput(btn, id); break;
    case 'amazon': openAmazonSingle(id); break;
    case 'seiyu':  openSeiyuSingle(id);  break;
    case 'edit':   openEditModal(id);    break;
    case 'delete': openDeleteModal(id);  break;
    case 'up':     moveItem(id, -1);     break;
    case 'down':   moveItem(id,  1);     break;
  }
});

function changeQty(id, delta) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.orderQty = Math.max(0, item.orderQty + delta);
  const li = itemList.querySelector(`[data-id="${id}"]`)?.closest('.item-row');
  if (li) {
    li.className = 'item-row' + (item.orderQty > 0 ? ' has-order' : '');
    const d = li.querySelector('.qty-display');
    if (d) d.textContent = item.orderQty;
  }
  updateCartBar();
  scheduleSave();
}

function startDirectInput(displayEl, id) {
  if (isEditMode) return;
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

function setupDragDrop() {
  const rows = itemList.querySelectorAll('.item-row');
  let src = null;
  rows.forEach(row => {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', () => { src = row; row.classList.add('dragging'); });
    row.addEventListener('dragend',   () => { row.classList.remove('dragging'); rows.forEach(r => r.classList.remove('drag-over')); });
    row.addEventListener('dragover',  e => { e.preventDefault(); if (row !== src) { rows.forEach(r => r.classList.remove('drag-over')); row.classList.add('drag-over'); } });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!src || src === row) return;
      const si = items.findIndex(i => i.id === src.dataset.id);
      const di = items.findIndex(i => i.id === row.dataset.id);
      items.splice(di, 0, items.splice(si, 1)[0]);
      items.forEach((it, i) => it.sortOrder = i);
      scheduleSave(); renderList();
    });
  });
}

editBtn.addEventListener('click', () => {
  isEditMode = !isEditMode;
  editBtn.classList.toggle('active', isEditMode);
  addBtn.classList.toggle('hidden', !isEditMode);
  renderList();
});

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
  inputName.value    = item.name;
  inputUnit.value    = item.unit     || '';
  inputAsin.value    = item.amazonASIN  || '';
  inputSeiyuId.value = item.seiyuItemId || '';
  modal.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 100);
}

function closeModal() { modal.classList.add('hidden'); editingId = null; }

async function saveItemModal() {
  const name = inputName.value.trim();
  if (!name) { inputName.focus(); inputName.style.borderColor = 'var(--color-danger)'; return; }
  inputName.style.borderColor = '';
  if (editingId) {
    const item = items.find(i => i.id === editingId);
    if (item) { item.name = name; item.unit = inputUnit.value.trim(); item.amazonASIN = inputAsin.value.trim(); item.seiyuItemId = inputSeiyuId.value.trim(); }
  } else {
    items.push({ id: uid(), name, unit: inputUnit.value.trim(), orderQty: 0, amazonASIN: inputAsin.value.trim(), seiyuItemId: inputSeiyuId.value.trim(), sortOrder: items.length });
  }
  closeModal(); scheduleSave(); renderList();
}

addBtn.addEventListener('click', openAddModal);
addFirstBtn.addEventListener('click', openAddModal);
modalCancelBtn.addEventListener('click', closeModal);
modalSaveBtn.addEventListener('click', saveItemModal);
modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
[inputName, inputUnit, inputAsin, inputSeiyuId].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') saveItemModal(); }));

function openDeleteModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  deletingId = id;
  deleteModalName.textContent = `「${item.name}」を削除します。`;
  deleteModal.classList.remove('hidden');
}
function closeDeleteModal() { deleteModal.classList.add('hidden'); deletingId = null; }
function confirmDelete() {
  if (!deletingId) return;
  items = items.filter(i => i.id !== deletingId);
  closeDeleteModal(); scheduleSave(); renderList();
}
deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteConfirmBtn.addEventListener('click', confirmDelete);
deleteModal.querySelector('.modal-backdrop').addEventListener('click', closeDeleteModal);

settingsBtn.addEventListener('click', () => {
  inputPat.value = getToken();
  patStatus.className = 'pat-status hidden';
  settingsModal.classList.remove('hidden');
  setTimeout(() => inputPat.focus(), 100);
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
    showToast('トークンを保存しました。同期を開始します...');
    const remote = await ghLoad();
    if (remote) { items = remote; localSave(); renderList(); }
    startPolling();
  } else { setSyncState('offline'); showToast('トークンを削除しました（ローカル保存のみ）'); }
});

function showPatStatus(msg, ok) {
  patStatus.textContent = msg;
  patStatus.className = 'pat-status ' + (ok ? 'pat-status--ok' : 'pat-status--ng');
}

function openAmazonAll() {
  const list = items.filter(i => i.orderQty > 0 && i.amazonASIN);
  if (!list.length) { showToast('AmazonのASINが設定された品目がありません'); return; }
  let url = 'https://www.amazon.co.jp/gp/aws/cart/add.html?';
  list.forEach((item, i) => { url += `ASIN.${i+1}=${encodeURIComponent(item.amazonASIN)}&Quantity.${i+1}=${item.orderQty}&`; });
  window.open(url.slice(0, -1), '_blank');
  showToast(`Amazon: ${list.length}品目をカートに追加`);
}

function openAmazonSingle(id) {
  const item = items.find(i => i.id === id);
  if (!item?.amazonASIN) { showToast('Amazon ASINが未設定です'); return; }
  window.open(`https://www.amazon.co.jp/gp/aws/cart/add.html?ASIN.1=${item.amazonASIN}&Quantity.1=${Math.max(1,item.orderQty)}`, '_blank');
}

function openSeiyuAll() {
  const list = items.filter(i => i.orderQty > 0 && i.seiyuItemId);
  if (!list.length) { showToast('西友の商品IDが設定された品目がありません'); return; }
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  list.forEach((item, i) => setTimeout(() => window.open(seiyuUrl(item), '_blank'), i * (mobile ? 800 : 1200)));
  showToast(mobile ? `西友: ${list.length}品目の商品ページを開きました` : `西友: ${list.length}品目を自動でカートに追加中...`);
}

function openSeiyuSingle(id) {
  const item = items.find(i => i.id === id);
  if (!item?.seiyuItemId) { showToast('西友の商品IDが未設定です'); return; }
  window.open(seiyuUrl(item), '_blank');
}

function seiyuUrl(item) {
  return `https://netsuper.rakuten.co.jp/seiyu/item/${encodeURIComponent(item.seiyuItemId)}/?__autoAdd=1&__qty=${Math.max(1,item.orderQty)}`;
}

amazonBtn.addEventListener('click', openAmazonAll);
seiyuBtn.addEventListener('click', openSeiyuAll);

function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.style.animation = 'none'; toast.offsetHeight; toast.style.animation = '';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function setSyncState(state) {
  let el = document.querySelector('.sync-indicator');
  if (!el) { el = document.createElement('div'); el.className = 'sync-indicator'; document.body.appendChild(el); }
  el.className = 'sync-indicator ' + state;
  el.title = { syncing: '同期中...', online: '同期済み', offline: 'オフライン（トークン未設定）' }[state] || '';
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
