/**
 * Interfaz en HTML sobre la escena: etiqueta al señalar, Hub de libros,
 * tarjeta del libro en foco, agenda (wishlist), «¿Qué leo?», discos, reproductor y avisos.
 */
import perfilesJson from './datos/perfiles.json';
import sugerenciasJson from './datos/sugerencias.json';
import type { DatosBiblioteca, EstadoLectura, Libro } from './datos/tipos';
import type { Orden } from './escena/estanteria';
import type { Disco } from './escena/tocadiscos';
import { Recomendador, type ContextoLectura, type Cuales, type Perfil, type Recomendacion } from './recomendador';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ESTADOS: Record<EstadoLectura, string> = { leido: 'Leído', empezado: 'Empezado', 'sin-leer': 'Sin leer' };

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function formatoHora(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`;
}

interface Acciones {
  elegirLibro: (id: string) => void;
  ordenar: (orden: Orden) => void;
  cerrarFoco: () => void;
  abrirCajon: () => void;
  cerrarCajon: () => void;
  sacarDisco: () => void;
  alCambiarPaneles: (abiertos: boolean) => void;
  /** Hora y clima de ahora, para que el «¿Qué leo?» los tenga en cuenta. */
  contextoLectura: () => ContextoLectura;
  /** Desde la lista del cajón: señalar un disco (sube en el cajón) o ponerlo. */
  senalarDiscoLista: (id: string | null) => void;
  ponerDiscoLista: (id: string) => void;
  /** La biblioteca señala (o deja de señalar) un libro; devuelve dónde está. */
  senalarLibro: (id: string | null, opciones?: { ola?: boolean; inmediato?: boolean }) => Promise<string | null>;
}

interface Sugerencia {
  si: string;
  titulo: string;
  autor: string;
  resumen: string;
}

const EJEMPLOS = [
  'cansado, algo liviano para el bondi…',
  'me siento sin rumbo, en una etapa de cambios…',
  'corté con alguien y quiero algo que me abrace…',
  'tengo la cabeza a mil, necesito calma…',
  'algo que me atrape hasta tarde…',
  'me pregunto por el sentido de todo…',
  'empiezo la facu y estoy nervioso…',
];

type Filtro = 'todos' | EstadoLectura | 'prestado';

export class Interfaz {
  private readonly etiqueta = $('etiqueta');
  private readonly hub = $('hub');
  private readonly lista = $<HTMLUListElement>('hub-lista');
  private readonly buscar = $<HTMLInputElement>('hub-buscar');
  private readonly tarjeta = $('tarjeta');
  private readonly agenda = $('agenda');
  private readonly aviso = $('aviso');
  private readonly ayudaCajon = $('ayuda-cajon');
  private readonly reproductor = $('reproductor');
  private readonly listaDiscos = $('discos-lista');
  private discoEnLista: string | null = null;
  private readonly quelee = $('quelee');
  private readonly queleeTexto = $<HTMLInputElement>('quelee-texto');
  private readonly queleeResultado = $('quelee-resultado');
  private readonly recomendador: Recomendador;
  private recomendaciones: Recomendacion[] = [];
  private recomendacionActual = 0;
  private ubicacion: string | null = null;
  private cuales: Cuales = 'todos';
  private pedidos = 0;
  /** Obra recomendada dentro de una antología, para recordarla en la tarjeta del libro. */
  private paraLeer: { id: string; texto: string } | null = null;
  private sugerencias: { si: { titulo: string }; s: Sugerencia }[] = [];
  private paginaSugerencias = 0;
  private filtro: Filtro = 'todos';
  private temporizadorAviso = 0;

  constructor(
    private datos: DatosBiblioteca,
    private acciones: Acciones,
  ) {
    this.hub.hidden = false;
    this.reproductor.hidden = false;
    this.tarjeta.hidden = false;
    this.agenda.hidden = false;
    this.quelee.hidden = false;
    this.listaDiscos.hidden = false;
    this.prepararListaDiscos();
    this.recomendador = new Recomendador(datos.libros, perfilesJson as unknown as Record<string, Perfil | string>);

    $('btn-libros').addEventListener('click', () => (this.hub.classList.contains('abierto') ? this.cerrarHub() : this.abrirHub()));
    $('btn-wishlist').addEventListener('click', () => (this.agenda.classList.contains('abierta') ? this.cerrarAgenda() : this.abrirAgenda()));
    $('btn-discos').addEventListener('click', () => this.acciones.abrirCajon());
    $('ayuda-cajon-volver').addEventListener('click', () => this.acciones.cerrarCajon());
    this.reproductor.querySelector('[data-cerrar]')!.addEventListener('click', () => this.acciones.sacarDisco());
    this.hub.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarHub());
    this.agenda.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarAgenda());
    this.tarjeta.querySelector('[data-cerrar]')!.addEventListener('click', () => this.acciones.cerrarFoco());
    this.prepararQueLeo();
    this.buscar.addEventListener('input', () => this.renderLista());
    for (const chip of this.hub.querySelectorAll<HTMLButtonElement>('[data-filtro]')) {
      chip.addEventListener('click', () => {
        this.filtro = chip.dataset.filtro as Filtro;
        for (const c of this.hub.querySelectorAll('[data-filtro]')) c.setAttribute('aria-pressed', String(c === chip));
        this.renderLista();
      });
    }
    $<HTMLSelectElement>('hub-orden').addEventListener('change', (e) => this.acciones.ordenar((e.target as HTMLSelectElement).value as Orden));
    this.lista.addEventListener('click', (e) => {
      const boton = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]');
      if (!boton) return;
      this.cerrarHub();
      this.acciones.elegirLibro(boton.dataset.id!);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.quelee.classList.contains('abierto')) this.cerrarQueLeo();
        else if (this.agenda.classList.contains('abierta')) this.cerrarAgenda();
        else if (this.hub.classList.contains('abierto')) this.cerrarHub();
        else this.acciones.cerrarFoco();
      } else if (e.key === '/' && !(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        this.abrirHub();
        this.buscar.focus();
      }
    });

    this.renderLista();
    this.renderAgenda();
    this.prepararSugerencias();
  }

  get panelesAbiertos() {
    return this.hub.classList.contains('abierto') || this.agenda.classList.contains('abierta') || this.quelee.classList.contains('abierto');
  }

  /* ------------------------------------------------------------ etiqueta */

  mostrarEtiqueta(titulo: string, subtitulo: string, x: number, y: number) {
    const [strong, span] = [this.etiqueta.querySelector('strong')!, this.etiqueta.querySelector('span')!];
    strong.textContent = titulo;
    span.textContent = subtitulo;
    span.hidden = !subtitulo;
    const margen = 150;
    this.etiqueta.style.left = `${Math.min(window.innerWidth - margen, Math.max(margen, x))}px`;
    this.etiqueta.style.top = `${Math.max(90, y)}px`;
    this.etiqueta.classList.add('visible');
  }

  ocultarEtiqueta() {
    this.etiqueta.classList.remove('visible');
  }

  /* ------------------------------------------------------------ hub */

  abrirHub() {
    this.cerrarAgenda();
    this.cerrarQueLeo();
    this.hub.classList.add('abierto');
    this.acciones.alCambiarPaneles(true);
  }

  cerrarHub() {
    if (!this.hub.classList.contains('abierto')) return;
    this.hub.classList.remove('abierto');
    this.acciones.alCambiarPaneles(this.panelesAbiertos);
  }

  private insignias(libro: Libro) {
    const partes: string[] = [];
    if (libro.prestado) partes.push(`<span class="insignia insignia--prestado">Prestado</span>`);
    else if (this.datos.leyendoAhora === libro.id) partes.push(`<span class="insignia insignia--empezado">Leyendo</span>`);
    else if (libro.estado) partes.push(`<span class="insignia insignia--${libro.estado}">${ESTADOS[libro.estado]}</span>`);
    return partes.join('');
  }

  renderLista() {
    const q = normalizar(this.buscar.value.trim());
    const libros = this.datos.libros.filter((l) => {
      if (this.filtro === 'prestado' && !l.prestado) return false;
      if (this.filtro !== 'todos' && this.filtro !== 'prestado' && l.estado !== this.filtro) return false;
      if (!q) return true;
      return normalizar(`${l.titulo} ${l.autor} ${l.editorial ?? ''}`).includes(q);
    });
    $('hub-cuenta').textContent = `${this.datos.libros.length}`;
    if (!libros.length) {
      this.lista.innerHTML = `<li class="hub__vacio">${q ? 'No encontré ningún libro con eso.' : 'No hay libros en este filtro.'}</li>`;
      return;
    }
    this.lista.innerHTML = libros
      .map(
        (l) => `<li><button type="button" data-id="${escapar(l.id)}">
          <span class="lomito" style="background:${escapar(l.lomo.fondo)}"></span>
          <span><span class="hub__libro-titulo">${escapar(l.titulo)}</span><span class="hub__libro-autor">${escapar(l.autor || 'Autor sin cargar')}</span></span>
          ${this.insignias(l)}
        </button></li>`,
      )
      .join('');
  }

  /* ------------------------------------------------------------ tarjeta */

  mostrarTarjeta(libro: Libro) {
    $('tarjeta-titulo').textContent = libro.titulo;
    $('tarjeta-autor').textContent = libro.autor;
    $('tarjeta-editorial').textContent = libro.editorial ?? '';
    const notas: string[] = [];
    if (libro.prestado) {
      const desde = libro.prestado.desde ? ` desde el ${libro.prestado.desde.split('-').reverse().join('/')}` : '';
      notas.push(`Se lo presté a ${libro.prestado.a}${desde}.`);
    }
    if (libro.notas) notas.push(libro.notas);
    if (this.paraLeer?.id === libro.id) notas.unshift(this.paraLeer.texto);
    this.paraLeer = null;
    $('tarjeta-notas').textContent = notas.join(' ');
    $('tarjeta-estado').innerHTML = this.insignias(libro);
    this.tarjeta.classList.add('abierta');
  }

  ocultarTarjeta() {
    this.tarjeta.classList.remove('abierta');
  }

  /* ------------------------------------------------------------ agenda */

  private renderAgenda() {
    const lista = $('agenda-lista');
    const deseos = this.datos.wishlist;
    $('agenda-vacia').hidden = deseos.length > 0;
    lista.innerHTML = deseos
      .map(
        (d) =>
          `<li class="${d.conseguido ? 'conseguido' : ''}">${escapar(d.titulo)}${d.autor ? ` <small>— ${escapar(d.autor)}</small>` : ''}${
            d.nota ? `<br><small>${escapar(d.nota)}</small>` : ''
          }</li>`,
      )
      .join('');
  }

  /* ------------------------------------------------------------ para descubrir */

  /** «Si te gustó X… te podría gustar Y»: solo de libros leídos, y nunca algo que ya está o ya quiero. */
  private prepararSugerencias() {
    const norm = (t: string) => normalizar(t).replace(/[^a-z0-9ñ]+/g, ' ').trim();
    const fuera = this.datos.leidosFuera ?? [];
    // Nada que ya tenga, quiera o haya leído en otro lado
    const tengo = new Set([...this.datos.libros, ...this.datos.wishlist, ...fuera].map((l) => norm(l.titulo)));
    const lista = (sugerenciasJson as unknown as { sugerencias: Sugerencia[] }).sugerencias;
    // «si» es el id de un libro leído del estante, o el título de uno leído fuera de él
    const leido = (si: string): { titulo: string } | undefined => {
      const libro = this.datos.libros.find((l) => l.id === si);
      if (libro) return libro.estado !== 'sin-leer' ? libro : undefined;
      return fuera.find((d) => norm(d.titulo) === norm(si));
    };
    this.sugerencias = lista
      .map((s) => ({ s, si: leido(s.si) }))
      .filter((x): x is { s: Sugerencia; si: { titulo: string } } => !!x.si && !tengo.has(norm(x.s.titulo)))
      .sort(() => Math.random() - 0.5);
    for (const pestana of this.agenda.querySelectorAll<HTMLButtonElement>('[data-hoja]')) {
      pestana.addEventListener('click', () => this.verHoja(pestana.dataset.hoja!));
    }
    $('agenda-otras').addEventListener('click', () => {
      this.paginaSugerencias++;
      this.renderSugerencias();
    });
    this.renderSugerencias();
  }

  private verHoja(hoja: string) {
    for (const p of this.agenda.querySelectorAll('[data-hoja]')) p.setAttribute('aria-selected', String(p.getAttribute('data-hoja') === hoja));
    for (const c of this.agenda.querySelectorAll<HTMLElement>('[data-hoja-contenido]')) c.hidden = c.dataset.hojaContenido !== hoja;
    this.agenda.scrollTop = 0;
  }

  private renderSugerencias() {
    const porPagina = 4;
    const total = this.sugerencias.length;
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    const inicio = (this.paginaSugerencias % paginas) * porPagina;
    $('agenda-sugerencias').innerHTML = this.sugerencias
      .slice(inicio, inicio + porPagina)
      .map(
        ({ s, si }) => `<li>
          <small>Si te gustó «${escapar(si.titulo)}»…</small>
          <strong>${escapar(s.titulo)}</strong> <span class="agenda__autor">— ${escapar(s.autor)}</span>
          <p>${escapar(s.resumen)}</p>
        </li>`,
      )
      .join('');
    $('agenda-otras').hidden = paginas < 2;
  }

  abrirAgenda() {
    this.cerrarHub();
    this.cerrarQueLeo();
    this.agenda.classList.add('abierta');
    this.acciones.alCambiarPaneles(true);
  }

  cerrarAgenda() {
    if (!this.agenda.classList.contains('abierta')) return;
    this.agenda.classList.remove('abierta');
    this.acciones.alCambiarPaneles(this.panelesAbiertos);
  }

  cerrarPaneles() {
    this.cerrarHub();
    this.cerrarAgenda();
    this.cerrarQueLeo();
  }

  /* ------------------------------------------------------------ ¿qué leo? */

  private prepararQueLeo() {
    const form = $<HTMLFormElement>('quelee-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.pedirRecomendacion();
    });
    for (const idea of this.quelee.querySelectorAll<HTMLButtonElement>('.idea')) {
      idea.addEventListener('click', () => {
        this.queleeTexto.value = idea.textContent ?? '';
        void this.pedirRecomendacion();
      });
    }
    this.quelee.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarQueLeo());
    for (const opcion of this.quelee.querySelectorAll<HTMLButtonElement>('[data-cuales]')) {
      opcion.addEventListener('click', () => {
        this.cuales = opcion.dataset.cuales as Cuales;
        for (const o of this.quelee.querySelectorAll('[data-cuales]')) o.setAttribute('aria-checked', String(o === opcion));
        // Si ya había una recomendación, se vuelve a elegir con el filtro nuevo
        if (this.recomendaciones.length || !this.queleeResultado.hidden) void this.pedirRecomendacion();
      });
    }
    this.quelee.querySelector('.quelee__otro')!.addEventListener('click', () => {
      if (!this.recomendaciones.length) return;
      void this.irA((this.recomendacionActual + 1) % this.recomendaciones.length);
    });
    this.quelee.querySelector('.quelee__mostrar')!.addEventListener('click', () => {
      const r = this.recomendaciones[this.recomendacionActual];
      if (!r) return;
      this.cerrarQueLeo(true);
      this.paraLeer = r.obra ? { id: r.libro.id, texto: `✦ Para leer: «${r.obra.titulo}» (${r.obra.tipo}).` } : null;
      this.acciones.elegirLibro(r.libro.id);
    });
    this.quelee.querySelector('.quelee__tambien')!.addEventListener('click', (e) => {
      const boton = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-indice]');
      if (!boton) return;
      void this.irA(Number(boton.dataset.indice));
    });
    $('hub-quelee').addEventListener('click', () => this.abrirQueLeo());
  }

  abrirQueLeo() {
    this.cerrarHub();
    this.cerrarAgenda();
    this.queleeTexto.placeholder = EJEMPLOS[Math.floor(Math.random() * EJEMPLOS.length)];
    this.quelee.classList.add('abierto');
    this.acciones.alCambiarPaneles(true);
    // En compu el cursor ya queda listo para escribir; en el celu no, para no tapar todo con el teclado
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => this.queleeTexto.focus({ preventScroll: true }), 320);
  }

  /** `inmediato`: el libro señalado vuelve a su lugar sin animación (cuando enseguida se lo abre). */
  cerrarQueLeo(inmediato = false) {
    if (!this.quelee.classList.contains('abierto')) return;
    this.quelee.classList.remove('abierto');
    this.pedidos++;
    this.queleeBuscando(false);
    void this.acciones.senalarLibro(null, { inmediato });
    if (this.quelee.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.acciones.alCambiarPaneles(this.panelesAbiertos);
  }

  private queleeBuscando(si: boolean) {
    $('quelee-buscando').hidden = !si;
    this.quelee.classList.toggle('buscando', si);
  }

  private async pedirRecomendacion() {
    const pedido = ++this.pedidos;
    if (matchMedia('(pointer: coarse)').matches) this.queleeTexto.blur();
    this.recomendaciones = this.recomendador.recomendar(this.queleeTexto.value, this.acciones.contextoLectura(), pedido, this.cuales);
    this.recomendacionActual = 0;
    this.queleeResultado.hidden = true;
    const primero = this.recomendaciones[0];
    if (!primero) {
      void this.acciones.senalarLibro(null);
      this.renderRecomendacion();
      return;
    }
    // Un momento de magia: una ola de luz recorre los estantes antes de que aparezca el elegido
    this.queleeBuscando(true);
    const ubicacion = await this.acciones.senalarLibro(primero.libro.id, { ola: true });
    if (pedido !== this.pedidos) return;
    this.queleeBuscando(false);
    this.ubicacion = ubicacion;
    this.renderRecomendacion();
  }

  private async irA(indice: number) {
    const pedido = ++this.pedidos;
    this.recomendacionActual = indice;
    const r = this.recomendaciones[indice];
    this.ubicacion = r ? await this.acciones.senalarLibro(r.libro.id) : null;
    if (pedido !== this.pedidos) return;
    this.renderRecomendacion();
  }

  private renderRecomendacion() {
    const r = this.recomendaciones[this.recomendacionActual];
    const caja = this.queleeResultado;
    caja.hidden = false;
    this.quelee.classList.add('con-resultado');
    caja.classList.toggle('vacio', !r);
    if (!r) {
      caja.querySelector('.quelee__intro')!.textContent = 'Hmm…';
      caja.querySelector('.quelee__titulo')!.textContent = 'No encontré ninguno así';
      caja.querySelector('.quelee__autor')!.textContent = '';
      caja.querySelector('.quelee__porque')!.textContent = 'Probá buscando entre todos los libros, o contame otra cosa.';
      caja.querySelector('.quelee__donde')!.textContent = '';
      caja.querySelector('.quelee__tambien')!.innerHTML = '';
      return;
    }
    caja.querySelector('.quelee__donde')!.textContent = this.ubicacion ? `Te está esperando ${this.ubicacion}.` : '';
    caja.querySelector('.quelee__intro')!.textContent = `${r.intro}…`;
    // En una antología, la obra concreta: «Relato de un náufrago», novela corta en «Narrativa completa I»
    caja.querySelector('.quelee__titulo')!.textContent = r.obra?.titulo ?? r.libro.titulo;
    caja.querySelector('.quelee__autor')!.textContent = r.obra ? `${r.libro.autor} · ${r.obra.tipo} en «${r.libro.titulo}»` : r.libro.autor;
    caja.querySelector('.quelee__porque')!.textContent = r.porque;
    const otros = [1, 2]
      .map((k) => (this.recomendacionActual + k) % this.recomendaciones.length)
      .filter((i, k, arr) => i !== this.recomendacionActual && arr.indexOf(i) === k);
    caja.querySelector('.quelee__tambien')!.innerHTML = otros.length
      ? `También: ${otros.map((i) => `<button type="button" data-indice="${i}">${escapar(this.recomendaciones[i].obra?.titulo ?? this.recomendaciones[i].libro.titulo)}</button>`).join(' · ')}`
      : '';
    // Una pequeña animación de «papel nuevo» cada vez que cambia
    caja.classList.remove('nuevo');
    void caja.offsetWidth;
    caja.classList.add('nuevo');
  }

  /* ------------------------------------------------------------ discos */

  /** Cartelito de ayuda (y la lista de atajo) mientras se eligen discos en el cajón. */
  mostrarAyudaCajon(visible: boolean, tactil = false) {
    $('ayuda-cajon-texto').textContent = tactil ? 'Tocá un disco para verlo y otra vez para ponerlo' : 'Pasá por los discos y hacé clic en uno para ponerlo';
    this.ayudaCajon.classList.toggle('visible', visible);
    this.listaDiscos.classList.toggle('visible', visible);
    if (!visible) this.senalarEnLista(null);
  }

  /** Lista de atajo con los discos del cajón, agrupados por género como los separadores. */
  cargarDiscos(discos: Disco[]) {
    let genero = '';
    const html: string[] = [];
    for (const d of discos) {
      if (d.genero && d.genero !== genero) {
        genero = d.genero;
        html.push(`<li class="discos-lista__genero">${escapar(genero)}</li>`);
      }
      html.push(`<li><button type="button" data-disco="${escapar(d.id)}">
        <img src="${escapar(d.portadaChica ?? d.portada ?? '')}" alt="" width="40" height="40" loading="lazy" decoding="async" />
        <span><strong>${escapar(d.nombre)}</strong><small>${escapar(d.artista)}</small></span>
      </button></li>`);
    }
    $('discos-lista-items').innerHTML = html.join('');
  }

  private prepararListaDiscos() {
    const lista = $('discos-lista-items');
    const boton = (e: Event) => (e.target as HTMLElement).closest<HTMLButtonElement>('[data-disco]');
    lista.addEventListener('pointerover', (e) => this.senalarEnLista(boton(e)?.dataset.disco ?? null));
    lista.addEventListener('focusin', (e) => this.senalarEnLista(boton(e)?.dataset.disco ?? null));
    lista.addEventListener('pointerleave', () => this.senalarEnLista(null));
    lista.addEventListener('click', (e) => {
      const id = boton(e)?.dataset.disco;
      if (!id) return;
      this.senalarEnLista(null);
      this.acciones.ponerDiscoLista(id);
    });
  }

  private senalarEnLista(id: string | null) {
    if (id === this.discoEnLista) return;
    this.discoEnLista = id;
    this.acciones.senalarDiscoLista(id);
  }

  /** Marca en la lista el disco que está sonando. */
  private marcarSonando(id: string | null) {
    for (const b of this.listaDiscos.querySelectorAll<HTMLButtonElement>('[data-disco]')) {
      b.classList.toggle('sonando', b.dataset.disco === id);
    }
  }

  /** Muestra el reproductor de Spotify con el disco elegido. */
  mostrarReproductor(disco: Disco) {
    const marco = $('reproductor-marco');
    marco.innerHTML = `<iframe title="${escapar(disco.nombre)} en Spotify" src="https://open.spotify.com/embed/album/${encodeURIComponent(disco.id)}?utm_source=generator&theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    this.reproductor.classList.add('abierto');
    this.marcarSonando(disco.id);
  }

  ocultarReproductor() {
    this.reproductor.classList.remove('abierto');
    this.marcarSonando(null);
    setTimeout(() => {
      if (!this.reproductor.classList.contains('abierto')) $('reproductor-marco').innerHTML = '';
    }, 450);
  }

  /* ------------------------------------------------------------ avisos */

  mostrarAviso(texto: string) {
    this.aviso.textContent = texto;
    this.aviso.classList.add('visible');
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = window.setTimeout(() => this.aviso.classList.remove('visible'), 3200);
  }
}
