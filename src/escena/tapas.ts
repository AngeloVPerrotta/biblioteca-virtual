/**
 * Tapas dibujadas según la edición real de cada libro (datos/tapas.json): colores, tipografía,
 * dónde va cada texto y una ilustración simple que recuerda a la de la tapa.
 * Se dibujan recién cuando el libro se mira de cerca, así que no pesan en la carga.
 */
import tapasJson from '../datos/tapas.json';
import type { Fuente, Libro } from '../datos/tipos';
import { hash, rng } from '../util/aleatorio';
import { dibujarLogo, espaciado, envolver, fuenteCSS, PX_TAPA, terminar, type Ctx } from './lomos';
import { lienzo, rgba } from './texturas';

export interface Letra {
  fuente: Fuente;
  peso?: number;
  mayus?: boolean;
  espaciado?: number;
}

interface TextoTapa {
  texto: string;
  fuente: Fuente;
  color: string;
  y: number;
  tam: number;
  x?: number;
  alinear?: 'centro' | 'izq' | 'der';
  peso?: number;
  espaciado?: number;
  interlineado?: number;
  ancho?: number;
  recuadro?: boolean;
  sombra?: boolean;
  /** Achica el ancho de las letras (tipografías altas y angostas). */
  estrecho?: number;
}

type Dibujo = { tipo: string } & Record<string, unknown>;

interface Tapa {
  letra?: Letra;
  fondo?: string;
  degrade?: string;
  cuero?: boolean;
  dibujos?: Dibujo[];
  textos?: TextoTapa[];
}

const TAPAS = (tapasJson as unknown as { libros: Record<string, Tapa> }).libros;

const esLupin = (libro: Libro) => libro.autor === 'Maurice Leblanc' && libro.lomo.estilo === 'pastilla';

/** La tipografía del título según la tapa real (también la usa la interfaz). */
export function letraDe(libro: Libro): Letra {
  if (esLupin(libro)) return { fuente: 'deco', mayus: true };
  return TAPAS[libro.id]?.letra ?? { fuente: libro.lomo.fuente ?? 'garamond' };
}

/** ¿Hay una tapa real descripta para este libro? */
export function tieneTapaReal(libro: Libro) {
  return esLupin(libro) || !!TAPAS[libro.id]?.textos;
}

function fuentesDe(libro: Libro): string[] {
  if (esLupin(libro)) return [fuenteCSS('deco', 20), fuenteCSS('garamond', 20, 600)];
  return [...new Set((TAPAS[libro.id]?.textos ?? []).map((t) => fuenteCSS(t.fuente, 20, t.peso)))];
}

/* ------------------------------------------------------------------ textos */

function escribir(ctx: Ctx, t: TextoTapa, W: number, H: number) {
  const alinear = t.alinear ?? 'centro';
  const x = (t.x ?? (alinear === 'centro' ? 0.5 : alinear === 'izq' ? 0.08 : 0.92)) * W;
  const ancho = (t.ancho ?? (alinear === 'centro' ? Math.min(0.86, 2 * Math.min(t.x ?? 0.5, 1 - (t.x ?? 0.5)) - 0.04) : alinear === 'izq' ? 0.92 - (t.x ?? 0.08) : (t.x ?? 0.92) - 0.08)) * W;
  const estrecho = t.estrecho ?? 1;
  const lineas = t.texto.split('\n');
  let px = t.tam * W;
  const medir = () => {
    ctx.font = fuenteCSS(t.fuente, px, t.peso);
    espaciado(ctx, (t.espaciado ?? 0) * px);
    return Math.max(...lineas.map((l) => ctx.measureText(l).width)) * estrecho;
  };
  for (let i = 0; i < 40 && medir() > ancho; i++) px *= 0.95;
  const masAncha = medir();
  const alto = px * (t.interlineado ?? 1.12);
  ctx.save();
  ctx.fillStyle = t.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = alinear === 'centro' ? 'center' : alinear === 'izq' ? 'left' : 'right';
  if (t.sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = px * 0.12;
    ctx.shadowOffsetY = px * 0.03;
  }
  lineas.forEach((l, i) => {
    const y = t.y * H + i * alto;
    if (estrecho === 1) ctx.fillText(l, x, y);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(estrecho, 1);
      ctx.fillText(l, 0, 0);
      ctx.restore();
    }
  });
  ctx.restore();
  if (t.recuadro) {
    const pad = px * 0.45;
    const x0 = alinear === 'centro' ? x - masAncha / 2 : alinear === 'izq' ? x : x - masAncha;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(1.2, px * 0.05);
    ctx.strokeRect(x0 - pad, t.y * H - pad * 0.7, masAncha + pad * 2, alto * lineas.length + pad * 0.9);
  }
}

/* ------------------------------------------------------------------ dibujos */

const num = (d: Dibujo, k: string, porDefecto = 0) => (typeof d[k] === 'number' ? (d[k] as number) : porDefecto);
const txt = (d: Dibujo, k: string, porDefecto = '#000') => (typeof d[k] === 'string' ? (d[k] as string) : porDefecto);

function silueta(ctx: Ctx, d: Dibujo, W: number, H: number) {
  const cx = num(d, 'cx', 0.5) * W;
  const base = num(d, 'base', 1) * H;
  const a = num(d, 'alto', 0.3) * H;
  ctx.fillStyle = txt(d, 'color');
  // Cabeza
  ctx.beginPath();
  ctx.ellipse(cx, base - a * 0.9, a * 0.062, a * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  // Torso, con hombros redondeados
  ctx.beginPath();
  ctx.moveTo(cx - a * 0.04, base - a * 0.82);
  ctx.quadraticCurveTo(cx - a * 0.15, base - a * 0.8, cx - a * 0.14, base - a * 0.66);
  if (d.vestido) {
    ctx.lineTo(cx - a * 0.2, base - a * 0.06);
    ctx.lineTo(cx + a * 0.2, base - a * 0.06);
  } else {
    ctx.lineTo(cx - a * 0.12, base - a * 0.42);
    ctx.lineTo(cx + a * 0.12, base - a * 0.42);
  }
  ctx.lineTo(cx + a * 0.14, base - a * 0.66);
  ctx.quadraticCurveTo(cx + a * 0.15, base - a * 0.8, cx + a * 0.04, base - a * 0.82);
  ctx.closePath();
  ctx.fill();
  // Piernas
  const piernas = d.vestido ? a * 0.03 : a * 0.05;
  ctx.fillRect(cx - a * 0.09, base - a * (d.vestido ? 0.07 : 0.43), piernas, a * (d.vestido ? 0.07 : 0.43));
  ctx.fillRect(cx + a * 0.09 - piernas, base - a * (d.vestido ? 0.07 : 0.43), piernas, a * (d.vestido ? 0.07 : 0.43));
  if (d.galera) {
    ctx.fillRect(cx - a * 0.1, base - a * 0.965, a * 0.2, a * 0.02);
    ctx.fillRect(cx - a * 0.058, base - a * 1.1, a * 0.116, a * 0.14);
  }
  if (d.paraguas) {
    ctx.beginPath();
    ctx.ellipse(cx, base - a * 1.0, a * 0.32, a * 0.16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - a * 0.008, base - a * 1.0, a * 0.016, a * 0.25);
  }
}

function retrato(ctx: Ctx, d: Dibujo, W: number, H: number) {
  const cx = num(d, 'cx', 0.5) * W;
  const base = num(d, 'base', 1) * H;
  const a = num(d, 'alto', 0.4) * H;
  ctx.fillStyle = txt(d, 'color');
  // Hombros
  ctx.beginPath();
  ctx.moveTo(cx - a * 0.55, base);
  ctx.quadraticCurveTo(cx - a * 0.5, base - a * 0.42, cx - a * 0.1, base - a * 0.46);
  ctx.lineTo(cx + a * 0.1, base - a * 0.46);
  ctx.quadraticCurveTo(cx + a * 0.5, base - a * 0.42, cx + a * 0.55, base);
  ctx.closePath();
  ctx.fill();
  // Cuello y cabeza
  ctx.fillRect(cx - a * 0.08, base - a * 0.58, a * 0.16, a * 0.16);
  ctx.beginPath();
  if (d.perfil) {
    ctx.ellipse(cx, base - a * 0.75, a * 0.17, a * 0.21, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - a * 0.2, base - a * 0.66, a * 0.08, a * 0.3, 0.2, 0, Math.PI * 2);
  } else ctx.ellipse(cx, base - a * 0.76, a * 0.16, a * (d.calvo ? 0.2 : 0.21), 0, 0, Math.PI * 2);
  ctx.fill();
}

function pieza(ctx: Ctx, d: Dibujo, W: number, H: number) {
  const cx = num(d, 'cx', 0.5) * W;
  const base = num(d, 'base', 1) * H;
  const a = num(d, 'alto', 0.3) * H;
  ctx.beginPath();
  ctx.moveTo(cx - a * 0.26, base);
  ctx.lineTo(cx + a * 0.26, base);
  ctx.lineTo(cx + a * 0.22, base - a * 0.08);
  ctx.lineTo(cx + a * 0.15, base - a * 0.12);
  ctx.quadraticCurveTo(cx + a * 0.08, base - a * 0.4, cx + a * 0.09, base - a * 0.62);
  ctx.lineTo(cx + a * 0.15, base - a * 0.66);
  ctx.lineTo(cx + a * 0.12, base - a * 0.72);
  ctx.lineTo(cx - a * 0.12, base - a * 0.72);
  ctx.lineTo(cx - a * 0.15, base - a * 0.66);
  ctx.lineTo(cx - a * 0.09, base - a * 0.62);
  ctx.quadraticCurveTo(cx - a * 0.08, base - a * 0.4, cx - a * 0.15, base - a * 0.12);
  ctx.lineTo(cx - a * 0.22, base - a * 0.08);
  ctx.closePath();
  ctx.moveTo(cx + a * 0.13, base - a * 0.82);
  ctx.ellipse(cx, base - a * 0.82, a * 0.13, a * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = txt(d, 'color');
  ctx.fill();
  if (d.rey) {
    ctx.fillRect(cx - a * 0.018, base - a * 1.02, a * 0.036, a * 0.14);
    ctx.fillRect(cx - a * 0.06, base - a * 0.98, a * 0.12, a * 0.034);
  } else {
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.arc(cx + k * a * 0.07, base - a * 0.94, a * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (d.contorno) {
    ctx.strokeStyle = txt(d, 'contorno');
    ctx.lineWidth = Math.max(1, a * 0.012);
    ctx.stroke();
  }
}

function huella(ctx: Ctx, d: Dibujo, W: number, H: number, r: () => number) {
  const cx = num(d, 'cx', 0.5) * W;
  const cy = num(d, 'cy', 0.5) * H;
  const R = num(d, 'r', 0.4) * W;
  ctx.strokeStyle = txt(d, 'color');
  ctx.lineWidth = R * 0.028;
  ctx.lineCap = 'round';
  for (let k = 1; k <= 24; k++) {
    const rx = (R * k) / 24;
    const ry = rx * 1.32;
    const partes = 1 + Math.floor(r() * 3);
    for (let p = 0; p < partes; p++) {
      const a0 = r() * Math.PI * 2;
      const largo = (Math.PI * 2) / partes - 0.15 - r() * 0.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + (24 - k) * R * 0.006, rx, ry, 0, a0, a0 + largo);
      ctx.stroke();
    }
  }
}

function dibujar(ctx: Ctx, d: Dibujo, W: number, H: number, r: () => number, fondo: string) {
  const color = txt(d, 'color');
  const X = num(d, 'x') * W;
  const Y = num(d, 'y') * H;
  const w = num(d, 'w', 1) * W;
  const h = num(d, 'h', 1) * H;
  const cx = num(d, 'cx', 0.5) * W;
  const cy = num(d, 'cy', 0.5) * H;
  ctx.save();
  switch (d.tipo) {
    case 'rect': {
      ctx.fillStyle = color;
      ctx.fillRect(X, Y, w, h);
      if (d.textura) {
        for (let i = 0; i < (w * h) / 60; i++) {
          ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
          ctx.beginPath();
          ctx.ellipse(X + r() * w, Y + r() * h, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (d.borde) {
        const g = W * 0.014;
        ctx.strokeStyle = txt(d, 'borde');
        ctx.lineWidth = g;
        ctx.strokeRect(X + g * 1.5, Y + g * 1.5, w - g * 3, h - g * 3);
      }
      break;
    }
    case 'foto': {
      const b = num(d, 'borde') * W;
      if (b) {
        ctx.fillStyle = '#f4f1ea';
        ctx.fillRect(X - b, Y - b, w + 2 * b, h + 2 * b + b * 1.6);
      }
      const g = ctx.createLinearGradient(0, Y, 0, Y + h);
      g.addColorStop(0, color);
      g.addColorStop(1, txt(d, 'color2', color));
      ctx.fillStyle = g;
      ctx.fillRect(X, Y, w, h);
      if (d.relieve) {
        // Un friso: figuras clásicas en relieve, apenas sugeridas
        for (let i = 0; i < 9; i++) {
          const fx = X + w * (0.06 + i * 0.11 + r() * 0.03);
          ctx.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.1})`;
          ctx.beginPath();
          ctx.ellipse(fx, Y + h * 0.3, w * 0.025, h * 0.09, 0, 0, Math.PI * 2);
          ctx.ellipse(fx, Y + h * 0.65, w * 0.04, h * 0.28, (r() - 0.5) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Viñeta y grano de foto impresa
      const v = ctx.createRadialGradient(X + w / 2, Y + h / 2, Math.min(w, h) * 0.2, X + w / 2, Y + h / 2, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = v;
      ctx.fillRect(X, Y, w, h);
      break;
    }
    case 'marco': {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, W * 0.006);
      ctx.strokeRect(X, Y, w, h);
      if (d.doble) {
        const s = W * 0.018;
        ctx.lineWidth = Math.max(1, W * 0.003);
        ctx.strokeRect(X + s, Y + s, w - 2 * s, h - 2 * s);
      }
      break;
    }
    case 'camino': {
      // Un camino claro que serpentea entre la niebla, hacia el horizonte
      ctx.fillStyle = rgba(color, 0.85);
      ctx.beginPath();
      ctx.moveTo(W * 0.18, H);
      ctx.bezierCurveTo(W * 0.5, H * 0.86, W * 0.7, H * 0.78, W * 0.44, H * 0.7);
      ctx.bezierCurveTo(W * 0.3, H * 0.66, W * 0.42, H * 0.61, W * 0.48, H * 0.6);
      ctx.bezierCurveTo(W * 0.46, H * 0.62, W * 0.38, H * 0.66, W * 0.52, H * 0.7);
      ctx.bezierCurveTo(W * 0.86, H * 0.8, W * 0.7, H * 0.9, W * 0.6, H);
      ctx.closePath();
      ctx.fill();
      const niebla = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.7);
      niebla.addColorStop(0, 'rgba(235,235,232,0.7)');
      niebla.addColorStop(1, 'rgba(235,235,232,0)');
      ctx.fillStyle = niebla;
      ctx.fillRect(0, H * 0.45, W, H * 0.25);
      break;
    }
    case 'persona':
      silueta(ctx, d, W, H);
      break;
    case 'retrato':
      retrato(ctx, d, W, H);
      break;
    case 'pieza':
      pieza(ctx, d, W, H);
      break;
    case 'huella':
      huella(ctx, d, W, H, r);
      break;
    case 'pajaro': {
      const t = num(d, 'tam', 0.4) * W;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      if (d.vuela) {
        ctx.lineWidth = t * 0.08;
        ctx.beginPath();
        ctx.moveTo(cx - t / 2, cy);
        ctx.quadraticCurveTo(cx - t / 4, cy - t * 0.3, cx, cy);
        ctx.quadraticCurveTo(cx + t / 4, cy - t * 0.3, cx + t / 2, cy);
        ctx.stroke();
        break;
      }
      // Rama pelada que cruza la tapa y un pájaro posado
      ctx.lineWidth = t * 0.014;
      ctx.beginPath();
      ctx.moveTo(0, cy + t * 0.12);
      ctx.quadraticCurveTo(cx, cy + t * 0.02, W, cy - t * 0.1);
      ctx.stroke();
      ctx.lineWidth = t * 0.006;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const bx = W * (0.05 + i * 0.11);
        const by = cy + t * 0.1 - (bx / W) * t * 0.2;
        if (Math.abs(bx - cx) < t * 0.12) continue;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (r() - 0.2) * t * 0.12, by - t * (0.05 + r() * 0.1));
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy - t * 0.06, t * 0.085, t * 0.06, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + t * 0.075, cy - t * 0.12, t * 0.036, t * 0.034, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - t * 0.08, cy - t * 0.05);
      ctx.lineTo(cx - t * 0.24, cy + t * 0.04);
      ctx.lineTo(cx - t * 0.2, cy + t * 0.07);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'circulos': {
      const R = num(d, 'r', 0.6) * W;
      const n = num(d, 'n', 20);
      for (let k = 1; k <= n; k++) {
        ctx.strokeStyle = rgba(color, 0.35 + 0.5 * ((k % 3) / 2));
        ctx.lineWidth = (R / n) * (0.25 + (k % 2) * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, (R * k) / n, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'sol': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, num(d, 'r', 0.1) * W, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arbol': {
      const base = num(d, 'base', 1) * H;
      const a = num(d, 'alto', 0.3) * H;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = a * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx, base);
      ctx.quadraticCurveTo(cx + (d.pino ? a * 0.2 : 0), base - a * 0.5, cx + (d.pino ? a * 0.1 : 0), base - a * 0.75);
      ctx.stroke();
      const copas = d.pino
        ? [[0.1, -0.78, 0.36, 0.08], [0.25, -0.86, 0.26, 0.06], [-0.05, -0.68, 0.26, 0.06], [0.18, -0.95, 0.16, 0.05]]
        : [[0, -0.82, 0.22, 0.2], [-0.15, -0.7, 0.16, 0.14], [0.15, -0.7, 0.16, 0.14]];
      for (const [dx, dy, rx, ry] of copas) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * a, base + dy * a, rx * a, ry * a, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'firma': {
      // Una firma grande en birome
      const ancho = num(d, 'w', 0.6) * W;
      ctx.strokeStyle = color;
      ctx.lineWidth = W * 0.008;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let x = cx - ancho / 2;
      ctx.moveTo(x, cy);
      while (x < cx + ancho / 2) {
        const paso = W * (0.04 + r() * 0.05);
        ctx.bezierCurveTo(x + paso * 0.2, cy - W * (0.08 + r() * 0.1), x + paso * 0.9, cy - W * 0.02, x + paso, cy + W * (r() * 0.05));
        x += paso;
      }
      ctx.moveTo(cx - ancho * 0.45, cy + W * 0.06);
      ctx.quadraticCurveTo(cx, cy + W * 0.1, cx + ancho * 0.5, cy + W * 0.04);
      ctx.stroke();
      break;
    }
    case 'tablero': {
      const n = 8;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? txt(d, 'color2') : color;
          ctx.fillRect(X + (i * w) / n, Y + (j * h) / n, w / n + 0.5, h / n + 0.5);
        }
      break;
    }
    case 'bokeh': {
      const x0 = d.x === undefined ? 0 : X;
      const y0 = d.y === undefined ? 0 : Y;
      for (let i = 0; i < num(d, 'n', 40); i++) {
        ctx.fillStyle = rgba(color, 0.15 + r() * 0.55);
        ctx.beginPath();
        ctx.arc(x0 + r() * w, y0 + r() * h, W * (0.003 + r() * r() * 0.02), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'lluvia': {
      ctx.strokeStyle = rgba(color, 0.35);
      ctx.lineWidth = Math.max(1, W * 0.002);
      for (let i = 0; i < num(d, 'n', 120); i++) {
        const x = r() * W;
        const y = r() * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - W * 0.01, y + H * (0.02 + r() * 0.03));
        ctx.stroke();
      }
      break;
    }
    case 'embrion': {
      const R = num(d, 'r', 0.2) * W;
      ctx.strokeStyle = rgba(color, 0.6);
      ctx.lineWidth = R * 0.04;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      // Cuerpo enroscado en forma de C, cabeza grande arriba
      ctx.lineCap = 'round';
      ctx.lineWidth = R * 0.32;
      ctx.beginPath();
      ctx.arc(cx + R * 0.02, cy + R * 0.12, R * 0.36, -Math.PI * 0.15, Math.PI * 0.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + R * 0.2, cy - R * 0.32, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.05, cy + R * 0.12);
      ctx.quadraticCurveTo(cx - R * 0.5, cy - R * 0.2, cx - R * 0.62, cy - R * 0.7);
      ctx.stroke();
      break;
    }
    case 'boceto': {
      // Trazos sueltos en sepia, como un grabado
      ctx.strokeStyle = rgba(color, 0.7);
      ctx.lineWidth = Math.max(1.2, W * 0.004);
      for (let i = 0; i < 140; i++) {
        const fx = X + w * (0.25 + (i % 2) * 0.45 + (r() - 0.5) * 0.3);
        const fy = Y + h * (0.15 + r() * 0.8);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + (r() - 0.5) * w * 0.15, fy - h * 0.05, fx + (r() - 0.5) * w * 0.2, fy + (r() - 0.5) * h * 0.12);
        ctx.stroke();
      }
      break;
    }
    case 'sello': {
      const R = num(d, 'r', 0.15) * W;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cx - R, cy - R, 2 * R, 2 * R, R * 0.12);
      ctx.fill();
      ctx.strokeStyle = fondo;
      ctx.lineWidth = R * 0.07;
      ctx.strokeRect(cx - R * 0.82, cy - R * 0.82, R * 1.64, R * 1.64);
      ctx.lineWidth = R * 0.09;
      for (let i = 0; i < 9; i++) {
        const x = cx + (r() - 0.5) * R * 1.2;
        const y = cy + (r() - 0.5) * R * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        if (r() > 0.5) ctx.lineTo(x + R * (0.2 + r() * 0.3), y);
        else ctx.lineTo(x, y + R * (0.2 + r() * 0.3));
        ctx.stroke();
      }
      break;
    }
    case 'zigurat': {
      const base = num(d, 'base', 1) * H;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (d.piramide) {
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, base);
        ctx.lineTo(cx, base - h);
        ctx.lineTo(cx + w / 2, base);
        ctx.closePath();
        ctx.fill();
        break;
      }
      ctx.lineWidth = Math.max(1.5, W * 0.006);
      for (let k = 0; k < 5; k++) {
        const ancho = w * (1 - k * 0.18);
        ctx.strokeRect(cx - ancho / 2, base - (h / 5) * (k + 1), ancho, h / 5);
      }
      ctx.fillRect(cx - w * 0.04, base - h * 0.6, w * 0.08, h * 0.6);
      break;
    }
    case 'cortinas': {
      ctx.fillStyle = color;
      for (const lado of [-1, 1]) {
        const x0 = lado < 0 ? 0 : W;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 - lado * W * 0.3, 0);
        ctx.bezierCurveTo(x0 - lado * W * 0.18, H * 0.35, x0 - lado * W * 0.06, H * 0.55, x0 - lado * W * 0.12, H);
        ctx.lineTo(x0, H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(0, 0, W, H * 0.04);
      break;
    }
    case 'pinguinos': {
      const base = num(d, 'base', 1) * H;
      for (const [px, a] of [[0.3, 0.36], [0.62, 0.42], [0.85, 0.28]]) {
        const x = px * W;
        const alto = a * H;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, base - alto * 0.45, alto * 0.2, alto * 0.45, 0, 0, Math.PI * 2);
        ctx.ellipse(x, base - alto * 0.92, alto * 0.11, alto * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5f5f2';
        ctx.beginPath();
        ctx.ellipse(x + alto * 0.03, base - alto * 0.42, alto * 0.13, alto * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8a23a';
        ctx.beginPath();
        ctx.ellipse(x + alto * 0.1, base - alto * 0.9, alto * 0.06, alto * 0.02, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'pasillo': {
      // Un pasillo en perspectiva con una puerta iluminada al fondo
      const fx = W * 0.5;
      const fy = H * 0.5;
      ctx.strokeStyle = rgba(color, 0.4);
      ctx.lineWidth = Math.max(1, W * 0.004);
      for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H], [0, H * 0.5], [W, H * 0.5]]) {
        ctx.beginPath();
        ctx.moveTo(fx + (x - fx) * 0.15, fy + (y - fy) * 0.15);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(color, 0.6);
      ctx.fillRect(fx - W * 0.06, fy - H * 0.07, W * 0.12, H * 0.14);
      break;
    }
    case 'ventanas': {
      const cols = num(d, 'cols', 5);
      const filas = num(d, 'filas', 8);
      const cw = w / cols;
      const ch = h / filas;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < filas; j++) {
          const prendida = r() < 0.12;
          ctx.fillStyle = prendida ? txt(d, 'luz') : color;
          ctx.fillRect(X + i * cw + cw * 0.2, Y + j * ch + ch * 0.15, cw * 0.6, ch * 0.7);
          if (prendida) {
            ctx.fillStyle = 'rgba(20,20,30,0.85)';
            ctx.beginPath();
            ctx.ellipse(X + i * cw + cw * 0.5, Y + j * ch + ch * 0.42, cw * 0.06, ch * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(X + i * cw + cw * 0.42, Y + j * ch + ch * 0.5, cw * 0.16, ch * 0.35);
          }
        }
      // La puerta
      ctx.fillStyle = '#0d1226';
      ctx.beginPath();
      ctx.roundRect(W * 0.43, Y + h - ch * 1.1, W * 0.14, ch * 1.1, [W * 0.07, W * 0.07, 0, 0]);
      ctx.fill();
      break;
    }
    case 'pasto': {
      ctx.strokeStyle = rgba(color, 0.35);
      ctx.lineWidth = Math.max(1, W * 0.003);
      for (let i = 0; i < 700; i++) {
        const x = r() * W;
        const y = H * (0.2 + r() * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * W * 0.01, y - H * (0.01 + r() * 0.02));
        ctx.stroke();
      }
      break;
    }
    case 'pelota': {
      const R = num(d, 'r', 0.1) * W;
      ctx.fillStyle = '#f7f7f4';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1b1b';
      const pent = (x: number, y: number, s: number) => {
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
          ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        ctx.closePath();
        ctx.fill();
      };
      pent(cx, cy, R * 0.3);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5 + Math.PI / 5;
        pent(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, R * 0.3);
      }
      ctx.restore();
      break;
    }
    case 'lata': {
      const ancho = num(d, 'w', 0.5) * W;
      const alto = ancho * 0.62;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(cx - ancho / 2, cy - alto / 2, ancho, alto, alto * 0.45);
      ctx.fill();
      ctx.fillStyle = '#e4e7ec';
      ctx.beginPath();
      ctx.roundRect(cx - ancho * 0.44, cy - alto * 0.38, ancho * 0.88, alto * 0.76, alto * 0.36);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const fy = cy - alto * 0.2 + i * alto * 0.2;
        ctx.save();
        ctx.translate(cx, fy);
        ctx.rotate((i - 1) * 0.06);
        ctx.fillStyle = '#8c96a5';
        ctx.beginPath();
        ctx.ellipse(-ancho * 0.03, 0, ancho * 0.3, alto * 0.075, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ancho * 0.25, 0);
        ctx.lineTo(ancho * 0.36, -alto * 0.07);
        ctx.lineTo(ancho * 0.36, alto * 0.07);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c9cfd8';
        ctx.fillRect(-ancho * 0.28, -alto * 0.012, ancho * 0.48, alto * 0.02);
        ctx.fillStyle = '#20242b';
        ctx.beginPath();
        ctx.arc(-ancho * 0.26, -alto * 0.015, alto * 0.014, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // La tapa enrollada con la llavecita
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx + ancho * 0.1, cy - alto * 0.62, ancho * 0.42, alto * 0.12, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = alto * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + ancho * 0.45, cy - alto * 0.62);
      ctx.lineTo(cx + ancho * 0.62, cy - alto * 0.95);
      ctx.stroke();
      break;
    }
    case 'raja': {
      const y = num(d, 'y', 0.6) * H;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(W * 0.22, y);
      for (let x = W * 0.22; x <= W * 0.78; x += W * 0.04) ctx.lineTo(x, y - H * (0.004 + r() * 0.006));
      for (let x = W * 0.78; x >= W * 0.22; x -= W * 0.04) ctx.lineTo(x, y + H * (0.004 + r() * 0.008));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'flores': {
      for (let i = 0; i < num(d, 'n', 8); i++) {
        const fx = W * (r() < 0.5 ? 0.05 + r() * 0.25 : 0.7 + r() * 0.25);
        const fy = H * (0.3 + r() * 0.62);
        const s = W * (0.05 + r() * 0.05);
        ctx.fillStyle = color;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + r() * 0.2;
          ctx.beginPath();
          ctx.ellipse(fx + Math.cos(a) * s * 0.6, fy + Math.sin(a) * s * 0.6, s * 0.55, s * 0.28, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = txt(d, 'centro', '#f2c23a');
        ctx.beginPath();
        ctx.arc(fx, fy, s * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'hojas': {
      ctx.fillStyle = color;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(W * (0.05 + i * 0.18), H * (0.95 + r() * 0.05), W * 0.09, H * 0.12, (r() - 0.5) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'ojo': {
      const R = num(d, 'r', 0.3) * W;
      if (!d.soloIris) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - R * 1.3, cy);
        ctx.quadraticCurveTo(cx, cy - R * 1.1, cx + R * 1.3, cy);
        ctx.quadraticCurveTo(cx, cy + R * 1.1, cx - R * 1.3, cy);
        ctx.fill();
      }
      const iris = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 0.55);
      iris.addColorStop(0, '#2a1a0c');
      iris.addColorStop(0.35, txt(d, 'iris'));
      iris.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, R * 0.01);
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
        ctx.lineTo(cx + Math.cos(a) * R * 0.52, cy + Math.sin(a) * R * 0.52);
        ctx.stroke();
      }
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx + R * 0.12, cy - R * 0.12, R * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'galaxia': {
      const R = num(d, 'r', 0.4) * W;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      halo.addColorStop(0, 'rgba(255,240,220,0.95)');
      halo.addColorStop(0.12, rgba(color, 0.7));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.55, -0.3, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 900; i++) {
        const brazo = i % 2 ? 0 : Math.PI;
        const t = r() * 4;
        const a = brazo + t * 1.4 + (r() - 0.5) * 0.5;
        const rr = (t / 4) * R;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.55;
        ctx.fillStyle = `rgba(230,220,255,${0.2 + r() * 0.6})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r() * 0.8})`;
        ctx.fillRect(r() * W, r() * H, 1.2, 1.2);
      }
      break;
    }
    case 'bombillas': {
      for (const [bx, s] of [[0.28, 0.12], [0.52, 0.15], [0.76, 0.11]]) {
        const x = bx * W;
        const R = s * W;
        const brillo = ctx.createRadialGradient(x, cy, 0, x, cy, R * 2.4);
        brillo.addColorStop(0, rgba(color, 0.55));
        brillo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = brillo;
        ctx.fillRect(x - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, cy, R * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a9a96';
        ctx.fillRect(x - R * 0.25, cy + R * 0.55, R * 0.5, R * 0.42);
      }
      break;
    }
    case 'banco': {
      const base = num(d, 'base', 1) * H;
      const ancho = num(d, 'w', 0.4) * W;
      ctx.fillStyle = color;
      ctx.fillRect(cx - ancho / 2, base - ancho * 0.22, ancho, ancho * 0.04);
      ctx.fillRect(cx - ancho / 2, base - ancho * 0.36, ancho, ancho * 0.035);
      ctx.fillRect(cx - ancho / 2, base - ancho * 0.29, ancho, ancho * 0.035);
      for (const k of [-0.42, 0.42]) {
        ctx.fillRect(cx + k * ancho - ancho * 0.02, base - ancho * 0.38, ancho * 0.04, ancho * 0.38);
      }
      break;
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Lupin (Editorial Del Fondo) */

function tapaLupin(ctx: Ctx, libro: Libro, W: number, H: number) {
  const L = libro.lomo;
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, W, H);
  // El arco del color del tomo, con filete dorado
  const x0 = W * 0.15;
  const x1 = W * 0.85;
  const y0 = H * 0.14;
  const y1 = H * 0.66;
  const rad = (x1 - x0) / 2;
  const arco = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + rad);
    ctx.arc((x0 + x1) / 2, y0 + rad, rad, Math.PI, 0);
    ctx.lineTo(x1, y1);
    ctx.closePath();
  };
  arco();
  ctx.fillStyle = L.acento ?? '#6f9b4f';
  ctx.fill();
  const luz = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.5);
  luz.addColorStop(0, 'rgba(255,255,255,0.22)');
  luz.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = luz;
  ctx.fill();
  ctx.strokeStyle = L.borde ?? '#caa54e';
  ctx.lineWidth = W * 0.014;
  ctx.stroke();
  // Lupin de galera dentro del arco
  ctx.save();
  arco();
  ctx.clip();
  silueta(ctx, { tipo: 'persona', cx: 0.5, base: 0.7, alto: 0.4, color: '#0c0c0c', galera: true }, W, H);
  ctx.strokeStyle = '#e8d9a8';
  ctx.lineWidth = W * 0.006;
  ctx.beginPath();
  ctx.arc(W * 0.515, H * 0.7 - H * 0.4 * 0.9, W * 0.018, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const oro = '#d9b45a';
  escribir(ctx, { texto: 'MAURICE LEBLANC', fuente: 'garamond', peso: 600, color: oro, y: 0.025, tam: 0.042, espaciado: 0.18 }, W, H);
  escribir(ctx, { texto: 'Arsène Lupin', fuente: 'deco', color: oro, y: 0.06, tam: 0.1, sombra: true }, W, H);
  // El título, en art déco, partido en las líneas que hagan falta
  const titulo = (L.textoTitulo ?? libro.titulo).toLocaleUpperCase('es');
  ctx.font = fuenteCSS('deco', W * 0.1);
  const lineas = envolver(ctx, titulo, W * 0.8).slice(0, 3);
  escribir(ctx, { texto: lineas.join('\n'), fuente: 'deco', color: '#f3ead2', y: 0.69, tam: lineas.length > 2 ? 0.085 : 0.1, interlineado: 1.02 }, W, H);
  dibujarLogo(ctx, { ...L, fondo: '#141414' }, W / 2, H * 0.94, W * 0.11, W);
}

/* ------------------------------------------------------------------ armado */

/** Dibuja la tapa real del libro, o devuelve null si no hay una descripta. */
export async function dibujarTapaReal(libro: Libro): Promise<HTMLCanvasElement | null> {
  if (!tieneTapaReal(libro)) return null;
  await Promise.all(fuentesDe(libro).map((f) => document.fonts.load(f).catch(() => [])));
  const W = Math.round(libro.ancho * PX_TAPA);
  const H = Math.round(libro.alto * PX_TAPA);
  const { c, ctx: ctx0 } = lienzo(W, H);
  const ctx = ctx0 as Ctx;
  const semilla = hash(libro.id) + 99;
  const r = rng(semilla);
  if (esLupin(libro)) tapaLupin(ctx, libro, W, H);
  else {
    const t = TAPAS[libro.id];
    const fondo = t.fondo ?? libro.lomo.fondo;
    if (t.degrade) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, fondo);
      g.addColorStop(1, t.degrade);
      ctx.fillStyle = g;
    } else ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, W, H);
    if (t.cuero) {
      // Cuero sintético: poro fino y un brillo suave
      for (let i = 0; i < (W * H) / 50; i++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
      }
    }
    for (const d of t.dibujos ?? []) dibujar(ctx, d, W, H, r, fondo);
    for (const tx of t.textos ?? []) escribir(ctx, tx, W, H);
  }
  // Bisagra: el lomo queda a la izquierda de la tapa
  const bisagra = ctx.createLinearGradient(0, 0, W * 0.06, 0);
  bisagra.addColorStop(0, 'rgba(0,0,0,0.3)');
  bisagra.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  bisagra.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bisagra;
  ctx.fillRect(0, 0, W * 0.06, H);
  // Brillo del laminado, en diagonal
  const lam = ctx.createLinearGradient(0, 0, W, H);
  lam.addColorStop(0, 'rgba(255,255,255,0)');
  lam.addColorStop(0.45, `rgba(255,255,255,${0.03 + (libro.lomo.brillo ?? 0.3) * 0.05})`);
  lam.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = lam;
  ctx.fillRect(0, 0, W, H);
  terminar(ctx, W, H, libro.lomo, semilla, false);
  return c;
}
