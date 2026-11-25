/**
 * Interfaz en HTML sobre la escena: etiqueta al señalar, Hub de libros,
 * tarjeta del libro en foco, agenda (wishlist), «¿Qué leo?», discos, reproductor y avisos.
 */
import perfilesJson from './datos/perfiles.json';
import type { DatosBiblioteca, EstadoLectura, Libro } from './datos/tipos';
import type { Orden } from './escena/estanteria';
import type { Disco } from './escena/tocadiscos';
import { Recomendador, type ContextoLectura, type Perfil, type Recomendacion } from './recomendador';

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
}

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
  private readonly quelee = $('quelee');
  private readonly queleeTexto = $<HTMLInputElement>('quelee-texto');
  private readonly queleeResultado = $('quelee-resultado');
  private readonly recomendador: Recomendador;
  private recomendaciones: Recomendacion[] = [];
  private recomendacionActual = 0;
  private pedidos = 0;
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
      this.pedirRecomendacion();
    });
    for (const idea of this.quelee.querySelectorAll<HTMLButtonElement>('.idea')) {
      idea.addEventListener('click', () => {
        this.queleeTexto.value = idea.textContent ?? '';
        this.pedirRecomendacion();
      });
    }
    this.quelee.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarQueLeo());
    this.quelee.querySelector('.quelee__otro')!.addEventListener('click', () => {
      if (!this.recomendaciones.length) return;
      this.recomendacionActual = (this.recomendacionActual + 1) % this.recomendaciones.length;
      this.renderRecomendacion();
    });
    this.quelee.querySelector('.quelee__mostrar')!.addEventListener('click', () => {
      const r = this.recomendaciones[this.recomendacionActual];
      if (!r) return;
      this.cerrarQueLeo();
      this.acciones.elegirLibro(r.libro.id);
    });
    this.quelee.querySelector('.quelee__tambien')!.addEventListener('click', (e) => {
      const boton = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-indice]');
      if (!boton) return;
      this.recomendacionActual = Number(boton.dataset.indice);
      this.renderRecomendacion();
    });
    $('hub-quelee').addEventListener('click', () => this.abrirQueLeo());
  }

  abrirQueLeo() {
    this.cerrarHub();
    this.cerrarAgenda();
    this.quelee.classList.add('abierto');
    this.acciones.alCambiarPaneles(true);
    // En compu el cursor ya queda listo para escribir; en el celu no, para no tapar todo con el teclado
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => this.queleeTexto.focus({ preventScroll: true }), 320);
  }

  cerrarQueLeo() {
    if (!this.quelee.classList.contains('abierto')) return;
    this.quelee.classList.remove('abierto');
    if (this.quelee.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.acciones.alCambiarPaneles(this.panelesAbiertos);
  }

  private pedirRecomendacion() {
    this.pedidos++;
    this.recomendaciones = this.recomendador.recomendar(this.queleeTexto.value, this.acciones.contextoLectura(), this.pedidos);
    this.recomendacionActual = 0;
    this.renderRecomendacion();
    if (matchMedia('(pointer: coarse)').matches) this.queleeTexto.blur();
  }

  private renderRecomendacion() {
    const r = this.recomendaciones[this.recomendacionActual];
    const caja = this.queleeResultado;
    caja.hidden = !r;
    this.quelee.classList.toggle('con-resultado', !!r);
    if (!r) return;
    caja.querySelector('.quelee__intro')!.textContent = `${r.intro}…`;
    caja.querySelector('.quelee__titulo')!.textContent = r.libro.titulo;
    caja.querySelector('.quelee__autor')!.textContent = r.libro.autor;
    caja.querySelector('.quelee__porque')!.textContent = r.porque;
    const otros = [1, 2]
      .map((k) => (this.recomendacionActual + k) % this.recomendaciones.length)
      .filter((i, k, arr) => i !== this.recomendacionActual && arr.indexOf(i) === k);
    caja.querySelector('.quelee__tambien')!.innerHTML = otros.length
      ? `También: ${otros.map((i) => `<button type="button" data-indice="${i}">${escapar(this.recomendaciones[i].libro.titulo)}</button>`).join(' · ')}`
      : '';
    // Una pequeña animación de «papel nuevo» cada vez que cambia
    caja.classList.remove('nuevo');
    void caja.offsetWidth;
    caja.classList.add('nuevo');
  }

  /* ------------------------------------------------------------ discos */

  /** Cartelito de ayuda mientras se eligen discos en el cajón. */
  mostrarAyudaCajon(visible: boolean, tactil = false) {
    $('ayuda-cajon-texto').textContent = tactil ? 'Tocá un disco para verlo y otra vez para ponerlo' : 'Pasá por los discos y hacé clic en uno para ponerlo';
    this.ayudaCajon.classList.toggle('visible', visible);
  }

  /** Muestra el reproductor de Spotify con el disco elegido. */
  mostrarReproductor(disco: Disco) {
    const marco = $('reproductor-marco');
    marco.innerHTML = `<iframe title="${escapar(disco.nombre)} en Spotify" src="https://open.spotify.com/embed/album/${encodeURIComponent(disco.id)}?utm_source=generator&theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    this.reproductor.classList.add('abierto');
  }

  ocultarReproductor() {
    this.reproductor.classList.remove('abierto');
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
