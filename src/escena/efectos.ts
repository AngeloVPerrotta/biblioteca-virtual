/**
 * Detalles de atmósfera: polvo flotando en la luz y el haz de sol que entra por la ventana.
 */
import * as THREE from 'three';
import { rng } from '../util/aleatorio';
import { aTextura, texturaPunto } from './texturas';

export class Polvo {
  readonly puntos: THREE.Points;
  private readonly base: Float32Array;
  private readonly fase: Float32Array;
  private t = 0;

  constructor(cantidad: number, caja: THREE.Box3) {
    const r = rng(181);
    const pos = new Float32Array(cantidad * 3);
    this.fase = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i++) {
      pos[i * 3] = caja.min.x + r() * (caja.max.x - caja.min.x);
      pos[i * 3 + 1] = caja.min.y + r() * (caja.max.y - caja.min.y);
      pos[i * 3 + 2] = caja.min.z + r() * (caja.max.z - caja.min.z);
      this.fase[i] = r() * Math.PI * 2;
    }
    this.base = pos.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: aTextura(texturaPunto()),
      color: 0xffe2b5,
      size: 0.009,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.puntos = new THREE.Points(geo, mat);
    this.puntos.frustumCulled = false;
  }

  set intensidad(v: number) {
    (this.puntos.material as THREE.PointsMaterial).opacity = v;
  }

  tick(dt: number) {
    this.t += dt;
    const pos = this.puntos.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.fase.length; i++) {
      const f = this.fase[i];
      arr[i * 3] = this.base[i * 3] + Math.sin(this.t * 0.11 + f) * 0.08;
      arr[i * 3 + 1] = this.base[i * 3 + 1] + Math.sin(this.t * 0.07 + f * 2) * 0.06 + ((this.t * 0.004 + f) % 0.2) - 0.1;
      arr[i * 3 + 2] = this.base[i * 3 + 2] + Math.cos(this.t * 0.09 + f) * 0.08;
    }
    pos.needsUpdate = true;
  }
}

const capaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const capaFragment = /* glsl */ `
  uniform sampler2D uGobo;
  uniform vec3 uColor;
  uniform float uIntensidad;
  uniform float uCapa;
  varying vec2 vUv;
  void main() {
    float g = texture2D(uGobo, vUv).r;
    float borde = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    gl_FragColor = vec4(uColor * g * uIntensidad * uCapa * borde, 1.0);
  }
`;

/**
 * Haces de sol "volumétricos": capas transparentes a lo largo del cono de la luz,
 * cada una con el mismo dibujo de ventana que proyecta el sol. Sumadas parecen rayos en el aire.
 */
export class HazDeSol {
  readonly grupo = new THREE.Group();
  private readonly comunes: { uGobo: { value: THREE.Texture | null }; uColor: { value: THREE.Color }; uIntensidad: { value: number } };
  private readonly capas: THREE.Mesh[] = [];

  constructor(gobo: THREE.Texture | null, cantidad: number) {
    this.comunes = { uGobo: { value: gobo }, uColor: { value: new THREE.Color('#ffcf94') }, uIntensidad: { value: 0 } };
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < cantidad; i++) {
      const k = i / (cantidad - 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.comunes, uCapa: { value: Math.pow(Math.sin(Math.PI * (0.08 + k * 0.84)), 1.5) } },
        vertexShader: capaVertex,
        fragmentShader: capaFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const capa = new THREE.Mesh(geo, mat);
      capa.renderOrder = 5;
      capa.frustumCulled = false;
      this.capas.push(capa);
      this.grupo.add(capa);
    }
  }

  /** Ubica las capas entre el sol y la pared. */
  actualizar(sol: THREE.SpotLight, color: THREE.Color, intensidad: number) {
    this.comunes.uColor.value.copy(color);
    this.comunes.uIntensidad.value = intensidad;
    this.grupo.visible = intensidad > 0.002;
    const desde = sol.position;
    const hasta = sol.target.position;
    const eje = hasta.clone().sub(desde);
    const largo = eje.length();
    eje.normalize();
    const tan = Math.tan(sol.angle);
    this.capas.forEach((capa, i) => {
      const d = largo * (0.35 + (i / (this.capas.length - 1)) * 0.62);
      capa.position.copy(desde).addScaledVector(eje, d);
      capa.up.set(0, 1, 0);
      capa.lookAt(desde);
      capa.scale.setScalar(2 * d * tan);
    });
  }
}
