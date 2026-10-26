const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const mainRoot=path.resolve(__dirname,'..');
const root=path.dirname(mainRoot);
test('tracker identity, refresh, retries, click filtering and admin desktop/mobile states',async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/harness/')) {
   const tool=url.pathname.split('/')[2];const repo=tool==='convert'?'Convert':tool;
   res.setHeader('Content-Type','text/html');res.end(`<script src="/main/tool-analytics.js" data-tool="${tool}"></script>`);return;
  }
  const file=path.join(mainRoot,url.pathname==='/'?'index.html':url.pathname.replace(/^\/main\//,''));
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true}).catch(async e=>{await new Promise(r=>server.close(r));throw e;});
 try{
  const context=await browser.newContext();const requests=[];let failTracking=false,failReport=false;
  let report={startedAt:'2026-10-26T05:00:00Z',main:{views:10,users:3},tools:[{tool:'sign',views:8,users:3,clicks:4,click_users:2},{tool:'photo',views:5,users:3,clicks:1,click_users:1},{tool:'convert',views:2,users:1,clicks:2,click_users:1},{tool:'family-tree',views:0,users:0,clicks:0,click_users:0}],daily:[{day:'2026-10-26',tool:'sign',kind:'service_view',events:8,users:3}]};
  await context.route('**/*',async route=>{
   const req=route.request();
   if(req.url().includes('main-visitor-api')){
    const body=req.postDataJSON();requests.push(body);
    if(body.action==='trackEvent'&&failTracking){failTracking=false;await route.fulfill({status:503,json:{}});return;}
    if(body.action==='analytics'){await route.fulfill({status:failReport?500:200,json:failReport?{error:'test error'}:{analytics:report}});return;}
    await route.fulfill({json:{stats:{today:1,total:54,visits:92},notice:{is_active:false},feedback:[]}});return;
   }
   if(!req.url().startsWith(base))return route.abort();
   return route.continue();
  });
  const page=await context.newPage();await page.goto(base+'/main/index.html');
  await page.waitForFunction(()=>window.WorkToolsAnalytics);
  await assertEventually(()=>requests.some(x=>x.action==='visit'));
  const id=requests.find(x=>x.kind==='main_view').visitorId;
  assert.equal(requests.find(x=>x.action==='visit').visitorId,id);
  await page.evaluate(()=>{
    const card=document.querySelector('.app-card');
    card.addEventListener('click',e=>e.preventDefault(),{once:true});
    card.dispatchEvent(new MouseEvent('click',{button:0,bubbles:true,cancelable:true}));
  });
  assert.equal(requests.filter(x=>x.kind==='tool_click').length,0);
  await page.evaluate(()=>document.querySelector('.app-card').dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true})));
  await assertEventually(()=>requests.some(x=>x.kind==='tool_click'));
  assert.equal(requests.find(x=>x.kind==='tool_click').tool,'family-tree');
  await page.reload();await assertEventually(()=>requests.filter(x=>x.kind==='main_view').length===2);
  assert.equal(requests.filter(x=>x.kind==='main_view')[1].visitorId,id);
  assert.notEqual(requests.filter(x=>x.kind==='main_view')[0].eventId,requests.filter(x=>x.kind==='main_view')[1].eventId);
  for(const tool of ['family-tree','sign','convert','photo']){
   const tab=await context.newPage();await tab.goto(base+'/harness/'+tool);
   await assertEventually(()=>requests.some(x=>x.kind==='service_view'&&x.tool===tool));
   assert.equal(requests.find(x=>x.kind==='service_view'&&x.tool===tool).visitorId,id);
   await tab.close();
  }
  failTracking=true;const before=requests.length;
  await page.evaluate(()=>window.WorkToolsAnalytics.record('tool_click','sign'));
  await assertEventually(()=>requests.slice(before).length===2);
  assert.equal(requests[before].eventId,requests[before+1].eventId);
  page.on('dialog',d=>d.accept('test-code'));
  await page.locator('.brand-mark').dblclick({force:true});
  await page.locator('#analyticsResults').waitFor({state:'visible'});
  assert.match(await page.locator('#analyticsWinner').innerText(),/서명·도장 만들기, 사진 정리/);
  assert.match(await page.locator('.wt-stats').innerText(),/누적 일별 방문자 합계/);
  await page.locator('#analyticsPeriod').selectOption('custom');
  await page.locator('#analyticsStart').fill('2026-10-01');await page.locator('#analyticsEnd').fill('2026-10-26');
  await page.locator('#analyticsLoad').click();await assertEventually(()=>requests.some(x=>x.action==='analytics'&&x.start==='2026-10-01'));
  failReport=true;await page.locator('#analyticsLoad').click();await page.getByText('통계 조회 실패:',{exact:false}).waitFor();
  assert.equal(await page.locator('#analyticsResults').isVisible(),false);
  failReport=false;report={...report,tools:report.tools.map(t=>({...t,views:0,users:0,clicks:0,click_users:0})),daily:[]};
  await page.locator('#analyticsLoad').click();await page.getByText('선택 기간에 수집된 서비스 접속 기록이 없어 인기 순위를 정할 수 없습니다.').waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'admin-mobile.png'),fullPage:true});
  assert.ok(await page.locator('#analyticsLoad').isVisible());
  assert.ok(await page.evaluate(()=>document.querySelector('#toolAnalytics').getBoundingClientRect().width<=390));
  await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(root,'admin-desktop.png'),fullPage:true});
  // Blocked localStorage must still use one in-memory ID shared with legacy visits.
  const isolated=await browser.newContext();const badPage=await isolated.newPage();
  await badPage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}}));
  const denied=[];await badPage.route('**/main-visitor-api',route=>{denied.push(route.request().postDataJSON());return route.fulfill({json:{}})});
  await badPage.goto(base+'/main/index.html');await assertEventually(()=>denied.some(x=>x.action==='visit'));
  assert.equal(denied.find(x=>x.kind==='main_view').visitorId,denied.find(x=>x.action==='visit').visitorId);
  await isolated.close();await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
async function assertEventually(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}assert.ok(fn(),'condition timed out');}
