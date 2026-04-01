import { useEffect, useState } from 'react'
import { api } from '../api'
import { RefreshCw, Server, Network, Image } from 'lucide-react'

function fmt(bytes) {
  if (!bytes) return '—'
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

export default function System() {
  const [info, setInfo] = useState(null)
  const [images, setImages] = useState([])
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')

  async function load() {
    setLoading(true)
    try {
      const [i, img, net] = await Promise.all([
        api.system.info(),
        api.system.images(),
        api.system.networks(),
      ])
      setInfo(i)
      setImages(img)
      setNetworks(net)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const tabs = [
    { id: 'info', label: 'Informações', icon: Server },
    { id: 'images', label: `Imagens (${images.length})`, icon: Image },
    { id: 'networks', label: `Redes (${networks.length})`, icon: Network },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sistema</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">Informações do Docker e host</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-sm transition-colors">
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      <div className="flex gap-1 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === t.id ? 'bg-[#6366f1] text-white' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-[#64748b] py-12">Carregando...</div>
      ) : (
        <>
          {tab === 'info' && info && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
                <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-4">Docker</h3>
                <div className="space-y-2">
                  {[
                    ['Versão', info.docker.version],
                    ['OS', info.docker.os],
                    ['Arquitetura', info.docker.architecture],
                    ['Memória Total', fmt(info.docker.memory)],
                    ['Containers', info.docker.containers],
                    ['Rodando', info.docker.containers_running],
                    ['Parados', info.docker.containers_stopped],
                    ['Imagens', info.docker.images],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-[#64748b]">{k}</span>
                      <span className="text-white font-medium">{v ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5">
                <h3 className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider mb-4">Host</h3>
                <div className="space-y-2">
                  {[
                    ['Plataforma', info.host.platform],
                    ['Máquina', info.host.machine],
                    ['Python', info.host.python],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-[#64748b]">{k}</span>
                      <span className="text-white font-medium">{v ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'images' && (
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e]">
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">Imagem</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">Tamanho</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {images.map(img => (
                    <tr key={img.id} className="hover:bg-[#2a2d3e]/20">
                      <td className="px-5 py-3 text-white">
                        {img.tags[0] || <span className="text-[#64748b] italic">sem tag</span>}
                      </td>
                      <td className="px-5 py-3 text-[#64748b]">{fmt(img.size)}</td>
                      <td className="px-5 py-3 text-[#64748b] font-mono text-xs">{img.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'networks' && (
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e]">
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">Nome</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">Driver</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">Scope</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {networks.map(n => (
                    <tr key={n.id} className="hover:bg-[#2a2d3e]/20">
                      <td className="px-5 py-3 text-white font-medium">{n.name}</td>
                      <td className="px-5 py-3 text-[#94a3b8]">{n.driver}</td>
                      <td className="px-5 py-3 text-[#64748b]">{n.scope}</td>
                      <td className="px-5 py-3 text-[#64748b] font-mono text-xs">{n.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
