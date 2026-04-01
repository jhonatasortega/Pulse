import { useEffect, useState } from 'react'
import { api } from '../api'
import { Bot, RefreshCw, ChevronDown, ChevronUp, Zap, X } from 'lucide-react'

// ── Dispatch Panel ────────────────────────────────────────────────────────────
function DispatchPanel({ agent, onClose }) {
  const [action, setAction] = useState(agent.allowed_actions[0] || '')
  const [paramsText, setParamsText] = useState('{}')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function dispatch() {
    setLoading(true); setError(''); setResult(null)
    try {
      const params = JSON.parse(paramsText)
      const res = await api.agents.dispatch(agent.id, action, params)
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Dispatch — {agent.name}</h2>
            <p className="text-xs text-[#64748b] mt-0.5">{agent.allowed_actions.length} ações disponíveis</p>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">Ação</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]"
            >
              {agent.allowed_actions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#94a3b8] mb-1.5 block">Parâmetros (JSON)</label>
            <textarea
              value={paramsText}
              onChange={e => setParamsText(e.target.value)}
              rows={4}
              spellCheck={false}
              className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#6366f1] resize-none"
              placeholder='{ "id": "container_name" }'
            />
          </div>

          <button
            onClick={dispatch}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] transition-colors disabled:opacity-40"
          >
            <Zap size={14} />
            {loading ? 'Executando...' : 'Executar'}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-[#0f1117] border border-[#2a2d3e] rounded-lg p-3">
              <p className="text-xs text-[#94a3b8] mb-2 font-medium uppercase tracking-wider">Resultado</p>
              <pre className="text-xs text-[#e2e8f0] font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onDispatch }) {
  const [open, setOpen] = useState(false)
  const hasActions = agent.allowed_actions?.length > 0

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#2a2d3e]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-indigo-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{agent.name}</p>
            <p className="text-xs text-[#64748b] line-clamp-1">{agent.function}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActions && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {agent.allowed_actions.length} ações
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-[#64748b]" /> : <ChevronDown size={16} className="text-[#64748b]" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#2a2d3e] pt-4">
          {agent.function && (
            <div>
              <h4 className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Função</h4>
              <p className="text-sm text-[#e2e8f0]">{agent.function}</p>
            </div>
          )}

          {agent.responsibilities?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-2">Responsabilidades</h4>
              <ul className="space-y-1">
                {agent.responsibilities.map((r, i) => (
                  <li key={i} className="text-sm text-[#e2e8f0] flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasActions && (
            <div>
              <h4 className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider mb-2">Ações permitidas</h4>
              <div className="flex flex-wrap gap-1.5">
                {agent.allowed_actions.map(a => (
                  <span key={a} className="text-xs px-2 py-0.5 bg-[#2a2d3e] text-[#94a3b8] rounded font-mono">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasActions && (
            <button
              onClick={() => onDispatch(agent)}
              className="flex items-center gap-2 px-4 py-2 bg-[#6366f1]/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm hover:bg-[#6366f1]/30 transition-colors"
            >
              <Zap size={14} />
              Executar ação
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Agents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [dispatchTarget, setDispatchTarget] = useState(null)

  async function load() {
    setLoading(true)
    try { setAgents(await api.agents.list()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function reload() {
    setLoading(true)
    try { await api.agents.reload(); await load() }
    catch (e) { alert(e.message); setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agentes</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">{agents.length} agentes carregados</p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Recarregar
        </button>
      </div>

      <div className="bg-[#1a1d27] border border-[#6366f1]/20 rounded-xl px-5 py-4">
        <p className="text-xs text-[#94a3b8]">
          Agentes são definidos em <code className="text-indigo-400">.md</code> em <code className="text-indigo-400">/agents</code>.
          Cada agente tem um conjunto de ações permitidas que pode executar via dispatcher.
          Base para integração futura com IA.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-[#64748b] py-12">Carregando agentes...</div>
      ) : (
        <div className="space-y-3">
          {agents.map(a => (
            <AgentCard key={a.id} agent={a} onDispatch={setDispatchTarget} />
          ))}
          {agents.length === 0 && (
            <div className="text-center text-[#64748b] py-12">
              <Bot size={32} className="mx-auto mb-3 opacity-30" />
              Nenhum agente encontrado
            </div>
          )}
        </div>
      )}

      {dispatchTarget && (
        <DispatchPanel agent={dispatchTarget} onClose={() => setDispatchTarget(null)} />
      )}
    </div>
  )
}
