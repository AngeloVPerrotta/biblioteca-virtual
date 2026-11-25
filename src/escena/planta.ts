/**
 * Singonio en maceta de terracota: hojas en forma de flecha, algunas
 * cayendo por el borde de la biblioteca.
 */
import * as THREE from 'three';
import { rng } from '../util/aleatorio';
import { aTextura, grano, lienzo, texturaHoja } from './texturas';

function geometriaHoja(largo: number) {
  const L = largo;
  const s = new THREE.Shape();
  s.moveTo(0, 0.04 * L);
  s.bezierCurveTo(0.12 * L, 0.02 * L, 0.3 * L, -0.06 * L, 0.36 * L, -0.2 * L);
  s.bezierCurveTo(0.3 * L, -0.02 * L, 0.46 * L, 0.2 * L, 0.36 * L, 0.48 * L);
  s.bezierCurveTo(0.28 * L, 0.72 * L, 0.1 * L, 0.9 * L, 0, L);
  s.bezierCurveTo(-0.1 * L, 0.9 * L, -0.28 * L, 0.72 * L, -0.36 * L, 0.48 * L);
  s.bezierCurveTo(-0.46 * L, 0.2 * L, -0.3 * L, -0.02 * L, -0.36 * L, -0.2 * L);
  s.bezierCurveTo(-0.3 * L, -0.06 * L, -0.12 * L, 0.02 * L, 0, 0.04 * L);
  const geo = new THREE.ShapeGeometry(s, 10);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x - bb.min.x) / (bb.max.x - bb.min.x), (y - bb.min.y) / (bb.max.y - bb.min.y));
    // Curvatura: la hoja se ahueca y la punta cae hacia atrás
    const t = Math.max(0, y / L);
    pos.setZ(i, -(x * x) / L * 1.6 - t * t * L * 0.18);
  }
  geo.computeVertexNormals();
  return geo;
}

function texturaTerracota() {
  const { c, ctx } = lienzo(256, 256);
  ctx.fillStyle = '#b5653d';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(161);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(90,40,20,0.08)' : 'rgba(240,200,170,0.07)';
    ctx.beginPath();
    ctx.arc(r() * 256, r() * 256, 2 + r() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // Marcas de cal cerca del borde
  ctx.fillStyle = 'rgba(235,225,205,0.25)';
  ctx.fillRect(0, 0, 256, 18);
  grano(ctx, 256, 256, 16, 162);
  return c;
}

export function singonio() {
  const g = new THREE.Group();
  const maceta = new THREE.MeshStandardMaterial({ map: aTextura(texturaTerracota()), roughness: 0.9 });
  const perfil = [
    [0.0, 0.0],
    [0.07, 0.0],
    [0.078, 0.006],
    [0.098, 0.15],
    [0.112, 0.152],
    [0.114, 0.18],
    [0.104, 0.182],
    [0.1, 0.17],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cuerpo = new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), maceta);
  cuerpo.material.side = THREE.DoubleSide;
  g.add(cuerpo);
  const tierra = new THREE.Mesh(new THREE.CircleGeometry(0.099, 32), new THREE.MeshStandardMaterial({ color: 0x2e2117, roughness: 1 }));
  tierra.rotation.x = -Math.PI / 2;
  tierra.position.y = 0.165;
  g.add(tierra);

  const materialesHoja = [0, 1, 2].map(
    (i) =>
      new THREE.MeshStandardMaterial({
        map: aTextura(texturaHoja(i)),
        side: THREE.DoubleSide,
        roughness: 0.55,
        color: [0xffffff, 0xe8f2dc, 0xf4ffe6][i],
      }),
  );
  const tallo = new THREE.MeshStandardMaterial({ color: 0x6d9a4f, roughness: 0.6 });
  const r = rng(171);
  const centro = new THREE.Vector3(0, 0.165, 0);
  const total = 15;
  for (let i = 0; i < total; i++) {
    // Todas las hojas hacia arriba y afuera: una mata prolija, sin tallos colgando
    const az = (i / total) * Math.PI * 2 + r() * 0.4;
    const elev = 0.45 + r() * 0.8;
    const largo = 0.15 + r() * 0.17;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev) * 0.8 + 0.2).normalize();
    const fin = centro.clone().addScaledVector(dir, largo);
    const control = centro.clone().add(new THREE.Vector3(dir.x * largo * 0.4, largo * 0.7, dir.z * largo * 0.4));
    const curva = new THREE.QuadraticBezierCurve3(centro.clone(), control, fin);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 16, 0.0028, 5, false), tallo));

    const hoja = new THREE.Mesh(geometriaHoja(0.12 + r() * 0.06), materialesHoja[i % 3]);
    const tangente = curva.getTangent(1).normalize();
    const eje = tangente.clone().lerp(new THREE.Vector3(dir.x, 0.25, dir.z + 0.3), 0.3).normalize();
    const arriba = new THREE.Vector3(0, 1, 0.35).normalize();
    let x = new THREE.Vector3().crossVectors(eje, arriba);
    if (x.lengthSq() < 1e-4) x = new THREE.Vector3(1, 0, 0);
    x.normalize();
    const normal = new THREE.Vector3().crossVectors(x, eje).normalize();
    hoja.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, eje, normal));
    hoja.rotateY((r() - 0.5) * 0.6);
    hoja.position.copy(fin);
    g.add(hoja);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
