from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db, KnowledgeCategory, KnowledgeArticle, Ticket, User
from schemas import (
    KnowledgeCategoryCreate, KnowledgeCategoryOut,
    KnowledgeArticleCreate, KnowledgeArticleUpdate, KnowledgeArticleOut,
)
from auth import get_current_user, require_admin, require_admin_or_tech
from services import audit_service

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def article_to_out(a: KnowledgeArticle, cat_name: str = "") -> KnowledgeArticleOut:
    return KnowledgeArticleOut(
        id=a.id, category_id=a.category_id,
        category_name=cat_name,
        title=a.title, problem_desc=a.problem_desc,
        solution_steps=a.solution_steps or [],
        keywords=a.keywords or "",
        images=a.images or [],
        created_by=a.created_by,
        created_at=a.created_at, updated_at=a.updated_at,
    )


@router.get("/categories", response_model=list[KnowledgeCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cats = db.query(KnowledgeCategory).filter(KnowledgeCategory.company_id == current_user.company_id).order_by(KnowledgeCategory.sort_order).all()
    result = []
    for c in cats:
        count = db.query(KnowledgeArticle).filter(KnowledgeArticle.category_id == c.id, KnowledgeArticle.company_id == current_user.company_id).count()
        result.append(KnowledgeCategoryOut(
            id=c.id, name=c.name, icon=c.icon, sort_order=c.sort_order,
            article_count=count,
        ))
    return result


@router.post("/categories", response_model=KnowledgeCategoryOut)
def create_category(
    req: KnowledgeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    cat = KnowledgeCategory(company_id=current_user.company_id, name=req.name, icon=req.icon, sort_order=req.sort_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    audit_service.log(db, current_user, "create", "knowledge_category", cat.id,
                      f"创建知识库分类: {cat.name}")
    return KnowledgeCategoryOut(
        id=cat.id, name=cat.name, icon=cat.icon,
        sort_order=cat.sort_order, article_count=0,
    )


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == cat_id, KnowledgeCategory.company_id == current_user.company_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    audit_service.log(db, current_user, "delete", "knowledge_category", cat_id,
                      f"删除知识库分类: {cat.name}")
    db.delete(cat)
    db.commit()
    return {"message": "Deleted"}


@router.get("/articles", response_model=dict)
def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: int = Query(0, description="Filter by category"),
    search: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(KnowledgeArticle).filter(KnowledgeArticle.company_id == current_user.company_id)
    if category_id:
        query = query.filter(KnowledgeArticle.category_id == category_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (KnowledgeArticle.title.like(pattern))
            | (KnowledgeArticle.keywords.like(pattern))
        )
    total = query.count()
    articles = query.order_by(KnowledgeArticle.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for a in articles:
        cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == a.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
        items.append(article_to_out(a, cat.name if cat else ""))
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/articles/{article_id}", response_model=KnowledgeArticleOut)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id, KnowledgeArticle.company_id == current_user.company_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Article not found")
    cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == a.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
    return article_to_out(a, cat.name if cat else "")


@router.post("/articles", response_model=KnowledgeArticleOut)
def create_article(
    req: KnowledgeArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == req.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")
    article = KnowledgeArticle(
        company_id=current_user.company_id,
        category_id=req.category_id, title=req.title,
        problem_desc=req.problem_desc, solution_steps=req.solution_steps,
        keywords=req.keywords, images=req.images,
        created_by=current_user.id,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == article.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
    audit_service.log(db, current_user, "create", "knowledge_article", article.id,
                      f"创建知识库文章: {article.title}")
    return article_to_out(article, cat.name if cat else "")


@router.put("/articles/{article_id}", response_model=KnowledgeArticleOut)
def update_article(
    article_id: int,
    req: KnowledgeArticleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id, KnowledgeArticle.company_id == current_user.company_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if req.category_id is not None:
        cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == req.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found")
        article.category_id = req.category_id
    if req.title is not None:
        article.title = req.title
    if req.problem_desc is not None:
        article.problem_desc = req.problem_desc
    if req.solution_steps is not None:
        article.solution_steps = req.solution_steps
    if req.keywords is not None:
        article.keywords = req.keywords
    if req.images is not None:
        article.images = req.images
    db.commit()
    db.refresh(article)
    cat = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == article.category_id, KnowledgeCategory.company_id == current_user.company_id).first()
    audit_service.log(db, current_user, "update", "knowledge_article", article_id,
                      f"更新知识库文章: {article.title}")
    return article_to_out(article, cat.name if cat else "")


@router.delete("/articles/{article_id}")
def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id, KnowledgeArticle.company_id == current_user.company_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    audit_service.log(db, current_user, "delete", "knowledge_article", article_id,
                      f"删除知识库文章: {article.title}")
    db.delete(article)
    db.commit()
    return {"message": "Deleted"}


@router.get("/suggest")
def suggest_articles(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """根据问题描述文本匹配知识库文章，返回 Top 5"""
    pattern = f"%{q}%"
    articles = db.query(KnowledgeArticle).filter(
        KnowledgeArticle.company_id == current_user.company_id,
        (
            KnowledgeArticle.title.like(pattern)
            | KnowledgeArticle.keywords.like(pattern)
            | KnowledgeArticle.problem_desc.like(pattern)
        ),
    ).limit(10).all()

    # 按匹配类型排序：标题 > 关键词 > 描述
    results = []
    for a in articles:
        match_type = "desc"
        if q.lower() in (a.title or "").lower():
            match_type = "title"
        elif q.lower() in (a.keywords or "").lower():
            match_type = "keyword"
        cat = db.query(KnowledgeCategory).filter(
            KnowledgeCategory.id == a.category_id,
            KnowledgeCategory.company_id == current_user.company_id,
        ).first()
        results.append({
            "id": a.id,
            "title": a.title,
            "category_name": cat.name if cat else "",
            "keywords": a.keywords or "",
            "problem_desc": (a.problem_desc or "")[:200],
            "match_type": match_type,
        })

    # 排序：title 匹配优先，然后 keyword，最后 desc
    order = {"title": 0, "keyword": 1, "desc": 2}
    results.sort(key=lambda x: order.get(x["match_type"], 9))
    return results[:5]


@router.post("/articles/from-ticket")
def create_article_from_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_tech),
):
    """从工单沉淀为知识库文章"""
    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.company_id == current_user.company_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 找到默认分类（第一个）
    default_cat = db.query(KnowledgeCategory).filter(
        KnowledgeCategory.company_id == current_user.company_id,
    ).order_by(KnowledgeCategory.sort_order).first()
    if not default_cat:
        raise HTTPException(status_code=400, detail="请先创建知识库分类")

    # 从工单提取内容
    title = (ticket.description or "")[:50] or f"工单#{ticket.id}问题"
    problem_desc = ticket.description or ""

    # 从诊断日志提取解决方案步骤
    solution_steps = []
    if ticket.diagnosis_log:
        for step in ticket.diagnosis_log:
            if isinstance(step, dict) and step.get("title"):
                solution_steps.append({
                    "title": step["title"],
                    "content": step.get("answer", ""),
                })

    # 从反馈记录提取补充方案
    for fb in ticket.feedbacks:
        if fb.content and fb.feedback_type == "progress":
            solution_steps.append({
                "title": "处理记录",
                "content": fb.content,
            })

    article = KnowledgeArticle(
        company_id=current_user.company_id,
        category_id=default_cat.id,
        title=title,
        problem_desc=problem_desc,
        solution_steps=solution_steps,
        keywords=ticket.customer_id or "",
        images=ticket.images or [],
        created_by=current_user.id,
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    audit_service.log(db, current_user, "create", "knowledge_article", article.id,
                      f"从工单#{ticket_id}沉淀知识库文章: {article.title}")
    return {"id": article.id, "title": article.title}
