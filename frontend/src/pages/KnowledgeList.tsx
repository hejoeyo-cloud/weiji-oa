import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Edit, Trash2, BookOpen, ChevronRight } from 'lucide-react'
import { getKnowledgeCategories, getKnowledgeArticles, deleteKnowledgeCategory, deleteKnowledgeArticle, createKnowledgeCategory } from '../api/knowledge'
import { useAuth } from '../hooks/useAuth'
import type { KnowledgeCategory, KnowledgeArticle } from '../types'

export default function KnowledgeList() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const isAdmin = hasPermission('knowledge:create', 'knowledge:edit', 'knowledge:delete')
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  useEffect(() => {
    getKnowledgeCategories().then((res) => setCategories(res.data)).catch(() => {})
  }, [])

  const fetchArticles = (catId: number | null, keyword = '') => {
    const params: any = { page: 1, page_size: 50 }
    if (catId) params.category_id = catId
    if (keyword) params.search = keyword
    getKnowledgeArticles(params).then((res) => {
      setArticles(res.data.items)
      setTotal(res.data.total)
    }).catch(() => {})
  }

  useEffect(() => {
    fetchArticles(selectedCat, search)
  }, [selectedCat])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchArticles(selectedCat, search)
  }

  const handleDeleteCat = async (id: number) => {
    if (!confirm('删除分类会同时删除该分类下所有文章，确定？')) return
    try {
      await deleteKnowledgeCategory(id)
      getKnowledgeCategories().then((res) => setCategories(res.data))
      if (selectedCat === id) setSelectedCat(null)
      fetchArticles(null, search)
    } catch (err) { console.error(err) }
  }

  const handleCreateCat = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await createKnowledgeCategory({ name })
      setNewCatName('')
      setShowNewCat(false)
      getKnowledgeCategories().then((res) => setCategories(res.data))
    } catch (err) { console.error(err) }
  }

  const handleDeleteArticle = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定删除这篇文章？')) return
    try {
      await deleteKnowledgeArticle(id)
      fetchArticles(selectedCat, search)
    } catch (err) { console.error(err) }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">知识库</h1>
        {isAdmin && (
          <button onClick={() => navigate('/knowledge/new')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> 新建文章
          </button>
        )}
      </div>

      <div className="flex gap-4">
        {/* Sidebar categories */}
        <div className="w-52 flex-shrink-0">
          <div className="card p-3 space-y-1">
            <button
              onClick={() => setSelectedCat(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCat === null ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              全部文章
            </button>
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center group">
                <button
                  onClick={() => setSelectedCat(cat.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCat === cat.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat.name}
                </button>
                {isAdmin && (
                  <button onClick={() => handleDeleteCat(cat.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              showNewCat ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateCat(); if (e.key === 'Escape') { setShowNewCat(false); setNewCatName('') } }}
                    placeholder="分类名称"
                    autoFocus
                    className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-primary-400"
                    style={{ borderColor: '#e5e5e5' }}
                  />
                  <button onClick={handleCreateCat} className="p-1.5 text-white bg-primary-500 rounded-lg hover:bg-primary-600">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCat(true)}
                  className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建分类
                </button>
              )
            )}
          </div>
        </div>

        {/* Article list */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSearch} className="card p-3 mb-4 flex gap-2">
            <Search className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文章标题或关键词..."
              className="input-field flex-1 border-0"
            />
          </form>

          <div className="space-y-2">
            {articles.length === 0 && (
              <div className="card p-8 text-center text-gray-400 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                暂无文章
              </div>
            )}
            {articles.map((a) => (
              <div
                key={a.id}
                className="card p-4 hover:shadow-md cursor-pointer transition-all duration-200"
                onClick={() => navigate(`/knowledge/${a.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{a.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.problem_desc}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className="badge bg-gray-100 text-gray-500 text-[10px]">{a.category_name}</span>
                    {isAdmin && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/knowledge/${a.id}/edit`) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-500">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => handleDeleteArticle(e, a.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">共 {total} 篇文章</p>
        </div>
      </div>
    </div>
  )
}
