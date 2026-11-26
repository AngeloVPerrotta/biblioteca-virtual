/** Generador pseudoaleatorio con semilla (xorshift32): mismos resultados en cada carga. */
export function rng(semilla: number): () => number {
  let s = semilla >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Hash FNV-1a de un texto, para derivar semillas estables por libro. */
export function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Ruido de valor 2D periódico. Muestreando con coordenadas en [0, periodo)
 * a lo ancho de una textura, el resultado se repite sin costuras.
 */
export function crearRuido(semilla: number, periodo = 8) {
  const r = rng(semilla);
  const n = periodo;
  const valores = new Float32Array(n * n);
  for (let i = 0; i < valores.length; i++) valores[i] = r();
  // Con períodos potencia de 2 (los de siempre) el «módulo» se hace con una máscara de bits: mucho más rápido
  const mascara = n - 1;
  const v =
    (n & mascara) === 0
      ? (x: number, y: number) => valores[(y & mascara) * n + (x & mascara)]
      : (x: number, y: number) => valores[(((y % n) + n) % n) * n + (((x % n) + n) % n)];
  const suavizar = (t: number) => t * t * (3 - 2 * t);

  const ruido = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = suavizar(x - xi);
    const yf = suavizar(y - yi);
    const a = v(xi, yi);
    const b = v(xi + 1, yi);
    const c = v(xi, yi + 1);
    const d = v(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };

  const fbm = (x: number, y: number, octavas = 4) => {
    let suma = 0;
    let amp = 0.5;
    let f = 1;
    let norma = 0;
    for (let o = 0; o < octavas; o++) {
      suma += amp * ruido(x * f, y * f);
      norma += amp;
      amp *= 0.5;
      f *= 2;
    }
    return suma / norma;
  };

  return { ruido, fbm };
}

export const limitar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const mezclar = (a: number, b: number, t: number) => a + (b - a) * t;
