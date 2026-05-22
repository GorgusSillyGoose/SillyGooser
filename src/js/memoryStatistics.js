export const statisticsData = {
  shared: {
    title: "Shared stats",
    subtitle: "Common totals from the scrapbook.",
    rows: [
      { label: "Total messages", value: 46870 },
      { label: "Total words", value: "about 165,937" },
      { label: "Media omitted", value: 9301 },
    ],
    notes: [
      {
        title: "Chat date range",
        body: "December 30, 2025 to May 21, 2026.",
      },
      {
        title: "“Bao bao / baobao / 宝宝 / 宝贝”",
        body: "appeared about 1,030 times. This relationship slowly transformed from English flirting into a Chinese baby-name ecosystem.",
      },
      {
        title: "“Good night / gn / 晚安”",
        body: "appeared about 172 times. But somehow “good night” often meant “let’s continue talking for 20 more minutes.”",
      },
      {
        title: "Fast replies",
        body: "about 81.8% of replies came within 1 minute. Both of you were clearly pretending not to wait by the phone.",
      },
      {
        title: "Busiest day",
        body: "January 7, 2026, with 1,353 messages. That is not “staying in touch.” That is a full-time job with overtime.",
      },
    ],
  },
  comparison: {
    title: "Versus stats",
    subtitle: "Dog vs Goose with a total column.",
    rows: [
      {
        label: "Messages sent",
        dog: 20787,
        goose: 26083,
        total: 46870,
        note: "Goose wins by 5,296 messages. She is officially the chat engine. Mr Doggo is the emotional co-pilot.",
      },
      {
        label: "“Probably” usage",
        dog: 160,
        goose: 44,
        total: 204,
        note: "“Probably” is Mr Doggo’s emotional defense mechanism.",
      },
      {
        label: "“Nerd” usage",
        dog: 28,
        goose: 55,
        total: 83,
        note: "Mr Doggo is not beating the allegations.",
      },
      {
        label: "“Grandma” usage",
        dog: 54,
        goose: 33,
        total: 87,
        note: "Goose calls him nerd, Mr Doggo retaliates with age-based warfare.",
      },
      {
        label: "“Miss” usage",
        dog: 152,
        goose: 304,
        total: 456,
        note: "This is not long-distance flirting. This is a mutual missing-you subscription service.",
      },
      {
        label: "😈 usage",
        dog: 973,
        goose: 85,
        total: 1058,
        note: "Mr Doggo was running a full-time mischievous side business.",
      },
      {
        label: "😭 usage",
        dog: 719,
        goose: 1441,
        total: 2160,
        note: "Goose is the CEO of emotional rain.",
      },
      {
        label: "Laughing incidents",
        dog: 1944,
        goose: 1744,
        total: 3688,
        note: "The chat contains enough hahaha / 😂 / 🤣 energy to qualify as a sitcom transcript.",
      },
      {
        label: "“Sorry” usage",
        dog: 184,
        goose: 174,
        total: 358,
        note: "A balanced apology economy. Very diplomatic. Very suspicious.",
      },
      {
        label: "Kiss department",
        dog: 5245,
        goose: 918,
        total: 6163,
        note: "Mr Doggo appears to have attempted to solve distance by weaponizing kiss emojis.",
      },
    ],
  },
  emojiCrimeScene: {
    title: "Emoji crime scene",
    subtitle: "Top emojis overall.",
    rows: [
      { label: "😚", value: 3709 },
      { label: "🥰", value: 3091 },
      { label: "😘", value: 2304 },
      { label: "😁", value: 2249 },
      { label: "😭", value: 2160 },
    ],
    note: "This chat has two emotional modes: kissing aggressively or crying dramatically.",
  },
  affectionInflation: {
    title: "Affection inflation index",
    rows: [
      { label: "Love", value: 1230 },
      { label: "Babe", value: 1398 },
      { label: "Baby", value: 438 },
      { label: "Cute", value: 331 },
      { label: "Miss", value: 456 },
    ],
    note: "At some point, normal names were abandoned and replaced by a rotating system of babe / baby / bao bao / nerd / grandma.",
  },
  sleepDenial: {
    title: "Sleep denial society",
    rows: [
      { label: "Sleep mentions", value: 778 },
      { label: "Good night attempts", value: 172 },
      { label: "Messages between 00:00 and 05:59", value: 6288 },
      { label: "Busiest sleepy hour", value: "02:00 with 1,644 messages" },
    ],
    note: "The evidence suggests both suspects knew what sleep was, but treated it as an optional side quest.",
  },
  dramaticAchievementAwards: {
    title: "Dramatic achievement awards",
    lines: [
      "Longest solo spam run: Goose sent 66 consecutive messages from January 10 to January 11. That is not texting. That is releasing an audiobook in chapters.",
      "Doggo counterattack: Mr Doggo’s biggest streak was 52 messages on January 5. A very serious case of keyboard zoomies.",
      "Peak yap hour: 13:00 was the busiest hour with 4,187 messages. Apparently lunch break means emotional admin.",
    ],
  },
  spamAchievement: {
    title: "Biggest spam achievement",
    lines: [
      "Goose’s longest message was over 4,000 characters, mostly repeating “drolletje.”",
      "This is not a message. This is Dutch psychological warfare.",
      "Mr Doggo’s longest counter-spam was a 1,080-character wall of 😚 emojis.",
      "Peace was never an option.",
    ],
  },
  finalDiagnosis: {
    title: "Final diagnosis",
    lines: [
      "This chat is approximately:",
      "32% “I miss you / babe / baby / bao bao”",
      "24% emojis with emotional consequences",
      "15% trying and failing to sleep",
      "11% food, work, and travel logistics",
      "10% nerd vs grandma combat",
      "8% dramatic crimes against the keyboard",
    ],
  },
};

const DOG_HEADER_SRC = new URL("../assets/ui/Small_dog.png", import.meta.url).href;
const GOOSE_HEADER_SRC = new URL("../assets/ui/Small_goose.png", import.meta.url).href;
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

function formatValue(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return NUMBER_FORMATTER.format(numericValue);
  }

  return String(value ?? 0);
}

function createSectionShell(title, subtitle) {
  const sectionEl = document.createElement("section");
  sectionEl.className = "memory-statistics-section";

  const headingEl = document.createElement("h3");
  headingEl.className = "memory-statistics-heading";
  headingEl.textContent = title || "";
  sectionEl.appendChild(headingEl);

  if (subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "memory-statistics-subheading";
    subtitleEl.textContent = subtitle;
    sectionEl.appendChild(subtitleEl);
  }

  return sectionEl;
}

function appendNoteList(parentEl, data = {}) {
  const notes = [];

  if (Array.isArray(data.lines)) {
    for (const line of data.lines) {
      notes.push({ text: line });
    }
  }

  if (Array.isArray(data.notes)) {
    for (const note of data.notes) {
      notes.push(note);
    }
  }

  if (data.note) {
    notes.push({ text: data.note });
  }

  if (!notes.length) {
    return false;
  }

  const notesEl = document.createElement("div");
  notesEl.className = "memory-statistics-note-list";

  for (const note of notes) {
    const noteEl = document.createElement("p");
    noteEl.className = "memory-statistics-note";

    if (note?.title) {
      const strongEl = document.createElement("strong");
      strongEl.textContent = note.title;
      noteEl.appendChild(strongEl);
      if (note.body) {
        noteEl.append(" ");
        noteEl.append(note.body);
      }
    } else if (note?.body) {
      noteEl.textContent = note.body;
    } else {
      noteEl.textContent = note?.text || String(note ?? "");
    }

    notesEl.appendChild(noteEl);
  }

  parentEl.appendChild(notesEl);
  return true;
}

function createValueRowsSection(data = {}, options = {}) {
  const includeHeading = options.includeHeading !== false;
  const sectionEl = includeHeading
    ? createSectionShell(data.title, data.subtitle)
    : document.createElement("section");
  sectionEl.className = includeHeading
    ? "memory-statistics-section memory-statistics-section--values"
    : "memory-statistics-section memory-statistics-section--values memory-statistics-section--compact";

  if (!includeHeading) {
    sectionEl.classList.add("memory-statistics-section--compact");
  }

  const listEl = document.createElement("div");
  listEl.className = "memory-statistics-list";

  for (const entry of Array.isArray(data.rows) ? data.rows : []) {
    const rowEl = document.createElement("div");
    rowEl.className = "memory-statistics-row";

    const labelEl = document.createElement("span");
    labelEl.className = "memory-statistics-row-label";
    labelEl.textContent = entry?.label || "";

    const valueEl = document.createElement("span");
    valueEl.className = "memory-statistics-row-value";
    valueEl.textContent = formatValue(entry?.value);

    rowEl.appendChild(labelEl);
    rowEl.appendChild(valueEl);
    listEl.appendChild(rowEl);
  }

  if (!listEl.childElementCount) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "memory-statistics-empty";
    emptyEl.textContent = "No stats yet.";
    listEl.appendChild(emptyEl);
  }

  sectionEl.appendChild(listEl);
  appendNoteList(sectionEl, data);
  return sectionEl;
}

function createNoteSection(data = {}) {
  const sectionEl = createSectionShell(data.title, data.subtitle);
  sectionEl.classList.add("memory-statistics-section--notes");
  appendNoteList(sectionEl, data);
  return sectionEl;
}

function createComparisonHeader(data = statisticsData.comparison) {
  const sectionEl = createSectionShell(data.title, data.subtitle);
  sectionEl.classList.add("memory-statistics-page-static", "memory-statistics-page-static--table");

  const tableEl = document.createElement("table");
  tableEl.className = "memory-statistics-table memory-statistics-table--header";
  tableEl.innerHTML = `
    <colgroup>
      <col class="memory-statistics-table-col memory-statistics-table-col-label" />
      <col class="memory-statistics-table-col memory-statistics-table-col-value" />
      <col class="memory-statistics-table-col memory-statistics-table-col-value" />
      <col class="memory-statistics-table-col memory-statistics-table-col-value" />
    </colgroup>
    <thead class="memory-statistics-table-header">
      <tr class="memory-statistics-table-header-row">
        <th class="memory-statistics-table-header-cell memory-statistics-table-header-cell-label">Stat</th>
        <th class="memory-statistics-table-header-cell memory-statistics-table-header-cell-icon" aria-label="Dog">
          <img class="memory-statistics-table-icon" src="${DOG_HEADER_SRC}" alt="" aria-hidden="true" />
        </th>
        <th class="memory-statistics-table-header-cell memory-statistics-table-header-cell-icon" aria-label="Goose">
          <img class="memory-statistics-table-icon" src="${GOOSE_HEADER_SRC}" alt="" aria-hidden="true" />
        </th>
        <th class="memory-statistics-table-header-cell memory-statistics-table-header-cell-total">Total</th>
      </tr>
    </thead>
  `;

  sectionEl.appendChild(tableEl);
  return sectionEl;
}

function wirePageWheelScroll(pageEl, scrollEl) {
  if (!pageEl || !scrollEl) {
    return;
  }

  pageEl.addEventListener(
    "wheel",
    (event) => {
      if (scrollEl.contains(event.target)) {
        return;
      }

      if (scrollEl.scrollHeight <= scrollEl.clientHeight) {
        return;
      }

      scrollEl.scrollTop += event.deltaY;
      event.preventDefault();
    },
    { passive: false }
  );
}

function attachCustomScrollbar(pageEl, scrollEl, contentEl) {
  if (!pageEl || !scrollEl) {
    return;
  }

  const scrollbarEl = document.createElement("div");
  scrollbarEl.className = "memory-statistics-custom-scrollbar";

  const trackEl = document.createElement("div");
  trackEl.className = "memory-statistics-custom-scrollbar-track";
  scrollbarEl.appendChild(trackEl);

  const thumbEl = document.createElement("div");
  thumbEl.className = "memory-statistics-custom-scrollbar-thumb";
  scrollbarEl.appendChild(thumbEl);
  pageEl.appendChild(scrollbarEl);

  const syncScrollbar = () => {
    const scrollHeight = contentEl?.offsetHeight ?? scrollEl.scrollHeight;
    const clientHeight = scrollEl.clientHeight;
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

    scrollbarEl.hidden = maxScrollTop <= 0;
    if (maxScrollTop <= 0) {
      return;
    }

    scrollbarEl.style.top = `${scrollEl.offsetTop}px`;
    scrollbarEl.style.height = `${clientHeight}px`;

    const trackHeight = clientHeight;
    const thumbHeight = Math.max(28, Math.round((clientHeight * clientHeight) / scrollHeight));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = Math.round((scrollEl.scrollTop / maxScrollTop) * maxThumbTop);

    thumbEl.style.height = `${thumbHeight}px`;
    thumbEl.style.transform = `translateY(${thumbTop}px)`;
  };

  scrollEl.addEventListener("scroll", syncScrollbar, { passive: true });

  if (contentEl && "ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(syncScrollbar);
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(contentEl);
  } else {
    window.addEventListener("resize", syncScrollbar, { passive: true });
  }

  requestAnimationFrame(syncScrollbar);
}

export function createTogetherStats(data = statisticsData.shared, options = {}) {
  return createValueRowsSection(data, options);
}

export function createGooseDogStatsTable(data = statisticsData.comparison, options = {}) {
  const includeHeading = options.includeHeading !== false;
  const sectionEl = includeHeading
    ? createSectionShell(data.title, data.subtitle)
    : document.createElement("section");
  sectionEl.className = includeHeading
    ? "memory-statistics-section memory-statistics-section--table"
    : "memory-statistics-section memory-statistics-section--table memory-statistics-section--compact";

  const tableWrapEl = document.createElement("div");
  tableWrapEl.className = "memory-statistics-table-wrap";
  tableWrapEl.innerHTML = `
    <table class="memory-statistics-table memory-statistics-table--body">
      <colgroup>
        <col class="memory-statistics-table-col memory-statistics-table-col-label" />
        <col class="memory-statistics-table-col memory-statistics-table-col-value" />
        <col class="memory-statistics-table-col memory-statistics-table-col-value" />
        <col class="memory-statistics-table-col memory-statistics-table-col-value" />
      </colgroup>
      <tbody class="memory-statistics-table-body"></tbody>
    </table>
  `;
  sectionEl.appendChild(tableWrapEl);

  const bodyEl = sectionEl.querySelector(".memory-statistics-table-body");
  if (!bodyEl) {
    return sectionEl;
  }

  for (const entry of Array.isArray(data.rows) ? data.rows : []) {
    const rowEl = document.createElement("tr");
    rowEl.className = "memory-statistics-table-row";

    const labelCell = document.createElement("td");
    labelCell.className = "memory-statistics-table-cell memory-statistics-table-cell-label";
    labelCell.textContent = entry?.label || "";

    const dogCell = document.createElement("td");
    dogCell.className = "memory-statistics-table-cell memory-statistics-table-cell-value";
    dogCell.textContent = formatValue(entry?.dog);

    const gooseCell = document.createElement("td");
    gooseCell.className = "memory-statistics-table-cell memory-statistics-table-cell-value";
    gooseCell.textContent = formatValue(entry?.goose);

    const totalCell = document.createElement("td");
    totalCell.className = "memory-statistics-table-cell memory-statistics-table-cell-value";
    totalCell.textContent = formatValue(entry?.total);

    rowEl.appendChild(labelCell);
    rowEl.appendChild(dogCell);
    rowEl.appendChild(gooseCell);
    rowEl.appendChild(totalCell);
    bodyEl.appendChild(rowEl);

    if (entry?.note) {
      const noteRowEl = document.createElement("tr");
      noteRowEl.className = "memory-statistics-table-note-row";
      const noteCellEl = document.createElement("td");
      noteCellEl.colSpan = 4;
      noteCellEl.className = "memory-statistics-table-note";
      noteCellEl.textContent = entry.note;
      noteRowEl.appendChild(noteCellEl);
      bodyEl.appendChild(noteRowEl);
    }
  }

  if (!bodyEl.childElementCount) {
    const rowEl = document.createElement("tr");
    const cellEl = document.createElement("td");
    cellEl.colSpan = 4;
    cellEl.className = "memory-statistics-table-empty";
    cellEl.textContent = "No comparison stats yet.";
    rowEl.appendChild(cellEl);
    bodyEl.appendChild(rowEl);
  }

  return sectionEl;
}

export function createStatisticsPage(data = statisticsData) {
  const rootEl = document.createElement("div");
  rootEl.className = "memory-statistics-content";

  const spreadEl = document.createElement("div");
  spreadEl.className = "memory-statistics-spread";

  const leftPageEl = document.createElement("div");
  leftPageEl.className = "memory-statistics-page memory-statistics-page--left";
  const leftStaticEl = createSectionShell(data.shared.title, data.shared.subtitle);
  leftStaticEl.classList.add("memory-statistics-page-static");

  const leftScrollEl = document.createElement("div");
  leftScrollEl.className = "memory-statistics-page-scroll memory-statistics-page-scroll--left";
  const leftScrollContentEl = document.createElement("div");
  leftScrollContentEl.className = "memory-statistics-page-scroll-content";
  leftScrollContentEl.appendChild(createTogetherStats(data.shared, { includeHeading: false }));
  leftScrollContentEl.appendChild(createValueRowsSection(data.emojiCrimeScene));
  leftScrollContentEl.appendChild(createValueRowsSection(data.affectionInflation));
  leftScrollContentEl.appendChild(createValueRowsSection(data.sleepDenial));
  leftScrollContentEl.appendChild(createNoteSection(data.dramaticAchievementAwards));
  leftScrollContentEl.appendChild(createNoteSection(data.spamAchievement));
  leftScrollContentEl.appendChild(createNoteSection(data.finalDiagnosis));
  leftScrollEl.appendChild(leftScrollContentEl);

  leftPageEl.innerHTML = "";
  leftPageEl.appendChild(leftStaticEl);
  leftPageEl.appendChild(leftScrollEl);
  wirePageWheelScroll(leftPageEl, leftScrollEl);
  attachCustomScrollbar(leftPageEl, leftScrollEl, leftScrollContentEl);

  const rightPageEl = document.createElement("div");
  rightPageEl.className = "memory-statistics-page memory-statistics-page--right";
  const rightStaticEl = createComparisonHeader(data.comparison);

  const rightScrollEl = document.createElement("div");
  rightScrollEl.className = "memory-statistics-page-scroll memory-statistics-page-scroll--right";
  const rightScrollContentEl = document.createElement("div");
  rightScrollContentEl.className = "memory-statistics-page-scroll-content";
  rightScrollContentEl.appendChild(createGooseDogStatsTable(data.comparison, { includeHeading: false }));
  rightScrollContentEl.appendChild(createNoteSection(data.spamAchievement));
  rightScrollEl.appendChild(rightScrollContentEl);
  rightPageEl.appendChild(rightStaticEl);
  rightPageEl.appendChild(rightScrollEl);
  wirePageWheelScroll(rightPageEl, rightScrollEl);
  attachCustomScrollbar(rightPageEl, rightScrollEl, rightScrollContentEl);

  // TODO: Fine-tune the left/right page inset against the final book artwork.
  spreadEl.appendChild(leftPageEl);
  spreadEl.appendChild(rightPageEl);

  rootEl.appendChild(spreadEl);
  return rootEl;
}

export const SharedStats = createTogetherStats;
export const VersusStats = createGooseDogStatsTable;
export const EmojiCrimeScene = (data = statisticsData.emojiCrimeScene) => createValueRowsSection(data);
export const AffectionInflationIndex = (data = statisticsData.affectionInflation) => createValueRowsSection(data);
export const SleepDenialSociety = (data = statisticsData.sleepDenial) => createValueRowsSection(data);
export const DramaticAchievementAwards = (data = statisticsData.dramaticAchievementAwards) => createNoteSection(data);
export const BiggestSpamAchievement = (data = statisticsData.spamAchievement) => createNoteSection(data);
export const FinalDiagnosis = (data = statisticsData.finalDiagnosis) => createNoteSection(data);
export const StatisticsPage = createStatisticsPage;
export const createStatisticsContent = createStatisticsPage;
