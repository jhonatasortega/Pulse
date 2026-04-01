import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { terminalSocket } from '../api'
import '@xterm/xterm/css/xterm.css'

export default function Terminal() {
  const containerRef = useRef(null)
  const termRef      = useRef(null)
  const wsRef        = useRef(null)
  const fitRef       = useRef(null)

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background:    '#0a0c12',
        foreground:    '#e2e8f0',
        cursor:        '#818cf8',
        cursorAccent:  '#0a0c12',
        selectionBackground: 'rgba(99,102,241,0.3)',
        black:         '#1e2030',
        red:           '#ff5f57',
        green:         '#28c840',
        yellow:        '#febc2e',
        blue:          '#818cf8',
        magenta:       '#c084fc',
        cyan:          '#22d3ee',
        white:         '#e2e8f0',
        brightBlack:   '#475569',
        brightRed:     '#ff8080',
        brightGreen:   '#4ade80',
        brightYellow:  '#fde68a',
        brightBlue:    '#a5b4fc',
        brightMagenta: '#d8b4fe',
        brightCyan:    '#67e8f9',
        brightWhite:   '#f8fafc',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    fitRef.current = fitAddon

    term.open(containerRef.current)
    fitAddon.fit()
    termRef.current = term

    // Connect WebSocket
    const ws = terminalSocket()
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      // Send initial size
      sendResize(term.cols, term.rows)
      term.focus()
    }

    ws.onmessage = (e) => {
      const data = e.data instanceof ArrayBuffer
        ? new Uint8Array(e.data)
        : e.data
      term.write(data)
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[Terminal] Erro de conexão — terminal disponível apenas no servidor Linux.\x1b[0m')
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33m[Terminal] Sessão encerrada.\x1b[0m')
    }

    // Forward keystrokes to WebSocket
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data))
      }
    })

    // Handle resize
    function sendResize(cols, rows) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    }

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      sendResize(term.cols, term.rows)
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      ws.close()
      term.dispose()
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0a0c12]">
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  )
}
