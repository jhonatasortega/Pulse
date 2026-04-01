import { useEffect, useState } from 'react'
import { api, logsSocket } from '../api'
import {
  Play, Square, RotateCw, Trash2, FileText, RefreshCw, X,
  ChevronDown, ChevronRight, Settings, Layers,
} from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    running: 'bg-green-500/10 text-green-400 border-green-500/20',
    exited: 'bg-red-500/10 text-red-400 border-red-500/20',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
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

function LogModal({ container, onClose }) {
  const [logs, setLogs] = useState('')
  const [wsRef, setWsRef] = useState(null)

  useEffect(() => {
    api.containers.logs(container.id, 200)
      .then(r => setLogs(r.logs))
      .catch(e => setLogs(`Error: ${e.message}`))
    return () => wsRef?.close()
  }, [container.id])

  function startStream() {
    wsRef?.close()
    setLogs('')
    const ws = logsSocket(container.id, (line) => setLogs(prev => prev + line))
    setWsRef(ws)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Logs: {container.name}</h2>
            <p className="text-xs text-[#64748b]">{container.image}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startStream}
              className="text-xs px-3 py-1.5 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5]">
              Stream Live
            </button>
            <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs text-[#94a3b8] font-mono leading-relaxed whitespace-pre-wrap">
          {logs || 'Carregando logs...'}
        </pre>
      </div>
    </div>
  )
}

function ConfigModal({ container, onClose, onSaved }) {
  const [config, setConfig] = useState(null)
  const [envRows, setEnvRows] = useState([])
  const [restart, setRestart] = useState('unless-stopped')
  const [saving, setSaving] = useState(false)

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
      onClose()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Configurar: {container.name}</h2>
            {config && <p className="text-xs text-[#64748b]">{config.image}</p>}
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
        </div>

        {!config ? (
          <div className="p-8 text-center text-[#64748b] text-sm">Carregando...</div>
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-5">
            {/* Restart policy */}
            <div>
              <label className="text-xs text-[#64748b] uppercase tracking-wider font-medium block mb-2">Restart Policy</label>
              <select
                value={restart}
                onChange={e => setRestart(e.target.value)}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2"
              >
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
                <button
                  onClick={() => setEnvRows(r => [...r, { k: '', v: '' }])}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  + Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {envRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={row.k}
                      onChange={e => setRow(i, 'k', e.target.value)}
                      placeholder="VARIAVEL"
                      className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono"
                    />
                    <input
                      value={row.v}
                      onChange={e => setRow(i, 'v', e.target.value)}
                      placeholder="valor"
                      className="flex-1 bg-[#0f1117] border border-[#2a2d3e] text-white text-xs rounded-lg px-3 py-2 font-mono"
                    />
                    <button
                      onClick={() => setEnvRows(r => r.filter((_, idx) => idx !== i))}
                      className="text-[#64748b] hover:text-red-400 px-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {envRows.length === 0 && (
                  <p className="text-xs text-[#475569]">Nenhuma variável configurada.</p>
                )}
              </div>
            </div>

            {/* Volumes (read-only display) */}
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
          </div>
        )}

        <div className="px-5 py-4 border-t border-[#2a2d3e] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !config}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar e Recriar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupRow({ group, onContainerAction, busy }) {
  const [expanded, setExpanded] = useState(false)
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
      {/* Group header row */}
      <tr
        className="hover:bg-[#2a2d3e]/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            {expanded ? <ChevronDown size={14} className="text-[#64748b]" /> : <ChevronRight size={14} className="text-[#64748b]" />}
            <span className="font-semibold text-white">{group.name}</span>
            {group.source === 'compose' && (
              <Layers size={12} className="text-[#475569]" />
            )}
          </div>
        </td>
        <td className="px-5 py-3 text-[#64748b] text-xs">
          {group.containers.length} container{group.containers.length > 1 ? 's' : ''}
        </td>
        <td className="px-5 py-3">
          <GroupBadge status={group.status} count={runningCount} />
        </td>
        <td className="px-5 py-3 text-[#64748b] text-xs">
          {Object.entries(group.ports || {}).slice(0, 3).map(([k, v]) => (
            <span key={k} className="mr-2">{Array.isArray(v) ? v[0] : v}:{k.split('/')[0]}</span>
          ))}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            {group.status !== 'running' && (
              <button
                onClick={() => doGroupAction(() => api.groups.start(group.id))}
                disabled={groupBusy}
                className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                title="Iniciar todos"
              >
                <Play size={14} />
              </button>
            )}
            {group.status !== 'stopped' && (
              <button
                onClick={() => doGroupAction(() => api.groups.stop(group.id))}
                disabled={groupBusy}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                title="Parar todos"
              >
                <Square size={14} />
              </button>
            )}
            <button
              onClick={() => doGroupAction(() => api.groups.restart(group.id))}
              disabled={groupBusy}
              className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"
              title="Reiniciar todos"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded container rows */}
      {expanded && group.containers.map(c => (
        <tr key={c.id} className="bg-[#0f1117]/40 hover:bg-[#2a2d3e]/20 transition-colors">
          <td className="px-5 py-2.5 pl-14">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                c.status === 'running' ? 'bg-green-400' :
                c.status === 'exited' ? 'bg-red-400' : 'bg-yellow-400'
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
            <div className="flex items-center justify-end gap-1">
              {c.status !== 'running' && (
                <button onClick={() => onContainerAction(c.id, () => api.containers.start(c.id))}
                  disabled={busy[c.id]}
                  className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                  title="Start">
                  <Play size={13} />
                </button>
              )}
              {c.status === 'running' && (
                <button onClick={() => onContainerAction(c.id, () => api.containers.stop(c.id))}
                  disabled={busy[c.id]}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                  title="Stop">
                  <Square size={13} />
                </button>
              )}
              <button onClick={() => onContainerAction(c.id, () => api.containers.restart(c.id))}
                disabled={busy[c.id]}
                className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"
                title="Restart">
                <RotateCw size={13} />
              </button>
              <button onClick={() => onContainerAction(c.id, null, 'logs', c)}
                className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10"
                title="Logs">
                <FileText size={13} />
              </button>
              <button onClick={() => onContainerAction(c.id, null, 'config', c)}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#6366f1]/10 hover:text-indigo-400"
                title="Configurar">
                <Settings size={13} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remover container "${c.name}"?`))
                    onContainerAction(c.id, () => api.containers.remove(c.id, true))
                }}
                disabled={busy[c.id]}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

export default function Containers() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [logTarget, setLogTarget] = useState(null)
  const [configTarget, setConfigTarget] = useState(null)
  const [busy, setBusy] = useState({})

  async function load() {
    setLoading(true)
    try {
      setGroups(await api.groups.list())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function containerAction(id, fn, modal = null, container = null) {
    if (modal === 'logs') { setLogTarget(container); return }
    if (modal === 'config') { setConfigTarget(container); return }
    setBusy(b => ({ ...b, [id]: true }))
    fn().then(() => load()).catch(e => alert(e.message)).finally(() => setBusy(b => ({ ...b, [id]: false })))
  }

  const totalContainers = groups.reduce((s, g) => s + g.containers.length, 0)
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
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white hover:bg-[#3a3d4e] transition-colors text-sm"
        >
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
                <GroupRow
                  key={g.id}
                  group={g}
                  onContainerAction={containerAction}
                  busy={busy}
                />
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#64748b]">
                    Nenhum container encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {logTarget && <LogModal container={logTarget} onClose={() => setLogTarget(null)} />}
      {configTarget && (
        <ConfigModal
          container={configTarget}
          onClose={() => setConfigTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
