# Biblioteca

Mi biblioteca en 3D: una habitación de entrecasa, cálida y tranquila, con mis libros reales en una biblioteca tipo Ruffo, la guitarra criolla, el mate, el tocadiscos y la luz que cambia según la hora de Buenos Aires.

Hecha con [Three.js](https://threejs.org) y Vite. Todo (libros, lomos, alfombra, parquet, cuadro) se dibuja por código al cargar: no hay modelos ni imágenes pesadas.

## Qué se puede hacer

- **Pasar el mouse (o tocar) un libro**: brilla y muestra título y autor.
- **Hacer clic**: el libro sale del estante y viene hacia vos; se puede girar arrastrando.
- **Libros**: lista con buscador, filtros (leídos, empezados, sin leer, prestados) y orden de la biblioteca (como en las fotos, por color, por autor o por título), con animación.
- **Wishlist**: la agenda bordó sobre la mesa del tocadiscos.
- **La luz sigue la hora real de Buenos Aires**: de día entra sol por la ventana, en la hora dorada se dibujan las sombras de las hojas, de noche queda la lámpara de pie. Para probar otra hora: `?hora=19.5`.
- **El clima también es real** (Open-Meteo, sin clave): si está nublado se apaga el sol y se prende la lámpara; si llueve se ven gotas afuera y en el vidrio; si hay tormenta, relámpagos. Para probar: `?clima=lluvia`, `torrencial`, `tormenta`, `nublado`, `niebla` o `llovizna`.
- **Discos**: el cajón bajo la mesa tiene mis discos más escuchados en Spotify. Al elegir uno, el vinilo cambia de etiqueta, el brazo se apoya, el plato gira y aparece el reproductor de Spotify.
- **Reloj de pared** con la hora de Buenos Aires.
- En el celular, la biblioteca se ve vertical y el panel de libros sale desde abajo.

## Cómo editar los datos

Todo está en [`src/datos/biblioteca.json`](src/datos/biblioteca.json):

- `libros`: cada libro con título, autor, medidas (cm) y cómo se ve su lomo.
- `estado`: `"leido"`, `"empezado"` o `"sin-leer"`.
- `prestado`: `{ "a": "Juan", "desde": "2026-11-20" }`. El libro sale del estante y queda un papelito en su lugar.
- `leyendoAhora`: el `id` del libro que va en la mesa de luz (o `null`).
- `wishlist`: `[{ "titulo": "…", "autor": "…" }]`.
- `notas`: texto libre que aparece al mirar el libro de cerca.
- `tapa`: ruta a una foto real de la tapa dentro de `public/` (opcional).
- `cuadro`: ruta a una imagen para el cuadro (opcional).

## Actualizar los discos de Spotify

```bash
node scripts/spotify-top.mjs <CLIENT_ID>             # últimas 4 semanas
node scripts/spotify-top.mjs <CLIENT_ID> medium_term # últimos 6 meses
```

Abre la autorización de Spotify (flujo PKCE, sin client secret), trae los temas más escuchados, los agrupa por disco y guarda solo la lista en `src/datos/discos.json`. La app de Spotify necesita la Redirect URI `http://127.0.0.1:8888/callback`.

## Correrlo en la compu

```bash
npm install
npm run dev
```

## Publicarlo

El sitio es estático y está en Cloudflare Workers (ver `wrangler.jsonc`), conectado a este repo: cada push a `main` se publica solo en [biblioteca.angeloperrotta.com.ar](https://biblioteca.angeloperrotta.com.ar). Build: `npm run build` · Deploy: `npx wrangler deploy`.

## Créditos

- Three.js (MIT).
- Tipografías EB Garamond, Playfair Display, Inter, Oswald, Bebas Neue y Caveat (SIL Open Font License), vía Fontsource.
- El cuadro es un dibujo original generado por código.
