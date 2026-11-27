/**
 * Texturas procedurales dibujadas en <canvas>: madera, parquet, alfombra persa,
 * pared, lino, hojas, ciudad, jacarandá, el cuadro y detalles chicos.
 * Todo se genera al cargar, así que el sitio no descarga imágenes pesadas.
 */
import * as THREE from 'three';
import { crearRuido, rng } from '../util/aleatorio';

export const config = { aniso: 8 };

export function lienzo(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // En memoria (CPU): casi todas estas texturas leen sus píxeles para el grano,
  // y leer desde la placa de video es lo que más tardaba.
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return { c, ctx };
}

export function aTextura(
  c: HTMLCanvasElement,
  opciones: { repetir?: [number, number]; color?: boolean; aniso?: number } = {},
) {
  const t = new THREE.CanvasTexture(c);
  if (opciones.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opciones.repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opciones.repetir[0], opciones.repetir[1]);
  }
  t.anisotropy = opciones.aniso ?? config.aniso;
  return t;
}

export function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number) {
  const [r, g, b] = hexARgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Tabla de ruido precalculada (largo primo, así no se alinea con el ancho de ninguna textura):
 * el grano la recorre en vez de pedir un número al azar por píxel, que era lo más lento de la carga.
 */
const LARGO_RUIDO = 65521;
let tablaRuido: Float32Array | null = null;
function ruidoBlanco() {
  if (!tablaRuido) {
    tablaRuido = new Float32Array(LARGO_RUIDO);
    const r = rng(9001);
    for (let i = 0; i < LARGO_RUIDO; i++) tablaRuido[i] = r() - 0.5;
  }
  return tablaRuido;
}

/** Suma a los píxeles un ruido de amplitud `amp` (los datos del canvas ya se recortan solos a 0–255). */
function sumarGrano(d: Uint8ClampedArray, amp: number, semilla: number) {
  const tabla = ruidoBlanco();
  let k = (Math.imul(semilla >>> 0, 2654435761) >>> 0) % LARGO_RUIDO;
  for (let i = 0; i < d.length; i += 4) {
    const n = tabla[k] * amp;
    if (++k === LARGO_RUIDO) k = 0;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
}

/** Agrega grano por píxel (papel, tela, pelo de alfombra). */
export function grano(ctx: CanvasRenderingContext2D, w: number, h: number, amp: number, semilla = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  sumarGrano(img.data, amp, semilla);
  ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------------ madera */

export function texturaMadera(
  tono: string,
  opciones: { semilla?: number; vetas?: number; contraste?: number; w?: number; h?: number } = {},
) {
  const w = opciones.w ?? 512;
  const h = opciones.h ?? 512;
  const { c, ctx } = lienzo(w, h);
  const img = ctx.createImageData(w, h);
  const [br, bg, bb] = hexARgb(tono);
  const { fbm, ruido } = crearRuido(opciones.semilla ?? 7, 8);
  const vetas = opciones.vetas ?? 9;
  const contraste = opciones.contraste ?? 0.3;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const deformar = fbm(u * 8, v * 8, 3);
      const s = Math.sin((v * vetas + deformar * 1.7) * Math.PI * 2);
      const g = Math.pow(0.5 + 0.5 * s, 3);
      const veta = ruido(u * 8, v * 64);
      const k = (1 - contraste * g) * (0.93 + 0.14 * veta);
      const i = (y * w + x) * 4;
      img.data[i] = br * k;
      img.data[i + 1] = bg * k;
      img.data[i + 2] = bb * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ----------------------------------------------------------------- parquet */

/** Parquet en espiga (herringbone), sin costuras. */
export function texturaParquet() {
  const S = 1024;
  const s = 64;
  const w = s / Math.SQRT2;
  const n = 4;
  const L = n * w;
  const { c, ctx } = lienzo(S, S);
  const r = rng(11);
  const tonos = ['#9b6a3b', '#a87645', '#8f6036', '#b27e4b', '#966539', '#a2703f', '#8a5b32', '#ad7a47'];
  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(Math.PI / 4);

  const tabla = (x: number, y: number, tw: number, th: number, horizontal: boolean) => {
    const tono = tonos[Math.floor(r() * tonos.length)];
    ctx.fillStyle = tono;
    ctx.fillRect(x, y, tw, th);
    // Vetas a lo largo de la tabla
    const lineas = 7;
    for (let i = 0; i < lineas; i++) {
      ctx.strokeStyle = r() > 0.5 ? 'rgba(60,35,15,0.16)' : 'rgba(255,225,180,0.08)';
      ctx.lineWidth = 0.6 + r() * 1.2;
      ctx.beginPath();
      if (horizontal) {
        const yy = y + ((i + r() * 0.8) / lineas) * th;
        ctx.moveTo(x, yy);
        ctx.bezierCurveTo(x + tw * 0.3, yy + (r() - 0.5) * 3, x + tw * 0.7, yy + (r() - 0.5) * 3, x + tw, yy);
      } else {
        const xx = x + ((i + r() * 0.8) / lineas) * tw;
        ctx.moveTo(xx, y);
        ctx.bezierCurveTo(xx + (r() - 0.5) * 3, y + th * 0.3, xx + (r() - 0.5) * 3, y + th * 0.7, xx, y + th);
      }
      ctx.stroke();
    }
    // Leve degradé de desgaste en el centro
    const grad = horizontal
      ? ctx.createLinearGradient(x, 0, x + tw, 0)
      : ctx.createLinearGradient(0, y, 0, y + th);
    grad.addColorStop(0, 'rgba(0,0,0,0.06)');
    grad.addColorStop(0.5, 'rgba(255,240,210,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, tw, th);
    ctx.strokeStyle = 'rgba(35,20,8,0.75)';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
  };

  for (let desplazo = -5; desplazo <= 5; desplazo++) {
    for (let k = -26; k <= 26; k++) {
      const ox = desplazo * 2 * L;
      tabla(k * w + ox, k * w, L, w, true);
      tabla(k * w + ox, k * w + w, w, L, false);
    }
  }
  ctx.restore();
  grano(ctx, S, S, 10, 12);
  return c;
}

/* -------------------------------------------------------------------- yeso */

export function texturaYeso(tono = '#efe6d8') {
  const S = 512;
  const { c, ctx } = lienzo(S, S);
  const img = ctx.createImageData(S, S);
  const [r0, g0, b0] = hexARgb(tono);
  const { fbm } = crearRuido(21, 8);
  const fino = crearRuido(22, 64);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const k = 0.97 + 0.05 * fbm(u * 8, v * 8, 5) + 0.025 * fino.ruido(u * 64, v * 64);
      const i = (y * S + x) * 4;
      img.data[i] = r0 * k;
      img.data[i + 1] = g0 * k;
      img.data[i + 2] = b0 * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* --------------------------------------------------------------------- lino */

export function texturaLino() {
  const S = 256;
  const { c, ctx } = lienzo(S, S);
  const r = rng(31);
  ctx.fillStyle = '#efe6d4';
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '255,250,240' : '150,130,100'},${0.05 + r() * 0.1})`;
    ctx.fillRect(0, y, S, 1);
  }
  for (let x = 0; x < S; x += 2) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '255,250,240' : '150,130,100'},${0.04 + r() * 0.08})`;
    ctx.fillRect(x, 0, 1, S);
  }
  // Slubs: engrosamientos típicos del lino
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(170,150,115,0.18)';
    ctx.fillRect(r() * S, r() * S, 6 + r() * 18, 1.2);
  }
  return c;
}

/* ------------------------------------------------------------------ páginas */

export function texturaPaginas(tono = '#f1e9d8') {
  const { c, ctx } = lienzo(128, 256);
  const r = rng(41);
  ctx.fillStyle = tono;
  ctx.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x++) {
    const k = r();
    ctx.fillStyle = k > 0.5 ? `rgba(120,100,70,${(k - 0.5) * 0.25})` : `rgba(255,255,250,${k * 0.15})`;
    ctx.fillRect(x, 0, 1, 256);
  }
  return c;
}

/* --------------------------------------------------------------------- hoja */

/** Hoja de singonio: verde profundo con el centro variegado y nervaduras claras. */
export function texturaHoja(variante = 0) {
  const S = 256;
  const { c, ctx } = lienzo(S, S);
  const r = rng(51 + variante);
  const g = ctx.createRadialGradient(S / 2, S * 0.62, 6, S / 2, S * 0.55, S * 0.62);
  g.addColorStop(0, variante % 2 ? '#c9dfa4' : '#b9d595');
  g.addColorStop(0.35, '#8fbb6a');
  g.addColorStop(0.7, '#4f8a3f');
  g.addColorStop(1, '#2c5e2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Nervadura central
  ctx.strokeStyle = 'rgba(232,244,214,0.85)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(S / 2, S);
  ctx.quadraticCurveTo(S / 2 + 3, S / 2, S / 2, 6);
  ctx.stroke();
  // Nervaduras laterales
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const y = S * (0.12 + i * 0.09);
    for (const lado of [-1, 1]) {
      ctx.strokeStyle = `rgba(220,238,200,${0.35 + r() * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(S / 2, y + 8);
      ctx.quadraticCurveTo(S / 2 + lado * S * 0.2, y - 4, S / 2 + lado * S * 0.46, y - S * 0.1);
      ctx.stroke();
    }
  }
  grano(ctx, S, S, 12, 52 + variante);
  return c;
}

/* ----------------------------------------------------------- alfombra persa */

/** Colores de la alfombra: la persa bordó de siempre, o una más sobria en azul y óxido. */
export const COLORES_ALFOMBRA = {
  persa: { bordo: '#7f2025', bordoOsc: '#5c151a', azul: '#1f2a4a', crema: '#e6d3a8', oro: '#c38b3e', verde: '#2e5049', rosa: '#b5564f' },
  sobria: { bordo: '#26324d', bordoOsc: '#1a2338', azul: '#6e3422', crema: '#d8c9ab', oro: '#a5733b', verde: '#3b4a42', rosa: '#8c4a33' },
};

export function texturaAlfombra(C = COLORES_ALFOMBRA.persa) {
  const W = 1536;
  const H = 1024;
  const { c, ctx } = lienzo(W, H);
  const r = rng(61);

  const marco = (inset: number, ancho: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(inset, inset, W - 2 * inset, ancho);
    ctx.fillRect(inset, H - inset - ancho, W - 2 * inset, ancho);
    ctx.fillRect(inset, inset, ancho, H - 2 * inset);
    ctx.fillRect(W - inset - ancho, inset, ancho, H - 2 * inset);
  };

  const roseta = (x: number, y: number, rad: number, petalo: string, centro: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = petalo;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(rad * 0.55, 0, rad * 0.45, rad * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = centro;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.bordo;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const rombo = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x + rx, y);
    ctx.lineTo(x, y + ry);
    ctx.lineTo(x - rx, y);
    ctx.closePath();
    ctx.fill();
  };

  const lobulado = (x: number, y: number, rx: number, ry: number, lobulos: number, prof: number, color: string, borde?: string) => {
    ctx.beginPath();
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      const k = 1 + prof * Math.abs(Math.sin((a * lobulos) / 2));
      const px = x + Math.cos(a) * rx * k;
      const py = y + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (borde) {
      ctx.strokeStyle = borde;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  };

  // Fondo y guardas exteriores
  ctx.fillStyle = C.bordo;
  ctx.fillRect(0, 0, W, H);
  marco(0, 12, C.azul);
  marco(12, 6, C.crema);
  marco(18, 8, C.bordoOsc);

  // Borde principal
  const B0 = 26;
  const BW = 96;
  marco(B0, BW, C.azul);
  for (let x = B0 + BW / 2 + 10; x < W - B0 - BW / 2; x += 88) {
    const alt = Math.round((x - B0) / 88) % 2 === 0;
    for (const y of [B0 + BW / 2, H - B0 - BW / 2]) {
      if (alt) roseta(x, y, 30, C.crema, C.oro);
      else {
        rombo(x, y, 26, 30, C.rosa);
        rombo(x, y, 14, 17, C.crema);
      }
    }
  }
  for (let y = B0 + BW + 40; y < H - B0 - BW - 20; y += 88) {
    const alt = Math.round((y - B0) / 88) % 2 === 0;
    for (const x of [B0 + BW / 2, W - B0 - BW / 2]) {
      if (alt) roseta(x, y, 30, C.crema, C.oro);
      else {
        rombo(x, y, 30, 26, C.rosa);
        rombo(x, y, 17, 14, C.crema);
      }
    }
  }
  // Zarcillos que unen los motivos del borde
  ctx.strokeStyle = rgba(C.oro, 0.7);
  ctx.lineWidth = 3;
  for (const y of [B0 + BW / 2, H - B0 - BW / 2]) {
    ctx.beginPath();
    for (let x = B0 + 40; x < W - B0 - 40; x += 4) ctx.lineTo(x, y + Math.sin(x / 14) * 28);
    ctx.stroke();
  }

  marco(B0 + BW, 6, C.crema);
  marco(B0 + BW + 6, 9, C.oro);
  marco(B0 + BW + 15, 5, C.azul);

  // Campo con retícula de flores
  const F0 = B0 + BW + 20;
  ctx.fillStyle = C.bordo;
  ctx.fillRect(F0, F0, W - 2 * F0, H - 2 * F0);
  const paso = 58;
  for (let y = F0 + paso / 2, fila = 0; y < H - F0; y += paso, fila++) {
    for (let x = F0 + paso / 2 + (fila % 2) * (paso / 2); x < W - F0; x += paso) {
      const t = (Math.floor(x / paso) + fila) % 3;
      if (t === 0) roseta(x, y, 12, C.crema, C.azul);
      else if (t === 1) rombo(x, y, 9, 12, C.azul);
      else {
        rombo(x, y, 7, 9, C.oro);
        ctx.fillStyle = C.crema;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
  }

  // Esquinas
  ctx.save();
  ctx.beginPath();
  ctx.rect(F0, F0, W - 2 * F0, H - 2 * F0);
  ctx.clip();
  for (const [x, y] of [
    [F0, F0],
    [W - F0, F0],
    [F0, H - F0],
    [W - F0, H - F0],
  ]) {
    lobulado(x, y, 210, 150, 10, 0.1, C.azul, C.crema);
    lobulado(x, y, 130, 92, 10, 0.12, C.verde);
    roseta(x + (x < W / 2 ? 70 : -70), y + (y < H / 2 ? 50 : -50), 22, C.crema, C.oro);
  }
  ctx.restore();

  // Medallón central
  const cx = W / 2;
  const cy = H / 2;
  rombo(cx, cy - 300, 38, 52, C.azul);
  rombo(cx, cy + 300, 38, 52, C.azul);
  rombo(cx, cy - 300, 20, 28, C.crema);
  rombo(cx, cy + 300, 20, 28, C.crema);
  lobulado(cx, cy, 330, 215, 16, 0.12, C.azul, C.crema);
  lobulado(cx, cy, 255, 165, 16, 0.1, C.bordoOsc, C.oro);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    roseta(cx + Math.cos(a) * 205, cy + Math.sin(a) * 132, 16, C.crema, C.azul);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = C.oro;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rad = i % 2 ? 70 : 130;
    ctx.lineTo(Math.cos(a) * rad * 1.3, Math.sin(a) * rad * 0.85);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  lobulado(cx, cy, 64, 44, 8, 0.15, C.azul, C.crema);
  roseta(cx, cy, 34, C.crema, C.rosa);

  // Abrash: variaciones horizontales del teñido natural
  for (let y = 0; y < H; y += 6) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,230,200,${r() * 0.04})` : `rgba(0,0,0,${r() * 0.05})`;
    ctx.fillRect(0, y, W, 6);
  }
  // Desgaste: zonas más gastadas en el centro (donde se camina). Es una mancha suave, así que se
  // calcula a un cuarto de resolución y se interpola: se ve igual y cuesta 16 veces menos.
  const { fbm } = crearRuido(62, 8);
  const ew = W / 4;
  const eh = H / 4;
  const campo = new Float32Array(ew * eh);
  for (let y = 0; y < eh; y++) {
    for (let x = 0; x < ew; x++) campo[y * ew + x] = Math.max(0, fbm((x / ew) * 8, (y / eh) * 8, 4) - 0.52) * 0.9;
  }
  const desgasteEn = (x: number, y: number) => {
    const fx = Math.min(ew - 1.001, x / 4);
    const fy = Math.min(eh - 1.001, y / 4);
    const x0 = fx | 0;
    const y0 = fy | 0;
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * ew + x0;
    const a = campo[i] + (campo[i + 1] - campo[i]) * tx;
    const b = campo[i + ew] + (campo[i + ew + 1] - campo[i + ew]) * tx;
    return a + (b - a) * ty;
  };
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const desgaste = desgasteEn(x, y);
      if (desgaste <= 0) continue;
      const i = (y * W + x) * 4;
      d[i] += (225 - d[i]) * desgaste * 0.5;
      d[i + 1] += (205 - d[i + 1]) * desgaste * 0.45;
      d[i + 2] += (180 - d[i + 2]) * desgaste * 0.4;
    }
  }
  // El pelo de la alfombra
  sumarGrano(d, 22, 63);
  ctx.putImageData(img, 0, 0);
  return c;
}

export function texturaFlecos() {
  const { c, ctx } = lienzo(512, 64);
  const r = rng(71);
  for (let x = 2; x < 512; x += 3) {
    ctx.strokeStyle = `rgba(${230 - r() * 30},${215 - r() * 30},${185 - r() * 30},1)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (r() - 0.5) * 6, 40 + r() * 22);
    ctx.stroke();
  }
  return c;
}

/* ------------------------------------------------------------------ ciudad */

/** Siluetas de edificios porteños (blanco, se tiñen por material) y sus ventanas encendidas. */
export function texturaCiudad() {
  const W = 2048;
  const H = 512;
  const base = lienzo(W, H);
  const luces = lienzo(W, H);
  const r = rng(81);
  let x = 0;
  while (x < W) {
    const ancho = 70 + r() * 150;
    const alto = 120 + r() * 260;
    const y0 = H - alto;
    const tono = 200 + Math.floor(r() * 55);
    base.ctx.fillStyle = `rgb(${tono},${tono},${tono})`;
    base.ctx.fillRect(x, y0, ancho, alto);
    // Tanque de agua y antena
    if (r() > 0.45) {
      base.ctx.fillRect(x + ancho * 0.2, y0 - 22, 26, 22);
      base.ctx.beginPath();
      base.ctx.moveTo(x + ancho * 0.2 - 3, y0 - 22);
      base.ctx.lineTo(x + ancho * 0.2 + 13, y0 - 34);
      base.ctx.lineTo(x + ancho * 0.2 + 29, y0 - 22);
      base.ctx.fill();
    }
    if (r() > 0.6) base.ctx.fillRect(x + ancho * 0.7, y0 - 40, 2, 40);
    // Balcones
    base.ctx.fillStyle = `rgba(0,0,0,0.12)`;
    for (let yy = y0 + 18; yy < H; yy += 26) base.ctx.fillRect(x + 4, yy, ancho - 8, 2);
    // Ventanas
    for (let yy = y0 + 8; yy < H - 10; yy += 26) {
      for (let xx = x + 8; xx < x + ancho - 14; xx += 18) {
        if (r() < 0.32) {
          const calido = r() > 0.25;
          luces.ctx.fillStyle = calido ? `rgba(255,${190 + r() * 40},${110 + r() * 40},${0.7 + r() * 0.3})` : 'rgba(180,200,255,0.6)';
          luces.ctx.fillRect(xx, yy, 9, 13);
        }
      }
    }
    x += ancho + r() * 14;
  }
  // Copas de árboles en la vereda
  base.ctx.fillStyle = 'rgb(170,170,170)';
  for (let i = 0; i < 40; i++) {
    base.ctx.beginPath();
    base.ctx.arc(r() * W, H - r() * 50, 30 + r() * 40, 0, Math.PI * 2);
    base.ctx.fill();
  }
  return { base: base.c, luces: luces.c };
}

/** Rama de jacarandá en flor (noviembre en Buenos Aires). */
export function texturaJacaranda() {
  const S = 1024;
  const { c, ctx } = lienzo(S, S);
  const r = rng(91);
  const ramas: [number, number][] = [];
  const rama = (x: number, y: number, ang: number, largo: number, grosor: number, nivel: number) => {
    const x2 = x + Math.cos(ang) * largo;
    const y2 = y + Math.sin(ang) * largo;
    ctx.strokeStyle = '#3a2824';
    ctx.lineWidth = grosor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 40, (y + y2) / 2 + (r() - 0.5) * 40, x2, y2);
    ctx.stroke();
    ramas.push([x2, y2]);
    if (nivel > 0) {
      const hijos = 2 + Math.floor(r() * 2);
      for (let i = 0; i < hijos; i++) rama(x2, y2, ang + (r() - 0.5) * 1.3, largo * (0.6 + r() * 0.2), grosor * 0.62, nivel - 1);
    }
  };
  rama(-40, S + 40, -1.05, 420, 34, 4);
  rama(S * 0.15, S + 60, -1.35, 360, 24, 3);
  for (const [bx, by] of ramas) {
    const n = 14 + Math.floor(r() * 18);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 70;
      const tono = r();
      ctx.fillStyle = tono > 0.85 ? 'rgba(98,128,70,0.8)' : `rgba(${130 + tono * 40},${100 + tono * 30},${200 + tono * 30},${0.75 + r() * 0.25})`;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.8, 6 + r() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/* ------------------------------------------------------------------ cuadro */

/**
 * Dibujo original a grafito: una partida de ajedrez esperando bajo una lámpara colgante.
 * Inspirado en el clima de "La Partida" (Pancho Dibujado), sin copiar la obra.
 */
export function texturaCuadro() {
  const W = 1000;
  const H = 720;
  const { c, ctx } = lienzo(W, H);
  const r = rng(101);
  ctx.fillStyle = '#ece7dd';
  ctx.fillRect(0, 0, W, H);

  // Sombreado general en tramas diagonales, más denso hacia los bordes
  const tramar = (x0: number, y0: number, x1: number, y1: number, densidad: number, alfa: number, angulo = 1) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.strokeStyle = `rgba(45,42,38,${alfa})`;
    ctx.lineWidth = 0.9;
    for (let i = -H; i < W + H; i += densidad) {
      ctx.beginPath();
      ctx.moveTo(i + r() * 2, 0);
      ctx.lineTo(i + H * angulo + r() * 2, H);
      ctx.stroke();
    }
    ctx.restore();
  };
  tramar(0, 0, W, H, 7, 0.22);
  tramar(0, 0, W, H, 9, 0.14, -1);
  // Cono de luz de la lámpara
  const luz = ctx.createRadialGradient(W / 2, 470, 20, W / 2, 430, 430);
  luz.addColorStop(0, 'rgba(244,240,232,0.95)');
  luz.addColorStop(0.55, 'rgba(240,236,228,0.6)');
  luz.addColorStop(1, 'rgba(240,236,228,0)');
  ctx.fillStyle = luz;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, 150);
  ctx.lineTo(W / 2 + 70, 150);
  ctx.lineTo(W / 2 + 430, H);
  ctx.lineTo(W / 2 - 430, H);
  ctx.closePath();
  ctx.fill();

  // Lámpara colgante
  ctx.strokeStyle = '#2b2925';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, 92);
  ctx.stroke();
  const pantalla = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
  pantalla.addColorStop(0, '#2c2a27');
  pantalla.addColorStop(0.45, '#6d6962');
  pantalla.addColorStop(1, '#232120');
  ctx.fillStyle = pantalla;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, 92);
  ctx.lineTo(W / 2 + 22, 92);
  ctx.lineTo(W / 2 + 80, 150);
  ctx.lineTo(W / 2 - 80, 150);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbf8f2';
  ctx.beginPath();
  ctx.ellipse(W / 2, 151, 78, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sillas vacías a cada lado
  const silla = (x: number, espejo: number) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(espejo, 1);
    ctx.fillStyle = 'rgba(40,37,33,0.82)';
    ctx.fillRect(-10, 330, 16, 330);
    ctx.fillRect(60, 470, 12, 190);
    ctx.fillRect(-10, 330, 26, 16);
    ctx.fillRect(-10, 380, 16, 10);
    ctx.fillRect(-10, 470, 90, 14);
    ctx.restore();
  };
  silla(150, 1);
  silla(W - 150, -1);

  // Mesa
  ctx.fillStyle = 'rgba(70,64,57,0.85)';
  ctx.beginPath();
  ctx.moveTo(230, 520);
  ctx.lineTo(W - 230, 520);
  ctx.lineTo(W - 180, 590);
  ctx.lineTo(180, 590);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(35,32,29,0.9)';
  ctx.fillRect(180, 590, W - 360, 22);
  ctx.fillRect(220, 612, 16, 108);
  ctx.fillRect(W - 236, 612, 16, 108);

  // Tablero en perspectiva
  const p = (u: number, v: number) => {
    const izq = { x: 380 + (300 - 380) * v, y: 498 + (566 - 498) * v };
    const der = { x: 620 + (700 - 620) * v, y: 498 + (566 - 498) * v };
    return { x: izq.x + (der.x - izq.x) * u, y: izq.y + (der.y - izq.y) * u };
  };
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const a = p(i / 8, j / 8);
      const b = p((i + 1) / 8, j / 8);
      const cc = p((i + 1) / 8, (j + 1) / 8);
      const d = p(i / 8, (j + 1) / 8);
      ctx.fillStyle = (i + j) % 2 ? 'rgba(58,54,49,0.9)' : 'rgba(232,227,216,0.95)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(cc.x, cc.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(30,28,25,0.9)';
  ctx.lineWidth = 2;
  const e = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
  ctx.beginPath();
  e.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.stroke();

  // Piezas
  const pieza = (u: number, v: number, alto: number, tipo: 'peon' | 'torre' | 'rey' | 'dama' | 'alfil', negra: boolean) => {
    const q = p(u, v);
    const esc = 0.75 + v * 0.4;
    const h = alto * esc;
    const w = h * 0.36;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.fillStyle = 'rgba(20,18,16,0.35)';
    ctx.beginPath();
    ctx.ellipse(6, 2, w * 0.7, w * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    if (negra) {
      g.addColorStop(0, '#1d1b19');
      g.addColorStop(0.4, '#57534d');
      g.addColorStop(1, '#141312');
    } else {
      g.addColorStop(0, '#d8d2c6');
      g.addColorStop(0.4, '#fbf8f1');
      g.addColorStop(1, '#a9a297');
    }
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(25,23,20,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, 0);
    ctx.lineTo(w * 0.55, 0);
    ctx.lineTo(w * 0.42, -h * 0.12);
    ctx.lineTo(w * 0.22, -h * 0.2);
    ctx.lineTo(w * 0.16, -h * 0.62);
    if (tipo === 'torre') {
      ctx.lineTo(w * 0.32, -h * 0.68);
      ctx.lineTo(w * 0.32, -h);
      ctx.lineTo(-w * 0.32, -h);
      ctx.lineTo(-w * 0.32, -h * 0.68);
    } else if (tipo === 'peon') {
      ctx.lineTo(w * 0.3, -h * 0.66);
      ctx.arc(0, -h * 0.82, w * 0.26, 0.3, Math.PI - 0.3, true);
      ctx.lineTo(-w * 0.3, -h * 0.66);
    } else {
      ctx.lineTo(w * 0.3, -h * 0.7);
      ctx.lineTo(w * 0.2, -h * 0.86);
      ctx.lineTo(0, -h * 0.94);
      ctx.lineTo(-w * 0.2, -h * 0.86);
      ctx.lineTo(-w * 0.3, -h * 0.7);
    }
    ctx.lineTo(-w * 0.16, -h * 0.62);
    ctx.lineTo(-w * 0.22, -h * 0.2);
    ctx.lineTo(-w * 0.42, -h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (tipo === 'rey') {
      ctx.fillRect(-1.5, -h * 1.1, 3, h * 0.16);
      ctx.fillRect(-w * 0.12, -h * 1.04, w * 0.24, 3);
    }
    if (tipo === 'dama' || tipo === 'alfil') {
      ctx.beginPath();
      ctx.arc(0, -h * 0.98, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };
  pieza(0.32, 0.06, 64, 'rey', true);
  pieza(0.56, 0.08, 58, 'dama', true);
  pieza(0.18, 0.2, 44, 'peon', true);
  pieza(0.7, 0.22, 44, 'peon', true);
  pieza(0.85, 0.1, 50, 'torre', true);
  pieza(0.45, 0.5, 52, 'alfil', false);
  pieza(0.28, 0.72, 46, 'peon', false);
  pieza(0.62, 0.78, 46, 'peon', false);
  pieza(0.12, 0.9, 54, 'torre', false);
  pieza(0.5, 0.92, 70, 'rey', false);

  // Reloj de ajedrez
  ctx.fillStyle = 'rgba(48,44,40,0.92)';
  ctx.beginPath();
  ctx.moveTo(712, 556);
  ctx.lineTo(792, 556);
  ctx.lineTo(782, 512);
  ctx.lineTo(722, 512);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eeeae1';
  for (const cx of [737, 767]) {
    ctx.beginPath();
    ctx.arc(cx, 532, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  grano(ctx, W, H, 18, 102);
  return c;
}

/** Cuadrito chico para un estante: atardecer en acuarela sobre papel. */
export function texturaPostal() {
  const W = 300;
  const H = 400;
  const { c, ctx } = lienzo(W, H);
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(0, 0, W, H);
  const cielo = ctx.createLinearGradient(0, 30, 0, 260);
  cielo.addColorStop(0, '#e9a27a');
  cielo.addColorStop(0.6, '#f3cf98');
  cielo.addColorStop(1, '#f6e3bf');
  ctx.fillStyle = cielo;
  ctx.fillRect(30, 30, W - 60, 240);
  ctx.fillStyle = 'rgba(241,200,120,0.95)';
  ctx.beginPath();
  ctx.arc(W / 2 + 30, 190, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(80,100,120,0.85)';
  ctx.fillRect(30, 230, W - 60, 40);
  ctx.fillStyle = 'rgba(60,70,90,0.9)';
  ctx.beginPath();
  ctx.moveTo(30, 240);
  ctx.quadraticCurveTo(110, 200, 170, 236);
  ctx.quadraticCurveTo(220, 222, 270, 240);
  ctx.lineTo(270, 270);
  ctx.lineTo(30, 270);
  ctx.fill();
  grano(ctx, W, H, 14, 111);
  return c;
}

/* ------------------------------------------------------------------ vinilo */

export function texturaVinilo(colorEtiqueta = '#c0533a') {
  const S = 512;
  const { c, ctx } = lienzo(S, S);
  const r = rng(121);
  ctx.fillStyle = '#0d0d0e';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let rad = S * 0.18; rad < S * 0.495; rad += 1.6) {
    ctx.strokeStyle = `rgba(${r() > 0.5 ? '70,70,75' : '20,20,22'},${0.35 + r() * 0.3})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = colorEtiqueta;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,0.8)';
  ctx.font = '600 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LADO A', S / 2, S / 2 - 30);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/* --------------------------------------------------------- tapa de guitarra */

/** Tapa de abeto con roseta, mapeada a x ∈ [-0.2, 0.2] m, y ∈ [0, 0.5] m. */
export function texturaTapaGuitarra(centroBoca: number, radioBoca: number) {
  const W = 400;
  const H = 500;
  const { c, ctx } = lienzo(W, H);
  const r = rng(131);
  ctx.fillStyle = '#dcb47a';
  ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 2) {
    ctx.fillStyle = r() > 0.6 ? `rgba(150,100,50,${0.12 + r() * 0.12})` : `rgba(255,235,200,${r() * 0.08})`;
    ctx.fillRect(x, 0, 1 + r(), H);
  }
  const px = (m: number) => m * 1000;
  const cy = H - px(centroBoca);
  const cx = W / 2;
  const anillos: [number, number, string][] = [
    [radioBoca + 0.006, radioBoca + 0.009, '#2b1a10'],
    [radioBoca + 0.009, radioBoca + 0.018, 'mosaico'],
    [radioBoca + 0.018, radioBoca + 0.021, '#2b1a10'],
  ];
  for (const [a, b, color] of anillos) {
    if (color === 'mosaico') {
      const pasos = 90;
      for (let i = 0; i < pasos; i++) {
        const a0 = (i / pasos) * Math.PI * 2;
        const a1 = ((i + 1) / pasos) * Math.PI * 2;
        ctx.fillStyle = ['#7a2e22', '#e8d6aa', '#2f5a3a', '#e8d6aa'][i % 4];
        ctx.beginPath();
        ctx.arc(cx, cy, px(b), a0, a1);
        ctx.arc(cx, cy, px(a), a1, a0, true);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, px(b), 0, Math.PI * 2);
      ctx.arc(cx, cy, px(a), 0, Math.PI * 2, true);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#120c08';
  ctx.beginPath();
  ctx.arc(cx, cy, px(radioBoca), 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/**
 * "Gobo" del sol: la silueta de una ventana de dos hojas con sombras de hojas de jacarandá.
 * Se proyecta con un SpotLight sobre la pared y la biblioteca.
 */
export function texturaVentanaSol() {
  const S = 512;
  const { c, ctx } = lienzo(S, S);
  const r = rng(191);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.filter = 'blur(5px)';
  ctx.fillStyle = '#fff';
  const x0 = S * 0.22;
  const x1 = S * 0.78;
  const y0 = S * 0.12;
  const y1 = S * 0.88;
  const parante = S * 0.035;
  const xm = (x0 + x1) / 2;
  const ym = y0 + (y1 - y0) * 0.3;
  ctx.fillRect(x0, y0, xm - x0 - parante / 2, ym - y0 - parante / 2);
  ctx.fillRect(xm + parante / 2, y0, x1 - xm - parante / 2, ym - y0 - parante / 2);
  ctx.fillRect(x0, ym + parante / 2, xm - x0 - parante / 2, y1 - ym - parante / 2);
  ctx.fillRect(xm + parante / 2, ym + parante / 2, x1 - xm - parante / 2, y1 - ym - parante / 2);
  // Hojas y ramas del jacarandá filtrando la luz
  ctx.filter = 'blur(7px)';
  for (let i = 0; i < 70; i++) {
    const cx = S * (0.15 + r() * 0.75);
    const cy = S * (0.05 + r() * 0.45);
    ctx.fillStyle = `rgba(0,0,0,${0.35 + r() * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 6 + r() * 16, 4 + r() * 9, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(S * 0.95, S * 0.02);
  ctx.quadraticCurveTo(S * 0.6, S * 0.18, S * 0.3, S * 0.12);
  ctx.stroke();
  ctx.filter = 'none';
  return c;
}

/** Puntito difuso para las partículas de polvo. */
export function texturaPunto() {
  const { c, ctx } = lienzo(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}
