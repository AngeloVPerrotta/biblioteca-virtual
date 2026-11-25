import * as THREE from 'three';

export type TipoInteractivo = 'libro' | 'prestado' | 'agenda' | 'vinilos' | 'tocadiscos' | 'reloj' | 'disco' | 'quelee';

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
  // Los objetos marcados con `sinResalte` (fundas con tapa, separadores) no se iluminan:
  // sus texturas sobre blanco se "queman" si se les suma brillo.
  const recorrer = (o: THREE.Object3D) => {
    if (o.userData.sinResalte) return;
    const m = (o as THREE.Mesh).material;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
      if (mat instanceof THREE.MeshStandardMaterial && !materiales.includes(mat)) {
        materiales.push(mat);
        mat.userData.emisivoBase = mat.emissive.clone();
        mat.userData.intensidadBase = mat.emissiveIntensity;
      }
    }
    o.children.forEach(recorrer);
  };
  recorrer(objeto);
  const tinte = new THREE.Color();
  return (v: number) => {
    for (const mat of materiales) {
      const base = mat.userData.emisivoBase as THREE.Color;
      if (v <= 0.001) {
        mat.emissive.copy(base);
        mat.emissiveIntensity = mat.userData.intensidadBase;
      } else {
        // Brillo suave: hacia el propio color del material, a media intensidad
        tinte.copy(mat.color).multiplyScalar(0.6);
        mat.emissive.copy(base).lerp(tinte, v);
        mat.emissiveIntensity = Math.max(mat.userData.intensidadBase, v * intensidad);
      }
    }
  };
}
