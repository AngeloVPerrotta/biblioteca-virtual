/**
 * Clima real de Buenos Aires (Open-Meteo, sin clave) y los efectos de lluvia:
 * gotas cayendo afuera, vidrio mojado y relámpagos cuando hay tormenta.
 */
import * as THREE from 'three';
import { limitar, rng } from '../util/aleatorio';
import type { Ventana } from './habitacion';
import { aTextura, lienzo } from './texturas';

export type TipoClima = 'despejado' | 'nublado' | 'niebla' | 'llovizna' | 'lluvia' | 'tormenta';

export interface EstadoClima {
  tipo: TipoClima;
  /** 0..1 */
  nubes: number;
  /** 0..1 (1 = torrencial) */
  lluvia: number;
  tormenta: boolean;
  descripcion: string;
}

export const DESPEJADO: EstadoClima = { tipo: 'despejado', nubes: 0, lluvia: 0, tormenta: false, descripcion: 'Despejado' };

const PRUEBAS: Record<string, EstadoClima> = {
  despejado: DESPEJADO,
  nublado: { tipo: 'nublado', nubes: 0.9, lluvia: 0, tormenta: false, descripcion: 'Nublado' },
  niebla: { tipo: 'niebla', nubes: 0.8, lluvia: 0, tormenta: false, descripcion: 'Neblina' },
  llovizna: { tipo: 'llovizna', nubes: 0.85, lluvia: 0.25, tormenta: false, descripcion: 'Llovizna' },
  lluvia: { tipo: 'lluvia', nubes: 1, lluvia: 0.65, tormenta: false, descripcion: 'Lluvia' },
  torrencial: { tipo: 'lluvia', nubes: 1, lluvia: 1, tormenta: false, descripcion: 'Lluvia fuerte' },
  tormenta: { tipo: 'tormenta', nubes: 1, lluvia: 0.95, tormenta: true, descripcion: 'Tormenta' },
};

export function climaDePrueba(nombre: string | null): EstadoClima | null {
  return nombre ? (PRUEBAS[nombre] ?? null) : null;
}

/** Traduce el código WMO de Open-Meteo a algo que la escena entiende. */
function interpretar(codigo: number, precipitacion: number, nubosidad: number): EstadoClima {
  const nubes = limitar(nubosidad / 100, 0, 1);
  const porLluvia = (base: number) => limitar(Math.max(base, precipitacion / 8), 0.2, 1);
  if ([95, 96, 99].includes(codigo)) return { tipo: 'tormenta', nubes: 1, lluvia: porLluvia(0.85), tormenta: true, descripcion: 'Tormenta' };
  if ([65, 67, 82].includes(codigo)) return { tipo: 'lluvia', nubes: 1, lluvia: porLluvia(1), tormenta: false, descripcion: 'Lluvia fuerte' };
  if ([63, 66, 81].includes(codigo)) return { tipo: 'lluvia', nubes: 1, lluvia: porLluvia(0.7), tormenta: false, descripcion: 'Lluvia' };
  if ([61, 80].includes(codigo)) return { tipo: 'lluvia', nubes: 0.95, lluvia: porLluvia(0.45), tormenta: false, descripcion: 'Lluvia débil' };
  if (codigo >= 51 && codigo <= 57) return { tipo: 'llovizna', nubes: 0.9, lluvia: 0.22, tormenta: false, descripcion: 'Llovizna' };
  if ([45, 48].includes(codigo)) return { tipo: 'niebla', nubes: 0.85, lluvia: 0, tormenta: false, descripcion: 'Neblina' };
  if (codigo === 3 || (codigo >= 71 && codigo <= 86)) return { tipo: 'nublado', nubes: Math.max(0.85, nubes), lluvia: 0, tormenta: false, descripcion: 'Nublado' };
  if (codigo === 2) return { tipo: 'nublado', nubes: Math.max(0.45, nubes * 0.8), lluvia: 0, tormenta: false, descripcion: 'Algo nublado' };
  return { tipo: 'despejado', nubes: nubes * 0.3, lluvia: 0, tormenta: false, descripcion: 'Despejado' };
}

export async function obtenerClima(): Promise<EstadoClima | null> {
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=-34.61&longitude=-58.38&current=weather_code,precipitation,cloud_cover&timezone=America%2FArgentina%2FBuenos_Aires';
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as { current?: { weather_code: number; precipitation: number; cloud_cover: number } };
    if (!d.current) return null;
    return interpretar(d.current.weather_code, d.current.precipitation ?? 0, d.current.cloud_cover ?? 0);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ efectos */

function texturaGotas(semilla: number, cantidad: number, conEstela: boolean) {
  const S = 512;
  const { c, ctx } = lienzo(S, S);
  const r = rng(semilla);
  for (let i = 0; i < cantidad; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 1.5 + r() * (conEstela ? 3 : 4.5);
    if (conEstela) {
      const largo = 20 + r() * 80;
      const g = ctx.createLinearGradient(x, y - largo, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.35)');
      ctx.strokeStyle = g;
      ctx.lineWidth = rad * 0.7;
      ctx.beginPath();
      ctx.moveTo(x + (r() - 0.5) * 3, y - largo);
      ctx.quadraticCurveTo(x + (r() - 0.5) * 6, y - largo / 2, x, y);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(210,225,240,0.45)');
    g.addColorStop(1, 'rgba(120,140,170,0.1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export class LluviaVisual {
  readonly grupo = new THREE.Group();
  private readonly gotas: THREE.LineSegments;
  private readonly velocidades: Float32Array;
  private readonly vidrio: THREE.MeshBasicMaterial;
  private readonly estelas: THREE.MeshBasicMaterial;
  private intensidad = 0;
  private readonly caja = { x0: -6, x1: 1.5, y0: -1.5, y1: 4.5, z0: -5.5, z1: -0.4 };

  constructor(ventana: Ventana, cantidad: number) {
    const r = rng(251);
    const pos = new Float32Array(cantidad * 6);
    this.velocidades = new Float32Array(cantidad);
    const k = this.caja;
    for (let i = 0; i < cantidad; i++) {
      const x = k.x0 + r() * (k.x1 - k.x0);
      const y = k.y0 + r() * (k.y1 - k.y0);
      const z = k.z0 + r() * (k.z1 - k.z0);
      pos.set([x, y, z, x - 0.02, y - 0.22, z], i * 6);
      this.velocidades[i] = 7 + r() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.gotas = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xc8d4e6, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.gotas.frustumCulled = false;

    const w = ventana.x1 - ventana.x0;
    const h = ventana.y1 - ventana.y0;
    const plano = new THREE.PlaneGeometry(w, h);
    this.vidrio = new THREE.MeshBasicMaterial({ map: aTextura(texturaGotas(261, 260, false), { repetir: [w * 1.6, h * 1.6] }), transparent: true, opacity: 0, depthWrite: false, color: 0xdfe7f2 });
    this.estelas = new THREE.MeshBasicMaterial({ map: aTextura(texturaGotas(271, 70, true), { repetir: [w * 1.2, h * 1.2] }), transparent: true, opacity: 0, depthWrite: false, color: 0xdfe7f2 });
    const cx = (ventana.x0 + ventana.x1) / 2;
    const cy = (ventana.y0 + ventana.y1) / 2;
    const gotasVidrio = new THREE.Mesh(plano, this.vidrio);
    gotasVidrio.position.set(cx, cy, -0.068);
    const estelasVidrio = new THREE.Mesh(plano, this.estelas);
    estelasVidrio.position.set(cx, cy, -0.066);
    this.grupo.add(this.gotas, gotasVidrio, estelasVidrio);
    this.grupo.visible = false;
  }

  /** intensidad 0..1; brillo según la luz de afuera (de noche las gotas se ven menos). */
  actualizar(dt: number, intensidad: number, brillo: number) {
    this.intensidad += (intensidad - this.intensidad) * Math.min(1, dt * 1.5);
    const v = this.intensidad;
    this.grupo.visible = v > 0.01;
    if (!this.grupo.visible) return;
    (this.gotas.material as THREE.LineBasicMaterial).opacity = 0.25 + v * 0.55 * brillo;
    this.vidrio.opacity = Math.min(1, v * 0.9 * brillo + 0.1);
    this.estelas.opacity = Math.min(1, v * 0.8 * brillo + 0.1);
    this.estelas.map!.offset.y += dt * 0.06 * (0.5 + v);
    const pos = this.gotas.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const k = this.caja;
    const visibles = Math.floor((arr.length / 6) * (0.25 + v * 0.75));
    for (let i = 0; i < arr.length / 6; i++) {
      const o = i * 6;
      if (i >= visibles) {
        arr[o + 1] = arr[o + 4] = -10;
        continue;
      }
      const d = this.velocidades[i] * dt * (0.8 + v * 0.4);
      arr[o + 1] -= d;
      arr[o + 4] -= d;
      arr[o] -= d * 0.08;
      arr[o + 3] -= d * 0.08;
      if (arr[o + 1] < k.y0) {
        const alto = k.y1 - (k.y0 - arr[o + 1]) % 0.5;
        arr[o + 1] = alto;
        arr[o + 4] = alto - 0.22;
        if (arr[o] < k.x0) {
          arr[o] += k.x1 - k.x0;
          arr[o + 3] += k.x1 - k.x0;
        }
      }
    }
    pos.needsUpdate = true;
  }
}
