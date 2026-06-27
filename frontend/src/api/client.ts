import axios from 'axios'

const API_BASE = '/api'

// ── GET 请求缓存（减少重复请求） ──
const _cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 30_000 // 30 秒

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // GET 请求：检查缓存
  if (config.method === 'get' && (config as any).cache !== false) {
    const key = `${config.url}?${JSON.stringify(config.params || {})}`
    const cached = _cache.get(key)
    if (cached && cached.expires > Date.now()) {
      // 返回缓存的响应，axios 会正常处理
      config.adapter = () => Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as any)
    }
    // 存储 key 用于响应拦截器
    ;(config as any)._cacheKey = key
  }
  return config
})

// 防止多个并发 401 同时触发重复跳转登录页
let _authRedirecting = false
function _redirectToLogin() {
  if (_authRedirecting) return
  _authRedirecting = true
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

client.interceptors.response.use(
  (response) => {
    // GET 请求成功：写入缓存
    if (response.config.method === 'get' && (response.config as any)._cacheKey) {
      _cache.set((response.config as any)._cacheKey, {
        data: response.data,
        expires: Date.now() + CACHE_TTL,
      })
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // 如果是 /api/auth/me 返回 401，说明 token 确实无效，跳转登录
      const isAuthCheck = error.config?.url?.includes('/auth/me')
      if (isAuthCheck) {
        _redirectToLogin()
        return Promise.reject(error)
      }
      // 其他接口的 401：先验证 token 是否真的失效
      // 避免因为后端重启等瞬态错误误清 token
      const token = localStorage.getItem('token')
      if (!token) {
        _redirectToLogin()
        return Promise.reject(error)
      }
      // 用原始 token 调一次 /auth/me 确认状态
      return axios
        .get(API_BASE + '/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(() => {
          // token 仍然有效，原请求的 401 是瞬态的，静默失败
          return Promise.reject(error)
        })
        .catch((verifyError) => {
          if (axios.isAxiosError(verifyError) && verifyError.response?.status === 401) {
            _redirectToLogin()
          }
          return Promise.reject(error)
        })
    }
    return Promise.reject(error)
  }
)

export default client
