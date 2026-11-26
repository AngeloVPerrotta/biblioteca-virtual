# Biblioteca

Mi biblioteca en 3D: una habitación de entrecasa, cálida y tranquila, con mis libros reales en una biblioteca tipo Ruffo, la guitarra criolla, el mate, el tocadiscos y la luz que cambia según la hora de Buenos Aires.

Hecha con [Three.js](https://threejs.org) y Vite. Todo (libros, lomos, alfombra, parquet, cuadro) se dibuja por código al cargar: no hay modelos ni imágenes pesadas.

## Qué se puede hacer

- **Pasar el mouse (o tocar) un libro**: brilla y muestra título y autor.
- **Hacer clic**: el libro sale del estante y viene hacia vos; se puede girar arrastrando.
- **Libros**: lista con buscador, filtros (leídos, empezados, sin leer, prestados) y orden de la biblioteca (como en las fotos, por color, por autor o por título), con animación.
- **Wishlist**: la agenda bordó sobre la mesa del tocadiscos.
- **¿Qué leo?**: un post-it en el cajón de la mesa de luz que cada tanto titila con un brillito (o «¿No sabés qué leer?» en el panel de libros). Le contás a la biblioteca cómo te sentís, en qué momento de tu vida estás o qué tenés ganas de leer («me siento sin rumbo», «corté con alguien y quiero algo que me abrace», «cabeza a mil», «algo corto para el bondi»), elegís si buscar entre todos, los que no leíste, los empezados o los que ya leíste, y una ola de luz recorre los estantes hasta que el libro elegido asoma rodeado de brillitos. Tiene en cuenta la hora y si llueve. Funciona sin internet ni API.
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

El perfil de cada libro para el «¿Qué leo?» está en `src/datos/perfiles.json` (tonos como `intriga`, `liviano`, `pensar`, temas, momentos de la vida para los que es especialmente bueno —`perdido`, `ruptura`, `duelo`, `empezar`…— y una frase). Al sumar un libro, pedile a Claude que le arme el perfil.

## Actualizar los discos de Spotify

La forma recomendada es con el **historial de reproducción extendido** (el .zip que se pide en spotify.com/account/privacy). No hace falta iniciar sesión ni ninguna clave:

```bash
node scripts/spotify-historial.mjs "<carpeta Spotify Extended Streaming History>"
```

Suma lo escuchado por disco mezclando lo de siempre con lo de ahora (la parte de cada disco en todo el historial, más la mitad de su parte del último año), elige un disco por artista y saca la tapa de las páginas públicas de Spotify. El historial **no** se copia al proyecto (tiene datos privados): a `src/datos/discos.json` va solo lo público de cada disco.

También se puede usar la API, con lo de las últimas semanas y meses (necesita autorizar la app, con la Redirect URI `http://127.0.0.1:8888/callback`):

```bash
node scripts/spotify-top.mjs <CLIENT_ID>
```

La selección del cajón la arma [`scripts/curar-discos.mjs`](scripts/curar-discos.mjs): 25 discos repartidos por género (rock nacional, reggaetón, trap y rap, corridos, hip hop y R&B, rock y punk, pop y reggae; cupos en `CUPOS`, género de cada artista en `GENEROS`), uno por artista. En el cajón van agrupados con separadores de cartón.

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
