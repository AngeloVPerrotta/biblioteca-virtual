/**
 * Muebles y objetos de la habitación, modelados con geometría simple
 * y materiales cuidados. Cada función devuelve un grupo con el origen en su base.
 */
import * as THREE from 'three';
import { rng } from '../util/aleatorio';
import { marcar, resaltadorDe } from './interactivos';
import type { LibroVisual } from './libros';
import { aTextura, grano, lienzo, texturaCuadro, texturaTapaGuitarra, texturaVinilo } from './texturas';

const sombra = <T extends THREE.Object3D>(o: T, recibe = true) => {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = recibe;
    }
  });
  return o;
};

function caja(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cilindroEntre(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, lados = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, lados), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.y = a.distanceTo(b);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function maderaMaterial(tex: THREE.Texture, repetir: [number, number], tinte = 0xffffff, rugosidad = 0.55) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repetir);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: t, color: tinte, roughness: rugosidad });
}

/* -------------------------------------------------------------- mesa de luz */

export function mesaDeLuz(madera: THREE.Texture) {
  const g = new THREE.Group();
  const mat = maderaMaterial(madera, [1, 1], 0xd9b38c, 0.5);
  const patas = 0.16;
  for (const x of [-0.19, 0.19]) {
    for (const z of [-0.15, 0.15]) {
      g.add(cilindroEntre(new THREE.Vector3(x * 1.08, 0, z * 1.1), new THREE.Vector3(x, patas + 0.01, z), 0.009, 0.015, mat));
    }
  }
  g.add(caja(0.46, 0.36, 0.38, mat, 0, patas + 0.18, 0));
  g.add(caja(0.48, 0.024, 0.4, mat, 0, patas + 0.372, 0));
  const frente = new THREE.MeshStandardMaterial({ map: mat.map, color: 0xe0bd96, roughness: 0.45 });
  g.add(caja(0.42, 0.14, 0.012, frente, 0, patas + 0.27, 0.19));
  g.add(caja(0.42, 0.12, 0.006, mat, 0, patas + 0.1, 0.19));
  const laton = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3 });
  const tirador = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), laton);
  tirador.position.set(0, patas + 0.27, 0.205);
  g.add(tirador);
  sombra(g);
  return { grupo: g, superficie: patas + 0.384 };
}

/* ------------------------------------------------------------ lámpara de pie */

export function lamparaDePie(madera: THREE.Texture) {
  const g = new THREE.Group();
  const mat = maderaMaterial(madera, [0.2, 1], 0xc89a6a, 0.45);
  const cima = new THREE.Vector3(0, 1.3, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    g.add(cilindroEntre(new THREE.Vector3(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27), cima, 0.011, 0.014, mat));
  }
  g.add(cilindroEntre(cima, new THREE.Vector3(0, 1.4, 0), 0.008, 0.008, new THREE.MeshStandardMaterial({ color: 0x2b2622, metalness: 0.7, roughness: 0.4 })));
  const pantalla = new THREE.MeshStandardMaterial({
    color: 0xf3e3c6,
    side: THREE.DoubleSide,
    roughness: 0.95,
    emissive: 0xffbf73,
    emissiveIntensity: 1,
  });
  const tela = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.225, 0.3, 48, 1, true), pantalla);
  tela.position.y = 1.47;
  tela.castShadow = false;
  g.add(tela);
  const foco = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const bulbo = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), foco);
  bulbo.position.y = 1.44;
  g.add(bulbo);
  sombra(g);
  tela.castShadow = false;
  bulbo.castShadow = false;
  return { grupo: g, pantalla, bulbo: foco, posLuz: new THREE.Vector3(0, 1.44, 0) };
}

/* ----------------------------------------------------------------- guitarra */

export function guitarraCriolla() {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(0, 0);
  forma.bezierCurveTo(0.12, 0, 0.185, 0.04, 0.185, 0.12);
  forma.bezierCurveTo(0.185, 0.21, 0.12, 0.25, 0.12, 0.29);
  forma.bezierCurveTo(0.12, 0.33, 0.1425, 0.35, 0.1425, 0.4);
  forma.bezierCurveTo(0.1425, 0.46, 0.09, 0.49, 0, 0.49);
  forma.bezierCurveTo(-0.09, 0.49, -0.1425, 0.46, -0.1425, 0.4);
  forma.bezierCurveTo(-0.1425, 0.35, -0.12, 0.33, -0.12, 0.29);
  forma.bezierCurveTo(-0.12, 0.25, -0.185, 0.21, -0.185, 0.12);
  forma.bezierCurveTo(-0.185, 0.04, -0.12, 0, 0, 0);
  const profundidad = 0.095;
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: profundidad,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 40,
  });
  const tapaTex = aTextura(texturaTapaGuitarra(0.335, 0.043));
  tapaTex.repeat.set(2.5, 2);
  tapaTex.offset.set(0.5, 0);
  const tapa = new THREE.MeshPhysicalMaterial({ map: tapaTex, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const aros = new THREE.MeshPhysicalMaterial({ color: 0x4a2716, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const cuerpo = new THREE.Mesh(geo, [tapa, aros]);
  g.add(cuerpo);

  const zTapa = profundidad + 0.003;
  const mastil = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.5 });
  const diapason = new THREE.MeshStandardMaterial({ color: 0x241510, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, metalness: 1, roughness: 0.3 });
  const yCejuela = 0.79;
  g.add(caja(0.05, yCejuela - 0.47, 0.024, mastil, 0, (yCejuela + 0.47) / 2, zTapa - 0.014));
  g.add(caja(0.054, yCejuela - 0.42, 0.006, diapason, 0, (yCejuela + 0.42) / 2, zTapa + 0.003));
  const escala = 0.65;
  for (let n = 1; n <= 19; n++) {
    const y = yCejuela - escala * (1 - Math.pow(2, -n / 12));
    if (y < 0.425) break;
    g.add(caja(0.054, 0.0018, 0.0016, metal, 0, y, zTapa + 0.0068));
  }
  g.add(caja(0.054, 0.006, 0.006, new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.4 }), 0, yCejuela, zTapa + 0.006));
  // Clavijero con ranuras, inclinado hacia atrás
  const clavijero = new THREE.Group();
  clavijero.position.set(0, yCejuela, zTapa - 0.006);
  clavijero.rotation.x = -0.24;
  clavijero.add(caja(0.074, 0.19, 0.02, mastil, 0, 0.095, 0));
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x120b08, roughness: 0.9 });
  for (const x of [-0.016, 0.016]) clavijero.add(caja(0.016, 0.13, 0.021, oscuro, x, 0.1, 0));
  const clavija = new THREE.CylinderGeometry(0.004, 0.004, 0.11, 8);
  clavija.rotateZ(Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(clavija, metal);
    c.position.set(0, 0.06 + i * 0.035, 0);
    clavijero.add(c);
    for (const lado of [-1, 1]) {
      const boton = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xefe3c4, roughness: 0.35 }));
      boton.rotation.z = Math.PI / 2;
      boton.position.set(lado * 0.062, 0.06 + i * 0.035, 0);
      clavijero.add(boton);
    }
  }
  g.add(clavijero);
  // Puente y cuerdas
  g.add(caja(0.18, 0.026, 0.01, mastil, 0, 0.115, zTapa + 0.005));
  g.add(caja(0.08, 0.003, 0.004, new THREE.MeshStandardMaterial({ color: 0xf1ead8 }), 0, 0.122, zTapa + 0.011));
  const nylon = new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.3 });
  const entorchado = new THREE.MeshStandardMaterial({ color: 0xc8c2b4, metalness: 0.9, roughness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const f = (i - 2.5) / 2.5;
    const a = new THREE.Vector3(f * 0.029, 0.12, zTapa + 0.012);
    const b = new THREE.Vector3(f * 0.021, yCejuela, zTapa + 0.0095);
    g.add(cilindroEntre(a, b, 0.0007 + i * 0.00008, 0.0007 + i * 0.00008, i < 3 ? entorchado : nylon, 5));
  }
  sombra(g);

  // Soporte
  const soporte = new THREE.Group();
  const negro = new THREE.MeshStandardMaterial({ color: 0x161514, roughness: 0.5, metalness: 0.4 });
  soporte.add(cilindroEntre(new THREE.Vector3(-0.15, 0, 0.12), new THREE.Vector3(0, 0.33, -0.05), 0.007, 0.007, negro));
  soporte.add(cilindroEntre(new THREE.Vector3(0.15, 0, 0.12), new THREE.Vector3(0, 0.33, -0.05), 0.007, 0.007, negro));
  soporte.add(cilindroEntre(new THREE.Vector3(0, 0, -0.2), new THREE.Vector3(0, 0.33, -0.05), 0.007, 0.007, negro));
  soporte.add(cilindroEntre(new THREE.Vector3(-0.14, 0.07, 0.11), new THREE.Vector3(0.14, 0.07, 0.11), 0.01, 0.01, negro));
  sombra(soporte);

  const raiz = new THREE.Group();
  g.position.set(0, 0.06, 0.04);
  g.rotation.x = -0.2;
  raiz.add(g, soporte);
  return raiz;
}

/* ---------------------------------------------------- mesa con tocadiscos */

const COLORES_DISCOS = ['#d94f3d', '#2f4f8f', '#e8c547', '#1d1d1f', '#f2efe6', '#7b4ca0', '#3e8e6e', '#e98b5a', '#b9d3e8', '#5b3a29', '#c73b6b', '#263238'];

export function mesaTocadiscos(madera: THREE.Texture) {
  const g = new THREE.Group();
  const mat = maderaMaterial(madera, [1.4, 1], 0xc79b70, 0.45);
  const alto = 0.62;
  for (const x of [-0.34, 0.34]) {
    for (const z of [-0.17, 0.17]) {
      g.add(cilindroEntre(new THREE.Vector3(x * 1.1, 0, z * 1.15), new THREE.Vector3(x, alto - 0.02, z), 0.01, 0.018, mat));
    }
  }
  g.add(caja(0.8, 0.03, 0.44, mat, 0, alto - 0.015, 0));
  g.add(caja(0.74, 0.05, 0.4, mat, 0, alto - 0.055, 0));

  // Tocadiscos
  const td = new THREE.Group();
  td.position.set(-0.1, alto, 0);
  const plinto = new THREE.MeshStandardMaterial({ map: mat.map, color: 0x8a5a38, roughness: 0.35 });
  td.add(caja(0.44, 0.085, 0.35, plinto, 0, 0.0425, 0));
  td.add(caja(0.43, 0.004, 0.34, new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.6 }), 0, 0.087, 0));
  const plato = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.018, 64), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.8, roughness: 0.35 }));
  plato.position.set(-0.05, 0.098, 0);
  td.add(plato);
  const vinilo = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 96),
    new THREE.MeshPhysicalMaterial({ map: aTextura(texturaVinilo('#c0533a')), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  );
  vinilo.rotation.x = -Math.PI / 2;
  vinilo.position.set(-0.05, 0.1085, 0);
  td.add(vinilo);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd3d0c8, metalness: 1, roughness: 0.25 });
  const pivote = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 20), metal);
  pivote.position.set(0.16, 0.1, -0.11);
  td.add(pivote);
  const brazo = cilindroEntre(new THREE.Vector3(0.16, 0.122, -0.11), new THREE.Vector3(0.11, 0.118, 0.08), 0.0035, 0.0035, metal);
  td.add(brazo);
  td.add(caja(0.02, 0.008, 0.03, new THREE.MeshStandardMaterial({ color: 0x1b1b1b }), 0.106, 0.114, 0.095));
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.006, 16), metal);
    b.position.set(0.15 + i * 0.03, 0.09, 0.14);
    td.add(b);
  }
  sombra(td);
  g.add(td);

  // Agenda (wishlist) con banda elástica y un lápiz
  const agenda = new THREE.Group();
  const cuero = new THREE.MeshStandardMaterial({ color: 0x6b2228, roughness: 0.55 });
  agenda.add(caja(0.15, 0.022, 0.21, cuero, 0, 0.011, 0));
  agenda.add(caja(0.146, 0.016, 0.204, new THREE.MeshStandardMaterial({ color: 0xf1e8d6, roughness: 0.9 }), 0.003, 0.011, 0));
  agenda.add(caja(0.008, 0.0235, 0.212, new THREE.MeshStandardMaterial({ color: 0x151313, roughness: 0.6 }), 0.055, 0.011, 0));
  const lapiz = cilindroEntre(new THREE.Vector3(-0.09, 0.005, -0.08), new THREE.Vector3(-0.07, 0.005, 0.09), 0.0045, 0.0045, new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.5 }), 6);
  agenda.add(lapiz);
  agenda.position.set(0.27, alto, 0.02);
  agenda.rotation.y = -0.22;
  sombra(agenda);
  g.add(agenda);

  // Caja de vinilos bajo la mesa: madera maciza, abierta arriba
  const cajon = new THREE.Group();
  const maderaCaja = maderaMaterial(madera, [0.5, 0.4], 0xd8ae7c, 0.5);
  const W = 0.37;
  const D = 0.35;
  const H = 0.27;
  const e = 0.014;
  cajon.add(caja(W, e, D, maderaCaja, 0, e / 2, 0));
  cajon.add(caja(W, H, e, maderaCaja, 0, H / 2, D / 2 - e / 2));
  cajon.add(caja(W, H, e, maderaCaja, 0, H / 2, -D / 2 + e / 2));
  cajon.add(caja(e, H, D, maderaCaja, -W / 2 + e / 2, H / 2, 0));
  cajon.add(caja(e, H, D, maderaCaja, W / 2 - e / 2, H / 2, 0));
  const manija = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.07, 4, 12), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 }));
  manija.rotation.z = Math.PI / 2;
  manija.scale.set(1, 1, 0.25);
  manija.position.set(0, H - 0.045, D / 2 + 0.0008);
  cajon.add(manija);
  const r = rng(141);
  for (let i = 0; i < 24; i++) {
    const color = COLORES_DISCOS[Math.floor(r() * COLORES_DISCOS.length)];
    const funda = caja(0.004, 0.31, 0.31, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), -0.15 + i * 0.0128, 0.168, 0);
    funda.rotation.z = (r() - 0.5) * 0.05;
    cajon.add(funda);
  }
  cajon.position.set(0, 0, 0.02);
  sombra(cajon);
  g.add(cajon);

  sombra(g);
  return { grupo: g, tocadiscos: td, vinilo, agenda, cajon, alto };
}

/* ------------------------------------------------------------------- cuadro */

/** Cuadro en lienzo (canvas) sin marco. Si se indica una imagen, la usa en lugar del dibujo. */
export function cuadroColgado(imagen?: string | null) {
  const g = new THREE.Group();
  const W = 0.72;
  const H = 0.52;
  const prof = 0.035;
  const frente = new THREE.MeshStandardMaterial({ map: aTextura(texturaCuadro()), roughness: 0.82 });
  const canto = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.8 });
  const lienzoMesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, prof), [canto, canto, canto, canto, frente, canto]);
  lienzoMesh.position.z = prof / 2 + 0.008;
  g.add(lienzoMesh);
  if (imagen) {
    new THREE.TextureLoader().load(imagen, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      frente.map = t;
      frente.needsUpdate = true;
      const img = t.image as { width: number; height: number };
      lienzoMesh.scale.x = (H * (img.width / img.height)) / W;
    });
  }
  return sombra(g);
}

/* ------------------------------------------------------------ mate y termo */

function texturaCuero() {
  const { c, ctx } = lienzo(256, 256);
  const r = rng(201);
  ctx.fillStyle = '#2d2b29';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 160; i++) {
    const x = r() * 256;
    const y = r() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
    ctx.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40);
    ctx.stroke();
  }
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    ctx.fillRect(r() * 256, r() * 256, 2 + r() * 6, 2 + r() * 6);
  }
  grano(ctx, 256, 256, 14, 202);
  return c;
}

function texturaCincelado() {
  const { c, ctx } = lienzo(512, 96);
  ctx.fillStyle = '#c9ad6f';
  ctx.fillRect(0, 0, 512, 96);
  for (let x = 0; x < 512; x += 16) {
    for (const [y, dir] of [
      [30, 1],
      [62, -1],
    ] as const) {
      ctx.save();
      ctx.translate(x + 8, y);
      ctx.rotate(dir * 0.6);
      ctx.fillStyle = 'rgba(80,58,20,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.5)';
      ctx.beginPath();
      ctx.ellipse(-1, -1, 7, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = 'rgba(70,50,18,0.6)';
  ctx.fillRect(0, 45, 512, 3);
  grano(ctx, 512, 96, 20, 212);
  return c;
}

function texturaYerba() {
  const { c, ctx } = lienzo(128, 128);
  const r = rng(221);
  ctx.fillStyle = '#8d9442';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const tono = r();
    ctx.fillStyle = tono > 0.7 ? '#c7c27a' : tono > 0.35 ? '#6d7a2e' : '#a3a55a';
    ctx.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1 + r() * 2);
  }
  return c;
}

/** Mate imperial: calabaza forrada en cuero negro, con patitas y virola cincelada. */
export function mateConBombilla() {
  const g = new THREE.Group();
  const cuero = new THREE.MeshStandardMaterial({ map: aTextura(texturaCuero()), roughness: 0.62 });
  const perfil = [
    [0.0, 0.022],
    [0.026, 0.022],
    [0.04, 0.032],
    [0.047, 0.05],
    [0.046, 0.067],
    [0.04, 0.079],
    [0.036, 0.086],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), cuero));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(
      cilindroEntre(
        new THREE.Vector3(Math.cos(a) * 0.022, 0.032, Math.sin(a) * 0.022),
        new THREE.Vector3(Math.cos(a) * 0.037, 0.002, Math.sin(a) * 0.037),
        0.008,
        0.01,
        cuero,
        10,
      ),
    );
  }
  const cincelado = aTextura(texturaCincelado(), { repetir: [3, 1] });
  const virola = new THREE.MeshStandardMaterial({ map: cincelado, metalness: 1, roughness: 0.34, side: THREE.DoubleSide });
  const perfilVirola = [
    [0.035, 0.082],
    [0.041, 0.088],
    [0.05, 0.094],
    [0.057, 0.1],
    [0.0585, 0.104],
    [0.0545, 0.1055],
    [0.046, 0.1],
    [0.039, 0.097],
    [0.036, 0.095],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(perfilVirola, 64), virola));
  const yerba = new THREE.Mesh(new THREE.CircleGeometry(0.037, 32), new THREE.MeshStandardMaterial({ map: aTextura(texturaYerba()), roughness: 1 }));
  yerba.rotation.x = -Math.PI / 2;
  yerba.position.y = 0.097;
  g.add(yerba);
  // Bombilla pico de loro
  const alpaca = new THREE.MeshStandardMaterial({ color: 0xd2c6a6, metalness: 1, roughness: 0.26 });
  g.add(cilindroEntre(new THREE.Vector3(0.012, 0.05, 0.004), new THREE.Vector3(0.019, 0.158, 0.006), 0.0034, 0.0034, alpaca, 10));
  const pico = cilindroEntre(new THREE.Vector3(0.019, 0.158, 0.006), new THREE.Vector3(0.035, 0.168, 0.006), 0.0048, 0.0048, alpaca, 10);
  pico.scale.x = 0.45;
  g.add(pico);
  return sombra(g);
}

/** Calcos genéricos sobre el termo negro (sin marcas). */
function texturaStickers() {
  const W = 1024;
  const H = 512;
  const { c, ctx } = lienzo(W, H);
  ctx.fillStyle = '#151515';
  ctx.fillRect(0, 0, W, H);
  grano(ctx, W, H, 8, 231);
  // Holográfico con un cohetito
  const holo = ctx.createLinearGradient(380, 80, 540, 240);
  ['#ff9ad5', '#9ad7ff', '#b6ffb0', '#fff59a', '#ffb38a', '#c9a6ff'].forEach((col, i, arr) => holo.addColorStop(i / (arr.length - 1), col));
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.arc(460, 150, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = holo;
  ctx.beginPath();
  ctx.arc(460, 150, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b3a8a';
  ctx.beginPath();
  ctx.moveTo(500, 105);
  ctx.lineTo(530, 95);
  ctx.lineTo(520, 125);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff8a3a';
  ctx.beginPath();
  ctx.arc(498, 128, 7, 0, Math.PI * 2);
  ctx.fill();
  // Guitarra eléctrica
  ctx.save();
  ctx.translate(410, 330);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#f3efe6';
  ctx.beginPath();
  ctx.ellipse(0, 40, 46, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-9, -130, 18, 140);
  const sol = ctx.createRadialGradient(0, 45, 6, 0, 45, 48);
  sol.addColorStop(0, '#ffd34a');
  sol.addColorStop(0.6, '#e2662b');
  sol.addColorStop(1, '#5a1e10');
  ctx.fillStyle = sol;
  ctx.beginPath();
  ctx.ellipse(0, 42, 38, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a26a';
  ctx.fillRect(-6, -125, 12, 130);
  ctx.fillStyle = '#eee';
  ctx.fillRect(-14, 30, 28, 6);
  ctx.restore();
  // Gatito con anteojos
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  ctx.arc(600, 300, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d1d1d';
  ctx.beginPath();
  ctx.arc(600, 305, 48, 0, Math.PI * 2);
  ctx.moveTo(562, 280);
  ctx.lineTo(570, 240);
  ctx.lineTo(590, 265);
  ctx.moveTo(638, 280);
  ctx.lineTo(630, 240);
  ctx.lineTo(610, 265);
  ctx.fill();
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(570, 296, 60, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(572, 293, 24, 14);
  ctx.fillRect(604, 293, 24, 14);
  // Etiqueta lila
  ctx.fillStyle = '#e9e2f5';
  ctx.beginPath();
  ctx.roundRect(650, 120, 110, 150, 10);
  ctx.fill();
  ctx.fillStyle = '#5d4f8a';
  ctx.font = '700 46px Inter, sans-serif';
  ctx.fillText('EB', 668, 185);
  ctx.fillRect(668, 205, 70, 6);
  ctx.fillRect(668, 220, 50, 6);
  // Tiras de colores
  ['#3e8e4e', '#d63c32', '#e8b43a'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(770, 300 + i * 45, 34, 38);
  });
  // Calco celeste con figura
  ctx.fillStyle = '#7ec3ea';
  ctx.beginPath();
  ctx.roundRect(470, 400, 90, 100, 14);
  ctx.fill();
  ctx.fillStyle = '#d64a3a';
  ctx.fillRect(500, 445, 30, 22);
  return c;
}

/** Termo negro con manija lateral, pico cebador y calcos. */
export function termo() {
  const g = new THREE.Group();
  const negro = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55 });
  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.22, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: aTextura(texturaStickers()), roughness: 0.45 }),
  );
  cuerpo.position.y = 0.13;
  cuerpo.rotation.y = Math.PI;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.04, 0.022, 48), negro);
  base.position.y = 0.011;
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.04, 0.02, 48), negro);
  cuello.position.y = 0.25;
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.042, 0.07, 48), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
  tapa.position.y = 0.295;
  const estrias = new THREE.Mesh(new THREE.CylinderGeometry(0.0425, 0.0425, 0.035, 24), new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.8, flatShading: true }));
  estrias.position.y = 0.285;
  const pico = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.05, 0.012), negro);
  pico.position.set(0.012, 0.345, 0);
  pico.rotation.z = -0.45;
  const asa = new THREE.Group();
  asa.add(caja(0.014, 0.17, 0.016, negro, -0.07, 0.17, 0));
  asa.add(caja(0.034, 0.014, 0.016, negro, -0.054, 0.252, 0));
  asa.add(caja(0.034, 0.014, 0.016, negro, -0.054, 0.09, 0));
  g.add(cuerpo, base, cuello, estrias, tapa, pico, asa);
  g.rotation.y = 0.5;
  return sombra(g);
}

/* --------------------------------------------------------------- reloj */

function texturaEsfera() {
  const S = 512;
  const { c, ctx } = lienzo(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#f6eedd');
  g.addColorStop(1, '#e6d8bd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) {
    const grande = i % 5 === 0;
    ctx.save();
    ctx.rotate((i / 60) * Math.PI * 2);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(grande ? -4 : -1.5, -S * 0.46, grande ? 8 : 3, grande ? 30 : 14);
    ctx.restore();
  }
  ctx.fillStyle = '#2a2420';
  ctx.font = '500 64px "EB Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [n, a] of [
    ['12', 0],
    ['3', 90],
    ['6', 180],
    ['9', 270],
  ] as const) {
    const rad = ((a - 90) * Math.PI) / 180;
    ctx.fillText(n, Math.cos(rad) * S * 0.32, Math.sin(rad) * S * 0.32 + 4);
  }
  ctx.font = 'italic 500 26px "EB Garamond", Georgia, serif';
  ctx.fillText('Buenos Aires', 0, S * 0.16);
  grano(ctx, S, S, 8, 241);
  return c;
}

/** Reloj de pared con la hora real de Buenos Aires. */
export function relojDePared() {
  const g = new THREE.Group();
  const R = 0.15;
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.014, R + 0.014, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.45 }));
  aro.rotation.x = Math.PI / 2;
  aro.position.z = 0.02;
  const esfera = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ map: aTextura(texturaEsfera()), roughness: 0.7 }));
  esfera.position.z = 0.0405;
  g.add(aro, esfera);
  const aguja = (largo: number, ancho: number, color: number, z: number) => {
    const pivote = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, largo, 0.002), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    m.position.y = largo / 2 - 0.012;
    m.castShadow = true;
    pivote.add(m);
    pivote.position.z = z;
    g.add(pivote);
    return pivote;
  };
  const horas = aguja(0.085, 0.008, 0x1d1915, 0.043);
  const minutos = aguja(0.125, 0.005, 0x1d1915, 0.0455);
  const segundos = aguja(0.13, 0.0018, 0xb03a2e, 0.048);
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0x1d1915 }));
  centro.rotation.x = Math.PI / 2;
  centro.position.z = 0.05;
  g.add(centro);
  sombra(g);
  return {
    grupo: g,
    /** hora: decimal en horas (ej. 21.5). */
    ajustar(hora: number) {
      const h = ((hora % 12) + 12) % 12;
      const m = (hora * 60) % 60;
      const s = (hora * 3600) % 60;
      horas.rotation.z = -(h / 12) * Math.PI * 2;
      minutos.rotation.z = -(m / 60) * Math.PI * 2;
      segundos.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2;
    },
  };
}

/** Pila de libros acostados (el más grande abajo). */
export function pilaDeLibros(libros: LibroVisual[]) {
  const g = new THREE.Group();
  const ordenados = [...libros].sort((a, b) => b.libro.alto * b.libro.ancho - a.libro.alto * a.libro.ancho);
  let y = 0;
  const r = rng(151);
  let ancho = 0;
  for (const lv of ordenados) {
    const t = lv.grosor;
    lv.mesh.rotation.set(0, (r() - 0.5) * 0.12, Math.PI / 2);
    lv.mesh.position.set((r() - 0.5) * 0.01, y + t / 2, 0.02);
    g.add(lv.mesh);
    y += t;
    ancho = Math.max(ancho, lv.alto);
  }
  return { grupo: g, ancho: ancho + 0.01 };
}

/** Hace señalables al tocadiscos, al cajón de vinilos y a la agenda. */
export function marcarObjetos(o: { tocadiscos: THREE.Object3D; cajon: THREE.Object3D; agenda: THREE.Object3D }) {
  marcar(o.tocadiscos, { tipo: 'tocadiscos', titulo: 'Tocadiscos', subtitulo: 'Muy pronto, con tu Spotify', resaltar: resaltadorDe(o.tocadiscos) });
  marcar(o.cajon, { tipo: 'vinilos', titulo: 'Vinilos', subtitulo: 'Muy pronto, tus discos más escuchados', resaltar: resaltadorDe(o.cajon) });
  marcar(o.agenda, { tipo: 'agenda', titulo: 'Wishlist', subtitulo: 'Mi agenda de libros deseados', resaltar: resaltadorDe(o.agenda, 0.3) });
}
