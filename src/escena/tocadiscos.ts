/**
 * El tocadiscos en acción: al elegir un disco, el vinilo sube, cambia la etiqueta
 * por la tapa del disco, baja, el brazo se apoya y el plato gira a 33⅓.
 */
import * as THREE from 'three';
import { salidaSuave, suave, type Animador } from '../util/animacion';
import { aTextura, lienzo } from './texturas';

export interface Disco {
  id: string;
  nombre: string;
  artista: string;
  anio: string;
  tipo: string;
  portada: string | null;
  portadaChica: string | null;
  url: string;
  temas: string[];
  puntos: number;
  genero?: string;
}

export interface DatosDiscos {
  actualizado: string;
  periodo: string;
  discos: Disco[];
}

const RPM_33 = (33.333 / 60) * Math.PI * 2;
const BRAZO_REPOSO = 0;
const BRAZO_TOCANDO = -0.36;

function cargarImagen(url: string) {
  return new Promise<HTMLImageElement | null>((resolver) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = url;
  });
}

/** Vinilo con surcos y la tapa del disco como etiqueta. */
function texturaViniloConTapa(img: HTMLImageElement | null) {
  const S = 1024;
  const { c, ctx } = lienzo(S, S);
  const centro = S / 2;
  ctx.fillStyle = '#0c0c0d';
  ctx.beginPath();
  ctx.arc(centro, centro, centro, 0, Math.PI * 2);
  ctx.fill();
  for (let r = S * 0.17; r < S * 0.495; r += 1.4) {
    const pista = Math.sin(r * 0.045) > 0.97;
    ctx.strokeStyle = pista ? 'rgba(0,0,0,0.9)' : `rgba(${60 + (r % 7) * 3},${60 + (r % 7) * 3},${66 + (r % 7) * 3},0.45)`;
    ctx.lineWidth = pista ? 2.5 : 0.7;
    ctx.beginPath();
    ctx.arc(centro, centro, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const radioEtiqueta = S * 0.165;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centro, centro, radioEtiqueta, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, centro - radioEtiqueta, centro - radioEtiqueta, radioEtiqueta * 2, radioEtiqueta * 2);
  } else {
    ctx.fillStyle = '#c0533a';
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#0c0c0d';
  ctx.beginPath();
  ctx.arc(centro, centro, S * 0.012, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export class Tocadiscos {
  sonando: { disco: Disco; textura: THREE.Texture } | null = null;
  private velocidad = 0;
  private velocidadObjetivo = 0;
  private ocupado = false;

  constructor(
    private partes: { giratorio: THREE.Group; brazo: THREE.Group; vinilo: THREE.MeshPhysicalMaterial },
    private animador: Animador,
  ) {}

  private moverBrazo(destino: number, ms: number) {
    const desde = this.partes.brazo.rotation.y;
    return this.animador.animar(ms, (k) => (this.partes.brazo.rotation.y = desde + (destino - desde) * k), { curva: suave, clave: 'brazo' });
  }

  async poner(disco: Disco) {
    if (this.ocupado) return;
    this.ocupado = true;
    const img = disco.portadaChica ? await cargarImagen(disco.portadaChica) : null;
    if (this.sonando) {
      this.velocidadObjetivo = 0;
      await this.moverBrazo(BRAZO_REPOSO, 500);
    }
    // El disco sube, cambia y vuelve a bajar
    const disc = this.partes.giratorio.children.find((o) => (o as THREE.Mesh).material === this.partes.vinilo)!;
    const y0 = disc.position.y;
    await this.animador.animar(380, (k) => (disc.position.y = y0 + k * 0.06), { curva: salidaSuave });
    const textura = aTextura(texturaViniloConTapa(img));
    const anterior = this.partes.vinilo.map;
    this.partes.vinilo.map = textura;
    this.partes.vinilo.needsUpdate = true;
    if (this.sonando) this.sonando.textura.dispose();
    else anterior?.dispose();
    await this.animador.animar(420, (k) => (disc.position.y = y0 + (1 - k) * 0.06), { curva: suave });
    disc.position.y = y0;
    this.velocidadObjetivo = RPM_33;
    await this.moverBrazo(BRAZO_TOCANDO, 900);
    this.sonando = { disco, textura };
    this.ocupado = false;
  }

  async detener() {
    if (!this.sonando || this.ocupado) return;
    this.ocupado = true;
    await this.moverBrazo(BRAZO_REPOSO, 700);
    this.velocidadObjetivo = 0;
    this.ocupado = false;
  }

  tick(dt: number) {
    this.velocidad += (this.velocidadObjetivo - this.velocidad) * Math.min(1, dt * 1.6);
    this.partes.giratorio.rotation.y -= this.velocidad * dt;
  }
}
