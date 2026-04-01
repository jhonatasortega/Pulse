import { useState, useEffect } from 'react'
import { auth } from '../auth'
import { api } from '../api'

export default function AuthGate({ children }) {
  const [authEnabled, setAuthEnabled] = useState(null)
  const [verified, setVerified] = useState(false)
  const [key, setKey] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.auth.status().then(({ auth_enabled }) => {
      setAuthEnabled(auth_enabled)
      if (!auth_enabled) {
        setVerified(true)
        return
      }
      const stored = auth.getKey()
      if (stored) {
        api.auth.verify()
          .then(() => setVerified(true))
          .catch(() => { auth.clear(); setVerified(false) })
      }
    })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    auth.setKey(key, remember)
    try {
      await api.auth.verify()
      setVerified(true)
    } catch {
      auth.clear()
      setError('Chave inválida')
    } finally {
      setLoading(false)
    }
  }

  if (authEnabled === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1117]">
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1117]">
        <div className="w-full max-w-sm mx-4">
          <div className="text-center mb-8">
            <span className="text-4xl">⚡</span>
            <h1 className="text-2xl font-bold text-white mt-2">Pulse</h1>
            <p className="text-sm text-[#94a3b8] mt-1">Insira sua API key para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs text-[#94a3b8] mb-1.5 block">API Key</label>
              <input
                type="password"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="pulse_xxxxxxxxxxxxxxxx"
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#6366f1] transition-colors"
                autoFocus
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="accent-indigo-500"
              />
              Lembrar neste dispositivo
            </label>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={!key || loading}
              className="w-full py-2.5 bg-[#6366f1] text-white rounded-lg text-sm font-medium hover:bg-[#4f46e5] transition-colors disabled:opacity-40"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs text-[#475569] mt-4">
            Configure via <code className="text-indigo-400">PULSE_API_KEY</code> no docker-compose
          </p>
        </div>
      </div>
    )
  }

  return children
}
