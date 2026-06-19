import { useState, useEffect } from "react";

// ─── BRAND TOKENS ─────────────────────────────────────────────────────────────
const C = {
  teal:       "#2C5F5D",
  tealLight:  "#3A7A77",
  gold:       "#C8A24D",
  goldLight:  "#F0E6C8",
  paper:      "#FAF8F2",
  surface:    "#FFFFFF",
  charcoal:   "#2B2B2B",
  secondary:  "#6B6B6B",
  sage:       "#6F9D74",
  sageBg:     "#EEF5EE",
  terra:      "#C7774A",
  terraBg:    "#FAF0EA",
  border:     "#E6E2D9",
  shadow:     "0 2px 12px rgba(44,95,93,0.08)",
  shadowMd:   "0 4px 20px rgba(44,95,93,0.12)",
};

const T = {
  heading: "'Cormorant Garamond', Georgia, serif",
  body:    "'Inter', -apple-system, sans-serif",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const SPINE_COLORS = [C.teal, "#4A7C6F", C.gold, "#7A6B4A", "#6F9D74", "#8B6B5D"];

function dkey(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function tkey() { return dkey(TODAY); }
function parseDate(s) {
  const [y,m,d] = s.split("-").map(Number);
  const dt = new Date(y, m-1, d); dt.setHours(0,0,0,0); return dt;
}
function toInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtShort(d) { return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }
function fmtFull(d)  { return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }

function buildReadingDays(preset, customSet, startDate, dueDate) {
  const days = []; const cur = new Date(startDate);
  while (cur <= dueDate) {
    const dow = cur.getDay(); let add = false;
    if (preset === "daily")    add = true;
    else if (preset === "weekdays") add = dow >= 1 && dow <= 5;
    else if (preset === "weekends") add = dow === 0 || dow === 6;
    else if (preset === "custom")   add = customSet.has(cur.getTime());
    if (add) days.push(dkey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function getAdaptiveGoal(book) {
  const left = Math.max(0, book.totalPages - book.pagesRead);
  if (left === 0) return 0;
  const future  = book.readingDays.filter(d => parseDate(d) > TODAY).length;
  const isToday = book.readingDays.includes(tkey());
  return Math.ceil(left / Math.max(1, future + (isToday ? 1 : 0)));
}

function getScheduleStatus(book) {
  const ag = getAdaptiveGoal(book);
  if (ag === 0) return { label: "Final page reached", dot: "✓", color: C.sage };
  if (ag < book.basePPD)  return { label: "Ahead of schedule", dot: "●", color: C.sage };
  if (ag === book.basePPD) return { label: "On schedule", dot: "●", color: C.gold };
  return { label: `${Math.round((ag - book.basePPD) / book.basePPD)} day${ag - book.basePPD > book.basePPD ? "s" : ""} behind`, dot: "●", color: C.terra };
}

function calcStreak(book) {
  let s = 0; const cur = new Date(TODAY);
  for (let i = 0; i < 365; i++) {
    const k = dkey(cur);
    if (book.readingDays.includes(k)) {
      if ((book.dailyTotals[k] || 0) >= book.basePPD) s++;
      else break;
    }
    cur.setDate(cur.getDate() - 1);
  }
  return s;
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
const STORE = "pace_books_v1";
function loadBooks() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } }
function saveBooks(b) { try { localStorage.setItem(STORE, JSON.stringify(b)); } catch {} }

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

function PaceLogo({ size = 28 }) {
  // Bookmark icon — the Pace visual identity
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 28 34" fill="none">
      <path d="M4 2h20a2 2 0 0 1 2 2v28l-12-7L2 32V4a2 2 0 0 1 2-2z" fill={C.teal} />
      <path d="M4 2h20a2 2 0 0 1 2 2v28l-12-7L2 32V18h24" stroke="none" fill={C.tealLight} opacity="0.3" />
    </svg>
  );
}

function BookmarkProgress({ pct, size = 32 }) {
  const fill = Math.max(0, Math.min(1, pct / 100));
  const totalH = size * 1.2;
  const fillH  = totalH * fill;
  return (
    <svg width={size} height={totalH} viewBox="0 0 32 38" fill="none">
      <path d="M4 2h24a2 2 0 0 1 2 2v34l-16-9L0 38V4a2 2 0 0 1 2-2z" fill={C.border} />
      <clipPath id={`bp-${size}`}>
        <rect x="0" y={38 - 38 * fill} width="32" height={38 * fill} />
      </clipPath>
      <path d="M4 2h24a2 2 0 0 1 2 2v34l-16-9L0 38V4a2 2 0 0 1 2-2z" fill={C.teal} clipPath={`url(#bp-${size})`} />
    </svg>
  );
}

function TopBar({ title, onBack, rightAction }) {
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"18px 20px 0", gap:12 }}>
      {onBack && (
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px 8px 6px 0", color:C.secondary, fontSize:20, lineHeight:1 }}>
          ←
        </button>
      )}
      <span style={{ flex:1, fontFamily:T.heading, fontSize:22, fontWeight:500, color:C.charcoal }}>{title}</span>
      {rightAction}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>{children}</div>;
}

function PaceInput({ style={}, ...props }) {
  return (
    <input {...props} style={{
      width:"100%", padding:"13px 15px", fontSize:15, fontFamily:T.body,
      border:`1px solid ${C.border}`, borderRadius:14, background:C.surface,
      color:C.charcoal, marginBottom:16, outline:"none",
      boxShadow:"0 1px 4px rgba(44,95,93,0.06)", WebkitAppearance:"none", ...style
    }} />
  );
}

function BtnPrimary({ onClick, children, style={} }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"15px", fontSize:15, fontWeight:600, fontFamily:T.body,
      background:C.teal, color:"#fff", border:"none", borderRadius:16, cursor:"pointer",
      boxShadow:C.shadow, marginTop:6, letterSpacing:".01em", ...style
    }}>{children}</button>
  );
}

function BtnSecondary({ onClick, children, style={} }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"14px", fontSize:15, fontWeight:500, fontFamily:T.body,
      background:C.surface, color:C.teal, border:`1.5px solid ${C.teal}`,
      borderRadius:16, cursor:"pointer", marginTop:6, ...style
    }}>{children}</button>
  );
}

function Card({ children, style={}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:C.surface, border:`1px solid ${C.border}`, borderRadius:20,
      padding:"18px 20px", marginBottom:12, boxShadow:C.shadow,
      cursor: onClick ? "pointer" : "default", ...style
    }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height:1, background:C.border, margin:"16px 0" }} />;
}

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function MiniCalendar({ calState, onShift, selectedTime, onSelect, readingSet, dueTime, mode }) {
  const { y, m } = calState;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayTime = TODAY.getTime();

  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:16, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={() => onShift(-1)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:10, padding:"5px 11px", color:C.secondary, cursor:"pointer", fontSize:15 }}>‹</button>
        <span style={{ fontFamily:T.heading, fontSize:17, color:C.charcoal, fontWeight:500 }}>{MONTHS[m]} {y}</span>
        <button onClick={() => onShift(1)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:10, padding:"5px 11px", color:C.secondary, cursor:"pointer", fontSize:15 }}>›</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
        {DAYS.map(l => <div key={l} style={{ fontSize:10, color:C.border, textAlign:"center", paddingBottom:6, fontWeight:600, letterSpacing:".04em" }}>{l}</div>)}
        {Array(firstDay).fill(null).map((_,i) => <div key={`e${i}`} />)}
        {Array(daysInMonth).fill(null).map((_,i) => {
          const d = i+1, dt = new Date(y,m,d), t = dt.getTime();
          const isPast      = dt < TODAY;
          const beyondDue   = dueTime && t > dueTime;
          const isSel       = mode === "due" ? selectedTime && t === selectedTime : readingSet && readingSet.has(t);
          const isToday     = t === todayTime;
          const disabled    = isPast || beyondDue;
          return (
            <div key={d} onClick={() => !disabled && onSelect(t, dt)} style={{
              aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, borderRadius: isSel && mode==="due" ? "50%" : 8,
              background: isSel ? C.teal : "transparent",
              border: isToday && !isSel ? `1.5px solid ${C.teal}` : "1.5px solid transparent",
              color: disabled ? C.border : isSel ? "#fff" : C.charcoal,
              cursor: disabled ? "default" : "pointer",
              fontWeight: isToday ? 600 : 400,
            }}>{d}</div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SHELF SCREEN ─────────────────────────────────────────────────────────────
function Shelf({ books, onOpen, onAdd }) {
  const todayBooks = books.filter(b => b.pagesRead < b.totalPages && b.readingDays.includes(tkey()));
  const otherBooks = books.filter(b => !todayBooks.includes(b));

  return (
    <div style={{ minHeight:"100vh", background:C.paper }}>
      {/* Header */}
      <div style={{ padding:"24px 20px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <PaceLogo size={28} />
          <span style={{ fontFamily:T.heading, fontSize:28, fontWeight:500, color:C.charcoal, letterSpacing:"-.01em" }}>Pace</span>
        </div>
        <button onClick={onAdd} style={{
          background:C.teal, color:"#fff", border:"none", borderRadius:20,
          padding:"9px 18px", fontSize:13, fontWeight:600, fontFamily:T.body, cursor:"pointer", boxShadow:C.shadow
        }}>+ Add book</button>
      </div>

      <div style={{ padding:"20px 20px 80px" }}>
        {books.length === 0 ? (
          <div style={{ textAlign:"center", padding:"4rem 1rem" }}>
            <BookmarkProgress pct={0} size={48} />
            <div style={{ fontFamily:T.heading, fontSize:26, color:C.charcoal, marginTop:20, marginBottom:8 }}>
              Your next story is waiting.
            </div>
            <div style={{ fontFamily:T.body, fontSize:14, color:C.secondary, marginBottom:28, lineHeight:1.6 }}>
              Add a book and Pace will figure out<br/>how many pages to read each day.
            </div>
            <BtnPrimary onClick={onAdd} style={{ borderRadius:20 }}>Start your first book</BtnPrimary>
          </div>
        ) : (
          <>
            {todayBooks.length > 0 && (
              <>
                <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>Today's reading</div>
                {todayBooks.map((b, i) => <BookCard key={b.id} book={b} onClick={() => onOpen(b.id)} colorIdx={books.indexOf(b)} />)}
              </>
            )}
            {otherBooks.length > 0 && (
              <>
                <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".08em", margin:"20px 0 12px" }}>
                  {todayBooks.length > 0 ? "Other books" : "Your books"}
                </div>
                {otherBooks.map(b => <BookCard key={b.id} book={b} onClick={() => onOpen(b.id)} colorIdx={books.indexOf(b)} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BookCard({ book, onClick, colorIdx }) {
  const pct    = Math.round((book.pagesRead / book.totalPages) * 100);
  const ag     = getAdaptiveGoal(book);
  const status = getScheduleStatus(book);
  const done   = book.pagesRead >= book.totalPages;
  const spineC = SPINE_COLORS[colorIdx % SPINE_COLORS.length];
  const due    = parseDate(book.dueDate);

  return (
    <Card onClick={onClick} style={{ padding:0, overflow:"hidden" }}>
      <div style={{ display:"flex" }}>
        {/* Color spine */}
        <div style={{ width:5, background:spineC, flexShrink:0 }} />
        <div style={{ flex:1, padding:"16px 18px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ fontFamily:T.heading, fontSize:19, color:C.charcoal, fontWeight:500, flex:1, marginRight:12, lineHeight:1.2 }}>{book.title}</div>
            <BookmarkProgress pct={pct} size={22} />
          </div>
          {!done && (
            <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:8 }}>
              <span style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color:C.teal, lineHeight:1 }}>{ag}</span>
              <span style={{ fontFamily:T.body, fontSize:13, color:C.secondary }}>pages today</span>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:T.body, fontSize:12, color:status.color, display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:8 }}>{status.dot}</span>{done ? "Final page reached" : status.label}
            </span>
            <span style={{ fontFamily:T.body, fontSize:12, color:C.secondary }}>Due {fmtShort(due)}</span>
          </div>
          {/* Progress bar */}
          <div style={{ height:3, background:C.border, borderRadius:2, marginTop:10, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:spineC, borderRadius:2, transition:"width .5s" }} />
          </div>
          <div style={{ fontFamily:T.body, fontSize:11, color:C.border, marginTop:4, textAlign:"right" }}>{pct}% complete</div>
        </div>
      </div>
    </Card>
  );
}

// ─── ADD BOOK SCREEN ──────────────────────────────────────────────────────────
function AddBook({ onSave, onBack }) {
  const [title,      setTitle]      = useState("");
  const [pages,      setPages]      = useState("");
  const [dueDate,    setDueDate]    = useState(null);
  const [dueCal,     setDueCal]     = useState({ y:TODAY.getFullYear(), m:TODAY.getMonth() });
  const [readCal,    setReadCal]    = useState({ y:TODAY.getFullYear(), m:TODAY.getMonth() });
  const [preset,     setPreset]     = useState(null);
  const [customDays, setCustomDays] = useState(new Set());

  const shiftDue  = d => setDueCal(c  => { let m=c.m+d,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const shiftRead = d => setReadCal(c => { let m=c.m+d,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const toggleDay = t => setCustomDays(p => { const s=new Set(p); s.has(t)?s.delete(t):s.add(t); return s; });

  const handleSave = () => {
    const p = parseInt(pages);
    if (!p || p < 1)                          return alert("Please enter the total number of pages.");
    if (!dueDate)                              return alert("Please choose a finish date.");
    if (!preset)                              return alert("Please choose your reading days.");
    if (preset==="custom" && !customDays.size) return alert("Please select at least one day.");
    const rdays = buildReadingDays(preset, customDays, TODAY, dueDate);
    if (!rdays.length) return alert("No reading days found — try adjusting your schedule.");
    onSave({ title: title.trim()||"Untitled", totalPages:p, dueDate:dkey(dueDate), readingDays:rdays, basePPD:Math.ceil(p/rdays.length) });
  };

  const presets = [
    { key:"daily",    label:"Every day"  },
    { key:"weekdays", label:"Weekdays"   },
    { key:"weekends", label:"Weekends"   },
    { key:"custom",   label:"Custom days"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.paper }}>
      <TopBar title="New book" onBack={onBack} />
      <div style={{ padding:"20px 20px 80px" }}>
        <p style={{ fontFamily:T.heading, fontSize:17, color:C.secondary, marginBottom:24, fontStyle:"italic" }}>
          Tell us about your book and we'll handle the math.
        </p>

        <Label>Book title</Label>
        <PaceInput type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. The Remains of the Day" />

        <Label>Total pages</Label>
        <PaceInput type="number" value={pages} onChange={e=>setPages(e.target.value)} placeholder="e.g. 258" min="1" />

        <Label>Finish by</Label>
        <MiniCalendar calState={dueCal} onShift={shiftDue}
          selectedTime={dueDate ? dueDate.getTime() : null}
          onSelect={(_,dt) => setDueDate(dt)} mode="due" />
        {dueDate && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:10, padding:"7px 14px", fontSize:13, color:C.charcoal, marginBottom:16, fontFamily:T.body }}>
            📅 {fmtFull(dueDate)}
          </div>
        )}

        <Label>Which days will you read?</Label>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          {presets.map(p => (
            <div key={p.key} onClick={() => setPreset(p.key)} style={{
              padding:"9px 16px", border:`1.5px solid ${preset===p.key ? C.teal : C.border}`,
              borderRadius:20, fontSize:13, cursor:"pointer", fontFamily:T.body,
              background: preset===p.key ? C.teal : C.surface,
              color: preset===p.key ? "#fff" : C.charcoal,
              boxShadow: preset===p.key ? C.shadow : "none",
              transition:"all .15s",
            }}>{p.label}</div>
          ))}
        </div>

        {preset === "custom" && (
          <>
            <MiniCalendar calState={readCal} onShift={shiftRead} readingSet={customDays}
              onSelect={t => toggleDay(t)} dueTime={dueDate ? dueDate.getTime() : null} mode="custom" />
            <p style={{ fontSize:12, color:C.secondary, marginBottom:16, marginTop:-10, fontFamily:T.body }}>{customDays.size} days selected</p>
          </>
        )}

        <BtnPrimary onClick={handleSave}>See my reading plan →</BtnPrimary>
        <BtnSecondary onClick={onBack} style={{ marginTop:10 }}>Cancel</BtnSecondary>
      </div>
    </div>
  );
}

// ─── PLAN SCREEN ──────────────────────────────────────────────────────────────
function PlanScreen({ book, onStart, onBack }) {
  return (
    <div style={{ minHeight:"100vh", background:C.paper, display:"flex", flexDirection:"column" }}>
      <TopBar title="" onBack={onBack} />
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 28px" }}>
        <BookmarkProgress pct={0} size={56} />
        <div style={{ fontFamily:T.heading, fontSize:17, color:C.secondary, marginTop:24, marginBottom:8, letterSpacing:".02em" }}>
          Your daily reading goal
        </div>
        <div style={{ fontFamily:T.body, fontSize:72, fontWeight:600, color:C.teal, lineHeight:1, marginBottom:4 }}>
          {book.basePPD}
        </div>
        <div style={{ fontFamily:T.heading, fontSize:22, color:C.secondary, marginBottom:28, fontStyle:"italic" }}>pages per day</div>

        <Card style={{ width:"100%", textAlign:"center", background:C.goldLight, border:`1px solid ${C.gold}` }}>
          <div style={{ fontFamily:T.body, fontSize:13, color:C.charcoal, lineHeight:1.7 }}>
            <strong>{book.readingDays.length}</strong> reading days ·
            finish by <strong>{fmtShort(parseDate(book.dueDate))}</strong>
          </div>
          <div style={{ fontFamily:T.heading, fontSize:15, color:C.secondary, marginTop:6, fontStyle:"italic" }}>
            One page at a time.
          </div>
        </Card>
      </div>
      <div style={{ padding:"0 20px 40px" }}>
        <BtnPrimary onClick={onStart}>Begin tracking</BtnPrimary>
        <BtnSecondary onClick={onBack} style={{ marginTop:10 }}>← Adjust plan</BtnSecondary>
      </div>
    </div>
  );
}

// ─── TRACKER SCREEN ───────────────────────────────────────────────────────────
function Tracker({ book, onUpdate, onBack, onDelete, colorIdx }) {
  const [logPages, setLogPages] = useState("");
  const [logDate,  setLogDate]  = useState(toInput(TODAY));

  const left   = Math.max(0, book.totalPages - book.pagesRead);
  const pct    = Math.round((book.pagesRead / book.totalPages) * 100);
  const ag     = getAdaptiveGoal(book);
  const status = getScheduleStatus(book);
  const streak = calcStreak(book);
  const done   = book.pagesRead >= book.totalPages;
  const todayRead  = book.dailyTotals[tkey()] || 0;
  const goalMet    = todayRead >= ag;
  const goalRecalc = ag !== book.basePPD && !done;
  const spineC     = SPINE_COLORS[colorIdx % SPINE_COLORS.length];

  const handleLog = () => {
    const val = parseInt(logPages);
    if (!val || val < 1) return alert("Enter pages read.");
    if (!logDate)        return alert("Pick a date.");
    if (done)            return alert("You've already reached the final page.");
    const toLog   = Math.min(val, left);
    const updated = {
      ...book,
      pagesRead: book.pagesRead + toLog,
      dailyTotals: { ...book.dailyTotals, [logDate]: (book.dailyTotals[logDate]||0) + toLog },
      log: [...book.log, { date:logDate, pages:toLog, ts:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) }]
    };
    onUpdate(updated);
    setLogPages("");
  };

  const handleDelete = i => {
    const e = book.log[i];
    onUpdate({
      ...book,
      pagesRead: Math.max(0, book.pagesRead - e.pages),
      dailyTotals: { ...book.dailyTotals, [e.date]: Math.max(0,(book.dailyTotals[e.date]||0)-e.pages) },
      log: book.log.filter((_,idx) => idx !== i)
    });
  };

  const dots = Array(7).fill(null).map((_,i) => {
    const d = new Date(TODAY); d.setDate(d.getDate()-(6-i));
    const k = dkey(d);
    const isReadDay = book.readingDays.includes(k);
    const hit = isReadDay && (book.dailyTotals[k]||0) >= book.basePPD;
    return { label:DAYS[d.getDay()], hit, isToday:i===6, isReadDay };
  });

  return (
    <div style={{ minHeight:"100vh", background:C.paper }}>
      <TopBar
        title={book.title}
        onBack={onBack}
        rightAction={
          <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:C.border, fontSize:18, padding:6 }}>🗑</button>
        }
      />

      <div style={{ padding:"16px 20px 80px" }}>
        <p style={{ fontFamily:T.body, fontSize:13, color:C.secondary, marginBottom:20 }}>
          {book.totalPages} pages · Due {fmtShort(parseDate(book.dueDate))}
        </p>

        {/* Today's goal hero */}
        {!done && (
          <Card style={{ background:C.teal, border:"none", textAlign:"center", padding:"24px 20px" }}>
            <div style={{ fontFamily:T.body, fontSize:12, color:"rgba(255,255,255,.65)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
              Read today's pages
            </div>
            <div style={{ fontFamily:T.body, fontSize:64, fontWeight:600, color:"#fff", lineHeight:1 }}>{ag}</div>
            <div style={{ fontFamily:T.heading, fontSize:18, color:"rgba(255,255,255,.75)", fontStyle:"italic", marginTop:4, marginBottom:16 }}>pages today</div>
            {book.pagesRead > 0 && (
              <div style={{ fontFamily:T.body, fontSize:13, color:"rgba(255,255,255,.7)" }}>
                p.{book.pagesRead} → p.{Math.min(book.totalPages, book.pagesRead + ag)}
              </div>
            )}
          </Card>
        )}

        {done && (
          <Card style={{ background:C.sageBg, border:`1px solid ${C.sage}`, textAlign:"center", padding:"28px 20px" }}>
            <BookmarkProgress pct={100} size={44} />
            <div style={{ fontFamily:T.heading, fontSize:26, color:C.charcoal, marginTop:16, marginBottom:6 }}>You reached the final page.</div>
            <div style={{ fontFamily:T.body, fontSize:13, color:C.secondary }}>{book.title}</div>
          </Card>
        )}

        {/* Status & streak row */}
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <div style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 14px", boxShadow:C.shadow }}>
            <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Schedule</div>
            <div style={{ fontFamily:T.body, fontSize:13, color:status.color, display:"flex", alignItems:"center", gap:5, fontWeight:500 }}>
              <span style={{ fontSize:8 }}>●</span> {status.label}
            </div>
          </div>
          {streak > 0 && (
            <div style={{ flex:1, background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:14, padding:"12px 14px" }}>
              <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Steady reading</div>
              <div style={{ fontFamily:T.body, fontSize:13, color:C.charcoal, fontWeight:500 }}>{streak} day{streak!==1?"s":""} in a row</div>
            </div>
          )}
        </div>

        {/* Pages left */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
          <Card style={{ padding:"14px 16px", marginBottom:0 }}>
            <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Pages left</div>
            <div style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color:C.charcoal }}>{left}</div>
            <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary }}>of {book.totalPages}</div>
          </Card>
          <Card style={{ padding:"14px 16px", marginBottom:0 }}>
            <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Read so far</div>
            <div style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color:C.teal }}>{book.pagesRead}</div>
            <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary }}>{pct}% complete</div>
          </Card>
        </div>

        {/* Progress bar */}
        <div style={{ height:6, background:C.border, borderRadius:3, marginTop:14, marginBottom:6, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:spineC, borderRadius:3, transition:"width .6s" }} />
        </div>

        {goalRecalc && (
          <div style={{ fontFamily:T.body, fontSize:12, color:ag < book.basePPD ? C.sage : C.terra, background: ag < book.basePPD ? C.sageBg : C.terraBg, border:`1px solid ${ag < book.basePPD ? C.sage : C.terra}`, borderRadius:10, padding:"8px 13px", marginTop:10, marginBottom:2 }}>
            {ag < book.basePPD ? "You're ahead — goal adjusted down." : "Goal adjusted to keep you on track."}
          </div>
        )}

        {/* 7-day dots */}
        <Divider />
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:10 }}>Days of steady reading</div>
        <div style={{ display:"flex", gap:6, marginBottom:4 }}>
          {dots.map((dot,i) => (
            <div key={i} style={{
              flex:1, aspectRatio:"1", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:500,
              border:`1.5px solid ${dot.hit ? C.teal : dot.isToday ? C.teal : C.border}`,
              background: dot.hit ? C.teal : C.paper,
              color: dot.hit ? "#fff" : dot.isToday ? C.teal : C.secondary,
            }}>{dot.label}</div>
          ))}
        </div>

        {/* Log reading */}
        <Divider />
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:14 }}>Log reading</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10, alignItems:"end" }}>
          <div>
            <Label>Date</Label>
            <PaceInput type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} max={book.dueDate} style={{ marginBottom:0 }} />
          </div>
          <div>
            <Label>Pages read</Label>
            <PaceInput type="number" value={logPages} onChange={e=>setLogPages(e.target.value)} placeholder="e.g. 30" min="1" style={{ marginBottom:0 }} />
          </div>
          <button onClick={handleLog} style={{
            padding:"13px 18px", background:C.teal, border:"none", borderRadius:14,
            color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1, boxShadow:C.shadow,
            marginBottom:0
          }}>＋</button>
        </div>

        {/* Today's status */}
        {todayRead > 0 && !done && (
          <div style={{ fontFamily:T.body, fontSize:13, marginTop:10, padding:"10px 14px", borderRadius:12, background: goalMet ? C.sageBg : C.terraBg, border:`1px solid ${goalMet ? C.sage : C.terra}`, color: goalMet ? C.sage : C.terra }}>
            {goalMet
              ? `Today's goal met — ${todayRead} pages read.`
              : `${todayRead} of ${ag} pages today.`}
          </div>
        )}

        {/* Log history */}
        <Divider />
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:10 }}>Reading history</div>
        {book.log.length === 0
          ? <div style={{ fontFamily:T.heading, fontSize:16, color:C.secondary, fontStyle:"italic", padding:"8px 0" }}>No entries yet — log your first pages above.</div>
          : book.log.slice().reverse().map((e,ri) => {
              const i   = book.log.length-1-ri;
              const dp  = parseDate(e.date);
              const lbl = e.date === tkey() ? "Today" : fmtShort(dp);
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontFamily:T.body, fontSize:14, fontWeight:500, color:C.charcoal }}>{lbl}</div>
                    <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, marginTop:2 }}>{e.ts}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontFamily:T.body, fontSize:16, fontWeight:600, color:C.teal }}>+{e.pages} pages</span>
                    <button onClick={() => handleDelete(i)} style={{ background:"none", border:"none", color:C.border, cursor:"pointer", fontSize:16, padding:"3px 6px" }}>✕</button>
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
  const [screen,      setScreen]      = useState("shelf");
  const [books,       setBooks]       = useState(() => loadBooks());
  const [curId,       setCurId]       = useState(null);
  const [pendingBook, setPendingBook] = useState(null);

  useEffect(() => saveBooks(books), [books]);

  const curBook  = books.find(b => b.id === curId);
  const colorIdx = books.findIndex(b => b.id === curId);

  const handleSaveBook = data => {
    const book = { ...data, id:"b"+Date.now(), pagesRead:0, log:[], dailyTotals:{} };
    setPendingBook(book);
    setScreen("plan");
  };

  const handleStartTracker = () => {
    setBooks(prev => [...prev, pendingBook]);
    setCurId(pendingBook.id);
    setPendingBook(null);
    setScreen("track");
  };

  const handleUpdateBook = updated => setBooks(prev => prev.map(b => b.id===updated.id ? updated : b));

  const handleDeleteBook = () => {
    if (!window.confirm(`Remove "${curBook.title}" from your shelf?`)) return;
    setBooks(prev => prev.filter(b => b.id !== curId));
    setCurId(null);
    setScreen("shelf");
  };

  if (screen==="shelf") return <Shelf books={books} onOpen={id=>{setCurId(id);setScreen("track");}} onAdd={()=>setScreen("add")} />;
  if (screen==="add")   return <AddBook onSave={handleSaveBook} onBack={()=>setScreen("shelf")} />;
  if (screen==="plan" && pendingBook) return <PlanScreen book={pendingBook} onStart={handleStartTracker} onBack={()=>setScreen("add")} />;
  if (screen==="track" && curBook)    return <Tracker book={curBook} onUpdate={handleUpdateBook} onBack={()=>setScreen("shelf")} onDelete={handleDeleteBook} colorIdx={colorIdx} />;
  return null;
}
