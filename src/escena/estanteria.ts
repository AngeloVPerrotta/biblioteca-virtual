/**
 * Biblioteca tipo Ruffo plegable: 5 niveles, caño negro, cruces en X a los costados,
 * estantes de madera y ruedas. El ancho crece solo si se agregan libros (1 a 1,5 m).
 */
import * as THREE from 'three';
import { hash, limitar, mezclar, rng } from '../util/aleatorio';
import type { Animador } from '../util/animacion';
import { fusionarEstaticos } from './fusion';
import { marcar } from './interactivos';
import type { LibroVisual } from './libros';
import { aTextura, lienzo } from './texturas';

/** Altura (superficie) de cada estante, de abajo hacia arriba. */
export const NIVELES = [0.1, 0.51, 0.92, 1.33, 1.74];
export const PROFUNDIDAD = 0.36;
const POSTE = 0.025;
const TABLA = 0.022;
const SEPARACION = 0.0018;

export type Orden = 'fotos' | 'color' | 'autor' | 'titulo';

export interface DecoracionEstante {
  objeto: THREE.Object3D;
  ancho: number;
  /** Estante preferido (0 = el de arriba con libros). */
  estante: number;
}

interface Destino {
  pos: THREE.Vector3;
  rotZ: number;
}

function hsl(hex: string) {
  const c = new THREE.Color(hex);
  const out = { h: 0, s: 0, l: 0 };
  c.getHSL(out, THREE.SRGBColorSpace);
  return out;
}

function apellido(autor: string) {
  const primero = autor.split(/,|\sy\s|·/)[0].trim();
  const partes = primero.split(/\s+/);
  return partes[partes.length - 1] ?? '';
}

const sinArticulo = (t: string) => t.replace(/^(el|la|los|las|un|una)\s+/i, '');

export function ordenarLibros(lista: LibroVisual[], orden: Orden, original: Map<string, number>) {
  const copia = [...lista];
  const es = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });
  switch (orden) {
    case 'fotos':
      return copia.sort((a, b) => (original.get(a.libro.id) ?? 0) - (original.get(b.libro.id) ?? 0));
    case 'autor':
      return copia.sort((a, b) => es(apellido(a.libro.autor), apellido(b.libro.autor)) || es(a.libro.titulo, b.libro.titulo));
    case 'titulo':
      return copia.sort((a, b) => es(sinArticulo(a.libro.titulo), sinArticulo(b.libro.titulo)));
    case 'color':
      return copia.sort((a, b) => {
        const A = hsl(a.libro.lomo.fondo);
        const B = hsl(b.libro.lomo.fondo);
        const neutroA = A.s < 0.18 || A.l < 0.13 || A.l > 0.9;
        const neutroB = B.s < 0.18 || B.l < 0.13 || B.l > 0.9;
        if (neutroA !== neutroB) return neutroA ? 1 : -1;
        if (neutroA) return B.l - A.l;
        return A.h - B.h || A.l - B.l;
      });
  }
}

function notaPrestamo(libroTitulo: string, a: string, desde?: string) {
  const { c, ctx } = lienzo(256, 256);
  ctx.fillStyle = '#f6e7a8';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, 256, 34);
  ctx.fillStyle = '#23252b';
  ctx.textAlign = 'center';
  ctx.font = '400 32px "Special Elite", monospace';
  ctx.fillText('Prestado a', 128, 92);
  ctx.font = '400 40px "Special Elite", monospace';
  ctx.fillText(a, 128, 156, 230);
  if (desde) {
    const [y, m, d] = desde.split('-');
    ctx.font = '400 26px "Special Elite", monospace';
    ctx.fillText(`desde el ${d}/${m}/${y.slice(2)}`, 128, 214);
  }
  const mat = new THREE.MeshStandardMaterial({ map: aTextura(c), roughness: 0.85, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0 });
  const nota = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), mat);
  nota.name = `nota:${libroTitulo}`;
  return { nota, mat };
}

export class Estanteria {
  readonly grupo = new THREE.Group();
  readonly ancho: number;
  private readonly parados: LibroVisual[];
  private readonly ordenOriginal = new Map<string, number>();
  private readonly sujetalibros: THREE.Group[] = [];
  private readonly notas = new Map<string, THREE.Mesh>();
  private readonly decoraciones: DecoracionEstante[];
  private readonly animador: Animador;
  orden: Orden = 'fotos';

  constructor(opciones: {
    parados: LibroVisual[];
    texturaMadera: THREE.Texture;
    decoraciones: DecoracionEstante[];
    animador: Animador;
  }) {
    this.parados = opciones.parados;
    this.decoraciones = opciones.decoraciones;
    this.animador = opciones.animador;
    this.parados.forEach((lv, i) => this.ordenOriginal.set(lv.libro.id, i));
    const total = this.parados.reduce((s, lv) => s + lv.grosor + SEPARACION, 0);
    // Ancho real de una Ruffo (~80 cm); crece hasta 1,5 m a medida que se suman libros
    this.ancho = limitar(total / 4 / 0.62 + 2 * POSTE + 0.03, 0.8, 1.5);
    this.grupo.name = 'estanteria';
    this.construirEstructura(opciones.texturaMadera);

    for (const lv of this.parados) {
      this.grupo.add(lv.mesh);
      const p = lv.libro.prestado;
      if (p) {
        lv.mesh.visible = false;
        const { nota, mat } = notaPrestamo(lv.libro.titulo, p.a, p.desde);
        marcar(nota, {
          tipo: 'prestado',
          id: lv.libro.id,
          titulo: lv.libro.titulo,
          subtitulo: `Prestado a ${p.a}`,
          resaltar: (v) => (mat.emissiveIntensity = v * 0.25),
        });
        this.notas.set(lv.libro.id, nota);
        this.grupo.add(nota);
      }
    }
    for (let i = 0; i < 4; i++) {
      const s = this.crearSujetalibros();
      this.sujetalibros.push(s);
      this.grupo.add(s);
    }
    for (const d of this.decoraciones) this.grupo.add(d.objeto);
    this.distribuir('fotos', false);
  }

  /* ------------------------------------------------------------ estructura */

  private construirEstructura(texturaMadera: THREE.Texture) {
    const W = this.ancho;
    const estructura = new THREE.Group();
    estructura.name = 'estructura';
    this.grupo.add(estructura);
    const metal = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.42, metalness: 0.65 });
    const tex = texturaMadera.clone();
    tex.repeat.set(W / 0.9, 0.5);
    tex.needsUpdate = true;
    const madera = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, color: 0xffffff });

    const caja = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      estructura.add(m);
      return m;
    };

    const xPoste = W / 2 - POSTE / 2;
    const zFrente = PROFUNDIDAD - POSTE / 2;
    const zFondo = POSTE / 2;
    const y0 = 0.05;
    const y1 = NIVELES[4] + 0.02;
    for (const x of [-xPoste, xPoste]) {
      for (const z of [zFondo, zFrente]) caja(POSTE, y1 - y0, POSTE, metal, x, (y0 + y1) / 2, z);
    }
    for (const nivel of NIVELES) {
      caja(W - 0.01, TABLA, PROFUNDIDAD - 0.01, madera, 0, nivel - TABLA / 2, PROFUNDIDAD / 2);
      // Bastidor de ángulo metálico
      caja(W, 0.03, 0.004, metal, 0, nivel - 0.016, PROFUNDIDAD - 0.002);
      caja(W, 0.03, 0.004, metal, 0, nivel - 0.016, 0.002);
      caja(0.004, 0.03, PROFUNDIDAD, metal, -W / 2 + 0.002, nivel - 0.016, PROFUNDIDAD / 2);
      caja(0.004, 0.03, PROFUNDIDAD, metal, W / 2 - 0.002, nivel - 0.016, PROFUNDIDAD / 2);
    }
    // Cruces en X en ambos costados
    const varilla = new THREE.CylinderGeometry(0.0032, 0.0032, 1, 6);
    const entre = (a: THREE.Vector3, b: THREE.Vector3) => {
      const m = new THREE.Mesh(varilla, metal);
      const medio = a.clone().add(b).multiplyScalar(0.5);
      m.position.copy(medio);
      m.scale.y = a.distanceTo(b);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true;
      estructura.add(m);
    };
    for (const x of [-W / 2 - 0.002, W / 2 + 0.002]) {
      for (let i = 0; i < 4; i++) {
        const ya = NIVELES[i] - 0.03;
        const yb = NIVELES[i + 1] - 0.03;
        entre(new THREE.Vector3(x, ya, 0.015), new THREE.Vector3(x, yb, PROFUNDIDAD - 0.015));
        entre(new THREE.Vector3(x, yb, 0.015), new THREE.Vector3(x, ya, PROFUNDIDAD - 0.015));
      }
    }
    // Ruedas
    const goma = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    const rueda = new THREE.CylinderGeometry(0.026, 0.026, 0.016, 20);
    rueda.rotateZ(Math.PI / 2);
    for (const x of [-xPoste, xPoste]) {
      for (const z of [zFondo + 0.01, zFrente - 0.01]) {
        caja(0.03, 0.03, 0.03, metal, x, 0.05, z);
        const r = new THREE.Mesh(rueda, goma);
        r.position.set(x, 0.026, z);
        r.castShadow = true;
        estructura.add(r);
      }
    }
    fusionarEstaticos(estructura);
  }

  private crearSujetalibros() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.5, metalness: 0.5 });
    const placa = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.15, 0.12), metal);
    placa.position.set(0, 0.075, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.003, 0.12), metal);
    base.position.set(0.05, 0.0015, 0);
    placa.castShadow = base.castShadow = true;
    g.add(placa, base);
    g.name = 'sujetalibros';
    return g;
  }

  /* ------------------------------------------------------------ distribución */

  private calcular(orden: Orden) {
    const lista = ordenarLibros(this.parados, orden, this.ordenOriginal);
    const grosor = (lv: LibroVisual) => lv.grosor + SEPARACION;
    const total = lista.reduce((s, lv) => s + grosor(lv), 0);
    const objetivo = total / 4;
    const estantes: LibroVisual[][] = [[], [], [], []];
    let acum = 0;
    for (const lv of lista) {
      const t = grosor(lv);
      const s = Math.min(3, Math.floor((acum + t / 2) / objetivo));
      estantes[s].push(lv);
      acum += t;
    }

    const destinos = new Map<string, Destino>();
    const sujetalibros: Destino[] = [];
    const decor = new Map<THREE.Object3D, Destino>();
    const interior = this.ancho / 2 - POSTE - 0.012;
    const zLomo = PROFUNDIDAD - 0.022;
    const libres: [number, number][] = [];

    estantes.forEach((fila, s) => {
      const nivel = NIVELES[3 - s];
      const largo = fila.reduce((acc, lv) => acc + grosor(lv), 0);
      const aIzquierda = s % 2 === 0;
      let x = aIzquierda ? -interior : interior - largo;
      for (const lv of fila) {
        const r = rng(hash(lv.libro.id));
        const t = grosor(lv);
        destinos.set(lv.libro.id, {
          pos: new THREE.Vector3(x + t / 2, nivel + lv.alto / 2 + 0.0004, zLomo - lv.ancho / 2 + (r() - 0.5) * 0.006),
          rotZ: (r() - 0.5) * 0.008,
        });
        x += t;
      }
      const xSujeta = aIzquierda ? -interior + largo + 0.0015 : interior - largo - 0.0015;
      sujetalibros.push({ pos: new THREE.Vector3(xSujeta, nivel, zLomo - 0.07), rotZ: aIzquierda ? 0 : Math.PI });

      libres.push(aIzquierda ? [xSujeta + 0.105, interior] : [-interior, xSujeta - 0.105]);
    });

    // Cada adorno va a su estante preferido o, si no entra, al que tenga más lugar libre
    const usados = new Set<number>();
    for (const d of this.decoraciones) {
      const candidatos = [d.estante, ...[0, 1, 2, 3].filter((s) => s !== d.estante).sort((a, b) => libres[b][1] - libres[b][0] - (libres[a][1] - libres[a][0]))];
      const s = candidatos.find((c) => !usados.has(c) && libres[c][1] - libres[c][0] > d.ancho + 0.015);
      if (s === undefined) continue;
      usados.add(s);
      const [a, b] = libres[s];
      decor.set(d.objeto, { pos: new THREE.Vector3(mezclar(a, b, 0.5), NIVELES[3 - s], PROFUNDIDAD / 2), rotZ: 0 });
    }
    return { destinos, sujetalibros, decor };
  }

  distribuir(orden: Orden, animar = true) {
    this.orden = orden;
    const { destinos, sujetalibros, decor } = this.calcular(orden);
    const ordenados = ordenarLibros(this.parados, orden, this.ordenOriginal);

    ordenados.forEach((lv, i) => {
      const d = destinos.get(lv.libro.id)!;
      const nota = this.notas.get(lv.libro.id);
      if (nota) {
        nota.position.set(d.pos.x, d.pos.y - lv.alto / 2 - 0.03, PROFUNDIDAD + 0.0025);
        nota.rotation.set(0, 0, (hash(lv.libro.id) % 10) / 100 - 0.05);
      }
      lv.mesh.userData.estante = { pos: d.pos.clone(), rotZ: d.rotZ };
      if (!animar) {
        lv.mesh.position.copy(d.pos);
        lv.mesh.rotation.set(0, 0, d.rotZ);
        return;
      }
      const desde = lv.mesh.position.clone();
      const rotDesde = lv.mesh.rotation.z;
      this.animador.animar(
        1100,
        (k) => {
          lv.mesh.position.lerpVectors(desde, d.pos, k);
          const arco = Math.sin(Math.PI * k);
          lv.mesh.position.z += arco * 0.12;
          lv.mesh.position.y += arco * 0.025;
          lv.mesh.rotation.z = mezclar(rotDesde, d.rotZ, k) + arco * 0.05;
        },
        { retraso: i * 14, clave: `orden:${lv.libro.id}` },
      );
    });

    this.sujetalibros.forEach((s, i) => {
      const d = sujetalibros[i];
      if (!animar) {
        s.position.copy(d.pos);
        s.rotation.y = d.rotZ;
        return;
      }
      const desde = s.position.clone();
      this.animador.animar(900, (k) => s.position.lerpVectors(desde, d.pos, k), { retraso: 300, clave: `sujeta:${i}` });
      s.rotation.y = d.rotZ;
    });

    for (const d of this.decoraciones) {
      const destino = decor.get(d.objeto);
      d.objeto.visible = !!destino;
      if (!destino) continue;
      if (!animar) {
        d.objeto.position.copy(destino.pos);
        continue;
      }
      const desde = d.objeto.position.clone();
      this.animador.animar(900, (k) => d.objeto.position.lerpVectors(desde, destino.pos, k), { retraso: 250 });
    }
  }

  /** Objetos señalables del estante (libros visibles y notas de préstamo). */
  objetivos(): THREE.Object3D[] {
    return [...this.parados.filter((lv) => lv.mesh.visible).map((lv) => lv.mesh), ...this.notas.values()];
  }

  libro(id: string) {
    return this.parados.find((lv) => lv.libro.id === id) ?? null;
  }
}
