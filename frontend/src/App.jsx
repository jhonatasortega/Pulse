import { useRef, useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Store, Activity, HardDrive, Database, TerminalSquare, Users as UsersIcon } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Containers from './pages/Containers'
import AppStore from './pages/AppStore'
import Metrics from './pages/Metrics'
import System from './pages/System'
import Storage from './pages/Storage'
import Terminal from './pages/Terminal'
import Users from './pages/Users'

// ─── Nav definition ──────────────────────────────────────────────────────────
const NAV = [
  { path: '/containers', label: 'Containers', icon: Box },
  { path: '/store',      label: 'App Store',  icon: Store },
  { path: '/storage',    label: 'Storage',    icon: Database },
  { path: '/metrics',    label: 'Métricas',   icon: Activity },
  { path: '/system',     label: 'Sistema',    icon: HardDrive },
  { path: '/terminal',   label: 'Terminal',   icon: TerminalSquare },
  { path: '/users',      label: 'Usuários',   icon: UsersIcon },
]

function pageFor(pathname) {
  if (pathname.startsWith('/containers')) return 'containers'
  if (pathname.startsWith('/store'))      return 'store'
  if (pathname.startsWith('/storage'))    return 'storage'
  if (pathname.startsWith('/metrics'))    return 'metrics'
  if (pathname.startsWith('/system'))     return 'system'
  if (pathname.startsWith('/terminal'))   return 'terminal'
  if (pathname.startsWith('/users'))      return 'users'
  return null
}

function PageContent({ id }) {
  if (id === 'containers') return <Containers />
  if (id === 'store')      return <AppStore />
  if (id === 'storage')    return <Storage />
  if (id === 'metrics')    return <Metrics />
  if (id === 'system')     return <System />
  if (id === 'terminal')   return <Terminal />
  if (id === 'users')      return <Users />
  return null
}

// ─── Draggable Window ─────────────────────────────────────────────────────────
const DEFAULT_W = 900
const DEFAULT_H = 620

function Window({ id, label, onClose }) {
  const winRef   = useRef(null)
  const [maximized, setMaximized]   = useState(false)
  const [prevGeom, setPrevGeom]     = useState(null)
  const [mounted,  setMounted]      = useState(false)

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  // Initial centered position
  useEffect(() => {
    const el = winRef.current
    if (!el || maximized) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    el.style.width  = DEFAULT_W + 'px'
    el.style.height = DEFAULT_H + 'px'
    el.style.left   = Math.max(0, (vw - DEFAULT_W) / 2) + 'px'
    el.style.top    = Math.max(0, (vh - DEFAULT_H) / 3) + 'px'
  }, []) // eslint-disable-line

  function startDrag(e) {
    if (maximized) return
    if (e.button !== 0) return
    const el = winRef.current
    const startX = e.clientX - el.offsetLeft
    const startY = e.clientY - el.offsetTop

    function onMove(ev) {
      el.style.left = Math.max(0, ev.clientX - startX) + 'px'
      el.style.top  = Math.max(0, ev.clientY - startY) + 'px'
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }

  function toggleMaximize() {
    const el = winRef.current
    if (!maximized) {
      setPrevGeom({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height })
      setMaximized(true)
    } else {
      if (prevGeom) {
        el.style.left   = prevGeom.left
        el.style.top    = prevGeom.top
        el.style.width  = prevGeom.width
        el.style.height = prevGeom.height
      }
      setMaximized(false)
    }
  }

  return (
    <div
      ref={winRef}
      className={[
        'fixed z-40 flex flex-col overflow-hidden',
        'bg-[#0f1117]/90 backdrop-blur-2xl',
        'border border-white/10 rounded-2xl shadow-2xl',
        'transition-[opacity,transform] duration-200',
        mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        maximized ? '!left-0 !top-0 !w-screen !h-screen !rounded-none' : '',
      ].join(' ')}
      style={{ minWidth: 320, minHeight: 240 }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0 select-none"
        onMouseDown={startDrag}
        onDoubleClick={toggleMaximize}
        style={{ cursor: maximized ? 'default' : 'grab' }}
      >
        {/* macOS-style traffic lights */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all flex-shrink-0"
          title="Fechar"
        />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleMaximize}
          className="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-110 transition-all flex-shrink-0"
          title={maximized ? 'Restaurar' : 'Maximizar'}
        />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleMaximize}
          className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-110 transition-all flex-shrink-0"
          title={maximized ? 'Restaurar' : 'Maximizar'}
        />
        <span className="flex-1 text-center text-sm font-medium text-white/70 pointer-events-none">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <PageContent id={id} />
      </div>
    </div>
  )
}

// ─── Dock ─────────────────────────────────────────────────────────────────────
function Dock({ active, onNavigate }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-end gap-1.5 px-4 py-3 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl">
      {/* Home button */}
      <DockItem
        label="Início"
        isActive={active === null}
        onClick={() => onNavigate('/')}
      >
        <img src="/logo.svg" alt="Pulse" className="w-7 h-7" />
      </DockItem>

      <div className="w-px h-8 bg-white/10 mx-1" />

      {NAV.map(({ path, label, icon: Icon }) => (
        <DockItem
          key={path}
          label={label}
          isActive={active === pageFor(path)}
          onClick={() => onNavigate(path)}
        >
          <Icon size={20} />
        </DockItem>
      ))}
    </div>
  )
}

function DockItem({ label, isActive, onClick, children }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="relative flex flex-col items-center">
      {/* Tooltip */}
      {hovered && (
        <div className="absolute bottom-full mb-2 px-2 py-1 rounded-md bg-black/80 backdrop-blur text-white text-xs whitespace-nowrap pointer-events-none">
          {label}
        </div>
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          'w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-150',
          isActive
            ? 'bg-white/20 text-white scale-110'
            : 'text-white/60 hover:bg-white/10 hover:text-white hover:scale-110',
        ].join(' ')}
      >
        {children}
      </button>

      {/* Active indicator dot */}
      <span
        className={[
          'mt-1 w-1 h-1 rounded-full transition-all duration-150',
          isActive ? 'bg-white/80' : 'bg-transparent',
        ].join(' ')}
      />
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const location  = useLocation()
  const navigate  = useNavigate()

  const active    = pageFor(location.pathname)

  // Track which windows have been opened this session (so they don't re-mount on re-open)
  const [openWindows, setOpenWindows] = useState(() => {
    const id = pageFor(location.pathname)
    return id ? [id] : []
  })

  // When URL changes, add window to open list
  useEffect(() => {
    const id = pageFor(location.pathname)
    if (id && !openWindows.includes(id)) {
      setOpenWindows(prev => [...prev, id])
    }
  }, [location.pathname]) // eslint-disable-line

  function closeWindow(id) {
    setOpenWindows(prev => prev.filter(w => w !== id))
    if (active === id) navigate('/')
  }

  function handleNavigate(path) {
    const id = pageFor(path)
    if (id && active === id) {
      // clicking same icon closes window
      closeWindow(id)
    } else {
      navigate(path)
    }
  }

  const labelFor = useCallback((id) => {
    return NAV.find(n => pageFor(n.path) === id)?.label ?? id
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0f1117]">
      {/* Dashboard always fills background */}
      <div className="absolute inset-0 pb-24 overflow-y-auto">
        <Dashboard />
      </div>

      {/* Floating windows */}
      {openWindows.map(id => (
        <Window
          key={id}
          id={id}
          label={labelFor(id)}
          onClose={() => closeWindow(id)}
        />
      ))}

      {/* Bottom dock */}
      <Dock active={active} onNavigate={handleNavigate} />
    </div>
  )
}
