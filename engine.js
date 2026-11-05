(function () {
  "use strict";

  const abilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

  function modifier(score) {
    return Math.floor((Number(score || 10) - 10) / 2);
  }

  function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  function chooseAbility(action) {
    if (/공격|때리|싸우|전투|밀치/.test(action)) return "STR";
    if (/숨|몰래|피하|도망|훔치|잠입/.test(action)) return "DEX";
    if (/버티|견디|참|저항/.test(action)) return "CON";
    if (/조사|기억|해석|마법|지식/.test(action)) return "INT";
    if (/관찰|살피|감지|추적|눈치/.test(action)) return "WIS";
    if (/설득|협상|대화|속이|위협/.test(action)) return "CHA";
    return "WIS";
  }

  function addJournal(state, entry) {
    state.journal = state.journal || [];
    state.journal.push(entry);
  }

  function start(payload) {
    const state = payload.gameState;
    state.combat = null;

    state.story =
      "안개가 짙게 깔린 숲에서 모험이 시작된다. 나무 사이로 희미한 발자국이 이어지고, 멀리서 정체를 알 수 없는 울음소리가 들려온다.";

    state.location = "미지의 숲";
    state.worldTime = "첫날, 새벽";
    state.choices = [
      "주변을 자세히 관찰한다.",
      "발자국을 따라간다.",
      "일행과 앞으로의 행동을 논의한다."
    ];

    state.turn = "a";
    addJournal(state, "모험이 미지의 숲에서 시작되었다.");

    return state;
  }

  function action(payload) {
    const state = payload.gameState;
    const actor = payload.actor;
    const actionText = String(payload.action || "").trim();

    if (!actor || !actionText) {
      throw new Error("행동 또는 캐릭터 정보가 없습니다.");
    }

    const character = state.characters.find(
      c => c.player === actor
    );

    if (!character) {
      throw new Error("행동할 캐릭터를 찾을 수 없습니다.");
    }

    const ability = chooseAbility(actionText);
    const roll = Number(payload.visibleRoll || rollD20());
    const bonus = modifier(character.stats[ability.toLowerCase()]);
    const total = roll + bonus;
    const dc = /어렵|위험|강력|복잡/.test(actionText) ? 15 : 12;
    const success = total >= dc;

    const check = {
      ability,
      roll,
      bonus,
      total,
      dc,
      success
    };

    let story;

    if (success) {
      story = `${character.name}의 행동이 성공했다. 판정 결과 ${total}으로 난이도 ${dc}를 넘었다.`;
    } else {
      story = `${character.name}의 행동은 뜻대로 되지 않았다. 판정 결과 ${total}으로 난이도 ${dc}에 미치지 못했다.`;
    }

    if (/관찰|살피|조사/.test(actionText) && success) {
      story += " 주변 나무 사이에서 오래된 흔적을 발견했다.";
    }

    if (/발자국|추적/.test(actionText) && success) {
      story += " 발자국은 숲 안쪽의 작은 공터로 이어진다.";
      state.location = "숲속 공터";
    }

    if (/공격|때리|싸우/.test(actionText)) {
      story += " 숲속의 낯선 생명체가 모습을 드러냈다.";
    }

    addJournal(state, story);

    character.exp = Number(character.exp || 0) + (success ? 10 : 5);

    let pendingStatPoints = Number(character.pendingStatPoints || 0);

    if (character.exp >= character.level * 100) {
      character.exp -= character.level * 100;
      character.level += 1;
      pendingStatPoints += 1;
      story += ` 레벨이 ${character.level}로 상승했다. 능력치 포인트 1점을 얻었다.`;
    }

    character.pendingStatPoints = pendingStatPoints;
    state.story = story;
    state.lastCheck = check;
    state.choices = [
      "주변을 더 조사한다.",
      "일행과 다음 행동을 결정한다.",
      "숲 안쪽으로 이동한다."
    ];

    const index = state.characters.indexOf(character);
     state.turn =
      state.characters[(index + 1) % state.characters.length].player.toLowerCase();
    return state;
  }

  window.TRPGEngine = {
    handle(payload) {
      if (payload.mode === "start") return start(payload);
      if (payload.mode === "action") return action(payload);
      throw new Error("지원하지 않는 게임 명령입니다.");
    }
  };
})();
