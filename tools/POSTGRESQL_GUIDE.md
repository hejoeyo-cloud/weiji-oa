# 微迹OA PostgreSQL 迁移部署指南

## 一、安装 PostgreSQL

### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
下载安装 https://www.postgresql.org/download/windows/
安装时记住设置的密码和端口（默认 5432）

### Docker（推荐，最简单）
```bash
docker run -d \
  --name weijioa-pg \
  -e POSTGRES_USER=weijioa \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=weijioa \
  -p 5432:5432 \
  -v weijioa_pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

---

## 二、创建数据库和用户

### 如果用 Docker，跳过此步（已自动创建）

### 如果用系统安装的 PostgreSQL

```bash
# 进入 PostgreSQL 命令行
sudo -u postgres psql

# 创建用户和数据库
CREATE USER weijioa WITH PASSWORD 'your_password';
CREATE DATABASE weijioa OWNER weijioa;
GRANT ALL PRIVILEGES ON DATABASE weijioa TO weijioa;
\q
```

---

## 三、数据迁移

### 1. 安装 Python PostgreSQL 驱动
```bash
pip install psycopg2-binary
```

### 2. 设置连接 URL 并迁移
```bash
cd /path/to/微迹OA

# 设置 PostgreSQL 连接 URL
export DATABASE_URL="postgresql://weijioa:your_password@localhost:5432/weijioa"

# 执行迁移（从 SQLite 导入数据到 PostgreSQL）
python tools/migrate_to_pg.py
```

迁移脚本会：
- 自动创建 PostgreSQL 表结构
- 从 SQLite `data.db` 导出所有数据
- 逐表导入 PostgreSQL
- 验证数据一致性

### 3. 只验证不迁移（可选）
```bash
python tools/migrate_to_pg.py --verify-only
```

---

## 四、启动项目

### 临时启动（当前终端有效）
```bash
export DATABASE_URL="postgresql://weijioa:your_password@localhost:5432/weijioa"
cd backend && python main.py
```

### 永久生效（写入配置文件）

**Linux/macOS** — 添加到 `~/.bashrc` 或 `~/.zshrc`：
```bash
export DATABASE_URL="postgresql://weijioa:your_password@localhost:5432/weijioa"
```

**Windows** — 系统环境变量中添加：
```
变量名: DATABASE_URL
变量值: postgresql://weijioa:your_password@localhost:5432/weijioa
```

**Docker Compose** — 在 `docker-compose.yml` 中：
```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://weijioa:your_password@postgres:5432/weijioa
```

---

## 五、验证迁移成功

### 1. 启动后端，观察日志
```bash
python backend/main.py
```

正常输出应包含：
```
[license] 授权状态: ...
INFO: Application startup complete.
INFO: Uvicorn running on http://0.0.0.0:8000
```

### 2. 测试登录
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@weiji.local","password":"admin"}'
```

应返回包含 `token` 的 JSON。

### 3. 检查数据
登录前端，确认工单、产品、知识库等数据完整。

---

## 六、回退到 SQLite

如果需要回退，只需去掉 `DATABASE_URL` 环境变量：

```bash
unset DATABASE_URL
python backend/main.py
```

SQLite 的 `data.db` 文件始终保持不变，可以随时回退。

---

## 七、PostgreSQL 维护

### 备份
项目已内置自动备份（每天凌晨 3 点），备份文件在 `backups/` 目录。

手动备份：
```bash
pg_dump postgresql://weijioa:your_password@localhost:5432/weijioa > backup.sql
```

### 恢复
```bash
psql postgresql://weijioa:your_password@localhost:5432/weijioa < backup.sql
```

### 数据清理
项目已内置自动清理（每天凌晨 4 点）：
- 操作日志：超过 6 个月自动归档
- 通知：已读超 30 天 + 未读超 90 天自动删除

---

## 八、连接 URL 格式说明

```
postgresql://用户名:密码@主机:端口/数据库名?参数
```

示例：
```
# 本地默认
postgresql://weijioa:pass123@localhost:5432/weijioa

# 远程服务器
postgresql://weijioa:pass123@192.168.1.100:5432/weijioa

# 带 SSL
postgresql://weijioa:pass123@localhost:5432/weijioa?sslmode=require

# Docker 内部
postgresql://weijioa:pass123@postgres:5432/weijioa
```

---

## 九、常见问题

### Q: 迁移后登录失败？
A: 检查 `users` 表数据是否完整。可能是密码哈希迁移问题，重新创建管理员即可。

### Q: 报错 "relation does not exist"？
A: 表未创建成功。运行 `python -c "from models.base import Base, engine; Base.metadata.create_all(bind=engine)"` 手动建表。

### Q: JSON 字段数据乱码？
A: PostgreSQL 的 JSONB 字段存储的是 JSON 对象，不是字符串。项目代码已自动处理转换。

### Q: 性能不如预期？
A: 检查 PostgreSQL 配置：
```sql
-- 查看当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 查看慢查询
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' ORDER BY duration DESC;
```
