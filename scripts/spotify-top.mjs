#!/usr/bin/env node
/**
 * Trae los discos más escuchados de las últimas ~4 semanas desde la API de Spotify
 * y los guarda en src/datos/discos.json (sin tokens ni datos privados).
 *
 * Uso:  node scripts/spotify-top.mjs <CLIENT_ID>
 *
 * Usa el flujo "Authorization Code con PKCE": no hace falta el client secret.
 * La app de Spotify tiene que tener como Redirect URI: http://127.0.0.1:8888/callback
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT_ID = process.argv[2] || process.env.SPOTIFY_CLIENT_ID;
if (!CLIENT_ID) {
  console.error('Falta el Client ID: node scripts/spotify-top.mjs <CLIENT_ID>');
  process.exit(1);
}
const PUERTO = 8888;
const REDIRECT = `http://127.0.0.1:${PUERTO}/callback`;
const RANGO = process.argv[3] || 'short_term';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'src', 'datos', 'discos.json');

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verificador = b64url(crypto.randomBytes(64));
const desafio = b64url(crypto.createHash('sha256').update(verificador).digest());
const estado = b64url(crypto.randomBytes(16));

const urlAutorizacion =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT,
    code_challenge_method: 'S256',
    code_challenge: desafio,
    scope: 'user-top-read',
    state: estado,
  });

async function api(token, ruta) {
  const r = await fetch(`https://api.spotify.com/v1${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Spotify respondió ${r.status} en ${ruta}: ${await r.text()}`);
  return r.json();
}

async function procesar(codigo) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: REDIRECT,
      client_id: CLIENT_ID,
      code_verifier: verificador,
    }),
  });
  if (!r.ok) throw new Error(`No pude obtener el token: ${r.status} ${await r.text()}`);
  const { access_token: token } = await r.json();

  const temas = [];
  for (const offset of [0, 49]) {
    const pagina = await api(token, `/me/top/tracks?time_range=${RANGO}&limit=50&offset=${offset}`);
    for (const t of pagina.items) if (!temas.some((x) => x.id === t.id)) temas.push(t);
  }

  // Cada tema suma puntos a su disco según su posición en el ranking
  const discos = new Map();
  temas.forEach((t, i) => {
    const a = t.album;
    if (!a?.id) return;
    const d = discos.get(a.id) ?? {
      id: a.id,
      nombre: a.name,
      artista: a.artists.map((x) => x.name).join(', '),
      anio: (a.release_date || '').slice(0, 4),
      tipo: a.album_type,
      portada: a.images?.[0]?.url ?? null,
      portadaChica: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
      url: a.external_urls?.spotify ?? `https://open.spotify.com/album/${a.id}`,
      temas: [],
      puntos: 0,
    };
    d.puntos += 100 - i;
    if (d.temas.length < 5) d.temas.push(t.name);
    discos.set(a.id, d);
  });

  const lista = [...discos.values()].sort((a, b) => b.puntos - a.puntos).slice(0, 40);
  const datos = {
    actualizado: new Date().toISOString().slice(0, 10),
    periodo: RANGO === 'short_term' ? 'Últimas 4 semanas' : RANGO === 'medium_term' ? 'Últimos 6 meses' : 'Último año',
    discos: lista,
  };
  fs.writeFileSync(salida, JSON.stringify(datos, null, 2) + '\n');
  console.log(`Listo: ${lista.length} discos (de ${temas.length} temas) guardados en src/datos/discos.json`);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  try {
    if (url.searchParams.get('state') !== estado) throw new Error('El estado no coincide.');
    const error = url.searchParams.get('error');
    if (error) throw new Error(`Spotify devolvió: ${error}`);
    await procesar(url.searchParams.get('code'));
    res.end('<body style="font-family:system-ui;background:#17110d;color:#f5ebdc;display:grid;place-items:center;height:100vh"><p>Listo, ya traje tus discos. Podés cerrar esta pestaña.</p></body>');
    setTimeout(() => process.exit(0), 300);
  } catch (e) {
    console.error(e);
    res.end(`<p>Algo falló: ${String(e.message).replace(/</g, '&lt;')}</p>`);
    setTimeout(() => process.exit(1), 300);
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Abrí esta URL para autorizar:');
  console.log(urlAutorizacion);
});
