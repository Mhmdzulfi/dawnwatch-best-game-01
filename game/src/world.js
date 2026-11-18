// The whole simulation of Dawnwatch: waves of night shards fly at the dawn crystal, the turret
// shoots them down, orbs drop and are shot for their gifts, and the night ends after twelve
// waves. Nothing here draws or makes a sound: step() advances the state by one fixed step and
// returns event bits, and the boot code turns the events into sound and announcements.

import { BASTION, COMBO, FIELD, ORB, POOL, SHARD, WAVES } from './config.js';

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_LEAK = 4;
export const EVENT_SHIELD = 8;
export const EVENT_ORB = 16;
export const EVENT_WAVE = 32;
export const EVENT_WIN = 64;
export const EVENT_LOSE = 128;

export const KIND_SHARD = 'shard';
export const KIND_WEAVER = 'weaver';
export const KIND_DARTER = 'darter';
export const KIND_BULWARK = 'bulwark';

/** How far beyond the field's edge a shard starts: just out of sight, so it is seen at once. */
const SPAWN_MARGIN = 46;
/** How far a bullet may fly from the crystal before it fizzles out. */
const BULLET_RANGE = 920;
/** Keyboard aim speed, radians a second. */
const KEY_AIM_SPEED = 2.8;

function waveCount(wave) {
  return WAVES.baseCount + (wave - 1) * WAVES.countPerWave;
}

function waveInterval(wave) {
  return Math.max(WAVES.minInterval, WAVES.baseInterval - (wave - 1) * WAVES.intervalPerWave);
}

function bulwarksPlanned(wave) {
  return wave >= 3 ? 1 + Math.floor((wave - 3) / 3) : 0;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    ward: BASTION.wardMax,
    shield: false,
    wave: 0,
    phase: 'banner',
    phaseTime: 0,
    spawnLeft: 0,
    spawnTimer: 0,
    bulwarksLeft: 0,
    aim: -Math.PI / 2,
    fireCooldown: 0,
    triTime: 0,
    rapidTime: 0,
    shake: 0,
    crystalFlash: 0,
    muzzle: 0,
    shards: [],
    bullets: [],
    orbs: [],
    particles: [],
    popups: [],
  };

  function burst(x, y, colour, count, speed, life, size) {
    for (let index = 0; index < count && state.particles.length < POOL.particles; index += 1) {
      const angle = random.range(0, Math.PI * 2);
      const pace = random.range(speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        age: 0,
        life: random.range(life * 0.5, life),
        size: random.range(size * 0.5, size),
        colour,
      });
    }
  }

  function popup(x, y, text, colour) {
    if (state.popups.length >= POOL.popups) state.popups.shift();
    state.popups.push({ x, y, text, colour, age: 0, life: COMBO.popupSeconds });
  }

  function startWave(wave) {
    state.wave = wave;
    state.phase = 'banner';
    state.phaseTime = WAVES.bannerSeconds;
    state.spawnLeft = waveCount(wave);
    state.bulwarksLeft = bulwarksPlanned(wave);
    state.spawnTimer = 0.4;
  }

  function chooseKind() {
    const wave = state.wave;
    if (state.bulwarksLeft > 0 && (state.spawnLeft <= state.bulwarksLeft || random.chance(0.1))) return KIND_BULWARK;
    const roll = random.next();
    if (wave >= 4 && roll < 0.18) return KIND_DARTER;
    if (wave >= 2 && roll < 0.45) return KIND_WEAVER;
    return KIND_SHARD;
  }

  /** A random point on the rectangle a little larger than the field, from any of its sides. */
  function spawnPoint() {
    const width = FIELD.width + SPAWN_MARGIN * 2;
    const height = FIELD.height + SPAWN_MARGIN * 2;
    let along = random.range(0, 2 * (width + height));
    if (along < width) return { x: -SPAWN_MARGIN + along, y: -SPAWN_MARGIN };
    along -= width;
    if (along < height) return { x: FIELD.width + SPAWN_MARGIN, y: -SPAWN_MARGIN + along };
    along -= height;
    if (along < width) return { x: FIELD.width + SPAWN_MARGIN - along, y: FIELD.height + SPAWN_MARGIN };
    along -= width;
    return { x: -SPAWN_MARGIN, y: FIELD.height + SPAWN_MARGIN - along };
  }

  function spawnShard() {
    const kind = chooseKind();
    if (kind === KIND_BULWARK) state.bulwarksLeft -= 1;
    const spec = SHARD[kind];
    const { x, y } = spawnPoint();
    const inward = Math.atan2(FIELD.centreY - y, FIELD.centreX - x) + random.range(-0.12, 0.12);
    const speed = spec.speed * (1 + (state.wave - 1) * WAVES.speedPerWave) * random.range(0.88, 1.12);
    state.shards.push({
      kind, x, y,
      dirX: Math.cos(inward),
      dirY: Math.sin(inward),
      speed,
      hp: spec.hp,
      maxHp: spec.hp,
      radius: spec.radius,
      spin: random.range(0, Math.PI * 2),
      spinSpeed: random.range(-1.4, 1.4),
      wobblePhase: random.range(0, Math.PI * 2),
      age: 0,
      flash: 0,
    });
    state.spawnLeft -= 1;
  }

  function dropOrb(x, y, guaranteed) {
    if (state.orbs.length >= POOL.orbs) return;
    if (!guaranteed && !random.chance(ORB.dropChance)) return;
    let kind = random.pick(ORB.kinds);
    if (kind === 'mend' && state.ward >= BASTION.wardMax) kind = 'tri';
    if (kind === 'aegis' && state.shield) kind = 'rapid';
    state.orbs.push({ x, y, kind, age: 0, life: ORB.lifetime });
  }

  function applyOrb(orb) {
    if (orb.kind === 'tri') state.triTime = BASTION.powerSeconds;
    else if (orb.kind === 'rapid') state.rapidTime = BASTION.powerSeconds;
    else if (orb.kind === 'aegis') state.shield = true;
    else if (orb.kind === 'mend') state.ward = Math.min(BASTION.wardMax, state.ward + ORB.mendAmount);
    popup(orb.x, orb.y - 18, orb.kind === 'tri' ? 'TRI-SHOT' : orb.kind === 'rapid' ? 'RAPID FIRE' : orb.kind === 'aegis' ? 'AEGIS' : 'WARD +2', '#dfffe9');
  }

  function killShard(shard, index, events) {
    const spec = SHARD[shard.kind];
    state.shards.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const multiplier = 1 + Math.min(state.combo, 40) * COMBO.step;
    const points = Math.round(spec.score * multiplier);
    state.score += points;
    burst(shard.x, shard.y, shard.kind === KIND_BULWARK ? '#ff7d9c' : '#c9b3ff', shard.kind === KIND_BULWARK ? 30 : 14, shard.kind === KIND_BULWARK ? 320 : 240, 0.55, 4);
    popup(shard.x, shard.y - shard.radius - 6, `+${points}`, '#ffe9a8');
    dropOrb(shard.x, shard.y, shard.kind === KIND_BULWARK);
    return events | EVENT_KILL;
  }

  function leakShard(shard, index, events) {
    const spec = SHARD[shard.kind];
    state.shards.splice(index, 1);
    burst(shard.x, shard.y, '#8ef6ff', 22, 280, 0.6, 4);
    state.shake = Math.min(1, state.shake + 0.55);
    state.crystalFlash = 0.35;
    state.combo = 0;
    if (state.shield) {
      state.shield = false;
      popup(FIELD.centreX, FIELD.centreY - 84, 'AEGIS SPENT', '#bcd9ff');
      return events | EVENT_SHIELD;
    }
    state.ward -= spec.wardDamage;
    popup(FIELD.centreX, FIELD.centreY - 84, spec.wardDamage > 1 ? 'WARD -2' : 'WARD -1', '#ff9d8a');
    if (state.ward <= 0) {
      state.ward = 0;
      state.phase = 'lost';
      state.phaseTime = 0;
      burst(FIELD.centreX, FIELD.centreY, '#8ef6ff', 70, 420, 1.1, 5);
      return events | EVENT_LEAK | EVENT_LOSE;
    }
    return events | EVENT_LEAK;
  }

  function fire(events) {
    const spread = state.triTime > 0 ? [-0.13, 0, 0.13] : [0];
    for (const offset of spread) {
      if (state.bullets.length >= POOL.bullets) break;
      const angle = state.aim + offset;
      state.bullets.push({
        x: FIELD.centreX + Math.cos(state.aim) * (BASTION.ringRadius + 8),
        y: FIELD.centreY + Math.sin(state.aim) * (BASTION.ringRadius + 8),
        vx: Math.cos(angle) * BASTION.bulletSpeed,
        vy: Math.sin(angle) * BASTION.bulletSpeed,
      });
      state.shotsFired += 1;
    }
    state.muzzle = 0.06;
    state.fireCooldown = state.rapidTime > 0 ? BASTION.rapidInterval : BASTION.fireInterval;
    return events | EVENT_SHOOT;
  }

  function step(dt, control) {
    let events = 0;
    state.time += dt;
    if (state.phase === 'won' || state.phase === 'lost') {
      stepEffects(dt);
      return events;
    }

    // Aim: the pointer wins when it has been seen; otherwise the keys turn the turret.
    if (control.aim !== null && control.aim !== undefined) state.aim = control.aim;
    else if (control.rotate) state.aim += control.rotate * KEY_AIM_SPEED * dt;

    state.phaseTime -= dt;
    if (state.phase === 'banner' && state.phaseTime <= 0) {
      state.phase = 'active';
      events |= EVENT_WAVE;
    } else if (state.phase === 'respite' && state.phaseTime <= 0) {
      startWave(state.wave + 1);
    }

    if (state.phase === 'active') {
      if (state.spawnLeft > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0 && state.shards.length < POOL.shards) {
          spawnShard();
          state.spawnTimer = waveInterval(state.wave) * random.range(0.7, 1.3);
        }
      } else if (state.shards.length === 0) {
        if (state.wave >= WAVES.total) {
          state.phase = 'won';
          state.phaseTime = 0;
          burst(FIELD.centreX, FIELD.centreY, '#ffd98a', 80, 460, 1.3, 5);
          events |= EVENT_WIN;
        } else {
          state.phase = 'respite';
          state.phaseTime = WAVES.respiteSeconds;
        }
      }
    }

    state.fireCooldown -= dt;
    if (control.firing && state.fireCooldown <= 0 && state.phase !== 'banner') events = fire(events);
    state.triTime = Math.max(0, state.triTime - dt);
    state.rapidTime = Math.max(0, state.rapidTime - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    state.crystalFlash = Math.max(0, state.crystalFlash - dt);
    state.shake = Math.max(0, state.shake - dt * 1.6);

    // Shards fly in; one that reaches the ring strikes the crystal.
    for (let index = state.shards.length - 1; index >= 0; index -= 1) {
      const shard = state.shards[index];
      shard.age += dt;
      shard.spin += shard.spinSpeed * dt;
      shard.flash = Math.max(0, shard.flash - dt);
      let vx = shard.dirX * shard.speed;
      let vy = shard.dirY * shard.speed;
      if (shard.kind === KIND_WEAVER) {
        const sway = Math.sin(shard.age * 3.2 + shard.wobblePhase) * 74;
        vx += -shard.dirY * sway;
        vy += shard.dirX * sway;
      }
      shard.x += vx * dt;
      shard.y += vy * dt;
      const dx = shard.x - FIELD.centreX;
      const dy = shard.y - FIELD.centreY;
      if (Math.hypot(dx, dy) < BASTION.ringRadius + shard.radius * 0.35) {
        events = leakShard(shard, index, events);
        if (state.phase === 'lost') {
          stepEffects(dt);
          return events;
        }
      }
    }

    // Bullets fly out and meet shards and orbs.
    for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.bullets[index];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const dx = bullet.x - FIELD.centreX;
      const dy = bullet.y - FIELD.centreY;
      if (Math.hypot(dx, dy) > BULLET_RANGE) {
        state.bullets.splice(index, 1);
        continue;
      }
      let spent = false;
      for (let s = state.shards.length - 1; s >= 0; s -= 1) {
        const shard = state.shards[s];
        if (Math.hypot(bullet.x - shard.x, bullet.y - shard.y) < shard.radius + BASTION.bulletRadius) {
          state.shotsHit += 1;
          shard.hp -= 1;
          shard.flash = 0.09;
          if (shard.hp <= 0) events = killShard(shard, s, events);
          else burst(shard.x, shard.y, '#e6dcff', 4, 160, 0.3, 3);
          spent = true;
          break;
        }
      }
      if (spent) {
        state.bullets.splice(index, 1);
        continue;
      }
      for (let o = state.orbs.length - 1; o >= 0; o -= 1) {
        const orb = state.orbs[o];
        if (Math.hypot(bullet.x - orb.x, bullet.y - orb.y) < ORB.radius + BASTION.bulletRadius) {
          applyOrb(orb);
          burst(orb.x, orb.y, '#dfffe9', 12, 200, 0.45, 3);
          state.orbs.splice(o, 1);
          state.bullets.splice(index, 1);
          events |= EVENT_ORB;
          break;
        }
      }
    }

    // Orbs fade; particles and popups live out their short lives.
    for (let index = state.orbs.length - 1; index >= 0; index -= 1) {
      state.orbs[index].age += dt;
      if (state.orbs[index].age >= state.orbs[index].life) state.orbs.splice(index, 1);
    }
    stepEffects(dt);
    return events;
  }

  function stepEffects(dt) {
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        state.particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
    for (let index = state.popups.length - 1; index >= 0; index -= 1) {
      const popup = state.popups[index];
      popup.age += dt;
      popup.y -= 34 * dt;
      if (popup.age >= popup.life) state.popups.splice(index, 1);
    }
  }

  /** Advance only the clock and the loose effects: the title screen's quiet sky. */
  function ambient(dt) {
    state.time += dt;
    stepEffects(dt);
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.ward = BASTION.wardMax;
    state.shield = false;
    state.shards.length = 0;
    state.bullets.length = 0;
    state.orbs.length = 0;
    state.particles.length = 0;
    state.popups.length = 0;
    state.fireCooldown = 0;
    state.triTime = 0;
    state.rapidTime = 0;
    state.shake = 0;
    state.crystalFlash = 0;
    state.muzzle = 0;
    startWave(1);
  }

  reset();

  return { state, step, ambient, reset };
}
