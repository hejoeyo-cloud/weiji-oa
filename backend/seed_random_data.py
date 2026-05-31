"""随机数据填充脚本 - 用于压力测试"""
import random
import sys
from datetime import datetime, timedelta
from database import SessionLocal, User, Department, Role, Company
from database import Ticket, Announcement, ApprovalRequest, ApprovalStep
from database import GiftRecord, GiftCashback, GiftResendRecord
from database import ReturnExchangeRecord, RepairRecord
from database import TaskBoard, ScheduleShift, ScheduleSlot
from database import Message, Notification
from database import CustomerInvoiceRequest, SalesInvoice, PurchaseInvoice, ExpenseInvoice
from database import WarehouseProduct, WarehouseInbound, WarehouseOutbound

db = SessionLocal()

# 获取管理员所属公司（确保数据与admin在同一公司）
admin = db.query(User).filter(User.username == "admin").first()
if not admin:
    print("错误: 未找到管理员用户")
    sys.exit(1)

company = db.query(Company).filter(Company.id == admin.company_id).first()
if not company:
    company = db.query(Company).first()
if not company:
    print("错误: 未找到公司")
    sys.exit(1)

company_id = company.id
admin_id = admin.id if admin else 1

# ==================== 创建部门 ====================
print("创建部门...")
departments = []
dept_names = ["技术部", "客服部", "销售部", "仓储部", "财务部", "人事部", "市场部", "运营部"]
for name in dept_names:
    dept = db.query(Department).filter(Department.name == name).first()
    if not dept:
        dept = Department(company_id=company_id, name=name)
        db.add(dept)
        db.flush()
    departments.append(dept)
db.commit()
print(f"  已有 {len(departments)} 个部门")

# ==================== 创建用户 ====================
print("创建用户...")
from auth import get_password_hash
last_names = ["张", "李", "王", "赵", "刘", "陈", "杨", "黄", "周", "吴"]
first_names = ["伟", "芳", "娜", "敏", "静", "强", "磊", "洋", "勇", "军", "杰", "涛", "明", "超", "秀英", "丽", "艳", "华", "玲", "桂英"]

roles = db.query(Role).filter(Role.company_id == company_id).all()
role_map = {r.name: r.id for r in roles}

users_created = 0
for i in range(50):
    username = f"user_{i+1:03d}"
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        continue
    name = random.choice(last_names) + random.choice(first_names)
    dept = random.choice(departments)
    role_name = random.choice(["technician", "customer"])
    user = User(
        company_id=company_id,
        username=username,
        password_hash=get_password_hash("123456"),
        name=name,
        email=f"{username}@test.local",
        role=role_name,
        role_id=role_map.get(role_name),
        department_id=dept.id if dept else None,
    )
    db.add(user)
    users_created += 1
db.commit()
print(f"  创建了 {users_created} 个用户")

# 获取所有用户
all_users = db.query(User).filter(User.company_id == company_id).all()
user_ids = [u.id for u in all_users]

# ==================== 创建工单 ====================
print("创建工单...")
ticket_titles = [
    "电脑无法开机", "打印机卡纸", "网络连接问题", "软件安装请求", "密码重置",
    "系统运行缓慢", "蓝屏死机", "外接显示器无信号", "键盘失灵", "鼠标不灵敏",
    "邮件无法发送", "VPN连接失败", "文件共享权限", "系统更新失败", "驱动程序问题",
    "USB接口故障", "音频设备问题", "摄像头无法使用", "触摸板失灵", "电池续航短",
]
ticket_statuses = ["pending", "processing", "resolved", "closed"]
ticket_priorities = ["low", "normal", "high", "urgent"]

tickets_created = 0
for i in range(200):
    title = random.choice(ticket_titles) + f" #{i+1}"
    status = random.choice(ticket_statuses)
    priority = random.choice(ticket_priorities)
    creator = random.choice(all_users)
    assignee = random.choice(all_users)
    created_at = datetime.now() - timedelta(days=random.randint(0, 90))

    ticket = Ticket(
        company_id=company_id,
        platform=random.choice(["微信", "QQ", "电话", "邮件", ""]),
        customer_id=f"C{random.randint(1000, 9999)}",
        description=f"{title}\n\n这是工单 #{i+1} 的详细描述。问题发生在{random.choice(['办公室', '会议室', '仓库', '前台'])}。",
        remote_tool=random.choice(["netease", "todesk", "anydesk", ""]),
        remote_code=f"{random.randint(100000, 999999)}" if random.random() > 0.5 else "",
        priority=priority,
        status=status,
        diagnosis_result=random.choice(["硬件故障", "软件问题", "网络问题", "操作失误", ""]),
        created_by=creator.id,
        assigned_to=assignee.id if status != "pending" else None,
        created_at=created_at,
        updated_at=created_at + timedelta(hours=random.randint(0, 48)),
        completed_at=created_at + timedelta(hours=random.randint(1, 72)) if status in ["resolved", "closed"] else None,
    )
    db.add(ticket)
    tickets_created += 1
db.commit()
print(f"  创建了 {tickets_created} 个工单")

# ==================== 创建发货登记 ====================
print("创建发货登记...")
gift_created = 0
for i in range(150):
    created_at = datetime.now() - timedelta(days=random.randint(0, 60))
    record = GiftRecord(
        company_id=company_id,
        date=created_at.strftime("%Y-%m-%d"),
        order_no=f"ORD{random.randint(100000, 999999)}",
        size=random.choice(["13寸", "14寸", "15寸", "16寸"]),
        model=random.choice(["型号A", "型号B", "型号C", "型号D", "型号E"]),
        config=random.choice(["基础版", "标准版", "高配版", "旗舰版"]),
        color=random.choice(["银色", "灰色", "黑色", "白色"]),
        quantity=random.randint(1, 5),
        accessories=random.choice(["充电器", "充电器+鼠标", "充电器+鼠标+包", "无"]),
        customer_info=f"客户{random.choice(last_names)}{random.choice(first_names)}",
        send_tracking=f"SF{random.randint(1000000000, 9999999999)}",
        shipping_fee=round(random.uniform(10, 50), 2),
        order_amount=round(random.uniform(1000, 10000), 2),
        cost=round(random.uniform(500, 8000), 2),
        remark="" if random.random() > 0.3 else f"备注信息{i}",
        ship_date=created_at.strftime("%Y-%m-%d"),
        status=random.choice(["pending", "shipped", "delivered"]),
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    gift_created += 1
db.commit()
print(f"  创建了 {gift_created} 条发货记录")

# ==================== 创建返现登记 ====================
print("创建返现登记...")
cashback_created = 0
for i in range(80):
    created_at = datetime.now() - timedelta(days=random.randint(0, 30))
    record = GiftCashback(
        company_id=company_id,
        order_no=f"ORD{random.randint(100000, 999999)}",
        cashback_amount=round(random.uniform(10, 500), 2),
        reason=random.choice(["好评返现", "活动返现", "补偿返现", "推广返现"]),
        remark="",
        applicant=f"客户{random.choice(last_names)}",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    cashback_created += 1
db.commit()
print(f"  创建了 {cashback_created} 条返现记录")

# ==================== 创建礼品补发 ====================
print("创建礼品补发...")
resend_created = 0
for i in range(60):
    created_at = datetime.now() - timedelta(days=random.randint(0, 45))
    record = GiftResendRecord(
        company_id=company_id,
        shop_name=random.choice(["天猫旗舰店", "京东自营", "拼多多", "淘宝店"]),
        type=random.choice(["补发", "换货", "重发"]),
        gift_detail=random.choice(["鼠标", "键盘", "耳机", "充电器", "背包"]),
        express_company=random.choice(["顺丰", "圆通", "中通", "韵达", "申通"]),
        tracking_no=f"YT{random.randint(1000000000, 9999999999)}",
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    resend_created += 1
db.commit()
print(f"  创建了 {resend_created} 条补发记录")

# ==================== 创建退换登记 ====================
print("创建退换登记...")
return_created = 0
for i in range(100):
    created_at = datetime.now() - timedelta(days=random.randint(0, 60))
    record = ReturnExchangeRecord(
        company_id=company_id,
        apply_date=created_at.strftime("%Y-%m-%d"),
        order_no=f"ORD{random.randint(100000, 999999)}",
        return_reason=random.choice(["质量问题", "尺寸不合适", "颜色不喜欢", "与描述不符", "其他"]),
        model=random.choice(["型号A", "型号B", "型号C", "型号D"]),
        config=random.choice(["基础版", "标准版", "高配版"]),
        size=random.choice(["13寸", "14寸", "15寸"]),
        computer_price=round(random.uniform(3000, 8000), 2),
        quantity=random.randint(1, 3),
        accessories=random.choice(["充电器", "充电器+鼠标", "无"]),
        accessories_price=round(random.uniform(0, 500), 2),
        customer_info=f"客户{random.choice(last_names)}{random.choice(first_names)}, 138{random.randint(10000000, 99999999)}",
        return_tracking=f"SF{random.randint(1000000000, 9999999999)}",
        send_tracking=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.3 else "",
        handle_result=random.choice(["已退款", "已换货", "处理中", ""]),
        progress=random.choice(["pending", "processing", "completed"]),
        shipping_fee=round(random.uniform(10, 50), 2),
        remark="",
        record_type=random.choice(["return", "exchange"]),
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    return_created += 1
db.commit()
print(f"  创建了 {return_created} 条退换记录")

# ==================== 创建维修登记 ====================
print("创建维修登记...")
repair_created = 0
for i in range(120):
    created_at = datetime.now() - timedelta(days=random.randint(0, 90))
    charge_required = random.random() > 0.6
    record = RepairRecord(
        company_id=company_id,
        apply_date=created_at.strftime("%Y-%m-%d"),
        order_no=f"ORD{random.randint(100000, 999999)}",
        return_reason=random.choice(["屏幕碎裂", "主板故障", "电池鼓包", "键盘失灵", "散热问题", "系统崩溃"]),
        model=random.choice(["型号A", "型号B", "型号C", "型号D", "型号E"]),
        config=random.choice(["基础版", "标准版", "高配版", "旗舰版"]),
        quantity=1,
        accessories=random.choice(["充电器", "充电器+鼠标", "无"]),
        customer_info=f"客户{random.choice(last_names)}{random.choice(first_names)}, 138{random.randint(10000000, 99999999)}",
        return_tracking=f"SF{random.randint(1000000000, 9999999999)}",
        send_tracking=f"SF{random.randint(1000000000, 9999999999)}" if random.random() > 0.3 else "",
        handle_result=random.choice(["已修复", "换新", "处理中", ""]),
        repair_status=random.choice(["pending_repair", "processing_repair", "completed_repair"]),
        charge_required=charge_required,
        charge_status="paid" if charge_required and random.random() > 0.5 else ("pending_charge" if charge_required else "none"),
        current_expected_amount=round(random.uniform(100, 2000), 2) if charge_required else 0,
        current_paid_amount=round(random.uniform(100, 2000), 2) if charge_required and random.random() > 0.5 else 0,
        shipping_fee=round(random.uniform(10, 80), 2),
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    repair_created += 1
db.commit()
print(f"  创建了 {repair_created} 条维修记录")

# ==================== 创建公告 ====================
print("创建公告...")
ann_created = 0
ann_titles = [
    "关于公司年会的通知", "系统维护公告", "新员工入职须知", "节假日放假通知",
    "办公区域调整通知", "培训课程安排", "绩效考核通知", "团建活动通知",
    "安全注意事项", "IT系统升级通知",
]
for i in range(30):
    created_at = datetime.now() - timedelta(days=random.randint(0, 60))
    ann = Announcement(
        company_id=company_id,
        title=f"{random.choice(ann_titles)} #{i+1}",
        content=f"这是公告 #{i+1} 的详细内容。请各位同事注意查看。\n\n发布时间：{created_at.strftime('%Y-%m-%d')}",
        is_pinned=random.random() > 0.8,
        is_active=True,
        target_departments="",
        created_by=admin_id,
        created_at=created_at,
    )
    db.add(ann)
    ann_created += 1
db.commit()
print(f"  创建了 {ann_created} 条公告")

# ==================== 创建任务 ====================
print("创建任务...")
task_created = 0
task_titles = [
    "完成项目文档", "修复登录bug", "优化数据库查询", "设计新界面", "编写测试用例",
    "部署新版本", "更新用户手册", "处理客户反馈", "代码审查", "性能测试",
]
for i in range(80):
    created_at = datetime.now() - timedelta(days=random.randint(0, 30))
    task = TaskBoard(
        company_id=company_id,
        title=f"{random.choice(task_titles)} #{i+1}",
        description=f"任务 #{i+1} 的详细描述",
        status=random.choice(["todo", "in_progress", "done"]),
        priority=random.choice(["low", "normal", "high", "urgent"]),
        assignee_id=random.choice(user_ids),
        due_date=(datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
        sort_order=i,
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(task)
    task_created += 1
db.commit()
print(f"  创建了 {task_created} 个任务")

# ==================== 创建消息 ====================
print("创建消息...")
msg_created = 0
msg_subjects = [
    "会议通知", "项目进度更新", "请审批", "工作交接", "问题反馈",
    "需求确认", "排期安排", "文档共享", "技术讨论", "日常沟通",
]
for i in range(200):
    created_at = datetime.now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
    sender = random.choice(all_users)
    recipient = random.choice(all_users)
    if sender.id == recipient.id:
        continue
    msg = Message(
        company_id=company_id,
        sender_id=sender.id,
        recipient_id=recipient.id,
        subject=f"{random.choice(msg_subjects)} #{i+1}",
        content=f"这是消息 #{i+1} 的内容。请查收。",
        is_read=random.random() > 0.4,
        is_draft=False,
        is_starred=random.random() > 0.8,
        created_at=created_at,
    )
    db.add(msg)
    msg_created += 1
db.commit()
print(f"  创建了 {msg_created} 条消息")

# ==================== 创建通知 ====================
print("创建通知...")
notif_created = 0
notif_types = ["ticket", "approval", "announcement", "message"]
for i in range(300):
    created_at = datetime.now() - timedelta(days=random.randint(0, 15), hours=random.randint(0, 23))
    notif = Notification(
        company_id=company_id,
        user_id=random.choice(user_ids),
        title=f"{random.choice(['工单更新', '审批通知', '新公告', '新消息'])} #{i+1}",
        content=f"您有一条新的通知，请及时查看。",
        is_read=random.random() > 0.5,
        resource_type=random.choice(notif_types),
        resource_id=random.randint(1, 100),
        created_at=created_at,
    )
    db.add(notif)
    notif_created += 1
db.commit()
print(f"  创建了 {notif_created} 条通知")

# ==================== 创建货品数据 ====================
print("创建货品数据...")
product_created = 0
product_categories = ["笔记本电脑", "台式机", "显示器", "键盘鼠标", "网络设备", "存储设备", "配件"]
product_names = {
    "笔记本电脑": ["ThinkPad X1", "MacBook Pro", "Dell XPS", "HP EliteBook", "华为MateBook"],
    "台式机": ["联想启天", "Dell OptiPlex", "HP ProDesk", "华硕商用"],
    "显示器": ["Dell U2723QE", "LG 27UK850", "AOC U2790VQ", "三星S80A"],
    "键盘鼠标": ["罗技MX Keys", "罗技MX Master", "雷蛇黑寡妇", "樱桃MX Board"],
    "网络设备": ["华为S5720", "H3C S5130", "TP-Link TL-SG", "锐捷RG-S"],
    "存储设备": ["三星970 EVO", "西数SN750", "希捷酷鱼", "金士顿NV1"],
    "配件": ["USB-C扩展坞", "电源适配器", "笔记本支架", "散热底座", "屏幕挂灯"],
}
products = []
for i in range(40):
    category = random.choice(product_categories)
    name = random.choice(product_names[category])
    code = f"SKU{random.randint(10000, 99999)}"
    existing = db.query(WarehouseProduct).filter(WarehouseProduct.code == code).first()
    if existing:
        products.append(existing)
        continue
    product = WarehouseProduct(
        company_id=company_id,
        code=code,
        category=category,
        name=f"{name} {chr(65 + random.randint(0, 5))}",
        spec=random.choice(["标准版", "高配版", "旗舰版", "基础版"]),
        location=f"{random.choice(['A', 'B', 'C'])}-{random.randint(1, 5)}-{random.randint(1, 10)}",
        initial_qty=random.randint(10, 200),
        unit=random.choice(["台", "个", "套", "件"]),
        created_by=admin_id,
        created_at=datetime.now() - timedelta(days=random.randint(30, 90)),
    )
    db.add(product)
    db.flush()
    products.append(product)
    product_created += 1
db.commit()
print(f"  创建了 {product_created} 个货品")

# ==================== 创建入库记录 ====================
print("创建入库记录...")
inbound_created = 0
for i in range(100):
    product = random.choice(products)
    created_at = datetime.now() - timedelta(days=random.randint(0, 60))
    record = WarehouseInbound(
        company_id=company_id,
        date=created_at.strftime("%Y-%m-%d"),
        product_id=product.id,
        product_code=product.code,
        category=product.category,
        product_name=product.name,
        spec=product.spec,
        location=product.location,
        quantity=random.randint(1, 50),
        operator=random.choice(["张伟", "李芳", "王强", "赵敏", "刘洋"]),
        remark="" if random.random() > 0.3 else f"入库备注{i}",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    inbound_created += 1
db.commit()
print(f"  创建了 {inbound_created} 条入库记录")

# ==================== 创建出库记录 ====================
print("创建出库记录...")
outbound_created = 0
for i in range(80):
    product = random.choice(products)
    created_at = datetime.now() - timedelta(days=random.randint(0, 45))
    record = WarehouseOutbound(
        company_id=company_id,
        date=created_at.strftime("%Y-%m-%d"),
        product_id=product.id,
        product_code=product.code,
        category=product.category,
        product_name=product.name,
        spec=product.spec,
        location=product.location,
        quantity=random.randint(1, 20),
        operator=random.choice(["张伟", "李芳", "王强", "赵敏", "刘洋"]),
        remark="" if random.random() > 0.3 else f"出库备注{i}",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    outbound_created += 1
db.commit()
print(f"  创建了 {outbound_created} 条出库记录")

# ==================== 创建销项发票 ====================
print("创建销项发票...")
sales_invoice_created = 0
invoice_contents = ["电脑设备", "办公耗材", "技术服务费", "维修配件", "网络设备"]
for i in range(60):
    created_at = datetime.now() - timedelta(days=random.randint(0, 90))
    amount = round(random.uniform(1000, 50000), 2)
    tax_rate = random.choice([0.03, 0.06, 0.13])
    tax_amount = round(amount * tax_rate, 2)
    record = SalesInvoice(
        company_id=company_id,
        invoice_date=created_at.strftime("%Y-%m-%d"),
        invoice_code=f"{random.randint(1000000000, 9999999999)}",
        invoice_no=f"INV{random.randint(10000000, 99999999)}",
        invoice_type=random.choice(["普通发票", "专用发票", "电子发票"]),
        buyer_name=f"客户{random.choice(last_names)}{random.choice(first_names)}",
        buyer_tax_id=f"91{random.randint(1000000000, 9999999999)}" if random.random() > 0.3 else "",
        invoice_content=random.choice(invoice_contents),
        amount=amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=round(amount + tax_amount, 2),
        order_no=f"ORD{random.randint(100000, 999999)}",
        shop_name=random.choice(["天猫旗舰店", "京东自营", "拼多多", "线下门店"]),
        handler=random.choice(["张会计", "李出纳", "王财务"]),
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    sales_invoice_created += 1
db.commit()
print(f"  创建了 {sales_invoice_created} 条销项发票")

# ==================== 创建进项发票 ====================
print("创建进项发票...")
purchase_invoice_created = 0
seller_names = ["联想集团", "华为技术", "戴尔科技", "惠普公司", "三星电子", "英特尔", "英伟达"]
for i in range(50):
    created_at = datetime.now() - timedelta(days=random.randint(0, 90))
    amount = round(random.uniform(500, 30000), 2)
    tax_rate = random.choice([0.13, 0.09, 0.06])
    tax_amount = round(amount * tax_rate, 2)
    is_certified = random.random() > 0.3
    record = PurchaseInvoice(
        company_id=company_id,
        receive_date=(created_at + timedelta(days=random.randint(1, 7))).strftime("%Y-%m-%d"),
        invoice_date=created_at.strftime("%Y-%m-%d"),
        invoice_code=f"{random.randint(1000000000, 9999999999)}",
        invoice_no=f"INV{random.randint(10000000, 99999999)}",
        invoice_type=random.choice(["普通发票", "专用发票"]),
        seller_name=random.choice(seller_names),
        seller_tax_id=f"91{random.randint(1000000000, 9999999999)}",
        invoice_content=random.choice(invoice_contents),
        amount=amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total_amount=round(amount + tax_amount, 2),
        is_certified=is_certified,
        certified_date=(created_at + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d") if is_certified else "",
        certification_result="success" if is_certified else random.choice(["fail", "in-progress"]),
        due_date=(created_at + timedelta(days=180)).strftime("%Y-%m-%d"),
        related_contract=f"HT{random.randint(1000, 9999)}" if random.random() > 0.5 else "",
        receiver=random.choice(["张采购", "李经理", "王主管"]),
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    purchase_invoice_created += 1
db.commit()
print(f"  创建了 {purchase_invoice_created} 条进项发票")

# ==================== 创建费用发票 ====================
print("创建费用发票...")
expense_invoice_created = 0
summaries = ["差旅费", "办公用品", "招待费", "交通费", "通讯费", "培训费", "维修费"]
for i in range(70):
    created_at = datetime.now() - timedelta(days=random.randint(0, 60))
    amount = round(random.uniform(100, 5000), 2)
    tax_rate = 0.03
    tax_amount = round(amount * tax_rate, 2)
    record = ExpenseInvoice(
        company_id=company_id,
        invoice_no=f"INV{random.randint(10000000, 99999999)}",
        invoice_date=created_at.strftime("%Y-%m-%d"),
        invoice_type=random.choice(["普通发票", "电子发票"]),
        seller_name=random.choice(["加油站", "酒店", "航空公司", "办公用品店", "餐厅", "出租车公司"]),
        summary=random.choice(summaries),
        amount=amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        reimbursement_amount=round(amount + tax_amount, 2),
        reimbursement_date=(created_at + timedelta(days=random.randint(1, 15))).strftime("%Y-%m-%d"),
        reimburser=random.choice(["张伟", "李芳", "王强", "赵敏", "刘洋", "陈明"]),
        department=random.choice(["技术部", "销售部", "客服部", "市场部", "运营部"]),
        is_paid=random.random() > 0.3,
        is_duplicate=False,
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    expense_invoice_created += 1
db.commit()
print(f"  创建了 {expense_invoice_created} 条费用发票")

# ==================== 创建客户开票申请 ====================
print("创建客户开票申请...")
customer_invoice_created = 0
for i in range(40):
    created_at = datetime.now() - timedelta(days=random.randint(0, 30))
    amount = round(random.uniform(500, 20000), 2)
    record = CustomerInvoiceRequest(
        company_id=company_id,
        apply_date=created_at.strftime("%Y-%m-%d"),
        order_no=f"ORD{random.randint(100000, 999999)}",
        shop_name=random.choice(["天猫旗舰店", "京东自营", "拼多多", "淘宝店"]),
        customer_name=f"客户{random.choice(last_names)}{random.choice(first_names)}",
        tax_id=f"91{random.randint(1000000000, 9999999999)}" if random.random() > 0.3 else "",
        invoice_type=random.choice(["普通发票", "专用发票", "电子发票"]),
        invoice_content=random.choice(invoice_contents),
        amount=amount,
        tax_rate=0.03,
        tax_amount=round(amount * 0.03, 2),
        email=f"customer{random.randint(100, 999)}@test.com" if random.random() > 0.5 else "",
        mail_address=f"北京市朝阳区{random.randint(1, 100)}号" if random.random() > 0.5 else "",
        status=random.choice(["pending", "processing", "issued", "mailed", "signed"]),
        handler=random.choice(["张会计", "李出纳", "王财务"]),
        remark="",
        created_by=random.choice(user_ids),
        created_at=created_at,
    )
    db.add(record)
    customer_invoice_created += 1
db.commit()
print(f"  创建了 {customer_invoice_created} 条客户开票申请")

db.close()

print("\n" + "=" * 50)
print("随机数据填充完成！")
print("=" * 50)
print(f"  用户: {users_created}")
print(f"  工单: {tickets_created}")
print(f"  发货: {gift_created}")
print(f"  返现: {cashback_created}")
print(f"  补发: {resend_created}")
print(f"  退换: {return_created}")
print(f"  维修: {repair_created}")
print(f"  公告: {ann_created}")
print(f"  任务: {task_created}")
print(f"  消息: {msg_created}")
print(f"  通知: {notif_created}")
print(f"  货品: {product_created}")
print(f"  入库: {inbound_created}")
print(f"  出库: {outbound_created}")
print(f"  销项发票: {sales_invoice_created}")
print(f"  进项发票: {purchase_invoice_created}")
print(f"  费用发票: {expense_invoice_created}")
print(f"  客户开票: {customer_invoice_created}")
print("=" * 50)
