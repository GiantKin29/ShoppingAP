// ============================================================
// 買い物リストアプリ - メインロジック
// ============================================================

// ===== 状態 =====
let items = [];
let isEditMode = false;
let db = null;
let editingItemId = null;
let deletingItemId = null;
let unsubscribe = null;

// ===== DOM =====
const itemList = document.getElementById('itemList');
const emptyState = document.getElementById('emptyState');
const editBtn = document.getElementById('editBtn');
const addBtn = document.getElementById('addBtn');
const addFirstBtn = document.getElementById('addFirstBtn');
const cartBar = document.getElementById('cartBar');
const amazonBtn = document.getElementById('amazonBtn');
const seiyuBtn = document.getElementById('seiyuBtn');
const amazonBadge = document.getElementById('amazonBadge');
const seiyuBadge = document.getElementById('seiyuBadge');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const inputName = document.getElementById('inputName');
const inputUnit = document.getElementById('inputUnit');
const inputAsin = document.getElementById('inputAsin');
const inputSeiyuId = document.getElementById('inputSeiyuId');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const deleteModal = document.getElementById('deleteModal');
const deleteModalName = document.getElementById('deleteModalName');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

// ===== Firebase初期化 =====
function initFirebase() {
  try {
    if (
      typeof firebase !== 'undefined' &&
      typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG.projectId
    ) {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      // オフライン永続化（モバイルでも使えるように）
      db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      console.log('Firebase接続OK');
      return true;
    }
  } catch (e) {
    console.warn('Firebase初期化失敗、ローカル保存を使用します:', e);
  }
  return false;
}

// ===== データ読み込み =====
function loadItems() {
  if (db) {
    // Firebaseからリアルタイム同期
    setSyncState('syncing');
    unsubscribe = db
      .collection('items')
      .orderBy('sortOrder')
      .onSnapshot(
        (snapshot) => {
          items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          renderList();
          setSyncState('online');
        },
        (err) => {
          console.error('Firestore読み込みエラー:', err);
          setSyncState('offline');
        }
      );
  } else {
    // ローカルストレージから読み込み
    const stored = localStorage.getItem('shoppingItems');
    if (stored) {
      items = JSON.parse(stored);
    } else {
      items = getDefaultItems();
    }
    renderList();
  }
}

// デフォルト品目（初回起動時）
function getDefaultItems() {
  return [
    { id: genId(), name: '牛乳', unit: '本', orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 0 },
    { id: genId(), name: '卵', unit: 'パック', orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 1 },
    { id: genId(), name: '食パン', unit: '袋', orderQty: 0, amazonASIN: '', seiyuItemId: '', sortOrder: 2 },
  ];
}

// ===== ローカル保存 =====
function saveLocal() {
  localStorage.setItem('shoppingItems', JSON.stringify(items));
}

// ===== Firebase更新（単一アイテム） =====
async function saveItemToFirebase(item) {
  if (!db) return;
  setSyncState('syncing');
  try {
    await db.collection('items').doc(item.id).set(item);
    setSyncState('online');
  } catch (e) {
    console.error('保存エラー:', e);
    setSyncState('offline');
  }
}

async function deleteItemFromFirebase(id) {
  if (!db) return;
  setSyncState('syncing');
  try {
    await db.collection('items').doc(id).delete();
    setSyncState('online');
  } catch (e) {
    console.error('削除エラー:', e);
    setSyncState('offline');
  }
}

// sortOrderを一括更新
async function saveSortOrderToFirebase() {
  if (!db) return;
  setSyncState('syncing');
  try {
    const batch = db.batch();
    items.forEach((item, idx) => {
      batch.update(db.collection('items').doc(item.id), { sortOrder: idx });
    });
    await batch.commit();
    setSyncState('online');
  } catch (e) {
    console.error('並び替え保存エラー:', e);
    setSyncState('offline');
  }
}

// ===== レンダリング =====
function renderList() {
  const editClass = isEditMode ? 'edit-mode' : '';
  itemList.className = editClass;

  if (items.length === 0) {
    itemList.innerHTML = '';
    emptyState.classList.remove('hidden');
    cartBar.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // カートバーの更新
  const orderItems = items.filter((i) => i.orderQty > 0);
  const amazonItems = orderItems.filter((i) => i.amazonASIN);
  const seiyuItems = orderItems.filter((i) => i.seiyuItemId);

  if (orderItems.length > 0 && !isEditMode) {
    cartBar.classList.remove('hidden');
    amazonBadge.textContent = amazonItems.length;
    seiyuBadge.textContent = seiyuItems.length;
    amazonBtn.disabled = amazonItems.length === 0;
    seiyuBtn.disabled = seiyuItems.length === 0;
    amazonBtn.style.opacity = amazonItems.length === 0 ? '0.5' : '';
    seiyuBtn.style.opacity = seiyuItems.length === 0 ? '0.5' : '';
  } else {
    cartBar.classList.add('hidden');
  }

  // アイテム描画
  itemList.innerHTML = '';
  items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'item-row' + (item.orderQty > 0 ? ' has-order' : '');
    li.dataset.id = item.id;

    const hasAmazon = !!item.amazonASIN;
    const hasSeiyu = !!item.seiyuItemId;

    li.innerHTML = `
      <div class="drag-handle" data-id="${item.id}" title="ドラッグして並び替え">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="5" width="16" height="2" rx="1"/>
          <rect x="4" y="11" width="16" height="2" rx="1"/>
          <rect x="4" y="17" width="16" height="2" rx="1"/>
        </svg>
      </div>
      <span class="item-name">${escapeHtml(item.name)}</span>
      <span class="item-unit">${escapeHtml(item.unit || '')}</span>
      <div class="qty-control">
        <button class="qty-btn qty-btn--minus" data-id="${item.id}" data-action="minus">－</button>
        <span class="qty-display" data-id="${item.id}" data-action="direct">${item.orderQty}</span>
        <button class="qty-btn qty-btn--plus" data-id="${item.id}" data-action="plus">＋</button>
      </div>
      <div class="shop-btns">
        <button class="shop-btn shop-btn--amazon${hasAmazon ? '' : ' no-link'}"
          data-id="${item.id}" data-action="amazon"
          title="${hasAmazon ? 'Amazonで開く' : 'Amazon ASINが未設定'}">A</button>
        <button class="shop-btn shop-btn--seiyu${hasSeiyu ? '' : ' no-link'}"
          data-id="${item.id}" data-action="seiyu"
          title="${hasSeiyu ? '西友で開く' : '西友IDが未設定'}">西</button>
      </div>
      <div class="item-edit-actions">
        <button class="move-btn" data-id="${item.id}" data-action="up" ${idx === 0 ? 'disabled' : ''} title="上に移動">↑</button>
        <button class="move-btn" data-id="${item.id}" data-action="down" ${idx === items.length - 1 ? 'disabled' : ''} title="下に移動">↓</button>
        <button class="icon-btn" data-id="${item.id}" data-action="edit" title="編集">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn icon-btn--danger" data-id="${item.id}" data-action="delete" title="削除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    `;

    itemList.appendChild(li);
  });

  // ドラッグ＆ドロップ設定（編集モード時）
  if (isEditMode) {
    setupDragAndDrop();
  }
}

// ===== イベント処理 =====
// リスト内クリックを委譲
itemList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  switch (action) {
    case 'plus':
      changeQty(id, 1);
      break;
    case 'minus':
      changeQty(id, -1);
      break;
    case 'direct':
      startDirectInput(btn, id);
      break;
    case 'amazon':
      openAmazonSingle(id);
      break;
    case 'seiyu':
      openSeiyuSingle(id);
      break;
    case 'edit':
      openEditModal(id);
      break;
    case 'delete':
      openDeleteModal(id);
      break;
    case 'up':
      moveItem(id, -1);
      break;
    case 'down':
      moveItem(id, 1);
      break;
  }
});

// 数量変更
function changeQty(id, delta) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.orderQty = Math.max(0, item.orderQty + delta);

  if (db) {
    saveItemToFirebase(item);
  } else {
    saveLocal();
  }

  // 行だけ更新（全再描画しない）
  const li = itemList.querySelector(`[data-id="${id}"]`)?.closest('.item-row');
  if (li) {
    li.className = 'item-row' + (item.orderQty > 0 ? ' has-order' : '');
    const display = li.querySelector('.qty-display');
    if (display) display.textContent = item.orderQty;
  }

  // カートバー更新
  renderCartBar();
}

// 数量直接入力
function startDirectInput(displayEl, id) {
  if (isEditMode) return;
  const item = items.find((i) => i.id === id);
  if (!item) return;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'qty-input';
  input.value = item.orderQty;
  input.min = 0;
  input.max = 99;

  displayEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = Math.max(0, Math.min(99, parseInt(input.value) || 0));
    item.orderQty = val;
    if (db) saveItemToFirebase(item);
    else saveLocal();
    renderList();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = item.orderQty;
      input.blur();
    }
  });
}

function renderCartBar() {
  const orderItems = items.filter((i) => i.orderQty > 0);
  const amazonItems = orderItems.filter((i) => i.amazonASIN);
  const seiyuItems = orderItems.filter((i) => i.seiyuItemId);

  if (orderItems.length > 0 && !isEditMode) {
    cartBar.classList.remove('hidden');
    amazonBadge.textContent = amazonItems.length;
    seiyuBadge.textContent = seiyuItems.length;
    amazonBtn.disabled = amazonItems.length === 0;
    seiyuBtn.disabled = seiyuItems.length === 0;
    amazonBtn.style.opacity = amazonItems.length === 0 ? '0.5' : '';
    seiyuBtn.style.opacity = seiyuItems.length === 0 ? '0.5' : '';
  } else {
    cartBar.classList.add('hidden');
  }
}

// ===== 並び替え =====
function moveItem(id, direction) {
  const idx = items.findIndex((i) => i.id === id);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= items.length) return;

  // 入れ替え
  [items[idx], items[newIdx]] = [items[newIdx], items[idx]];

  // sortOrder更新
  items.forEach((item, i) => (item.sortOrder = i));

  if (db) {
    saveSortOrderToFirebase();
  } else {
    saveLocal();
  }

  renderList();
}

// ===== ドラッグ＆ドロップ =====
function setupDragAndDrop() {
  const rows = itemList.querySelectorAll('.item-row');
  let dragSrc = null;

  rows.forEach((row) => {
    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', (e) => {
      dragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      rows.forEach((r) => r.classList.remove('drag-over'));
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (row !== dragSrc) {
        rows.forEach((r) => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      }
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;

      const srcId = dragSrc.dataset.id;
      const dstId = row.dataset.id;
      const srcIdx = items.findIndex((i) => i.id === srcId);
      const dstIdx = items.findIndex((i) => i.id === dstId);

      items.splice(dstIdx, 0, items.splice(srcIdx, 1)[0]);
      items.forEach((item, i) => (item.sortOrder = i));

      if (db) saveSortOrderToFirebase();
      else saveLocal();

      renderList();
    });
  });
}

// ===== 編集モード =====
editBtn.addEventListener('click', () => {
  isEditMode = !isEditMode;
  editBtn.classList.toggle('active', isEditMode);
  addBtn.classList.toggle('hidden', !isEditMode);
  renderList();
});

// ===== 品目追加・編集モーダル =====
function openAddModal() {
  editingItemId = null;
  modalTitle.textContent = '品目を追加';
  inputName.value = '';
  inputUnit.value = '';
  inputAsin.value = '';
  inputSeiyuId.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 100);
}

function openEditModal(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  editingItemId = id;
  modalTitle.textContent = '品目を編集';
  inputName.value = item.name;
  inputUnit.value = item.unit || '';
  inputAsin.value = item.amazonASIN || '';
  inputSeiyuId.value = item.seiyuItemId || '';
  modal.classList.remove('hidden');
  setTimeout(() => inputName.focus(), 100);
}

function closeModal() {
  modal.classList.add('hidden');
  editingItemId = null;
}

async function saveItem() {
  const name = inputName.value.trim();
  if (!name) {
    inputName.focus();
    inputName.style.borderColor = 'var(--color-danger)';
    return;
  }
  inputName.style.borderColor = '';

  if (editingItemId) {
    // 更新
    const item = items.find((i) => i.id === editingItemId);
    if (item) {
      item.name = name;
      item.unit = inputUnit.value.trim();
      item.amazonASIN = inputAsin.value.trim();
      item.seiyuItemId = inputSeiyuId.value.trim();
      if (db) await saveItemToFirebase(item);
      else saveLocal();
    }
  } else {
    // 追加
    const newItem = {
      id: genId(),
      name,
      unit: inputUnit.value.trim(),
      orderQty: 0,
      amazonASIN: inputAsin.value.trim(),
      seiyuItemId: inputSeiyuId.value.trim(),
      sortOrder: items.length,
    };
    if (db) {
      await db.collection('items').doc(newItem.id).set(newItem);
    } else {
      items.push(newItem);
      saveLocal();
      renderList();
    }
  }

  closeModal();
  if (!db) renderList();
}

addBtn.addEventListener('click', openAddModal);
addFirstBtn.addEventListener('click', openAddModal);
modalCancelBtn.addEventListener('click', closeModal);
modalSaveBtn.addEventListener('click', saveItem);
modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

// Enterキーで保存
inputName.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveItem(); });
inputUnit.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveItem(); });
inputAsin.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveItem(); });
inputSeiyuId.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveItem(); });

// ===== 削除モーダル =====
function openDeleteModal(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  deletingItemId = id;
  deleteModalName.textContent = `「${item.name}」を削除します。`;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  deletingItemId = null;
}

async function confirmDelete() {
  if (!deletingItemId) return;
  const id = deletingItemId;
  closeDeleteModal();

  if (db) {
    await deleteItemFromFirebase(id);
  } else {
    items = items.filter((i) => i.id !== id);
    saveLocal();
    renderList();
  }
}

deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteConfirmBtn.addEventListener('click', confirmDelete);
deleteModal.querySelector('.modal-backdrop').addEventListener('click', closeDeleteModal);

// ===== Amazon カート追加 =====
// Amazon は複数品目を1つのURLでまとめてカートに入れられる
function openAmazonAll() {
  const orderItems = items.filter((i) => i.orderQty > 0 && i.amazonASIN);
  if (orderItems.length === 0) {
    showToast('AmazonのASINが設定された品目がありません');
    return;
  }

  let url = 'https://www.amazon.co.jp/gp/aws/cart/add.html?';
  orderItems.forEach((item, idx) => {
    url += `ASIN.${idx + 1}=${encodeURIComponent(item.amazonASIN)}&Quantity.${idx + 1}=${item.orderQty}&`;
  });

  window.open(url.slice(0, -1), '_blank');
  showToast(`Amazon: ${orderItems.length}品目をカートに追加しました`);
}

function openAmazonSingle(id) {
  const item = items.find((i) => i.id === id);
  if (!item || !item.amazonASIN) {
    showToast('Amazon ASINが設定されていません（編集から追加できます）');
    return;
  }
  const url = `https://www.amazon.co.jp/gp/aws/cart/add.html?ASIN.1=${encodeURIComponent(item.amazonASIN)}&Quantity.1=${Math.max(1, item.orderQty)}`;
  window.open(url, '_blank');
}

// ===== 西友 カート追加 =====
// PC + Chrome拡張: ?__autoAdd=1&__qty=N でタブを開くと自動でカートに入る
// スマホ: 商品ページを開くだけ（手動で1タップ必要）
function openSeiyuAll() {
  const orderItems = items.filter((i) => i.orderQty > 0 && i.seiyuItemId);
  if (orderItems.length === 0) {
    showToast('西友の商品IDが設定された品目がありません');
    return;
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const delay = isMobile ? 800 : 1200; // 間隔（ms）

  orderItems.forEach((item, idx) => {
    setTimeout(() => {
      const url = buildSeiyuUrl(item);
      window.open(url, '_blank');
    }, idx * delay);
  });

  if (isMobile) {
    showToast(`西友: ${orderItems.length}品目の商品ページを開きました`);
  } else {
    showToast(`西友: ${orderItems.length}品目を自動でカートに追加中...`);
  }
}

function openSeiyuSingle(id) {
  const item = items.find((i) => i.id === id);
  if (!item || !item.seiyuItemId) {
    showToast('西友の商品IDが設定されていません（編集から追加できます）');
    return;
  }
  window.open(buildSeiyuUrl(item), '_blank');
}

function buildSeiyuUrl(item) {
  const base = `https://netsuper.rakuten.co.jp/seiyu/item/${encodeURIComponent(item.seiyuItemId)}/`;
  // Chrome拡張が検知するパラメータを付加
  return `${base}?__autoAdd=1&__qty=${Math.max(1, item.orderQty)}`;
}

// ===== カートボタン =====
amazonBtn.addEventListener('click', openAmazonAll);
seiyuBtn.addEventListener('click', openSeiyuAll);

// ===== ユーティリティ =====
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  // アニメーション再トリガー
  toast.style.animation = 'none';
  toast.offsetHeight; // reflow
  toast.style.animation = '';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

// 同期状態インジケーター
function setSyncState(state) {
  let indicator = document.querySelector('.sync-indicator');
  if (!indicator && db) {
    indicator = document.createElement('div');
    indicator.className = 'sync-indicator';
    document.body.appendChild(indicator);
  }
  if (!indicator) return;
  indicator.className = 'sync-indicator ' + state;
}

// ===== Service Worker登録 =====
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ===== 起動 =====
(function init() {
  initFirebase();
  loadItems();
  registerSW();
})();
