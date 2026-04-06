// ============================================================
// 買い物リスト - 西友ネットスーパー 自動カート追加スクリプト
// ============================================================
// アプリが ?__autoAdd=1&__qty=N を付けてページを開いた時のみ動作します
// ============================================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('__autoAdd') !== '1') return;

  const targetQty = Math.max(1, parseInt(params.get('__qty') || '1', 10));

  // ページが完全に読み込まれてから実行
  function run() {
    if (setQuantity(targetQty)) {
      // 数量設定後、少し待ってからカートボタンをクリック
      setTimeout(() => clickCartButton(), 400);
    } else {
      clickCartButton();
    }
  }

  // ===== 数量入力 =====
  function setQuantity(qty) {
    if (qty <= 1) return false;

    // よくある数量入力パターンを試す
    const selectors = [
      'input[type="number"][name*="quantity"]',
      'input[type="number"][name*="qty"]',
      'input[type="number"][id*="quantity"]',
      'input[type="number"][id*="qty"]',
      'input[type="number"]',
      'select[name*="quantity"]',
      'select[name*="qty"]',
      'select[id*="quantity"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, qty);
        } else {
          el.value = qty;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // ===== カートボタンを探してクリック =====
  function clickCartButton() {
    const btn = findCartButton();
    if (btn) {
      btn.click();
      // クリック後2秒待ってからタブを閉じる
      setTimeout(() => {
        // タブを閉じられるのは window.open で開かれた場合のみ
        try { window.close(); } catch (e) {}
      }, 2000);
      showAddedBanner();
      return true;
    }
    return false;
  }

  function findCartButton() {
    // 1. data属性ベースのセレクター（React/Next.jsアプリによくある）
    const dataSelectors = [
      '[data-testid*="add-to-cart"]',
      '[data-testid*="cart-button"]',
      '[data-testid*="addToCart"]',
      '[data-cy*="add-to-cart"]',
      '[aria-label*="カートに入れ"]',
      '[aria-label*="かごに入れ"]',
      '[aria-label*="カートへ"]',
    ];
    for (const sel of dataSelectors) {
      const el = document.querySelector(sel);
      if (el && !el.disabled) return el;
    }

    // 2. テキストで探す（最も確実）
    const cartTexts = [
      'カートに入れる',
      'かごに入れる',
      'カートへ入れる',
      '買い物かごに入れる',
      'カートに追加',
      'かごに追加',
      'カートへ追加',
      'カートに入れ',
    ];

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
    for (const btn of buttons) {
      const text = btn.textContent?.trim() ?? '';
      if (cartTexts.some((t) => text.includes(t))) {
        if (!btn.disabled && !btn.getAttribute('aria-disabled')) {
          return btn;
        }
      }
    }

    return null;
  }

  // ===== 追加完了バナー表示 =====
  function showAddedBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #0a9e50;
      color: white;
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 15px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      font-family: -apple-system, sans-serif;
      pointer-events: none;
    `;
    banner.textContent = '✓ カートに追加しました';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  }

  // ===== 実行タイミング =====
  // Reactアプリはハイドレーション後にDOMが確定するため、
  // MutationObserverでカートボタンの出現を待つ

  let attempts = 0;
  const MAX_ATTEMPTS = 30; // 最大15秒待つ

  function tryWithRetry() {
    const btn = findCartButton();
    if (btn) {
      run();
      return;
    }
    attempts++;
    if (attempts < MAX_ATTEMPTS) {
      setTimeout(tryWithRetry, 500);
    }
    // タイムアウト: カートボタンが見つからなかった場合は何もしない
  }

  // DOMContentLoaded後に開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryWithRetry, 300));
  } else {
    setTimeout(tryWithRetry, 300);
  }
})();
