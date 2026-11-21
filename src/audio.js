export class Audio {
  constructor() {
    this.enabled = false;
    this.volume = 0.65;
    this.context = null;
    this.lastShot = 0;
    this.lastCollect = 0;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }
  tone(freq, duration = 0.12, volume = 0.04, type = "sine", delay = 0) {
    if (
      !this.enabled ||
      this.volume <= 0 ||
      !this.context ||
      this.context.state !== "running"
    )
      return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.75, t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.001, volume * this.volume),
      t + 0.008,
    );
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  play(type) {
    if (!this.enabled) return;
    switch (type) {
      case "shoot":
        if (performance.now() - this.lastShot > 140) {
          this.tone(740, 0.065, 0.015);
          this.lastShot = performance.now();
        }
        break;
      case "collect":
        if (performance.now() - this.lastCollect > 60) {
          this.tone(1100, 0.08, 0.018);
          this.lastCollect = performance.now();
        }
        break;
      case "hurt":
        this.tone(120, 0.18, 0.045, "triangle");
        break;
      case "dash":
        this.tone(330, 0.15, 0.03, "triangle");
        break;
      case "level":
      case "upgrade":
        for (let i = 0; i < 3; i++)
          this.tone([523, 659, 784][i], 0.22, 0.03, "sine", i * 0.1);
        break;
      case "end":
        for (let i = 0; i < 4; i++)
          this.tone([392, 523, 659, 784][i], 0.35, 0.035, "sine", i * 0.14);
        break;
      case "loss":
        for (let i = 0; i < 3; i++)
          this.tone([392, 330, 262][i], 0.3, 0.025, "sine", i * 0.15);
        break;
    }
  }
}
