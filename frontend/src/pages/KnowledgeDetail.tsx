import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, ZoomIn } from 'lucide-react'
import { getKnowledgeArticle, deleteKnowledgeArticle } from '../api/knowledge'
import { useAuth } from '../hooks/useAuth'
import type { KnowledgeArticle } from '../types'

function renderStepContent(text: string) {
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const imgMatch = part.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      return <img key={i} src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-lg border border-gray-200 mt-2 max-h-60 object-contain bg-gray-50" />
    }
    return <span key={i}>{part}</span>
  })
}

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      getKnowledgeArticle(Number(id)).then((res) => setArticle(res.data)).catch(() => {})
    }
  }, [id])

  const handleDelete = async () => {
    if (!id || !confirm('确定删除这篇文章？')) return
    try {
      await deleteKnowledgeArticle(Number(id))
      navigate('/knowledge')
    } catch (err) { console.error(err) }
  }

  if (!article) return <div className="text-center py-20 text-gray-400">加载中...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <span className="badge bg-gray-100 text-gray-500 text-xs">{article.category_name}</span>
            <h1 className="text-xl font-bold text-gray-800 mt-1">{article.title}</h1>
          </div>
        </div>
        {hasPermission('knowledge:edit', 'knowledge:delete') && (
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => navigate(`/knowledge/${id}/edit`)} className="btn-secondary flex items-center gap-2 text-sm">
              <Edit className="w-4 h-4" /> 编辑
            </button>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">问题描述</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{article.problem_desc}</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">解决步骤</h2>
          <ol className="space-y-4">
            {article.solution_steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap flex-1 min-w-0">
                  {renderStepContent(step)}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {article.images && article.images.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">相关图片</h2>
            <div className="flex flex-wrap gap-3">
              {article.images.map((url, idx) => (
                <div
                  key={idx}
                  className="w-28 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setPreviewImg(url)}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {article.keywords && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">关键词：</span>
            {article.keywords.split(',').map((kw) => (
              <span key={kw} className="badge bg-gray-100 text-gray-500 text-[10px]">{kw.trim()}</span>
            ))}
          </div>
        )}
      </div>

      {/* Image preview */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
