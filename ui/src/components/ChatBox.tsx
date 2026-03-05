import { useEffect, useRef } from 'react'
import { CHAT_PANEL_MAX_HEIGHT } from '../constants.js'

export interface ChatMessage {
  sender: string
  text: string
  agentId: number
  timestamp: number
}

interface ChatBoxProps {
  messages: ChatMessage[]
  isOpen: boolean
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 52,
  right: 10,
  width: 320,
  maxHeight: CHAT_PANEL_MAX_HEIGHT,
  zIndex: 'var(--pixel-controls-z)',
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxShadow: 'var(--pixel-shadow)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '20px',
  color: 'var(--pixel-text-dim)',
  borderBottom: '2px solid var(--pixel-border)',
  flexShrink: 0,
}

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  padding: '4px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flexGrow: 1,
}

const messageStyle: React.CSSProperties = {
  fontSize: '20px',
  lineHeight: 1.3,
  color: 'var(--pixel-text)',
}

const agentNameStyle: React.CSSProperties = {
  color: 'var(--pixel-accent)',
  fontWeight: 'bold',
}

const peerNameStyle: React.CSSProperties = {
  color: 'var(--pixel-text-dim)',
  fontWeight: 'normal',
}

function formatSender(sender: string): React.ReactNode {
  const colonIdx = sender.indexOf(': ')
  if (colonIdx >= 0) {
    const peer = sender.slice(0, colonIdx)
    const agent = sender.slice(colonIdx + 2)
    return (
      <>
        <span style={agentNameStyle}>{agent}</span>
        {' '}
        <span style={peerNameStyle}>[{peer}]</span>
      </>
    )
  }
  return <span style={agentNameStyle}>{sender}</span>
}

export function ChatBox({ messages, isOpen }: ChatBoxProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  if (!isOpen) return null

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Chat</div>
      <div ref={listRef} style={listStyle}>
        {messages.length === 0 ? (
          <div style={{ fontSize: '20px', color: 'var(--pixel-text-dim)', padding: '8px 0' }}>
            No messages yet...
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={messageStyle}>
              {formatSender(msg.sender)}:{' '}
              {msg.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
