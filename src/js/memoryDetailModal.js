import { formatMemoryDate } from "./memoryPolaroid.js";

const CLOSE_ICON_SRC = new URL("../assets/ui/Close.png", import.meta.url).href;

function resolveImageSources(memory) {
  const sources = [];
  const seen = new Set();

  if (Array.isArray(memory?.images)) {
    for (const image of memory.images) {
      const source = typeof image === "string" ? image : image?.src;
      if (!source || seen.has(source)) continue;

      sources.push({
        src: source,
        thumbnailSrc: typeof image === "string" ? source : image.thumbnailSrc || source,
        description: typeof image === "string" ? "" : image.description || image.caption || "",
        fileName: typeof image === "string" ? "" : image.fileName || "",
      });
      seen.add(source);
    }
  }

  if (!sources.length && memory?.coverImage) {
    sources.push({
      src: memory.coverFullImage || memory.coverImage,
      thumbnailSrc: memory.coverImage,
      description: memory.description || "",
      fileName: "",
    });
  }

  return sources;
}

function clampIndex(index, maxIndex) {
  if (maxIndex < 0) return 0;
  return Math.max(0, Math.min(index, maxIndex));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function canScrollInDirection(element, delta) {
  if (!element || delta === 0) return false;

  const canScrollDown = delta > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  const canScrollUp = delta < 0 && element.scrollTop > 1;
  return canScrollDown || canScrollUp;
}

function isLikelyDiscreteMouseWheel(event, delta) {
  if (!event || delta === 0) return false;
  if (event.deltaMode !== 0) return true;

  const absDelta = Math.abs(delta);
  return absDelta >= 40 && Number.isInteger(delta);
}

function getStackWheelDelta(event, delta) {
  const wheelUnit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 600 : 1;
  const normalizedDelta = delta * wheelUnit;
  return isLikelyDiscreteMouseWheel(event, delta) ? -normalizedDelta : normalizedDelta;
}

function createMetaRow(label, value) {
  const row = document.createElement("div");
  row.className = "memory-detail-meta-row";

  const labelEl = document.createElement("dt");
  labelEl.textContent = label;

  const valueEl = document.createElement("dd");
  valueEl.textContent = value || "-";

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

export function createMemoryDetailModal() {
  const rootEl = document.createElement("div");
  rootEl.className = "memory-detail-modal hidden";
  rootEl.setAttribute("aria-hidden", "true");
  rootEl.innerHTML = `
    <div class="memory-detail-backdrop" aria-hidden="true"></div>
    <div class="memory-detail-shell memory-detail-menu" role="dialog" aria-modal="true" aria-labelledby="memory-detail-title">
      <button type="button" class="memory-detail-close" aria-label="Close memory details">
        <img src="${CLOSE_ICON_SRC}" alt="" aria-hidden="true" class="memory-detail-close-icon" />
      </button>
      <aside class="memory-detail-copy">
        <p class="memory-detail-kicker">Memory menu</p>
        <h3 id="memory-detail-title" class="memory-detail-title"></h3>
        <p class="memory-detail-date"></p>
        <p class="memory-detail-description"></p>
        <dl class="memory-detail-meta"></dl>
        <p class="memory-detail-hint">Scroll the stack to lift each polaroid.</p>
      </aside>
      <section class="memory-detail-stack-panel" aria-label="Polaroid stack">
        <div class="memory-detail-stack-stage" tabindex="0">
          <div class="memory-detail-stack"></div>
        </div>
        <div class="memory-detail-stack-controls">
          <button type="button" class="memory-detail-nav-button memory-detail-nav-button-prev" aria-label="Restack previous polaroid">
            <span aria-hidden="true">Previous</span>
          </button>
          <div class="memory-detail-image-caption" aria-live="polite"></div>
          <button type="button" class="memory-detail-nav-button memory-detail-nav-button-next" aria-label="Lift next polaroid">
            <span aria-hidden="true">Next</span>
          </button>
        </div>
      </section>
    </div>
  `;

  const titleEl = rootEl.querySelector(".memory-detail-title");
  const dateEl = rootEl.querySelector(".memory-detail-date");
  const descriptionEl = rootEl.querySelector(".memory-detail-description");
  const metaEl = rootEl.querySelector(".memory-detail-meta");
  const stackPanelEl = rootEl.querySelector(".memory-detail-stack-panel");
  const stackStageEl = rootEl.querySelector(".memory-detail-stack-stage");
  const stackEl = rootEl.querySelector(".memory-detail-stack");
  const captionEl = rootEl.querySelector(".memory-detail-image-caption");
  const prevButton = rootEl.querySelector(".memory-detail-nav-button-prev");
  const nextButton = rootEl.querySelector(".memory-detail-nav-button-next");
  const closeButton = rootEl.querySelector(".memory-detail-close");

  const state = {
    isOpen: false,
    memory: null,
    imageIndex: 0,
    stackCurrent: 0,
    stackTarget: 0,
    stackRafId: 0,
    wheelCarry: 0,
    onClose: null,
    onPrevImage: null,
    onNextImage: null,
    closeTimer: 0,
    isClosing: false,
  };

  function requestClose() {
    if (state.isClosing) return;

    if (typeof state.onClose === "function") {
      state.onClose();
      return;
    }
    close();
  }

  function renderStack(memory, sources) {
    if (!stackEl) return;

    stackEl.innerHTML = "";

    sources.forEach((source, index) => {
      const card = document.createElement("article");
      card.className = "memory-detail-stack-card";
      card.dataset.imageIndex = String(index);
      card.style.setProperty("--detail-card-tilt", `${((index * 11) % 14) - 7}deg`);

      const image = document.createElement("img");
      image.className = "memory-detail-stack-image";
      image.src = source.src || source.thumbnailSrc || "";
      image.alt = `${memory?.title || "Memory"} polaroid ${index + 1}`;
      image.decoding = "async";
      image.loading = index <= 1 ? "eager" : "lazy";

      const note = document.createElement("p");
      note.className = "memory-detail-stack-note";
      note.textContent = source.description || memory?.title || "Memory";

      card.appendChild(image);
      card.appendChild(note);
      stackEl.appendChild(card);
    });
  }

  function updateStackCards(sources) {
    const cards = Array.from(stackEl?.querySelectorAll(".memory-detail-stack-card") || []);
    const maxIndex = sources.length - 1;
    const stackIndex = clampIndex(state.stackCurrent, maxIndex);
    const activeIndex = clampIndex(Math.round(state.stackTarget), maxIndex);

    cards.forEach((card, index) => {
      const offset = index - stackIndex;
      const lifted = offset < -0.08;
      const isActive = index === activeIndex;
      const hiddenBehind = offset > 5;
      const direction = index % 2 === 0 ? 1 : -1;
      const liftProgress = clamp(-offset, 0, 1);

      card.classList.toggle("is-lifted", lifted);
      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-hidden-behind", hiddenBehind);
      card.style.zIndex = String(1000 - index);
      card.style.opacity = "1";

      if (lifted) {
        card.style.transform = `
        translate3d(calc(-50% + ${direction * (42 + liftProgress * 34)}px), calc(${(-128 * liftProgress).toFixed(3)}% - ${liftProgress * 120}px), 0)
          rotate(${direction * -16 * liftProgress}deg)
          scale(${1 - liftProgress * 0.06})
        `;
        return;
      }

      card.style.transform = `
        translate3d(calc(-50% + ${offset * 13 * direction}px), ${offset * 12}px, 0)
        rotate(calc(var(--detail-card-tilt) + ${offset * 3 * direction}deg))
        scale(${Math.max(0.84, 1 - offset * 0.035)})
      `;
    });
  }

  function requestStackFrame() {
    if (!state.isOpen) return;
    if (state.stackRafId) return;
    state.stackRafId = window.requestAnimationFrame(tickStack);
  }

  function stopStackFrame() {
    if (!state.stackRafId) return;
    window.cancelAnimationFrame(state.stackRafId);
    state.stackRafId = 0;
  }

  function tickStack() {
    const sources = resolveImageSources(state.memory);
    state.stackCurrent += (state.stackTarget - state.stackCurrent) * 0.14;

    if (Math.abs(state.stackTarget - state.stackCurrent) < 0.002) {
      state.stackCurrent = state.stackTarget;
    }

    updateStackCards(sources);

    if (Math.abs(state.stackTarget - state.stackCurrent) > 0.002 && state.isOpen) {
      state.stackRafId = window.requestAnimationFrame(tickStack);
      return;
    }

    state.stackRafId = 0;
  }

  function updateDom({ rebuildStack = false } = {}) {
    const memory = state.memory;
    const sources = resolveImageSources(memory);
    const maxIndex = sources.length - 1;
    const imageIndex = clampIndex(state.imageIndex, maxIndex);
    const currentImage = sources[imageIndex] || null;

    rootEl.classList.toggle("hidden", !state.isOpen);
    rootEl.setAttribute("aria-hidden", state.isOpen ? "false" : "true");

    if (!memory) {
      if (titleEl) titleEl.textContent = "";
      if (dateEl) dateEl.textContent = "";
      if (descriptionEl) descriptionEl.textContent = "";
      if (metaEl) metaEl.innerHTML = "";
      if (stackEl) stackEl.innerHTML = "";
      if (captionEl) captionEl.textContent = "";
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
      return;
    }

    state.imageIndex = imageIndex;
    state.stackTarget = imageIndex;

    if (titleEl) titleEl.textContent = memory.title || "Untitled memory";
    if (dateEl) dateEl.textContent = formatMemoryDate(memory.date);
    if (descriptionEl) {
      descriptionEl.textContent = currentImage?.description || memory.description || "";
    }

    if (metaEl) {
      metaEl.innerHTML = "";
      metaEl.appendChild(createMetaRow("Photos", String(sources.length)));
      metaEl.appendChild(createMetaRow("Location", memory.location || memory.folderName || "Scrapbook"));
      metaEl.appendChild(createMetaRow("Current note", currentImage?.description || memory.description || "Saved moment"));
      if (currentImage?.fileName) {
        metaEl.appendChild(createMetaRow("File", currentImage.fileName));
      }
    }

    if (captionEl) {
      captionEl.textContent = currentImage?.description || memory.title || "Polaroid";
    }

    if (rebuildStack) {
      renderStack(memory, sources);
      state.stackCurrent = imageIndex;
    } else {
      requestStackFrame();
    }
    updateStackCards(sources);

    if (prevButton) {
      prevButton.disabled = sources.length <= 1 || imageIndex <= 0;
    }
    if (nextButton) {
      nextButton.disabled = sources.length <= 1 || imageIndex >= maxIndex;
    }
  }

  function open(memory, options = {}) {
    window.clearTimeout(state.closeTimer);
    rootEl.classList.remove("is-closing");
    state.memory = memory || null;
    state.imageIndex = clampIndex(options.imageIndex ?? 0, resolveImageSources(memory).length - 1);
    state.stackCurrent = state.imageIndex;
    state.stackTarget = state.imageIndex;
    state.wheelCarry = 0;
    state.isClosing = false;
    state.onClose = typeof options.onClose === "function" ? options.onClose : null;
    state.onPrevImage = typeof options.onPrevImage === "function" ? options.onPrevImage : null;
    state.onNextImage = typeof options.onNextImage === "function" ? options.onNextImage : null;
    state.isOpen = Boolean(memory);
    updateDom({ rebuildStack: true });

    if (state.isOpen) {
      const focusTarget = stackStageEl || closeButton || rootEl;
      window.setTimeout(() => {
        focusTarget?.focus?.();
      }, 0);
    }
  }

  function close() {
    window.clearTimeout(state.closeTimer);

    if (!state.memory) {
      state.isClosing = false;
      state.isOpen = false;
      updateDom();
      return;
    }

    state.isClosing = true;
    state.imageIndex = 0;
    state.stackCurrent = 0;
    state.stackTarget = 0;
    rootEl.classList.add("is-closing");
    updateDom();

    state.closeTimer = window.setTimeout(() => {
      stopStackFrame();
      state.isOpen = false;
      state.memory = null;
      state.imageIndex = 0;
      state.stackCurrent = 0;
      state.stackTarget = 0;
      state.wheelCarry = 0;
      state.isClosing = false;
      state.onClose = null;
      state.onPrevImage = null;
      state.onNextImage = null;
      rootEl.classList.remove("is-closing");
      updateDom({ rebuildStack: true });
    }, 620);
  }

  function setImageIndex(nextIndex) {
    state.imageIndex = nextIndex;
    updateDom();
  }

  function moveStack(direction) {
    if (direction < 0 && typeof state.onPrevImage === "function") {
      state.onPrevImage();
      return;
    }
    if (direction > 0 && typeof state.onNextImage === "function") {
      state.onNextImage();
      return;
    }

    const maxIndex = resolveImageSources(state.memory).length - 1;
    setImageIndex(clampIndex(state.imageIndex + direction, maxIndex));
  }

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  });
  closeButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  rootEl.querySelector(".memory-detail-backdrop").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  });
  rootEl.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest(".memory-detail-close")) {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    }
  });

  prevButton.addEventListener("click", () => moveStack(-1));
  nextButton.addEventListener("click", () => moveStack(1));

  function handleStackWheel(event) {
    if (!state.isOpen || state.isClosing) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 8) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    const scrollableMeta = target?.closest?.(".memory-detail-meta");
    if (scrollableMeta && canScrollInDirection(scrollableMeta, delta)) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state.wheelCarry += getStackWheelDelta(event, delta);

    const threshold = 90;
    while (state.wheelCarry >= threshold) {
      moveStack(1);
      state.wheelCarry -= threshold;
    }
    while (state.wheelCarry <= -threshold) {
      moveStack(-1);
      state.wheelCarry += threshold;
    }
  }

  stackStageEl.addEventListener("wheel", handleStackWheel, { passive: false });
  stackPanelEl.addEventListener("wheel", handleStackWheel, { passive: false });
  rootEl.addEventListener("wheel", handleStackWheel, { passive: false });

  stackStageEl.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }

    if (event.code === "ArrowUp" || event.code === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      moveStack(-1);
    }
    if (event.code === "ArrowDown" || event.code === "ArrowRight" || event.code === "Space") {
      event.preventDefault();
      event.stopPropagation();
      moveStack(1);
    }
  });

  rootEl.addEventListener("keydown", (event) => {
    if (event.code !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  });

  updateDom();

  return {
    element: rootEl,
    open,
    close,
    setImageIndex,
    isOpen: () => state.isOpen,
    getMemory: () => state.memory,
    getImageIndex: () => state.imageIndex,
  };
}
