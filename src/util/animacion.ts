export type Curva = (x: number) => number;

export const suave: Curva = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const salida: Curva = (x) => 1 - Math.pow(1 - x, 3);
export const salidaSuave: Curva = (x) => 1 - Math.pow(1 - x, 4);
export const lineal: Curva = (x) => x;

interface Tarea {
  inicio: number;
  dur: number;
  curva: Curva;
  paso: (k: number) => void;
  fin: () => void;
  clave?: string;
}

/** Interpolaciones simples sincronizadas con el loop de render. */
export class Animador {
  private tareas: Tarea[] = [];

  animar(
    dur: number,
    paso: (k: number) => void,
    opciones: { curva?: Curva; retraso?: number; clave?: string } = {},
  ): Promise<void> {
    return new Promise((resolver) => {
      if (opciones.clave) this.cancelar(opciones.clave);
      this.tareas.push({
        inicio: performance.now() + (opciones.retraso ?? 0),
        dur: Math.max(1, dur),
        curva: opciones.curva ?? suave,
        paso,
        fin: resolver,
        clave: opciones.clave,
      });
    });
  }

  cancelar(clave: string) {
    this.tareas = this.tareas.filter((t) => {
      if (t.clave !== clave) return true;
      t.fin();
      return false;
    });
  }

  get activo() {
    return this.tareas.length > 0;
  }

  tick(ahora: number) {
    const lista = this.tareas;
    this.tareas = [];
    for (const t of lista) {
      const k = (ahora - t.inicio) / t.dur;
      if (k < 0) {
        this.tareas.push(t);
      } else if (k >= 1) {
        t.paso(t.curva(1));
        t.fin();
      } else {
        t.paso(t.curva(k));
        this.tareas.push(t);
      }
    }
  }
}

export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const cuadro = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
