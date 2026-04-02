import { auth } from './auth'

const BASE = '/api'

async function request(path, options = {}) {
  const key  = auth.getKey()
  const user = auth.getUser()
  const pass = auth.getPass()
  const headers = {
    'Content-Type': 'application/json',
    ...(key  ? { 'X-Pulse-Key':  key  } : {}),
    ...(user ? { 'X-Pulse-User': user.username } : {}),
    ...(pass ? { 'X-Pulse-Pass': pass } : {}),
    ...options.headers,
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    auth.clear()
    window.location.reload()
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  auth: {
    status: () => request('/auth/status'),
    verify: () => request('/auth/verify'),
    setup: (key) => request('/auth/setup', { method: 'POST', body: JSON.stringify({ key }) }),
    login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    setupUser: (username, password, display_name) => request('/auth/setup-user', { method: 'POST', body: JSON.stringify({ username, password, display_name }) }),
  },

  // Users (admin only)
  users: {
    list: () => request('/users/'),
    create: (username, password, role) => request('/users/', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
    update: (username, data) => request(`/users/${username}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (username) => request(`/users/${username}`, { method: 'DELETE' }),
  },

  // Containers
  containers: {
    list: (all = true) => request(`/containers/?all=${all}`),
    get: (id) => request(`/containers/${id}`),
    start: (id) => request(`/containers/${id}/start`, { method: 'POST' }),
    stop: (id) => request(`/containers/${id}/stop`, { method: 'POST' }),
    restart: (id) => request(`/containers/${id}/restart`, { method: 'POST' }),
    remove: (id, force = false) => request(`/containers/${id}?force=${force}`, { method: 'DELETE' }),
    logs: (id, tail = 100) => request(`/logs/${id}?tail=${tail}`),
    config: (id) => request(`/containers/${id}/config`),
    updateConfig: (id, env, restart_policy) =>
      request(`/containers/${id}/config`, {
        method: 'PUT',
        body: JSON.stringify({ env, restart_policy }),
      }),
  },

  // Apps
  apps: {
    templates: () => request('/apps/templates'),
    template: (id) => request(`/apps/templates/${id}`),
    installed: () => request('/apps/installed'),
    install: (id, env = {}) =>
      request(`/apps/install/${id}`, {
        method: 'POST',
        body: JSON.stringify({ env_overrides: env }),
      }),
    uninstall: (id, removeData = false) =>
      request(`/apps/uninstall/${id}?remove_data=${removeData}`, { method: 'DELETE' }),
    start: (id) => request(`/apps/installed/${id}/start`, { method: 'POST' }),
    stop: (id) => request(`/apps/installed/${id}/stop`, { method: 'POST' }),
    restart: (id) => request(`/apps/installed/${id}/restart`, { method: 'POST' }),
    update: (id) => request(`/apps/installed/${id}/update`, { method: 'POST' }),
    refreshStore: () => request('/apps/store/refresh'),
    reconfigure: (id, env) =>
      request(`/apps/installed/${id}/reconfigure`, {
        method: 'PUT',
        body: JSON.stringify({ env }),
      }),
    customInstall: (config) =>
      request('/apps/custom-install', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  },

  // Metrics
  metrics: {
    system: () => request('/metrics/system'),
    container: (id) => request(`/metrics/container/${id}`),
  },

  // System
  system: {
    info: () => request('/system/info'),
    networks: () => request('/system/networks'),
    images: () => request('/system/images'),
  },

  // Groups
  groups: {
    list: () => request('/groups/'),
    start: (project) => request(`/groups/${encodeURIComponent(project)}/start`, { method: 'POST' }),
    stop: (project) => request(`/groups/${encodeURIComponent(project)}/stop`, { method: 'POST' }),
    restart: (project) => request(`/groups/${encodeURIComponent(project)}/restart`, { method: 'POST' }),
  },

  // Storage
  storage: {
    info: () => request('/storage/'),
    disks: () => request('/storage/disks'),
    volumes: () => request('/storage/volumes'),
  },

  // Files
  files: {
    roots: () => request('/files/roots'),
    browse: (path) => request(`/files/browse?path=${encodeURIComponent(path)}`),
    mkdir: (path) => request('/files/mkdir', { method: 'POST', body: JSON.stringify({ path }) }),
    delete: (path) => request(`/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
    rename: (path, new_name) => request('/files/rename', { method: 'POST', body: JSON.stringify({ path, new_name }) }),
    read: (path) => request(`/files/read?path=${encodeURIComponent(path)}`),
    writeText: (path, content) =>
      request('/files/write', { method: 'PUT', body: JSON.stringify({ path, content }) }),
    copy: (src, dest_dir) =>
      request('/files/copy', { method: 'POST', body: JSON.stringify({ src, dest_dir }) }),
    move: (src, dest_dir) =>
      request('/files/move', { method: 'POST', body: JSON.stringify({ src, dest_dir }) }),
    downloadUrl: (path) => `/api/files/download?path=${encodeURIComponent(path)}`,
  },

}

// WebSocket helpers — inject auth as query params (headers not supported by browsers for WS)
function wsUrl(path) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const params = new URLSearchParams()
  const key  = auth.getKey()
  const user = auth.getUser()
  const pass = auth.getPass()
  if (key)  params.set('key',  key)
  if (user) params.set('user', user.username)
  if (pass) params.set('pass', pass)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return `${protocol}://${location.host}/api${path}${qs}`
}

export function metricsSocket(onMessage) {
  const ws = new WebSocket(wsUrl('/metrics/ws'))
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  return ws
}

export function logsSocket(containerId, onMessage) {
  const ws = new WebSocket(wsUrl(`/logs/ws/${containerId}`))
  ws.onmessage = (e) => onMessage(e.data)
  return ws
}

export function terminalSocket() {
  return new WebSocket(wsUrl('/terminal/ws'))
}
