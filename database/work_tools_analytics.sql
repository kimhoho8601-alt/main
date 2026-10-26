-- Additive migration. Existing visitors, notices and feedback are untouched.
begin;
create table public.work_tools_analytics_meta (
  id boolean primary key default true check (id),
  started_at timestamptz not null default now()
);
insert into public.work_tools_analytics_meta(id) values(true);
create table public.work_tools_events (
  event_id uuid primary key,
  visitor_id text not null check (visitor_id ~ '^[a-zA-Z0-9-]{20,80}$'),
  kind text not null check (kind in ('main_view','tool_click','service_view')),
  tool text,
  occurred_at timestamptz not null default now(),
  check ((kind='main_view' and tool is null) or
    (kind in ('tool_click','service_view') and tool is not null and tool in ('family-tree','sign','convert','photo')))
);
create index work_tools_events_time on public.work_tools_events(occurred_at);
create index work_tools_events_tool_time on public.work_tools_events(tool,kind,occurred_at);
alter table public.work_tools_events enable row level security;
alter table public.work_tools_analytics_meta enable row level security;
revoke all on public.work_tools_events, public.work_tools_analytics_meta from public,anon,authenticated;
grant select,insert on public.work_tools_events to service_role;
grant select on public.work_tools_analytics_meta to service_role;

create function public.work_tools_analytics_report(p_start date default null, p_end date default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with filtered as materialized (
 select *, (occurred_at at time zone 'Asia/Seoul')::date as day
 from public.work_tools_events
 where (p_start is null or occurred_at >= (p_start::timestamp at time zone 'Asia/Seoul'))
   and (p_end is null or occurred_at < ((p_end+1)::timestamp at time zone 'Asia/Seoul'))
), tools as (
 select t.tool,
 count(*) filter(where e.kind='tool_click') as clicks,
 count(distinct e.visitor_id) filter(where e.kind='tool_click') as click_users,
 count(*) filter(where e.kind='service_view') as views,
 count(distinct e.visitor_id) filter(where e.kind='service_view') as users
 from (values ('family-tree'),('sign'),('convert'),('photo')) t(tool)
 left join filtered e on e.tool=t.tool group by t.tool
), daily as (
 select day,coalesce(tool,'main') as tool,kind,count(*) as events,count(distinct visitor_id) as users
 from filtered group by day,tool,kind
)
select jsonb_build_object(
 'startedAt',(select started_at from public.work_tools_analytics_meta where id),
 'start',p_start,'end',p_end,
 'main',jsonb_build_object('views',(select count(*) from filtered where kind='main_view'),
   'users',(select count(distinct visitor_id) from filtered where kind='main_view')),
 'tools',(select jsonb_agg(to_jsonb(tools) order by users desc,views desc,tool) from tools),
 'daily',coalesce((select jsonb_agg(to_jsonb(daily) order by day,tool,kind) from daily),'[]'::jsonb)
);
$$;
revoke all on function public.work_tools_analytics_report(date,date) from public,anon,authenticated;
grant execute on function public.work_tools_analytics_report(date,date) to service_role;
commit;
