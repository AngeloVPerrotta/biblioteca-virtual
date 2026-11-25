/**
 * La habitación: piso de parquet, paredes blanco cálido, ventana con cortinas
 * de lino, el exterior (cielo, ciudad, jacarandá) y la alfombra persa.
 */
import * as THREE from 'three';
import { aTextura, texturaAlfombra, texturaCiudad, texturaFlecos, texturaJacaranda, texturaLino, texturaParquet, texturaYeso } from './texturas';

export const CUARTO = { ancho: 6.4, fondo: 5.4, alto: 2.8 };

export interface Ventana {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const cieloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cieloFragment = /* glsl */ `
  uniform vec3 uArriba;
  uniform vec3 uHorizonte;
  uniform vec3 uSolColor;
  uniform vec2 uSol;
  uniform float uSolBrillo;
  uniform float uEstrellas;
  uniform float uTiempo;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float t = smoothstep(0.0, 0.75, vUv.y);
    vec3 col = mix(uHorizonte, uArriba, pow(t, 0.8));
    float d = distance(vUv * vec2(2.1, 1.0), uSol * vec2(2.1, 1.0));
    col += uSolColor * uSolBrillo * (0.55 * exp(-d * 9.0) + 0.25 * exp(-d * 2.5));
    vec2 celda = floor(vUv * vec2(260.0, 120.0));
    float h = hash(celda);
    float titila = 0.6 + 0.4 * sin(uTiempo * (1.0 + h * 3.0) + h * 40.0);
    float estrella = step(0.992, h) * titila * smoothstep(0.25, 0.7, vUv.y);
    col += vec3(1.0, 0.95, 0.85) * estrella * uEstrellas * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function crearHabitacion(ventana: Ventana) {
  const g = new THREE.Group();
  g.name = 'habitacion';
  const { ancho, fondo, alto } = CUARTO;

  // Piso
  const parquet = aTextura(texturaParquet(), { repetir: [ancho / 1.45, fondo / 1.45] });
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, fondo),
    new THREE.MeshStandardMaterial({ map: parquet, roughness: 0.48, metalness: 0, color: 0xf2e2cf }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, fondo / 2 - 0.2);
  piso.receiveShadow = true;
  g.add(piso);

  // Paredes
  const yeso = texturaYeso('#f2e5d0');
  const matPared = (rep: [number, number]) =>
    new THREE.MeshStandardMaterial({ map: aTextura(yeso, { repetir: rep }), roughness: 0.92, color: 0xffffff });
  const grosorPared = 0.14;
  const paredFondo = new THREE.Group();
  const bloque = (x0: number, x1: number, y0: number, y1: number) => {
    const w = x1 - x0;
    const h = y1 - y0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, grosorPared), matPared([w / 1.6, h / 1.6]));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, -grosorPared / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    paredFondo.add(m);
  };
  bloque(-ancho / 2, ventana.x0, 0, alto);
  bloque(ventana.x1, ancho / 2, 0, alto);
  bloque(ventana.x0, ventana.x1, 0, ventana.y0);
  bloque(ventana.x0, ventana.x1, ventana.y1, alto);
  g.add(paredFondo);

  for (const lado of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fondo, alto), matPared([fondo / 1.6, alto / 1.6]));
    p.rotation.y = -lado * Math.PI / 2;
    p.position.set((lado * ancho) / 2, alto / 2, fondo / 2 - 0.2);
    p.receiveShadow = true;
    g.add(p);
  }
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), new THREE.MeshStandardMaterial({ color: 0xf2ebe0, roughness: 0.95 }));
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, alto, fondo / 2 - 0.2);
  g.add(techo);

  // Zócalo
  const zocalo = new THREE.MeshStandardMaterial({ color: 0xf1ebe1, roughness: 0.6 });
  for (const [x0, x1] of [
    [-ancho / 2, ancho / 2],
  ]) {
    const z = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.09, 0.014), zocalo);
    z.position.set((x0 + x1) / 2, 0.045, 0.007);
    z.receiveShadow = true;
    g.add(z);
  }

  // Ventana: marco, travesaños, vidrio y alféizar
  const vw = ventana.x1 - ventana.x0;
  const vh = ventana.y1 - ventana.y0;
  const vx = (ventana.x0 + ventana.x1) / 2;
  const vy = (ventana.y0 + ventana.y1) / 2;
  const pintura = new THREE.MeshStandardMaterial({ color: 0xf0e9dd, roughness: 0.5 });
  const marco = new THREE.Group();
  const listón = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), pintura);
    m.position.set(x, y, -0.07);
    m.castShadow = true;
    m.receiveShadow = true;
    marco.add(m);
  };
  const t = 0.055;
  listón(vw, t, vx, ventana.y1 - t / 2);
  listón(vw, t, vx, ventana.y0 + t / 2);
  listón(t, vh, ventana.x0 + t / 2, vy);
  listón(t, vh, ventana.x1 - t / 2, vy);
  listón(0.035, vh, vx, vy);
  listón(vw, 0.035, vx, ventana.y0 + vh * 0.72);
  g.add(marco);
  const vidrio = new THREE.Mesh(
    new THREE.PlaneGeometry(vw, vh),
    new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, transparent: true, opacity: 0.07, roughness: 0.16, metalness: 0, envMapIntensity: 1.5, depthWrite: false }),
  );
  vidrio.position.set(vx, vy, -0.075);
  g.add(vidrio);
  const alfeizar = new THREE.Mesh(new THREE.BoxGeometry(vw + 0.12, 0.03, 0.22), pintura);
  alfeizar.position.set(vx, ventana.y0 - 0.015, -0.04);
  alfeizar.castShadow = alfeizar.receiveShadow = true;
  g.add(alfeizar);

  // Barral y cortinas de lino
  const barral = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, vw + 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0x2b2622, metalness: 0.7, roughness: 0.35 }),
  );
  barral.rotation.z = Math.PI / 2;
  barral.position.set(vx, ventana.y1 + 0.14, 0.08);
  g.add(barral);
  const lino = aTextura(texturaLino(), { repetir: [3, 6] });
  const matCortina = new THREE.MeshStandardMaterial({
    map: lino,
    color: 0xf2e9d8,
    side: THREE.DoubleSide,
    roughness: 0.95,
    transparent: true,
    opacity: 0.93,
    emissive: 0xffe2b8,
    emissiveIntensity: 0.0,
  });
  const altoCortina = ventana.y1 + 0.12;
  const cortina = (x: number) => {
    const geo = new THREE.PlaneGeometry(0.58, altoCortina, 60, 6);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const caida = 1 - (py / altoCortina + 0.5) * 0.25;
      pos.setZ(i, Math.sin(px * 52) * 0.022 * caida + Math.sin(px * 17 + 1) * 0.01);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matCortina);
    m.position.set(x, altoCortina / 2 + 0.02, 0.07);
    // Lino liviano: deja pasar el sol (no proyecta sombra opaca)
    m.castShadow = false;
    m.receiveShadow = true;
    return m;
  };
  g.add(cortina(ventana.x0 - 0.12), cortina(ventana.x1 + 0.12));

  // Exterior: cielo, ciudad y jacarandá
  const uniformesCielo = {
    uArriba: { value: new THREE.Color('#1b1f4a') },
    uHorizonte: { value: new THREE.Color('#5a4a7a') },
    uSolColor: { value: new THREE.Color('#ffb070') },
    uSol: { value: new THREE.Vector2(0.4, 0.2) },
    uSolBrillo: { value: 0 },
    uEstrellas: { value: 1 },
    uTiempo: { value: 0 },
  };
  const cielo = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 16),
    new THREE.ShaderMaterial({ uniforms: uniformesCielo, vertexShader: cieloVertex, fragmentShader: cieloFragment, depthWrite: false }),
  );
  cielo.position.set(vx - 2, 4, -10);
  g.add(cielo);

  const ciudadTex = texturaCiudad();
  const matCiudad = new THREE.MeshBasicMaterial({ map: aTextura(ciudadTex.base), transparent: true, color: 0x2a2638, depthWrite: false });
  const matLuces = new THREE.MeshBasicMaterial({ map: aTextura(ciudadTex.luces), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const ciudad = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), matCiudad);
  ciudad.position.set(vx - 3, 0.2, -6.5);
  const luces = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), matLuces);
  luces.position.set(vx - 3, 0.2, -6.49);
  g.add(ciudad, luces);

  const matJacaranda = new THREE.MeshBasicMaterial({ map: aTextura(texturaJacaranda()), transparent: true, color: 0xffffff, depthWrite: false });
  const jacaranda = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), matJacaranda);
  jacaranda.position.set(vx - 0.9, ventana.y1 - 0.4, -1.6);
  g.add(jacaranda);

  // Alfombra persa con flecos
  const alfombra = new THREE.Group();
  const aw = 2.4;
  const ad = 1.6;
  const matAlfombra = new THREE.MeshStandardMaterial({ map: aTextura(texturaAlfombra()), roughness: 1, color: 0xffffff });
  const pelo = new THREE.Mesh(new THREE.BoxGeometry(aw, 0.008, ad), [
    new THREE.MeshStandardMaterial({ color: 0x5c171b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5c171b, roughness: 1 }),
    matAlfombra,
    new THREE.MeshStandardMaterial({ color: 0x3a1012, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5c171b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5c171b, roughness: 1 }),
  ]);
  pelo.position.y = 0.004;
  pelo.receiveShadow = true;
  alfombra.add(pelo);
  const flecos = aTextura(texturaFlecos());
  for (const lado of [-1, 1]) {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(ad, 0.07),
      new THREE.MeshStandardMaterial({ map: flecos, alphaTest: 0.4, transparent: true, roughness: 1, side: THREE.DoubleSide }),
    );
    f.rotation.set(-Math.PI / 2, 0, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
    f.position.set((lado * (aw + 0.07)) / 2, 0.003, 0);
    f.receiveShadow = true;
    alfombra.add(f);
  }
  alfombra.position.set(0, 0, 1.3);
  g.add(alfombra);

  return {
    grupo: g,
    cielo: uniformesCielo,
    ciudad: matCiudad,
    lucesCiudad: matLuces,
    jacaranda: matJacaranda,
    cortinas: matCortina,
    ventana,
  };
}

export type Habitacion = ReturnType<typeof crearHabitacion>;
