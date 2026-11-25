/**
 * Postproceso: oclusión ambiental (solo en compu), bloom suave en lámparas y ventana,
 * y un pase final de grano fílmico, viñeta y calidez.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Limpia valores inválidos (infinitos o NaN de brillos especulares extremos en half-float)
 * antes del bloom, que si no los esparce y la imagen se pone negra.
 */
const Saneador = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(min(c.rgb, vec3(48.0)), c.a);
    }
  `,
};

const PaseFinal = {
  uniforms: {
    tDiffuse: { value: null },
    uTiempo: { value: 0 },
    uVineta: { value: 0.32 },
    uGrano: { value: 0.035 },
    uOscurecer: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTiempo;
    uniform float uVineta;
    uniform float uGrano;
    uniform float uOscurecer;
    varying vec2 vUv;
    float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.9);
      float v = smoothstep(0.78, 0.18, length(d));
      float vineta = uVineta + uOscurecer * 0.35;
      c.rgb *= mix(1.0 - vineta, 1.0, v);
      c.rgb *= 1.0 - uOscurecer * 0.18 * (1.0 - v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.035, 1.0, 0.94), 0.6);
      float g = azar(vUv * 1000.0 + fract(uTiempo) * 17.0) - 0.5;
      c.rgb += g * uGrano;
      gl_FragColor = c;
    }
  `,
};

export class Postproceso {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly final: ShaderPass;
  private readonly gtao: GTAOPass | null;

  constructor(renderer: THREE.WebGLRenderer, escena: THREE.Scene, camara: THREE.PerspectiveCamera, alta: boolean, ocultarEnAO: THREE.Object3D[]) {
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    const destino = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: alta ? 4 : 2 });
    this.composer = new EffectComposer(renderer, destino);
    this.composer.addPass(new RenderPass(escena, camara));
    if (alta) {
      this.gtao = new GTAOPass(escena, camara, tam.x, tam.y);
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
      // Los efectos transparentes (haz, polvo, vidrio) no deben generar oclusión
      const renderOriginal = this.gtao.render.bind(this.gtao);
      this.gtao.render = (...args: Parameters<GTAOPass['render']>) => {
        const visibles = ocultarEnAO.map((o) => o.visible);
        ocultarEnAO.forEach((o) => (o.visible = false));
        renderOriginal(...args);
        ocultarEnAO.forEach((o, i) => (o.visible = visibles[i]));
      };
      this.composer.addPass(this.gtao);
    } else {
      this.gtao = null;
    }
    this.composer.addPass(new ShaderPass(Saneador));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(tam.x / 2, tam.y / 2), 0.32, 0.6, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(PaseFinal);
    this.composer.addPass(this.final);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  set oscurecer(v: number) {
    this.final.uniforms.uOscurecer.value = v;
  }

  render(dt: number) {
    this.final.uniforms.uTiempo.value += dt;
    this.composer.render(dt);
  }
}
