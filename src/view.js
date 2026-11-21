import { WORLD, clamp } from "./core.js";

// Geometry is independent from Canvas and DOM, including the HUD safety margins.
export function cameraTarget(player, width, height, scale = 1, menu = false) {
  const vw = width / scale,
    vh = height / scale;
  if (menu)
    return {
      x: clamp(player.x - vw * 0.7, 0, Math.max(0, WORLD.width - vw)),
      y: clamp(
        player.y - vh * (width < 700 ? 0.69 : 0.54),
        0,
        Math.max(0, WORLD.height - vh),
      ),
    };
  const side = Math.max(0, Math.min(vw * 0.5 - 45, 160 / scale));
  const top = Math.max(0, Math.min(vh * 0.5 - 45, 145 / scale));
  const bottom = Math.max(0, Math.min(vh * 0.5 - 45, 220 / scale));
  return {
    x:
      vw >= WORLD.width
        ? (WORLD.width - vw) / 2
        : clamp(player.x - vw * 0.5, -side, WORLD.width - vw + side),
    y:
      vh >= WORLD.height
        ? (WORLD.height - vh) / 2
        : clamp(player.y - vh * 0.52, -top, WORLD.height - vh + bottom),
  };
}

export function edgeIndicator(target, camera, width, height, scale = 1) {
  const x = (target.x - camera.x) * scale,
    y = (target.y - camera.y) * scale;
  if (x >= 18 && x <= width - 18 && y >= 18 && y <= height - 18) return null;
  const cx = width * 0.5,
    cy = height * 0.52,
    dx = x - cx,
    dy = y - cy;
  const landscape = width > height;
  const left = landscape ? Math.min(160, width * 0.25) : 34,
    right = width - (landscape ? Math.min(130, width * 0.22) : 34);
  const top = Math.min(112, height * 0.4),
    bottom = height - (landscape ? 80 : Math.min(190, height * 0.3));
  const tx = (dx < 0 ? cx - left : right - cx) / (Math.abs(dx) || 1);
  const ty = (dy < 0 ? cy - top : bottom - cy) / (Math.abs(dy) || 1);
  const t = Math.max(0, Math.min(tx, ty));
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx) };
}
