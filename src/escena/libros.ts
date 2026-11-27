import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Libro } from '../datos/tipos';
import { compactarGrupos } from './fusion';
import { marcar } from './interactivos';
import { dibujarContratapa, dibujarLomo, dibujarTapa } from './lomos';
import { dibujarTapaReal } from './tapas';
import { aTextura, texturaPaginas } from './texturas';

/**
 * Los libros se dibujan un poco más grandes que en la realidad: se leen mejor
 * en pantalla, son más fáciles de tocar y llenan mejor la biblioteca.
 */
export const ESCALA_LIBROS = 1.32;

let paginasNuevas: THREE.MeshStandardMaterial | null = null;
let paginasViejas: THREE.MeshStandardMaterial | null = null;

function materialPaginas(gastado: number) {
  if (!paginasNuevas || !paginasViejas) {
    paginasNuevas = new THREE.MeshStandardMaterial({ map: aTextura(texturaPaginas('#f3ecdc')), roughness: 0.9 });
    paginasViejas = new THREE.MeshStandardMaterial({ map: aTextura(texturaPaginas('#e4cf9f')), roughness: 0.95 });
  }
  return gastado > 0.45 ? paginasViejas : paginasNuevas;
}

/** Un libro en 3D: caja apenas redondeada con lomo, tapas y cantos de páginas. */
export class LibroVisual {
  readonly libro: Libro;
  readonly mesh: THREE.Mesh;
  /** Medidas en metros, ya escaladas. */
  readonly alto: number;
  readonly grosor: number;
  readonly ancho: number;
  private readonly matLomo: THREE.MeshStandardMaterial;
  private readonly matTapa: THREE.MeshStandardMaterial;
  private readonly matContra: THREE.MeshStandardMaterial;
  private tapasListas = false;

  constructor(libro: Libro) {
    this.libro = libro;
    this.alto = (libro.alto / 100) * ESCALA_LIBROS;
    this.grosor = (libro.grosor / 100) * ESCALA_LIBROS;
    this.ancho = (libro.ancho / 100) * ESCALA_LIBROS;
    // Caras: +x tapa, -x contratapa, +y/-y/-z cantos de páginas, +z lomo → 4 dibujos en vez de 6
    const geo = compactarGrupos(new RoundedBoxGeometry(this.grosor, this.alto, this.ancho, 2, 0.0015), (i) => [0, 1, 2, 2, 3, 2][i]);
    const lomo = aTextura(dibujarLomo(libro));
    const brillo = libro.lomo.brillo ?? 0.3;
    const rugosidad = 0.8 - brillo * 0.42;
    this.matLomo = new THREE.MeshStandardMaterial({
      map: lomo,
      roughness: rugosidad,
      emissive: 0xffffff,
      emissiveMap: lomo,
      emissiveIntensity: 0,
    });
    const color = new THREE.Color(libro.lomo.fondo);
    this.matTapa = new THREE.MeshStandardMaterial({ color, roughness: rugosidad, emissive: color, emissiveIntensity: 0 });
    this.matContra = this.matTapa.clone();
    const paginas = materialPaginas(libro.lomo.gastado ?? 0);
    this.mesh = new THREE.Mesh(geo, [this.matTapa, this.matContra, paginas, this.matLomo]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = `libro:${libro.id}`;
    marcar(this.mesh, {
      tipo: 'libro',
      id: libro.id,
      titulo: libro.titulo,
      subtitulo: libro.autor,
      resaltar: (v) => this.resaltar(v),
    });
  }

  resaltar(v: number) {
    this.matLomo.emissiveIntensity = v * 0.3;
    this.matTapa.emissiveIntensity = v * 0.22;
    this.matContra.emissiveIntensity = v * 0.22;
  }

  /** Las tapas se dibujan recién cuando el libro se mira de cerca. */
  asegurarTapas() {
    if (this.tapasListas) return;
    this.tapasListas = true;
    const ponerTapa = (tex: THREE.Texture) => {
      this.matTapa.map = tex;
      this.matTapa.emissiveMap = tex;
      this.matTapa.color.set(0xffffff);
      this.matTapa.emissive.set(0xffffff);
      this.matTapa.needsUpdate = true;
    };
    if (this.libro.tapa) {
      new THREE.TextureLoader().load(this.libro.tapa, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        ponerTapa(t);
      });
    } else {
      // La tapa de la edición real; si no está descripta, una genérica con los colores del lomo
      void dibujarTapaReal(this.libro).then((c) => ponerTapa(aTextura(c ?? dibujarTapa(this.libro))));
    }
    const contra = aTextura(dibujarContratapa(this.libro));
    this.matContra.map = contra;
    this.matContra.emissiveMap = contra;
    this.matContra.color.set(0xffffff);
    this.matContra.emissive.set(0xffffff);
    this.matContra.needsUpdate = true;
  }
}
