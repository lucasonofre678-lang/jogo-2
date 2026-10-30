// Clima de cada ambiente: partículas que caem, sobem ou derivam ao redor da
// câmera (cinza na noite, chuva na tempestade, brasas na fúria, pólen
// dourado no poente). A posição é calculada na GPU, dentro de uma caixa que
// acompanha a câmera: um único desenho e nenhum trabalho de CPU por partícula.
import * as THREE from 'three';

// vel: deriva em m/s · sway: balanço lateral (m) · streak: risco vertical (chuva)
const KINDS = {
  noite: { color: [0.5, 0.56, 0.72], vel: [0.25, -0.8, 0.1], size: 0.06, sway: 0.6, alpha: 0.55 },
  crepusculo: { color: [0.75, 0.5, 0.95], vel: [0.2, -0.35, 0], size: 0.07, sway: 1.0, alpha: 0.5 },
  tempestade: { color: [0.55, 0.75, 0.85], vel: [2.2, -17, 0.6], size: 0.16, sway: 0.05, alpha: 0.5, streak: 1 },
  furia: { color: [2.0, 0.45, 0.35], vel: [0.25, 1.3, 0], size: 0.07, sway: 0.8, alpha: 0.85 },
  aurora: { color: [0.45, 1.3, 0.95], vel: [0, 0.35, 0], size: 0.06, sway: 1.2, alpha: 0.5 },
  poente: { color: [1.7, 1.1, 0.45], vel: [0.6, -0.25, 0.2], size: 0.07, sway: 1.4, alpha: 0.6 },
  veu: { color: [1.0, 0.45, 1.7], vel: [0, 0.5, 0], size: 0.07, sway: 1.0, alpha: 0.55 },
  amanhecer: { color: [1.5, 1.2, 0.85], vel: [0.2, 0.25, 0], size: 0.06, sway: 1.0, alpha: 0.5 },
};

const MAX = 1600;
const BOX = 36;

const VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uVel;
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform float uSway;
  varying float vA;
  void main() {
    vec3 seed = position;
    vec3 off = seed * ${BOX.toFixed(1)} + uVel * uTime;
    off.x += sin(uTime * 0.7 + seed.y * 40.0) * uSway;
    off.z += cos(uTime * 0.6 + seed.x * 30.0) * uSway;
    vec3 local = mod(off - uCam, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(uCam + local, 1.0);
    float d = length(local) / ${(BOX / 2).toFixed(1)};
    vA = smoothstep(1.0, 0.55, d) * smoothstep(0.6, 2.5, -mv.z);
    gl_PointSize = uSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uStreak;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float disc = smoothstep(0.5, 0.0, length(c));
    float streak = smoothstep(0.07, 0.0, abs(c.x)) * (1.0 - abs(c.y) * 2.0);
    float a = mix(disc, streak, uStreak);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * vA * uAlpha);
  }
`;

export class Weather {
  constructor(scene, scaleUniform) {
    const seeds = new Float32Array(MAX * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uScale: scaleUniform,
        uSize: { value: 0.06 },
        uSway: { value: 1 },
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0.5 },
        uStreak: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this.count = MAX;
  }

  setKind(env) {
    const k = KINDS[env] ?? KINDS.noite;
    const u = this.mat.uniforms;
    u.uVel.value.set(...k.vel);
    u.uSize.value = k.size;
    u.uSway.value = k.sway;
    u.uColor.value.setRGB(...k.color);
    u.uAlpha.value = k.alpha;
    u.uStreak.value = k.streak ?? 0;
  }

  // 0..1 da quantidade máxima (0 desliga)
  setDensity(k) {
    this.count = Math.round(MAX * k);
    this.points.geometry.setDrawRange(0, this.count);
    this.points.visible = this.count > 0;
  }

  update(time, camPos) {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uCam.value.copy(camPos);
  }
}
