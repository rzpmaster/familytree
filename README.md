# Family Tree - 家族族谱管理系统

这是一个现代化的在线家谱管理系统，旨在帮助用户以直观、互动的方式记录和传承家族历史。系统支持多用户协作、家族成员管理、关系图谱可视化以及权限控制等功能。

## ✨ 主要功能

- **多家族支持**：用户可以创建并管理多个独立的家谱。
- **可视化图谱**：基于 React Flow 的交互式家谱图，支持拖拽、缩放和自动布局。
- **成员管理**：详细记录成员信息（姓名、生卒年、出生地、照片等）。
- **关系管理**：轻松添加配偶和亲子关系，自动生成关系连线。
- **协作共享**：
  - 支持邀请其他用户协作编辑家谱。
  - 细粒度的权限控制：可读 (Viewer)、可写 (Editor)、管理员 (Admin)。
- **权限系统**：
  - 超级管理员 (SuperAdmin)：系统级管理权限。
  - 家谱管理员：特定家谱的管理权限。
- **多语言支持**：内置中英文切换。
- **多数据库支持**：兼容 SQLite、MySQL 和 PostgreSQL。

## 🛠️ 技术栈

- **前端**: React 18, TypeScript, TailwindCSS, Vite, React Flow
- **后端**: Python 3.9+, FastAPI, SQLAlchemy
- **数据库**: PostgreSQL / MySQL / SQLite
- **部署**: Docker, Docker Compose

## 🚀 快速开始

### 方式一：Docker 部署 (推荐)

最简单的方式是使用 Docker Compose 一键启动。

1. **使用源码**

- 克隆项目

```bash
git clone https://github.com/rzpmaster/familytree.git
cd familytree
```

- 修改环境变量（可选）

复制 `.env.example` 为 `.env` 并按需修改。

```bash
cp .env.example .env
```

- 一键启动

```bash
   docker compose -f docker-compose-source.yaml up -d --build
```

- 打开浏览器访问 `http://localhost`。

2. **使用镜像**

- 复制本仓库 `docker-compose.yaml` 到你到文件夹
- 修改环境变量（可选）

  复制本仓库 `.env.example` 为 `.env` 并按需修改。

- 一键启动

```bash
docker-compose up -d
```

- 打开浏览器访问 `http://localhost`。

### 方式二：本地开发运行

### 环境要求

- Python **3.12+**
- Node.js **24+**
- （可选）uv（Python 包管理工具，推荐）

#### 后端

1. 安装依赖：

   **前端**

   ```bash
   cd backend
   pip install --no-cache-dir uv
   uv synv
   ```

   **后端**

   ```bash
   cd frontend
   npm install
   ```

2. 配置环境变量：
   复制 `.env.example` 为 `.env` 并按需修改。

   ```bash
   cp .env.example .env
   ```

3. 启动开发服务器：

   ```bash
   npm start
   ```

   后端默认运行在 `http://localhost:8000`
   前端默认运行在 `http://localhost:5173`。

## ⚙️ 配置说明

### 数据库配置

在 `backend/.env` 中设置 `DATABASE_URL`：

- **SQLite (默认)**: `sqlite:///./app/data/family_tree.db`
- **PostgreSQL**: `postgresql://user:password@localhost/dbname`
- **MySQL**: `mysql+pymysql://user:password@localhost/dbname`

系统会在启动时自动检测并初始化数据库结构。

### 超级管理员

在 `backend/.env` 中设置 `SUPERUSER_IDS`（逗号分隔的 UUID）以指定系统超级管理员。

## 📄 许可证 (License)

本项目采用 **CC BY-NC-SA 4.0** (署名-非商业性使用-相同方式共享 4.0 国际) 许可协议。

这意味着您可以：

- **共享** — 在任何媒介以任何形式复制、发行本作品。
- **演绎** — 修改、转换或以本作品为基础进行创作。

但在遵守以下条件的情况下：

- **署名** — 您必须给出适当的署名，提供指向本许可协议的链接，同时标明是否（对原始作品）作了修改。
- **非商业性使用** — **您不得将本作品用于商业目的**。
- **相同方式共享** — 如果您再混合、转换或者基于本作品进行创作，您必须基于与原先许可协议相同的许可协议分发您贡献的作品。

查看完整协议：[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-nc-sa/4.0/)
