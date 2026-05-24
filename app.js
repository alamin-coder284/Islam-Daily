"use strict";

let quranAyahs = [];
let heatmapYear = new Date().getFullYear();
let heatmapMonth = new Date().getMonth();

async function loadQuranAyahs() {
  const res = await fetch("quran.json");
  const json = await res.json();

  quranAyahs = json
    .flatMap((surah) =>
      (surah.verses || []).map((ayah, idx) => ({
        text: ayah.text || "",
        surahName: surah.transliteration || surah.name || "",
        verseNumber: ayah.id || idx + 1,
        surahNumber: surah.id || null,
      })),
    )
    .filter((item) => item.text);
}

const DB_NAME = "dailyIslamicApp";
const DB_VERSION = 1;
const STORE_NAME = "activities";

const DEFAULT_DATA = [
  {
    id: "quran",
    total: 6236,
    current: 0,
    dailyLogs: {},
  },
  {
    id: "hadith",
    books: [
      {
        name: "Sahih Al Bukhari",
        author: "Imam Bukhari",
        totalHadith: 7000,
        currentHadith: 120,
        dailyLogs: {},
      },
    ],
  },
  {
    id: "books",
    books: [
      {
        name: "Al Fawaid",
        author: "Ibn Qayyim",
        totalPages: 300,
        currentPages: 0,
      },
    ],
  },
  {
    id: "azkar",
    list: [{ name: "SubhanAllah", count: 0 }],
  },
  {
    id: "dua",
    list: ["Morning Dua"],
    history: {},
  },
  {
    id: "deeds",
    list: [],
  },
  {
    id: "prayer",
    completedToday: [],
    history: {},
  },
];

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

function getTransaction(mode = "readonly") {
  if (!db) throw new Error("Database not initialized");
  return db.transaction(STORE_NAME, mode);
}

function getData(id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = getTransaction("readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function saveData(data) {
  return new Promise((resolve, reject) => {
    try {
      const tx = getTransaction("readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(data);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    } catch (err) {
      reject(err);
    }
  });
}

async function seedData() {
  for (const item of DEFAULT_DATA) {
    const existing = await getData(item.id);
    if (!existing) {
      await saveData(item);
    }
  }
}

function safeText(value) {
  return String(value ?? "");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = safeText(text);
  return node;
}

function clearAndHideSection(card) {
  const content = Array.from(card.children).filter(
    (child) => !child.classList.contains("card-header"),
  );
  content.forEach((child) => {
    child.style.display = "none";
  });
  card.classList.remove("open");
}

function showSection(card) {
  const content = Array.from(card.children).filter(
    (child) => !child.classList.contains("card-header"),
  );
  content.forEach((child) => {
    child.style.display = "";
  });
  card.classList.add("open");
}

function initAccordion(cards) {
  cards.forEach((card) => {
    const header = card.querySelector(".card-header");
    if (!header) return;

    clearAndHideSection(card);
    header.style.cursor = "pointer";

    header.addEventListener("click", () => {
      if (card.classList.contains("open")) {
        clearAndHideSection(card);
      } else {
        showSection(card);
      }
    });
  });
}

function setProgressFill(fillEl, percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  fillEl.style.width = `${clamped}%`;
}

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++)
    cells.push(new Date(year, month, day));

  return cells;
}

function getHeatClass(count) {
  if (!count) return "empty";
  if (count <= 5) return "low";
  if (count <= 15) return "mid";
  return "high";
}

function renderQuranHeatmap(dailyLogs = {}) {
  const heatmap = document.getElementById("quranHeatmap");
  const title = document.getElementById("monthAndYear");
  const detail = document.getElementById("quranDayDetail");
  if (!heatmap || !title || !detail) return;

  const firstDay = new Date(heatmapYear, heatmapMonth, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(heatmapYear, heatmapMonth + 1, 0).getDate();
  title.textContent = firstDay.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  heatmap.innerHTML = "";

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "heatmap-day empty";
    heatmap.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(heatmapYear, heatmapMonth, day);
    const key = getLocalDateKey(dateObj);
    const count = dailyLogs[key] || 0;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `heatmap-day ${getHeatClass(count)}`;
    cell.title = `${key}: ${count ? count + " ayahs" : "missed"}`;

    const dayNum = document.createElement("strong");
    dayNum.textContent = day;

    const value = document.createElement("span");
    value.style.fontSize = "8px";
    value.style.filter = "brightness(160%)";
    value.textContent = count ? count : "—";

    cell.appendChild(dayNum);
    cell.appendChild(value);

    cell.addEventListener("click", () => {
      detail.textContent = count
        ? `${key}: you read ${count} ayahs.`
        : `${key}: no ayahs recorded.`;
    });

    heatmap.appendChild(cell);
  }
}

function initHeatmapNav(getDailyLogs) {
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");

  prevBtn.addEventListener("click", () => {
    heatmapMonth--;
    if (heatmapMonth < 0) {
      heatmapMonth = 11;
      heatmapYear--;
    }
    renderQuranHeatmap(getDailyLogs());
  });

  nextBtn.addEventListener("click", () => {
    heatmapMonth++;
    if (heatmapMonth > 11) {
      heatmapMonth = 0;
      heatmapYear++;
    }
    renderQuranHeatmap(getDailyLogs());
  });
}

async function initQuran() {
  const card = document.getElementById("quran-section");
  const data = await getData("quran");
  initHeatmapNav(() => data.dailyLogs || {});
  renderQuranHeatmap(data.dailyLogs || {});

  const progressText = card.querySelector(".progress-text");
  const progressFill = card.querySelector(".progress-fill");
  const input = card.querySelector("#quranInput");
  const button = card.querySelector("#quranBtn");
  const currentAyah = card.querySelector("#currentAyah");

  function updateUI() {
    const percent = (data.current / data.total) * 100;
    progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = `${data.current} / 6236 Ayahs Completed`;

    const ayah = quranAyahs[data.current - 1];

    if (ayah) {
      currentAyah.innerHTML = `
    <h3>Last Read:</h3>
    <div class="ayah-text">${ayah.text}</div>
    <div class="ayah-meta">${ayah.surahName} • Verse ${ayah.verseNumber}</div>
  `;
    }
  }

  function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  button.addEventListener("click", async () => {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) return;

    const today = getLocalDateKey();

    data.dailyLogs = data.dailyLogs || {};
    data.dailyLogs[today] = (data.dailyLogs[today] || 0) + value;

    data.current = Math.min(data.total, data.current + value);

    await saveData(data);
    input.value = "";
    updateUI();
    await saveData(data);
    updateUI();
    renderQuranHeatmap(data.dailyLogs || {});
  });

  updateUI();
}

// init Hadith Data
function getHadithPercent(book) {
  if (!book.totalHadith) return 0;
  return Math.min(100, (book.currentHadith / book.totalHadith) * 100);
}

function getHadithTopPercent(books) {
  const total = books.reduce(
    (sum, book) => sum + (Number(book.totalHadith) || 0),
    0,
  );
  const read = books.reduce(
    (sum, book) => sum + (Number(book.currentHadith) || 0),
    0,
  );
  if (!total) return 0;
  return Math.min(100, (read / total) * 100);
}

function initHadithFormToggle() {
  const toggleBtn = document.getElementById("toggleHadithForm");
  const formWrap = document.getElementById("hadithFormWrap");

  toggleBtn.addEventListener("click", () => {
    const isOpen = !formWrap.hasAttribute("hidden");

    if (isOpen) {
      formWrap.setAttribute("hidden", "");
      toggleBtn.style.boxShadow = "none";
      toggleBtn.setAttribute("aria-expanded", "false");
    } else {
      formWrap.removeAttribute("hidden");
      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.style.boxShadow = "0 0 0 4px rgba(255,255,255,0.06)";
    }
  });
}

async function initHadith() {
  const data = await getData("hadith");

  const list = document.getElementById("hadithList");
  const topFill = document.getElementById("hadithTopFill");
  const topText = document.getElementById("hadithTopText");

  function updateTop() {
    const percent = getHadithTopPercent(data.books || []);
    topFill.style.width = `${percent}%`;
    topText.textContent = `Hadith Collection Progress: ${Math.round(percent)}%`;
  }

  function render() {
    list.innerHTML = "";

    (data.books || []).forEach((book, index) => {
      const card = document.createElement("div");
      card.className = "hadith-book-card";

      const top = document.createElement("div");
      top.className = "hadith-book-top";

      const info = document.createElement("div");

      const title = document.createElement("div");
      title.className = "hadith-book-title";
      title.textContent = book.name;

      const author = document.createElement("span");
      author.className = "hadith-book-author";
      author.textContent = book.author;

      info.appendChild(title);
      info.appendChild(author);

      const progressText = document.createElement("div");
      progressText.className = "hadith-book-progress-text";
      progressText.textContent = `${book.currentHadith || 0} / ${book.totalHadith || 0} Hadith`;

      const progress = document.createElement("div");
      progress.className = "progress";

      const fill = document.createElement("div");
      fill.className = "progress-fill";
      fill.style.width = `${getHadithPercent(book)}%`;

      progress.appendChild(fill);

      const actions = document.createElement("div");
      actions.className = "hadith-book-actions";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "hadith-mini-btn";
      addBtn.textContent = "+1 Hadith";

      addBtn.addEventListener(
        "click",
        async (e) => {
          e.stopPropagation();
          book.currentHadith = Math.min(
            book.totalHadith,
            (Number(book.currentHadith) || 0) + 1,
          );

          await saveData(data);
          render();
          updateTop();
        },
        false,
      );

      actions.appendChild(addBtn);

      top.appendChild(info);
      card.appendChild(top);
      card.appendChild(progressText);
      card.appendChild(progress);
      card.appendChild(actions);

      list.appendChild(card);
    });

    updateTop();
  }

  const saveBtn = document.getElementById("saveHadithBook");
  const nameInput = document.getElementById("newHadithName");
  const authorInput = document.getElementById("newHadithAuthor");
  const totalInput = document.getElementById("newHadithTotal");
  const formWrap = document.getElementById("hadithFormWrap");
  const toggleBtn = document.getElementById("toggleHadithForm");

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const author = authorInput.value.trim();
    const totalHadith = Number(totalInput.value);

    if (!name || !author || !Number.isFinite(totalHadith) || totalHadith <= 0)
      return;

    data.books = data.books || [];
    data.books.push({
      name,
      author,
      totalHadith,
      currentHadith: 0,
    });

    await saveData(data);

    nameInput.value = "";
    authorInput.value = "";
    totalInput.value = "";
    formWrap.setAttribute("hidden", "");
    toggleBtn.setAttribute("aria-expanded", "false");

    render();
  });

  render();
}

// init Books

function getBookPercent(book) {
  if (!book.totalPages) return 0;
  return Math.min(100, (book.currentPages / book.totalPages) * 100);
}

function getBooksTopPercent(books) {
  const total = books.reduce(
    (sum, book) => sum + (Number(book.totalPages) || 0),
    0,
  );
  const read = books.reduce(
    (sum, book) => sum + (Number(book.currentPages) || 0),
    0,
  );
  if (!total) return 0;
  return Math.min(100, (read / total) * 100);
}

function initBooksFormToggle() {
  const toggleBtn = document.getElementById("toggleBooksForm");
  const formWrap = document.getElementById("booksFormWrap");

  if (!toggleBtn || !formWrap) return;

  toggleBtn.addEventListener("click", () => {
    const isOpen = !formWrap.hasAttribute("hidden");

    if (isOpen) {
      formWrap.setAttribute("hidden", "");
      toggleBtn.setAttribute("aria-expanded", "false");
    } else {
      formWrap.removeAttribute("hidden");
      toggleBtn.setAttribute("aria-expanded", "true");
    }
  });
}

async function initBooksSection() {
  const data = await getData("books");

  const list = document.getElementById("booksList");
  const topFill = document.getElementById("booksTopFill");
  const topText = document.getElementById("booksTopText");

  if (!list || !topFill || !topText) return;

  function updateTop() {
    const percent = getBooksTopPercent(data.books || []);
    topFill.style.width = `${percent}%`;
    topText.textContent = `Islamic Books Progress: ${Math.round(percent)}%`;
  }

  function render() {
    list.innerHTML = "";

    (data.books || []).forEach((book) => {
      const card = document.createElement("div");
      card.className = "book-card";

      const top = document.createElement("div");
      top.className = "book-top";

      const info = document.createElement("div");

      const title = document.createElement("div");
      title.className = "book-title";
      title.textContent = book.name;

      const author = document.createElement("span");
      author.className = "book-author";
      author.textContent = book.author;

      info.appendChild(title);
      info.appendChild(author);

      const progressText = document.createElement("div");
      progressText.className = "book-progress-text";
      progressText.textContent = `${book.currentPages || 0} / ${book.totalPages || 0} Pages`;

      const progress = document.createElement("div");
      progress.className = "progress";

      const fill = document.createElement("div");
      fill.className = "progress-fill";
      fill.style.width = `${getBookPercent(book)}%`;

      progress.appendChild(fill);

      const actions = document.createElement("div");
      actions.className = "book-actions";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "book-mini-btn";
      addBtn.textContent = "+1 Page";

      addBtn.addEventListener("click", async () => {
        book.currentPages = Math.min(
          book.totalPages,
          (Number(book.currentPages) || 0) + 1,
        );

        await saveData(data);
        render();
        updateTop();
      });

      actions.appendChild(addBtn);

      top.appendChild(info);
      card.appendChild(top);
      card.appendChild(progressText);
      card.appendChild(progress);
      card.appendChild(actions);

      list.appendChild(card);
    });

    updateTop();
  }

  const saveBtn = document.getElementById("saveBook");
  const nameInput = document.getElementById("newBookName");
  const authorInput = document.getElementById("newBookAuthor");
  const totalInput = document.getElementById("newBookTotal");
  const formWrap = document.getElementById("booksFormWrap");
  const toggleBtn = document.getElementById("toggleBooksForm");

  if (
    !saveBtn ||
    !nameInput ||
    !authorInput ||
    !totalInput ||
    !formWrap ||
    !toggleBtn
  )
    return;

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const author = authorInput.value.trim();
    const totalPages = Number(totalInput.value);

    if (!name || !author || !Number.isFinite(totalPages) || totalPages <= 0)
      return;

    data.books = data.books || [];
    data.books.push({
      name,
      author,
      totalPages,
      currentPages: 0,
    });

    await saveData(data);

    nameInput.value = "";
    authorInput.value = "";
    totalInput.value = "";
    formWrap.setAttribute("hidden", "");
    toggleBtn.setAttribute("aria-expanded", "false");

    render();
  });

  render();
}

/* load Azkar */
async function initAzkar() {
  const card = document.getElementById("azkar-section");
  const data = await getData("azkar");

  const list = card.querySelector(".activity-list");
  const input = card.querySelector("#azkarInput");
  const button = card.querySelector("#azkarBtn");

  async function render() {
    list.innerHTML = "";
    data.list.forEach((zikr, index) => {
      const btn = el("button", "tag", `${zikr.name} (${zikr.count})`);
      btn.type = "button";
      btn.addEventListener("click", async () => {
        data.list[index].count += 1;
        await saveData(data);
        render();
      });
      list.appendChild(btn);
    });
  }

  button.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) return;

    data.list.push({ name: value, count: 0 });
    await saveData(data);
    input.value = "";
    render();
  });

  await render();
}

async function initDua() {
  const card = document.getElementById("dua-section");
  const data = await getData("dua");

  const list = card.querySelector(".activity-list");
  const input = card.querySelector("#duaInput");
  const button = card.querySelector("#duaBtn");

  function render() {
    list.innerHTML = "";
    list.appendChild(el("span", "duaAfterSalah tag", "Dua After Salah"));
    data.list.forEach((dua) => {
      list.appendChild(el("span", "tag", dua));
    });
  }

  button.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) return;

    data.list.push(value);
    await saveData(data);
    input.value = "";
    render();
  });

  render();
}

async function initDeeds() {
  const card = document.getElementById("deeds-section");
  const data = await getData("deeds");

  const list = card.querySelector(".activity-list");
  const input = card.querySelector("#deedInput");
  const button = card.querySelector("#deedBtn");

  function render() {
    list.innerHTML = "";
    data.list.forEach((deed) => {
      list.appendChild(el("span", "tag", deed));
    });
  }

  button.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) return;

    data.list.push(value);
    await saveData(data);
    input.value = "";
    render();
  });

  render();
}

function initSidebarAndTheme() {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const themeToggle = document.getElementById("themeToggle");
  const resetDB = document.getElementById("resetDB");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
    });
  }

  if (resetDB) {
    resetDB.addEventListener("click", async () => {
      if (!db) return;
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = async () => {
        await seedData();
        location.reload();
      };
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await openDB();
    await seedData();

    const cards = document.querySelectorAll(".card");
    initAccordion(cards);
    initSidebarAndTheme();

    await loadQuranAyahs();
    await initQuran();
    await initHadith();

    initBooksFormToggle();
    await initBooksSection();

    await initAzkar();
    await initDua();
    initDuaChecklist();
    await initDeeds();

    initModalSystem();
    await initDuaHistory();
    await initStreakSystem();
    await initPrayerTracker();
    await initDailySummary();
  } catch (error) {
    console.error("App initialization failed:", error);
  }
});

const historyToggle = document.querySelector(".history-toggle");
const historyPanel = document.querySelector(".history-panel");

historyToggle.addEventListener("click", () => {
  const isOpen = historyToggle.getAttribute("aria-expanded") === "true";
  historyToggle.setAttribute("aria-expanded", String(!isOpen));

  if (isOpen) {
    historyPanel.style.maxHeight = null;
    setTimeout(() => {
      historyPanel.hidden = true;
    }, 250);
  } else {
    historyPanel.hidden = false;
    historyPanel.style.maxHeight = historyPanel.scrollHeight + "px";
  }
});

function initDuaChecklist() {
  const panel = document.getElementById("duaFullScreen");
  const duaAfterSalahList = document.querySelector(".duaAfterSalah");
  const closeBtn = document.getElementById("closeDuaView");
  const saveBtn = document.getElementById("saveDuaDone");
  const items = [...document.querySelectorAll("#myUL .dua-item")];

  duaAfterSalahList.addEventListener("click", () => {
    panel.hidden = false;
  });

  const doneState = new Array(items.length).fill(false);

  function updateSaveButton() {
    const allDone = doneState.every(Boolean);
    saveBtn.hidden = !allDone;
  }

  items.forEach((item, index) => {
    item.addEventListener("click", () => {
      doneState[index] = !doneState[index];
      item.classList.toggle("done", doneState[index]);
      updateSaveButton();
    });
  });

  saveBtn.addEventListener("click", async () => {
    const completedDuas = items
      .filter((_, i) => doneState[i])
      .map((el) => el.textContent.trim());

    // save completedDuas to IndexedDB or your existing Dua list
    panel.hidden = true;
  });

  closeBtn.addEventListener("click", () => {
    panel.hidden = true;
  });

  updateSaveButton();
}

/* ========================================
   MODAL SYSTEM FOR FULLSCREEN VIEWS
======================================== */

function initModalSystem() {
  const cards = document.querySelectorAll(".card");

  cards.forEach((card) => {
    const header = card.querySelector(".card-header");
    if (!header) return;

    header.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        openCardModal(card);
      }
    });
  });
}




//test 

function openCardModal(card) {
  // Prevent double open
  if (document.querySelector(".card-modal-wrapper")) return;

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "card-modal-wrapper";

  // Create close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "close-modal-btn";
  closeBtn.innerHTML = "✕";

  // Save original styles
  const original = {
    parent: card.parentNode,
    next: card.nextSibling,
    style: card.getAttribute("style") || ""
  };

  // Add modal class
  card.classList.add("modal-card");

  // Move card into wrapper
  wrapper.appendChild(card);

  // Add to body
  document.body.append(wrapper, closeBtn);

  // Animate
  requestAnimationFrame(() => {
    wrapper.classList.add("show");
  });

  function closeModal() {
    clearAndHideSection(card);
    wrapper.classList.remove("show");

    setTimeout(() => {
      // Restore card
      card.classList.remove("modal-card");
      card.setAttribute("style", original.style);

      if (original.next) {
        original.parent.insertBefore(card, original.next);
      } else {
        original.parent.appendChild(card);
      }

      wrapper.remove();
      closeBtn.remove();
    }, 220);
  }

  closeBtn.onclick = closeModal;

  wrapper.onclick = (e) => {
    if (e.target === wrapper) {
      closeModal();
    }
  };
}



//  test
//    clearAndHideSection(card);

/* ========================================
   DUA HISTORY TRACKING SYSTEM
======================================== */

async function initDuaHistory() {
  let duaData = (await getData("dua")) || { list: [], history: {} };

  if (!duaData.history) {
    duaData.history = {};
    await saveData(duaData);
  }

  const saveDuaBtn = document.getElementById("saveDuaDone");
  if (!saveDuaBtn) return;

  const originalClick = saveDuaBtn.onclick;

  saveDuaBtn.addEventListener("click", async () => {
    const today = getLocalDateKey();

    duaData = await getData("dua");
    duaData.history = duaData.history || {};

    if (!duaData.history[today]) {
      duaData.history[today] = [];
    }

    duaData.history[today].push({
      timestamp: new Date().toISOString(),
      completedDuas: document.querySelectorAll("#myUL .dua-item.done").length,
    });

    await saveData(duaData);

    showNotification(
      `✨ Duas recorded! Current streak: ${await calculateDuaStreak()}`,
    );
  });
}

async function calculateDuaStreak() {
  const data = await getData("dua");
  if (!data.history) return 0;

  let streak = 0;
  let currentDate = new Date();

  while (true) {
    const dateKey = getLocalDateKey(currentDate);
    if (!data.history[dateKey] || data.history[dateKey].length === 0) break;

    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(212, 165, 116, 0.9);
    color: #0f1620;
    padding: 14px 24px;
    border-radius: 12px;
    z-index: 10001;
    font-weight: 600;
    animation: slideUp 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideDown 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

/* ========================================
   STREAK SYSTEM
======================================== */

async function initStreakSystem() {
  const sections = [
    { id: "quran", name: "Quran" },
    { id: "hadith", name: "Hadith" },
    { id: "dua", name: "Dua" },
    { id: "azkar", name: "Azkar" },
    { id: "deeds", name: "Deeds" },
  ];

  for (const section of sections) {
    const data = await getData(section.id);
    if (!data) continue;

    const streak = await calculateStreak(data);
    displayStreak(section.id, streak);
  }
}

async function calculateStreak(data) {
  if (!data.dailyLogs && !data.history) return 0;

  const logs = data.dailyLogs || data.history || {};
  let streak = 0;
  let currentDate = new Date();

  while (true) {
    const dateKey = getLocalDateKey(currentDate);
    const hasEntry = logs[dateKey] !== undefined && logs[dateKey] !== 0;

    if (!hasEntry) break;

    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function displayStreak(sectionId, streak) {
  const section = document.getElementById(`${sectionId}-section`);
  if (!section) return;

  let streakBadge = section.querySelector(".streak-badge");

  if (!streakBadge && streak > 0) {
    streakBadge = document.createElement("div");
    streakBadge.className = "streak-badge";
    streakBadge.innerHTML = `🔥 <strong>${streak}</strong> day streak`;

    const header = section.querySelector(".card-header");
    if (header) {
      header.appendChild(streakBadge);
    }
  } else if (streakBadge && streak > 0) {
    streakBadge.innerHTML = `🔥 <strong>${streak}</strong> day streak`;
  }
}

/* ========================================
   PRAYER TRACKER SYSTEM
======================================== */

const PRAYERS = [
  { name: "Fajr", emoji: "🌅", time: "05:30" },
  { name: "Dhuhr", emoji: "☀️", time: "12:30" },
  { name: "Asr", emoji: "🌤️", time: "15:45" },
  { name: "Maghrib", emoji: "🌅", time: "18:15" },
  { name: "Isha", emoji: "🌙", time: "19:45" },
];

async function initPrayerTracker() {
  let prayerData = await getData("prayer");

  if (!prayerData) {
    prayerData = {
      id: "prayer",
      completedToday: [],
      history: {},
    };
    await saveData(prayerData);
  }

  const today = getLocalDateKey();
  if (!prayerData.history[today]) {
    prayerData.history[today] = [];
  }

  const list = document.getElementById("prayerList");
  const progressFill = document.getElementById("prayerProgressFill");

  function renderPrayers() {
    list.innerHTML = "";
    prayerData.completedToday = prayerData.completedToday || [];

    PRAYERS.forEach((prayer, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tag ${prayerData.completedToday.includes(idx) ? "done" : ""}`;
      btn.style.display = "inline-block";
      btn.textContent = `${prayer.emoji} ${prayer.name}`;

      btn.addEventListener("click", async () => {
        const index = prayerData.completedToday.indexOf(idx);
        if (index > -1) {
          prayerData.completedToday.splice(index, 1);
        } else {
          prayerData.completedToday.push(idx);
        }

        btn.classList.toggle("done");
        await saveData(prayerData);
        updatePrayerProgress();
      });

      if (prayerData.completedToday.includes(idx)) {
        btn.classList.add("done");
      }

      list.appendChild(btn);
    });

    updatePrayerProgress();
  }

  function updatePrayerProgress() {
    const percent = (prayerData.completedToday.length / PRAYERS.length) * 100;
    progressFill.style.width = `${percent}%`;
  }

  renderPrayers();
}

/* ========================================
   DAILY SUMMARY DASHBOARD
======================================== */

async function initDailySummary() {
  const summaryStats = document.getElementById("summaryStats");
  const viewFullBtn = document.getElementById("viewFullSummary");

  async function updateSummary() {
    const quranData = await getData("quran");
    const hadithData = await getData("hadith");
    const prayerData = await getData("prayer");
    const duaData = await getData("dua");
    const azkarData = await getData("azkar");
    const deedsData = await getData("deeds");

    const today = getLocalDateKey();

    const stats = [
      {
        label: "Quran",
        value: (quranData?.dailyLogs?.[today] || 0) + " ayahs",
      },
      {
        label: "Prayers",
        value: (prayerData?.completedToday?.length || 0) + " / 5",
      },
      {
        label: "Duas",
        value: (duaData?.history?.[today]?.length || 0) + " times",
      },
      {
        label: "Deeds",
        value: (deedsData?.list?.length || 0) + " done",
      },
    ];

    summaryStats.innerHTML = stats
      .map(
        (stat) => `
      <div class="stat-card">
        <div class="stat-value">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `,
      )
      .join("");
  }

  viewFullBtn.addEventListener("click", () => {
    showNotification("📈 Detailed analytics coming soon!");
  });

  await updateSummary();

  // Update summary every minute
  setInterval(updateSummary, 60000);
}

/* ========================================
   ENHANCED UTILITY FUNCTIONS
======================================== */

function getCurrentPrayerTime() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Fajr";
  if (hour >= 12 && hour < 15) return "Dhuhr";
  if (hour >= 15 && hour < 18) return "Asr";
  if (hour >= 18 && hour < 19) return "Maghrib";
  if (hour >= 19 || hour < 5) return "Isha";

  return "Isha";
}
