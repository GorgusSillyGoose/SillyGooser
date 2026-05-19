import * as THREE from "three";

const DEFAULT_TALK_DISTANCE = 1.9;
const DEFAULT_DIALOG_TEXT = "Wil je op de bank zitten?";
const DEFAULT_GIF_SRC = new URL("../assets/ui/Dog_talk_102x102.gif", import.meta.url).href;
const FALLBACK_GIF_SRC = DEFAULT_GIF_SRC;
const TYPE_SPEED_DEFAULT = 35;
const TYPEWRITER_NEWLINE_PAUSE = 660;
const DEBUG_SKIP_NAME = "Gooser";

let sharedDialogState = null;

function ensureDialogElements() {
  let promptEl = document.getElementById("npc-dialog-prompt");
  let uiEl = document.getElementById("dog-dialog-ui");

  if (!promptEl) {
    promptEl = document.createElement("div");
    promptEl.id = "npc-dialog-prompt";
    promptEl.className = "dialog-prompt";
    promptEl.textContent = 'Press "E" to talk';
    promptEl.hidden = true;
    document.body.appendChild(promptEl);
  }

  if (!uiEl) {
    uiEl = document.createElement("div");
    uiEl.id = "dog-dialog-ui";
    uiEl.className = "dialog-ui hidden";
    uiEl.innerHTML = `
      <div class="dialog-shell">
        <img src="./assets/ui/Combined_Dialogbox.png" alt="" aria-hidden="true" class="dialog-shell-frame" />
        <div id="dialog-npc-name" class="dialog-npc-name" aria-hidden="true"></div>
        <img src="${DEFAULT_GIF_SRC}" alt="" aria-hidden="true" class="dog-portrait" />

        <p id="dialog-text"></p>
        <div id="dialog-continue" class="dialog-continue hidden">
          <button type="button" class="dialog-action-button dialog-continue-button" data-dialog-action="continue" aria-label="Continue dialog">
            <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">SHIFT</span></span>
            <span class="dialog-hint-label">for continue</span>
          </button>
        </div>
        <div id="dialog-choice" class="dialog-choice hidden">
          <button type="button" class="dialog-action-button dialog-choice-button" data-dialog-action="yes" aria-label="Yes">
            <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">Y</span></span>
            <span class="dialog-hint-label">for yes</span>
          </button>
          <button type="button" class="dialog-action-button dialog-choice-button" data-dialog-action="no" aria-label="No">
            <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">N</span></span>
            <span class="dialog-hint-label">for no</span>
          </button>
        </div>
        <div id="dialog-name-row" class="dialog-name-row hidden">
          <span>Name:</span>
          <input
            id="dialog-name-input"
            class="dialog-name-input"
            type="text"
            maxlength="24"
            autocomplete="off"
            spellcheck="false"
            placeholder="Enter your name..."
          />
          <span>Press Enter</span>
        </div>
      </div>
    `;
    document.body.appendChild(uiEl);
  }

  return {
    promptEl,
    uiEl,
    portraitEl: uiEl.querySelector(".dog-portrait"),
    textEl: uiEl.querySelector("#dialog-text"),
    continueEl: uiEl.querySelector("#dialog-continue"),
    choiceEl: uiEl.querySelector("#dialog-choice"),
    nameplateEl: uiEl.querySelector("#dialog-npc-name"),
    nameRowEl: uiEl.querySelector("#dialog-name-row"),
    nameInputEl: uiEl.querySelector("#dialog-name-input"),
  };
}

function clearDebugSkipTimer(dialogState) {
  if (dialogState?.debugSkipTimer) {
    window.clearTimeout(dialogState.debugSkipTimer);
    dialogState.debugSkipTimer = 0;
  }
}

function queueDebugAdvance(dialogState) {
  if (!dialogState?.debugSkipDialog || !dialogState.isOpen || dialogState.scriptFinished) {
    return;
  }

  clearDebugSkipTimer(dialogState);
  dialogState.debugSkipTimer = window.setTimeout(() => {
    dialogState.debugSkipTimer = 0;
    if (!dialogState.isOpen || dialogState.scriptFinished) return;
    advance(dialogState);
  }, 0);
}

function resolveObject3D(ref) {
  if (typeof ref === "function") {
    try {
      return ref();
    } catch {
      return null;
    }
  }
  return ref || null;
}

export function checkDogProximity(playerObject, dogObject, talkDistance = DEFAULT_TALK_DISTANCE) {
  if (!playerObject || !dogObject) {
    return {
      inRange: false,
      distance: Infinity,
      playerPosition: null,
      dogPosition: null,
    };
  }

  const playerPosition = new THREE.Vector3();
  const dogPosition = new THREE.Vector3();
  playerObject.getWorldPosition(playerPosition);
  dogObject.getWorldPosition(dogPosition);

  const distance = playerPosition.distanceTo(dogPosition);

  return {
    inRange: distance <= talkDistance,
    distance,
    playerPosition,
    npcPosition: dogPosition,
  };
}

function getPromptWorldPosition(npc) {
  const promptObject = resolveObject3D(npc?.promptObject3D)
    || resolveObject3D(npc?.object3D)
    || resolveObject3D(npc?.interactionObject3D);

  if (!promptObject) {
    return null;
  }

  const promptPosition = new THREE.Vector3();
  promptObject.getWorldPosition(promptPosition);

  if (npc?.promptOffset instanceof THREE.Vector3) {
    promptPosition.add(npc.promptOffset);
  }

  return promptPosition;
}

export function startTypewriter(textEl, text, options = {}) {
  const speed = options.speed ?? TYPE_SPEED_DEFAULT;
  const onDone = options.onDone;
  let cancelled = false;
  let index = 0;

  if (!textEl) {
    if (typeof onDone === "function") onDone();
    return () => {
      cancelled = true;
    };
  }

  textEl.textContent = "";

  const tick = () => {
    if (cancelled) return;

    index += 1;
    textEl.textContent = text.slice(0, index);

    if (index < text.length) {
      const delay = text[index - 1] === "\n"
        ? speed + TYPEWRITER_NEWLINE_PAUSE
        : speed;
      window.setTimeout(tick, delay);
    } else if (typeof onDone === "function") {
      onDone();
    }
  };

  window.setTimeout(tick, speed);

  return () => {
    cancelled = true;
  };
}

export function showInteractPrompt(promptEl, visible) {
  if (!promptEl) return;
  promptEl.hidden = !visible;
  promptEl.setAttribute("aria-hidden", visible ? "false" : "true");
}

function setInteractPromptText(promptEl, text) {
  if (!promptEl) return;
  promptEl.textContent = text || 'Press "E" to talk';
}

function positionPrompt(dialogState, worldPosition) {
  const { promptEl, camera } = dialogState.elements;
  if (!promptEl || !worldPosition || !camera) return;

  const screenPos = worldPosition.clone().project(camera);
  const x = ((screenPos.x + 1) / 2) * window.innerWidth;
  const y = ((-screenPos.y + 1) / 2) * window.innerHeight - 150;

  promptEl.style.left = `${x}px`;
  promptEl.style.top = `${y}px`;
}

function setFallbackPromptPosition(promptEl) {
  if (!promptEl) return;
  promptEl.style.left = "50%";
  promptEl.style.top = "calc(100vh - 284px)";
  promptEl.style.transform = "translateX(-50%)";
}

function normalizeStep(step) {
  if (typeof step === "string") {
    return { type: "line", text: step };
  }

  const normalizeBranch = (branch) => {
    if (Array.isArray(branch)) {
      return branch.map(normalizeStep);
    }
    if (typeof branch === "string") {
      return branch;
    }
    return branch || null;
  };

  return {
    type: step?.type || "line",
    text: step?.text || "",
    placeholder: step?.placeholder || "Enter your name...",
    speed: step?.speed,
    onYes: normalizeBranch(step?.onYes),
    onNo: normalizeBranch(step?.onNo),
    options: Array.isArray(step?.options)
      ? step.options.map((option) => ({
        text: option?.text || option?.label || "Option",
        next: normalizeBranch(option?.next),
      }))
      : null,
  };
}

function defaultScript() {
  return [
    "Wil je op de bank zitten?",
  ];
}

function playSentenceSound(dialogState) {
  const audioEl = dialogState.sentenceAudioEl;
  if (!audioEl) return;

  try {
    audioEl.currentTime = 0;
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore playback errors, especially on browsers that block autoplay.
  }
}

function updateContinueHint(dialogState, visible) {
  const { continueEl } = dialogState.elements;
  if (!continueEl) return;
  continueEl.hidden = !visible;
  continueEl.classList.toggle("is-visible", visible);
  continueEl.classList.toggle("hidden", !visible);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateChoiceHint(dialogState, visible) {
  const { choiceEl } = dialogState.elements;
  if (!choiceEl) return;
  choiceEl.hidden = !visible;
  choiceEl.classList.toggle("is-visible", visible);
  choiceEl.classList.toggle("hidden", !visible);

  if (!visible) return;

  const step = dialogState.activeScript?.[dialogState.activeStepIndex];
  if (step?.options?.length) {
    choiceEl.innerHTML = step.options.map((option, index) => `
    <button type="button" class="dialog-action-button dialog-choice-button dialog-option-button" data-choice-index="${index}" aria-label="${escapeHtml(option.text)}">
        <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">${index + 1}</span></span>
        <span class="dialog-hint-label">${escapeHtml(option.text)}</span>
      </button>
    `).join("");
    return;
  }

  choiceEl.innerHTML = `
    <button type="button" class="dialog-action-button dialog-choice-button" data-dialog-action="yes" aria-label="Yes">
      <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">Y</span></span>
      <span class="dialog-hint-label">for yes</span>
    </button>
    <button type="button" class="dialog-action-button dialog-choice-button" data-dialog-action="no" aria-label="No">
      <span class="dialog-keycap" aria-hidden="true"><span class="dialog-keycap-text">N</span></span>
      <span class="dialog-hint-label">for no</span>
    </button>
  `;
}

function handleDialogButtonClick(dialogState, event) {
  if (!dialogState?.isOpen) return false;

  const button = event?.target?.closest?.(".dialog-action-button");
  if (!button) return false;

  if (button.dataset.dialogAction === "continue") {
    const currentStep = dialogState.activeScript?.[dialogState.activeStepIndex];
    if (currentStep?.type === "choice") return false;
    event.preventDefault();
    advance(dialogState);
    return true;
  }

  if (button.dataset.dialogAction === "yes") {
    const currentStep = dialogState.activeScript?.[dialogState.activeStepIndex];
    if (currentStep?.type !== "choice" || !currentStep?.onYes) return false;
    event.preventDefault();
    applyBranch(dialogState, currentStep.onYes);
    return true;
  }

  if (button.dataset.dialogAction === "no") {
    const currentStep = dialogState.activeScript?.[dialogState.activeStepIndex];
    if (currentStep?.type !== "choice" || !currentStep?.onNo) return false;
    event.preventDefault();
    applyBranch(dialogState, currentStep.onNo);
    return true;
  }

  if (button.dataset.choiceIndex != null) {
    const index = Number(button.dataset.choiceIndex);
    if (Number.isNaN(index)) return false;
    event.preventDefault();
    return chooseDialogOption(dialogState, index);
  }

  return false;
}

function setButtonPressed(dialogState, selector, pressed) {
  const { continueEl, choiceEl } = dialogState.elements;
  const button = (continueEl?.querySelector(selector)) || (choiceEl?.querySelector(selector));
  if (!button) return false;
  button.classList.toggle("is-pressed", pressed);
  return true;
}

function setContinueButtonPressed(dialogState, pressed) {
  setButtonPressed(dialogState, '[data-dialog-action="continue"]', pressed);
}

function setChoiceButtonPressed(dialogState, selector, pressed) {
  setButtonPressed(dialogState, selector, pressed);
}

function clearChoiceButtonPressed(dialogState) {
  const { choiceEl } = dialogState.elements;
  if (!choiceEl) return;
  choiceEl.querySelectorAll(".dialog-action-button.is-pressed").forEach((button) => {
    button.classList.remove("is-pressed");
  });
}

function setNameInputVisible(dialogState, visible) {
  const { nameRowEl } = dialogState.elements;
  if (!nameRowEl) return;
  nameRowEl.hidden = !visible;
  nameRowEl.classList.toggle("hidden", !visible);
}

function renderStep(dialogState) {
  const step = dialogState.activeScript?.[dialogState.activeStepIndex];
  const { textEl, portraitEl, nameInputEl } = dialogState.elements;

  if (!step) {
    dialogState.scriptFinished = true;
    setNameInputVisible(dialogState, false);
    updateContinueHint(dialogState, false);
    updateChoiceHint(dialogState, false);
    clearChoiceButtonPressed(dialogState);
    if (textEl) textEl.textContent = "";
    return;
  }

  if (dialogState.cancelTyping) {
    dialogState.cancelTyping();
    dialogState.cancelTyping = null;
  }

  if (step.type === "name") {
    if (dialogState.debugSkipDialog) {
      dialogState.awaitingName = false;
      setNameInputVisible(dialogState, false);
      updateContinueHint(dialogState, false);
      updateChoiceHint(dialogState, false);
      clearChoiceButtonPressed(dialogState);
      if (textEl) textEl.textContent = "";
      dialogState.playerName = dialogState.debugPlayerName || DEBUG_SKIP_NAME;
      dialogState.activeStepIndex += 1;
      renderStep(dialogState);
      return;
    }

    dialogState.awaitingName = true;
    setNameInputVisible(dialogState, true);
    updateContinueHint(dialogState, false);
    updateChoiceHint(dialogState, false);
    clearChoiceButtonPressed(dialogState);
    if (nameInputEl) {
      nameInputEl.value = "";
      nameInputEl.placeholder = step.placeholder || "Enter your name...";
      window.setTimeout(() => {
        nameInputEl.focus();
      }, 0);
    }
    if (textEl) textEl.textContent = step.text || "What’s your name, stranger?";
    return;
  }

  dialogState.awaitingName = false;
  setNameInputVisible(dialogState, false);
  updateContinueHint(dialogState, false);
  updateChoiceHint(dialogState, false);
  clearChoiceButtonPressed(dialogState);

  const rawText = step.text || "";
  const text = rawText.replace(/\{playerName\}/g, dialogState.playerName || "Gooser");

  if (dialogState.debugSkipDialog) {
    if (step.type === "choice") {
      if (textEl) textEl.textContent = "";
      updateChoiceHint(dialogState, true);
      return;
    }

    if (textEl) textEl.textContent = "";
    queueDebugAdvance(dialogState);
    return;
  }

  if (step.type === "line") {
    playSentenceSound(dialogState);
  }

  dialogState.cancelTyping = startTypewriter(textEl, text, {
    speed: step.speed ?? dialogState.typeSpeed ?? TYPE_SPEED_DEFAULT,
    onDone: () => {
      dialogState.cancelTyping = null;
      if (step.type === "choice") {
        updateChoiceHint(dialogState, true);
      } else {
        updateContinueHint(dialogState, true);
      }
    },
  });
}

function applyBranch(dialogState, branch) {
  if (typeof branch === "function") {
    const result = branch(dialogState);
    if (Array.isArray(result)) {
      branch = result;
    } else if (typeof result === "string") {
      branch = dialogState.routes?.[result] || null;
    } else {
      branch = null;
    }
  }

  if (typeof branch === "string") {
    branch = dialogState.routes?.[branch] || null;
  }

  if (!Array.isArray(branch) || branch.length === 0) {
    closeDogDialog(dialogState);
    return;
  }

  dialogState.postCloseAction = typeof branch.postClose === "function"
    ? branch.postClose
    : null;
  dialogState.activeScript = branch.map(normalizeStep);
  dialogState.activeStepIndex = 0;
  dialogState.scriptFinished = false;
  dialogState.awaitingName = false;
  clearDebugSkipTimer(dialogState);
  renderStep(dialogState);
}

function chooseDialogOption(dialogState, index) {
  const step = dialogState.activeScript?.[dialogState.activeStepIndex];
  const option = step?.options?.[index];
  if (!option) return false;

  applyBranch(dialogState, option.next);
  return true;
}

function getChoiceIndexFromEvent(event) {
  if (!event) return null;

  const code = event.code || "";
  if (code.startsWith("Digit")) {
    const parsed = Number.parseInt(code.slice(5), 10);
    return Number.isNaN(parsed) ? null : parsed - 1;
  }

  if (code.startsWith("Numpad")) {
    const parsed = Number.parseInt(code.slice(6), 10);
    return Number.isNaN(parsed) ? null : parsed - 1;
  }

  if (/^[1-9]$/.test(event.key || "")) {
    return Number.parseInt(event.key, 10) - 1;
  }

  return null;
}

function advance(dialogState) {
  if (!dialogState.isOpen || dialogState.scriptFinished) {
    return false;
  }

  if (dialogState.awaitingName) {
    if (dialogState.debugSkipDialog) {
      dialogState.playerName = dialogState.debugPlayerName || DEBUG_SKIP_NAME;
      dialogState.activeStepIndex += 1;
      renderStep(dialogState);
      return true;
    }

    const typedName = (dialogState.elements.nameInputEl?.value || "").trim();
    if (!typedName) return true;

    dialogState.playerName = typedName;
    dialogState.activeStepIndex += 1;
    renderStep(dialogState);
    return true;
  }

  if (dialogState.cancelTyping) {
    const step = dialogState.activeScript?.[dialogState.activeStepIndex];
    const { textEl } = dialogState.elements;
    dialogState.cancelTyping();
    dialogState.cancelTyping = null;
    if (step && textEl) {
      textEl.textContent = (step.text || "").replace(/\{playerName\}/g, dialogState.playerName || "Gooser");
    }
    if (step?.type === "choice") {
      updateChoiceHint(dialogState, true);
    } else {
      updateContinueHint(dialogState, true);
    }
    return true;
  }

  dialogState.activeStepIndex += 1;
  if (dialogState.activeStepIndex >= dialogState.activeScript.length) {
    closeDogDialog(dialogState);
    return true;
  }

  renderStep(dialogState);
  return true;
}

function findNearestDog(dialogState) {
  const { playerRef, npcEntries, defaultTalkDistance } = dialogState;
  if (!playerRef || npcEntries.length === 0) return null;

  let closest = null;

  for (const npc of npcEntries) {
    const targetObject = resolveObject3D(npc.interactionObject3D) || resolveObject3D(npc.object3D);
    if (!targetObject) continue;

    const proximity = checkDogProximity(
      playerRef,
      targetObject,
      npc.talkDistance ?? defaultTalkDistance
    );

    if (!proximity.inRange) continue;

    if (!closest || proximity.distance < closest.distance) {
      closest = { ...npc, ...proximity };
    }
  }

  return closest;
}

export function openDogDialog(text, options = {}) {
  const state = options.state || sharedDialogState;
  if (!state) return false;

  clearDebugSkipTimer(state);

  const { uiEl, portraitEl, textEl, continueEl, choiceEl, nameplateEl, nameInputEl } = state.elements;
  state.activeScript = Array.isArray(text) ? text.map(normalizeStep) : [normalizeStep(text || DEFAULT_DIALOG_TEXT)];
  state.activeStepIndex = 0;
  state.scriptFinished = false;
  state.awaitingName = false;
  state.isOpen = true;
  state.activeNpcName = options.npcName || options.name || state.currentPromptNpc?.name || "";
  state.sentenceSoundSrc = options.sentenceSoundSrc || state.sentenceSoundSrc || null;
  state.routes = options.dialogRoutes || {};
  state.postCloseAction = options.postCloseAction || null;
  if (state.sentenceSoundSrc) {
    state.sentenceAudioEl = state.sentenceAudioEl || new Audio(state.sentenceSoundSrc);
    state.sentenceAudioEl.src = state.sentenceSoundSrc;
    state.sentenceAudioEl.preload = "auto";
    state.sentenceAudioEl.volume = 0.9;
  } else {
    state.sentenceAudioEl = null;
  }

  if (uiEl) uiEl.classList.remove("hidden");
  setContinueButtonPressed(state, false);
  if (nameplateEl) {
    nameplateEl.textContent = state.activeNpcName;
    nameplateEl.hidden = !state.activeNpcName;
  }
  if (portraitEl) {
    portraitEl.src = options.gifSrc || DEFAULT_GIF_SRC;
    portraitEl.onerror = () => {
      portraitEl.onerror = null;
      portraitEl.src = FALLBACK_GIF_SRC;
    };
  }
  if (textEl) textEl.textContent = "";
  if (continueEl) continueEl.hidden = true;
  if (choiceEl) choiceEl.hidden = true;
  setNameInputVisible(state, false);
  if (nameInputEl) nameInputEl.value = "";

  renderStep(state);
  return true;
}

export function closeDogDialog(state = sharedDialogState) {
  if (!state) return;

  state.isOpen = false;
  state.activeStepIndex = 0;
  state.scriptFinished = false;
  state.awaitingName = false;
  state.playerName = "";
  state.activeNpcName = "";
  clearChoiceButtonPressed(state);
  clearDebugSkipTimer(state);

  if (state.cancelTyping) {
    state.cancelTyping();
    state.cancelTyping = null;
  }

  const { uiEl, textEl, continueEl, choiceEl, nameplateEl, nameInputEl } = state.elements;
  if (uiEl) uiEl.classList.add("hidden");
  if (textEl) textEl.textContent = "";
  if (continueEl) continueEl.hidden = true;
  if (choiceEl) choiceEl.hidden = true;
  setContinueButtonPressed(state, false);
  clearChoiceButtonPressed(state);
  if (nameplateEl) {
    nameplateEl.textContent = "";
    nameplateEl.hidden = true;
  }
  setNameInputVisible(state, false);
  if (nameInputEl) nameInputEl.value = "";

  const postCloseAction = state.postCloseAction;
  state.postCloseAction = null;
  if (typeof postCloseAction === "function") {
    window.setTimeout(() => {
      postCloseAction();
    }, 0);
  }
}

export function createDialogSystem(options = {}) {
  const elements = ensureDialogElements();
  const dialogState = {
    elements: {
      ...elements,
      camera: options.camera || null,
    },
    playerRef: options.player || null,
    camera: options.camera || null,
    npcEntries: [],
    defaultTalkDistance: options.talkDistance ?? DEFAULT_TALK_DISTANCE,
    isOpen: false,
    activeStepIndex: 0,
    activeScript: [],
    scriptFinished: false,
    awaitingName: false,
    playerName: "",
    activeNpcName: "",
    cancelTyping: null,
    typeSpeed: options.typeSpeed ?? TYPE_SPEED_DEFAULT,
    sentenceSoundSrc: options.sentenceSoundSrc || null,
    sentenceAudioEl: null,
    routes: options.dialogRoutes || {},
    postCloseAction: null,
    debugSkipDialog: Boolean(options.debugSkipDialog),
    debugPlayerName: options.debugPlayerName || DEBUG_SKIP_NAME,
    debugSkipTimer: 0,
  };

  sharedDialogState = dialogState;

  if (dialogState.elements.nameInputEl) {
    dialogState.elements.nameInputEl.addEventListener("keydown", (event) => {
      if (!dialogState.isOpen || !dialogState.awaitingName) return;

      event.stopPropagation();

      if (event.code === "Enter") {
        event.preventDefault();
        advance(dialogState);
      } else if (event.code === "Escape") {
        event.preventDefault();
        closeDogDialog(dialogState);
      }
    });
  }

  if (dialogState.elements.continueEl) {
    dialogState.elements.continueEl.addEventListener("click", (event) => {
      handleDialogButtonClick(dialogState, event);
    });
  }

  if (dialogState.elements.choiceEl) {
    dialogState.elements.choiceEl.addEventListener("click", (event) => {
      handleDialogButtonClick(dialogState, event);
    });
  }

  function registerNpc(npcConfig) {
    const entry = {
      id: npcConfig.id || npcConfig.name || `npc-${dialogState.npcEntries.length + 1}`,
      name: npcConfig.name || npcConfig.id || "NPC",
      object3D: npcConfig.object3D || null,
      interactionObject3D: npcConfig.interactionObject3D || npcConfig.object3D || null,
      promptObject3D: npcConfig.promptObject3D || null,
      promptOffset: npcConfig.promptOffset || null,
      talkDistance: npcConfig.talkDistance ?? dialogState.defaultTalkDistance,
      dialogText: npcConfig.dialogText || DEFAULT_DIALOG_TEXT,
      gifSrc: npcConfig.gifSrc || DEFAULT_GIF_SRC,
      promptText: npcConfig.promptText || null,
      typeSpeed: npcConfig.typeSpeed ?? TYPE_SPEED_DEFAULT,
      dialogScript: npcConfig.dialogScript || null,
      dialogRoutes: npcConfig.dialogRoutes || null,
      sentenceSoundSrc: npcConfig.sentenceSoundSrc || null,
      onInteract: npcConfig.onInteract || null,
    };

    dialogState.npcEntries.push(entry);
    return entry;
  }

  function setPlayer(playerObject) {
    dialogState.playerRef = playerObject;
  }

  function update() {
    const nearestNpc = findNearestDog(dialogState);
    const musicGameUnlocked = Boolean(dialogState.playerRef?.userData?.musicGamePromptsUnlocked);
    const promptRequiresUnlock = nearestNpc
      && (nearestNpc.id === "gramophone" || nearestNpc.id === "arcade");
    const visiblePromptNpc = promptRequiresUnlock && !musicGameUnlocked
      ? null
      : nearestNpc;

    dialogState.currentPromptNpc = visiblePromptNpc;

    if (dialogState.isOpen) {
      showInteractPrompt(dialogState.elements.promptEl, false);
      return;
    }

    setInteractPromptText(dialogState.elements.promptEl, visiblePromptNpc?.promptText || 'Press "E" to talk');
    showInteractPrompt(dialogState.elements.promptEl, Boolean(visiblePromptNpc));
    const promptWorldPosition = getPromptWorldPosition(visiblePromptNpc);
    if (promptWorldPosition) {
      positionPrompt(dialogState, promptWorldPosition);
    } else if (dialogState.elements.promptEl && !dialogState.isOpen) {
      setFallbackPromptPosition(dialogState.elements.promptEl);
    }
  }

  function handleKeyDown(event) {
    if (!event || event.repeat) return false;

    const isTypingName = Boolean(
      dialogState.isOpen
      && dialogState.awaitingName
      && event.target === dialogState.elements.nameInputEl
    );

    if (isTypingName) {
      if (event.code === "Enter") {
        event.preventDefault();
        advance(dialogState);
      } else if (event.code === "Escape") {
        event.preventDefault();
        closeDogDialog(dialogState);
      }
      return true;
    }

    const currentStep = dialogState.activeScript?.[dialogState.activeStepIndex];
    if (dialogState.isOpen && currentStep?.type === "choice") {
      if (currentStep.options?.length) {
        const choiceIndex = getChoiceIndexFromEvent(event);
        if (!Number.isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < currentStep.options.length) {
          event.preventDefault();
          setChoiceButtonPressed(dialogState, `[data-choice-index="${choiceIndex}"]`, true);
          return true;
        }
      }
      if (event.code === "KeyY") {
        event.preventDefault();
        setChoiceButtonPressed(dialogState, '[data-dialog-action="yes"]', true);
        return true;
      }
      if (event.code === "KeyN") {
        event.preventDefault();
        setChoiceButtonPressed(dialogState, '[data-dialog-action="no"]', true);
        return true;
      }
    }

    if (
      dialogState.isOpen
      && (event.code === "ShiftLeft" || event.code === "ShiftRight")
      && currentStep?.type !== "choice"
    ) {
      event.preventDefault();
      setContinueButtonPressed(dialogState, true);
      return true;
    }

    if (dialogState.isOpen && event.code === "KeyE") {
      event.preventDefault();
      return true;
    }

    if (event.code === "KeyE") {
      if (dialogState.currentPromptNpc) {
        event.preventDefault();
        const npc = dialogState.currentPromptNpc;
        if (typeof npc.onInteract === "function") {
          const handled = npc.onInteract(dialogState, npc);
          if (handled !== false) {
            return true;
          }
        }
        const rawScript = typeof npc.dialogScript === "function"
          ? npc.dialogScript(dialogState)
          : npc.dialogScript;
        const script = rawScript || [
          "Wil je op de bank zitten?",
        ];
        openDogDialog(script, {
          state: dialogState,
          npcName: npc.name,
          gifSrc: npc.gifSrc,
          sentenceSoundSrc: npc.sentenceSoundSrc,
          dialogRoutes: npc.dialogRoutes,
        });
        if (npc.id === "dog" && npc.object3D?.userData) {
          npc.object3D.userData.hasMetDog = true;
        }
        return true;
      }

      return false;
    }

    if (event.code === "Escape" && dialogState.isOpen) {
      event.preventDefault();
      closeDogDialog(dialogState);
      return true;
    }

    return false;
  }

  function handleKeyUp(event) {
    if (!event) return false;

    if (!dialogState.isOpen) {
      return false;
    }

    const currentStep = dialogState.activeScript?.[dialogState.activeStepIndex];
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      if (currentStep?.type === "choice") {
        setContinueButtonPressed(dialogState, false);
        return false;
      }

      event.preventDefault();
      setContinueButtonPressed(dialogState, false);
      advance(dialogState);
      return true;
    }

    if (currentStep?.type === "choice") {
      if (currentStep.options?.length) {
        const choiceIndex = getChoiceIndexFromEvent(event);
        if (!Number.isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < currentStep.options.length) {
          event.preventDefault();
          clearChoiceButtonPressed(dialogState);
          return chooseDialogOption(dialogState, choiceIndex);
        }
      }

      if (event.code === "KeyY") {
        event.preventDefault();
        clearChoiceButtonPressed(dialogState);
        if (currentStep.onYes) {
          applyBranch(dialogState, currentStep.onYes);
          return true;
        }
        return false;
      }

      if (event.code === "KeyN") {
        event.preventDefault();
        clearChoiceButtonPressed(dialogState);
        if (currentStep.onNo) {
          applyBranch(dialogState, currentStep.onNo);
          return true;
        }
        return false;
      }
    }

    return false;
  }

  return {
    registerNpc,
    setPlayer,
    update,
    handleKeyDown,
    handleKeyUp,
    openDogDialog: (text, options = {}) => openDogDialog(text, { ...options, state: dialogState }),
    closeDogDialog: () => closeDogDialog(dialogState),
    isOpen: () => dialogState.isOpen,
    getActiveNpc: () => dialogState.currentPromptNpc,
  };
}
