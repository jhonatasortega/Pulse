const KEY_STORAGE  = 'pulse_api_key'
const USER_STORAGE = 'pulse_user'
const PASS_STORAGE = 'pulse_pass'

export const auth = {
  // ─── API-key mode ──────────────────────────────────────────────────────
  getKey: () => sessionStorage.getItem(KEY_STORAGE) || localStorage.getItem(KEY_STORAGE) || '',
  setKey: (k, remember = false) => {
    sessionStorage.setItem(KEY_STORAGE, k)
    if (remember) localStorage.setItem(KEY_STORAGE, k)
    else localStorage.removeItem(KEY_STORAGE)
  },

  // ─── Multi-user mode ───────────────────────────────────────────────────
  getUser: () => {
    try {
      const s = sessionStorage.getItem(USER_STORAGE) || localStorage.getItem(USER_STORAGE)
      return s ? JSON.parse(s) : null
    } catch { return null }
  },
  setUser: (user, remember = false) => {
    const s = JSON.stringify(user)
    sessionStorage.setItem(USER_STORAGE, s)
    if (remember) localStorage.setItem(USER_STORAGE, s)
    else localStorage.removeItem(USER_STORAGE)
  },
  getPass: () => sessionStorage.getItem(PASS_STORAGE) || '',
  setPass: (p, remember = false) => {
    sessionStorage.setItem(PASS_STORAGE, p)
    if (remember) localStorage.setItem(PASS_STORAGE, p)
    else localStorage.removeItem(PASS_STORAGE)
  },

  // ─── Shared ────────────────────────────────────────────────────────────
  clear: () => {
    [KEY_STORAGE, USER_STORAGE, PASS_STORAGE].forEach(k => {
      sessionStorage.removeItem(k)
      localStorage.removeItem(k)
    })
  },

  isAdmin: () => {
    const user = auth.getUser()
    return !user || user.role === 'admin'
  },

  getRole: () => {
    const user = auth.getUser()
    return user?.role ?? 'admin'
  },
}
