import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, metricsSocket } from '../api'
import { memCache, bust } from '../cache'
import { auth } from '../auth'
import { Play, Square, RotateCw, ExternalLink, X, Image, Upload, HardDrive } from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function fmt(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

const iconMap = {
  plex: '🎬', nginx: '🌐', portainer: '🐳', jellyfin: '🎵',
  nextcloud: '☁️', sonarr: '📺', radarr: '🎥', prowlarr: '🔍',
  filebrowser: '📁', 'uptime-kuma': '📊', adguard: '🛡️',
  transmission: '⬇️', ghost: '👻', watchtower: '🔭',
  retrocloud: '🕹️', novelreader: '📖', gopeed: '⚡', retroarch: '🎮',
  emulatorjs: '🕹️', redis: '🗃️', postgres: '🗄️', mysql: '🗄️',
  'home-assistant': '🏠', homeassistant: '🏠', grafana: '📊',
  tailscale: '🔒', pihole: '🚫', vaultwarden: '🔑', bitwarden: '🔑',
  gitea: '🐙', wireguard: '🛡️', nginx: '🌐', caddy: '🌐',
  syncthing: '🔄', immich: '📷', audiobookshelf: '🎧',
}

function groupIcon(name) {
  const key = Object.keys(iconMap).find(k => name.toLowerCase().includes(k))
  return iconMap[key] || '📦'
}


// ─── storage modal (disks only) ───────────────────────────────────────────────
function StorageModal({ onClose }) {
  const [disks, setDisks] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.storage.info()
      .then(d => setDisks(d.disks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function openDisk(mountpoint) {
    onClose()
    navigate('/storage', { state: { browsePath: mountpoint } })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3e]">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-indigo-400" />
            <p className="text-sm font-semibold text-white">Armazenamento</p>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {loading ? (
            <p className="text-center text-[#64748b] py-8">Carregando...</p>
          ) : disks.length === 0 ? (
            <p className="text-center text-[#64748b] py-8">Nenhum disco encontrado</p>
          ) : disks.map((disk, i) => (
            <div key={i} onClick={() => openDisk(disk.mountpoint)}
              className="bg-[#0f1117] border border-[#2a2d3e] rounded-xl p-4 cursor-pointer hover:border-indigo-400/40 hover:bg-indigo-500/5 transition-all group">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{disk.mountpoint}</p>
                    <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">Explorar →</span>
                  </div>
                  <p className="text-xs text-[#64748b]">{disk.device} · {disk.fstype}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  disk.percent > 85 ? 'bg-red-500/10 text-red-400' :
                  disk.percent > 70 ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-indigo-500/10 text-indigo-400'
                }`}>{disk.percent}%</span>
              </div>
              <div className="w-full bg-[#2a2d3e] rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full transition-all ${
                  disk.percent > 85 ? 'bg-red-500' : disk.percent > 70 ? 'bg-yellow-500' : 'bg-indigo-500'
                }`} style={{ width: `${Math.min(disk.percent, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#64748b]">
                <span>{fmt(disk.used)} usado</span>
                <span>{fmt(disk.free)} livre</span>
                <span>{fmt(disk.total)} total</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── wallpaper settings panel ─────────────────────────────────────────────────
const GRADIENT_PRESETS = [
  { label: 'Padrão',      value: '' },
  { label: 'Azul escuro', value: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
  { label: 'Índigo',      value: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' },
  { label: 'Verde',       value: 'linear-gradient(135deg,#0a3d0a,#1a4a1a,#0f2a0f)' },
  { label: 'Roxo',        value: 'linear-gradient(135deg,#2d1b69,#1a0a3e,#0f0520)' },
  { label: 'Crepúsculo',  value: 'linear-gradient(135deg,#1a0533,#2d0d43,#0a1628)' },
]

const IMAGE_PRESETS = [
  {
    label: 'Nebulosa',
    url: 'https://images6.alphacoders.com/109/thumb-1920-1096452.jpg',
  },
  {
    label: 'Floresta',
    url: 'https://th.bing.com/th/id/R.c4948d8a07e11b9c9b01a274a515adb1?rik=PmbX6HqLAhE83A&pid=ImgRaw&r=0',
  },
  {
    label: 'Pôr do sol',
    url: 'https://www.xtrafondos.com/wallpapers/pinos-y-montanas-al-atardecer-5146.jpg',
  },
  {
    label: 'Paisagem',
    url: 'https://images8.alphacoders.com/984/thumb-1920-984617.jpg',
  },
]

function WallpaperPanel({ onClose }) {
  const [url, setUrl]           = useState(localStorage.getItem('pulse_wallpaper_url') || '')
  const [preset, setPreset]     = useState(localStorage.getItem('pulse_wallpaper_preset') || '')
  const [nickName, setNickName] = useState(localStorage.getItem('pulse_display_name') || '')
  const fileRef                 = useRef(null)

  function apply() {
    localStorage.setItem('pulse_wallpaper_url', url)
    localStorage.setItem('pulse_wallpaper_preset', preset)
    if (nickName.trim()) localStorage.setItem('pulse_display_name', nickName.trim())
    else localStorage.removeItem('pulse_display_name')
    window.dispatchEvent(new Event('wallpaper-change'))
    // Persist to server so preferences survive incognito/other devices
    const user = auth.getUser()
    if (user) {
      api.users.savePreferences({
        display_name: nickName.trim(),
        wallpaper_url: url.startsWith('data:') ? '' : url,
        wallpaper_preset: preset,
      }).catch(() => {})
    }
    onClose()
  }
  function clear() {
    localStorage.removeItem('pulse_wallpaper_url')
    localStorage.removeItem('pulse_wallpaper_preset')
    window.dispatchEvent(new Event('wallpaper-change'))
    onClose()
  }

  function pickImagePreset(imgUrl) {
    setUrl(imgUrl)
    setPreset('')
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setUrl(ev.target.result)
      setPreset('')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="absolute top-12 right-0 z-50 w-80 bg-[#1a1d27]/95 backdrop-blur-md border border-[#2a2d3e] rounded-2xl p-4 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Aparência</p>
        <button onClick={onClose} className="text-[#64748b] hover:text-white"><X size={14} /></button>
      </div>

      {/* Image presets thumbnails */}
      <div>
        <p className="text-xs text-[#64748b] mb-2">Fotos</p>
        <div className="grid grid-cols-4 gap-2">
          {IMAGE_PRESETS.map(p => (
            <button key={p.url} onClick={() => pickImagePreset(p.url)} title={p.label}
              className={`h-14 rounded-xl overflow-hidden border-2 transition-all ${url === p.url ? 'border-indigo-400 scale-105' : 'border-transparent opacity-80 hover:opacity-100'}`}
              style={{ backgroundImage: `url(${p.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          ))}
        </div>
      </div>

      {/* Gradient presets */}
      <div>
        <p className="text-xs text-[#64748b] mb-2">Gradientes</p>
        <div className="grid grid-cols-3 gap-2">
          {GRADIENT_PRESETS.map(p => (
            <button key={p.value} onClick={() => { setPreset(p.value); setUrl('') }}
              className={`h-10 rounded-lg text-[10px] text-white border transition-all ${preset === p.value && !url ? 'border-indigo-400' : 'border-[#2a2d3e]'}`}
              style={{ background: p.value || '#0f1117' }}>
              {!p.value && <span className="text-[#64748b]">Padrão</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL */}
      <div>
        <p className="text-xs text-[#64748b] mb-1">URL personalizada</p>
        <input value={url.startsWith('data:') ? '' : url}
          onChange={e => { setUrl(e.target.value); setPreset('') }}
          placeholder="https://..."
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2" />
      </div>

      {/* Upload from PC */}
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileRef.current?.click()}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-all ${url.startsWith('data:') ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10' : 'border-[#2a2d3e] text-[#64748b] hover:text-white hover:border-white/20'}`}>
          <Upload size={12} />
          {url.startsWith('data:') ? 'Imagem do PC selecionada ✓' : 'Enviar do computador'}
        </button>
      </div>

      {/* Display name */}
      <div>
        <p className="text-xs text-[#64748b] mb-1">Seu nome (saudação)</p>
        <input value={nickName} onChange={e => setNickName(e.target.value)}
          placeholder="Ex: João"
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2" />
      </div>

      <div className="flex gap-2">
        <button onClick={clear} className="flex-1 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg text-xs hover:text-white">Limpar</button>
        <button onClick={apply} className="flex-1 py-2 bg-[#6366f1] text-white rounded-lg text-xs hover:bg-[#4f46e5]">Aplicar</button>
      </div>
    </div>
  )
}

// ─── group tile ───────────────────────────────────────────────────────────────
function GroupTile({ group, onStart, onStop, onRestart, busy }) {
  const running = group.status === 'running'
  const partial = group.status === 'partial'
  const navigate = useNavigate()

  const portEntry = Object.entries(group.ports || {})[0]
  const hostPort = portEntry ? portEntry[1]?.[0] : null

  const statusColor = running
    ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
    : partial ? 'bg-yellow-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
    : 'bg-[#475569]'

  const borderColor = running || partial
    ? 'border-[#2a2d3e] hover:border-[#6366f1]/40'
    : 'border-[#2a2d3e]/50 opacity-60'

  return (
    <div className={`group relative bg-[#1a1d27]/80 backdrop-blur-sm border rounded-2xl p-4 flex flex-col items-center gap-3 transition-all w-[120px] h-[148px] flex-shrink-0 ${borderColor}`}>
      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${statusColor}`} />

      {/* Icon → open app */}
      {hostPort && running ? (
        <a href={`http://${location.hostname}:${hostPort}`} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2a2d3e] to-[#1a1d27] flex items-center justify-center text-3xl shadow-inner hover:from-[#6366f1]/20 hover:scale-105 transition-all overflow-hidden">
          {group.icon_url
            ? <img src={group.icon_url} alt={group.display_name} className="w-10 h-10 object-contain rounded-xl" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            : null}
          <span style={{ display: group.icon_url ? 'none' : 'flex' }}>{groupIcon(group.display_name || group.name)}</span>
        </a>
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2a2d3e] to-[#1a1d27] flex items-center justify-center text-3xl shadow-inner overflow-hidden">
          {group.icon_url
            ? <img src={group.icon_url} alt={group.display_name} className="w-10 h-10 object-contain rounded-xl" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            : null}
          <span style={{ display: group.icon_url ? 'none' : 'flex' }}>{groupIcon(group.display_name || group.name)}</span>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs font-semibold text-white leading-tight truncate max-w-[90px]">{group.display_name || group.name}</p>
        <p className={`text-[10px] mt-0.5 ${running ? 'text-green-400' : partial ? 'text-yellow-400' : 'text-[#64748b]'}`}>
          {running ? 'rodando' : partial
            ? `${group.containers.filter(c => c.status === 'running').length}/${group.containers.length}`
            : 'parado'}
        </p>
        {group.source === 'compose' && group.containers.length > 1 && (
          <p className="text-[9px] text-[#475569] mt-0.5">{group.containers.length} serviços</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!running ? (
          <button onClick={e => { e.stopPropagation(); onStart(group.id) }} disabled={busy}
            className="p-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40">
            <Play size={11} />
          </button>
        ) : (
          <button onClick={e => { e.stopPropagation(); onStop(group.id) }} disabled={busy}
            className="p-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40">
            <Square size={11} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onRestart(group.id) }} disabled={busy}
          className="p-1 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40">
          <RotateCw size={11} />
        </button>
        <button onClick={e => { e.stopPropagation(); navigate('/containers', { state: { group: group.id } }) }}
          className="p-1 rounded-lg bg-[#6366f1]/20 text-indigo-400 hover:bg-[#6366f1]/30" title="Ver containers">
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────
function getWallpaper() {
  const url = localStorage.getItem('pulse_wallpaper_url') || ''
  const preset = localStorage.getItem('pulse_wallpaper_preset') || ''
  if (url) return { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
  if (preset) return { background: preset }
  return {}
}

function getDisplayName() {
  const local = localStorage.getItem('pulse_display_name')
  if (local) return local
  return auth.getUser()?.display_name || ''
}

export default function Dashboard() {
  const [groups, setGroups] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [busy, setBusy] = useState({})
  const [wallpaper, setWallpaper] = useState(getWallpaper)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [storageOpen, setStorageOpen] = useState(false)
  const settingsRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handler() { setWallpaper(getWallpaper()) }
    window.addEventListener('wallpaper-change', handler)
    return () => window.removeEventListener('wallpaper-change', handler)
  }, [])

  async function loadGroups(force = false) {
    try {
      if (force) bust('dash_groups')
      const data = await memCache('dash_groups', 5000, api.groups.list)
      setGroups(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    loadGroups()
    const ws = metricsSocket(setMetrics)
    const interval = setInterval(() => loadGroups(), 10000)
    return () => { ws.close(); clearInterval(interval) }
  }, [])

  async function groupAction(id, fn) {
    setBusy(b => ({ ...b, [id]: true }))
    try { bust('dash_groups'); await fn(); await loadGroups(true) }
    catch (e) { alert(e.message) }
    finally { setBusy(b => ({ ...b, [id]: false })) }
  }

  const hasWallpaper = !!(wallpaper.backgroundImage || wallpaper.background)
  const cardClass = hasWallpaper
    ? 'bg-black/30 backdrop-blur-md border-white/10'
    : 'bg-[#1a1d27] border-[#2a2d3e]'

  const runningGroups = groups.filter(g => g.status === 'running' || g.status === 'partial')
  const stoppedGroups = groups.filter(g => g.status === 'stopped')

  return (
    <div className="h-full overflow-y-auto relative">
      {storageOpen && <StorageModal onClose={() => setStorageOpen(false)} />}

      <div className="relative z-10 p-8 space-y-8">
        {/* Header row */}
        <div className="flex items-start justify-between pt-4">
          <p className="text-3xl font-bold text-white drop-shadow">
            {greeting()}{getDisplayName() ? `, ${getDisplayName()}` : ''}.
          </p>
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setSettingsOpen(o => !o)}
              className={`p-2 rounded-xl transition-colors ${settingsOpen ? 'bg-[#6366f1] text-white' : 'bg-black/20 backdrop-blur-sm text-[#94a3b8] hover:text-white'}`}
              title="Aparência">
              <Image size={16} />
            </button>
            {settingsOpen && <WallpaperPanel onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>

        {/* Widgets */}
        {metrics && (
          <div className="flex justify-center gap-4 flex-wrap">
            <div className={`border rounded-2xl px-6 py-4 flex flex-col gap-1 min-w-[150px] ${cardClass}`}>
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider">Armazenamento</p>
              <p className="text-2xl font-bold text-white">{fmt(metrics.disk.used)}</p>
              <p className="text-xs text-[#64748b]">de {fmt(metrics.disk.total)}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full ${metrics.disk.percent > 85 ? 'bg-red-500' : metrics.disk.percent > 70 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                  style={{ width: `${metrics.disk.percent}%` }} />
              </div>
            </div>

            <div className={`border rounded-2xl px-6 py-4 flex items-center gap-6 ${cardClass}`}>
              {Object.keys(metrics.temperatures || {}).length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🌡️</span>
                  <p className="text-xs text-[#64748b]">Temp</p>
                  <p className={`text-sm font-bold ${Object.values(metrics.temperatures)[0] > 80 ? 'text-red-400' : Object.values(metrics.temperatures)[0] > 70 ? 'text-yellow-400' : 'text-white'}`}>
                    {Object.values(metrics.temperatures)[0]}°C
                  </p>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">⚡</span>
                <p className="text-xs text-[#64748b]">CPU</p>
                <p className="text-sm font-bold text-white">{metrics.cpu.percent}%</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">🧠</span>
                <p className="text-xs text-[#64748b]">Memória</p>
                <p className="text-sm font-bold text-white">{metrics.memory.percent}%</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">💾</span>
                <p className="text-xs text-[#64748b]">Disco</p>
                <p className="text-sm font-bold text-white">{metrics.disk.percent}%</p>
              </div>
            </div>

            <div className={`border rounded-2xl px-6 py-4 flex flex-col gap-1 min-w-[150px] ${cardClass}`}>
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wider">Memória</p>
              <p className="text-2xl font-bold text-white">{fmt(metrics.memory.used)}</p>
              <p className="text-xs text-[#64748b]">de {fmt(metrics.memory.total)}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full ${metrics.memory.percent > 90 ? 'bg-red-500' : metrics.memory.percent > 75 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                  style={{ width: `${metrics.memory.percent}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Running apps grid */}
        {runningGroups.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {/* Fixed storage tile */}
            <div onClick={() => setStorageOpen(true)}
              className={`w-[120px] h-[148px] flex-shrink-0 border rounded-2xl p-4 flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-indigo-400/40 ${hasWallpaper ? 'bg-black/30 backdrop-blur-md border-white/10' : 'bg-[#1a1d27] border-[#2a2d3e]'}`}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/20 flex items-center justify-center">
                <HardDrive size={26} className="text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-white leading-tight">Arquivos</p>
                <p className="text-[10px] mt-0.5 text-indigo-400">armazenamento</p>
              </div>
            </div>
            {runningGroups.map(g => (
              <GroupTile key={g.id} group={g} busy={busy[g.id]}
                onStart={id => groupAction(id, () => api.groups.start(id))}
                onStop={id => groupAction(id, () => api.groups.stop(id))}
                onRestart={id => groupAction(id, () => api.groups.restart(id))}
              />
            ))}
            <div onClick={() => navigate('/store')}
              className={`w-[120px] h-[148px] flex-shrink-0 border border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#6366f1]/50 transition-all ${hasWallpaper ? 'bg-black/20 backdrop-blur-sm border-white/20' : 'bg-[#1a1d27] border-[#2a2d3e]'}`}>
              <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[#2a2d3e] flex items-center justify-center text-[#64748b] text-2xl">+</div>
              <p className="text-[10px] text-[#64748b] text-center">Instalar app</p>
            </div>
          </div>
        )}

        {/* Stopped */}
        {stoppedGroups.length > 0 && (
          <div>
            <p className="text-xs text-[#64748b]/80 uppercase tracking-wider mb-3 font-medium drop-shadow">Parados</p>
            <div className="flex flex-wrap gap-3">
              {stoppedGroups.map(g => (
                <GroupTile key={g.id} group={g} busy={busy[g.id]}
                  onStart={id => groupAction(id, () => api.groups.start(id))}
                  onStop={id => groupAction(id, () => api.groups.stop(id))}
                  onRestart={id => groupAction(id, () => api.groups.restart(id))}
                />
              ))}
            </div>
          </div>
        )}

        {groups.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-[#64748b] text-sm drop-shadow">
              Nenhum container.{' '}
              <span className="text-indigo-400 cursor-pointer hover:underline" onClick={() => navigate('/store')}>
                Instale um app
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
