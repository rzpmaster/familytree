# Family Tree – Genealogy Management System

English | [简体中文](./README-cn.md)

A modern, web-based genealogy management system designed to help users record and preserve family history in an intuitive and interactive way. The system supports multi-user collaboration, family member management, relationship graph visualization, and fine-grained access control.

## ✨ Key Features

- **Multiple Family Support**: Create and manage multiple independent family trees.
- **Visualized Graph**: Interactive genealogy graph based on React Flow, supporting drag, zoom, and automatic layout.
- **Member Management**: Maintain detailed member information (name, birth/death year, birthplace, photos, etc.).
- **Relationship Management**: Easily add spouse and parent–child relationships with automatic relationship edges.
- **Collaboration & Sharing**:
  - Invite other users to collaboratively edit a family tree.
  - Fine-grained permission control: Viewer (read-only), Editor (write), Admin.
- **Permission System**:
  - SuperAdmin: system-level administrative privileges.
  - Family Admin: administrative privileges for a specific family tree.
- **Multi-language Support**: Built-in Chinese and English language switching.
- **Multi-database Support**: Compatible with SQLite, MySQL, and PostgreSQL.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, Vite, React Flow
- **Backend**: Python 3.9+, FastAPI, SQLAlchemy
- **Database**: PostgreSQL / MySQL / SQLite
- **Deployment**: Docker, Docker Compose

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

The easiest way to get started is using Docker Compose.

1. **Using Source Code**

- Clone the repository

```bash
git clone https://github.com/rzpmaster/familytree.git
cd familytree
```

- Configure environment variables (optional)

Copy `.env.example` to `.env` and modify as needed.

```bash
cp .env.example .env
```

- One-command startup

```bash
docker compose -f docker-compose-source.yml up -d --build
```

- Open your browser and visit `http://localhost`.

2. **Using Docker Images**

- Copy/Download `docker-compose.yml` from this repository to your directory

  ```powershell
  curl.exe -L -o docker-compose.yml https://raw.githubusercontent.com/rzpmaster/familytree/main/docker-compose.yml
  ```

  ```bash
  curl -L -o docker-compose.yml https://raw.githubusercontent.com/rzpmaster/familytree/main/docker-compose.yml
  ```

- Configure environment variables (optional)

  Copy/Download `.env.example` to `.env` and modify as needed.

  ```powershell
  curl.exe -L -o .env.example https://raw.githubusercontent.com/rzpmaster/familytree/main/.env.example
  Copy-Item .env.example .env -Force
  ```

  ```bash
  curl -L -o .env.example https://raw.githubusercontent.com/rzpmaster/familytree/main/.env.example
  cp -f .env.example .env
  ```

- One-command startup

  ```bash
  docker-compose up -d
  ```

- Open your browser and visit `http://localhost`.

### Option 2: Local Development

### Requirements

- Python **3.12+**
- Node.js **24+**
- (Optional) uv (Python package manager, recommended)

#### Run Project

1. Install dependencies:

**Backend**

```bash
cd backend
pip install --no-cache-dir uv
uv sync
```

**Frontend**

```bash
cd frontend
npm install
```

2. Configure environment variables:

Copy `.env.example` to `.env` and modify as needed.

```bash
cp .env.example .env
```

3. Start development servers:

```bash
npm start
```

Backend runs at `http://localhost:8000`  
Frontend runs at `http://localhost:5173`

## ⚙️ Configuration

### Database Configuration

Set `DATABASE_URL` in `backend/.env`:

- **SQLite (default)**: `sqlite:///./app/data/family_tree.db`
- **PostgreSQL**: `postgresql://user:password@localhost/dbname`
- **MySQL**: `mysql+pymysql://user:password@localhost/dbname`

The database schema will be automatically detected and initialized on startup.

### Super Administrator

Set `SUPERUSER_IDS` (comma-separated UUIDs) in `backend/.env` to define system super administrators.

## 📄 License

This project is licensed under **CC BY-NC-SA 4.0** (Attribution-NonCommercial-ShareAlike 4.0 International).

You are free to:

- **Share** — copy and redistribute the material in any medium or format.
- **Adapt** — remix, transform, and build upon the material.

Under the following conditions:

- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- **Non-Commercial** — **You may not use the material for commercial purposes**.
- **ShareAlike** — If you remix or build upon the material, you must distribute your contributions under the same license.

View the full license:  
http://creativecommons.org/licenses/by-nc-sa/4.0/
