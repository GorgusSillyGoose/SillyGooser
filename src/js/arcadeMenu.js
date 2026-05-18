const ARCADE_CABINET_SRC = new URL("../assets/ui/Arcade.png", import.meta.url).href;
const ARROW_HINT_SRC = new URL("../assets/ui/Arrow.png", import.meta.url).href;
const WASD_HINT_SRC = new URL("../assets/ui/WASD.png", import.meta.url).href;
const SCROLLBAR_SRC = new URL("../assets/ui/ScrollBar.png", import.meta.url).href;
const SCROLLER_SRC = new URL("../assets/ui/Scroller_indicator.png", import.meta.url).href;
const CLOSE_PRESSED_SRC = new URL("../assets/ui/Close_pressed.png", import.meta.url).href;
const RED_BUTTON_PRESSED_SRC = new URL("../assets/ui/Red_Arcade_button_pressed.png", import.meta.url).href;
const RED_BUTTON_SRC = new URL("../assets/ui/Red_Arcade_button.png", import.meta.url).href;
const CLOSE_SRC = new URL("../assets/ui/Close.png", import.meta.url).href;
const PACMAN_GAME_SRC = new URL("../games/pacman/index.html", import.meta.url).href;

const GAMES = [
  {
    id: "gulu-gooser",
    title: "Gulu Gooser",
    badge: "Playable",
    preview: "Launch the local Pacman build inside the arcade frame.",
    frameText: "Pacman is loaded inside the arcade cabinet.",
    frameSrc: PACMAN_GAME_SRC,
  },
  {
    id: "coming-soon",
    title: "Coming soon",
    badge: "Locked",
    preview: "This cabinet slot is waiting for the next game.",
    frameText: "Coming soon",
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createArcadeMenu(options = {}) {
  const root = document.createElement("section");
  root.className = "arcade-ui hidden";
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("role", "dialog");
  root.dataset.screen = "menu";
  document.body.appendChild(root);

  const state = {
    open: false,
    screen: "menu",
    selectedIndex: 0,
    closePressed: false,
    startPressed: false,
  };

  function getCloseIcon() {
    return root.querySelector(".arcade-ui-close img");
  }

  function setClosePressed(isPressed) {
    state.closePressed = Boolean(isPressed);
    const closeIcon = getCloseIcon();
    if (!closeIcon) return;
    closeIcon.src = state.closePressed ? CLOSE_PRESSED_SRC : CLOSE_SRC;
  }

  function getStartIcon() {
    return root.querySelector(".arcade-ui-start-button img");
  }

  function setStartPressed(isPressed) {
    state.startPressed = Boolean(isPressed);
    const startIcon = getStartIcon();
    if (!startIcon) return;
    startIcon.src = state.startPressed ? RED_BUTTON_PRESSED_SRC : RED_BUTTON_SRC;
  }

  function getSelectedGame() {
    return GAMES[state.selectedIndex] || GAMES[0];
  }

  function renderMenu() {
    const selectedGame = getSelectedGame();
    const count = GAMES.length;
    const thumbTop = count <= 1
      ? 50
      : 18 + (state.selectedIndex / (count - 1)) * 64;

    root.innerHTML = `
      <div class="arcade-ui-backdrop" aria-hidden="true"></div>
      <div class="arcade-ui-panel arcade-ui-panel-menu">
        <div class="arcade-ui-cabinet-shell">
          <div class="arcade-ui-screen">
            <div class="arcade-ui-screen-header">
              <div class="arcade-ui-screen-kicker">Arcade Menu</div>
              <div class="arcade-ui-screen-title">Pick a game</div>
            </div>
            <div class="arcade-ui-list-shell">
              <div class="memory-statistics-custom-scrollbar arcade-ui-scrollbar" aria-hidden="true">
                <div class="memory-statistics-custom-scrollbar-track arcade-ui-scrollbar-track"></div>
                <div
                  class="memory-statistics-custom-scrollbar-thumb arcade-ui-scrollbar-thumb"
                  style="top: ${thumbTop}%;"
                ></div>
              </div>
              <div class="arcade-ui-list" role="listbox" aria-label="Arcade games">
                ${GAMES.map((game, index) => `
                  <button
                    type="button"
                    class="arcade-ui-item ${index === state.selectedIndex ? "is-selected" : ""}"
                    data-arcade-action="select"
                    data-game-index="${index}"
                    role="option"
                    aria-selected="${index === state.selectedIndex ? "true" : "false"}"
                  >
                    <span class="arcade-ui-item-marker" aria-hidden="true">${index === state.selectedIndex ? "▶" : "•"}</span>
                    <span class="arcade-ui-item-copy">
                      <span class="arcade-ui-item-title">${escapeHtml(game.title)}</span>
                      <span class="arcade-ui-item-badge">${escapeHtml(game.badge)}</span>
                    </span>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="arcade-ui-preview">
              <div class="arcade-ui-preview-title">${escapeHtml(selectedGame.title)}</div>
              <div class="arcade-ui-preview-text">${escapeHtml(selectedGame.preview)}</div>
            </div>
          </div>
          <button type="button" class="arcade-ui-start-button" data-arcade-action="start" aria-label="Start selected game">
            <img src="${RED_BUTTON_SRC}" alt="" aria-hidden="true" class="arcade-ui-start-button-art" draggable="false" />
          </button>
          <img class="arcade-ui-cabinet-image" src="${ARCADE_CABINET_SRC}" alt="" aria-hidden="true" draggable="false" />
          <button type="button" class="arcade-ui-close" data-arcade-action="close" aria-label="Close arcade">
            <img src="${CLOSE_SRC}" alt="" aria-hidden="true" draggable="false" />
          </button>
        </div>
        <div class="arcade-ui-hints">
          <div class="arcade-ui-hint-card">
            <div class="arcade-ui-hint-icons">
              <img src="${ARROW_HINT_SRC}" alt="" aria-hidden="true" class="arcade-ui-hint-icon arcade-ui-hint-icon-arrows" />
              <img src="${WASD_HINT_SRC}" alt="" aria-hidden="true" class="arcade-ui-hint-icon arcade-ui-hint-icon-wasd" />
            </div>
            <div class="arcade-ui-hint-copy">
              <span class="arcade-ui-hint-title">Move</span>
              <span class="arcade-ui-hint-text">Arrows or WASD to select</span>
            </div>
          </div>
          <div class="arcade-ui-hint-card">
            <div class="arcade-ui-hint-icons arcade-ui-hint-scroll-icons">
              <img src="${SCROLLBAR_SRC}" alt="" aria-hidden="true" class="arcade-ui-hint-icon arcade-ui-hint-icon-scrollbar" />
              <img src="${SCROLLER_SRC}" alt="" aria-hidden="true" class="arcade-ui-hint-icon arcade-ui-hint-icon-scroller" />
            </div>
            <div class="arcade-ui-hint-copy">
              <span class="arcade-ui-hint-title">Scroll</span>
              <span class="arcade-ui-hint-text">Mouse wheel to scroll</span>
            </div>
          </div>
          <div class="arcade-ui-hint-card">
            <div class="arcade-ui-hint-icons">
              <img src="${RED_BUTTON_SRC}" alt="" aria-hidden="true" class="arcade-ui-hint-icon arcade-ui-hint-icon-red" />
            </div>
            <div class="arcade-ui-hint-copy">
              <span class="arcade-ui-hint-title">Start</span>
              <span class="arcade-ui-hint-text">Enter or red button to start</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderGameFrame() {
    const selectedGame = getSelectedGame();
    const isPacmanGame = selectedGame.id === "gulu-gooser" && Boolean(selectedGame.frameSrc);

    root.innerHTML = `
      <div class="arcade-ui-backdrop" aria-hidden="true"></div>
      <div class="arcade-ui-panel arcade-ui-panel-game">
        <button type="button" class="arcade-ui-close arcade-ui-close-game" data-arcade-action="close" aria-label="Close arcade">
          <img src="${CLOSE_SRC}" alt="" aria-hidden="true" draggable="false" />
        </button>
        <div class="arcade-ui-game-card ${isPacmanGame ? "arcade-ui-game-card-pacman" : ""}">
          <div class="arcade-ui-game-header">
            <div class="arcade-ui-game-kicker">Arcade Frame</div>
            <div class="arcade-ui-game-title">${escapeHtml(selectedGame.title)}</div>
          </div>
          <div class="arcade-ui-game-body">
            ${
              isPacmanGame
                ? `
                  <div class="arcade-ui-game-stage">
                    <iframe
                      class="arcade-ui-game-iframe"
                      src="${escapeHtml(selectedGame.frameSrc)}"
                      title="${escapeHtml(selectedGame.title)} game"
                      allow="autoplay; fullscreen; gamepad"
                      loading="eager"
                      tabindex="0"
                    ></iframe>
                  </div>
                  <div class="arcade-ui-game-copy arcade-ui-game-copy-frame">
                    <div class="arcade-ui-game-message">${escapeHtml(selectedGame.frameText)}</div>
                    <div class="arcade-ui-game-subtext">Later we can swap the sound and Pacman art inside <code>src/games/pacman/</code>.</div>
                    <button type="button" class="arcade-ui-back-button" data-arcade-action="back">
                      <span class="arcade-ui-back-button-title">Back to list</span>
                      <span class="arcade-ui-back-button-subtitle">Escape returns here</span>
                    </button>
                  </div>
                `
                : `
                  <div class="arcade-ui-game-copy">
                    <div class="arcade-ui-game-message">${escapeHtml(selectedGame.frameText)}</div>
                    <div class="arcade-ui-game-subtext">We will build the actual game here later.</div>
                    <button type="button" class="arcade-ui-back-button" data-arcade-action="back">
                      <span class="arcade-ui-back-button-title">Back to list</span>
                      <span class="arcade-ui-back-button-subtitle">Escape returns here</span>
                    </button>
                  </div>
                `
            }
          </div>
        </div>
      </div>
    `;

    if (isPacmanGame) {
      const iframe = root.querySelector(".arcade-ui-game-iframe");
      if (iframe instanceof HTMLIFrameElement) {
        requestAnimationFrame(() => {
          iframe.focus();
        });
      }
    }
  }

  function render() {
    if (!state.open) {
      root.classList.add("hidden");
      root.setAttribute("aria-hidden", "true");
      root.dataset.screen = "menu";
      state.closePressed = false;
      state.startPressed = false;
      return;
    }

    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
    root.dataset.screen = state.screen;

    if (state.screen === "game") {
      renderGameFrame();
    } else {
      renderMenu();
    }

    setClosePressed(state.closePressed);
    setStartPressed(state.startPressed);
  }

  function selectGame(index) {
    const nextIndex = clamp(index, 0, GAMES.length - 1);
    if (nextIndex === state.selectedIndex) {
      return;
    }

    state.selectedIndex = nextIndex;
    render();
  }

  function moveSelection(delta) {
    if (!delta) return;
    const nextIndex = clamp(state.selectedIndex + delta, 0, GAMES.length - 1);
    selectGame(nextIndex);
  }

  function startSelectedGame() {
    state.screen = "game";
    render();
    return true;
  }

  function backToMenu() {
    state.screen = "menu";
    render();
    return true;
  }

  function open() {
    if (state.open) {
      return true;
    }

    state.open = true;
    state.screen = "menu";
    state.selectedIndex = 0;
    state.closePressed = false;
    state.startPressed = false;
    render();
    if (typeof options.onOpen === "function") {
      options.onOpen(state);
    }
    return true;
  }

  function close() {
    if (!state.open) {
      return false;
    }

    state.open = false;
    state.screen = "menu";
    state.closePressed = false;
    state.startPressed = false;
    render();
    if (typeof options.onClose === "function") {
      options.onClose(state);
    }
    return true;
  }

  function handleKeyDown(event) {
    if (!state.open || !event) return false;

    const code = event.code || "";
    const handledNavigation = (
      code === "ArrowUp"
      || code === "ArrowDown"
      || code === "ArrowLeft"
      || code === "ArrowRight"
      || code === "KeyW"
      || code === "KeyA"
      || code === "KeyS"
      || code === "KeyD"
    );

    if (state.screen === "menu") {
      if (handledNavigation) {
        event.preventDefault();
        if (code === "ArrowUp" || code === "ArrowLeft" || code === "KeyW" || code === "KeyA") {
          moveSelection(-1);
        } else {
          moveSelection(1);
        }
        return true;
      }

      if (code === "Enter" || code === "NumpadEnter") {
        event.preventDefault();
        startSelectedGame();
        return true;
      }

      if (code === "Escape") {
        event.preventDefault();
        close();
        return true;
      }

      event.preventDefault();
      return true;
    }

    if (state.screen === "game") {
      if (code === "Escape" || code === "Backspace") {
        event.preventDefault();
        backToMenu();
        return true;
      }

      event.preventDefault();
      return true;
    }

    event.preventDefault();
    return true;
  }

  function handleKeyUp(event) {
    if (!state.open || !event) return false;
    event.preventDefault();
    return true;
  }

  function handleWheel(event) {
    if (!state.open || !event) return false;

    event.preventDefault();

    if (state.screen !== "menu") {
      return true;
    }

    const wheelDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;

    if (wheelDelta > 0) {
      moveSelection(1);
    } else if (wheelDelta < 0) {
      moveSelection(-1);
    }

    return true;
  }

  function handleClick(event) {
    if (!state.open || !event) return false;

    const actionButton = event.target?.closest?.("[data-arcade-action]");
    if (!actionButton) {
      return false;
    }

    const action = actionButton.dataset.arcadeAction;
    if (action === "select") {
      const index = Number.parseInt(actionButton.dataset.gameIndex || "", 10);
      if (!Number.isNaN(index)) {
        selectGame(index);
      }
      return true;
    }

    if (action === "start") {
      setStartPressed(false);
      startSelectedGame();
      return true;
    }

    if (action === "back") {
      backToMenu();
      return true;
    }

    if (action === "close") {
      setClosePressed(false);
      if (state.screen === "game") {
        backToMenu();
      } else {
        close();
      }
      return true;
    }

    return false;
  }

  function handlePointerDown(event) {
    if (!state.open || event.button !== 0) return false;
    const closeButton = event.target?.closest?.(".arcade-ui-close");
    if (!closeButton) return false;
    setClosePressed(true);
    return false;
  }

  function handleStartPointerDown(event) {
    if (!state.open || event.button !== 0) return false;
    const startButton = event.target?.closest?.(".arcade-ui-start-button");
    if (!startButton) return false;
    setStartPressed(true);
    return false;
  }

  function handlePointerUp(event) {
    if (!state.open) return false;
    if (!state.closePressed) return false;
    if (event && event.target?.closest?.(".arcade-ui-close")) {
      return false;
    }
    setClosePressed(false);
    return false;
  }

  function handleStartPointerUp(event) {
    if (!state.open || !state.startPressed) return false;
    if (event && event.target?.closest?.(".arcade-ui-start-button")) {
      return false;
    }
    setStartPressed(false);
    return false;
  }

  function handlePointerLeave(event) {
    if (!state.open || !state.closePressed) return false;
    const closeButton = event.target?.closest?.(".arcade-ui-close");
    if (closeButton) {
      setClosePressed(false);
    }
    return false;
  }

  function handleStartPointerLeave(event) {
    if (!state.open || !state.startPressed) return false;
    const startButton = event.target?.closest?.(".arcade-ui-start-button");
    if (startButton) {
      setStartPressed(false);
    }
    return false;
  }

  function handleKeyDownPress(event) {
    if (!state.open || !event) return false;
    const closeButton = event.target?.closest?.(".arcade-ui-close");
    if (!closeButton) return false;
    if (event.code !== "Space" && event.code !== "Enter") return false;
    setClosePressed(true);
    return false;
  }

  function handleStartKeyDown(event) {
    if (!state.open || !event) return false;
    const startButton = event.target?.closest?.(".arcade-ui-start-button");
    if (!startButton) return false;
    if (event.code !== "Space" && event.code !== "Enter") return false;
    setStartPressed(true);
    return false;
  }

  function handleKeyUpPress(event) {
    if (!state.open || !event) return false;
    const closeButton = event.target?.closest?.(".arcade-ui-close");
    if (!closeButton) return false;
    if (event.code !== "Space" && event.code !== "Enter") return false;
    setClosePressed(false);
    return false;
  }

  function handleStartKeyUp(event) {
    if (!state.open || !event) return false;
    const startButton = event.target?.closest?.(".arcade-ui-start-button");
    if (!startButton) return false;
    if (event.code !== "Space" && event.code !== "Enter") return false;
    setStartPressed(false);
    return false;
  }

  root.addEventListener("click", handleClick);
  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointerdown", handleStartPointerDown);
  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("pointerup", handleStartPointerUp);
  root.addEventListener("pointerleave", handlePointerLeave);
  root.addEventListener("pointerleave", handleStartPointerLeave);
  root.addEventListener("keydown", handleKeyDownPress);
  root.addEventListener("keydown", handleStartKeyDown);
  root.addEventListener("keyup", handleKeyUpPress);
  root.addEventListener("keyup", handleStartKeyUp);

  return {
    open,
    close,
    isOpen: () => state.open,
    isGameFrameOpen: () => state.open && state.screen === "game",
    getSelectedGame,
    selectGame,
    handleKeyDown,
    handleKeyUp,
    handleWheel,
    handleClick,
  };
}
