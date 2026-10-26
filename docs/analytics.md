# WORK TOOLS 기능별 통계

## 집계 정의

| 기록 | 기록 시점 | 횟수 | 고유 수 |
|---|---|---|---|
| main_view | 메인 문서의 추적 코드 실행 | 문서 로드마다 1회, 새로고침 포함 | 기간 내 visitor_id 중복 제거 |
| tool_click | 메인 카드 왼쪽/가운데 클릭·키보드 활성화 | 유효한 카드 열기 동작마다 1회 | 기능별·기간별 visitor_id 중복 제거 |
| service_view | 개별 서비스 문서의 추적 코드 실행 | 직접 주소 접속·새 탭·새로고침 포함 | 기능별·기간별 visitor_id 중복 제거 |

서비스 접속은 도구의 작업 완료/파일 저장을 뜻하지 않는다. 페이지에서 추적 코드가 실행된 사실을 측정한다. 우클릭 메뉴의 '새 탭에서 열기', 주소 복사, 북마크 접속은 메인 클릭으로 측정할 수 없지만 서비스 접속으로 측정한다. 메인에서 클릭했어도 새 탭이 차단되거나 페이지를 불러오지 못하면 서비스 접속은 기록되지 않는다. 뒤로가기 캐시(BFCache) 복원은 새 문서 로드가 아니므로 재집계하지 않는다.

하나의 이벤트는 event_id UUID를 갖는다. 네트워크 재시도 시 같은 ID를 전송하고 DB 기본키로 중복 제거한다. 다른 로드/클릭은 새로운 ID를 사용한다. 동일한 브라우저의 반복 방문은 횟수만 증가하고 기간 전체 고유 수는 증가하지 않는다. 일별 고유 수를 더해서 기간 고유 수를 계산하지 않는다. 각 서비스의 고유 수 합은 홈페이지 전체의 고유 수가 아니다.

5개 페이지가 모두 https://kimhoho8601-alt.github.io 출처를 사용하므로 기존 메인 localStorage 키(work-tools-main-visitor-v1)의 식별자를 공유한다. 다른 기기/브라우저/시크릿 모드/저장소 삭제는 별도 식별자가 된다. 저장소 사용이 차단되면 한 문서에서만 식별자를 유지한다. 사용자 로그인 기반 실제 사람 수가 아니다. IP, 사례·가계도 내용, 서명, 사진, 파일명, URL 쿼리는 수집하지 않는다. 광고 차단, JavaScript 비활성화, 네트워크 실패, 자동화 트래픽의 영향을 받는 익명 측정이다. 봇을 완벽하게 구분하거나 도구 사용 완료를 증명하지 않는다.

## 관리자 화면

기존 방식대로 메인 좌상단 브랜드 표시를 더블클릭하고 관리자 코드를 입력한다. 최근 7일(오늘 포함), 오늘, 최근 30일, 수집 이후 전체, 직접 날짜 범위를 조회한다. 한국 시간 기준 시작일 00:00 이상, 종료일 다음 날 00:00 미만을 서버에서 적용한다. 기능 4개의 서비스 접속 횟수/고유 이용자와 메인 클릭 횟수/고유 이용자를 비교한다. 순위 기준은 서비스 고유 이용자 수이며 동률은 같은 순위다. 0명인 기능은 순위를 부여하지 않고, 모든 기능이 0이면 순위를 산출하지 않는다. 일자별 표에서 날짜 간 비교가 가능하다. 기록 없는 날짜는 0건이며, 수집 이전은 미수집이다. 조회 실패 시 이전 표를 숨기고 오류를 표시한다.

기존 메인 통계 API의 stats.visits는 main_visitor_daily의 행 수였다. 따라서 '누적 방문 횟수'를 '누적 일별 방문자 합계'로 수정했다. 기존 세 지표의 서버 계산 및 데이터는 변경하지 않았다. 신설한 메인 접속 횟수는 수집 시작 이후만 제공한다. 기존 데이터로 과거 기능별 기록이나 과거 페이지 조회수를 복원하지 않는다.

## 서버와 권한

기존 main-visitor-api에 trackEvent와 관리자 인증이 필요한 analytics를 추가했다. 기존 visit/public/admin/saveNotice/submitFeedback/deleteFeedback 경로와 CASE_RELATION_ADMIN_CODE 비밀값은 유지한다. 기존 verify_jwt=false 상태를 유지하며 집계 읽기는 서버 관리자 코드로 보호한다. 원시 이벤트 테이블을 브라우저에서 직접 읽거나 쓰지 않는다.

work_tools_events와 work_tools_analytics_meta는 RLS 활성화, PUBLIC/anon/authenticated 권한 회수, service_role만 필요한 권한 부여. work_tools_analytics_report는 SECURITY INVOKER, search_path 고정, service_role에만 실행 허용. 관리 화면 응답에는 원시 브라우저 ID를 포함하지 않는다. 신규 테이블 GRANT 정책 변화와 관계없이 권한을 명시했다. 보안 Advisor의 두 신규 테이블 RLS 정책 없음(INFO)은 서버 전용·공개 접근 차단 의도와 일치한다. 프로젝트 내 다른 기존 리소스의 경고는 이번 변경에 포함하지 않았다. https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

서버는 event_id/visitor_id/이벤트 유형/기능을 검증한다. 클라이언트 시각을 받지 않고 서버 DB now()를 사용한다. 통계는 익명 공개 쓰기 API이므로 완벽한 트래픽 위변조 방지나 봇 방지를 보장하지 않는다.

## 적용과 되돌리기

1. 실제 운영 함수(v2)와 기존 테이블 구조를 확인하고 서버 원본을 supabase/rollback/main-visitor-api/index.ts에 보관했다.
2. database/work_tools_analytics.sql을 work_tools_feature_analytics 이름의 운영 마이그레이션으로 적용했다. 기존 테이블을 변경하거나 삭제하지 않았다. 이 SQL은 최초 설치용이므로 재실행하지 않는다.
3. supabase/functions/main-visitor-api/index.ts와 analytics.ts를 기존 함수에 배포했다.
4. 메인과 family-tree/sign/Convert/photo 저장소에 추적 스크립트와 스크립트 태그를 추가한다. 메인에는 관리자 표/필터를 추가한다. 추적 스크립트는 각 저장소에 동일 사본을 둬 메인 저장소의 서비스 장애에 종속시키지 않는다.
5. GitHub Pages 게시 후 HTML 태그와 JS 정적 파일을 확인한다. 기존 탭은 새로고침해야 추적이 시작된다.

문제가 있으면 먼저 각 프런트엔드 커밋을 revert한다. 서버는 보관한 원본 index.ts 한 파일을 main-visitor-api에 배포하고 기존 verify_jwt=false를 유지한다. 신규 테이블은 지우지 않고 남겨도 기존 기능에 영향을 주지 않는다. 수집 데이터 보전을 위해 DROP/DELETE를 기본 롤백으로 사용하지 않는다. 기존 공지/의견/방문 테이블은 건드리지 않는다.

## 검증

Node 24 이상에서 npm ci 후 npm test로 API 및 DOM 회귀 검증을 재현한다. tests/analytics-db.sql은 DB에서 BEGIN/ROLLBACK으로 실행하며 테스트 기록이 남지 않는다. 선택 사항인 npm run test:browser는 npx playwright install chromium 후 실행한다.

- API 소스 검사: 이벤트 검증, 날짜 형식, 날짜 순서, 관리자 인증, 기존 visit/public/admin/saveNotice/submitFeedback/deleteFeedback 경로 통과.
- 실제 DB 트랜잭션 검증: 이벤트 재전송, 여러 날짜·동일 브라우저 중복 제거, 한국 시간 자정, 클릭/접속 분리, 4개 기능의 0건 표시, 직접 접근 차단 및 RLS 통과.
- DOM 검증: 4개 서비스 추적 사본, 식별자 재사용, 중복 스크립트 방지, 클릭 필터, 재전송 ID, 저장소 차단 시 기존 방문과 같은 ID 사용, 관리자 동률 순위·날짜 선택·전체 조회·오류·빈 결과·기존 공지/의견 표시 통과.
- 실제 운영 API: 공지 조회, 미인증 통계 401, 잘못된 이벤트 400, 4개 서비스 각각 이벤트 전송, 동일 이벤트 재전송, 메인 접속/버튼 클릭, CORS 통과. DB에서 4개의 서비스 접속이 각각 정확히 1건임을 확인. 테스트 visitor_id 행을 삭제하고 잔여 0건 확인.
- 브라우저 설치 파일을 내려받을 수 없어 Playwright 화면 렌더링/PC·모바일 스크린샷 검증은 수행하지 못했다. DOM 동작 검증과 실제 API/DB 검증을 수행했다. 실제 운영 관리자 코드는 읽거나 변경하지 않았으며, 관리자 성공 경로는 코드/DOM의 테스트 코드로 검증했다.

운영 API 테스트(tests/live-api.cjs)는 명시적으로 실행할 때만 기록한다. 실행 후 아래처럼 해당 시험 식별자만 삭제하고 0건을 확인한다. 기존 방문자 기록이나 다른 이벤트는 삭제하지 않는다.

```sql
delete from public.work_tools_events where visitor_id='analytics-live-test-20261026';
select count(*) from public.work_tools_events where visitor_id='analytics-live-test-20261026';
```
