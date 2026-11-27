/**
 * Variantes de diseño para probar antes de decidir, por la dirección de la página:
 *   ?paleta=carton|grafito|verde|minimal   colores de los paneles
 *   ?formas=chicas|rectas                   esquinas de botones y paneles
 *   ?agenda=libreta                         la agenda como libreta negra
 *   ?paneles=derechos                       paneles sin la leve inclinación
 *   ?papelito=ficha                         ficha de cartón en vez del post-it
 *   ?alfombra=sobria                        alfombra en azul y óxido
 * Sin nada, la página queda como siempre.
 */
const pedido = new URLSearchParams(location.search);

const OPCIONES = {
  paleta: ['carton', 'grafito', 'verde', 'minimal'],
  formas: ['chicas', 'rectas'],
  agenda: ['libreta'],
  paneles: ['derechos'],
  papelito: ['ficha'],
  alfombra: ['sobria'],
} as const;

type Variantes = { [K in keyof typeof OPCIONES]?: (typeof OPCIONES)[K][number] };

export const variantes: Variantes = {};
for (const [clave, valores] of Object.entries(OPCIONES) as [keyof typeof OPCIONES, readonly string[]][]) {
  const v = pedido.get(clave);
  if (v && valores.includes(v)) (variantes as Record<string, string>)[clave] = v;
}

/** Las de CSS van como atributos en <html>: [data-paleta="carton"], etc. */
export function aplicarVariantes() {
  const raiz = document.documentElement;
  for (const clave of ['paleta', 'formas', 'agenda', 'paneles'] as const) {
    const v = variantes[clave];
    if (v) raiz.dataset[clave] = v;
  }
}
