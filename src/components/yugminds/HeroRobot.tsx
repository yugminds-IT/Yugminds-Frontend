"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw, RotateCw } from "lucide-react";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
  The RoboCoders robot car in a 3D-printed hypercar shell. It drives in and
  cruises (floor and speed lines stream past, front wheels steer toward the
  cursor), then slows, lifts its shell and comes apart once, each part tagged
  with the YugMinds company that makes it, before putting itself back
  together. Drag to turn it; the button takes it apart or puts it back.
*/

type Side = "l" | "r";
type Tag = { key: string; company: string; part: string; side: Side; anchor: [number, number, number] };

const TAGS: Tag[] = [
  { key: "shell", company: "YugMinds Manufacturing", part: "Makes the body, chassis and every part that holds it together", side: "r", anchor: [0.9, 1.1, -1.4] },
  { key: "card", company: "Robocoders™", part: "Teaches kids to build and code robots like this one", side: "r", anchor: [0.48, 0, 0] },
  { key: "oled", company: "YugMinds Software", part: "Writes the code we load into it, so it sees and drives", side: "r", anchor: [0.27, 0, 0] },
  { key: "board", company: "YugMinds Hardware", part: "Designs the electronics and circuit boards that power it", side: "r", anchor: [0.55, 0.05, -0.3] },
  { key: "sensors", company: "YugMinds Labs", part: "Where we build and test it all, until it works", side: "r", anchor: [0.5, -0.6, 0] },
];

type Layer = { o: THREE.Object3D; base: THREE.Vector3; out: THREE.Vector3; delay: number; tilt?: number };

const PCB = "#1e40af";
export const R = 0.46; // tyre radius
export const WHEEL_X = 0.86;
export const AXLE_Z = 1.55;
const FORWARD_YAW = -0.86; // front three-quarter, facing the headline
const CRUISE = 3.2; // floor speed while driving

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* Fine horizontal ridges: the layer lines of a 3D print, used as a bump map. */
export function layerLines() {
  const t = canvasTexture(8, 64, (g) => {
    for (let y = 0; y < 64; y += 4) {
      g.fillStyle = "#ffffff";
      g.fillRect(0, y, 8, 2);
      g.fillStyle = "#8a8a8a";
      g.fillRect(0, y + 2, 8, 2);
    }
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3.2);
  return t;
}

/* Twill carbon weave. */
export function carbon() {
  const t = canvasTexture(64, 64, (g) => {
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        const on = ((x + y) / 8) % 2 === 0;
        g.fillStyle = on ? "#1f2937" : "#0b1120";
        g.fillRect(x, y, 8, 8);
        g.fillStyle = on ? "#374151" : "#111827";
        g.fillRect(x, y, 8, 2);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}

/* Studio floor: pale concrete with a faint grid, scrolled to show speed. */
function floorTexture() {
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = "#f6f8fb";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(100,116,139,${Math.random() * 0.03})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    g.fillStyle = "#e9eef4";
    g.fillRect(0, 0, 512, 3);
    g.fillRect(0, 0, 3, 512);
    g.fillStyle = "#e2e8f0";
    g.fillRect(250, 120, 12, 150);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  return t;
}

/* The ESP32 board's top: soldermask, traces, pads and silkscreen. */
export function boardTop() {
  return canvasTexture(1024, 1024, (g) => {
    g.fillStyle = PCB;
    g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = "#2f56d0";
    g.lineWidth = 7;
    g.lineCap = "round";
    for (let i = 0; i < 24; i++) {
      const y = 150 + i * 30;
      g.beginPath();
      g.moveTo(90, y);
      g.lineTo(220 + (i % 5) * 30, y);
      g.lineTo(300 + (i % 5) * 30, y + 40);
      g.lineTo(380, y + 40);
      g.stroke();
      g.beginPath();
      g.moveTo(934, y);
      g.lineTo(800 - (i % 4) * 26, y);
      g.lineTo(740 - (i % 4) * 26, y - 30);
      g.stroke();
    }
    g.strokeStyle = "#f8fafc";
    g.lineWidth = 4;
    g.strokeRect(330, 260, 360, 420);
    g.fillStyle = "#f8fafc";
    g.font = "700 54px system-ui, sans-serif";
    g.fillText("RoboCoders", 360, 760);
    g.font = "600 30px system-ui, sans-serif";
    g.fillText("Main board", 420, 805);
    g.font = "600 24px system-ui, sans-serif";
    ["M1", "M2", "M3", "M4"].forEach((t, i) => g.fillText(t, 140 + i * 220, 70));
  });
}

/* Robocoders' lesson card: the obstacle-avoider lesson, as the block code kids snap together for this car. */
export function lessonCard() {
  return canvasTexture(1024, 640, (g) => {
    const block = (x: number, y: number, w: number, h: number, fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      g.roundRect(x, y, w, h, 12);
      g.fill();
    };
    const text = (t: string, x: number, y: number, color: string, size = 30, weight = 700) => {
      g.fillStyle = color;
      g.font = `${weight} ${size}px system-ui, sans-serif`;
      g.fillText(t, x, y);
    };
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 1024, 640);
    // Header: who teaches it, and which lesson.
    g.fillStyle = "#2563eb";
    g.fillRect(0, 0, 1024, 88);
    text("Robocoders", 44, 58, "#ffffff", 38, 800);
    text("Lesson 6", 836, 58, "#dbeafe", 30, 600);
    text("Teach it to dodge obstacles", 44, 152, "#0f172a", 46, 800);
    // The program, as blocks: start, loop, sensor check, actions.
    block(44, 186, 430, 60, "#f59e0b");
    text("when the robot starts", 66, 226, "#0f172a");
    block(44, 256, 250, 60, "#2563eb");
    text("forever", 66, 296, "#ffffff");
    g.fillStyle = "#2563eb";
    g.fillRect(44, 306, 26, 296);
    block(84, 326, 560, 60, "#0ea5e9");
    text("if", 106, 366, "#ffffff");
    block(146, 336, 360, 40, "#ffffff");
    text("distance  <  20 cm", 166, 366, "#0f172a", 28, 700);
    g.fillStyle = "#0ea5e9";
    g.fillRect(84, 376, 22, 140);
    block(122, 396, 520, 54, "#334155");
    text("stop, back up and turn", 144, 432, "#ffffff", 28);
    block(84, 462, 200, 54, "#0ea5e9");
    text("else", 106, 498, "#ffffff", 28);
    block(122, 526, 420, 54, "#334155");
    text("drive forward", 144, 562, "#ffffff", 28);
    // The robot itself, as a tiny badge: this lesson runs on it.
    block(716, 186, 264, 196, "#eff6ff");
    g.fillStyle = "#0f172a";
    g.beginPath();
    g.roundRect(772, 248, 152, 70, 18);
    g.fill();
    g.fillStyle = "#ffffff";
    for (const cx of [818, 878]) {
      g.beginPath();
      g.arc(cx, 283, 17, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#2563eb";
    for (const cx of [792, 904]) {
      g.beginPath();
      g.arc(cx, 330, 20, 0, Math.PI * 2);
      g.fill();
    }
    text("Runs on this car", 742, 366, "#1e3a8a", 24, 700);
    text("Build it, code it, race it.", 716, 470, "#475569", 26, 600);
  });
}

/* Soft contact shadow, and the ultrasonic mesh face. */ // taste-skill-ignore: 3D textures, not CSS shadows
export function radial(inner: string, outer: string) {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, inner);
    r.addColorStop(1, outer);
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });
}
export function meshFace() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = "#9ca3af";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#374151";
    for (let y = 2; y < 128; y += 7) for (let x = (y % 14) / 2; x < 128; x += 7) g.fillRect(x, y, 4, 4);
  });
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/* `?perf` in the URL logs each scene's draw calls, triangles, frame time and pixel ratio every 2 s. */
export const PERF = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");
const perfStats = new Map<string, { t: number; n: number; ms: number }>();
export function timed<T>(label: string, f: () => T): T {
  if (!PERF) return f();
  const t = performance.now();
  const v = f();
  console.log(`[perf] ${label}: ${(performance.now() - t).toFixed(0)} ms`);
  return v;
}
export function perfLog(tag: string, renderer: THREE.WebGLRenderer, ms: number) {
  const st = perfStats.get(tag) ?? { t: performance.now(), n: 0, ms: 0 };
  st.n++;
  st.ms += ms;
  if (performance.now() - st.t > 2000) {
    const { calls, triangles } = renderer.info.render;
    console.log(`[perf] ${tag}: ${calls} calls, ${triangles} tris, ${(st.ms / st.n).toFixed(1)} ms/frame, dpr ${renderer.getPixelRatio()}`);
    st.t = performance.now();
    st.n = 0;
    st.ms = 0;
  }
  perfStats.set(tag, st);
}

/* Keeps a scene sharp first and smooth second. Renders at the screen's full pixel ratio (up to
   2); only if frames stay slow (over 24 ms on average for 2 seconds running, ignoring the
   load) does it ease down 0.25 at a time, never below 1.25, and it climbs back as soon as
   frames keep pace again. Call tick(ms between frames) once per frame. */
export function adaptiveDpr(renderer: THREE.WebGLRenderer) {
  const max = Math.min(window.devicePixelRatio, 2);
  const floor = Math.min(max, 1.25);
  const started = performance.now();
  let ratio = max;
  let sum = 0;
  let n = 0;
  let slow = 0;
  let calm = 0;
  renderer.setPixelRatio(ratio);
  return {
    tick(ms: number) {
      if (ms > 250 || performance.now() - started < 4000) return; // stalls and the page load aren't the render
      sum += ms;
      n++;
      if (sum < 1000) return;
      const avg = sum / n;
      sum = 0;
      n = 0;
      let next = ratio;
      if (avg > 24) {
        calm = 0;
        if (++slow >= 2) {
          next = Math.max(floor, ratio - 0.25);
          slow = 0;
        }
      } else {
        slow = 0;
        if (avg < 18 && ++calm >= 2) {
          next = Math.min(max, ratio + 0.25); // keeping pace at the 60 fps cap: go back up
          calm = 0;
        }
      }
      if (next !== ratio) {
        ratio = next;
        renderer.setPixelRatio(ratio); // re-sizes the drawing buffer itself
      }
    },
  };
}

/* A flat outline as small triangles: triangulated, then each triangle split into four,
   `levels` times, so the pieces can be bent onto a curved surface point by point. */
export function fineTriangles(shape: THREE.Shape, levels = 3, curveSegments = 12) {
  const flat = new THREE.ShapeGeometry(shape, curveSegments);
  const fp = flat.attributes.position;
  const fi = flat.index!;
  let tris: THREE.Vector2[][] = [];
  for (let i = 0; i < fi.count; i += 3) tris.push([0, 1, 2].map((k) => new THREE.Vector2(fp.getX(fi.getX(i + k)), fp.getY(fi.getX(i + k)))));
  flat.dispose();
  for (let level = 0; level < levels; level++) {
    tris = tris.flatMap(([a, b, c]) => {
      const ab = a.clone().lerp(b, 0.5);
      const bc = b.clone().lerp(c, 0.5);
      const ca = c.clone().lerp(a, 0.5);
      return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
    });
  }
  return tris;
}

const SHELL_HW = 1.04; // half the shell's extruded width, bevel included

/* Shapes the extruded shell: a point (x across, y up, z along) before sculpting -> its x and y after. */
function sculptShell(x: number, y: number, z: number): [number, number] {
  // Plan view: a narrower nose and tail; shoulders rolling in toward the glass.
  let f = (1 - 0.1 * smooth((z - 2.2) / 0.65) - 0.07 * smooth((-z - 2.2) / 0.55)) * (1 - 0.1 * smooth((y - 0.9) / 0.26));
  // Flared arches.
  for (const az of [AXLE_Z, -AXLE_Z]) {
    const k = Math.max(0, 1 - ((z - az) / 0.95) ** 2);
    f += 0.075 * k * smooth((y - 0.22) / 0.2) * (1 - smooth((y - 0.86) / 0.18));
  }
  f += 0.018 * Math.max(0, 1 - Math.abs(y - 0.8) / 0.07); // shoulder crease
  x *= f;
  y -= 0.07 * (x / SHELL_HW) ** 2 * smooth((y - 0.94) / 0.2); // crowned top
  if (y > 0.84 && z > 0.9) {
    const ax = Math.abs(x);
    const along = smooth((z - 0.9) / 0.4) * (1 - smooth((z - 2.55) / 0.25));
    y += 0.05 * Math.exp(-((x / 0.3) ** 2)) * along; // centre dome down the hood
    y += 0.055 * Math.exp(-(((ax - 0.8) / 0.15) ** 2)) * Math.max(0, 1 - ((z - 1.95) / 0.85) ** 2); // fender peaks over the lights
  }
  return [x, y];
}

/* A point on the shell's tail, exactly: the tail is its profile (ducktail lip, rear face,
   under-lip) swept across the width, pushed out by the bevel, then sculpted like the rest.
   x is across the unsculpted width (-1..1), y the height in the profile. */
export function tailPoint(x: number, y: number) {
  const segs: [number, number][][] = [
    [[-2.62, 1.26], [-2.67, 1.2], [-2.72, 1.14]],
    [[-2.72, 1.14], [-2.8, 0.66], [-2.55, 0.3]],
    [[-2.55, 0.3], [-2.45, 0.25], [-2.35, 0.2]],
  ];
  const seg = y >= 1.14 ? segs[0] : y >= 0.3 ? segs[1] : segs[2];
  const at = (t: number) => {
    const [a, c, b] = seg;
    const u = 1 - t;
    return { z: u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], y: u * u * a[1] + 2 * u * t * c[1] + t * t * b[1] };
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).y > y) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  const q = at(t);
  const q2 = at(Math.min(1, t + 0.01));
  const q1 = at(Math.max(0, t - 0.01));
  const tz = q2.z - q1.z;
  const ty = q2.y - q1.y;
  const len = Math.hypot(tz, ty) || 1;
  const z = q.z + (ty / len) * 0.025; // the bevel's outward offset
  const yy = q.y - (tz / len) * 0.025;
  const [sx, sy] = sculptShell(x, yy, z);
  return new THREE.Vector3(sx, sy, z);
}

/* The shell, lower body: a long side profile with wheel arches, extruded and sculpted
   (flared arches, a shoulder crease, a domed hood between raised fender peaks, tapered nose
   and tail). The flanks are rebuilt as a fine mesh so the flares and crease can shape them;
   the extrude's own end caps are only the outline. Tight bevels keep the edges crisp. */
function buildShellGeometry() {
  const s = new THREE.Shape();
  const ARCH = 0.58;
  const AY = R;
  s.moveTo(-2.55, 0.3);
  s.lineTo(-2.35, 0.2);
  s.lineTo(-AXLE_Z - ARCH, 0.2);
  s.lineTo(-AXLE_Z - ARCH, AY);
  s.absarc(-AXLE_Z, AY, ARCH, Math.PI, 0, true);
  s.lineTo(-AXLE_Z + ARCH, 0.2);
  s.lineTo(AXLE_Z - ARCH, 0.2);
  s.lineTo(AXLE_Z - ARCH, AY);
  s.absarc(AXLE_Z, AY, ARCH, Math.PI, 0, true);
  s.lineTo(AXLE_Z + ARCH, 0.2);
  s.lineTo(2.55, 0.22);
  s.quadraticCurveTo(2.82, 0.25, 2.84, 0.48); // upright front face: grille and lights
  s.quadraticCurveTo(2.86, 0.74, 2.66, 0.84); // nose edge into the hood
  s.quadraticCurveTo(2.2, 0.94, 1.7, 1.06); // long hood
  s.quadraticCurveTo(1.25, 1.16, 1.0, 1.16); // cowl
  s.lineTo(-1.6, 1.17); // shoulder line
  s.quadraticCurveTo(-2.3, 1.17, -2.62, 1.26); // flat deck into the ducktail lip
  s.lineTo(-2.72, 1.14);
  s.quadraticCurveTo(-2.8, 0.66, -2.55, 0.3);
  const depth = 2.0;
  const bt = 0.04;
  const ext = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.025, bevelSegments: 2, curveSegments: 36, steps: 30 });
  // Keep the extrude's sides; replace its caps with finely divided copies of the outline.
  const sides = ext.groups[1];
  const sidePos = ext.attributes.position.array.slice(sides.start * 3, (sides.start + sides.count) * 3);
  ext.dispose();
  const tris = fineTriangles(s, 3, 36); // fine enough for smooth, unfaceted panels
  const capPos: number[] = [];
  for (const t of tris) {
    for (const k of [0, 1, 2]) capPos.push(t[k].x, t[k].y, depth + bt); // faces +Z
    for (const k of [0, 2, 1]) capPos.push(t[k].x, t[k].y, -bt); // faces -Z
  }
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute("position", new THREE.Float32BufferAttribute(sidePos, 3));
  const capGeo = new THREE.BufferGeometry();
  capGeo.setAttribute("position", new THREE.Float32BufferAttribute(capPos, 3));
  let g = mergeGeometries([sideGeo, capGeo])!;
  sideGeo.dispose();
  capGeo.dispose();
  g.rotateY(-Math.PI / 2); // profile u -> +z (forward), extrusion -> x
  g.translate(depth / 2, 0, 0);
  const p = g.attributes.position;
  const uvs = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const [x, y] = sculptShell(p.getX(i), p.getY(i), z);
    p.setXYZ(i, x, y, z);
    // Livery coordinates: u runs nose to tail; v runs up the side and on over the shoulder to
    // the centre line, each side in its own half of the texture (see liveryTexture).
    const v = Math.min(2, y + Math.max(0, 0.95 - Math.abs(x)));
    uvs[i * 2] = (z + 2.9) / 5.8;
    uvs[i * 2 + 1] = x >= 0 ? v / 4 : 1 - v / 4;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

/* The glasshouse: raked windscreen, roof and a long sloping rear window, tapering in toward
   the roof and the tail. Sits down into the shell's shoulders. */
function buildCabinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(1.0, 1.06);
  s.quadraticCurveTo(0.5, 1.36, 0.15, 1.54);
  s.quadraticCurveTo(-0.3, 1.6, -0.75, 1.57);
  s.quadraticCurveTo(-1.4, 1.5, -2.0, 1.14);
  s.lineTo(-2.0, 1.06);
  s.lineTo(1.0, 1.06);
  const depth = 1.7;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 3, curveSegments: 28, steps: 14 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const z = p.getZ(i);
    p.setX(i, p.getX(i) * (1 - 0.24 * smooth((y - 1.1) / 0.42) - 0.08 * smooth((-z - 1.3) / 0.6)));
  }
  g.computeVertexNormals();
  return g;
}

/* The race livery, wrapped round the shell. Each side of the car has its own half of the
   texture, set up so its text reads the right way; the halves meet on the centre line.
   Painted in metres: X along the car as someone looking at that side sees it (their left to
   right), T from the hood's centre line (0) out over the shoulder and down to the sill (2). */
function paintLivery() {
  const W = 2048;
  const H = 1600;
  const L = 5.8;
  const LIGHT = "#0ea5e9";
  const DARK = "#1e3a8a";
  const RED = "#dc2626";
  return canvasTexture(W, H, (g) => {
    g.fillStyle = "#f8fafc";
    g.fillRect(0, 0, W, H);
    for (const right of [true, false]) {
      g.save();
      if (right) g.setTransform(-W / L, 0, 0, H / 4, W, H / 2);
      else g.setTransform(W / L, 0, 0, -H / 4, 0, H / 2);
      const X = (z: number) => (right ? 2.9 - z : z + 2.9);
      const T = (v: number) => 2 - v;
      // Three stripes along the door that kick up over the front wheel and run on up the hood.
      g.lineCap = "butt";
      [LIGHT, DARK, RED].forEach((c, k) => {
        const o = k * 0.075;
        g.strokeStyle = c;
        g.lineWidth = 0.055;
        g.beginPath();
        g.moveTo(X(-2.5), T(0.8 - o)); // the tail has its own horseshoe
        g.lineTo(X(0.3), T(0.8 - o));
        g.bezierCurveTo(X(0.8), T(0.8 - o), X(0.95), T(1.25 - o), X(1.45), T(1.3 - o));
        g.lineTo(X(3.1), T(1.36 - o));
        g.stroke();
      });
      const text = (str: string, z: number, v: number, size: number, fill: string, font: string, outline = "") => {
        g.save();
        g.translate(X(z), T(v));
        g.scale(size / 100, size / 100);
        g.font = `${font} 100px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        if (outline) {
          g.strokeStyle = outline;
          g.lineWidth = 14;
          g.lineJoin = "round";
          g.strokeText(str, 0, 0);
        }
        g.fillStyle = fill;
        g.fillText(str, 0, 0);
        g.restore();
      };
      text("24", -0.3, 0.72, 0.46, "#0f172a", "italic 800", "#f8fafc"); // door number: the year we started
      text("RoboCoders", 0, 0.42, 0.17, "#1d4ed8", "800"); // on the sill, between the wheels
      if (right) {
        // Hood number, on one side only, turned to run across the hood and read from the front.
        g.save();
        g.translate(X(1.85), T(1.62));
        g.rotate(Math.PI / 2);
        g.translate(-X(1.85), -T(1.62));
        text("24", 1.85, 1.62, 0.32, "#0f172a", "italic 800", "#f8fafc");
        g.restore();
      }
      g.restore();
    }
  });
}

/* The grille's mesh: a fine triangular lattice in dark grey on black. */
function grilleTexture() {
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#05070c";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#3b4252";
    g.lineWidth = 3;
    for (let i = -256; i < 512; i += 22) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 128, 256);
      g.moveTo(i, 0);
      g.lineTo(i - 128, 256);
      g.stroke();
    }
    for (let y = 0; y < 256; y += 38) g.fillRect(0, y, 256, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/* Top of the rear wing. */
function wingTexture() {
  return canvasTexture(1024, 192, (g) => {
    g.fillStyle = "#f8fafc";
    g.fillRect(0, 0, 1024, 192);
    g.fillStyle = "#0f172a";
    g.fillRect(0, 0, 1024, 14);
    g.fillStyle = "#1d4ed8";
    g.font = "800 104px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("RoboCoders", 512, 106);
  });
}

/* The cabin's glass. Windscreen and rear window are cut from the cabin's
   own surface so they follow it exactly; the side windows, with the kink at the back, are a
   finely divided outline pressed onto its flanks by ray casting. All sit 8 mm proud. */
function buildCabinGlass(cabinGeo: THREE.BufferGeometry) {
  const pos = cabinGeo.attributes.position;
  const nor = cabinGeo.attributes.normal;
  const glass: number[] = [];
  const inset = (y: number, z: number) => 0.85 * (1 - 0.24 * smooth((y - 1.1) / 0.42) - 0.08 * smooth((-z - 1.2) / 0.6)) - 0.09;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    const tri: THREE.Vector3[] = [];
    let ok = true;
    let front = true;
    let rear = true;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k);
      n.fromBufferAttribute(nor, i + k);
      if (Math.abs(n.x) > 0.6 || Math.abs(v.x) > inset(v.y, v.z) || v.y < 1.16) ok = false;
      if (v.z < 0.2 || v.z > 0.92) front = false;
      if (v.z > -0.95 || v.z < -1.85) rear = false;
      tri.push(v.clone().addScaledVector(n, 0.008));
    }
    if (!ok || !(front || rear)) continue;
    for (const p of tri) glass.push(p.x, p.y, p.z);
  }
  // Side windows: the outline, each triangle split three times, every point pushed onto the cabin.
  const outline = new THREE.Shape(
    [[0.56, 1.25], [0.42, 1.33], [0.26, 1.43], [-0.4, 1.51], [-1.05, 1.45], [-1.45, 1.3], [-1.25, 1.25]].map(([z, y]) => new THREE.Vector2(z, y)),
  );
  const tris = fineTriangles(outline, 2); // the side glass is nearly flat; 2 levels follow it
  const probe = new THREE.Mesh(cabinGeo, new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster();
  const hitX = new Map<string, number | null>();
  const press = (s: number, q: THREE.Vector2) => {
    const key = `${s}:${q.x.toFixed(4)}:${q.y.toFixed(4)}`;
    if (!hitX.has(key)) {
      ray.set(new THREE.Vector3(s * 2, q.y, q.x), new THREE.Vector3(-s, 0, 0));
      const hit = ray.intersectObject(probe)[0];
      hitX.set(key, hit ? hit.point.x + s * 0.008 : null);
    }
    return hitX.get(key)!;
  };
  for (const s of [-1, 1]) {
    for (const t of tris) {
      const xs = t.map((q) => press(s, q));
      if (xs.some((x) => x === null)) continue;
      const order = s > 0 ? [0, 2, 1] : [0, 1, 2]; // face outward
      for (const k of order) glass.push(xs[k]!, t[k].y, t[k].x);
    }
  }
  (probe.material as THREE.Material).dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(glass, 3));
  geo.computeVertexNormals();
  return geo;
}

/* The race car's body: the livery shell and everything fixed to it (white cabin and glass,
   kidneys, headlights, vents, skirts, mirrors, tail lights, horseshoe, exhausts, diffuser and
   wing). Shared by the hero and the build scene. `fx` collects the exhaust flames to animate;
   `clip` clips every material, for the build scene's print head. */
export function buildRaceShell(
  keep: <T extends { dispose: () => void }>(x: T) => T,
  fx?: { outer: THREE.Material; core: THREE.Material; list: THREE.Mesh[] } | null,
  clip?: THREE.Plane[],
) {
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, r = 0) =>
    mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, axis: "x" | "y" | "z", x = 0, y = 0, z = 0, seg = 32) => {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  };
  const livery = keep(new THREE.MeshPhysicalMaterial({ map: keep(liveryTexture()), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const paintWhite = keep(new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const carbonMat = keep(new THREE.MeshPhysicalMaterial({ map: keep(carbon()), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const glass = keep(new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.18, metalness: 0.2, envMapIntensity: 0.25 })); // tinted: dark from every angle
  const rubberDeep = keep(new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.95 }));
  const silver = keep(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1, roughness: 0.2 }));
  const blackPlastic = keep(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }));
  const tail = keep(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const g = new THREE.Group();
  const shellMesh = mesh(shellGeometry(), livery);
  g.add(shellMesh);
  const cabinGeo = keep(cabinGeometry());
  g.add(mesh(cabinGeo, paintWhite));
  g.add(mesh(keep(cabinGlass()), glass));
  const drl = keep(new THREE.MeshBasicMaterial({ color: 0xf1f5f9 }));
  const smoked = keep(new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.16 }));
  const darkChrome = keep(new THREE.MeshStandardMaterial({ color: 0x8b95a5, metalness: 1, roughness: 0.25 })); // satin grey frame
  const grilleMesh = keep(new THREE.MeshStandardMaterial({ map: keep(grilleTexture()), roughness: 0.6 }));
  const flameGeo = keep(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, 0.5, 0));

  // Seat a part flush on the curved shell: cast a ray at the body, put the part on the hit,
  // facing out along the surface, its x axis kept as close to `along` as the surface allows.
  const caster = new THREE.Raycaster();
  const hitAt = (from: THREE.Vector3, dir: THREE.Vector3) => {
    caster.set(from, dir);
    const h = caster.intersectObject(frontProbe())[0];
    return h?.face ? { p: h.point.clone(), n: h.face.normal.clone() } : null;
  };
  const seat = (o: THREE.Object3D, at: THREE.Vector3, n: THREE.Vector3, along = new THREE.Vector3(1, 0, 0), lift = 0.004) => {
    const z = n.clone().normalize();
    const x = along.clone().addScaledVector(z, -along.dot(z)).normalize();
    const y = z.clone().cross(x);
    o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    o.position.copy(at).addScaledVector(z, lift);
    g.add(o);
    return o;
  };
  const FRONT = new THREE.Vector3(0, 0, -1);
  const front = (x: number, y: number) => hitAt(new THREE.Vector3(x, y, 5), FRONT);
  const flatShape = (pts: number[][], mirror = 1) => new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u * mirror, v)));
  // Lay a flat outline onto the back of the shell: every point of a finely divided copy is
  // put exactly on the tail (see tailPoint) and lifted off it a little along the surface.
  const onTail = (x: number, y: number, lift: number) => {
    const p0 = tailPoint(x, y);
    const n = tailPoint(x, y + 0.01).sub(p0).cross(tailPoint(x + 0.01, y).sub(p0)).normalize();
    return p0.addScaledVector(n, lift);
  };
  const drapeRear = (shape: THREE.Shape, mat: THREE.Material, lift: number) => {
    const pos: number[] = [];
    for (const t of fineTriangles(shape, 2)) {
      for (const k of [0, 2, 1]) {
        const q = onTail(t[k].x, t[k].y, lift); // wound to face backward, toward someone behind
        pos.push(q.x, q.y, q.z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(mesh(keep(geo), mat));
  };
  // A band of width w along a path, as an outline.
  const ribbon = (pts: THREE.Vector2[], w: number) => {
    const l: THREE.Vector2[] = [];
    const r: THREE.Vector2[] = [];
    pts.forEach((q, i) => {
      const d = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const off = new THREE.Vector2(-d.y, d.x).multiplyScalar(w / 2);
      l.push(q.clone().add(off));
      r.push(q.clone().sub(off));
    });
    return new THREE.Shape([...l, ...r.reverse()]);
  };
  const V = (pts: number[][]) => pts.map(([x, y]) => new THREE.Vector2(x, y));

  // Front: twin kidneys on the upright face, a wide lower grille, round corner intakes.
  const kidneyGeo = (w: number, h: number, d: number) => {
    const r = 0.08;
    const k = new THREE.Shape();
    k.moveTo(-w / 2 + r, -h / 2);
    k.lineTo(w / 2 - r, -h / 2);
    k.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    k.lineTo(w / 2 - 0.015, h / 2 - r);
    k.quadraticCurveTo(w / 2 - 0.015, h / 2, w / 2 - r - 0.015, h / 2);
    k.lineTo(-w / 2 + r + 0.015, h / 2);
    k.quadraticCurveTo(-w / 2 + 0.015, h / 2, -w / 2 + 0.015, h / 2 - r);
    k.lineTo(-w / 2, -h / 2 + r);
    k.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = keep(new THREE.ExtrudeGeometry(k, { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12 }));
    // Planar UVs across the opening, for the mesh texture.
    const pp = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / w + 0.5, pp.getY(i) / h + 0.5);
    return geo;
  };
  // Proportions from the reference front view: two tall kidneys, each about a fifth of the
  // car's width, side by side with a small gap; their tops line up with the headlights.
  const surroundGeo = kidneyGeo(0.34, 0.4, 0.035);
  const insideGeo = kidneyGeo(0.29, 0.35, 0.02);
  for (const sx of [-1, 1]) {
    const h = front(sx * 0.19, 0.48);
    if (!h) continue;
    const k = new THREE.Group();
    k.add(mesh(surroundGeo, darkChrome));
    k.add(mesh(insideGeo, grilleMesh, 0, 0, 0.03));
    seat(k, h.p, h.n, undefined, -0.014); // set slightly into the face
    const fog = front(sx * 0.7, 0.31);
    if (fog) {
      const ring = new THREE.Group();
      ring.add(cyl(0.1, 0.1, 0.03, darkChrome, "z", 0, 0, 0.012, 32));
      const inner = mesh(new THREE.CircleGeometry(0.082, 32), grilleMesh, 0, 0, 0.029);
      ring.add(inner);
      seat(ring, fog.p, fog.n);
    }
  }
  const low = front(0, 0.235);
  if (low) {
    const lg = new THREE.Group();
    const lip = keep(new THREE.ExtrudeGeometry(flatShape([[-0.5, 0.05], [0.5, 0.05], [0.42, -0.06], [-0.42, -0.06]]), { depth: 0.02, bevelEnabled: false }));
    const pp = lip.attributes.position;
    const uv = lip.attributes.uv;
    for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) + 0.5, (pp.getY(i) + 0.06) / 0.11);
    lg.add(mesh(lip, grilleMesh));
    seat(lg, low.p, low.n);
  }

  // The headlights, the car's signature: slim dark units that start just outside the kidneys'
  // frames (never over them) and run out to the corners, level with the kidney tops, rising a
  // little toward the outside. Each has two X-shaped light elements and a light line along its
  // lower edge. Measured on the face: inner end at 0.42, outer at 0.86 (kidney frames end at 0.37).
  const LAMP_IN = 0.42;
  const LAMP_OUT = 0.86;
  for (const sx of [-1, 1]) {
    const p1 = front(sx * LAMP_IN, 0.645);
    const p2 = front(sx * LAMP_OUT, 0.69);
    if (!p1 || !p2) continue;
    const lamp = new THREE.Group();
    const half = p1.p.distanceTo(p2.p) / 2;
    // Outline in the lamp's own plane: u along it (inner -> outer), v up. Pointed at the inner
    // end, squared off and a touch deeper at the outer corner.
    const outline = [
      [-half, -0.028],
      [-half + 0.03, 0.024],
      [half - 0.07, 0.046],
      [half - 0.01, 0.044],
      [half + 0.004, 0.0],
      [half - 0.04, -0.042],
      [-half + 0.11, -0.046],
    ];
    const housing = keep(new THREE.ExtrudeGeometry(flatShape(outline, sx), { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 }));
    lamp.add(mesh(housing, smoked));
    // Light line along the lower edge.
    const line = box(half * 2 - 0.13, 0.009, 0.006, drl, sx * 0.04, -0.034, 0.026);
    line.rotation.z = sx * 0.012;
    lamp.add(line);
    // Two X-shaped light elements toward the inner half.
    for (const u of [-half * 0.42, -half * 0.05]) {
      for (const a of [0.55, -0.55]) {
        const stroke = box(0.075, 0.011, 0.006, drl, sx * u, 0.006, 0.026);
        stroke.rotation.z = a;
        lamp.add(stroke);
      }
    }
    const mid = p1.p.clone().lerp(p2.p, 0.5);
    const n = p1.n.clone().add(p2.n).normalize();
    const along = sx > 0 ? p2.p.clone().sub(p1.p) : p1.p.clone().sub(p2.p);
    seat(lamp, mid, n, along, 0.01);
  }
  // Nostril vents in the hood, just behind the lights.
  for (const sx of [-1, 1]) {
    const h = hitAt(new THREE.Vector3(sx * 0.52, 3, 2.25), new THREE.Vector3(0, -1, 0));
    if (!h) continue;
    const vent = new THREE.Group();
    for (let i = 0; i < 3; i++) vent.add(box(0.26, 0.018, 0.012, rubberDeep, 0, -0.03 + i * 0.03, 0.004));
    seat(vent, h.p, h.n, new THREE.Vector3(1, 0, 0.35 * sx));
  }
  g.add(box(1.78, 0.04, 0.24, carbonMat, 0, 0.17, 2.6, 0.015)); // splitter

  // Sides: carbon skirts, the vent behind the front wheel, door mirrors.
  for (const sx of [-1, 1]) {
    g.add(box(0.06, 0.12, 1.84, carbonMat, sx * 1.09, 0.24, 0, 0.03));
    const gill = hitAt(new THREE.Vector3(sx * 3, 0.7, 0.8), new THREE.Vector3(-sx, 0, 0));
    if (gill) {
      const vent = new THREE.Group();
      for (let i = 0; i < 3; i++) vent.add(box(0.2, 0.018, 0.012, rubberDeep, 0, -0.03 + i * 0.03, 0.004));
      seat(vent, gill.p, gill.n, new THREE.Vector3(0, 0, -1));
    }
    g.add(box(0.06, 0.04, 0.2, blackPlastic, sx * 0.86, 1.2, 0.72));
    g.add(box(0.2, 0.11, 0.16, carbonMat, sx * 0.98, 1.24, 0.74, 0.04));
  }

  // Rear, all draped onto the curved tail: boomerang tail lights (red outline, smoked lens)
  // joined by a light line along the ducktail lip, and the livery's three bands arching in a
  // horseshoe over a wide dark diffuser opening with the exhausts inside it.
  const tailLens = keep(new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.25 }));
  const stripeMat = (c: number) => keep(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const boomerang = [[-0.32, -0.01], [-0.2, 0.07], [0.18, 0.1], [0.3, 0.07], [0.31, -0.02], [0.2, -0.1], [0.04, -0.1], [-0.14, -0.05]];
  for (const sx of [-1, 1]) {
    const at = (u: number, v: number) => [sx * (0.53 + u * 1.25), 0.95 + v * 1.35]; // u runs out toward the corner
    const outer = new THREE.Shape(V(boomerang.map(([u, v]) => at(u, v))));
    const lens = V(boomerang.map(([u, v]) => at(u * 0.8 + 0.01, v * 0.55)));
    outer.holes.push(new THREE.Path(lens));
    drapeRear(outer, tail, 0.008);
    drapeRear(new THREE.Shape(lens), tailLens, 0.006);
  }
  drapeRear(ribbon(V([[-0.84, 1.0], [-0.8, 1.1], [0.8, 1.1], [0.84, 1.0]]), 0.026), tail, 0.008); // lip light
  [0x0ea5e9, 0x1e3a8a, 0xdc2626].forEach((c, k) => {
    const a = 0.84 - 0.09 * k; // half-width of this arch
    const top = 0.68 - 0.07 * k;
    const r = 0.16;
    const path: number[][] = [[-a, 0.2], [-a, top - r]];
    for (let i = 1; i < 12; i++) {
      const t = Math.PI - (i / 12) * (Math.PI / 2);
      path.push([-a + r + r * Math.cos(t), top - r + r * Math.sin(t)]);
    }
    path.push([-a + r, top], [a - r, top]);
    for (let i = 1; i < 12; i++) {
      const t = Math.PI / 2 - (i / 12) * (Math.PI / 2);
      path.push([a - r + r * Math.cos(t), top - r + r * Math.sin(t)]);
    }
    path.push([a, top - r], [a, 0.2]);
    drapeRear(ribbon(V(path), 0.07), stripeMat(c), 0.005);
  });
  const opening = new THREE.Shape();
  opening.moveTo(-0.44, 0.2);
  opening.lineTo(-0.44, 0.38);
  opening.quadraticCurveTo(-0.44, 0.46, -0.36, 0.46);
  opening.lineTo(0.36, 0.46);
  opening.quadraticCurveTo(0.44, 0.46, 0.44, 0.38);
  opening.lineTo(0.44, 0.2);
  drapeRear(opening, rubberDeep, 0.006);
  for (const px of [-0.2, 0.2]) {
    g.add(cyl(0.07, 0.07, 0.22, silver, "z", px, 0.32, -2.58, 28));
    g.add(cyl(0.05, 0.05, 0.23, rubberDeep, "z", px, 0.32, -2.58, 24));
    if (fx) {
      for (const [mat, r] of [[fx.outer, 0.06], [fx.core, 0.028]] as const) {
        const f = new THREE.Mesh(flameGeo, mat);
        f.position.set(px, 0.32, -2.7);
        f.rotation.x = -Math.PI / 2;
        f.scale.set(r, 0.2, r);
        g.add(f);
        fx.list.push(f);
      }
    }
  }
  for (const sx of [-1, 1]) {
    g.add(box(0.04, 0.32, 0.07, carbonMat, sx * 0.45, 1.42, -2.37)); // swan-neck strut...
    g.add(box(0.04, 0.05, 0.18, carbonMat, sx * 0.45, 1.6, -2.33)); // ...hooked over the wing
    g.add(box(0.03, 0.22, 0.48, carbonMat, sx * 0.97, 1.53, -2.35)); // wing end plate
  }
  g.add(box(1.92, 0.045, 0.44, carbonMat, 0, 1.55, -2.35, 0.02)); // wing
  const wingTop = mesh(new THREE.PlaneGeometry(1.82, 0.38), keep(new THREE.MeshPhysicalMaterial({ map: keep(wingTexture()), roughness: 0.3, clearcoat: 1 })), 0, 1.5735, -2.35);
  wingTop.rotation.x = -Math.PI / 2;
  g.add(wingTop);
  g.add(box(1.7, 0.06, 0.32, carbonMat, 0, 0.18, -2.52, 0.02)); // diffuser
  for (let i = -4; i <= 4; i++) g.add(box(0.018, 0.12, 0.3, carbonMat, i * 0.19, 0.2, -2.54));
  mergeByMaterial(keep, g, new Set(fx?.list ?? []));
  if (clip) {
    g.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (mats) for (const m of Array.isArray(mats) ? mats : [mats]) m.clippingPlanes = clip;
    });
  }
  return g;
}

/* One draw call per material: every static mesh under `root` (except `skip`) is baked into its
   place and merged with the others that share its material. Parts that move on their own must
   be left out. Meshes with several materials are left as they are. */
export function mergeByMaterial(keep: <T extends { dispose: () => void }>(x: T) => T, root: THREE.Object3D, skip = new Set<THREE.Object3D>()) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || skip.has(m) || Array.isArray(m.material)) return;
    const list = groups.get(m.material) ?? [];
    list.push(m);
    groups.set(m.material, list);
  });
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    const textured = !!(mat as THREE.MeshStandardMaterial).map;
    const geos = meshes.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && !(textured && name === "uv")) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      return g;
    });
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of meshes) m.removeFromParent();
    root.add(new THREE.Mesh(keep(merged), mat));
  }
}

/* The body's geometry is the slow part to build, so it's built once per page and shared by
   both scenes; each caller gets its own copy to place and dispose. */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const shellSource = once(() => timed("shell geometry", buildShellGeometry));
const cabinSource = once(buildCabinGeometry);
const glassSource = once(() => timed("cabin glass", () => buildCabinGlass(cabinSource())));
export const shellGeometry = () => shellSource().clone();
const liverySource = once(paintLivery);
const blueprintSource = once(() => new THREE.EdgesGeometry(shellSource(), 20));
/* The shell's outline edges, for the build scene's blueprint. */
export const blueprintEdges = () => blueprintSource().clone();
/* The livery, painted once per page; each scene gets its own texture over the same canvas. */
export const liveryTexture = () => {
  const t = liverySource().clone();
  t.needsUpdate = true; // a clone starts unuploaded
  return t;
};
/* Builds the shared body pieces a step at a time, giving the page a breather between steps, so
   no single task blocks scrolling for long. The scenes wait for this before building. */
export async function warmCarBody() {
  const breathe = () => new Promise<void>((r) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => r(), { timeout: 200 }) : setTimeout(r, 0)));
  for (const step of [shellSource, cabinSource, glassSource, frontProbe, liverySource, blueprintSource]) {
    step();
    await breathe();
  }
}
export const cabinGeometry = () => cabinSource().clone();
export const cabinGlass = () => glassSource().clone();
/* The shell's front two-thirds (the nose, hood and front flanks): enough to seat the front
   parts by ray casting without testing every triangle of the body. */
const frontProbe = once(() => {
  const src = shellSource();
  const idx = src.index!;
  const pos = src.attributes.position;
  const out: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const tri = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
    if (Math.max(...tri.map((k) => pos.getZ(k))) < 0.5) continue;
    for (const k of tri) out.push(pos.getX(k), pos.getY(k), pos.getZ(k));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
});

/* Low-profile tyre cross-section, lathed round the axle. */
export function tyreGeometry() {
  const pts = [[0.33, -0.17], [0.42, -0.17], [0.45, -0.15], [R, -0.12], [R, 0.12], [0.45, 0.15], [0.42, 0.17], [0.33, 0.17]].map(
    ([x, y]) => new THREE.Vector2(x, y),
  );
  const g = new THREE.LatheGeometry(pts, 72);
  g.rotateZ(Math.PI / 2);
  return g;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function HeroRobot({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const userRef = useRef<number | null>(null); // set once the visitor uses the button
  const kickRef = useRef<() => void>(() => {});
  const readoutRef = useRef<HTMLParagraphElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const driveRef = useRef({ up: false, down: false, left: false, right: false, at: 0, auto: true });
  const [autopilot, setAutopilot] = useState(true);
  const viewRef = useRef<(delta: number | null) => void>(() => {});
  const [turned, setTurned] = useState(false); // has the visitor turned the view yet?
  const [apart, setApart] = useState(false);
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let live = true;
    warmCarBody().then(() => live && setWarm(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !warm) return;
    // Reduced motion, or the browser's data saver: a still car rather than a continuous drive.
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const reduced = saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      mount.dataset.failed = "1";
      return;
    }
    const dpr = adaptiveDpr(renderer);
    renderer.setClearColor(0xffffff, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.prepend(renderer.domElement);

    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(keep(geo), mat);
      m.position.set(x, y, z);
      return m;
    };
    const box = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, r = 0) =>
      mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, axis: "x" | "y" | "z", x = 0, y = 0, z = 0, seg = 32) => {
      const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
      if (axis === "x") m.rotation.z = Math.PI / 2;
      if (axis === "z") m.rotation.x = Math.PI / 2;
      return m;
    };

    // Studio: reflections, a soft key, a cool rim, and a floor that fades into the page.
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 13, 30);
    const pmrem = keep(new THREE.PMREMGenerator(renderer));
    const room = keep(new RoomEnvironment());
    scene.environment = keep(pmrem.fromScene(room, 0.03).texture);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-3, 8, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfdbfe, 1.5);
    rim.position.set(5, 3, -6);
    scene.add(rim);

    const bronze = keep(new THREE.MeshStandardMaterial({ color: 0xa8834a, metalness: 1, roughness: 0.3 }));
    const amber = keep(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }));
    // Plain see-through, not `transmission`: that renders the whole scene a second time every frame.
    const acrylic = keep(new THREE.MeshStandardMaterial({ color: 0xcfe0ff, roughness: 0.12, transparent: true, opacity: 0.55 }));
    const yellow = keep(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 }));
    const rubber = keep(new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }));
    const rubberDeep = keep(new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.95 }));
    const silver = keep(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1, roughness: 0.2 }));
    const disc = keep(new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 1, roughness: 0.42 }));
    const brass = keep(new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }));
    const blackPlastic = keep(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }));
    const gold = keep(new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.28 }));
    const pcbEdge = keep(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55 }));
    const pcbPlain = keep(new THREE.MeshStandardMaterial({ color: PCB, roughness: 0.45 }));
    const pcbTop = keep(new THREE.MeshStandardMaterial({ map: keep(boardTop()), roughness: 0.4 }));
    const caliper = keep(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3 }));
    const headlight = keep(new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    const tail = keep(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const cellWrap = keep(new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.3 }));

    // The test arena. The car stays put; the arena slides past it along the track.
    const track = new THREE.Group();
    scene.add(track);
    const floorTex = keep(floorTexture());
    const floor = mesh(new THREE.PlaneGeometry(60, 60), keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0 })));
    floor.rotation.x = -Math.PI / 2;
    track.add(floor);
    // Black line track down the middle, as on a competition mat.
    const tape = mesh(new THREE.PlaneGeometry(0.1, 60), keep(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })), 0, 0.004, 0);
    tape.rotation.x = -Math.PI / 2;
    track.add(tape);
    // Low arena walls in segments: far side and near side. One segment (panel, cap, post, coloured
    // per vertex) is drawn 12 times per side as an instanced mesh: two draw calls for all of them.
    const walls: { m: THREE.InstancedMesh; x: number }[] = [];
    {
      const wallMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
      const part = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number) => {
        const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
        const c = new THREE.Color(hex);
        g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
        g.deleteAttribute("uv");
        return g;
      };
      for (const [x, hgt] of [[-4.6, 0.46], [5.6, 0.3]]) {
        const parts = [part(0.12, hgt, 3.7, 0, hgt / 2, 0, 0xf8fafc), part(0.15, 0.05, 3.7, 0, hgt + 0.02, 0, 0xcbd5e1), part(0.18, hgt + 0.1, 0.12, 0, (hgt + 0.1) / 2, 1.9, 0x334155)];
        const seg = keep(mergeGeometries(parts)!);
        parts.forEach((g) => g.dispose());
        const m = new THREE.InstancedMesh(seg, wallMat, 12);
        m.frustumCulled = false; // the segments move every frame
        track.add(m);
        walls.push({ m, x });
      }
    }

    const car = new THREE.Group(); // position and heading
    scene.add(car);
    const body = new THREE.Group(); // rides on the suspension
    car.add(body);
    const obj: Record<string, THREE.Object3D> = {};
    const layers: Layer[] = [];
    const layer = (o: THREE.Object3D, out: [number, number, number], delay: number, tilt = 0) => {
      layers.push({ o, base: o.position.clone(), out: new THREE.Vector3(...out), delay, tilt });
      return o;
    };

    const flames: THREE.Mesh[] = [];
    // Parts sealed inside the closed body: not drawn until it opens (filled in below).
    const hidden: THREE.Object3D[] = [];
    const flameOuter = keep(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const flameCore = keep(new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0, depthWrite: false, fog: false }));

    // Manufacturing: the printed race shell and everything fixed to it.
    {
      const g = timed("race shell (hero)", () => buildRaceShell(keep, { outer: flameOuter, core: flameCore, list: flames }));
      body.add(g);
      layer(g, [0, 2.15, -0.15], 0.15, -0.08);
      obj.shell = g;
    }

    // Wheels: low-profile tyres, 10-spoke rims, drilled discs, blue calipers. BO motors drive them.
    const wheels: THREE.Group[] = [];
    const steerers: THREE.Group[] = [];
    {
      const tyreGeo = keep(tyreGeometry());
      const grooveGeo = keep(new THREE.TorusGeometry(R + 0.002, 0.012, 6, 72));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const unit = new THREE.Group();
          unit.position.set(0, R, sz * AXLE_Z);
          unit.add(box(0.48, 0.32, 0.28, yellow, sx * 0.42, 0, 0, 0.03)); // BO gear motor
          unit.add(cyl(0.11, 0.11, 0.24, silver, "x", sx * 0.12, 0.02, 0));
          const corner = new THREE.Group(); // steers on the front axle
          corner.position.x = sx * WHEEL_X;
          unit.add(corner);
          const cal = box(0.1, 0.18, 0.12, caliper, -sx * 0.06, 0.18, -0.12, 0.03);
          cal.rotation.x = 0.5;
          corner.add(cal);
          const wheel = new THREE.Group();
          wheel.add(mesh(tyreGeo, rubber));
          for (const dx of [-0.06, 0.06]) {
            const groove = mesh(grooveGeo, rubberDeep, dx, 0, 0);
            groove.rotation.y = Math.PI / 2;
            wheel.add(groove);
          }
          wheel.add(cyl(0.33, 0.33, 0.3, bronze, "x"));
          wheel.add(cyl(0.29, 0.29, 0.02, rubberDeep, "x", sx * 0.15, 0, 0));
          wheel.add(cyl(0.25, 0.25, 0.025, disc, "x", -sx * 0.02, 0, 0, 48));
          for (let i = 0; i < 10; i++) {
            const spoke = box(0.035, 0.05, 0.27, bronze, sx * 0.155, 0, 0, 0.012);
            const a = (i / 10) * Math.PI * 2;
            spoke.position.set(sx * 0.155, Math.cos(a) * 0.16, Math.sin(a) * 0.16);
            spoke.rotation.x = a;
            wheel.add(spoke);
          }
          wheel.add(cyl(0.06, 0.06, 0.06, silver, "x", sx * 0.17, 0, 0, 6)); // centre lock
          wheel.add(cyl(0.025, 0.025, 0.07, amber, "x", sx * 0.19, 0, 0, 12));
          wheel.userData.side = sx;
          mergeByMaterial(keep, wheel);
          corner.add(wheel);
          wheels.push(wheel);
          if (sz === 1) steerers.push(corner);
          car.add(unit);
          layer(unit, [sx * 0.65, 0, sz * 0.2], 0);
          unit.userData.wheelUnit = true;
          hidden.push(unit.children[0], unit.children[1]); // motor and shaft sit inside the body
        }
      }
    }

    // The robot inside: acrylic plates on brass posts, battery.
    {
      const plates = new THREE.Group();
      plates.add(box(1.3, 0.05, 2.1, acrylic, 0, 0.68, 0, 0.02));
      for (const [x, z] of [[-0.5, -0.85], [0.5, -0.85], [-0.5, 0.85], [0.5, 0.85]]) plates.add(cyl(0.035, 0.035, 0.14, brass, "y", x, 0.77, z, 6));
      body.add(plates);
      layer(plates, [0, 0, 0], 0);
      const top = box(1.3, 0.05, 2.1, acrylic, 0, 0.86, 0, 0.02);
      body.add(top);
      layer(top, [0, 0.45, 0], 0.06);
      const batt = new THREE.Group();
      batt.position.set(0, 0.47, 0);
      batt.add(box(0.9, 0.12, 0.44, blackPlastic, 0, -0.03, 0, 0.02));
      for (const z of [-0.1, 0.1]) batt.add(cyl(0.09, 0.09, 0.76, cellWrap, "x", 0, 0.06, z));
      body.add(batt);
      layer(batt, [0, 0, 0], 0);
    }

    // Hardware: the custom ESP32 board.
    {
      const g = new THREE.Group();
      g.position.set(0, 0.92, -0.2);
      g.scale.setScalar(0.85);
      g.add(box(1.2, 0.05, 1.3, [pcbEdge, pcbEdge, pcbTop, pcbEdge, pcbEdge, pcbEdge]));
      g.add(box(0.42, 0.06, 0.44, silver, 0, 0.055, -0.06, 0.01));
      const pins = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.022, 0.12, 0.022)), gold, 30);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 30; i++) {
        pins.setMatrixAt(i, m4.makeTranslation(i < 15 ? -0.5 : 0.5, 0.07, -0.5 + (i % 15) * 0.07));
      }
      g.add(pins);
      for (const x of [-0.5, 0.5]) g.add(box(0.06, 0.06, 1.06, blackPlastic, x, 0.05, 0));
      for (let i = 0; i < 4; i++) g.add(box(0.2, 0.11, 0.12, caliper, -0.33 + i * 0.22, 0.08, -0.58, 0.01));
      g.add(cyl(0.08, 0.08, 0.08, blackPlastic, "y", -0.32, 0.06, 0.45));
      body.add(g);
      layer(g, [0, 1.05, 0], 0.08);
      obj.board = g;
    }

    // Software: the OLED, showing live distance and steering.
    const oledCanvas = document.createElement("canvas");
    oledCanvas.width = 256;
    oledCanvas.height = 128;
    const oledTex = keep(new THREE.CanvasTexture(oledCanvas));
    oledTex.colorSpace = THREE.SRGBColorSpace;
    const drawOled = (cm: number, turn: number) => {
      const g = oledCanvas.getContext("2d")!;
      g.fillStyle = "#020617";
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = "#7dd3fc";
      g.font = "600 22px system-ui, sans-serif";
      g.fillText("Distance", 16, 30);
      g.fillStyle = "#e0f2fe";
      g.font = "700 54px system-ui, sans-serif";
      g.fillText(`${cm} cm`, 16, 92);
      g.save();
      g.translate(212, 64);
      g.rotate(turn);
      g.fillStyle = "#7dd3fc";
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(22, 4);
      g.lineTo(7, 4);
      g.lineTo(7, 28);
      g.lineTo(-7, 28);
      g.lineTo(-7, 4);
      g.lineTo(-22, 4);
      g.closePath();
      g.fill();
      g.restore();
      oledTex.needsUpdate = true;
    };
    drawOled(24, 0);
    {
      const g = new THREE.Group();
      g.position.set(0.2, 1.02, 0.45);
      g.rotation.x = -0.25;
      g.add(box(0.52, 0.03, 0.44, pcbPlain));
      const screen = mesh(new THREE.PlaneGeometry(0.42, 0.21), keep(new THREE.MeshBasicMaterial({ map: oledTex })), 0, 0.02, 0.02);
      screen.rotation.x = -Math.PI / 2;
      g.add(screen);
      body.add(g);
      layer(g, [0.1, 1.45, 0.3], 0.1);
      obj.oled = g;
    }

    // Labs: the ultrasonic sensor, set in the grille as the car's eyes, and IR sensors beneath.
    const pings: THREE.Mesh[] = [];
    {
      const g = new THREE.Group();
      g.position.set(0, 0.38, 2.3);
      g.scale.setScalar(0.62);
      g.add(box(0.9, 0.42, 0.035, [pcbEdge, pcbEdge, pcbEdge, pcbEdge, pcbPlain, pcbPlain]));
      const faceMat = keep(new THREE.MeshStandardMaterial({ map: keep(meshFace()), roughness: 0.7 }));
      for (const x of [-0.24, 0.24]) {
        g.add(cyl(0.16, 0.16, 0.2, silver, "z", x, 0, 0.11, 40));
        g.add(mesh(new THREE.CircleGeometry(0.145, 40), faceMat, x, 0, 0.212));
      }
      g.add(box(0.12, 0.05, 0.04, silver, 0, 0.13, 0.04, 0.02));
      const ringGeo = keep(new THREE.TorusGeometry(0.3, 0.012, 6, 48));
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false })));
        ring.position.z = 0.35;
        g.add(ring);
        pings.push(ring);
      }
      for (const x of [-0.45, 0.45]) {
        g.add(box(0.36, 0.04, 0.2, blackPlastic, x, -0.38, -0.5));
        g.add(cyl(0.035, 0.035, 0.1, headlight, "y", x - 0.07, -0.44, -0.5, 12));
        g.add(cyl(0.035, 0.035, 0.1, blackPlastic, "y", x + 0.07, -0.44, -0.5, 12));
      }
      body.add(g);
      layer(g, [0, 0.3, 0.75], 0.04);
      obj.sensors = g;
    }

    // Robocoders: the lesson card for this car, riding inside behind the board.
    const paper = keep(new THREE.MeshBasicMaterial({ color: 0xf8fafc, fog: false }));
    const card = mesh(new RoundedBoxGeometry(0.64, 0.4, 0.012, 2, 0.004), [paper, paper, paper, paper, keep(new THREE.MeshBasicMaterial({ map: keep(lessonCard()), toneMapped: false, fog: false })), paper]);
    body.add(card);
    obj.card = card;
    hidden.push(card, ...layers.map((l) => l.o).filter((o) => o !== obj.shell && !o.userData.wheelUnit));
    const cardA = { p: new THREE.Vector3(0, 0.92, -1.05), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)) };
    const cardB = { p: new THREE.Vector3(0, 4.35, 1.25), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.86, 0)) }; // above the lifted shell

    const shadow = mesh(new THREE.PlaneGeometry(3.6, 6.6), keep(new THREE.MeshBasicMaterial({ map: keep(radial("rgba(15,23,42,0.5)", "rgba(15,23,42,0)")), transparent: true, depthWrite: false }))); // taste-skill-ignore
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    car.add(shadow);

    // Obstacles: foam blocks, cones and cardboard boxes, recycled ahead of the car.
    type Kind = 0 | 1 | 2;
    type Obstacle = { g: THREE.Group; kinds: THREE.Object3D[]; x: number; z: number; dropAt: number; slideTo: number | null };
    const obstacles: Obstacle[] = [];
    {
      const foam = keep(new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.95 }));
      const coneMat = keep(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55 }));
      const band = keep(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
      const kraft = keep(new THREE.MeshStandardMaterial({ color: 0xc8a273, roughness: 0.9 }));
      const tapeMat = keep(new THREE.MeshStandardMaterial({ color: 0xe9d5a6, roughness: 0.5 }));
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Group();
        const block = new THREE.Group();
        block.add(box(1.0, 0.8, 0.8, foam, 0, 0.4, 0, 0.08));
        const cone = new THREE.Group();
        cone.add(box(0.8, 0.06, 0.8, blackPlastic, 0, 0.03, 0, 0.02));
        cone.add(mesh(new THREE.ConeGeometry(0.34, 0.95, 32), coneMat, 0, 0.535, 0));
        cone.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 32), band, 0, 0.55, 0));
        const carton = new THREE.Group();
        carton.add(box(1.1, 0.72, 0.9, kraft, 0, 0.36, 0, 0.01));
        carton.add(box(0.2, 0.01, 0.92, tapeMat, 0, 0.725, 0));
        g.add(block, cone, carton);
        track.add(g);
        obstacles.push({ g, kinds: [block, cone, carton], x: 0, z: 0, dropAt: 0, slideTo: null });
      }
    }
    const setKind = (o: Obstacle, k: Kind) => o.kinds.forEach((m, i) => (m.visible = i === k));
    const randKind = () => Math.floor(Math.random() * 3) as Kind;
    obstacles.forEach((o, i) => {
      o.x = (Math.random() - 0.5) * 2.4;
      o.z = 11 + i * 12;
      setKind(o, i as Kind);
    });

    // What the ultrasonic sensor sees: a faint cone ahead that warms as something gets close.
    const sonarMat = keep(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const sonar = mesh(new THREE.ConeGeometry(0.95, 4, 40, 1, true), sonarMat, 0, 0.38, 4.9);
    sonar.rotation.x = -Math.PI / 2;
    body.add(sonar);
    const SONAR_BLUE = new THREE.Color(0x3b82f6);
    const SONAR_AMBER = new THREE.Color(0xf59e0b);
    const SONAR_RED = new THREE.Color(0xef4444);

    // Drag to turn the view; a click on the floor drops an obstacle in front of the car.
    let dragYaw = 0;
    let viewTarget = 0;
    viewRef.current = (delta) => {
      viewTarget = delta === null ? 0 : viewTarget + delta;
      kick();
    };
    let dragging = false;
    let lastX = 0;
    let moved = 0;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const onDown = (ev: PointerEvent) => {
      rootRef.current?.focus({ preventScroll: true });
      dragging = true;
      moved = 0;
      lastX = ev.clientX;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      moved += Math.abs(ev.clientX - lastX);
      dragYaw += (ev.clientX - lastX) * 0.008;
      viewTarget = dragYaw;
      lastX = ev.clientX;
      if (moved > 24) setTurned(true);
      kick();
    };
    const onUp = (ev: PointerEvent) => {
      if (dragging && moved < 5 && !reduced && e < 0.05) drop(ev);
      dragging = false;
    };
    const drop = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(ground, hit)) return;
      track.worldToLocal(hit);
      if (hit.z < 3.9 || Math.abs(hit.x) > 3.4) return; // only ahead of the car, inside the arena
      const pick = obstacles.filter((o) => o !== avoidO).sort((p, q) => q.z - p.z)[0];
      pick.x = hit.x + cx;
      pick.z = hit.z + cz;
      pick.dropAt = performance.now();
      setKind(pick, randKind());
      kick();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", () => (dragging = false));
    renderer.domElement.style.cursor = "grab";

    // Driving: W A S D anywhere while the hero is on screen; arrow keys once the stage has focus.
    const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
      KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
    };
    const onKey = (down: boolean) => (ev: KeyboardEvent) => {
      const k = KEYS[ev.code];
      if (!k || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (ev.code.startsWith("Arrow")) {
        if (!rootRef.current?.contains(document.activeElement)) return;
        ev.preventDefault();
      }
      if (!onScreen) return;
      driveRef.current[k] = down;
      driveRef.current.at = performance.now();
      kick();
    };
    const onKeyDown = onKey(true);
    const onKeyUp = onKey(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Hyperspeed: light trails rushing along the track, low beside the car and high across the whole stage.
    const trailMats = [
      { m: keep(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0, depthWrite: false })), w: 0.5 },
      { m: keep(new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0, depthWrite: false })), w: 0.55 },
      { m: keep(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0, depthWrite: false })), w: 0.45 },
    ];
    // All 110 streaks are drawn as one instanced mesh per colour: three draw calls.
    const streakGeo = keep(new THREE.BoxGeometry(0.014, 0.014, 1));
    const SPAN = 64;
    type Streak = { k: number; slot: number; x: number; y: number; z: number; thick: number; len: number; v: number };
    const streaks: Streak[] = [];
    const counts = [0, 0, 0];
    for (let i = 0; i < 110; i++) {
      const pick = Math.random();
      const k = pick < 0.55 ? 0 : pick < 0.9 ? 1 : 2;
      const nearCar = i < 30;
      const side = i % 2 ? 1 : -1;
      streaks.push({
        k,
        slot: counts[k]++,
        x: nearCar ? side * (1.4 + Math.random() * 2.6) : side * (2 + Math.random() * 16),
        y: nearCar ? 0.1 + Math.random() * 1.5 : 0.3 + Math.random() * 7.5,
        z: (Math.random() - 0.5) * SPAN,
        thick: nearCar ? 1 : 1.5 + Math.random() * 2,
        len: 1.5 + Math.random() * (nearCar ? 2.5 : 6),
        v: nearCar ? 1.5 + Math.random() * 1.2 : 2.2 + Math.random() * 2.6,
      });
    }
    const streakMeshes = trailMats.map((t, k) => {
      const m = new THREE.InstancedMesh(streakGeo, t.m, Math.max(1, counts[k]));
      m.count = counts[k];
      m.frustumCulled = false; // they move every frame
      track.add(m);
      return m;
    });
    const tmpM = new THREE.Matrix4();

    // Phones and tablets: the stage fills the whole hero, behind the copy. The car is framed in the
    // room below the copy, seen from high and far with the camera aimed ahead of it, so the road
    // and the obstacles it dodges are in view. While it comes apart the camera eases back to it.
    let narrowStage = false;
    let narrowDist = 30;
    const AHEAD = new THREE.Vector3(Math.sin(FORWARD_YAW), 0, Math.cos(FORWARD_YAW)).multiplyScalar(2.2);
    const frameNarrow = (k: number) => {
      const dist = narrowDist * (1 + 0.15 * k);
      camera.position.set(0.6, dist * (0.48 - 0.12 * k), dist);
      camera.lookAt(AHEAD.x * (1 - k), 0.5 + 1.4 * k, AHEAD.z * (1 - k));
    };
    // The exploded-view tags' viewport size and box dimensions, cached here and only remeasured on
    // resize — not every animation frame. Reading clientWidth/offsetWidth inside the render loop
    // (as this used to) forces a synchronous layout on every frame, interleaved with the transform
    // writes right after: textbook layout thrashing, and continuous since this loop runs the whole
    // time the hero is on screen. That's what a real-device Timeline recording caught as constant
    // Layout/Style-Recalculate activity.
    let stageW = 0;
    let stageH = 0;
    let labelSizes: { w: number; h: number }[] = [];
    const remeasureLabels = () => {
      labelSizes = labelRefs.current.map((el) => (el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 0, h: 0 }));
    };
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      stageW = w;
      stageH = h;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Desktop: the car sits right of the headline. Phones and tablets: it sits centred below
      // the copy, with the camera brought in so it fills the stage.
      const wide = camera.aspect > 1.2 && window.innerWidth >= 1024;
      narrowStage = !wide;
      if (wide) {
        camera.position.set(0.6, 13.6 * 0.3, 13.6);
        camera.lookAt(0, 1.75, 0);
        camera.setViewOffset(w, h, -w * 0.2, -h * 0.03, w, h); // the car sits right of the headline
        scene.fog = new THREE.Fog(0xffffff, 13, 30);
      } else {
        // About 8.5 units of road across the width, wherever the stage's height ends up.
        narrowDist = 8.5 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
        frameNarrow(0);
        // Centre the car in the room below the copy (the spacer in YugmindsSite's hero).
        const room = w < 640 ? Math.min(w, 500) : Math.min(w * 0.72, 600);
        camera.setViewOffset(w, h, 0, -(h - room * 0.55 - h / 2), w, h);
        scene.fog = new THREE.Fog(0xffffff, narrowDist * 0.9, narrowDist * 2.1);
      }
      camera.updateProjectionMatrix();
    };

    // The obstacle avoider, as kids program it: cruise, see something, stop,
    // back up, look left and right, go round the clear side.
    type State = "cruise" | "brake" | "reverse" | "scan" | "avoid" | "clear";
    let state: State = "cruise";
    let stateT = 0;
    let side = 1; // +1 = the car's left
    let avoidX = 0;
    let avoidO: Obstacle | null = null;
    let passZ = 0;
    let reachZ = 0;
    let blockedFor = 0;
    let attempts = 0;
    let stuckSince = 0;
    let progZ = 0;
    // How deep the car's footprint (a rectangle) sits inside any block (a circle); 0 = touching nothing.
    const HALF_L = 2.88;
    const HALF_W = 1.08;
    const BLOCK_R = 0.6;
    const PATH = HALF_W + BLOCK_R + 0.07; // centre-to-centre distance at which car and block just miss
    const MARGIN = 0.3; // the room a lane should leave on top of that
    const overlap = (x: number, z: number, hd: number) => {
      const sn = Math.sin(hd);
      const cs = Math.cos(hd);
      let worst = 0;
      for (const o of obstacles) {
        const ox = o.x - x;
        const oz = o.z - z;
        const intoSide = HALF_W + BLOCK_R - Math.abs(ox * cs - oz * sn);
        const intoEnd = HALF_L + BLOCK_R - Math.abs(ox * sn + oz * cs);
        if (intoSide > 0 && intoEnd > 0) worst = Math.max(worst, Math.min(intoSide, intoEnd));
      }
      return worst;
    };
    // Pick the closest lane, across the whole floor, with room beside every block the car
    // will be alongside while it passes the one in its way.
    const pickLane = () => {
      let ahead = obstacles.filter((o) => o.z - cz > -1 && o.z - cz < 10);
      // Blocks further on than a car length don't share the lane; they get their own dodge later.
      const first = ahead.filter((o) => o.z > cz && Math.abs(o.x - cx) < PATH + 0.2).sort((p, q) => p.z - q.z)[0];
      if (first) ahead = ahead.filter((o) => Math.abs(o.z - first.z) < 2 * (HALF_L + BLOCK_R));
      let best = { x: 0, cost: Infinity };
      for (let x = -3.4; x <= 3.401; x += 0.2) {
        const room = ahead.reduce((m, o) => Math.min(m, Math.abs(o.x - x)), Infinity);
        // A lane it could only reach by cutting across a block close in front isn't a real option.
        const cuts = ahead.some((o) => o.z - cz < 2 * (HALF_L + BLOCK_R) && Math.abs(o.x - cx) >= PATH && Math.min(cx, x) < o.x + PATH && o.x - PATH < Math.max(cx, x));
        // Roomy lanes first; a tight squeeze beats calling the way blocked.
        const fit = room >= PATH + MARGIN ? 0 : room >= PATH + 0.08 ? 50 : 100 + (PATH + MARGIN - room) * 10;
        const cost = fit + (cuts ? 60 : 0) + Math.abs(x - cx);
        if (cost < best.cost) best = { x, cost };
      }
      const blocking = ahead.filter((o) => Math.abs(o.x - cx) < PATH + 0.2 || Math.abs(o.x - best.x) < PATH + 0.2);
      // Be across before the nose reaches the first block in the way...
      const inWay = ahead.filter((o) => o.z > cz && Math.abs(o.x - cx) < PATH + 0.2);
      const reachZ = inWay.reduce((m, o) => Math.min(m, o.z - (HALF_L + BLOCK_R + 0.2)), cz + 3);
      // ...and stay in the lane until the tail has cleared the last one.
      const passZ = blocking.reduce((m, o) => Math.max(m, o.z + HALF_L + BLOCK_R + 0.3), cz);
      return { x: best.x, passZ, reachZ, blocked: best.cost >= 100 };
    };
    let cx = 0; // the car's place on the track
    let cz = 0;
    let h = 0; // heading relative to the track
    let v = 0;
    let lastV = 0;
    let pitch = 0;
    let steerVis = 0;
    let pingPhase = 0;
    let firstClearAt = 0;
    let mode: "auto" | "manual" | "idle" = "auto";
    let lastRem = 0;
    const born = performance.now();
    let lastOled = 0;
    let lastMsg = "";
    let e = reduced ? 1 : 0;
    let from = e;
    let start = 0;
    let shownApart = false;
    let last = performance.now();
    const DURATION = 2100;
    const TILE = 60 / 14;
    const anchor = new THREE.Vector3();
    const go = (s: State) => {
      state = s;
      stateT = 0;
    };
    // Nothing draws until every shader is compiled (in the background, below), so the
    // first frame never freezes the page compiling them.
    let ready = false;
    let disposed = false;
    const draw = (now: number) => {
      if (!ready) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const live = !reduced;
      stateT += dt;

      // Apart once, a moment after its first successful dodge; the visitor's choice wins after that.
      const auto = live ? (firstClearAt && now > firstClearAt + 1500 && now < firstClearAt + 10500 ? 1 : 0) : 1;
      const target = userRef.current ?? auto;
      if (target === 1 !== shownApart) {
        shownApart = target === 1;
        setApart(shownApart);
      }
      if (!live) e = target;
      else if (e !== target) {
        if (!start) {
          start = now;
          from = e;
        }
        const k = Math.min(1, (now - start) / DURATION);
        e = from + (target - from) * k;
        if (k >= 1) {
          e = target;
          start = 0;
        }
      }

      // Sense: the nearest obstacle in the car's path, measured from the sensor.
      let near = Infinity;
      let nearO: Obstacle | null = null;
      const sn = Math.sin(h);
      const cs = Math.cos(h);
      for (const o of obstacles) {
        const ox = o.x - cx;
        const oz = o.z - cz;
        const fwd = ox * sn + oz * cs; // ahead of the car, along its heading
        const lat = ox * cs - oz * sn; // to its side
        if (fwd > 0 && fwd < 9 && Math.abs(lat) < PATH) {
          const d = Math.max(0, fwd - 3.41); // from the nose
          if (d < near) {
            near = d;
            nearO = o;
          }
        }
      }

      // Decide.
      let vWant = 0;
      let hWant = h;
      let turnRate = 1.1;
      const d = driveRef.current;
      const input = d.up || d.down || d.left || d.right;
      mode = !live || e >= 0.05 ? mode : input || now - d.at < 2500 ? "manual" : d.auto ? "auto" : "idle";
      if (live && e < 0.05 && mode !== "auto") {
        // The visitor drives. The sensor still brakes before a crash.
        if (state !== "cruise") go("cruise");
        avoidO = null;
        progZ = cz;
        vWant = d.up ? CRUISE * 1.6 : d.down ? -2 : 0;
        hWant = Math.max(-0.9, Math.min(0.9, h + (d.left ? 0.6 : 0) - (d.right ? 0.6 : 0)));
        turnRate = 1.4;
        if (vWant > 0 && near < 0.7) vWant = 0;
      } else if (live && e < 0.05) {
        // "Stuck" means no headway for a while, not a long dodge that is still getting somewhere.
        if (cz > progZ + 1) {
          progZ = cz;
          stuckSince = now;
        }
        if (state !== "cruise" && state !== "clear" && now - stuckSince > 12000) {
          // Taking far too long: treat it as blocked and clear a path.
          stuckSince = now;
          go("clear");
        }
        if (state === "cruise") {
          vWant = CRUISE;
          // Head back to the line only when that strip of floor is free; otherwise keep to this lane
          // (steering home straight after a dodge would aim it at the block it just went round).
          const homeFree = !obstacles.some((o) => o.z - cz > -(HALF_L + BLOCK_R) && o.z - cz < 8 && Math.min(cx, 0) - PATH < o.x && o.x < Math.max(cx, 0) + PATH);
          hWant = homeFree ? Math.max(-0.28, Math.min(0.28, -cx * 0.35)) : 0;
          if (near < 2 && nearO) {
            avoidO = nearO;
            stuckSince = now;
            go("brake");
          }
        } else if (state === "brake") {
          if (v < 0.05) go("reverse");
        } else if (state === "reverse") {
          // Back up until there's room to turn, further on each retry.
          vWant = -0.9;
          hWant = 0;
          if ((stateT > 0.6 + attempts * 0.4 && near > 1) || stateT > 2.2 + attempts * 0.5) go("scan");
        } else if (state === "scan") {
          hWant = Math.sin((stateT / 1.6) * Math.PI * 2) * 0.45;
          turnRate = 2.2;
          if (stateT > 1.6) {
            const plan = pickLane();
            if (plan.blocked) go("clear");
            else {
              avoidX = plan.x;
              passZ = plan.passZ;
              reachZ = plan.reachZ;
              side = avoidX >= cx ? 1 : -1;
              go("avoid");
            }
          }
        } else if (state === "clear") {
          // No gap wide enough: slide the blocks in front toward the nearest wall, then look again.
          if (stateT < dt * 1.5) {
            for (const o of obstacles) {
              if (o.z - cz > -1 && o.z - cz < 7 && Math.abs(o.x - cx) < PATH + 0.6) o.slideTo = o.x >= cx ? 4.1 : -3.9;
            }
          }
          if (stateT > 1.2) go("scan");
        } else if (state === "avoid") {
          // Point at the gap steeply enough to get across before reaching the block:
          // turn on the spot first (it's a differential drive), then drive.
          const lat = avoidX - cx;
          const across = Math.abs(lat);
          if (across > 0.1) {
            // Aim at a fixed point on the track (the lane, just before the block), so the
            // angle doesn't change as the block drops out of the sensor's view.
            const run = Math.max(0.4, reachZ - cz);
            hWant = Math.max(-1.2, Math.min(1.2, Math.atan2(lat, run)));
            turnRate = 1.9;
            vWant = Math.abs(hWant - h) > 0.25 ? 0 : CRUISE * 0.55;
          } else {
            hWant = Math.max(-0.2, Math.min(0.2, lat * 1.2)); // hold the lane's centre while passing
            vWant = CRUISE * 0.7;
          }
          if (near < 0.25 && nearO) {
            avoidO = nearO;
            attempts++;
            go("brake");
          } else if (cz > passZ && across < 0.6) {
            attempts = 0;
            avoidO = null;
            go("cruise");
            if (!firstClearAt) firstClearAt = now;
          }
        }
      }

      // Move.
      const opposing = mode === "manual" && vWant !== 0 && Math.sign(vWant) !== Math.sign(v) && Math.abs(v) > 0.05;
      const decel = state === "brake" || e > 0 || opposing ? 6 : mode === "manual" ? 3 : 2;
      const gain = mode === "manual" ? 2.6 : 1.4;
      v += Math.max(-decel * dt, Math.min(gain * dt, vWant - v));
      let dh = Math.max(-turnRate * dt, Math.min(turnRate * dt, hWant - h));
      const nh = h + dh;
      const nz = cz + v * Math.cos(nh) * dt;
      const nx = Math.max(-3.4, Math.min(3.4, cx + v * Math.sin(nh) * dt));
      const inNow = overlap(cx, cz, h);
      const sz = cz + v * Math.cos(h) * dt;
      const sx = Math.max(-3.4, Math.min(3.4, cx + v * Math.sin(h) * dt));
      if (overlap(nx, nz, nh) <= inNow + 1e-4) {
        cx = nx;
        cz = nz;
        h = nh;
      } else if (overlap(sx, sz, h) <= inNow + 1e-4) {
        cx = sx; // turning would clip the block, so carry straight on for now
        cz = sz;
        dh = 0;
      } else if (overlap(cx, cz, nh) <= inNow + 1e-4) {
        h = nh; // blocked ahead, but it can still turn on the spot
        v = 0;
      } else {
        dh = 0;
        v = 0;
      }
      // Autopilot wants to go but can't: back up and re-plan instead of sitting there.
      blockedFor = mode === "auto" && Math.abs(vWant) > 0.3 && Math.abs(v) < 0.05 && e < 0.05 ? blockedFor + dt : 0;
      if (blockedFor > 1.2) {
        blockedFor = 0;
        attempts++;
        stuckSince = state === "cruise" ? now : stuckSince;
        go(state === "reverse" ? "scan" : "reverse");
      }
      for (const w of wheels) {
        const pivot = (-(w.userData.side as number) * dh * WHEEL_X) / R;
        w.rotation.x += (v * dt) / R + pivot + (live && e > 0.5 ? dt * 1.2 * e : 0);
      }
      steerVis += (Math.max(-0.45, Math.min(0.45, (hWant - h) * 2.5)) - steerVis) * Math.min(1, dt * 6);
      for (const s of steerers) s.rotation.y = steerVis;
      if (!dragging) dragYaw += (viewTarget - dragYaw) * Math.min(1, dt * 5);
      track.rotation.y = FORWARD_YAW + dragYaw;
      car.rotation.y = FORWARD_YAW + dragYaw + h;
      // Drive in from off screen on load.
      const kIn = live ? clamp01((now - born) / 2200) : 1;
      const rem = 7 * (1 - kIn) ** 3;
      car.position.set(-Math.sin(car.rotation.y) * rem, 0, -Math.cos(car.rotation.y) * rem);
      if (lastRem) for (const w of wheels) w.rotation.x += (lastRem - rem) / R;
      lastRem = rem;
      // Trails always drift; they brighten and race with the car's speed.
      const rush = clamp01(Math.abs(v) / CRUISE);
      const boost = mode === "manual" && d.up ? 1 : 0;
      const fire = live && e < 0.05 && v > 0.05 ? 1 : 0;
      flameOuter.opacity = fire * (0.35 + 0.3 * rush + 0.2 * boost);
      flameCore.opacity = fire * (0.6 + 0.3 * boost);
      flames.forEach((f, i) => {
        const core = i % 2 === 1;
        const len = (0.12 + 0.55 * rush + 0.55 * boost) * (core ? 0.6 : 1) * (0.9 + Math.random() * 0.2);
        f.scale.y = Math.max(0.01, len);
      });
      for (const t of trailMats) t.m.opacity = live ? t.w * (0.28 + 0.72 * rush) : 0;
      const flow = live ? Math.max(Math.abs(v), 0.9) * (v < 0 ? -1 : 1) : 0;
      for (const st of streaks) {
        st.z -= st.v * flow * dt;
        if (st.z < -SPAN / 2) st.z += SPAN;
        if (st.z > SPAN / 2) st.z -= SPAN;
        streakMeshes[st.k].setMatrixAt(st.slot, tmpM.makeScale(st.thick, st.thick, st.len).setPosition(st.x, st.y, st.z));
      }
      for (const m of streakMeshes) m.instanceMatrix.needsUpdate = true;

      // The arena slides past.
      floorTex.offset.set(cx / TILE, -cz / TILE);
      tape.position.x = -cx;
      for (const w of walls) {
        for (let i = 0; i < 12; i++) w.m.setMatrixAt(i, tmpM.makeTranslation(w.x - cx, 0, ((((i * 4 - cz) % 48) + 48) % 48) - 16));
        w.m.instanceMatrix.needsUpdate = true;
      }
      let ahead = -Infinity;
      for (const o of obstacles) ahead = Math.max(ahead, o.z);
      for (const o of obstacles) {
        if (o.z < cz - 7 && o !== avoidO) {
          o.z = ahead + 10 + Math.random() * 5;
          o.x = (Math.random() - 0.5) * 2.8;
          o.dropAt = 0;
          setKind(o, randKind());
          ahead = o.z;
        }
        if (o.slideTo !== null) {
          o.x += (o.slideTo - o.x) * Math.min(1, dt * 3);
          if (Math.abs(o.slideTo - o.x) < 0.02) o.slideTo = null;
        }
        const ft = (now - o.dropAt) / 1000;
        const y = !o.dropAt ? 0 : ft < 0.45 ? 2.4 * (1 - (ft / 0.45) ** 2) : ft < 0.7 ? 0.16 * Math.sin(((ft - 0.45) / 0.25) * Math.PI) : 0;
        o.g.position.set(o.x - cx, y, o.z - cz);
      }

      // Suspension: dips under braking, squats pulling away, a fine buzz at speed.
      const accel = (v - lastV) / Math.max(dt, 1e-3);
      lastV = v;
      pitch += (Math.max(-0.045, Math.min(0.045, -accel * 0.012)) - pitch) * Math.min(1, dt * 8);
      const buzz = live ? (Math.sin(now / 47) * 0.004 + Math.sin(now / 131) * 0.003) * Math.min(1, Math.abs(v) / CRUISE) : 0;
      body.position.y = buzz;
      body.rotation.x = pitch;
      body.rotation.z = -steerVis * 0.04 * Math.min(1, Math.abs(v) / CRUISE);

      // Come apart, layer by layer.
      for (const l of layers) {
        const p = ease(clamp01((e - l.delay) / 0.82));
        l.o.position.copy(l.base).addScaledVector(l.out, p);
        if (l.tilt) l.o.rotation.x = l.tilt * p;
        if (live && p > 0) l.o.position.y += Math.sin(now / 1000 + l.delay * 30) * 0.025 * p;
      }
      const open = e > 0.001;
      for (const o of hidden) o.visible = open;
      const tc = ease(clamp01((e - 0.3) / 0.7));
      card.position.lerpVectors(cardA.p, cardB.p, tc);
      card.quaternion.slerpQuaternions(cardA.q, cardB.q, tc);
      card.scale.setScalar(1 + tc);

      // Sonar: the cone warms as something gets close; pings quicken.
      const cm = Math.min(199, Math.round(near * 15));
      const warn = near < 1.4 ? 1 : near < 4 ? 0.5 : 0;
      sonarMat.color.copy(warn === 1 ? SONAR_RED : warn ? SONAR_AMBER : SONAR_BLUE);
      sonarMat.opacity = live ? (0.07 + warn * 0.05) * (1 - Math.min(1, e * 4)) : 0;
      pingPhase += dt * (near < 4 ? 2.4 : 0.9);
      pings.forEach((p, i) => {
        const age = live ? (pingPhase + i / 3) % 1 : 0;
        p.scale.setScalar(1 + age * 2.6);
        (p.material as THREE.MeshBasicMaterial).opacity = live ? (1 - age) * 0.5 : 0;
      });
      if (now - lastOled > 120) {
        lastOled = now;
        drawOled(cm, steerVis * 3);
      }
      const braking = state === "brake" || state === "reverse";
      tail.color.setHex(braking && live ? 0xff2d2d : 0xb91c1c);

      // HUD read-out: what the sensor sees and what the car is doing.
      const ro = readoutRef.current;
      if (ro) {
        const msg = !live
          ? "Taken apart"
          : e > 0.05
            ? "Taken apart"
            : mode === "manual"
              ? d.up && near < 0.7
                ? `Obstacle at ${cm} cm. Braking for you`
                : near < 6
                  ? `You're driving. Obstacle at ${cm} cm`
                  : "You're driving. Path clear"
              : mode === "idle"
                ? "Autopilot off. Drive with W A S D"
                : state === "brake"
                  ? `Obstacle at ${cm} cm. Stopping`
                  : state === "reverse"
                    ? "Too close. Backing up"
                    : state === "clear"
                      ? "No way round. Clearing a path"
                      : state === "scan"
                      ? "Looking left and right"
                      : state === "avoid"
                        ? side > 0
                          ? "Left is clear. Going round"
                          : "Right is clear. Going round"
                        : near < 6
                          ? `Obstacle at ${cm} cm`
                          : "Path clear";
        if (msg !== lastMsg) {
          ro.textContent = msg;
          const tone = braking || (mode === "manual" && d.up && near < 0.7) ? "stop" : near < 4 || state === "scan" || state === "avoid" ? "warn" : "ok";
          if (ro.parentElement) ro.parentElement.dataset.tone = tone;
          lastMsg = msg;
        }
      }

      if (narrowStage) frameNarrow(ease(clamp01(e)));
      renderer.render(scene, camera);

      // Tags follow each part, fading in as it separates. vw/vh and each label's size come from
      // the resize-time cache (stageW/stageH/labelSizes) — read, never measured here.
      const placed: { el: HTMLDivElement; x: number; y: number; w: number; h: number }[] = [];
      TAGS.forEach((l, i) => {
        const el = labelRefs.current[i];
        const size = labelSizes[i];
        if (!el || !size) return;
        anchor.set(...l.anchor);
        obj[l.key].localToWorld(anchor);
        anchor.project(camera);
        const x = ((anchor.x + 1) / 2) * stageW;
        const y = ((1 - anchor.y) / 2) * stageH;
        const want = l.side === "r" ? x : x - size.w;
        // Keep the whole tag inside the panel.
        const lx = Math.max(12, Math.min(want, stageW - size.w - 24));
        placed.push({ el, x: lx, y: Math.max(8, Math.min(y - size.h / 2, stageH - size.h - 8)), w: size.w, h: size.h });
      });
      // Top to bottom, push any tag that collides with one above it down below it.
      placed.sort((a, b) => a.y - b.y);
      placed.forEach((t, i) => {
        for (let j = 0; j < i; j++) {
          const o = placed[j];
          if (t.x < o.x + o.w && o.x < t.x + t.w && t.y < o.y + o.h + 6) t.y = o.y + o.h + 6;
        }
        t.el.style.transform = `translate(${Math.round(t.x)}px, ${Math.round(t.y)}px)`;
        // Fully opaque from halfway through the explode, so parts never show through a tag.
        t.el.style.opacity = String(Math.min(1, Math.max(0, (e - 0.35) / 0.2)));
      });
    };

    // Animate while on screen and the tab is visible.
    let raf = 0;
    let onScreen = true;
    let lastFrame = 0;
    const loop = (now: number) => {
      // At most 60 frames a second, even on 120 Hz screens (the simulation runs on dt, so it's unchanged).
      if (now - lastFrame >= 1000 / 62) {
        if (lastFrame) dpr.tick(now - lastFrame);
        if (PERF && lastFrame) perfLog("hero", renderer, now - lastFrame);
        lastFrame = now;
        draw(now);
      }
      raf = onScreen && !document.hidden && !reduced ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
      if (reduced) draw(performance.now());
    };
    kickRef.current = kick;
    const io = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen) kick();
    });
    io.observe(mount);
    const ro = new ResizeObserver(() => {
      resize();
      remeasureLabels();
      draw(performance.now());
    });
    ro.observe(mount);
    const onVis = () => {
      if (!document.hidden) {
        last = performance.now();
        kick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    resize();
    remeasureLabels();
    const t0 = performance.now();
    const compiling = renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        if (PERF) console.log(`[perf] hero shaders compiled in the background: ${(performance.now() - t0).toFixed(0)} ms`);
        ready = true;
        last = performance.now();
        draw(last);
        kick();
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      kickRef.current = () => {};
      // Free the GPU side only once any background compile has settled; three.js still touches it.
      compiling.finally(() => {
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
      });
      renderer.domElement.remove();
    };
  }, [warm]);

  const toggle = () => {
    const next = !apart;
    userRef.current = next ? 1 : 0;
    setApart(next);
    kickRef.current();
  };

  // `at` uses the event's timestamp, which shares performance.now()'s clock.
  return (
    <div ref={rootRef} tabIndex={-1} aria-label="Robot car test drive" role="region" className={`relative outline-none ${className}`}>
      <div
        ref={mountRef}
        data-drive-surface
        className="ym-device absolute inset-0"
        role="img"
        aria-label="The RoboCoders robot car in a 3D-printed hypercar shell, driving. Taken apart, each part shows who makes it: YugMinds Manufacturing makes the body, chassis and parts; Robocoders teaches kids to build and code robots like it; YugMinds Software writes the code that makes it see and drive; YugMinds Hardware designs the boards and microcontrollers that power it; YugMinds Labs builds and tests it all."
      >
        {TAGS.map((l, i) => (
          <div
            key={l.key}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 flex items-center opacity-0 will-change-transform ${l.side === "l" ? "flex-row-reverse text-right" : ""}`}
          >
            {/* Leader line from the part to its tag, as on an exploded drawing. taste-skill-ignore */}
            <span className="h-0.5 w-6 shrink-0 bg-slate-400 sm:w-10" />
            <span className={`max-w-[15rem] bg-white px-2 py-1 leading-tight ${l.side === "l" ? "mr-1" : "ml-1"}`}>
              <span className="block font-acdisplay text-[13px] font-bold text-ym-text sm:text-[15px]">{l.company}</span>
              <span className="block text-[13px] text-slate-600 max-sm:hidden">{l.part}</span>
            </span>
          </div>
        ))}
        <p className="ym-device-fallback">The RoboCoders robot car. Manufacturing makes its body, Software writes its code, Hardware designs its boards, Labs builds and tests it, and Robocoders teaches kids to make one.</p>
      </div>
      {/* Turn the view: a hint until the visitor has dragged once, then just the buttons. */}
      <div className="ym-drive-ui absolute bottom-4 left-4 z-10 items-center gap-1">
        <div role="group" aria-label="Turn the view" className="flex gap-1">
          <button
            type="button"
            aria-label="Turn the view left"
            onClick={() => {
              viewRef.current(-0.6);
              setTurned(true);
            }}
            className="grid size-11 place-items-center bg-slate-100 text-ym-text outline-none transition-colors hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-2 focus-visible:ring-ym-blue"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Turn the view right"
            onClick={() => {
              viewRef.current(0.6);
              setTurned(true);
            }}
            className="grid size-11 place-items-center bg-slate-100 text-ym-text outline-none transition-colors hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-2 focus-visible:ring-ym-blue"
          >
            <RotateCw className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => viewRef.current(null)}
            className="min-h-11 bg-slate-100 px-3.5 text-sm font-semibold text-ym-text outline-none transition-colors hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-2 focus-visible:ring-ym-blue"
          >
            Reset view
          </button>
        </div>
        {!turned && (
          <p className="ml-1.5 hidden min-h-11 items-center bg-white px-3.5 text-sm font-semibold text-ym-text sm:flex">
            Drag the floor to look around
          </p>
        )}
      </div>
      {/* Corner slot for the drive prompt; it steps aside while the car is taken apart. */}
      {children && (
        <div className={`ym-drive-ui absolute right-3 top-3 z-10 transition-opacity duration-300 md:right-4 md:top-4 ${apart ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          {children}
        </div>
      )}
      <div className="ym-drive-ui absolute bottom-4 right-4 z-10 max-w-[calc(100%-2rem)] flex-col items-end gap-2">
        <div data-tone="ok" className="group flex min-h-10 items-center gap-2.5 bg-white px-3.5">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-ym-blue group-data-[tone=stop]:bg-red-500 group-data-[tone=warn]:bg-amber-500" />
          <p ref={readoutRef} aria-live="polite" className="text-sm font-semibold text-ym-text">
            Path clear
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            aria-pressed={autopilot}
            onClick={() => {
              const next = !autopilot;
              setAutopilot(next);
              driveRef.current.auto = next;
              driveRef.current.at = 0;
              kickRef.current();
            }}
            className={`min-h-11 px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2 ${autopilot ? "bg-ym-blue text-white" : "bg-slate-100 text-ym-text hover:bg-slate-200"}`}
          >
            {autopilot ? "Autopilot on" : "Autopilot off"}
          </button>
          <button
            type="button"
            onClick={toggle}
            className="min-h-11 bg-ym-text px-5 text-sm font-semibold text-white outline-none transition-transform active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2"
          >
            {apart ? "Put it back together" : "Take it apart"}
          </button>
        </div>
      </div>
    </div>
  );
}
