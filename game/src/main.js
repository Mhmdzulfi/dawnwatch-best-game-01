// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between five screens: title, play, paused, victory and defeat, the last two
// reached when the world's own phase says the night is won or lost.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|siege|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_KILL, EVENT_LEAK, EVENT_LOSE, EVENT_ORB, EVENT_SHIELD, EVENT_SHOOT, EVENT_WAVE, EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotInfo = {
    screen: scene.screen,
    phase: world.state.phase,
    wave: world.state.wave,
    score: world.state.score,
    ward: world.state.ward,
    kills: world.state.kills,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(renderer.toLogical);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each blow.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. The crystal ward is full.');
  }

  function finishGame() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (world.state.phase === 'won') {
      screen = SCREEN_WIN;
      announce(`Dawn breaks. You held all twelve waves. Score ${world.state.score}.`);
    } else {
      screen = SCREEN_OVER;
      announce(`The crystal has fallen on wave ${world.state.wave}. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.boom(false);
    if (events & EVENT_LEAK) audio.leak();
    if (events & EVENT_SHIELD) audio.orb();
    if (events & EVENT_ORB) audio.orb();
    if (events & EVENT_WAVE) {
      audio.waveHorn();
      announce(`Wave ${world.state.wave} of 12.`);
    }
    if (events & EVENT_WIN) audio.win();
    if (events & EVENT_LOSE) audio.lose();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) announce(audio.toggleMuted() ? 'Sound off.' : 'Sound on.');
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function control() {
    const rotate = input.rotateDirection();
    if (rotate !== 0) return { aim: null, rotate, firing: input.firing() };
    if (input.pointer.seen) {
      const aim = Math.atan2(input.pointer.y - FIELD.centreY, input.pointer.x - FIELD.centreX);
      return { aim, rotate: 0, firing: input.firing() };
    }
    return { aim: null, rotate: 0, firing: input.firing() };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.state.aim += STEP * 0.35; // a slow sweep over the title sky
      world.ambient(STEP);
      return;
    }
    const events = world.step(STEP, control());
    playEvents(events);
    if ((events & (EVENT_WIN | EVENT_LOSE)) !== 0) finishGame();
    else if (events & EVENT_LEAK) announce(world.state.ward === 1 ? 'The ward is nearly gone.' : `Struck. Ward ${world.state.ward} of 10.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the night pass unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Dawnwatch. Press Enter or click to begin the watch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
