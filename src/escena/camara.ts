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
  /** Vista alternativa (por ejemplo, mirando el cajón de discos) y cuánto se mezcla con la base. */
  vista: { pos: THREE.Vector3; mira: THREE.Vector3; fov: number } | null = null;
  mezclaVista = 0;
  vertical = false;
  private giroscopioBase: { beta: number; gamma: number } | null = null;

  encuadrar(aspecto: number, anchoEstante: number) {
    this.vertical = aspecto < 0.9;
    const fov = this.vertical ? 50 : 36;
    const tan = Math.tan((fov / 2) * RAD);
    if (this.vertical) {
      const mira = new THREE.Vector3(0, 1.0, 0.2);
      const d = Math.min(Math.max(1.2 / tan, (anchoEstante / 2 + 0.3) / (tan * aspecto)), 4.6);
      this.base.pos.set(0, 1.45, mira.z + d);
      this.base.mira.copy(mira);
    } else {
      // En compu: que entre de la planta (arriba de la biblioteca) hasta buena parte de la alfombra,
      // y el ancho de la habitación. En pantallas anchas la cámara se aleja un poco para que el piso no quede cortado.
      const altura = 1.56;
      const arriba = { y: 2.32, z: 0.05 };
      const abajo = { y: 0, z: 1.62 };
      const angulos = (z: number) => ({
        arriba: Math.atan2(arriba.y - altura, z - arriba.z),
        abajo: Math.atan2(altura - abajo.y, z - abajo.z),
      });
      let z = 3.2;
      while (z < 5 && angulos(z).arriba + angulos(z).abajo > fov * RAD) z += 0.02;
      z = Math.min(Math.max(z, 0.2 + 2.3 / (tan * aspecto)), 5);
      // Mirar al medio de ese rango
      const a = angulos(z);
      const inclinacion = (a.arriba - a.abajo) / 2;
      this.base.pos.set(0, altura, z);
      this.base.mira.set(0, altura + Math.tan(inclinacion) * (z - 0.2), 0.2);
    }
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
    const m = this.mezclaVista;
    const libertad = (1 - this.zoom * 0.7) * (1 - m * 0.7);
    const i = this.intro;
    const pos = new THREE.Vector3(
      this.base.pos.x + this.actual.x * 0.08 * libertad - i * 0.35,
      this.base.pos.y + this.actual.y * 0.04 * libertad + i * 0.3,
      this.base.pos.z - this.zoom * 0.12 - i * 1.4,
    );
    const mira = new THREE.Vector3(this.base.mira.x + this.actual.x * 0.02, this.base.mira.y + this.actual.y * 0.012 + i * 0.2, this.base.mira.z);
    let fov = this.base.fov - this.zoom * 3 - i * 6;
    if (this.vista && m > 0) {
      pos.lerp(this.vista.pos.clone().add(new THREE.Vector3(this.actual.x * 0.02, this.actual.y * 0.012, 0)), m);
      mira.lerp(this.vista.mira, m);
      fov += (this.vista.fov - fov) * m;
    }
    this.cam.position.copy(pos);
    this.cam.lookAt(mira);
    this.cam.rotateZ(i * 0.18);
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
