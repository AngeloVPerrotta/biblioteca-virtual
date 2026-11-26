#!/usr/bin/env node
/**
 * Arma el cajón de vinilos a partir del «historial de reproducción extendido» de Spotify
 * (el .zip que se pide en spotify.com/account/privacy). Mezcla lo de siempre con lo de ahora:
 * el puntaje de cada disco es su parte de todo el historial más la mitad de su parte del último año.
 *
 * Uso (no hace falta iniciar sesión ni ninguna clave):
 *   node scripts/spotify-historial.mjs "<carpeta Spotify Extended Streaming History>"
 *
 * El historial NO se copia al proyecto (tiene datos privados como IPs): solo se lee para sumar
 * minutos por disco. A src/datos/discos.json va solo lo público de cada disco (nombre, tapa, temas).
 * La tapa y el id de cada disco salen de las páginas públicas de open.spotify.com.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUPOS, curar, GENEROS } from './curar-discos.mjs';

const [carpeta] = process.argv.slice(2);
if (!carpeta) {
  console.error('Uso: node scripts/spotify-historial.mjs "<carpeta del historial>"');
  process.exit(1);
}
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'src', 'datos', 'discos.json');
const DIA = 86400000;

// 1) Sumar escuchas por disco (más de 30 s cuenta como escucha)
const filas = fs
  .readdirSync(carpeta)
  .filter((f) => /^Streaming_History_Audio_.*\.json$/.test(f))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(carpeta, f), 'utf8')))
  .filter((r) => r.master_metadata_track_name && r.spotify_track_uri && r.ms_played > 30000);
const ahora = Math.max(...filas.map((r) => Date.parse(r.ts)));
const delUltimoAnio = (ts) => (ahora - Date.parse(ts)) / DIA <= 365;
const totalSiempre = filas.reduce((s, r) => s + r.ms_played, 0);
const totalAnio = filas.reduce((s, r) => s + (delUltimoAnio(r.ts) ? r.ms_played : 0), 0) || 1;
const peso = (ts) => 1 / totalSiempre + (delUltimoAnio(ts) ? 0.5 / totalAnio : 0);

const discos = new Map();
const artistas = new Map();
for (const r of filas) {
  const artista = r.master_metadata_album_artist_name;
  const clave = `${artista}|||${r.master_metadata_album_album_name}`;
  const p = r.ms_played * peso(r.ts);
  const d = discos.get(clave) ?? { artista, nombre: r.master_metadata_album_album_name, puntos: 0, temas: new Map() };
  d.puntos += p;
  const t = d.temas.get(r.spotify_track_uri) ?? { nombre: r.master_metadata_track_name, puntos: 0 };
  t.puntos += p;
  d.temas.set(r.spotify_track_uri, t);
  discos.set(clave, d);
  artistas.set(artista, (artistas.get(artista) ?? 0) + p);
}
const ranking = [...artistas.entries()].sort((a, b) => b[1] - a[1]);
console.log(`Historial: ${filas.length} escuchas de ${new Date(Math.min(...filas.map((r) => Date.parse(r.ts)))).getFullYear()} a hoy.`);

// 2) Datos públicos de un disco a partir de uno de sus temas (páginas de open.spotify.com)
const decodificar = (t) => t.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? decodificar(m[1]) : null;
};
async function pagina(url) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (biblioteca-virtual)', 'Accept-Language': 'en' } });
    if (r.ok) return r.text();
    await new Promise((res) => setTimeout(res, 800 * (intento + 1)));
  }
  throw new Error(`No pude leer ${url}`);
}
async function albumDeTema(idTema) {
  const tema = await pagina(`https://open.spotify.com/track/${idTema}`);
  const enlace = meta(tema, 'music:album');
  if (!enlace) return null;
  const id = enlace.split('/').pop();
  const album = await pagina(`https://open.spotify.com/album/${id}`);
  // «Artista · album · 1997 · 10 songs»
  const partes = (meta(album, 'og:description') ?? '').split(' · ');
  const portada = meta(album, 'og:image');
  return {
    id,
    tipo: (partes[1] ?? 'album').toLowerCase(),
    anio: partes.find((p) => /^\d{4}$/.test(p)) ?? (meta(tema, 'music:release_date') ?? '').slice(0, 4),
    total: Number(partes.find((p) => /\d+ songs?/.test(p))?.match(/\d+/)?.[0] ?? 0) || (album.match(/name="music:song"/g) ?? []).length,
    portada,
    portadaChica: portada?.replace('ab67616d0000b273', 'ab67616d00001e02') ?? portada,
  };
}

// 3) Un disco por artista, en orden de lo más escuchado, hasta llenar los cupos de cada género
const cupos = new Map(CUPOS);
const porGenero = new Map();
const lista = [];
for (const [artista, puntos] of ranking) {
  const genero = GENEROS[artista];
  if (!genero || !cupos.has(genero)) continue;
  // Con algunos de reserva por género, por si la curaduría descarta alguno (familias, repetidos)
  if ((porGenero.get(genero) ?? 0) >= cupos.get(genero) + 2) continue;
  const suyos = [...discos.values()].filter((d) => d.artista === artista).sort((a, b) => b.puntos - a.puntos).slice(0, 4);
  for (const d of suyos) {
    const idTema = [...d.temas.entries()].sort((a, b) => b[1].puntos - a[1].puntos)[0][0].split(':').pop();
    const a = await albumDeTema(idTema).catch((e) => (console.warn(`  (salteo ${d.nombre}: ${e.message})`), null));
    // Un disco de verdad: álbum, compilado o EP largo; no un simple suelto
    if (!a || a.total < 4 || (a.tipo === 'single' && a.total < 5)) continue;
    lista.push({
      id: a.id,
      nombre: d.nombre,
      artista,
      anio: a.anio,
      tipo: a.tipo,
      portada: a.portada,
      portadaChica: a.portadaChica,
      url: `https://open.spotify.com/album/${a.id}`,
      temas: [...d.temas.values()].sort((x, y) => y.puntos - x.puntos).slice(0, 5).map((t) => t.nombre),
      // Puntaje relativo (0 a 100) para ordenar: no se guardan horas ni nada privado
      puntos: Math.round((puntos / ranking[0][1]) * 1000) / 10,
      genero,
    });
    porGenero.set(genero, (porGenero.get(genero) ?? 0) + 1);
    console.log(`  ${genero.padEnd(14)} ${artista} — ${d.nombre}`);
    break;
  }
  if (CUPOS.every(([g, n]) => (porGenero.get(g) ?? 0) >= n + 2)) break;
}

// 4) Curaduría por género y guardar
const datos = {
  actualizado: new Date(ahora).toISOString().slice(0, 10),
  periodo: 'De siempre y de ahora',
  discos: curar(lista),
};
fs.writeFileSync(salida, JSON.stringify(datos, null, 2) + '\n');
console.log(`\nCajón armado con ${datos.discos.length} discos:`);
for (const d of datos.discos) console.log(`  [${d.genero}] ${d.nombre} — ${d.artista} (${d.anio})`);
const faltan = ranking.slice(0, 20).filter(([a]) => !datos.discos.some((d) => d.artista === a));
if (faltan.length) console.log(`Del top 20 quedaron afuera: ${faltan.map(([a]) => a).join(', ')}`);
