# 启动方式

## 后端

```bash
   cd backend
   pip install --no-cache-dir uv
   uv synv
   cp .env.example .env
   uv run uvicorn app.main:app
```

## 前端

推荐使用 nginx 

- 静态代理 /frontend/dist
- 反向代理 /api/ --> backend


实在不会用，看一下项目根目录的 README 使用 docker 吧，学一次用一生
