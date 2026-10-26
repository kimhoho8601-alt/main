// Run only against the authorized project; remove test visitor rows afterward via the SQL in docs.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const api='https://tedbkobhltarqibjhfhk.supabase.co/functions/v1/main-visitor-api';
(async()=>{
 const send=async body=>{const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 assert.equal((await send({action:'public'})).status,200);
 assert.equal((await send({action:'analytics',adminCode:'invalid-analytics-test-code'})).status,401);
 assert.equal((await send({action:'trackEvent',eventId:'bad'})).status,400);
 const visitorId='analytics-live-test-20261026';
 for(const tool of ['family-tree','sign','convert','photo']){
  const event={action:'trackEvent',eventId:randomUUID(),visitorId,kind:'service_view',tool};
  assert.equal((await send(event)).status,200);
  assert.equal((await send(event)).status,200);
 }
 for(const kind of ['main_view','tool_click'])assert.equal((await send({action:'trackEvent',eventId:randomUUID(),visitorId,kind,tool:kind==='main_view'?null:'sign'})).status,200);
 const options=await fetch(api,{method:'OPTIONS',headers:{Origin:'https://kimhoho8601-alt.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
 assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),'*');
 console.log('Live API passed: public notice, unauthorized report, invalid event, 4 services, duplicate retry, main/click, CORS. Cleanup required for analytics-live-test-20261026.');
})().catch(e=>{console.error(e);process.exitCode=1});
