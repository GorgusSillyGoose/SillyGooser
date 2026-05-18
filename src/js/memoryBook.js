import { createMemoryPolaroid, formatMemoryDate, formatMemoryShortDate } from "./memoryPolaroid.js";
import { createMemoryDetailModal } from "./memoryDetailModal.js";
import { createStatisticsPage, statisticsData } from "./memoryStatistics.js";

const BOOK_FRAME_MEMORIES = new URL("../assets/ui/Book_Memories.png", import.meta.url).href;
const BOOK_FRAME_STATISTICS = new URL("../assets/ui/Book_Statistics.png", import.meta.url).href;
const CALENDAR_ICON_SRC = new URL("../assets/ui/Calendar.png", import.meta.url).href;
const CLOSE_ICON_SRC = new URL("../assets/ui/Close.png", import.meta.url).href;
const CLOSE_ICON_PRESSED_SRC = new URL("../assets/ui/Close_pressed.png", import.meta.url).href;
const IMAGES_ICON_SRC = new URL("../assets/ui/Images.png", import.meta.url).href;
const MEMORY_MANIFEST_SRC = new URL("../assets/Memories/memories.json", import.meta.url).href;
const PAGE_NAMES = {
  memories: "memories",
  statistics: "statistics",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function slugify(value) {
  return String(value || "memory")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function attachHorizontalScrollbar(pageEl, scrollEl, contentEl) {
  if (!pageEl || !scrollEl) {
    return null;
  }

  const scrollbarEl = document.createElement("div");
  scrollbarEl.className = "memory-book-date-scrollbar";

  const trackEl = document.createElement("div");
  trackEl.className = "memory-book-date-scrollbar-track memory-statistics-custom-scrollbar-track";
  scrollbarEl.appendChild(trackEl);

  const thumbEl = document.createElement("div");
  thumbEl.className = "memory-book-date-scrollbar-thumb memory-statistics-custom-scrollbar-thumb";
  scrollbarEl.appendChild(thumbEl);
  pageEl.appendChild(scrollbarEl);

  let isDragging = false;
  let activePointerId = null;
  let dragOffset = 0;

  const getMetrics = () => {
    const scrollWidth = contentEl?.offsetWidth ?? scrollEl.scrollWidth;
    const clientWidth = scrollEl.clientWidth;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    const thumbWidth = maxScrollLeft <= 0
      ? clientWidth
      : Math.max(28, Math.round((clientWidth * clientWidth) / scrollWidth));
    const maxThumbLeft = Math.max(0, clientWidth - thumbWidth);
    return {
      scrollWidth,
      clientWidth,
      maxScrollLeft,
      thumbWidth,
      maxThumbLeft,
    };
  };

  const setScrollFromClientX = (clientX) => {
    const { maxScrollLeft, thumbWidth, maxThumbLeft, clientWidth } = getMetrics();
    if (maxScrollLeft <= 0) {
      return;
    }

    const scrollbarRect = scrollbarEl.getBoundingClientRect();
    const thumbLeft = clamp(clientX - scrollbarRect.left - dragOffset, 0, maxThumbLeft);
    const scrollLeft = (thumbLeft / Math.max(1, maxThumbLeft)) * maxScrollLeft;

    thumbEl.style.width = `${thumbWidth}px`;
    thumbEl.style.transform = `translateX(${thumbLeft}px)`;
    scrollEl.scrollLeft = scrollLeft;

    if (clientWidth && scrollEl.scrollLeft > maxScrollLeft) {
      scrollEl.scrollLeft = maxScrollLeft;
    }
  };

  const syncScrollbar = () => {
    const { scrollWidth, clientWidth, maxScrollLeft, thumbWidth, maxThumbLeft } = getMetrics();

    scrollbarEl.style.left = "0px";
    scrollbarEl.style.width = `${pageEl.clientWidth}px`;

    if (maxScrollLeft <= 0) {
      thumbEl.style.width = `${clientWidth}px`;
      thumbEl.style.transform = "translateX(0)";
      return;
    }

    const thumbLeft = Math.round((scrollEl.scrollLeft / maxScrollLeft) * maxThumbLeft);

    thumbEl.style.width = `${thumbWidth}px`;
    thumbEl.style.transform = `translateX(${thumbLeft}px)`;
  };

  const startDrag = (event) => {
    if (event.button !== 0) {
      return;
    }

    const { thumbWidth } = getMetrics();
    const thumbRect = thumbEl.getBoundingClientRect();
    dragOffset = event.target === thumbEl ? event.clientX - thumbRect.left : thumbWidth / 2;
    isDragging = true;
    activePointerId = event.pointerId;

    if (scrollbarEl.setPointerCapture) {
      scrollbarEl.setPointerCapture(event.pointerId);
    }

    setScrollFromClientX(event.clientX);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    if (!isDragging || event.pointerId !== activePointerId) {
      return;
    }

    setScrollFromClientX(event.clientX);
    event.preventDefault();
  };

  const stopDrag = (event) => {
    if (!isDragging || (event.pointerId !== undefined && event.pointerId !== activePointerId)) {
      return;
    }

    isDragging = false;
    activePointerId = null;
    dragOffset = 0;

    if (scrollbarEl.releasePointerCapture && event.pointerId !== undefined) {
      try {
        scrollbarEl.releasePointerCapture(event.pointerId);
      } catch {
        // ignore capture release errors
      }
    }
  };

  scrollEl.addEventListener("scroll", syncScrollbar, { passive: true });
  scrollbarEl.addEventListener("pointerdown", startDrag);
  scrollbarEl.addEventListener("pointermove", moveDrag);
  scrollbarEl.addEventListener("pointerup", stopDrag);
  scrollbarEl.addEventListener("pointercancel", stopDrag);

  if (contentEl && "ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(syncScrollbar);
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(contentEl);
  } else {
    window.addEventListener("resize", syncScrollbar, { passive: true });
  }

  requestAnimationFrame(syncScrollbar);
  return scrollbarEl;
}

function normalizeImageEntry(entry, index = 0) {
  if (!entry) return null;

  if (typeof entry === "string") {
    return {
      src: entry,
      description: "",
      fileName: "",
      index: index + 1,
    };
  }

  const src = entry.src || entry.url || entry.path || "";
  if (!src) return null;

  return {
    src,
    description: entry.description || entry.caption || "",
    fileName: entry.fileName || entry.name || "",
    index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : index + 1,
  };
}

function getMemoryImageEntries(memory) {
  const entries = [];
  const seen = new Set();

  if (Array.isArray(memory?.images)) {
    for (let index = 0; index < memory.images.length; index += 1) {
      const entry = normalizeImageEntry(memory.images[index], index);
      if (!entry || seen.has(entry.src)) continue;
      entries.push(entry);
      seen.add(entry.src);
    }
  }

  if (!entries.length && memory?.coverImage && !seen.has(memory.coverImage)) {
    entries.unshift({
      src: memory.coverFullImage || memory.coverImage,
      description: memory.description || "",
      fileName: "",
      index: 1,
    });
  }

  return entries;
}

function normalizeMemory(memory, fallbackIndex = 0) {
  if (!memory) return null;

  const images = getMemoryImageEntries(memory);
  const coverImage = memory.coverImage || images[0]?.src || "";
  const title = memory.title || "Untitled memory";

  return {
    ...memory,
    id: memory.id || slugify(`${memory.date || fallbackIndex}-${title}`),
    title,
    date: memory.date || "",
    coverImage,
    images,
    imageCount: Number.isFinite(Number(memory.imageCount))
      ? Number(memory.imageCount)
      : images.length,
    description: memory.description || images[0]?.description || "",
  };
}

function normalizeMemories(memories) {
  return (Array.isArray(memories) ? memories : [])
    .map(normalizeMemory)
    .filter((memory) => memory && memory.coverImage)
    .sort((a, b) => getDateTime(a.date) - getDateTime(b.date));
}

async function loadGeneratedMemories() {
  try {
    const response = await fetch(MEMORY_MANIFEST_SRC, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Memory manifest returned ${response.status}`);
    }

    const manifest = await response.json();
    return normalizeMemories(Array.isArray(manifest) ? manifest : manifest.memories);
  } catch (error) {
    console.warn("[SillyGooser] Could not load memories manifest.", error);
    return [];
  }
}

export function createMemoryBook(options = {}) {
  let memories = normalizeMemories(options.memories);
  const statsData = options.statisticsData || statisticsData;
  const statisticsPageContent = createStatisticsPage(statsData);

  const rootEl = document.createElement("div");
  rootEl.className = "memory-book-overlay hidden";
  rootEl.setAttribute("aria-hidden", "true");
  rootEl.innerHTML = `
    <div class="memory-book-backdrop" aria-hidden="true"></div>
    <div class="memory-book-shell" role="dialog" aria-modal="true" aria-label="Memory book">
      <img class="memory-book-frame" alt="" aria-hidden="true" />
      <div class="memory-book-ui">
        <div class="memory-book-tabs">
          <button type="button" class="memory-book-tab memory-book-tab-memories" data-page="${PAGE_NAMES.memories}">
            memories
          </button>
          <span class="memory-book-tab-key memory-book-tab-key-memories" aria-hidden="true">
            <span class="memory-book-tab-key-label">M</span>
          </span>
          <button type="button" class="memory-book-tab memory-book-tab-statistics" data-page="${PAGE_NAMES.statistics}">
            Statistics
          </button>
          <span class="memory-book-tab-key memory-book-tab-key-statistics" aria-hidden="true">
            <span class="memory-book-tab-key-label">S</span>
          </span>
        </div>
        <button type="button" class="memory-book-close" aria-label="Close memory book">
          <img src="${CLOSE_ICON_SRC}" alt="" aria-hidden="true" class="memory-book-close-icon" />
        </button>
        <button type="button" class="memory-book-nav memory-book-nav-prev" aria-label="Previous memory"></button>
        <button type="button" class="memory-book-nav memory-book-nav-next" aria-label="Next memory"></button>
        <div class="memory-book-pages">
          <section class="memory-book-page memory-book-page-memories" data-page="${PAGE_NAMES.memories}">
            <div class="memory-book-memory-summary">
              <div class="memory-book-memory-label">MEMORY:</div>
              <div class="memory-book-memory-title" aria-live="polite">Untitled memory</div>
              <div class="memory-book-memory-divider" aria-hidden="true"></div>
              <div class="memory-book-memory-meta memory-book-memory-meta-date">
                <img src="${CALENDAR_ICON_SRC}" alt="" aria-hidden="true" class="memory-book-memory-meta-icon" />
                <div class="memory-book-memory-date" aria-live="polite"></div>
              </div>
              <div class="memory-book-memory-description" aria-live="polite"></div>
              <div class="memory-book-memory-divider" aria-hidden="true"></div>
              <div class="memory-book-memory-meta memory-book-memory-meta-images">
                <img src="${IMAGES_ICON_SRC}" alt="" aria-hidden="true" class="memory-book-memory-meta-icon" />
                <div class="memory-book-memory-image-count" aria-live="polite"></div>
              </div>
              <div class="memory-book-memory-helper">
                <span class="memory-book-memory-helper-line memory-book-memory-helper-line-main">Use arrows or mouse wheel</span>
                <span class="memory-book-memory-helper-line memory-book-memory-helper-line-sub">to scroll</span>
              </div>
            </div>
            <div class="memory-book-carousel-shell">
              <div class="memory-book-carousel-viewport" aria-live="polite">
                <div class="memory-book-carousel-track"></div>
              </div>
              <div class="memory-book-open-memory-stack">
                <button type="button" class="memory-book-open-memory" aria-label="Open selected memory">Open Memory</button>
                <div class="memory-book-open-memory-count" aria-live="polite"></div>
              </div>
            </div>
          </section>
          <section class="memory-book-page memory-book-page-statistics" data-page="${PAGE_NAMES.statistics}">
            <div class="memory-book-statistics"></div>
          </section>
        </div>
        <div class="memory-book-date-strip" aria-label="Memory dates">
          <div class="memory-book-date-track"></div>
        </div>
      </div>
    </div>
  `;

  const frameEl = rootEl.querySelector(".memory-book-frame");
  if (frameEl) frameEl.draggable = false;
  rootEl.querySelectorAll("img").forEach((image) => {
    image.draggable = false;
  });
  rootEl.addEventListener(
    "dragstart",
    (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("img")) {
        event.preventDefault();
      }
    },
    true
  );
  const tabs = Array.from(rootEl.querySelectorAll(".memory-book-tab"));
  const closeButton = rootEl.querySelector(".memory-book-close");
  const closeIconEl = rootEl.querySelector(".memory-book-close-icon");
  const memoryPageEl = rootEl.querySelector(".memory-book-page-memories");
  const statisticsPageEl = rootEl.querySelector(".memory-book-page-statistics");
  const carouselViewportEl = rootEl.querySelector(".memory-book-carousel-viewport");
  const carouselTrackEl = rootEl.querySelector(".memory-book-carousel-track");
  const titleEl = rootEl.querySelector(".memory-book-memory-title");
  const dateEl = rootEl.querySelector(".memory-book-memory-date");
  const descriptionEl = rootEl.querySelector(".memory-book-memory-description");
  const imageCountEl = rootEl.querySelector(".memory-book-memory-image-count");
  const openMemoryCountEl = rootEl.querySelector(".memory-book-open-memory-count");
  const dateStripEl = rootEl.querySelector(".memory-book-date-strip");
  const dateTrackEl = rootEl.querySelector(".memory-book-date-track");
  const openMemoryButton = rootEl.querySelector(".memory-book-open-memory");
  const prevButton = rootEl.querySelector(".memory-book-nav-prev");
  const nextButton = rootEl.querySelector(".memory-book-nav-next");
  const statisticsMountEl = rootEl.querySelector(".memory-book-statistics");

  if (statisticsMountEl) {
    statisticsMountEl.appendChild(statisticsPageContent);
  }

  document.body.appendChild(rootEl);
  const detailModal = createMemoryDetailModal();
  document.body.appendChild(detailModal.element);
  const dateScrollbarEl = attachHorizontalScrollbar(rootEl.querySelector(".memory-book-pages"), dateStripEl, dateTrackEl);

  const state = {
    isBookOpen: false,
    activeBookPage: PAGE_NAMES.memories,
    previousFocus: null,
    scrollCurrent: 0,
    scrollTarget: 0,
    rafId: 0,
    cardEls: [],
    dateButtonEls: [],
    activeMemoryIndex: -1,
    metrics: {
      viewportWidth: 720,
      step: 240,
      centerX: 360,
      cardWidth: 235,
    },
    isDragging: false,
    dragStartX: 0,
    dragStartTarget: 0,
    hasLoadedManifest: Boolean(options.memories),
    shortcutPressedTab: null,
  };

  function setTabPressed(tab, isPressed) {
    tab?.classList.toggle("is-pressed", Boolean(isPressed));
  }

  function setClosePressed(isPressed) {
    if (!closeIconEl) return;
    closeIconEl.src = isPressed ? CLOSE_ICON_PRESSED_SRC : CLOSE_ICON_SRC;
  }

  function clearShortcutPressedTab() {
    setTabPressed(state.shortcutPressedTab, false);
    state.shortcutPressedTab = null;
  }

  function pressShortcutTab(tab) {
    if (state.shortcutPressedTab && state.shortcutPressedTab !== tab) {
      setTabPressed(state.shortcutPressedTab, false);
    }
    state.shortcutPressedTab = tab || null;
    setTabPressed(state.shortcutPressedTab, true);
  }

  function getPressedTab(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return null;
    return target.closest(".memory-book-tab");
  }

  function handleTabKeyDown(event) {
    const tab = getPressedTab(event);
    if (!tab || (event.code !== "Space" && event.code !== "Enter")) return;
    event.preventDefault();
    setTabPressed(tab, true);
  }

  function handleTabKeyUp(event) {
    const tab = getPressedTab(event);
    if (!tab || (event.code !== "Space" && event.code !== "Enter")) return;
    event.preventDefault();
    setTabPressed(tab, false);
  }

  function handleTabBlur(event) {
    const tab = event.target instanceof HTMLElement ? event.target.closest(".memory-book-tab") : null;
    if (!tab) return;
    setTabPressed(tab, false);
  }

  function handleClosePointerDown(event) {
    if (event.button !== 0) return;
    setClosePressed(true);
  }

  function handleClosePointerUp() {
    setClosePressed(false);
  }

  function handleCloseKeyDown(event) {
    if (event.code !== "Space" && event.code !== "Enter") return;
    setClosePressed(true);
  }

  function handleCloseKeyUp(event) {
    if (event.code !== "Space" && event.code !== "Enter") return;
    setClosePressed(false);
  }

  function getShortcutTabFromKey(event) {
    const key = event?.key?.toLowerCase?.();
    if (key === "m") return rootEl.querySelector(".memory-book-tab-memories");
    if (key === "s") return rootEl.querySelector(".memory-book-tab-statistics");
    return null;
  }

  function handleShortcutKeyDown(event) {
    if (!state.isBookOpen) return;
    const tab = getShortcutTabFromKey(event);
    if (!tab) return;
    pressShortcutTab(tab);
  }

  function handleShortcutKeyUp(event) {
    if (!state.isBookOpen) return;
    const tab = getShortcutTabFromKey(event);
    if (!tab || tab !== state.shortcutPressedTab) return;
    clearShortcutPressedTab();
  }

  function getMaxScrollIndex() {
    return Math.max(0, memories.length - 1);
  }

  function setScrollTarget(value) {
    state.scrollTarget = clamp(value, 0, getMaxScrollIndex());
    if (!state.isBookOpen && memories.length) {
      state.scrollCurrent = state.scrollTarget;
    }
    updateNavState();
    requestTimelineFrame();
  }

  function nudgeTimeline(direction) {
    setScrollTarget(Math.round(state.scrollTarget) + direction);
  }

  function getActiveMemory() {
    if (!memories.length) return null;
    return memories[clamp(Math.round(state.scrollTarget), 0, getMaxScrollIndex())] || null;
  }

  function getFrameSrc() {
    return state.activeBookPage === PAGE_NAMES.statistics
      ? BOOK_FRAME_STATISTICS
      : BOOK_FRAME_MEMORIES;
  }

  function setFrameImage() {
    if (frameEl) {
      frameEl.src = getFrameSrc();
    }
  }

  function syncTabs() {
    for (const tab of tabs) {
      const isActive = tab.dataset.page === state.activeBookPage;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function syncPageVisibility() {
    const isMemories = state.activeBookPage === PAGE_NAMES.memories;
    const isStatistics = state.activeBookPage === PAGE_NAMES.statistics;

    memoryPageEl?.classList.toggle("is-active", isMemories);
    statisticsPageEl?.classList.toggle("is-active", isStatistics);
    memoryPageEl?.setAttribute("aria-hidden", isMemories ? "false" : "true");
    statisticsPageEl?.setAttribute("aria-hidden", isStatistics ? "false" : "true");
    if (prevButton) prevButton.hidden = !isMemories;
    if (nextButton) nextButton.hidden = !isMemories;
    if (dateStripEl) dateStripEl.hidden = !isMemories;
    if (dateScrollbarEl) {
      dateScrollbarEl.hidden = !isMemories;
    }
  }

  function updateNavState() {
    const maxIndex = getMaxScrollIndex();
    if (prevButton) prevButton.disabled = memories.length <= 1 || state.scrollTarget <= 0.01;
    if (nextButton) nextButton.disabled = memories.length <= 1 || state.scrollTarget >= maxIndex - 0.01;
    if (openMemoryButton) openMemoryButton.disabled = !memories.length;
  }

  function syncActiveMemoryMeta(force = false) {
    const activeIndex = clamp(Math.round(state.scrollCurrent), 0, getMaxScrollIndex());
    if (!force && activeIndex === state.activeMemoryIndex) {
      return;
    }

    state.activeMemoryIndex = activeIndex;
    const memory = memories[activeIndex];
    const totalMemories = memories.length;
    if (titleEl) {
      titleEl.textContent = memory?.title || "Untitled memory";
    }
    if (dateEl) {
      dateEl.textContent = memory?.date ? formatMemoryDate(memory.date) : "";
    }
    if (descriptionEl) {
      descriptionEl.textContent = memory?.description || "No description available.";
    }
    if (imageCountEl) {
      const imageCount = memory?.imageCount || 0;
      imageCountEl.textContent = `${imageCount} image${imageCount === 1 ? "" : "s"} in memory`;
    }
    if (openMemoryCountEl) {
      const currentMemoryNumber = totalMemories ? activeIndex + 1 : 0;
      openMemoryCountEl.textContent = `${currentMemoryNumber} / ${totalMemories} memories`;
    }
    state.dateButtonEls.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-current", isActive ? "true" : "false");
      if (isActive) {
        button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });
  }

  function measureTimeline() {
    const viewportWidth = carouselViewportEl?.clientWidth || 720;
    state.metrics.viewportWidth = viewportWidth;
    state.metrics.step = clamp(viewportWidth * 0.33, 140, 260);
    state.metrics.centerX = viewportWidth / 2;
    state.metrics.cardWidth = state.cardEls[0]?.offsetWidth || clamp(viewportWidth * 0.38, 160, 295);
    if (prevButton && carouselViewportEl) {
      const uiRect = rootEl.querySelector(".memory-book-ui")?.getBoundingClientRect();
      const viewportRect = carouselViewportEl.getBoundingClientRect();
      if (uiRect && viewportRect.width > 0) {
        const buttonWidth = prevButton.offsetWidth || 0;
        const left = viewportRect.left - uiRect.left - buttonWidth * 0.5;
        prevButton.style.left = `${left}px`;
      }
    }
  }

  function ensureCardImageLoaded(card) {
    const image = card?.querySelector?.(".memory-polaroid-cover");
    if (image?.dataset.src && !image.getAttribute("src")) {
      image.src = image.dataset.src;
      image.removeAttribute("data-src");
    }
  }

  function updateTimeline() {
    const { step, centerX, cardWidth } = state.metrics;
    const settle = state.isDragging ? 0.35 : 0.13;
    const before = state.scrollCurrent;

    state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * settle;
    if (Math.abs(state.scrollTarget - state.scrollCurrent) < 0.002) {
      state.scrollCurrent = state.scrollTarget;
    }

    const activeIndex = clamp(Math.round(state.scrollCurrent), 0, getMaxScrollIndex());
    const visibleStart = Math.max(0, Math.floor(state.scrollCurrent) - 4);
    const visibleEnd = Math.min(memories.length - 1, Math.ceil(state.scrollCurrent) + 4);

    state.cardEls.forEach((card, index) => {
      if (index < visibleStart || index > visibleEnd) {
        card.classList.add("is-hidden");
        card.style.pointerEvents = "none";
        return;
      }

      const diff = index - state.scrollCurrent;
      const distance = Math.abs(diff);
      const hidden = distance > 3.35;
      const tilt = Number(card.dataset.tilt || 0);
      const x = centerX + diff * step - cardWidth / 2;
      const y = 130 + distance * 10.5;
      const scale = clamp(1.34 - distance * 0.22, 0.48, 1.34);
      const rotate = tilt - diff * 4.5;
      const opacity = hidden ? 0 : clamp(1 - distance * 0.22, 0.18, 1);

      if (distance <= 2.2) {
        ensureCardImageLoaded(card);
      }

      card.classList.toggle("is-hidden", hidden);
      card.classList.toggle("is-active", index === activeIndex);
      card.classList.toggle("is-nearby", distance > 0.45 && distance <= 1.65);
      card.classList.toggle("is-distant", distance > 1.65);
      card.style.zIndex = String(100 - Math.round(distance * 18));
      card.style.opacity = String(opacity);
      card.style.pointerEvents = distance <= 2.25 ? "auto" : "none";
      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`;
    });

    syncActiveMemoryMeta();
    return state.isDragging || Math.abs(state.scrollTarget - state.scrollCurrent) > 0.002 || Math.abs(before - state.scrollCurrent) > 0.0005;
  }

  function tick() {
    const shouldContinue = updateTimeline();
    if (shouldContinue && state.isBookOpen) {
      state.rafId = window.requestAnimationFrame(tick);
      return;
    }
    state.rafId = 0;
  }

  function requestTimelineFrame() {
    if (!state.isBookOpen) return;
    if (state.rafId) return;
    state.rafId = window.requestAnimationFrame(tick);
  }

  function stopTimelineLoop() {
    if (!state.rafId) return;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  function renderDateStrip() {
    if (!dateTrackEl) return;

    dateTrackEl.innerHTML = "";
    state.dateButtonEls = [];

    memories.forEach((memory, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "memory-book-date-button";
      button.dataset.memoryIndex = String(index);
      const shortDate = formatMemoryShortDate(memory.date);
      const fullDate = formatMemoryDate(memory.date);
      button.textContent = shortDate;
      button.setAttribute("aria-label", `Show ${memory.title || "memory"} from ${fullDate}`);
      dateTrackEl.appendChild(button);
      state.dateButtonEls.push(button);
    });
  }

  function renderCarousel() {
    if (!carouselTrackEl) return;

    carouselTrackEl.innerHTML = "";
    state.cardEls = [];
    renderDateStrip();

    memories.forEach((memory, index) => {
      const card = createMemoryPolaroid(memory, {
        loadCover: index <= 3,
        onSelect: () => {
          setScrollTarget(index);
        },
      });
      card.dataset.index = String(index);
      card.dataset.tilt = String(((index * 17) % 15) - 7);
      carouselTrackEl.appendChild(card);
      state.cardEls.push(card);
    });

    const hasMemories = memories.length > 0;
    if (carouselTrackEl) carouselTrackEl.hidden = !hasMemories;
    setScrollTarget(clamp(state.scrollTarget, 0, getMaxScrollIndex()));
    state.scrollCurrent = clamp(state.scrollCurrent, 0, getMaxScrollIndex());
    measureTimeline();
    state.activeMemoryIndex = -1;
    updateTimeline();
    syncActiveMemoryMeta(true);
    updateNavState();
  }

  function setActiveBookPage(page) {
    const nextPage = page === PAGE_NAMES.statistics ? PAGE_NAMES.statistics : PAGE_NAMES.memories;
    state.activeBookPage = nextPage;
    setFrameImage();
    syncTabs();
    syncPageVisibility();
  }

  function open() {
    state.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.isBookOpen = true;
    state.activeBookPage = PAGE_NAMES.memories;
    state.selectedMemory = null;
    state.selectedMemoryImageIndex = 0;
    rootEl.classList.remove("hidden");
    rootEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("memory-book-open");
    setFrameImage();
    syncTabs();
    syncPageVisibility();
    renderCarousel();
    requestTimelineFrame();
    clearShortcutPressedTab();
    window.setTimeout(() => {
      closeButton?.focus?.();
    }, 0);
  }

  function close() {
    detailModal.close();
    state.isBookOpen = false;
    state.isDragging = false;
    stopTimelineLoop();
    clearShortcutPressedTab();
    rootEl.classList.add("hidden");
    rootEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("memory-book-open");
    state.previousFocus?.focus?.();
    state.previousFocus = null;
  }

  function handleWheel(event) {
    if (!state.isBookOpen || state.activeBookPage !== PAGE_NAMES.memories || !memories.length) return;
    if (event.target instanceof HTMLElement && event.target.closest(".memory-book-date-strip")) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    event.preventDefault();
    event.stopPropagation();
    setScrollTarget(state.scrollTarget + delta / 420);
  }

  function handlePointerDown(event) {
    if (!memories.length || !carouselViewportEl?.contains(event.target)) return;
    if (event.target instanceof HTMLElement && event.target.closest(".memory-polaroid")) {
      return;
    }

    state.isDragging = true;
    state.dragStartX = event.clientX;
    state.dragStartTarget = state.scrollTarget;
    carouselViewportEl.setPointerCapture?.(event.pointerId);
    carouselViewportEl.classList.add("is-dragging");
    requestTimelineFrame();
  }

  function handlePointerMove(event) {
    if (!state.isDragging || !carouselViewportEl) return;
    const viewportWidth = carouselViewportEl.clientWidth || 720;
    const step = clamp(viewportWidth * 0.38, 150, 270);
    const delta = (state.dragStartX - event.clientX) / step;
    setScrollTarget(state.dragStartTarget + delta);
  }

  function handlePointerUp(event) {
    if (!state.isDragging) return;
    state.isDragging = false;
    setScrollTarget(Math.round(state.scrollTarget));
    carouselViewportEl?.releasePointerCapture?.(event.pointerId);
    carouselViewportEl?.classList.remove("is-dragging");
  }

  function handleKeyDown(event) {
    if (!state.isBookOpen || !event) return false;

    if (event.code === "Escape") {
      event.preventDefault();
      close();
      return true;
    }

    if (event.code === "ArrowLeft") {
      event.preventDefault();
      nudgeTimeline(-1);
      return true;
    }

    if (event.code === "ArrowRight") {
      event.preventDefault();
      nudgeTimeline(1);
      return true;
    }

    if (event.code === "Digit1") {
      event.preventDefault();
      setActiveBookPage(PAGE_NAMES.memories);
      return true;
    }

    if (event.code === "Digit2") {
      event.preventDefault();
      setActiveBookPage(PAGE_NAMES.statistics);
      return true;
    }

    if (event.key?.toLowerCase?.() === "m") {
      event.preventDefault();
      pressShortcutTab(rootEl.querySelector(".memory-book-tab-memories"));
      setActiveBookPage(PAGE_NAMES.memories);
      return true;
    }

    if (event.key?.toLowerCase?.() === "s") {
      event.preventDefault();
      pressShortcutTab(rootEl.querySelector(".memory-book-tab-statistics"));
      setActiveBookPage(PAGE_NAMES.statistics);
      return true;
    }

    return false;
  }

  function handleRootClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest(".memory-book-close")) {
      event.preventDefault();
      close();
      return;
    }

    if (target.closest(".memory-book-open-memory")) {
      event.preventDefault();
      const memory = getActiveMemory();
      if (memory) {
        detailModal.open(memory);
      }
      return;
    }

    const tab = target.closest(".memory-book-tab");
    if (tab?.dataset.page) {
      event.preventDefault();
      setActiveBookPage(tab.dataset.page);
      return;
    }

    if (target.closest(".memory-book-nav-prev")) {
      event.preventDefault();
      nudgeTimeline(-1);
      return;
    }

    if (target.closest(".memory-book-nav-next")) {
      event.preventDefault();
      nudgeTimeline(1);
      return;
    }

    const dateButton = target.closest(".memory-book-date-button");
    if (dateButton?.dataset.memoryIndex) {
      event.preventDefault();
      setScrollTarget(Number(dateButton.dataset.memoryIndex));
    }
  }

  rootEl.addEventListener("click", handleRootClick);
  rootEl.addEventListener("keydown", handleTabKeyDown, true);
  rootEl.addEventListener("keyup", handleTabKeyUp, true);
  rootEl.addEventListener("blur", handleTabBlur, true);
  closeButton?.addEventListener("pointerdown", handleClosePointerDown);
  closeButton?.addEventListener("pointerup", handleClosePointerUp);
  closeButton?.addEventListener("pointercancel", handleClosePointerUp);
  closeButton?.addEventListener("keydown", handleCloseKeyDown);
  closeButton?.addEventListener("keyup", handleCloseKeyUp);
  closeButton?.addEventListener("blur", handleClosePointerUp);
  window.addEventListener("keydown", handleShortcutKeyDown, true);
  window.addEventListener("keyup", handleShortcutKeyUp, true);
  memoryPageEl?.addEventListener("wheel", handleWheel, { passive: false });
  carouselViewportEl?.addEventListener("wheel", handleWheel, { passive: false });
  carouselViewportEl?.addEventListener("pointerdown", handlePointerDown);
  carouselViewportEl?.addEventListener("pointermove", handlePointerMove);
  carouselViewportEl?.addEventListener("pointerup", handlePointerUp);
  carouselViewportEl?.addEventListener("pointercancel", handlePointerUp);
  dateStripEl?.addEventListener("wheel", (event) => {
    if (!dateStripEl) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    event.stopPropagation();
    dateStripEl.scrollLeft += delta;
  }, { passive: false });
  window.addEventListener("resize", () => {
    measureTimeline();
    updateTimeline();
  }, { passive: true });

  setFrameImage();
  syncTabs();
  syncPageVisibility();
  renderCarousel();

  if (!options.memories) {
    loadGeneratedMemories().then((generatedMemories) => {
      state.hasLoadedManifest = true;
      memories = generatedMemories;
      state.scrollTarget = 0;
      state.scrollCurrent = 0;
      renderCarousel();
    });
  }

  return {
    element: rootEl,
    open,
    close,
    isOpen: () => state.isBookOpen,
    setActiveBookPage,
    handleKeyDown,
  };
}
