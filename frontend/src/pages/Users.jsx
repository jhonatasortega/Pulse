import { useEffect, useState } from 'react'
import { api } from '../api'
import { auth } from '../auth'
import { UserPlus, Trash2, Shield, Eye, X, RefreshCw } from 'lucide-react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-[#2a2d3e] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function CreateUserModal({ onClose, onDone }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('viewer')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.users.create(username, password, role)
      onDone(); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const inp = "w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"

  return (
    <Modal title="Criar usuário" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs text-[#64748b] block mb-1">Usuário</label>
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="nome" className={inp} autoFocus />
        </div>
        <div>
          <label className="text-xs text-[#64748b] block mb-1">Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres" className={inp} />
        </div>
        <div>
          <label className="text-xs text-[#64748b] block mb-1">Função (role)</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full bg-[#0f1117] border border-[#2a2d3e] text-white text-sm rounded-lg px-3 py-2">
            <option value="admin">admin — acesso total</option>
            <option value="viewer">viewer — somente leitura</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={!username || !password || loading}
          className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] disabled:opacity-40">
          {loading ? 'Criando...' : 'Criar usuário'}
        </button>
      </form>
    </Modal>
  )
}

const ROLE_BADGE = {
  admin:  { label: 'Admin',  icon: Shield, cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  viewer: { label: 'Viewer', icon: Eye,    cls: 'bg-[#2a2d3e] text-[#94a3b8] border-[#3a3d4e]' },
}

export default function Users() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const currentUser = auth.getUser()
  const isAdmin     = auth.isAdmin()

  async function load() {
    setLoading(true)
    try { setUsers(await api.users.list()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function deleteUser(username) {
    if (!confirm(`Remover usuário "${username}"?`)) return
    try { await api.users.delete(username); load() }
    catch (e) { alert(e.message) }
  }

  async function toggleRole(user) {
    const newRole = user.role === 'admin' ? 'viewer' : 'admin'
    try { await api.users.update(user.username, { role: newRole }); load() }
    catch (e) { alert(e.message) }
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-[#64748b] py-20">
        <Shield size={32} className="mx-auto mb-3 opacity-30" />
        Apenas administradores podem gerenciar usuários.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Usuários</h1>
          <p className="text-sm text-[#94a3b8] mt-0.5">{users.length} usuário{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 bg-[#2a2d3e] text-[#94a3b8] rounded-lg hover:text-white transition-colors">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] text-sm transition-colors">
            <UserPlus size={14} />Novo usuário
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-[#64748b] py-12">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {users.map(user => {
            const badge = ROLE_BADGE[user.role] || ROLE_BADGE.viewer
            const BadgeIcon = badge.icon
            const isSelf = currentUser?.username === user.username

            return (
              <div key={user.username}
                className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {user.username}
                    {isSelf && <span className="ml-2 text-xs text-indigo-400">(você)</span>}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${badge.cls}`}>
                  <BadgeIcon size={11} />
                  {badge.label}
                </span>
                {!isSelf && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleRole(user)} title="Alternar role"
                      className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#2a2d3e] hover:text-white transition-colors">
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => deleteUser(user.username)}
                      className="p-1.5 rounded-lg text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {users.length === 0 && (
            <div className="text-center text-[#64748b] py-12">
              Nenhum usuário configurado.
            </div>
          )}
        </div>
      )}

      {/* Role explanation */}
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Sobre as funções</p>
        <div className="flex items-start gap-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex-shrink-0">
            <Shield size={10} />admin
          </span>
          <p className="text-xs text-[#64748b]">Acesso total — pode criar/modificar/remover containers, apps, arquivos e outros usuários.</p>
        </div>
        <div className="flex items-start gap-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[#2a2d3e] text-[#94a3b8] border border-[#3a3d4e] flex-shrink-0">
            <Eye size={10} />viewer
          </span>
          <p className="text-xs text-[#64748b]">Somente leitura — pode ver containers, logs, métricas e arquivos, mas não pode fazer alterações.</p>
        </div>
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onDone={load} />}
    </div>
  )
}
