import React, { useState, useRef } from 'react'
import { uploadImage, deleteImage } from '../api/upload'
import { X, Upload, ZoomIn } from 'lucide-react'

interface Props {
  images: string[]
  onChange: (images: string[]) => void
}

export default function ImageUpload({ images, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploading(true)
    const newImages: string[] = []
    for (let i = 0; i < files.length; i++) {
      try {
        const res = await uploadImage(files[i])
        newImages.push(res.data.url)
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }
    if (newImages.length > 0) {
      onChange([...images, ...newImages])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRemove = async (url: string) => {
    const filename = url.split('/').pop()
    if (filename) {
      try { await deleteImage(filename) } catch { /* ignore */ }
    }
    onChange(images.filter((img) => img !== url))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (dt.files.length > 0 && fileRef.current) {
      const input = fileRef.current
      const dt2 = new DataTransfer()
      for (let i = 0; i < dt.files.length; i++) {
        dt2.items.add(dt.files[i])
      }
      input.files = dt2.files
      const event = new Event('change', { bubbles: true })
      input.dispatchEvent(event)
    }
  }

  return (
    <div>
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary-400 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">
          {uploading ? '上传中...' : '点击或拖拽图片到此处上传'}
        </p>
        <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF，单张最大 10MB</p>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {images.map((url, idx) => (
            <div key={url} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewIdx(idx) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-gray-700" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(url) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewIdx !== null && images[previewIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setPreviewIdx(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={images[previewIdx]}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setPreviewIdx(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
