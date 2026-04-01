import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import {
  Folder, File, ChevronRight, Upload, FolderPlus, Trash2,
  Edit2, Download, RefreshCw, X, Home, ArrowLeft,
} from 'lucide-react'

function fmt(bytes) {
  if (bytes == null) return '—'
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`
  return `${bytes} B`
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function RenameModal({ entry, onClose, onDone }) {
  const [name, setName] = useState(entry.name)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.files.rename(entry.path, name)
      onDone()
      onClose()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Renomear</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2"
          autoFocus
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">
            Renomear
          </button>
        </div>
      </div>
    </div>
  )
}

function MkdirModal({ currentPath, onClose, onDone }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.files.mkdir(`${currentPath}/${name.trim()}`)
      onDone()
      onClose()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Nova Pasta</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Nome da pasta"
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2"
          autoFocus
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">
            Criar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Files() {
  const [roots, setRoots] = useState([])
  const [dir, setDir] = useState(null)
  const [path, setPath] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const uploadRef = useRef(null)

  useEffect(() => {
    api.files.roots().then(setRoots).catch(console.error)
  }, [])

  async function browse(p) {
    setLoading(true)
    setSelected(null)
    try {
      const data = await api.files.browse(p)
      setDir(data)
      setPath(data.path)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function doDelete(entry) {
    if (!confirm(`Deletar "${entry.name}"?`)) return
    try {
      await api.files.delete(entry.path)
      browse(path)
    } catch (e) {
      alert(e.message)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`/api/files/upload?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: { 'X-Pulse-Key': localStorage.getItem('pulse_key') || sessionStorage.getItem('pulse_key') || '' },
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      browse(path)
    } catch (e) {
      alert(e.message)
    }
    e.target.value = ''
  }

  if (!path) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-white">Gerenciador de Arquivos</h1>
        <p className="text-sm text-[#94a3b8]">Selecione um diretório para explorar</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {roots.map(r => (
            <button
              key={r.path}
              onClick={() => browse(r.path)}
              className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5 flex items-center gap-3 hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-all text-left"
            >
              <Folder size={24} className="text-indigo-400 flex-shrink-0" />
              <span className="text-sm font-medium text-white">{r.name}</span>
            </button>
          ))}
          {roots.length === 0 && (
            <p className="text-[#64748b] col-span-3 text-sm">Nenhum diretório disponível.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setPath(null); setDir(null) }}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#2a2d3e]" title="Raiz">
            <Home size={16} />
          </button>
          {dir?.parent && (
            <button onClick={() => browse(dir.parent)}
              className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#2a2d3e]" title="Voltar">
              <ArrowLeft size={16} />
            </button>
          )}
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm">
            {(dir?.breadcrumb || []).map((crumb, i, arr) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-[#475569]" />}
                <button
                  onClick={() => i < arr.length - 1 && browse(crumb.path)}
                  className={i === arr.length - 1 ? 'text-white font-medium' : 'text-[#64748b] hover:text-white'}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMkdirOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-sm">
            <FolderPlus size={14} />
            Nova Pasta
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] text-sm">
            <Upload size={14} />
            Upload
          </button>
          <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
          <button onClick={() => browse(path)}
            className="p-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[#64748b]">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3e]">
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Tamanho</th>
                <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Modificado</th>
                <th className="text-right px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3e]">
              {(dir?.entries || []).map(entry => (
                <tr
                  key={entry.path}
                  className={`hover:bg-[#2a2d3e]/30 transition-colors cursor-pointer ${selected?.path === entry.path ? 'bg-[#6366f1]/10' : ''}`}
                  onClick={() => {
                    if (entry.type === 'dir') browse(entry.path)
                    else setSelected(entry)
                  }}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {entry.type === 'dir'
                        ? <Folder size={16} className="text-indigo-400 flex-shrink-0" />
                        : <File size={16} className="text-[#64748b] flex-shrink-0" />
                      }
                      <span className={`${entry.type === 'dir' ? 'text-white font-medium' : 'text-[#94a3b8]'}`}>
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#64748b] text-xs">
                    {entry.type === 'dir' ? '—' : fmt(entry.size)}
                  </td>
                  <td className="px-5 py-3 text-[#64748b] text-xs">{fmtDate(entry.modified)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {entry.type === 'file' && (
                        <a
                          href={api.files.downloadUrl(entry.path)}
                          target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-indigo-400 hover:bg-indigo-500/10"
                          title="Download"
                        >
                          <Download size={13} />
                        </a>
                      )}
                      <button
                        onClick={() => setRenameTarget(entry)}
                        className="p-1.5 rounded-lg text-[#64748b] hover:text-yellow-400 hover:bg-yellow-500/10"
                        title="Renomear"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => doDelete(entry)}
                        className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-500/10"
                        title="Deletar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(dir?.entries || []).length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[#64748b]">
                    Diretório vazio
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {renameTarget && (
        <RenameModal
          entry={renameTarget}
          onClose={() => setRenameTarget(null)}
          onDone={() => browse(path)}
        />
      )}
      {mkdirOpen && (
        <MkdirModal
          currentPath={path}
          onClose={() => setMkdirOpen(false)}
          onDone={() => browse(path)}
        />
      )}
    </div>
  )
}
