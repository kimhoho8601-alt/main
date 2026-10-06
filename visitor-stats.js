(() => {
  const api = 'https://tedbkobhltarqibjhfhk.supabase.co/functions/v1/main-visitor-api';
  const key = 'work-tools-main-visitor-v1';

  function id() {
    let v = '';
    try { v = localStorage.getItem(key) || ''; } catch {}
    if (!v) {
      v = crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      try { localStorage.setItem(key, v); } catch {}
    }
    return v;
  }

  async function call(body) {
    const r = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '요청에 실패했습니다.');
    return data;
  }

  function dialog() {
    let d = document.getElementById('visitorStatsDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'visitorStatsDialog';
    d.style.cssText = 'border:0;border-radius:20px;padding:0;width:min(680px,calc(100vw - 28px));box-shadow:0 30px 90px rgba(0,0,0,.28)';
    d.innerHTML = '<div style="padding:28px;font-family:Noto Sans KR,sans-serif"><div style="display:flex;justify-content:space-between;align-items:start;gap:20px"><div><div style="color:#e52329;font-size:11px;font-weight:800;letter-spacing:.14em">VISITOR STATS</div><h2 style="margin:5px 0 0;font-size:26px">WORK TOOLS 접속 현황</h2></div><button id="visitorStatsClose" style="border:0;background:#f1efef;border-radius:10px;width:36px;height:36px;font-size:24px;cursor:pointer">×</button></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px"><div class="vstat"><span>오늘 방문자</span><strong id="vToday">0</strong></div><div class="vstat"><span>누적 방문자</span><strong id="vTotal">0</strong></div><div class="vstat"><span>누적 방문 횟수</span><strong id="vVisits">0</strong></div></div><p style="margin:16px 0 0;padding:13px 14px;background:#f5f3f3;border-radius:12px;color:#756d6e;font-size:11px;line-height:1.6">브라우저에 생성된 익명 ID로 집계합니다. 같은 브라우저의 하루 방문은 1회로 계산됩니다.</p></div>';
    const style = document.createElement('style');
    style.textContent = '#visitorStatsDialog::backdrop{background:rgba(24,15,18,.52);backdrop-filter:blur(2px)}#visitorStatsDialog .vstat{padding:20px;border:1px solid #d9d9d5;border-radius:16px;background:#fff}#visitorStatsDialog .vstat span{display:block;color:#747474;font-size:11px;font-weight:700;margin-bottom:9px}#visitorStatsDialog .vstat strong{display:block;color:#e52329;font-size:34px;font-weight:800}@media(max-width:560px){#visitorStatsDialog>div>div:nth-child(2){grid-template-columns:1fr!important}}';
    document.head.appendChild(style);
    document.body.appendChild(d);
    d.querySelector('#visitorStatsClose').onclick = () => d.close();
    return d;
  }

  async function openStats() {
    const code = prompt('관리자 코드를 입력하세요.');
    if (!code) return;
    try {
      const data = await call({ action: 'admin', adminCode: code });
      const d = dialog();
      d.querySelector('#vToday').textContent = Number(data.stats?.today || 0).toLocaleString('ko-KR');
      d.querySelector('#vTotal').textContent = Number(data.stats?.total || 0).toLocaleString('ko-KR');
      d.querySelector('#vVisits').textContent = Number(data.stats?.visits || 0).toLocaleString('ko-KR');
      d.showModal();
    } catch (e) {
      alert(e.message || '관리자 코드를 확인해주세요.');
    }
  }

  const mark = document.querySelector('.brand-mark');
  if (mark) mark.addEventListener('dblclick', e => {
    e.preventDefault();
    e.stopPropagation();
    openStats();
  });

  call({ action: 'visit', visitorId: id() }).catch(() => {});
})();