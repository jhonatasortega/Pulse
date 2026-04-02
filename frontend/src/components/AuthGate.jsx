import { useState, useEffect } from 'react'
import { auth } from '../auth'
import { api } from '../api'
import { Eye, EyeOff, Lock, KeyRound, ShieldCheck, User } from 'lucide-react'

function Background() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  )
}

// ─── First-access: create admin user ─────────────────────────────────────────
function SetupUserScreen({ onDone }) {
  const [displayName, setDisplayName] = useState('')
  const [username,    setUsername]    = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [show,        setShow]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  // Auto-derive username from display name
  const derivedUser = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'admin'

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem'); return }
    if (password.length < 8)  { setError('Mínimo 8 caracteres');    return }
    if (!displayName.trim())  { setError('Informe seu nome');        return }
    setLoading(true); setError('')
    const finalUser = username.trim() || derivedUser
    try {
      const user = await api.auth.setupUser(finalUser, password, displayName.trim())
      auth.setUser(user, true)
      auth.setPass(password, true)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 mb-4">
          <ShieldCheck size={28} className="text-indigo-300" />
        </div>
        <h1 className="text-2xl font-bold text-white">Bem-vindo ao Pulse</h1>
        <p className="text-sm text-white/50 mt-2">Crie sua conta de administrador</p>
      </div>

      <form onSubmit={submit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        {/* Display name — shown in greeting */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Seu nome</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
              autoFocus />
          </div>
        </div>

        {/* Username — auto-derived, editable */}
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Login <span className="text-white/25">(preenchido automaticamente)</span></label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder={derivedUser} className={inp} />
        </div>

        <div className="relative">
          <label className="text-xs text-white/50 mb-1.5 block">Senha</label>
          <input type={show ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"
            className={inp} />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 bottom-3 text-white/30 hover:text-white/70 transition-colors">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Confirmar senha</label>
          <input type={show ? 'text' : 'password'} value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha"
            className={inp} />
        </div>

        {password.length > 0 && (
          <div className="flex gap-1 items-center">
            {[4, 8, 12, 16].map(n => (
              <div key={n} className={`flex-1 h-1 rounded-full transition-all ${password.length >= n ? (password.length >= 16 ? 'bg-green-400' : password.length >= 8 ? 'bg-yellow-400' : 'bg-red-400') : 'bg-white/10'}`} />
            ))}
            <span className="text-[10px] text-white/40 ml-2">
              {password.length < 8 ? 'fraca' : password.length < 12 ? 'boa' : 'forte'}
            </span>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button type="submit" disabled={!displayName || !password || !confirm || loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40">
          {loading ? 'Criando conta...' : 'Criar conta e entrar'}
        </button>
      </form>
    </div>
  )
}

// ─── First-access: API-key setup (legacy single-user mode) ───────────────────
function SetupKeyScreen({ onDone }) {
  const [key, setKey]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function submit(e) {
    e.preventDefault()
    if (key !== confirm) { setError('As chaves não coincidem'); return }
    if (key.length < 8)  { setError('Mínimo 8 caracteres');    return }
    setLoading(true); setError('')
    try {
      await api.auth.setup(key)
      auth.setKey(key, true)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 mb-4">
          <ShieldCheck size={28} className="text-indigo-300" />
        </div>
        <h1 className="text-2xl font-bold text-white">Bem-vindo ao Pulse</h1>
        <p className="text-sm text-white/50 mt-2">Configure uma senha para proteger sua instância</p>
      </div>

      <form onSubmit={submit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="relative">
          <label className="text-xs text-white/50 mb-1.5 block">Criar senha</label>
          <input type={show ? 'text' : 'password'} value={key}
            onChange={e => setKey(e.target.value)} placeholder="Mínimo 8 caracteres"
            className={inp} autoFocus />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 bottom-3 text-white/30 hover:text-white/70 transition-colors">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Confirmar senha</label>
          <input type={show ? 'text' : 'password'} value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha"
            className={inp} />
        </div>

        {key.length > 0 && (
          <div className="flex gap-1 items-center">
            {[4, 8, 12, 16].map(n => (
              <div key={n} className={`flex-1 h-1 rounded-full transition-all ${key.length >= n ? (key.length >= 16 ? 'bg-green-400' : key.length >= 8 ? 'bg-yellow-400' : 'bg-red-400') : 'bg-white/10'}`} />
            ))}
            <span className="text-[10px] text-white/40 ml-2">
              {key.length < 8 ? 'fraca' : key.length < 12 ? 'boa' : 'forte'}
            </span>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button type="submit" disabled={!key || !confirm || loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40">
          {loading ? 'Configurando...' : 'Criar senha e entrar'}
        </button>
      </form>
    </div>
  )
}

// ─── Multi-user login screen ──────────────────────────────────────────────────
function LoginUserScreen({ onDone }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const user = await api.auth.login(username, password)
      auth.setUser(user, remember)
      auth.setPass(password, remember)
      onDone()
    } catch {
      setError('Usuário ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <span className="text-3xl">⚡</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Pulse</h1>
        <p className="text-sm text-white/40 mt-1">Entre para continuar</p>
      </div>

      <form onSubmit={submit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Usuário</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
              autoFocus />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Senha</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input type={show ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors" />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-white/50 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
            className="accent-indigo-500 w-4 h-4" />
          Lembrar neste dispositivo
        </label>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <KeyRound size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button type="submit" disabled={!username || !password || loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

// ─── API-key login screen (legacy) ────────────────────────────────────────────
function LoginKeyScreen({ onDone }) {
  const [key, setKey]           = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    auth.setKey(key, remember)
    try {
      await api.auth.verify()
      onDone()
    } catch {
      auth.clear()
      setError('Senha incorreta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-4">
          <span className="text-3xl">⚡</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Pulse</h1>
        <p className="text-sm text-white/40 mt-1">Entre para continuar</p>
      </div>

      <form onSubmit={submit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Senha / API Key</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input type={show ? 'text' : 'password'} value={key}
              onChange={e => setKey(e.target.value)} placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors"
              autoFocus />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-white/50 cursor-pointer select-none">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
            className="accent-indigo-500 w-4 h-4" />
          Lembrar neste dispositivo
        </label>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <KeyRound size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button type="submit" disabled={!key || loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40">
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-xs text-white/25 mt-4">
        Configure via <code className="text-indigo-400/70">PULSE_API_KEY</code> no docker-compose
      </p>
    </div>
  )
}

// ─── AuthGate ─────────────────────────────────────────────────────────────────
export default function AuthGate({ children }) {
  const [status, setStatus]     = useState(null)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    api.auth.status().then(s => {
      setStatus(s)

      // No auth required at all
      if (!s.auth_enabled && !s.setup_required) {
        setVerified(true)
        return
      }

      // Multi-user mode: check stored credentials
      if (s.multi_user) {
        const user = auth.getUser()
        const pass = auth.getPass()
        if (user && pass) {
          api.auth.login(user.username, pass)
            .then(u => { auth.setUser(u, true); auth.setPass(pass, true); setVerified(true) })
            .catch(() => auth.clear())
        }
        return
      }

      // API-key mode: check stored key
      const storedKey = auth.getKey()
      if (storedKey) {
        api.auth.verify()
          .then(() => setVerified(true))
          .catch(() => auth.clear())
      }
    })
  }, [])

  if (status === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1117]">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
      </div>
    )
  }

  if (verified) return children

  return (
    <div className="relative flex h-screen items-center justify-center bg-[#0a0c12] overflow-hidden">
      <Background />
      <div className="relative z-10 w-full flex justify-center">
        {status.setup_required ? <SetupUserScreen onDone={() => setVerified(true)} /> :
         status.multi_user    ? <LoginUserScreen onDone={() => setVerified(true)} /> :
                                <LoginKeyScreen  onDone={() => setVerified(true)} />}
      </div>
    </div>
  )
}
