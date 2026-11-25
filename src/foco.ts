/**
 * Foco: el libro sale del estante y viene hacia la cámara, girando para mostrar la tapa.
 * La habitación se oscurece un poco y aparece una luz de lectura. Se puede girar arrastrando.
 */
import * as THREE from 'three';
import { limitar } from './util/aleatorio';
import { salidaSuave, suave, type Animador } from './util/animacion';
import type { Ambiente } from './escena/ambiente';
import type { Camara } from './escena/camara';
import type { LibroVisual } from './escena/libros';
import type { Postproceso } from './escena/postproceso';

interface Origen {
  padre: THREE.Object3D;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  visible: boolean;
  /** Para préstamos: el libro aparece desde la nota. */
  desde: THREE.Vector3 | null;
}

export class Foco {
  activo: LibroVisual | null = null;
  private origen: Origen | null = null;
  private ocupado = false;
  private flotando = false;
  private destino = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private giro = new THREE.Vector2();
  private giroObjetivo = new THREE.Vector2();
  private t = 0;

  constructor(
    private escena: THREE.Scene,
    private camara: Camara,
    private animador: Animador,
    private ambiente: Ambiente,
    private post: Postproceso,
  ) {}

  get enUso() {
    return this.activo !== null || this.ocupado;
  }

  private calcularDestino() {
    const { pos, adelante, derecha, arriba } = this.camara.ejes();
    const vertical = this.camara.vertical;
    const p = pos
      .clone()
      .addScaledVector(adelante, vertical ? 1.05 : 0.82)
      .addScaledVector(derecha, vertical ? 0 : -0.12)
      .addScaledVector(arriba, vertical ? 0.1 : 0.0);
    const x = adelante.clone().negate();
    const y = arriba.clone();
    const z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.32));
    this.destino.pos.copy(p);
    this.destino.quat.copy(q);
    const luz = p.clone().addScaledVector(x, 0.5).addScaledVector(arriba, 0.3).addScaledVector(derecha, 0.25);
    return luz;
  }

  async abrir(lv: LibroVisual, desde: THREE.Object3D | null = null) {
    if (this.ocupado || this.activo === lv) return;
    if (this.activo) await this.cerrar();
    this.ocupado = true;
    const m = lv.mesh;
    lv.asegurarTapas();
    lv.resaltar(0);
    this.origen = {
      padre: m.parent!,
      pos: m.position.clone(),
      quat: m.quaternion.clone(),
      visible: m.visible,
      desde: desde ? desde.getWorldPosition(new THREE.Vector3()) : null,
    };
    this.escena.attach(m);
    if (!m.visible) {
      m.visible = true;
      m.position.copy(this.origen.desde ?? m.position);
      m.scale.setScalar(0.05);
    }
    const luz = this.calcularDestino();
    const p0 = m.position.clone();
    const salida = p0.clone().add(new THREE.Vector3(0, 0.008, 0.16));
    if (this.origen.visible) {
      await this.animador.animar(300, (k) => m.position.lerpVectors(p0, salida, k), { curva: suave });
    }
    const p1 = m.position.clone();
    const q1 = m.quaternion.clone();
    const s1 = m.scale.x;
    await this.animador.animar(
      950,
      (k) => {
        m.position.lerpVectors(p1, this.destino.pos, k);
        m.position.y += Math.sin(Math.PI * k) * 0.05;
        m.quaternion.slerpQuaternions(q1, this.destino.quat, k);
        m.scale.setScalar(s1 + (1 - s1) * k);
        this.ambiente.setFoco(k, luz);
        this.post.oscurecer = k;
        this.camara.zoom = k;
      },
      { curva: salidaSuave },
    );
    this.giro.set(0, 0);
    this.giroObjetivo.set(0, 0);
    this.activo = lv;
    this.flotando = true;
    this.ocupado = false;
  }

  async cerrar() {
    if (!this.activo || !this.origen || this.ocupado) return;
    this.ocupado = true;
    this.flotando = false;
    const lv = this.activo;
    const m = lv.mesh;
    const o = this.origen;
    const destinoPos = o.padre.localToWorld(o.pos.clone());
    const destinoQuat = o.padre.getWorldQuaternion(new THREE.Quaternion()).multiply(o.quat);
    const p0 = m.position.clone();
    const q0 = m.quaternion.clone();
    const antesDeEntrar = o.visible ? destinoPos.clone().add(new THREE.Vector3(0, 0.008, 0.16)) : (o.desde ?? destinoPos);
    await this.animador.animar(
      850,
      (k) => {
        m.position.lerpVectors(p0, antesDeEntrar, k);
        m.position.y += Math.sin(Math.PI * k) * 0.04;
        m.quaternion.slerpQuaternions(q0, destinoQuat, k);
        if (!o.visible) m.scale.setScalar(1 - 0.95 * k);
        this.ambiente.setFoco(1 - k);
        this.post.oscurecer = 1 - k;
        this.camara.zoom = 1 - k;
      },
      { curva: suave },
    );
    if (o.visible) {
      await this.animador.animar(280, (k) => m.position.lerpVectors(antesDeEntrar, destinoPos, k), { curva: suave });
    }
    o.padre.attach(m);
    m.position.copy(o.pos);
    m.quaternion.copy(o.quat);
    m.scale.setScalar(1);
    m.visible = o.visible;
    this.activo = null;
    this.origen = null;
    this.ocupado = false;
  }

  arrastrar(dx: number, dy: number) {
    if (!this.flotando) return;
    this.giroObjetivo.x += dx * 0.012;
    this.giroObjetivo.y = limitar(this.giroObjetivo.y + dy * 0.008, -0.7, 0.7);
  }

  tick(dt: number) {
    this.t += dt;
    if (!this.flotando || !this.activo) return;
    const m = this.activo.mesh;
    const k = 1 - Math.exp(-dt * 8);
    this.giro.lerp(this.giroObjetivo, k);
    m.position.copy(this.destino.pos);
    m.position.y += Math.sin(this.t * 1.3) * 0.004;
    m.quaternion
      .copy(this.destino.quat)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(this.camara.ejes().derecha, this.giro.y))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.giro.x));
  }
}
