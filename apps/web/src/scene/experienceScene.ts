import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { buildShapes } from "./shapes";

export type SceneStatus = "checking" | "connected" | "failed";

export interface ExperienceScene {
  /** True when the scene draws on demand instead of animating. */
  readonly lowPower: boolean;
  setProgress: (value: number) => void;
  setPaused: (paused: boolean) => void;
  setStarted: (started: boolean) => void;
  setPointer: (clientX: number, clientY: number) => void;
  setStatus: (status: SceneStatus) => void;
  dispose: () => void;
}

export interface SceneOptions {
  paused: boolean;
  /** The entrance only plays once the page has been revealed. */
  started: boolean;
  status: SceneStatus;
  progress: number;
  /** Receives a copy of each frame drawn while the scene is at rest. */
  still: HTMLCanvasElement | null;
  /** Called once the first frame has been drawn. */
  onReady: () => void;
  onContextLost: () => void;
  /** Called if the device turns out too slow to animate smoothly. */
  onLowPower: () => void;
}

interface Tier {
  pixelRatio: number;
  particles: number;
  frameInterval: number;
}

/** Position is a fraction of the visible half-width/half-height at the focal plane. */
interface Pose {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

const MAX_PARTICLES = 28000;
const CAMERA_DISTANCE = 10;
const FIELD_OF_VIEW = 40;
const FORM_COUNT = 6;
const TIERS: readonly Tier[] = [
  { pixelRatio: 1.5, particles: MAX_PARTICLES, frameInterval: 0 },
  { pixelRatio: 1, particles: 20000, frameInterval: 0 },
  { pixelRatio: 0.75, particles: 12000, frameInterval: 1000 / 30 },
];
const SETTLE_MS = 900;
const WINDOW_MS = 1200;
// Software rasterisers and very slow devices hold still and draw only when the
// chapter changes, which keeps the page itself responsive.
const STILL_TIER: Tier = { pixelRatio: 1, particles: MAX_PARTICLES, frameInterval: 0 };
const REST: Pose = { x: 0, y: 0, scale: 1, opacity: 1 };
// One pose per form: sphere, chaos, documents, network, rings, asterisk.
const WIDE_POSES: readonly Pose[] = [
  { x: 0.56, y: 0.04, scale: 1.04, opacity: 1 },
  { x: 0, y: 0, scale: 1, opacity: 0.55 },
  { x: 0.6, y: 0.4, scale: 0.62, opacity: 0.9 },
  { x: 0.5, y: 0.62, scale: 0.42, opacity: 0.45 },
  { x: -0.8, y: -0.95, scale: 0.72, opacity: 0.45 },
  { x: 0.6, y: -0.28, scale: 0.8, opacity: 0.85 },
];
// On tall screens the content fills the width, so later forms sit behind it as faint marks.
const TALL_POSES: readonly Pose[] = [
  { x: 0.42, y: 0.43, scale: 0.52, opacity: 0.8 },
  { x: 0, y: 0, scale: 0.8, opacity: 0.5 },
  { x: 0, y: 0.05, scale: 0.5, opacity: 0.24 },
  { x: 0, y: 0.05, scale: 0.3, opacity: 0.26 },
  { x: 0, y: -0.1, scale: 0.45, opacity: 0.24 },
  { x: 0.45, y: -0.5, scale: 0.5, opacity: 0.6 },
];

const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const backdropFragment = /* glsl */ `
uniform float uTime;
uniform float uAspect;
uniform float uProgress;
uniform float uReveal;
uniform vec2 uFocus;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0 * vec2(uAspect, 1.0);
  float t = uTime * 0.06;
  vec2 q = p;
  q += 0.42 * vec2(sin(q.y * 1.3 + t * 1.7), cos(q.x * 1.1 - t * 1.3));
  q += 0.28 * vec2(sin(q.y * 2.3 - t * 2.1 + 1.7), cos(q.x * 2.0 + t * 1.9 + 0.4));
  q += 0.16 * vec2(sin(q.y * 3.9 + t * 2.9), cos(q.x * 3.4 - t * 2.3));
  float a = 0.5 + 0.5 * sin(q.x * 1.6 + q.y * 1.2 + t * 3.0);
  float b = 0.5 + 0.5 * sin(q.x * 0.9 - q.y * 1.9 - t * 2.2 + 2.0);
  float chaos = max(0.0, 1.0 - abs(uProgress - 1.0));
  vec3 color = vec3(0.02, 0.085, 0.045) * pow(a, 2.0);
  color += vec3(0.08, 0.13, 0.03) * pow(a * b, 2.5) * (1.0 - 0.7 * chaos);
  color += vec3(0.2, 0.06, 0.02) * pow(b * (1.0 - a), 2.0) * (0.12 + 0.88 * chaos);
  // The glow behind the form tightens on narrow screens so it does not flood them.
  vec2 away = (p - uFocus) / min(uAspect, 1.0);
  color += vec3(0.09, 0.15, 0.04) * exp(-dot(away, away) * 0.55) * (1.0 - chaos);
  color *= mix(1.0, 0.3, smoothstep(0.55, 1.6, length(p * vec2(0.62, 0.9))));
  gl_FragColor = vec4(vec3(0.024, 0.031, 0.027) + color * uReveal, 1.0);
}`;

const compositeFragment = /* glsl */ `
uniform sampler2D tMap;
uniform float uTime;
varying vec2 vUv;
float grain(vec2 point) {
  return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec3 color = texture2D(tMap, vUv).rgb;
  color += (grain(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.032;
  gl_FragColor = vec4(color, 1.0);
}`;

const pointVertex = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uSize;
uniform float uFormScale;
uniform float uConnected;
uniform float uFailed;
uniform float uOpacity;
uniform float uReveal;
uniform float uPointerStrength;
uniform vec2 uPointer;
attribute vec3 aChaos;
attribute vec3 aDocuments;
attribute vec3 aNetwork;
attribute vec3 aRings;
attribute vec3 aAsterisk;
attribute vec4 aMeta;
varying vec3 vColor;
varying float vAlpha;

vec3 rotateX(vec3 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
}
vec3 rotateY(vec3 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x);
}
vec3 rotateZ(vec3 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}
float weight(float progress, float index) {
  return max(0.0, 1.0 - abs(progress - index));
}

void main() {
  float seed = aMeta.x;
  float link = aMeta.y;
  float node = aMeta.z;

  // Particles leave for the next form at staggered moments, yet every form is
  // exact whenever the progress rests on a whole number.
  float segment = min(floor(uProgress), 4.0);
  float local = clamp((uProgress - segment - seed * 0.35) / 0.65, 0.0, 1.0);
  float eased = segment + local * local * (3.0 - 2.0 * local);
  float w0 = weight(eased, 0.0);
  float w1 = weight(eased, 1.0);
  float w2 = weight(eased, 2.0);
  float w3 = weight(eased, 3.0);
  float w4 = weight(eased, 4.0);
  float w5 = weight(eased, 5.0);

  vec3 unit = normalize(position);
  float swell = sin(unit.x * 3.1 + uTime * 0.55) * sin(unit.y * 2.7 - uTime * 0.4)
    + 0.55 * sin(unit.z * 4.9 + unit.x * 2.3 + uTime * 0.75);
  vec3 sphere = rotateY(position + unit * swell * 0.2, uTime * 0.09);
  sphere = rotateZ(rotateX(sphere, 0.38), 0.3);

  vec3 chaos = rotateY(aChaos, uTime * 0.02) + 0.55 * vec3(
    sin(uTime * 0.21 + seed * 41.0),
    cos(uTime * 0.17 + seed * 27.0),
    sin(uTime * 0.13 + seed * 63.0));

  vec3 documents = rotateY(aDocuments, sin(uTime * 0.32) * 0.24 - 0.3);
  documents.y += sin(uTime * 0.6 + aDocuments.x * 1.4) * 0.05;

  vec3 network = rotateY(aNetwork, sin(uTime * 0.27) * 0.1);

  float radius = length(aRings.xz);
  vec3 rings = rotateY(aRings, uTime * 0.16 / max(radius, 0.5));
  rings = rotateZ(rotateX(rings, 1.08), -0.22);

  vec3 asterisk = rotateY(rotateZ(aAsterisk, uTime * 0.1), sin(uTime * 0.25) * 0.35);

  vec3 morphed = sphere * w0 + chaos * w1 + documents * w2 + network * w3
    + rings * w4 + asterisk * w5;

  float settled = max(max(max(w0, w1), max(w2, w3)), max(w4, w5));
  morphed += 2.2 * (1.0 - settled) * vec3(
    sin(seed * 91.0 + uTime * 0.9),
    cos(seed * 53.0 - uTime * 0.7),
    sin(seed * 17.0 + uTime * 0.5));
  morphed *= mix(0.12, 1.0, uReveal);

  vec2 away = morphed.xy - uPointer;
  float push = uPointerStrength * exp(-dot(away, away) * 0.9);
  morphed.xy += normalize(away + vec2(0.0001)) * push * 0.55;
  morphed.z += push * 0.7;

  vec4 viewPosition = modelViewMatrix * vec4(morphed, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float isLink = step(0.0, link);
  float isNode = step(0.0, node);
  float pulse = isLink * w3 * uConnected
    * smoothstep(0.8, 1.0, fract(link * 1.5 - uTime * 0.32));

  vec3 lime = vec3(0.82, 0.98, 0.41);
  vec3 bone = vec3(0.95, 0.94, 0.88);
  vec3 ember = vec3(1.0, 0.47, 0.24);
  vec3 moss = vec3(0.36, 0.6, 0.3);
  float accent = step(0.72, fract(seed * 7.13));

  vec3 sphereColor = mix(
    mix(moss, lime, clamp(0.5 + 0.5 * swell, 0.0, 1.0)),
    bone,
    smoothstep(0.75, 1.3, swell));
  vec3 chaosColor = mix(bone * 0.75, ember, step(0.6, fract(seed * 5.71)));
  vec3 documentColor = mix(bone, lime, accent);
  // Node 0 is this page; nodes 1 and 2 reflect the latest real system check.
  float live = node < 0.5 ? 1.0 : uConnected;
  vec3 nodeColor = mix(mix(bone * 0.55, ember, uFailed), lime, live);
  vec3 linkColor = mix(mix(bone * 0.5, ember * 0.6, uFailed), lime, uConnected * 0.8);
  vec3 networkColor = mix(linkColor, nodeColor, isNode) + lime * pulse * 1.5;
  float current = 1.0 - smoothstep(0.08, 0.2, abs(radius - 1.7));
  vec3 ringColor = mix(bone * 0.7, lime, current);
  vec3 asteriskColor = mix(lime, bone, accent * 0.6);
  vColor = sphereColor * w0 + chaosColor * w1 + documentColor * w2 + networkColor * w3
    + ringColor * w4 + asteriskColor * w5;

  // Particles away from the focal plane grow larger and fainter, like bokeh.
  // Forms drawn small use finer points so their lines stay crisp.
  float depth = -viewPosition.z;
  float blur = clamp(abs(depth - 10.0) * 0.22, 0.0, 1.6);
  float fine = mix(0.6, 1.0, smoothstep(0.3, 1.0, uFormScale));
  float size = uSize * fine * (0.55 + aMeta.w * 0.9) * (1.0 + blur) * (1.0 + pulse * 1.6);
  gl_PointSize = max(1.0, size * uPixelRatio * 10.0 / depth);
  float fade = 1.0 - smoothstep(12.0, 24.0, depth);
  vAlpha = uOpacity * (0.42 + 0.58 * aMeta.w) * fade * (1.0 + pulse * 1.4)
    / (1.0 + blur * 1.4);
}`;

const pointFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float falloff = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vColor, falloff * vAlpha);
}`;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function poseAt(poses: readonly Pose[], index: number) {
  return poses[clamp(index, 0, poses.length - 1)] ?? REST;
}

export function createExperienceScene(
  canvas: HTMLCanvasElement,
  options: SceneOptions,
): ExperienceScene {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  renderer.autoClear = false;

  const context = renderer.getContext();
  const debug = context.getExtension("WEBGL_debug_renderer_info");
  const rendererName = String(
    context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER),
  );
  const software = /swiftshader|llvmpipe|software|basic render/i.test(rendererName);
  let lowPower = software;
  let tierIndex = window.innerWidth < 720 ? 1 : 0;
  let tier = lowPower ? STILL_TIER : (TIERS[tierIndex] ?? STILL_TIER);

  const shapes = buildShapes(MAX_PARTICLES);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(shapes.sphere, 3));
  geometry.setAttribute("aChaos", new BufferAttribute(shapes.chaos, 3));
  geometry.setAttribute("aDocuments", new BufferAttribute(shapes.documents, 3));
  geometry.setAttribute("aNetwork", new BufferAttribute(shapes.network, 3));
  geometry.setAttribute("aRings", new BufferAttribute(shapes.rings, 3));
  geometry.setAttribute("aAsterisk", new BufferAttribute(shapes.asterisk, 3));
  geometry.setAttribute("aMeta", new BufferAttribute(shapes.meta, 4));

  const pointUniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uPixelRatio: { value: 1 },
    uSize: { value: 3 },
    uFormScale: { value: 1 },
    uConnected: { value: 0 },
    uFailed: { value: 0 },
    uOpacity: { value: 0 },
    uReveal: { value: 0 },
    uPointerStrength: { value: 0 },
    uPointer: { value: new Vector2() },
  };
  const pointMaterial = new ShaderMaterial({
    uniforms: pointUniforms,
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const points = new Points(geometry, pointMaterial);
  points.frustumCulled = false;
  const pointScene = new Scene();
  pointScene.add(points);
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 60);
  camera.position.z = CAMERA_DISTANCE;

  // The soft backdrop is drawn small and stretched; grain is added at full size.
  const target = new WebGLRenderTarget(64, 64, {
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  const backdropUniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uProgress: { value: 0 },
    uReveal: { value: 0 },
    uFocus: { value: new Vector2() },
  };
  const compositeUniforms = { tMap: { value: target.texture }, uTime: { value: 0 } };
  const backdropMaterial = new ShaderMaterial({
    uniforms: backdropUniforms,
    vertexShader: quadVertex,
    fragmentShader: backdropFragment,
    depthTest: false,
    depthWrite: false,
  });
  const compositeMaterial = new ShaderMaterial({
    uniforms: compositeUniforms,
    vertexShader: quadVertex,
    fragmentShader: compositeFragment,
    depthTest: false,
    depthWrite: false,
  });
  const quadGeometry = new PlaneGeometry(2, 2);
  const backdrop = new Mesh(quadGeometry, backdropMaterial);
  const composite = new Mesh(quadGeometry, compositeMaterial);
  backdrop.frustumCulled = false;
  composite.frustumCulled = false;
  const backdropScene = new Scene();
  backdropScene.add(backdrop);
  const compositeScene = new Scene();
  compositeScene.add(composite);
  const quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let disposed = false;
  let lost = false;
  let paused = options.paused;
  let started = options.started;
  let status = options.status;
  let targetProgress = options.progress;
  let progress = paused || lowPower ? Math.round(targetProgress) : targetProgress;
  let connected = status === "connected" ? 1 : 0;
  let failed = status === "failed" ? 1 : 0;
  let reveal = paused || lowPower ? 1 : 0;
  let time = 0;
  let frame = 0;
  let last = 0;
  let width = 1;
  let height = 1;
  let halfWidth = 1;
  let halfHeight = 1;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerStrength = 0;
  let pointerMovedAt = Number.NEGATIVE_INFINITY;
  let measuringFrom = 0;
  let measuredFrames = 0;
  let slowWindows = 0;
  let presented = false;
  const stillContext = options.still?.getContext("2d", { alpha: false }) ?? null;

  // Every frame drawn at rest is copied to a plain 2D canvas, which is what the
  // page shows while resting: an idle WebGL surface can be dropped by the
  // compositor after scrolling, whereas a bitmap canvas keeps its picture.
  function snapshot() {
    const still = options.still;
    if (!still || !stillContext) return;
    if (still.width !== canvas.width || still.height !== canvas.height) {
      still.width = canvas.width;
      still.height = canvas.height;
    }
    stillContext.drawImage(canvas, 0, 0);
  }

  function schedule() {
    if (!disposed && !lost && !document.hidden && frame === 0) {
      frame = requestAnimationFrame(render);
    }
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    target.setSize(
      Math.max(32, Math.round(width * 0.18)),
      Math.max(32, Math.round(height * 0.18)),
    );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    halfHeight = Math.tan((FIELD_OF_VIEW * Math.PI) / 360) * CAMERA_DISTANCE;
    halfWidth = halfHeight * camera.aspect;
    pointUniforms.uPixelRatio.value = ratio;
    backdropUniforms.uAspect.value = camera.aspect;
    schedule();
  }

  function applyTier() {
    geometry.setDrawRange(0, tier.particles);
    pointUniforms.uSize.value = 3 * Math.sqrt(MAX_PARTICLES / tier.particles);
    resize();
  }

  function restartMeasuring() {
    measuringFrom = 0;
    measuredFrames = 0;
  }

  // Judge sustained speed rather than single frames: two slow windows in a row
  // step the quality down, and a device that is far too slow stops animating.
  function measure(now: number, elapsed: number) {
    // A long gap is an interruption such as a throttled tab, not a slow device.
    if (elapsed > 500) {
      restartMeasuring();
      return;
    }
    if (measuringFrom === 0) {
      measuringFrom = now + SETTLE_MS;
      return;
    }
    if (now < measuringFrom) return;
    measuredFrames++;
    const span = now - measuringFrom;
    if (span < WINDOW_MS) return;
    const average = span / measuredFrames;
    measuringFrom = now;
    measuredFrames = 0;
    const lightest = tierIndex === TIERS.length - 1;
    if (average <= (lightest ? 70 : 34)) {
      slowWindows = 0;
      return;
    }
    slowWindows++;
    if (slowWindows < 2) return;
    slowWindows = 0;
    if (lightest || average > 110) {
      lowPower = true;
      tier = STILL_TIER;
      applyTier();
      options.onLowPower();
    } else {
      tierIndex++;
      tier = TIERS[tierIndex] ?? tier;
      restartMeasuring();
      applyTier();
    }
  }

  function render(now: number) {
    frame = 0;
    if (disposed || lost || document.hidden) return;
    const resting = paused || lowPower;
    const elapsed = last === 0 ? 0 : now - last;
    if (
      !resting &&
      last !== 0 &&
      tier.frameInterval > 0 &&
      elapsed < tier.frameInterval - 2
    ) {
      schedule();
      return;
    }
    last = now;
    const delta = Math.min(elapsed, 100) / 1000;
    const blend = (rate: number) => (resting ? 1 : 1 - Math.exp(-delta * rate));

    if (resting) {
      reveal = 1;
    } else {
      time += delta;
      if (started) reveal = Math.min(1, reveal + delta / 2.6);
      measure(now, elapsed);
    }
    // At rest the scene cuts between whole forms instead of animating.
    const goal = resting ? Math.round(targetProgress) : targetProgress;
    progress += (goal - progress) * blend(4.2);
    connected += ((status === "connected" ? 1 : 0) - connected) * blend(3);
    failed += ((status === "failed" ? 1 : 0) - failed) * blend(3);
    const pointerActive = !resting && now - pointerMovedAt < 2600 ? 1 : 0;
    pointerStrength += (pointerActive - pointerStrength) * blend(5);
    pointerX += (pointerTargetX - pointerX) * blend(9);
    pointerY += (pointerTargetY - pointerY) * blend(9);

    const poses = camera.aspect < 0.9 ? TALL_POSES : WIDE_POSES;
    const lower = clamp(Math.floor(progress), 0, FORM_COUNT - 2);
    const amount = clamp(progress - lower, 0, 1);
    const eased = amount * amount * (3 - 2 * amount);
    const from = poseAt(poses, lower);
    const to = poseAt(poses, lower + 1);
    const scale = lerp(from.scale, to.scale, eased);
    const focusX = lerp(from.x, to.x, eased);
    const focusY = lerp(from.y, to.y, eased);
    points.position.set(focusX * halfWidth, focusY * halfHeight, 0);
    points.scale.setScalar(scale);

    const entrance = 1 - Math.pow(1 - reveal, 3);
    pointUniforms.uTime.value = time;
    pointUniforms.uProgress.value = progress;
    pointUniforms.uFormScale.value = scale;
    pointUniforms.uConnected.value = connected;
    pointUniforms.uFailed.value = failed;
    pointUniforms.uReveal.value = entrance;
    pointUniforms.uOpacity.value = lerp(from.opacity, to.opacity, eased) * entrance;
    pointUniforms.uPointerStrength.value = pointerStrength;
    pointUniforms.uPointer.value.set(
      (pointerX * halfWidth - points.position.x) / scale,
      (pointerY * halfHeight - points.position.y) / scale,
    );
    backdropUniforms.uTime.value = time;
    backdropUniforms.uProgress.value = progress;
    backdropUniforms.uReveal.value = entrance;
    backdropUniforms.uFocus.value.set(focusX * camera.aspect, focusY);
    compositeUniforms.uTime.value = time;

    renderer.setRenderTarget(target);
    renderer.render(backdropScene, quadCamera);
    renderer.setRenderTarget(null);
    renderer.render(compositeScene, quadCamera);
    renderer.render(pointScene, camera);
    if (resting) snapshot();
    if (!presented) {
      presented = true;
      options.onReady();
    }

    if (!resting) schedule();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      // Time spent hidden must not count as a slow frame.
      last = 0;
      restartMeasuring();
      schedule();
    }
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    options.onContextLost();
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onContextLost);
  applyTier();

  return {
    get lowPower() {
      return lowPower;
    },
    setProgress(value) {
      const next = clamp(value, 0, FORM_COUNT - 1);
      // At rest only a change of chapter is visible, so only that redraws.
      const visible =
        paused || lowPower
          ? Math.round(next) !== Math.round(targetProgress)
          : next !== targetProgress;
      targetProgress = next;
      if (visible) schedule();
    },
    setPaused(value) {
      paused = value;
      last = 0;
      restartMeasuring();
      schedule();
    },
    setStarted(value) {
      started = value;
      schedule();
    },
    setPointer(clientX, clientY) {
      if (paused || lowPower) return;
      pointerTargetX = (clientX / width) * 2 - 1;
      pointerTargetY = 1 - (clientY / height) * 2;
      pointerMovedAt = performance.now();
      schedule();
    },
    setStatus(value) {
      if (value === status) return;
      status = value;
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      geometry.dispose();
      quadGeometry.dispose();
      pointMaterial.dispose();
      backdropMaterial.dispose();
      compositeMaterial.dispose();
      target.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
