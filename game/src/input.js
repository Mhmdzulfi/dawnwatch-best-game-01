// Keyboard and mouse, read as state plus a small queue of one-shot actions. The game loop asks
// each frame: where is the pointer (in logical field coordinates), is the trigger held, which
// way do the keys turn the turret, and which actions were pressed since the last frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

/**
 * `toLogical` turns a mouse event's client position into field coordinates; the renderer owns
 * the letterbox maths and hands it in. Listeners are attached to the window so a pointer that
 * leaves the canvas still aims true.
 */
export function createInput(toLogical) {
  const keys = new Set();
  const pointer = { x: 0, y: 0, down: false, seen: false };
  let queued = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('pointermove', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.seen = true;
  });
  window.addEventListener('pointerdown', (event) => {
    pointer.down = true;
    const point = toLogical(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.seen = true;
    queued |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
  });

  return {
    pointer,
    /** -1 to turn left, 1 to turn right, 0 for neither (A/D or the arrow keys). */
    rotateDirection() {
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The trigger: the mouse button held, or Space held. */
    firing() {
      return pointer.down || keys.has('Space');
    },
    /** The actions pressed since the last call; asking spends them. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
