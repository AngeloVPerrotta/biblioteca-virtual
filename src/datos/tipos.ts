/**
 * Tipos de los datos de la biblioteca.
 * Todo lo editable vive en `biblioteca.json` (mismo directorio).
 * Medidas de los libros en centímetros.
 */

export type Fuente =
  | 'serif'
  | 'garamond'
  | 'garamond-cursiva'
  | 'sans'
  | 'condensada'
  | 'display'
  | 'mano'
  | 'maquina'
  | 'mono'
  | 'deco';

export type Logo = 'circulo' | 'cuadro' | 'pluma' | 'triangulo' | 'casa' | 'letra' | 'texto';

export type Patron = 'puntos' | 'escamas' | 'pasto' | 'rombos' | 'huella' | 'acuarela';

/** Cómo se dibuja el lomo. Todo es opcional salvo los colores base. */
export interface Lomo {
  fondo: string;
  texto: string;
  colorAutor?: string;
  colorTitulo?: string;
  /** Color secundario: pastilla, etiqueta, patrón… */
  acento?: string;
  /** Filete o borde (pastilla, etiqueta, recuadro horizontal). */
  borde?: string;
  estilo?: 'simple' | 'pastilla' | 'cuero' | 'etiqueta';
  fuente?: Fuente;
  fuenteAutor?: Fuente;
  mayus?: boolean;
  autorMayus?: boolean;
  orden?: 'autor-titulo' | 'titulo-autor';
  /** Texto tal como figura en el lomo, si difiere del título/autor. */
  textoTitulo?: string;
  textoAutor?: string;
  /** Texto horizontal (lomos anchos, ediciones clásicas). */
  horizontal?: boolean;
  /** Bandas de color: [desde, hasta, color], en fracción de la altura desde arriba. */
  bandas?: [number, number, string][];
  /** Índice de la banda que contiene al autor. */
  autorEnBanda?: number;
  logo?: Logo;
  logoTexto?: string;
  colorLogo?: string;
  patron?: Patron;
  /** 0 = nuevo, 1 = muy gastado. */
  gastado?: number;
  /** 0 = mate, 1 = laminado brillante. */
  brillo?: number;
}

export type EstadoLectura = 'leido' | 'empezado' | 'sin-leer';

export interface Prestamo {
  a: string;
  /** Fecha ISO (AAAA-MM-DD). */
  desde?: string;
}

export interface Libro {
  id: string;
  titulo: string;
  autor: string;
  editorial?: string;
  alto: number;
  grosor: number;
  ancho: number;
  lomo: Lomo;
  /** Va acostado en una pila, en vez de parado. */
  acostado?: boolean;
  /** Estado de lectura. Sin valor = todavía no lo marqué. */
  estado?: EstadoLectura | null;
  notas?: string;
  prestado?: Prestamo | null;
  /** Foto de la tapa (ruta dentro de /public). Si falta, se dibuja una. */
  tapa?: string;
  /** Algún dato está por confirmar. */
  confirmar?: boolean;
}

export interface Deseo {
  titulo: string;
  autor?: string;
  nota?: string;
  conseguido?: boolean;
}

export interface DatosBiblioteca {
  /** id del libro que está en la mesa de luz. */
  leyendoAhora: string | null;
  /** Imagen para el cuadro (ruta dentro de /public). Si falta, se dibuja uno original. */
  cuadro?: string | null;
  wishlist: Deseo[];
  /** Libros que leí pero no están en el estante (prestados que no vuelven, de otra persona…). */
  leidosFuera?: Deseo[];
  libros: Libro[];
}
