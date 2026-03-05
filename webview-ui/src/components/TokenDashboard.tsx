import type { OfficeState } from '../office/engine/officeState.js'
import type { TokenUsage } from '../hooks/useServerMessages.js'

interface TokenDashboardProps {
  agentTokens: Record<number, TokenUsage>
  agents: number[]
  officeState: OfficeState
  onClose: () => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 'var(--pixel-controls-z)',
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxShadow: 'var(--pixel-shadow)',
  padding: 0,
  minWidth: 260,
  maxHeight: '80vh',
  overflowY: 'auto',
  fontSize: '22px',
  color: 'var(--pixel-text)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  borderBottom: '2px solid var(--pixel-border)',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--pixel-text-dim)',
  cursor: 'pointer',
  fontSize: '22px',
  padding: '0 4px',
}

const peerNameStyle: React.CSSProperties = {
  padding: '4px 8px 2px',
  display: 'flex',
  justifyContent: 'space-between',
  fontWeight: 'bold',
}

const agentRowStyle: React.CSSProperties = {
  padding: '1px 8px 1px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  color: 'var(--pixel-text-dim)',
}

const totalRowStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderTop: '2px solid var(--pixel-border)',
  display: 'flex',
  justifyContent: 'space-between',
  fontWeight: 'bold',
}

export function TokenDashboard({ agentTokens, agents, officeState, onClose }: TokenDashboardProps) {
  // Group agents by peer name
  const groups = new Map<string, Array<{ id: number; project: string; tokens: TokenUsage }>>()

  for (const id of agents) {
    const tokens = agentTokens[id]
    if (!tokens) continue

    const ch = officeState.characters.get(id)
    const folderName = ch?.folderName || `Agent ${id}`

    // folderName for peer agents is "PeerName: project"
    const colonIdx = folderName.indexOf(': ')
    const peerName = colonIdx >= 0 ? folderName.slice(0, colonIdx) : 'Local'
    const project = colonIdx >= 0 ? folderName.slice(colonIdx + 2) : folderName

    if (!groups.has(peerName)) groups.set(peerName, [])
    groups.get(peerName)!.push({ id, project, tokens })
  }

  let grandInput = 0
  let grandOutput = 0

  for (const t of Object.values(agentTokens)) {
    grandInput += t.input
    grandOutput += t.output
  }

  const grandTotal = grandInput + grandOutput
  const hasData = grandTotal > 0

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Token Usage</span>
        <button style={closeBtnStyle} onClick={onClose}>X</button>
      </div>

      {!hasData && (
        <div style={{ padding: '8px', color: 'var(--pixel-text-dim)' }}>
          No token data yet
        </div>
      )}

      {[...groups.entries()].map(([peerName, agentList]) => {
        let peerTotal = 0
        for (const a of agentList) {
          peerTotal += a.tokens.input + a.tokens.output
        }
        return (
          <div key={peerName}>
            <div style={peerNameStyle}>
              <span>{peerName}</span>
              <span>{formatTokens(peerTotal)}</span>
            </div>
            {agentList.map((a) => (
              <div key={a.id} style={agentRowStyle}>
                <span>{a.project}</span>
                <span>{formatTokens(a.tokens.input)} in / {formatTokens(a.tokens.output)} out</span>
              </div>
            ))}
          </div>
        )
      })}

      {hasData && (
        <div style={totalRowStyle}>
          <span>Total</span>
          <span>{formatTokens(grandTotal)}</span>
        </div>
      )}
    </div>
  )
}
