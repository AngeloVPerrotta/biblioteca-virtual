/**
 * Puntero y toques: señalar (brillo + etiqueta), elegir, y arrastrar para girar un libro.
 * En el celu el primer toque muestra la etiqueta y el segundo abre el objeto.
 */
import * as THREE from 'three';
import type { Camara } from './escena/camara';
import { buscarInteractivo, type Interactivo } from './escena/interactivos';

interface Callbacks {
  alSeleccionar: (i: Interactivo, objeto: THREE.Object3D) => void;
  alSenalar: (i: Interactivo | null, pantalla: { x: number; y: number } | null, tactil: boolean) => void;
  alTocarVacio: () => void;
  alArrastrar: (dx: number, dy: number) => void;
}

export class Interaccion {
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private actual: Interactivo | null = null;
  private actualObjeto: THREE.Object3D | null = null;
  private readonly brillo = new Map<Interactivo, number>();
  private pendiente = false;
  private ultimo = { x: 0, y: 0 };
  private presion: { x: number; y: number; t: number; tipo: string; arrastrando: boolean } | null = null;
  /** Modo foco: los gestos giran el objeto en vez de señalar. */
  modoFoco = false;
  bloqueado = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private camara: Camara,
    private objetivos: () => THREE.Object3D[],
    private cb: Callbacks,
  ) {
    canvas.addEventListener('pointermove', (e) => this.mover(e));
    canvas.addEventListener('pointerdown', (e) => this.bajar(e));
    canvas.addEventListener('pointerup', (e) => this.subir(e));
    canvas.addEventListener('pointerleave', () => {
      if (!this.modoFoco) this.senalar(null, null, false);
    });
  }

  private aNdc(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private intersectar(): { i: Interactivo; o: THREE.Object3D } | null {
    this.ray.setFromCamera(this.ndc, this.camara.cam);
    const hits = this.ray.intersectObjects(this.objetivos(), true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      const i = buscarInteractivo(h.object);
      if (i) {
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.interactivo !== i) o = o.parent;
        return { i, o: o ?? h.object };
      }
    }
    return null;
  }

  private mover(e: PointerEvent) {
    this.ultimo = { x: e.clientX, y: e.clientY };
    const r = this.canvas.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      this.camara.setPuntero(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    }
    if (this.presion) {
      const dx = e.clientX - this.presion.x;
      const dy = e.clientY - this.presion.y;
      if (this.modoFoco && (this.presion.arrastrando || Math.hypot(dx, dy) > 6)) {
        this.presion.arrastrando = true;
        this.cb.alArrastrar(e.movementX || 0, e.movementY || 0);
        return;
      }
    }
    if (this.modoFoco || this.bloqueado || e.pointerType !== 'mouse') return;
    if (!this.pendiente) {
      this.pendiente = true;
      requestAnimationFrame(() => {
        this.pendiente = false;
        this.aNdc(this.ultimo.x, this.ultimo.y);
        const hit = this.intersectar();
        this.senalar(hit?.i ?? null, hit?.o ?? null, false);
      });
    }
  }

  private bajar(e: PointerEvent) {
    this.presion = { x: e.clientX, y: e.clientY, t: performance.now(), tipo: e.pointerType, arrastrando: false };
    if (this.modoFoco) this.canvas.setPointerCapture(e.pointerId);
  }

  private subir(e: PointerEvent) {
    const p = this.presion;
    this.presion = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (!p || p.arrastrando) return;
    const movido = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (movido > 10 || performance.now() - p.t > 600) return;
    if (this.modoFoco) {
      this.cb.alTocarVacio();
      return;
    }
    if (this.bloqueado) return;
    this.aNdc(e.clientX, e.clientY);
    const hit = this.intersectar();
    const tactil = e.pointerType !== 'mouse';
    if (!hit) {
      this.senalar(null, null, tactil);
      this.cb.alTocarVacio();
      return;
    }
    if (tactil && this.actual !== hit.i) {
      this.senalar(hit.i, hit.o, true);
      return;
    }
    this.senalar(null, null, tactil);
    this.cb.alSeleccionar(hit.i, hit.o);
  }

  private senalar(i: Interactivo | null, o: THREE.Object3D | null, tactil: boolean) {
    if (i === this.actual) {
      if (i && !tactil) this.cb.alSenalar(i, this.ultimo, false);
      return;
    }
    this.actual = i;
    this.actualObjeto = o;
    this.canvas.style.cursor = i ? 'pointer' : '';
    if (!i) {
      this.cb.alSenalar(null, null, tactil);
      return;
    }
    this.cb.alSenalar(i, tactil ? this.proyectar(o!) : this.ultimo, tactil);
  }

  /** Posición en pantalla, justo arriba del objeto. */
  private proyectar(o: THREE.Object3D) {
    const caja = new THREE.Box3().setFromObject(o);
    const p = new THREE.Vector3((caja.min.x + caja.max.x) / 2, caja.max.y, (caja.min.z + caja.max.z) / 2).project(this.camara.cam);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  limpiar() {
    this.senalar(null, null, false);
  }

  /** Anima el brillo de lo señalado. */
  tick(dt: number) {
    const k = 1 - Math.exp(-dt * 12);
    if (this.actual && !this.brillo.has(this.actual)) this.brillo.set(this.actual, 0);
    for (const [i, v] of this.brillo) {
      const meta = i === this.actual ? 1 : 0;
      const nuevo = v + (meta - v) * k;
      if (Math.abs(nuevo - meta) < 0.002 && meta === 0) {
        i.resaltar(0);
        this.brillo.delete(i);
      } else {
        i.resaltar(nuevo);
        this.brillo.set(i, nuevo);
      }
    }
  }

  /** Objeto señalado actualmente (para reposicionar la etiqueta táctil). */
  get objetoSenalado() {
    return this.actualObjeto;
  }
}
