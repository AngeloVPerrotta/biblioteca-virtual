/**
 * Dibuja lomos, tapas y contratapas a partir de la descripción de cada libro
 * (colores, bandas, tipografías, logos y desgaste tomados de las fotos).
 */
import type { Fuente, Libro, Lomo } from '../datos/tipos';
import { hash, rng } from '../util/aleatorio';
import { grano, lienzo, rgba } from './texturas';

/** Resolución del lomo: píxeles por centímetro. */
const PX_LOMO = 30;
/** Resolución de tapas (se ven de cerca en el foco). */
export const PX_TAPA = 36;

const FAMILIAS: Record<Fuente, { familia: string; estilo: string; peso: number }> = {
  serif: { familia: '"Playfair Display", Georgia, serif', estilo: 'normal', peso: 600 },
  garamond: { familia: '"EB Garamond", Georgia, serif', estilo: 'normal', peso: 500 },
  'garamond-cursiva': { familia: '"EB Garamond", Georgia, serif', estilo: 'italic', peso: 500 },
  sans: { familia: 'Inter, Arial, sans-serif', estilo: 'normal', peso: 600 },
  condensada: { familia: 'Oswald, "Arial Narrow", sans-serif', estilo: 'normal', peso: 500 },
  display: { familia: '"Bebas Neue", Impact, sans-serif', estilo: 'normal', peso: 400 },
  mano: { familia: 'Caveat, cursive', estilo: 'normal', peso: 700 },
  maquina: { familia: '"Special Elite", "Courier New", monospace', estilo: 'normal', peso: 400 },
  mono: { familia: '"IBM Plex Mono", monospace', estilo: 'normal', peso: 500 },
  deco: { familia: 'Limelight, Georgia, serif', estilo: 'normal', peso: 400 },
};

/** La familia CSS de cada fuente, para usarla también en la interfaz. */
export function familiaDe(f: Fuente) {
  return FAMILIAS[f];
}

/** Fuentes que hay que tener cargadas antes de dibujar en canvas. */
export const FUENTES_CANVAS = [
  '500 20px "EB Garamond"',
  'italic 500 20px "EB Garamond"',
  '600 20px "Playfair Display"',
  '400 20px Inter',
  '600 20px Inter',
  '500 20px Oswald',
  '400 20px "Bebas Neue"',
  '700 20px Caveat',
  '400 20px "Special Elite"',
];

export function fuenteCSS(f: Fuente, px: number, peso?: number) {
  const d = FAMILIAS[f];
  return `${d.estilo} ${peso ?? d.peso} ${Math.max(4, px).toFixed(1)}px ${d.familia}`;
}

export type Ctx = CanvasRenderingContext2D & { letterSpacing: string };

export function espaciado(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px.toFixed(2)}px`;
}

function mayus(t: string, si?: boolean) {
  return si ? t.toLocaleUpperCase('es') : t;
}

function partirEnDos(t: string): [string, string] | null {
  const palabras = t.split(' ');
  if (palabras.length < 2) return null;
  let mejor = 1;
  let dif = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(' ').length;
    const b = palabras.slice(i).join(' ').length;
    if (Math.abs(a - b) < dif) {
      dif = Math.abs(a - b);
      mejor = i;
    }
  }
  return [palabras.slice(0, mejor).join(' '), palabras.slice(mejor).join(' ')];
}

interface OpcTexto {
  fuente: Fuente;
  color: string;
  maxPx: number;
  peso?: number;
  espaciado?: number;
  dosLineas?: boolean;
}

/** Texto que corre de arriba hacia abajo por el lomo (se lee inclinando la cabeza a la derecha). */
function textoVertical(ctx: Ctx, texto: string, cx: number, y0: number, y1: number, anchoDisp: number, o: OpcTexto) {
  if (!texto.trim()) return;
  const largo = y1 - y0;
  const medir = (s: string, px: number) => {
    ctx.font = fuenteCSS(o.fuente, px, o.peso);
    espaciado(ctx, (o.espaciado ?? 0) * px);
    return ctx.measureText(s).width;
  };
  ctx.save();
  ctx.translate(cx, (y0 + y1) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.color;
  let px = o.maxPx;
  const w = medir(texto, px);
  if (w > largo) px *= largo / w;
  if (o.dosLineas && px < o.maxPx * 0.62) {
    const partes = partirEnDos(texto);
    if (partes) {
      let px2 = Math.min(o.maxPx * 0.6, anchoDisp * 0.4);
      const w2 = Math.max(medir(partes[0], px2), medir(partes[1], px2));
      if (w2 > largo) px2 *= largo / w2;
      if (px2 > px * 1.12) {
        medir('', px2);
        const sep = px2 * 0.58;
        ctx.fillText(partes[0], 0, -sep);
        ctx.fillText(partes[1], 0, sep);
        ctx.restore();
        return;
      }
    }
  }
  medir('', px);
  ctx.fillText(texto, 0, 0);
  ctx.restore();
}

export function envolver(ctx: Ctx, texto: string, anchoMax: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= anchoMax || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Texto horizontal centrado y ajustado a un ancho; devuelve la altura que ocupó. */
function textoHorizontal(
  ctx: Ctx,
  texto: string,
  cx: number,
  cy: number,
  anchoMax: number,
  o: OpcTexto & { maxLineas?: number; interlineado?: number },
) {
  if (!texto.trim()) return 0;
  const maxLineas = o.maxLineas ?? 3;
  let px = o.maxPx;
  let lineas: string[] = [];
  for (let i = 0; i < 40; i++) {
    ctx.font = fuenteCSS(o.fuente, px, o.peso);
    espaciado(ctx, (o.espaciado ?? 0) * px);
    lineas = envolver(ctx, texto, anchoMax);
    const masAncha = Math.max(...lineas.map((l) => ctx.measureText(l).width));
    if (lineas.length <= maxLineas && masAncha <= anchoMax) break;
    px *= 0.92;
  }
  const alto = px * (o.interlineado ?? 1.15);
  ctx.fillStyle = o.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = alto * lineas.length;
  lineas.forEach((l, i) => ctx.fillText(l, cx, cy - total / 2 + alto * (i + 0.5)));
  return total;
}

export function dibujarLogo(ctx: Ctx, L: Lomo, cx: number, cy: number, tam: number, anchoLomo: number) {
  const color = L.colorLogo ?? L.texto;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, tam * 0.08);
  ctx.beginPath();
  switch (L.logo) {
    case 'circulo':
      ctx.arc(cx, cy, tam * 0.34, 0.3, Math.PI * 2 - 0.3);
      ctx.stroke();
      break;
    case 'cuadro':
      ctx.roundRect(cx - tam * 0.34, cy - tam * 0.34, tam * 0.68, tam * 0.68, tam * 0.08);
      ctx.stroke();
      ctx.fillRect(cx - tam * 0.05, cy - tam * 0.22, tam * 0.1, tam * 0.24);
      ctx.fillRect(cx - tam * 0.05, cy + tam * 0.08, tam * 0.1, tam * 0.1);
      break;
    case 'pluma':
      ctx.moveTo(cx, cy + tam * 0.46);
      ctx.quadraticCurveTo(cx + tam * 0.38, cy + tam * 0.04, cx + tam * 0.27, cy - tam * 0.38);
      ctx.lineTo(cx - tam * 0.27, cy - tam * 0.38);
      ctx.quadraticCurveTo(cx - tam * 0.38, cy + tam * 0.04, cx, cy + tam * 0.46);
      ctx.fill();
      ctx.strokeStyle = L.fondo;
      ctx.lineWidth = Math.max(1, tam * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx, cy + tam * 0.42);
      ctx.lineTo(cx, cy - tam * 0.02);
      ctx.stroke();
      ctx.fillStyle = L.fondo;
      ctx.beginPath();
      ctx.arc(cx, cy - tam * 0.06, tam * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangulo':
      ctx.moveTo(cx, cy - tam * 0.34);
      ctx.lineTo(cx + tam * 0.34, cy + tam * 0.28);
      ctx.lineTo(cx - tam * 0.34, cy + tam * 0.28);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - tam * 0.06);
      ctx.lineTo(cx + tam * 0.15, cy + tam * 0.2);
      ctx.lineTo(cx - tam * 0.15, cy + tam * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'casa':
      ctx.moveTo(cx - tam * 0.3, cy + tam * 0.3);
      ctx.lineTo(cx - tam * 0.3, cy - tam * 0.06);
      ctx.lineTo(cx, cy - tam * 0.34);
      ctx.lineTo(cx + tam * 0.3, cy - tam * 0.06);
      ctx.lineTo(cx + tam * 0.3, cy + tam * 0.3);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'letra':
      ctx.font = fuenteCSS('garamond', tam * 0.85, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.logoTexto ?? '', cx, cy);
      break;
    case 'texto': {
      const t = L.logoTexto ?? '';
      ctx.font = fuenteCSS('sans', tam * 0.42, 600);
      const ancho = ctx.measureText(t).width;
      if (ancho > anchoLomo * 0.86 && t.length > 4) {
        textoVertical(ctx, t, cx, cy - tam * 0.9, cy + tam * 0.5, anchoLomo, {
          fuente: 'sans',
          color,
          maxPx: anchoLomo * 0.3,
        });
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const px = Math.min(tam * 0.42, (anchoLomo * 0.84 * tam * 0.42) / Math.max(1, ancho));
        ctx.font = fuenteCSS('sans', px, 600);
        ctx.fillText(t, cx, cy);
      }
      break;
    }
  }
  ctx.restore();
}

function dibujarPatron(ctx: Ctx, L: Lomo, w: number, h: number, r: () => number) {
  const color = L.acento ?? L.texto;
  ctx.save();
  switch (L.patron) {
    case 'puntos':
      for (let y = 0; y < h; y += 6) {
        ctx.fillStyle = rgba(color, 0.12 + 0.4 * (y / h));
        for (let x = (y / 6) % 2 ? 3 : 0; x < w; x += 6) ctx.fillRect(x, y, 1.6, 1.6);
      }
      break;
    case 'escamas':
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.lineWidth = 1.1;
      for (let y = 0, fila = 0; y < h + 10; y += 8, fila++) {
        for (let x = fila % 2 ? 5 : 0; x < w + 10; x += 10) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI);
          ctx.stroke();
        }
      }
      break;
    case 'pasto':
      ctx.lineWidth = 1;
      for (let i = 0; i < (w * h) / 30; i++) {
        const x = r() * w;
        const y = r() * h;
        ctx.strokeStyle = rgba(color, 0.3 + r() * 0.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 8);
        ctx.stroke();
      }
      break;
    case 'rombos':
      ctx.strokeStyle = rgba(color, 0.45);
      ctx.lineWidth = 1;
      for (let i = -h; i < w + h; i += 12) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.moveTo(i, 0);
        ctx.lineTo(i - h, h);
        ctx.stroke();
      }
      break;
    case 'huella':
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.lineWidth = 1.2;
      for (let k = 1; k < 9; k++) {
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.52, (w * 0.42 * k) / 9, (w * 0.62 * k) / 9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'acuarela':
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rgba(color, 0.08 + r() * 0.16);
        ctx.beginPath();
        ctx.arc(r() * w, r() * h, w * (0.3 + r() * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}

/** Toque final: volumen del lomo, bordes, pliegues de lectura, desgaste y grano. */
export function terminar(ctx: Ctx, w: number, h: number, L: Lomo, semilla: number, esLomo: boolean) {
  const r = rng(semilla + 7);
  if (esLomo) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.24)');
    g.addColorStop(0.18, 'rgba(0,0,0,0.04)');
    g.addColorStop(0.42, `rgba(255,255,255,${0.04 + (L.brillo ?? 0.3) * 0.09})`);
    g.addColorStop(0.78, 'rgba(0,0,0,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, 0, w, 2);
  ctx.fillRect(0, h - 2, w, 2);
  const gastado = L.gastado ?? 0.08;
  if (esLomo) {
    const pliegues = Math.round(gastado * 8);
    for (let i = 0; i < pliegues; i++) {
      const x = w * (0.2 + r() * 0.6);
      ctx.strokeStyle = `rgba(255,250,235,${0.14 + gastado * 0.32})`;
      ctx.lineWidth = 0.7 + r();
      ctx.beginPath();
      let y = h * r() * 0.3;
      ctx.moveTo(x, y);
      const fin = h * (0.6 + r() * 0.4);
      while (y < fin) {
        y += 12;
        ctx.lineTo(x + (r() - 0.5) * 2.5, y);
      }
      ctx.stroke();
    }
  }
  if (gastado > 0.3) {
    for (let i = 0; i < 40 * gastado; i++) {
      const enBorde = r() > 0.5;
      const x = enBorde ? (r() > 0.5 ? r() * w * 0.15 : w - r() * w * 0.15) : r() * w;
      const y = r() > 0.6 ? (r() > 0.5 ? r() * h * 0.08 : h - r() * h * 0.08) : r() * h;
      ctx.fillStyle = `rgba(240,232,212,${0.12 + r() * 0.4 * gastado})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + r() * w * 0.12, 1 + r() * 8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grano(ctx, w, h, 9 + gastado * 18, semilla);
}

/* --------------------------------------------------------------- cuero */

function dibujarCuero(ctx: Ctx, libro: Libro, w: number, h: number, r: () => number, esTapa: boolean) {
  const L = libro.lomo;
  const oro = L.texto;
  for (let i = 0; i < (w * h) / 120; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,220,180,0.05)';
    ctx.beginPath();
    ctx.ellipse(r() * w, r() * h, 2 + r() * 10, 1 + r() * 6, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const linea = (y: number, grosor = 1.6) => {
    ctx.fillStyle = oro;
    ctx.fillRect(w * 0.04, y, w * 0.92, grosor);
  };
  const editorial = libro.editorial?.split('·').pop()?.trim() ?? '';
  const palabrasAutor = libro.autor.split(' ');
  if (esTapa) {
    ctx.strokeStyle = oro;
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(w * 0.08, h * 0.065, w * 0.84, h * 0.87);
    textoHorizontal(ctx, libro.autor, w / 2, h * 0.32, w * 0.7, { fuente: 'serif', color: oro, maxPx: w * 0.09, maxLineas: 2 });
    textoHorizontal(ctx, libro.titulo, w / 2, h * 0.5, w * 0.7, { fuente: 'garamond', color: oro, maxPx: w * 0.07, maxLineas: 2 });
    textoHorizontal(ctx, editorial.toLocaleUpperCase('es'), w / 2, h * 0.85, w * 0.6, { fuente: 'serif', color: oro, maxPx: w * 0.04 });
    return;
  }
  ctx.fillStyle = L.acento ?? '#8a4c2a';
  ctx.fillRect(w * 0.06, h * 0.055, w * 0.88, h * 0.31);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(w * 0.06, h * 0.395, w * 0.88, h * 0.23);
  for (const y of [0.035, 0.05, 0.37, 0.385, 0.63, 0.645, 0.95, 0.965]) linea(h * y);
  const ed = editorial.toLocaleUpperCase('es').split(' ');
  textoHorizontal(ctx, ed.join(' '), w / 2, h * 0.12, w * 0.82, { fuente: 'serif', color: oro, maxPx: w * 0.2, maxLineas: 2 });
  const tomo = /\b(I{1,3}|IV|V|\d+)\s*$/.exec(libro.titulo)?.[1] ?? '';
  const numero = tomo === 'I' ? '1' : tomo === 'II' ? '2' : tomo;
  textoHorizontal(ctx, numero, w / 2, h * 0.3, w * 0.6, { fuente: 'serif', color: oro, maxPx: w * 0.2 });
  const autorLineas = palabrasAutor.length > 2 ? [palabrasAutor[0], palabrasAutor[1], palabrasAutor.slice(2).join(' ')] : palabrasAutor;
  autorLineas.forEach((p, i) =>
    textoHorizontal(ctx, p, w / 2, h * (0.44 + i * 0.055), w * 0.84, { fuente: 'serif', color: oro, maxPx: w * 0.17 }),
  );
  const tituloSinTomo = libro.titulo.replace(/\s+(I{1,3}|IV|V|\d+)\s*$/, '');
  textoHorizontal(ctx, tituloSinTomo, w / 2, h * 0.69, w * 0.82, { fuente: 'serif', color: oro, maxPx: w * 0.13, maxLineas: 2 });
  textoHorizontal(ctx, '*', w / 2, h * 0.75, w * 0.4, { fuente: 'serif', color: oro, maxPx: w * 0.12 });
  textoHorizontal(ctx, L.logoTexto ?? '', w / 2, h * 0.92, w * 0.82, { fuente: 'serif', color: oro, maxPx: w * 0.12 });
}

/* --------------------------------------------------------------- lomo */

export function dibujarLomo(libro: Libro): HTMLCanvasElement {
  const L = libro.lomo;
  const w = Math.max(24, Math.round(libro.grosor * PX_LOMO));
  const h = Math.round(libro.alto * PX_LOMO);
  const { c, ctx: ctx0 } = lienzo(w, h);
  const ctx = ctx0 as Ctx;
  const semilla = hash(libro.id);
  const r = rng(semilla);
  const colorAutor = L.colorAutor ?? L.texto;
  const colorTitulo = L.colorTitulo ?? L.texto;
  const fuenteT: Fuente = L.fuente ?? 'sans';
  const fuenteA: Fuente = L.fuenteAutor ?? fuenteT;
  const titulo = mayus(L.textoTitulo ?? libro.titulo, L.mayus);
  const autor = mayus(L.textoAutor ?? libro.autor, L.autorMayus);

  ctx.fillStyle = L.fondo;
  ctx.fillRect(0, 0, w, h);

  if (L.estilo === 'cuero') {
    dibujarCuero(ctx, libro, w, h, r, false);
    terminar(ctx, w, h, L, semilla, true);
    return c;
  }

  for (const [a, b, color] of L.bandas ?? []) {
    ctx.fillStyle = color;
    ctx.fillRect(0, a * h, w, (b - a) * h);
  }
  if (L.patron) dibujarPatron(ctx, L, w, h, r);

  if (L.estilo === 'pastilla') {
    const x0 = w * 0.17;
    const pw = w * 0.66;
    const y0 = h * 0.035;
    const y1 = h * 0.865;
    ctx.fillStyle = L.acento ?? '#888';
    ctx.beginPath();
    ctx.roundRect(x0, y0, pw, y1 - y0, pw / 2);
    ctx.fill();
    const lw = Math.max(1.2, w * 0.035);
    ctx.strokeStyle = L.borde ?? '#caa54e';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(x0 + lw * 1.4, y0 + lw * 1.4, pw - lw * 2.8, y1 - y0 - lw * 2.8, pw / 2 - lw);
    ctx.stroke();
  }
  if (L.estilo === 'etiqueta') {
    ctx.fillStyle = L.acento ?? '#1e5b3b';
    ctx.fillRect(w * 0.12, h * 0.06, w * 0.76, h * 0.6);
    ctx.strokeStyle = L.borde ?? '#b3272b';
    ctx.lineWidth = Math.max(1.5, w * 0.05);
    ctx.strokeRect(w * 0.12, h * 0.06, w * 0.76, h * 0.6);
  }

  const finTexto = L.logo ? 0.87 : 0.95;
  if (L.horizontal) {
    const tituloPrimero = L.orden === 'titulo-autor';
    let y = h * 0.07;
    const caja0 = y - h * 0.015;
    const bloques: [string, Fuente, string, number][] = tituloPrimero
      ? [
          [titulo, fuenteT, colorTitulo, w * 0.2],
          [autor, fuenteA, colorAutor, w * 0.11],
        ]
      : [
          [autor, fuenteA, colorAutor, w * 0.11],
          [titulo, fuenteT, colorTitulo, w * 0.15],
        ];
    for (const [texto, fuente, color, maxPx] of bloques) {
      ctx.font = fuenteCSS(fuente, maxPx);
      const ocupado = textoHorizontal(ctx, texto, w / 2, y + maxPx, w * 0.8, { fuente, color, maxPx, maxLineas: 3 });
      y += ocupado + maxPx * 0.9;
    }
    if (L.borde) {
      ctx.strokeStyle = L.borde;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(w * 0.1, caja0, w * 0.8, y - caja0);
    }
  } else {
    let zAutor: [number, number];
    let zTitulo: [number, number];
    const banda = L.autorEnBanda !== undefined ? L.bandas?.[L.autorEnBanda] : undefined;
    if (L.estilo === 'pastilla') {
      zAutor = [0.065, 0.4];
      zTitulo = [0.43, 0.84];
    } else if (L.estilo === 'etiqueta') {
      zTitulo = [0.09, 0.63];
      zAutor = [0.69, finTexto];
    } else if (banda) {
      zAutor = [banda[0] + 0.015, banda[1] - 0.015];
      zTitulo = [banda[1] + 0.04, finTexto];
    } else if (L.orden === 'titulo-autor') {
      zTitulo = [0.05, 0.6];
      zAutor = [0.64, finTexto];
    } else {
      zAutor = [0.05, 0.36];
      zTitulo = [0.4, finTexto];
    }
    textoVertical(ctx, autor, w / 2, zAutor[0] * h, zAutor[1] * h, w, {
      fuente: fuenteA,
      color: colorAutor,
      maxPx: w * (fuenteA === 'mano' ? 0.62 : 0.4),
      espaciado: L.autorMayus ? 0.06 : 0,
    });
    textoVertical(ctx, titulo, w / 2, zTitulo[0] * h, zTitulo[1] * h, w, {
      fuente: fuenteT,
      color: colorTitulo,
      maxPx: w * (fuenteT === 'display' || fuenteT === 'condensada' ? 0.66 : 0.56),
      espaciado: L.mayus ? 0.04 : 0,
      dosLineas: libro.grosor >= 2.2,
    });
  }
  if (L.logo) dibujarLogo(ctx, L, w / 2, h * 0.935, Math.min(w * 0.6, h * 0.05), w);
  terminar(ctx, w, h, L, semilla, true);
  return c;
}

/* --------------------------------------------------------------- tapa */

export function dibujarTapa(libro: Libro): HTMLCanvasElement {
  const L = libro.lomo;
  const W = Math.round(libro.ancho * PX_TAPA);
  const H = Math.round(libro.alto * PX_TAPA);
  const { c, ctx: ctx0 } = lienzo(W, H);
  const ctx = ctx0 as Ctx;
  const semilla = hash(libro.id) + 99;
  const r = rng(semilla);
  const colorAutor = L.colorAutor ?? L.texto;
  const colorTitulo = L.colorTitulo ?? L.texto;
  const fuenteT: Fuente = L.fuente ?? 'sans';
  const fuenteA: Fuente = L.fuenteAutor ?? fuenteT;

  ctx.fillStyle = L.fondo;
  ctx.fillRect(0, 0, W, H);

  if (L.estilo === 'cuero') {
    dibujarCuero(ctx, libro, W, H, r, true);
    terminar(ctx, W, H, L, semilla, false);
    return c;
  }
  for (const [a, b, color] of L.bandas ?? []) {
    ctx.fillStyle = color;
    ctx.fillRect(0, a * H, W, (b - a) * H);
  }
  if (L.patron) dibujarPatron(ctx, L, W, H, r);

  const anchoTexto = W * 0.78;
  if (L.estilo === 'pastilla') {
    ctx.fillStyle = L.acento ?? '#888';
    ctx.beginPath();
    ctx.roundRect(W * 0.09, H * 0.06, W * 0.82, H * 0.74, W * 0.1);
    ctx.fill();
    ctx.strokeStyle = L.borde ?? '#caa54e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(W * 0.11, H * 0.072, W * 0.78, H * 0.716, W * 0.09);
    ctx.stroke();
    textoHorizontal(ctx, libro.autor.toLocaleUpperCase('es'), W / 2, H * 0.16, anchoTexto * 0.9, { fuente: 'condensada', color: colorAutor, maxPx: W * 0.08, espaciado: 0.08 });
    textoHorizontal(ctx, libro.titulo.toLocaleUpperCase('es'), W / 2, H * 0.44, anchoTexto * 0.9, { fuente: 'condensada', color: colorTitulo, maxPx: W * 0.14, maxLineas: 4, interlineado: 1.05 });
    const logo: Lomo = { ...L, fondo: L.fondo };
    dibujarLogo(ctx, logo, W / 2, H * 0.9, W * 0.14, W);
    terminar(ctx, W, H, L, semilla, false);
    return c;
  }

  let yTitulo = H * 0.4;
  if (L.estilo === 'etiqueta') {
    ctx.fillStyle = L.acento ?? '#1e5b3b';
    ctx.fillRect(W * 0.12, H * 0.24, W * 0.76, H * 0.32);
    ctx.strokeStyle = L.borde ?? '#b3272b';
    ctx.lineWidth = 6;
    ctx.strokeRect(W * 0.12, H * 0.24, W * 0.76, H * 0.32);
    yTitulo = H * 0.4;
  }

  const banda = L.autorEnBanda !== undefined ? L.bandas?.[L.autorEnBanda] : undefined;
  const yAutor = banda ? ((banda[0] + banda[1]) / 2) * H : L.orden === 'titulo-autor' ? H * 0.62 : H * 0.16;
  textoHorizontal(ctx, mayus(libro.autor, L.autorMayus), W / 2, yAutor, anchoTexto, {
    fuente: fuenteA,
    color: colorAutor,
    maxPx: W * (fuenteA === 'mano' ? 0.12 : 0.07),
    espaciado: L.autorMayus ? 0.1 : 0.02,
    maxLineas: 2,
  });
  const altoTitulo = textoHorizontal(ctx, mayus(libro.titulo, L.mayus), W / 2, yTitulo, anchoTexto, {
    fuente: fuenteT,
    color: colorTitulo,
    maxPx: W * (fuenteT === 'display' || fuenteT === 'condensada' ? 0.15 : 0.12),
    maxLineas: 4,
    interlineado: 1.08,
  });
  ctx.fillStyle = rgba(colorTitulo, 0.55);
  ctx.fillRect(W / 2 - W * 0.06, yTitulo + altoTitulo / 2 + H * 0.025, W * 0.12, 2);
  if (libro.editorial) {
    textoHorizontal(ctx, libro.editorial.toLocaleUpperCase('es'), W / 2, H * 0.93, anchoTexto * 0.7, {
      fuente: 'sans',
      color: rgba(L.colorLogo ?? L.texto, 0.85),
      maxPx: W * 0.035,
      espaciado: 0.18,
    });
  }
  // Bisagra: el lomo queda a la izquierda de la tapa
  const bisagra = ctx.createLinearGradient(0, 0, W * 0.06, 0);
  bisagra.addColorStop(0, 'rgba(0,0,0,0.28)');
  bisagra.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bisagra;
  ctx.fillRect(0, 0, W * 0.06, H);
  terminar(ctx, W, H, L, semilla, false);
  return c;
}

export function dibujarContratapa(libro: Libro): HTMLCanvasElement {
  const L = libro.lomo;
  const W = Math.round(libro.ancho * 20);
  const H = Math.round(libro.alto * 20);
  const { c, ctx: ctx0 } = lienzo(W, H);
  const ctx = ctx0 as Ctx;
  const r = rng(hash(libro.id) + 3);
  ctx.fillStyle = L.estilo === 'pastilla' ? L.fondo : L.fondo;
  ctx.fillRect(0, 0, W, H);
  if (L.estilo !== 'cuero') {
    ctx.fillStyle = rgba(L.texto, 0.32);
    for (let y = H * 0.2; y < H * 0.62; y += H * 0.022) {
      const ancho = W * (0.6 + r() * 0.12);
      ctx.fillRect(W * 0.14, y, y > H * 0.6 ? ancho * 0.5 : ancho, H * 0.008);
    }
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(W * 0.58, H * 0.8, W * 0.3, H * 0.1);
    ctx.fillStyle = '#111';
    for (let x = W * 0.6; x < W * 0.86; x += 2 + Math.floor(r() * 3)) ctx.fillRect(x, H * 0.815, 1 + Math.floor(r() * 2), H * 0.065);
  }
  const bisagra = ctx.createLinearGradient(W, 0, W * 0.94, 0);
  bisagra.addColorStop(0, 'rgba(0,0,0,0.28)');
  bisagra.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bisagra;
  ctx.fillRect(W * 0.94, 0, W * 0.06, H);
  terminar(ctx, W, H, L, hash(libro.id) + 5, false);
  return c;
}
