import json as _json
from database import (
    SessionLocal, TroubleshootCategory, TroubleshootStep,
    KnowledgeCategory, KnowledgeArticle, User, init_db
)


def seed_troubleshoot():
    db = SessionLocal()
    try:
        if db.query(TroubleshootCategory).count() > 0:
            return

        categories_data = [
            ("无法开机", "power", 0),
            ("蓝屏故障", "bsod", 1),
            ("网络问题", "wifi", 2),
            ("系统卡顿", "slow", 3),
            ("驱动问题", "driver", 4),
            ("显示异常", "display", 5),
            ("音频问题", "audio", 6),
            ("外设问题", "usb", 7),
        ]

        cat_map = {}
        for name, icon, order in categories_data:
            cat = TroubleshootCategory(name=name, icon=icon, sort_order=order)
            db.add(cat)
            db.flush()
            cat_map[name] = cat.id

        steps_data = {
            "无法开机": [
                {
                    "title": "按电源键无任何反应",
                    "instruction": "请按住电源键至少3秒，观察电脑是否有任何指示灯亮起、风扇转动或屏幕闪烁。",
                    "children": [
                        {
                            "title": "指示灯亮但屏幕黑",
                            "instruction": "电脑有电源指示，但屏幕完全没有显示。请尝试连接外接显示器确认是否为屏幕问题。",
                            "children": [
                                {
                                    "title": "外接显示器有画面",
                                    "instruction": "外接显示器可以显示画面，说明笔记本屏幕或排线存在问题。",
                                    "is_hardware": True,
                                    "solution": "笔记本屏幕或屏幕排线损坏，需要寄回售后部更换屏幕组件。",
                                },
                                {
                                    "title": "外接显示器也无画面",
                                    "instruction": "外接显示器同样无画面，尝试按以下步骤排查：1) 长按电源键15秒强制关机，等待30秒后重新开机 2) 开机时反复按F2或Del进入BIOS",
                                    "children": [
                                        {
                                            "title": "能进入BIOS",
                                            "instruction": "可以进入BIOS界面，说明硬件基本正常，问题可能在操作系统层面。",
                                            "children": [
                                                {
                                                    "title": "安全模式可进入",
                                                    "instruction": "重启电脑，在开机时反复按F8进入高级启动选项，选择「安全模式」。",
                                                    "solution": "能进入安全模式说明是驱动或软件冲突导致无法正常启动。建议在安全模式下卸载最近安装的驱动或软件，或使用系统还原。",
                                                },
                                                {
                                                    "title": "安全模式也无法进入",
                                                    "instruction": "安全模式也无法进入，可能需要重装系统。",
                                                    "solution": "建议使用U盘启动盘重装操作系统。如果客户有重要数据，先引导进入PE系统备份后再重装。",
                                                },
                                            ],
                                        },
                                        {
                                            "title": "无法进入BIOS",
                                            "instruction": "无法进入BIOS，可能存在主板或内存硬件故障。",
                                            "is_hardware": True,
                                            "solution": "无法进入BIOS通常表示主板或内存存在硬件故障，需要寄回售后部检测维修。",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            "title": "指示灯完全不亮",
                            "instruction": "电脑完全没有任何反应，指示灯不亮、风扇不转。请确认：1) 电源适配器已正确连接 2) 墙壁插座有电 3) 尝试更换电源适配器",
                            "children": [
                                {
                                    "title": "更换适配器后可以开机",
                                    "instruction": "更换电源适配器后电脑可以正常开机。",
                                    "is_hardware": True,
                                    "solution": "原电源适配器损坏，需要更换电源适配器。建议使用原装或同规格适配器。",
                                },
                                {
                                    "title": "更换适配器仍无法开机",
                                    "instruction": "更换适配器后仍然无法开机。",
                                    "is_hardware": True,
                                    "solution": "主板或电源接口可能存在故障，需要寄回售后部检测维修。",
                                },
                            ],
                        },
                    ],
                },
                {
                    "title": "能开机但反复自动重启",
                    "instruction": "电脑可以开机，但会在启动过程中反复重启。请尝试进入安全模式确认是否可以稳定运行。",
                    "children": [
                        {
                            "title": "安全模式稳定运行",
                            "instruction": "在安全模式下电脑不会自动重启，说明是驱动或软件问题。",
                            "solution": "在安全模式下卸载最近更新的显卡驱动，或在「系统属性→高级→启动和故障恢复」中关闭自动重启，查看蓝屏错误代码进一步排查。",
                        },
                        {
                            "title": "安全模式也自动重启",
                            "instruction": "安全模式下也会自动重启，可能是散热或硬件问题。",
                            "children": [
                                {
                                    "title": "电脑底部非常烫",
                                    "instruction": "触摸电脑底部和散热口区域，感觉明显过热。",
                                    "is_hardware": True,
                                    "solution": "散热系统故障（风扇损坏或散热硅脂干涸），需要寄回售后部清理散热并重新涂抹硅脂。",
                                },
                                {
                                    "title": "温度正常也重启",
                                    "instruction": "电脑温度正常但仍然反复重启。",
                                    "is_hardware": True,
                                    "solution": "可能是内存条或主板故障，需要寄回售后部使用专业设备检测。",
                                },
                            ],
                        },
                    ],
                },
            ],
            "蓝屏故障": [
                {
                    "title": "蓝屏后可以正常重启",
                    "instruction": "电脑出现蓝屏后，可以正常重启使用，但可能会再次蓝屏。请查看蓝屏错误代码（通常显示在屏幕下方，如：IRQL_NOT_LESS_OR_EQUAL）。",
                    "children": [
                        {
                            "title": "错误代码与驱动相关",
                            "instruction": "错误代码提示与驱动程序有关，如 DRIVER_IRQL_NOT_LESS_OR_EQUAL、VIDEO_TDR_FAILURE 等。",
                            "solution": "1) 使用「蓝屏查看器」分析dump文件确定具体驱动\n2) 到设备管理器更新或回滚对应驱动\n3) 如为显卡驱动，建议到官网下载对应型号的稳定版驱动重新安装",
                        },
                        {
                            "title": "错误代码与内存相关",
                            "instruction": "错误代码提示内存问题，如 MEMORY_MANAGEMENT、BAD_POOL_HEADER 等。",
                            "solution": "1) 按Win+R输入mdsched.exe运行Windows内存诊断\n2) 如果诊断发现内存问题，可能是内存条故障\n3) 也可能是软件引起的内存冲突，先尝试在安全模式下使用观察",
                        },
                        {
                            "title": "不确定错误代码",
                            "instruction": "无法确定具体的错误代码含义。",
                            "solution": "1) 按 Win+R 输入 eventvwr.msc 打开事件查看器\n2) 在「Windows日志→系统」中查找红色错误事件\n3) 查看最近安装的软件和驱动更新\n4) 尝试使用系统还原点到最近的正常时间点",
                        },
                    ],
                },
                {
                    "title": "蓝屏后无法启动系统",
                    "instruction": "蓝屏后电脑无法正常进入Windows，可能进入自动修复循环。",
                    "children": [
                        {
                            "title": "自动修复可以修复",
                            "instruction": "Windows自动修复成功，可以正常进入系统。",
                            "solution": "进入系统后立即备份重要数据，然后检查最近的系统更新和驱动变更，建议运行sfc /scannow修复系统文件。",
                        },
                        {
                            "title": "自动修复无法修复",
                            "instruction": "Windows自动修复失败，仍然无法进入系统。",
                            "solution": "1) 尝试进入安全模式\n2) 使用系统还原恢复到正常时间点\n3) 如果以上都失败，建议使用U盘启动盘重装系统\n4) 重装前引导进入PE系统备份客户数据",
                        },
                    ],
                },
            ],
            "网络问题": [
                {
                    "title": "完全无法连接WiFi",
                    "instruction": "电脑找不到任何WiFi网络或无法连接。请检查：1) WiFi开关是否打开（部分笔记本有物理开关或Fn快捷键）2) 设备管理器中无线网卡是否有黄色感叹号",
                    "children": [
                        {
                            "title": "WiFi开关未打开",
                            "instruction": "WiFi功能被关闭了。",
                            "solution": "1) 检查笔记本侧面是否有物理WiFi开关\n2) 按Fn+WiFi快捷键（不同品牌不同，通常是Fn+F2/F3/F5等）\n3) 在Windows设置→网络和Internet中确认WiFi已开启",
                        },
                        {
                            "title": "无线网卡有感叹号",
                            "instruction": "设备管理器中无线网卡驱动有问题。",
                            "solution": "1) 右键无线网卡→卸载设备→勾选删除驱动→重启电脑（Windows会自动重装）\n2) 如果问题依旧，到笔记本品牌官网下载对应型号的无线网卡驱动安装",
                        },
                        {
                            "title": "开关和驱动都正常",
                            "instruction": "WiFi开关开启、驱动正常但仍无法连接。",
                            "children": [
                                {
                                    "title": "其他设备可以连接",
                                    "instruction": "手机和其他电脑可以连接同一个WiFi。",
                                    "solution": "1) 在命令提示符（管理员）运行：netsh winsock reset\n2) 运行：netsh int ip reset\n3) 重启电脑\n4) 如果问题依旧，尝试「网络适配器」疑难解答",
                                },
                                {
                                    "title": "其他设备也无法连接",
                                    "instruction": "所有设备都无法连接这个WiFi，是路由器问题。",
                                    "solution": "这是路由器/网络环境问题，建议客户重启路由器或联系网络运营商。非电脑故障。",
                                },
                            ],
                        },
                    ],
                },
                {
                    "title": "连接WiFi但无法上网",
                    "instruction": "WiFi显示已连接，但浏览器无法打开网页。",
                    "children": [
                        {
                            "title": "显示「无Internet」",
                            "instruction": "WiFi连接状态显示「无Internet，安全连接」。",
                            "solution": "1) 尝试断开WiFi重新连接\n2) 在命令提示符运行：ipconfig /flushdns\n3) 运行：ipconfig /release 然后 ipconfig /renew\n4) 检查DHCP是否正常获取到IP地址（ipconfig查看）\n5) 尝试忘记该WiFi网络后重新输入密码连接",
                        },
                        {
                            "title": "显示已连接但打不开网页",
                            "instruction": "WiFi状态显示已连接且有Internet，但实际无法上网。",
                            "solution": "1) 尝试ping 8.8.8.8（命令提示符输入ping 8.8.8.8）\n2) 如果ping通但打不开网页，是DNS问题：改为使用 114.114.114.114 或 223.5.5.5\n3) 如果ping不通，可能是IP冲突或路由器问题\n4) 检查是否开启了代理或VPN软件",
                        },
                    ],
                },
            ],
            "系统卡顿": [
                {
                    "title": "开机很慢",
                    "instruction": "电脑从按下电源到进入桌面需要很长时间。",
                    "children": [
                        {
                            "title": "开机后桌面响应正常",
                            "instruction": "虽然开机慢，但进入桌面后使用正常。",
                            "solution": "1) 按 Win+R 输入 msconfig → 启动选项卡，禁用不必要的启动项\n2) 任务管理器→启动选项卡，禁用不需要的启动程序\n3) 开启Windows快速启动：控制面板→电源选项→选择电源按钮的功能→勾选启用快速启动\n4) 如果使用机械硬盘(HDD)，建议升级为固态硬盘(SSD)可大幅提升开机速度",
                        },
                        {
                            "title": "开机后也很卡",
                            "instruction": "开机慢，进入桌面后也持续卡顿。",
                            "solution": "1) 打开任务管理器（Ctrl+Shift+Esc）查看CPU/内存/磁盘使用率\n2) 如果磁盘使用率持续100%，可能是硬盘故障或即将损坏\n3) 检查C盘剩余空间，至少保留10GB以上\n4) 运行sfc /scannow修复系统文件\n5) 考虑重装系统",
                        },
                    ],
                },
                {
                    "title": "运行时突然变卡",
                    "instruction": "电脑使用过程中突然变得很卡，之前是正常的。",
                    "children": [
                        {
                            "title": "任务管理器显示CPU占用高",
                            "instruction": "打开任务管理器，发现某个进程CPU占用率很高。",
                            "solution": "1) 找到CPU占用高的进程，如果是未知进程，可能是恶意软件\n2) 使用Windows安全中心进行全盘扫描\n3) 如果是系统进程（如System Interrupts），可能是驱动冲突\n4) 如果是某个软件，尝试关闭或卸载后观察",
                        },
                        {
                            "title": "任务管理器显示内存占用高",
                            "instruction": "内存使用率接近或达到100%。",
                            "solution": "1) 查看哪个程序占用了大量内存\n2) 关闭不需要的程序和浏览器标签页\n3) 如果物理内存较小（4GB以下），建议增加内存条\n4) 检查是否有内存泄漏的程序（重启后观察内存是否正常）",
                        },
                        {
                            "title": "磁盘使用率持续100%",
                            "instruction": "磁盘使用率持续在100%，系统响应很慢。",
                            "solution": "1) 如果是机械硬盘(HDD)，这是正常现象但影响体验，建议升级SSD\n2) 关闭Windows搜索服务：服务→Windows Search→禁用\n3) 关闭磁盘碎片整理计划任务\n4) 检查硬盘健康状态：命令提示符运行 wmic diskdrive get status\n5) 如果显示非OK状态，硬盘可能即将损坏，建议立即备份数据",
                        },
                    ],
                },
            ],
            "驱动问题": [
                {
                    "title": "设备管理器有黄色感叹号",
                    "instruction": "打开设备管理器（右键开始→设备管理器），发现有设备显示黄色感叹号。",
                    "children": [
                        {
                            "title": "未知设备",
                            "instruction": "显示为「未知设备」，通常是缺少驱动程序。",
                            "solution": "1) 右键未知设备→属性→详细信息→硬件ID\n2) 记录硬件ID信息\n3) 到笔记本品牌官网的驱动下载页面\n4) 输入笔记本型号，下载对应驱动安装\n5) 也可以安装驱动管理工具辅助安装",
                        },
                        {
                            "title": "已知设备驱动异常",
                            "instruction": "知道是哪个设备的驱动有问题（如显卡、声卡、网卡等）。",
                            "solution": "1) 右键该设备→更新驱动程序→自动搜索\n2) 如果自动搜索失败，到品牌官网下载手动安装\n3) 也可以右键→卸载设备→勾选删除驱动→重启电脑让Windows重装\n4) 如果是显卡问题，到NVIDIA/AMD官网下载对应显卡驱动",
                        },
                    ],
                },
                {
                    "title": "外设无法识别",
                    "instruction": "USB设备、打印机等外设插上后电脑没有反应或提示无法识别。",
                    "children": [
                        {
                            "title": "该USB口其他设备正常",
                            "instruction": "同一个USB口插其他设备可以正常使用。",
                            "solution": "该外设本身可能有问题。尝试：1) 换一个USB口\n2) 如果是打印机，到品牌官网下载最新驱动\n3) 如果是U盘，在其他电脑上测试是否可以识别\n4) 设备管理器中查看是否有通用串行总线控制器异常",
                        },
                        {
                            "title": "所有USB口都有问题",
                            "instruction": "所有USB口都无法正常识别外设。",
                            "children": [
                                {
                                    "title": "鼠标键盘USB口可以用",
                                    "instruction": "USB键盘和鼠标可以正常使用，但其他USB设备不行。",
                                    "solution": "可能是USB驱动问题。尝试：1) 设备管理器→通用串行总线控制器→右键全部卸载→重启\n2) 检查BIOS中USB 3.0设置是否正常\n3) 更新芯片组驱动",
                                },
                                {
                                    "title": "所有USB设备都不行",
                                    "instruction": "包括键盘鼠标在内的所有USB设备都无法使用。",
                                    "is_hardware": True,
                                    "solution": "USB控制器硬件可能存在故障，需要寄回售后部检测维修。",
                                },
                            ],
                        },
                    ],
                },
            ],
            "显示异常": [
                {
                    "title": "屏幕花屏或闪屏",
                    "instruction": "屏幕出现花屏（乱码色块）、闪屏（画面闪烁）或横线竖线。",
                    "children": [
                        {
                            "title": "外接显示器正常",
                            "instruction": "连接外接显示器后，外接显示器显示正常，笔记本屏幕有问题。",
                            "children": [
                                {
                                    "title": "轻轻按压屏幕边框会变化",
                                    "instruction": "用手轻轻按压屏幕边框时花屏会变化或暂时恢复。",
                                    "is_hardware": True,
                                    "solution": "屏幕排线松动或损坏，需要寄回售后部重新安装排线或更换屏幕。",
                                },
                                {
                                    "title": "按压无变化，一直花屏",
                                    "instruction": "按压屏幕边框不影响花屏表现。",
                                    "is_hardware": True,
                                    "solution": "可能是液晶面板或显卡硬件问题，需要寄回售后部进一步检测确认是屏幕面板还是显卡问题。",
                                },
                            ],
                        },
                        {
                            "title": "外接显示器也花屏",
                            "instruction": "外接显示器同样出现花屏现象。",
                            "children": [
                                {
                                    "title": "安全模式下正常",
                                    "instruction": "进入安全模式后花屏消失，显示正常。",
                                    "solution": "这是显卡驱动问题。1) 在安全模式下卸载显卡驱动\n2) 到官网下载最新稳定版驱动重新安装\n3) 如果是独立显卡，检查独显是否正常切换",
                                },
                                {
                                    "title": "安全模式下也花屏",
                                    "instruction": "安全模式下屏幕同样花屏。",
                                    "is_hardware": True,
                                    "solution": "显卡硬件存在故障（可能是显存或GPU芯片问题），需要寄回售后部维修。",
                                },
                            ],
                        },
                    ],
                },
                {
                    "title": "分辨率异常或显示不全",
                    "instruction": "屏幕显示模糊、分辨率不是推荐值、或显示区域不完整。",
                    "solution": "1) 右键桌面→显示设置→将分辨率设为推荐值\n2) 如果推荐值不在列表中，显卡驱动可能未安装\n3) 检查显示缩放比例是否为100%或125%\n4) 右键应用→属性→兼容性→更改高DPI设置→勾选替代高DPI缩放\n5) 更新显卡驱动到最新版本",
                },
            ],
            "音频问题": [
                {
                    "title": "完全没有声音",
                    "instruction": "电脑播放音频时扬声器或耳机没有声音输出。请检查：1) 音量是否静音 2) 音频输出设备是否选对",
                    "children": [
                        {
                            "title": "音量静音或输出设备选错",
                            "instruction": "检查发现音量被静音了，或者输出设备选择了错误的选项。",
                            "solution": "1) 点击右下角音量图标取消静音\n2) 右键音量图标→声音设置→输出设备选择正确的扬声器/耳机\n3) 如果使用蓝牙耳机，确认蓝牙已连接并选为输出设备",
                        },
                        {
                            "title": "音量和设备都正常仍无声音",
                            "instruction": "音量未静音，输出设备正确，但仍然没有声音。",
                            "solution": "1) 右键音量图标→声音设置→输出设备→找到当前设备→设备属性\n2) 在「级别」选项卡确认音量\n3) 在「增强功能」选项卡禁用所有音效\n4) 设备管理器中卸载声卡驱动→重启重装\n5) 检查声音控制面板：播放选项卡中默认设备是否正确\n6) 运行Windows声音疑难解答",
                        },
                        {
                            "title": "耳机有声音但扬声器没有",
                            "instruction": "插入耳机有声音，拔出耳机扬声器无声。",
                            "children": [
                                {
                                    "title": "重装驱动后解决",
                                    "instruction": "尝试卸载并重装声卡驱动。",
                                    "solution": "1) 设备管理器→声音、视频和游戏控制器→右键卸载所有声卡设备（勾选删除驱动）\n2) 重启电脑\n3) 到品牌官网下载声卡驱动安装\n4) 检查音频插口是否有灰尘或异物",
                                },
                                {
                                    "title": "重装驱动仍无法解决",
                                    "instruction": "重装驱动后扬声器仍然没有声音。",
                                    "is_hardware": True,
                                    "solution": "笔记本扬声器或音频功放硬件可能损坏，需要寄回售后部检测维修。",
                                },
                            ],
                        },
                    ],
                },
                {
                    "title": "声音有杂音或断断续续",
                    "instruction": "有声音但伴随杂音、电流声、或声音断断续续。",
                    "children": [
                        {
                            "title": "所有音频都有杂音",
                            "instruction": "不管是播放音乐、视频还是系统音都有杂音。",
                            "children": [
                                {
                                    "title": "插耳机也有杂音",
                                    "instruction": "使用耳机同样有杂音。",
                                    "children": [
                                        {
                                            "title": "外接USB声卡正常",
                                            "instruction": "使用USB声卡或蓝牙音频输出声音正常。",
                                            "is_hardware": True,
                                            "solution": "笔记本内置声卡硬件故障，需要寄回售后部维修。",
                                        },
                                        {
                                            "title": "外接声卡也有杂音",
                                            "instruction": "即使使用USB声卡也有杂音。",
                                            "solution": "可能是系统或软件层面的干扰。1) 检查是否有电磁干扰（远离手机等设备）\n2) 在电源管理中禁用USB选择性挂起\n3) 更新主板芯片组驱动\n4) 在BIOS中禁用内置音频再启用试试",
                                        },
                                    ],
                                },
                                {
                                    "title": "只有扬声器有杂音",
                                    "instruction": "使用耳机时声音正常，只有扬声器有杂音。",
                                    "is_hardware": True,
                                    "solution": "扬声器硬件可能损坏或存在接触不良，需要寄回售后部检测维修。",
                                },
                            ],
                        },
                        {
                            "title": "只有特定软件有杂音",
                            "instruction": "某些软件播放有杂音，其他软件正常。",
                            "solution": "1) 检查该软件的音频设置（采样率、输出设备）\n2) 更新该软件到最新版本\n3) 在软件设置中更换音频输出方式（如从WASAPI改为DirectSound）\n4) 检查是否有音频增强插件冲突",
                        },
                    ],
                },
            ],
            "外设问题": [
                {
                    "title": "触控板失灵或不灵敏",
                    "instruction": "笔记本触控板无法使用、光标不动、或触控操作不灵敏。",
                    "children": [
                        {
                            "title": "USB鼠标可以使用",
                            "instruction": "外接USB鼠标工作正常，只是触控板有问题。",
                            "children": [
                                {
                                    "title": "触控板被禁用了",
                                    "instruction": "可能是触控板被关闭了。检查：1) Fn+触控板快捷键（不同品牌不同） 2) 设置→蓝牙和其他设备→触控板",
                                    "solution": "1) 按Fn+F5/F6/F8等快捷键开启触控板\n2) Windows设置→蓝牙和其他设备→触控板→确认未禁用\n3) 某些笔记本有物理触控板开关，检查侧面",
                                },
                                {
                                    "title": "触控板未禁用但仍失灵",
                                    "instruction": "触控板未禁用但仍然无法使用。",
                                    "solution": "1) 设备管理器→找到触控板设备→卸载驱动→重启\n2) 到品牌官网下载触控板驱动安装\n3) 控制面板→鼠标→触控板设置卡→重置默认\n4) 检查触控板表面是否有污渍影响灵敏度",
                                },
                            ],
                        },
                        {
                            "title": "USB鼠标也不行",
                            "instruction": "USB鼠标也无法正常使用。",
                            "solution": "1) 尝试不同的USB口\n2) 检查设备管理器中USB控制器是否有异常\n3) 运行Windows更新\n4) 在BIOS中检查USB设置是否正常",
                        },
                    ],
                },
                {
                    "title": "键盘失灵或按键错乱",
                    "instruction": "部分按键无反应、按键输入错误字符、或键盘卡键。",
                    "children": [
                        {
                            "title": "外接USB键盘正常",
                            "instruction": "外接USB键盘可以正常使用，笔记本键盘有问题。",
                            "children": [
                                {
                                    "title": "部分按键不灵",
                                    "instruction": "只有个别或部分按键没有反应。",
                                    "is_hardware": True,
                                    "solution": "可能是键盘膜/按键排线问题。如果是少量按键，可暂时使用外接键盘。需要寄回售后部更换键盘组件。",
                                },
                                {
                                    "title": "输入字符全部错误",
                                    "instruction": "按键输入的字符和实际不符，如输入a出现q。",
                                    "solution": "1) 检查输入法是否正确（切换到英文输入法测试）\n2) 检查键盘布局设置：设置→时间和语言→语言→选项→键盘\n3) 确认键盘布局为「中文(简体) - 美式键盘」\n4) 如果还是错误，可能是键盘硬件故障",
                                },
                            ],
                        },
                        {
                            "title": "外接USB键盘也不正常",
                            "instruction": "外接USB键盘同样有按键异常。",
                            "solution": "这是软件/系统层面的问题。1) 检查是否有键盘过滤驱动\n2) 设备管理器→键盘→卸载所有键盘设备→重启\n3) 检查是否有恶意软件劫持键盘输入\n4) 尝试在安全模式下测试",
                        },
                    ],
                },
            ],
        }

        for cat_name, steps_list in steps_data.items():
            cat_id = cat_map[cat_name]
            _create_steps(db, None, cat_id, steps_list)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def _create_steps(db, parent_id, cat_id, steps_data):
    for i, step_data in enumerate(steps_data):
        step = TroubleshootStep(
            parent_id=parent_id,
            category_id=cat_id,
            title=step_data["title"],
            instruction=step_data.get("instruction", ""),
            is_hardware=step_data.get("is_hardware", False),
            solution=step_data.get("solution", ""),
            sort_order=i,
        )
        db.add(step)
        db.flush()
        if "children" in step_data:
            _create_steps(db, step.id, cat_id, step_data["children"])


def seed_knowledge():
    db = SessionLocal()
    try:
        if db.query(KnowledgeCategory).count() > 0:
            return

        cats = [
            ("基础操作", "basic", 0),
            ("系统维护", "maintenance", 1),
            ("网络配置", "network", 2),
            ("数据备份", "backup", 3),
        ]

        cat_map = {}
        for name, icon, order in cats:
            cat = KnowledgeCategory(name=name, icon=icon, sort_order=order)
            db.add(cat)
            db.flush()
            cat_map[icon] = cat.id

        admin = db.query(User).filter(User.username == "admin").first()
        admin_id = admin.id if admin else 1

        articles = [
            ("Windows常见快捷键", "basic", "Windows系统中常用的快捷键操作汇总，帮助用户提高操作效率。",
             ["Ctrl+C 复制", "Ctrl+V 粘贴", "Ctrl+Z 撤销", "Ctrl+A 全选", "Ctrl+S 保存",
              "Alt+F4 关闭当前窗口", "Alt+Tab 切换窗口", "Win+E 打开文件资源管理器",
              "Win+D 显示桌面", "Win+L 锁定电脑", "Ctrl+Shift+Esc 打开任务管理器",
              "Win+R 运行对话框", "Win+I 打开设置", "Win+截图工具 快速截图"], "快捷键 操作效率"),
            ("如何进入安全模式", "basic", "安全模式是Windows的诊断模式，只加载最基本的驱动和程序，用于排查系统问题。",
             ["方法一：在Windows中设置：设置→更新和安全→恢复→高级启动→立即重启→疑难解答→高级选项→启动设置→重启→按F4",
              "方法二：开机时反复按F8（部分旧版本Windows适用）",
              "方法三：使用Windows安装U盘启动→修复计算机→疑难解答→高级选项→启动设置",
              "进入安全模式后，屏幕四角会显示「安全模式」字样"], "安全模式 排查 诊断"),
            ("如何使用系统还原", "maintenance", "系统还原可以将电脑恢复到之前的正常状态，不会影响个人文件。",
             ["按Win+R输入 rstrui 打开系统还原",
              "选择「选择另一个还原点」可以查看更多还原点",
              "建议勾选「显示更多还原点」查看完整列表",
              "如果无法进入Windows，可以在安全模式或恢复环境中运行系统还原",
              "还原操作可以撤销，如果还原后问题更严重可以撤销还原"],
             "系统还原 恢复 回滚"),
            ("如何使用磁盘清理释放空间", "maintenance", "Windows内置的磁盘清理工具可以安全地清理不需要的文件释放磁盘空间。",
             ["双击「此电脑」→右键C盘→属性→磁盘清理",
              "点击「清理系统文件」可以清理更多内容（包括Windows更新缓存）",
              "可以清理的内容：临时文件、回收站、Windows更新清理、系统错误内存转储文件等",
              "建议定期清理，尤其是C盘空间不足时",
              "如果C盘长期空间不足，考虑将大文件转移到D盘或外接存储"],
             ["磁盘清理 空间 C盘"]),
            ("如何重置网络设置", "network", "当网络出现异常时，重置网络设置可以解决大部分软件层面的网络问题。",
             ["以管理员身份打开命令提示符（Win+X→Windows PowerShell(管理员)）",
              "运行：netsh winsock reset（重置网络套接字）",
              "运行：netsh int ip reset（重置IP设置）",
              "运行：ipconfig /flushdns（清除DNS缓存）",
              "运行：netsh advfirewall reset（重置防火墙设置）",
              "运行以上命令后重启电脑生效"],
             ["网络 重置 Winsock DNS"]),
            ("如何备份数据到U盘", "backup", "在重装系统或送修前，建议备份重要数据到U盘或移动硬盘。",
             ["插入U盘，打开「此电脑」确认U盘已识别",
              "重要数据通常在这些位置：\n  - 桌面：C:\\Users\\用户名\\Desktop\n  - 文档：C:\\Users\\用户名\\Documents\n  - 图片：C:\\Users\\用户名\\Pictures\n  - 下载：C:\\Users\\用户名\\Downloads",
              "微信聊天记录默认在：C:\\Users\\用户名\\Documents\\WeChat Files",
              "QQ文件默认在：C:\\Users\\用户名\\Documents\\Tencent Files",
              "浏览器书签建议先登录账号同步，或在浏览器设置中导出书签HTML文件",
              "选中文件→右键复制→到U盘目录中→右键粘贴"],
             ["备份 U盘 数据 微信 QQ"]),
        ]

        for title, cat_key, desc, steps, keywords in articles:
            if isinstance(keywords, list):
                keywords = " ".join(keywords)
            article = KnowledgeArticle(
                category_id=cat_map[cat_key],
                title=title,
                problem_desc=desc,
                solution_steps=steps,
                keywords=keywords,
                created_by=admin_id,
            )
            db.add(article)
            db.flush()

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
