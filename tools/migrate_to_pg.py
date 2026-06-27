"""
SQLite → PostgreSQL 数据迁移脚本

用法:
  1. 确保 PostgreSQL 已安装并运行
  2. 设置环境变量: export DATABASE_URL="postgresql://user:pass@localhost:5432/weijioa"
  3. 运行: python tools/migrate_to_pg.py

脚本会:
  - 从 SQLite 读取所有表数据
  - 在 PostgreSQL 中创建表结构（通过 SQLAlchemy）
  - 将数据逐表导入 PostgreSQL
  - 验证迁移结果
"""
import os
import sys
import json
import sqlite3
from datetime import datetime

# 添加 backend 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


def get_sqlite_tables(sqlite_path: str) -> list[str]:
    """获取 SQLite 中所有用户表"""
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables


def get_table_columns(sqlite_path: str, table: str) -> list[str]:
    """获取表的列名"""
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()
    return columns


def export_sqlite_data(sqlite_path: str) -> dict[str, list[dict]]:
    """导出 SQLite 所有数据"""
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    data = {}

    tables = get_sqlite_tables(sqlite_path)
    for table in tables:
        try:
            cursor = conn.execute(f'SELECT * FROM "{table}"')
            rows = [dict(row) for row in cursor.fetchall()]
            data[table] = rows
            print(f"  导出 {table}: {len(rows)} 行")
        except Exception as e:
            print(f"  跳过 {table}: {e}")

    conn.close()
    return data


def import_to_postgres(data: dict[str, list[dict]], pg_engine):
    """将数据导入 PostgreSQL"""
    from sqlalchemy import inspect, text

    inspector = inspect(pg_engine)
    pg_tables = inspector.get_table_names()

    with pg_engine.connect() as conn:
        for table, rows in data.items():
            if not rows:
                continue
            if table not in pg_tables:
                print(f"  跳过 {table}: PostgreSQL 中不存在该表")
                continue

            # 获取 PostgreSQL 表的列
            pg_columns = {col["name"] for col in inspector.get_columns(table)}
            # 过滤出两边都有的列
            common_cols = [c for c in rows[0].keys() if c in pg_columns]
            if not common_cols:
                continue

            col_list = ", ".join(f'"{c}"' for c in common_cols)
            placeholders = ", ".join(f":{c}" for c in common_cols)

            inserted = 0
            for row in rows:
                # 只保留公共列，过滤 None 值
                values = {c: row.get(c) for c in common_cols}
                # 跳过全空行
                if all(v is None for v in values.values()):
                    continue
                try:
                    conn.execute(
                        text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'),
                        values,
                    )
                    inserted += 1
                except Exception as e:
                    # 主键冲突等错误跳过
                    if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
                        continue
                    print(f"    {table} 行插入失败: {e}")

            conn.commit()
            print(f"  导入 {table}: {inserted}/{len(rows)} 行")


def verify_migration(sqlite_path: str, pg_engine):
    """验证迁移结果"""
    from sqlalchemy import text

    sqlite_conn = sqlite3.connect(sqlite_path)
    tables = get_sqlite_tables(sqlite_path)

    print("\n=== 迁移验证 ===")
    mismatches = []

    with pg_engine.connect() as conn:
        for table in tables:
            try:
                sqlite_count = sqlite_conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
                pg_result = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).fetchone()
                pg_count = pg_result[0] if pg_result else 0

                status = "✓" if pg_count >= sqlite_count else "✗"
                if pg_count < sqlite_count:
                    mismatches.append((table, sqlite_count, pg_count))
                print(f"  {status} {table}: SQLite={sqlite_count}, PG={pg_count}")
            except Exception as e:
                print(f"  ? {table}: 无法验证 ({e})")

    sqlite_conn.close()

    if mismatches:
        print(f"\n⚠️ {len(mismatches)} 个表数据不一致，请检查")
        return False
    else:
        print("\n✅ 所有表数据验证通过")
        return True


def main():
    import argparse

    parser = argparse.ArgumentParser(description="SQLite → PostgreSQL 数据迁移")
    parser.add_argument("--sqlite", default=None, help="SQLite 数据库路径（默认: backend/data.db）")
    parser.add_argument("--pg-url", default=None, help="PostgreSQL 连接 URL（默认: 读取 DATABASE_URL 环境变量）")
    parser.add_argument("--verify-only", action="store_true", help="只验证，不执行迁移")
    args = parser.parse_args()

    # 确定路径
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_path = args.sqlite or os.path.join(project_dir, "backend", "data.db")
    pg_url = args.pg_url or os.environ.get("DATABASE_URL")

    if not os.path.exists(sqlite_path):
        print(f"❌ SQLite 数据库不存在: {sqlite_path}")
        sys.exit(1)

    if not pg_url or "sqlite" in pg_url:
        print("❌ 请设置 PostgreSQL 连接 URL")
        print("   方法1: export DATABASE_URL='postgresql://user:pass@localhost:5432/weijioa'")
        print("   方法2: python migrate_to_pg.py --pg-url 'postgresql://...'")
        sys.exit(1)

    print("=" * 50)
    print("  微迹OA 数据迁移: SQLite → PostgreSQL")
    print("=" * 50)
    print(f"  SQLite: {sqlite_path}")
    print(f"  PG URL: {pg_url.split('@')[1] if '@' in pg_url else pg_url}")
    print()

    # Step 1: 创建 PostgreSQL 表结构
    print("[1/3] 创建 PostgreSQL 表结构...")
    os.environ["DATABASE_URL"] = pg_url
    # 重新加载模块以使用新的 DATABASE_URL
    from models.base import engine as pg_engine
    from models.base import Base
    Base.metadata.create_all(bind=pg_engine)
    print("  表结构创建完成")

    if args.verify_only:
        verify_migration(sqlite_path, pg_engine)
        return

    # Step 2: 导出 SQLite 数据
    print("\n[2/3] 导出 SQLite 数据...")
    data = export_sqlite_data(sqlite_path)
    total_rows = sum(len(rows) for rows in data.values())
    print(f"  共导出 {len(data)} 个表, {total_rows} 行数据")

    # Step 3: 导入 PostgreSQL
    print("\n[3/3] 导入 PostgreSQL...")
    import_to_postgres(data, pg_engine)

    # Step 4: 验证
    verify_migration(sqlite_path, pg_engine)

    print("\n" + "=" * 50)
    print("  迁移完成！")
    print(f"  启动命令: DATABASE_URL='{pg_url}' python backend/main.py")
    print("=" * 50)


if __name__ == "__main__":
    main()
