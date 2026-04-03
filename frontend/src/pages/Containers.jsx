import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api, logsSocket, containerTerminalSocket } from '../api'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  Play, Square, RotateCw, Trash2, FileText, RefreshCw, X,
  ChevronDown, ChevronRight, Settings, Layers, TerminalSquare, Globe, Copy, Check,
} from 'lucide-react'

// ─── Status badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    running: 'bg-green-500/10 text-green-400 border-green-500/20',
    exited:  'bg-red-500/10 text-red-400 border-red-500/20',
    paused:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    restarting: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] || 'bg-[#2a2d3e] text-[#94a3b8] border-[#3a3d4e]'}`}>
      {status}
    </span>
  )
}

function GroupBadge({ status, count }) {
  if (status === 'running') return <span className="text-xs text-green-400">{count} rodando</span>
  if (status === 'partial') return <span className="text-xs text-yellow-400">parcial</span>
  return <span className="text-xs text-[#64748b]">parado</span>
}

// ─── Logs tab ──────────────────────────────────────────────────────────────────
function LogsTab({ container }) {
  const [logs, setLogs]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const wsRef  = useRef(null)
  const preRef = useRef(null)

  useEffect(() => {
    api.containers.logs(container.id, 200)
      .then(r => setLogs(r.logs))
      .catch(e => setLogs(`Error: ${e.message}`))
    return () => wsRef.current?.close()
  }, [container.id])

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight
  }, [logs])

  function toggleStream() {
    if (streaming) {
      wsRef.current?.close()
      wsRef.current = null
      setStreaming(false)
    } else {
      setLogs('')
      const ws = logsSocket(container.id, line => setLogs(p => p + line))
      wsRef.current = ws
      setStreaming(true)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2d3e] flex-shrink-0">
        <span className="text-xs text-[#64748b]">últimas 200 linhas</span>
        <button onClick={toggleStream}
          className={`text-xs px-3 py-1 rounded-lg transition-colors ${streaming ? 'bg-red-500/20 text-red-400' : 'bg-[#6366f1]/20 text-indigo-400 hover:bg-[#6366f1]/30'}`}>
          {streaming ? 'Parar stream' : '▶ Stream live'}
        </button>
      </div>
      <pre ref={preRef}
        className="flex-1 overflow-auto p-4 text-xs text-[#94a3b8] font-mono leading-relaxed whitespace-pre-wrap">
        {logs || 'Carregando...'}
      </pre>
    </div>
  )
}

// ─── Config tab ────────────────────────────────────────────────────────────────
function ConfigTab({ container, onSaved }) {
  const [config, setConfig]   = useState(null)
  const [envRows, setEnvRows] = useState([])
  const [restart, setRestart] = useState('unless-stopped')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    api.containers.config(container.id).then(cfg => {
      setConfig(cfg)
      setEnvRows(Object.entries(cfg.env).map(([k, v]) => ({ k, v })))
      setRestart(cfg.restart_policy)
    }).catch(e => alert(e.message))
  }, [container.id])

  function setRow(i, field, val) {
    setEnvRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function save() {
    setSaving(true)
    try {
      const env = {}
      envRows.forEach(({ k, v }) => { if (k.trim()) env[k.trim()] = v })
      await api.containers.updateConfig(container.id, env, restart)
      onSaved()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!config) return <div className="p-8 text-center text-[#64748b] text-sm">Carregando...</div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Image */}
        <div>
          <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium block mb-1">Imagem</label>
          <p className="text-xs text-[#94a3b8] font-mono bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2">{config.image}</p>
        </div>

        {/* Restart policy */}
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

        {/* Env vars */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium">Variáveis de Ambiente</label>
            <button onClick={() => setEnvRows(r => [...r, { k: '', v: '' }])}
              className="text-xs text-indigo-400 hover:text-indigo-300">+ Adicionar</button>
          </div>
          <div className="space-y-2">
            {envRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input value={row.k} onChange={e => setRow(i, 'k', e.target.value)}
                  placeholder="VARIAVEL"
                  className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono" />
                <input value={row.v} onChange={e => setRow(i, 'v', e.target.value)}
                  placeholder="valor"
                  className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono" />
                <button onClick={() => setEnvRows(r => r.filter((_, idx) => idx !== i))}
                  className="text-[#64748b] hover:text-red-400 px-1"><X size={14} /></button>
              </div>
            ))}
            {envRows.length === 0 && <p className="text-xs text-[#475569]">Nenhuma variável configurada.</p>}
          </div>
        </div>

        {/* Volumes */}
        {config.binds.length > 0 && (
          <div>
            <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium block mb-2">Volumes</label>
            <div className="space-y-1">
              {config.binds.map((b, i) => (
                <p key={i} className="text-xs text-[#94a3b8] font-mono bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-1.5">{b}</p>
              ))}
            </div>
          </div>
        )}

        {/* Ports */}
        {Object.keys(config.ports).length > 0 && (
          <div>
            <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium block mb-2">Portas</label>
            <div className="space-y-1">
              {Object.entries(config.ports).map(([k, v]) => (
                <p key={k} className="text-xs text-[#94a3b8] font-mono bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-1.5">{v} → {k}</p>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-[#2a2d3e] flex justify-end gap-3 flex-shrink-0">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar e Recriar'}
        </button>
      </div>
    </div>
  )
}

// ─── Terminal tab ──────────────────────────────────────────────────────────────
function TerminalTab({ container }) {
  const divRef = useRef(null)
  const xtermRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!divRef.current) return

    const term = new XTerm({
      theme: { background: '#0f1117', foreground: '#e2e8f0', cursor: '#6366f1', selectionBackground: '#6366f133' },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(divRef.current)
    fit.fit()
    xtermRef.current = term

    const ws = containerTerminalSocket(container.id)
    wsRef.current = ws

    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
    ws.onmessage = e => {
      if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data))
      else term.write(e.data)
    }
    ws.onclose = () => term.write('\r\n\x1b[33m[Terminal] Conexão encerrada.\x1b[0m\r\n')

    term.onData(data => { if (ws.readyState === 1) ws.send(new TextEncoder().encode(data)) })
    term.onBinary(data => { if (ws.readyState === 1) ws.send(new Uint8Array([...data].map(c => c.charCodeAt(0)))) })

    const obs = new ResizeObserver(() => {
      try { fit.fit(); ws.readyState === 1 && ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })) }
      catch {}
    })
    obs.observe(divRef.current)

    return () => {
      obs.disconnect()
      ws.close()
      term.dispose()
    }
  }, [container.id])

  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
      <div className="px-4 py-2 border-b border-[#2a2d3e] flex-shrink-0">
        <span className="text-xs text-[#64748b]">docker exec → {container.name}</span>
      </div>
      <div ref={divRef} className="flex-1 p-2" />
    </div>
  )
}

// ─── Local domain tab ──────────────────────────────────────────────────────────
function LocalDomainTab({ container }) {
  const [subdomain, setSubdomain] = useState(
    container.name.replace(/^pulse_/, '').replace(/[^a-z0-9]/g, '-').toLowerCase()
  )
  const [copied, setCopied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyStatus, setApplyStatus] = useState(null) // 'ok' | 'error'
  const [applyMsg, setApplyMsg] = useState('')
  const host = location.hostname

  const ports = Object.values(container.ports || {}).flat().filter(Boolean)
  const hostname = `${subdomain}.local`
  const hostsEntry = `${host}  ${hostname}`

  function copy() {
    navigator.clipboard.writeText(hostsEntry)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function applyOnPi() {
    setApplying(true)
    setApplyStatus(null)
    try {
      await api.files.applyHostsEntry(hostname, host)
      setApplyStatus('ok')
      setApplyMsg(`${hostsEntry} adicionado ao /etc/hosts do Pi`)
    } catch (e) {
      setApplyStatus('error')
      setApplyMsg(e.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <label className="text-xs text-[#64748b] block mb-1">Nome local</label>
        <div className="flex gap-2 items-center">
          <input value={subdomain} onChange={e => setSubdomain(e.target.value.replace(/[^a-z0-9-]/g, '').toLowerCase())}
            className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2 font-mono" />
          <span className="text-sm text-[#64748b] font-mono">.local</span>
        </div>
      </div>

      {ports.length > 0 && (
        <div>
          <p className="text-xs text-[#64748b] mb-2">URLs resultantes</p>
          <div className="space-y-1">
            {ports.map(p => (
              <p key={p} className="text-sm text-indigo-400 font-mono bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2">
                http://{hostname}:{p}
              </p>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-[#64748b] mb-1">Entrada no <code className="text-indigo-400">/etc/hosts</code></p>
        <div className="flex gap-2 items-center">
          <code className="flex-1 text-xs text-green-400 bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 font-mono">
            {hostsEntry}
          </code>
          <button onClick={copy}
            className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-500/20 text-green-400' : 'bg-[#2a2d3e] text-[#94a3b8] hover:text-white'}`}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* Apply on Pi */}
      <div className="border border-[#2a2d3e] rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-white">Aplicar no Pi</p>
          <p className="text-xs text-[#64748b] mt-0.5">Adiciona automaticamente ao <code className="text-indigo-400">/etc/hosts</code> do servidor</p>
        </div>
        <button onClick={applyOnPi} disabled={applying || !subdomain}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg disabled:opacity-40 transition-colors">
          {applying ? 'Aplicando...' : `Aplicar ${hostname}`}
        </button>
        {applyStatus === 'ok' && (
          <p className="text-xs text-green-400">{applyMsg}</p>
        )}
        {applyStatus === 'error' && (
          <p className="text-xs text-red-400">{applyMsg}</p>
        )}
        <p className="text-xs text-[#475569]">Para acessar pelo nome no seu PC, adicione também ao <code className="text-[#64748b]">/etc/hosts</code> do seu dispositivo.</p>
      </div>
    </div>
  )
}

// ─── Container drawer ──────────────────────────────────────────────────────────
function ContainerDrawer({ container, onClose, onSaved }) {
  const [tab, setTab] = useState('logs')
  const tabs = [
    { id: 'logs',     label: 'Logs',     icon: FileText },
    { id: 'config',   label: 'Config',   icon: Settings },
    ...(container.status === 'running' ? [{ id: 'terminal', label: 'Terminal', icon: TerminalSquare }] : []),
    { id: 'domain',   label: 'Domínio',  icon: Globe },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-[#13151f] border-l border-[#2a2d3e] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{container.name}</h2>
            <p className="text-xs text-[#64748b] font-mono mt-0.5">{container.image}</p>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-white mt-0.5"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2d3e] flex-shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-[#6366f1] text-white'
                  : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
              }`}>
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'logs'     && <LogsTab container={container} />}
          {tab === 'config'   && <ConfigTab container={container} onSaved={onSaved} />}
          {tab === 'terminal' && <TerminalTab container={container} />}
          {tab === 'domain'   && <LocalDomainTab container={container} />}
        </div>
      </div>
    </div>
  )
}

// ─── Group row ─────────────────────────────────────────────────────────────────
function GroupRow({ group, onOpenDrawer, onContainerAction, busy, autoExpand }) {
  const [expanded, setExpanded] = useState(autoExpand)
  const [groupBusy, setGroupBusy] = useState(false)

  async function doGroupAction(fn) {
    setGroupBusy(true)
    try { await fn() } catch (e) { alert(e.message) }
    finally { setGroupBusy(false) }
  }

  const runningCount = group.containers.filter(c => c.status === 'running').length
  const dotColor = group.status === 'running'
    ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
    : group.status === 'partial' ? 'bg-yellow-400' : 'bg-[#475569]'

  return (
    <>
      <tr className="hover:bg-[#2a2d3e]/30 cursor-pointer transition-colors" onClick={() => setExpanded(e => !e)}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            {expanded ? <ChevronDown size={14} className="text-[#64748b]" /> : <ChevronRight size={14} className="text-[#64748b]" />}
            <span className="font-semibold text-white">{group.display_name || group.name}</span>
            {group.source === 'compose' && <Layers size={12} className="text-[#475569]" />}
          </div>
        </td>
        <td className="px-5 py-3 text-[#64748b] text-xs">
          {group.containers.length} container{group.containers.length > 1 ? 's' : ''}
        </td>
        <td className="px-5 py-3"><GroupBadge status={group.status} count={runningCount} /></td>
        <td className="px-5 py-3 text-[#64748b] text-xs">
          {Object.entries(group.ports || {}).slice(0, 3).map(([k, v]) => (
            <span key={k} className="mr-2">{Array.isArray(v) ? v[0] : v}:{k.split('/')[0]}</span>
          ))}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            {group.status !== 'running' && (
              <button onClick={() => doGroupAction(() => api.groups.start(group.id))} disabled={groupBusy}
                className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-40" title="Iniciar todos">
                <Play size={14} />
              </button>
            )}
            {group.status !== 'stopped' && (
              <button onClick={() => doGroupAction(() => api.groups.stop(group.id))} disabled={groupBusy}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40" title="Parar todos">
                <Square size={14} />
              </button>
            )}
            <button onClick={() => doGroupAction(() => api.groups.restart(group.id))} disabled={groupBusy}
              className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40" title="Reiniciar todos">
              <RotateCw size={14} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && group.containers.map(c => (
        <tr key={c.id} className="bg-[#0f1117]/40 hover:bg-[#2a2d3e]/20 transition-colors cursor-pointer"
          onClick={() => onOpenDrawer(c)}>
          <td className="px-5 py-2.5 pl-14">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                c.status === 'running' ? 'bg-green-400' : c.status === 'exited' ? 'bg-red-400' : 'bg-yellow-400'
              }`} />
              <span className="text-sm text-[#94a3b8]">{c.name}</span>
            </div>
          </td>
          <td className="px-5 py-2.5 text-[#475569] font-mono text-xs">{c.image}</td>
          <td className="px-5 py-2.5"><StatusBadge status={c.status} /></td>
          <td className="px-5 py-2.5 text-[#64748b] text-xs">
            {Object.entries(c.ports || {}).map(([k, v]) => (
              <span key={k} className="mr-2">{Array.isArray(v) ? v.join(',') : v}:{k.split('/')[0]}</span>
            ))}
          </td>
          <td className="px-5 py-2.5">
            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
              {c.status !== 'running' && (
                <button onClick={() => onContainerAction(c.id, () => api.containers.start(c.id))}
                  disabled={busy[c.id]}
                  className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-40" title="Start">
                  <Play size={13} />
                </button>
              )}
              {c.status === 'running' && (
                <button onClick={() => onContainerAction(c.id, () => api.containers.stop(c.id))}
                  disabled={busy[c.id]}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40" title="Stop">
                  <Square size={13} />
                </button>
              )}
              <button onClick={() => onContainerAction(c.id, () => api.containers.restart(c.id))}
                disabled={busy[c.id]}
                className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40" title="Restart">
                <RotateCw size={13} />
              </button>
              <button onClick={() => onOpenDrawer(c)}
                className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10" title="Abrir painel">
                <Settings size={13} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remover container "${c.name}"?`))
                    onContainerAction(c.id, () => api.containers.remove(c.id, true))
                }}
                disabled={busy[c.id]}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40" title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Containers() {
  const location = useLocation()
  const focusGroup = location.state?.group || null
  const [groups, setGroups]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [drawer, setDrawer]     = useState(null)   // container object
  const [busy, setBusy]         = useState({})

  async function load() {
    setLoading(true)
    try { setGroups(await api.groups.list()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function containerAction(id, fn) {
    setBusy(b => ({ ...b, [id]: true }))
    fn().then(() => load()).catch(e => alert(e.message)).finally(() => setBusy(b => ({ ...b, [id]: false })))
  }

  const totalContainers   = groups.reduce((s, g) => s + g.containers.length, 0)
  const runningContainers = groups.reduce((s, g) => s + g.containers.filter(c => c.status === 'running').length, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Containers</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">
            {groups.length} apps · {runningContainers}/{totalContainers} rodando
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white hover:bg-[#3a3d4e] transition-colors text-sm">
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#64748b] py-16">Carregando...</div>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3e]">
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">App / Container</th>
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Imagem</th>
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Portas</th>
                <th className="text-right px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3e]">
              {groups.map(g => (
                <GroupRow key={g.id} group={g} busy={busy}
                  onOpenDrawer={setDrawer}
                  onContainerAction={containerAction}
                  autoExpand={focusGroup === g.id}
                />
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-[#64748b]">Nenhum container encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <ContainerDrawer
          container={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => { load(); setDrawer(null) }}
        />
      )}
    </div>
  )
}
