import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  Cloud,
  CloudRain,
  CloudSun,
  ExternalLink,
  Gauge,
  LogOut,
  Radio,
  Sunrise,
  Wallet,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { base } from 'wagmi/chains'
import {
  INNER_FORECAST_ADDRESS,
  innerForecastAbi,
  isContractConfigured,
} from './config/contract'
import { DATA_SUFFIX } from './config/wagmi'

const CONDITIONS = [
  {
    name: 'Clear',
    phrase: 'Everything feels steady',
    short: 'Calm air',
    color: '#b9f227',
    icon: CloudSun,
  },
  {
    name: 'Cloudy',
    phrase: 'My thoughts feel tangled',
    short: 'Low visibility',
    color: '#a7b1aa',
    icon: Cloud,
  },
  {
    name: 'Electric',
    phrase: 'Energy is running high',
    short: 'High voltage',
    color: '#ffd84d',
    icon: Zap,
  },
  {
    name: 'Drizzle',
    phrase: 'I feel a little low',
    short: 'Soft rain',
    color: '#5fc8ff',
    icon: CloudRain,
  },
  {
    name: 'Windy',
    phrase: 'Focus keeps moving away',
    short: 'Changing fast',
    color: '#ff785a',
    icon: Wind,
  },
  {
    name: 'Warm front',
    phrase: 'Things are getting lighter',
    short: 'Rising gently',
    color: '#ff9fc7',
    icon: Sunrise,
  },
] as const

type Stats = {
  totalReports: bigint
  streak: bigint
  lastActiveDay: bigint
  todayCount: number
  lastCondition: number
  lastReportedAt: bigint
}

const EMPTY_STATS: Stats = {
  totalReports: 0n,
  streak: 0n,
  lastActiveDay: 0n,
  todayCount: 0,
  lastCondition: 0,
  lastReportedAt: 0n,
}

function toBigInt(value: unknown) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' || typeof value === 'string') {
    return BigInt(value)
  }
  return 0n
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint' || typeof value === 'string') {
    return Number(value)
  }
  return 0
}

function normalizeStats(value: unknown): Stats {
  if (!value) return EMPTY_STATS

  if (Array.isArray(value)) {
    return {
      totalReports: toBigInt(value[0]),
      streak: toBigInt(value[1]),
      lastActiveDay: toBigInt(value[2]),
      todayCount: toNumber(value[3]),
      lastCondition: toNumber(value[4]),
      lastReportedAt: toBigInt(value[5]),
    }
  }

  const item = value as Record<string, unknown>
  return {
    totalReports: toBigInt(item.totalReports),
    streak: toBigInt(item.streak),
    lastActiveDay: toBigInt(item.lastActiveDay),
    todayCount: toNumber(item.todayCount),
    lastCondition: toNumber(item.lastCondition),
    lastReportedAt: toBigInt(item.lastReportedAt),
  }
}

function shortAddress(address?: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTime(timestamp: bigint) {
  if (timestamp === 0n) return 'NO SIGNAL YET'

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Number(timestamp) * 1000))
}

function cleanError(error: Error | null) {
  if (!error) return ''
  const message = error.message

  if (message.includes('User rejected') || message.includes('User denied')) {
    return 'Request cancelled in wallet.'
  }
  if (message.includes('DailyLimitReached')) {
    return 'Five reports are already logged today.'
  }
  if (message.includes('insufficient funds')) {
    return 'Not enough ETH on Base for network gas.'
  }

  return message.split('\n')[0].slice(0, 180)
}

export function App() {
  const [selected, setSelected] = useState(0)
  const [walletOpen, setWalletOpen] = useState(false)
  const [success, setSuccess] = useState('')

  const {
    address,
    isConnected,
    isConnecting: accountConnecting,
    isReconnecting,
  } = useAccount()
  const chainId = useChainId()
  const {
    connectors,
    connect,
    error: connectError,
    isPending: connecting,
  } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()

  const connectorList = useMemo(() => {
    const seen = new Set<string>()
    return connectors.filter((connector) => {
      const key = `${connector.id}:${connector.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [connectors])

  const statsQuery = useReadContract({
    address: INNER_FORECAST_ADDRESS,
    abi: innerForecastAbi,
    functionName: 'statsOf',
    args: [address!],
    chainId: base.id,
    query: {
      enabled: Boolean(address && isContractConfigured),
    },
  })

  const globalQuery = useReadContract({
    address: INNER_FORECAST_ADDRESS,
    abi: innerForecastAbi,
    functionName: 'globalReports',
    chainId: base.id,
    query: {
      enabled: isContractConfigured,
    },
  })

  const conditionCountQuery = useReadContract({
    address: INNER_FORECAST_ADDRESS,
    abi: innerForecastAbi,
    functionName: 'conditionCountOf',
    args: [address!, selected],
    chainId: base.id,
    query: {
      enabled: Boolean(address && isContractConfigured),
    },
  })

  const stats = useMemo(
    () => normalizeStats(statsQuery.data),
    [statsQuery.data],
  )

  const {
    data: hash,
    error: writeError,
    isPending: waitingForWallet,
    writeContract,
  } = useWriteContract()

  const {
    isLoading: confirming,
    isSuccess: confirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!confirmed || !hash) return

    setSuccess(`${CONDITIONS[selected].name} report logged on Base.`)
    void statsQuery.refetch()
    void globalQuery.refetch()
    void conditionCountQuery.refetch()
  }, [confirmed, hash])

  useEffect(() => {
    if (isConnected) setWalletOpen(false)
  }, [isConnected])

  const wrongChain = isConnected && chainId !== base.id
  const busy = waitingForWallet || confirming || switching || connecting
  const error = cleanError(writeError || receiptError)
  const current = CONDITIONS[selected]
  const CurrentIcon = current.icon

  const submitReport = () => {
    setSuccess('')

    if (!isConnected) {
      setWalletOpen(true)
      return
    }

    if (wrongChain) {
      switchChain({ chainId: base.id })
      return
    }

    if (!isContractConfigured || stats.todayCount >= 5) return

    writeContract({
      address: INNER_FORECAST_ADDRESS,
      abi: innerForecastAbi,
      functionName: 'report',
      args: [selected],
      chainId: base.id,
      dataSuffix: DATA_SUFFIX,
    })
  }

  const actionText = () => {
    if (!isConnected) return 'CONNECT TO REPORT'
    if (wrongChain) return switching ? 'SWITCHING...' : 'SWITCH TO BASE'
    if (!isContractConfigured) return 'CONTRACT NOT CONFIGURED'
    if (stats.todayCount >= 5) return 'DAILY WINDOW COMPLETE'
    if (waitingForWallet) return 'CONFIRM IN WALLET'
    if (confirming) return 'TRANSMITTING...'
    return 'TRANSMIT REPORT'
  }

  return (
    <div className="station">
      <header className="topbar">
        <a className="identity" href="#station">
          <span className="identity-icon">
            <Radio size={20} />
          </span>
          <span>
            <strong>INNER FORECAST</strong>
            <small>PERSONAL WEATHER / BASE</small>
          </span>
        </a>

        <div className="wallet-zone">
          {isReconnecting || accountConnecting ? (
            <span className="mono">SCANNING WALLET...</span>
          ) : isConnected ? (
            <>
              <span className="live-label">
                <i />
                BASE LIVE
              </span>
              <span className="mono wallet-address">
                {shortAddress(address)}
              </span>
              <button
                className="square-button"
                type="button"
                onClick={() => disconnect()}
                title="Disconnect"
                aria-label="Disconnect wallet"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button
              className="connect-button"
              type="button"
              onClick={() => setWalletOpen(true)}
            >
              <Wallet size={17} />
              CONNECT
            </button>
          )}
        </div>
      </header>

      {walletOpen && !isConnected && (
        <div
          className="wallet-backdrop"
          onClick={() => setWalletOpen(false)}
          role="presentation"
        >
          <section
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="wallet-dialog-head">
              <div>
                <span className="eyebrow">RECEIVER ACCESS</span>
                <h2 id="wallet-title">Choose signal source</h2>
              </div>
              <button
                className="square-button"
                type="button"
                onClick={() => setWalletOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="wallet-options">
              {connectorList.map((connector) => {
                const name = connector.name.toLowerCase()
                const isBase = name.includes('base')

                return (
                  <button
                    type="button"
                    key={`${connector.id}:${connector.name}`}
                    onClick={() => connect({ connector })}
                    disabled={connecting}
                  >
                    <span className={isBase ? 'base-source' : 'web-source'}>
                      {isBase ? <Radio size={21} /> : <Wallet size={21} />}
                    </span>
                    <span>
                      <strong>
                        {name === 'injected'
                          ? 'Browser wallet'
                          : connector.name}
                      </strong>
                      <small>
                        {isBase
                          ? 'Base smart wallet'
                          : 'MetaMask, Rabby or browser extension'}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                )
              })}

              {connectError && (
                <p className="dialog-error">{cleanError(connectError)}</p>
              )}
            </div>
          </section>
        </div>
      )}

      {!isContractConfigured && (
        <div className="setup-warning">
          CONTRACT OFFLINE / ADD THE DEPLOYED ADDRESS TO
          SRC/CONFIG/CONTRACT.TS
        </div>
      )}

      <main id="station">
        <section className="console">
          <div className="console-copy">
            <span className="eyebrow">
              DAILY ATMOSPHERIC OBSERVATION
            </span>
            <h1>What is the weather inside?</h1>
            <p>
              Read the moment. Choose the closest condition. Send up to five
              honest signals before the UTC day rolls over.
            </p>

            <div className="day-scale">
              <div className="scale-head">
                <span>TODAY'S SIGNAL WINDOW</span>
                <strong>{stats.todayCount}/5</strong>
              </div>
              <div className="scale-track">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    className={index < stats.todayCount ? 'filled' : ''}
                    key={index}
                  >
                    {index < stats.todayCount ? <Check size={15} /> : index + 1}
                  </span>
                ))}
              </div>
              <small>
                {5 - stats.todayCount} transmissions remaining today
              </small>
            </div>
          </div>

          <div className="radar-panel" style={{ '--signal': current.color } as React.CSSProperties}>
            <div className="radar-meta">
              <span>LIVE READING</span>
              <span>UTC / {new Date().toISOString().slice(11, 16)}</span>
            </div>
            <div className="radar">
              <div className="radar-sweep" />
              <div className="radar-axis horizontal" />
              <div className="radar-axis vertical" />
              <div className="radar-core">
                <CurrentIcon size={54} strokeWidth={1.5} />
                <strong>{current.name}</strong>
                <span>{current.short}</span>
              </div>
              <i className="signal-dot dot-one" />
              <i className="signal-dot dot-two" />
              <i className="signal-dot dot-three" />
            </div>
            <div className="radar-caption">
              <span>SELECTED CONDITION</span>
              <strong>{current.phrase}</strong>
            </div>
          </div>
        </section>

        <section className="condition-bay">
          <div className="bay-heading">
            <div>
              <span className="eyebrow">CONDITION LIBRARY / 06</span>
              <h2>Choose the closest sky</h2>
            </div>
            <p>No writing required. Pick the signal that feels true now.</p>
          </div>

          <div className="condition-strip">
            {CONDITIONS.map((condition, index) => {
              const Icon = condition.icon
              return (
                <button
                  className={selected === index ? 'condition active' : 'condition'}
                  type="button"
                  key={condition.name}
                  onClick={() => setSelected(index)}
                  style={{ '--condition': condition.color } as React.CSSProperties}
                >
                  <span className="condition-index">0{index + 1}</span>
                  <Icon size={27} strokeWidth={1.7} />
                  <strong>{condition.name}</strong>
                  <small>{condition.phrase}</small>
                  <i />
                </button>
              )
            })}
          </div>

          <div className="transmit-row">
            <div className="selected-summary">
              <span
                className="summary-icon"
                style={{ background: current.color }}
              >
                <CurrentIcon size={22} />
              </span>
              <span>
                <small>READY TO TRANSMIT</small>
                <strong>{current.name} / {current.phrase}</strong>
              </span>
            </div>

            <button
              className="transmit-button"
              type="button"
              onClick={submitReport}
              disabled={busy || !isContractConfigured || stats.todayCount >= 5}
            >
              <span>{actionText()}</span>
              <Radio size={21} />
            </button>
          </div>

          {(success || error) && (
            <div className={error ? 'notice error' : 'notice'}>
              <span>{error || success}</span>
              {hash && (
                <a
                  href={`https://basescan.org/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  BASESCAN <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </section>

        <section className="telemetry">
          <div className="telemetry-title">
            <Gauge size={24} />
            <span>
              <small>PERSONAL TELEMETRY</small>
              <strong>Your atmospheric record</strong>
            </span>
          </div>

          <div className="telemetry-grid">
            <div>
              <span>REPORTS</span>
              <strong>{stats.totalReports.toString()}</strong>
              <small>all personal signals</small>
            </div>
            <div>
              <span>ACTIVE STREAK</span>
              <strong>{stats.streak.toString()}</strong>
              <small>consecutive UTC days</small>
            </div>
            <div>
              <span>{current.name.toUpperCase()}</span>
              <strong>{toBigInt(conditionCountQuery.data).toString()}</strong>
              <small>times this sky appeared</small>
            </div>
            <div className="last-reading">
              <span>LAST READING</span>
              <strong>
                {stats.totalReports > 0n
                  ? CONDITIONS[stats.lastCondition]?.name || 'Unknown'
                  : 'None'}
              </strong>
              <small>{formatTime(stats.lastReportedAt)} UTC</small>
            </div>
          </div>
        </section>

        <section className="global-band">
          <div>
            <span className="eyebrow">NETWORK PRESSURE</span>
            <h2>One sky, many inner climates.</h2>
          </div>
          <div className="global-reading">
            <span>BASE-WIDE REPORTS</span>
            <strong>{toBigInt(globalQuery.data).toString()}</strong>
            <small>signals recorded by this station</small>
          </div>
        </section>
      </main>

      <footer>
        <span>INNER FORECAST / BASE MAINNET</span>
        <span>NO TOKEN · NO APP FEE · NETWORK GAS ONLY</span>
      </footer>
    </div>
  )
}
