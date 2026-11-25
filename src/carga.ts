/**
 * Pantalla de carga: un vinilo girando a 33⅓, dibujado en alta resolución
 * (surcos, separación entre temas, etiqueta de papel con texto curvo).
 * Al terminar, la vista entra por el agujero del centro a la habitación.
 */
import { rng } from './util/aleatorio';

function textoCurvo(ctx: CanvasRenderingContext2D, texto: string, cx: number, cy: number, radio: number, arriba: boolean, espaciado: number) {
  const anchos = [...texto].map((ch) => ctx.measureText(ch).width + espaciado);
  const total = anchos.reduce((a, b) => a + b, 0) - espaciado;
  const angTotal = total / radio;
  let acumulado = 0;
  [...texto].forEach((ch, i) => {
    const centroLetra = acumulado + (anchos[i] - espaciado) / 2;
    const ang = arriba ? -Math.PI / 2 - angTotal / 2 + centroLetra / radio : Math.PI / 2 + angTotal / 2 - centroLetra / radio;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * radio, cy + Math.sin(ang) * radio);
    ctx.rotate(arriba ? ang + Math.PI / 2 : ang - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    acumulado += anchos[i];
  });
}

function dibujarVinilo(canvas: HTMLCanvasElement, conTexto: boolean) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const lado = Math.round(canvas.getBoundingClientRect().width * dpr) || 600;
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d')!;
  const R = lado / 2;
  const c = R;
  const r = rng(7);

  // Disco base y canto
  ctx.fillStyle = '#0c0c0d';
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();

  // Surcos: anillos finísimos con variaciones sutiles
  const paso = Math.max(1, dpr * 0.85);
  for (let rad = R * 0.36; rad < R * 0.972; rad += paso) {
    const v = 20 + Math.floor(r() * 16);
    ctx.strokeStyle = `rgba(${v},${v},${v + 3},${0.55 + r() * 0.35})`;
    ctx.lineWidth = paso * 0.55;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Separaciones entre temas: bandas más lisas
  for (const f of [0.455, 0.56, 0.655, 0.76, 0.865]) {
    ctx.strokeStyle = '#19191b';
    ctx.lineWidth = R * 0.009;
    ctx.beginPath();
    ctx.arc(c, c, R * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Borde de entrada y canto
  ctx.strokeStyle = '#151516';
  ctx.lineWidth = R * 0.02;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.985, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = R * 0.004;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.997, 0, Math.PI * 2);
  ctx.stroke();
  // Zona sin surcos alrededor de la etiqueta
  ctx.fillStyle = '#101011';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.36, 0, Math.PI * 2);
  ctx.fill();

  // Etiqueta de papel
  const rl = R * 0.33;
  const papel = ctx.createRadialGradient(c - rl * 0.3, c - rl * 0.3, rl * 0.1, c, c, rl);
  papel.addColorStop(0, '#d0603b');
  papel.addColorStop(1, '#ad4429');
  ctx.fillStyle = papel;
  ctx.beginPath();
  ctx.arc(c, c, rl, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 2200; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * rl;
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,235,210,0.06)' : 'rgba(60,15,5,0.07)';
    ctx.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, dpr, dpr);
  }
  ctx.strokeStyle = 'rgba(250,232,205,0.7)';
  ctx.lineWidth = R * 0.0045;
  ctx.beginPath();
  ctx.arc(c, c, rl * 0.93, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = R * 0.002;
  ctx.beginPath();
  ctx.arc(c, c, rl * 0.89, 0, Math.PI * 2);
  ctx.stroke();

  if (conTexto) {
    ctx.fillStyle = '#fbead0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${R * 0.07}px "EB Garamond", Georgia, serif`;
    textoCurvo(ctx, 'BIBLIOTECA', c, c, rl * 0.7, true, R * 0.014);
    ctx.font = `500 ${R * 0.03}px Inter, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(251,234,208,0.85)';
    textoCurvo(ctx, 'LADO A  ·  33⅓ RPM', c, c, rl * 0.72, false, R * 0.006);
  }

  // Agujero central: por acá se entra a la habitación
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

export function crearCarga() {
  const raiz = document.getElementById('carga')!;
  const escenario = raiz.querySelector<HTMLElement>('.carga__escenario')!;
  const canvas = raiz.querySelector<HTMLCanvasElement>('canvas.disco')!;
  dibujarVinilo(canvas, false);
  document.fonts
    .load('600 20px "EB Garamond"')
    .then(() => dibujarVinilo(canvas, true))
    .catch(() => dibujarVinilo(canvas, true));
  const inicio = performance.now();

  return {
    progreso(p: number) {
      raiz.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    },

    /** Hace el zoom a través del disco. `alEmpezar` arranca la animación de la cámara. */
    async entrar(alEmpezar: () => void) {
      const minimo = 650 - (performance.now() - inicio);
      if (minimo > 0) await new Promise((r) => setTimeout(r, minimo));
      const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const radioAgujero = escenario.getBoundingClientRect().width * 0.5 * 0.022;
      const diagonal = Math.hypot(innerWidth, innerHeight);
      const escalaFinal = (diagonal / radioAgujero) * 0.6;
      const duracion = reducido ? 300 : 1150;
      raiz.classList.add('entrando');
      alEmpezar();
      await new Promise<void>((resolver) => {
        const t0 = performance.now();
        const paso = (t: number) => {
          const k = Math.min(1, (t - t0) / duracion);
          const e = Math.pow(k, 2.1);
          const s = Math.pow(escalaFinal, e);
          escenario.style.transform = `scale(${s})`;
          raiz.style.setProperty('--agujero', `${radioAgujero * s}px`);
          if (k < 1) requestAnimationFrame(paso);
          else resolver();
        };
        requestAnimationFrame(paso);
      });
      raiz.remove();
    },
  };
}
