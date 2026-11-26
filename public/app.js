const voiceGrid = document.getElementById("voiceGrid");
const listStatus = document.getElementById("listStatus");
const searchInput = document.getElementById("search");
const player = document.getElementById("player");

// Providers wired to our backend. Others are visual-only (match the real UI).
const SUPPORTED = { xai: "xai", azure: "azure" };

const COPY_SVG = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75m9-3H12a1.125 1.125 0 0 0-1.125 1.125v3.375M15.75 3.75l3.75 3.75m0 0h-3.375a1.125 1.125 0 0 1-1.125-1.125V3.75"></path></svg>`;
const CHECK_SVG = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"></path></svg>`;

let currentProvider = "xai";
let voices = [];

async function loadVoices(uiProvider) {
  const apiProvider = SUPPORTED[uiProvider];
  currentProvider = apiProvider || uiProvider;
  voiceGrid.innerHTML = "";

  if (!apiProvider) {
    voices = [];
    listStatus.textContent = "This provider isn't connected yet.";
    return;
  }

  listStatus.textContent = "Loading voices…";
  try {
    const res = await fetch(`/api/voices/${apiProvider}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");
    voices = data.voices || [];
    console.log(`[voices] ${apiProvider}: loaded ${voices.length} voices`, voices);
    listStatus.textContent = voices.length ? "" : "No voices found.";
    applyFilter();
  } catch (err) {
    voices = [];
    listStatus.textContent = `⚠ ${err.message}`;
  }
}

// Tags: split "Male · Multilingual" into chips; fall back to "auto".
function tagsFor(v) {
  const raw = (v.description || "").split("·").map((s) => s.trim()).filter(Boolean);
  return raw.length ? raw : ["auto"];
}

function render(items) {
  voiceGrid.innerHTML = "";
  for (const v of items) {
    const id = v.id || v.name;

    const card = document.createElement("div");
    card.className = "vcard";

    // top: eyebrow + name  |  play
    const top = document.createElement("div");
    top.className = "vc-top";
    const head = document.createElement("div");
    head.className = "vc-head";
    head.innerHTML = `<p class="vc-eyebrow">public</p><p class="vc-name"></p>`;
    head.querySelector(".vc-name").textContent = v.name;

    const play = document.createElement("button");
    play.className = "vc-play";
    play.setAttribute("aria-label", "Play");
    play.innerHTML = `<span class="vc-tri" aria-hidden="true"></span>`;
    play.addEventListener("click", () => preview(v, play));
    top.append(head, play);

    // chips
    const tags = document.createElement("div");
    tags.className = "vc-tags";
    for (const t of tagsFor(v)) {
      const el = document.createElement("span");
      el.className = "vc-chip";
      el.textContent = t.toLowerCase();
      tags.appendChild(el);
    }

    // footer: id + copy
    const foot = document.createElement("div");
    foot.className = "vc-foot";
    const idEl = document.createElement("span");
    idEl.className = "vc-id";
    idEl.textContent = id;
    const copy = document.createElement("button");
    copy.className = "vc-copy";
    copy.innerHTML = `${COPY_SVG}Copy ID`;
    copy.addEventListener("click", () => copyId(id, copy));
    foot.append(idEl, copy);

    card.append(top, tags, foot);
    voiceGrid.appendChild(card);
  }
}

function applyFilter() {
  const q = searchInput.value.toLowerCase();
  const filtered = voices.filter((v) => {
    const hay = `${v.name} ${v.description || ""} ${v.id || ""} ${v.language || ""}`.toLowerCase();
    return hay.includes(q);
  });
  render(filtered);
  listStatus.textContent = filtered.length ? "" : "No voices found.";
}

async function copyId(id, btn) {
  try {
    await navigator.clipboard.writeText(id);
  } catch {
    const t = document.createElement("textarea");
    t.value = id; document.body.appendChild(t); t.select();
    document.execCommand("copy"); t.remove();
  }
  btn.classList.add("copied");
  btn.innerHTML = `${CHECK_SVG}Copied`;
  setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = `${COPY_SVG}Copy ID`; }, 1400);
}

async function preview(v, btn) {
  if (!v) return;
  btn.classList.add("loading");
  try {
    const res = await fetch(`/api/preview/${currentProvider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: v.id, locale: v.locale }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Preview failed");
    }
    const blob = await res.blob();
    player.src = URL.createObjectURL(blob);
    await player.play();
  } catch (err) {
    alert(`Preview error: ${err.message}`);
  } finally {
    btn.classList.remove("loading");
  }
}

/* Theme toggle — default light, persisted across visits */
const themeToggle = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ml-theme", theme);
}
applyTheme(localStorage.getItem("ml-theme") || "light");
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

/* Search */
searchInput.addEventListener("input", applyFilter);

/* Provider tabs */
document.querySelectorAll("#providerTabs > button").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#providerTabs > button").forEach((t) =>
      t.setAttribute("data-active", "false")
    );
    tab.setAttribute("data-active", "true");
    searchInput.value = "";
    loadVoices(tab.dataset.provider);
  });
});

loadVoices("xai");
