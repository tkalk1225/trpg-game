# 회귀의 서 — AI 협동 TRPG 웹앱 (초기 버전)

두 명이 **한 기기**에서 번갈아 플레이하는 브라우저용 TRPG 시작 프로젝트입니다.

## 들어 있는 기능
- A/B 캐릭터 생성, 종족별 특성 입력 개수 제한
- 6개 능력치와 27점 구매
- AI GM 호출용 Supabase Edge Function
- AI가 장소·장면·선택지·판정·캐릭터 상태를 JSON으로 반환
- 클라이언트에서 d20을 생성하고 결과를 AI에 전달
- 캐릭터·소지품·기록 탭
- 브라우저 localStorage 자동 저장\n- UTF-8 Base64URL 형식의 저장 주소 생성 및 복구

## 중요한 점
이 파일만 열면 화면은 실행되지만, AI 진행을 하려면 Supabase와 OpenAI API 설정이 필요합니다. 아직 공개 웹 주소에 배포된 사이트는 아닙니다. 아래 설정을 마치면 정적 웹 호스팅에 올려 사용할 수 있습니다.

이 버전은 플레이 가능한 **초기 골격**입니다. 전투 세부 규칙, 숙련도 선택 UI, 레벨업 배분, 퀘스트 상세 UI, 회귀 후 상태 복원 등은 다음 개발 단계에서 보강해야 합니다.

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 프로젝트를 생성합니다.
2. 프로젝트의 Project URL과 anon/public key를 확인합니다.
3. `config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 입력합니다.
   - anon key는 브라우저에 공개되는 키입니다.
   - **OpenAI API 키는 절대 config.js나 index.html에 입력하지 마세요.**

## 2. Supabase CLI로 AI 함수 배포
Supabase CLI가 설치된 컴퓨터에서 프로젝트 폴더를 기준으로 실행합니다.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
supabase functions deploy gm
```

`OPENAI_API_KEY`는 Supabase의 서버 비밀키로 저장되므로 브라우저에 노출되지 않습니다.

## 3. 웹사이트 배포
`index.html`, `style.css`, `app.js`, `config.js`를 정적 웹 호스팅에 올립니다. 예: GitHub Pages, Netlify, Cloudflare Pages 등.
`supabase` 폴더는 웹사이트 공개 파일로 올릴 필요가 없고, Edge Function 배포에 사용합니다.

## 4. 로컬에서 화면 확인
간단한 정적 파일 서버로 실행할 수 있습니다.

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. `file://`로 직접 여는 것보다 로컬 웹 서버 사용을 권장합니다.

## 데이터와 비용
- 게임 저장은 기본적으로 현재 브라우저의 localStorage에 저장됩니다. 같은 기기·같은 브라우저에서 이어서 플레이하세요.
- 브라우저 데이터/사이트 데이터를 삭제하면 저장된 게임이 사라질 수 있습니다. 중요한 세션이 끝나면 브라우저 데이터를 지우지 마세요.
- AI 호출에는 OpenAI API 사용료가 발생할 수 있습니다. 사용량과 모델 가격은 OpenAI 공식 요금 페이지에서 확인하세요.
- Supabase 무료/유료 한도는 계정과 시점에 따라 달라집니다.

## 현재 규칙 초안
- d20 + 능력 보정 + 숙련 보너스 + 기타 보정
- 능력 보정: floor((능력치-10)/2)
- 숙련: 미숙련 +0, 훈련 +2, 전문가 +4, 달인 +6, 전설 +8
- 성공도: DC+10 대성공, DC 이상 성공, DC 미만 실패, DC-10 이하 대실패
- 시작 능력치: 각 8, 27점 구매, 최대 15
- 레벨 상한 20, 레벨업 시 능력치 점수 1점 제안(플레이어가 직접 배분)
- 인간: 성격 3개·능력 특성 2개 / 그 외 종족: 성격 2개·능력 특성 1개
- 클래스는 게임 시작 후 사건·훈련·경험을 통해 해금
- 파티 전멸 시 두 캐릭터가 함께 회귀

## 안전·운영 메모
- 이 초기 버전은 로그인과 서버 측 사용자별 권한 관리를 구현하지 않았습니다. 초대 링크 공유형 멀티기능이 아니라 한 기기 로컬 플레이에 맞춘 구조입니다.
- Edge Function의 CORS는 초기 테스트를 위해 넓게 열려 있습니다. 공개 운영 전에는 허용 도메인을 제한하고 요청량 제한·인증을 추가하세요.
- AI 출력은 모델 응답이므로 중요한 수치 변경과 규칙은 테스트 후 확정해야 합니다.


## URL 저장 및 불러오기
- 게임 화면 상단의 **URL 저장**을 누르면 현재 게임 상태를 URL 해시(`#r=`)에 기록하고 주소를 복사합니다.
- 저장한 URL로 접속하면 URL 스냅샷을 우선 복원합니다.
- **URL 불러오기**를 누르고 전체 URL 또는 `#r=` 뒤의 데이터 문자열을 붙여넣어 복원할 수도 있습니다.
- URL 저장은 저장 시점의 스냅샷이며, 이후 진행 내용이 기존 URL에 자동 반영되지는 않습니다.
- Base64URL은 인코딩일 뿐 암호화가 아닙니다. 저장 URL을 가진 사람은 내용을 확인할 수 있습니다.
- URL 길이가 지나치게 길어지면 브라우저나 메신저에서 다루기 어려울 수 있으므로, 장기 진행은 localStorage 자동 저장도 함께 사용하세요.
