import { useEffect, useState, useRef } from 'react'
import { metricsSocket, api } from '../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MAX_POINTS = 30

function fmt(bytes) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

function Gauge({ label, value, unit = '%', warn = 70, crit = 90 }) {
  const color = value >= crit ? '#f87171' : value >= warn ? '#fbbf24' : '#6366f1'
  const r = 40
  const circ = 2 * Math.PI * r
  const fill = (value / 100) * circ

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5 flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#2a2d3e" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
          {value}{unit}
        </text>
      </svg>
      <p className="text-xs text-[#94a3b8] font-medium">{label}</p>
    </div>
  )
}

function MiniBar({ value, color = '#6366f1' }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-[#2a2d3e] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-[#94a3b8] w-10 text-right">{value}%</span>
    </div>
  )
}

function ContainerMetrics() {
  const [containers, setContainers] = useState([])
  const [stats, setStats] = useState({})
  const intervalRef = useRef(null)

  async function fetchStats(list) {
    const running = list.filter(c => c.status === 'running')
    const results = await Promise.allSettled(
      running.map(c => api.metrics.container(c.id))
    )
    const next = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        next[running[i].id] = r.value
      }
    })
    setStats(next)
  }

  useEffect(() => {
    api.containers.list(true).then(list => {
      setContainers(list)
      fetchStats(list)
      intervalRef.current = setInterval(() => fetchStats(list), 5000)
    })
    return () => clearInterval(intervalRef.current)
  }, [])

  const running = containers.filter(c => c.status === 'running')
  if (running.length === 0) return null

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2d3e]">
        <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider">Por Container</h3>
      </div>
      <div className="divide-y divide-[#2a2d3e]">
        {running.map(c => {
          const s = stats[c.id]
          const cpu = s ? s.cpu_percent : null
          const memPct = s ? s.memory.percent : null
          const memUsed = s ? fmt(s.memory.used) : null
          const memLimit = s ? fmt(s.memory.limit) : null
          return (
            <div key={c.id} className="px-5 py-3 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <p className="text-sm text-white font-mono w-40 truncate flex-shrink-0">{c.name}</p>
              {s ? (
                <>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-[#64748b] w-7">CPU</span>
                    <MiniBar value={cpu} color="#6366f1" />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-[#64748b] w-7">RAM</span>
                    <MiniBar value={memPct} color="#22c55e" />
                  </div>
                  <p className="text-xs text-[#64748b] w-28 text-right flex-shrink-0">{memUsed} / {memLimit}</p>
                </>
              ) : (
                <p className="text-xs text-[#475569]">carregando...</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Metrics() {
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    const ws = metricsSocket((data) => {
      setCurrent(data)
      setHistory(prev => {
        const next = [...prev, {
          t: new Date().toLocaleTimeString(),
          cpu: data.cpu.percent,
          mem: data.memory.percent,
          disk: data.disk.percent,
        }]
        return next.slice(-MAX_POINTS)
      })
    })
    return () => ws.close()
  }, [])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Métricas</h1>
        <p className="text-sm text-[#94a3b8] mt-0.5">Monitoramento em tempo real</p>
      </div>

      {current && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Gauge label="CPU" value={current.cpu.percent} />
            <Gauge label="Memória" value={current.memory.percent} />
            <Gauge label="Disco" value={current.disk.percent} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
              <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-1">Memória</h3>
              <p className="text-sm text-white">
                <span className="font-semibold">{fmt(current.memory.used)}</span>
                <span className="text-[#64748b]"> / {fmt(current.memory.total)}</span>
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">Disponível: {fmt(current.memory.available)}</p>
            </div>
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
              <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-1">Disco</h3>
              <p className="text-sm text-white">
                <span className="font-semibold">{fmt(current.disk.used)}</span>
                <span className="text-[#64748b]"> / {fmt(current.disk.total)}</span>
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">Livre: {fmt(current.disk.free)}</p>
            </div>
          </div>

          {Object.keys(current.temperatures).length > 0 && (
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
              <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-3">Temperatura</h3>
              <div className="flex gap-6">
                {Object.entries(current.temperatures).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-[#64748b]">{k}</p>
                    <p className={`text-2xl font-bold ${v > 80 ? 'text-red-400' : v > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {v}°C
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {history.length > 1 && (
        <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
          <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-4">Histórico (CPU / Memória)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history}>
              <CartesianGrid stroke="#2a2d3e" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} dot={false} name="CPU" />
              <Line type="monotone" dataKey="mem" stroke="#22c55e" strokeWidth={2} dot={false} name="Memória" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ContainerMetrics />

      {!current && (
        <div className="text-center text-[#64748b] py-16">Conectando ao WebSocket...</div>
      )}
    </div>
  )
}
