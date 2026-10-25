// Renderizador, céu noturno, névoa, luz lunar e pós-processamento (bloom).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const FOG_COLOR = new THREE.Color(0x111a30);
export const MOON_DIR = new THREE.Vector3(-0.42, 0.52, -0.74).normalize();

export const ENVS = {
  noite: {
    fog: 0x111a30, density: 0.018, top: 0x02040a, moon: 0xc4d4ff, moonI: 2.4,
    hemiSky: 0x7a92d4, hemiGround: 0x10131d, hemiI: 1.15, fill: 0x6a84cc, exposure: 1.25, mist: [0.35, 0.45, 0.75],
  },
  crepusculo: {
    fog: 0x2b1c3d, density: 0.013, top: 0x07030f, moon: 0xffcfb0, moonI: 2.2,
    hemiSky: 0xa58ad0, hemiGround: 0x1a1020, hemiI: 1.1, fill: 0x9a78c8, exposure: 1.2, mist: [0.55, 0.4, 0.7],
  },
  tempestade: {
    fog: 0x0f2428, density: 0.02, top: 0x010507, moon: 0xb0ecff, moonI: 2.6,
    hemiSky: 0x6ab0c0, hemiGround: 0x081214, hemiI: 1.1, fill: 0x5aa0b0, exposure: 1.25, mist: [0.3, 0.55, 0.6],
  },
  furia: {
    fog: 0x2c0e18, density: 0.015, top: 0x080104, moon: 0xffb8c0, moonI: 2.3,
    hemiSky: 0xc07890, hemiGround: 0x1a0810, hemiI: 1.05, fill: 0xb06080, exposure: 1.2, mist: [0.6, 0.3, 0.4],
  },
  aurora: {
    fog: 0x0e2622, density: 0.012, top: 0x010806, moon: 0xc0ffe8, moonI: 2.4,
    hemiSky: 0x70d0b0, hemiGround: 0x081410, hemiI: 1.15, fill: 0x60c0a0, exposure: 1.25, mist: [0.3, 0.6, 0.55],
  },
  // o outro lado do Véu (tecla F)
  veu: {
    fog: 0x1c0d34, density: 0.016, top: 0x060112, moon: 0xd8b8ff, moonI: 2.3,
    hemiSky: 0xa080f0, hemiGround: 0x140820, hemiI: 1.2, fill: 0x9070e0, exposure: 1.3, mist: [0.55, 0.3, 0.85],
  },
  // o amanhecer do epílogo
  amanhecer: {
    fog: 0x6a5a78, density: 0.009, top: 0x24345a, moon: 0xffe0b8, moonI: 2.8,
    hemiSky: 0xffd0b0, hemiGround: 0x302830, hemiI: 1.4, fill: 0xffc0a0, exposure: 1.15, mist: [0.9, 0.7, 0.7],
  },
};

function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x02040a) },
      uHorizon: { value: FOG_COLOR.clone() },
      uMoonDir: { value: MOON_DIR.clone() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uMoonDir;
      uniform float uTime;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.3, h));

        // Estrelas
        vec3 p = d * 260.0;
        vec3 cell = floor(p);
        float rnd = hash(cell);
        vec3 f = fract(p) - 0.5;
        float star = step(0.986, rnd) * smoothstep(0.35, 0.0, length(f));
        float tw = 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 4.0) + rnd * 40.0);
        col += vec3(0.75, 0.82, 1.0) * star * tw * smoothstep(0.05, 0.35, h) * 1.6;

        // Lua com halo
        float m = dot(d, normalize(uMoonDir));
        float disc = smoothstep(0.99935, 0.99955, m);
        float crater = hash(floor(d * 900.0)) * 0.12;
        col += vec3(1.0, 0.97, 0.9) * disc * (3.2 - crater * 6.0);
        col += vec3(0.45, 0.58, 0.95) * pow(max(m, 0.0), 220.0) * 0.9;
        col += vec3(0.25, 0.35, 0.7) * pow(max(m, 0.0), 14.0) * 0.18;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = FOG_COLOR.clone();
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.018);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 5, 20);

  const sky = createSky();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0x7a92d4, 0x10131d, 1.15);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x1c2850, 0.6);
  scene.add(ambient);
  // Luz de preenchimento vinda de trás do jogador: deixa legíveis as paredes
  // e bordas à frente, que ficam na contraluz da lua.
  const fill = new THREE.DirectionalLight(0x6a84cc, 0.75);
  fill.position.set(0.35, 0.55, 0.8);
  scene.add(fill);

  const moon = new THREE.DirectionalLight(0xc4d4ff, 2.4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -32;
  sc.right = 32;
  sc.top = 32;
  sc.bottom = -32;
  sc.near = 1;
  sc.far = 180;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.05;
  scene.add(moon);
  scene.add(moon.target);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.55, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resizeListeners = [];
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    for (const fn of resizeListeners) fn(w, h);
  }
  window.addEventListener('resize', resize);

  // Ambientes: cada fase tem seu céu, névoa e luar.
  function setEnv(name) {
    const e = ENVS[name] ?? ENVS.noite;
    const fog = new THREE.Color(e.fog);
    scene.fog.color.copy(fog);
    scene.fog.density = e.density;
    scene.background.copy(fog);
    sky.material.uniforms.uHorizon.value.copy(fog);
    sky.material.uniforms.uTop.value.set(e.top);
    moon.color.set(e.moon);
    moon.intensity = e.moonI;
    hemi.color.set(e.hemiSky);
    hemi.groundColor.set(e.hemiGround);
    hemi.intensity = e.hemiI;
    fill.color.set(e.fill);
    renderer.toneMappingExposure = e.exposure;
    return e;
  }

  // A luz da lua acompanha o jogador para manter o mapa de sombras nítido.
  const texel = (sc.right - sc.left) / moon.shadow.mapSize.x;
  const tmp = new THREE.Vector3();
  function followMoon(target) {
    tmp.set(Math.round(target.x / texel) * texel, Math.round(target.y / texel) * texel, Math.round(target.z / texel) * texel);
    moon.target.position.copy(tmp);
    moon.position.copy(tmp).addScaledVector(MOON_DIR, 90);
  }

  return { renderer, scene, camera, composer, bloom, moon, sky, resizeListeners, followMoon, setEnv, resize };
}
