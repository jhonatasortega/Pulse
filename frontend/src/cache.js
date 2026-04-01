// Simple in-memory TTL cache (resets on page reload)
const _store = {}

export function memCache(key, ttlMs, fn) {
  const hit = _store[key]
  if (hit && Date.now() - hit.t < ttlMs) return Promise.resolve(hit.v)
  return fn().then(v => { _store[key] = { v, t: Date.now() }; return v })
}

export function bust(...keys) {
  keys.forEach(k => delete _store[k])
}
