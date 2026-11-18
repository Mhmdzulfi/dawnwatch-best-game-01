// Everything Dawnwatch draws: the sky that lightens as dawn nears, the crystal and its turret
// ring, the shards, orbs, bullets and sparks, the HUD, and the title, pause, victory and defeat
// screens. The world module owns the rules; this one only paints the state it is given, in a
// fixed 1280x800 field letterboxed into the window.

import { BASTION, FIELD, FONT, ORB, PALETTE, WAVES } from './config.js';
import { KIND_BULWARK, KIND_DARTER, KIND_SHARD, KIND_WEAVER } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** A name for each of the twelve waves, shown on its banner. */
const WAVE_NAMES = [
  'The First Stirring', 'The Weavers Come', 'Iron in the Dark', 'Darters at the Gate',
  'The Long Drift', 'A Sharper Night', 'The Bulwark Road', 'Crosswinds',
  'The Ninth Bell', 'Embers of Dawn', 'The Last Muster', 'Until Sunrise',
];

const SHARD_PAINT = {
  [KIND_SHARD]: [PALETTE.shard, PALETTE.shardEdge],
  [KIND_WEAVER]: [PALETTE.weaver, PALETTE.weaverEdge],
  [KIND_DARTER]: [PALETTE.darter, PALETTE.darterEdge],
  [KIND_BULWARK]: [PALETTE.bulwark, PALETTE.bulwarkEdge],
};

const ORB_PAINT = { tri: PALETTE.orbTri, rapid: PALETTE.orbRapid, aegis: PALETTE.orbAegis, mend: PALETTE.orbMend };
const ORB_LABEL = { tri: 'TRI', rapid: 'RAPID', aegis: 'AEGIS', mend: 'MEND' };

function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 };

  // The starfield is fixed: one seeded scatter, twinkling by the clock, never by the rules.
  const starRandom = createRandom(20261115);
  const stars = [];
  for (let index = 0; index < 170; index += 1) {
    stars.push({
      x: starRandom.range(0, FIELD.width),
      y: starRandom.range(0, FIELD.height),
      r: starRandom.range(0.7, 2.1),
      phase: starRandom.range(0, Math.PI * 2),
    });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
    view.scale = Math.min(view.width / FIELD.width, view.height / FIELD.height);
    view.offsetX = (view.width - FIELD.width * view.scale) / 2;
    view.offsetY = (view.height - FIELD.height * view.scale) / 2;
    view.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  /** A mouse event's client position turned into field coordinates. */
  function toLogical(clientX, clientY) {
    return {
      x: (clientX - view.offsetX) / view.scale,
      y: (clientY - view.offsetY) / view.scale,
    };
  }

  function dawnProgress(state, screen) {
    if (screen === SCREEN_WIN || state.phase === 'won') return 1;
    return Math.min(1, Math.max(0, (state.wave - 1) / WAVES.total));
  }

  function drawSky(state, screen) {
    const t = dawnProgress(state, screen);
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, mix(PALETTE.nightTop, PALETTE.dawnTop, t));
    gradient.addColorStop(1, mix(PALETTE.nightBottom, PALETTE.dawnBottom, t * t));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // The sun, rising as the waves fall: a glow low on the field that grows with the night.
    if (t > 0.25) {
      const glow = ctx.createRadialGradient(FIELD.centreX, FIELD.height + 60, 40, FIELD.centreX, FIELD.height + 60, 620);
      glow.addColorStop(0, `rgba(255, 176, 92, ${(t - 0.25) * 0.75})`);
      glow.addColorStop(1, 'rgba(255, 176, 92, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    for (const star of stars) {
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 1.7 + star.phase));
      ctx.globalAlpha = twinkle * (1 - t * 0.75);
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBastion(state) {
    const { centreX: cx, centreY: cy } = FIELD;
    // The ward ring the shards must not cross, and the turret ring that turns on it.
    ctx.strokeStyle = 'rgba(140, 165, 220, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.arc(cx, cy, BASTION.ringRadius + 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, BASTION.ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ringLit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, BASTION.ringRadius, state.time * 0.4, state.time * 0.4 + 4.2);
    ctx.stroke();

    // The barrel, turned to the aim, with its muzzle flash while it fires.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.aim);
    ctx.fillStyle = '#39466a';
    ctx.fillRect(BASTION.ringRadius - 6, -7, 34, 14);
    ctx.fillStyle = '#5a6d99';
    ctx.fillRect(BASTION.ringRadius + 18, -4.5, 12, 9);
    if (state.muzzle > 0) {
      ctx.fillStyle = PALETTE.muzzle;
      ctx.beginPath();
      ctx.moveTo(BASTION.ringRadius + 32, 0);
      ctx.lineTo(BASTION.ringRadius + 52, -8);
      ctx.lineTo(BASTION.ringRadius + 46, 0);
      ctx.lineTo(BASTION.ringRadius + 52, 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // The aegis, when one is held: a bubble of light over the ring.
    if (state.shield) {
      ctx.strokeStyle = 'rgba(107, 184, 255, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, BASTION.ringRadius + 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The crystal itself: a turning diamond with a bright heart, flashing when struck.
    const pulse = 1 + Math.sin(state.time * 2.4) * 0.05;
    const r = BASTION.crystalRadius * pulse;
    ctx.save();
    ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 3.1);
    glow.addColorStop(0, 'rgba(142, 246, 255, 0.5)');
    glow.addColorStop(1, 'rgba(142, 246, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 3.1, -r * 3.1, r * 6.2, r * 6.2);
    ctx.rotate(Math.sin(state.time * 0.7) * 0.16);
    ctx.fillStyle = state.crystalFlash > 0 ? '#ffffff' : PALETTE.crystal;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.62, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.crystalCore;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(r * 0.28, 0);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.28, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawShard(shard) {
    const [fill, edge] = SHARD_PAINT[shard.kind];
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.fillStyle = shard.flash > 0 ? '#ffffff' : fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (shard.kind === KIND_DARTER) {
      const heading = Math.atan2(shard.dirY, shard.dirX);
      ctx.rotate(heading);
      ctx.moveTo(shard.radius + 5, 0);
      ctx.lineTo(-shard.radius, -shard.radius * 0.72);
      ctx.lineTo(-shard.radius * 0.45, 0);
      ctx.lineTo(-shard.radius, shard.radius * 0.72);
    } else if (shard.kind === KIND_WEAVER) {
      ctx.rotate(shard.spin);
      ctx.moveTo(0, -shard.radius);
      ctx.quadraticCurveTo(shard.radius, 0, 0, shard.radius);
      ctx.quadraticCurveTo(-shard.radius, 0, 0, -shard.radius);
    } else if (shard.kind === KIND_BULWARK) {
      ctx.rotate(shard.spin);
      for (let side = 0; side < 6; side += 1) {
        const angle = (side / 6) * Math.PI * 2;
        const px = Math.cos(angle) * shard.radius;
        const py = Math.sin(angle) * shard.radius;
        if (side === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else {
      ctx.rotate(shard.spin);
      const points = 7;
      for (let side = 0; side < points; side += 1) {
        const angle = (side / points) * Math.PI * 2;
        const wobble = 1 + 0.18 * Math.sin(side * 2.7 + shard.wobblePhase);
        const px = Math.cos(angle) * shard.radius * wobble;
        const py = Math.sin(angle) * shard.radius * wobble;
        if (side === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // A bulwark shows its wounds: an arc of remaining strength above it.
    if (shard.kind === KIND_BULWARK && shard.hp < shard.maxHp) {
      ctx.strokeStyle = 'rgba(10, 12, 24, 0.65)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(shard.x, shard.y, shard.radius + 9, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.bulwark;
      ctx.beginPath();
      ctx.arc(shard.x, shard.y, shard.radius + 9, -Math.PI / 2, -Math.PI / 2 + (shard.hp / shard.maxHp) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawOrb(orb) {
    const colour = ORB_PAINT[orb.kind];
    const blink = orb.life - orb.age < 2 && Math.sin(orb.age * 14) > 0;
    ctx.save();
    ctx.translate(orb.x, orb.y + Math.sin(orb.age * 2.6) * 3);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fillStyle = 'rgba(8, 12, 26, 0.85)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, ORB.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.font = `700 8.5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ORB_LABEL[orb.kind], 0, 0.5);
    ctx.restore();
  }

  function drawEffects(state) {
    for (const bullet of state.bullets) {
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
      ctx.fillStyle = particle.colour;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const popup of state.popups) {
      ctx.globalAlpha = Math.max(0, 1 - popup.age / popup.life);
      ctx.font = `700 17px ${FONT}`;
      ctx.fillStyle = popup.colour;
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = 'rgba(140, 165, 220, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function drawHud(state, best, muted) {
    // Score and best, top left.
    panel(18, 16, 218, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('SCORE', 34, 38);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 27px ${FONT}`;
    ctx.fillText(String(state.score), 34, 68);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`BEST ${best}`, 130, 68);

    // Wave and the shards still out there, top centre.
    panel(506, 16, 268, 64);
    ctx.textAlign = 'center';
    const left = state.spawnLeft + state.shards.length;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(state.phase === 'respite' ? 'WAVE — HELD' : `WAVE — ${left} SHARD${left === 1 ? '' : 'S'} OUT`, 640, 38);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 27px ${FONT}`;
    ctx.fillText(`${state.wave} / ${WAVES.total}`, 640, 68);

    // The crystal's ward, top right: ten diamonds, lit while the ward holds.
    panel(1044, 16, 218, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('CRYSTAL WARD', 1060, 38);
    for (let index = 0; index < BASTION.wardMax; index += 1) {
      const x = 1068 + index * 19;
      const y = 58;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = index < state.ward ? (state.ward <= 3 ? PALETTE.wardLow : PALETTE.ward) : 'rgba(120, 135, 170, 0.3)';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    if (state.shield) {
      ctx.fillStyle = PALETTE.orbAegis;
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText('AEGIS HELD', 1170, 38);
    }

    // Combo, bottom left: the multiplier and a bar of the streak behind it.
    if (state.combo > 1) {
      const multiplier = 1 + Math.min(state.combo, 40) * 0.1;
      panel(18, 716, 218, 64);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText('COMBO', 34, 738);
      ctx.fillStyle = '#ffd94d';
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText(`x${multiplier.toFixed(1)}`, 34, 766);
      ctx.fillStyle = 'rgba(255, 217, 77, 0.85)';
      ctx.fillRect(104, 752, Math.min(state.combo, 40) / 40 * 116, 8);
    }

    // Gifts in hand, bottom right, with the seconds they have left.
    const gifts = [];
    if (state.triTime > 0) gifts.push(['TRI-SHOT', state.triTime, PALETTE.orbTri]);
    if (state.rapidTime > 0) gifts.push(['RAPID', state.rapidTime, PALETTE.orbRapid]);
    if (gifts.length > 0) {
      panel(1044, 716, 218, 64);
      gifts.forEach(([label, seconds, colour], index) => {
        const y = 740 + index * 24;
        ctx.fillStyle = colour;
        ctx.font = `700 13px ${FONT}`;
        ctx.fillText(label, 1060, y);
        ctx.fillRect(1140, y - 9, (seconds / BASTION.powerSeconds) * 104, 7);
      });
    }

    ctx.fillStyle = 'rgba(200, 212, 240, 0.55)';
    ctx.font = `600 12.5px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'M sound off · P pause' : 'M mute · P pause', 1262, 790);
  }

  function centreText(text, y, font, colour) {
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.centreX, y);
  }

  function statsLines(state) {
    const held = state.phase === 'won' ? WAVES.total : Math.max(0, state.wave - 1);
    const minutes = Math.floor(state.time / 60);
    const seconds = String(Math.floor(state.time % 60)).padStart(2, '0');
    return [
      `Score  ${state.score}`,
      `Waves held  ${held} of ${WAVES.total}   ·   Shards felled  ${state.kills}`,
      `Best combo  x${(1 + Math.min(state.bestCombo, 40) * 0.1).toFixed(1)}   ·   Night endured  ${minutes}:${seconds}`,
    ];
  }

  function drawTitle(state, best) {
    centreText('DAWNWATCH', 168, `800 84px ${FONT}`, PALETTE.text);
    centreText('Hold the dawn crystal through twelve waves of night.', 208, `500 21px ${FONT}`, '#c6d2f2');
    const lines = [
      'Night shards fly at the crystal. If one crosses the ring, the ward breaks a little;',
      'if the ward reaches zero, the light goes out. Clear wave twelve and dawn breaks — you win.',
      '',
      'MOUSE aim   ·   CLICK or SPACE fire   ·   A / D or arrow keys turn   ·   P pause   ·   M mute',
      'Shoot the glowing orbs for their gifts: TRI-SHOT, RAPID fire, an AEGIS shield, a mended ward.',
      'Kills in a row raise your combo multiplier — but every leak resets it.',
    ];
    ctx.font = `500 17.5px ${FONT}`;
    ctx.fillStyle = '#aebadd';
    ctx.textAlign = 'center';
    lines.forEach((line, index) => ctx.fillText(line, FIELD.centreX, 560 + index * 27));
    centreText('Press ENTER or click to begin the watch', 760 - 24, `700 20px ${FONT}`, PALETTE.muzzle);
    if (best > 0) centreText(`Best score so far: ${best}`, 118, `600 15px ${FONT}`, PALETTE.muted);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(24, 4, 10, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    centreText('THE CRYSTAL HAS FALLEN', 268, `800 52px ${FONT}`, '#ff9d8a');
    centreText(`The night took the light on wave ${state.wave}.`, 312, `500 20px ${FONT}`, '#e8c9c2');
    ctx.font = `600 21px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    statsLines(state).forEach((line, index) => centreText(line, 396 + index * 36, `600 21px ${FONT}`, PALETTE.text));
    if (state.score >= best && state.score > 0) centreText('A new best score.', 396 + 3 * 36, `700 19px ${FONT}`, PALETTE.muzzle);
    centreText('Press ENTER or click to watch again', 620, `700 20px ${FONT}`, PALETTE.muzzle);
  }

  function drawWin(state, best) {
    centreText('DAWN BREAKS', 250, `800 60px ${FONT}`, '#ffe3ae');
    centreText('Twelve waves held. The crystal greets the sun.', 296, `500 21px ${FONT}`, '#fdf3df');
    statsLines(state).forEach((line, index) => centreText(line, 384 + index * 36, `600 21px ${FONT}`, PALETTE.text));
    if (state.score >= best && state.score > 0) centreText('A new best score.', 384 + 3 * 36, `700 19px ${FONT}`, PALETTE.muzzle);
    centreText('Press ENTER or click to watch again', 620, `700 20px ${FONT}`, '#ffe3ae');
  }

  function drawBanner(state) {
    if (state.phase === 'banner') {
      ctx.globalAlpha = Math.min(1, state.phaseTime / 0.6 + 0.25);
      centreText(`WAVE ${state.wave}`, 330, `800 58px ${FONT}`, PALETTE.text);
      centreText(WAVE_NAMES[state.wave - 1] ?? '', 372, `500 22px ${FONT}`, '#c6d2f2');
      ctx.globalAlpha = 1;
    } else if (state.phase === 'respite') {
      centreText(`Wave ${state.wave} held — the next stirs in ${Math.ceil(state.phaseTime)}`, 120, `700 20px ${FONT}`, '#b9ffd2');
    }
  }

  function draw(state, screen, best, muted) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#04060f';
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);
    if (state.shake > 0) {
      const kick = state.shake * 9;
      ctx.translate(Math.sin(state.time * 91) * kick, Math.cos(state.time * 113) * kick);
    }
    drawSky(state, screen);
    if (screen !== SCREEN_TITLE) {
      for (const shard of state.shards) drawShard(shard);
      for (const orb of state.orbs) drawOrb(orb);
    }
    drawBastion(state);
    drawEffects(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, best, muted);
      drawBanner(state);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(5, 8, 18, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      centreText('PAUSED', 380, `800 54px ${FONT}`, PALETTE.text);
      centreText('Press P to resume', 428, `600 19px ${FONT}`, PALETTE.muted);
    }
    if (screen === SCREEN_OVER) {
      drawHud(state, best, muted);
      drawOver(state, best);
    }
    if (screen === SCREEN_WIN) {
      drawHud(state, best, muted);
      drawWin(state, best);
    }
  }

  return { draw, toLogical };
}
