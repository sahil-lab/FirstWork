import {
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshMatcapMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";

export interface SculptureScene {
  setPaused: (paused: boolean) => void;
  setPointer: (x: number, y: number) => void;
  turn: () => void;
  dispose: () => void;
}

function studioTexture(pigment: readonly [number, number, number], metallic: boolean) {
  const size = 192;
  const channels = [0, 1, 2] as const;
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = ((column + 0.5) / size) * 2 - 1;
      const y = 1 - ((row + 0.5) / size) * 2;
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      const light = Math.max(0, -x * 0.38 + y * 0.5 + z * 0.78);
      const highlight = Math.pow(Math.max(0, -x * 0.5 + y * 0.55 + z * 0.67), 32);
      const reflectedX = 2 * x * z;
      const reflectedY = 2 * y * z;
      const strip = Math.exp(-Math.pow((reflectedX + 0.58) / 0.13, 2));
      const rim = Math.exp(-Math.pow((reflectedY - 0.65) / 0.1, 2));
      const intensity = metallic
        ? 0.24 + (reflectedY + 1) * 0.21 + strip * 0.7 + rim * 0.6
        : 0.3 + light * 0.7;
      const offset = (row * size + column) * 4;
      for (const channel of channels) {
        pixels[offset + channel] = Math.min(
          255,
          pigment[channel] * intensity + highlight * (metallic ? 100 : 95),
        );
      }
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, size, size);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createSculptureScene(
  canvas: HTMLCanvasElement,
  initiallyPaused: boolean,
  onContextLost: () => void,
): SculptureScene {
  const host = canvas.parentElement;
  if (!host) throw new Error("The sculpture canvas needs a containing element.");
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(37, 1, 0.1, 40);
  camera.position.set(0, 0.15, 7.8);
  // Bake studio highlights once, avoiding expensive real-time environment convolution.
  const limeTexture = studioTexture([202, 242, 91], false);
  const chromeTexture = studioTexture([218, 225, 215], true);
  const lime = new MeshMatcapMaterial({ matcap: limeTexture });
  const chrome = new MeshMatcapMaterial({ matcap: chromeTexture });
  const knotGeometry = new TorusKnotGeometry(1.15, 0.38, 160, 24, 2, 3);
  const orbitGeometry = new TorusGeometry(1.92, 0.048, 12, 128);
  const sphereGeometry = new SphereGeometry(0.28, 32, 20);
  const knot = new Mesh(knotGeometry, lime);
  const orbit = new Mesh(orbitGeometry, chrome);
  orbit.rotation.set(1.12, 0.28, -0.4);
  const satellite = new Mesh(sphereGeometry, chrome);
  satellite.position.set(-1.7, 1.1, 0.45);
  const model = new Group();
  model.add(knot, orbit, satellite);
  scene.add(model);

  let disposed = false;
  let lost = false;
  let paused = initiallyPaused;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let angle = 0;
  let targetAngle = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;

  function schedule() {
    if (!disposed && !lost && inView && !document.hidden && frame === 0) {
      frame = requestAnimationFrame(render);
    }
  }

  function render(time: number) {
    frame = 0;
    if (disposed || lost || !inView || document.hidden) return;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    if (time - lastTime < 1000 / 24) {
      schedule();
      return;
    }
    lastTime = time;
    if (!paused) elapsed += delta;
    angle += (targetAngle - angle) * 0.085;
    pointerX += (targetX - pointerX) * 0.065;
    pointerY += (targetY - pointerY) * 0.065;
    model.rotation.set(
      0.35 + Math.sin(elapsed * 0.22) * 0.08 + pointerY * 0.16,
      -0.35 + elapsed * 0.085 + pointerX * 0.24 + angle,
      -0.32 + Math.sin(elapsed * 0.18) * 0.045,
    );
    model.position.y = Math.sin(elapsed * 0.55) * 0.065;
    renderer.render(scene, camera);
    if (
      !paused ||
      Math.abs(angle - targetAngle) > 0.001 ||
      Math.abs(pointerX - targetX) > 0.001 ||
      Math.abs(pointerY - targetY) > 0.001
    ) {
      schedule();
    }
  }

  function resize() {
    const width = Math.max(1, host?.clientWidth ?? 1);
    const height = Math.max(1, host?.clientHeight ?? 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 0.85 ? 8.8 : 7.8;
    camera.updateProjectionMatrix();
    schedule();
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      inView = entry?.isIntersecting ?? false;
      if (inView) schedule();
      else stopFrame();
    },
    { threshold: 0.05 },
  );
  visibilityObserver.observe(host);

  function onVisibilityChange() {
    if (document.hidden) stopFrame();
    else schedule();
  }

  function onLost(event: Event) {
    event.preventDefault();
    lost = true;
    stopFrame();
    onContextLost();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("webglcontextlost", onLost);
  resize();

  return {
    setPaused(value) {
      paused = value;
      if (paused) {
        angle = targetAngle;
        pointerX = targetX;
        pointerY = targetY;
      }
      schedule();
    },
    setPointer(x, y) {
      if (paused) return;
      targetX = x;
      targetY = y;
      schedule();
    },
    turn() {
      targetAngle += Math.PI / 2;
      if (paused) angle = targetAngle;
      schedule();
    },
    dispose() {
      disposed = true;
      stopFrame();
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onLost);
      knotGeometry.dispose();
      orbitGeometry.dispose();
      sphereGeometry.dispose();
      lime.dispose();
      chrome.dispose();
      limeTexture.dispose();
      chromeTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
