import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CycleState, Phase } from '../lib/thermodynamics';

export class Engine3DRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animId = 0;

  private piston!: THREE.Mesh;
  private pistonRings: THREE.Mesh[] = [];
  private conrod!: THREE.Mesh;
  private crankPin!: THREE.Mesh;
  private crankArm!: THREE.Mesh;
  private crankShaft!: THREE.Mesh;
  private intakeValveStem!: THREE.Mesh;
  private intakeValveDisc!: THREE.Mesh;
  private exhaustValveStem!: THREE.Mesh;
  private exhaustValveDisc!: THREE.Mesh;
  private sparkPlug!: THREE.Mesh;
  private sparkFlash!: THREE.PointLight;
  private gasFill!: THREE.Mesh;
  private gasMaterial!: THREE.MeshPhysicalMaterial;

  // Kinematically consistent dimensions
  //   stroke = 2 * crankRadius
  //   At TDC (angle=0): wristPinY = crankCenterY + crankRadius + conrodLen
  //   At BDC (angle=π): wristPinY = crankCenterY - crankRadius + conrodLen
  private readonly cylRadius = 1.2;
  private readonly cylHeight = 4.0;
  private readonly pistonH = 0.6;
  private readonly crankRadius = 1.1;
  private readonly conrodLen = 3.0;
  // Place crank center so that piston top at TDC ≈ cylHeight/2 - 0.3
  // wristPinTDC = crankCenterY + R + L → pistonTopTDC ≈ wristPinTDC + pistonH/2 - 0.1
  // pistonTopTDC = crankCenterY + R + L + pistonH/2 - 0.1 = cylHeight/2 - 0.3
  // crankCenterY = cylHeight/2 - 0.3 - R - L - pistonH/2 + 0.1
  private readonly crankCenterY =
    4.0 / 2 - 0.3 - 1.1 - 3.0 - 0.6 / 2 + 0.1; // = -2.6

  private state: CycleState = { V: 1, P: 1, T: 300, phase: 'intake', phaseProgress: 0 };
  private tVal = 0;

  constructor(private container: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(5, 2, 5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, -0.5, 0);
    this.controls.minDistance = 4;
    this.controls.maxDistance = 16;

    this.setupLights();
    this.buildEngine();
    this.resize();

    window.addEventListener('resize', this.resize);
    this.loop();
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(4, 6, 3);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);
  }

  private buildEngine() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.7, roughness: 0.3 });

    // Cylinder walls
    const cylGeo = new THREE.CylinderGeometry(this.cylRadius, this.cylRadius, this.cylHeight, 32, 1, true);
    const cylMat = new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, metalness: 0.1, roughness: 0.05,
      transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(cylGeo, cylMat));

    // Cylinder head
    const headGeo = new THREE.CylinderGeometry(this.cylRadius + 0.15, this.cylRadius + 0.15, 0.25, 32);
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = this.cylHeight / 2 + 0.125;
    this.scene.add(head);

    // Piston
    const pistonGeo = new THREE.CylinderGeometry(this.cylRadius - 0.06, this.cylRadius - 0.06, this.pistonH, 32);
    this.piston = new THREE.Mesh(pistonGeo, new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.25 }));
    this.scene.add(this.piston);

    // Piston rings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(this.cylRadius - 0.04, 0.035, 8, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      this.pistonRings.push(ring);
      this.scene.add(ring);
    }

    // Wrist pin (child of piston)
    const wp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.2 }),
    );
    wp.rotation.z = Math.PI / 2;
    wp.position.y = -this.pistonH / 2 + 0.1;
    this.piston.add(wp);

    // Connecting rod — geometry length = conrodLen, origin at center
    this.conrod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, this.conrodLen, 8),
      new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7, roughness: 0.3 }),
    );
    this.scene.add(this.conrod);

    // Crankshaft main shaft
    this.crankShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 16), metalMat.clone());
    this.crankShaft.rotation.x = Math.PI / 2;
    this.crankShaft.position.y = this.crankCenterY;
    this.scene.add(this.crankShaft);

    // Crank arm
    this.crankArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, this.crankRadius, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.3 }),
    );
    this.scene.add(this.crankArm);

    // Crank pin
    const cpGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 12);
    cpGeo.rotateX(Math.PI / 2);
    this.crankPin = new THREE.Mesh(cpGeo, new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.8, roughness: 0.2 }));
    this.scene.add(this.crankPin);

    // Crankcase
    const caseH = this.crankRadius * 2 + 1.2;
    const crankcase = new THREE.Mesh(
      new THREE.CylinderGeometry(this.cylRadius + 0.3, this.cylRadius + 0.6, caseH, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x667788, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    crankcase.position.y = this.crankCenterY;
    this.scene.add(crankcase);

    // Valves
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const discGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });

    this.intakeValveStem = new THREE.Mesh(stemGeo, stemMat);
    this.intakeValveStem.position.set(-0.5, this.cylHeight / 2 + 0.6, 0);
    this.scene.add(this.intakeValveStem);
    this.intakeValveDisc = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 }));
    this.scene.add(this.intakeValveDisc);

    this.exhaustValveStem = new THREE.Mesh(stemGeo.clone(), stemMat);
    this.exhaustValveStem.position.set(0.5, this.cylHeight / 2 + 0.6, 0);
    this.scene.add(this.exhaustValveStem);
    this.exhaustValveDisc = new THREE.Mesh(discGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 }));
    this.scene.add(this.exhaustValveDisc);

    // Spark plug
    this.sparkPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.7, roughness: 0.3 }),
    );
    this.sparkPlug.position.set(0, this.cylHeight / 2 + 0.5, 0.4);
    this.scene.add(this.sparkPlug);

    this.sparkFlash = new THREE.PointLight(0xffcc00, 0, 4);
    this.sparkFlash.position.set(0, this.cylHeight / 2 - 0.3, 0);
    this.scene.add(this.sparkFlash);

    // Gas fill
    this.gasMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false,
    });
    this.gasFill = new THREE.Mesh(
      new THREE.CylinderGeometry(this.cylRadius - 0.1, this.cylRadius - 0.1, 1, 32),
      this.gasMaterial,
    );
    this.scene.add(this.gasFill);

    // PMS / PMI reference lines and labels
    const wristPinTDC = this.crankCenterY + this.crankRadius + this.conrodLen;
    const pistonTopTDC = wristPinTDC + this.pistonH / 2 - 0.1;
    const wristPinBDC = this.crankCenterY - this.crankRadius + this.conrodLen;
    const pistonTopBDC = wristPinBDC + this.pistonH / 2 - 0.1;

    this.addRefRing(pistonTopTDC, 'PMS');
    this.addRefRing(pistonTopBDC, 'PMI');
  }

  private addRefRing(y: number, label: string) {
    const segments = 64;
    const r = this.cylRadius + 0.25;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x999999, dashSize: 0.15, gapSize: 0.1 });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    this.scene.add(line);

    const sprite = makeTextSprite(label);
    sprite.position.set(r + 0.35, y, 0);
    this.scene.add(sprite);
  }

  update(state: CycleState, t: number) {
    this.state = state;
    this.tVal = t;
  }

  private updatePositions() {
    const { phase, phaseProgress } = this.state;
    const t = this.tVal;

    // --- Crank kinematics (Y-up coordinate system) ---
    // angle=0 → crank pin at TOP of circle (closest to piston) → piston at TDC
    const crankAngle = t * 4 * Math.PI;
    const cpX = Math.sin(crankAngle) * this.crankRadius;
    const cpY = this.crankCenterY + Math.cos(crankAngle) * this.crankRadius;

    // Wrist pin: constrained to x=0, connected to crank pin by rod of fixed length
    // conrodLen² = cpX² + (wristPinY - cpY)²  →  wristPinY = cpY + √(L² - cpX²)
    const wristPinY = cpY + Math.sqrt(this.conrodLen * this.conrodLen - cpX * cpX);

    // Piston center: wrist pin sits at pistonH/2 - 0.1 below piston center
    const pistonY = wristPinY + this.pistonH / 2 - 0.1;

    this.piston.position.y = pistonY;

    // Piston rings
    for (let i = 0; i < 3; i++) {
      this.pistonRings[i].position.set(0, pistonY + this.pistonH / 2 - 0.1 - i * 0.15, 0);
    }

    // Crank pin
    this.crankPin.position.set(cpX, cpY, 0);

    // Crank arm: connects crank center to crank pin
    this.crankArm.position.set(cpX / 2, (this.crankCenterY + cpY) / 2, 0);
    this.crankArm.rotation.z = -crankAngle;

    // Connecting rod: connects crank pin (cpX, cpY) to wrist pin (0, wristPinY)
    // Length is always conrodLen — no scaling needed
    const conrodMidX = cpX / 2;
    const conrodMidY = (cpY + wristPinY) / 2;
    const conrodAngle = Math.atan2(cpX, wristPinY - cpY);

    this.conrod.position.set(conrodMidX, conrodMidY, 0);
    this.conrod.rotation.z = conrodAngle;
    this.conrod.scale.y = 1; // never scale

    // Valves
    const intakeOffset = phase === 'intake' ? -0.4 : 0;
    const exhaustOffset = phase === 'exhaust' ? -0.4 : 0;
    this.intakeValveStem.position.y = this.cylHeight / 2 + 0.6 + intakeOffset;
    this.intakeValveDisc.position.set(-0.5, this.cylHeight / 2 + intakeOffset, 0);
    this.exhaustValveStem.position.y = this.cylHeight / 2 + 0.6 + exhaustOffset;
    this.exhaustValveDisc.position.set(0.5, this.cylHeight / 2 + exhaustOffset, 0);

    // Spark
    this.sparkFlash.intensity = (phase === 'power' && phaseProgress < 0.08) ? 8 : 0;

    // Gas fill
    const gasTop = this.cylHeight / 2 - 0.15;
    const gasBottom = pistonY + this.pistonH / 2 + 0.02;
    const gasH = Math.max(0.01, gasTop - gasBottom);
    this.gasFill.scale.y = gasH;
    this.gasFill.position.y = gasBottom + gasH / 2;

    switch (phase) {
      case 'intake':
        this.gasMaterial.color.setHex(0x3b82f6);
        this.gasMaterial.opacity = 0.12 + phaseProgress * 0.08;
        break;
      case 'compression':
        this.gasMaterial.color.setHex(lerpColor(0xf59e0b, 0xff6600, phaseProgress));
        this.gasMaterial.opacity = 0.15 + phaseProgress * 0.2;
        break;
      case 'power':
        if (phaseProgress < 0.1) {
          this.gasMaterial.color.setHex(0xff2200);
          this.gasMaterial.opacity = 0.4;
        } else {
          this.gasMaterial.color.setHex(lerpColor(0xff4400, 0xcc8855, (phaseProgress - 0.1) / 0.9));
          this.gasMaterial.opacity = 0.35 - phaseProgress * 0.2;
        }
        break;
      case 'exhaust':
        this.gasMaterial.color.setHex(0x887766);
        this.gasMaterial.opacity = 0.1 * (1 - phaseProgress);
        break;
    }
  }

  private resize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    this.animId = requestAnimationFrame(this.loop);
    this.updatePositions();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

function makeTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 28px Roboto, sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.0, 0.375, 1);
  return sprite;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
