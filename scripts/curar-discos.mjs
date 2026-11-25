#!/usr/bin/env node
/**
 * Curaduría del cajón de vinilos: a partir de la lista de discos más escuchados
 * (ordenada por puntaje) elige 20, repartidos por género y sin repetir artista.
 *
 * Uso suelto:  node scripts/curar-discos.mjs   (re-cura src/datos/discos.json)
 * También lo usa scripts/spotify-top.mjs al traer datos nuevos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cuántos discos de cada género entran en el cajón (en este orden). */
export const CUPOS = [
  ['Rock nacional', 8],
  ['Rock internacional', 6],
  ['Punk y metal', 2],
  ['Urbano', 1],
  ['Pop e indie', 2],
  ['Electrónica', 1],
];

/** Género de cada artista (por nombre principal en Spotify). Lo que no esté va a "Otros". */
export const GENEROS = {
  'Patricio Rey y sus Redonditos de Ricota': 'Rock nacional',
  'Los Fundamentalistas del Aire Acondicionado': 'Rock nacional',
  'Indio Solari': 'Rock nacional',
  'Gaspar Benegas': 'Rock nacional',
  Divididos: 'Rock nacional',
  Sumo: 'Rock nacional',
  Babasonicos: 'Rock nacional',
  Callejeros: 'Rock nacional',
  'La Renga': 'Rock nacional',
  Intoxicados: 'Rock nacional',
  'Fabiana Cantilo': 'Rock nacional',
  'Bersuit Vergarabat': 'Rock nacional',
  'Mancha De Rolando': 'Rock nacional',
  'No Te Va Gustar': 'Rock nacional',
  Pappo: 'Rock nacional',
  'The Strokes': 'Rock internacional',
  Coldplay: 'Rock internacional',
  'John Mayer': 'Rock internacional',
  'Chuck Berry': 'Rock internacional',
  Nirvana: 'Rock internacional',
  Oasis: 'Rock internacional',
  'Pearl Jam': 'Rock internacional',
  'Attaque 77': 'Punk y metal',
  Almafuerte: 'Punk y metal',
  Gatillazo: 'Punk y metal',
  'Green Day': 'Punk y metal',
  'YSY A': 'Urbano',
  Lali: 'Pop e indie',
  Dayglow: 'Pop e indie',
  'Daft Punk': 'Electrónica',
};

/** Artistas que cuentan como uno solo para no llenar el cajón con lo mismo. */
const FAMILIAS = {
  'Patricio Rey y sus Redonditos de Ricota': 'redondos',
  'Los Fundamentalistas del Aire Acondicionado': 'redondos',
  'Indio Solari': 'redondos',
  'Gaspar Benegas': 'redondos',
};
const MAX_POR_FAMILIA = 2;

const principal = (d) => d.artista.split(',')[0].trim();

/** Recibe discos ordenados por puntaje y devuelve la selección agrupada por género. */
export function curar(discos) {
  const cupo = new Map(CUPOS);
  const elegidos = new Map(CUPOS.map(([g]) => [g, []]));
  const usados = new Map();
  const artistas = new Set();
  for (const d of discos) {
    const artista = principal(d);
    const genero = d.genero ?? GENEROS[artista] ?? 'Otros';
    if (!cupo.has(genero)) continue;
    const lista = elegidos.get(genero);
    if (lista.length >= cupo.get(genero)) continue;
    const familia = FAMILIAS[artista] ?? artista;
    const max = FAMILIAS[artista] ? MAX_POR_FAMILIA : 1;
    if ((usados.get(familia) ?? 0) >= max || artistas.has(artista)) continue;
    artistas.add(artista);
    usados.set(familia, (usados.get(familia) ?? 0) + 1);
    lista.push({ ...d, genero });
  }
  return CUPOS.flatMap(([g]) => elegidos.get(g));
}

// Uso suelto: re-curar el archivo de datos
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ruta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'datos', 'discos.json');
  const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const ordenados = [...datos.discos].sort((a, b) => b.puntos - a.puntos);
  datos.discos = curar(ordenados);
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2) + '\n');
  console.log(`Cajón curado: ${datos.discos.length} discos`);
  for (const d of datos.discos) console.log(`  [${d.genero}] ${d.nombre} — ${d.artista}`);
}
