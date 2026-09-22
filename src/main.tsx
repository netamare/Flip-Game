import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Difficulty = 'Easy' | 'Medium' | 'Hard'
type Card = { id: number; icon: string; matched: boolean }

const glyphs = ['◈', '✦', '◉', '⬡', '✧', '◌', '▲', '◆', '☄', '✺', '◍', '✹', '⬢', '✣', '◐', '❖', '☾', '✤']
const configs: Record<Difficulty, { pairs: number; seconds: number; multiplier: number }> = {
  Easy: { pairs: 6, seconds: 90, multiplier: 1 },
  Medium: { pairs: 10, seconds: 120, multiplier: 1.45 },
  Hard: { pairs: 15, seconds: 160, multiplier: 2 },
}

const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - .5)
const makeDeck = (level: Difficulty) => shuffle(glyphs.slice(0, configs[level].pairs).flatMap((icon, n) => [{ id: n * 2, icon, matched: false }, { id: n * 2 + 1, icon, matched: false }]))

function useSound(muted: boolean) {
  return useCallback((kind: 'flip' | 'match' | 'wrong' | 'win') => {
    if (muted) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    const tones = { flip: [450, .045], match: [740, .11], wrong: [180, .12], win: [620, .25] } as const
    osc.frequency.value = tones[kind][0]; osc.type = kind === 'wrong' ? 'sawtooth' : 'sine'
    gain.gain.setValueAtTime(.055, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + tones[kind][1])
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + tones[kind][1])
  }, [muted])
}

const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>(() => (localStorage.getItem('nexus-difficulty') as Difficulty) || 'Medium')
  const [deck, setDeck] = useState<Card[]>(() => makeDeck((localStorage.getItem('nexus-difficulty') as Difficulty) || 'Medium'))
  const [flipped, setFlipped] = useState<number[]>([]), [moves, setMoves] = useState(0), [combo, setCombo] = useState(0), [score, setScore] = useState(0)
  const [time, setTime] = useState(configs[difficulty].seconds), [paused, setPaused] = useState(false), [frozen, setFrozen] = useState(false), [won, setWon] = useState(false), [help, setHelp] = useState(false)
  const [muted, setMuted] = useState(() => localStorage.getItem('nexus-muted') === 'true')
  const [freeze, setFreeze] = useState(1), [scan, setScan] = useState(1)
  const sound = useSound(muted)
  const locked = useRef(false)
  const best = Number(localStorage.getItem(`nexus-best-${difficulty}`) || 0)
  const totalPairs = configs[difficulty].pairs
  const matched = deck.filter(x => x.matched).length / 2

  const newGame = useCallback((level = difficulty) => {
    setDeck(makeDeck(level)); setFlipped([]); setMoves(0); setCombo(0); setScore(0); setTime(configs[level].seconds); setPaused(false); setFrozen(false); setWon(false); setFreeze(1); setScan(1); locked.current = false
  }, [difficulty])
  useEffect(() => { localStorage.setItem('nexus-difficulty', difficulty); newGame(difficulty) }, [difficulty])
  useEffect(() => { localStorage.setItem('nexus-muted', String(muted)) }, [muted])
  useEffect(() => {
    if (paused || frozen || won || time <= 0) return
    const i = window.setInterval(() => setTime(x => x - 1), 1000); return () => clearInterval(i)
  }, [paused, frozen, won, time])
  useEffect(() => { if (time === 0 && !won) setPaused(true) }, [time, won])
  useEffect(() => {
    if (matched === totalPairs && totalPairs > 0 && !won) {
      setWon(true); sound('win'); const final = score + Math.max(0, time * 5)
      if (final > best) localStorage.setItem(`nexus-best-${difficulty}`, String(final))
    }
  }, [matched, totalPairs, won, score, time, best, difficulty, sound])

  const clickCard = (id: number) => {
    if (paused || won || locked.current || flipped.includes(id) || deck.find(c => c.id === id)?.matched) return
    sound('flip'); const next = [...flipped, id]; setFlipped(next)
    if (next.length !== 2) return
    locked.current = true; setMoves(m => m + 1)
    const [a, b] = next.map(x => deck.find(c => c.id === x)!)
    if (a.icon === b.icon) {
      const nextCombo = combo + 1; setCombo(nextCombo); setScore(s => s + Math.round((100 + nextCombo * 25) * configs[difficulty].multiplier)); sound('match')
      window.setTimeout(() => { setDeck(d => d.map(c => next.includes(c.id) ? { ...c, matched: true } : c)); setFlipped([]); locked.current = false }, 430)
    } else {
      setCombo(0); sound('wrong'); window.setTimeout(() => { setFlipped([]); locked.current = false }, 850)
    }
  }
  const useFreeze = () => { if (!freeze || paused || won) return; setFreeze(0); setFrozen(true); window.setTimeout(() => setFrozen(false), 5000) }
  const useScan = () => { if (!scan || paused || won) return; setScan(0); setFlipped(deck.filter(c => !c.matched).map(c => c.id)); window.setTimeout(() => setFlipped([]), 1100) }
  const currentScore = score + (won ? Math.max(0, time * 5) : 0)
  const cardCols = totalPairs <= 6 ? 'six' : totalPairs <= 10 ? 'ten' : 'hard'
  const advanceGame = () => { const next = difficulty === 'Easy' ? 'Medium' : 'Hard'; setDifficulty(next) }

  return <main>
    <div className="stars" />
    <header><div className="brand"><span className="brand-mark">N</span><span>NEON <b>NEXUS</b></span></div><nav><button onClick={() => setHelp(false)} className={!help ? 'nav-active' : ''}>GAME</button><button onClick={() => setHelp(true)} className={help ? 'nav-active' : ''}>HOW TO PLAY</button><button className="sound" onClick={() => setMuted(!muted)}>{muted ? '◌ SOUND OFF' : '◉ SOUND ON'}</button></nav></header>
    {help ? <Help onBack={() => setHelp(false)} /> : <>
      <section className="hero"><div><p className="eyebrow">MEMORY PROTOCOL // 01</p><h1>FLIP <i>THE</i> <span>NEXUS</span></h1><p className="sub">Synchronize the hidden glyphs. Build your combo. Bend the clock.</p></div><div className="difficulty">{(['Easy','Medium','Hard'] as Difficulty[]).map(d => <button key={d} className={difficulty === d ? 'selected' : ''} onClick={() => setDifficulty(d)}><span>{d === 'Easy' ? '◌' : d === 'Medium' ? '◉' : '✦'}</span>{d}</button>)}</div></section>
      <section className="dashboard"><Stat label="TIME" value={formatTime(time)} alert={time < 20} /><Stat label="MOVES" value={String(moves).padStart(2,'0')} /><Stat label="SCORE" value={String(score).padStart(4,'0')} /><Stat label="COMBO" value={combo ? `×${combo}` : '—'} special /></section>
      <div className="game-layout"><aside className="side left-side"><div className="side-label">PROGRESS</div><div className="progress-ring" style={{'--p': (matched / totalPairs) * 100} as React.CSSProperties}><span>{matched}<small>/{totalPairs}</small></span></div><p>PAIRS<br/>SYNCED</p><div className="bar"><i style={{height: `${(matched / totalPairs) * 100}%`}} /></div></aside>
        <section className={`board ${cardCols}`}>{deck.map(card => <button key={card.id} onClick={() => clickCard(card.id)} className={`card ${flipped.includes(card.id) || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`} aria-label="Flip memory card"><span className="card-inner"><span className="card-front"><em>✦</em><i>NX</i></span><span className="card-back">{card.icon}</span></span></button>)}</section>
        <aside className="side power-side"><div className="side-label">POWER-UPS</div><button disabled={!freeze} className="power freeze" onClick={useFreeze}><span>❄</span>TIME FREEZE<small>{freeze ? 'READY' : 'USED'}</small></button><button disabled={!scan} className="power scan" onClick={useScan}><span>⌁</span>NEURAL SCAN<small>{scan ? 'READY' : 'USED'}</small></button><div className="best">BEST SCORE <b>{best ? best.toLocaleString() : '—'}</b></div></aside>
      </div>
      <footer><button onClick={() => setPaused(!paused)} className="control">{paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button><button onClick={() => newGame()} className="control">↻ RESTART</button><button onClick={() => newGame()} className="new">+ NEW GAME</button></footer>
      {(paused || time === 0) && <div className="overlay"><div className="modal"><p className="eyebrow">SYSTEM STATUS</p><h2>{time === 0 ? 'TIME BREACH' : 'PAUSED'}</h2><p>{time === 0 ? 'Your neural link expired. Reinitialize and try again.' : 'The nexus is held in stasis.'}</p><button className="new" onClick={() => time === 0 ? newGame() : setPaused(false)}>{time === 0 ? '↻ TRY AGAIN' : '▶ RESUME LINK'}</button></div></div>}
      {won && <div className="overlay win"><div className="modal"><div className="orbit">✦</div><p className="eyebrow">NEXUS SYNCHRONIZED</p><h2>PERFECT <span>LINK</span></h2><p>Every glyph is aligned. The network is yours.</p><div className="win-stats"><span>SCORE<b>{currentScore.toLocaleString()}</b></span><span>MOVES<b>{moves}</b></span><span>TIME LEFT<b>{formatTime(time)}</b></span></div><button className="new" onClick={difficulty === 'Hard' ? () => newGame() : advanceGame}>{difficulty === 'Hard' ? '+ PLAY AGAIN' : '↑ NEXT PROTOCOL'}</button></div></div>}
    </>}
  </main>
}
function Stat({label,value,alert,special}:{label:string;value:string;alert?:boolean;special?:boolean}) { return <div className={`stat ${alert ? 'alert' : ''} ${special ? 'special' : ''}`}><small>{label}</small><b>{value}</b></div> }
function Help({onBack}:{onBack:()=>void}) { return <section className="help"><p className="eyebrow">TRAINING MODULE</p><h1>HOW TO <span>SYNC</span></h1><div className="help-grid"><article><b>01</b><h3>Reveal</h3><p>Flip two glyphs at a time. Memorize their position in the grid.</p></article><article><b>02</b><h3>Match</h3><p>Find identical pairs to lock them into the nexus and earn points.</p></article><article><b>03</b><h3>Chain</h3><p>Consecutive matches build a combo, multiplying your score reward.</p></article><article><b>04</b><h3>Power up</h3><p>Use Time Freeze for five seconds of stasis or Neural Scan to reveal the board.</p></article></div><p className="help-note">Choose a difficulty to expand the grid. Complete all pairs before time expires. Your best score and sound preference are saved locally.</p><button className="new" onClick={onBack}>← ENTER NEXUS</button></section> }
createRoot(document.getElementById('root')!).render(<App />)
