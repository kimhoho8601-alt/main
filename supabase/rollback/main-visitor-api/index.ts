import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function kstDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return map.year + "-" + map.month + "-" + map.day;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration error" }, 500);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch {}
  const action = String(payload.action || "");

  async function requireAdmin() {
    const adminCode = Deno.env.get("CASE_RELATION_ADMIN_CODE") || "";
    if (!adminCode || String(payload.adminCode || "") !== adminCode) {
      throw Object.assign(new Error("관리자 코드가 올바르지 않습니다."), { status: 401 });
    }
  }

  async function getNotice() {
    const result = await supabase
      .from("main_notice")
      .select("title,body,is_active,updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data || { title: "", body: "", is_active: false, updated_at: null };
  }

  async function getFeedback() {
    const result = await supabase
      .from("main_feedback")
      .select("id,message,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getStats() {
    const today = kstDateString();
    const [todayResult, totalResult, visitsResult] = await Promise.all([
      supabase.from("main_visitor_daily").select("ip_hash", { count: "exact", head: true }).eq("visit_date", today),
      supabase.from("main_visitor_unique").select("ip_hash", { count: "exact", head: true }),
      supabase.from("main_visitor_daily").select("ip_hash", { count: "exact", head: true }),
    ]);
    if (todayResult.error) throw todayResult.error;
    if (totalResult.error) throw totalResult.error;
    if (visitsResult.error) throw visitsResult.error;
    return {
      today: todayResult.count || 0,
      total: totalResult.count || 0,
      visits: visitsResult.count || 0,
    };
  }

  try {
    if (action === "visit") {
      const visitorId = String(payload.visitorId || "").trim();
      if (!/^[a-zA-Z0-9-]{20,80}$/.test(visitorId)) return json({ error: "Invalid visitor id" }, 400);
      const today = kstDateString();

      const daily = await supabase
        .from("main_visitor_daily")
        .upsert({ visit_date: today, ip_hash: visitorId }, { onConflict: "visit_date,ip_hash", ignoreDuplicates: true });
      if (daily.error) throw daily.error;

      const unique = await supabase
        .from("main_visitor_unique")
        .upsert({ ip_hash: visitorId }, { onConflict: "ip_hash", ignoreDuplicates: true });
      if (unique.error) throw unique.error;

      return json({ ok: true, notice: await getNotice() });
    }

    if (action === "public") {
      return json({ ok: true, notice: await getNotice() });
    }

    if (action === "submitFeedback") {
      const message = String(payload.message || "").trim().slice(0, 1500);
      if (!message) return json({ error: "의견 내용을 입력해주세요." }, 400);
      const result = await supabase.from("main_feedback").insert({ message });
      if (result.error) throw result.error;
      return json({ ok: true });
    }

    if (action === "admin") {
      await requireAdmin();
      const [stats, notice, feedback] = await Promise.all([getStats(), getNotice(), getFeedback()]);
      return json({ ok: true, stats, notice, feedback });
    }

    if (action === "saveNotice") {
      await requireAdmin();
      const result = await supabase.from("main_notice").upsert({
        id: 1,
        title: String(payload.title || "").trim().slice(0, 80),
        body: String(payload.body || "").trim().slice(0, 2000),
        is_active: Boolean(payload.isActive),
        updated_at: new Date().toISOString(),
      });
      if (result.error) throw result.error;
      const [stats, notice, feedback] = await Promise.all([getStats(), getNotice(), getFeedback()]);
      return json({ ok: true, stats, notice, feedback });
    }

    if (action === "deleteFeedback") {
      await requireAdmin();
      const id = Number(payload.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "삭제할 의견을 확인할 수 없습니다." }, 400);
      const result = await supabase.from("main_feedback").delete().eq("id", id);
      if (result.error) throw result.error;
      return json({ ok: true, feedback: await getFeedback() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, status);
  }
});
