const KEY = 'pulse_api_key'

export const auth = {
  getKey: () => sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '',
  setKey: (k, remember = false) => {
    sessionStorage.setItem(KEY, k)
    if (remember) localStorage.setItem(KEY, k)
    else localStorage.removeItem(KEY)
  },
  clear: () => {
    sessionStorage.removeItem(KEY)
    localStorage.removeItem(KEY)
  },
}
