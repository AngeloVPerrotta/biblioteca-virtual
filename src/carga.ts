/**
 * Pantalla de carga: un vinilo girando. Al terminar, la vista se acerca al disco
 * hasta pasar por el agujero del centro y entrar a la habitación.
 */
export function crearCarga() {
  const raiz = document.getElementById('carga')!;
  const escenario = raiz.querySelector<HTMLElement>('.carga__escenario')!;
  const anillo = raiz.querySelector<SVGCircleElement>('.carga__progreso circle')!;
  const largo = 2 * Math.PI * 48;
  anillo.style.strokeDasharray = `${largo}`;
  anillo.style.strokeDashoffset = `${largo}`;
  const inicio = performance.now();

  return {
    progreso(p: number) {
      anillo.style.strokeDashoffset = `${largo * (1 - p)}`;
      raiz.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    },

    /** Hace el zoom a través del disco. `alEmpezar` arranca la animación de la cámara. */
    async entrar(alEmpezar: () => void) {
      // Que el disco se llegue a ver girando aunque la carga sea muy rápida
      const minimo = 1400 - (performance.now() - inicio);
      if (minimo > 0) await new Promise((r) => setTimeout(r, minimo));
      const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const radioAgujero = escenario.getBoundingClientRect().width * 0.018;
      const diagonal = Math.hypot(innerWidth, innerHeight);
      const escalaFinal = (diagonal / radioAgujero) * 0.62;
      const duracion = reducido ? 400 : 1900;
      raiz.classList.add('entrando');
      alEmpezar();
      await new Promise<void>((resolver) => {
        const t0 = performance.now();
        const paso = (t: number) => {
          const k = Math.min(1, (t - t0) / duracion);
          const e = k * k * (3 - 2 * k) * k;
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
