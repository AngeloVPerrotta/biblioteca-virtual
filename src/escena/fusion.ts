/**
 * Optimización de dibujo: menos llamadas a la placa de video sin cambiar cómo se ve.
 * - `fusionarEstaticos`: une las mallas quietas que comparten material en una sola.
 * - `compactarGrupos`: junta las caras de una caja que usan el mismo material.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ATRIBUTOS = ['position', 'normal', 'uv'] as const;

function normalizar(geo: THREE.BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const nombre of Object.keys(g.attributes)) {
    if (!(ATRIBUTOS as readonly string[]).includes(nombre)) g.deleteAttribute(nombre);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}

/**
 * Une las mallas quietas de `raiz` por material (y por si proyectan/reciben sombra).
 * No entra en objetos interactivos ni en los marcados con `userData.noFusionar`
 * (salvo que sean la propia raíz), ni toca mallas con varios materiales.
 */
export function fusionarEstaticos(raiz: THREE.Object3D) {
  raiz.updateMatrixWorld(true);
  const inversa = raiz.matrixWorld.clone().invert();
  const cubetas = new Map<string, { material: THREE.Material; mallas: THREE.Mesh[]; proyecta: boolean; recibe: boolean }>();

  const recorrer = (o: THREE.Object3D) => {
    if (o !== raiz && (o.userData.noFusionar || o.userData.interactivo)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material) && m.visible && !m.userData.noFusionar) {
      const clave = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
      const c = cubetas.get(clave) ?? { material: m.material, mallas: [], proyecta: m.castShadow, recibe: m.receiveShadow };
      c.mallas.push(m);
      cubetas.set(clave, c);
    }
    o.children.forEach(recorrer);
  };
  recorrer(raiz);

  let unidas = 0;
  for (const c of cubetas.values()) {
    if (c.mallas.length < 2) continue;
    const geos = c.mallas.map((m) => {
      const g = normalizar(m.geometry);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, m.matrixWorld));
      return g;
    });
    const unida = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!unida) continue;
    const malla = new THREE.Mesh(unida, c.material);
    malla.castShadow = c.proyecta;
    malla.receiveShadow = c.recibe;
    malla.name = 'fusion';
    raiz.add(malla);
    for (const m of c.mallas) m.removeFromParent();
    unidas += c.mallas.length - 1;
  }
  return unidas;
}

/**
 * Reordena el índice de una geometría con grupos (como una caja) para que las caras
 * que van a usar el mismo material queden juntas: menos dibujos por objeto.
 * `nuevoIndice` traduce el materialIndex original al nuevo.
 */
export function compactarGrupos(geo: THREE.BufferGeometry, nuevoIndice: (original: number) => number) {
  const indice = geo.index;
  if (!indice) return compactarSinIndice(geo, nuevoIndice);
  const original = indice.array;
  const porMaterial = new Map<number, number[]>();
  for (const g of geo.groups) {
    const m = nuevoIndice(g.materialIndex ?? 0);
    const lista = porMaterial.get(m) ?? [];
    for (let k = g.start; k < g.start + g.count; k++) lista.push(original[k]);
    porMaterial.set(m, lista);
  }
  const materiales = [...porMaterial.keys()].sort((a, b) => a - b);
  const total = materiales.reduce((s, m) => s + porMaterial.get(m)!.length, 0);
  const nuevo = total > 65535 ? new Uint32Array(total) : new Uint16Array(total);
  geo.clearGroups();
  let inicio = 0;
  for (const m of materiales) {
    const lista = porMaterial.get(m)!;
    nuevo.set(lista, inicio);
    geo.addGroup(inicio, lista.length, m);
    inicio += lista.length;
  }
  geo.setIndex(new THREE.BufferAttribute(nuevo, 1));
  return geo;
}

/** Igual que `compactarGrupos`, para geometrías sin índice (como RoundedBoxGeometry): reordena los vértices. */
function compactarSinIndice(geo: THREE.BufferGeometry, nuevoIndice: (original: number) => number) {
  const porMaterial = new Map<number, { start: number; count: number }[]>();
  for (const g of geo.groups) {
    const m = nuevoIndice(g.materialIndex ?? 0);
    const lista = porMaterial.get(m) ?? [];
    lista.push({ start: g.start, count: g.count });
    porMaterial.set(m, lista);
  }
  const materiales = [...porMaterial.keys()].sort((a, b) => a - b);
  for (const nombre of Object.keys(geo.attributes)) {
    const attr = geo.attributes[nombre] as THREE.BufferAttribute;
    const n = attr.itemSize;
    const origen = attr.array as Float32Array;
    const destino = new (origen.constructor as Float32ArrayConstructor)(origen.length);
    let escrito = 0;
    for (const m of materiales) {
      for (const r of porMaterial.get(m)!) {
        destino.set(origen.subarray(r.start * n, (r.start + r.count) * n), escrito * n);
        escrito += r.count;
      }
    }
    geo.setAttribute(nombre, new THREE.BufferAttribute(destino, n, attr.normalized));
  }
  geo.clearGroups();
  let inicio = 0;
  for (const m of materiales) {
    const cantidad = porMaterial.get(m)!.reduce((s, r) => s + r.count, 0);
    geo.addGroup(inicio, cantidad, m);
    inicio += cantidad;
  }
  return geo;
}
