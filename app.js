const STORAGE_KEY = "zimushouji-data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { dramas: [], files: [], entries: [], nextId: 1 };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function nextId(data) {
  const id = data.nextId;
  data.nextId += 1;
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
  const blocks = content.trim().split(/\r?\n\r?\n+/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;

    let idx = 0;
    let sequence = entries.length + 1;

    if (/^\d+$/.test(lines[0])) {
      sequence = parseInt(lines[0], 10);
      idx = 1;
    }

    const timeLine = lines[idx];
    const timeMatch = timeLine?.match(
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
    if (!text) continue;

    entries.push({ sequence, startTime, endTime, text });
  }

  return entries;
}

function parseVtt(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let i = 0;

  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const timeLine = lines[i];
    const timeMatch = timeLine.match(
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

  const srtEntries = parseSrt(content);
  if (srtEntries.length > 0) return srtEntries;

  const vttEntries = parseVtt(content);
  if (vttEntries.length > 0) return vttEntries;

  return parsePlainText(content);
}

function highlightText(text, query) {
  if (!query.trim()) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dramaNameFromFileName(name) {
  return name.replace(/\.(srt|vtt|txt|ass|ssa)$/i, "").replace(/[._-]+/g, " ").trim();
}

function getDramaStats(data, dramaId) {
  const files = data.files.filter((f) => f.dramaId === dramaId);
  const entries = data.entries.filter((e) => e.dramaId === dramaId);
  return { fileCount: files.length, entryCount: entries.length };
}

function findOrCreateDrama(data, name) {
  const trimmed = name.trim();
  let drama = data.dramas.find((d) => d.name === trimmed);
  if (!drama) {
    drama = { id: nextId(data), name: trimmed, createdAt: new Date().toISOString() };
    data.dramas.push(drama);
  }
  return drama;
}

function importSubtitle(data, dramaName, fileName, parsedEntries) {
  const drama = findOrCreateDrama(data, dramaName);
  const fileId = nextId(data);

  data.files.push({
    id: fileId,
    dramaId: drama.id,
    fileName,
    createdAt: new Date().toISOString(),
  });

  for (const entry of parsedEntries) {
    data.entries.push({
      id: nextId(data),
      fileId,
      dramaId: drama.id,
      sequence: entry.sequence,
      startTime: entry.startTime,
      endTime: entry.endTime,
      text: entry.text,
      fileName,
    });
  }

  saveData(data);
  return { drama, entryCount: parsedEntries.length };
}

function searchEntries(data, query, dramaId) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  let results = data.entries.filter((e) => e.text.toLowerCase().includes(q));
  if (dramaId) results = results.filter((e) => e.dramaId === dramaId);

  return results
    .map((e) => {
      const drama = data.dramas.find((d) => d.id === e.dramaId);
      return {
        ...e,
        dramaName: drama?.name ?? "未知剧集",
      };
    })
    .slice(0, 200);
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

let state = {
  view: "home",
  data: loadData(),
  selectedDramaId: null,
  searchQuery: "",
  searchDramaId: "",
  searchResults: [],
  searched: false,
};

function setView(view, dramaId) {
  state.view = view;
  state.selectedDramaId = dramaId ?? null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHeader() {
  return `
    <header class="site-header">
      <div class="container header-inner">
        <a href="#" class="logo" data-nav="home">字幕收集</a>
        <nav class="nav">
          <a href="#" data-nav="home" class="${state.view === "home" ? "active" : ""}">剧集列表</a>
          <a href="#" data-nav="upload" class="${state.view === "upload" ? "active" : ""}">上传字幕</a>
          <a href="#" data-nav="search" class="${state.view === "search" ? "active" : ""}">单词检索</a>
        </nav>
      </div>
    </header>
  `;
}

function renderHome() {
  const { dramas } = state.data;

  if (dramas.length === 0) {
    return `
      <section class="hero">
        <h1>我的字幕库</h1>
        <p class="lead">按剧名管理字幕，随时上传新文件，通过单词快速检索台词。</p>
        <div class="actions">
          <button class="btn btn-primary" data-nav="upload">+ 上传字幕</button>
          <button class="btn btn-secondary" data-nav="search">检索单词</button>
        </div>
      </section>
      <div class="empty-state">
        <p>还没有任何字幕</p>
        <button class="link-btn" data-nav="upload">上传第一个字幕文件 →</button>
      </div>
    `;
  }

  const cards = dramas
    .map((drama) => {
      const stats = getDramaStats(state.data, drama.id);
      return `
        <article class="drama-card" data-drama="${drama.id}">
          <h2>${escapeHtml(drama.name)}</h2>
          <div class="stats">
            <span>${stats.fileCount} 个字幕文件</span>
            <span>${stats.entryCount} 条台词</span>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="hero compact">
      <h1>我的字幕库</h1>
      <p class="lead">按剧名管理字幕，随时上传新文件，通过单词快速检索台词。</p>
      <div class="actions">
        <button class="btn btn-primary" data-nav="upload">+ 上传字幕</button>
        <button class="btn btn-secondary" data-nav="search">检索单词</button>
      </div>
    </section>
    <div class="drama-grid">${cards}</div>
  `;
}

function renderUpload() {
  return `
    <section class="page-header">
      <h1>上传字幕</h1>
      <p class="lead">填写剧名并选择字幕文件。同一剧名可多次上传，字幕会累加。</p>
    </section>
    <form class="upload-form card" id="upload-form">
      <label>
        <span>剧名</span>
        <input type="text" id="drama-name" placeholder="例如：Friends 第一季" required />
      </label>
      <label>
        <span>字幕文件</span>
        <input type="file" id="subtitle-file" accept=".srt,.vtt,.txt,.ass,.ssa" required />
        <small>支持 SRT、VTT、TXT 等格式</small>
      </label>
      <p id="upload-message" class="message hidden"></p>
      <button type="submit" class="btn btn-primary btn-block">上传并导入</button>
    </form>
    <p class="hint">数据保存在浏览器本地，清除缓存后会丢失。</p>
  `;
}

function renderSearch() {
  const { dramas } = state.data;
  const dramaFilters = dramas
    .map(
      (d) => `
      <button type="button" class="filter-chip ${state.searchDramaId === String(d.id) ? "active" : ""}" data-filter="${d.id}">
        ${escapeHtml(d.name)}
      </button>
    `
    )
    .join("");

  let resultsHtml = "";
  if (state.searched && state.searchResults.length === 0) {
    resultsHtml = `<p class="empty-text">没有找到匹配的台词</p>`;
  } else if (state.searchResults.length > 0) {
    const groups = groupByDrama(state.searchResults);
    resultsHtml = `
      <p class="result-summary">
        找到 ${state.searchResults.length} 条结果，分布在 ${groups.length} 部剧中
      </p>
      <div class="result-grid">
        ${groups
          .map(
            (group) => `
          <section class="result-group card">
            <header>
              <button class="link-btn" data-drama="${group.dramaId}">${escapeHtml(group.dramaName)}</button>
              <span>${group.items.length} 条匹配</span>
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
    <section class="page-header">
      <h1>单词检索</h1>
      <p class="lead">输入单词或短语，结果按剧集分栏显示。</p>
    </section>
    <form class="search-bar" id="search-form">
      <input type="text" id="search-input" value="${escapeHtml(state.searchQuery)}" placeholder="输入要检索的单词…" />
      <button type="submit" class="btn btn-primary">搜索</button>
    </form>
    ${
      dramas.length > 0
        ? `
      <div class="filters">
        <p>筛选剧集</p>
        <div class="filter-grid">
          <button type="button" class="filter-chip ${state.searchDramaId === "" ? "active" : ""}" data-filter="">全部剧集</button>
          ${dramaFilters}
        </div>
      </div>
    `
        : ""
    }
    <div class="search-results">${resultsHtml}</div>
  `;
}

function renderDramaDetail(dramaId) {
  const drama = state.data.dramas.find((d) => d.id === dramaId);
  if (!drama) {
    return `<p class="empty-text">剧集不存在</p>`;
  }

  const files = state.data.files.filter((f) => f.dramaId === dramaId);
  const entries = state.data.entries.filter((e) => e.dramaId === dramaId);

  const fileList = files
    .map(
      (f) => `
    <li>
      <span>${escapeHtml(f.fileName)}</span>
      <span>${new Date(f.createdAt).toLocaleDateString("zh-CN")}</span>
    </li>
  `
    )
    .join("");

  const preview = entries
    .slice(0, 30)
    .map(
      (e) => `
    <article class="result-item">
      <div class="meta">
        <span>${escapeHtml(e.fileName)}</span>
        ${e.startTime ? `<span>·</span><span class="time">${escapeHtml(e.startTime)}</span>` : ""}
      </div>
      <p>${escapeHtml(e.text)}</p>
    </article>
  `
    )
    .join("");

  return `
    <button class="back-btn" data-nav="home">← 返回列表</button>
    <section class="page-header">
      <h1>${escapeHtml(drama.name)}</h1>
      <p class="lead">${files.length} 个字幕文件 · ${entries.length} 条台词</p>
      <div class="actions">
        <button class="btn btn-primary" data-nav="upload">继续上传</button>
        <button class="btn btn-secondary" data-nav="search">检索本剧</button>
      </div>
    </section>
    <div class="detail-grid">
      <section class="card">
        <h3>字幕文件</h3>
        <ul class="file-list">${fileList || "<li>暂无文件</li>"}</ul>
      </section>
      <section class="card">
        <h3>台词预览</h3>
        <div class="result-list">${preview || "<p class='empty-text'>暂无台词</p>"}</div>
      </section>
    </div>
  `;
}

function renderMain() {
  if (state.view === "upload") return renderUpload();
  if (state.view === "search") return renderSearch();
  if (state.view === "drama" && state.selectedDramaId) return renderDramaDetail(state.selectedDramaId);
  return renderHome();
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderHeader()}
    <main class="container main">${renderMain()}</main>
    <footer class="site-footer">
      <div class="container">
        <p>字幕收集 · 数据保存在浏览器本地 · <a href="https://github.com/hufelix765-alt/zimu-cheek" target="_blank" rel="noopener">GitHub</a></p>
      </div>
    </footer>
  `;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      setView(el.dataset.nav);
    });
  });

  document.querySelectorAll("[data-drama]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      setView("drama", Number(el.dataset.drama));
    });
  });

  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", handleUpload);

    const fileInput = document.getElementById("subtitle-file");
    const dramaInput = document.getElementById("drama-name");
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file && !dramaInput.value.trim()) {
        dramaInput.value = dramaNameFromFileName(file.name);
      }
    });
  }

  const searchForm = document.getElementById("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.searchQuery = document.getElementById("search-input").value;
      state.searchResults = searchEntries(
        state.data,
        state.searchQuery,
        state.searchDramaId ? Number(state.searchDramaId) : null
      );
      state.searched = true;
      render();
    });
  }

  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      state.searchDramaId = el.dataset.filter;
      if (state.searched && state.searchQuery.trim()) {
        state.searchResults = searchEntries(
          state.data,
          state.searchQuery,
          state.searchDramaId ? Number(state.searchDramaId) : null
        );
      }
      render();
    });
  });
}

function handleUpload(e) {
  e.preventDefault();

  const dramaInput = document.getElementById("drama-name");
  const fileInput = document.getElementById("subtitle-file");
  const messageEl = document.getElementById("upload-message");
  const dramaName = dramaInput.value.trim();
  const file = fileInput.files?.[0];

  if (!dramaName || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseSubtitle(String(reader.result), file.name);
    if (parsed.length === 0) {
      messageEl.textContent = "未能解析出字幕内容，请检查文件格式";
      messageEl.className = "message error";
      return;
    }

    const result = importSubtitle(state.data, dramaName, file.name, parsed);
    messageEl.textContent = `成功导入 ${result.entryCount} 条字幕！`;
    messageEl.className = "message success";

    setTimeout(() => setView("drama", result.drama.id), 800);
  };
  reader.readAsText(file, "UTF-8");
}

render();
