/* ================================================================
   js/modal.js  —  Global modal / dialog system
   ================================================================
   Spec §16–§20 and §48: ONE reusable, centred, accessible dialog used by
   every Add / Edit / View / Delete flow. No browser confirm() anywhere.

   Public API
     showModal({...})        -> opens a dialog, returns its id
     closeModal()            -> closes the top-most dialog
     confirmAction({...})    -> Promise<boolean>, a proper confirmation dialog
     paintModal()            -> repaints ONLY the legacy modal host (§22: no
                                full re-render just to open/close a dialog)
     setBusy(el, on, label)  -> loading state on a button (§23)
     withBusy(el, fn)        -> runs fn with the button locked, so a double
                                click cannot submit twice (§23)

   showModal options
     title        heading text                       (required-ish)
     subtitle     small line under the heading
     body         HTML string for the scrollable body
     icon         glyph shown in the header badge
     tone         'default' | 'danger' | 'warning' | 'success'
     size         'sm' | 'md' | 'lg' | 'xl'          (default 'md')
     actions      [{label, tone:'primary'|'ghost'|'danger', onClick, close, id}]
     dismissible  false -> no ✕, no backdrop click, no ESC (default true)
     onClose      callback fired after the dialog leaves

   Why this file loads LAST
     `closeModal` and `openModal` already exist (state.js, modals.js). This
     file captures those originals and wraps them, so every one of the ~20
     existing `openModal('addStudent')` call sites keeps working while
     silently gaining focus management, ESC, scroll lock and — importantly —
     a targeted repaint instead of rebuilding the whole shell.
   ================================================================ */

(function () {
  'use strict';

  /* ── Originals, captured before we shadow them ── */
  const _legacyClose  = typeof window.closeModal === 'function' ? window.closeModal : null;
  const _legacyOpen   = typeof window.openModal  === 'function' ? window.openModal  : null;
  const _realRender   = typeof window.render     === 'function' ? window.render     : null;

  const _stack = [];          // open ad-hoc dialogs, top-most last
  let   _seq   = 0;
  let   _restoreFocus = null;  // element focused before the first dialog opened

  const TONE_GLYPH = {
    default: '',
    danger:  '🗑',
    warning: '⚠',
    success: '✓',
  };

  /* ================================================================
     Body scroll lock — shared by ad-hoc dialogs AND the legacy modal
     ================================================================ */
  function _syncBodyLock() {
    const legacyOpen = !!(typeof modalState !== 'undefined' && modalState);
    const anyOpen    = _stack.length > 0 || legacyOpen;
    document.body.classList.toggle('nx-modal-open', anyOpen);
  }

  /* ================================================================
     Focus management (spec §18, §45)
     ================================================================ */
  function _focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
        'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ),
      el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
    );
  }

  function _focusFirst(root) {
    // Prefer the first real field so the user can start typing immediately;
    // fall back to the first button (a confirmation dialog has no fields).
    const field = root.querySelector(
      'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled])'
    );
    const target = field || root.querySelector('.nx-btn--primary,.nx-btn--danger') || root;
    try { target.focus({ preventScroll: true }); } catch (_) { /* older browsers */ }
  }

  function _trapTab(e, panel) {
    if (e.key !== 'Tab') return;
    const items = _focusables(panel);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ================================================================
     showModal
     ================================================================ */
  function showModal(opts) {
    opts = opts || {};
    if (!_stack.length && !document.body.classList.contains('nx-modal-open')) {
      _restoreFocus = document.activeElement;
    }

    const id    = 'nx-modal-' + (++_seq);
    const tone  = opts.tone || 'default';
    const size  = opts.size || 'md';
    const canX  = opts.dismissible !== false;
    const icon  = opts.icon !== undefined ? opts.icon : TONE_GLYPH[tone];
    const acts  = Array.isArray(opts.actions) ? opts.actions : [];

    const overlay = document.createElement('div');
    overlay.className = 'nx-modal';
    overlay.id = id;

    const sizeCls = size === 'md' ? '' : ' nx-modal__panel--' + size;
    const toneCls = tone === 'default' ? '' : ' nx-modal__panel--' + tone;

    overlay.innerHTML =
      '<div class="nx-modal__panel' + sizeCls + toneCls + '" role="dialog" aria-modal="true"' +
        ' aria-labelledby="' + id + '-t">' +
        '<div class="nx-modal__head">' +
          (icon ? '<div class="nx-modal__glyph' +
                  (tone === 'default' ? '' : ' nx-modal__glyph--' + tone) +
                  '" aria-hidden="true">' + icon + '</div>' : '') +
          '<div class="nx-modal__title" id="' + id + '-t">' + esc(opts.title || '') +
            (opts.subtitle ? '<div class="nx-modal__sub">' + esc(opts.subtitle) + '</div>' : '') +
          '</div>' +
          (canX ? '<button type="button" class="nx-modal__x" data-nx-close aria-label="Close dialog">&#10005;</button>' : '') +
        '</div>' +
        '<div class="nx-modal__body">' + (opts.body || '') + '</div>' +
        (acts.length ? '<div class="nx-modal__foot"></div>' : '') +
      '</div>';

    const panel = overlay.firstElementChild;
    const foot  = overlay.querySelector('.nx-modal__foot');

    // Buttons are built as real elements so onClick stays a function reference
    // (no string handlers, nothing to escape, nothing global to leak).
    acts.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nx-btn nx-btn--' + (a.tone || (i === acts.length - 1 ? 'primary' : 'ghost'));
      b.textContent = a.label || 'OK';
      if (a.id) b.id = a.id;
      b.addEventListener('click', async () => {
        let keep = false;
        if (typeof a.onClick === 'function') {
          // An action may return false to keep the dialog open (validation).
          keep = (await withBusy(b, () => a.onClick(rec))) === false;
        }
        if (a.close !== false && !keep) _close(id);
      });
      foot.appendChild(b);
    });

    const rec = { id, overlay, panel, onClose: opts.onClose };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && canX) _close(id);
    });
    overlay.querySelectorAll('[data-nx-close]').forEach(el =>
      el.addEventListener('click', () => _close(id)));

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && canX) { e.stopPropagation(); _close(id); }
      else _trapTab(e, panel);
    });

    document.body.appendChild(overlay);
    _stack.push(rec);
    _syncBodyLock();
    requestAnimationFrame(() => {
      overlay.classList.add('is-in');
      _focusFirst(panel);
    });
    return id;
  }

  function _close(id) {
    const idx = id ? _stack.findIndex(r => r.id === id) : _stack.length - 1;
    if (idx < 0) return false;
    const rec = _stack.splice(idx, 1)[0];
    rec.overlay.classList.remove('is-in');
    const drop = () => {
      if (rec.overlay.parentNode) rec.overlay.parentNode.removeChild(rec.overlay);
      _syncBodyLock();
      if (typeof rec.onClose === 'function') rec.onClose();
      if (!_stack.length && _restoreFocus && document.body.contains(_restoreFocus)) {
        try { _restoreFocus.focus({ preventScroll: true }); } catch (_) {}
        _restoreFocus = null;
      }
    };
    rec.overlay.addEventListener('transitionend', drop, { once: true });
    setTimeout(drop, 320);   // guard: transitionend can be skipped
    return true;
  }

  /* ================================================================
     confirmAction — the replacement for window.confirm  (spec §19)
     ================================================================
     Awaitable, so an existing `if (!confirm(...)) return;` becomes
     `if (!await confirmAction({...})) return;` with no other change.
     ================================================================ */
  function confirmAction(opts) {
    if (typeof opts === 'string') opts = { message: opts };
    opts = opts || {};
    const tone = opts.tone || 'danger';

    return new Promise((resolve) => {
      let answered = false;
      const settle = (v) => { if (!answered) { answered = true; resolve(v); } };

      showModal({
        title:    opts.title || (tone === 'danger' ? 'Confirm deletion' : 'Please confirm'),
        subtitle: opts.subtitle || '',
        tone:     tone,
        size:     'sm',
        icon:     opts.icon !== undefined ? opts.icon : TONE_GLYPH[tone],
        body:
          '<p>' + esc(opts.message || 'Are you sure you want to continue?').replace(/\n/g, '<br>') + '</p>' +
          (opts.note ? '<div class="nx-modal__note">' + esc(opts.note) + '</div>' : ''),
        actions: [
          { label: opts.cancelLabel || 'Cancel', tone: 'ghost',
            onClick: () => settle(false) },
          { label: opts.confirmLabel || (tone === 'danger' ? 'Delete' : 'Confirm'),
            tone: tone === 'danger' ? 'danger' : 'primary',
            onClick: () => settle(true) },
        ],
        onClose: () => settle(false),   // ESC / ✕ / backdrop == cancel
      });
    });
  }

  /* ================================================================
     LEGACY MODAL BRIDGE  (spec §22: stop re-rendering the whole shell)
     ================================================================
     renderShell() ends with <div id="legacy-modal-host">${renderModal()}</div>.
     Opening or closing one of the older `modalState` dialogs now repaints
     only that host — the sidebar, header and page keep their DOM, their
     scroll position and their focus.
     ================================================================ */
  function paintModal() {
    const host = document.getElementById('legacy-modal-host');
    if (!host) {                       // pre-login, or shell not built yet
      if (_realRender) _realRender();
      return;
    }
    host.innerHTML = (typeof renderModal === 'function') ? renderModal() : '';
    _syncBodyLock();
    const panel = host.querySelector('.modal-panel, [data-modal-panel]');
    if (panel) {
      _restoreFocus = _restoreFocus || document.activeElement;
      requestAnimationFrame(() => _focusFirst(panel));
    } else if (_restoreFocus && document.body.contains(_restoreFocus)) {
      try { _restoreFocus.focus({ preventScroll: true }); } catch (_) {}
      _restoreFocus = null;
    }
  }

  /** Run `fn`, and if it calls render(), redirect that to paintModal(). */
  function _scoped(fn) {
    if (!_realRender) { fn(); paintModal(); return; }
    let redirected = false;
    window.render = function () { redirected = true; paintModal(); };
    try { fn(); } finally { window.render = _realRender; }
    if (!redirected) paintModal();
  }

  /* ── openModal: same behaviour, targeted repaint ── */
  if (_legacyOpen) {
    window.openModal = function (type, arg2, arg3) {
      _scoped(() => _legacyOpen.call(window, type, arg2, arg3));
    };
  }

  /* ── closeModal: one entry point for BOTH systems ── */
  window.closeModal = function () {
    if (_close()) return;                       // an ad-hoc dialog was on top
    if (typeof modalState !== 'undefined' && modalState && _legacyClose) {
      _scoped(() => _legacyClose.call(window));
      return;
    }
    if (_legacyClose) _legacyClose.call(window);
  };

  /* ── ESC closes the legacy modal too (spec §18) ── */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (_stack.length) return;                  // its own handler deals with it
    if (typeof modalState !== 'undefined' && modalState) window.closeModal();
  });

  /* ================================================================
     LOADING STATES  (spec §23)
     ================================================================ */
  function setBusy(el, on, label) {
    el = typeof el === 'string' ? document.getElementById(el) : el;
    if (!el) return;
    if (on) {
      if (el.dataset.nxBusy === '1') return;
      el.dataset.nxBusy  = '1';
      el.dataset.nxLabel = el.innerHTML;
      el.disabled = true;
      el.setAttribute('aria-busy', 'true');
      el.innerHTML = '<span class="nx-spin" aria-hidden="true"></span>' +
                     '<span>' + esc(label || 'Please wait…') + '</span>';
    } else {
      if (el.dataset.nxBusy !== '1') return;
      el.disabled = false;
      el.removeAttribute('aria-busy');
      if (el.dataset.nxLabel !== undefined) el.innerHTML = el.dataset.nxLabel;
      delete el.dataset.nxBusy;
      delete el.dataset.nxLabel;
    }
  }

  /**
   * Lock a button for the duration of an async call. A second click while the
   * first request is in flight is dropped, so nothing is ever created twice.
   */
  async function withBusy(el, fn, label) {
    el = typeof el === 'string' ? document.getElementById(el) : el;
    if (el && el.dataset && el.dataset.nxBusy === '1') return undefined;
    setBusy(el, true, label);
    try {
      return await fn();
    } finally {
      // The element may have been removed with the modal it lived in.
      if (el && document.body.contains(el)) setBusy(el, false);
      else if (el) { delete el.dataset.nxBusy; }
    }
  }

  /**
   * Same guard, keyed on a name instead of an element — for handlers fired
   * from inline onclick where no button reference is at hand.
   */
  const _inflight = new Set();
  async function once(key, fn) {
    if (_inflight.has(key)) return undefined;
    _inflight.add(key);
    try { return await fn(); }
    finally { _inflight.delete(key); }
  }

  /* ================================================================
     SKELETONS  (spec §24)
     ================================================================ */
  function skeletonCards(n) {
    let h = '<div class="nx-skel-grid">';
    for (let i = 0; i < (n || 4); i++) h += '<div class="nx-skel nx-skel--card"></div>';
    return h + '</div>';
  }
  function skeletonRows(n) {
    let h = '<div class="nx-skel nx-skel--title"></div>';
    for (let i = 0; i < (n || 6); i++) h += '<div class="nx-skel nx-skel--row"></div>';
    return h;
  }
  function skeletonPage() {
    return '<div style="padding:4px">' + skeletonCards(4) +
           '<div style="background:var(--surface);border:1px solid var(--border);' +
           'border-radius:16px;padding:20px">' + skeletonRows(6) + '</div></div>';
  }

  /* ── Exports ── */
  window.showModal      = showModal;
  window.confirmAction  = confirmAction;
  window.paintModal     = paintModal;
  window.setBusy        = setBusy;
  window.withBusy       = withBusy;
  window.nxOnce         = once;
  window.skeletonCards  = skeletonCards;
  window.skeletonRows   = skeletonRows;
  window.skeletonPage   = skeletonPage;
})();
