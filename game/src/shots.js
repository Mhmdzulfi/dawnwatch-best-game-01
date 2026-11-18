// The screenshot scenes behind ?shot=start|play|siege|end. Each one plays the real rules
// forward from a fresh world, steered by an autopilot that aims the turret the way a careful
// player does — at the shard nearest to striking, led by its flight — so the frame is what a
// real game looks like and the same seed always gives the same frame.

import { BASTION, FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** The autopilot's control for one step: lead the most dangerous shard, fire, take orbs when safe. */
function autopilotControl(state) {
  let target = null;
  let targetTime = Infinity;
  for (const shard of state.shards) {
    const distance = Math.hypot(shard.x - FIELD.centreX, shard.y - FIELD.centreY) - BASTION.ringRadius;
    const time = distance / Math.max(shard.speed, 1);
    if (time < targetTime) {
      targetTime = time;
      target = shard;
    }
  }
  if (target === null && state.orbs.length > 0) target = state.orbs[0];
  if (target === null) return { aim: state.aim, rotate: 0, firing: false };
  const flight = Math.hypot(target.x - FIELD.centreX, target.y - FIELD.centreY) / BASTION.bulletSpeed;
  const leadX = target.x + (target.dirX ? target.dirX * target.speed * flight : 0);
  const leadY = target.y + (target.dirY ? target.dirY * target.speed * flight : 0);
  return { aim: Math.atan2(leadY - FIELD.centreY, leadX - FIELD.centreX), rotate: 0, firing: true };
}

/**
 * A human-like pilot for the play scene: it aims at where the most dangerous shard is, not
 * where it will be, and fires in bursts — so shards live longer, the field fills the way it
 * does for a real player, and the frame is honest mid-game traffic.
 */
function casualControl(state) {
  let target = null;
  let targetTime = Infinity;
  for (const shard of state.shards) {
    const distance = Math.hypot(shard.x - FIELD.centreX, shard.y - FIELD.centreY) - BASTION.ringRadius;
    const time = distance / Math.max(shard.speed, 1);
    if (time < targetTime) {
      targetTime = time;
      target = shard;
    }
  }
  if (target === null && state.orbs.length > 0) target = state.orbs[0];
  if (target === null) return { aim: state.aim, rotate: 0, firing: false };
  const aim = Math.atan2(target.y - FIELD.centreY, target.x - FIELD.centreX) + Math.sin(state.time * 1.7) * 0.03;
  const firing = Math.floor(state.time * 9) % 10 < 7;
  return { aim, rotate: 0, firing };
}

/** A control that watches the nearest shard but never fires: the siege scene's held breath. */
function passiveControl(state) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const shard of state.shards) {
    const distance = Math.hypot(shard.x - FIELD.centreX, shard.y - FIELD.centreY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = shard;
    }
  }
  if (nearest === null) return { aim: state.aim, rotate: 0, firing: false };
  return { aim: Math.atan2(nearest.y - FIELD.centreY, nearest.x - FIELD.centreX), rotate: 0, firing: false };
}

function playUntil(world, seconds, until, control = autopilotControl) {
  const limit = Math.floor(seconds / STEP);
  for (let index = 0; index < limit; index += 1) {
    world.step(STEP, control(world.state));
    if (until(world.state)) return;
    if (world.state.phase === 'won' || world.state.phase === 'lost') return;
  }
}

function screenOf(state) {
  if (state.phase === 'won') return SCREEN_WIN;
  if (state.phase === 'lost') return SCREEN_OVER;
  return SCREEN_PLAY;
}

/** How many shards are inside the field where a viewer can see them, not still flying in. */
function visibleShards(state) {
  let count = 0;
  for (const shard of state.shards) {
    if (shard.x > 30 && shard.x < FIELD.width - 30 && shard.y > 30 && shard.y < FIELD.height - 30) count += 1;
  }
  return count;
}

/**
 * Set `world` to the named scene (start, play, siege or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    playUntil(world, 300, (state) => (state.wave >= 4 && visibleShards(state) >= 5) || (state.wave >= 6 && visibleShards(state) >= 3), casualControl);
    return { screen: screenOf(world.state), best: world.state.score };
  }
  if (name === 'siege') {
    // Reach the eighth wave fighting, then hold fire a few seconds so the night closes in:
    // the frame is the real moment of peril the game keeps putting its player in.
    playUntil(world, 900, (state) => state.wave >= 8 && state.phase === 'active');
    playUntil(world, 7, (state) => visibleShards(state) >= 10 || state.ward <= 5, passiveControl);
    return { screen: screenOf(world.state), best: world.state.score };
  }
  if (name === 'end') {
    playUntil(world, 2400, () => false);
    return { screen: screenOf(world.state), best: world.state.score };
  }
  for (let index = 0; index < 3 / STEP; index += 1) world.ambient(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
