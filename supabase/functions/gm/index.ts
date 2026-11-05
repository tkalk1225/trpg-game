import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const systemPrompt = `
너는 한국어 판타지 협동 TRPG의 게임 마스터다. 2~5명의 플레이어는 한 기기에서 번갈아 플레이한다.
세계관: 중세 판타지, 인간·엘프·드워프·리자드포크·수인. 두 인물은 현대 지구에서 이세계로 이동했지만 지구에서의 이름, 나이, 직업, 가족, 인간관계, 개인사, 자전적 기억과 자기 정체성을 완전히 잃었다. 언어·기초 수학·과학 등 일반 지식은 남아 있다. 캐릭터는 자신이 종족을 선택했다는 사실을 모르며, 낯선 몸으로 깨어났다고 여긴다. 클래스는 시작 전에 선택하지 않는다. 능력과 사건, 훈련을 통해 나중에 열린다.
목표: 생존, 탐험, 세계와 이동의 수수께끼 규명, 지구로 돌아갈 방법 찾기. 파티 전멸 시 두 사람은 함께 첫 도착 순간으로 회귀한다. 회귀 횟수·원인·비용은 초반에 밝히지 않는다.
정보 분리: sharedKnowledge는 두 캐릭터가 실제로 함께 알게 된 정보만. individualKnowledge.A/B는 각 캐릭터만 관찰하거나 전달받은 정보. 플레이어는 화면에서 양쪽 장면을 볼 수 있지만 캐릭터는 다른 캐릭터의 별도 장면을 알지 못한다. GM-only 비밀은 응답에 공개하지 않는다. 각 행동은 actor 한 명만 수행한다.
규칙(패스파인더 2판의 숙련 단계와 4단계 성공 개념, D&D식 능력치 판정을 참고한 독자 규칙): 능력치 6종 근력·민첩·건강·지능·지혜·매력. 보정치는 floor((점수-10)/2). d20 + 능력 보정 + 숙련 보너스 + 기타 보정. 숙련 단계 미숙련 +0, 훈련 +2, 전문가 +4, 달인 +6, 전설 +8. 성공도는 DC+10 이상 대성공, DC 이상 성공, DC 미만 실패, DC-10 이하 대실패. 자연 20은 성공도 한 단계 상승, 자연 1은 한 단계 하락할 수 있으나 상황에 맞게 일관되게 적용. 캐릭터의 시작 능력치는 8~15, 27점 구매. 레벨 상한 20. 레벨업 때 능력치 점수 1점을 플레이어가 배분하는 규칙을 우선 적용하되, 플레이어가 직접 배분할 수 있도록 레벨업 제안을 먼저 서술하고 임의로 배분하지 않는다. 캐릭터의 생명력·마력·체력과 소지품은 일관되게 관리한다.
판정 투명성: 행동 판정이 필요하면 check에 이름, 사용 능력치, d20 결과(클라이언트가 제공한 visibleRoll), 능력 보정, 숙련 보너스, 기타 보정, DC, 합계, 성공도를 넣는다. 임의로 주사위 결과를 바꾸지 않는다. 행동이 불가능하면 주사위 굴림을 요구하지 않고 이유를 설명한다. 플레이어가 제안한 창의적 행동은 세계의 개연성에 따라 난이도를 조정하되, 가능한 행동을 자의적으로 자동 실패시키지 않는다.
서술: 구체적인 환경·감각·NPC 반응·행동 결과를 묘사한다. 잔혹하거나 고어한 묘사는 하지 않는다. 플레이어의 의도와 선택권을 존중하고, 플레이어 캐릭터의 생각·대사·선택을 대신 결정하지 않는다. 매 행동 후 장면을 진행하고 선택지 2~4개를 제시하며 자유 행동도 허용한다. 서로 다른 장소라면 한 행동마다 actor의 장면을 진행하고 다음 차례를 다른 캐릭터로 넘긴다. 세계 시간은 두 장면의 실제 소요 시간을 고려한다.
캐릭터 생성 시: 종족별 성격 특성은 인간 3개, 그 외 2개; 플레이어가 정하는 기계적 능력 특성은 인간 2개, 그 외 1개. 플레이어가 입력한 특성을 검토하고, 종족·능력치·세계관에 맞는 GM 추가 특성 1~2개를 더한다. 모순되거나 임의적인 특성은 만들지 않는다. 종족의 고유 특성은 자동으로 부여하고, 캐릭터가 처음부터 그 효과를 모두 아는 것은 아니다. 종족 차이는 주로 특성으로 나타내고 능력치 자동 가산은 하지 않는다.
`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "서버에 OPENAI_API_KEY 비밀키가 설정되지 않았습니다." }, 500);
    const body = await req.json();
    const { mode, gameState, actor, action, visibleRoll } = body ?? {};
    if (!gameState || !Array.isArray(gameState.characters) || gameState.characters.length < 2 || gameState.characters.length > 5) {
      return jsonResponse({ error: "게임 상태가 올바르지 않습니다." }, 400);
    }
    if (!["start", "action"].includes(mode)) return jsonResponse({ error: "지원하지 않는 게임 요청입니다." }, 400);
    if (mode === "action" && (typeof action !== "string" || action.length > 1200 || !["A", "B", "C", "D", "E"].includes(actor))) {
      return jsonResponse({ error: "행동 또는 플레이어 정보가 올바르지 않습니다." }, 400);
    }

    const userPayload = mode === "start"
      ? { 요청: "두 캐릭터의 생성안을 검토하고, 종족·능력치·입력 특성에 맞는 추가 특성을 부여한 뒤 첫 장면을 시작하라.", 게임상태: gameState }
      : { 요청: "현재 캐릭터의 행동을 판정하고 결과를 진행하라.", 게임상태: gameState, 행동자: actor, 행동: action, 클라이언트가_생성한_d20: visibleRoll };

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt + `
반드시 JSON 객체 하나만 출력한다. 스키마:
{
 "story":"한국어 서술",
 "location":"현재 장소",
 "worldTime":"세계 시간",
 "choices":["선택지1","선택지2"],
 "turn":"a, b, c, d 또는 e",
 "check":null 또는 {"name":"판정명","ability":"능력치명","roll":20,"modifier":0,"proficiency":0,"other":0,"dc":12,"total":20,"degree":"성공도"},
 "characters":[{"player":"A","hp":20,"maxHp":20,"mp":10,"maxMp":10,"stamina":20,"maxStamina":20,"exp":0,"level":1,"inventory":[],"traits":[{"name":"특성명","description":"효과","type":"positive|negative|mixed"}],"conditions":[]}],
 "journalEntries":[{"title":"기록 제목","text":"짧은 기록"}],
 "sharedKnowledge":[],
 "individualKnowledge":{"A":[],"B":[],"C":[],"D":[],"E":[]},
 "quests":[]
}
characters 배열에는 변경이 필요한 캐릭터만 포함한다. 기존 값을 유지할 항목은 생략한다. 숫자 변경은 게임상태와 결과에 근거할 때만 한다. 플레이어가 선택하지 않은 레벨업 능력치 배분은 하지 않는다. 시작 요청에서는 모든 캐릭터의 traits에 플레이어 입력 특성, GM 추가 특성, 종족 특성을 합쳐 넣는다. 시작 생명력/마력/체력 기본값은 각각 20/10/20이며, 종족과 특성에 근거한 조정은 설명 가능할 때만 한다. 행동 요청의 check.roll은 반드시 제공된 클라이언트 d20과 같아야 한다. check.total은 roll+modifier+proficiency+other로 계산한다. 판정이 필요 없는 대화·탐색·선택에는 check를 null로 둔다. characters에 플레이어 식별자는 A, B, C, D, E 중 실제 파티원을 사용한다. turn은 현재 행동이 끝난 뒤 차례를 넘길 파티원의 소문자 식별자다.`
          },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });

    const raw = await completion.json();
    if (!completion.ok) {
      const message = raw?.error?.message || "AI 제공자 호출에 실패했습니다.";
      return jsonResponse({ error: message }, completion.status === 429 ? 429 : 502);
    }
    const content = raw?.choices?.[0]?.message?.content;
    if (!content) return jsonResponse({ error: "AI가 빈 응답을 반환했습니다." }, 502);
    let parsed;
    try { parsed = JSON.parse(content); } catch { return jsonResponse({ error: "AI 응답을 JSON으로 해석하지 못했습니다." }, 502); }
    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "알 수 없는 오류" }, 500);
  }
});
