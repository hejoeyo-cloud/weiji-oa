import client from './client'

export function uploadImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return client.post<{ url: string; filename: string }>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function deleteImage(filename: string) {
  return client.delete(`/upload/${filename}`)
}
