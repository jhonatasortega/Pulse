import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import {
  RefreshCw, HardDrive, Database, Folder, File, ChevronRight,
  Upload, FolderPlus, Trash2, Edit2, Download, Home, ArrowLeft,
  LayoutGrid, LayoutList, X, Save, Copy, Scissors, Clipboard,
  FilePlus, ArrowLeft as Back,
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (bytes == null) return '—'
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`
  return `${bytes} B`
}
function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
const TEXT_EXTS = new Set([
  'txt','md','json','yaml','yml','toml','ini','conf','cfg','env',
  'sh','bash','py','js','ts','jsx','tsx','html','css','xml','log',
  'dockerfile','gitignore','sql','csv',
])
function isText(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  return TEXT_EXTS.has(ext) || name.toLowerCase() === 'dockerfile'
}

function Bar({ percent, warn = 70, crit = 85 }) {
  const color = percent > crit ? 'bg-red-500' : percent > warn ? 'bg-yellow-500' : 'bg-indigo-500'
  return (
    <div className="w-full bg-[#2a2d3e] rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}

// ─── modals ───────────────────────────────────────────────────────────────────
function RenameModal({ entry, onClose, onDone }) {
  const [name, setName] = useState(entry.name)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    setSaving(true)
    try { await api.files.rename(entry.path, name); onDone(); onClose() }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Renomear</h2>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2"
          autoFocus />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">Renomear</button>
        </div>
      </div>
    </div>
  )
}

function MkdirModal({ currentPath, onClose, onDone }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try { await api.files.mkdir(`${currentPath}/${name.trim()}`); onDone(); onClose() }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Nova Pasta</h2>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Nome da pasta"
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2" autoFocus />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">Criar</button>
        </div>
      </div>
    </div>
  )
}

function NewFileModal({ currentPath, onClose, onDone }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try { await api.files.writeText(`${currentPath}/${name.trim()}`, ''); onDone(); onClose() }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Novo Arquivo</h2>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="nome.txt"
          className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2" autoFocus />
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#94a3b8] hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">Criar</button>
        </div>
      </div>
    </div>
  )
}

function EditorModal({ entry, onClose, onSaved }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    api.files.read(entry.path)
      .then(r => { setContent(r.content); setLoading(false) })
      .catch(e => { setErr(e.message); setLoading(false) })
  }, [entry.path])
  async function save() {
    setSaving(true)
    try { await api.files.writeText(entry.path, content); onSaved() }
    catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-4xl h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-[#2a2d3e] flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">{entry.name}</p>
            <p className="text-xs text-[#64748b] font-mono">{entry.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1] text-white text-xs rounded-lg hover:bg-[#4f46e5] disabled:opacity-50">
              <Save size={12} />{saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
          </div>
        </div>
        {err && <div className="px-5 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">{err}</div>}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[#64748b]">Carregando...</div>
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 bg-[#0f1117] text-[#94a3b8] font-mono text-xs p-4 resize-none focus:outline-none leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}

// ─── context menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, entry, clipboard, onAction, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const items = entry
    ? [
        { label: isText(entry.name) ? 'Editar' : 'Abrir', action: 'open', icon: '📄' },
        { label: 'Copiar', action: 'copy', icon: '📋' },
        { label: 'Recortar', action: 'cut', icon: '✂️' },
        ...(clipboard ? [{ label: 'Colar aqui', action: 'paste', icon: '📌' }] : []),
        null,
        { label: 'Renomear', action: 'rename', icon: '✏️' },
        entry.type === 'file' ? { label: 'Download', action: 'download', icon: '⬇️' } : null,
        null,
        { label: 'Excluir', action: 'delete', icon: '🗑️', danger: true },
      ].filter(Boolean)
    : [
        { label: 'Nova Pasta', action: 'mkdir', icon: '📁' },
        { label: 'Novo Arquivo', action: 'newfile', icon: '📄' },
        ...(clipboard ? [{ label: 'Colar', action: 'paste', icon: '📌' }] : []),
      ]

  return (
    <div ref={ref}
      className="fixed z-[999] bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-2xl py-1.5 min-w-[180px]"
      style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 border-t border-[#2a2d3e]" />
        ) : (
          <button key={item.action} onClick={() => { onAction(item.action, entry); onClose() }}
            className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 hover:bg-[#2a2d3e] transition-colors ${item.danger ? 'text-red-400' : 'text-[#94a3b8]'}`}>
            <span>{item.icon}</span>{item.label}
          </button>
        )
      )}
    </div>
  )
}

// ─── file browser ──────────────────────────────────────────────────────────────
function FileBrowser({ initialPath, onBack, clipboard, setClipboard }) {
  const [dir, setDir] = useState(null)
  const [path, setPath] = useState(initialPath)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'
  const [contextMenu, setContextMenu] = useState(null) // { x, y, entry }
  const [renameTarget, setRenameTarget] = useState(null)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [editorTarget, setEditorTarget] = useState(null)
  const uploadRef = useRef(null)

  function showError(msg) {
    setError(msg)
    setTimeout(() => setError(''), 4000)
  }

  const browse = useCallback(async (p) => {
    setLoading(true)
    try {
      const data = await api.files.browse(p)
      setDir(data); setPath(data.path)
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { browse(initialPath) }, [initialPath])

  function handleContextMenu(e, entry = null) {
    e.preventDefault()
    e.stopPropagation()
    const margin = 8
    const menuW = 180, menuH = 220
    let x = e.clientX, y = e.clientY
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - margin
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - margin
    setContextMenu({ x, y, entry })
  }

  async function handleAction(action, entry) {
    switch (action) {
      case 'open':
        if (!entry) break
        if (entry.type === 'dir') browse(entry.path)
        else if (isText(entry.name)) setEditorTarget(entry)
        break
      case 'copy': setClipboard({ entry, op: 'copy' }); break
      case 'cut':  setClipboard({ entry, op: 'cut' });  break
      case 'paste':
        if (!clipboard) break
        try {
          if (clipboard.op === 'copy') await api.files.copy(clipboard.entry.path, path)
          else { await api.files.move(clipboard.entry.path, path); setClipboard(null) }
          browse(path)
        } catch (e) { showError(e.message) }
        break
      case 'rename': setRenameTarget(entry); break
      case 'delete':
        if (!confirm(`Excluir "${entry.name}"?`)) break
        try { await api.files.delete(entry.path); browse(path) } catch (e) { showError(e.message) }
        break
      case 'download':
        window.open(api.files.downloadUrl(entry.path), '_blank')
        break
      case 'mkdir': setMkdirOpen(true); break
      case 'newfile': setNewFileOpen(true); break
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const key = localStorage.getItem('pulse_key') || sessionStorage.getItem('pulse_key') || ''
      const res = await fetch(`/api/files/upload?path=${encodeURIComponent(path)}`, {
        method: 'POST', headers: { 'X-Pulse-Key': key }, body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      browse(path)
    } catch (e) { showError(e.message) }
    e.target.value = ''
  }

  const entries = dir?.entries || []

  return (
    <div className="flex flex-col h-full" onContextMenu={e => handleContextMenu(e, null)}>
      {error && (
        <div className="mb-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex-shrink-0">
          {error}
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onBack}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#2a2d3e]" title="Voltar ao Armazenamento">
            <Back size={16} />
          </button>
          {dir?.parent && (
            <button onClick={() => browse(dir.parent)}
              className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#2a2d3e]" title="Pasta acima">
              <ArrowLeft size={16} />
            </button>
          )}
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm flex-wrap">
            {(dir?.breadcrumb || []).map((crumb, i, arr) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-[#475569]" />}
                <button onClick={() => i < arr.length - 1 && browse(crumb.path)}
                  className={i === arr.length - 1 ? 'text-white font-medium text-xs' : 'text-[#64748b] hover:text-white text-xs'}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
          {clipboard && (
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              {clipboard.op === 'copy' ? <Copy size={10} /> : <Scissors size={10} />}
              {clipboard.entry.name}
              <button onClick={() => setClipboard(null)} className="ml-1 hover:text-white"><X size={10} /></button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMkdirOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-xs">
            <FolderPlus size={13} />Nova Pasta
          </button>
          <button onClick={() => setNewFileOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white text-xs">
            <FilePlus size={13} />Novo Arquivo
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] text-xs">
            <Upload size={13} />Upload
          </button>
          <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
          <button onClick={() => browse(path)} className="p-1.5 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white">
            <RefreshCw size={13} />
          </button>
          <div className="flex rounded-lg overflow-hidden border border-[#2a2d3e]">
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-[#6366f1] text-white' : 'bg-[#1a1d27] text-[#64748b] hover:text-white'}`}>
              <LayoutList size={14} />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#6366f1] text-white' : 'bg-[#1a1d27] text-[#64748b] hover:text-white'}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[#64748b]">Carregando...</div>
      ) : viewMode === 'list' ? (
        <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-auto flex-1 min-h-0">
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
              {entries.map(entry => (
                <tr key={entry.path}
                  className="hover:bg-[#2a2d3e]/30 transition-colors cursor-pointer"
                  onDoubleClick={() => {
                    if (entry.type === 'dir') browse(entry.path)
                    else if (isText(entry.name)) setEditorTarget(entry)
                  }}
                  onContextMenu={e => handleContextMenu(e, entry)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {entry.type === 'dir'
                        ? <Folder size={16} className="text-indigo-400 flex-shrink-0" />
                        : <File size={16} className="text-[#64748b] flex-shrink-0" />}
                      <span className={entry.type === 'dir' ? 'text-white font-medium text-sm' : 'text-[#94a3b8] text-sm'}>
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#64748b] text-xs">{entry.type === 'dir' ? '—' : fmt(entry.size)}</td>
                  <td className="px-5 py-3 text-[#64748b] text-xs">{fmtDate(entry.modified)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {isText(entry.name) && entry.type === 'file' && (
                        <button onClick={() => setEditorTarget(entry)}
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-indigo-400 hover:bg-indigo-500/10" title="Editar">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {entry.type === 'file' && (
                        <a href={api.files.downloadUrl(entry.path)} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-indigo-400 hover:bg-indigo-500/10" title="Download">
                          <Download size={13} />
                        </a>
                      )}
                      <button onClick={() => setRenameTarget(entry)}
                        className="p-1.5 rounded-lg text-[#64748b] hover:text-yellow-400 hover:bg-yellow-500/10" title="Renomear">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleAction('delete', entry)}
                        className="p-1.5 rounded-lg text-[#64748b] hover:text-red-400 hover:bg-red-500/10" title="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-[#64748b]">Pasta vazia</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid view */
        <div className="flex-1 overflow-auto min-h-0">
          {entries.length === 0 ? (
            <p className="text-center text-[#64748b] py-12">Pasta vazia</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-3">
              {entries.map(entry => (
                <div key={entry.path}
                  className="group flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#2a2d3e]/60 cursor-pointer transition-colors select-none"
                  onDoubleClick={() => {
                    if (entry.type === 'dir') browse(entry.path)
                    else if (isText(entry.name)) setEditorTarget(entry)
                  }}
                  onContextMenu={e => handleContextMenu(e, entry)}>
                  <div className="w-12 h-12 flex items-center justify-center">
                    {entry.type === 'dir'
                      ? <Folder size={40} className="text-indigo-400" />
                      : <File size={40} className="text-[#64748b]" />}
                  </div>
                  <p className="text-[10px] text-center text-[#94a3b8] leading-tight break-all line-clamp-2 w-full">
                    {entry.name}
                  </p>
                  {entry.type === 'file' && (
                    <p className="text-[9px] text-[#475569]">{fmt(entry.size)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {renameTarget && <RenameModal entry={renameTarget} onClose={() => setRenameTarget(null)} onDone={() => browse(path)} />}
      {mkdirOpen && <MkdirModal currentPath={path} onClose={() => setMkdirOpen(false)} onDone={() => browse(path)} />}
      {newFileOpen && <NewFileModal currentPath={path} onClose={() => setNewFileOpen(false)} onDone={() => browse(path)} />}
      {editorTarget && <EditorModal entry={editorTarget} onClose={() => setEditorTarget(null)} onSaved={() => browse(path)} />}
      {contextMenu && (
        <ContextMenu {...contextMenu} clipboard={clipboard}
          onAction={handleAction} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}

// ─── main Storage page ─────────────────────────────────────────────────────────
export default function Storage() {
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [browsePath, setBrowsePath] = useState(location.state?.browsePath || null)
  const [clipboard, setClipboard] = useState(null) // lifted so it persists across disk switches

  // Re-read location.state when navigating to /storage while already on it
  useEffect(() => {
    if (location.state?.browsePath) {
      setBrowsePath(location.state.browsePath)
    }
  }, [location.state?.browsePath])

  async function load() {
    setLoading(true)
    try { setData(await api.storage.info()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (browsePath) {
    return (
      <div className="p-6 h-full flex flex-col">
        <FileBrowser
          key={browsePath}
          initialPath={browsePath}
          onBack={() => setBrowsePath(null)}
          clipboard={clipboard}
          setClipboard={setClipboard}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Armazenamento</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">Discos e volumes Docker · clique em um disco para explorar</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white hover:bg-[#3a3d4e] transition-colors text-sm">
          <RefreshCw size={14} />Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center text-[#64748b] py-16">Carregando...</div>
      ) : !data ? (
        <div className="text-center text-red-400 py-16">Erro ao carregar dados</div>
      ) : (
        <>
          {/* Disks */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={16} className="text-[#64748b]" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Discos</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.disks.map((disk, i) => (
                <div key={i}
                  onClick={() => setBrowsePath(disk.mountpoint)}
                  className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-5 cursor-pointer hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5 transition-all group">
                  <div className="flex items-start justify-between mb-1">
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
                  <Bar percent={disk.percent} />
                  <div className="flex justify-between mt-3 text-xs text-[#64748b]">
                    <span>{fmt(disk.used)} usado</span>
                    <span>{fmt(disk.free)} livre</span>
                    <span>{fmt(disk.total)} total</span>
                  </div>
                </div>
              ))}
              {data.disks.length === 0 && <p className="text-[#64748b] text-sm">Nenhum disco encontrado.</p>}
            </div>
          </section>

          {/* Volumes */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Database size={16} className="text-[#64748b]" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Volumes Docker
                <span className="ml-2 text-xs font-normal text-[#64748b]">({data.volumes.length})</span>
              </h2>
            </div>
            <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d3e]">
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Nome</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Driver</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Tamanho</th>
                    <th className="text-left px-5 py-3 text-xs text-[#64748b] font-medium uppercase tracking-wider">Mount Point</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {data.volumes.map((vol, i) => (
                    <tr key={i}
                      className="hover:bg-[#2a2d3e]/30 transition-colors cursor-pointer"
                      onClick={() => setBrowsePath(vol.mountpoint)}>
                      <td className="px-5 py-3 font-medium text-white text-xs truncate max-w-[200px]">{vol.name}</td>
                      <td className="px-5 py-3 text-[#64748b] text-xs">{vol.driver}</td>
                      <td className="px-5 py-3 text-[#94a3b8] text-xs">{fmt(vol.size)}</td>
                      <td className="px-5 py-3 text-[#475569] font-mono text-xs truncate max-w-[200px]">{vol.mountpoint}</td>
                    </tr>
                  ))}
                  {data.volumes.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-[#64748b]">Nenhum volume</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
