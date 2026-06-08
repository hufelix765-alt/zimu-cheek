# 字幕收集

上传字幕、按剧名管理、检索单词。

## 在线网页

本项目提供 **GitHub Pages 静态网页**，可直接在浏览器中使用：

👉 **https://你的用户名.github.io/zimu-cheek/**

（将 `你的用户名` 替换为你的 GitHub 用户名）

功能包括：上传 SRT/VTT/TXT 字幕、按剧名管理、单词检索。数据保存在浏览器本地。

## 启用 GitHub Pages

1. 将代码推送到 GitHub 仓库（例如 `zimu-cheek`）
2. 打开仓库 **Settings → Pages**
3. **Build and deployment** 选择 **Deploy from a branch**
4. Branch 选 `master`（或 `main`），文件夹选 **`/docs`**
5. 点击 Save，等待 1～2 分钟
6. 访问 `https://你的用户名.github.io/仓库名/`

## 本地开发版（完整功能 + SQLite）

如需本地 SQLite 持久化，使用 Next.js 版本：

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 技术栈

- GitHub Pages 版：HTML + CSS + JavaScript（localStorage）
- 本地版：Next.js 15 · React 19 · SQLite · Tailwind CSS 4
