/**
 * El papelito pegado en el cajón de la mesa de luz que dice «¿qué leo?»: la puerta discreta al recomendador.
 * Un post-it amarillo escrito a máquina.
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

export function papelitoQueLeo() {
  const { c, ancho, alto } = postit();
  const tex = aTextura(c);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.85,
    side: THREE.DoubleSide,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0,
  });
  const geo = new THREE.PlaneGeometry(ancho, alto, 1, 10);
  // La parte de abajo se despega un poquito de la madera
  const pos = geo.attributes.position;
  const curva = 0.008;
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
