<div align="center">

# 🎬 字幕收集

**上传字幕 · 按剧名管理 · 单词检索**

本地运行的字幕管理工具，帮你把零散的字幕文件整理成可搜索的台词库。

<br />

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<br />

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [项目结构](#-项目结构) · [数据存储](#-数据存储)

</div>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%" valign="top">

### 📤 上传字幕

填写剧名，上传 **SRT / VTT / TXT** 等常见字幕格式，自动解析台词与时间轴。

</td>
<td width="50%" valign="top">

### ➕ 随时追加

同一剧名可多次上传，新字幕会自动累加，无需手动合并文件。

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📺 剧集列表

一览所有剧名，查看每个剧集的字幕文件数与台词条数统计。

</td>
<td width="50%" valign="top">

### 🔍 单词检索

在所有字幕或指定剧集中搜索单词 / 短语，快速定位台词上下文。

</td>
</tr>
</table>

---

## 🚀 快速开始

### 环境要求

- **Node.js** 18.18 或更高版本
- **npm** 9+

### 安装与运行

```bash
# 克隆仓库
git clone <your-repo-url>
cd zimushouji

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 👉 **[http://localhost:3000](http://localhost:3000)**

### 其他命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 运行生产服务器 |
| `npm run lint` | 代码检查 |

---

## 🗂️ 项目结构

```
zimushouji/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 剧集列表首页
│   │   ├── upload/page.tsx       # 上传字幕
│   │   ├── search/page.tsx       # 单词检索
│   │   ├── dramas/[id]/page.tsx  # 剧集详情
│   │   └── api/                  # REST API
│   └── lib/
│       ├── db.ts                 # SQLite 数据库
│       └── parser.ts             # 字幕解析 (SRT / VTT / TXT)
├── data/
│   └── subtitles.db              # 运行时自动创建
└── public/
```

---

## 💾 数据存储

字幕数据保存在项目目录下的 `data/subtitles.db`（SQLite），**无需额外配置数据库**。

- 首次运行自动创建 `data/` 目录与数据库文件
- 使用 WAL 模式，读写性能更好
- 所有数据保存在本地，适合个人学习场景

---

## 🛠️ 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | [Next.js 15](https://nextjs.org/) (App Router) |
| 前端 | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| 语言 | [TypeScript 5](https://www.typescriptlang.org/) |
| 数据库 | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| 字幕格式 | SRT · VTT · TXT |

---

<div align="center">

**用字幕学语言，从整理台词开始** 🎬

</div>
