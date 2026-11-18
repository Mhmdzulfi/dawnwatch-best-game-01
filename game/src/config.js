// Every tuning number and colour of Dawnwatch in one place. The playfield is a fixed 1280x800
// logical area with the dawn crystal at its centre; the renderer scales it to the window, so no
// rule below depends on the screen size.

export const FIELD = { width: 1280, height: 800, centreX: 640, centreY: 400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The crystal the player guards, and the turret ring around it. */
export const BASTION = {
  crystalRadius: 26,
  ringRadius: 52,
  wardMax: 10,
  bulletSpeed: 760,
  bulletRadius: 5,
  fireInterval: 0.16,
  rapidInterval: 0.085,
  powerSeconds: 12,
};

/** The four kinds of night shard that fly at the crystal. */
export const SHARD = {
  shard: { radius: 16, hp: 1, speed: 78, score: 50, wardDamage: 1 },
  weaver: { radius: 14, hp: 1, speed: 86, score: 80, wardDamage: 1 },
  darter: { radius: 11, hp: 1, speed: 142, score: 100, wardDamage: 1 },
  bulwark: { radius: 30, hp: 6, speed: 33, score: 250, wardDamage: 2 },
};

/** Power orbs: shoot one to take its gift. Tri-shot and rapid fade; the aegis waits to be spent. */
export const ORB = {
  radius: 15,
  lifetime: 11,
  dropChance: 0.06,
  kinds: ['tri', 'rapid', 'aegis', 'mend'],
  mendAmount: 2,
};

/** Twelve waves of night, then dawn. Counts grow, the gaps shrink, the shards hurry. */
export const WAVES = {
  total: 12,
  baseCount: 11,
  countPerWave: 4,
  baseInterval: 0.98,
  intervalPerWave: 0.08,
  minInterval: 0.32,
  speedPerWave: 0.07,
  respiteSeconds: 3.2,
  bannerSeconds: 2.2,
};

/** Kills in a row without a leak raise the score multiplier, one tenth at a time, to fivefold. */
export const COMBO = { step: 0.1, maxBonus: 4, popupSeconds: 0.9 };

/** Caps for the pooled things that fly around, so a long wave never allocates mid-frame. */
export const POOL = { shards: 96, bullets: 160, particles: 420, orbs: 12, popups: 24 };

export const PALETTE = {
  nightTop: '#070a18',
  nightBottom: '#131a33',
  dawnTop: '#3a2b52',
  dawnBottom: '#c96f3f',
  star: '#dfe8ff',
  crystal: '#8ef6ff',
  crystalCore: '#eaffff',
  ring: '#54627f',
  ringLit: '#9fb6dd',
  muzzle: '#ffd98a',
  bullet: '#ffe9a8',
  ward: '#7dffb0',
  wardLow: '#ff7d6b',
  text: '#eef2ff',
  muted: '#93a0c2',
  panel: 'rgba(10, 14, 30, 0.72)',
  shard: '#b08cff',
  shardEdge: '#6d4fd0',
  weaver: '#7de3ff',
  weaverEdge: '#2f8fb8',
  darter: '#ffb35c',
  darterEdge: '#c26a1d',
  bulwark: '#ff7d9c',
  bulwarkEdge: '#b83a5c',
  orbTri: '#ffd94d',
  orbRapid: '#6bffb8',
  orbAegis: '#6bb8ff',
  orbMend: '#a8ff6b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'dawnwatch.best';
