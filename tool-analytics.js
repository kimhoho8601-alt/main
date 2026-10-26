/* Shared across the five repositories. First-party browser identifier; no case/file content. */
(() => {
  if (window.WorkToolsAnalytics) return;
  const api = 'https://tedbkobhltarqibjhfhk.supabase.co/functions/v1/main-visitor-api';
  const key = 'work-tools-main-visitor-v1';
  let visitorId;
  try { visitorId = localStorage.getItem(key); } catch {}
  if (!visitorId || !/^[a-zA-Z0-9-]{20,80}$/.test(visitorId)) {
    visitorId = crypto.randomUUID();
    try { localStorage.setItem(key, visitorId); } catch {}
  }
  function record(kind, tool = null) {
    const body = JSON.stringify({ action: 'trackEvent', eventId: crypto.randomUUID(), visitorId, kind, tool });
    // Retry only with the same event ID: the database primary key makes delivery idempotent.
    const send = () => fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    send().then(r => { if (r.status >= 500) return send(); }).catch(() => send()).catch(() => {});
  }
  window.WorkToolsAnalytics = { visitorId, record };
  const tool = document.currentScript?.dataset.tool;
  if (tool === 'main') {
    record('main_view');
    const click = e => {
      if ((e.type === 'click' && e.button !== 0) || (e.type === 'auxclick' && e.button !== 1)) return;
      if (e.defaultPrevented || e.target.closest('button,.reorder-handle')) return;
      const card = e.target.closest('a.app-card[data-tool]');
      if (card) record('tool_click', card.dataset.tool);
    };
    // Bubble to window so existing drag/reorder handlers can cancel navigation first.
    window.addEventListener('click', click);
    window.addEventListener('auxclick', click);
  } else if (['family-tree', 'sign', 'convert', 'photo'].includes(tool)) {
    record('service_view', tool);
  }
})();
