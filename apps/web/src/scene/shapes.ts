export interface ShapeSet {
  count: number;
  sphere: Float32Array;
  chaos: Float32Array;
  documents: Float32Array;
  network: Float32Array;
  rings: Float32Array;
  asterisk: Float32Array;
  /** Per particle: seed, link position (-1 off a link), node index (-1 off a node), size. */
  meta: Float32Array;
}

type Random = () => number;

const TAU = Math.PI * 2;
const SHEET_WIDTH = 2.3;
const SHEET_HEIGHT = 3.1;
const SHEETS = [
  { x: -1.25, y: -0.05, z: -0.55, tilt: 0.2 },
  { x: 0, y: 0.08, z: 0, tilt: -0.03 },
  { x: 1.25, y: -0.05, z: 0.55, tilt: -0.24 },
] as const;
const NODES = [
  { x: -3.3, y: 0.45 },
  { x: 0, y: -0.4 },
  { x: 3.3, y: 0.45 },
] as const;
const NODE_RADIUS = 0.7;
const RING_RADII = [1.05, 1.7, 2.35, 3] as const;

// Deterministic generator so every visit, tier and test sees the same forms.
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function write(target: Float32Array, index: number, x: number, y: number, z: number) {
  const offset = index * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function writeSphere(target: Float32Array, index: number, next: Random) {
  if (index % 9 === 0) {
    const angle = next() * TAU;
    const radius = 2.72 + next() * 0.16;
    write(
      target,
      index,
      Math.cos(angle) * radius,
      (next() - 0.5) * 0.04,
      Math.sin(angle) * radius,
    );
    return;
  }
  const height = 1 - 2 * next();
  const ring = Math.sqrt(1 - height * height);
  const angle = next() * TAU;
  write(
    target,
    index,
    ring * Math.cos(angle) * 2,
    height * 2,
    ring * Math.sin(angle) * 2,
  );
}

function lineLength(sheet: number, row: number) {
  const value = Math.sin((sheet * 13 + row * 7 + 1) * 12.9898) * 43758.5453;
  return 0.45 + 0.5 * (value - Math.floor(value));
}

function writeDocument(target: Float32Array, index: number, next: Random) {
  const sheetIndex = index % SHEETS.length;
  const sheet = SHEETS[sheetIndex] ?? SHEETS[0];
  const kind = next();
  let x: number;
  let y: number;
  if (kind < 0.2) {
    const along = next() * (SHEET_WIDTH + SHEET_HEIGHT) * 2;
    if (along < SHEET_WIDTH) {
      x = along - SHEET_WIDTH / 2;
      y = SHEET_HEIGHT / 2;
    } else if (along < SHEET_WIDTH + SHEET_HEIGHT) {
      x = SHEET_WIDTH / 2;
      y = SHEET_HEIGHT / 2 - (along - SHEET_WIDTH);
    } else if (along < SHEET_WIDTH * 2 + SHEET_HEIGHT) {
      x = SHEET_WIDTH / 2 - (along - SHEET_WIDTH - SHEET_HEIGHT);
      y = -SHEET_HEIGHT / 2;
    } else {
      x = -SHEET_WIDTH / 2;
      y = -SHEET_HEIGHT / 2 + (along - SHEET_WIDTH * 2 - SHEET_HEIGHT);
    }
  } else if (kind < 0.84) {
    let row = Math.floor(next() * 10);
    if (row === 4 || row === 8) row += 1;
    const title = row === 0;
    const usable = SHEET_WIDTH - 0.6;
    const length = title ? usable * 0.5 : usable * lineLength(sheetIndex, row);
    x = -SHEET_WIDTH / 2 + 0.3 + next() * length;
    y = SHEET_HEIGHT / 2 - 0.42 - row * 0.19 + (next() - 0.5) * (title ? 0.07 : 0.024);
  } else {
    const angle = next() * TAU;
    const radius = 0.26 + (next() - 0.5) * 0.03;
    x = SHEET_WIDTH / 2 - 0.52 + Math.cos(angle) * radius;
    y = -SHEET_HEIGHT / 2 + 0.52 + Math.sin(angle) * radius;
  }
  const cosine = Math.cos(sheet.tilt);
  const sine = Math.sin(sheet.tilt);
  write(
    target,
    index,
    sheet.x + x * cosine - y * sine,
    sheet.y + x * sine + y * cosine,
    sheet.z + (next() - 0.5) * 0.03,
  );
}

function writeNetwork(
  target: Float32Array,
  meta: Float32Array,
  index: number,
  next: Random,
) {
  const pick = next();
  if (pick < 0.3) {
    // An outlined circle with a light fill, matching the status diagram beside it.
    const nodeIndex = index % NODES.length;
    const node = NODES[nodeIndex] ?? NODES[0];
    const angle = next() * TAU;
    const radius =
      next() < 0.85
        ? NODE_RADIUS + (next() - 0.5) * 0.05
        : NODE_RADIUS * Math.sqrt(next());
    write(
      target,
      index,
      node.x + Math.cos(angle) * radius,
      node.y + Math.sin(angle) * radius,
      (next() - 0.5) * 0.06,
    );
    meta[index * 4 + 2] = nodeIndex;
    return;
  }
  if (pick >= 0.38) {
    // Loose dust around the diagram gives it depth.
    write(target, index, (next() - 0.5) * 16, (next() - 0.5) * 6, 3 - next() * 8);
    return;
  }
  const linkIndex = index % 2;
  const from = NODES[linkIndex] ?? NODES[0];
  const to = NODES[linkIndex + 1] ?? NODES[2];
  const along = next();
  const t = 0.2 + along * 0.6;
  const inverse = 1 - t;
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 + 0.7;
  const x = inverse * inverse * from.x + 2 * inverse * t * controlX + t * t * to.x;
  const y = inverse * inverse * from.y + 2 * inverse * t * controlY + t * t * to.y;
  const spread = next() < 0.14 ? next() * 0.24 : 0.035;
  const angle = next() * TAU;
  write(
    target,
    index,
    x + Math.cos(angle) * spread * 0.4,
    y + Math.cos(angle) * spread,
    Math.sin(angle) * spread,
  );
  meta[index * 4 + 1] = linkIndex + along;
}

function writeRing(target: Float32Array, index: number, next: Random) {
  const pick = next();
  if (pick < 0.06) {
    const height = 1 - 2 * next();
    const ring = Math.sqrt(1 - height * height);
    const angle = next() * TAU;
    const radius = 0.26 * Math.cbrt(next());
    write(
      target,
      index,
      ring * Math.cos(angle) * radius,
      height * radius,
      ring * Math.sin(angle) * radius,
    );
    return;
  }
  const ringIndex = pick < 0.24 ? 0 : pick < 0.62 ? 1 : pick < 0.81 ? 2 : 3;
  const base = RING_RADII[ringIndex] ?? RING_RADII[0];
  const radius = base + (next() - 0.5) * (ringIndex === 1 ? 0.13 : 0.05);
  const angle = next() * TAU;
  const lean = ringIndex === 2 ? 0.12 : ringIndex === 3 ? -0.14 : 0;
  const x = Math.cos(angle) * radius;
  const y = (next() - 0.5) * 0.04;
  write(
    target,
    index,
    x * Math.cos(lean) - y * Math.sin(lean),
    x * Math.sin(lean) + y * Math.cos(lean),
    Math.sin(angle) * radius,
  );
}

function writeAsterisk(target: Float32Array, index: number, next: Random) {
  const angle = (index % 4) * (Math.PI / 4);
  let along = (next() - 0.5) * 4.6;
  let across = (next() - 0.5) * 0.78;
  const edge = next();
  if (edge < 0.22) across = across < 0 ? -0.39 : 0.39;
  else if (edge < 0.3) along = along < 0 ? -2.3 : 2.3;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  write(
    target,
    index,
    along * cosine - across * sine,
    along * sine + across * cosine,
    (next() - 0.5) * 0.36,
  );
}

/**
 * Builds every form the particles can take. Sampling is random per index, so
 * drawing only the first N particles still shows each complete form.
 */
export function buildShapes(count: number): ShapeSet {
  const next = createRandom(20261112);
  const shapes: ShapeSet = {
    count,
    sphere: new Float32Array(count * 3),
    chaos: new Float32Array(count * 3),
    documents: new Float32Array(count * 3),
    network: new Float32Array(count * 3),
    rings: new Float32Array(count * 3),
    asterisk: new Float32Array(count * 3),
    meta: new Float32Array(count * 4),
  };
  for (let index = 0; index < count; index++) {
    shapes.meta[index * 4] = next();
    shapes.meta[index * 4 + 1] = -1;
    shapes.meta[index * 4 + 2] = -1;
    shapes.meta[index * 4 + 3] = next();
    writeSphere(shapes.sphere, index, next);
    write(
      shapes.chaos,
      index,
      (next() - 0.5) * 20,
      (next() - 0.5) * 11,
      (next() - 0.5) * 10 - 1,
    );
    writeDocument(shapes.documents, index, next);
    writeNetwork(shapes.network, shapes.meta, index, next);
    writeRing(shapes.rings, index, next);
    writeAsterisk(shapes.asterisk, index, next);
  }
  return shapes;
}
