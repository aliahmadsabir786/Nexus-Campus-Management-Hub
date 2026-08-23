/* ================================================================
   js/notifications.js  —  Global toast / notification system
   ================================================================
   Spec §14–§15: ONE reusable notification system for the whole app.
   No browser alert() anywhere.

   Public API (used by every module):
       showToast('success' | 'error' | 'warning' | 'info', message, opts?)
       showToast(message)                       -> info toast
       showToast({type, title, message, ...})   -> object form

       notify.success(msg, opts)   notify.error(msg, opts)
       notify.warning(msg, opts)   notify.info(msg, opts)
       notify.fromError(err)       -> best-effort message from a fetch/JSON error
       notify.clear()              -> dismiss everything

   opts:
       title     : bold heading (defaults per type)
       duration  : ms before auto-dismiss (0 = sticky). Errors default longer.
       dismissible: show the ✕ button (default true)

   Design notes
     * The container lives on <body>, NOT inside #app, because state.js
       replaces #app.innerHTML on every render — a toast inside it would
       vanish mid-animation.
     * All colours come from CSS custom properties (static/css/ui.css), so
       light/dark mode is automatic (spec §29: notifications must be
       readable in dark mode).
     * Accessible: the stack is an aria-live region; errors are announced
       assertively, everything else politely (spec §45).
   ================================================================ */

const TOAST_MAX      = 4;      // more than this and the oldest is retired
const TOAST_DEFAULTS = {
  success: { icon: '✓', title: 'Success',     duration: 3200 },
  error:   { icon: '!', title: 'Error',       duration: 6000 },
  warning: { icon: '▲', title: 'Warning',     duration: 4800 },
  info:    { icon: 'i', title: 'Information', duration: 3600 },
};

let _toastSeq   = 0;
const _toasts   = new Map();   // id -> {el, timer, key}
let _lastToast  = { key: '', at: 0 };

/* ── Container (created once, re-created if the DOM was wiped) ── */
function _toastRoot() {
  let root = document.getElementById('nx-toasts');
  if (!root || !document.body.contains(root)) {
    root = document.createElement('div');
    root.id = 'nx-toasts';
    root.className = 'nx-toasts';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(root);
  }
  return root;
}

function _dismissToast(id) {
  const rec = _toasts.get(id);
  if (!rec) return;
  clearTimeout(rec.timer);
  _toasts.delete(id);
  rec.el.classList.add('is-leaving');
  // Remove after the exit transition; also guard against a missed event.
  const drop = () => { if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); };
  rec.el.addEventListener('transitionend', drop, { once: true });
  setTimeout(drop, 400);
}

/* ── The one public entry point ── */
function showToast(type, message, opts) {
  // Flexible signatures: showToast('msg'), showToast({...}), showToast(type,msg)
  if (type && typeof type === 'object') {
    opts = type; message = opts.message; type = opts.type;
  } else if (message === undefined && typeof type === 'string') {
    message = type; type = 'info';
  } else if (typeof type === 'string' && typeof message === 'string'
             && !TOAST_DEFAULTS[type.toLowerCase()]
             && TOAST_DEFAULTS[message.toLowerCase()]) {
    // Reversed order — the older module-local helpers were written as
    // toast(message, type). Tolerate it so no call site reports the word
    // "success" as its message.
    const t = message; message = type; type = t;
  }
  opts = opts || {};
  type = String(type || 'info').toLowerCase();
  if (!TOAST_DEFAULTS[type]) type = 'info';

  const preset = TOAST_DEFAULTS[type];
  const text   = String(message == null ? '' : message).trim();
  if (!text) return null;

  // Collapse a duplicate fired twice in quick succession (double submit, a
  // loop that reports per row) instead of stacking identical cards.
  const key = type + '|' + text;
  const now = Date.now();
  if (key === _lastToast.key && now - _lastToast.at < 900) return null;
  _lastToast = { key, at: now };

  const root = _toastRoot();
  while (_toasts.size >= TOAST_MAX) _dismissToast(_toasts.keys().next().value);

  const id    = 'nx-toast-' + (++_toastSeq);
  const title = opts.title === undefined ? preset.title : opts.title;
  const dur   = opts.duration === undefined ? preset.duration : Number(opts.duration);
  const canX  = opts.dismissible !== false;

  const el = document.createElement('div');
  el.className = 'nx-toast nx-toast--' + type;
  el.id = id;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML =
    '<span class="nx-toast__icon" aria-hidden="true">' + preset.icon + '</span>' +
    '<div class="nx-toast__body">' +
      (title ? '<div class="nx-toast__title">' + esc(title) + '</div>' : '') +
      '<div class="nx-toast__msg">' + esc(text) + '</div>' +
    '</div>' +
    (canX ? '<button class="nx-toast__x" type="button" aria-label="Dismiss notification">&#10005;</button>' : '');

  if (canX) el.querySelector('.nx-toast__x').addEventListener('click', () => _dismissToast(id));

  const rec = { el, timer: null, key };
  _toasts.set(id, rec);
  root.appendChild(el);
  // Force a frame so the entry transition actually plays.
  requestAnimationFrame(() => el.classList.add('is-in'));

  if (dur > 0) {
    rec.timer = setTimeout(() => _dismissToast(id), dur);
    // Reading a long message should not race the timer.
    el.addEventListener('mouseenter', () => clearTimeout(rec.timer));
    el.addEventListener('mouseleave', () => { rec.timer = setTimeout(() => _dismissToast(id), 1600); });
  }
  return id;
}

/* ── Convenience wrappers ── */
const notify = {
  success: (m, o) => showToast('success', m, o),
  error:   (m, o) => showToast('error',   m, o),
  warning: (m, o) => showToast('warning', m, o),
  info:    (m, o) => showToast('info',    m, o),

  /**
   * Report a failed request without leaking internals.
   * Accepts an Error, a fetch Response payload, or a plain string.
   */
  fromError(err, fallback) {
    let msg = fallback || 'Something went wrong. Please try again.';
    if (typeof err === 'string' && err.trim()) msg = err.trim();
    else if (err && typeof err === 'object') {
      if (err.error)        msg = String(err.error);
      else if (err.message) msg = String(err.message);
    }
    return showToast('error', msg);
  },

  clear() { Array.from(_toasts.keys()).forEach(_dismissToast); },
};

/* Escape hatch for inline handlers written as strings. */
window.showToast = showToast;
window.notify    = notify;
