const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Window}=require('happy-dom');
const mainRoot=path.resolve(__dirname,'..');
const root=path.dirname(mainRoot);
const read=p=>fs.readFileSync(p.startsWith('main/') ? path.join(mainRoot,p.slice(5)) : fs.existsSync(path.join(root,p)) ? path.join(root,p) : path.join(mainRoot,'tool-analytics.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
function make(tool='main',blocked=false){
 const w=new Window({url:'https://kimhoho8601-alt.github.io/'+tool+'/'});
 w.document.body.innerHTML='<a class="brand-mark"></a><button id="feedbackOpenBtn"></button><a class="app-card" data-tool="sign"><span>sign</span><button>move</button></a>';
 const sent=[];let fail=false;
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('blocked')}});
 w.fetch=async(_url,options)=>{const body=JSON.parse(options.body);sent.push(body);if(fail){fail=false;throw Error('offline')}return {status:200,ok:true,json:async()=>({})}};
 const s=w.document.createElement('script');s.dataset.tool=tool;w.document.body.append(s);
 Object.defineProperty(w.document,'currentScript',{get:()=>s});
 w.eval(read((tool==='convert'?'Convert':tool)+'/tool-analytics.js'));
 return {w,sent,retry:()=>fail=true};
}
test('identity reuse, all four service collectors, retry ID and click exclusions',async()=>{
 const {w,sent,retry}=make();await tick();
 assert.equal(sent[0].kind,'main_view');
 const id=sent[0].visitorId;
 // Double inclusion does not send a second document view.
 w.eval(read('main/tool-analytics.js'));await tick();assert.equal(sent.length,1);
 w.document.querySelector('.app-card span').dispatchEvent(new w.MouseEvent('click',{button:0,bubbles:true}));
 w.document.querySelector('.app-card button').dispatchEvent(new w.MouseEvent('click',{button:0,bubbles:true}));
 w.document.querySelector('.app-card').dispatchEvent(new w.MouseEvent('auxclick',{button:1,bubbles:true}));
 const canceled=new w.MouseEvent('click',{button:0,bubbles:true,cancelable:true});canceled.preventDefault();w.document.querySelector('.app-card').dispatchEvent(canceled);
 await tick();assert.equal(sent.filter(x=>x.kind==='tool_click').length,2);
 retry();w.WorkToolsAnalytics.record('tool_click','photo');await tick();
 assert.equal(sent.at(-1).eventId,sent.at(-2).eventId);
 for(const tool of ['family-tree','sign','convert','photo']){
  const x=make(tool);await tick();assert.equal(x.sent[0].kind,'service_view');assert.equal(x.sent[0].tool,tool);await x.w.happyDOM.close();
 }
 // Emulate a new document with persisted first-party storage.
 const w2=new Window({url:'https://kimhoho8601-alt.github.io/sign/'});w2.localStorage.setItem('work-tools-main-visitor-v1',id);w2.document.body.innerHTML='<script data-tool="sign"></script>';
 Object.defineProperty(w2.document,'currentScript',{get:()=>w2.document.querySelector('script')});
 let event;w2.fetch=async(_u,o)=>{event=JSON.parse(o.body);return {status:200}};w2.eval(read('sign/tool-analytics.js'));await tick();
 assert.equal(event.visitorId,id);assert.notEqual(event.eventId,sent[0].eventId);
 const blocked=make('main',true);blocked.w.eval(read('main/visitor-stats.js'));await tick();
 assert.equal(blocked.sent.find(x=>x.kind==='main_view').visitorId,blocked.sent.find(x=>x.action==='visit').visitorId);
 await Promise.all([w.happyDOM.close(),w2.happyDOM.close(),blocked.w.happyDOM.close()]);
});
test('admin period, ranking ties, empty/error and legacy notice/feedback UI',async()=>{
 const {w,sent}=make();const q=s=>w.document.querySelector(s);let fail=false;
 let a={startedAt:'2026-10-26T05:00:00Z',main:{views:10,users:3},tools:[{tool:'sign',views:5,users:3,clicks:2,click_users:1},{tool:'photo',views:3,users:3,clicks:1,click_users:1},{tool:'family-tree',views:0,users:0,clicks:0,click_users:0},{tool:'convert',views:0,users:0,clicks:0,click_users:0}],daily:[{day:'2026-10-26',tool:'sign',kind:'service_view',events:5,users:3}]};
 w.prompt=()=> 'test-code';w.alert=e=>{throw Error(e)};
 w.fetch=async(_url,options)=>{const b=JSON.parse(options.body);sent.push(b);return {ok:!fail,status:fail?500:200,json:async()=>fail?{error:'test-error'}:b.action==='analytics'?{analytics:a}:{stats:{today:1,total:54,visits:92},notice:{title:'notice-test',body:'body-test',is_active:false},feedback:[{id:1,message:'feedback-test'}]}}};
 w.eval(read('main/analytics-admin.js'));w.eval(read('main/visitor-stats.js'));
 q('.brand-mark').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal(q('#analyticsResults').hidden,false);assert.match(q('#analyticsWinner').textContent,/서명·도장 만들기, 사진 정리/);
 assert.equal(q('#analyticsTools tr td').textContent,'1');assert.equal(q('#analyticsTools tr:nth-child(2) td').textContent,'1');
 assert.match(q('#analyticsMain').textContent,/접속 10회 · 고유 방문자 3명/);
 assert.equal(q('#aTotal').textContent,'54');assert.equal(q('#aVisits').textContent,'92');assert.equal(q('#aNoticeTitle').value,'notice-test');assert.match(q('#aFeedbackList').textContent,/feedback-test/);
 q('#analyticsPeriod').value='custom';q('#analyticsPeriod').dispatchEvent(new w.Event('change'));
 q('#analyticsStart').value='2026-10-01';q('#analyticsEnd').value='2026-10-26';q('#analyticsLoad').click();await tick();
 assert.equal(sent.at(-1).start,'2026-10-01');assert.equal(sent.at(-1).end,'2026-10-26');
 q('#analyticsEnd').value='2026-09-30';const count=sent.length;q('#analyticsLoad').click();await tick();assert.equal(sent.length,count);assert.match(q('#analyticsStatus').textContent,/시작일과 종료일/);
 q('#analyticsPeriod').value='all';q('#analyticsPeriod').dispatchEvent(new w.Event('change'));q('#analyticsLoad').click();await tick();assert.equal(sent.at(-1).start,null);
 fail=true;q('#analyticsLoad').click();await tick();assert.match(q('#analyticsStatus').textContent,/통계 조회 실패/);assert.equal(q('#analyticsResults').hidden,true);
 fail=false;a={...a,tools:a.tools.map(t=>({...t,users:0,views:0})),daily:[]};q('#analyticsLoad').click();await tick();assert.match(q('#analyticsWinner').textContent,/인기 순위를 정할 수 없습니다/);
 await w.happyDOM.close();
});
