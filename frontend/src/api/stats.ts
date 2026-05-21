import client from './client'

export function getStats() {
  return client.get('/tickets', { params: { page: 1, page_size: 1000 } })
}
