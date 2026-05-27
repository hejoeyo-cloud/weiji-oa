"""
统一模块种子函数 v1.0
在 init_db.py 和 auth_router.py 中复用，
确保模块配置从注册表统一生成。
"""

import json
from sqlalchemy.orm import Session


def seed_module_configs(db: Session, company_id: int):
    """为指定公司创建默认模块配置（从注册表读取）"""
    from .misc import ModuleConfig
    from .module_registry import MODULE_REGISTRY

    # 检查是否已有配置，避免重复初始化
    existing = db.query(ModuleConfig).filter(
        ModuleConfig.company_id == company_id
    ).first()
    if existing:
        # 已有配置，但可能需要补充新模块
        existing_keys = {
            m.module_key
            for m in db.query(ModuleConfig).filter(
                ModuleConfig.company_id == company_id
            ).all()
        }
        for mod_def in MODULE_REGISTRY.values():
            if mod_def.module_key not in existing_keys:
                config = ModuleConfig(
                    company_id=company_id,
                    module_key=mod_def.module_key,
                    enabled=mod_def.enabled_by_default,
                    display_name=mod_def.display_name,
                    sort_order=mod_def.sort_order,
                    icon=mod_def.icon,
                    route_path=mod_def.route_path,
                    navigation_group=mod_def.navigation_group,
                    permissions=json.dumps(mod_def.permissions),
                    fields_schema=json.dumps([
                        {"name": f.name, "label": f.label, "type": f.type,
                         "options": f.options, "required": f.required,
                         "sort_order": f.sort_order}
                        for f in mod_def.fields
                    ]),
                )
                db.add(config)
        db.commit()
        return

    # 全新公司：创建全部默认模块
    for mod_def in MODULE_REGISTRY.values():
        config = ModuleConfig(
            company_id=company_id,
            module_key=mod_def.module_key,
            enabled=mod_def.enabled_by_default,
            display_name=mod_def.display_name,
            sort_order=mod_def.sort_order,
            icon=mod_def.icon,
            route_path=mod_def.route_path,
            navigation_group=mod_def.navigation_group,
            permissions=json.dumps(mod_def.permissions),
            fields_schema=json.dumps([
                {"name": f.name, "label": f.label, "type": f.type,
                 "options": f.options, "required": f.required,
                 "sort_order": f.sort_order}
                for f in mod_def.fields
            ]),
        )
        db.add(config)
    db.commit()
