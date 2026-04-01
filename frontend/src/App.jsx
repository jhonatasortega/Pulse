import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Home, Box, Store, Activity, HardDrive, Database, ChevronLeft, ChevronRight } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Containers from './pages/Containers'
import AppStore from './pages/AppStore'
import Metrics from './pages/Metrics'
import System from './pages/System'
import Storage from './pages/Storage'

const navItems = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/containers', label: 'Containers', icon: Box },
  { to: '/store', label: 'App Store', icon: Store },
  { to: '/storage', label: 'Armazenamento', icon: Database },
  { to: '/metrics', label: 'Métricas', icon: Activity },
  { to: '/system', label: 'Sistema', icon: HardDrive },
]

export default function App() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f1117]">
      <aside className={`flex-shrink-0 bg-[#1a1d27] border-r border-[#2a2d3e] flex flex-col transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Logo */}
        <div className={`border-b border-[#2a2d3e] flex items-center ${collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5'}`}>
          {collapsed ? (
            <span className="text-2xl">⚡</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <span className="text-lg font-bold text-white tracking-tight">Pulse</span>
                <p className="text-xs text-[#94a3b8]">Container Manager</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-[#6366f1]/20 text-[#818cf8] font-medium'
                  : 'text-[#94a3b8] hover:bg-[#2a2d3e] hover:text-white'
                }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Footer / toggle */}
        <div className={`border-t border-[#2a2d3e] p-2 flex ${collapsed ? 'justify-center' : 'items-center justify-between px-4 py-3'}`}>
          {!collapsed && <span className="text-xs text-[#64748b]">v1.0.0 · Pulse</span>}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-white hover:bg-[#2a2d3e] transition-colors"
            title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/store" element={<AppStore />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/storage/:diskPath" element={<Storage />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/system" element={<System />} />
        </Routes>
      </main>
    </div>
  )
}
