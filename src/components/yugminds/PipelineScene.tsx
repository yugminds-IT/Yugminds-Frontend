"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AXLE_Z, PERF, R, WHEEL_X, adaptiveDpr, warmCarBody, perfLog, timed, boardTop, buildRaceShell, canvasTexture, lessonCard, mergeByMaterial, meshFace, radial, blueprintEdges, tyreGeometry } from "./HeroRobot";

/*
  The RoboCoders car, built by scroll. `progress` runs 0..5, one unit per company:
  0-1 Labs draws the blueprint, 1-2 Hardware fits boards, motors and sensors,
  2-3 Software streams code onto the board and wakes the sensor, 3-4 Manufacturing
  fits the wheels and 3D-prints the shell, 4-5 Robocoders sets it on a line track
  with its lesson card. The camera circles slowly as it's built.
*/

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Local 0..1 progress inside [a, b].
const win = (p: number, a: number, b: number) => ease(clamp01((p - a) / (b - a)));

const PROGRAM = ["forever {", "  d = ultrasonic.read()", "  if (d < 20) {", "    stop(); turn()", "  } else {", "    drive()", "  }", "}"];
const PROGRAM_CHARS = PROGRAM.join("").length;

export function PipelineScene({ progress, className = "" }: { progress: React.RefObject<number>; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Wait for the shared car body (built in idle-time steps, usually already done by the hero).
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      mount.dataset.failed = "1";
      return;
    }
    const dpr = adaptiveDpr(renderer);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.display = "block";
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
    const cyl = (r: number, h: number, mat: THREE.Material, axis: "x" | "y" | "z", x = 0, y = 0, z = 0, seg = 32) => {
      const m = mesh(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z);
      if (axis === "x") m.rotation.z = Math.PI / 2;
      if (axis === "z") m.rotation.x = Math.PI / 2;
      return m;
    };

    const scene = new THREE.Scene();
    const pmrem = keep(new THREE.PMREMGenerator(renderer));
    const room = keep(new RoomEnvironment());
    scene.environment = keep(pmrem.fromScene(room, 0.03).texture);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(-3, 8, 5);
    scene.add(key);

    // Materials.
    const BLUE = 0x2563eb;
    const blueprint = keep(new THREE.LineBasicMaterial({ color: BLUE, transparent: true }));
    const gridMat = keep(new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 }));
    const printPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // keeps everything below the print height
    const acrylic = keep(new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.15, transparent: true, opacity: 0.6 }));
    const yellow = keep(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 }));
    const silver = keep(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1, roughness: 0.2 }));
    const gold = keep(new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.28 }));
    const black = keep(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }));
    const rubber = keep(new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }));
    const gunmetal = keep(new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.28 }));
    const bronze = keep(new THREE.MeshStandardMaterial({ color: 0xa8834a, metalness: 1, roughness: 0.3 })); // the hero car's rims
    const pcbEdge = keep(new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55 }));
    const pcbPlain = keep(new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.45 }));
    const traces = keep(new THREE.MeshStandardMaterial({ map: keep(boardTop()), roughness: 0.4, emissive: new THREE.Color(0x3b82f6), emissiveIntensity: 0 }));
    const cellWrap = keep(new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.3 }));
    const glow = keep(new THREE.MeshBasicMaterial({ color: 0x60a5fa }));

    const stage = new THREE.Group();
    scene.add(stage);

    // Floor: a blueprint grid that calms to a pale studio grid.
    const grid = new THREE.GridHelper(24, 48);
    keep(grid.geometry);
    grid.material = gridMat;
    stage.add(grid);
    const shadow = mesh(new THREE.PlaneGeometry(3.6, 6.6), keep(new THREE.MeshBasicMaterial({ map: keep(radial("rgba(15,23,42,0.4)", "rgba(15,23,42,0)")), transparent: true, depthWrite: false }))); // taste-skill-ignore
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    stage.add(shadow);
    const tape = mesh(new THREE.PlaneGeometry(0.1, 20), keep(new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true })), 0, 0.006, 0);
    tape.rotation.x = -Math.PI / 2;
    stage.add(tape);

    // 1. Labs: the blueprint, drawn line by line, with a dimension line.
    const bpEdges = keep(blueprintEdges());
    const bp = new THREE.LineSegments(bpEdges, blueprint);
    stage.add(bp);
    const bpTotal = bpEdges.attributes.position.count;
    const wheelRings: THREE.Line[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pts = new THREE.EllipseCurve(0, 0, R, R, 0, Math.PI * 2).getPoints(48).map((p) => new THREE.Vector3(0, p.y, p.x));
        const ring = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), blueprint);
        ring.position.set(sx * 1.03, R, sz * AXLE_Z);
        stage.add(ring);
        wheelRings.push(ring);
      }
    }
    const dim = new THREE.Group();
    {
      const pts = [new THREE.Vector3(1.7, 0.02, -2.84), new THREE.Vector3(1.7, 0.02, 2.88)];
      dim.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), blueprint));
      for (const z of [-2.84, 2.88]) {
        dim.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.55, 0.02, z), new THREE.Vector3(1.85, 0.02, z)])), blueprint));
      }
      const label = mesh(
        new THREE.PlaneGeometry(0.9, 0.22),
        keep(new THREE.MeshBasicMaterial({ transparent: true, map: keep(canvasTexture(256, 64, (g) => {
          g.fillStyle = "#2563eb";
          g.font = "700 40px system-ui, sans-serif";
          g.fillText("56 cm", 40, 46);
        })) })),
        2.05, 0.03, 0,
      );
      label.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      dim.add(label);
    }
    stage.add(dim);

    // 2. Hardware: chassis, motors, battery, board, sensor. Each part drops in on its own beat.
    type Part = { o: THREE.Object3D; base: THREE.Vector3; at: number };
    const parts: Part[] = [];
    const part = (o: THREE.Object3D, at: number) => {
      stage.add(o);
      parts.push({ o, base: o.position.clone(), at });
      return o;
    };
    part(box(1.3, 0.05, 2.1, acrylic, 0, 0.68, 0, 0.02), 1.0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const motor = new THREE.Group();
        motor.position.set(sx * 0.42, R, sz * AXLE_Z);
        motor.add(box(0.48, 0.32, 0.28, yellow, 0, 0, 0, 0.03));
        motor.add(cyl(0.11, 0.24, silver, "x", -sx * 0.3, 0.02, 0));
        part(motor, 1.1 + (sx + 1) * 0.04 + (sz + 1) * 0.02);
      }
    }
    {
      const batt = new THREE.Group();
      batt.position.set(0, 0.86, -0.75);
      batt.add(box(0.9, 0.12, 0.44, black, 0, -0.03, 0, 0.02));
      for (const z of [-0.1, 0.1]) batt.add(cyl(0.09, 0.76, cellWrap, "x", 0, 0.06, z));
      part(batt, 1.3);
    }
    const board = new THREE.Group();
    board.position.set(0, 0.92, 0.2);
    board.scale.setScalar(0.85);
    board.add(box(1.2, 0.05, 1.3, [pcbEdge, pcbEdge, traces, pcbEdge, pcbEdge, pcbEdge]));
    board.add(box(0.42, 0.06, 0.44, silver, 0, 0.055, -0.06, 0.01));
    {
      const pins = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.022, 0.12, 0.022)), gold, 30);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 30; i++) pins.setMatrixAt(i, m4.makeTranslation(i < 15 ? -0.5 : 0.5, 0.07, -0.5 + (i % 15) * 0.07));
      board.add(pins);
    }
    part(board, 1.45);
    const sensor = new THREE.Group();
    sensor.position.set(0, 0.42, 2.55); // ends up inside the nose once the shell is printed
    sensor.scale.setScalar(0.62);
    sensor.add(box(0.9, 0.42, 0.035, [pcbEdge, pcbEdge, pcbEdge, pcbEdge, pcbPlain, pcbPlain]));
    {
      const faceMat = keep(new THREE.MeshStandardMaterial({ map: keep(meshFace()), roughness: 0.7 }));
      for (const x of [-0.24, 0.24]) {
        sensor.add(cyl(0.16, 0.2, silver, "z", x, 0, 0.11, 40));
        sensor.add(mesh(new THREE.CircleGeometry(0.145, 40), faceMat, x, 0, 0.212));
      }
    }
    part(sensor, 1.6);

    // 3. Software: the screen types the program; code streams into the board; the sensor wakes.
    const oledCanvas = document.createElement("canvas");
    oledCanvas.width = 512;
    oledCanvas.height = 320;
    const oledTex = keep(new THREE.CanvasTexture(oledCanvas));
    oledTex.colorSpace = THREE.SRGBColorSpace;
    let typed = -1;
    const drawProgram = (chars: number) => {
      const g = oledCanvas.getContext("2d")!;
      g.fillStyle = "#020617";
      g.fillRect(0, 0, 512, 320);
      g.font = "600 30px ui-monospace, monospace";
      let left = chars;
      PROGRAM.forEach((line, i) => {
        if (left <= 0) return;
        const shown = line.slice(0, left);
        left -= line.length;
        g.fillStyle = i === 0 || i === PROGRAM.length - 1 ? "#93c5fd" : "#e0f2fe";
        g.fillText(shown, 18, 40 + i * 36);
      });
      oledTex.needsUpdate = true;
    };
    drawProgram(0);
    const oled = new THREE.Group();
    oled.position.set(0, 1.05, 0.9); // low enough to end up under the printed hood
    oled.rotation.x = -0.35;
    oled.add(box(0.9, 0.04, 0.6, pcbPlain));
    const screen = mesh(new THREE.PlaneGeometry(0.82, 0.51), keep(new THREE.MeshBasicMaterial({ map: oledTex, toneMapped: false })), 0, 0.025, 0);
    screen.rotation.x = -Math.PI / 2;
    oled.add(screen);
    stage.add(oled);

    const bits: { m: THREE.Mesh; from: THREE.Vector3; at: number }[] = [];
    const bitGeo = keep(new THREE.BoxGeometry(0.07, 0.07, 0.07));
    const boardAt = new THREE.Vector3(0, 0.98, 0.2);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(bitGeo, glow);
      const a = (i / 18) * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * (2 + (i % 3) * 0.5), 2.6 + (i % 4) * 0.35, Math.sin(a) * (2 + (i % 2)));
      stage.add(m);
      bits.push({ m, from, at: 2.05 + i * 0.03 });
    }
    const sonarMat = keep(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const sonar = mesh(new THREE.ConeGeometry(0.95, 3.4, 40, 1, true), sonarMat, 0, 0.42, 4.6);
    sonar.rotation.x = -Math.PI / 2;
    stage.add(sonar);
    const rings: THREE.Mesh[] = [];
    const ringGeo = keep(new THREE.TorusGeometry(0.22, 0.01, 6, 48));
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0, depthWrite: false })));
      ring.position.set(0, 0.42, 2.95);
      stage.add(ring);
      rings.push(ring);
    }

    // 4. Manufacturing: wheels slide on, then the shell is printed up from the floor.
    const wheels: THREE.Group[] = [];
    {
      const tyreGeo = keep(tyreGeometry());
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const w = new THREE.Group();
          w.position.set(sx * WHEEL_X, R, sz * AXLE_Z);
          w.userData.side = sx;
          w.add(mesh(tyreGeo, rubber));
          w.add(cyl(0.33, 0.3, bronze, "x"));
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const spoke = box(0.035, 0.05, 0.27, bronze, sx * 0.155, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.012);
            spoke.rotation.x = a;
            w.add(spoke);
          }
          w.add(cyl(0.06, 0.06, silver, "x", sx * 0.17, 0, 0, 6));
          mergeByMaterial(keep, w);
          stage.add(w);
          wheels.push(w);
        }
      }
    }
    // The same race body as the hero car, clipped to the print height as it's printed.
    const shell = timed("race shell (build scene)", () => buildRaceShell(keep, null, [printPlane]));
    stage.add(shell);
    // The print head: a glowing fresh layer and a nozzle sweeping across it.
    const head = new THREE.Group();
    {
      const pts = [[-1.1, -2.9], [1.1, -2.9], [1.1, 2.9], [-1.1, 2.9], [-1.1, -2.9]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      head.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), keep(new THREE.LineBasicMaterial({ color: 0x60a5fa }))));
      head.add(box(2.4, 0.03, 0.06, gunmetal, 0, 0.25, 0)); // gantry
    }
    const nozzle = box(0.14, 0.22, 0.14, black, 0, 0.13, 0, 0.02);
    head.add(nozzle);
    stage.add(head);

    // 5. Robocoders: the lesson card for this robot.
    const card = mesh(new THREE.PlaneGeometry(1.6, 1.0), keep(new THREE.MeshBasicMaterial({ map: keep(lessonCard()), toneMapped: false, side: THREE.DoubleSide })));
    stage.add(card);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    let shown = 0;
    let last = performance.now();
    let onScreen = false;
    let raf = 0;
    // Nothing draws until every shader is compiled (in the background, below), so the
    // first frame never freezes the page compiling them.
    let ready = false;
    let disposed = false;
    const draw = (now: number) => {
      if (!ready) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = progress.current ?? 0;
      shown += (target - shown) * (reduced ? 1 : Math.min(1, dt * 6));
      const p = shown;

      // Camera circles the build.
      const dist = camera.aspect < 1 ? 13.5 : 11;
      const a = 0.95 - 1.7 * ease(clamp01(p / 5));
      camera.position.set(Math.sin(a) * dist, 3.9 + Math.sin(p * 0.6) * 0.3, Math.cos(a) * dist);
      camera.lookAt(0, 0.75, 0);

      // 1. Blueprint draws on, then fades as the shell is printed.
      const draw1 = win(p, 0.05, 0.85);
      bpEdges.setDrawRange(0, Math.floor(bpTotal * draw1 / 2) * 2);
      blueprint.opacity = 1 - win(p, 3.4, 3.95);
      for (const r of wheelRings) r.visible = draw1 > 0.6 && p < 3.2;
      dim.visible = draw1 > 0.9 && p < 3.4;
      gridMat.color.setHex(p < 1.2 ? 0x93c5fd : 0xcbd5e1);
      gridMat.opacity = 0.55 - 0.25 * win(p, 1, 2);

      // 2. Parts drop in.
      for (const pt of parts) {
        const t = win(p, pt.at, pt.at + 0.35);
        pt.o.visible = t > 0.001 && p < 3.95; // sealed inside once the shell is printed
        pt.o.position.set(pt.base.x, pt.base.y + (1 - t) * 1.6, pt.base.z);
        pt.o.scale.setScalar((pt.o === board ? 0.85 : pt.o === sensor ? 0.62 : 1) * (0.6 + 0.4 * t));
      }
      (shadow.material as THREE.MeshBasicMaterial).opacity = win(p, 1, 1.6);

      // 3. Code streams in, the screen types it out, the sensor wakes up.
      oled.visible = p > 1.95 && p < 3.95;
      oled.scale.setScalar(win(p, 1.95, 2.2) || 0.001);
      const chars = Math.round(PROGRAM_CHARS * win(p, 2.15, 2.85));
      if (chars !== typed) {
        typed = chars;
        drawProgram(chars);
      }
      for (const b of bits) {
        const t = clamp01((p - b.at) / 0.4);
        b.m.visible = t > 0 && t < 1;
        b.m.position.lerpVectors(b.from, boardAt, ease(t));
        b.m.rotation.set(t * 4, t * 6, 0);
      }
      traces.emissiveIntensity = 0.9 * win(p, 2.1, 2.6) * (1 - 0.6 * win(p, 3.4, 4));
      const awake = win(p, 2.55, 2.9);
      sonarMat.opacity = 0.09 * awake;
      rings.forEach((r, i) => {
        const age = reduced ? 0.4 : (now / 1100 + i / 3) % 1;
        r.scale.setScalar(1 + age * 3);
        (r.material as THREE.MeshBasicMaterial).opacity = awake * (1 - age) * 0.5;
      });

      // 4. Wheels slide on; the shell prints layer by layer.
      const wIn = win(p, 3.0, 3.35);
      for (const w of wheels) {
        const sx = w.userData.side as number;
        w.visible = wIn > 0.001;
        w.position.x = sx * (WHEEL_X + (1 - wIn) * 1.6);
      }
      const printT = clamp01((p - 3.3) / 0.65);
      const printH = -0.02 + 1.7 * printT;
      printPlane.constant = printH;
      shell.visible = printT > 0;
      head.visible = printT > 0 && printT < 1;
      head.position.y = printH;
      nozzle.position.x = reduced ? 0 : Math.sin(now / 160) * 0.9;
      nozzle.position.z = reduced ? 0 : Math.sin(now / 410) * 2;

      // 5. On the line track with its lesson.
      const teach = win(p, 4.05, 4.5);
      (tape.material as THREE.MeshBasicMaterial).opacity = teach;
      card.visible = teach > 0.001;
      card.scale.setScalar(teach || 0.001);
      card.position.set(-2.2, 1.9 + (reduced ? 0 : Math.sin(now / 1200) * 0.05), -0.6);
      card.lookAt(camera.position);
      const roll = !reduced && p > 4.2 ? dt * 4 : 0;
      for (const w of wheels) w.rotation.x += roll;

      renderer.render(scene, camera);
    };
    let lastFrame = 0;
    const loop = (now: number) => {
      if (now - lastFrame >= 1000 / 62) {
        if (lastFrame) dpr.tick(now - lastFrame);
        if (PERF && lastFrame) perfLog("build", renderer, now - lastFrame);
        lastFrame = now;
        draw(now);
      }
      raf = onScreen && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen) {
        last = performance.now();
        kick();
      }
    });
    io.observe(mount);
    const ro = new ResizeObserver(() => {
      resize();
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
    const compiling = renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
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
      // Free the GPU side only once any background compile has settled; three.js still touches it.
      compiling.finally(() => {
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
      });
      renderer.domElement.remove();
    };
  }, [progress, warm]);

  return (
    <div ref={mountRef} className={`ym-device relative ${className}`} role="img" aria-label="The RoboCoders robot car being built step by step as you scroll: blueprint, boards and sensors, code, wheels and a 3D-printed shell, then a lesson card.">
      <p className="ym-device-fallback">The RoboCoders car, built by each YugMinds company in turn.</p>
    </div>
  );
}
