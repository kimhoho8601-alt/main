-- All fixture writes are rolled back; no production totals are polluted.
begin;
insert into public.work_tools_events(event_id,visitor_id,kind,tool,occurred_at) values
 ('00000000-0000-4000-8000-000000000001','analytics-test-browser-0001','service_view','sign','2099-01-01T14:59:59Z'),
 ('00000000-0000-4000-8000-000000000002','analytics-test-browser-0001','service_view','sign','2099-01-01T15:00:00Z'),
 ('00000000-0000-4000-8000-000000000003','analytics-test-browser-0002','service_view','sign','2099-01-01T15:01:00Z'),
 ('00000000-0000-4000-8000-000000000004','analytics-test-browser-0001','tool_click','photo','2099-01-01T15:01:00Z'),
 ('00000000-0000-4000-8000-000000000005','analytics-test-browser-0001','main_view',null,'2099-01-01T15:01:00Z');
insert into public.work_tools_events(event_id,visitor_id,kind,tool) values
 ('00000000-0000-4000-8000-000000000001','analytics-test-browser-0001','service_view','sign') on conflict do nothing;
do $$ declare r jsonb; t jsonb; begin
 r:=public.work_tools_analytics_report('2099-01-01','2099-01-02');
 select x into t from jsonb_array_elements(r->'tools') x where x->>'tool'='sign';
 assert (t->>'views')::int=3, 'Repeated delivery must not increment';
 assert (t->>'users')::int=2, 'Distinct users across days must not sum daily unique users';
 assert (r#>>'{main,views}')::int=1, 'Main views separate';
 select x into t from jsonb_array_elements(r->'tools') x where x->>'tool'='photo';
 assert (t->>'clicks')::int=1 and (t->>'views')::int=0, 'Click is not service arrival';
 r:=public.work_tools_analytics_report('2099-01-02','2099-01-02');
 select x into t from jsonb_array_elements(r->'tools') x where x->>'tool'='sign';
 assert (t->>'views')::int=2, 'KST midnight boundary';
 assert jsonb_array_length(r->'tools')=4, 'Always return four tools';
 assert not has_table_privilege('anon','public.work_tools_events','SELECT'), 'No anonymous raw reads';
 assert not has_table_privilege('authenticated','public.work_tools_events','INSERT'), 'No direct inserts';
 assert not has_function_privilege('anon','public.work_tools_analytics_report(date,date)','EXECUTE'), 'No public reports';
 assert (select relrowsecurity from pg_class where oid='public.work_tools_events'::regclass), 'RLS enabled';
 begin
  insert into public.work_tools_events(event_id,visitor_id,kind,tool) values
   ('00000000-0000-4000-8000-000000000009','analytics-test-browser-0001','service_view',null);
  raise exception 'Invalid missing service tool accepted';
 exception when check_violation then null; end;
end $$;
rollback;
