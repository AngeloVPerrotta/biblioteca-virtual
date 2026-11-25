/**
 * Cámara fija en primera persona, parado frente a la biblioteca.
 * Se mueve apenas con el mouse o inclinando el celular (parallax).
 */
import * as THREE from 'three';
import { limitar } from '../util/aleatorio';

const RAD = Math.PI / 180;

export class Camara {
  readonly cam = new THREE.PerspectiveCamera(36, 1, 0.03, 40);
  readonly base = { pos: new THREE.Vector3(0, 1.55, 4), mira: new THREE.Vector3(0, 1.05, 0.2), fov: 36 };
  private readonly objetivo = new THREE.Vector2();
  private readonly actual = new THREE.Vector2();
  /** 0..1, acercamiento leve cuando se mira un objeto. */
  zoom = 0;
  /** 1..0, entrada a la habitación después de la pantalla de carga. */
  intro = 0;
  vertical = false;
  private giroscopioBase: { beta: number; gamma: number } | null = null;

  encuadrar(aspecto: number, anchoEstante: number) {
    this.vertical = aspecto < 0.9;
    const fov = this.vertical ? 50 : 36;
    const mira = new THREE.Vector3(0, this.vertical ? 1.0 : 1.06, 0.2);
    const medioAlto = this.vertical ? 1.2 : 1.12;
    const medioAncho = this.vertical ? anchoEstante / 2 + 0.3 : 2.3;
    const tan = Math.tan((fov / 2) * RAD);
    const d = Math.min(Math.max(medioAlto / tan, medioAncho / (tan * aspecto)), 4.6);
    this.base.pos.set(0, this.vertical ? 1.45 : 1.56, mira.z + d);
    this.base.mira.copy(mira);
    this.base.fov = fov;
    this.cam.aspect = aspecto;
    this.cam.fov = fov;
    this.cam.updateProjectionMatrix();
    this.aplicar();
  }

  /** Posición del puntero normalizada (-1..1). */
  setPuntero(x: number, y: number) {
    this.objetivo.set(limitar(x, -1, 1), limitar(y, -1, 1));
  }

  escucharGiroscopio() {
    const manejar = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (!this.giroscopioBase) this.giroscopioBase = { beta: e.beta, gamma: e.gamma };
      this.setPuntero((e.gamma - this.giroscopioBase.gamma) / 18, -(e.beta - this.giroscopioBase.beta) / 18);
    };
    const pedir = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof pedir === 'function') {
      pedir()
        .then((r) => r === 'granted' && window.addEventListener('deviceorientation', manejar))
        .catch(() => undefined);
    } else {
      window.addEventListener('deviceorientation', manejar);
    }
  }

  private aplicar() {
    const libertad = 1 - this.zoom * 0.7;
    const i = this.intro;
    this.cam.position.set(
      this.base.pos.x + this.actual.x * 0.08 * libertad - i * 0.35,
      this.base.pos.y + this.actual.y * 0.04 * libertad + i * 0.3,
      this.base.pos.z - this.zoom * 0.12 - i * 1.4,
    );
    this.cam.lookAt(this.base.mira.x + this.actual.x * 0.02, this.base.mira.y + this.actual.y * 0.012 + i * 0.2, this.base.mira.z);
    this.cam.rotateZ(i * 0.18);
    const fov = this.base.fov - this.zoom * 3 - i * 6;
    if (Math.abs(this.cam.fov - fov) > 1e-4) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
  }

  tick(dt: number) {
    const k = 1 - Math.exp(-dt * 3);
    this.actual.lerp(this.objetivo, k);
    this.aplicar();
  }

  /** Ejes de la cámara en reposo (sin parallax), para ubicar objetos frente a ella. */
  ejes() {
    const pos = this.base.pos.clone();
    pos.z -= 0.12;
    const adelante = this.base.mira.clone().sub(this.base.pos).normalize();
    const derecha = new THREE.Vector3().crossVectors(adelante, new THREE.Vector3(0, 1, 0)).normalize();
    const arriba = new THREE.Vector3().crossVectors(derecha, adelante).normalize();
    return { pos, adelante, derecha, arriba };
  }
}
