/**
 * El papelito pegado en el cajón de la mesa de luz que dice «¿qué leo?»: la puerta discreta al recomendador.
 * Por defecto es un post-it escrito a máquina; como variante, una ficha de cartón de biblioteca.
 * Se despega apenas de abajo, como uno de verdad.
 */
import * as THREE from 'three';
import { aTextura, grano, lienzo } from './texturas';

const MAQUINA = '"Special Elite", "Courier New", monospace';

function postit() {
  const { c, ctx } = lienzo(256, 256);
  ctx.fillStyle = '#f6e7a8';
  ctx.fillRect(0, 0, 256, 256);
  // La franja de pegamento arriba y una sombrita donde se despega
  const sombra = ctx.createLinearGradient(0, 0, 0, 256);
  sombra.addColorStop(0, 'rgba(90, 60, 0, 0.07)');
  sombra.addColorStop(0.17, 'rgba(90, 60, 0, 0)');
  sombra.addColorStop(0.8, 'rgba(90, 60, 0, 0)');
  sombra.addColorStop(1, 'rgba(90, 60, 0, 0.1)');
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#23252b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 40px ${MAQUINA}`;
  ctx.fillText('¿qué leo?', 128, 112, 224);
  // Subrayado en birome
  ctx.strokeStyle = '#a8442f';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(48, 146);
  ctx.quadraticCurveTo(128, 140, 208, 144);
  ctx.stroke();
  grano(ctx, 256, 256, 8, 71);
  return { c, ancho: 0.085, alto: 0.085 };
}

function ficha() {
  const W = 512;
  const H = 320;
  const { c, ctx } = lienzo(W, H);
  ctx.fillStyle = '#ece1c8';
  ctx.fillRect(0, 0, W, H);
  // Renglones celestes y la línea roja de arriba, como las fichas de catálogo
  ctx.fillStyle = 'rgba(70, 110, 160, 0.32)';
  for (let y = 118; y < H - 24; y += 30) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = 'rgba(170, 50, 40, 0.55)';
  ctx.fillRect(0, 84, W, 3);
  ctx.fillRect(66, 84, 2, H - 84);
  // El agujero de la varilla del fichero
  ctx.fillStyle = 'rgba(60, 40, 20, 0.55)';
  ctx.beginPath();
  ctx.arc(W / 2, H - 22, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#202124';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 52px ${MAQUINA}`;
  ctx.fillText('¿QUÉ LEO?', 82, 68, W - 120);
  ctx.font = `400 25px ${MAQUINA}`;
  ctx.fillStyle = 'rgba(32, 33, 36, 0.85)';
  ctx.fillText('Consultar a la biblioteca', 82, 141, W - 110);
  ctx.fillText('según el día.', 82, 171, W - 110);
  ctx.font = `400 22px ${MAQUINA}`;
  ctx.fillStyle = 'rgba(32, 33, 36, 0.6)';
  ctx.textAlign = 'right';
  ctx.fillText('B-001', W - 16, 34);
  grano(ctx, W, H, 12, 73);
  return { c, ancho: 0.1, alto: 0.0625 };
}

export function papelitoQueLeo(comoFicha = false) {
  const { c, ancho, alto } = comoFicha ? ficha() : postit();
  const tex = aTextura(c);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: comoFicha ? 0.92 : 0.85,
    side: THREE.DoubleSide,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0,
  });
  const geo = new THREE.PlaneGeometry(ancho, alto, 1, 10);
  // La parte de abajo se despega un poquito de la madera (la ficha, menos: es cartón)
  const pos = geo.attributes.position;
  const curva = comoFicha ? 0.003 : 0.008;
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, (alto * 0.15 - pos.getY(i)) / (alto * 0.65));
    pos.setZ(i, k * k * curva);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'papelito-que-leo';
  return { mesh, resaltar: (v: number) => (mat.emissiveIntensity = v * 0.22) };
}
