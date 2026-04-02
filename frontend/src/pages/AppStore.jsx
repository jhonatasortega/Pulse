import { useEffect, useState } from 'react'
import { api } from '../api'
import { memCache, bust } from '../cache'
import {
  Download, Trash2, Play, Square, RefreshCw, Package,
  Settings, ArrowUpCircle, X, Search, Plus, PlusCircle,
  Store, ToggleLeft, ToggleRight, ExternalLink,
} from 'lucide-react'

const categoryColors = {
  web: 'bg-blue-500/10 text-blue-400',
  management: 'bg-purple-500/10 text-purple-400',
  monitoring: 'bg-green-500/10 text-green-400',
  tools: 'bg-orange-500/10 text-orange-400',
  media: 'bg-pink-500/10 text-pink-400',
  store: 'bg-cyan-500/10 text-cyan-400',
}

const emojiMap = {
  plex: '🎬', nginx: '🌐', portainer: '🐳', jellyfin: '🎵',
  nextcloud: '☁️', sonarr: '📺', radarr: '🎥', prowlarr: '🔍',
  filebrowser: '📁', 'uptime-kuma': '📊', adguard: '🛡️',
  transmission: '⬇️', ghost: '👻', watchtower: '🔭', bazarr: '💬',
  lidarr: '🎧', speedtest: '⚡', stirling: '📄', changedetection: '🔔',
  chatpad: '💬', unmanic: '🔄', pihole: '🛡️',
}

function getEmoji(template) {
  const key = Object.keys(emojiMap).find(k =>
    template.id?.toLowerCase().includes(k) || template.name?.toLowerCase().includes(k)
  )
  return emojiMap[key] || template.icon || '📦'
}

function AppIcon({ template, size = 'lg' }) {
  const [imgErr, setImgErr] = useState(false)
  const s = size === 'lg' ? 'w-14 h-14 text-3xl' : 'w-10 h-10 text-xl'
  if (template.icon_url && !imgErr) {
    return (
      <img src={template.icon_url} alt={template.name} onError={() => setImgErr(true)}
        className={`${s} rounded-2xl object-cover bg-[#2a2d3e]`} />
    )
  }
  return (
    <div className={`${s} rounded-2xl bg-gradient-to-br from-[#2a2d3e] to-[#1a1d27] flex items-center justify-center`}>
      {getEmoji(template)}
    </div>
  )
}

// ─── generic modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="absolute inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className={`bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} my-4 flex-shrink-0`}>
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-center justify-between sticky top-0 bg-[#1a1d27] rounded-t-xl z-10">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── helpers to build compose yaml from template ─────────────────────────────
function templateToComposeYaml(template) {
  const d = template.docker || {}
  const svcName = (template.name || 'app').toLowerCase().replace(/[^a-z0-9]/g, '_')
  const ports   = (d.ports  || []).map(p => `      - "${p}"`).join('\n')
  const volumes = (d.volumes|| []).map(v => `      - ${v}`).join('\n')
  const envLines = (d.env   || []).map(e => `      - ${e}`).join('\n')
  return [
    `services:`,
    `  ${svcName}:`,
    `    image: ${d.image || 'image:latest'}`,
    `    container_name: ${svcName}`,
    `    restart: ${d.restart || 'unless-stopped'}`,
    ports   ? `    ports:\n${ports}`   : null,
    volumes ? `    volumes:\n${volumes}` : null,
    envLines? `    environment:\n${envLines}` : null,
  ].filter(Boolean).join('\n')
}

// ─── install modal (template-based) ──────────────────────────────────────────
function InstallModal({ template, onClose, onDone }) {
  const [mode, setMode]       = useState('form') // 'form' | 'compose'
  const [fields, setFields]   = useState(() => {
    const init = {}
    ;(template.docker?.env || []).forEach(e => {
      if (e.includes('=')) { const [k, v] = e.split('=', 2); init[k] = v }
    })
    return init
  })
  const [composeYaml, setComposeYaml] = useState(() => templateToComposeYaml(template))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const envDefs = template.docker?.env || []

  async function submitForm(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { await api.apps.install(template.id, fields); onDone() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function submitCompose(e) {
    e.preventDefault()
    // Parse the edited compose and send as customInstall
    const parsed = parseCompose(composeYaml)
    if (!parsed.image) { setError('Imagem não encontrada no compose'); return }
    setLoading(true); setError('')
    try {
      await api.apps.customInstall({
        image: parsed.image, tag: parsed.tag || 'latest',
        name: parsed.name || template.name,
        icon_url: template.icon_url || '',
        network: parsed.network || 'bridge',
        restart: parsed.restart || 'unless-stopped',
        webui_port: '', webui_path: '/',
        ports:   parsed.ports.map(p => ({ host: p.host, container: p.container, protocol: 'tcp' })),
        volumes: parsed.volumes.map(v => ({ host: v.host, container: v.container, mode: 'rw' })),
        env:     parsed.env.map(ev => ({ key: ev.key, value: ev.value })),
      })
      onDone()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Modal title={`Instalar ${template.name}`} onClose={onClose} wide>
      {/* Mode tabs */}
      <div className="flex gap-1 bg-[#0f1117] border border-[#2a2d3e] rounded-xl p-1 mb-4 w-fit">
        {[{ id: 'form', label: 'Configurar' }, { id: 'compose', label: 'Editar docker-compose' }].map(t => (
          <button key={t.id} onClick={() => { setMode(t.id); if (t.id === 'compose') setComposeYaml(templateToComposeYaml(template)) }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${mode === t.id ? 'bg-[#6366f1] text-white' : 'text-[#94a3b8] hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {mode === 'form' ? (
        <form onSubmit={submitForm} className="space-y-4">
          {envDefs.length > 0 ? (
            <>
              <p className="text-xs text-[#64748b]">Variáveis de ambiente</p>
              {envDefs.map(e => {
                if (!e.includes('=')) return null
                const [k] = e.split('=', 1)
                return (
                  <div key={k}>
                    <label className="text-xs text-[#94a3b8] mb-1 block font-mono">{k}</label>
                    <input value={fields[k] ?? ''} onChange={ev => setFields(f => ({ ...f, [k]: ev.target.value }))}
                      className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]" />
                  </div>
                )
              })}
            </>
          ) : (
            <p className="text-xs text-[#64748b]">Este app não requer configuração. Clique em "Editar docker-compose" para personalizar.</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] disabled:opacity-40">
            {loading ? 'Instalando...' : 'Instalar'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCompose} className="space-y-4">
          <p className="text-xs text-[#64748b]">Edite o docker-compose abaixo antes de instalar. As alterações serão aplicadas.</p>
          <textarea value={composeYaml} onChange={e => setComposeYaml(e.target.value)}
            rows={18}
            className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-xs font-mono rounded-lg px-3 py-3 resize-none focus:outline-none focus:border-[#6366f1] leading-relaxed"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] disabled:opacity-40">
            {loading ? 'Instalando...' : 'Instalar com este compose'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── reconfigure modal (reads live container config) ─────────────────────────
function ReconfigureModal({ installed, onClose, onDone }) {
  const [envRows, setEnvRows] = useState([])
  const [restart, setRestart] = useState('unless-stopped')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.containers.config(installed.container_name)
      .then(cfg => {
        setEnvRows(Object.entries(cfg.env).map(([k, v]) => ({ k, v })))
        setRestart(cfg.restart_policy)
        setLoading(false)
      })
      .catch(() => {
        // fallback to template env defs
        const rows = []
        ;(installed.template?.docker?.env || []).forEach(e => {
          if (e.includes('=')) {
            const [k, v] = e.split('=', 2)
            rows.push({ k, v: installed.env_overrides?.[k] ?? v })
          }
        })
        setEnvRows(rows)
        setLoading(false)
      })
  }, [installed])

  function setRow(i, field, val) {
    setEnvRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const env = {}
      envRows.forEach(({ k, v }) => { if (k.trim()) env[k.trim()] = v })
      await api.containers.updateConfig(installed.container_name, env, restart)
      onDone(); onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Configurar ${installed.name}`} onClose={onClose}>
      {loading ? (
        <div className="py-8 text-center text-[#64748b] text-sm">Carregando configuração...</div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium block mb-2">Restart Policy</label>
            <select value={restart} onChange={e => setRestart(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2">
              <option value="no">no</option>
              <option value="always">always</option>
              <option value="unless-stopped">unless-stopped</option>
              <option value="on-failure">on-failure</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Variáveis de Ambiente</label>
              <button onClick={() => setEnvRows(r => [...r, { k: '', v: '' }])}
                className="text-xs text-indigo-400 hover:text-indigo-300">+ Adicionar</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {envRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input value={row.k} onChange={e => setRow(i, 'k', e.target.value)} placeholder="KEY"
                    className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono" />
                  <input value={row.v} onChange={e => setRow(i, 'v', e.target.value)} placeholder="value"
                    className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono" />
                  <button onClick={() => setEnvRows(r => r.filter((_, idx) => idx !== i))}
                    className="text-[#64748b] hover:text-red-400 px-1"><X size={14} /></button>
                </div>
              ))}
              {envRows.length === 0 && <p className="text-xs text-[#475569]">Nenhuma variável.</p>}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-xs text-yellow-400/80">⚠ O container será parado e recriado.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg text-sm hover:text-white">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm hover:bg-[#4f46e5] disabled:opacity-40">
              {saving ? 'Salvando...' : 'Aplicar e Recriar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── manual install modal (CasaOS-style) ─────────────────────────────────────
function ListField({ label, items, onChange, fields, placeholders }) {
  function add() { onChange([...items, Object.fromEntries(fields.map(f => [f, '']))]) }
  function remove(i) { onChange(items.filter((_, idx) => idx !== i)) }
  function set(i, field, val) { onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item)) }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium">{label}</label>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
          <Plus size={12} />Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            {fields.map(f => (
              <input key={f} value={item[f]} onChange={e => set(i, f, e.target.value)}
                placeholder={placeholders?.[f] || f}
                className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-2 py-1.5 font-mono" />
            ))}
            <button type="button" onClick={() => remove(i)} className="text-[#64748b] hover:text-red-400"><X size={13} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-[#475569]">Nenhum configurado.</p>}
      </div>
    </div>
  )
}

// ─── docker-compose parser (basic) ────────────────────────────────────────────
function parseCompose(text) {
  const result = { image: '', tag: 'latest', name: '', ports: [], volumes: [], env: [], network: 'bridge', restart: 'unless-stopped' }
  if (!text) return result

  // image: image:tag
  const imgMatch = text.match(/^\s*image:\s*([^\s#\n]+)/m)
  if (imgMatch) {
    const full = imgMatch[1].trim()
    const colonIdx = full.lastIndexOf(':')
    if (colonIdx > 0 && !full.includes('/') || (colonIdx > full.lastIndexOf('/'))) {
      result.image = full.substring(0, colonIdx)
      result.tag   = full.substring(colonIdx + 1)
    } else {
      result.image = full
    }
  }

  // container_name
  const nameMatch = text.match(/^\s*container_name:\s*([^\s#\n]+)/m)
  if (nameMatch) result.name = nameMatch[1].trim()

  // restart
  const restartMatch = text.match(/^\s*restart:\s*([^\s#\n]+)/m)
  if (restartMatch) result.restart = restartMatch[1].trim()

  // network_mode: host
  if (/network_mode:\s*host/.test(text)) result.network = 'host'

  // ports: - "8080:80" or - 8080:80
  const portsSection = text.match(/^\s*ports:\s*\n((?:\s+-[^\n]+\n?)*)/m)
  if (portsSection) {
    const lines = portsSection[1].split('\n')
    lines.forEach(l => {
      const m = l.match(/-\s*["']?(\d+):(\d+)["']?/)
      if (m) result.ports.push({ host: m[1], container: m[2], protocol: 'tcp' })
    })
  }

  // volumes: - /host:/container
  const volSection = text.match(/^\s*volumes:\s*\n((?:\s+-[^\n]+\n?)*)/m)
  if (volSection) {
    const lines = volSection[1].split('\n')
    lines.forEach(l => {
      const m = l.match(/-\s*["']?([^:'"]+):([^:'"#\s]+)["']?/)
      if (m && m[1] && m[2]) result.volumes.push({ host: m[1].trim(), container: m[2].trim() })
    })
  }

  // environment: - KEY=VALUE  or  KEY: VALUE
  const envSection = text.match(/^\s*environment:\s*\n((?:\s+[^\n]+\n?)*)/m)
  if (envSection) {
    const lines = envSection[1].split('\n')
    lines.forEach(l => {
      // list form: - KEY=VALUE
      let m = l.match(/-\s*([\w]+)=(.*)/)
      if (m) { result.env.push({ key: m[1].trim(), value: m[2].trim() }); return }
      // map form: KEY: VALUE
      m = l.match(/^\s+([\w]+):\s*(.*)/)
      if (m && m[1] !== 'image' && m[1] !== 'restart') result.env.push({ key: m[1].trim(), value: m[2].trim() })
    })
  }

  return result
}

function ManualInstallModal({ onClose, onDone }) {
  const [tab, setTab] = useState('form') // 'form' | 'compose'
  const [composeText, setComposeText] = useState('')
  const [form, setForm] = useState({
    image: '', tag: 'latest', name: '', icon_url: '',
    network: 'bridge', restart: 'unless-stopped',
    webui_port: '', webui_path: '/',
  })
  const [ports, setPorts] = useState([])
  const [volumes, setVolumes] = useState([])
  const [env, setEnv] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [iconErr, setIconErr] = useState(false)

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function applyCompose() {
    const parsed = parseCompose(composeText)
    setForm(f => ({
      ...f,
      image:   parsed.image   || f.image,
      tag:     parsed.tag     || f.tag,
      name:    parsed.name    || f.name,
      network: parsed.network || f.network,
      restart: parsed.restart || f.restart,
    }))
    if (parsed.ports.length)   setPorts(parsed.ports)
    if (parsed.volumes.length) setVolumes(parsed.volumes)
    if (parsed.env.length)     setEnv(parsed.env)
    setTab('form')
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.image.trim() || !form.name.trim()) { setError('Imagem e nome são obrigatórios'); return }
    setLoading(true); setError('')
    try {
      await api.apps.customInstall({
        ...form,
        ports: ports.map(p => ({ host: p.host, container: p.container, protocol: p.protocol || 'tcp' })),
        volumes: volumes.map(v => ({ host: v.host, container: v.container, mode: v.mode || 'rw' })),
        env: env.map(e => ({ key: e.key, value: e.value })),
      })
      onDone(); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const inp = "w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"

  return (
    <Modal title="Instalar app manualmente" onClose={onClose} wide>
      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1117] border border-[#2a2d3e] rounded-xl p-1 mb-5 w-fit">
        {[{ id: 'form', label: 'Preencher manualmente' }, { id: 'compose', label: 'Colar docker-compose' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${tab === t.id ? 'bg-[#6366f1] text-white' : 'text-[#94a3b8] hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'compose' ? (
        <div className="space-y-4">
          <p className="text-xs text-[#64748b]">Cole seu arquivo <code className="text-indigo-400">docker-compose.yml</code> abaixo. Os campos serão preenchidos automaticamente.</p>
          <textarea value={composeText} onChange={e => setComposeText(e.target.value)}
            rows={16}
            placeholder={`version: "3"\nservices:\n  myapp:\n    image: myimage:latest\n    container_name: myapp\n    ports:\n      - "8080:80"\n    volumes:\n      - ./data:/data\n    environment:\n      - MY_VAR=value\n    restart: unless-stopped`}
            className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-xs font-mono rounded-lg px-3 py-3 resize-none focus:outline-none focus:border-[#6366f1]"
          />
          <button onClick={applyCompose} disabled={!composeText.trim()}
            className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] disabled:opacity-40">
            Importar e preencher formulário →
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {/* Image + tag */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[#64748b] block mb-1">Docker Image *</label>
              <input value={form.image} onChange={e => setF('image', e.target.value)}
                placeholder="ghcr.io/owner/app" className={inp} />
            </div>
            <div className="w-28">
              <label className="text-xs text-[#64748b] block mb-1">Tag</label>
              <input value={form.tag} onChange={e => setF('tag', e.target.value)}
                placeholder="latest" className={inp} />
            </div>
          </div>

          {/* Name + icon */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-[#64748b] block mb-1">Nome do App *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)}
                placeholder="meu-app" className={inp} />
            </div>
            <div className="flex items-center gap-2">
              {form.icon_url && !iconErr && (
                <img src={form.icon_url} onError={() => setIconErr(true)}
                  className="w-9 h-9 rounded-xl object-cover bg-[#2a2d3e]" />
              )}
            </div>
          </div>

          {/* Icon URL */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">Icon URL</label>
            <input value={form.icon_url} onChange={e => { setF('icon_url', e.target.value); setIconErr(false) }}
              placeholder="https://..." className={inp} />
          </div>

          {/* Web UI */}
          <div>
            <label className="text-xs text-[#64748b] block mb-1">Web UI</label>
            <div className="flex gap-2">
              <select value={form.network === 'host' ? 'host' : 'http'}
                className="bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-2 py-2 w-20">
                <option value="http">http://</option>
                <option value="https">https://</option>
              </select>
              <input value={form.webui_port} onChange={e => setF('webui_port', e.target.value)}
                placeholder="Porta" className="w-24 bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2" />
              <input value={form.webui_path} onChange={e => setF('webui_path', e.target.value)}
                placeholder="/" className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Network + restart */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[#64748b] block mb-1">Network</label>
              <select value={form.network} onChange={e => setF('network', e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2">
                <option value="bridge">bridge</option>
                <option value="host">host</option>
                <option value="none">none</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#64748b] block mb-1">Restart</label>
              <select value={form.restart} onChange={e => setF('restart', e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2">
                <option value="unless-stopped">unless-stopped</option>
                <option value="always">always</option>
                <option value="on-failure">on-failure</option>
                <option value="no">no</option>
              </select>
            </div>
          </div>

          {/* Ports */}
          <ListField label="Ports" items={ports} onChange={setPorts}
            fields={['host', 'container', 'protocol']}
            placeholders={{ host: 'Host', container: 'Container', protocol: 'tcp' }} />

          {/* Volumes */}
          <ListField label="Volumes" items={volumes} onChange={setVolumes}
            fields={['host', 'container']}
            placeholders={{ host: '/host/path', container: '/container/path' }} />

          {/* Env vars */}
          <ListField label="Environment Variables" items={env} onChange={setEnv}
            fields={['key', 'value']}
            placeholders={{ key: 'KEY', value: 'value' }} />

          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] disabled:opacity-40">
            {loading ? 'Instalando (pode demorar)...' : 'Instalar'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── Store Manager Modal ──────────────────────────────────────────────────────
function StoreManagerModal({ onClose, onRefresh }) {
  const [stores, setStores]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [newStore, setNewStore] = useState({ id: '', name: '', url: '' })
  const [refreshing, setRefreshing] = useState({})

  async function loadStores() {
    setLoading(true)
    try { setStores(await api.stores.list()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadStores() }, [])

  async function toggle(store) {
    await api.stores.toggle(store.id, !store.enabled)
    loadStores()
  }

  async function remove(id) {
    if (!confirm(`Remover loja "${id}"?`)) return
    await api.stores.remove(id)
    loadStores()
  }

  async function refreshOne(id) {
    setRefreshing(r => ({ ...r, [id]: true }))
    try { await api.stores.refresh(id); bust('store_templates'); onRefresh() }
    catch (e) { alert(e.message) }
    finally { setRefreshing(r => ({ ...r, [id]: false })) }
  }

  async function addStore(e) {
    e.preventDefault()
    const id = newStore.id || newStore.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    try {
      await api.stores.add({ ...newStore, id })
      setNewStore({ id: '', name: '', url: '' })
      setAddOpen(false)
      loadStores()
    } catch (err) { alert(err.message) }
  }

  const inp = "w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"

  return (
    <Modal title="Gerenciar Lojas" onClose={onClose} wide>
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-[#64748b] text-sm">Carregando...</div>
        ) : stores.map(store => (
          <div key={store.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${store.enabled ? 'bg-[#0f1117] border-[#2a2d3e]' : 'bg-[#0f1117]/50 border-[#2a2d3e]/50 opacity-60'}`}>
            <Store size={16} className="text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{store.name}</p>
              <p className="text-[10px] text-[#64748b] truncate">{store.url}</p>
            </div>
            <button onClick={() => refreshOne(store.id)} disabled={refreshing[store.id]}
              title="Atualizar" className="p-1.5 text-[#64748b] hover:text-white disabled:opacity-40">
              <RefreshCw size={13} className={refreshing[store.id] ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => toggle(store)} title={store.enabled ? 'Desativar' : 'Ativar'}>
              {store.enabled
                ? <ToggleRight size={20} className="text-indigo-400" />
                : <ToggleLeft size={20} className="text-[#64748b]" />}
            </button>
            <button onClick={() => remove(store.id)} className="p-1.5 text-[#64748b] hover:text-red-400">
              <X size={13} />
            </button>
          </div>
        ))}

        {/* Add store form */}
        {addOpen ? (
          <form onSubmit={addStore} className="border border-indigo-500/30 rounded-xl p-3 space-y-2 bg-indigo-500/5">
            <p className="text-xs font-medium text-indigo-300">Nova loja (ZIP)</p>
            <input value={newStore.name} onChange={e => setNewStore(s => ({ ...s, name: e.target.value }))}
              placeholder="Nome da loja" className={inp} />
            <input value={newStore.url} onChange={e => setNewStore(s => ({ ...s, url: e.target.value }))}
              placeholder="URL do arquivo .zip" className={inp} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddOpen(false)}
                className="flex-1 py-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg text-xs hover:text-white">Cancelar</button>
              <button type="submit" disabled={!newStore.name || !newStore.url}
                className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-500 disabled:opacity-40">Adicionar</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAddOpen(true)}
            className="w-full py-2 border border-dashed border-[#2a2d3e] rounded-xl text-xs text-[#64748b] hover:text-white hover:border-white/20 transition-colors flex items-center justify-center gap-2">
            <Plus size={13} />Adicionar loja
          </button>
        )}
      </div>
    </Modal>
  )
}

// ─── App Card ─────────────────────────────────────────────────────────────────
function AppCard({ template, installed, onInstall, onUninstall, onStart, onStop, onUpdate, onConfigure, busy }) {
  const isInstalled = !!installed
  const status = installed?.status
  const storeName = template.store_name || template.source || template.category || 'local'

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#3a3d4e] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AppIcon template={template} />
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm leading-tight">{template.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block ${categoryColors[template.category] || 'bg-[#2a2d3e] text-[#94a3b8]'}`}>
              {storeName}
            </span>
          </div>
        </div>
        {isInstalled && (
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
            status === 'running' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' :
            status === 'exited'  ? 'bg-red-400' : 'bg-yellow-400'
          }`} />
        )}
      </div>
      <p className="text-xs text-[#64748b] leading-relaxed flex-1 line-clamp-2">{template.description}</p>
      <div className="flex items-center justify-between pt-1 border-t border-[#2a2d3e]">
        <span className="text-xs text-[#64748b]">v{template.version}</span>
        <div className="flex items-center gap-1">
          {!isInstalled ? (
            <button onClick={() => onInstall(template)} disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1] text-white text-xs rounded-lg hover:bg-[#4f46e5] disabled:opacity-40">
              <Download size={12} />Instalar
            </button>
          ) : (
            <>
              {status !== 'running' && (
                <button onClick={() => onStart(template.id)} disabled={busy} title="Iniciar"
                  className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-40"><Play size={13} /></button>
              )}
              {status === 'running' && (
                <button onClick={() => onStop(template.id)} disabled={busy} title="Parar"
                  className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"><Square size={13} /></button>
              )}
              <button onClick={() => onConfigure(installed)} disabled={busy} title="Configurar"
                className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#2a2d3e] hover:text-white disabled:opacity-40"><Settings size={13} /></button>
              <button onClick={() => onUpdate(template.id)} disabled={busy} title="Atualizar"
                className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"><ArrowUpCircle size={13} /></button>
              <button onClick={() => onUninstall(template.id)} disabled={busy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 disabled:opacity-40">
                <Trash2 size={12} />Remover
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000

export default function AppStore() {
  const [templates, setTemplates]           = useState([])
  const [installed, setInstalled]           = useState({})
  const [stores, setStores]                 = useState([])
  const [busy, setBusy]                     = useState({})
  const [loading, setLoading]               = useState(true)
  const [filter, setFilter]                 = useState('')
  const [storeTab, setStoreTab]             = useState('all')   // 'all' | 'installed' | 'local' | store_id
  const [installModal, setInstallModal]     = useState(null)
  const [configModal, setConfigModal]       = useState(null)
  const [manualInstallOpen, setManualInstallOpen] = useState(false)
  const [storeManagerOpen, setStoreManagerOpen]   = useState(false)

  async function loadStores() {
    try { setStores(await api.stores.list()) } catch (e) { console.error(e) }
  }

  async function load(force = false) {
    setLoading(true)
    try {
      if (force) bust('store_templates', 'store_installed')
      const [tmpl, inst] = await Promise.all([
        memCache('store_templates', CACHE_TTL, api.apps.templates),
        memCache('store_installed', 10_000, api.apps.installed),
      ])
      setTemplates(tmpl)
      const map = {}
      inst.forEach(a => { map[a.id] = a })
      setInstalled(map)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load(); loadStores() }, [])

  async function act(id, fn) {
    setBusy(b => ({ ...b, [id]: true }))
    try { bust('store_installed'); await fn(); await load(false) }
    catch (e) { alert(e.message) }
    finally { setBusy(b => ({ ...b, [id]: false })) }
  }

  async function handleRefreshAll() {
    setLoading(true)
    bust('store_templates', 'store_installed')
    try { await api.stores.refreshAll(); await load(true) }
    catch (e) { console.error(e); setLoading(false) }
  }

  // Build tabs: fixed tabs + one per store
  const fixedTabs = [
    { id: 'all',       label: 'Todos' },
    { id: 'installed', label: 'Instalados' },
    { id: 'local',     label: 'Local' },
  ]
  const storeTabs = stores.filter(s => s.enabled).map(s => ({ id: s.id, label: s.name }))
  const allTabs = [...fixedTabs, ...storeTabs]

  const filtered = templates.filter(t => {
    const q = filter.toLowerCase()
    const match = t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    if (storeTab === 'installed') return match && installed[t.id]
    if (storeTab === 'local')     return match && !t.source
    if (storeTab === 'all')       return match
    // store tab: filter by source or category matching store id
    return match && (t.source === storeTab || t.category === storeTab)
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">App Store</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">
            {Object.keys(installed).length} instalados · {templates.length} disponíveis · {stores.filter(s => s.enabled).length} lojas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStoreManagerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-xs transition-colors">
            <Store size={13} />Lojas
          </button>
          <button onClick={() => setManualInstallOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] text-xs transition-colors">
            <PlusCircle size={13} />Instalar Manualmente
          </button>
          <button onClick={handleRefreshAll}
            className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-xs transition-colors">
            <RefreshCw size={13} />Atualizar
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
        <input type="text" placeholder="Buscar apps..." value={filter} onChange={e => setFilter(e.target.value)}
          className="w-full bg-[#1a1d27] border border-[#2a2d3e] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#64748b] focus:outline-none focus:border-[#6366f1]" />
      </div>

      {/* Store tabs — scrollable */}
      <div className="flex gap-1 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-1 overflow-x-auto">
        {allTabs.map(t => (
          <button key={t.id} onClick={() => setStoreTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 ${storeTab === t.id ? 'bg-[#6366f1] text-white' : 'text-[#94a3b8] hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[#64748b]">
          <RefreshCw size={24} className="animate-spin opacity-40" />
          <p className="text-sm">Carregando lojas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => (
            <AppCard key={t.id} template={t} installed={installed[t.id]}
              onInstall={setInstallModal}
              onUninstall={(id) => act(id, () => api.apps.uninstall(id))}
              onStart={(id) => act(id, () => api.apps.start(id))}
              onStop={(id) => act(id, () => api.apps.stop(id))}
              onUpdate={(id) => { if (confirm(`Atualizar "${id}"?`)) act(id, () => api.apps.update(id)) }}
              onConfigure={setConfigModal}
              busy={busy[t.id]}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-[#64748b] py-12">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              Nenhum app encontrado
            </div>
          )}
        </div>
      )}

      {installModal && (
        <InstallModal template={installModal} onClose={() => setInstallModal(null)}
          onDone={() => { setInstallModal(null); bust('store_installed'); load() }} />
      )}
      {configModal && (
        <ReconfigureModal installed={configModal} onClose={() => setConfigModal(null)}
          onDone={() => { setConfigModal(null); bust('store_installed'); load() }} />
      )}
      {manualInstallOpen && (
        <ManualInstallModal onClose={() => setManualInstallOpen(false)}
          onDone={() => { setManualInstallOpen(false); bust('store_installed'); load() }} />
      )}
      {storeManagerOpen && (
        <StoreManagerModal onClose={() => { setStoreManagerOpen(false); loadStores() }}
          onRefresh={() => load(true)} />
      )}
    </div>
  )
}
