(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  if (params.get('__autoAdd') !== '1') return;
  const targetQty = Math.max(1, parseInt(params.get('__qty') || '1', 10));

  function run() {
    if (setQuantity(targetQty)) { setTimeout(() => clickCartButton(), 400); }
    else { clickCartButton(); }
  }

  function setQuantity(qty) {
    if (qty <= 1) return false;
    const selectors = ['input[type="number"][name*="quantity"]','input[type="number"][name*="qty"]','input[type="number"][id*="quantity"]','input[type="number"][id*="qty"]','input[type="number"]','select[name*="quantity"]','select[name*="qty"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, qty); else el.value = qty;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function clickCartButton() {
    const btn = findCartButton();
    if (btn) {
      btn.click();
      setTimeout(() => { try { window.close(); } catch (e) {} }, 2000);
      showBanner();
      return true;
    }
    return false;
  }

  function findCartButton() {
    const dataSelectors = ['[data-testid*="add-to-cart"]','[data-testid*="cart-button"]','[data-testid*="addToCart"]','[aria-label*="カートに入れ"]','[aria-label*="かごに入れ"]'];
    for (const sel of dataSelectors) { const el = document.querySelector(sel); if (el && !el.disabled) return el; }
    const cartTexts = ['カートに入れる','かごに入れる','カートへ入れる','買い物かごに入れる','カートに追加','かごに追加','カートへ追加'];
    for (const btn of document.querySelectorAll('button, [role="button"], a')) {
      const text = btn.textContent?.trim() ?? '';
      if (cartTexts.some(t => text.includes(t)) && !btn.disabled && !btn.getAttribute('aria-disabled')) return btn;
    }
    return null;
  }

  function showBanner() {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#0a9e50;color:white;padding:12px 24px;border-radius:24px;font-size:15px;font-weight:bold;z-index:999999;box-shadow:0 4px 16px rgba(0,0,0,0.2);font-family:-apple-system,sans-serif;pointer-events:none;';
    b.textContent = '✓ カートに追加しました';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2500);
  }

  let attempts = 0;
  function tryWithRetry() {
    if (findCartButton()) { run(); return; }
    if (++attempts < 30) setTimeout(tryWithRetry, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(tryWithRetry, 300));
  else setTimeout(tryWithRetry, 300);
})();
