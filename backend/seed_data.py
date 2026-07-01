"""填充随机测试数据——覆盖所有业务模块"""
import random, json
from datetime import datetime, timedelta
from models.base import SessionLocal
from models import *
from models.field_option import FieldOption
from auth import get_password_hash


def seed():
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name == "微迹OA").first()

        # ── 1. 部门 ─────────────────────────────────────────────
        dept_names = ["技术部", "运营部", "客服部", "仓储部", "财务部"]
        depts = {}
        for name in dept_names:
            d = db.query(Department).filter(Department.name == name).first()
            if not d:
                d = Department(company_id=company.id, name=name)
                db.add(d)
        db.commit()
        for name in dept_names:
            depts[name] = db.query(Department).filter(Department.name == name).first()

        # ── 2. 店铺 ─────────────────────────────────────────────
        shop_names = ["天猫旗舰店", "京东自营", "拼多多专营", "抖音小店", "线下门店"]
        for sn in shop_names:
            s = db.query(Shop).filter(Shop.name == sn).first()
            if not s:
                db.add(Shop(company_id=company.id, name=sn))
        db.commit()
        shops = db.query(Shop).all()

        # ── 3. 角色 ─────────────────────────────────────────────
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        tech_role = db.query(Role).filter(Role.name == "technician").first()
        cust_role = db.query(Role).filter(Role.name == "customer").first()

        # ── 4. 用户 ─────────────────────────────────────────────
        user_data = [
            ("张三", "zhangsan", "技术部", "technician", True),
            ("李四", "lisi", "运营部", "technician", True),
            ("王五", "wangwu", "客服部", "customer", False),
            ("赵六", "zhaoliu", "仓储部", "customer", False),
            ("钱七", "qianqi", "财务部", "customer", False),
            ("孙八", "sunba", "运营部", "customer", False),
            ("周九", "zhoujiu", "客服部", "customer", False),
            ("吴十", "wushi", "技术部", "technician", False),
        ]
        users_list = [db.query(User).filter(User.username == "admin").first()]
        for name, uname, dept, role, is_mgr in user_data:
            u = db.query(User).filter(User.username == uname).first()
            if not u:
                u = User(
                    company_id=company.id, username=uname, name=name,
                    email=f"{uname}@weiji.local",
                    password_hash=get_password_hash("123456"),
                    role=role,
                    role_id=tech_role.id if role == "technician" else cust_role.id,
                    department_id=depts[dept].id, is_manager=is_mgr,
                )
                db.add(u)
            users_list.append(u)
        db.commit()
        users_list = db.query(User).all()
        admin_user = users_list[0]

        # ── 5. 工单 (60条) ───────────────────────────────────────
        if db.query(Ticket).count() == 0:
            platforms = ["天猫", "京东", "拼多多", "抖音", "小红书"]
            descs = [
                "电脑无法开机，按下电源键无反应",
                "屏幕出现花屏/闪屏现象",
                "键盘部分按键失灵",
                "系统频繁蓝屏，错误代码0x0000001A",
                "电池无法充电，插电后指示灯不亮",
                "风扇噪音大，温度显示异常高",
                "WiFi连接不稳定，频繁断线",
                "触控板灵敏度异常",
                "外接显示器无法识别",
                "系统更新后部分软件无法运行",
            ]
            for i in range(60):
                t = Ticket(
                    company_id=company.id,
                    platform=random.choice(platforms),
                    customer_id=f"CUST{random.randint(1000, 9999)}",
                    description=random.choice(descs),
                    remote_code=f"RC{random.randint(100000, 999999)}",
                    verify_code=f"VC{random.randint(1000, 9999)}",
                    priority=random.choice(["low", "medium", "high", "urgent"]),
                    status=random.choice(["pending", "processing", "completed", "cancelled"]),
                    diagnosis_result=random.choice(["", "硬件故障", "软件问题", "操作不当"]),
                    created_by=random.choice(users_list).id,
                    assigned_to=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                )
                db.add(t)
            db.commit()

        # ── 6. 工单反馈 ───────────────────────────────────────────
        if db.query(TicketFeedback).count() == 0:
            tickets = db.query(Ticket).all()
            for tkt in random.sample(tickets, min(30, len(tickets))):
                for _ in range(random.randint(1, 3)):
                    db.add(TicketFeedback(
                        company_id=company.id, ticket_id=tkt.id,
                        user_id=random.choice(users_list).id,
                        content=random.choice([
                            "已联系客户，正在排查问题。",
                            "客户反馈是软件冲突导致，已远程修复。",
                            "需要更换配件，已通知客户寄回。",
                            "客户已确认问题解决，工单关闭。",
                        ]),
                        feedback_type=random.choice(["progress", "diagnosis", "resolution"]),
                        created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                    ))
            db.commit()

        # ── 7. 发货登记 (80条) ─────────────────────────────────────
        if db.query(GiftRecord).count() == 0:
            models_list = ["ThinkPad X1 Carbon", "MacBook Pro 14", "MateBook X Pro", "Yoga Pro 14s", "XPS 15", "暗影精灵9"]
            configs_list = ["i5-13500H/16G/512G", "i7-13700H/32G/1TB", "R7-7840H/16G/512G", "i9-13900H/32G/2TB", "M2 Pro/16G/512G"]
            colors_list = ["深空灰", "银色", "星空黑", "云杉绿", "皓月银"]
            sizes_list = ["13.3寸", "14寸", "14.5寸", "15.6寸", "16寸"]
            accessories_pool = ["鼠标", "键盘", "电脑包", "贴膜", "U盘", "扩展坞", "散热支架", "屏幕清洁套装"]
            for i in range(80):
                qty = random.randint(1, 3)
                acc = random.sample(accessories_pool, random.randint(1, 3))
                order_amt = round(random.uniform(3000, 15000), 2)
                cost = round(order_amt * random.uniform(0.5, 0.85), 2)
                g = GiftRecord(
                    company_id=company.id,
                    date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    shop_name=random.choice(shop_names),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    product=random.choice(["笔记本电脑", "平板电脑", "一体机", "显示器"]),
                    size=random.choice(sizes_list), model=random.choice(models_list),
                    config=random.choice(configs_list), color=random.choice(colors_list),
                    quantity=qty, accessories=", ".join(acc),
                    customer_info=f"{random.choice(['张先生','李女士','王先生','赵女士'])} 1{random.randint(30,99)}{random.randint(10000000,99999999)}",
                    send_tracking=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.2 else "",
                    shipping_fee=round(random.uniform(18, 80), 2),
                    order_amount=order_amt, cost=cost,
                    gift_costs=[{"name": a, "amount": round(random.uniform(5, 50), 2)} for a in acc],
                    remark=random.choice(["", "请仔细包装", "加急发货", "客户要求周末送达"]),
                    ship_date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d") if random.random() > 0.3 else "",
                    status=random.choice(["pending", "sent", "intercepted", "torn", "cancelled", "returned"]),
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 90)),
                )
                db.add(g)
            db.commit()

        # ── 8. 返现登记 (25条) ─────────────────────────────────────
        if db.query(GiftCashback).count() == 0:
            gift_records = db.query(GiftRecord).filter(GiftRecord.order_amount > 0).all()
            for gr in random.sample(gift_records, min(25, len(gift_records))):
                db.add(GiftCashback(
                    company_id=company.id, shop_name=gr.shop_name, order_no=gr.order_no,
                    cashback_amount=round(random.uniform(50, 500), 2),
                    reason=random.choice(["好评返现", "活动返现", "补偿运费", "老客户回馈"]),
                    applicant=random.choice(users_list).name,
                    payment_method=random.choice(["微信", "支付宝", "银行卡"]),
                    payment_account=f"1{random.randint(30,99)}{random.randint(10000000,99999999)}",
                    payee=random.choice(users_list).name,
                    status=random.choice(["pending", "completed"]),
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                ))
            db.commit()

        # ── 9. 礼品补发 (20条) ─────────────────────────────────────
        if db.query(GiftResendRecord).count() == 0:
            for i in range(20):
                items = [{"name": n, "quantity": random.randint(1, 3)} for n in
                         random.sample(["鼠标", "键盘膜", "电脑包", "适配器", "数据线", "说明书"], random.randint(1, 3))]
                db.add(GiftResendRecord(
                    company_id=company.id,
                    apply_date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d"),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    shop_name=random.choice(shop_names),
                    type=random.choice(["漏发补发", "破损补发", "赠品补发"]),
                    gift_items=items,
                    customer_info=f"{random.choice(['张先生','李女士'])} 1{random.randint(30,99)}{random.randint(10000000,99999999)} 广东省深圳市南山区",
                    express_company=random.choice(["顺丰", "中通", "圆通", "韵达"]),
                    tracking_no=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.2 else "",
                    status=random.choice(["pending", "sent", "cancelled"]),
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                ))
            db.commit()

        # ── 10. 退换登记 (50条) ────────────────────────────────────
        if db.query(ReturnExchangeRecord).count() == 0:
            models_list = ["ThinkPad X1 Carbon", "MacBook Pro 14", "MateBook X Pro", "Yoga Pro 14s", "XPS 15", "暗影精灵9"]
            configs_list = ["i5-13500H/16G/512G", "i7-13700H/32G/1TB", "R7-7840H/16G/512G", "i9-13900H/32G/2TB", "M2 Pro/16G/512G"]
            sizes_list = ["13.3寸", "14寸", "14.5寸", "15.6寸", "16寸"]
            accessories_pool = ["鼠标", "键盘", "电脑包", "贴膜", "U盘", "扩展坞", "散热支架"]
            for i in range(50):
                has_dmg = random.random() > 0.7
                dmg_items = []
                if has_dmg:
                    dmg_items = [{"name": n, "amount": round(random.uniform(50, 300), 2), "desc": d}
                                 for n, d in random.sample([("屏幕", "碎裂"), ("外壳", "划痕"), ("键盘", "按键脱落"), ("充电器", "损坏")], random.randint(1, 2))]
                db.add(ReturnExchangeRecord(
                    company_id=company.id,
                    apply_date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    shop_name=random.choice(shop_names),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    return_reason=random.choice(["商品与描述不符", "质量问题", "发错型号", "客户不想要了", "屏幕有坏点", "无法开机", "尺寸不合适"]),
                    size=random.choice(sizes_list), model=random.choice(models_list),
                    config=random.choice(configs_list),
                    computer_price=round(random.uniform(3000, 12000), 2),
                    quantity=random.randint(1, 2),
                    accessories=", ".join(random.sample(accessories_pool, random.randint(0, 3))),
                    accessories_price=round(random.uniform(0, 300), 2),
                    customer_info=f"{random.choice(['张先生','李女士','王先生','赵女士'])} 1{random.randint(30,99)}{random.randint(10000000,99999999)} 杭州市余杭区",
                    return_tracking=f"YT{random.randint(1000000000, 9999999999)}" if random.random() > 0.3 else "",
                    send_tracking=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.5 else "",
                    progress=random.choice(["pending", "processing", "completed"]),
                    shipping_fee=round(random.uniform(15, 60), 2),
                    record_type=random.choice(["return", "exchange"]),
                    has_damage=has_dmg, damage_items=dmg_items,
                    claim_status=random.choice(["none", "pending", "claimed"]) if has_dmg else "none",
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 90)),
                ))
            db.commit()

        # ── 11. 维修登记 (30条) ────────────────────────────────────
        if db.query(RepairRecord).count() == 0:
            models_list = ["ThinkPad X1 Carbon", "MacBook Pro 14", "MateBook X Pro", "Yoga Pro 14s", "XPS 15", "暗影精灵9"]
            configs_list = ["i5-13500H/16G/512G", "i7-13700H/32G/1TB", "R7-7840H/16G/512G", "i9-13900H/32G/2TB", "M2 Pro/16G/512G"]
            for i in range(30):
                db.add(RepairRecord(
                    company_id=company.id,
                    apply_date=(datetime.now() - timedelta(days=random.randint(0, 120))).strftime("%Y-%m-%d"),
                    shop_name=random.choice(shop_names),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    return_reason=random.choice(["无法开机", "屏幕碎裂", "进水", "键盘失灵", "风扇异响", "电池鼓包", "接口接触不良", "系统崩溃"]),
                    model=random.choice(models_list), config=random.choice(configs_list),
                    quantity=1, accessories="适配器",
                    customer_info=f"{random.choice(['张先生','李女士'])} 1{random.randint(30,99)}{random.randint(10000000,99999999)}",
                    return_tracking=f"YT{random.randint(1000000000, 9999999999)}" if random.random() > 0.2 else "",
                    send_tracking=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.6 else "",
                    repair_status=random.choice(["pending_repair", "processing_repair", "completed_repair"]),
                    charge_required=random.random() > 0.4,
                    charge_status=random.choice(["none", "pending_charge", "paid"]),
                    current_expected_amount=round(random.uniform(100, 2000), 2),
                    current_paid_amount=round(random.uniform(0, 2000), 2),
                    handle_result=random.choice(["已修复", "无法修复建议换新", "等待配件", ""]),
                    shipping_fee=round(random.uniform(15, 50), 2),
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 120)),
                ))
            db.commit()

        # ── 12. 仓库产品 ─────────────────────────────────────────
        if db.query(WarehouseProduct).count() == 0:
            wp_data = [
                ("CP001", "笔记本电脑", "ThinkPad X1 Carbon", "i7-13700H/32G/1TB", "A-01"),
                ("CP002", "笔记本电脑", "MacBook Pro 14", "M2 Pro/16G/512G", "A-02"),
                ("PJ001", "配件", "无线鼠标", "蓝牙5.0", "B-01"),
                ("PJ002", "配件", "机械键盘", "87键青轴", "B-02"),
                ("PJ003", "配件", "电脑包", "14寸防水", "B-03"),
                ("PJ004", "配件", "USB扩展坞", "7合1 Type-C", "B-04"),
                ("XS001", "显示器", "27寸4K显示器", "IPS面板", "C-01"),
                ("XS002", "显示器", "24寸便携屏", "1080P", "C-02"),
                ("QT001", "其他", "散热支架", "铝合金", "D-01"),
                ("QT002", "其他", "电源适配器", "65W GaN", "D-02"),
                ("RJ001", "软件", "正版Office授权", "Office 2021", "E-01"),
            ]
            for code, cat, name, spec, loc in wp_data:
                db.add(WarehouseProduct(
                    company_id=company.id, code=code, category=cat, name=name,
                    spec=spec, location=loc, initial_qty=random.randint(10, 100),
                    unit="个" if cat != "软件" else "套", created_by=admin_user.id,
                ))
            db.commit()

        # ── 13. 入库记录 (40条) ────────────────────────────────────
        if db.query(WarehouseInbound).count() == 0:
            products = db.query(WarehouseProduct).all()
            for _ in range(40):
                p = random.choice(products)
                qty = random.randint(5, 50)
                db.add(WarehouseInbound(
                    company_id=company.id,
                    date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    product_id=p.id, product_code=p.code, category=p.category,
                    product_name=p.name, spec=p.spec, location=p.location,
                    quantity=qty,
                    operator=random.choice(["仓库管理员-刘", "采购员-陈"]),
                    remark="供应商到货" if random.random() > 0.5 else "调拨入库",
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 90)),
                ))
            db.commit()

        # ── 14. 出库记录 (50条) ────────────────────────────────────
        if db.query(WarehouseOutbound).count() == 0:
            products = db.query(WarehouseProduct).all()
            for _ in range(50):
                p = random.choice(products)
                qty = random.randint(1, 10)
                db.add(WarehouseOutbound(
                    company_id=company.id,
                    date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    product_id=p.id, product_code=p.code, category=p.category,
                    product_name=p.name, spec=p.spec, location=p.location,
                    quantity=qty,
                    operator=random.choice(["仓库管理员-刘", "发货员-周"]),
                    remark=random.choice(["订单出库", "备件出库", "调拨出库", "售后换新"]),
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 90)),
                ))
            db.commit()

        # ── 15. 返厂出库 (10条) ────────────────────────────────────
        if db.query(WarehouseReturnToFactory).count() == 0:
            products = db.query(WarehouseProduct).filter(WarehouseProduct.category == "笔记本电脑").all()
            for _ in range(10):
                p = random.choice(products)
                db.add(WarehouseReturnToFactory(
                    company_id=company.id,
                    date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d"),
                    product_id=p.id, product_code=p.code, category=p.category,
                    product_name=p.name, spec=p.spec, location=p.location,
                    quantity=random.randint(1, 3),
                    reason=random.choice(["屏幕坏点", "主板故障", "电池问题", "外壳损坏"]),
                    status=random.choice(["repairing", "repaired"]),
                    operator="仓库管理员-刘",
                    repaired_at=datetime.now() if random.random() > 0.5 else None,
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                ))
            db.commit()

        # ── 16. 产品目录 ────────────────────────────────────────
        if db.query(Product).count() == 0:
            product_list = [
                {"name": "ThinkPad X1 Carbon Gen11", "brand": "联想", "model_number": "X1C-G11", "category": "笔记本电脑",
                 "cpu": "i7-13700H", "ram": "32GB", "ram_freq": "LPDDR5 5200MHz", "storage": "1TB NVMe SSD",
                 "display": "14寸 2.8K OLED", "gpu": "Intel Iris Xe", "battery": "57Wh", "weight": "1.12kg", "os": "Windows 11 Pro"},
                {"name": "MacBook Pro 14 M2", "brand": "Apple", "model_number": "A2779", "category": "笔记本电脑",
                 "cpu": "M2 Pro", "ram": "16GB", "ram_freq": "统一内存", "storage": "512GB SSD",
                 "display": "14.2寸 Liquid Retina XDR", "gpu": "M2 Pro 16核GPU", "battery": "70Wh", "weight": "1.6kg", "os": "macOS Ventura"},
                {"name": "MateBook X Pro 2024", "brand": "华为", "model_number": "MXP-2024", "category": "笔记本电脑",
                 "cpu": "Ultra 9 185H", "ram": "32GB", "ram_freq": "LPDDR5X 6400MHz", "storage": "2TB NVMe SSD",
                 "display": "14.2寸 3.1K OLED", "gpu": "Intel Arc", "battery": "70Wh", "weight": "980g", "os": "Windows 11 Home"},
            ]
            for p in product_list:
                db.add(Product(
                    company_id=company.id, name=p["name"], brand=p["brand"],
                    model_number=p["model_number"], category=p["category"],
                    cpu=p["cpu"], ram=p["ram"], ram_freq=p["ram_freq"],
                    storage=p["storage"], display=p["display"], gpu=p["gpu"],
                    battery=p["battery"], weight=p["weight"], os=p["os"],
                    description=f'{p["brand"]} {p["name"]}，{p["cpu"]}，{p["display"]}',
                    ports=json.dumps(["USB-C x2", "HDMI", "3.5mm"]),
                    status=random.choice(["在售", "在售", "在售", "停产"]),
                    created_by=admin_user.id,
                ))
            db.commit()

        # ── 17. 公告 (5条) ────────────────────────────────────────
        if db.query(Announcement).count() == 0:
            announcements_data = [
                ("关于规范售后处理流程的通知", "各位同事：为提升售后服务质量，现规范售后处理流程：1. 收到退换货需48小时内处理；2. 维修需要在3个工作日内给出诊断结果；3. 所有操作必须在系统中留痕。请各部门严格执行。"),
                ("端午节放假通知", "根据国家法定节假日安排，端午节放假时间为6月22日至6月24日，共3天。放假期间仓库暂停发货，客服值班安排详见排班表。"),
                ("新员工入职培训通知", "本周五下午2点在会议室A举行新员工入职培训，内容包括OA系统使用、售后服务流程、财务报销制度。"),
                ("仓库盘点通知", "定于本月底进行仓库全面盘点，盘点期间暂停出库操作。请仓储部做好准备工作。"),
                ("关于启用新版返现流程的通知", "即日起，返现申请统一通过OA系统提交，需填写收款方式、收款账户信息。财务部审核通过后方可支付。"),
            ]
            for title, content in announcements_data:
                db.add(Announcement(
                    company_id=company.id, title=title, content=content,
                    is_pinned=random.random() > 0.7, created_by=admin_user.id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                ))
            db.commit()

        # ── 18. 内部消息 (30条) ───────────────────────────────────
        if db.query(Message).count() == 0:
            for _ in range(30):
                snd = random.choice(users_list)
                rcp = random.choice([u for u in users_list if u.id != snd.id])
                db.add(Message(
                    company_id=company.id, sender_id=snd.id, recipient_id=rcp.id,
                    subject=random.choice(["请查收维修报告", "发货单号确认", "客户问题跟进", "月底总结", "请假申请", "配件申请", "会议通知"]),
                    content=random.choice(["请查收附件中的维修报告。", "订单发货单号已更新，请注意跟进。", "客户反馈问题已解决，请归档。", "麻烦处理一下这个售后申请。"]),
                    is_read=random.random() > 0.3, is_starred=random.random() > 0.8,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                ))
            db.commit()

        # ── 19. 任务看板 (12条) ───────────────────────────────────
        if db.query(TaskBoard).count() == 0:
            task_titles = [
                "优化售后处理流程", "更新产品目录数据", "整理仓库库存", "跟进客户满意度调查",
                "完善知识库文档", "修复系统bug", "准备月底报表", "新人培训材料",
                "处理积压退货单", "联系供应商确认配件", "审核返现申请", "测试新功能",
            ]
            for title in random.sample(task_titles, 12):
                db.add(TaskBoard(
                    company_id=company.id, title=title, description=f"详细内容待补充。",
                    status=random.choice(["todo", "in_progress", "done"]),
                    priority=random.choice(["low", "normal", "high", "urgent"]),
                    assignee_id=random.choice(users_list).id,
                    due_date=(datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                    created_by=admin_user.id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                ))
            db.commit()

        # ── 20. 知识库 ──────────────────────────────────────────
        if db.query(KnowledgeCategory).count() == 0:
            for name, icon in [("常见问题", "HelpCircle"), ("维修指南", "Wrench"), ("售后流程", "RefreshCw"), ("系统操作", "Monitor")]:
                db.add(KnowledgeCategory(company_id=company.id, name=name, icon=icon))
            db.commit()

        cats = db.query(KnowledgeCategory).all()
        if db.query(KnowledgeArticle).count() == 0:
            kb_articles = [
                ("如何判断电脑是否进水", "常见问题",
                 "客户反馈电脑无法开机，怀疑进水。判断步骤：\n1. 检查外壳是否有水渍\n2. 观察主板是否有腐蚀痕迹\n3. 闻是否有烧焦味道\n4. 使用湿度检测卡测试",
                 "外观检查, 主板检查, 进水, 腐蚀"),
                ("屏幕更换标准流程", "维修指南",
                 "屏幕更换操作步骤：\n1. 断电并拆下电池\n2. 使用热风枪加热屏幕边框\n3. 用吸盘小心取下旧屏幕\n4. 清理边框残胶\n5. 安装新屏幕并固定\n6. 连接排线并通电测试",
                 "屏幕, 更换, 拆机, 排线"),
                ("退换货处理时效要求", "售后流程",
                 "根据公司售后政策：\n- 收到退换货申请后24小时内响应\n- 签收退货后48小时内质检\n- 质检完成后24小时内确定处理方案\n- 换货发出后及时更新快递单号",
                 "退换货, 时效, 流程, 质检"),
                ("OA系统快速上手", "系统操作",
                 "OA系统主要功能模块：\n1. 工单处理：创建、跟进、关闭工单\n2. 售后管理：退货、换货、维修登记\n3. 发货管理：发货登记、成本跟踪\n4. 仓储管理：入库、出库、库存查询\n5. 财务管理：发票管理、返现审批",
                 "OA, 上手, 教程, 功能"),
            ]
            for title, cat_name, desc, keywords in kb_articles:
                cat = next((c for c in cats if c.name == cat_name), cats[0])
                db.add(KnowledgeArticle(
                    company_id=company.id, category_id=cat.id,
                    title=title, problem_desc=desc,
                    solution_steps=json.dumps([{"step": i+1, "content": s.strip()} for i, s in enumerate(desc.split("\n"))]),
                    keywords=keywords, created_by=admin_user.id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                ))
            db.commit()

        # ── 21. 排班记录 ─────────────────────────────────────────
        if db.query(ScheduleSlot).count() == 0:
            shifts = db.query(ScheduleShift).all()
            non_admin = [u for u in users_list if u.username != "admin"]
            for u in non_admin:
                for day_offset in range(7):
                    if random.random() > 0.15:
                        shift = random.choice([s for s in shifts if not s.is_rest]) if random.random() > 0.1 else next(s for s in shifts if s.is_rest)
                        date_str = (datetime.now() - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                        existing = db.query(ScheduleSlot).filter(
                            ScheduleSlot.user_id == u.id, ScheduleSlot.date == date_str).first()
                        if not existing:
                            db.add(ScheduleSlot(
                                company_id=company.id, user_id=u.id, date=date_str,
                                shift_id=shift.id, created_by=admin_user.id,
                                created_at=datetime.now() - timedelta(days=day_offset),
                            ))
            db.commit()

        # ── 22. 考勤记录 (30天) ──────────────────────────────────
        if db.query(AttendanceRecord).count() == 0:
            non_admin = [u for u in users_list if u.username != "admin"]
            for u in non_admin:
                for day_offset in range(30):
                    if random.random() > 0.1:
                        date_str = (datetime.now() - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                        existing = db.query(AttendanceRecord).filter(
                            AttendanceRecord.user_id == u.id, AttendanceRecord.date == date_str).first()
                        if not existing:
                            base_date = datetime.now() - timedelta(days=day_offset)
                            check_in_h = random.randint(8, 9)
                            check_in_m = random.randint(0, 59)
                            check_out_h = random.randint(17, 19)
                            check_out_m = random.randint(0, 59)
                            status = "normal"
                            if check_in_h > 9 or (check_in_h == 9 and check_in_m > 0):
                                status = "late"
                            if check_out_h < 18:
                                status = "early" if status == "normal" else status
                            db.add(AttendanceRecord(
                                company_id=company.id, user_id=u.id, date=date_str,
                                check_in=base_date.replace(hour=check_in_h, minute=check_in_m),
                                check_out=base_date.replace(hour=check_out_h, minute=check_out_m),
                                status=status, source="manual",
                                scheduled_start="09:00", scheduled_end="18:00",
                                location="公司",
                                created_at=datetime.now() - timedelta(days=day_offset),
                            ))
            db.commit()

        # ── 23. 审批申请 (20条) ──────────────────────────────────
        if db.query(ApprovalRequest).count() == 0:
            for _ in range(20):
                app_type = random.choice(["leave", "reimbursement", "purchase"])
                applicant = random.choice(users_list)
                title = {
                    "leave": random.choice(["年假申请", "事假申请", "病假申请", "调休申请"]),
                    "reimbursement": random.choice(["差旅费报销", "办公用品报销", "客户招待费报销"]),
                    "purchase": random.choice(["配件采购申请", "检测设备采购", "包装材料采购"]),
                }[app_type]
                status = random.choice(["pending", "pending", "approved", "rejected"])
                ar = ApprovalRequest(
                    company_id=company.id, type=app_type, title=title,
                    description=f"{applicant.name}提交的{title}" if app_type == "leave" else "详情见附件",
                    amount=round(random.uniform(100, 5000), 2) if app_type in ("reimbursement", "purchase") else None,
                    start_date=(datetime.now() + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d"),
                    end_date=(datetime.now() + timedelta(days=random.randint(15, 20))).strftime("%Y-%m-%d") if app_type == "leave" else "",
                    status=status, applicant_id=applicant.id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 30)),
                )
                db.add(ar)
                db.flush()
                db.add(ApprovalStep(
                    company_id=company.id, request_id=ar.id, step_order=1,
                    approver_id=admin_user.id, status=status if status != "pending" else "pending",
                    comment="同意" if status == "approved" else "",
                    approved_at=datetime.now() if status != "pending" else None,
                ))
            db.commit()

        # ── 24. 客户开票申请 (25条) ───────────────────────────────
        if db.query(CustomerInvoiceRequest).count() == 0:
            for _ in range(25):
                amt = round(random.uniform(2000, 20000), 2)
                tax_rate = random.choice([0.03, 0.06, 0.13])
                db.add(CustomerInvoiceRequest(
                    company_id=company.id,
                    apply_date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d"),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    shop_name=random.choice(shop_names),
                    customer_name=random.choice(["深圳科技有限公司", "北京创新有限公司", "杭州网络科技", "上海贸易公司"]),
                    tax_id=f"91440300{random.randint(100000, 999999)}",
                    invoice_type=random.choice(["普通发票", "专用发票", "电子发票"]),
                    invoice_content=random.choice(["笔记本电脑", "电脑配件", "维修服务费"]),
                    amount=amt, tax_rate=tax_rate,
                    tax_amount=round(amt * tax_rate, 2),
                    email=f"finance{random.randint(100, 999)}@example.com",
                    status=random.choice(["pending", "processing", "issued", "mailed", "signed"]),
                    handler=random.choice(users_list).name,
                    created_by=random.choice(users_list).id,
                    created_at=datetime.now() - timedelta(days=random.randint(0, 60)),
                ))
            db.commit()

        # ── 25. 销项发票 (20条) ──────────────────────────────────
        if db.query(SalesInvoice).count() == 0:
            for _ in range(20):
                amt = round(random.uniform(2000, 15000), 2)
                tax = round(amt * 0.13, 2)
                db.add(SalesInvoice(
                    company_id=company.id,
                    invoice_date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    invoice_code=f"{random.randint(1000000000, 9999999999)}",
                    invoice_no=f"{random.randint(10000000, 99999999)}",
                    invoice_type=random.choice(["普通发票", "专用发票", "电子发票"]),
                    buyer_name=random.choice(["深圳科技有限公司", "北京创新有限公司"]),
                    buyer_tax_id=f"91440300{random.randint(100000, 999999)}",
                    invoice_content=random.choice(["笔记本电脑", "电脑配件"]),
                    amount=amt, tax_rate=0.13, tax_amount=tax,
                    total_amount=round(amt + tax, 2),
                    order_no=f"DD{datetime.now().strftime('%Y%m%d')}{random.randint(1000, 9999)}",
                    shop_name=random.choice(shop_names),
                    handler=random.choice(users_list).name,
                    created_by=random.choice(users_list).id,
                ))
            db.commit()

        # ── 26. 进项发票 (15条) ──────────────────────────────────
        if db.query(PurchaseInvoice).count() == 0:
            for _ in range(15):
                amt = round(random.uniform(5000, 50000), 2)
                tax = round(amt * 0.13, 2)
                db.add(PurchaseInvoice(
                    company_id=company.id,
                    receive_date=(datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
                    invoice_date=(datetime.now() - timedelta(days=random.randint(0, 120))).strftime("%Y-%m-%d"),
                    invoice_code=f"{random.randint(1000000000, 9999999999)}",
                    invoice_no=f"{random.randint(10000000, 99999999)}",
                    invoice_type="专用发票",
                    seller_name=random.choice(["联想集团", "华为技术", "京东供应链", "顺丰速运"]),
                    seller_tax_id=f"91110108{random.randint(100000, 999999)}",
                    invoice_content=random.choice(["笔记本电脑", "电脑配件", "物流服务", "办公用品"]),
                    amount=amt, tax_rate=0.13, tax_amount=tax,
                    total_amount=round(amt + tax, 2),
                    is_certified=random.random() > 0.3,
                    certified_date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d") if random.random() > 0.5 else "",
                    related_contract=f"HT-{datetime.now().strftime('%Y')}-{random.randint(100, 999)}",
                    receiver=random.choice(users_list).name,
                    created_by=random.choice(users_list).id,
                ))
            db.commit()

        # ── 27. 费用报销发票 (20条) ───────────────────────────────
        if db.query(ExpenseInvoice).count() == 0:
            for _ in range(20):
                amt = round(random.uniform(50, 3000), 2)
                tax = round(amt * 0.03, 2)
                db.add(ExpenseInvoice(
                    company_id=company.id,
                    invoice_no=f"{random.randint(10000000, 99999999)}",
                    invoice_date=(datetime.now() - timedelta(days=random.randint(0, 60))).strftime("%Y-%m-%d"),
                    invoice_type=random.choice(["普通发票", "电子发票"]),
                    seller_name=random.choice(["顺丰速运", "京东物流", "瑞幸咖啡", "如家酒店", "中国石化"]),
                    summary=random.choice(["快递费", "差旅住宿", "客户招待", "加油费", "高速通行费"]),
                    amount=amt, tax_rate=0.03, tax_amount=tax,
                    reimbursement_amount=round(amt + tax, 2),
                    reimbursement_date=(datetime.now() - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d"),
                    reimburser=random.choice(users_list).name,
                    department=random.choice(dept_names),
                    is_paid=random.random() > 0.4,
                    created_by=random.choice(users_list).id,
                ))
            db.commit()

        # ── 28. Field Options ─────────────────────────────────────
        if db.query(FieldOption).count() == 0:
            field_data = {
                "model": ["ThinkPad X1 Carbon", "MacBook Pro 14", "MateBook X Pro", "Yoga Pro 14s", "XPS 15", "暗影精灵9"],
                "config": ["i5-13500H/16G/512G", "i7-13700H/32G/1TB", "R7-7840H/16G/512G", "i9-13900H/32G/2TB", "M2 Pro/16G/512G"],
                "color": ["深空灰", "银色", "星空黑", "云杉绿", "皓月银"],
                "size": ["13.3寸", "14寸", "14.5寸", "15.6寸", "16寸"],
                "accessories": ["鼠标", "键盘", "电脑包", "贴膜", "扩展坞", "散热支架"],
            }
            color_codes = {"深空灰": "#4A4A4A", "银色": "#C0C0C0", "星空黑": "#1A1A2E", "云杉绿": "#2D5A27", "皓月银": "#E8E8E8"}
            for field_name, options in field_data.items():
                for value in options:
                    db.add(FieldOption(
                        company_id=company.id, field_name=field_name, value=value,
                        price=round(random.uniform(10, 200), 2) if field_name == "accessories" else 0,
                        color_code=color_codes.get(value, "") if field_name == "color" else "",
                    ))
            db.commit()

        # ── 统计输出 ────────────────────────────────────────────
        counts = {
            "用户": db.query(User).count(),
            "部门": db.query(Department).count(),
            "店铺": db.query(Shop).count(),
            "工单": db.query(Ticket).count(),
            "工单反馈": db.query(TicketFeedback).count(),
            "发货登记": db.query(GiftRecord).count(),
            "返现登记": db.query(GiftCashback).count(),
            "礼品补发": db.query(GiftResendRecord).count(),
            "退换登记": db.query(ReturnExchangeRecord).count(),
            "维修登记": db.query(RepairRecord).count(),
            "仓库产品": db.query(WarehouseProduct).count(),
            "入库记录": db.query(WarehouseInbound).count(),
            "出库记录": db.query(WarehouseOutbound).count(),
            "返厂出库": db.query(WarehouseReturnToFactory).count(),
            "产品目录": db.query(Product).count(),
            "公告": db.query(Announcement).count(),
            "内部消息": db.query(Message).count(),
            "任务看板": db.query(TaskBoard).count(),
            "知识库分类": db.query(KnowledgeCategory).count(),
            "知识库文章": db.query(KnowledgeArticle).count(),
            "排班记录": db.query(ScheduleSlot).count(),
            "考勤记录": db.query(AttendanceRecord).count(),
            "审批申请": db.query(ApprovalRequest).count(),
            "客户开票": db.query(CustomerInvoiceRequest).count(),
            "销项发票": db.query(SalesInvoice).count(),
            "进项发票": db.query(PurchaseInvoice).count(),
            "费用报销": db.query(ExpenseInvoice).count(),
            "字段选项": db.query(FieldOption).count(),
        }
        print(f"\n{'='*55}")
        print("  随机测试数据填充完成！")
        print(f"{'='*55}")
        for k, v in counts.items():
            print(f"  {k}: {v}")
        print(f"{'='*55}")
        print(f"  管理员: admin@weiji.local / admin")
        print(f"  其他账号: zhangsan~wushi / 123456")
        print(f"{'='*55}\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
