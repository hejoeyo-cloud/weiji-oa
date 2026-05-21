import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ImagePlus, X } from 'lucide-react'
import { getKnowledgeCategories, createKnowledgeArticle, updateKnowledgeArticle, getKnowledgeArticle } from '../api/knowledge'
import { uploadImage, deleteImage } from '../api/upload'
import type { KnowledgeCategory } from '../types'

export default function KnowledgeEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadTargetStep, setUploadTargetStep] = useState<number | null>(null)
  const [form, setForm] = useState({
    category_id: 0,
    title: '',
    problem_desc: '',
    solution_steps: [''],
    keywords: '',
    images: [] as string[],
  })

  useEffect(() => {
    getKnowledgeCategories().then((res) => setCategories(res.data)).catch(() => {})
    if (isEdit && id) {
      getKnowledgeArticle(Number(id)).then((res) => {
        setForm({
          category_id: res.data.category_id,
          title: res.data.title,
          problem_desc: res.data.problem_desc,
          solution_steps: res.data.solution_steps.length > 0 ? res.data.solution_steps : [''],
          keywords: res.data.keywords || '',
          images: res.data.images || [],
        })
      }).catch(() => {})
    }
  }, [id])

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

  const updateStep = (idx: number, value: string) => {
    const steps = [...form.solution_steps]
    steps[idx] = value
    update('solution_steps', steps)
  }

  const addStep = () => update('solution_steps', [...form.solution_steps, ''])
  const removeStep = (idx: number) => {
    if (form.solution_steps.length <= 1) return
    update('solution_steps', form.solution_steps.filter((_, i) => i !== idx))
  }

  const handleUploadClick = (stepIdx: number) => {
    setUploadTargetStep(stepIdx)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadTargetStep === null) return
    setUploading(true)
    try {
      const res = await uploadImage(file)
      const imgUrl = res.data.url
      const steps = [...form.solution_steps]
      const current = steps[uploadTargetStep]
      if (current.trim()) {
        steps[uploadTargetStep] = current + '\n' + `![](${imgUrl})`
      } else {
        steps[uploadTargetStep] = `![](${imgUrl})`
      }
      update('solution_steps', steps)
      update('images', [...form.images, imgUrl])
    } catch (err) { console.error(err) }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveImage = async (imgUrl: string) => {
    const filename = imgUrl.split('/').pop()
    if (filename) {
      try { await deleteImage(filename) } catch { /* ignore */ }
    }
    update('images', form.images.filter((u) => u !== imgUrl))
    const steps = form.solution_steps.map((s) => s.replace(`\n![](${imgUrl})`, '').replace(`![](${imgUrl})`, ''))
    update('solution_steps', steps)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category_id) return
    setLoading(true)
    try {
      const data = {
        ...form,
        solution_steps: form.solution_steps.filter((s) => s.trim()),
      }
      if (isEdit && id) {
        await updateKnowledgeArticle(Number(id), data)
      } else {
        await createKnowledgeArticle(data)
      }
      navigate('/knowledge')
    } catch (err) {
      console.error('Save failed:', err)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-200">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">{isEdit ? '编辑文章' : '新建文章'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">分类</label>
            <select value={form.category_id} onChange={(e) => update('category_id', Number(e.target.value))} className="input-field">
              <option value={0}>请选择分类</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">关键词</label>
            <input value={form.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="逗号分隔" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">标题</label>
          <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="文章标题" className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">问题描述</label>
          <textarea value={form.problem_desc} onChange={(e) => update('problem_desc', e.target.value)} rows={3} placeholder="描述问题现象..." className="input-field resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">解决步骤</label>
          <div className="space-y-3">
            {form.solution_steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <textarea
                    value={step}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    placeholder={`步骤 ${idx + 1}，可插入图片辅助说明`}
                    rows={3}
                    className="input-field resize-none w-full"
                  />
                  <button
                    type="button"
                    onClick={() => handleUploadClick(idx)}
                    disabled={uploading}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-500 mt-1 transition-colors"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {uploading && uploadTargetStep === idx ? '上传中...' : '添加图片'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  disabled={form.solution_steps.length <= 1}
                  className="p-2 mt-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addStep} className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1 mt-1">
              <Plus className="w-4 h-4" /> 添加步骤
            </button>
          </div>
        </div>

        {/* Image gallery */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {form.images.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">已上传图片</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">取消</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? '保存中...' : '保存'}</button>
        </div>
      </form>
    </div>
  )
}
