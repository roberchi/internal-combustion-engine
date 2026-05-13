import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CycleState, Phase } from '../lib/thermodynamics';

const PHASE_COLORS_HEX: Record<Phase, number> = {
  intake: 0x3b82f6,
  compression: 0xf59e0b,
  power: 0xef4444,
  exhaust: 0x8b5cf6,
};

export class Engine3DRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animId = 0;

  // Engine parts
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
  private cylinderWalls!: THREE.Mesh;

  // Dimensions
  private readonly cylRadius = 1.2;
  private readonly cylHeight = 4.0;
  private readonly pistonH = 0.6;
  private readonly strokeLen = 2.2;
  private readonly tdcY: number;
  private readonly crankRadius = 1.1;
  private readonly conrodLen = 2.4;
  private readonly crankCenterY: number;

  private state: CycleState = { V: 1, P: 1, T: 300, phase: 'intake', phaseProgress: 0 };
  private tVal = 0;

  constructor(private container: HTMLDivElement) {
    this.tdcY = this.cylHeight / 2 - 0.3;
    this.crankCenterY = -this.cylHeight / 2 - 1.6;

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
    this.controls.target.set(0, 0, 0);
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
    // Cylinder walls — transparent glass
    const cylGeo = new THREE.CylinderGeometry(this.cylRadius, this.cylRadius, this.cylHeight, 32, 1, true);
    const cylMat = new THREE.MeshPhysicalMaterial({
      color: 0x88aacc,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cylinderWalls = new THREE.Mesh(cylGeo, cylMat);
    this.scene.add(this.cylinderWalls);

    // Cylinder head (top cap)
    const headGeo = new THREE.CylinderGeometry(this.cylRadius + 0.15, this.cylRadius + 0.15, 0.25, 32);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.7, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = this.cylHeight / 2 + 0.125;
    this.scene.add(head);

    // Piston
    const pistonGeo = new THREE.CylinderGeometry(this.cylRadius - 0.06, this.cylRadius - 0.06, this.pistonH, 32);
    const pistonMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.25 });
    this.piston = new THREE.Mesh(pistonGeo, pistonMat);
    this.scene.add(this.piston);

    // Piston rings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(this.cylRadius - 0.04, 0.035, 8, 32);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      this.pistonRings.push(ring);
      this.scene.add(ring);
    }

    // Wrist pin
    const wpGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 12);
    const wpMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.2 });
    const wristPin = new THREE.Mesh(wpGeo, wpMat);
    wristPin.rotation.z = Math.PI / 2;
    this.piston.add(wristPin);
    wristPin.position.y = -this.pistonH / 2 + 0.1;

    // Connecting rod
    const conrodGeo = new THREE.CylinderGeometry(0.1, 0.12, this.conrodLen, 8);
    const conrodMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7, roughness: 0.3 });
    this.conrod = new THREE.Mesh(conrodGeo, conrodMat);
    this.scene.add(this.conrod);

    // Crankshaft main shaft
    const shaftGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.5, 16);
    this.crankShaft = new THREE.Mesh(shaftGeo, metalMat.clone());
    this.crankShaft.rotation.z = Math.PI / 2;
    this.crankShaft.position.y = this.crankCenterY;
    this.scene.add(this.crankShaft);

    // Crank arm
    const armGeo = new THREE.BoxGeometry(0.25, this.crankRadius, 0.5);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.3 });
    this.crankArm = new THREE.Mesh(armGeo, armMat);
    this.scene.add(this.crankArm);

    // Crank pin
    const cpGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 12);
    cpGeo.rotateZ(Math.PI / 2);
    const cpMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.8, roughness: 0.2 });
    this.crankPin = new THREE.Mesh(cpGeo, cpMat);
    this.scene.add(this.crankPin);

    // Crankcase outline
    const caseGeo = new THREE.CylinderGeometry(this.cylRadius + 0.3, this.cylRadius + 0.6, 2.0, 32, 1, true);
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x667788,
      metalness: 0.5,
      roughness: 0.4,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const crankcase = new THREE.Mesh(caseGeo, caseMat);
    crankcase.position.y = this.crankCenterY;
    this.scene.add(crankcase);

    // Valves
    const valveStemGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const valveDiscGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
    const intakeValveMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.3 });
    const exhaustValveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });

    this.intakeValveStem = new THREE.Mesh(valveStemGeo, stemMat);
    this.intakeValveStem.position.set(-0.5, this.cylHeight / 2 + 0.6, 0);
    this.scene.add(this.intakeValveStem);
    this.intakeValveDisc = new THREE.Mesh(valveDiscGeo, intakeValveMat);
    this.scene.add(this.intakeValveDisc);

    this.exhaustValveStem = new THREE.Mesh(valveStemGeo.clone(), stemMat);
    this.exhaustValveStem.position.set(0.5, this.cylHeight / 2 + 0.6, 0);
    this.scene.add(this.exhaustValveStem);
    this.exhaustValveDisc = new THREE.Mesh(valveDiscGeo.clone(), exhaustValveMat);
    this.scene.add(this.exhaustValveDisc);

    // Spark plug
    const spBodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const spMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.7, roughness: 0.3 });
    this.sparkPlug = new THREE.Mesh(spBodyGeo, spMat);
    this.sparkPlug.position.set(0, this.cylHeight / 2 + 0.5, 0.4);
    this.scene.add(this.sparkPlug);

    // Spark flash light
    this.sparkFlash = new THREE.PointLight(0xffcc00, 0, 4);
    this.sparkFlash.position.set(0, this.tdcY, 0);
    this.scene.add(this.sparkFlash);

    // Gas fill volume (cylinder inside)
    const gasGeo = new THREE.CylinderGeometry(this.cylRadius - 0.1, this.cylRadius - 0.1, 1, 32);
    this.gasMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.gasFill = new THREE.Mesh(gasGeo, this.gasMaterial);
    this.scene.add(this.gasFill);
  }

  update(state: CycleState, t: number) {
    this.state = state;
    this.tVal = t;
  }

  private updatePositions() {
    const { phase, phaseProgress } = this.state;
    const t = this.tVal;

    // Piston position
    const pistonFrac = this.pistonPosition(t);
    const pistonY = this.tdcY - pistonFrac * this.strokeLen;
    this.piston.position.y = pistonY;

    // Piston rings
    for (let i = 0; i < 3; i++) {
      this.pistonRings[i].position.set(0, pistonY + this.pistonH / 2 - 0.1 - i * 0.15, 0);
    }

    // Crank angle
    const crankAngle = t * 4 * Math.PI;
    const cpX = Math.sin(crankAngle) * this.crankRadius;
    const cpY = this.crankCenterY - Math.cos(crankAngle) * this.crankRadius;

    this.crankPin.position.set(cpX, cpY, 0);

    // Crank arm
    this.crankArm.position.set(cpX / 2, (this.crankCenterY + cpY) / 2, 0);
    this.crankArm.rotation.z = Math.atan2(cpX, -(cpY - this.crankCenterY));
    this.crankArm.scale.y = Math.sqrt(cpX * cpX + (cpY - this.crankCenterY) ** 2) / this.crankRadius;

    // Connecting rod
    const wristY = pistonY - this.pistonH / 2 + 0.1;
    const midX = cpX / 2;
    const midY = (wristY + cpY) / 2;
    const rodLen = Math.sqrt(cpX * cpX + (wristY - cpY) ** 2);
    const rodAngle = Math.atan2(cpX, -(cpY - wristY));

    this.conrod.position.set(midX, midY, 0);
    this.conrod.rotation.z = rodAngle;
    this.conrod.scale.y = rodLen / this.conrodLen;

    // Valves
    const intakeOpen = phase === 'intake';
    const exhaustOpen = phase === 'exhaust';
    const intakeOffset = intakeOpen ? -0.4 : 0;
    const exhaustOffset = exhaustOpen ? -0.4 : 0;

    this.intakeValveStem.position.y = this.cylHeight / 2 + 0.6 + intakeOffset;
    this.intakeValveDisc.position.set(-0.5, this.cylHeight / 2 + intakeOffset, 0);
    this.exhaustValveStem.position.y = this.cylHeight / 2 + 0.6 + exhaustOffset;
    this.exhaustValveDisc.position.set(0.5, this.cylHeight / 2 + exhaustOffset, 0);

    // Spark flash
    const firing = phase === 'power' && phaseProgress < 0.08;
    this.sparkFlash.intensity = firing ? 8 : 0;

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

  private pistonPosition(t: number): number {
    const tc = ((t % 1) + 1) % 1;
    const pi = Math.min(3, Math.floor(tc * 4));
    const pt = (tc * 4) - pi;
    switch (pi) {
      case 0: return pt;
      case 1: return 1 - pt;
      case 2: return pt;
      case 3: return 1 - pt;
      default: return 0;
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

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bv;
}
