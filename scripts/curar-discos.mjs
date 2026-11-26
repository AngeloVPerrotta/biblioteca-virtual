#!/usr/bin/env node
/**
 * Curaduría del cajón de vinilos: a partir de la lista de discos más escuchados
 * (ordenada por puntaje) elige 25, repartidos por género y sin repetir artista.
 *
 * Uso suelto:  node scripts/curar-discos.mjs   (re-cura src/datos/discos.json)
 * También lo usan scripts/spotify-historial.mjs y scripts/spotify-top.mjs al traer datos nuevos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cuántos discos de cada género entran en el cajón (en este orden, de adelante hacia atrás). */
export const CUPOS = [
  ['Rock nacional', 5],
  ['Reggaetón', 5],
  ['Trap y rap', 6],
  ['Corridos', 2],
  ['Hip hop y R&B', 3],
  ['Rock y punk', 2],
  ['Pop', 1],
  ['Reggae', 1],
];

const g = (genero, artistas) => Object.fromEntries(artistas.map((a) => [a, genero]));

/** Género de cada artista (por nombre principal en Spotify). Lo que no esté no entra al cajón. */
export const GENEROS = {
  ...g('Rock nacional', [
    'Patricio Rey y sus Redonditos de Ricota',
    'Los Fundamentalistas del Aire Acondicionado',
    'Indio Solari',
    'Gaspar Benegas',
    'Babasonicos',
    'Los Auténticos Decadentes',
    'Intoxicados',
    'Los Fabulosos Cadillacs',
    'Los Piojos',
    'Callejeros',
    'Bersuit Vergarabat',
    'Divididos',
    'La Renga',
    'Las Pastillas del Abuelo',
    'Viejas Locas',
    'Sumo',
    'Pappo',
    'Caras Extrañas',
    'Attaque 77',
    'Almafuerte',
    'No Te Va Gustar',
    'Fabiana Cantilo',
    'Mancha De Rolando',
    'Soda Stereo',
    'Charly García',
    'Andrés Calamaro',
    'Los Pericos',
    'Ciro y los Persas',
    'El Mató a un Policía Motorizado',
    'Él Mató a un Policía Motorizado',
  ]),
  ...g('Reggaetón', [
    'Bad Bunny',
    'Feid',
    'Quevedo',
    'Mora',
    'Tainy',
    'Rauw Alejandro',
    'J Balvin',
    'JHAYCO',
    'Anuel AA',
    'Daddy Yankee',
    'Ozuna',
    'Arcángel',
    'Ñengo Flow',
    'Myke Towers',
    'Alvaro Diaz',
    'El Alfa',
    'Bad Gyal',
    'Cris Mj',
    'SAIKO',
    'Plan B',
    'Dei V',
    'Omar Courtz',
    'Sech',
    'Karol G',
    'Manuel Turizo',
    'Jere Klein',
  ]),
  ...g('Trap y rap', [
    'YSY A',
    'Harry Nach',
    'Duki',
    'Beny Jr',
    'Trueno',
    'Paco Amoroso',
    'CA7RIEL',
    'CA7RIEL & Paco Amoroso',
    'Kidd Keo',
    'Dillom',
    'KHEA',
    'Bizarrap',
    'Eladio Carrion',
    'Pablo Chill-E',
    'Alemán',
    'Julianno Sosa',
    'Polimá Westcoast',
    'Young Cister',
    'Bhavi',
    'C.R.O',
    'Paulo Londra',
    'Morad',
    'Yung Beef',
    'Oscu',
    'Santoz',
    'Neo Pistea',
    'Canserbero',
    'Cruz Cafuné',
    'WOS',
    'Calle 13',
    'Yixs98',
    'Pedritovm',
    'L-Gante',
  ]),
  ...g('Corridos', ['Natanael Cano', 'Junior H', 'Peso Pluma', 'Fuerza Regida', 'Grupo Frontera', 'Neton Vega', 'Victor Mendivil', 'Gabito Ballesteros', 'Tito Double P', 'Eslabon Armado']),
  ...g('Hip hop y R&B', [
    'The Weeknd',
    'Drake',
    'Tyler, The Creator',
    '6ix9ine',
    'Travis Scott',
    'Dr. Dre',
    'DJ Khaled',
    '2Pac',
    'The Notorious B.I.G.',
    'Kendrick Lamar',
    'Travis Thompson',
    'Chief Keef',
    'Kanye West',
    'Eminem',
    'Frank Ocean',
    'Post Malone',
    'Juice WRLD',
    'XXXTENTACION',
    'Bruno Mars',
  ]),
  ...g('Rock y punk', [
    'The Smiths',
    'blink-182',
    'Deftones',
    'Green Day',
    'The Strokes',
    'The Beatles',
    'Avril Lavigne',
    'Oasis',
    'Nirvana',
    'Arctic Monkeys',
    'Gatillazo',
    'Radiohead',
    'Red Hot Chili Peppers',
    'Linkin Park',
    'The Cure',
    'Pearl Jam',
    'Coldplay',
    'John Mayer',
    'Chuck Berry',
  ]),
  ...g('Pop', ['Maná', 'Zoé', 'Lana Del Rey', 'Taylor Swift', 'Julieta Venegas', 'Mon Laferte', 'The Marías', 'Sabrina Carpenter', 'Jesse & Joy', 'NATHY PELUSO', 'Mesita', 'Lali', 'Dayglow', 'Daft Punk']),
  ...g('Reggae', ['Los Cafres', 'Dread Mar I', 'Bob Marley & The Wailers', 'Kameleba', 'Nonpalidece', 'Zona Ganjah', 'Alika']),
};

/** Artistas que cuentan como uno solo para no llenar el cajón con lo mismo. */
const FAMILIAS = {
  'Patricio Rey y sus Redonditos de Ricota': 'redondos',
  'Los Fundamentalistas del Aire Acondicionado': 'redondos',
  'Indio Solari': 'redondos',
  'Gaspar Benegas': 'redondos',
  'Paco Amoroso': 'ca7riel-paco',
  CA7RIEL: 'ca7riel-paco',
  'CA7RIEL & Paco Amoroso': 'ca7riel-paco',
};
const MAX_POR_FAMILIA = 1;

const principal = (d) => d.artista.split(',')[0].trim();

/** Recibe discos ordenados por puntaje y devuelve la selección agrupada por género. */
export function curar(discos) {
  const cupo = new Map(CUPOS);
  const elegidos = new Map(CUPOS.map(([genero]) => [genero, []]));
  const usados = new Map();
  const artistas = new Set();
  for (const d of discos) {
    const artista = principal(d);
    const genero = d.genero ?? GENEROS[artista] ?? 'Otros';
    if (!cupo.has(genero)) continue;
    const lista = elegidos.get(genero);
    if (lista.length >= cupo.get(genero)) continue;
    const familia = FAMILIAS[artista] ?? artista;
    if ((usados.get(familia) ?? 0) >= MAX_POR_FAMILIA || artistas.has(artista)) continue;
    artistas.add(artista);
    usados.set(familia, (usados.get(familia) ?? 0) + 1);
    lista.push({ ...d, genero });
  }
  return CUPOS.flatMap(([genero]) => elegidos.get(genero));
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
