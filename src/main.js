import { Game, UPGRADES, clamp, timeText, scoreFor, xpFor } from "./core.js";
import { Renderer } from "./renderer.js";
import { loadRecord, saveRecord } from "./storage.js";
import { Audio } from "./audio.js";

// Keep touch controls stable on hybrid devices, including after a mouse click.
document.documentElement.classList.toggle(
  "touch-device",
  navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches,
);

const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  renderer = new Renderer(canvas),
  audio = new Audio();
let loaded;
try {
  loaded = loadRecord();
} catch {
  loaded = {
    record: { score: 0, wins: 0, bestTime: 0, runs: 0, sound: false },
    available: false,
  };
}
const record = loaded.record;
audio.enabled = record.sound;
let storageAvailable = loaded.available,
  game = null,
  screen = "menu",
  lastFrame = performance.now(),
  previousFocus = null,
  helpFrom = "menu",
  toastUntil = 0,
  lastSaved = null,
  pointerId = null,
  gamepad = { x: 0, y: 0 };
const keys = new Set();
const preview = new Game({ seed: 84 });
preview.player.x = 1130;
preview.player.y = 785;
preview.enemies = [
  {
    id: 1,
    type: "mite",
    x: 1285,
    y: 820,
    radius: 12,
    hp: 20,
    maxHp: 20,
    phase: 0,
    hit: 0,
  },
  {
    id: 2,
    type: "beetle",
    x: 1325,
    y: 725,
    radius: 19,
    hp: 50,
    maxHp: 50,
    phase: 1,
    hit: 0,
  },
  {
    id: 3,
    type: "wisp",
    x: 1025,
    y: 664,
    radius: 9,
    hp: 15,
    maxHp: 15,
    phase: 2,
    hit: 0,
  },
];
preview.motes = [
  { x: 1185, y: 744, radius: 4 },
  { x: 1240, y: 868, radius: 4 },
  { x: 1082, y: 844, radius: 4 },
  { x: 1364, y: 794, radius: 4 },
];
export const getSession = () => ({ game, screen, record });
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const phases = [
  "露水初降",
  "苔叶轻响",
  "虫影渐近",
  "夜色正浓",
  "微光不灭",
  "黎明将至",
];

function records() {
  $("record-score").textContent = record.score.toLocaleString("zh-CN");
  $("record-wins").textContent = record.wins;
  $("record-time").textContent = timeText(record.bestTime);
  $("storage-warning").hidden = storageAvailable;
  $("local-note").hidden = !storageAvailable;
}
function save() {
  storageAvailable = saveRecord(record);
  records();
}
function soundUI() {
  $("sound-icon").setAttribute("href", audio.enabled ? "#i-sound" : "#i-muted");
  $("sound-button").setAttribute(
    "aria-label",
    audio.enabled ? "关闭音效" : "开启音效",
  );
  $("sound-button").setAttribute("aria-pressed", String(audio.enabled));
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  toastUntil = performance.now() + 3000;
}
function resetInput() {
  keys.clear();
  pointerId = null;
  gamepad = { x: 0, y: 0 };
  $("joystick-knob").style.transform = "translate(0px,0px)";
}
function hideDialog() {
  const restore = previousFocus;
  $("overlay").hidden = true;
  previousFocus = null;
  if (restore?.isConnected) restore.focus({ preventScroll: true });
}
function dialog(html) {
  if ($("overlay").hidden) previousFocus = document.activeElement;
  $("dialog").innerHTML = html;
  $("overlay").hidden = false;
  resetInput();
  requestAnimationFrame(() =>
    ($("dialog").querySelector("button") || $("dialog")).focus({
      preventScroll: true,
    }),
  );
}
function showGameUI(visible) {
  for (const id of ["hud", "bottom-hud", "touch-controls"])
    $(id).hidden = !visible;
  $("menu-panel").hidden = visible;
  if (!visible) $("boss-hud").hidden = true;
}
function start() {
  audio.unlock();
  game = new Game({
    mode: document.querySelector('input[name="mode"]:checked').value,
  });
  screen = "playing";
  renderer.effects = [];
  lastSaved = null;
  resetInput();
  hideDialog();
  showGameUI(true);
  updateBuild();
  canvas.focus({ preventScroll: true });
  toast("收集金色微光来升级，萤火会自动攻击");
  updateHUD();
}
function menu() {
  game = null;
  screen = "menu";
  resetInput();
  hideDialog();
  showGameUI(false);
  $("start-button").focus({ preventScroll: true });
}
function pause() {
  if (screen !== "playing" || !game) return;
  game.pause();
  screen = "paused";
  resetInput();
  showPause();
}
function resume() {
  if (!game || game.status !== "paused") return;
  game.resume();
  screen = "playing";
  hideDialog();
  resetInput();
  canvas.focus({ preventScroll: true });
}
function showPause() {
  dialog(
    `<h2 id="dialog-title">在苔叶间歇一会儿</h2><p class="intro">花园已经暂停，微光会等你回来。</p><button class="start-button" data-action="resume">继续守夜</button><button class="secondary-button" data-action="abandon">结束本局</button><p class="result-build">P 或 Esc 继续 · 当前 ${timeText(game.elapsed)}</p>`,
  );
}
function showAbandon() {
  dialog(
    `<h2 id="dialog-title">结束这次守望？</h2><p class="intro">本局将按当前成绩结算，可以随时重新出发。</p><div class="dialog-actions"><button class="start-button" data-action="resume">继续守夜</button><button class="secondary-button" data-action="finish">结束并结算</button></div>`,
  );
}
function showUpgrade() {
  screen = "choosing";
  dialog(
    `<h2 id="dialog-title">微光，又长大了一点</h2><p class="intro">升至 Lv. ${game.level} · 选择一份花园的馈赠</p><div class="upgrade-grid">${game.choices
      .map((id, i) => {
        const u = UPGRADES.find((u) => u.id === id),
          level = (game.build[id] || 0) + 1;
        return `<button class="upgrade-card" data-upgrade="${id}">${icon(u.icon)}<strong>${u.name}</strong><small>Lv. ${level} / ${u.max}</small><p>${u.desc}</p><span class="card-shortcut">按 ${i + 1} 选择</span></button>`;
      })
      .join("")}</div>`,
  );
}
function choose(id) {
  if (!game?.choose(id)) return;
  audio.play("upgrade");
  updateBuild();
  if (game.status === "choosing") showUpgrade();
  else {
    screen = "playing";
    hideDialog();
    resetInput();
    canvas.focus({ preventScroll: true });
  }
}
function updateBuild() {
  if (!game) return;
  $("equipped").innerHTML = Object.entries(game.build)
    .map(
      ([id, n]) =>
        `<span title="${UPGRADES.find((u) => u.id === id).desc}">${UPGRADES.find((u) => u.id === id).name} ${n}</span>`,
    )
    .join("");
}
function showResult() {
  const won = game.status === "won",
    practice = game.mode === "practice",
    score = scoreFor(game);
  screen = "result";
  resetInput();
  if (lastSaved !== game) {
    lastSaved = game;
    if (!practice) {
      record.runs++;
      record.score = Math.max(record.score, score);
      record.bestTime = Math.max(record.bestTime, Math.floor(game.elapsed));
      if (won) record.wins++;
      save();
    }
    audio.play("end");
  }
  const title = won
    ? practice
      ? "初次守望，完成了"
      : "天亮了，花园还在"
    : "把微光留给下一次";
  const description = won
    ? game.bossDefeated
      ? "你驱散了巨蛾，也迎来了清晨。"
      : "你守住了这一夜，每一点微光都没有白费。"
    : "休整一下，换一种生长的方式再出发。";
  const build =
    Object.entries(game.build)
      .map(([id, n]) => `${UPGRADES.find((u) => u.id === id).name} ${n}`)
      .join(" / ") || "最初的萤火";
  dialog(
    `<div class="result-symbol">${icon(won ? "leaf" : "spark")}</div><h2 id="dialog-title">${title}</h2><p class="intro">${description}</p><div class="result-stats"><div><b>${score.toLocaleString("zh-CN")}</b><span>本局微光</span></div><div><b>${timeText(game.elapsed)}</b><span>守望时间</span></div><div><b>${game.kills}</b><span>驱散虫影</span></div></div><p class="result-build">${build}</p>${practice ? '<p class="result-build">练习局不计入守夜手记</p>' : ""}<div class="dialog-actions"><button class="start-button" data-action="restart">再守一夜</button><button class="secondary-button" data-action="menu">回到花园</button></div>`,
  );
}
function help() {
  if (screen === "help") return;
  helpFrom = screen;
  if (screen === "playing") game.pause();
  screen = "help";
  resetInput();
  dialog(
    `<h2 id="dialog-title">做一晚花园的守夜人</h2><p class="intro">移动躲开虫影，萤火会自动照亮最近的敌人。</p><div class="help-content"><p><b>收集，再生长</b><br>拾起敌人留下的金色微光。升级后，从三种能力中选择一种，组合出这一局的成长路线。</p><p><b>留一点风给自己</b><br><span class="help-keyboard">WASD / 方向键移动，空格冲刺。</span>触屏拖动左下摇杆移动，点右侧按钮冲刺。冲刺期间短暂免伤，有冷却时间。</p><p><b>守到黎明</b><br>标准守夜 3 分钟，练习 90 秒。虫群会逐渐变密，最后会出现噬光巨蛾；存活到天亮即可获胜，击败巨蛾会掉落大量微光。</p><p class="help-warning">P / Esc 暂停或继续；数字键 1–3 选能力。切换窗口会自动暂停。声音可在右上角开启；记录仅保存在本机，练习局不计入正式记录。</p></div><button class="start-button" data-action="close-help">我知道了</button>`,
  );
}
function closeHelp() {
  if (helpFrom === "playing") {
    game.resume();
    screen = "playing";
    hideDialog();
    canvas.focus({ preventScroll: true });
  } else if (helpFrom === "paused") {
    screen = "paused";
    showPause();
  } else if (helpFrom === "choosing") {
    showUpgrade();
  } else if (helpFrom === "result") {
    showResult();
  } else {
    screen = "menu";
    hideDialog();
  }
}
function updateHUD() {
  if (!game) return;
  const p = game.player,
    s = game.stats;
  $("hp-fill").style.width = `${clamp((p.hp / s.maxHp) * 100, 0, 100)}%`;
  $("hp-text").textContent = Math.ceil(p.hp);
  $("level-text").textContent = `Lv. ${game.level}`;
  $("xp-fill").style.width =
    `${clamp((game.xp / xpFor(game.level)) * 100, 0, 100)}%`;
  $("timer").textContent = timeText(
    Math.ceil(game.rules.duration - game.elapsed),
  );
  $("phase-text").textContent =
    phases[Math.min(5, Math.floor((game.elapsed / game.rules.duration) * 6))];
  $("kill-text").textContent = game.kills;
  $("dash-fill").style.width =
    `${(1 - p.dashRemaining / s.dashCooldown) * 100}%`;
  $("dash-text").textContent =
    p.dashRemaining > 0
      ? `冲刺 ${p.dashRemaining.toFixed(1)}s`
      : "空格 · 冲刺就绪";
  $("dash-button").disabled = p.dashRemaining > 0;
  const boss = game.enemies.find((e) => e.type === "boss");
  $("boss-hud").hidden = !boss;
  if (boss)
    $("boss-fill").style.width =
      `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  $("hud").setAttribute(
    "aria-label",
    `剩余 ${timeText(game.rules.duration - game.elapsed)}，生命 ${Math.ceil(p.hp)}，等级 ${game.level}`,
  );
}

$("start-button").addEventListener("click", start);
$("help-button").addEventListener("click", help);
$("pause-button").addEventListener("click", pause);
$("sound-button").addEventListener("click", () => {
  audio.enabled = !audio.enabled;
  audio.unlock();
  record.sound = audio.enabled;
  save();
  soundUI();
  if (audio.enabled) audio.play("collect");
});
$("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("garden").requestFullscreen();
  } catch {
    toast("浏览器未允许全屏，可使用 F11");
  }
});
$("dialog").addEventListener("click", (e) => {
  const upgrade = e.target.closest("[data-upgrade]");
  if (upgrade) {
    choose(upgrade.dataset.upgrade);
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  const actions = {
    resume,
    abandon: showAbandon,
    finish: () => {
      game.status = "lost";
      showResult();
    },
    restart: start,
    menu,
    "close-help": closeHelp,
  };
  if (actions[action]) actions[action]();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !$("overlay").hidden) {
    const focusable = [
      ...$("dialog").querySelectorAll("button:not(:disabled),a[href]"),
    ];
    if (focusable.length) {
      const first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (
    screen === "playing" &&
    ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (key === "escape" || key === "p") {
    if (screen === "playing") pause();
    else if (screen === "paused") resume();
    else if (screen === "help") closeHelp();
    return;
  }
  if (screen === "choosing" && ["1", "2", "3"].includes(key)) {
    choose(game.choices[Number(key) - 1]);
    return;
  }
  if (screen === "playing") {
    keys.add(key);
    if (key === " ") {
      game.dash();
    }
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  resetInput();
  if (screen === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "playing") pause();
});
$("dash-button").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (screen === "playing") game.dash();
});
const joystick = $("joystick");
function joystickMove(e) {
  if (e.pointerId !== pointerId) return;
  const r = joystick.getBoundingClientRect(),
    max = 32,
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2,
    len = Math.hypot(dx, dy),
    scale = len > max ? max / len : 1;
  gamepad = { x: (dx * scale) / max, y: (dy * scale) / max };
  $("joystick-knob").style.transform =
    `translate(${dx * scale}px,${dy * scale}px)`;
}
joystick.addEventListener("pointerdown", (e) => {
  if (screen !== "playing" || pointerId !== null) return;
  e.preventDefault();
  pointerId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  joystickMove(e);
});
joystick.addEventListener("pointermove", joystickMove);
for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
  joystick.addEventListener(name, (e) => {
    if (e.pointerId === pointerId) {
      pointerId = null;
      gamepad = { x: 0, y: 0 };
      $("joystick-knob").style.transform = "translate(0px,0px)";
    }
  });
new ResizeObserver(() => renderer.resize()).observe($("garden"));
records();
soundUI();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (game) {
    if (screen === "playing") {
      let x =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
        gamepad.x;
      let y =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
        gamepad.y;
      game.update(dt, { x, y });
      if (game.status === "choosing") showUpgrade();
      else if (["won", "lost"].includes(game.status)) showResult();
    }
    for (const e of game.events.splice(0)) {
      renderer.event(e);
      audio.play(e.type);
      if (e.type === "boss") toast("噬光巨蛾出现了，保持移动");
      if (e.type === "bossDown") toast("巨蛾散去，微光正在回到花园");
      if (e.type === "wave")
        toast(
          [
            "",
            "风穿过草叶，虫影渐近",
            "新的虫影出现了",
            "夜已过半，别停下脚步",
            "黎明在前方",
            "再坚持一小会儿",
          ][e.wave] || "黎明快到了",
        );
    }
    updateHUD();
  }
  renderer.draw(game || preview, dt, now / 1000, !game);
  if (now > toastUntil) $("toast").classList.remove("visible");
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
