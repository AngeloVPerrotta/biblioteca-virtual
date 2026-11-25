import * as THREE from 'three';

export type TipoInteractivo = 'libro' | 'prestado' | 'agenda' | 'vinilos' | 'tocadiscos' | 'reloj';

/** Lo que la escena sabe de un objeto que se puede señalar o tocar. */
export interface Interactivo {
  tipo: TipoInteractivo;
  id?: string;
  titulo: string;
  subtitulo?: string;
  resaltar: (v: number) => void;
}

export function marcar(obj: THREE.Object3D, datos: Interactivo) {
  obj.userData.interactivo = datos;
  return obj;
}

export function buscarInteractivo(obj: THREE.Object3D | null): Interactivo | null {
  let o = obj;
  while (o) {
    if (o.userData.interactivo) return o.userData.interactivo as Interactivo;
    o = o.parent;
  }
  return null;
}

/** Sube el brillo de un grupo de materiales estándar sin perder su emisión original. */
export function resaltadorDe(objeto: THREE.Object3D, intensidad = 0.22) {
  const materiales: THREE.MeshStandardMaterial[] = [];
  objeto.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (mat instanceof THREE.MeshStandardMaterial && !materiales.includes(mat)) {
        materiales.push(mat);
        mat.userData.emisivoBase = mat.emissive.clone();
        mat.userData.intensidadBase = mat.emissiveIntensity;
      }
    }
  });
  return (v: number) => {
    for (const mat of materiales) {
      const base = mat.userData.emisivoBase as THREE.Color;
      if (v <= 0.001) {
        mat.emissive.copy(base);
        mat.emissiveIntensity = mat.userData.intensidadBase;
      } else {
        mat.emissive.copy(base).lerp(mat.color, v);
        mat.emissiveIntensity = Math.max(mat.userData.intensidadBase, v * intensidad * 2);
      }
    }
  };
}
