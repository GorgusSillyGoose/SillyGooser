import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createDialogSystem } from "./js/dialog.js";
import { createArcadeMenu } from "./js/arcadeMenu.js";
import { createMemoryBook } from "./js/memoryBook.js";
import { finishIntro, initEggIntro, handleIntroEnter, initIntroCamera, handleIntroControlInput, showIntroControlHints } from "./js/intro.js";

const leavesVS = /*glsl*/`
    uniform sampler2D uNoiseMap;
    uniform vec3 uBoxMin, uBoxSize, uRaycast;
    uniform float uTime;
    varying vec3 vObjectPos, vNormal, vWorldNormal; 
    varying float vCloseToGround;
    
    vec4 getTriplanar(sampler2D tex){
        vec4 xPixel = texture(tex, (vObjectPos.xy + uTime) / 3.);
        vec4 yPixel = texture(tex, (vObjectPos.yz + uTime) / 3.);
        vec4 zPixel = texture(tex, (vObjectPos.zx + uTime) / 3.);
        vec4 combined = (xPixel + yPixel + zPixel) / 6.0;
        combined.xyz = combined.xyz * vObjectPos; 
        return combined;
    }
    
    void main(){
        mat4 mouseDisplace = mat4(1.);
        vec3 vWorldPos = vec3(modelMatrix * instanceMatrix * mouseDisplace * vec4(position, 1.));
        vCloseToGround = clamp(vWorldPos.y, 0., 1.);
        float offset = clamp(0.8 - distance(uRaycast, instanceMatrix[3].xyz), 0., 999.); 
        offset = (pow(offset, 0.8) / 2.0) * vCloseToGround;
        mouseDisplace[3].xyz = vec3(offset);
        vNormal = normalMatrix * mat3(instanceMatrix) * mat3(mouseDisplace) * normalize(normal); 
        vWorldNormal = vec3(modelMatrix * instanceMatrix * mouseDisplace * vec4(normal, 0.));
        vObjectPos = ((vWorldPos - uBoxMin) * 2.) / uBoxSize - vec3(1.0); 
        vec4 noiseOffset = getTriplanar(uNoiseMap) * vCloseToGround; 
        vec4 newPos = instanceMatrix * mouseDisplace * vec4(position, 1.); 
        newPos.xyz = newPos.xyz + noiseOffset.xyz;
        gl_Position =  projectionMatrix * modelViewMatrix * newPos;
    }
`
const leavesFS = /*glsl*/`
    #include <common> 
    #include <lights_pars_begin>
    uniform vec3 uColorA, uColorB, uColorC;
    uniform float uTime;
    varying vec3 vObjectPos, vNormal, vWorldNormal; 
    varying float vCloseToGround;
    
    vec3 mix3 (vec3 v1, vec3 v2, vec3 v3, float fa){
        vec3 m; 
        fa > 0.7 ? m = mix(v2, v3, (fa - .5) * 2.) : m = mix(v1, v2, fa * 2.);
        return m;
    }

    float getPosColors(){
        float p = 0.;
        p = smoothstep(0.2, 0.8, distance(vec3(0.), vObjectPos));
        p = p * (-(vWorldNormal.g / 2.) + 0.5) * (- vObjectPos.y / 9. + 0.5); 
        return p;
    }
    float getDiffuse(){
        float intensity;
        for (int i = 0; i < directionalLights.length(); i++){
            intensity = dot(directionalLights[i].direction, vNormal);
            intensity = smoothstep(0.55, 1., intensity) * 0.2 
                        + pow(smoothstep(0.55, 1., intensity), 0.5);
        }
        return intensity;
    }

    void main(){
        float gradMap = (getPosColors() + getDiffuse()) * vCloseToGround / 2. ;
        vec4 c = vec4(mix3(uColorA, uColorB, uColorC, gradMap), 1.0);
        gl_FragColor = vec4(pow(c.xyz,vec3(0.454545)), c.w);
				//gl_FragColor = vec4(c.xyz, c.w);
    }
`

// GENERAL DEFINITIONS
const scene = new THREE.Scene();
const loader = new GLTFLoader();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth/window.innerHeight, 0.001, 1000);
const renderer = new THREE.WebGLRenderer({alpha: true});
const controls = new OrbitControls(camera, renderer.domElement);
const dummy = new THREE.Object3D();
const matrix = new THREE.Matrix4();
const pointer = new THREE.Vector2(); 
const raycaster = new THREE.Raycaster();
const dlight01 = new THREE.DirectionalLight(0xcccccc, 1.8);
const tree = {group: new THREE.Group()};
const bench = {group: new THREE.Group(), ready: false};
const DEBUG_SKIP_DIALOG = true;
const DEBUG_SHOW_CAMERA = false;
const GOOSE_START_TURN_OFFSET = -12 * Math.PI / 180;
const GOOSE_HEIGHT_OFFSET = -0.14;
const TALK_DISTANCE = 1.25;
const benchTalkAnchor = new THREE.Object3D();
const nest = { group: new THREE.Group(), ready: false };
const gramophone = { group: new THREE.Group(), ready: false };
const arcade = { group: new THREE.Group(), ready: false };
const dog = {
  group: new THREE.Group(),
  ready: false,
  mixer: null,
  action: null,
};
const gooseJumpSound = new Audio("./assets/Audio/Goose.mp3");
gooseJumpSound.preload = "auto";
gooseJumpSound.volume = 0.85;
const goose = {
  group: new THREE.Group(),
  mixer: null,
  actions: {},
  currentAction: null,
  sittingAction: null,
  preSitWorldPosition: new THREE.Vector3(),
  preSitWorldQuaternion: new THREE.Quaternion(),
  preSitHeading: 0,
  preSitGroundY: 0,
  moveVelocity: 0,
  turnVelocity: 0,
  heading: 0,
  verticalVelocity: 0,
  groundY: 0,
  isJumping: false,
  isSitting: false,
  followActive: false,
  walkTilt: 0,
  pendingIntroJump: false,
  pendingIntroSpin: false,
  returningHome: false,
  returnTarget: new THREE.Vector3(),
  returnFacingTarget: null,
  returnSpeed: 2.0,
};
function placeGooseAtNestStart() {
  if (!goose.group || !nest.ready || !nest.group) return;

  goose.group.position.copy(nest.group.position);
  goose.group.position.y = nest.group.position.y + 0.02 + GOOSE_HEIGHT_OFFSET;
  goose.heading = nest.group.rotation.y + Math.PI + GOOSE_START_TURN_OFFSET;
  goose.group.rotation.set(0, goose.heading, 0);
  goose.groundY = goose.group.position.y;
  goose.preSitWorldPosition.copy(goose.group.position);
  goose.preSitWorldQuaternion.copy(goose.group.quaternion);
  goose.preSitHeading = goose.heading;

  if (window.__introBlocking) {
    initIntroCamera();
  }
}
const clock = new THREE.Clock();
const dialogSystem = createDialogSystem({
  talkDistance: TALK_DISTANCE,
  camera,
  debugSkipDialog: DEBUG_SKIP_DIALOG,
});
let memoryBook = createMemoryBook();
const arcadeMenu = createArcadeMenu({
  onOpen: () => {
    arcadeControlsWasEnabled = controls.enabled;
    controls.enabled = false;
    if (goose.group) {
      goose.group.userData.arcadeMenuOpen = true;
      controls.target.copy(goose.group.position);
    }
    document.body.classList.add("arcade-menu-open");
  },
  onClose: () => {
    if (goose.group) {
      goose.group.userData.arcadeMenuOpen = false;
      controls.target.copy(goose.group.position);
    }
    document.body.classList.remove("arcade-menu-open");
    controls.enabled = arcadeControlsWasEnabled;
    if (goose.actions.idle) {
      switchGooseAction("idle");
    }
  },
});
const tmpVector = new THREE.Vector3();
const tmpVector2 = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);
const MAX_FALLING_LEAVES = 35;
const MAX_GROUND_LEAVES = 150;
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  arrowup: false,
  arrowleft: false,
  arrowdown: false,
  arrowright: false,
};
let cameraDebugEl = null;
let arcadeControlsWasEnabled = true;
const RENDER_PIXEL_RATIO = 1;
const textureLoader = new THREE.TextureLoader();
const PROJECTED_SHADOW_COLOR = 0x080516;
const PROJECTED_SHADOW_GROUND_Y = -0.033;
const PROJECTED_SHADOW_LIGHT = new THREE.Vector3(3, 6, -3);
const GROUND_GRASS_RADIUS = 5.45;
const GROUND_GRASS_MIN_RADIUS = 0.9;
const GRASS_SPRITE_ASSETS = [
  "Grass_Sprite_1.png",
  "Grass_Sprite_2.png",
  "Grass_Sprite_3.png",
  "Grass_Sprite_4.png",
  "Grass_Sprite_5.png",
  "Grass_Sprite_6.png",
  "Grass_Sprite_7.png",
  "Grass_Sprite_8.png",
  "Grass_Sprite_9.png",
  "Grass_Sprite_10.png",
];
const SCENE_TUNING = {
  bushes: {
    center: new THREE.Vector3(0, 0, 0),
    fadeStart: 0.18,
    fadeEnd: 0.68,
    layers: [
      {
        name: "back",
        radius: 6,
        count: 17,
        scale: 1.86,
        y: 0.34,
        opacity: 0.37,
        angleOffset: 0.05,
        assets: ["bg_bush_back_01.png", "bg_bush_back_02.png", "bg_bush_back_03.png"],
      },
      {
        name: "mid",
        radius: 5.8,
        count: 15,
        scale: 1.54,
        y: 0.26,
        opacity: 0.52,
        angleOffset: 0.21,
        assets: ["bg_bush_mid_01.png", "bg_bush_mid_02.png", "bg_bush_mid_03.png"],
      },
      {
        name: "front",
        radius: 5.6,
        count: 14,
        scale: 1.18,
        y: 0.13,
        opacity: 0.6,
        angleOffset: -0.14,
        assets: ["bg_bush_front_01.png", "bg_bush_front_02.png", "bg_bush_front_03.png"],
      },
    ],
  },
};
const tmpBushViewDirection = new THREE.Vector3();
const tmpProjectedShadowWorld = new THREE.Vector3();
const tmpProjectedShadowCenter = new THREE.Vector3();
const tmpProjectedShadowPerp = new THREE.Vector3();
const tmpProjectedShadowVertex = new THREE.Vector3();
let bushRing = null;
let groundGrassLayer = new THREE.Group();
const groundShadowLayer = new THREE.Group();
const projectedModelShadows = [];

function createProjectedShadowMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: PROJECTED_SHADOW_COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function collectShadowMeshes(sourceObject, sourceMeshes) {
  if (sourceMeshes?.length) {
    return sourceMeshes.filter((child) => child?.isMesh && child.geometry?.attributes?.position);
  }

  const meshes = [];
  sourceObject.traverse((child) => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      meshes.push(child);
    }
  });
  return meshes;
}

function createProjectedShadowGeometry(sourceMesh) {
  const sourcePosition = sourceMesh.geometry.attributes.position;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sourcePosition.count * 3), 3));

  if (sourceMesh.geometry.index) {
    geometry.setIndex(sourceMesh.geometry.index.clone());
  }

  return geometry;
}

function projectShadowGeometry(entry, shadowPart, expand = 1) {
  const { sourceMesh, sourcePosition, geometry } = shadowPart;
  const targetPosition = geometry.attributes.position;
  const {
    flatness,
    scaleX,
    groundY,
  } = entry;
  const shadowY = groundY + entry.yBias;
  let centerX = 0;
  let centerZ = 0;
  const count = sourcePosition.count;

  sourceMesh.updateMatrixWorld(true);

  for (let i = 0; i < count; i++) {
    tmpProjectedShadowVertex.fromBufferAttribute(sourcePosition, i).applyMatrix4(sourceMesh.matrixWorld);
    const flattenedY = shadowY + (tmpProjectedShadowVertex.y - shadowY) * (1 - flatness);
    const denom = flattenedY - PROJECTED_SHADOW_LIGHT.y;
    const t = Math.abs(denom) < 0.0001 ? 0 : (shadowY - PROJECTED_SHADOW_LIGHT.y) / denom;
    const x = PROJECTED_SHADOW_LIGHT.x + (tmpProjectedShadowVertex.x - PROJECTED_SHADOW_LIGHT.x) * t;
    const z = PROJECTED_SHADOW_LIGHT.z + (tmpProjectedShadowVertex.z - PROJECTED_SHADOW_LIGHT.z) * t;

    targetPosition.setXYZ(i, x, shadowY, z);
    centerX += x;
    centerZ += z;
  }

  centerX /= count || 1;
  centerZ /= count || 1;

  if (scaleX !== 1 || expand !== 1) {
    const direction = entry.castDirection;
    tmpProjectedShadowPerp.set(-direction.z, 0, direction.x);
    for (let i = 0; i < count; i++) {
      const x = targetPosition.getX(i);
      const z = targetPosition.getZ(i);
      const dx = x - centerX;
      const dz = z - centerZ;
      const along = dx * direction.x + dz * direction.z;
      const across = dx * tmpProjectedShadowPerp.x + dz * tmpProjectedShadowPerp.z;
      const widenedAcross = across * scaleX * expand;
      const stretchedAlong = along * expand;

      targetPosition.setXYZ(
        i,
        centerX + direction.x * stretchedAlong + tmpProjectedShadowPerp.x * widenedAcross,
        shadowY,
        centerZ + direction.z * stretchedAlong + tmpProjectedShadowPerp.z * widenedAcross
      );
    }
  }

  targetPosition.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateProjectedModelShadow(entry) {
  if (!entry?.sourceObject) return;

  entry.sourceObject.updateMatrixWorld(true);
  entry.sourceObject.getWorldPosition(tmpProjectedShadowWorld);
  tmpProjectedShadowCenter.copy(tmpProjectedShadowWorld).sub(PROJECTED_SHADOW_LIGHT);
  tmpProjectedShadowCenter.y = 0;
  if (tmpProjectedShadowCenter.lengthSq() < 0.0001) {
    tmpProjectedShadowCenter.set(1, 0, 0);
  }
  tmpProjectedShadowCenter.normalize();
  entry.castDirection.copy(tmpProjectedShadowCenter);

  for (const shadowPart of entry.parts) {
    projectShadowGeometry(entry, shadowPart, 1);
    if (shadowPart.featherGeometry) {
      projectShadowGeometry(
        entry,
        {
          ...shadowPart,
          geometry: shadowPart.featherGeometry,
        },
        1 + entry.blur * 0.018
      );
    }
  }
}

function setProjectedModelShadowOpacity(shadowGroup, opacity) {
  const entry = shadowGroup?.userData?.projectedModelShadow;
  if (!entry) return;

  entry.material.opacity = opacity;
  entry.featherMaterial.opacity = opacity * 0.28;
}

function createProjectedModelShadow({
  sourceObject,
  sourceMeshes = null,
  opacity = 0.35,
  blur = 3,
  flatness = 0.28,
  length = 0.58,
  scaleX = 1,
  rotation = 0,
  skew = -8,
  yBias = 0,
  groundY = PROJECTED_SHADOW_GROUND_Y,
  renderOrder = -2,
  dynamic = false,
} = {}) {
  const meshes = collectShadowMeshes(sourceObject, sourceMeshes);
  if (!sourceObject || !meshes.length) return null;

  const group = new THREE.Group();
  const material = createProjectedShadowMaterial(opacity);
  const featherMaterial = createProjectedShadowMaterial(opacity * 0.28);
  const entry = {
    sourceObject,
    group,
    parts: [],
    opacity,
    blur,
    flatness,
    length,
    scaleX,
    rotation: rotation * Math.PI / 180,
    skew: skew * Math.PI / 180,
    yBias,
    groundY,
    dynamic,
    material,
    featherMaterial,
    castDirection: new THREE.Vector3(1, 0, 0),
  };

  for (const sourceMesh of meshes) {
    const geometry = createProjectedShadowGeometry(sourceMesh);
    const shadowMesh = new THREE.Mesh(geometry, material);
    shadowMesh.renderOrder = renderOrder;
    shadowMesh.frustumCulled = false;
    group.add(shadowMesh);

    const part = {
      sourceMesh,
      sourcePosition: sourceMesh.geometry.attributes.position,
      geometry,
    };

    if (blur > 0) {
      const featherGeometry = createProjectedShadowGeometry(sourceMesh);
      const featherMesh = new THREE.Mesh(featherGeometry, featherMaterial);
      featherMesh.renderOrder = renderOrder - 1;
      featherMesh.frustumCulled = false;
      group.add(featherMesh);
      part.featherGeometry = featherGeometry;
    }

    entry.parts.push(part);
  }

  group.userData.projectedModelShadow = entry;
  groundShadowLayer.add(group);
  updateProjectedModelShadow(entry);

  if (dynamic) {
    projectedModelShadows.push(entry);
  }

  return group;
}

function createSeededRandom(seed) {
  let t = seed >>> 0;
  return function seededRandom() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createGrassSprite(texture, {
  x = 0,
  y = -0.065,
  z = 0,
  scale = 0.6,
  opacity = 1,
  renderOrder = -9,
} = {}) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    alphaTest: 0.02,
  });

  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.position.set(x, y, z);
  sprite.renderOrder = renderOrder;
  sprite.frustumCulled = false;
  sprite.scale.set(scale, scale, 1);
  material.map.needsUpdate = true;
  material.needsUpdate = true;
  return sprite;
}

function createGroundGrassLayer() {
  const group = new THREE.Group();
  const rng = createSeededRandom(1919);
  const basePath = "./assets/textures/Grass_sprites/";

  GRASS_SPRITE_ASSETS.forEach((asset, index) => {
    const angle = rng() * Math.PI * 2;
    const radius = GROUND_GRASS_MIN_RADIUS + Math.sqrt(rng()) * (GROUND_GRASS_RADIUS - GROUND_GRASS_MIN_RADIUS);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = 0.70 + rng() * 0.24;
    const opacity = 0.86 + rng() * 0.12;
    let sprite = null;
    const texture = textureLoader.load(`${basePath}${asset}`, () => {
      const image = texture.image;
      if (!sprite || !image?.width || !image?.height) return;
      const aspect = image.width / image.height;
      sprite.scale.set(scale * Math.max(0.55, Math.min(1.1, aspect)), scale, 1);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    sprite = createGrassSprite(texture, {
      x,
      z,
      scale,
      opacity,
      renderOrder: -9 - (index % 2),
    });

    group.add(sprite);
  });

  group.position.y = 0;
  return group;
}

function formatVector(vector) {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function createBushRing() {
  const group = new THREE.Group();
  const sprites = [];
  const basePath = "./assets/textures/Bush_Sprites/"; 

  SCENE_TUNING.bushes.layers.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i++) {
      const asset = layer.assets[i % layer.assets.length];
      const texture = textureLoader.load(`${basePath}${asset}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.anisotropy = 1;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      });

      const angle = layer.angleOffset + (i / layer.count) * Math.PI * 2;
      const radiusJitter = 1 + (((i * 37 + layerIndex * 13) % 17) - 8) * 0.004;
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
      const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

      sprite.position
        .copy(SCENE_TUNING.bushes.center)
        .addScaledVector(radial, layer.radius * radiusJitter);

      sprite.position.y = layer.y + ((i % 3) - 1) * 0.025;

      const scaleJitter = 0.9 + ((i * 19 + layerIndex * 7) % 9) * 0.025;
      sprite.scale.set(layer.scale * scaleJitter, layer.scale * 0.7 * scaleJitter, 1);
      sprite.lookAt(SCENE_TUNING.bushes.center.x, sprite.position.y, SCENE_TUNING.bushes.center.z);
      sprite.renderOrder = -7 - layerIndex;

      sprite.userData.bush = {
        radial,
        baseOpacity: layer.opacity,
        layerIndex,
      };

      group.add(sprite);
      sprites.push(sprite);
    }
  });

  group.userData.sprites = sprites;
  return group;
}

function updateBushVisibility(delta = 0.016) {
  if (!bushRing?.userData?.sprites) return;

  tmpBushViewDirection.copy(SCENE_TUNING.bushes.center).sub(camera.position);
  tmpBushViewDirection.y = 0;
  if (tmpBushViewDirection.lengthSq() < 0.0001) return;
  tmpBushViewDirection.normalize();

  for (const sprite of bushRing.userData.sprites) {
    const dot = sprite.userData.bush.radial.dot(tmpBushViewDirection);
    const fade = smoothstep(SCENE_TUNING.bushes.fadeStart, SCENE_TUNING.bushes.fadeEnd, dot);
    const layerDepth = sprite.userData.bush.layerIndex === 0 ? 0.58 : sprite.userData.bush.layerIndex === 1 ? 0.78 : 1.0;
    const opacity = sprite.userData.bush.baseOpacity * fade * layerDepth;

    sprite.material.opacity = THREE.MathUtils.damp(sprite.material.opacity, opacity, 8, Math.min(delta, 0.033));
    sprite.visible = sprite.material.opacity > 0.006;
  }
}

function playGooseJumpSound() {
  try {
    gooseJumpSound.currentTime = 0;
    const playPromise = gooseJumpSound.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore playback errors when the browser blocks audio.
  }
}

function setGooseIntroPose() {
  if (!goose.group) return;

  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;
  goose.isJumping = false;
  goose.followActive = false;

  if (goose.actions.sit) {
    switchGooseAction("sit");
    goose.sittingAction = goose.actions.sit;
    return;
  }

  if (goose.actions.idle) {
    switchGooseAction("idle");
    goose.sittingAction = goose.actions.idle;
  }
}

function startGooseIntroJump() {
  if (!goose.group || !goose.actions.jump) {
    goose.pendingIntroJump = true;
    return false;
  }

  if (goose.currentAction === goose.actions.jump) {
    goose.pendingIntroJump = false;
    return true;
  }

  goose.pendingIntroJump = false;
  playGooseJumpSound();
  if (goose.mixer) {
    const onJumpFinished = (event) => {
      if (event.action !== goose.actions.jump) return;
      goose.mixer.removeEventListener("finished", onJumpFinished);
      startGooseIntroSpin();
    };

    goose.mixer.addEventListener("finished", onJumpFinished);
  }

  switchGooseAction("jump");
  goose.actions.jump.reset().play();
  goose.actions.jump.timeScale = 1.25;
  return true;
}

function startGooseIntroSpin() {
  if (!goose.group || !goose.actions.spin) {
    finishIntro();
    return false;
  }

  if (goose.currentAction === goose.actions.spin) {
    goose.pendingIntroSpin = false;
    return true;
  }

  goose.pendingIntroSpin = false;
  if (goose.mixer) {
    const onSpinFinished = (event) => {
      if (event.action !== goose.actions.spin) return;
      goose.mixer.removeEventListener("finished", onSpinFinished);
      if (goose.actions.idle) {
        switchGooseAction("idle");
      }
      finishIntro();
    };

    goose.mixer.addEventListener("finished", onSpinFinished);
  }

  switchGooseAction("spin");
  goose.actions.spin.reset().play();
  goose.actions.spin.timeScale = 1.0;
  return true;
}

function updateCameraDebugOverlay() {
  if (!DEBUG_SHOW_CAMERA) return;

  if (!cameraDebugEl) {
    cameraDebugEl = document.createElement("div");
    cameraDebugEl.id = "camera-debug";
    document.body.appendChild(cameraDebugEl);
  }

  const target = controls?.target || new THREE.Vector3();
  const goosePosition = goose.group?.position || new THREE.Vector3();
  cameraDebugEl.innerHTML = [
    `camera: ${formatVector(camera.position)}`,
    `target: ${formatVector(target)}`,
    `goose: ${formatVector(goosePosition)}`,
    `heading: ${(goose.heading * 180 / Math.PI).toFixed(1)}deg`,
  ].join("<br>");
}

const dogDialogRoutes = {
  gramophoneMusic: [
    "Ooooh, music time.",
    "The gramophone is over there.",
    "It’s old, dusty, and only screams sometimes.",
    "Go pick something nice.",
    "But not duck jazz.",
    "We don’t talk about duck jazz.",
    "Walk to the gramophone and press E to interact.",
  ],
  couchMemories: [
"Alright... story time.",
"This couch has seen things.\nSecrets. Snacks. Kisses... ew... gross...",
"I used to sit here with Grey.\nHe is... let’s say, a little silly.",
"He also dances.\nBadly. But with confidence.",
"He’s a bit like that panda from Kung Fu Panda.",
"You know... Po.\nThe Dragon Warrior himself.",
"Honestly... Grey might secretly be Po.",
"I’ve never seen them in the same room.",
"And they both dance without a shirt.\nCoincidence? I think not.",
"Speaking of Po...\nNow I’m gulu gulu for pho!!",
"Anyway...",
"Honestly... I forget most stories.",
"My memory is kinda broken.",
"But I have a solution.",
"My diary.",
"Stories, legends, and very important statistics.",
"Like how many times I think about pho.",
"Record: 67.\nIn one day.",
"Impressive, I know.",
"Here... take a look.",
  ],
  arcadeGame: [
    "You want to play the arcade machine?",
    "Bold choice for someone with wings and no fingers.",
    "But I respect it.",
    "The machine is over there.",
    "Try not to peck the buttons too hard.",
    "Last time someone did that, the game called them rude.",
    "Walk to the arcade hall and press E to interact.",
  ],
};

const dogIntroDialogScript = [
  "Oh hey goose, I almost didn’t see you... you’re kinda short and low to the ground, huh?",
  "What’s your name, stranger?",
  {
    type: "name",
    text: "Type your name:",
    placeholder: "Enter your name...",
    valueKey: "playerName",
  },
  "Hmm... I think you look more like a Gooser.\nYeah, I’m gonna call you Gooser.",
  "Don’t take it personally. I rename everyone.\nMet a cat once... called him \"Barkley.\" He hated it.",
  "So what brings you here, Gooser?\nYou waddling around looking important... or just lost?",
  "I’ve been sitting here for a while.\nThinking about stuff... deep stuff.",
  "Like...\nWhy do humans throw balls if they want the ball back?",
  "Anyway... you seem alright.\nFor a goose.",
  "I was waiting for my best friend.\nHe’s a panda called Grey.",
  "He’s black and white... but that name was too long,\nso I just mixed the colors and call him Grey.",
  "I don’t think he’s gonna make it...",
  "Hey... do you maybe want to sit next to me on the couch?",
  "It’s pretty comfortable.",
  {
    type: "choice",
    text: "Want to sit on the bench with me?",
    onYes: () => {
      seatGooseOnBench();
      return [
        "Whoo hooo! New friend :P",
        "You always sit this close to strangers?",
        "Oh wait... we are friends now. You are right.",
        "This is nice. A goose and a dog. Sitting. Like legends.",
        "What would you like to do?\nListen to music, hear a story, or play a game?",
        {
          type: "choice",
          text: "What would you like to do?\nListen to music, hear a story, or play a game?",
          options: [
            { text: "Music", next: () => dogDialogRoutes.gramophoneMusic },
            { text: "Story", next: () => dogDialogRoutes.couchMemories },
            { text: "Game", next: () => dogDialogRoutes.arcadeGame },
          ],
        },
      ];
    },
    onNo: [
      "Oh. Okay. That’s fine.",
      "I didn’t want a goose sitting next to me anyway.",
      "This bench is actually very exclusive.",
      "Only cool animals allowed.",
      "And ducks with good manners.",
      "...",
      "But mostly I’m just kidding.",
      "Come back if you change your tiny goose mind.",
    ],
  },
];

const dogRevisitDialogScript = [
  "Oh hey Gooser.",
  "Back again, huh?",
  "You just casually waddling past my bench...",
  "Or are you finally ready to sit next to the coolest dog in the park?",
  {
    type: "choice",
    text: "Want to sit next to me now?",
    onYes: () => {
      seatGooseOnBench();
      return [
        "YES! I mean... cool. Very normal.",
        "I was not waiting. I was just... bench guarding.",
        "What would you like to do?\nListen to music, hear a story, or play a game?",
        {
          type: "choice",
          text: "What would you like to do?\nListen to music, hear a story, or play a game?",
          options: [
            { text: "Music", next: () => dogDialogRoutes.gramophoneMusic },
            { text: "Story", next: () => dogDialogRoutes.couchMemories },
            { text: "Game", next: () => dogDialogRoutes.arcadeGame },
          ],
        },
      ];
    },
    onNo: [
      "Wow. Rejected again by a goose.",
      "That’s going in my diary.",
      "Dear diary: today a goose broke my tiny dog heart.",
      "Anyway... I’ll be here. Being dramatic.",
    ],
  },
];

dogDialogRoutes.gramophoneMusic.postClose = () => startGooseWalkToObject(gramophone.group);
dogDialogRoutes.couchMemories.postClose = () => memoryBook?.open();
dogDialogRoutes.arcadeGame.postClose = () => startGooseWalkToObject(arcade.group);

// GLTF LOADING 
const noiseMap = new THREE.TextureLoader().load('./assets/textures/noise.png');
const poleTexture = new THREE.TextureLoader().load('./assets/textures/texture.jpg');
poleTexture.rotation = 100 * 0.01745329252; // WTF???
const rayPlane = new THREE.Mesh(new THREE.PlaneGeometry(100,100,1,1), undefined);
const groundTexture = new THREE.TextureLoader().load("./assets/textures/GroundTexture.png");
groundTexture.colorSpace = THREE.SRGBColorSpace;
groundTexture.minFilter = THREE.NearestFilter;
groundTexture.magFilter = THREE.NearestFilter;
groundTexture.generateMipmaps = false;
groundTexture.anisotropy = 1;
groundTexture.center.set(0.5, 0.5);
groundTexture.rotation = -135* Math.PI / 180;
groundTexture.wrapS = THREE.ClampToEdgeWrapping;
groundTexture.wrapT = THREE.ClampToEdgeWrapping;
const groundMaterial = new THREE.MeshBasicMaterial({
  map: groundTexture,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const ground = new THREE.Mesh(new THREE.CircleGeometry(5.8, 96), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.07;
ground.renderOrder = -10;
ground.frustumCulled = false;
// MATERIALS
const leavesMat = new THREE.ShaderMaterial({
  lights: true,
  side: THREE.DoubleSide,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uTime: {value: 0.},
    uColorA: {value: new THREE.Color(0xb45252)},
    uColorB: {value: new THREE.Color(0xd3a068)},
    uColorC: {value: new THREE.Color(0xede19e)},
    uBoxMin: {value: new THREE.Vector3(0,0,0)},
    uBoxSize: {value: new THREE.Vector3(10,10,10)},
    uRaycast: {value: new THREE.Vector3(0,0,0)},
    uNoiseMap: {value: noiseMap},
  },
  vertexShader: leavesVS,
  fragmentShader: leavesFS,
})
// GLTF LOADING 
loader.loadAsync("./assets/models/tree.glb")
  .then(obj => {
	document.getElementById("previewHack").style.display = "none";
  tree.pole = obj.scene.getObjectByName("Pole");
  tree.pole.material = new THREE.MeshToonMaterial({map: tree.pole.material.map});
  tree.pole.position.y -= 0.1;
  // Each vertex of crown mesh will be a leaf
  // Crown mesh won't be visible in scene
  tree.crown = obj.scene.getObjectByName("Leaves");
  // For object space shader
  tree.bbox = new THREE.Box3().setFromObject(tree.crown);
  leavesMat.uniforms.uBoxMin.value.copy(tree.bbox.min); 
  leavesMat.uniforms.uBoxSize.value.copy(tree.bbox.getSize(new THREE.Vector3())); 
  tree.leavesCount = tree.crown.geometry.attributes.position.count;
  tree.whenDied = new Array(tree.leavesCount);
  tree.baseMatrices = new Array(tree.leavesCount);
  tree.groundID = [];
  tree.deadID = []; 
  tree.leafGeometry = obj.scene.getObjectByName("Leaf").geometry; 
  tree.leaves = new THREE.InstancedMesh(tree.leafGeometry, leavesMat, tree.leavesCount); 
  for (let i = 0; i < tree.leavesCount; i++) { 
    dummy.position.x = tree.crown.geometry.attributes.position.array[i*3];
    dummy.position.y = tree.crown.geometry.attributes.position.array[i*3+1];
    dummy.position.z = tree.crown.geometry.attributes.position.array[i*3+2];
    dummy.lookAt(dummy.position.x + tree.crown.geometry.attributes.normal.array[i*3],
                 dummy.position.y + tree.crown.geometry.attributes.normal.array[i*3+1],
                 dummy.position.z + tree.crown.geometry.attributes.normal.array[i*3+2]);
    dummy.scale.x = (Math.random() * 0.2 + 0.8);
    dummy.scale.y = (Math.random() * 0.2 + 0.8);
    dummy.scale.z = (Math.random() * 0.2 + 0.8);
    dummy.updateMatrix();
    tree.leaves.setMatrixAt(i, dummy.matrix);
    tree.baseMatrices[i] = dummy.matrix.clone();
  }
  tree.group.add(tree.pole, tree.leaves);
  tree.collider = createXZCollider(tree.pole, 0.65, 0.45);
  createProjectedModelShadow({
    sourceObject: tree.pole,
    opacity: 0.34,
    blur: 4.2,
    flatness: 0.34,
    length: 0.62,
    scaleX: 1.08,
    rotation: 0,
    skew: -10,
  });
  createProjectedModelShadow({
    sourceObject: tree.crown,
    opacity: 0.16,
    blur: 5.6,
    flatness: 0.2,
    length: 0.48,
    scaleX: 1.05,
    rotation: 0,
    skew: -6,
    renderOrder: -3,
  });
  for (let i = 0; i < 24; i++)
    queueDeadLeaf(Math.floor(Math.random() * tree.leavesCount)); 
})
loader.loadAsync("./assets/models/Goose.glb")
  .then(obj => {
    goose.group = obj.scene;
    goose.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        const sourceMaterial = child.material || {};
        const isIris = (sourceMaterial.name || child.name || "").toLowerCase().includes("iris");
        child.material = new THREE.MeshToonMaterial({
          map: sourceMaterial.map || null,
          color: sourceMaterial.color || 0xffffff,
          skinning: child.isSkinnedMesh,
          morphTargets: !!child.morphTargetInfluences,
          morphNormals: !!child.morphTargetInfluences,
          flatShading: true,
        });
        if (isIris) {
          child.material.polygonOffset = true;
          child.material.polygonOffsetFactor = -4;
          child.material.polygonOffsetUnits = -4;
          child.material.depthWrite = false;
          child.renderOrder = 10;
          child.material.needsUpdate = true;
        }
      }
    });

    const gooseBox = new THREE.Box3().setFromObject(goose.group);
    const gooseSize = gooseBox.getSize(new THREE.Vector3());
    const gooseCenter = gooseBox.getCenter(new THREE.Vector3());
    const gooseScale = 0.65 / Math.max(gooseSize.x, gooseSize.y, gooseSize.z);
    const gooseFloorOffset = 0.2;
    const gooseWidthSqueeze = 0.9;

    goose.group.scale.set(
      gooseScale * gooseWidthSqueeze,
      gooseScale,
      gooseScale
    );
    goose.group.position.set(
      -1.5 - (gooseCenter.x * gooseScale),
      -(gooseBox.min.y * gooseScale) - gooseFloorOffset + GOOSE_HEIGHT_OFFSET,
      1.5 - (gooseCenter.z * gooseScale)
    );
    goose.groundY = goose.group.position.y;
    goose.heading = goose.group.rotation.y;
    goose.group.userData.musicGamePromptsUnlocked = false;
    goose.colliderRadius = Math.max(
      gooseSize.x * gooseWidthSqueeze,
      gooseSize.z
    ) * 0.28 * gooseScale;
    scene.add(goose.group);
    goose.groundShadow = createProjectedModelShadow({
      sourceObject: goose.group,
      opacity: 0.42,
      blur: 3.2,
      flatness: 0.3,
      length: 0.56,
      scaleX: 1.08,
      rotation: 0,
      skew: -6,
      dynamic: true,
    });
    dialogSystem.setPlayer(goose.group);

    goose.mixer = new THREE.AnimationMixer(goose.group);
    goose.mixer.timeScale = 0.5;
    obj.animations.forEach((clip) => {
      goose.actions[clip.name.toLowerCase()] = goose.mixer.clipAction(clip);
    });

    const walkClip = obj.animations.find((clip) => clip.name.toLowerCase().includes('walk')) || obj.animations[0];
    if (walkClip) {
      goose.actions.walk = goose.mixer.clipAction(walkClip);
      goose.actions.walk.play();
      goose.currentAction = goose.actions.walk;
    }
    const idleClip = obj.animations.find((clip) => clip.name.toLowerCase().includes('idle'));
    if (idleClip) {
      goose.actions.idle = goose.mixer.clipAction(idleClip);
    }
    const jumpClip = obj.animations.find((clip) => clip.name.toLowerCase().includes('jump'))
      || obj.animations.find((clip) => clip.name.toLowerCase().includes('fly'));
    if (jumpClip) {
      const jumpAction = goose.mixer.clipAction(jumpClip);
      jumpAction.loop = THREE.LoopOnce;
      jumpAction.clampWhenFinished = true;
      goose.actions.jump = jumpAction;
    }

    const spinClip = obj.animations.find((clip) => clip.name.toLowerCase().includes('spin'));
    if (spinClip) {
      const spinAction = goose.mixer.clipAction(spinClip);
      spinAction.loop = THREE.LoopOnce;
      spinAction.clampWhenFinished = true;
      goose.actions.spin = spinAction;
    }

    const sitClip = obj.animations.find((clip) => {
      const name = clip.name.toLowerCase();
      return name.includes('sit') || name.includes('seat') || name.includes('perch') || name.includes('rest');
    });
    if (sitClip) {
      const sitAction = goose.mixer.clipAction(sitClip);
      sitAction.loop = THREE.LoopRepeat;
      goose.actions.sit = sitAction;
    }

    placeGooseAtNestStart();
    if (window.__introBlocking || document.body.classList.contains("intro-active")) {
      setGooseIntroPose();
      if (goose.pendingIntroJump) {
        startGooseIntroJump();
      }
    }
  })
loader.loadAsync("./assets/models/bench.glb")
  .then(obj => {
    bench.group = obj.scene;
    const benchBox = new THREE.Box3().setFromObject(bench.group);
    const benchSize = benchBox.getSize(new THREE.Vector3());
    const benchCenter = benchBox.getCenter(new THREE.Vector3());
    const benchScale = 1.4 / Math.max(benchSize.x, benchSize.y, benchSize.z);

    bench.group.scale.setScalar(benchScale);
    bench.group.position.x = 0.9 - (benchCenter.x * benchScale);
    bench.group.rotation.y = 300 * Math.PI / 180;
    bench.group.position.y = -.05 -(benchBox.min.y * benchScale);
    bench.group.position.z = .5 - (benchCenter.z * benchScale);
    bench.collider = createXZCollider(bench.group, 0.85, 0.45);
    benchTalkAnchor.position.set(0, 0.18, -0.95);
    bench.group.add(benchTalkAnchor);
    scene.add(bench.group);
    createProjectedModelShadow({
      sourceObject: bench.group,
      opacity: 0.38,
      blur: 4.8,
      flatness: 0.3,
      length: 0.58,
      scaleX: 1.18,
      rotation: 0,
      skew: -12,
    });
    bench.ready = true;
    attachDogToBench();
  })
loader.loadAsync("./assets/models/nest.glb")
  .then(obj => {
    nest.group = obj.scene;
    nest.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        const sourceMaterial = child.material || {};
        child.material = new THREE.MeshToonMaterial({
          map: sourceMaterial.map || null,
          color: sourceMaterial.color || 0xffffff,
          flatShading: true,
        });
      }
    });

    const nestBox = new THREE.Box3().setFromObject(nest.group);
    const nestSize = nestBox.getSize(new THREE.Vector3());
    const nestCenter = nestBox.getCenter(new THREE.Vector3());
    const nestScale = 0.75 / Math.max(nestSize.x, nestSize.y, nestSize.z);

    nest.group.scale.setScalar(nestScale);
    nest.group.position.set(
      -2.55 - (nestCenter.x * nestScale),
      -0.05 - (nestBox.min.y * nestScale),
      -2.55 - (nestCenter.z * nestScale)
    );
    nest.group.rotation.y = 35 * Math.PI / 180;
    scene.add(nest.group);
    createProjectedModelShadow({
      sourceObject: nest.group,
      opacity: 0.32,
      blur: 3.4,
      flatness: 0.34,
      length: 0.5,
      scaleX: 1.08,
      rotation: 0,
      skew: -8,
    });
    nest.ready = true;
    placeGooseAtNestStart();
  })
loader.loadAsync("./assets/models/Gramophone.glb")
  .then(obj => {
    gramophone.group = obj.scene;
    gramophone.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        // Keep the original GLB material so the gramophone retains its texture/palette.
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) => material?.clone?.() || material);
        } else if (child.material?.clone) {
          child.material = child.material.clone();
        }
      }
    });

    const gramophoneBox = new THREE.Box3().setFromObject(gramophone.group);
    const gramophoneSize = gramophoneBox.getSize(new THREE.Vector3());
    const gramophoneCenter = gramophoneBox.getCenter(new THREE.Vector3());
    const gramophoneScale = 1.3 / Math.max(gramophoneSize.x, gramophoneSize.y, gramophoneSize.z);

    gramophone.group.scale.setScalar(gramophoneScale);
    gramophone.group.position.set(
      2.55 - (gramophoneCenter.x * gramophoneScale),
      -0.05 - (gramophoneBox.min.y * gramophoneScale),
      -1.05 - (gramophoneCenter.z * gramophoneScale)
    );
    gramophone.group.rotation.y = 78 * Math.PI / 180;
    gramophone.collider = createXZCollider(gramophone.group, 0.75, 0.4);
    scene.add(gramophone.group);
    createProjectedModelShadow({
      sourceObject: gramophone.group,
      opacity: 0.4,
      blur: 4.2,
      flatness: 0.26,
      length: 0.66,
      scaleX: 1.08,
      rotation: 0,
      skew: -11,
    });
    gramophone.ready = true;
    dialogSystem.registerNpc({
      id: "gramophone",
      name: "Gramophone",
      object3D: gramophone.group,
      interactionObject3D: () => gramophone.group,
      promptObject3D: () => gramophone.group,
      promptOffset: new THREE.Vector3(-0.2, 1.75, 0),
      promptText: "Press E for music",
      talkDistance: 2.2,
      dialogScript: [
        "You put on some music.",
        "The gramophone crackles softly.",
      ],
      gifSrc: "./assets/ui/Dog_talk_102x102.gif",
    });
  })
loader.loadAsync("./assets/models/Arcade.glb")
  .then(obj => {
    arcade.group = obj.scene;
    arcade.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        const sourceMaterial = child.material || {};
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) => material?.clone?.() || material);
        } else if (child.material?.clone) {
          child.material = child.material.clone();
        } else {
          child.material = new THREE.MeshToonMaterial({
            map: sourceMaterial.map || null,
            color: sourceMaterial.color || 0xffffff,
            flatShading: true,
          });
        }
      }
    });

    const arcadeBox = new THREE.Box3().setFromObject(arcade.group);
    const arcadeSize = arcadeBox.getSize(new THREE.Vector3());
    const arcadeCenter = arcadeBox.getCenter(new THREE.Vector3());
    const arcadeScale = 2.0 / Math.max(arcadeSize.x, arcadeSize.y, arcadeSize.z);

    arcade.group.scale.setScalar(arcadeScale);
    arcade.group.position.set(
      -1.8 - (arcadeCenter.x * arcadeScale),
      -0.05 - (arcadeBox.min.y * arcadeScale),
      0.8 - (arcadeCenter.z * arcadeScale)
    );
    arcade.group.rotation.y = 110 * Math.PI / 180;
    arcade.collider = createXZCollider(arcade.group, 0.85, 0.55);
    scene.add(arcade.group);
    createProjectedModelShadow({
      sourceObject: arcade.group,
      opacity: 0.42,
      blur: 5,
      flatness: 0.24,
      length: 0.7,
      scaleX: 1.12,
      rotation: 0,
      skew: -9,
    });
    arcade.ready = true;
    dialogSystem.registerNpc({
      id: "arcade",
      name: "Arcade",
      object3D: arcade.group,
      interactionObject3D: () => arcade.group,
      promptObject3D: () => arcade.group,
      promptOffset: new THREE.Vector3(0, 0.75, 0),
      promptText: "Press E for game",
      talkDistance: 2.4,
      dialogScript: [
        "You boot up the arcade machine.",
        "It flickers to life.",
      ],
      gifSrc: "./assets/ui/Dog_talk_102x102.gif",
      onInteract: () => openArcadeMenu(),
    });
  })
loader.loadAsync("./assets/models/dog.glb")
  .then(obj => {
    dog.group = obj.scene;
    dog.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        const sourceMaterial = child.material || {};
        child.material = new THREE.MeshToonMaterial({
          map: sourceMaterial.map || null,
          color: sourceMaterial.color || 0xffffff,
          skinning: child.isSkinnedMesh,
          morphTargets: !!child.morphTargetInfluences,
          morphNormals: !!child.morphTargetInfluences,
          flatShading: true,
        });
      }
    });

    const dogBox = new THREE.Box3().setFromObject(dog.group);
    const dogSize = dogBox.getSize(new THREE.Vector3());
    const dogCenter = dogBox.getCenter(new THREE.Vector3());
    const dogScale = 0.68 * 3.5 / Math.max(dogSize.x, dogSize.y, dogSize.z);
    const dogWidthSqueeze = 1.1;

    dog.group.scale.set(
      dogScale * dogWidthSqueeze,
      dogScale,
      dogScale
    );
    dog.group.position.set(
      1 - (dogCenter.x * dogScale),
      -0.35 - (dogBox.min.y * dogScale),
      -1.4 - (dogCenter.z * dogScale)
    );
    dog.group.rotation.y = 220 * Math.PI / 180;
    dog.groundShadow = createProjectedModelShadow({
      sourceObject: dog.group,
      opacity: 0.3,
      blur: 3.2,
      flatness: 0.33,
      length: 0.48,
      scaleX: 1.05,
      rotation: 0,
      skew: -7,
      dynamic: true,
    });
    dog.mixer = new THREE.AnimationMixer(dog.group);
    if (obj.animations && obj.animations.length) {
      const clip = obj.animations[0];
      dog.action = dog.mixer.clipAction(clip);
      dog.action.reset().play();
    }
    dog.ready = true;
    attachDogToBench();
    dialogSystem.registerNpc({
      id: "dog",
      name: "Mr. Doggo",
      object3D: dog.group,
      interactionObject3D: () => benchTalkAnchor,
      promptObject3D: () => dog.group,
      promptOffset: new THREE.Vector3(0, 0.15, 0),
      talkDistance: TALK_DISTANCE,
      sentenceSoundSrc: "./assets/Audio/DogBark.mp3",
      dialogScript: () => (
        dog.group?.userData?.hasMetDog ? dogRevisitDialogScript : dogIntroDialogScript
      ),
      dialogRoutes: dogDialogRoutes,
      gifSrc: "./assets/ui/Dog_talk_102x102.gif",
      typeSpeed: 28,
    });
  })
// INIT
document.body.appendChild(renderer.domElement); 
renderer.domElement.style.imageRendering = "pixelated";
renderer.domElement.style.imageRendering = "crisp-edges";
renderer.setPixelRatio(RENDER_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
dlight01.position.set(3,6,-3);
dlight01.lookAt(0,2.4,0);
PROJECTED_SHADOW_LIGHT.copy(dlight01.position);
rayPlane.visible = false;
bushRing = createBushRing();
groundGrassLayer = createGroundGrassLayer();
camera.position.set(-7,1,-12);
controls.target = new THREE.Vector3(0,2.4,0);
controls.minPolarAngle = 0.65;
controls.maxPolarAngle = 1.35; 
controls.enableDamping = true;
controls.enableZoom = true;
controls.minDistance = 6;
controls.maxDistance = 24;
controls.autoRotate = false;
controls.enablePan = false;
controls.touches = {TWO: THREE.TOUCH.ROTATE,};
scene.add(dlight01, bushRing, tree.group, rayPlane);
scene.add(ground, groundGrassLayer, groundShadowLayer);
noiseMap.wrapS = THREE.RepeatWrapping;
noiseMap.wrapT = THREE.RepeatWrapping;

initEggIntro({
  camera,
  controls,
  goose,
  onShellOpened: () => {
    setGooseIntroPose();
  },
  onZoomComplete: () => {
    startGooseIntroJump();
    showIntroControlHints();
  },
});

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("wheel", onWheel, { passive: false });
// MAIN LOOP
animate()
function animate () {
	requestAnimationFrame(animate);
  leavesMat.uniforms.uTime.value += 0.01; 
  const delta = Math.min(clock.getDelta(), 0.033);
  updateGoose(delta);
  updateBushVisibility(delta);
  scene.updateMatrixWorld(true);
  for (const shadow of projectedModelShadows) {
    updateProjectedModelShadow(shadow);
  }
  if (goose.groundShadow) {
    setProjectedModelShadowOpacity(goose.groundShadow, goose.isJumping ? 0.28 : 0.42);
  }
  dialogSystem.update();
  if (dog.mixer) {
    dog.mixer.update(delta);
  }

  if (tree.deadID){
    tree.deadID = tree.deadID.map((i) => {
      tree.leaves.getMatrixAt(i, matrix);
      matrix.decompose(dummy.position, dummy.rotation, dummy.scale);
      if (dummy.position.y > 0) {
        dummy.position.y -= 0.04;
        dummy.position.x += Math.random()/5 - 0.11;
        dummy.position.z += Math.random()/5 - 0.11;
        dummy.rotation.x += 0.2;
        dummy.updateMatrix();
        tree.leaves.setMatrixAt(i, dummy.matrix);
        return i;
      }
      dummy.position.y = 0;
      dummy.updateMatrix();
      tree.leaves.setMatrixAt(i, dummy.matrix);
      tree.groundID.push(i);
      return undefined;
    }).filter((i) => i !== undefined);

    while (tree.groundID.length > MAX_GROUND_LEAVES) {
      const oldestGroundLeaf = tree.groundID.shift();
      if (oldestGroundLeaf !== undefined && tree.baseMatrices[oldestGroundLeaf]) {
        tree.leaves.setMatrixAt(oldestGroundLeaf, tree.baseMatrices[oldestGroundLeaf]);
      }
    }

    tree.leaves.instanceMatrix.needsUpdate = true; 
  }

  if (!window.__introBlocking) {
    controls.update(); 
    if (goose.followActive) {
      applyZoomTilt();
    }
  }
  updateCameraDebugOverlay();
  renderer.render(scene, camera); 
}
// EVENTS
window.addEventListener("resize", () => {
  camera.aspect = document.body.clientWidth / document.body.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(RENDER_PIXEL_RATIO);
  renderer.setSize( document.body.clientWidth, document.body.clientHeight );
})
document.addEventListener("mousemove", (e) => pointerMove(e))
// MISC
killRandom();
function killRandom() {
  if (tree.deadID)
    queueDeadLeaf(Math.floor(Math.random() * tree.leavesCount)); 
  setTimeout(killRandom, Math.random() * 1500);
}
function pointerMove(e) {
    if (memoryBook?.isOpen()) return;
    if (goose.group?.userData?.arcadeMenuOpen) return;

    pointer.set((e.clientX / window.innerWidth) * 2 - 1,
              -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects([tree.leaves, rayPlane]);
  if (intersects[0]){
    // for smooth transition between background and tree
    rayPlane.position.copy(intersects[0].point);
    rayPlane.position.multiplyScalar(0.9);
    rayPlane.lookAt(camera.position);
    leavesMat.uniforms.uRaycast.value = intersects[0].point;
    if (Math.random()*5 > 3)
      queueDeadLeaf(intersects[0].instanceId);
  }
}

function onKeyDown(e) {
  if (memoryBook?.isOpen()) {
    if (memoryBook.handleKeyDown(e)) {
      return;
    }
    e.preventDefault();
    return;
  }

  if (arcadeMenu.handleKeyDown(e)) {
    return;
  }

  if (handleIntroEnter(e)) {
    return;
  }

  if (window.__introBlocking) {
    e.preventDefault();
    return;
  }

  handleIntroControlInput(e);

  if (goose.isSitting) {
    if (e.code === "Escape") {
      e.preventDefault();
      standGooseUp();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      return;
    }
  }

  const activeNpc = dialogSystem.getActiveNpc();

  if (DEBUG_SKIP_DIALOG && e.code === "KeyE" && activeNpc?.id === "dog") {
    e.preventDefault();
    if (!goose.isSitting) {
      seatGooseOnBench();
    }
  }

  if (dialogSystem.handleKeyDown(e)) {
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    startGooseJump();
    return;
  }
  const key = e.key.toLowerCase();
  if (key in keys) {
    e.preventDefault();
    keys[key] = true;
  }
}

function onKeyUp(e) {
  if (memoryBook?.isOpen()) {
    e.preventDefault();
    return;
  }

  if (arcadeMenu.handleKeyUp(e)) {
    return;
  }

  if (window.__introBlocking) {
    e.preventDefault();
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    keys.space = false;
    return;
  }
  if (dialogSystem.handleKeyUp?.(e)) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key in keys) {
    e.preventDefault();
    keys[key] = false;
  }
}

function onWheel(e) {
  if (memoryBook?.isOpen()) {
    return;
  }

  if (arcadeMenu.handleWheel(e)) {
    return;
  }
}

function startGooseJump() {
  if (goose.isSitting) return;
  if (goose.isJumping) return;
  goose.isJumping = true;
  goose.verticalVelocity = 3.6;
  keys.space = true;
  playGooseJumpSound();
  if (goose.actions.jump) {
    switchGooseAction("jump");
    goose.actions.jump.reset().play();
  }
}

function seatGooseOnBench() {
  if (!goose.group || !bench.ready || goose.isSitting) return;

  goose.group.getWorldPosition(goose.preSitWorldPosition);
  goose.group.getWorldQuaternion(goose.preSitWorldQuaternion);
  goose.preSitHeading = goose.heading;
  goose.preSitGroundY = goose.groundY;

  if (goose.group.parent) {
    bench.group.attach(goose.group);
  } else {
    bench.group.add(goose.group);
  }

  goose.group.position.set(-0.58, -0.1, -0.5);
  goose.group.rotation.y = 210*Math.PI/180;
  goose.heading = goose.group.rotation.y;
  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;
  goose.isJumping = false;
  goose.isSitting = true;
  goose.group.userData.isSitting = true;
  goose.group.userData.musicGamePromptsUnlocked = true;
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.arrowup = false;
  keys.arrowleft = false;
  keys.arrowdown = false;
  keys.arrowright = false;

  if (goose.actions.sit) {
    switchGooseAction("sit");
    goose.actions.sit.reset().play();
    goose.sittingAction = goose.actions.sit;
  } else if (goose.actions.idle) {
    switchGooseAction("idle");
    goose.sittingAction = goose.actions.idle;
  }

  controls.target.copy(goose.group.position);
}

function standGooseUp() {
  if (!goose.group || !goose.isSitting) return;

  scene.attach(goose.group);
  goose.isSitting = false;
  goose.group.userData.isSitting = false;
  goose.sittingAction = null;
  goose.group.position.copy(goose.preSitWorldPosition);
  goose.groundY = goose.preSitGroundY || goose.preSitWorldPosition.y;
  goose.heading = goose.preSitHeading;
  goose.group.quaternion.copy(goose.preSitWorldQuaternion);
  goose.group.rotation.set(0, goose.heading, 0);
  keys.space = false;
  if (goose.actions.idle) {
    switchGooseAction("idle");
  }
  controls.target.copy(goose.group.position);
}

function releaseGooseFromBench() {
  if (!goose.group || !goose.isSitting) return;

  scene.attach(goose.group);
  goose.isSitting = false;
  goose.group.userData.isSitting = false;
  goose.sittingAction = null;
  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;
  goose.group.position.y = goose.preSitGroundY || goose.preSitWorldPosition.y;
  goose.groundY = goose.preSitGroundY || goose.preSitWorldPosition.y;
  goose.heading = goose.preSitHeading;
  goose.group.quaternion.copy(goose.preSitWorldQuaternion);
  goose.group.rotation.set(0, goose.heading, 0);
  keys.space = false;
}

function positionGooseAtArcade() {
  if (!goose.group || !arcade.ready || !arcade.group) return false;

  if (goose.isSitting) {
    releaseGooseFromBench();
  }

  if (goose.group.parent !== scene) {
    scene.attach(goose.group);
  }

  const arcadePosition = new THREE.Vector3();
  arcade.group.getWorldPosition(arcadePosition);

  const awayFromArcade = goose.group.position.clone().sub(arcadePosition);
  awayFromArcade.y = 0;
  if (awayFromArcade.lengthSq() < 0.001) {
    awayFromArcade.set(1, 0, 0);
  }
  awayFromArcade.normalize();

  const standDistance = (arcade.collider?.radius || 0.85)
    + (goose.colliderRadius || 0.25)
    + 0.18;

  const targetPosition = arcadePosition.clone().addScaledVector(awayFromArcade, standDistance);
  targetPosition.y = goose.groundY || goose.group.position.y;

  goose.group.position.copy(targetPosition);
  goose.groundY = targetPosition.y;
  goose.heading = Math.atan2(
    arcadePosition.x - goose.group.position.x,
    arcadePosition.z - goose.group.position.z,
  );
  goose.group.rotation.set(0, goose.heading, 0);
  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;
  goose.isJumping = false;
  goose.followActive = false;
  goose.returningHome = false;
  goose.returnFacingTarget = null;
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.arrowup = false;
  keys.arrowleft = false;
  keys.arrowdown = false;
  keys.arrowright = false;
  keys.space = false;
  goose.group.userData.arcadeMenuOpen = false;

  if (goose.actions.idle) {
    switchGooseAction("idle");
  }

  controls.target.copy(goose.group.position);
  return true;
}

function openArcadeMenu() {
  if (!positionGooseAtArcade()) return false;
  return arcadeMenu.open();
}

function closeArcadeMenu() {
  return arcadeMenu.close();
}

function startGooseReturnHome(options = {}) {
  if (!goose.group || !goose.preSitWorldPosition) return;

  if (goose.isSitting) {
    releaseGooseFromBench();
  }

  const sideBias = options.sideBias ?? 0;
  goose.returningHome = true;
  goose.returnTarget.copy(goose.preSitWorldPosition);
  goose.returnTarget.x += sideBias * 1.1;
  goose.returnTarget.y = goose.preSitGroundY || goose.preSitWorldPosition.y;
  goose.returnFacingTarget = null;
  goose.groundY = goose.returnTarget.y;
  goose.followActive = true;
  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.arrowup = false;
  keys.arrowleft = false;
  keys.arrowdown = false;
  keys.arrowright = false;

  if (goose.actions.walk) {
    switchGooseAction("walk");
    goose.actions.walk.timeScale = 0.85;
  } else if (goose.actions.idle) {
    switchGooseAction("idle");
  }
}

function startGooseWalkToObject(targetObject) {
  if (!goose.group || !targetObject) return;

  if (goose.isSitting) {
    releaseGooseFromBench();
  }

  const targetPosition = new THREE.Vector3();
  targetObject.getWorldPosition(targetPosition);

  const fromObjectToGoose = goose.group.position.clone().sub(targetPosition);
  fromObjectToGoose.y = 0;
  if (fromObjectToGoose.lengthSq() < 0.001) {
    fromObjectToGoose.set(1, 0, 0);
  }
  fromObjectToGoose.normalize();

  goose.returningHome = true;
  goose.returnFacingTarget = targetObject;
  goose.returnTarget.copy(targetPosition).addScaledVector(fromObjectToGoose, 1.05);
  goose.returnTarget.y = goose.preSitGroundY || goose.preSitWorldPosition.y;
  goose.groundY = goose.returnTarget.y;
  goose.followActive = true;
  goose.moveVelocity = 0;
  goose.turnVelocity = 0;
  goose.verticalVelocity = 0;

  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.arrowup = false;
  keys.arrowleft = false;
  keys.arrowdown = false;
  keys.arrowright = false;

  if (goose.actions.walk) {
    switchGooseAction("walk");
    goose.actions.walk.timeScale = 0.85;
  } else if (goose.actions.idle) {
    switchGooseAction("idle");
  }
}

function updateGooseReturnHome(delta) {
  if (!goose.returningHome || !goose.group) return false;

  const dx = goose.returnTarget.x - goose.group.position.x;
  const dz = goose.returnTarget.z - goose.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.04) {
    goose.group.position.copy(goose.returnTarget);
    if (goose.returnFacingTarget) {
      const lookTarget = new THREE.Vector3();
      goose.returnFacingTarget.getWorldPosition(lookTarget);
      const faceX = lookTarget.x - goose.group.position.x;
      const faceZ = lookTarget.z - goose.group.position.z;
      goose.heading = Math.atan2(faceX, faceZ);
    } else {
      goose.heading = goose.preSitHeading;
    }
    goose.group.rotation.set(0, goose.heading, 0);
    goose.returningHome = false;
    goose.returnFacingTarget = null;
    goose.followActive = false;
    if (goose.actions.idle) {
      switchGooseAction("idle");
    }
    controls.target.copy(goose.group.position);
    return true;
  }

  const step = Math.min(goose.returnSpeed * delta, dist);
  const moveX = (dx / dist) * step;
  const moveZ = (dz / dist) * step;
  goose.group.position.x += moveX;
  goose.group.position.z += moveZ;
  goose.heading = Math.atan2(moveX, moveZ);
  goose.group.rotation.y = goose.heading;

  if (goose.actions.walk && goose.currentAction !== goose.actions.walk) {
    switchGooseAction("walk");
  }

  if (goose.actions.walk) {
    goose.actions.walk.timeScale = 0.75;
  }

  controls.target.lerp(goose.group.position.clone(), 0.08);
  return true;
}

function updateGoose(delta) {
  if (!goose.group || !goose.group.parent) return;
  if (goose.mixer) {
    goose.mixer.update(delta);
  }
  if (goose.group.userData.arcadeMenuOpen) {
    return;
  }
  if (updateGooseReturnHome(delta)) {
    return;
  }
  if (window.__introBlocking) return;
  if (goose.isSitting) {
    return;
  }

  const turnLeft = keys.d || keys.arrowright;
  const turnRight = keys.a || keys.arrowleft;
  const forward = keys.w || keys.arrowup;
  const backward = keys.s || keys.arrowdown;
  const turnInput = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);
  const moveInput = (forward ? 1 : 0) - (backward ? 1 : 0);
  const turning = turnInput !== 0;
  const moving = moveInput !== 0;
  goose.followActive = moving || goose.isJumping;

  const turnSpeed = moving ? 3.6+1 : 4.4+1;
  const moveSpeed = 3.4;
  const turnDamping = 16;
  const moveDamping = 8;

  goose.turnVelocity = THREE.MathUtils.damp(goose.turnVelocity, turnInput * turnSpeed, turnDamping, delta);
  goose.moveVelocity = THREE.MathUtils.damp(goose.moveVelocity, moveInput * moveSpeed, moveDamping, delta);
  goose.heading += goose.turnVelocity * delta;
  goose.group.rotation.y = goose.heading;

  if (Math.abs(goose.moveVelocity) > 0.001) {
    tmpVector.set(0, 0, 1);
    tmpVector.applyAxisAngle(tmpUp, goose.heading);
    tmpVector.multiplyScalar(goose.moveVelocity * delta);
    moveGooseWithCollisions(tmpVector);
  }

  const desiredWalkTilt = moving ? -0.35 * Math.min(1, Math.abs(goose.moveVelocity) / moveSpeed) : 0;
  goose.walkTilt = THREE.MathUtils.lerp(goose.walkTilt, desiredWalkTilt, 0.08);

  if (goose.isJumping) {
    goose.group.position.y += goose.verticalVelocity * delta;
    goose.verticalVelocity -= 9.5 * delta;
    if (goose.group.position.y <= goose.groundY) {
      goose.group.position.y = goose.groundY;
      goose.verticalVelocity = 0;
      goose.isJumping = false;
      keys.space = false;
      if (goose.actions.idle) {
        switchGooseAction("idle");
      }
    }
  }

  if (camera && goose.group && (moving || goose.isJumping)) {
    const target = goose.group.position.clone();
    target.y += goose.walkTilt;
    controls.target.lerp(target, 0.08);
  }

  if (goose.isJumping) {
    if (goose.actions.jump && goose.currentAction !== goose.actions.jump) {
      switchGooseAction("jump");
    }
  } else if (moving && goose.actions.walk && goose.currentAction !== goose.actions.walk) {
    switchGooseAction("walk");
  } else if (!moving && goose.actions.idle && goose.currentAction !== goose.actions.idle) {
    switchGooseAction("idle");
  } else if (!moving && goose.actions.walk) {
    goose.actions.walk.paused = true;
  }

  if (goose.actions.walk) {
    const motionAmount = Math.min(1, Math.abs(goose.moveVelocity) / moveSpeed);
    goose.actions.walk.timeScale = 0.55 + motionAmount * 0.55;
  }
  if (goose.actions.jump) {
    goose.actions.jump.timeScale = 0.7;
  }
}

function applyZoomTilt() {
  if (!camera || !controls) return;

  const distance = camera.position.distanceTo(controls.target);
  const zoomRange = controls.maxDistance - controls.minDistance;
  const zoomT = zoomRange > 0
    ? THREE.MathUtils.clamp((distance - controls.minDistance) / zoomRange, 0, 1)
    : 0;

  const liftedY = controls.target.y + THREE.MathUtils.lerp(0, 3.5, zoomT);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, liftedY, 0.04);
}

function queueDeadLeaf(index) {
  const leafIndex = Math.max(0, Math.min(index, tree.leavesCount - 1));
  const groundIndex = tree.groundID.indexOf(leafIndex);
  if (groundIndex !== -1) {
    tree.groundID.splice(groundIndex, 1);
  }
  if (tree.deadID.includes(leafIndex)) return;

  if (tree.deadID.length >= MAX_FALLING_LEAVES) {
    const oldestLeaf = tree.deadID.shift();
    if (oldestLeaf !== undefined) {
      tree.leaves.getMatrixAt(oldestLeaf, matrix);
      matrix.decompose(dummy.position, dummy.rotation, dummy.scale);
      dummy.position.y = 0;
      dummy.updateMatrix();
      tree.leaves.setMatrixAt(oldestLeaf, dummy.matrix);
      tree.groundID.push(oldestLeaf);
      tree.leaves.instanceMatrix.needsUpdate = true;
    }
  }

  tree.leaves.getMatrixAt(leafIndex, matrix);
  matrix.decompose(dummy.position, dummy.rotation, dummy.scale);
  tree.deadID.push(leafIndex);
  tree.leaves.instanceMatrix.needsUpdate = true;
}

function attachDogToBench() {
  if (!bench.ready || !dog.ready) return;
  if (dog.group.parent) {
    dog.group.removeFromParent();
  }
  bench.group.add(dog.group);
}

function moveGooseWithCollisions(deltaMove) {
  const currentX = goose.group.position.x;
  const currentZ = goose.group.position.z;
  const nextX = currentX + deltaMove.x;
  const nextZ = currentZ + deltaMove.z;

  if (!collidesAt(nextX, nextZ)) {
    goose.group.position.x = nextX;
    goose.group.position.z = nextZ;
    return;
  }

  if (!collidesAt(nextX, currentZ)) {
    goose.group.position.x = nextX;
  }

  if (!collidesAt(goose.group.position.x, nextZ)) {
    goose.group.position.z = nextZ;
  }
}

function collidesAt(x, z) {
  const gooseRadius = goose.colliderRadius || 0.25;

  if (tree.collider) {
    const dx = x - tree.collider.center.x;
    const dz = z - tree.collider.center.z;
    const treeRadius = tree.collider.radius + gooseRadius;
    if ((dx * dx + dz * dz) < (treeRadius * treeRadius)) {
      return true;
    }
  }

  if (bench.collider) {
    const dx = x - bench.collider.center.x;
    const dz = z - bench.collider.center.z;
    const benchRadius = bench.collider.radius + gooseRadius;
    if ((dx * dx + dz * dz) < (benchRadius * benchRadius)) {
      return true;
    }
  }

  if (gramophone.collider) {
    const dx = x - gramophone.collider.center.x;
    const dz = z - gramophone.collider.center.z;
    const gramophoneRadius = gramophone.collider.radius + gooseRadius;
    if ((dx * dx + dz * dz) < (gramophoneRadius * gramophoneRadius)) {
      return true;
    }
  }

  if (arcade.collider) {
    const dx = x - arcade.collider.center.x;
    const dz = z - arcade.collider.center.z;
    const arcadeRadius = arcade.collider.radius + gooseRadius;
    if ((dx * dx + dz * dz) < (arcadeRadius * arcadeRadius)) {
      return true;
    }
  }

  return false;
}

function createXZCollider(object3D, radiusScale = 1, minRadius = 0) {
  const box = new THREE.Box3().setFromObject(object3D);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.5 * radiusScale;

  return {
    center: new THREE.Vector3(center.x, center.y, center.z),
    radius: Math.max(radius, minRadius),
  };
}

function switchGooseAction(actionName) {
  const nextAction = goose.actions[actionName];
  if (!nextAction || goose.currentAction === nextAction) return;

  if (goose.currentAction) {
    goose.currentAction.fadeOut(0.15);
  }

  nextAction.reset().fadeIn(0.15).play();
  goose.currentAction = nextAction;
}
