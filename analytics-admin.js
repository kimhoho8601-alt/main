(() => {
  const names = { 'family-tree': '가계도·생태도', sign: '서명·도장 만들기', convert: '문서 변환기', photo: '사진 정리', main: '메인 홈페이지' };
  const num = v => Number(v || 0).toLocaleString('ko-KR');
  const kstToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const previousDay = day => new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0,10);
  window.mountToolAnalytics = (dialog, call, getCode) => {
    if (dialog.querySelector('#toolAnalytics')) return;
    const panel = document.createElement('section');
    panel.id = 'toolAnalytics'; panel.className = 'wt-admin-panel wt-analytics';
    panel.innerHTML = `<h3>기능별 이용 통계</h3>
      <p>고유 이용자는 같은 브라우저 기준입니다. 인기 순위는 실제 서비스의 고유 이용자 수 기준이며 동률은 같은 순위입니다.</p>
      <div class="analytics-filters">
        <label>기간 <select id="analyticsPeriod"><option value="7">최근 7일</option><option value="today">오늘</option><option value="30">최근 30일</option><option value="all">수집 이후 전체</option><option value="custom">직접 선택</option></select></label>
        <label>시작일 <input type="date" id="analyticsStart"></label>
        <label>종료일 <input type="date" id="analyticsEnd"></label>
        <button type="button" class="wt-btn primary" id="analyticsLoad">조회</button>
      </div>
      <div id="analyticsStatus" class="wt-status" role="status" aria-live="polite"></div>
      <div id="analyticsResults" hidden>
        <p id="analyticsMain"></p><p id="analyticsWinner"></p>
        <div class="analytics-scroll"><table><caption>선택 기간 기능별 순위</caption><thead><tr><th>순위</th><th>기능</th><th>서비스 접속 횟수</th><th>서비스 고유 이용자</th><th>메인 버튼 클릭 횟수</th><th>클릭 고유 이용자</th></tr></thead><tbody id="analyticsTools"></tbody></table></div>
        <details><summary>일자별 현황 보기</summary><div class="analytics-scroll"><table><caption>한국 시간 기준 · 기록이 없는 날짜는 0건</caption><thead><tr><th>날짜</th><th>기능</th><th>구분</th><th>횟수</th><th>고유 이용자</th></tr></thead><tbody id="analyticsDaily"></tbody></table></div></details>
      </div>
      <p class="analytics-help">클릭은 메인 카드의 왼쪽·가운데 버튼 및 키보드 열기, 접속은 각 페이지의 추적 코드가 실행된 횟수입니다. 직접 접속도 포함하며 새로고침은 새 접속입니다. 한 요청의 재전송은 중복 집계하지 않습니다. 접속은 작업 완료를 뜻하지 않습니다. 브라우저·기기가 다르거나 저장소를 삭제하면 별도로 집계됩니다. 일별 고유 수의 합은 기간 전체 고유 수와 다릅니다. 수집 이전 기능별 기록은 제공하지 않습니다.</p>`;
    dialog.querySelector('.wt-stats').after(panel);
    const q = s => panel.querySelector(s);
    const setPeriod = () => {
      const value = q('#analyticsPeriod').value;
      q('#analyticsStart').disabled = q('#analyticsEnd').disabled = value !== 'custom';
      if (value === 'custom') return;
      if (value === 'all') { q('#analyticsStart').value = q('#analyticsEnd').value = ''; return; }
      let start = kstToday();
      for (let i=1; i < (Number(value) || 1); i++) start = previousDay(start);
      q('#analyticsStart').value = start; q('#analyticsEnd').value = kstToday();
    };
    q('#analyticsPeriod').onchange = setPeriod;
    setPeriod();
    const row = (body, cells) => {
      const tr = document.createElement('tr');
      cells.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
      body.append(tr);
    };
    let sequence = 0;
    async function load() {
      const seq = ++sequence;
      const st = q('#analyticsStatus');
      q('#analyticsResults').hidden = true; st.textContent = '통계를 조회하고 있습니다…';
      try {
        const start = q('#analyticsStart').value, end = q('#analyticsEnd').value;
        if (q('#analyticsPeriod').value !== 'all' && (!start || !end || start > end)) throw new Error('시작일과 종료일을 확인해주세요.');
        const data = await call({ action: 'analytics', adminCode: getCode(), start: start || null, end: end || null });
        if (seq !== sequence) return;
        const a = data.analytics;
        if (!a || !Array.isArray(a.tools) || !Array.isArray(a.daily)) throw new Error('통계 응답을 확인할 수 없습니다.');
        st.textContent = `조회: ${start && end ? start + ' ~ ' + end : '수집 이후 전체'} · 수집 시작: ${new Date(a.startedAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})} (한국 시간). 수집 시작 전 기록은 없습니다.`;
        q('#analyticsMain').textContent = `선택 기간 메인 홈페이지: 접속 ${num(a.main.views)}회 · 고유 방문자 ${num(a.main.users)}명`;
        const tools = [...a.tools].sort((x,y) => y.users-x.users || y.views-x.views || x.tool.localeCompare(y.tool));
        const best = tools[0]?.users || 0;
        q('#analyticsWinner').textContent = best ? `현재 인기 1위: ${tools.filter(t => t.users === best).map(t => names[t.tool]).join(', ')} · 고유 이용자 ${num(best)}명` : '선택 기간에 수집된 서비스 접속 기록이 없어 인기 순위를 정할 수 없습니다.';
        q('#analyticsTools').replaceChildren();
        tools.forEach(t => row(q('#analyticsTools'), [t.users ? 1 + tools.filter(x => x.users > t.users).length : '—', names[t.tool], num(t.views), num(t.users), num(t.clicks), num(t.click_users)]));
        q('#analyticsDaily').replaceChildren();
        a.daily.forEach(d => row(q('#analyticsDaily'), [d.day, names[d.tool], { main_view: '메인 접속', tool_click: '버튼 클릭', service_view: '서비스 접속' }[d.kind], num(d.events), num(d.users)]));
        if (!a.daily.length) row(q('#analyticsDaily'), ['수집된 기록이 없습니다.', '', '', '', '']);
        q('#analyticsResults').hidden = false;
      } catch(e) {
        if (seq === sequence) st.textContent = `통계 조회 실패: ${e.message} 다시 조회해주세요.`;
      }
    }
    q('#analyticsLoad').onclick = load;
    dialog.addEventListener('close', () => { sequence++; });
    dialog.refreshToolAnalytics = load;
  };
})();
