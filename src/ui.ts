/**
 * Interfaz en HTML sobre la escena: etiqueta al señalar, Hub de libros,
 * tarjeta del libro en foco, agenda (wishlist) y avisos.
 */
import type { DatosBiblioteca, EstadoLectura, Libro } from './datos/tipos';
import type { Orden } from './escena/estanteria';

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
  alCambiarPaneles: (abiertos: boolean) => void;
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
  private filtro: Filtro = 'todos';
  private temporizadorAviso = 0;

  constructor(
    private datos: DatosBiblioteca,
    private acciones: Acciones,
  ) {
    this.hub.hidden = false;
    this.tarjeta.hidden = false;
    this.agenda.hidden = false;

    $('btn-libros').addEventListener('click', () => (this.hub.classList.contains('abierto') ? this.cerrarHub() : this.abrirHub()));
    $('btn-wishlist').addEventListener('click', () => (this.agenda.classList.contains('abierta') ? this.cerrarAgenda() : this.abrirAgenda()));
    this.hub.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarHub());
    this.agenda.querySelector('[data-cerrar]')!.addEventListener('click', () => this.cerrarAgenda());
    this.tarjeta.querySelector('[data-cerrar]')!.addEventListener('click', () => this.acciones.cerrarFoco());
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
        if (this.agenda.classList.contains('abierta')) this.cerrarAgenda();
        else if (this.hub.classList.contains('abierto')) this.cerrarHub();
        else this.acciones.cerrarFoco();
      } else if (e.key === '/' && document.activeElement !== this.buscar) {
        e.preventDefault();
        this.abrirHub();
        this.buscar.focus();
      }
    });

    this.renderLista();
    this.renderAgenda();
  }

  get panelesAbiertos() {
    return this.hub.classList.contains('abierto') || this.agenda.classList.contains('abierta');
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
  }

  /* ------------------------------------------------------------ avisos */

  mostrarAviso(texto: string) {
    this.aviso.textContent = texto;
    this.aviso.classList.add('visible');
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = window.setTimeout(() => this.aviso.classList.remove('visible'), 3200);
  }
}
