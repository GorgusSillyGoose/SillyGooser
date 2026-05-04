import * as THREE from "three";

export const INTRO_CAMERA_DISTANCE_START = 1.2;
export const INTRO_CAMERA_DISTANCE_END = 6.0;
export const INTRO_CAMERA_HEIGHT_START = 1.1;
export const INTRO_CAMERA_HEIGHT_END = 3.0;
export const INTRO_CAMERA_SIDE_OFFSET_START = 0.0;
export const INTRO_CAMERA_SIDE_OFFSET_END = 0.6;
export const INTRO_CAMERA_ZOOM_DURATION = 3200;
const INTRO_CAMERA_ARC_STRENGTH = -1.15;
export const INTRO_CAMERA_END_POSITION = new THREE.Vector3(7.0, 5.17, -12.57);
export const INTRO_CAMERA_END_TARGET = new THREE.Vector3(-5.88, 1.11, 0.17);

const INTRO_WORLD_ZOOM_DELAY = 450;
const INTRO_CONTROL_HINT_FADE_DELAY = 220;
const INTRO_CONTROL_HINT_FADE_DURATION = 350;

const ZIGZAG_POINTS = [
  [0.0, 50.0],
  [5.5, 35.5],
  [13.5, 64.5],
  [24.5, 34.0],
  [37.0, 66.0],
  [50.0, 33.5],
  [63.0, 66.5],
  [76.5, 34.5],
  [89.0, 64.5],
  [100.0, 50.0],
];

const introState = {
  active: false,
  phase: "idle",
  overlayEl: null,
  introTextEl: null,
  controlsHintEl: null,
  controlsHintHideTimer: 0,
  controlsHintFadeTimer: 0,
  controlsHintVisible: false,
  controlsHintDismissable: false,
  camera: null,
  controls: null,
  gooseRef: null,
  zoomStart: null,
  zoomEnd: null,
  zoomStartTarget: null,
  zoomEndTarget: null,
  currentLookTarget: new THREE.Vector3(),
  zoomStartedAt: 0,
  rafId: 0,
  timers: new Set(),
  zoomDelayTimer: 0,
  onShellOpened: null,
  onZoomComplete: null,
  crackSounds: [],
  backgroundMusic: null,
};

function createAudio(src, volume = 1) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

function playCrackSound(index) {
  const audio = introState.crackSounds[index];
  if (!audio) return;

  try {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore autoplay / decode errors.
  }
}

function startBackgroundMusic() {
  const audio = introState.backgroundMusic;
  if (!audio) return;

  try {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore autoplay / decode errors.
  }
}

function stopBackgroundMusic() {
  const audio = introState.backgroundMusic;
  if (!audio) return;

  try {
    audio.pause();
  } catch {
    // Ignore pause errors.
  }
}

function resolveValue(value) {
  return typeof value === "function" ? value() : value;
}

function resolveGooseObject(gooseRef) {
  const resolved = resolveValue(gooseRef) || null;
  if (!resolved) return null;
  if (resolved.isObject3D) return resolved;
  if (resolved.group?.isObject3D) return resolved.group;
  return resolved;
}

function getGooseWorldPosition() {
  const gooseObject = resolveGooseObject(introState.gooseRef);
  if (!gooseObject) return null;

  const position = new THREE.Vector3();
  gooseObject.getWorldPosition(position);
  return position;
}

function getGooseWorldQuaternion() {
  const gooseObject = resolveGooseObject(introState.gooseRef);
  if (!gooseObject) return null;

  const quaternion = new THREE.Quaternion();
  gooseObject.getWorldQuaternion(quaternion);
  return quaternion;
}

export function getGooseForwardDirection() {
  const gooseQuat = getGooseWorldQuaternion();
  const forward = new THREE.Vector3(0, 0, 1);
  if (gooseQuat) {
    forward.applyQuaternion(gooseQuat);
  }
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) {
    forward.set(0, 0, 1);
  }
  return forward.normalize();
}

function getGooseRightDirection() {
  const gooseQuat = getGooseWorldQuaternion();
  const right = new THREE.Vector3(1, 0, 0);
  if (gooseQuat) {
    right.applyQuaternion(gooseQuat);
  }
  right.y = 0;
  if (right.lengthSq() < 0.0001) {
    right.set(1, 0, 0);
  }
  return right.normalize();
}

function getIntroCameraPose(distance, height, sideOffset) {
  const goosePos = getGooseWorldPosition();
  if (!goosePos) {
    return {
      position: new THREE.Vector3(sideOffset, height, distance),
      target: new THREE.Vector3(0, 1, 1),
    };
  }

  const gooseForward = getGooseForwardDirection();
  const gooseRight = getGooseRightDirection();
  const position = goosePos.clone()
    .addScaledVector(gooseForward, -distance)
    .addScaledVector(gooseRight, sideOffset);
  position.y += height;

  const target = goosePos.clone().addScaledVector(gooseForward, 1.0);
  target.y += 1.0;

  return { position, target };
}

function createOverlayDom() {
  const overlay = document.createElement("div");
  overlay.id = "egg-intro";
  overlay.className = "egg-intro";
  overlay.innerHTML = `
    <div class="egg-shell-top"></div>
    <div class="egg-shell-bottom"></div>
    <div id="intro-text">
      <span id="prompt-text">Press Enter</span>
    </div>
  `;

  return {
    overlayEl: overlay,
    introTextEl: overlay.querySelector("#intro-text"),
    promptTextEl: overlay.querySelector("#prompt-text"),
    topShellEl: overlay.querySelector(".egg-shell-top"),
    bottomShellEl: overlay.querySelector(".egg-shell-bottom"),
  };
}

function createControlsHintDom() {
  const overlay = document.createElement("div");
  overlay.id = "intro-controls-hint";
  overlay.className = "intro-controls-hint hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="intro-controls-row">
      <span class="intro-controls-label">use</span>
      <div class="intro-controls-icons" aria-hidden="true">
        <img src="./assets/ui/WASD.png" alt="" class="intro-controls-key intro-controls-key-wasd" />
        <img src="./assets/ui/Arrow.png" alt="" class="intro-controls-key intro-controls-key-arrow" />
      </div>
      <span class="intro-controls-label">to move</span>
    </div>
    <div class="intro-controls-row">
      <span class="intro-controls-label">jump with</span>
      <img src="./assets/ui/Spacebar.png" alt="" aria-hidden="true" class="intro-controls-key intro-controls-key-space" />
    </div>
  `;

  return overlay;
}

function clearTimers() {
  if (introState.zoomDelayTimer) {
    window.clearTimeout(introState.zoomDelayTimer);
    introState.zoomDelayTimer = 0;
  }
  for (const timer of introState.timers) {
    window.clearTimeout(timer);
  }
  introState.timers.clear();
}

function queueTimer(callback, delay) {
  const id = window.setTimeout(() => {
    introState.timers.delete(id);
    callback();
  }, delay);
  introState.timers.add(id);
  return id;
}

function clearControlsHintTimer() {
  if (introState.controlsHintHideTimer) {
    window.clearTimeout(introState.controlsHintHideTimer);
    introState.controlsHintHideTimer = 0;
  }
  if (introState.controlsHintFadeTimer) {
    window.clearTimeout(introState.controlsHintFadeTimer);
    introState.controlsHintFadeTimer = 0;
  }
}

function hideControlsHintNow() {
  if (!introState.controlsHintEl) return;
  if (introState.controlsHintFadeTimer) {
    window.clearTimeout(introState.controlsHintFadeTimer);
    introState.controlsHintFadeTimer = 0;
  }
  introState.controlsHintEl.classList.remove("visible");
  introState.controlsHintEl.classList.remove("fading");
  introState.controlsHintEl.classList.add("hidden");
  introState.controlsHintVisible = false;
  introState.controlsHintDismissable = false;
  clearControlsHintTimer();
}

export function showIntroControlHints() {
  if (!introState.controlsHintEl) return;

  clearControlsHintTimer();
  introState.controlsHintEl.classList.remove("hidden");
  introState.controlsHintEl.classList.remove("fading");
  requestAnimationFrame(() => {
    if (!introState.controlsHintEl) return;
    introState.controlsHintEl.classList.add("visible");
  });
  introState.controlsHintVisible = true;
  introState.controlsHintDismissable = false;
}

function requestHideControlsHint() {
  if (!introState.controlsHintEl || !introState.controlsHintVisible) return;
  if (!introState.controlsHintDismissable) return;
  if (introState.controlsHintHideTimer) return;

  introState.controlsHintHideTimer = window.setTimeout(() => {
    introState.controlsHintHideTimer = 0;
    if (!introState.controlsHintEl) return;
    introState.controlsHintEl.classList.add("fading");
    introState.controlsHintFadeTimer = window.setTimeout(() => {
      introState.controlsHintFadeTimer = 0;
      hideControlsHintNow();
    }, INTRO_CONTROL_HINT_FADE_DURATION);
  }, INTRO_CONTROL_HINT_FADE_DELAY);
}

export function handleIntroControlInput(event) {
  if (!event || event.repeat) return false;

  const code = event.code || "";
  const isMoveKey = code === "KeyW"
    || code === "KeyA"
    || code === "KeyS"
    || code === "KeyD"
    || code === "ArrowUp"
    || code === "ArrowLeft"
  || code === "ArrowDown"
  || code === "ArrowRight"
  || code === "Space";

  if (!isMoveKey) return false;

  if (!introState.controlsHintDismissable) return false;
  requestHideControlsHint();
  return true;
}

function setOverlayMode(mode) {
  if (!introState.overlayEl) return;
  introState.overlayEl.classList.toggle("peek", mode === "peek" || mode === "open" || mode === "zoom");
  introState.overlayEl.classList.toggle("open", mode === "open" || mode === "zoom" || mode === "finished");
  introState.overlayEl.classList.toggle("fading", mode === "finished");
}

function setIntroText(text, hidden = false) {
  if (!introState.introTextEl) return;
  const promptText = introState.overlayEl?.querySelector("#prompt-text");
  if (promptText) {
    promptText.textContent = text;
  } else {
    introState.introTextEl.textContent = text;
  }
  introState.introTextEl.classList.toggle("hidden", hidden);
}

function applyZigZagClipPaths() {
  if (!introState.overlayEl) return;

  const p = ([x, y]) => `${x}% ${y}%`;
  const topCP = `polygon(0% 0%, 100% 0%, ${[...ZIGZAG_POINTS].reverse().map(p).join(', ')})`;
  const botCP = `polygon(${ZIGZAG_POINTS.map(p).join(', ')}, 100% 100%, 0% 100%)`;

  if (introState.overlayEl.querySelector(".egg-shell-top")) {
    introState.overlayEl.querySelector(".egg-shell-top").style.clipPath = topCP;
  }
  if (introState.overlayEl.querySelector(".egg-shell-bottom")) {
    introState.overlayEl.querySelector(".egg-shell-bottom").style.clipPath = botCP;
  }
}

export function setCameraBehindGoose(distance, height, sideOffset) {
  const camera = introState.camera;
  if (!camera) return;

  const pose = getIntroCameraPose(distance, height, sideOffset);
  camera.position.copy(pose.position);
  introState.currentLookTarget.copy(pose.target);
  lookAtGooseFront();
  if (introState.controls?.target) {
    introState.controls.target.copy(pose.target);
  }
}

export function lookAtGooseFront() {
  if (!introState.camera) return;
  introState.camera.lookAt(introState.currentLookTarget);
}

export function initIntroCamera() {
  if (!introState.camera) return;

  setCameraBehindGoose(
    INTRO_CAMERA_DISTANCE_START,
    INTRO_CAMERA_HEIGHT_START,
    INTRO_CAMERA_SIDE_OFFSET_START
  );
  console.log("[intro camera] start", {
    position: introState.camera?.position.toArray(),
    target: introState.currentLookTarget.toArray(),
  });
}

function updateCameraZoom(progress) {
  const camera = introState.camera;
  if (!camera || !introState.zoomStart || !introState.zoomEnd || !introState.zoomStartTarget || !introState.zoomEndTarget) return;

  const eased = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const arcAmount = Math.sin(Math.PI * eased) * INTRO_CAMERA_ARC_STRENGTH;
  const arcOffset = getGooseRightDirection().multiplyScalar(arcAmount);
  camera.position.lerpVectors(introState.zoomStart, introState.zoomEnd, eased).add(arcOffset);
  introState.currentLookTarget.lerpVectors(introState.zoomStartTarget, introState.zoomEndTarget, eased);
  camera.lookAt(introState.currentLookTarget);
  if (introState.controls?.target) {
    introState.controls.target.copy(introState.currentLookTarget);
  }
}

function introLoop(now) {
  if (!introState.active || introState.phase !== "zoom") {
    introState.rafId = 0;
    return;
  }

  const elapsed = now - introState.zoomStartedAt;
  const progress = Math.min(elapsed / INTRO_CAMERA_ZOOM_DURATION, 1);
  updateCameraZoom(progress);

  if (progress >= 1) {
    introState.rafId = 0;
    introState.phase = "zoom-complete";
    if (typeof introState.onZoomComplete === "function") {
      introState.onZoomComplete();
      return;
    }
    finishIntro();
    return;
  }

  introState.rafId = window.requestAnimationFrame(introLoop);
}

export function disablePlayerControls() {
  if (introState.controls) {
    introState.controls.enabled = false;
  }
  window.__introBlocking = true;
}

export function enablePlayerControls() {
  if (introState.controls) {
    introState.controls.enabled = true;
  }
  window.__introBlocking = false;
}

export function setPeekState() {
  if (!introState.active || !introState.overlayEl) return;

  introState.phase = "peek";
  playCrackSound(0);
  initIntroCamera();
  introState.overlayEl.classList.remove("open", "fading");
  introState.overlayEl.classList.add("peek");
  setOverlayMode("peek");
  setIntroText("Press Enter again", false);
}

export function openShellFully() {
  if (!introState.active || !introState.overlayEl) return;

  introState.phase = "open";
  playCrackSound(1);
  introState.overlayEl.classList.add("open");
  setOverlayMode("open");
  setIntroText("", true);

  if (introState.backgroundMusic) {
    if (introState.backgroundMusic.paused || introState.backgroundMusic.ended) {
      startBackgroundMusic();
    }
  }

  if (introState.onShellOpened) {
    queueTimer(() => {
      if (introState.active && typeof introState.onShellOpened === "function") {
        introState.onShellOpened();
      }
    }, 1100);
  }
}

export function startIntroCameraZoomOut() {
  if (!introState.active || introState.phase === "zoom") return;

  introState.phase = "zoom";
  disableGameplayCamera();
  setOverlayMode("zoom");

  introState.zoomDelayTimer = window.setTimeout(() => {
    introState.zoomDelayTimer = 0;

    const camera = introState.camera;
    const endPose = {
      position: INTRO_CAMERA_END_POSITION.clone(),
      target: INTRO_CAMERA_END_TARGET.clone(),
    };

    if (camera) {
      introState.zoomStart = camera.position.clone();
      introState.zoomEnd = endPose.position;
      introState.zoomStartTarget = introState.currentLookTarget.clone();
      introState.zoomEndTarget = endPose.target;
      introState.zoomStartedAt = performance.now();
      if (introState.controls?.target) {
        introState.controls.target.copy(introState.zoomStartTarget);
      }
      console.log("[intro camera] end", {
        position: introState.zoomEnd.toArray(),
        target: introState.zoomEndTarget.toArray(),
      });

      if (introState.rafId) {
        window.cancelAnimationFrame(introState.rafId);
      }
      introState.rafId = window.requestAnimationFrame(introLoop);
      return;
    }

    queueTimer(() => finishIntro(), INTRO_CAMERA_ZOOM_DURATION);
  }, INTRO_WORLD_ZOOM_DELAY);
}

export function startCameraZoomOut() {
  return startIntroCameraZoomOut();
}

export function finishIntro() {
  if (!introState.active) return;

  introState.phase = "finished";
  introState.onShellOpened = null;
  introState.onZoomComplete = null;
  clearTimers();

  if (introState.rafId) {
    window.cancelAnimationFrame(introState.rafId);
    introState.rafId = 0;
  }

  if (introState.camera) {
    introState.camera.position.copy(INTRO_CAMERA_END_POSITION);
    introState.camera.lookAt(INTRO_CAMERA_END_TARGET);
  }
  introState.currentLookTarget.copy(INTRO_CAMERA_END_TARGET);
  if (introState.controls?.target) {
    introState.controls.target.copy(INTRO_CAMERA_END_TARGET);
  }
  enableGameplayCamera();

  introState.overlayEl?.remove();
  introState.overlayEl = null;
  introState.introTextEl = null;

  document.documentElement.classList.remove("intro-active");
  document.body.classList.remove("intro-active");

  introState.active = false;
}

export function handleIntroEnter(event) {
  if (!introState.active || !event || event.repeat || event.code !== "Enter") {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();

  if (introState.phase === "waiting") {
    setPeekState();
    return true;
  }

  if (introState.phase === "peek") {
    openShellFully();
    startIntroCameraZoomOut();
    return true;
  }

  return true;
}

export function initEggIntro(options = {}) {
  if (introState.active) {
    return introState;
  }

  introState.camera = resolveValue(options.camera) || resolveValue(window.camera) || null;
  introState.controls = resolveValue(options.controls) || resolveValue(window.controls) || null;
  introState.gooseRef = options.goose || window.goose || window.player || null;
  introState.onShellOpened = typeof options.onShellOpened === "function" ? options.onShellOpened : null;
  introState.onZoomComplete = typeof options.onZoomComplete === "function" ? options.onZoomComplete : null;
  introState.crackSounds = [
    createAudio("./assets/Audio/EggCrack1.mp3", 0.9),
    createAudio("./assets/Audio/EggCrack2.mp3", 0.9),
  ];
  introState.backgroundMusic = createAudio("./assets/Audio/Background_song.mp3", 0.35);
  introState.backgroundMusic.loop = true;

  const dom = createOverlayDom();
  const controlsDom = createControlsHintDom();
  introState.overlayEl = dom.overlayEl;
  introState.introTextEl = dom.introTextEl;
  introState.controlsHintEl = controlsDom;

  document.body.appendChild(introState.overlayEl);
  document.body.appendChild(introState.controlsHintEl);
  document.documentElement.classList.add("intro-active");
  document.body.classList.add("intro-active");

  introState.active = true;
  introState.phase = "waiting";
  applyZigZagClipPaths();
  setOverlayMode("waiting");
  setIntroText("Press Enter", false);
  hideControlsHintNow();
  disableGameplayCamera();
  initIntroCamera();

  return introState;
}

export function initIntro(options = {}) {
  return initEggIntro(options);
}

export function showEggPeek() {
  return setPeekState();
}

export function openEggFully() {
  return openShellFully();
}

export function disableGameplayCamera() {
  return disablePlayerControls();
}

export function enableGameplayCamera() {
  introState.controlsHintDismissable = true;
  console.log("[intro camera] gameplay active", {
    position: introState.camera?.position.toArray(),
    target: introState.controls?.target?.toArray(),
  });
  return enablePlayerControls();
}
