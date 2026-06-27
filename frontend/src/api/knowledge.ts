import client from './client'
import type { KnowledgeCategory, KnowledgeArticle } from '../types'

export function getKnowledgeCategories() {
  return client.get<KnowledgeCategory[]>('/knowledge/categories')
}

export function createKnowledgeCategory(data: { name: string; icon: string; sort_order: number }) {
  return client.post<KnowledgeCategory>('/knowledge/categories', data)
}

export function deleteKnowledgeCategory(id: number) {
  return client.delete(`/knowledge/categories/${id}`)
}

export function getKnowledgeArticles(params: any = {}) {
  return client.get('/knowledge/articles', { params })
}

export function getKnowledgeArticle(id: number) {
  return client.get<KnowledgeArticle>(`/knowledge/articles/${id}`)
}

export function createKnowledgeArticle(data: any) {
  return client.post<KnowledgeArticle>('/knowledge/articles', data)
}

export function updateKnowledgeArticle(id: number, data: any) {
  return client.put<KnowledgeArticle>(`/knowledge/articles/${id}`, data)
}

export function deleteKnowledgeArticle(id: number) {
  return client.delete(`/knowledge/articles/${id}`)
}

export interface KnowledgeSuggestItem {
  id: number
  title: string
  category_name: string
  keywords: string
  problem_desc: string
  match_type: string
}

export function suggestArticles(q: string) {
  return client.get<KnowledgeSuggestItem[]>('/knowledge/suggest', { params: { q } })
}

export function createArticleFromTicket(ticketId: number) {
  return client.post<{ id: number; title: string }>('/knowledge/articles/from-ticket', null, { params: { ticket_id: ticketId } })
}
