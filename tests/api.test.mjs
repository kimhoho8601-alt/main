import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { validateEvent, validateRange } from '../supabase/functions/main-visitor-api/analytics.ts';
const valid = {eventId:'00000000-0000-4000-8000-000000000001',visitorId:'analytics-test-browser-0001',kind:'service_view',tool:'sign'};
test('validate only permitted identities, events, tools and real dates', () => {
 assert.equal(validateEvent(valid).tool,'sign');
 for(const p of [{...valid,kind:'fake'},{...valid,tool:'fake'},{...valid,tool:null},{...valid,visitorId:'x'},{...valid,eventId:'x'},{...valid,kind:'main_view'}]) assert.throws(()=>validateEvent(p));
 assert.equal(validateEvent({...valid,kind:'main_view',tool:null}).tool,null);
 assert.deepEqual(validateRange({}),{p_start:null,p_end:null});
 assert.deepEqual(validateRange({start:'2026-10-26',end:'2026-10-26'}),{p_start:'2026-10-26',p_end:'2026-10-26'});
 for(const p of [{start:'2026-02-30',end:'2026-03-01'},{start:'2026-10-26'},{start:'2026-10-27',end:'2026-10-26'}]) assert.throws(()=>validateRange(p));
});
function setup() {
 let handler; const writes=[];
 const db={from(table){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle(){return q},upsert(value,opts){writes.push({table,value,opts});return q},insert(value){writes.push({table,value});return q},delete(){writes.push({table});return q},then(resolve){resolve({data:table==='main_feedback'?[]:null,count:0,error:null})}};return q},rpc:async()=>({data:{tools:[],daily:[]},error:null})};
 let src=fs.readFileSync(new URL('../supabase/functions/main-visitor-api/index.ts',import.meta.url),'utf8').replace(/^import.*;\n/gm,'');
 src=stripTypeScriptTypes(src);
 vm.runInNewContext(src,{validateEvent,validateRange,createClient:()=>db,Deno:{env:{get:k=>k==='CASE_RELATION_ADMIN_CODE'?'test-code':'test-env'},serve:fn=>handler=fn},Response,Intl,Date,Promise,Error,Object,String,Number,Boolean});
 return {writes,send:async body=>handler(new Request('https://test.local',{method:'POST',body:JSON.stringify(body)}))};
}
test('tracking upsert, protected reports, legacy visit and notice/feedback routes',async()=>{
 const {send,writes}=setup();
 assert.equal((await send({action:'trackEvent',...valid})).status,200);
 assert.equal(writes[0].table,'work_tools_events');
 assert.equal(writes[0].opts.ignoreDuplicates,true);
 assert.equal((await send({action:'trackEvent',...valid,tool:'bad'})).status,400);
 assert.equal((await send({action:'analytics'})).status,401);
 assert.equal((await send({action:'analytics',adminCode:'test-code'})).status,200);
 assert.equal((await send({action:'analytics',adminCode:'test-code',start:'bad'})).status,400);
 for(const action of ['admin','saveNotice','deleteFeedback']) assert.equal((await send({action})).status,401);
 for(const body of [{action:'visit',visitorId:valid.visitorId},{action:'public'},{action:'admin',adminCode:'test-code'},{action:'saveNotice',adminCode:'test-code',title:'test',body:'test'},{action:'submitFeedback',message:'test'},{action:'deleteFeedback',adminCode:'test-code',id:1}]) assert.equal((await send(body)).status,200);
 assert.ok(writes.some(w=>w.table==='main_visitor_daily'));
 assert.ok(writes.some(w=>w.table==='main_visitor_unique'));
});
