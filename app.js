const STAT_NAMES = ["근력","민첩","건강","지능","지혜","매력"];
const STAT_KEYS = ["str","dex","con","int","wis","cha"];
const COST = {8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
const STORAGE_KEY = "trpg_regression_save_v1";
let state = null;
let activeTab = "status";
let busy = false;
let selectedChoice = null;

function $(id){return document.getElementById(id)}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function splitList(v){return v.split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)}
function modifier(score){return Math.floor((score-10)/2)}
function costFor(score){return Number.isInteger(score)&&score>=8&&score<=15?COST[score]:null}
function defaultStats(){return {str:8,dex:8,con:8,int:8,wis:8,cha:8}}
const PLAYER_KEYS=["a","b","c","d","e"];
function playerFormMarkup(p,index){
  const label=String.fromCharCode(65+index);
  return `<div class="character-form">
    <h3><span class="player-dot ${p}"></span> 플레이어 ${label}</h3>
    <label>캐릭터 이름<input id="${p}Name" maxlength="24" placeholder="이 세계에서 사용할 이름"></label>
    <label>종족<select id="${p}Race"><option value="인간">인간</option><option value="엘프">엘프</option><option value="드워프">드워프</option><option value="리자드포크">리자드포크</option><option value="수인">수인</option></select></label>
    <label>성격 특성 <small id="${p}PersonalityCount">3개 선택</small><textarea id="${p}Personality" rows="2" placeholder="쉼표로 구분해 입력"></textarea></label>
    <label>원하는 능력 특성 <small id="${p}TraitCount">2개 선택</small><textarea id="${p}Traits" rows="2" placeholder="예: 빠른 손놀림, 뛰어난 청각"></textarea></label>
    <div class="stats-head"><b>능력치</b><span>기본 8 · 총 27점 · 최대 15</span></div>
    <div class="stats" data-player="${p}"></div><div class="points" id="${p}Points">사용 점수: 0 / 27</div>
  </div>`;
}
function makeStatInputs(){
  const count=$("playerCount")?Number($("playerCount").value):2;
  $("characterForms").innerHTML=PLAYER_KEYS.slice(0,count).map(playerFormMarkup).join("");
  document.querySelectorAll(".stats").forEach(container=>{
    const p=container.dataset.player;
    container.innerHTML=STAT_NAMES.map((name,i)=>`<div class="stat"><label for="${p}_${STAT_KEYS[i]}">${name}</label><input type="number" min="8" max="15" step="1" value="8" id="${p}_${STAT_KEYS[i]}" data-player="${p}" data-stat="${STAT_KEYS[i]}"></div>`).join("");
  });
  PLAYER_KEYS.slice(0,count).forEach(p=>{
    document.querySelectorAll(`input[data-player="${p}"]`).forEach(el=>{
      el.addEventListener("input",()=>updatePoints(p));
      el.addEventListener("change",()=>{
        const value=Number(el.value);
        el.value=String(Number.isFinite(value)?Math.max(8,Math.min(15,Math.round(value))):8);
        updatePoints(p);
      });
    });
    $(`${p}Race`).addEventListener("change",()=>raceCounts(p));
    raceCounts(p);updatePoints(p);
  });
}
function readStats(p){const o={};STAT_KEYS.forEach(k=>o[k]=Number($(`${p}_${k}`).value));return o}
function pointsUsed(stats){return Object.values(stats).reduce((s,v)=>s+(costFor(v)??0),0)}
function updatePoints(p){
  const stats=readStats(p),invalid=Object.values(stats).some(v=>!Number.isInteger(v)||v<8||v>15),used=pointsUsed(stats);
  $(`${p}Points`).textContent=invalid?`능력치는 8~15 사이 정수여야 합니다. (현재 ${used} / 27)`:`사용 점수: ${used} / 27`;
  $(`${p}Points`).style.color=(invalid||used>27)?"#f0a5a5":"var(--gold)";
}
function raceCounts(p){
  const human=$(`${p}Race`).value==="인간";
  $(`${p}PersonalityCount`).textContent=`${human?3:2}개 선택`;
  $(`${p}TraitCount`).textContent=`${human?2:1}개 선택`;
}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$("saveState").textContent="자동 저장됨"}catch(e){$("saveState").textContent="저장 실패"}}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))}catch(e){return null}}

// URL에는 현재 상태의 스냅샷을 저장한다. Base64URL은 암호화가 아니다.
function encodeSaveUrl(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let binary="";
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
}
function decodeSaveUrl(encoded){
  if(!encoded||encoded.length>150000)throw new Error("URL 저장 데이터가 비어 있거나 너무 큽니다.");
  const normalized=encoded.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
function validateSaveData(data){
  if(!data||typeof data!=="object"||data.version!==1||!Array.isArray(data.characters)||data.characters.length<2||data.characters.length>5)throw new Error("지원하지 않거나 손상된 저장 데이터입니다.");
  if(!PLAYER_KEYS.slice(0,data.characters.length).includes(data.turn))throw new Error("저장 데이터의 차례 정보가 올바르지 않습니다.");
  for(const c of data.characters){
    if(!c||!PLAYER_KEYS.slice(0,data.characters.length).map(x=>x.toUpperCase()).includes(c.player)||!c.stats||!STAT_KEYS.every(k=>Number.isInteger(c.stats[k])&&c.stats[k]>=8&&c.stats[k]<=15))throw new Error("캐릭터 데이터가 올바르지 않습니다.");
  }
  return data;
}
function saveToUrl(){
  if(!state)throw new Error("먼저 게임을 시작해야 URL 저장을 할 수 있습니다.");
  const encoded=encodeSaveUrl(state);
  const url=`${location.origin}${location.pathname}${location.search}#r=${encoded}`;
  if(url.length>60000)throw new Error("저장 데이터가 너무 커서 URL로 저장하기 어렵습니다. 기기 자동 저장을 이용해 주세요.");
  history.replaceState(null,"",`#r=${encoded}`);
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(url).then(()=>{$("saveState").textContent="URL 복사 완료"}).catch(()=>{prompt("아래 주소를 복사해 보관하세요.",url)});
  }else prompt("아래 주소를 복사해 보관하세요.",url);
}
function loadFromUrlString(value){
  const raw=String(value||"").trim();
  const match=raw.match(/#r=([^&]+)/);
  const encoded=match?match[1]:raw.startsWith("r=")?raw.slice(2):raw;
  const restored=validateSaveData(decodeSaveUrl(encoded));
  state=restored;save();render();showCheck(state.lastCheck);
  return true;
}
function setError(id,msg){$(id).textContent=msg||""}
function currentCharacter(){return state.characters.find(c=>c.player.toLowerCase()===state.turn)}
function render(){
  if(!state){$("setupView").classList.remove("hidden");$("gameView").classList.add("hidden");return}
  $("setupView").classList.add("hidden");$("gameView").classList.remove("hidden");
  $("location").textContent=state.location||"장소 미상";
  $("worldTime").textContent=state.worldTime||"첫날, 새벽";
  $("story").textContent=state.story||"";
  const c=currentCharacter(),p=state.turn;
  $("turnTitle").textContent=`플레이어 ${p.toUpperCase()} · ${c.name}의 차례`;
  $("turnBadge").textContent=p.toUpperCase();$("turnBadge").className=`turn-badge ${p}`;
  $("choices").innerHTML=(state.choices||[]).map((x,i)=>`<button class="choice${selectedChoice===i?" selected":""}" data-choice="${i}" type="button">${i+1}. ${escapeHtml(x)}</button>`).join("");
$("choices").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  selectedChoice=Number(b.dataset.choice);
  $("choices").querySelectorAll("button").forEach(x=>x.classList.toggle("selected",Number(x.dataset.choice)===selectedChoice));
  $("actionInput").value=state.choices[selectedChoice];
}));
$("actionInput").value=selectedChoice===null?"":(state.choices[selectedChoice]||"");
  renderTab();renderParty();
}
function renderTab(){
  const el=$("tabContent");
  if(activeTab==="status"){
    el.className="tab-content";
    el.innerHTML=state.characters.map((c,i)=>`<div class="char-card">
      <div class="char-title"><span>${i===0?"🔹":"🔸"} ${escapeHtml(c.name)}</span><span class="muted">Lv.${c.level||1}</span></div>
      <div class="char-sub">${escapeHtml(c.race)} · 경험치 ${c.exp||0}</div>
      <div class="bars">
        <div><div class="bar-label"><span>생명력</span><span>${c.hp}/${c.maxHp}</span></div><div class="bar"><i style="width:${Math.max(0,Math.min(100,c.hp/c.maxHp*100))}%"></i></div></div>
        <div><div class="bar-label"><span>마력</span><span>${c.mp}/${c.maxMp}</span></div><div class="bar"><i style="width:${c.maxMp?Math.max(0,Math.min(100,c.mp/c.maxMp*100)):0}%;background:#8eb8e8"></i></div></div>
        <div><div class="bar-label"><span>체력</span><span>${c.stamina}/${c.maxStamina}</span></div><div class="bar"><i style="width:${Math.max(0,Math.min(100,c.stamina/c.maxStamina*100))}%;background:#d7b77a"></i></div></div>
      </div>
      <div class="stat-list">${STAT_NAMES.map((n,j)=>`<div class="stat-pill"><small>${n}</small><b>${c.stats[STAT_KEYS[j]]} (${modifier(c.stats[STAT_KEYS[j]])>=0?"+":""}${modifier(c.stats[STAT_KEYS[j]])})</b></div>`).join("")}</div>
      <div class="char-sub">성격: ${escapeHtml((c.personality||[]).join(" · ")||"미정")}</div>
      <div class="char-sub">특성: ${escapeHtml((c.traits||[]).map(t=>typeof t==="string"?t:t.name).join(" · ")||"없음")}</div>
    </div>`).join("");
  }else if(activeTab==="inventory"){
    el.className="inventory";
    el.innerHTML=state.characters.map(c=>`<h4>${escapeHtml(c.name)}</h4><ul>${(c.inventory||[]).length?(c.inventory||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join(""):"<li>소지품 없음</li>"}</ul>`).join("")+`<h4>공용 소지품</h4><ul>${(state.partyInventory||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join("")||"<li>없음</li>"}</ul>`;
  }else{
    el.className="journal-list";
    el.innerHTML=(state.journal||[]).slice().reverse().map(x=>`<div class="journal-item"><b>${escapeHtml(x.title||"모험 기록")}</b>${escapeHtml(x.text)}</div>`).join("")||"아직 기록이 없습니다.";
  }
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab));
}
function renderParty(){
  $("partyStatus").innerHTML=state.characters.map(c=>`<div class="party-row"><span>${escapeHtml(c.player)} · ${escapeHtml(c.name)}</span><span>${c.hp}/${c.maxHp} HP</span></div>`).join("");
}
function showCheck(check){
  const box=$("checkBox");
  if(!check){box.classList.add("hidden");box.textContent="";return}
  box.classList.remove("hidden");
  box.textContent=`판정: ${check.name||"능력 판정"} · ${check.die||"1d20"} 결과 ${check.roll} + 능력 보정 ${check.modifier>=0?"+":""}${check.modifier} + 숙련 ${check.proficiency>=0?"+":""}${check.proficiency} = ${check.total} / 난이도 ${check.dc} · ${check.degree||""}`;
}
function dice20(){const a=new Uint32Array(1);crypto.getRandomValues(a);return (a[0]%20)+1}
async function callGM(payload){
    const cfg=window.TRPG_CONFIG||{};
  const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes("YOUR-PROJECT")&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  if(!configured){
    if(window.TRPGEngine)return window.TRPGEngine.handle(payload);
    throw new Error("로컬 게임 엔진을 불러오지 못했습니다. engine.js를 확인해 주세요.");
  }
  const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/gm`,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.SUPABASE_ANON_KEY,"Authorization":`Bearer ${cfg.SUPABASE_ANON_KEY}`},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`AI 호출 실패 (${response.status})`);
  return data;
}
function validateCharacter(p){
  const name=$(`${p}Name`).value.trim(),race=$(`${p}Race`).value,stats=readStats(p);
  if(!name)throw new Error(`플레이어 ${p.toUpperCase()}의 캐릭터 이름을 입력해 주세요.`);
  if(Object.values(stats).some(v=>!Number.isInteger(v)||v<8||v>15))throw new Error(`${p.toUpperCase()}의 능력치는 8~15 사이 정수여야 합니다.`);
  if(pointsUsed(stats)!==27)throw new Error(`${p.toUpperCase()}의 능력치 점수가 27점이 아닙니다. 현재 ${pointsUsed(stats)}점입니다.`);
  const personality=splitList($(`${p}Personality`).value),traits=splitList($(`${p}Traits`).value);
  const human=race==="인간",pc=human?3:2,tc=human?2:1;
  if(personality.length!==pc)throw new Error(`${p.toUpperCase()}의 성격 특성을 ${pc}개 입력해 주세요.`);
  if(traits.length!==tc)throw new Error(`${p.toUpperCase()}의 능력 특성을 ${tc}개 입력해 주세요.`);
  return {player:p.toUpperCase(),name,race,stats,personality,desiredTraits:traits,level:1,exp:0,hp:20,maxHp:20,mp:10,maxMp:10,stamina:20,maxStamina:20,inventory:[],traits:[],conditions:[]};
}
async function startGame(){
  setError("setupError","");
  try{
    const count=Number($("playerCount").value);
    const characters=PLAYER_KEYS.slice(0,count).map(validateCharacter);
    state={version:1,turn:"a",location:"미지의 숲",worldTime:"첫날, 새벽",story:"모험가들의 이야기가 시작됩니다.",choices:[],characters,partyInventory:[],journal:[],sharedKnowledge:[],individualKnowledge:Object.fromEntries(characters.map(c=>[c.player,[]])),quests:[],regressionCount:0};
    busy=true;$("startBtn").disabled=true;$("startBtn").textContent="세계 생성 중…";
    const result=await callGM({mode:"start",gameState:state});
    applyGMResult(result, false);
    save();render();
  }catch(e){setError("setupError",e.message);state=null}
  finally{busy=false;$("startBtn").disabled=false;$("startBtn").innerHTML='캐릭터 확정 및 모험 시작 <span>→</span>'}
}
function applyGMResult(result, advanceTurn=false){
  if(!result||typeof result!=="object")throw new Error("AI 응답 형식이 올바르지 않습니다.");
  if(typeof result.story==="string")state.story=result.story;
  if(typeof result.location==="string")state.location=result.location;
  if(typeof result.worldTime==="string")state.worldTime=result.worldTime;
  if(Array.isArray(result.choices))state.choices=result.choices.slice(0,5).map(String);
  if(Array.isArray(result.journalEntries))state.journal.push(...result.journalEntries.slice(0,3));
  if(Array.isArray(result.sharedKnowledge))state.sharedKnowledge=result.sharedKnowledge.slice(-30);
  if(result.individualKnowledge&&typeof result.individualKnowledge==="object")state.individualKnowledge=result.individualKnowledge;
  if(Array.isArray(result.quests))state.quests=result.quests;
  if(Array.isArray(result.characters)){
    result.characters.forEach(update=>{
      const c=state.characters.find(x=>x.player===update.player);
      if(!c)return;
      ["hp","mp","stamina","exp","level"].forEach(k=>{if(Number.isFinite(update[k]))c[k]=Math.max(0,Math.min(k==="level"?20:99999,Math.round(update[k])))});
      ["maxHp","maxMp","maxStamina"].forEach(k=>{if(Number.isFinite(update[k]))c[k]=Math.max(1,Math.min(999,Math.round(update[k])))});
      if(Array.isArray(update.inventory))c.inventory=update.inventory.slice(0,40).map(String);
      if(Array.isArray(update.traits))c.traits=update.traits.slice(0,12);
      if(Array.isArray(update.conditions))c.conditions=update.conditions.slice(0,12).map(String);
    });
  }
  if(result.check&&typeof result.check==="object")state.lastCheck=result.check;
  else state.lastCheck=null;
  if(PLAYER_KEYS.slice(0,state.characters.length).includes(result.turn))state.turn=result.turn;
  else if(advanceTurn){const idx=state.characters.findIndex(c=>c.player.toLowerCase()===state.turn);state.turn=state.characters[(idx+1)%state.characters.length].player.toLowerCase();}
}
async function submitAction(actionText){
  if(busy||!state)return;
  const action=String(actionText||"").trim();
  if(!action)return setError("gameError","행동을 입력하거나 선택지를 골라 주세요.");
  setError("gameError","");
  const actor=currentCharacter(),roll=dice20();
  const payload={mode:"action",gameState:state,actor:actor.player,action,visibleRoll:roll};
  busy=true;$("submitAction").disabled=true;$("submitAction").textContent="판정 중…";
  try{
    const result=await callGM(payload);
    applyGMResult(result, true);
    showCheck(state.lastCheck);
    state.journal.push({title:`${actor.name}의 행동`,text:`${action} — ${state.story.slice(0,220)}`});
    save();render();showCheck(state.lastCheck);
  }catch(e){setError("gameError",e.message)}
  finally{busy=false;$("submitAction").disabled=false;$("submitAction").innerHTML='행동하기 <span>→</span>'}
}
function resetGame(){
  if(!confirm("저장된 모험을 삭제하고 새 게임을 시작할까요?"))return;
  localStorage.removeItem(STORAGE_KEY);state=null;activeTab="status";
  history.replaceState(null,"",`${location.pathname}${location.search}`);
  render();
}
document.addEventListener("DOMContentLoaded",()=>{
  makeStatInputs();
  $("playerCount").addEventListener("change",makeStatInputs);
  $("startBtn").addEventListener("click",startGame);
  $("submitAction").addEventListener("click",()=>submitAction($("actionInput").value));
  $("actionInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitAction(e.target.value)}});
  $("resetBtn").addEventListener("click",resetGame);
  $("saveUrlBtn").addEventListener("click",()=>{
    try{saveToUrl()}catch(e){alert(e.message)}
  });
  $("loadUrlBtn").addEventListener("click",()=>{
    const value=prompt("불러올 전체 저장 URL 또는 #r= 뒤의 데이터를 붙여넣으세요.");
    if(value===null)return;
    try{loadFromUrlString(value)}catch(e){alert(`불러오기 실패: ${e.message}`)}
  });
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;renderTab()}));
  const hashMatch=location.hash.match(/^#r=([^&]+)/);
  if(hashMatch){
    try{state=validateSaveData(decodeSaveUrl(hashMatch[1]));save();render();showCheck(state.lastCheck);return}
    catch(e){console.warn("URL 저장 데이터 복구 실패:",e);$("saveState").textContent="URL 복구 실패"}
  }
  const saved=load();
  if(saved&&saved.characters?.length>=2&&saved.characters?.length<=5){try{state=validateSaveData(saved);render();showCheck(state.lastCheck)}catch(e){console.warn("기기 저장 데이터 복구 실패:",e)}}
});
