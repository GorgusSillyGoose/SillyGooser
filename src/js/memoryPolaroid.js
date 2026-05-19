const MEMORY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MEMORY_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatMemoryDate(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return MEMORY_DATE_FORMATTER.format(date).replaceAll(",", "");
}

export function formatMemoryShortDate(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return MEMORY_SHORT_DATE_FORMATTER.format(date).replaceAll(",", "");
}

export function createMemoryPolaroid(memory, options = {}) {
  const imageCount = Number.isFinite(Number(memory?.imageCount))
    ? Number(memory.imageCount)
    : Array.isArray(memory?.images)
      ? memory.images.length
      : 0;
  const title = memory?.title || "Untitled memory";
  const dateLabel = formatMemoryDate(memory?.date);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "memory-polaroid";
  button.dataset.memoryId = memory?.id || "";
  button.setAttribute("aria-label", [title, dateLabel].filter(Boolean).join(", "));

  if (imageCount > 1) {
    button.classList.add("is-stacked");
  }
  button.style.setProperty("--memory-stack-count", String(Math.max(1, imageCount)));

  const stackLayers = Math.min(Math.max(imageCount - 1, 0), 7);
  for (let index = stackLayers; index >= 1; index -= 1) {
    const layer = document.createElement("span");
    layer.className = "memory-polaroid-stack";
    layer.style.setProperty("--memory-stack-index", String(index));
    layer.style.setProperty("--memory-stack-direction", index % 2 === 0 ? "1" : "-1");
    layer.style.zIndex = String(2 + stackLayers - index);
    layer.setAttribute("aria-hidden", "true");
    button.appendChild(layer);
  }

  const paper = document.createElement("span");
  paper.className = "memory-polaroid-paper";
  button.appendChild(paper);

  const imageWrap = document.createElement("span");
  imageWrap.className = "memory-polaroid-image-wrap";
  paper.appendChild(imageWrap);

  const image = document.createElement("img");
  image.className = "memory-polaroid-cover";
  image.draggable = false;
  image.src = memory?.coverImage || "";
  image.alt = title;
  image.loading = options.loadCover === false ? "lazy" : "eager";
  image.decoding = "async";
  imageWrap.appendChild(image);

  const dateEl = document.createElement("span");
  dateEl.className = "memory-polaroid-date";
  dateEl.textContent = dateLabel;
  paper.appendChild(dateEl);

  const titleEl = document.createElement("span");
  titleEl.className = "memory-polaroid-title";
  titleEl.textContent = title;
  paper.appendChild(titleEl);

  if (typeof options.onSelect === "function") {
    button.addEventListener("click", () => {
      options.onSelect(memory);
    });
  }

  return button;
}
