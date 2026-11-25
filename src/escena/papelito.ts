/**
 * Post-it pegado en el cajón de la mesa de luz que dice «¿qué leo?»:
 * la puerta discreta al recomendador. Se despega apenas de abajo, como uno de verdad.
 */
import * as THREE from 'three';
import { aTextura, lienzo } from './texturas';

export function papelitoQueLeo() {
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

  ctx.fillStyle = '#2c3a6b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px Caveat, cursive';
  ctx.save();
  ctx.translate(128, 104);
  ctx.rotate(-0.05);
  ctx.fillText('¿qué leo?', 0, 0);
  ctx.restore();

  // Subrayado a mano
  ctx.strokeStyle = '#b5523b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 150);
  ctx.quadraticCurveTo(128, 138, 204, 146);
  ctx.stroke();

  // Un librito abierto dibujado en birome
  ctx.strokeStyle = '#2c3a6b';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(100, 190);
  ctx.quadraticCurveTo(114, 182, 128, 190);
  ctx.quadraticCurveTo(142, 182, 156, 190);
  ctx.lineTo(156, 214);
  ctx.quadraticCurveTo(142, 206, 128, 214);
  ctx.quadraticCurveTo(114, 206, 100, 214);
  ctx.closePath();
  ctx.moveTo(128, 190);
  ctx.lineTo(128, 214);
  ctx.stroke();

  const tex = aTextura(c);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.85,
    side: THREE.DoubleSide,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0,
  });
  const lado = 0.085;
  const geo = new THREE.PlaneGeometry(lado, lado, 1, 10);
  // La parte de abajo se despega un poquito de la madera
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, (lado * 0.15 - pos.getY(i)) / (lado * 0.65));
    pos.setZ(i, k * k * 0.008);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'papelito-que-leo';
  return { mesh, resaltar: (v: number) => (mat.emissiveIntensity = v * 0.22) };
}
