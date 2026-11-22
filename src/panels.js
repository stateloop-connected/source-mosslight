import { UPGRADES, MODES, KEEPERS, ENEMY_NAMES, timeText } from "./core.js";

const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
export const buildText = (build, keeper = "lantern") =>
  UPGRADES.filter((u) => build[u.id])
    .map((u) => `${u.name} ${build[u.id]}/${u.max}`)
    .join(" · ") ||
  `${KEEPERS[keeper]?.name || KEEPERS.lantern.name}的初始能力 · 还未选择成长`;
export function buildOverview(game) {
  const s = game.stats;
  return `<div class="build-overview"><div class="section-heading"><h3>这一局的生长</h3><span>${KEEPERS[game.keeper].name} · Lv. ${game.level} · ${MODES[game.mode].label} ${timeText(game.elapsed)}</span></div><dl class="build-stats">${[
    ["生命", `${Math.ceil(game.player.hp)} / ${s.maxHp}`],
    ["萤火伤害", s.damage.toFixed(1)],
    ["发射频率", `${(1 / s.interval).toFixed(1)} 次/秒`],
    ["每次萤火", `${s.bolts} 枚`],
    ["移动速度", Math.round(s.speed)],
    ["微光吸引", Math.round(s.magnet)],
    ["叶环伤害", s.orbit ? `${s.orbit} / 0.55秒` : "未获得"],
    ["冲刺冷却", `${s.dashCooldown.toFixed(1)} 秒`],
  ]
    .map(([label, value]) => stat(label, value))
    .join(
      "",
    )}</dl><p class="build-list">${buildText(game.build, game.keeper)}</p></div>`;
}
export function keeperPanel(selected) {
  return `<h2 id="dialog-title">今晚，如何守望</h2><p class="intro">三种起步方式，各有长处；能力仍由这一局的选择生长。</p><fieldset class="keeper-options"><legend class="sr-only">选择守夜人</legend>${Object.entries(
    KEEPERS,
  )
    .map(
      ([id, k]) =>
        `<label class="keeper-option"><input type="radio" name="keeper" data-setting="keeper" value="${id}" ${selected === id ? "checked" : ""}><svg aria-hidden="true"><use href="#i-${k.icon}"/></svg><span><strong>${k.name}</strong><small>${k.desc}</small><span>${k.summary}</span><span class="keeper-detail">${k.detail}</span></span></label>`,
    )
    .join(
      "",
    )}</fieldset><p class="panel-note">三位守夜人从开始即可选择，无需解锁。正式纪录共用，足迹会标明使用的守夜人。</p><button class="start-button" data-action="close-panel">完成选择</button>`;
}
export function runDetails(game) {
  const m = game.metrics;
  const reason =
    game.status === "lost" && game.endReason !== "abandoned" && game.lastHit
      ? `最后受到${ENEMY_NAMES[game.lastHit.type] || "虫影"}的伤害；下次可留一次冲刺脱离近身。`
      : game.endReason === "abandoned"
        ? "这次守望由你主动结束，成绩已保留。"
        : "";
  return `<details class="result-details"><summary>这一夜的战斗明细</summary><dl class="combat-stats">${[
    ["有效伤害", Math.round(m.damageDealt).toLocaleString("zh-CN")],
    ["承受伤害", Math.round(m.damageTaken)],
    ["使用冲刺", `${m.dashes} 次`],
    ["恢复生命", Math.round(m.healed)],
    ["拾取微光", game.collected],
  ]
    .map(([label, value]) => stat(label, value))
    .join("")}</dl>${reason ? `<p>${reason}</p>` : ""}</details>`;
}
export function guidePanel(game) {
  return `<h2 id="dialog-title">花园图鉴</h2><p class="intro">认识每一份馈赠，也认清夜里的虫影。</p>${game ? buildOverview(game) : ""}<div class="guide-content"><h3>八种生长方向</h3>${UPGRADES.map((u) => `<details><summary>${u.name}<span>上限 ${u.max} 级</span></summary><p>${u.desc}${u.id === "orbit" ? "叶环每 0.55 秒触发一次，每级增加 10 点伤害。" : ""}</p></details>`).join("")}<h3>夜里的来客</h3>${[
    ["苔螨", "缓慢接近的虫影。保持移动，留意背后的聚集。"],
    ["甲虫", "生命和碰撞体型更大，移动较慢。别被它挡住退路。"],
    ["游光", "体型小，速度快慢交替。优先为自己留出躲避距离。"],
    [
      "噬光巨蛾",
      "守夜 2:20、练习 1:05 时出现。粉色带状区域表示巨蛾与角色的碰撞危险范围，蓄力后横向离开；画面外有方向提示。击败后留下 40 点微光，但存活到黎明就能获胜。",
    ],
  ]
    .map(
      ([name, desc]) =>
        `<details><summary>${name}</summary><p>${desc}</p></details>`,
    )
    .join(
      "",
    )}</div><button class="start-button" data-action="close-panel">返回</button>`;
}
export function settingsPanel(record, available) {
  return `<h2 id="dialog-title">让守夜更顺手</h2><p class="intro" data-save-status aria-live="polite">设置即时生效，${available ? "自动保存在这台设备上。" : "本次有效；浏览器未允许保存，刷新后会恢复默认。"}</p><div class="settings-content"><label class="setting-row" for="setting-sound"><span><b>游戏音效</b><small>轻声的萤火、拾取与冲刺反馈</small></span><input id="setting-sound" type="checkbox" data-setting="sound" ${record.sound ? "checked" : ""}></label><div class="volume-setting"><label for="setting-volume">音效音量 <output id="volume-value">${Math.round(record.volume * 100)}%</output></label><input id="setting-volume" data-setting="volume" type="range" min="0" max="100" step="5" value="${Math.round(record.volume * 100)}"></div><fieldset class="setting-group"><legend>画面效果</legend><label><input type="radio" name="effects" data-setting="effects" value="auto" ${record.effects === "auto" ? "checked" : ""}><span>跟随系统</span></label><label><input type="radio" name="effects" data-setting="effects" value="reduced" ${record.effects === "reduced" ? "checked" : ""}><span>轻量效果</span></label><p>轻量模式减少粒子和画布像素，玩法不变；系统的减少动态效果设置始终受到尊重。</p></fieldset><fieldset class="setting-group"><legend>操作方式</legend>${[
    ["auto", "自动识别"],
    ["keyboard", "键盘"],
    ["touch", "触屏摇杆"],
  ]
    .map(
      ([value, label]) =>
        `<label><input type="radio" data-setting="controls" name="controls" value="${value}" ${record.controls === value ? "checked" : ""}><span>${label}</span></label>`,
    )
    .join(
      "",
    )}<p>键盘始终可用。触屏模式显示摇杆和冲刺按钮，适合平板与触控电脑。</p></fieldset></div><button class="start-button" data-action="close-panel">完成</button>`;
}
export function journalPanel(record, canReplay) {
  const outcomes = { won: "迎来黎明", lost: "微光暂歇", abandoned: "主动结束" };
  return `<h2 id="dialog-title">守夜足迹</h2><p class="intro">最近 ${record.history.length} / 8 局 · 练习单独标记，不影响正式纪录。</p>${record.history.length ? `<ol class="run-list">${record.history.map((run, i) => `<li><div class="run-heading"><strong>${MODES[run.mode].label} · ${outcomes[run.outcome]} · ${KEEPERS[run.keeper].name}</strong><time datetime="${new Date(run.endedAt).toISOString()}">${new Date(run.endedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div><p class="run-numbers">${run.score.toLocaleString("zh-CN")} 微光 · ${timeText(run.elapsed)} · ${run.kills} 虫影 · Lv. ${run.level}</p><p>${buildText(run.build, run.keeper)}</p><div class="run-footer"><span>种子 ${run.seed}</span><button class="secondary-button" data-replay="${i}" ${canReplay ? "" : "disabled"}>重试这一局</button></div></li>`).join("")}</ol>` : '<div class="empty-journal"><p>花园还在等第一行足迹。</p><p>完成一次守夜或练习后，这里会留下时间、能力与种子。</p></div>'}<p class="panel-note">${canReplay ? "相同种子复用随机起点；操作、视口和选择会影响后续进程，并非录像回放。" : "本局仍在进行，结算后可以从足迹重试；返回即可继续。"}</p><button class="start-button" data-action="close-panel">返回</button>`;
}
