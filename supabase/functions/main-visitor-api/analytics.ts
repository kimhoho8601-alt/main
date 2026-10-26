export const TOOLS = ['family-tree', 'sign', 'convert', 'photo'];
export function validateEvent(p: Record<string, unknown>) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(p.eventId || '')) ||
      !/^[a-zA-Z0-9-]{20,80}$/.test(String(p.visitorId || ''))) throw new Error('Invalid event identity');
  if (!['main_view', 'tool_click', 'service_view'].includes(String(p.kind)) ||
      (p.kind === 'main_view' ? p.tool != null : !TOOLS.includes(String(p.tool)))) throw new Error('Invalid event type');
  return { event_id: p.eventId, visitor_id: p.visitorId, kind: p.kind, tool: p.tool ?? null };
}
export function validateRange(p: Record<string, unknown>) {
  const date = (v: unknown) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) throw new Error('날짜 형식을 확인해주세요.');
    return v;
  };
  const start = date(p.start), end = date(p.end);
  if ((start === null) !== (end === null) || (start && end && start > end)) throw new Error('조회 기간을 확인해주세요.');
  return { p_start: start, p_end: end };
}
