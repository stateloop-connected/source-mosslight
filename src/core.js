export const WORLD = { width: 2000, height: 1500 };
export const MODES = {
  night: {
    label: "守夜",
    duration: 180,
    spawnScale: 1,
    damageScale: 1,
    bossAt: 140,
  },
  practice: {
    label: "练习",
    duration: 90,
    spawnScale: 0.65,
    damageScale: 0.55,
    bossAt: 65,
  },
};
export const UPGRADES = [
  {
    id: "power",
    name: "炽热萤火",
    desc: "萤火伤害增加 30%。",
    max: 5,
    icon: "spark",
    apply: (s) => {
      s.damage *= 1.3;
    },
  },
  {
    id: "haste",
    name: "风铃草",
    desc: "萤火发射速度增加 22%。",
    max: 5,
    icon: "bolt",
    apply: (s) => {
      s.interval *= 0.82;
    },
  },
  {
    id: "multi",
    name: "双生花",
    desc: "每次多发射一枚萤火。",
    max: 3,
    icon: "leaf",
    apply: (s) => {
      s.bolts++;
    },
  },
  {
    id: "speed",
    name: "轻叶步",
    desc: "移动速度增加 16%。",
    max: 3,
    icon: "leaf",
    apply: (s) => {
      s.speed *= 1.16;
    },
  },
  {
    id: "magnet",
    name: "引光苔",
    desc: "微光吸引范围增加 50%。",
    max: 3,
    icon: "spark",
    apply: (s) => {
      s.magnet *= 1.5;
    },
  },
  {
    id: "vitality",
    name: "晨露",
    desc: "生命上限 +20，并恢复 40 生命。",
    max: 4,
    icon: "heart",
    apply: (s, g) => {
      s.maxHp += 20;
      g.player.hp = Math.min(s.maxHp, g.player.hp + 40);
    },
  },
  {
    id: "orbit",
    name: "护身叶",
    desc: "身旁长出叶环，持续伤害靠近的敌人。",
    max: 4,
    icon: "leaf",
    apply: (s) => {
      s.orbit += 10;
    },
  },
  {
    id: "dash",
    name: "夜行风",
    desc: "冲刺冷却缩短 20%，并恢复 15 生命。",
    max: 3,
    icon: "bolt",
    apply: (s, g) => {
      s.dashCooldown *= 0.8;
      g.player.hp = Math.min(s.maxHp, g.player.hp + 15);
    },
  },
];
export function rng(seed = Date.now()) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const timeText = (n) =>
  `${Math.floor(Math.max(0, n) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, n) % 60)
    .toString()
    .padStart(2, "0")}`;
export const scoreFor = (g) =>
  Math.round(
    g.kills * 12 +
      g.collected * 5 +
      g.elapsed * 2 +
      (g.status === "won" ? 1200 : 0),
  );
export const xpFor = (level) => 8 + level * 5;

export class Game {
  constructor({ mode = "night", seed = Date.now() } = {}) {
    this.mode = MODES[mode] ? mode : "night";
    this.rules = MODES[this.mode];
    this.seed = seed;
    this.random = rng(seed);
    this.status = "playing";
    this.elapsed = 0;
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.collected = 0;
    this.nextId = 1;
    this.player = {
      x: 1000,
      y: 750,
      hp: 100,
      radius: 13,
      invincible: 0,
      dashTime: 0,
      dashRemaining: 0,
      lastX: 1,
      lastY: 0,
    };
    this.stats = {
      maxHp: 100,
      speed: 175,
      damage: 16,
      interval: 0.66,
      bolts: 1,
      magnet: 78,
      orbit: 0,
      dashCooldown: 3.8,
    };
    this.enemies = [];
    this.bullets = [];
    this.motes = [];
    this.events = [];
    this.build = {};
    this.choices = [];
    this.shotTimer = 0.1;
    this.spawnTimer = 0.7;
    this.orbitTimer = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.wave = 0;
    this.contactTimer = 0;
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (this.events.length > 200) this.events.shift();
  }
  pause() {
    if (this.status === "playing") this.status = "paused";
  }
  resume() {
    if (this.status === "paused") this.status = "playing";
  }
  dash() {
    const p = this.player;
    if (this.status !== "playing" || p.dashRemaining > 0) return false;
    p.dashTime = 0.19;
    p.dashRemaining = this.stats.dashCooldown;
    p.invincible = Math.max(p.invincible, 0.42);
    this.emit("dash", { x: p.x, y: p.y });
    return true;
  }
  spawn(type) {
    const p = this.player,
      angle = this.random() * Math.PI * 2;
    // Spawn in a ring beyond the largest normal viewport, never on the player.
    let x = clamp(p.x + Math.cos(angle) * 650, 30, WORLD.width - 30),
      y = clamp(p.y + Math.sin(angle) * 650, 30, WORLD.height - 30);
    if (Math.hypot(x - p.x, y - p.y) < 280) {
      x = p.x < WORLD.width / 2 ? WORLD.width - 40 : 40;
      y = clamp(p.y + (this.random() - 0.5) * 700, 40, WORLD.height - 40);
    }
    const phase = this.elapsed / this.rules.duration;
    const config = {
      mite: {
        hp: 20 + phase * 14,
        speed: 42 + phase * 17,
        radius: 12,
        damage: 10,
        xp: 2,
      },
      beetle: {
        hp: 57 + phase * 30,
        speed: 30 + phase * 13,
        radius: 19,
        damage: 16,
        xp: 4,
      },
      wisp: {
        hp: 15 + phase * 13,
        speed: 83 + phase * 16,
        radius: 9,
        damage: 9,
        xp: 3,
      },
      boss: {
        hp: this.mode === "practice" ? 420 : 750,
        speed: 39,
        radius: 43,
        damage: 25,
        xp: 40,
      },
    };
    const c = config[type] || config.mite;
    const e = {
      id: this.nextId++,
      type,
      x,
      y,
      ...c,
      maxHp: c.hp,
      hit: 0,
      phase: this.random() * 6.28,
    };
    this.enemies.push(e);
    return e;
  }
  shoot() {
    const p = this.player;
    const targets = this.enemies
      .filter((e) => e.hp > 0 && distance(e, p) < 520)
      .sort((a, b) => distance(a, p) - distance(b, p));
    if (!targets.length) return;
    for (let i = 0; i < this.stats.bolts; i++) {
      const target = targets[i % targets.length];
      let a = Math.atan2(target.y - p.y, target.x - p.x);
      if (i >= targets.length) a += (i % 2 ? 1 : -1) * 0.12;
      this.bullets.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 460,
        vy: Math.sin(a) * 460,
        life: 1.5,
        damage: this.stats.damage,
        radius: 5,
      });
    }
    this.emit("shoot");
  }
  damageEnemy(e, amount) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.hit = 0.12;
    this.emit("hit", { x: e.x, y: e.y, amount: Math.round(amount) });
    if (e.hp <= 0) {
      this.kills++;
      this.emit("kill", { x: e.x, y: e.y, boss: e.type === "boss" });
      if (e.type === "boss") {
        this.bossDefeated = true;
        this.emit("bossDown");
      }
      this.motes.push({
        x: e.x,
        y: e.y,
        value: e.xp,
        radius: e.type === "boss" ? 10 : 4,
        life: 35,
      });
    }
  }
  addXp(value) {
    this.xp += value;
    this.collected += value;
    this.checkLevel();
  }
  checkLevel() {
    if (this.status !== "playing") return;
    if (this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      this.status = "choosing";
      const pool = UPGRADES.filter((u) => (this.build[u.id] || 0) < u.max);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.choices = pool.slice(0, 3).map((u) => u.id);
      if (!this.choices.length) {
        this.player.hp = Math.min(this.stats.maxHp, this.player.hp + 25);
        this.status = "playing";
        this.emit("heal");
      } else this.emit("level", { level: this.level });
    }
  }
  choose(id) {
    if (this.status !== "choosing" || !this.choices.includes(id)) return false;
    const u = UPGRADES.find((u) => u.id === id);
    u.apply(this.stats, this);
    this.build[id] = (this.build[id] || 0) + 1;
    this.choices = [];
    this.status = "playing";
    this.emit("upgrade", { id });
    this.checkLevel();
    return true;
  }
  update(delta, input = { x: 0, y: 0 }) {
    if (this.status !== "playing") return;
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05);
    if (dt === 0) return;
    this.elapsed = Math.min(this.rules.duration, this.elapsed + dt);
    if (this.elapsed >= this.rules.duration) {
      this.status = "won";
      this.emit("end");
      return;
    }
    const p = this.player;
    p.invincible = Math.max(0, p.invincible - dt);
    p.dashRemaining = Math.max(0, p.dashRemaining - dt);
    let ix = Number.isFinite(input.x) ? input.x : 0,
      iy = Number.isFinite(input.y) ? input.y : 0;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    if (len > 0.08) {
      p.lastX = ix / Math.hypot(ix, iy);
      p.lastY = iy / Math.hypot(ix, iy);
    }
    if (p.dashTime > 0) {
      ix = p.lastX;
      iy = p.lastY;
      p.dashTime = Math.max(0, p.dashTime - dt);
    }
    const speed = this.stats.speed * (p.dashTime > 0 ? 4.5 : 1);
    p.x = clamp(p.x + ix * speed * dt, 25, WORLD.width - 25);
    p.y = clamp(p.y + iy * speed * dt, 25, WORLD.height - 25);
    const wave = Math.floor(this.elapsed / 30);
    if (wave > this.wave) {
      this.wave = wave;
      this.emit("wave", { wave });
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < 145) {
      const progress = this.elapsed / this.rules.duration;
      this.spawnTimer =
        Math.max(0.2, 1.1 - progress * 0.82) / this.rules.spawnScale;
      const roll = this.random();
      this.spawn(
        this.elapsed > 45 && roll < 0.2
          ? "wisp"
          : this.elapsed > 22 && roll < 0.4
            ? "beetle"
            : "mite",
      );
      if (this.elapsed > 85 && this.random() < 0.34) this.spawn("mite");
    }
    if (!this.bossSpawned && this.elapsed >= this.rules.bossAt) {
      this.bossSpawned = true;
      this.spawn("boss");
      this.emit("boss");
    }
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      this.shotTimer = this.stats.interval;
      this.shoot();
    }
    this.orbitTimer -= dt;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.hit = Math.max(0, e.hit - dt);
      const dx = p.x - e.x,
        dy = p.y - e.y,
        d = Math.hypot(dx, dy) || 1;
      const speed =
        e.speed *
        (e.type === "wisp"
          ? 1 + Math.sin(this.elapsed * 3 + e.phase) * 0.25
          : 1);
      e.x += (dx / d) * speed * dt;
      e.y += (dy / d) * speed * dt;
      if (this.stats.orbit > 0 && this.orbitTimer <= 0 && d < 82 + e.radius)
        this.damageEnemy(e, this.stats.orbit);
      if (e.hp > 0 && d < e.radius + p.radius && p.invincible <= 0) {
        p.hp = Math.max(0, p.hp - e.damage * this.rules.damageScale);
        p.invincible = 0.85;
        e.x -= (dx / d) * 25;
        e.y -= (dy / d) * 25;
        this.emit("hurt", { x: p.x, y: p.y });
        if (p.hp <= 0) {
          this.status = "lost";
          this.emit("end");
          break;
        }
      }
    }
    if (this.orbitTimer <= 0) this.orbitTimer = 0.55;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of this.enemies)
        if (e.hp > 0 && b.life > 0 && distance(b, e) < e.radius + b.radius) {
          this.damageEnemy(e, b.damage);
          b.life = 0;
          break;
        }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const m of this.motes) {
      m.life -= dt;
      const dx = p.x - m.x,
        dy = p.y - m.y,
        d = Math.hypot(dx, dy);
      if (d < this.stats.magnet) {
        const step = Math.min(
          d,
          (190 + Math.max(0, this.stats.magnet - d) * 4) * dt,
        );
        m.x += (dx / (d || 1)) * step;
        m.y += (dy / (d || 1)) * step;
      }
      if (d < 19 && m.life > 0 && this.status === "playing") {
        m.life = 0;
        this.addXp(m.value);
        this.emit("collect", { x: m.x, y: m.y });
      }
    }
    this.motes = this.motes.filter((m) => m.life > 0);
    // Deterministic coalescing keeps long sessions bounded without losing XP.
    if (this.motes.length > 240) {
      const a = this.motes.shift(),
        b = this.motes[0];
      b.value += a.value;
    }
  }
}
