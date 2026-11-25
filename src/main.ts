import './estilos.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500-italic.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/oswald/500.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import datosJson from './datos/biblioteca.json';
import discosJson from './datos/discos.json';
import type { DatosBiblioteca } from './datos/tipos';
import { Ambiente } from './escena/ambiente';
import { Camara } from './escena/camara';
import { climaDePrueba, LluviaVisual, obtenerClima } from './escena/clima';
import { HazDeSol, Polvo } from './escena/efectos';
import { Estanteria, NIVELES, PROFUNDIDAD } from './escena/estanteria';
import { fusionarEstaticos } from './escena/fusion';
import { crearHabitacion, type Ventana } from './escena/habitacion';
import { marcar, resaltadorDe, type Interactivo } from './escena/interactivos';
import { LibroVisual } from './escena/libros';
import { FUENTES_CANVAS } from './escena/lomos';
import {
  cuadroColgado,
  guitarraCriolla,
  lamparaDePie,
  marcarObjetos,
  mateConBombilla,
  mesaDeLuz,
  mesaTocadiscos,
  pilaDeLibros,
  relojDePared,
  termo,
} from './escena/muebles';
import { singonio } from './escena/planta';
import { Tocadiscos, type DatosDiscos } from './escena/tocadiscos';
import { Postproceso } from './escena/postproceso';
import { aTextura, config, texturaMadera } from './escena/texturas';
import { Foco } from './foco';
import { Interaccion } from './interaccion';
import { crearCarga } from './carga';
import { formatoHora, Interfaz } from './ui';
import { Animador, cuadro, salidaSuave } from './util/animacion';

const datos = datosJson as unknown as DatosBiblioteca;
const datosDiscos = discosJson as unknown as DatosDiscos;

async function iniciar() {
  const canvas = document.getElementById('escena') as HTMLCanvasElement;
  const carga = crearCarga();
  performance.mark('carga-inicio');
  const progreso = async (p: number) => {
    performance.mark(`carga-${p}`);
    carga.progreso(p);
    await cuadro();
  };

  await Promise.all(FUENTES_CANVAS.map((f) => document.fonts.load(f)));
  await progreso(0.08);

  const movil = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  const alta = !movil;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, alta ? 2 : 1.6));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Las sombras se recalculan solo cuando algo se mueve (ver el bucle)
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  config.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // Si el navegador pierde el contexto gráfico (pasa a veces en celulares), ofrecer recargar
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div class="aviso visible" style="pointer-events:auto">Se reinició la parte gráfica. <a href="" style="color:#e8b46a">Recargar</a></div>',
      );
    },
    { once: true },
  );
  RectAreaLightUniformsLib.init();

  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#120d0a');
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.16;

  const animador = new Animador();

  // Libros
  const libros = datos.libros.map((l) => new LibroVisual(l));
  await progreso(0.4);
  const leyendo = datos.leyendoAhora ? (libros.find((lv) => lv.libro.id === datos.leyendoAhora) ?? null) : null;
  const acostados = libros.filter((lv) => lv.libro.acostado && lv !== leyendo);
  const parados = libros.filter((lv) => !lv.libro.acostado && lv !== leyendo);

  const madera = aTextura(texturaMadera('#7a4c2c', { vetas: 11, semilla: 3 }));
  const maderaClara = aTextura(texturaMadera('#a87a4e', { vetas: 8, semilla: 5, contraste: 0.24 }));
  await progreso(0.5);

  // Biblioteca con su decoración
  const pila = pilaDeLibros(acostados);
  const estanteria = new Estanteria({
    parados,
    texturaMadera: madera,
    animador,
    decoraciones: [],
  });
  const zEstante = 0.04;
  estanteria.grupo.position.z = zEstante;
  escena.add(estanteria.grupo);
  const W = estanteria.ancho;
  // Los libros acostados, en pila arriba de la biblioteca, junto a la planta
  pila.grupo.position.set(W / 2 - pila.ancho / 2 - 0.04, NIVELES[4], PROFUNDIDAD / 2 - 0.01);
  pila.grupo.rotation.y = -0.06;
  estanteria.grupo.add(pila.grupo);

  const planta = singonio();
  planta.position.set(-W * 0.2, NIVELES[4], zEstante + PROFUNDIDAD / 2);
  escena.add(planta);
  await progreso(0.6);

  // Habitación
  const ventana: Ventana = { x0: -W / 2 - 1.6, x1: -W / 2 - 0.7, y0: 0.92, y1: 2.24 };
  const hab = crearHabitacion(ventana);
  escena.add(hab.grupo);
  await progreso(0.75);

  const mesaLuz = mesaDeLuz(maderaClara);
  mesaLuz.grupo.position.set(-W / 2 - 0.4, 0, 0.24);
  escena.add(mesaLuz.grupo);
  const sup = mesaLuz.superficie;
  const mate = mateConBombilla();
  mate.position.set(-W / 2 - 0.55, sup, 0.32);
  const unTermo = termo();
  unTermo.position.set(-W / 2 - 0.27, sup, 0.17);
  escena.add(mate, unTermo);
  if (leyendo) {
    leyendo.mesh.rotation.set(0, 0.35, Math.PI / 2);
    leyendo.mesh.position.set(-W / 2 - 0.36, sup + leyendo.grosor / 2, 0.3);
    leyendo.mesh.userData.interactivo.subtitulo = `${leyendo.libro.autor} · leyendo ahora`;
    escena.add(leyendo.mesh);
  }

  const lampara = lamparaDePie(maderaClara);
  lampara.grupo.position.set(-W / 2 - 1.0, 0, 0.62);
  escena.add(lampara.grupo);
  const posLampara = lampara.posLuz.clone().add(lampara.grupo.position);

  const guitarra = guitarraCriolla();
  guitarra.position.set(-W / 2 - 1.55, 0, 0.3);
  guitarra.rotation.y = 0.28;
  escena.add(guitarra);

  // Lo que va en el cajón: un separador al empezar cada género y las fundas
  const itemsCajon: { portada?: string | null; separador?: string }[] = [];
  datosDiscos.discos.forEach((d, i) => {
    // Como en los cajones reales, adelante va un disco (no un separador)
    if (i > 0 && d.genero && d.genero !== datosDiscos.discos[i - 1]?.genero) itemsCajon.push({ separador: d.genero });
    itemsCajon.push({ portada: d.portadaChica });
  });
  const mesa = mesaTocadiscos(maderaClara, itemsCajon);
  mesa.grupo.position.set(W / 2 + 0.85, 0, 0.3);
  mesa.grupo.rotation.y = -0.1;
  marcarObjetos(mesa);
  mesa.cajon.userData.interactivo.subtitulo = `${datosDiscos.discos.length} discos · ${datosDiscos.periodo.toLowerCase()}`;
  mesa.tocadiscos.userData.interactivo.subtitulo = 'Elegí un disco del cajón';
  const tocadiscos = new Tocadiscos({ giratorio: mesa.giratorio, brazo: mesa.brazo, vinilo: mesa.vinilo }, animador);
  escena.add(mesa.grupo);
  // La caja de vinilos va en el piso, entre la biblioteca y la mesa
  mesa.cajon.position.set(W / 2 + 0.235, 0, 0.3);
  mesa.cajon.rotation.y = 0.1;
  escena.add(mesa.cajon);
  const datosCajon = mesa.cajon.userData.interactivo as Interactivo;
  // Cada funda se puede señalar como un libro: sube y muestra su tapa.
  // Se detecta con una "zona" invisible fija por disco, así el disco que sube no tapa a los demás.
  const zonasDiscos: THREE.Mesh[] = [];
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  // Zonas hasta el borde de las fundas: así el disco que sube se puede tocar sin "saltar" al de adelante
  const geoZona = new THREE.PlaneGeometry(0.31, 0.36);
  let discoSenalado: number | null = null;
  const ultimoValor: number[] = [];
  mesa.fundas.forEach((funda, i) => {
    const disco = datosDiscos.discos[i];
    if (!disco) return;
    const base = (funda.userData.base as THREE.Vector3).clone();
    const inclinacion = funda.rotation.x;
    const zona = new THREE.Mesh(geoZona, invisible);
    zona.position.set(0, 0.18, base.z);
    zona.rotation.x = inclinacion;
    mesa.cajon.add(zona);
    zonasDiscos.push(zona);
    const datosDisco: Interactivo = {
      tipo: 'disco',
      id: disco.id,
      titulo: disco.nombre,
      subtitulo: disco.anio ? `${disco.artista} · ${disco.anio}` : disco.artista,
      resaltar: (v) => {
        // Fuera del modo cajón, el cajón entero se comporta como un solo objeto
        if (!enCajon) {
          funda.position.y = base.y;
          funda.rotation.x = inclinacion;
          datosCajon.resaltar(v);
          return;
        }
        // El disco que va subiendo queda "elegido" hasta que se señala otro
        if (v > (ultimoValor[i] ?? 0)) discoSenalado = i;
        else if (discoSenalado === i && v < 0.02) discoSenalado = null;
        ultimoValor[i] = v;
        funda.position.y = base.y + v * 0.18;
        funda.position.z = base.z + v * 0.012;
        funda.rotation.x = inclinacion - v * 0.08;
      },
    };
    // La zona y la funda comparten los mismos datos: pasar de una a otra no cambia la selección
    marcar(zona, datosDisco);
    marcar(funda, datosDisco);
  });

  const elCuadro = cuadroColgado(datos.cuadro);
  elCuadro.position.set(W / 2 + 0.85, 1.58, 0);
  escena.add(elCuadro);

  // Reloj de pared con la hora de Buenos Aires
  const relojPared = relojDePared();
  relojPared.grupo.position.set(W / 2 + 1.62, 1.66, 0);
  escena.add(relojPared.grupo);
  const datosReloj: Interactivo = { tipo: 'reloj', titulo: '', subtitulo: '', resaltar: resaltadorDe(relojPared.grupo, 0.15) };
  marcar(relojPared.grupo, datosReloj);
  await progreso(0.85);

  // Optimización: las piezas quietas que comparten material se dibujan de una sola vez
  for (const o of [planta, guitarra, mesaLuz.grupo, lampara.grupo, mate, unTermo, elCuadro, mesa.grupo, mesa.agenda, relojPared.grupo, hab.grupo]) {
    fusionarEstaticos(o);
  }

  // Luz, atmósfera, cámara y postproceso
  const ambiente = new Ambiente(escena, renderer, hab, { pantalla: lampara.pantalla, bulbo: lampara.bulbo, posLuz: posLampara }, alta);
  const polvo = new Polvo(alta ? 280 : 150, new THREE.Box3(new THREE.Vector3(-W / 2 - 2.1, 0.3, 0.1), new THREE.Vector3(W / 2 + 0.6, 2.4, 2.2)));
  const haz = new HazDeSol(ambiente.sol.map, alta ? 16 : 9);
  escena.add(polvo.puntos, haz.grupo);
  const lluvia = new LluviaVisual(ventana, alta ? 900 : 450);
  escena.add(lluvia.grupo);
  // Clima: real (Open-Meteo) o de prueba con ?clima=lluvia|tormenta|nublado|torrencial
  const climaForzado = climaDePrueba(new URLSearchParams(location.search).get('clima'));
  const traerClima = async () => {
    const c = climaForzado ?? (await obtenerClima());
    if (c) ambiente.setClima(c);
  };
  void traerClima();
  if (!climaForzado) setInterval(() => void traerClima(), 15 * 60 * 1000);

  const camara = new Camara();
  camara.encuadrar(innerWidth / innerHeight, W);
  const post = new Postproceso(renderer, escena, camara.cam, alta, [haz.grupo, polvo.puntos]);
  const foco = new Foco(escena, camara, animador, ambiente, post);

  let ultimaElevacion = NaN;
  const actualizarSol = () => {
    const e = ambiente.estado;
    const firma = e.elev + ambiente.clima.nubes * 100 + ambiente.clima.lluvia * 1000;
    if (Math.abs(firma - ultimaElevacion) < 0.05) return;
    ultimaElevacion = firma;
    haz.actualizar(ambiente.sol, e.solColor, Math.min(1, ambiente.sol.intensity / 3.5) * 0.022);
    polvo.intensidad = (0.25 + Math.min(1, e.sol / 3) * 0.35 + e.lampara * 0.1) * (1 - ambiente.clima.lluvia * 0.6);
  };

  // Interfaz e interacción
  let interaccion: Interaccion;
  const cerrarFoco = async () => {
    if (!foco.activo) return;
    ui.ocultarTarjeta();
    await foco.cerrar();
    interaccion.modoFoco = false;
  };
  const abrirLibro = async (id: string, desde: THREE.Object3D | null = null) => {
    const lv = libros.find((l) => l.libro.id === id);
    if (!lv || foco.enUso) return;
    ui.ocultarEtiqueta();
    interaccion.limpiar();
    interaccion.modoFoco = true;
    const nota = desde ?? (lv.mesh.visible ? null : (estanteria.objetivos().find((o) => o.userData.interactivo?.id === id) ?? null));
    await foco.abrir(lv, nota);
    ui.mostrarTarjeta(lv.libro);
  };
  // Modo cajón: la cámara se acerca a los vinilos para elegir uno
  let enCajon = false;
  const tactil = matchMedia('(pointer: coarse)').matches;
  const entrarCajon = async () => {
    if (enCajon || foco.enUso) return;
    enCajon = true;
    ui.cerrarPaneles();
    ui.ocultarEtiqueta();
    interaccion.limpiar();
    const p = mesa.cajon.getWorldPosition(new THREE.Vector3());
    camara.vista = camara.vertical
      ? { pos: p.clone().add(new THREE.Vector3(-0.05, 1.15, 0.95)), mira: p.clone().add(new THREE.Vector3(0, 0.16, -0.02)), fov: 50 }
      : { pos: p.clone().add(new THREE.Vector3(-0.03, 0.98, 0.92)), mira: p.clone().add(new THREE.Vector3(0, 0.2, -0.03)), fov: 42 };
    ui.mostrarAyudaCajon(true, tactil);
    await animador.animar(1000, (k) => (camara.mezclaVista = k), { clave: 'vista' });
  };
  const salirCajon = async () => {
    if (!enCajon) return;
    enCajon = false;
    interaccion.limpiar();
    ui.ocultarEtiqueta();
    ui.mostrarAyudaCajon(false);
    const desde = camara.mezclaVista;
    await animador.animar(900, (k) => (camara.mezclaVista = desde * (1 - k)), { clave: 'vista' });
  };
  const ponerDisco = (id: string) => {
    const disco = datosDiscos.discos.find((d) => d.id === id);
    if (!disco) return;
    mesa.tocadiscos.userData.interactivo.subtitulo = `Sonando: ${disco.nombre}`;
    ui.mostrarReproductor(disco);
    void tocadiscos.poner(disco);
  };

  const ui = new Interfaz(datos, {
    elegirLibro: (id) => void abrirLibro(id),
    ordenar: (orden) => {
      if (foco.enUso) return;
      estanteria.distribuir(orden, true);
    },
    cerrarFoco: () => void (enCajon ? salirCajon() : cerrarFoco()),
    abrirCajon: () => void (enCajon ? salirCajon() : entrarCajon()),
    cerrarCajon: () => void salirCajon(),
    sacarDisco: () => {
      ui.ocultarReproductor();
      mesa.tocadiscos.userData.interactivo.subtitulo = 'Elegí un disco del cajón';
      void tocadiscos.detener();
    },
    alCambiarPaneles: (abiertos) => {
      interaccion.bloqueado = abiertos;
      if (abiertos) {
        ui.ocultarEtiqueta();
        interaccion.limpiar();
      }
    },
  });

  const seleccionar = (i: Interactivo, objeto: THREE.Object3D) => {
    switch (i.tipo) {
      case 'libro':
        void abrirLibro(i.id!);
        break;
      case 'prestado':
        void abrirLibro(i.id!, objeto);
        break;
      case 'agenda':
        ui.abrirAgenda();
        break;
      case 'vinilos':
        void entrarCajon();
        break;
      case 'tocadiscos':
        if (tocadiscos.sonando) ui.mostrarReproductor(tocadiscos.sonando.disco);
        else void entrarCajon();
        break;
      case 'disco':
        if (!enCajon) {
          void entrarCajon();
          break;
        }
        ponerDisco(i.id!);
        void salirCajon();
        break;
      case 'reloj':
        ui.mostrarAviso(`${datosReloj.titulo} · ${datosReloj.subtitulo}`);
        break;
    }
  };

  interaccion = new Interaccion(
    canvas,
    camara,
    () => enCajon ? [...zonasDiscos, ...(discoSenalado !== null ? [mesa.fundas[discoSenalado]] : [])] : [...estanteria.objetivos(), pila.grupo, mesa.tocadiscos, mesa.cajon, mesa.agenda, relojPared.grupo, ...(leyendo ? [leyendo.mesh] : [])],
    {
      alSenalar: (i, p) => {
        const e = i && !enCajon && i.tipo === 'disco' ? datosCajon : i;
        if (e && p) ui.mostrarEtiqueta(e.titulo, e.subtitulo ?? '', p.x, p.y);
        else ui.ocultarEtiqueta();
      },
      alSeleccionar: seleccionar,
      alTocarVacio: () => void (enCajon ? salirCajon() : cerrarFoco()),
      alArrastrar: (dx, dy) => foco.arrastrar(dx, dy),
    },
  );
  canvas.addEventListener('pointerdown', () => {
    if (ui.panelesAbiertos) ui.cerrarPaneles();
  });
  // Atajo: girar la ruedita hacia atrás sale del foco (libro) o del modo cajón
  let ruedaAcumulada = 0;
  let ruedaUltima = 0;
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!enCajon && !foco.activo) return;
      e.preventDefault();
      const ahora = performance.now();
      if (ahora - ruedaUltima > 350) ruedaAcumulada = 0;
      ruedaUltima = ahora;
      if (e.deltaY > 0) ruedaAcumulada += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      if (ruedaAcumulada > 60) {
        ruedaAcumulada = -Infinity;
        void (enCajon ? salirCajon() : cerrarFoco());
      }
    },
    { passive: false },
  );
  if (movil) {
    window.addEventListener('pointerdown', () => camara.escucharGiroscopio(), { once: true });
  }

  const redimensionar = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    post.setSize(innerWidth, innerHeight);
    camara.encuadrar(innerWidth / innerHeight, W);
  };
  window.addEventListener('resize', redimensionar);

  // Para probar otras horas: ?hora=19.5
  const horaUrl = new URLSearchParams(location.search).get('hora');
  if (horaUrl !== null && !Number.isNaN(Number(horaUrl))) {
    ambiente.horaForzada = Number(horaUrl);
    ambiente.actualizar(true);
  }
  const horaConSegundos = () => {
    if (ambiente.horaForzada !== null) return ambiente.horaForzada;
    const ba = new Date(Date.now() - 3 * 3600000);
    return ba.getUTCHours() + ba.getUTCMinutes() / 60 + ba.getUTCSeconds() / 3600;
  };

  // Los shaders se compilan en paralelo mientras gira el disco de carga, en vez de trabar el primer cuadro.
  // Se apunta al mismo destino que usa la escena para que sean exactamente los mismos programas.
  renderer.setRenderTarget(post.destinoEscena);
  const compilando = renderer.compileAsync(escena, camara.cam);
  renderer.setRenderTarget(null);
  await compilando.catch(() => undefined);
  await progreso(1);
  // Resolución adaptable: si la compu no llega a ~40 fps baja un poco la resolución interna,
  // y la vuelve a subir cuando sobra margen (en compus rápidas queda siempre al máximo)
  const prMaximo = renderer.getPixelRatio();
  let prActual = prMaximo;
  let sumaCuadros = 0;
  let cuadros = 0;
  let inicioMedicion = performance.now() + 2500;
  const ajustarResolucion = (dt: number, valido: boolean) => {
    if (!valido) {
      sumaCuadros = 0;
      cuadros = 0;
      return;
    }
    if (performance.now() < inicioMedicion || document.hidden) return;
    sumaCuadros += dt;
    cuadros++;
    if (cuadros < 90) return;
    const promedio = (sumaCuadros / cuadros) * 1000;
    sumaCuadros = 0;
    cuadros = 0;
    let nuevo = prActual;
    if (promedio > 26) nuevo = Math.max(0.6, prActual - 0.15);
    else if (promedio < 15) nuevo = Math.min(prMaximo, prActual + 0.15);
    if (Math.abs(nuevo - prActual) > 0.01) {
      prActual = nuevo;
      renderer.setPixelRatio(prActual);
      renderer.setSize(innerWidth, innerHeight, false);
      post.setPixelRatio(prActual, innerWidth, innerHeight);
      inicioMedicion = performance.now() + 1000;
    }
  };

  // En reposo (nada se mueve y nadie toca nada por unos segundos) la escena se dibuja a ~30 cuadros:
  // el polvo y la lluvia se ven igual y la compu descansa. Cualquier gesto vuelve a la velocidad plena.
  let ultimaActividad = performance.now();
  const marcarActividad = () => (ultimaActividad = performance.now());
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'] as const) {
    addEventListener(ev, marcarActividad, { passive: true });
  }
  let ultimoCuadro = 0;
  const posAnterior = new THREE.Vector3();
  const rotAnterior = new THREE.Quaternion();

  const reloj = new THREE.Timer();
  let primero = true;
  const bucle = (ahora: number) => {
    const enReposo = !primero && ahora - ultimaActividad > 4000 && !animador.activo && !interaccion.animando && !foco.enUso;
    if (enReposo && ahora - ultimoCuadro < 29) {
      requestAnimationFrame(bucle);
      return;
    }
    ultimoCuadro = ahora;
    reloj.update(ahora);
    const dt = Math.min(reloj.getDelta(), 0.05);
    animador.tick(performance.now());
    camara.tick(dt);
    // Si la cámara todavía se acomoda (paralaje, giroscopio) no estamos en reposo
    if (camara.cam.position.distanceToSquared(posAnterior) > 1e-9 || 1 - Math.abs(camara.cam.quaternion.dot(rotAnterior)) > 1e-9) {
      marcarActividad();
    }
    posAnterior.copy(camara.cam.position);
    rotAnterior.copy(camara.cam.quaternion);
    interaccion.tick(dt);
    foco.tick(dt);
    ambiente.tick(dt);
    actualizarSol();
    polvo.tick(dt);
    // Las sombras se recalculan solo cuando algo se mueve: el brillo al señalar un libro no las cambia,
    // pero en el cajón el disco señalado sí sube
    if (animador.activo || foco.girando || (enCajon && interaccion.animando) || ambiente.consumirCambio()) renderer.shadowMap.needsUpdate = true;
    ajustarResolucion(dt, !enReposo);
    tocadiscos.tick(dt);
    lluvia.actualizar(dt, ambiente.clima.lluvia, Math.min(1, Math.max(0.35, (ambiente.estado.elev + 10) / 25)));
    const h = horaConSegundos();
    relojPared.ajustar(h);
    datosReloj.titulo = `${formatoHora(h)} en Buenos Aires`;
    datosReloj.subtitulo = `${ambiente.estado.nombre} · ${ambiente.clima.descripcion}`;
    post.render(dt);
    if (primero) {
      primero = false;
      performance.mark('carga-primer-cuadro');
      void carga.entrar(() => {
        camara.intro = 1;
        void animador.animar(1900, (k) => (camara.intro = 1 - k), { curva: salidaSuave });
      });
    }
    requestAnimationFrame(bucle);
  };
  requestAnimationFrame(bucle);

  // Para depurar desde la consola
  Object.assign(window, {
    __biblioteca: {
      escena,
      camara,
      ambiente,
      estanteria,
      renderer,
      post,
      haz,
      polvo,
      abrirLibro,
      cerrarFoco,
      probarHora: (h: number | null) => {
        ambiente.horaForzada = h;
        ambiente.actualizar(true);
      },
    },
  });
}

iniciar().catch((e) => {
  console.error(e);
  const carga = document.getElementById('carga');
  if (carga) carga.insertAdjacentHTML('beforeend', '<p class="carga__error">No se pudo cargar la biblioteca. Probá recargar la página.</p>');
});
