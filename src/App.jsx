import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')
  const [msg, setMsg] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error } = await fn.call(supabase.auth, { email, password })
    setMsg(error ? error.message : mode === 'signup' ? 'Account created. Check your email if confirmation is on.' : '')
  }
  return (
    <main className="auth">
      <h1>FocusRooms</h1>
      <p>Study together. One shared timer, live chat, no distractions.</p>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        <button className="primary">{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {msg && <small className="err">{msg}</small>}
      </form>
    </main>
  )
}

function Lobby({ onOpen }) {
  const [rooms, setRooms] = useState([])
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(25)
  const load = async () => {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false })
    setRooms(data || [])
  }
  useEffect(() => { load() }, [])
  const create = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.from('rooms').insert({ name, minutes }).select().single()
    if (!error) onOpen(data)
  }
  return (
    <section className="lobby">
      <h2>Open rooms</h2>
      <ul>
        {rooms.map((r) => (
          <li key={r.id}><button onClick={() => onOpen(r)}><b>{r.name}</b><span>{r.minutes} min sessions</span></button></li>
        ))}
        {!rooms.length && <li className="empty">No rooms yet. Start the first one below.</li>}
      </ul>
      <form onSubmit={create} className="row">
        <input placeholder="Room name, e.g. DSA night grind" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={minutes} onChange={(e) => setMinutes(+e.target.value)}>
          {[15, 25, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
        <button className="primary">Create room</button>
      </form>
    </section>
  )
}

function Room({ initial, user, onLeave }) {
  const [room, setRoom] = useState(initial)
  const [msgs, setMsgs] = useState([])
  const [people, setPeople] = useState([])
  const [text, setText] = useState('')
  const [now, setNow] = useState(Date.now())
  const endRef = useRef()
  const isOwner = room.owner === user.id
  const total = room.minutes * 60
  const elapsed = room.started_at ? Math.floor((now - new Date(room.started_at)) / 1000) : 0
  const left = room.started_at ? Math.max(total - elapsed, 0) : total
  const running = room.started_at && left > 0

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  useEffect(() => {
    supabase.from('messages').select('*').eq('room_id', room.id).order('created_at').limit(100).then(({ data }) => setMsgs(data || []))
    const ch = supabase.channel(`room:${room.id}`, { config: { presence: { key: user.id } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` }, (p) => setMsgs((m) => [...m, p.new]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p) => setRoom(p.new))
      .on('presence', { event: 'sync' }, () => setPeople(Object.values(ch.presenceState()).map((a) => a[0].email)))
      .subscribe((s) => s === 'SUBSCRIBED' && ch.track({ email: user.email }))
    return () => { supabase.removeChannel(ch) }
  }, [room.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const setTimer = (v) => supabase.from('rooms').update({ started_at: v }).eq('id', room.id)
  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.from('messages').insert({ room_id: room.id, email: user.email, body: text.trim() })
    setText('')
  }
  const R = 120, C = 2 * Math.PI * R

  return (
    <section className="room">
      <header><button className="link" onClick={onLeave}>Back to rooms</button><h2>{room.name}</h2></header>
      <div className="grid">
        <div className="timer">
          <svg viewBox="0 0 280 280" role="img" aria-label={`${fmt(left)} left`}>
            <circle cx="140" cy="140" r={R} className="track" />
            <circle cx="140" cy="140" r={R} className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} />
            <text x="140" y="152" textAnchor="middle">{fmt(left)}</text>
          </svg>
          <p>{running ? 'Everyone is focusing.' : room.started_at ? 'Session done. Take a break.' : 'Waiting to start.'}</p>
          {isOwner
            ? <button className="primary" onClick={() => setTimer(running ? null : new Date().toISOString())}>{running ? 'Stop session' : 'Start session'}</button>
            : <small>Only the room owner controls the timer.</small>}
          <h3>In this room ({people.length})</h3>
          <ul className="people">{people.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <div className="chat">
          <ul>{msgs.map((m) => <li key={m.id} className={m.user_id === user.id ? 'me' : ''}><small>{m.email}</small>{m.body}</li>)}<div ref={endRef} /></ul>
          <form onSubmit={send} className="row">
            <input placeholder="Share a goal or a doubt" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="primary">Send</button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [room, setRoom] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return null
  if (!user) return <Auth />
  return (
    <div className="shell">
      <nav><b>FocusRooms</b><span>{user.email}</span><button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button></nav>
      {room ? <Room initial={room} user={user} onLeave={() => setRoom(null)} /> : <Lobby onOpen={setRoom} />}
    </div>
  )
}
