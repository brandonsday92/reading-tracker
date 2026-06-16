import { useState, useEffect, useCallback } from "react";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const SPINE_COLORS = ["#7C6FE0","#0FA87C","#E05C3A","#D44F82","#C48A1A","#2A8FD4"];

function dkey(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function tkey() { return dkey(TODAY); }
function parseDate(s) { const [y,m,d] = s.split("-").map(Number); const dt = new Date(y,m-1,d); dt.setHours(0,0,0,0); return dt; }
function toInput(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtShort(d) { return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }
function fmtFull(d) { return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }

function buildReadingDays(preset, customSet, startDate, dueDate) {
  const days = [];
  const cur = new Date(startDate);
  while (cur <= dueDate) {
    const dow = cur.getDay();
    let add = false;
    if (preset === "daily") add = true;
    else if (preset === "weekdays") add = dow >= 1 && dow <= 5;
    else if (preset === "weekends") add = dow === 0 || dow === 6;
    else if (preset === "custom") add = customSet.has(cur.getTime());
    if (add) days.push(dkey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "reading_tracker_books_v1";

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBooks(books) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); } catch {}
}

// ─── MINI CALENDAR ───────────────────────────────────────────────────────────
const navBtn = {
  padding: "5px 10px", border: "1px solid #2A2250", borderRadius: 8,
  background: "none", color: "#9B8FC4", cursor: "pointer", fontSize: 14
};

function MiniCalendar({ calState, onShift, selectedTime, onSelect, readingSet, dueTime, mode }) {
  const { y, m } = calState;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayTime = TODAY.getTime();

  return (
    <div style={{ background: "#13102A", border: "1px solid #2A2250", borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => onShift(-1)} style={navBtn}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#EEE9FF" }}>{MONTHS[m]} {y}</span>
        <button onClick={() => onShift(1)} style={navBtn}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{ fontSize: 10, color: "#4A3E6A", textAlign: "center", paddingBottom: 4 }}>{l}</div>
        ))}
        {Array(firstDay).fill(null).map((_,i) => <div key={`e${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const d = i + 1;
          const dt = new Date(y, m, d);
          const t = dt.getTime();
          const isPast = dt < TODAY;
          const isBeyondDue = dueTime && t > dueTime;
          const isSel = mode === "due" ? (selectedTime && t === selectedTime) : (readingSet && readingSet.has(t));
          const isToday = t === todayTime;
          const disabled = isPast || isBeyondDue;
          return (
            <div key={d} onClick={() => !disabled && onSelect(t, dt)}
              style={{
                aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, borderRadius: mode === "due" && isSel ? "50%" : 8,
                border: isToday && !isSel ? "1px solid #7C6FE0" : "1px solid transparent",
                background: isSel ? "#7C6FE0" : "transparent",
                color: disabled ? "#2A2250" : isSel ? "#fff" : "#C4B8E8",
                cursor: disabled ? "default" : "pointer",
              }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SHARED UI ───────────────────────────────────────────────────────────────
function Label({ children }) {
  return <div style={{ fontSize: 11, color: "#4A3E6A", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>{children}</div>;
}

function Input({ style = {}, ...props }) {
  return (
    <input {...props} style={{
      width: "100%", padding: "11px 13px", fontSize: 14,
      border: "1px solid #2A2250", borderRadius: 12,
      background: "#13102A", color: "#EEE9FF", marginBottom: 14,
      outline: "none", WebkitAppearance: "none", ...style
    }} />
  );
}

function Btn({ variant, onClick, children, style = {} }) {
  const styles = {
    purple: { background: "linear-gradient(135deg,#7C6FE0,#534AB7)", color: "#fff", border: "none" },
    ghost:  { background: "#13102A", color: "#9B8FC4", border: "1px solid #2A2250" },
  };
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: 13, fontSize: 14, fontWeight: 600,
      borderRadius: 12, cursor: "pointer", display: "flex",
      alignItems: "center", justifyContent: "center", gap: 7, marginTop: 6,
      ...styles[variant], ...style
    }}>
      {children}
    </button>
  );
}

function Badge({ color, bg, border, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
      fontWeight: 500, padding: "5px 11px", borderRadius: 20,
      background: bg, border: `1px solid ${border}`, color
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#13102A", border: "1px solid #2A2250", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 10, color: "#4A3E6A", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#EEE9FF" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#4A3E6A", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

// ─── ADD BOOK ────────────────────────────────────────────────────────────────
function AddBook({ onSave, onBack }) {
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState("");
  const [dueDate, setDueDate] = useState(null);
  const [dueCal, setDueCal] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const [readCal, setReadCal] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const [preset, setPreset] = useState(null);
  const [customDays, setCustomDays] = useState(new Set());

  const shiftDue = dir => setDueCal(c => { let m=c.m+dir,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const shiftRead = dir => setReadCal(c => { let m=c.m+dir,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const toggleCustom = t => setCustomDays(prev => { const s=new Set(prev); s.has(t)?s.delete(t):s.add(t); return s; });

  const handleSave = () => {
    const p = parseInt(pages);
    if (!p || p < 1) return alert("Enter total pages.");
    if (!dueDate) return alert("Pick a finish date.");
    if (!preset) return alert("Choose reading days.");
    if (preset === "custom" && customDays.size === 0) return alert("Select at least one day.");
    const rdays = buildReadingDays(preset, customDays, TODAY, dueDate);
    if (!rdays.length) return alert("No reading days found — adjust your schedule.");
    onSave({ title: title.trim() || "Untitled", totalPages: p, dueDate: dkey(dueDate), readingDays: rdays, basePPD: Math.ceil(p / rdays.length) });
  };

  const presets = ["daily","weekdays","weekends","custom"];
  const presetLabels = { daily:"Every day", weekdays:"Weekdays", weekends:"Weekends", custom:"Custom" };

  return (
    <div style={{ minHeight: "100vh", background: "#0E0C1A", color: "#EEE9FF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 0" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#9B8FC4", fontSize:22, cursor:"pointer", padding:4 }}>←</button>
        <span style={{ fontSize:16, fontWeight:600 }}>Add a book</span>
      </div>
      <div style={{ padding: "16px 16px 80px" }}>
        <Label>Book title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The Name of the Wind" type="text" />
        <Label>Total pages</Label>
        <Input value={pages} onChange={e => setPages(e.target.value)} placeholder="e.g. 662" type="number" min="1" />
        <Label>Finish by</Label>
        <MiniCalendar calState={dueCal} onShift={shiftDue}
          selectedTime={dueDate ? dueDate.getTime() : null}
          onSelect={(t, dt) => setDueDate(dt)} mode="due" />
        {dueDate && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#1A1640", border:"1px solid #7C6FE0", borderRadius:10, padding:"7px 13px", fontSize:13, color:"#C4B8E8", marginBottom:14 }}>
            📅 {fmtFull(dueDate)}
          </div>
        )}
        <Label>Reading days</Label>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {presets.map(p => (
            <div key={p} onClick={() => setPreset(p)} style={{
              padding:"8px 14px", border:`1px solid ${preset===p?"#7C6FE0":"#2A2250"}`,
              borderRadius:20, fontSize:13, cursor:"pointer",
              background: preset===p ? "#7C6FE0" : "#13102A",
              color: preset===p ? "#fff" : "#9B8FC4"
            }}>{presetLabels[p]}</div>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <MiniCalendar calState={readCal} onShift={shiftRead} readingSet={customDays}
              onSelect={t => toggleCustom(t)} dueTime={dueDate ? dueDate.getTime() : null} mode="custom" />
            <p style={{ fontSize:12, color:"#4A3E6A", marginBottom:14, marginTop:-8 }}>{customDays.size} days selected</p>
          </>
        )}
        <Btn variant="purple" onClick={handleSave}>✓ Save &amp; see plan</Btn>
        <Btn variant="ghost" onClick={onBack} style={{ marginTop:10 }}>Cancel</Btn>
      </div>
    </div>
  );
}

// ─── PLAN SCREEN ─────────────────────────────────────────────────────────────
function PlanScreen({ book, onStart, onBack }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0E0C1A", display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1 }} />
      <div style={{ background:"#13102A", borderTopLeftRadius:28, borderTopRightRadius:28, padding:"32px 24px 48px", textAlign:"center", border:"1px solid #2A2250", borderBottom:"none" }}>
        <div style={{ fontSize:11, color:"#4A3E6A", letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Your daily goal</div>
        <div style={{ fontSize:64, fontWeight:800, background:"linear-gradient(135deg,#A89EF0,#7C6FE0)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1.05 }}>{book.basePPD}</div>
        <div style={{ fontSize:15, color:"#9B8FC4", marginTop:6, marginBottom:20 }}>pages per day</div>
        <div style={{ height:1, background:"#2A2250", margin:"0 0 20px" }} />
        <div style={{ fontSize:13, color:"#4A3E6A", marginBottom:28 }}>
          {book.readingDays.length} reading days · finish by {fmtShort(parseDate(book.dueDate))}
        </div>
        <Btn variant="purple" onClick={onStart}>Start tracking →</Btn>
        <Btn variant="ghost" onClick={onBack} style={{ marginTop:10 }}>← Back</Btn>
      </div>
    </div>
  );
}

// ─── TRACKER ─────────────────────────────────────────────────────────────────
function Tracker({ book, onUpdate, onBack, onDelete }) {
  const [logPages, setLogPages] = useState("");
  const [logDate, setLogDate] = useState(toInput(TODAY));

  const left = Math.max(0, book.totalPages - book.pagesRead);
  const pct = Math.round((book.pagesRead / book.totalPages) * 100);

  const getAdaptiveGoal = () => {
    if (left === 0) return 0;
    const future = book.readingDays.filter(d => parseDate(d) > TODAY).length;
    const isToday = book.readingDays.includes(tkey());
    return Math.ceil(left / Math.max(1, future + (isToday ? 1 : 0)));
  };

  const calcStreak = () => {
    let s = 0;
    const cur = new Date(TODAY);
    for (let i = 0; i < 365; i++) {
      const k = dkey(cur);
      if (book.readingDays.includes(k)) {
        if ((book.dailyTotals[k] || 0) >= book.basePPD) s++;
        else break;
      }
      cur.setDate(cur.getDate() - 1);
    }
    return s;
  };

  const ag = getAdaptiveGoal();
  const streak = calcStreak();
  const todayRead = book.dailyTotals[tkey()] || 0;
  const done = book.pagesRead >= book.totalPages;
  const goalRecalced = ag !== book.basePPD && !done;

  const handleLog = () => {
    const val = parseInt(logPages);
    if (!val || val < 1) return alert("Enter pages read.");
    if (!logDate) return alert("Pick a date.");
    if (done) return alert("Book already complete!");
    const toLog = Math.min(val, left);
    const updated = {
      ...book,
      pagesRead: book.pagesRead + toLog,
      dailyTotals: { ...book.dailyTotals, [logDate]: (book.dailyTotals[logDate] || 0) + toLog },
      log: [...book.log, { date: logDate, pages: toLog, ts: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }]
    };
    onUpdate(updated);
    setLogPages("");
  };

  const handleDeleteLog = i => {
    const e = book.log[i];
    const updated = {
      ...book,
      pagesRead: Math.max(0, book.pagesRead - e.pages),
      dailyTotals: { ...book.dailyTotals, [e.date]: Math.max(0, (book.dailyTotals[e.date] || 0) - e.pages) },
      log: book.log.filter((_, idx) => idx !== i)
    };
    onUpdate(updated);
  };

  const dots = Array(7).fill(null).map((_, i) => {
    const d = new Date(TODAY); d.setDate(d.getDate() - (6 - i));
    const k = dkey(d);
    const hit = book.readingDays.includes(k) && (book.dailyTotals[k] || 0) >= book.basePPD;
    return { label: DAY_LABELS[d.getDay()], hit, isToday: i === 6 };
  });

  return (
    <div style={{ minHeight:"100vh", background:"#0E0C1A", color:"#EEE9FF" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"16px 16px 0" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#9B8FC4", fontSize:22, cursor:"pointer", padding:4 }}>←</button>
        <span style={{ fontSize:16, fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{book.title}</span>
        <button onClick={onDelete} style={{ background:"none", border:"none", color:"#4A3E6A", fontSize:18, cursor:"pointer", padding:4 }}>🗑</button>
      </div>
      <div style={{ padding:"14px 16px 80px" }}>
        <div style={{ fontSize:13, color:"#4A3E6A", marginBottom:14 }}>{book.totalPages} pages · Due {fmtShort(parseDate(book.dueDate))}</div>

        {streak > 0 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, background:"#2A1E0A", border:"1px solid #B87D1A", borderRadius:12, padding:"9px 14px", fontSize:13, fontWeight:600, color:"#E0B45A", marginBottom:14 }}>
            🔥 {streak}-day streak
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <StatCard label="Pages left" value={left} sub={`of ${book.totalPages}`} />
          <StatCard label="Daily goal" value={ag} sub="pages / day" />
        </div>

        {goalRecalced && (
          <div style={{ fontSize:12, color:"#5FD4B0", background:"#0A2E24", border:"1px solid #14A07D", borderRadius:10, padding:"8px 12px", display:"flex", alignItems:"center", gap:7, marginBottom:12 }}>
            ↻ {ag < book.basePPD ? "Goal reduced — you're ahead!" : "Goal adjusted to keep you on track"}
          </div>
        )}

        <div style={{ height:8, background:"#13102A", border:"1px solid #2A2250", borderRadius:4, overflow:"hidden", marginBottom:6 }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#534AB7,#9B6FD4)", borderRadius:4, transition:"width .5s" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#4A3E6A", marginBottom:14, alignItems:"center" }}>
          <span>
            {done
              ? <Badge color="#5FD4B0" bg="#0A2E24" border="#14A07D">🏆 Complete!</Badge>
              : todayRead === 0
                ? <Badge color="#C4B8E8" bg="#1A1640" border="#7C6FE0">🎯 Goal: {ag} pages</Badge>
                : todayRead >= ag
                  ? <Badge color="#5FD4B0" bg="#0A2E24" border="#14A07D">✓ Goal met! {todayRead}/{ag}</Badge>
                  : <Badge color="#E0B45A" bg="#2A1E0A" border="#B87D1A">📖 {todayRead}/{ag} today</Badge>}
          </span>
          <span>{pct}%</span>
        </div>

        <div style={{ fontSize:10, color:"#4A3E6A", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>Last 7 days</div>
        <div style={{ display:"flex", gap:6, marginBottom:18 }}>
          {dots.map((dot, i) => (
            <div key={i} style={{
              flex:1, aspectRatio:"1", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, border:`1px solid ${dot.hit ? "#7C6FE0" : dot.isToday ? "#7C6FE0" : "#2A2250"}`,
              background: dot.hit ? "#7C6FE0" : "#13102A",
              color: dot.hit ? "#fff" : dot.isToday ? "#9B8FC4" : "#4A3E6A",
            }}>{dot.label}</div>
          ))}
        </div>

        <div style={{ fontSize:10, color:"#4A3E6A", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>Log reading</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, alignItems:"end", marginBottom:6 }}>
          <div>
            <Label>Date</Label>
            <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} max={book.dueDate} style={{ marginBottom:0 }} />
          </div>
          <div>
            <Label>Pages</Label>
            <Input type="number" value={logPages} onChange={e => setLogPages(e.target.value)} placeholder="e.g. 40" min="1" style={{ marginBottom:0 }} />
          </div>
          <button onClick={handleLog} style={{ padding:"11px 16px", background:"linear-gradient(135deg,#14A07D,#0B7A5E)", border:"none", borderRadius:12, color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1 }}>＋</button>
        </div>

        <div style={{ fontSize:10, color:"#4A3E6A", letterSpacing:".08em", textTransform:"uppercase", margin:"18px 0 10px" }}>History</div>
        {book.log.length === 0
          ? <div style={{ fontSize:13, color:"#2A2250", padding:"10px 0" }}>No entries yet</div>
          : book.log.slice().reverse().map((e, ri) => {
              const i = book.log.length - 1 - ri;
              const dp = parseDate(e.date);
              const label = e.date === tkey() ? "Today" : fmtShort(dp);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom:"1px solid #13102A" }}>
                  <div>
                    <div style={{ fontWeight:600, color:"#EEE9FF", fontSize:13 }}>{label}</div>
                    <div style={{ fontSize:11, color:"#3A305A", marginTop:2 }}>{e.ts}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:"#7C6FE0" }}>+{e.pages}</span>
                    <button onClick={() => handleDeleteLog(i)} style={{ background:"none", border:"none", color:"#3A305A", cursor:"pointer", fontSize:16, padding:"3px 6px" }}>✕</button>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

// ─── SHELF ───────────────────────────────────────────────────────────────────
function Shelf({ books, onOpen, onAdd }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0E0C1A", color:"#EEE9FF" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 16px 0" }}>
        <span style={{ fontSize:20, fontWeight:700 }}>📚 My Shelf</span>
        <button onClick={onAdd} style={{ padding:"8px 14px", background:"linear-gradient(135deg,#7C6FE0,#534AB7)", border:"none", borderRadius:20, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>＋ Add book</button>
      </div>
      <div style={{ padding:"16px 16px 80px" }}>
        {books.length === 0 ? (
          <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#2A2250" }}>
            <div style={{ fontSize:48, marginBottom:14 }}>📖</div>
            <div style={{ fontSize:14 }}>No books yet.<br />Add one to get started!</div>
          </div>
        ) : books.map((b, i) => {
          const pct = Math.round((b.pagesRead / b.totalPages) * 100);
          const c = SPINE_COLORS[i % SPINE_COLORS.length];
          const done = b.pagesRead >= b.totalPages;
          const daysLeft = b.readingDays.filter(d => parseDate(d) >= TODAY).length;
          return (
            <div key={b.id} onClick={() => onOpen(b.id)}
              style={{ background:"#13102A", border:"1px solid #2A2250", borderRadius:16, padding:"14px 16px", marginBottom:10, cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:5, borderRadius:3, alignSelf:"stretch", background:c, minHeight:52, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#EEE9FF", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.title}</div>
                  <div style={{ fontSize:12, color:"#4A3E6A", marginTop:3 }}>
                    {b.pagesRead}/{b.totalPages} pages · {done ? <span style={{ color:"#14A07D" }}>Complete!</span> : `${daysLeft} days left`}
                  </div>
                  <div style={{ height:3, background:"#2A2250", borderRadius:2, marginTop:8, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:2 }} />
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:c, minWidth:38, textAlign:"right" }}>{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("shelf");
  const [books, setBooks] = useState(() => loadBooks());
  const [curId, setCurId] = useState(null);
  const [pendingBook, setPendingBook] = useState(null);

  // Save to localStorage whenever books change
  useEffect(() => { saveBooks(books); }, [books]);

  const curBook = books.find(b => b.id === curId);

  const handleSaveBook = data => {
    const book = { ...data, id: "b" + Date.now(), pagesRead: 0, log: [], dailyTotals: {} };
    setPendingBook(book);
    setScreen("plan");
  };

  const handleStartTracker = () => {
    setBooks(prev => [...prev, pendingBook]);
    setCurId(pendingBook.id);
    setPendingBook(null);
    setScreen("track");
  };

  const handleUpdateBook = updated => {
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleDeleteBook = () => {
    if (!window.confirm(`Remove "${curBook.title}" from your shelf?`)) return;
    setBooks(prev => prev.filter(b => b.id !== curId));
    setCurId(null);
    setScreen("shelf");
  };

  if (screen === "shelf")  return <Shelf books={books} onOpen={id => { setCurId(id); setScreen("track"); }} onAdd={() => setScreen("add")} />;
  if (screen === "add")    return <AddBook onSave={handleSaveBook} onBack={() => setScreen("shelf")} />;
  if (screen === "plan" && pendingBook) return <PlanScreen book={pendingBook} onStart={handleStartTracker} onBack={() => setScreen("add")} />;
  if (screen === "track" && curBook)    return <Tracker book={curBook} onUpdate={handleUpdateBook} onBack={() => setScreen("shelf")} onDelete={handleDeleteBook} />;
  return null;
}
