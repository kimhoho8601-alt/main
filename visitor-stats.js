(() => {
  const api = 'https://tedbkobhltarqibjhfhk.supabase.co/functions/v1/main-visitor-api';
  const key = 'work-tools-main-visitor-v1';
  let adminCode = '';
  const noticeDismissKey = 'work-tools-notice-dismissed-v1';

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

  function makeDialog(id, inner) {
    let d = document.getElementById(id);
    if (d) return d;
    d = document.createElement('dialog');
    d.id = id;
    d.className = 'wt-dialog';
    d.innerHTML = inner;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    const close = d.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => d.close());
    return d;
  }

  function feedbackDialog() {
    const d = makeDialog('feedbackDialog',
      '<div class="wt-dialog-inner"><div class="wt-dialog-head"><div><div class="wt-kicker">FEEDBACK</div><h2>관리자에게 의견 보내기</h2></div><button class="wt-close" data-close aria-label="닫기">×</button></div><label class="wt-field"><span>의견</span><textarea id="feedbackMessage" class="wt-textarea" maxlength="1500" placeholder="불편한 점, 추가되면 좋은 기능 등을 자유롭게 적어주세요."></textarea></label><div id="feedbackStatus" class="wt-status"></div><div class="wt-actions"><button class="wt-btn ghost" data-close type="button">취소</button><button class="wt-btn primary" id="feedbackSubmit" type="button">의견 보내기</button></div></div>'
    );
    d.querySelector('#feedbackSubmit').onclick = async () => {
      const msg = d.querySelector('#feedbackMessage').value.trim();
      const st = d.querySelector('#feedbackStatus');
      if (!msg) { st.textContent = '의견 내용을 입력해주세요.'; return; }
      st.textContent = '전송 중...';
      try {
        await call({ action: 'submitFeedback', message: msg });
        d.querySelector('#feedbackMessage').value = '';
        st.textContent = '의견을 보냈습니다.';
        setTimeout(() => d.close(), 700);
      } catch (e) {
        st.textContent = e.message || '의견 전송에 실패했습니다.';
      }
    };
    return d;
  }

  function noticeDialog(notice) {
    const d = makeDialog('noticeDialog',
      '<div class="wt-dialog-inner"><section class="notice-hero"><div class="notice-kicker">WORK TOOLS NOTICE</div><h2 class="wt-notice-title" id="noticeTitle"></h2></section><section class="notice-content"><div class="wt-notice-body" id="noticeBody"></div><div class="notice-actions"><label class="notice-hide"><input type="checkbox" id="noticeDontShow"> 다시 열지 않기</label><button class="notice-confirm" id="noticeConfirm" type="button">확인</button></div></section></div>'
    );
    d.querySelector('#noticeTitle').textContent = notice?.title || '공지';
    d.querySelector('#noticeBody').textContent = notice?.body || '';
    const closeNotice = () => {
      if (d.querySelector('#noticeDontShow')?.checked) {
        try { localStorage.setItem(noticeDismissKey, String(notice?.updated_at || notice?.title || 'notice')); } catch {}
      }
      d.close();
    };
    d.querySelector('#noticeConfirm').onclick = closeNotice;
    d.addEventListener('cancel', e => {
      e.preventDefault();
      closeNotice();
    }, { once:true });
    return d;
  }

  function adminDialog() {
    const d = makeDialog('adminDialog',
      '<div class="wt-dialog-inner"><div class="wt-dialog-head"><div><div class="wt-kicker">ADMIN</div><h2>WORK TOOLS 관리</h2></div><button class="wt-close" data-close aria-label="닫기">×</button></div><div class="wt-stats"><div class="wt-stat"><span>오늘 방문자</span><strong id="aToday">0</strong></div><div class="wt-stat"><span>누적 방문자</span><strong id="aTotal">0</strong></div><div class="wt-stat"><span>누적 방문 횟수</span><strong id="aVisits">0</strong></div></div><div class="wt-admin-grid"><section class="wt-admin-panel"><h3>팝업 공지</h3><p>메인 페이지 접속 시 표시할 공지를 설정합니다.</p><label class="wt-field"><span>제목</span><input class="wt-input" id="aNoticeTitle" maxlength="80"></label><label class="wt-field"><span>내용</span><textarea class="wt-textarea" id="aNoticeBody" maxlength="2000"></textarea></label><label class="wt-check"><input type="checkbox" id="aNoticeActive"> 공지 활성화</label><div class="wt-preview"><div class="wt-preview-label">공지 미리보기</div><div class="wt-preview-body"><strong id="aPreviewTitle" class="wt-preview-empty">제목을 입력하면 여기에 표시됩니다.</strong><p id="aPreviewBody">내용을 입력하면 실제 팝업과 비슷하게 미리 볼 수 있습니다.</p></div></div><div id="aNoticeStatus" class="wt-status"></div><div class="wt-actions"><button class="wt-btn primary" id="aNoticeSave" type="button">공지 저장</button></div></section><section class="wt-admin-panel"><h3>받은 의견</h3><p>최근 의견 100건까지 표시됩니다.</p><div class="wt-feedback-list" id="aFeedbackList"></div></section></div></div>'
    );
    const syncNoticePreview = () => {
      const title = d.querySelector('#aNoticeTitle').value.trim();
      const body = d.querySelector('#aNoticeBody').value.trim();
      const pt = d.querySelector('#aPreviewTitle');
      const pb = d.querySelector('#aPreviewBody');
      pt.textContent = title || '제목을 입력하면 여기에 표시됩니다.';
      pt.classList.toggle('wt-preview-empty', !title);
      pb.textContent = body || '내용을 입력하면 실제 팝업과 비슷하게 미리 볼 수 있습니다.';
    };
    d.querySelector('#aNoticeTitle').addEventListener('input', syncNoticePreview);
    d.querySelector('#aNoticeBody').addEventListener('input', syncNoticePreview);
    d.querySelector('#aNoticeSave').onclick = async () => {
      const st = d.querySelector('#aNoticeStatus');
      st.textContent = '저장 중...';
      try {
        const data = await call({
          action: 'saveNotice',
          adminCode,
          title: d.querySelector('#aNoticeTitle').value,
          body: d.querySelector('#aNoticeBody').value,
          isActive: d.querySelector('#aNoticeActive').checked
        });
        renderAdmin(data);
        st.textContent = '저장했습니다.';
      } catch (e) {
        st.textContent = e.message || '저장에 실패했습니다.';
      }
    };
    d.querySelector('#aFeedbackList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-feedback-delete]');
      if (!btn) return;
      if (!confirm('이 의견을 삭제할까요?')) return;
      try {
        const data = await call({ action: 'deleteFeedback', adminCode, id: Number(btn.dataset.feedbackDelete) });
        renderFeedback(data.feedback || []);
      } catch (err) {
        alert(err.message || '삭제에 실패했습니다.');
      }
    });
    return d;
  }

  function renderFeedback(items) {
    const box = adminDialog().querySelector('#aFeedbackList');
    box.innerHTML = '';
    if (!items.length) {
      box.innerHTML = '<div class="wt-status">아직 등록된 의견이 없습니다.</div>';
      return;
    }
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'wt-feedback-item';
      const date = item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '';
      el.innerHTML = '<div class="wt-feedback-meta"><span></span><button class="wt-feedback-delete" type="button" data-feedback-delete="'+item.id+'">삭제</button></div><div class="wt-feedback-message"></div>';
      el.querySelector('.wt-feedback-meta span').textContent = date;
      el.querySelector('.wt-feedback-message').textContent = item.message || '';
      box.appendChild(el);
    });
  }

  function renderAdmin(data) {
    const d = adminDialog();
    const stats = data.stats || {};
    d.querySelector('#aToday').textContent = Number(stats.today || 0).toLocaleString('ko-KR');
    d.querySelector('#aTotal').textContent = Number(stats.total || 0).toLocaleString('ko-KR');
    d.querySelector('#aVisits').textContent = Number(stats.visits || 0).toLocaleString('ko-KR');
    const n = data.notice || {};
    d.querySelector('#aNoticeTitle').value = n.title || '';
    d.querySelector('#aNoticeBody').value = n.body || '';
    d.querySelector('#aNoticeActive').checked = !!n.is_active;
    const pt = d.querySelector('#aPreviewTitle');
    const pb = d.querySelector('#aPreviewBody');
    pt.textContent = n.title || '제목을 입력하면 여기에 표시됩니다.';
    pt.classList.toggle('wt-preview-empty', !n.title);
    pb.textContent = n.body || '내용을 입력하면 실제 팝업과 비슷하게 미리 볼 수 있습니다.';
    renderFeedback(data.feedback || []);
  }

  async function openAdmin() {
    const code = prompt('관리자 코드를 입력하세요.');
    if (!code) return;
    try {
      const data = await call({ action: 'admin', adminCode: code });
      adminCode = code;
      renderAdmin(data);
      const d = adminDialog();
      if (!d.open) d.showModal();
    } catch (e) {
      alert(e.message || '관리자 코드를 확인해주세요.');
    }
  }

  const feedbackBtn = document.getElementById('feedbackOpenBtn');
  if (feedbackBtn) feedbackBtn.onclick = () => {
    const d = feedbackDialog();
    d.querySelector('#feedbackStatus').textContent = '';
    if (!d.open) d.showModal();
    setTimeout(() => d.querySelector('#feedbackMessage')?.focus(), 30);
  };

  const mark = document.querySelector('.brand-mark');
  if (mark) {
    mark.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
    });
    mark.addEventListener('dblclick', e => {
      e.preventDefault();
      e.stopPropagation();
      openAdmin();
    });
  }

  call({ action: 'visit', visitorId: id() })
    .then(data => {
      const n = data.notice;
      if (n && n.is_active && (n.title || n.body)) {
        const noticeVersion = String(n.updated_at || n.title || 'notice');
        let dismissed = '';
        try { dismissed = localStorage.getItem(noticeDismissKey) || ''; } catch {}
        if (dismissed !== noticeVersion) {
          const d = noticeDialog(n);
          if (!d.open) d.showModal();
        }
      }
    })
    .catch(() => {});
})();