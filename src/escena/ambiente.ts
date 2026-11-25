/**
 * Iluminación según la hora real de Buenos Aires.
 * Se calcula la altura del sol y se interpolan "climas" pensados para que
 * la escena siempre se vea cálida y tranquila (nunca luz fría ni plana).
 */
import * as THREE from 'three';
import { limitar } from '../util/aleatorio';
import { DESPEJADO, type EstadoClima } from './clima';
import type { Habitacion } from './habitacion';
import { texturaVentanaSol } from './texturas';

const LAT = -34.6;
const LON = -58.38;
const RAD = Math.PI / 180;

/** Altura del sol en grados y si es de mañana (aproximación NOAA). */
export function posicionSolar(fecha: Date) {
  const inicio = Date.UTC(fecha.getUTCFullYear(), 0, 0);
  const dia = (fecha.getTime() - inicio) / 86400000;
  const horaUTC = fecha.getUTCHours() + fecha.getUTCMinutes() / 60 + fecha.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (Math.floor(dia) - 1 + (horaUTC - 12) / 24);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ecuacion =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const tiempoSolar = horaUTC * 60 + ecuacion + 4 * LON;
  const anguloHorario = (tiempoSolar / 4 - 180) * RAD;
  const cosZenit = Math.sin(LAT * RAD) * Math.sin(decl) + Math.cos(LAT * RAD) * Math.cos(decl) * Math.cos(anguloHorario);
  const elevacion = 90 - Math.acos(limitar(cosZenit, -1, 1)) / RAD;
  return { elevacion, manana: anguloHorario < 0 };
}

/** Hora actual en Buenos Aires (UTC-3, sin horario de verano). */
export function horaBuenosAires(fecha = new Date()) {
  const ba = new Date(fecha.getTime() - 3 * 3600000);
  return ba.getUTCHours() + ba.getUTCMinutes() / 60;
}

/** Fecha de hoy a una hora dada de Buenos Aires (para "probar otra hora"). */
export function fechaConHora(hora: number) {
  const ahora = new Date();
  const ba = new Date(ahora.getTime() - 3 * 3600000);
  const base = Date.UTC(ba.getUTCFullYear(), ba.getUTCMonth(), ba.getUTCDate());
  return new Date(base + (hora + 3) * 3600000);
}

interface Clima {
  elev: number;
  nombre: string;
  nombreManana: string;
  arriba: string;
  horizonte: string;
  solColor: string;
  sol: number;
  lampara: number;
  ventanaColor: string;
  ventana: number;
  hemiCielo: string;
  hemiSuelo: string;
  hemi: number;
  /** Rebote cálido general (luz de "la casa"), mantiene legibles los libros de noche. */
  relleno: number;
  /** Reflejos del entorno. */
  entorno: number;
  ciudad: string;
  luces: number;
  estrellas: number;
  exposicion: number;
  cortina: number;
  jacaranda: string;
}

const CLIMAS: Clima[] = [
  { elev: -18, nombre: 'Noche', nombreManana: 'Madrugada', arriba: '#0d1131', horizonte: '#3b2e62', solColor: '#ffb070', sol: 0, lampara: 1, ventanaColor: '#6d73c6', ventana: 0.7, hemiCielo: '#ffc890', hemiSuelo: '#1c130c', hemi: 0.06, relleno: 1, entorno: 0.02, ciudad: '#15131f', luces: 1, estrellas: 1, exposicion: 1.25, cortina: 0.05, jacaranda: '#2a2340' },
  { elev: -8, nombre: 'Hora azul', nombreManana: 'Alba', arriba: '#242b6e', horizonte: '#b06e9e', solColor: '#ff9a6a', sol: 0, lampara: 1, ventanaColor: '#8f86d8', ventana: 1.4, hemiCielo: '#ffd0a8', hemiSuelo: '#22170f', hemi: 0.1, relleno: 0.85, entorno: 0.04, ciudad: '#221d3a', luces: 0.85, estrellas: 0.45, exposicion: 1.2, cortina: 0.1, jacaranda: '#3d3260' },
  { elev: -2, nombre: 'Atardecer', nombreManana: 'Amanecer', arriba: '#4d4d96', horizonte: '#f49b78', solColor: '#ff8a50', sol: 0.7, lampara: 0.9, ventanaColor: '#f4a98c', ventana: 2, hemiCielo: '#ffd2a8', hemiSuelo: '#2e1f15', hemi: 0.22, relleno: 0.6, entorno: 0.07, ciudad: '#3b3050', luces: 0.45, estrellas: 0.08, exposicion: 1.08, cortina: 0.16, jacaranda: '#5a4570' },
  { elev: 6, nombre: 'Hora dorada', nombreManana: 'Mañana dorada', arriba: '#7d86c4', horizonte: '#ffb57d', solColor: '#ffa45c', sol: 3.4, lampara: 0.7, ventanaColor: '#ffc28c', ventana: 2.6, hemiCielo: '#ffd9b0', hemiSuelo: '#33231a', hemi: 0.42, relleno: 0.35, entorno: 0.11, ciudad: '#6c5f78', luces: 0.1, estrellas: 0, exposicion: 0.98, cortina: 0.24, jacaranda: '#8a77a8' },
  { elev: 20, nombre: 'Tarde', nombreManana: 'Mañana', arriba: '#8fb0dc', horizonte: '#ffd7a8', solColor: '#ffcb8c', sol: 3.6, lampara: 0.55, ventanaColor: '#ffdcb0', ventana: 3, hemiCielo: '#ffe2c0', hemiSuelo: '#3a281c', hemi: 0.62, relleno: 0.25, entorno: 0.15, ciudad: '#8e8aa0', luces: 0, estrellas: 0, exposicion: 0.95, cortina: 0.26, jacaranda: '#a493c2' },
  { elev: 45, nombre: 'Mediodía', nombreManana: 'Mediodía', arriba: '#8fbbe6', horizonte: '#f6dfc0', solColor: '#ffdcae', sol: 3.2, lampara: 0.45, ventanaColor: '#ffe6c4', ventana: 3.2, hemiCielo: '#ffe6c8', hemiSuelo: '#3a281c', hemi: 0.72, relleno: 0.25, entorno: 0.17, ciudad: '#a3a2b4', luces: 0, estrellas: 0, exposicion: 0.93, cortina: 0.26, jacaranda: '#b3a3d0' },
];

const NUMERICOS = ['sol', 'lampara', 'ventana', 'hemi', 'relleno', 'entorno', 'luces', 'estrellas', 'exposicion', 'cortina'] as const;
const COLORES = ['arriba', 'horizonte', 'solColor', 'ventanaColor', 'hemiCielo', 'hemiSuelo', 'ciudad', 'jacaranda'] as const;

type Estado = { [K in (typeof NUMERICOS)[number]]: number } & { [K in (typeof COLORES)[number]]: THREE.Color } & {
  nombre: string;
  elev: number;
  manana: boolean;
};

function interpolar(elev: number, manana: boolean): Estado {
  let i = 0;
  while (i < CLIMAS.length - 2 && elev > CLIMAS[i + 1].elev) i++;
  const a = CLIMAS[i];
  const b = CLIMAS[i + 1];
  const tLineal = limitar((elev - a.elev) / (b.elev - a.elev), 0, 1);
  const t = tLineal * tLineal * (3 - 2 * tLineal);
  const e = { elev, manana } as Estado;
  for (const k of NUMERICOS) e[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of COLORES) e[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  const cercano = t < 0.5 ? a : b;
  e.nombre = manana ? cercano.nombreManana : cercano.nombre;
  return e;
}

/** Intensidades base (unidades físicas de three.js), ajustadas a ojo. */
const K = { tela: 1.6, abajo: 10, arriba: 7, relleno: 1.1, ventana: 0.75, sol: 1.15 };

const GRIS_DIA = new THREE.Color('#7c828e');
const GRIS_DIA_H = new THREE.Color('#a3a3a8');
const GRIS_NOCHE = new THREE.Color('#1c1e29');
const GRIS_NOCHE_H = new THREE.Color('#353341');
const LUZ_LLUVIA = new THREE.Color('#cdd5e2');
const LUZ_RAYO = new THREE.Color('#dfe6ff');

/** De dónde viene el sol (una ventana imaginaria a la izquierda) y adónde apunta. */
export const POS_SOL = new THREE.Vector3(-4.4, 3.1, 2.4);
export const OBJETIVO_SOL = new THREE.Vector3(-0.15, 1.05, 0);

export class Ambiente {
  readonly hemi: THREE.HemisphereLight;
  readonly sol: THREE.SpotLight;
  /** Lámpara de pie: brillo a través de la tela, haz hacia abajo y hacia el techo. */
  readonly tela: THREE.PointLight;
  readonly abajo: THREE.SpotLight;
  readonly arriba: THREE.SpotLight;
  readonly relleno: THREE.PointLight;
  readonly ventanaLuz: THREE.RectAreaLight;
  readonly clave: THREE.PointLight;
  estado!: Estado;
  /** 0..1: cuánto se oscurece la habitación al mirar un libro de cerca. */
  foco = 0;
  /** Hora forzada (para probar), o null para la hora real. */
  horaForzada: number | null = null;
  /** Clima real (o de prueba): nubes, lluvia, tormenta. */
  clima: EstadoClima = DESPEJADO;
  private relampago = 0;
  private rayo = -1;
  private proximoRayo = 4;
  private ultimaActualizacion = -Infinity;
  /** Cambió la posición de alguna luz con sombra (hay que recalcular sombras). */
  private cambioSombras = true;
  private tiempo = 0;
  readonly direccionSol = new THREE.Vector3();

  constructor(
    private escena: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private hab: Habitacion,
    private lamparaVis: { pantalla: THREE.MeshStandardMaterial; bulbo: THREE.MeshBasicMaterial; posLuz: THREE.Vector3 },
    alta: boolean,
  ) {
    this.hemi = new THREE.HemisphereLight(0xffe0c0, 0x2a1d14, 0.5);
    escena.add(this.hemi);

    // Sol de una ventana lateral (fuera de cuadro): proyecta el dibujo de la ventana
    // y las hojas sobre la pared del fondo y la biblioteca.
    this.sol = new THREE.SpotLight(0xffcf94, 3, 0, 0.3, 0.12, 0);
    this.sol.position.copy(POS_SOL);
    this.sol.target.position.copy(OBJETIVO_SOL);
    const gobo = new THREE.CanvasTexture(texturaVentanaSol());
    gobo.colorSpace = THREE.SRGBColorSpace;
    this.sol.map = gobo;
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(alta ? 2048 : 1024, alta ? 2048 : 1024);
    this.sol.shadow.camera.near = 0.5;
    this.sol.shadow.camera.far = 12;
    this.sol.shadow.bias = -0.0003;
    this.sol.shadow.normalBias = 0.02;
    this.sol.shadow.radius = 2.5;
    escena.add(this.sol, this.sol.target);

    const p = lamparaVis.posLuz;
    this.tela = new THREE.PointLight(0xffb066, K.tela, 0, 2);
    this.tela.position.copy(p);
    escena.add(this.tela);

    this.abajo = new THREE.SpotLight(0xffbe7a, K.abajo, 0, 1.05, 0.75, 2);
    this.abajo.position.copy(p).add(new THREE.Vector3(0, -0.06, 0));
    this.abajo.target.position.copy(p).setY(0).add(new THREE.Vector3(0.2, 0, 0.15));
    if (alta) {
      this.abajo.castShadow = true;
      this.abajo.shadow.mapSize.set(1024, 1024);
      this.abajo.shadow.bias = -0.0006;
      this.abajo.shadow.radius = 4;
      this.abajo.shadow.camera.near = 0.1;
      this.abajo.shadow.camera.far = 3;
    }
    escena.add(this.abajo, this.abajo.target);

    this.arriba = new THREE.SpotLight(0xffc488, K.arriba, 0, 1.15, 0.9, 2);
    this.arriba.position.copy(p).add(new THREE.Vector3(0, 0.08, 0));
    this.arriba.target.position.copy(p).setY(2.8).add(new THREE.Vector3(0.1, 0, 0));
    escena.add(this.arriba, this.arriba.target);

    // Rebote cálido que viene "de la casa", detrás de la cámara
    this.relleno = new THREE.PointLight(0xffc995, K.relleno, 0, 2);
    this.relleno.position.set(0.6, 2.2, 2.6);
    escena.add(this.relleno);

    const v = hab.ventana;
    this.ventanaLuz = new THREE.RectAreaLight(0xffe0b8, 2, v.x1 - v.x0, v.y1 - v.y0);
    this.ventanaLuz.position.set((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, 0.02);
    this.ventanaLuz.lookAt((v.x0 + v.x1) / 2 + 0.4, (v.y0 + v.y1) / 2 - 0.6, 4);
    escena.add(this.ventanaLuz);

    // Luz de lectura que aparece al acercar un libro
    this.clave = new THREE.PointLight(0xffe2bd, 0, 1.6, 2);
    escena.add(this.clave);

    this.actualizar(true);
  }

  get hora() {
    return this.horaForzada ?? horaBuenosAires();
  }

  actualizar(forzar = false) {
    const ahora = performance.now();
    if (!forzar && ahora - this.ultimaActualizacion < 20000) return;
    this.ultimaActualizacion = ahora;
    const fecha = this.horaForzada === null ? new Date() : fechaConHora(this.horaForzada);
    const { elevacion, manana } = posicionSolar(fecha);
    this.estado = interpolar(elevacion, manana);
    this.cambioSombras = true;
    this.aplicar();
  }

  consumirCambio() {
    const c = this.cambioSombras;
    this.cambioSombras = false;
    return c;
  }

  setClima(c: EstadoClima) {
    this.clima = c;
    this.cambioSombras = true;
    if (!c.tormenta) this.relampago = 0;
    this.aplicar();
  }

  private aplicar() {
    const e = this.estado;
    const atenuar = 1 - this.foco * 0.5;
    const h = this.hab;
    const c = this.clima;
    // Cuánto tapan las nubes y la lluvia (0 = despejado, 1 = cerrado)
    const nub = limitar(c.nubes * 0.75 + c.lluvia * 0.45, 0, 1);
    const dia = limitar((e.elev + 8) / 20, 0, 1);
    const grisArriba = GRIS_NOCHE.clone().lerp(GRIS_DIA, dia);
    const grisHorizonte = GRIS_NOCHE_H.clone().lerp(GRIS_DIA_H, dia);
    h.cielo.uArriba.value.copy(e.arriba).lerp(grisArriba, nub * 0.8);
    h.cielo.uHorizonte.value.copy(e.horizonte).lerp(grisHorizonte, nub * 0.72);
    h.cielo.uSolColor.value.copy(e.solColor);
    h.cielo.uEstrellas.value = e.estrellas * (1 - nub);
    h.cielo.uRelampago.value = this.relampago;
    const solVisible = limitar((e.elev + 6) / 10, 0, 1);
    h.cielo.uSolBrillo.value = solVisible * (e.elev < 25 ? 1 : 0.4) * (1 - nub);
    h.cielo.uSol.value.set(e.manana ? 0.72 : 0.22, limitar(0.12 + e.elev / 80, 0.02, 0.9));
    h.ciudad.color.copy(e.ciudad).lerp(grisHorizonte, nub * (c.tipo === 'niebla' ? 0.75 : 0.35));
    h.lucesCiudad.opacity = e.luces;
    h.jacaranda.color.copy(e.jacaranda);
    h.cortinas.emissive.copy(e.ventanaColor);
    h.cortinas.emissiveIntensity = e.cortina * 0.35;

    // Con el sol más bajo, el recuadro de luz cae más arriba y más alargado en la pared
    const bajo = 1 - limitar(e.elev / 45, 0, 1);
    this.sol.position.set(POS_SOL.x, POS_SOL.y - bajo * 0.9, POS_SOL.z);
    this.sol.target.position.set(OBJETIVO_SOL.x, OBJETIVO_SOL.y + bajo * 0.25, OBJETIVO_SOL.z);
    this.direccionSol.copy(this.sol.position).sub(this.sol.target.position).normalize();
    this.sol.color.copy(e.solColor);
    this.sol.intensity = e.sol * K.sol * atenuar * (1 - nub * 0.93);
    this.sol.visible = this.sol.intensity > 0.03;

    this.hemi.color.copy(e.hemiCielo);
    this.hemi.groundColor.copy(e.hemiSuelo);
    this.hemi.intensity = (e.hemi * (1 - nub * 0.25) + this.relampago * 0.7) * atenuar;
    this.escena.environmentIntensity = e.entorno * atenuar;
    this.relleno.intensity = e.relleno * K.relleno * atenuar;
    this.ventanaLuz.color.copy(e.ventanaColor).lerp(LUZ_LLUVIA, nub * 0.45).lerp(LUZ_RAYO, this.relampago);
    this.ventanaLuz.intensity = (e.ventana * K.ventana * (1 - nub * 0.35) + this.relampago * 16) * atenuar;

    // En días nublados o de lluvia la lámpara se prende igual: más acogedor
    const lamp = Math.max(e.lampara, nub > 0.45 ? 0.62 + c.lluvia * 0.35 : 0) * (1 - this.foco * 0.35);
    this.tela.intensity = lamp * K.tela;
    this.abajo.intensity = lamp * K.abajo;
    this.arriba.intensity = lamp * K.arriba;
    // La pantalla brilla de verdad solo cuando oscurece; de día es tela iluminada
    const brilloPantalla = Math.max(0, lamp - 0.5) * 2;
    this.lamparaVis.pantalla.emissiveIntensity = 0.08 + brilloPantalla * 0.75;
    this.lamparaVis.bulbo.color.setRGB(1, 0.86, 0.62).multiplyScalar(0.4 + brilloPantalla * 2);
    this.renderer.toneMappingExposure = e.exposicion * (1 - nub * 0.05);
  }

  /** Oscurece la habitación para el foco (0..1) y ubica la luz de lectura. */
  setFoco(v: number, posicion?: THREE.Vector3) {
    this.foco = v;
    this.clave.intensity = v * 1.3;
    if (posicion) this.clave.position.copy(posicion);
    this.aplicar();
  }

  tick(dt: number) {
    this.tiempo += dt;
    this.hab.cielo.uTiempo.value = this.tiempo;
    // Relámpagos: un destello doble y un resplandor que se apaga
    if (this.clima.tormenta && this.rayo < 0) {
      this.proximoRayo -= dt;
      if (this.proximoRayo <= 0) {
        this.rayo = 0;
        this.proximoRayo = 5 + Math.random() * 12;
      }
    }
    if (this.rayo >= 0) {
      this.rayo += dt;
      const t = this.rayo;
      this.relampago = t < 0.07 ? 1 : t < 0.15 ? 0.2 : t < 0.23 ? 0.8 : Math.max(0, 0.55 - (t - 0.23) * 1.1);
      if (t > 0.75) {
        this.rayo = -1;
        this.relampago = 0;
      }
      this.aplicar();
    }
    this.actualizar();
  }
}
