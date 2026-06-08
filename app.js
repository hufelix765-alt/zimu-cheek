const STORAGE_KEY = "zimushouji-data";

const state = {
  view: "home",
  dramaId: null,
  searchQuery: "",
  searchDramaId: "",
  searchResults: [],
  searched: false,
  loading: false,
  uploadLoading: false,
  uploadMessage: null,
  data: loadData(),
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { dramas: [], files: [], entries: [], nextId: 1 };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function nextId() {
  const id = state.data.nextId;
  state.data.nextId += 1;
  return id;
}

function stripTags(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/\n/g, " ")
    .trim();
}

function parseSrt(content) {
  const entries = [];
  for (const block of content.trim().split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;

    let idx = 0;
    let sequence = entries.length + 1;
    if (/^\d+$/.test(lines[0])) {
      sequence = parseInt(lines[0], 10);
      idx = 1;
    }

    const timeMatch = lines[idx]?.match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/
    );

    let startTime = null;
    let endTime = null;
    let textStart = idx + 1;
    if (timeMatch) {
      startTime = timeMatch[1].replace(",", ".");
      endTime = timeMatch[2].replace(",", ".");
    } else {
      textStart = idx;
    }

    const text = stripTags(lines.slice(textStart).join("\n"));
    if (text) entries.push({ sequence, startTime, endTime, text });
  }
  return entries;
}

function parseVtt(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let i = 0;
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const timeMatch = lines[i].match(
      /(\d{1,2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3})/
    );
    if (!timeMatch) {
      i++;
      continue;
    }
    i++;
    const textLines = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }
    const text = stripTags(textLines.join("\n"));
    if (text) {
      entries.push({
        sequence: entries.length + 1,
        startTime: timeMatch[1],
        endTime: timeMatch[2],
        text,
      });
    }
    i++;
  }
  return entries;
}

function parsePlainText(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => ({
      sequence: index + 1,
      startTime: null,
      endTime: null,
      text: stripTags(line),
    }));
}

function parseSubtitle(content, fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".srt")) return parseSrt(content);
  if (lower.endsWith(".vtt")) return parseVtt(content);
  const srt = parseSrt(content);
  if (srt.length) return srt;
  const vtt = parseVtt(content);
  if (vtt.length) return vtt;
  return parsePlainText(content);
}

function highlightText(text, query) {
  if (!query.trim()) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeHtml(text).replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dramaNameFromFileName(name) {
  return name.replace(/\.(srt|vtt|txt|ass|ssa)$/i, "").replace(/[._-]+/g, " ").trim();
}

function getDramaStats(dramaId) {
  const files = state.data.files.filter((f) => f.dramaId === dramaId);
  const entries = state.data.entries.filter((e) => e.dramaId === dramaId);
  return { fileCount: files.length, entryCount: entries.length };
}

function findOrCreateDrama(name) {
  const trimmed = name.trim();
  let drama = state.data.dramas.find((d) => d.name === trimmed);
  if (!drama) {
    drama = { id: nextId(), name: trimmed, createdAt: new Date().toISOString() };
    state.data.dramas.push(drama);
  }
  return drama;
}

function importSubtitle(dramaName, fileName, parsedEntries) {
  const drama = findOrCreateDrama(dramaName);
  const fileId = nextId();
  state.data.files.push({
    id: fileId,
    dramaId: drama.id,
    fileName,
    createdAt: new Date().toISOString(),
  });
  for (const entry of parsedEntries) {
    state.data.entries.push({
      id: nextId(),
      fileId,
      dramaId: drama.id,
      sequence: entry.sequence,
      startTime: entry.startTime,
      endTime: entry.endTime,
      text: entry.text,
      fileName,
    });
  }
  saveData();
  return { drama, entryCount: parsedEntries.length };
}

function searchEntries(query, dramaId) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  let results = state.data.entries.filter((e) => e.text.toLowerCase().includes(q));
  if (dramaId) results = results.filter((e) => e.dramaId === dramaId);
  return results.slice(0, 200).map((e) => {
    const drama = state.data.dramas.find((d) => d.id === e.dramaId);
    return { ...e, dramaName: drama?.name ?? "未知剧集" };
  });
}

function groupByDrama(results) {
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.dramaId)) {
      map.set(r.dramaId, { dramaId: r.dramaId, dramaName: r.dramaName, items: [] });
    }
    map.get(r.dramaId).items.push(r);
  }
  return Array.from(map.values());
}

function deleteDrama(dramaId) {
  state.data.dramas = state.data.dramas.filter((d) => d.id !== dramaId);
  state.data.files = state.data.files.filter((f) => f.dramaId !== dramaId);
  state.data.entries = state.data.entries.filter((e) => e.dramaId !== dramaId);
  saveData();
}

function navigate(view, opts = {}) {
  state.view = view;
  state.dramaId = opts.dramaId ?? null;
  if (opts.searchQuery !== undefined) state.searchQuery = opts.searchQuery;
  if (opts.searchDramaId !== undefined) state.searchDramaId = opts.searchDramaId;
  if (opts.searched !== undefined) state.searched = opts.searched;
  if (opts.searchResults !== undefined) state.searchResults = opts.searchResults;
  state.uploadMessage = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHeader() {
  return `
    <header class="site-header">
      <div class="container-header header-inner">
        <button class="logo" data-nav="home">字幕收集</button>
        <nav class="nav">
          <button data-nav="home" class="${state.view === "home" ? "active" : ""}">剧集列表</button>
          <button data-nav="upload" class="${state.view === "upload" ? "active" : ""}">上传字幕</button>
          <button data-nav="search" class="${state.view === "search" ? "active" : ""}">单词检索</button>
        </nav>
      </div>
    </header>
  `;
}

function renderHome() {
  const { dramas } = state.data;
  const actions = `
    <div class="actions mb-8">
      <button class="btn btn-primary" data-nav="upload">+ 上传字幕</button>
      <button class="btn btn-secondary" data-nav="search">检索单词</button>
    </div>
  `;

  if (!dramas.length) {
    return `
      <div class="mb-8">
        <h1 class="page-title mb-2">我的字幕库</h1>
        <p class="text-muted">按剧名管理字幕，随时上传新文件，通过单词快速检索台词。</p>
      </div>
      ${actions}
      <div class="empty-state">
        <p class="text-muted mb-4">还没有任何字幕</p>
        <button class="link-accent" data-nav="upload">上传第一个字幕文件 →</button>
      </div>
    `;
  }

  const cards = dramas
    .map((drama) => {
      const stats = getDramaStats(drama.id);
      return `
        <button class="drama-card" data-drama="${drama.id}">
          <h2>${escapeHtml(drama.name)}</h2>
          <div class="stats">
            <span>${stats.fileCount} 个字幕文件</span>
            <span>${stats.entryCount} 条台词</span>
          </div>
        </button>
      `;
    })
    .join("");

  return `
    <div class="mb-8">
      <h1 class="page-title mb-2">我的字幕库</h1>
      <p class="text-muted">按剧名管理字幕，随时上传新文件，通过单词快速检索台词。</p>
    </div>
    ${actions}
    <div class="drama-grid">${cards}</div>
  `;
}

function renderUpload() {
  const msg = state.uploadMessage
    ? `<p class="message ${state.uploadMessage.type}">${escapeHtml(state.uploadMessage.text)}</p>`
    : "";

  return `
    <div class="max-w-lg">
      <h1 class="page-title mb-2">上传字幕</h1>
      <p class="text-muted mb-8">填写剧名并选择字幕文件。同一剧名可多次上传，字幕会累加。</p>
      <form id="upload-form" class="form-stack">
        <div class="form-field">
          <label for="dramaName">剧名</label>
          <input id="dramaName" type="text" placeholder="例如：Friends 第一季" required />
        </div>
        <div class="form-field">
          <label for="file-input">字幕文件</label>
          <input id="file-input" class="file-input" type="file" accept=".srt,.vtt,.txt,.ass,.ssa" required />
          <p class="form-hint">支持 SRT、VTT、TXT 等格式</p>
        </div>
        ${msg}
        <button type="submit" class="btn btn-primary btn-block" ${state.uploadLoading ? "disabled" : ""}>
          ${state.uploadLoading ? "上传中…" : "上传并导入"}
        </button>
      </form>
    </div>
  `;
}

function renderSearch() {
  const { dramas } = state.data;
  const filters =
    dramas.length > 0
      ? `
    <div class="mb-8">
      <p class="filter-label">筛选剧集</p>
      <div class="filter-grid">
        <button type="button" class="filter-chip ${state.searchDramaId === "" ? "active" : ""}" data-filter="">全部剧集</button>
        ${dramas
          .map(
            (d) => `
          <button type="button" class="filter-chip ${state.searchDramaId === String(d.id) ? "active" : ""}" data-filter="${d.id}" title="${escapeHtml(d.name)}">
            ${escapeHtml(d.name)}
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `
      : "";

  let resultsHtml = "";
  if (state.loading) {
    resultsHtml = `<p class="text-muted center-empty">正在搜索…</p>`;
  } else if (state.searched && !state.searchResults.length) {
    resultsHtml = `<p class="text-muted center-empty">没有找到匹配的台词</p>`;
  } else if (state.searchResults.length) {
    const groups = groupByDrama(state.searchResults);
    const cols = groups.length === 1 ? "cols-1" : groups.length === 2 ? "cols-2" : "cols-3";
    resultsHtml = `
      <p class="result-summary">找到 ${state.searchResults.length} 条结果，分布在 ${groups.length} 部剧中${state.searchResults.length >= 200 ? "（最多显示 200 条）" : ""}</p>
      <div class="result-grid ${cols}">
        ${groups
          .map(
            (group) => `
          <section class="result-group">
            <header>
              <button class="title" data-drama="${group.dramaId}">${escapeHtml(group.dramaName)}</button>
              <p class="count">${group.items.length} 条匹配</p>
            </header>
            <div class="result-list">
              ${group.items
                .map(
                  (r) => `
                <article class="result-item">
                  <div class="meta">
                    <span>${escapeHtml(r.fileName)}</span>
                    ${r.startTime ? `<span>·</span><span class="time">${escapeHtml(r.startTime)}</span>` : ""}
                  </div>
                  <p>${highlightText(r.text, state.searchQuery)}</p>
                </article>
              `
                )
                .join("")}
            </div>
          </section>
        `
          )
          .join("")}
      </div>
    `;
  }

  return `
    <div class="w-full">
      <h1 class="page-title mb-2">单词检索</h1>
      <p class="text-muted mb-6">输入单词或短语，结果按剧集分栏显示。</p>
      <form id="search-form" class="search-form">
        <input id="search-input" type="text" value="${escapeHtml(state.searchQuery)}" placeholder="输入要检索的单词…" />
        <button type="submit" class="btn btn-primary" ${!state.searchQuery.trim() && state.searched ? "" : ""}>搜索</button>
      </form>
      ${filters}
      ${resultsHtml}
    </div>
  `;
}

function renderDramaDetail() {
  const drama = state.data.dramas.find((d) => d.id === state.dramaId);
  if (!drama) {
    return `
      <div class="center-empty">
        <p class="text-muted mb-4">剧集不存在</p>
        <button class="link-accent" data-nav="home">返回首页</button>
      </div>
    `;
  }

  const stats = getDramaStats(drama.id);
  const files = state.data.files
    .filter((f) => f.dramaId === drama.id)
    .map((f) => {
      const entryCount = state.data.entries.filter((e) => e.fileId === f.id).length;
      return { ...f, entryCount };
    });

  const fileList =
    files.length === 0
      ? `<p class="text-muted">暂无字幕文件</p>`
      : files
          .map(
            (file) => `
        <div class="file-row">
          <div>
            <p class="name">${escapeHtml(file.fileName)}</p>
            <p class="sub">${file.entryCount} 条 · 上传于 ${new Date(file.createdAt).toLocaleString("zh-CN")}</p>
          </div>
        </div>
      `
          )
          .join("");

  return `
    <button class="back-link" data-nav="home">← 返回剧集列表</button>
    <div class="drama-header">
      <div>
        <h1 class="page-title mb-2">${escapeHtml(drama.name)}</h1>
        <p class="text-muted">${stats.fileCount} 个字幕文件 · ${stats.entryCount} 条台词</p>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" data-nav="search" data-drama-filter="${drama.id}">在此剧中检索</button>
        <button class="btn btn-primary" data-nav="upload">继续上传</button>
      </div>
    </div>
    <h2 class="section-title">字幕文件</h2>
    ${fileList}
    <div class="mt-12 pt-8 border-t">
      <button class="delete-btn" id="delete-drama">删除此剧集及全部字幕</button>
    </div>
  `;
}

function renderMain() {
  if (state.view === "upload") return renderUpload();
  if (state.view === "search") return renderSearch();
  if (state.view === "drama") return renderDramaDetail();
  return renderHome();
}

function render() {
  document.getElementById("app").innerHTML = `
    ${renderHeader()}
    <main class="container-main main">${renderMain()}</main>
  `;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      const filter = el.dataset.dramaFilter;
      if (el.dataset.nav === "search" && filter) {
        navigate("search", {
          searchDramaId: filter,
          searchQuery: state.searchQuery,
          searched: false,
          searchResults: [],
        });
        return;
      }
      navigate(el.dataset.nav);
    });
  });

  document.querySelectorAll("[data-drama]").forEach((el) => {
    el.addEventListener("click", () => navigate("drama", { dramaId: Number(el.dataset.drama) }));
  });

  document.getElementById("upload-form")?.addEventListener("submit", handleUpload);
  document.getElementById("file-input")?.addEventListener("change", () => {
    const fileInput = document.getElementById("file-input");
    const dramaInput = document.getElementById("dramaName");
    const file = fileInput.files?.[0];
    if (file && !dramaInput.value.trim()) {
      dramaInput.value = dramaNameFromFileName(file.name);
    }
  });

  document.getElementById("search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    state.searchQuery = document.getElementById("search-input").value;
    state.loading = true;
    render();
    setTimeout(() => {
      state.searchResults = searchEntries(
        state.searchQuery,
        state.searchDramaId ? Number(state.searchDramaId) : null
      );
      state.searched = true;
      state.loading = false;
      render();
    }, 100);
  });

  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      state.searchDramaId = el.dataset.filter;
      if (state.searched && state.searchQuery.trim()) {
        state.searchResults = searchEntries(
          state.searchQuery,
          state.searchDramaId ? Number(state.searchDramaId) : null
        );
      }
      render();
    });
  });

  document.getElementById("delete-drama")?.addEventListener("click", () => {
    const drama = state.data.dramas.find((d) => d.id === state.dramaId);
    if (!drama) return;
    if (!confirm(`确定删除「${drama.name}」及其所有字幕吗？此操作不可恢复。`)) return;
    deleteDrama(drama.id);
    navigate("home");
  });
}

function handleUpload(e) {
  e.preventDefault();
  const dramaInput = document.getElementById("dramaName");
  const fileInput = document.getElementById("file-input");
  const dramaName = dramaInput.value.trim();
  const file = fileInput.files?.[0];

  if (!dramaName) {
    state.uploadMessage = { type: "err", text: "请先填写剧名" };
    render();
    return;
  }
  if (!file) {
    state.uploadMessage = { type: "err", text: "请选择字幕文件" };
    render();
    return;
  }

  state.uploadLoading = true;
  state.uploadMessage = null;
  render();

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseSubtitle(String(reader.result), file.name);
    if (!parsed.length) {
      state.uploadLoading = false;
      state.uploadMessage = { type: "err", text: "未能解析出字幕内容，请检查文件格式" };
      render();
      return;
    }
    const result = importSubtitle(dramaName, file.name, parsed);
    state.uploadLoading = false;
    state.uploadMessage = { type: "ok", text: `成功导入 ${result.entryCount} 条字幕！` };
    render();
    setTimeout(() => navigate("drama", { dramaId: result.drama.id }), 1000);
  };
  reader.onerror = () => {
    state.uploadLoading = false;
    state.uploadMessage = { type: "err", text: "读取文件失败，请重试" };
    render();
  };
  reader.readAsText(file, "UTF-8");
}

render();
