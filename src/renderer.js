import { WORLD, clamp, rng } from "./core.js";
import { cameraTarget, edgeIndicator } from "./view.js";
const TAU = Math.PI * 2;
const glowSprites = new Map();
const ellipse = (c, x, y, rx, ry, color, rotation = 0) => {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rotation, 0, TAU);
  c.fill();
};
const line = (c, points, color, width = 1) => {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
};
function leaf(c, x, y, size, angle, color) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(
    -size * 0.7,
    -size * 0.45,
    -size * 0.45,
    -size * 1.4,
    0,
    -size * 1.8,
  );
  c.bezierCurveTo(size * 0.7, -size * 1.2, size * 0.55, -size * 0.4, 0, 0);
  c.fill();
  line(
    c,
    [
      [0, -2],
      [0, -size * 1.4],
    ],
    "#c3d4a52b",
    0.8,
  );
  c.restore();
}
function glow(c, x, y, r, color) {
  const key = `${r}:${color}`;
  if (!glowSprites.has(key)) {
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = r * 2;
    const ctx = sprite.getContext("2d"),
      g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r * 2, r * 2);
    glowSprites.set(key, sprite);
  }
  c.drawImage(glowSprites.get(key), x - r, y - r);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.camera = { x: 450, y: 430 };
    this.effects = [];
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.width = 0;
    this.height = 0;
    this.hurtTime = 0;
    this.makeGround();
    this.makeOuterGarden();
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const mobile =
      matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    this.dpr = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 2);
    const width = Math.round(rect.width * this.dpr),
      height = Math.round(rect.height * this.dpr);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.scale = this.width < 700 ? 0.82 : 1;
    this.shade = this.ctx.createRadialGradient(
      this.width * 0.52,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.3,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.65,
    );
    this.shade.addColorStop(0, "transparent");
    this.shade.addColorStop(1, "#061f2b6b");
  }
  makeOuterGarden() {
    const tile = document.createElement("canvas");
    tile.width = tile.height = 192;
    const c = tile.getContext("2d"),
      random = rng(8976);
    c.fillStyle = "#18392e";
    c.fillRect(0, 0, 192, 192);
    for (let i = 0; i < 65; i++) {
      const x = random() * 192,
        y = random() * 192,
        size = 6 + random() * 13;
      for (let j = 0; j < 3; j++)
        leaf(
          c,
          x,
          y,
          size,
          random() * TAU,
          ["#234d36", "#2c563a", "#365d3e"][j],
        );
    }
    this.outerGarden = this.ctx.createPattern(tile, "repeat");
  }
  getView() {
    return {
      camera: { ...this.camera },
      width: this.width,
      height: this.height,
      scale: this.scale,
    };
  }
  makeGround() {
    this.ground = document.createElement("canvas");
    this.ground.width = WORLD.width;
    this.ground.height = WORLD.height;
    const c = this.ground.getContext("2d"),
      r = rng(21473);
    c.fillStyle = "#214637";
    c.fillRect(0, 0, WORLD.width, WORLD.height);
    // Fixed, original procedural terrain. Rendered once, never fetched.
    for (let i = 0; i < 350; i++) {
      const x = r() * 2000,
        y = r() * 1500;
      ellipse(
        c,
        x,
        y,
        20 + r() * 100,
        15 + r() * 70,
        ["#244a38", "#254c3a", "#294f3b", "#1e4235", "#2b503b"][i % 5],
      );
    }
    // A quiet watering path, with irregular soil edges and individual stepping stones.
    for (let y = 0; y < 1600; y += 15) {
      const x = 825 + Math.sin(y / 225) * 130;
      ellipse(c, x, y, 64 + Math.sin(y / 53) * 7, 35, "#344c38");
    }
    for (let i = 0; i < 15; i++) {
      const y = i * 118 + 20,
        x = 825 + Math.sin(y / 225) * 130;
      this.stone(c, x + (r() - 0.5) * 20, y, 19 + r() * 11, 12 + r() * 6, r());
    }
    // The small pond is an actual landmark in the scrolling arena.
    ellipse(c, 1450, 430, 205, 130, "#315c45", -0.28);
    ellipse(c, 1450, 430, 181, 111, "#1c4e49", -0.28);
    ellipse(c, 1457, 420, 153, 84, "#245951", -0.28);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      this.stone(
        c,
        1450 + Math.cos(a) * 195,
        430 + Math.sin(a) * 120,
        14 + r() * 14,
        10 + r() * 6,
        r(),
      );
    }
    for (let i = 0; i < 9; i++) {
      const x = 1350 + r() * 190,
        y = 365 + r() * 110;
      ellipse(c, x, y, 12 + r() * 6, 7, "#527a50", r());
      line(
        c,
        [
          [x, y],
          [x + 8, y - 2],
        ],
        "#97ac6e",
        0.7,
      );
    }
    for (let i = 0; i < 5500; i++) {
      const x = r() * 2000,
        y = r() * 1500;
      const pond = ((x - 1450) / 200) ** 2 + ((y - 430) / 120) ** 2 < 1;
      if (pond) continue;
      c.fillStyle = ["#64805a38", "#a8b77d25", "#162f2d35"][i % 3];
      c.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 420; i++) {
      const x = r() * 2000,
        y = r() * 1500;
      if (((x - 1450) / 215) ** 2 + ((y - 430) / 140) ** 2 < 1) continue;
      const size = 5 + r() * 11,
        n = 3 + Math.floor(r() * 4);
      for (let j = 0; j < n; j++)
        leaf(
          c,
          x + (r() - 0.5) * 8,
          y + (r() - 0.5) * 8,
          size,
          (j / n) * TAU,
          ["#3e6745", "#527b4b", "#648650", "#375f44", "#78925b"][i % 5],
        );
    }
    const gardens = [
      [1140, 800, 1],
      [1280, 690, 0.8],
      [1070, 620, 0.65],
      [1520, 990, 1.2],
      [500, 1100, 1.25],
      [410, 460, 0.9],
      [1750, 610, 1.25],
      [920, 1240, 0.8],
      [1300, 1150, 0.8],
      [650, 320, 0.9],
    ];
    for (const [x, y, s] of gardens) this.flowerBed(c, x, y, s, r);
    for (let i = 0; i < 48; i++) {
      let x = r() * 2000,
        y = r() * 1500;
      if (((x - 1450) / 230) ** 2 + ((y - 430) / 150) ** 2 < 1) continue;
      this.stone(c, x, y, 6 + r() * 10, 4 + r() * 7, r());
    }
    // The garden perimeter reads as thick vegetation; collision stays predictable.
    for (let i = 0; i < 140; i++) {
      const x = i % 2 ? r() * 2000 : i % 4 ? 1980 : 20,
        y = i % 2 ? (i % 4 < 2 ? 15 : 1485) : r() * 1500;
      for (let j = 0; j < 6; j++)
        leaf(
          c,
          x + (r() - 0.5) * 50,
          y + (r() - 0.5) * 50,
          13 + r() * 12,
          r() * TAU,
          "#355d40",
        );
    }
  }
  stone(c, x, y, rx, ry, v) {
    ellipse(c, x, y + 3, rx + 2, ry + 1, "#142f2a55", v * 0.6);
    ellipse(c, x, y, rx, ry, v > 0.5 ? "#5c7360" : "#526a59", v * 0.6);
    ellipse(c, x - 2, y - 3, rx * 0.6, ry * 0.5, "#81917a55", v * 0.6);
  }
  flowerBed(c, x, y, s, r) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    ellipse(c, 0, 7, 76, 31, "#183c3073");
    for (let i = 0; i < 23; i++) {
      const a = r() * TAU,
        rad = r() * 67,
        px = Math.cos(a) * rad,
        py = Math.sin(a) * rad * 0.4;
      leaf(c, px, py, 10 + r() * 13, (r() - 0.5) * 2, "#6c8b4e");
      leaf(c, px, py, 8 + r() * 12, 1 + r() * 2, "#416f48");
    }
    for (let i = 0; i < 9; i++) {
      const px = (r() - 0.5) * 110,
        py = (r() - 0.5) * 36 - 9,
        h = 12 + r() * 21;
      line(
        c,
        [
          [px, py + 7],
          [px - 2, py - h],
        ],
        "#83a065",
        1.4,
      );
      if (i % 3 === 0) {
        ellipse(c, px - 2, py - h, 8, 4, "#e6bf9d");
        ellipse(c, px - 3, py - h - 1, 8, 4, "#dfaa8d");
        line(
          c,
          [
            [px - 7, py - h],
            [px + 3, py - h],
          ],
          "#f8d4a8",
          1,
        );
      } else {
        const color = i % 2 ? "#c4b6d5" : "#d7d6a2";
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * TAU;
          ellipse(
            c,
            px - 2 + Math.cos(a) * 4,
            py - h + Math.sin(a) * 4,
            3.5,
            2.5,
            color,
            a,
          );
        }
        ellipse(c, px - 2, py - h, 2, 2, "#f0d48a");
      }
    }
    c.restore();
  }
  event(e) {
    if (e.type === "hurt") this.hurtTime = 0.25;
    if (!["hit", "kill", "collect", "dash", "hurt"].includes(e.type)) return;
    if (this.effects.length > 180) this.effects.splice(0, 25);
    if (e.type === "hit") {
      this.effects.push({
        type: "number",
        x: e.x,
        y: e.y - 16,
        text: e.amount,
        life: 0.6,
        max: 0.6,
      });
      return;
    }
    const count = this.reduced ? 2 : e.type === "kill" ? 8 : 4;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      this.effects.push({
        type: e.type,
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * (20 + i * 5),
        vy: Math.sin(a) * (20 + i * 5),
        life: 0.3 + i * 0.04,
        max: 0.3 + i * 0.04,
      });
    }
  }
  draw(g, dt, time, menu = false) {
    const c = this.ctx,
      w = this.width,
      h = this.height,
      s = this.scale,
      t = this.reduced ? 0 : time;
    if (!w || !h) return;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    const vw = w / s,
      vh = h / s,
      p = g.player;
    const target = cameraTarget(p, w, h, s, menu),
      targetX = target.x,
      targetY = target.y;
    const f = 1 - Math.exp(-Math.min(dt, 0.05) * 5);
    this.camera.x += (targetX - this.camera.x) * f;
    this.camera.y += (targetY - this.camera.y) * f;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#214637";
    c.fillRect(0, 0, w, h);
    c.save();
    c.scale(s, s);
    c.translate(-this.camera.x, -this.camera.y);
    if (
      this.camera.x < 0 ||
      this.camera.y < 0 ||
      this.camera.x + vw > WORLD.width ||
      this.camera.y + vh > WORLD.height
    ) {
      c.fillStyle = this.outerGarden;
      c.fillRect(this.camera.x, this.camera.y, vw, vh);
    }
    c.drawImage(this.ground, 0, 0);
    const moon = c.createLinearGradient(
      this.camera.x,
      this.camera.y,
      this.camera.x + vw,
      this.camera.y + vh,
    );
    moon.addColorStop(0, "#9cc8b105");
    moon.addColorStop(0.6, "#a7d7ab08");
    moon.addColorStop(1, "#071e2a28");
    c.fillStyle = moon;
    c.fillRect(this.camera.x, this.camera.y, vw, vh);
    for (let i = 0; i < 26; i++) {
      const x =
          this.camera.x + ((i * 173.27 + Math.sin(t * 0.4 + i) * 18) % vw),
        y = this.camera.y + ((i * 97.29 + Math.cos(t * 0.3 + i) * 20) % vh);
      const a = 0.25 + Math.sin(t * 1.7 + i * 2) * 0.16;
      ellipse(c, x, y, i % 3 ? 1.3 : 2, 1.3, `rgba(222,231,155,${a})`);
    }
    for (const m of g.motes) {
      if (
        m.x < this.camera.x - 20 ||
        m.x > this.camera.x + vw + 20 ||
        m.y < this.camera.y - 20 ||
        m.y > this.camera.y + vh + 20
      )
        continue;
      glow(c, m.x, m.y, 13, "#e7de8a35");
      c.save();
      c.translate(m.x, m.y + Math.sin(t * 3 + m.x) * 2);
      c.rotate(Math.PI / 4);
      c.fillStyle = "#e9d98c";
      c.fillRect(
        -m.radius / 1.4,
        -m.radius / 1.4,
        m.radius * 1.4,
        m.radius * 1.4,
      );
      c.strokeStyle = "#fff0bd";
      c.lineWidth = 1;
      c.strokeRect(
        -m.radius / 1.4,
        -m.radius / 1.4,
        m.radius * 1.4,
        m.radius * 1.4,
      );
      c.restore();
    }
    if (g.stats.orbit > 0) {
      c.strokeStyle = "#cbdda345";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x, p.y, 74, 53, 0, 0, TAU);
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 2.5 + (i / 3) * TAU;
        leaf(
          c,
          p.x + Math.cos(a) * 74,
          p.y + Math.sin(a) * 53,
          9,
          a,
          "#c1d88c",
        );
      }
    }
    const entities = [
      ...g.enemies
        .filter(
          (e) =>
            Math.abs(e.x - (this.camera.x + vw / 2)) < vw / 2 + 75 &&
            Math.abs(e.y - (this.camera.y + vh / 2)) < vh / 2 + 75,
        )
        .map((e) => ({ y: e.y, type: "enemy", e })),
      { y: p.y, type: "player" },
    ].sort((a, b) => a.y - b.y);
    for (const item of entities) {
      if (item.type === "player") this.player(c, p, t, menu);
      else if (
        Math.abs(item.e.x - (this.camera.x + vw / 2)) < vw / 2 + 70 &&
        Math.abs(item.e.y - (this.camera.y + vh / 2)) < vh / 2 + 70
      )
        this.enemy(c, item.e, t);
    }
    for (const b of g.bullets) {
      if (
        b.x < this.camera.x - 25 ||
        b.x > this.camera.x + vw + 25 ||
        b.y < this.camera.y - 25 ||
        b.y > this.camera.y + vh + 25
      )
        continue;
      glow(c, b.x, b.y, 19, "#f5dc8c36");
      line(
        c,
        [
          [b.x - b.vx * 0.025, b.y - b.vy * 0.025],
          [b.x, b.y],
        ],
        "#e3d58883",
        3,
      );
      ellipse(c, b.x, b.y, 4, 4, "#fff2b6");
    }
    if (menu)
      for (let i = 0; i < 4; i++) {
        const a = t * 0.7 + i * 1.5;
        const x = p.x + Math.cos(a) * 60,
          y = p.y - 20 + Math.sin(a) * 32;
        glow(c, x, y, 24, "#e8e59a29");
        ellipse(c, x, y, 2.5, 2.5, "#f5e7a0");
        line(
          c,
          [
            [x - 5, y - 1],
            [x + 5, y + 1],
          ],
          "#dbddad73",
          1,
        );
      }
    for (const e of this.effects) {
      e.life -= dt;
      if (e.life <= 0) continue;
      c.globalAlpha = clamp(e.life / e.max, 0, 1);
      if (e.type === "number") {
        e.y -= 25 * dt;
        c.fillStyle = "#f1ead0";
        c.font = "600 12px sans-serif";
        c.textAlign = "center";
        c.fillText(e.text, e.x, e.y);
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        ellipse(
          c,
          e.x,
          e.y,
          e.type === "dash" ? 4 : 2,
          2,
          e.type === "hurt"
            ? "#f1a796"
            : e.type === "kill"
              ? "#b8bdcb"
              : "#f3e7a3",
        );
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    c.globalAlpha = 1;
    // A soft edge keeps interactive objects distinct without dimming the HUD.
    c.restore();
    c.fillStyle = this.shade;
    c.fillRect(0, 0, w, h);
    if (this.hurtTime > 0) {
      c.strokeStyle = `rgba(237,167,145,${this.hurtTime * 1.4})`;
      c.lineWidth = 10;
      c.strokeRect(4, 4, w - 8, h - 8);
    }
    const dawn = menu
      ? 0
      : clamp((g.elapsed / g.rules.duration - 0.82) / 0.18, 0, 1);
    if (dawn > 0) {
      c.fillStyle = `rgba(244,220,154,${dawn * 0.11})`;
      c.fillRect(0, 0, w, h);
    }
    if (g.status === "lost") {
      c.fillStyle = "#142a3744";
      c.fillRect(0, 0, w, h);
    }
    if (!menu) this.drawBossIndicator(g);
  }
  drawBossIndicator(g) {
    const boss = g.enemies.find((e) => e.type === "boss");
    const point = boss
      ? edgeIndicator(boss, this.camera, this.width, this.height, this.scale)
      : null;
    if (!point) return;
    const c = this.ctx;
    c.save();
    c.translate(point.x, point.y);
    c.fillStyle = "#213e35";
    c.strokeStyle = boss.windup > 0 ? "#f0bdc8" : "#f0cc88";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, 16, 0, TAU);
    c.fill();
    c.stroke();
    c.save();
    c.rotate(point.angle);
    c.beginPath();
    c.moveTo(-5, -6);
    c.lineTo(4, 0);
    c.lineTo(-5, 6);
    c.stroke();
    c.restore();
    c.fillStyle = "#f0f0d9";
    c.font = "11px sans-serif";
    c.textAlign = "center";
    c.fillText("巨蛾", 0, 32);
    c.restore();
  }
  player(c, p, t, menu) {
    c.save();
    c.translate(p.x, p.y);
    if (p.invincible > 0 && !this.reduced)
      c.globalAlpha = 0.55 + Math.cos(t * 22) * 0.22;
    const bob = Math.sin(t * 3) * 1.4;
    glow(c, 0, -4, 75, "#d1dd8e16");
    ellipse(c, 0, 10, 17, 7, "#102f2ba0");
    c.strokeStyle = p.dashTime > 0 ? "#fff0bd" : "#e4e7b5b3";
    c.lineWidth = p.dashTime > 0 ? 2.5 : 1.2;
    c.beginPath();
    c.ellipse(0, 10, 21, 9, 0, 0, TAU);
    c.stroke();
    if (p.dashTime > 0)
      for (let i = 1; i < 5; i++)
        ellipse(
          c,
          -p.dashX * i * 12,
          -p.dashY * i * 12 + 2,
          10 - i,
          8 - i,
          `rgba(197,220,155,${0.2 - i * 0.035})`,
        );
    c.translate(0, bob);
    ellipse(c, -5, 9, 4, 5, "#c6be91");
    ellipse(c, 5, 9, 4, 5, "#c6be91");
    c.fillStyle = "#b9cc8d";
    c.beginPath();
    c.moveTo(0, -20);
    c.bezierCurveTo(-19, -8, -16, 1, -20, 8);
    c.quadraticCurveTo(0, 20, 19, 8);
    c.bezierCurveTo(15, -2, 14, -12, 0, -20);
    c.fill();
    c.fillStyle = "#759c67";
    c.beginPath();
    c.moveTo(-2, -18);
    c.quadraticCurveTo(-16, 0, -13, 11);
    c.lineTo(-20, 8);
    c.bezierCurveTo(-17, -6, -12, -14, -2, -18);
    c.fill();
    ellipse(c, 1, -7, 10, 10, "#e0d8b2");
    ellipse(c, -1, -7, 1.4, 2, "#294237");
    ellipse(c, 6, -7, 1.4, 2, "#294237");
    c.fillStyle = "#8caf73";
    c.beginPath();
    c.moveTo(-13, -10);
    c.bezierCurveTo(-15, -25, 0, -32, 12, -24);
    c.quadraticCurveTo(14, -16, 15, -9);
    c.quadraticCurveTo(-1, -18, -13, -10);
    c.fill();
    leaf(c, 0, -24, 9, 0.7, "#b6ce86");
    line(
      c,
      [
        [-10, -15],
        [7, -18],
      ],
      "#cbdc9e66",
      1,
    );
    line(
      c,
      [
        [15, 12],
        [19, -12],
      ],
      "#a58d62",
      3,
    );
    ellipse(c, 19, -14, 6, 7, "#eedc8e");
    glow(c, 19, -14, 30, "#f4e5a136");
    ellipse(c, 18, -16, 2, 2, "#fff2bc");
    line(
      c,
      [
        [-8, -1],
        [10, 7],
      ],
      "#7b7651",
      3,
    );
    ellipse(c, -9, 5, 5, 6, "#c5a778");
    c.restore();
  }
  enemy(c, e, t) {
    c.save();
    c.translate(e.x, e.y);
    if (e.type === "boss" && e.windup > 0) {
      c.strokeStyle = "#f0bdc8";
      c.lineWidth = 2;
      c.setLineDash([7, 7]);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(e.chargeX * 220, e.chargeY * 220);
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.ellipse(0, 0, 50, 43, 0, 0, TAU);
      c.stroke();
    }
    const a = Math.atan2(Math.sin(e.phase + t), 1),
      bob = this.reduced ? 0 : Math.sin(t * 6 + e.phase) * 1.7;
    ellipse(
      c,
      0,
      e.radius * 0.45,
      e.radius * 0.95,
      e.radius * 0.37,
      "#102b2c7a",
    );
    c.translate(0, bob);
    if (e.type === "boss") {
      const flap = this.reduced ? 0.9 : 0.75 + Math.sin(t * 5) * 0.15;
      c.save();
      c.scale(1, flap);
      ellipse(c, -30, -5, 30, 39, "#6e687d", -0.6);
      ellipse(c, 30, -5, 30, 39, "#6e687d", 0.6);
      ellipse(c, -28, -11, 17, 22, "#a08c9d", -0.6);
      ellipse(c, 28, -11, 17, 22, "#a08c9d", 0.6);
      ellipse(c, -31, -7, 8, 11, "#d1aba5", -0.5);
      ellipse(c, 31, -7, 8, 11, "#d1aba5", 0.5);
      ellipse(c, -31, -7, 3, 5, "#3f4654");
      ellipse(c, 31, -7, 3, 5, "#3f4654");
      c.restore();
      ellipse(c, 0, 0, 11, 27, "#454a60");
      ellipse(c, 0, -17, 12, 12, "#a29eac");
      line(
        c,
        [
          [-5, -23],
          [-13, -37],
        ],
        "#c3b9bd",
        2,
      );
      line(
        c,
        [
          [5, -23],
          [13, -37],
        ],
        "#c3b9bd",
        2,
      );
      ellipse(c, -5, -20, 3, 3, "#f1c59f");
      ellipse(c, 5, -20, 3, 3, "#f1c59f");
    } else if (e.type === "beetle") {
      for (let i = 0; i < 3; i++) {
        line(
          c,
          [
            [-12, -7 + i * 7],
            [-24, -10 + i * 8],
          ],
          "#949c93",
          2,
        );
        line(
          c,
          [
            [12, -7 + i * 7],
            [24, -10 + i * 8],
          ],
          "#949c93",
          2,
        );
      }
      ellipse(c, 0, 0, 17, 20, e.hit > 0 ? "#d5d7c1" : "#768b88", a * 0.2);
      ellipse(c, -4, -4, 8, 12, "#98aaa0", -0.2);
      line(
        c,
        [
          [0, -17],
          [1, 19],
        ],
        "#3f6360",
        1.5,
      );
      ellipse(c, 0, -16, 11, 8, "#4c6f6b");
      ellipse(c, -5, -19, 2, 2, "#f1c2a3");
      ellipse(c, 5, -19, 2, 2, "#f1c2a3");
    } else if (e.type === "wisp") {
      glow(c, 0, 0, 21, "#bbaddb1f");
      ellipse(c, -8, -3, 10, 4, "#b6acd59c", Math.sin(t * 12) * 0.4);
      ellipse(c, 8, -3, 10, 4, "#b6acd59c", -Math.sin(t * 12) * 0.4);
      ellipse(c, 0, 0, 6, 10, e.hit > 0 ? "#ede8d1" : "#a5a1d2");
      ellipse(c, -2, -4, 1.5, 1.5, "#f0d1bf");
      ellipse(c, 2, -4, 1.5, 1.5, "#f0d1bf");
    } else {
      for (let i = 0; i < 3; i++) {
        const dy = Math.sin(t * 9 + i) * 2;
        line(
          c,
          [
            [-6, i * 5 - 6],
            [-15, i * 6 - 8 + dy],
          ],
          "#8b8e9f",
          1.7,
        );
        line(
          c,
          [
            [6, i * 5 - 6],
            [15, i * 6 - 8 - dy],
          ],
          "#8b8e9f",
          1.7,
        );
      }
      ellipse(c, 0, 0, 10, 12, e.hit > 0 ? "#e8d8cc" : "#73738b");
      ellipse(c, -2, -3, 6, 6, "#9890a3");
      ellipse(c, -4, -6, 2, 2, "#edb1a6");
      ellipse(c, 4, -6, 2, 2, "#edb1a6");
    }
    if (e.hit > 0 && e.type !== "boss") {
      c.fillStyle = "#142d2b";
      c.fillRect(-e.radius, -e.radius - 10, e.radius * 2, 3);
      c.fillStyle = "#e7c99f";
      c.fillRect(
        -e.radius,
        -e.radius - 10,
        e.radius * 2 * Math.max(0, e.hp / e.maxHp),
        3,
      );
    }
    c.restore();
  }
}
