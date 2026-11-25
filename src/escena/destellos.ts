/**
 * Brillitos mágicos: estrellitas que titilan alrededor de algo.
 * Se usan como «easter egg» en el post-it del «¿Qué leo?» y alrededor del libro que elige la biblioteca.
 */
import * as THREE from 'three';

let texturaEstrella: THREE.Texture | null = null;

/** Estrellita de cuatro puntas con halo, dibujada una sola vez. */
function estrella() {
  if (texturaEstrella) return texturaEstrella;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const halo = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  halo.addColorStop(0, 'rgba(255,255,255,1)');
  halo.addColorStop(0.12, 'rgba(255,244,214,0.85)');
  halo.addColorStop(0.35, 'rgba(255,214,140,0.18)');
  halo.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 64, 64);
  ctx.translate(32, 32);
  for (let i = 0; i < 2; i++) {
    const rayo = ctx.createLinearGradient(-32, 0, 32, 0);
    rayo.addColorStop(0, 'rgba(255,230,180,0)');
    rayo.addColorStop(0.5, 'rgba(255,252,240,0.95)');
    rayo.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = rayo;
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.PI / 2);
  }
  texturaEstrella = new THREE.CanvasTexture(c);
  texturaEstrella.colorSpace = THREE.SRGBColorSpace;
  return texturaEstrella;
}

interface Chispa {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  fase: number;
  periodo: number;
  base: THREE.Vector3;
  tam: number;
}

export interface OpcionesDestellos {
  /** Cuántas estrellitas. */
  cantidad: number;
  /** Tamaño de cada una (metros). */
  tam: number;
  color?: THREE.ColorRepresentation;
  /** Más de 1 hace que el bloom las haga brillar. */
  brillo?: number;
  /** Cuánto suben mientras titilan (metros). */
  sube?: number;
  /** Qué parte del ciclo está visible cada una (0..1): poco = un guiño de vez en cuando. */
  visible?: number;
  /** Segundos que dura un ciclo. */
  periodo?: [number, number];
}

export class Destellos {
  readonly grupo = new THREE.Group();
  /** Semiejes de la caja donde aparecen (en el espacio del grupo). */
  readonly caja = new THREE.Vector3(0.05, 0.05, 0.01);
  /** Hacia dónde va la intensidad (0 apagado, 1 normal, más = más grandes). */
  meta = 1;
  private intensidad = 0;
  private readonly chispas: Chispa[] = [];
  private t = Math.random() * 10;

  constructor(private readonly o: OpcionesDestellos) {
    this.grupo.name = 'destellos';
    const color = new THREE.Color(o.color ?? 0xffe2a8).multiplyScalar(o.brillo ?? 2.2);
    const [pMin, pMax] = o.periodo ?? [2.5, 5];
    for (let i = 0; i < o.cantidad; i++) {
      const mat = new THREE.SpriteMaterial({
        map: estrella(),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 5;
      this.grupo.add(sprite);
      const ch: Chispa = { sprite, mat, fase: Math.random(), periodo: pMin + Math.random() * (pMax - pMin), base: new THREE.Vector3(), tam: o.tam * (0.6 + Math.random() * 0.7) };
      this.reubicar(ch);
      this.chispas.push(ch);
    }
    this.grupo.visible = false;
  }

  private reubicar(ch: Chispa) {
    ch.base.set((Math.random() * 2 - 1) * this.caja.x, (Math.random() * 2 - 1) * this.caja.y, (Math.random() * 2 - 1) * this.caja.z);
    ch.tam = this.o.tam * (0.6 + Math.random() * 0.7);
  }

  /** Coloca los brillitos alrededor de una caja del mundo (por ejemplo, un libro). */
  rodear(caja: THREE.Box3, margen = 0.02) {
    const centro = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());
    // Un poco separados de la superficie: miran a la cámara y si no se meten en la madera
    this.grupo.position.set(centro.x, centro.y, caja.max.z + 0.035);
    this.caja.set(tam.x / 2 + margen, tam.y / 2 + margen * 0.5, 0.015);
    this.chispas.forEach((ch) => this.reubicar(ch));
  }

  tick(dt: number) {
    this.t += dt;
    this.intensidad += (this.meta - this.intensidad) * (1 - Math.exp(-dt * 4));
    const visible = this.intensidad > 0.01;
    this.grupo.visible = visible;
    if (!visible) return;
    const ventana = this.o.visible ?? 0.35;
    const sube = this.o.sube ?? 0;
    for (const ch of this.chispas) {
      const ciclo = (this.t / ch.periodo + ch.fase) % 1;
      const anterior = ch.sprite.userData.ciclo ?? ciclo;
      if (ciclo < anterior) this.reubicar(ch); // vuelve a nacer en otro lugar
      ch.sprite.userData.ciclo = ciclo;
      const p = ciclo / ventana;
      const titila = p < 1 ? Math.pow(Math.sin(p * Math.PI), 2) : 0;
      ch.sprite.position.set(ch.base.x, ch.base.y + p * sube, ch.base.z);
      const s = ch.tam * (0.35 + 0.65 * titila) * (0.8 + 0.2 * Math.min(this.intensidad, 1.6));
      ch.sprite.scale.set(s, s, 1);
      ch.mat.opacity = Math.min(1, titila * this.intensidad);
      ch.sprite.material.rotation = this.t * 0.6 + ch.fase * 6;
    }
  }
}
