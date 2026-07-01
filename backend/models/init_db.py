"""Database initialization and migration"""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from .base import engine, SessionLocal, _is_sqlite
from . import *
from .permissions import DEFAULT_ROLES


def _pg():
    """是否为 PostgreSQL"""
    return not _is_sqlite


def _col(sqlite_type: str, pg_type: str) -> str:
    """根据数据库方言返回对应类型"""
    return pg_type if _pg() else sqlite_type


def _migrate_db():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # PostgreSQL：create_all 已处理建表，跳过所有 CREATE TABLE 块
    # 只需执行 ALTER TABLE 迁移（添加新列）

    tenant_tables = [
        "roles", "departments", "users", "tickets", "ticket_feedbacks",
        "after_sales_feedbacks", "gift_feedbacks", "gift_resend_feedbacks",
        "notifications", "knowledge_categories", "knowledge_articles",
        "after_sales_records", "return_exchange_records", "return_exchange_feedbacks",
        "repair_records", "repair_feedbacks", "repair_charge_requests",
        "after_sales_charge_requests", "gift_records", "gift_cashbacks",
        "audit_logs", "announcements", "gift_resend_records", "announcement_reads",
        "approval_requests", "approval_steps", "schedule_shifts", "schedule_slots",
        "shift_swap_requests", "warehouse_products", "warehouse_inbound",
        "warehouse_outbound", "warehouse_inbound_feedbacks",
        "warehouse_outbound_feedbacks", "customer_invoice_requests",
        "sales_invoices", "purchase_invoices", "expense_invoices",
        "attendance_records", "task_boards", "shops",
        "gift_cashback_feedbacks",
    ]

    if "companies" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    status VARCHAR(30) DEFAULT 'active',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "attendance_records" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE attendance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    date VARCHAR(20) NOT NULL,
                    check_in DATETIME,
                    check_out DATETIME,
                    status VARCHAR(20) DEFAULT 'normal',
                    location VARCHAR(200) DEFAULT '',
                    remark VARCHAR(200) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()
        # Re-get existing_tables after creating new table
        existing_tables = inspector.get_table_names()

    if "task_boards" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE task_boards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    title VARCHAR(200) NOT NULL,
                    description TEXT DEFAULT '',
                    status VARCHAR(20) DEFAULT 'todo',
                    priority VARCHAR(20) DEFAULT 'normal',
                    assignee_id INTEGER REFERENCES users(id),
                    due_date VARCHAR(20),
                    sort_order INTEGER DEFAULT 0,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "shops" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE shops (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    name VARCHAR(200) DEFAULT '',
                    created_at DATETIME
                )
            """))
            conn.commit()

    with engine.connect() as conn:
        default_company = conn.execute(text("SELECT id FROM companies WHERE name = '微迹OA'")).fetchone()
        if not default_company:
            now = datetime.now()
            conn.execute(
                text("INSERT INTO companies (name, status, created_at, updated_at) VALUES ('微迹OA', 'active', :now, :now)"),
                {"now": now},
            )
            conn.commit()
            default_company = conn.execute(text("SELECT id FROM companies WHERE name = '微迹OA'")).fetchone()
        default_company_id = default_company[0]

    existing_tables = inspect(engine).get_table_names()
    for table_name in tenant_tables:
        if table_name in existing_tables:
            columns = [c["name"] for c in inspect(engine).get_columns(table_name)]
            if "company_id" not in columns:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN company_id INTEGER REFERENCES companies(id)"))
                    conn.commit()
            with engine.connect() as conn:
                conn.execute(text(f"UPDATE {table_name} SET company_id = :company_id WHERE company_id IS NULL"), {"company_id": default_company_id})
                conn.commit()

    if "users" in existing_tables:
        columns = [c["name"] for c in inspect(engine).get_columns("users")]
        if "is_platform_admin" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0"))
                conn.commit()
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET is_platform_admin = 1 WHERE username = 'admin'"))
            conn.commit()

        if "email" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(120)"))
                conn.commit()
            with engine.connect() as conn:
                conn.execute(text("UPDATE users SET email = 'admin@weiji.local' WHERE username = 'admin' AND email IS NULL"))
                conn.commit()
            # 尝试移除 username 的全局唯一约束，改为添加联合唯一索引
            try:
                with engine.connect() as conn:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_username ON users (company_id, username)"))
                    conn.commit()
            except:
                pass

        if "dingtalk_user_id" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN dingtalk_user_id VARCHAR(64)"))
                conn.commit()

    if "attendance_records" in existing_tables:
        columns = [c["name"] for c in inspect(engine).get_columns("attendance_records")]
        if "source" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE attendance_records ADD COLUMN source VARCHAR(20) DEFAULT 'manual'"))
                conn.commit()
        if "scheduled_start" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE attendance_records ADD COLUMN scheduled_start VARCHAR(10) DEFAULT ''"))
                conn.execute(text("ALTER TABLE attendance_records ADD COLUMN scheduled_end VARCHAR(10) DEFAULT ''"))
                conn.commit()

    new_tables = inspect(engine).get_table_names()
    if "dingtalk_configs" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE dingtalk_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                    app_key VARCHAR(100) DEFAULT '',
                    app_secret VARCHAR(200) DEFAULT '',
                    enabled INTEGER DEFAULT 0,
                    last_sync_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    if "module_configs" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE module_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    module_key VARCHAR(50) NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    display_name VARCHAR(50) DEFAULT '',
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()
        new_tables = inspector.get_table_names()

    if "field_labels" not in new_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE field_labels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL REFERENCES companies(id),
                    module_key VARCHAR(50) NOT NULL,
                    field_name VARCHAR(50) NOT NULL,
                    label VARCHAR(50) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE dingtalk_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
                    app_key VARCHAR(100) DEFAULT '',
                    app_secret VARCHAR(200) DEFAULT '',
                    enabled INTEGER DEFAULT 0,
                    last_sync_at DATETIME,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    # ── 模块配置表新增元数据字段（v2.0 迁移） ────────────────────
    if "module_configs" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("module_configs")]
        new_module_config_columns = {
            "icon": "ALTER TABLE module_configs ADD COLUMN icon VARCHAR(50) DEFAULT ''",
            "route_path": "ALTER TABLE module_configs ADD COLUMN route_path VARCHAR(200) DEFAULT ''",
            "navigation_group": "ALTER TABLE module_configs ADD COLUMN navigation_group VARCHAR(50) DEFAULT ''",
            "permissions": "ALTER TABLE module_configs ADD COLUMN permissions TEXT DEFAULT '[]'",
            "fields_schema": "ALTER TABLE module_configs ADD COLUMN fields_schema TEXT DEFAULT '[]'",
        }
        for col_name, sql in new_module_config_columns.items():
            if col_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()
        # 迁移后，用注册表数据回填现有记录的元数据字段
        from .module_registry import MODULE_REGISTRY
        import json as _json
        db_migrate = SessionLocal()
        try:
            configs = db_migrate.query(ModuleConfig).all()
            for config in configs:
                reg = MODULE_REGISTRY.get(config.module_key)
                if reg:
                    config.icon = reg.icon
                    config.route_path = reg.route_path
                    config.navigation_group = reg.navigation_group
                    config.permissions = _json.dumps(reg.permissions)
                    config.fields_schema = _json.dumps([
                        {"name": f.name, "label": f.label, "type": f.type,
                         "options": f.options, "required": f.required,
                         "sort_order": f.sort_order}
                        for f in reg.fields
                    ])
            db_migrate.commit()
        finally:
            db_migrate.close()
    # ─────────────────────────────────────────────────────────────

    # 旧迁移：knowledge_articles.images 列
    if 'knowledge_articles' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('knowledge_articles')]
        if 'images' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_articles ADD COLUMN images TEXT DEFAULT '[]'"))
                conn.commit()

    # 新迁移：users 表新增 department_id 列
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'department_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN department_id INTEGER REFERENCES departments(id)"))
                conn.commit()

    # 新迁移：users 表新增 is_manager 列
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'is_manager' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_manager INTEGER DEFAULT 0"))
                conn.commit()
        # 将 admin 用户的 is_manager 设为 True
        with engine.connect() as conn:
            conn.execute(text("UPDATE users SET is_manager = 1 WHERE username = 'admin' AND is_manager = 0"))
            conn.commit()

    # 新迁移：roles 表新增 bound_shops 列
    if 'roles' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('roles')]
        if 'bound_shops' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE roles ADD COLUMN bound_shops TEXT DEFAULT '[]'"))
                conn.commit()

    # ── 售后登记表重构迁移 ──────────────────────────────────────────
    # 旧字段：customer_name, customer_phone, platform, product_name, issue_desc,
    #         handle_result, status, images, customer_address, customer_id
    # 新字段：apply_date, return_reason, size, model, config, computer_price,
    #         quantity, accessories, accessories_price, customer_info,
    #         return_tracking, send_tracking, progress, disassembly_feedback,
    #         shipping_fee, remark
    if 'after_sales_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('after_sales_records')]
        # 如果存在旧字段 customer_name 说明还是旧结构，需要重建
        if 'customer_name' in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE after_sales_records RENAME TO after_sales_records_old"))
                conn.execute(text("""
                    CREATE TABLE after_sales_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        apply_date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        return_reason TEXT DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        computer_price REAL DEFAULT 0,
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        accessories_price REAL DEFAULT 0,
                        customer_info TEXT DEFAULT '',
                        return_tracking VARCHAR(100) DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        handle_result TEXT DEFAULT '',
                        progress VARCHAR(50) DEFAULT 'pending',
                        disassembly_feedback TEXT DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                conn.execute(text("DROP TABLE after_sales_records_old"))
                conn.commit()
        columns = [c['name'] for c in inspector.get_columns('after_sales_records')]
        after_sales_add_columns = {
            'charge_required': "ALTER TABLE after_sales_records ADD COLUMN charge_required INTEGER DEFAULT 0",
            'charge_status': "ALTER TABLE after_sales_records ADD COLUMN charge_status VARCHAR(30) DEFAULT 'none'",
            'current_expected_amount': f"ALTER TABLE after_sales_records ADD COLUMN current_expected_amount {_col('REAL', 'NUMERIC(12,2)')} DEFAULT 0",
            'current_paid_amount': f"ALTER TABLE after_sales_records ADD COLUMN current_paid_amount {_col('REAL', 'NUMERIC(12,2)')} DEFAULT 0",
            'last_charge_request_id': "ALTER TABLE after_sales_records ADD COLUMN last_charge_request_id INTEGER",
            'record_type': "ALTER TABLE after_sales_records ADD COLUMN record_type VARCHAR(20) DEFAULT ''",
        }
        for column_name, sql in after_sales_add_columns.items():
            if column_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()

    if 'after_sales_charge_requests' not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE after_sales_charge_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    after_sales_record_id INTEGER NOT NULL REFERENCES after_sales_records(id),
                    status VARCHAR(30) DEFAULT 'pending_charge',
                    expected_amount REAL DEFAULT 0,
                    paid_amount REAL DEFAULT 0,
                    charge_note TEXT DEFAULT '',
                    amount_change_note TEXT DEFAULT '',
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    paid_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    paid_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    # ── 退换登记表 record_type 字段迁移 ───────────────────────────
    if 'return_exchange_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('return_exchange_records')]
        if 'record_type' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN record_type VARCHAR(20) DEFAULT ''"))
                conn.commit()

    # ── 发货登记表重构迁移（原赠品登记） ────────────────────────────
    # 旧字段：customer_name, customer_phone, platform, gift_name, gift_qty,
    #         activity_name, remark, status, customer_address, customer_id
    # 新字段：date, size, model, config, color, quantity, accessories,
    #         customer_info, send_tracking, shipping_fee, ship_date, order_amount, cost
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        # 如果存在旧字段 customer_name 说明还是旧结构，需要重建
        if 'customer_name' in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records RENAME TO gift_records_old"))
                conn.execute(text("""
                    CREATE TABLE gift_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        color VARCHAR(50) DEFAULT '',
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        customer_info TEXT DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        order_amount REAL DEFAULT 0,
                        cost REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        ship_date VARCHAR(20) DEFAULT '',
                        status VARCHAR(20) DEFAULT 'pending',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                conn.execute(text("DROP TABLE gift_records_old"))
                conn.commit()
        # 如果存在 cashback 或 profit 列，需要移除（现在有独立的返现表了）
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'cashback' in columns or 'profit' in columns:
            # SQLite 不支持 DROP COLUMN，需要重建表
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records RENAME TO gift_records_old2"))
                conn.execute(text("""
                    CREATE TABLE gift_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date VARCHAR(20) DEFAULT '',
                        order_no VARCHAR(100) DEFAULT '',
                        size VARCHAR(50) DEFAULT '',
                        model VARCHAR(200) DEFAULT '',
                        config VARCHAR(200) DEFAULT '',
                        color VARCHAR(50) DEFAULT '',
                        quantity INTEGER DEFAULT 1,
                        accessories VARCHAR(500) DEFAULT '',
                        customer_info TEXT DEFAULT '',
                        send_tracking VARCHAR(100) DEFAULT '',
                        shipping_fee REAL DEFAULT 0,
                        order_amount REAL DEFAULT 0,
                        cost REAL DEFAULT 0,
                        remark TEXT DEFAULT '',
                        ship_date VARCHAR(20) DEFAULT '',
                        status VARCHAR(20) DEFAULT 'pending',
                        created_by INTEGER REFERENCES users(id),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))
                # 复制数据
                conn.execute(text("""
                    INSERT INTO gift_records (id, date, order_no, size, model, config, color, quantity,
                        accessories, customer_info, send_tracking, shipping_fee, order_amount, cost,
                        remark, ship_date, status, created_by, created_at, updated_at)
                    SELECT id, date, order_no, size, model, config, color, quantity,
                        accessories, customer_info, send_tracking, shipping_fee,
                        COALESCE(order_amount, 0), COALESCE(cost, 0),
                        remark, ship_date, status, created_by, created_at, updated_at
                    FROM gift_records_old2
                """))
                conn.execute(text("DROP TABLE gift_records_old2"))
                conn.commit()

    # 创建返现登记表
    if 'gift_cashbacks' not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE gift_cashbacks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_no VARCHAR(100) DEFAULT '',
                    cashback_amount REAL DEFAULT 0,
                    reason TEXT DEFAULT '',
                    remark TEXT DEFAULT '',
                    applicant VARCHAR(100) DEFAULT '',
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.commit()

    # ── 迁移：gift_records 新增 shop_id / shop_name 列 ─────────────
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'shop_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records ADD COLUMN shop_id INTEGER REFERENCES shops(id)"))
                conn.commit()
        if 'shop_name' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records ADD COLUMN shop_name VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：users 表新增 role_id 列 ──────────────────────────────
    if 'users' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'role_id' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)"))
                conn.commit()
            # 将现有用户的 role 字符串关联到对应的 Role 记录
            _sync_user_role_ids()

    if 'notifications' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('notifications')]
        notification_add_columns = {
            'resource_type': "ALTER TABLE notifications ADD COLUMN resource_type VARCHAR(50) DEFAULT ''",
            'resource_id': "ALTER TABLE notifications ADD COLUMN resource_id INTEGER",
        }
        for column_name, sql in notification_add_columns.items():
            if column_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()

    # ── 迁移：announcements 表新增 target_departments 列 ───────────────
    if 'announcements' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('announcements')]
        if 'target_departments' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE announcements ADD COLUMN target_departments TEXT DEFAULT ''"))
                conn.commit()

    # ── 迁移：shops 表（店铺管理） ────────────────────────────────────
    if "shops" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE shops (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    name VARCHAR(200) DEFAULT '',
                    created_at DATETIME,
                    updated_at DATETIME,
                    UNIQUE(company_id, name)
                )
            """))
            conn.commit()
    else:
        # 表可能由 create_all 创建但缺少列，补全
        columns = [c['name'] for c in inspector.get_columns('shops')]
        if 'updated_at' not in columns:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE shops ADD COLUMN updated_at {_col('DATETIME', 'TIMESTAMP')}"))
                conn.commit()

    # ── 迁移：return_exchange_records 新增升级配置列 ───────────────
    if 'return_exchange_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('return_exchange_records')]
        with engine.connect() as conn:
            if 'upgrade_config' not in columns:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN upgrade_config VARCHAR(200) DEFAULT ''"))
            if 'upgrade_fee' not in columns:
                conn.execute(text(f"ALTER TABLE return_exchange_records ADD COLUMN upgrade_fee {_col('REAL', 'NUMERIC(12,2)')} DEFAULT 0"))
            conn.commit()

    # ── 迁移：return_exchange_records 新增 shop_name 列 ───────────────
    if 'return_exchange_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('return_exchange_records')]
        if 'shop_name' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN shop_name VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：return_exchange_records 新增货损追赔列 ──────────────────
    if 'return_exchange_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('return_exchange_records')]
        with engine.connect() as conn:
            if 'has_damage' not in columns:
                conn.execute(text(f"ALTER TABLE return_exchange_records ADD COLUMN has_damage BOOLEAN DEFAULT {_col('0', 'FALSE')}"))
            if 'damage_items' not in columns:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN damage_items TEXT DEFAULT '[]'"))
            if 'claim_status' not in columns:
                conn.execute(text("ALTER TABLE return_exchange_records ADD COLUMN claim_status VARCHAR(20) DEFAULT 'none'"))
            conn.commit()

    # ── 迁移：gift_records 新增 shop_name 列 ─────────────────────────
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'shop_name' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records ADD COLUMN shop_name VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：gift_records 新增 product 列 ─────────────────────────
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'product' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records ADD COLUMN product VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：gift_records 新增 gift_costs 列 ─────────────────────
    if 'gift_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_records')]
        if 'gift_costs' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_records ADD COLUMN gift_costs TEXT DEFAULT '[]'"))
                conn.commit()

    # ── 创建字段预设选项表 ──────────────────────────────────────────
    if "field_options" not in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE field_options (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    field_name VARCHAR(50) NOT NULL,
                    value VARCHAR(200) NOT NULL,
                    created_at DATETIME,
                    UNIQUE(company_id, field_name, value)
                )
            """))
            conn.commit()

    # ── 迁移：field_options 新增 price 列 ────────────────────────
    if 'field_options' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('field_options')]
        if 'price' not in columns:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE field_options ADD COLUMN price {_col('REAL', 'NUMERIC(12,2)')} DEFAULT 0"))
                conn.commit()

    # ── 迁移：field_options 新增 color_code 列 ───────────────────
    if 'field_options' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('field_options')]
        if 'color_code' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE field_options ADD COLUMN color_code VARCHAR(20)"))
                conn.commit()

    # ── 创建礼品预设组合表 ────────────────────────────────────────
    if "gift_presets" not in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE gift_presets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    name VARCHAR(100) NOT NULL,
                    items TEXT DEFAULT '[]',
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME
                )
            """))
            conn.commit()

    # ── 创建礼品补发预设组合表 ──────────────────────────────────────
    if "gift_resend_presets" not in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE gift_resend_presets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    name VARCHAR(100) NOT NULL,
                    items TEXT DEFAULT '[]',
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME
                )
            """))
            conn.commit()

    # ── 迁移：repair_records 新增 shop_name 列 ──────────────────
    if 'repair_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('repair_records')]
        if 'shop_name' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE repair_records ADD COLUMN shop_name VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：gift_cashbacks 新增 shop_name 列 ─────────────────
    if 'gift_cashbacks' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_cashbacks')]
        if 'shop_name' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_cashbacks ADD COLUMN shop_name VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 迁移：gift_resend_records 新增 gift_items 列 ─────────────
    if 'gift_resend_records' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_resend_records')]
        if 'gift_items' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_resend_records ADD COLUMN gift_items TEXT DEFAULT '[]'"))
                conn.commit()
        # 迁移：gift_resend_records 新增 status 列
        if 'status' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE gift_resend_records ADD COLUMN status VARCHAR(20) DEFAULT 'pending'"))
                conn.commit()

    # products 表：新增 ram_freq 列
    if 'products' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('products')]
        if 'ram_freq' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN ram_freq VARCHAR(100) DEFAULT ''"))
                conn.commit()
        if 'charger' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN charger VARCHAR(200) DEFAULT ''"))
                conn.commit()

    # ── 操作日志增加 changes 字段 ──
    if "audit_logs" in existing_tables:
        columns = {col["name"] for col in inspector.get_columns("audit_logs")}
        if "changes" not in columns:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE audit_logs ADD COLUMN changes {_col('TEXT', 'JSONB')} DEFAULT {_col(chr(39)+'{}'+chr(39), chr(39)+'{}'+chr(39)+'::jsonb')}"))
                conn.commit()

    # gift_cashbacks 表：新增收款方式、收款账户、收款码、状态字段
    if 'gift_cashbacks' in existing_tables:
        columns = [c['name'] for c in inspector.get_columns('gift_cashbacks')]
        for col_name, col_def in [
            ('payment_method', "VARCHAR(100) DEFAULT ''"),
            ('payment_account', "VARCHAR(200) DEFAULT ''"),
            ('payment_qr_code', "VARCHAR(500) DEFAULT ''"),
            ('payee', "VARCHAR(100) DEFAULT ''"),
            ('status', "VARCHAR(20) DEFAULT 'pending'"),
        ]:
            if col_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE gift_cashbacks ADD COLUMN {col_name} {col_def}"))
                    conn.commit()

    # ── 迁移：返现登记处理记录表 ───────────────────────────────
    if "gift_cashback_feedbacks" not in existing_tables:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE gift_cashback_feedbacks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER REFERENCES companies(id),
                    record_id INTEGER NOT NULL REFERENCES gift_cashbacks(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    content TEXT DEFAULT '',
                    created_at DATETIME
                )
            """))
            conn.commit()

    # ── 性能优化：添加常用查询索引 ──
    _ensure_indexes(engine, existing_tables)


def _ensure_indexes(engine, existing_tables):
    """为高频查询字段添加索引，提升并发查询性能"""
    indexes = [
        # tickets 表：customer_id、status、created_at 是列表页常用过滤/排序字段
        ("idx_tickets_customer_id", "tickets", "customer_id"),
        ("idx_tickets_status", "tickets", "status"),
        ("idx_tickets_created_at", "tickets", "created_at"),
        # repair_records 表：model、repair_status、created_at 用于报表和列表
        ("idx_repair_model", "repair_records", "model"),
        ("idx_repair_status", "repair_records", "repair_status"),
        ("idx_repair_created_at", "repair_records", "created_at"),
        # return_exchange_records 表：model、record_type、progress、created_at
        ("idx_return_model", "return_exchange_records", "model"),
        ("idx_return_record_type", "return_exchange_records", "record_type"),
        ("idx_return_created_at", "return_exchange_records", "created_at"),
        # ticket_feedbacks 表：ticket_id 已有索引，加 feedback_type
        ("idx_feedback_type", "ticket_feedbacks", "feedback_type"),
        # knowledge_articles 表：title、keywords 用于搜索
        ("idx_knowledge_title", "knowledge_articles", "title"),
        # products 表：model_number 用于搜索
        ("idx_product_model_number", "products", "model_number"),
    ]
    with engine.connect() as conn:
        for idx_name, table, column in indexes:
            if table in existing_tables:
                try:
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({column})"))
                except Exception:
                    pass  # 索引可能已存在
        conn.commit()


def _sync_user_role_ids():
    """将现有用户的 role 字符串与 roles 表的 id 关联"""
    from sqlalchemy import text
    db = SessionLocal()
    try:
        roles = db.query(Role).all()
        role_map = {r.name: r.id for r in roles}
        users = db.query(User).filter(User.role_id.is_(None)).all()
        for u in users:
            if u.role in role_map:
                u.role_id = role_map[u.role]
        db.commit()
    finally:
        db.close()


def _sync_role_permissions():
    """给现有角色补充新增的权限"""
    from .permissions import DEFAULT_ROLES
    db = SessionLocal()
    try:
        for role_def in DEFAULT_ROLES:
            role = db.query(Role).filter(Role.name == role_def["name"]).first()
            if role:
                existing = set(role.permissions or [])
                target = set(role_def["permissions"])
                missing = target - existing
                if missing:
                    role.permissions = sorted(existing | target)
                    db.commit()
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    db = SessionLocal()
    from auth import get_password_hash

    default_company = db.query(Company).filter(Company.name == "微迹OA").first()
    if not default_company:
        default_company = Company(name="微迹OA", status="active")
        db.add(default_company)
        db.commit()
        db.refresh(default_company)

    # 种子数据：默认角色
    if db.query(Role).count() == 0:
        for r in DEFAULT_ROLES:
            db.add(Role(
                company_id=default_company.id,
                name=r["name"], label=r["label"], color=r["color"],
                permissions=r["permissions"], is_builtin=r["is_builtin"],
            ))
        db.commit()

    # 迁移：将 technician 和 customer 的 is_builtin 改为 False（仅 admin 为内置）
    for role_name in ["technician", "customer"]:
        role_obj = db.query(Role).filter(Role.name == role_name).first()
        if role_obj and role_obj.is_builtin:
            role_obj.is_builtin = False
            db.commit()

    # 同步角色权限（补充新增的权限）
    _sync_role_permissions()

    existing = db.query(User).filter(User.username == "admin").first()
    if not existing:
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        admin = User(
            company_id=default_company.id,
            is_platform_admin=True,
            email="admin@weiji.local",
            username="admin",
            password_hash=get_password_hash("admin"),
            name="管理员",
            role="admin",
            role_id=admin_role.id if admin_role else None,
        )
        db.add(admin)
        db.commit()
    else:
        # 确保已有 admin 用户关联 role_id
        if existing.role_id is None:
            admin_role = db.query(Role).filter(Role.name == "admin").first()
            if admin_role:
                existing.role_id = admin_role.id
                db.commit()
        if existing.company_id is None:
            existing.company_id = default_company.id
            db.commit()
        if not existing.is_platform_admin:
            existing.is_platform_admin = True
            db.commit()
        if not existing.email:
            existing.email = "admin@weiji.local"
            db.commit()
        # 确保 admin 的 role 字段与 role_id 一致
        if existing.role_obj and existing.role != existing.role_obj.name:
            existing.role = existing.role_obj.name
            db.commit()

    # 确保 technician 和 customer 用户也关联 role_id
    for role_name in ["technician", "customer"]:
        role_obj = db.query(Role).filter(Role.name == role_name).first()
        if role_obj:
            db.query(User).filter(User.role == role_name, User.role_id.is_(None)).update(
                {"role_id": role_obj.id}, synchronize_session=False
            )
            db.commit()

    # 种子数据：默认班次类型
    if db.query(ScheduleShift).count() == 0:
        default_shifts = [
            ScheduleShift(name="早班", short_name="早", color="#1677FF", start_time="09:00", end_time="13:00", sort_order=1, is_rest=False),
            ScheduleShift(name="中班", short_name="中", color="#52C41A", start_time="13:00", end_time="18:00", sort_order=2, is_rest=False),
            ScheduleShift(name="晚班", short_name="晚", color="#722ED1", start_time="18:00", end_time="22:00", sort_order=3, is_rest=False),
            ScheduleShift(name="全天班", short_name="全", color="#FA8C16", start_time="09:00", end_time="18:00", sort_order=4, is_rest=False),
            ScheduleShift(name="休息", short_name="休", color="#D9D9D9", start_time="", end_time="", sort_order=5, is_rest=True),
        ]
        db.add_all(default_shifts)
        db.commit()
    # 种子数据：默认模块配置（从注册表统一生成）
    from .seed_modules import seed_module_configs
    seed_module_configs(db, default_company.id)

    # 清理超过3个月的操作日志
    try:
        from datetime import datetime, timedelta
        cutoff = datetime.now() - timedelta(days=90)
        deleted = db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete()
        if deleted:
            print(f"[init_db] 已清理 {deleted} 条超过3个月的操作日志")
        db.commit()
    except Exception as e:
        print(f"[init_db] 清理过期操作日志失败: {e}")
        db.rollback()

    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
