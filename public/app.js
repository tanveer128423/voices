const voiceGrid = document.getElementById("voiceGrid");
const listStatus = document.getElementById("listStatus");
const searchInput = document.getElementById("search");
const voiceCount = document.getElementById("voiceCount");
const player = document.getElementById("player");

// Our backend currently supports these providers.
const SUPPORTED = { xai: "xai", azure: "azure" };

let currentProvider = "xai";
let voices = [];

async function loadVoices(uiProvider) {
  const apiProvider = SUPPORTED[uiProvider];
  currentProvider = apiProvider || uiProvider;
  voiceGrid.innerHTML = "";
  voiceCount.textContent = "";

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

function tagsFor(v) {
  // Split "Male · Multilingual" into individual tags; fall back to "auto".
  const raw = (v.description || "").split("·").map((s) => s.trim()).filter(Boolean);
  if (v.language && !raw.some((t) => t.toLowerCase() === String(v.language).toLowerCase())) {
    // keep language if not already present
  }
  return raw.length ? raw : ["auto"];
}

function render(items) {
  voiceGrid.innerHTML = "";
  for (const v of items) {
    const id = v.id || v.name;

    const card = document.createElement("div");
    card.className = "vcard";

    const top = document.createElement("div");
    top.className = "vc-top";
    const head = document.createElement("div");
    head.className = "vc-head";
    head.innerHTML = `<div class="vc-badge">PUBLIC</div><div class="vc-name"></div>`;
    head.querySelector(".vc-name").textContent = v.name;

    const play = document.createElement("button");
    play.className = "vc-play";
    play.textContent = "▶";
    play.title = "Preview";
    play.addEventListener("click", () => preview(v, play));
    top.append(head, play);

    const tags = document.createElement("div");
    tags.className = "vc-tags";
    for (const t of tagsFor(v)) {
      const el = document.createElement("span");
      el.className = "vc-tag";
      el.textContent = t.toLowerCase();
      tags.appendChild(el);
    }

    const foot = document.createElement("div");
    foot.className = "vc-foot";

    const idEl = document.createElement("span");
    idEl.className = "vc-id";
    idEl.textContent = id;

    const copy = document.createElement("button");
    copy.className = "vc-copy";
    copy.innerHTML = `<span>⧉</span> Copy ID`;
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
  voiceCount.textContent = `${filtered.length} voice${filtered.length === 1 ? "" : "s"}`;
}

async function copyId(id, btn) {
  try {
    await navigator.clipboard.writeText(id);
  } catch {
    const t = document.createElement("textarea");
    t.value = id; document.body.appendChild(t); t.select();
    document.execCommand("copy"); t.remove();
  }
  const prev = btn.innerHTML;
  btn.classList.add("copied");
  btn.innerHTML = `<span>✓</span> Copied`;
  setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = prev; }, 1400);
}

async function preview(v, btn) {
  if (!v) return;
  btn.classList.add("loading");
  const prev = btn.textContent;
  btn.textContent = "…";
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
    btn.textContent = prev;
  }
}

/* Search */
searchInput.addEventListener("input", applyFilter);

/* Provider tabs */
document.querySelectorAll(".ptab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".ptab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    searchInput.value = "";
    loadVoices(tab.dataset.provider);
  });
});

loadVoices("xai");
