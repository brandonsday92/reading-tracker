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

// ─── CSS ANIMATIONS ──────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes floatUp {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-40px); }
}
@keyframes pulseBadge {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@keyframes fadeSlideUp {
  0%   { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes ripple {
  0%   { transform: scale(0); opacity: 0.5; }
  100% { transform: scale(4); opacity: 0; }
}
@keyframes countDown {
  0%   { transform: translateY(-8px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}
@keyframes pageFan {
  0%   { opacity: 0; transform: translateY(12px) rotate(-3deg); }
  60%  { opacity: 1; transform: translateY(-4px) rotate(1deg); }
  100% { opacity: 1; transform: translateY(0) rotate(0deg); }
}
`;
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = ANIM_CSS;
  document.head.appendChild(style);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const SPINE_COLORS = [C.teal, "#4A7C6F", C.gold, "#7A6B4A", "#6F9D74", "#8B6B5D"];

// Zero-padded YYYY-MM-DD so log entries, dailyTotals, and readingDays always match
function dkey(d) {
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function tkey() { return dkey(TODAY); }
function parseDate(s) {
  const [y,m,d] = s.split("-").map(Number);
  const dt = new Date(y, m-1, d); dt.setHours(0,0,0,0); return dt;
}
function toInput(d) { return dkey(d); }
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
  // Use pages remaining BEFORE today's logging so today's goal stays
  // fixed as you log — only recalculates tomorrow onward.
  const todayLogged = book.dailyTotals[tkey()] || 0;
  const leftBeforeToday = Math.max(0, book.totalPages - book.pagesRead + todayLogged);
  if (leftBeforeToday === 0) return 0;
  const futureDays = book.readingDays.filter(d => parseDate(d) > TODAY).length;
  const isToday    = book.readingDays.includes(tkey());
  const totalDays  = Math.max(1, futureDays + (isToday ? 1 : 0));
  return Math.ceil(leftBeforeToday / totalDays);
}

function getScheduleStatus(book) {
  const ag = getAdaptiveGoal(book);
  if (ag === 0)            return { label: "Final page reached",  icon: "ahead",    color: C.sage  };
  if (ag < book.basePPD)  return { label: "Ahead of schedule",   icon: "ahead",    color: C.sage  };
  if (ag === book.basePPD) return { label: "On schedule",         icon: "ontrack",  color: C.teal  };
  return { label: "A little behind",                               icon: "behind",   color: C.terra };
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

// Normalize any date string to zero-padded YYYY-MM-DD.
// Handles old format "2026-6-3" -> "2026-06-03" so books saved before the
// padding fix still work correctly.
function normDate(s) {
  if (!s) return s;
  const [y, m, d] = s.split("-").map(Number);
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function migrateBook(b) {
  return {
    ...b,
    dueDate:     normDate(b.dueDate),
    readingDays: (b.readingDays || []).map(normDate),
    // Also normalize keys in dailyTotals
    dailyTotals: Object.fromEntries(
      Object.entries(b.dailyTotals || {}).map(([k, v]) => [normDate(k), v])
    ),
    log: (b.log || []).map(e => ({ ...e, date: normDate(e.date) })),
  };
}

function loadBooks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE)) || [];
    return raw.map(migrateBook);
  } catch { return []; }
}
function saveBooks(b) { try { localStorage.setItem(STORE, JSON.stringify(b)); } catch {} }

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

// ─── SVG ICON COMPONENTS ─────────────────────────────────────────────────────

function IconLogo({ size = 32 }) {
  const s = size, h = Math.round(size * 1.2);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={s} height={h}>
      <path d="M20 10 H80 V110 L50 90 L20 110 Z" fill="none" stroke="#2C5F5D" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M23 70 L50 60 L77 70 V106 L50 88 L23 106 Z" fill="#2C5F5D"/>
    </svg>
  );
}

// Unique ID counter so multiple BookmarkProgress instances never share a clipPath id
let _bpCounter = 0;

function BookmarkProgress({ pct, size = 32 }) {
  const [uid] = useState(() => `bp_${++_bpCounter}`);
  const fill  = Math.max(0, Math.min(1, pct / 100));
  const totalH = Math.round(size * 1.2);
  const clipY  = 120 * (1 - fill);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={size} height={totalH} style={{ overflow:"visible" }}>
      <defs>
        <clipPath id={uid}>
          <rect x="0" y={clipY} width="100" height={120 - clipY} />
        </clipPath>
      </defs>
      {/* Unfilled outline */}
      <path d="M20 10 H80 V110 L50 90 L20 110 Z" fill="none" stroke={C.border} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Filled teal layer clipped from bottom up */}
      {fill > 0 && (
        <>
          <path d="M20 10 H80 V110 L50 90 L20 110 Z" fill={C.teal} clipPath={`url(#${uid})`} opacity="0.15"/>
          <path d="M20 10 H80 V110 L50 90 L20 110 Z" fill="none" stroke={C.teal} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${uid})`}/>
        </>
      )}
    </svg>
  );
}

function IconHome({ size = 24, color = C.charcoal, active = false }) {
  const c = active ? C.teal : color;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6"/>
      <path d="M12 1v1M18 2.5l-.7.7M6 2.5l.7.7" stroke={active ? C.gold : C.gold} strokeWidth="1.5"/>
    </svg>
  );
}

function IconShelf({ size = 24, color = C.charcoal, active = false }) {
  const c = active ? C.teal : color;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h4v16H4zM9 4h4v16H9z"/>
      <path d="M14 4.5l3.5 15.5M17.5 4l1.5 6" opacity="0.4"/>
    </svg>
  );
}

function IconHistory({ size = 24, color = C.charcoal, active = false }) {
  const c = active ? C.teal : color;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3"/>
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
    </svg>
  );
}

function IconLogReading({ size = 24, color = C.teal }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6s3-1 10-1 10 1 10 1v11s-3-1-10-1-10 1-10 1z"/>
      <path d="M12 5v11"/>
      <path d="M3 19c2 2 5 2 7 0l8-4a1.5 1.5 0 0 0-1-3h-4"/>
    </svg>
  );
}

function IconAdd({ size = 24, color = C.charcoal }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconStatusAhead({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-7-4-7 4V3z"/>
      <path d="M12 14V8M9 11l3-3 3 3"/>
    </svg>
  );
}

function IconStatusOnTrack({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-7-4-7 4V3z"/>
      <path d="M9 10l2 2 4-4"/>
    </svg>
  );
}

function IconStatusBehind({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={C.terra} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-7-4-7 4V3z"/>
      <path d="M9 11h6"/>
    </svg>
  );
}

function TopBar({ title, onBack, rightAction }) {
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"18px 20px 0", gap:12 }}>
      {onBack && (
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px 8px 6px 0", color:C.secondary, lineHeight:1, display:"flex", alignItems:"center" }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
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
          <IconLogo size={28} />
          <span style={{ fontFamily:T.heading, fontSize:28, fontWeight:500, color:C.charcoal, letterSpacing:"-.01em" }}>Pace</span>
        </div>
        <button onClick={onAdd} style={{
          display:"flex", alignItems:"center", gap:7,
          background:C.teal, color:"#fff", border:"none", borderRadius:20,
          padding:"9px 18px", fontSize:13, fontWeight:600, fontFamily:T.body, cursor:"pointer", boxShadow:C.shadow
        }}><IconAdd size={16} color="#fff" /> Add book</button>
      </div>

      <div style={{ padding:"20px 20px 80px" }}>
        {books.length === 0 ? (
          <div style={{ textAlign:"center", padding:"4rem 1rem" }}>
            <IconLogo size={48} />
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
                <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".08em", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
                  <IconHome size={14} color={C.secondary} /> Today's reading
                </div>
                {todayBooks.map((b, i) => <BookCard key={b.id} book={b} onClick={() => onOpen(b.id)} colorIdx={books.indexOf(b)} />)}
              </>
            )}
            {otherBooks.length > 0 && (
              <>
                <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".08em", margin:"20px 0 12px", display:"flex", alignItems:"center", gap:7 }}>
                  <IconShelf size={14} color={C.secondary} />
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
        {/* Always show thin color spine */}
        <div style={{ width:5, background:spineC, flexShrink:0 }} />

        <div style={{ flex:1, padding:"16px 16px 14px 16px" }}>
          {/* Title row with optional thumbnail */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:2 }}>
            {book.coverUrl && (
              <img
                src={book.coverUrl} alt=""
                style={{ width:44, height:64, objectFit:"cover", borderRadius:6,
                  border:`1px solid ${C.border}`, flexShrink:0, boxShadow:"0 1px 6px rgba(0,0,0,0.10)" }}
              />
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:2 }}>
                <div style={{ fontFamily:T.heading, fontSize:19, color:C.charcoal, fontWeight:500, flex:1, marginRight:10, lineHeight:1.2 }}>{book.title}</div>
                <BookmarkProgress pct={pct} size={22} />
              </div>
              {book.author && <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginBottom:6 }}>{book.author}</div>}
              {!done && (
                <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                  <span style={{ fontFamily:T.body, fontSize:26, fontWeight:600, color:C.teal, lineHeight:1 }}>{ag}</span>
                  <span style={{ fontFamily:T.body, fontSize:13, color:C.secondary }}>pages today</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop: book.coverUrl ? 8 : 0 }}>
            <span style={{ fontFamily:T.body, fontSize:12, color:status.color, display:"flex", alignItems:"center", gap:5 }}>
              {done || status.icon === "ahead"   ? <IconStatusAhead size={16} />   : null}
              {status.icon === "ontrack"         ? <IconStatusOnTrack size={16} /> : null}
              {status.icon === "behind"          ? <IconStatusBehind size={16} />  : null}
              {done ? "Final page reached" : status.label}
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
  const [title,        setTitle]        = useState("");
  const [pages,        setPages]        = useState("");
  const [author,       setAuthor]       = useState("");
  const [coverUrl,     setCoverUrl]     = useState(null);
  const [alreadyRead,  setAlreadyRead]  = useState("");
  const [dueDate,      setDueDate]      = useState(null);
  const [dueCal,       setDueCal]       = useState({ y:TODAY.getFullYear(), m:TODAY.getMonth() });
  const [readCal,      setReadCal]      = useState({ y:TODAY.getFullYear(), m:TODAY.getMonth() });
  const [preset,       setPreset]       = useState(null);
  const [customDays,   setCustomDays]   = useState(new Set());
  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [showResults,  setShowResults]  = useState(false);
  const [searchTimer,  setSearchTimer]  = useState(null);
  const [bookSelected, setBookSelected] = useState(false); // true once user picks from search
  const [manualMode,   setManualMode]   = useState(false); // true if user opts for manual entry
  const [searchDone,   setSearchDone]   = useState(false); // true once a search has completed

  const shiftDue  = d => setDueCal(c  => { let m=c.m+d,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const shiftRead = d => setReadCal(c => { let m=c.m+d,y=c.y; if(m>11){m=0;y++} if(m<0){m=11;y--} return {y,m}; });
  const toggleDay = t => setCustomDays(p => { const s=new Set(p); s.has(t)?s.delete(t):s.add(t); return s; });

  const handleQueryChange = (val) => {
    setQuery(val);
    setBookSelected(false);
    setSearchDone(false);
    setCoverUrl(null); setAuthor(""); setTitle(""); setPages("");
    if (searchTimer) clearTimeout(searchTimer);
    if (val.trim().length < 2) { setResults([]); setShowResults(false); return; }
    const timer = setTimeout(() => searchBooks(val), 500);
    setSearchTimer(timer);
  };

  const searchBooks = async (q) => {
    setSearching(true);
    setShowResults(true);
    try {
      const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&fields=title,author_name,number_of_pages_median,cover_i,key&limit=6`;
      const res  = await fetch(url);
      const data = await res.json();
      const filtered = (data.docs || [])
        .filter(b => b.number_of_pages_median && b.number_of_pages_median > 10)
        .slice(0, 6);
      setResults(filtered);
    } catch {
      setResults([]);
    }
    setSearching(false);
    setSearchDone(true);
  };

  const selectBook = (book) => {
    const t = book.title || "";
    const a = (book.author_name || [])[0] || "";
    const p = book.number_of_pages_median || "";
    const cover = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null;
    setTitle(t); setAuthor(a); setPages(String(p)); setCoverUrl(cover);
    setBookSelected(true); setShowResults(false); setResults([]);
    setManualMode(false);
  };

  const clearSearch = () => {
    setQuery(""); setTitle(""); setAuthor(""); setPages(""); setCoverUrl(null);
    setResults([]); setShowResults(false); setBookSelected(false);
    setManualMode(false); setSearchDone(false);
  };

  const handleSave = () => {
    const p  = parseInt(pages);
    const ar = parseInt(alreadyRead) || 0;
    if (!title.trim())                         return alert("Please enter a book title.");
    if (!p || p < 1)                           return alert("Please enter the total number of pages.");
    if (ar < 0 || ar >= p)                     return alert("Pages already read must be less than the total.");
    if (!dueDate)                              return alert("Please choose a finish date.");
    if (!preset)                               return alert("Please choose your reading days.");
    if (preset==="custom" && !customDays.size)  return alert("Please select at least one day.");
    const rdays = buildReadingDays(preset, customDays, TODAY, dueDate);
    if (!rdays.length) return alert("No reading days found — try adjusting your schedule.");
    onSave({
      title: title.trim()||"Untitled",
      author,
      coverUrl,
      totalPages: p,
      startingPage: ar,
      dueDate: dkey(dueDate),
      readingDays: rdays,
      basePPD: Math.ceil((p - ar) / rdays.length),
    });
  };

  const presets = [
    { key:"daily",    label:"Every day"  },
    { key:"weekdays", label:"Weekdays"   },
    { key:"weekends", label:"Weekends"   },
    { key:"custom",   label:"Custom days"},
  ];

  // Show the plan fields once a book is confirmed (selected or manual)
  const showPlanFields = bookSelected || manualMode;

  return (
    <div style={{ minHeight:"100vh", background:C.paper }}>
      <TopBar title="New book" onBack={onBack} />
      <div style={{ padding:"20px 20px 80px" }}>
        <p style={{ fontFamily:T.heading, fontSize:17, color:C.secondary, marginBottom:24, fontStyle:"italic" }}>
          Tell us about your book and we'll handle the math.
        </p>

        {/* ── SEARCH STATE ── */}
        {!bookSelected && !manualMode && (
          <>
            <Label>Search for your book</Label>
            <div style={{ position:"relative" }}>
              <PaceInput
                type="text" value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Type a title to search..."
                style={{ marginBottom:0, paddingRight: query ? 40 : 15 }}
              />
              {query.length > 0 && (
                <button onClick={clearSearch} style={{
                  position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", color:C.secondary,
                  fontSize:20, lineHeight:1, padding:2
                }}>×</button>
              )}
            </div>

            {/* Results dropdown */}
            {showResults && (
              <div style={{
                background:C.surface, border:`1px solid ${C.border}`, borderRadius:14,
                boxShadow:C.shadowMd, marginTop:4, overflow:"hidden"
              }}>
                {searching ? (
                  <div style={{ padding:"16px 18px", fontFamily:T.heading, fontSize:15, color:C.secondary, fontStyle:"italic" }}>
                    Searching...
                  </div>
                ) : results.map((b, i) => {
                  const cover = b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null;
                  const auth  = (b.author_name || [])[0] || "";
                  return (
                    <div key={i} onClick={() => selectBook(b)} style={{
                      display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
                      borderBottom: i < results.length-1 ? `1px solid ${C.border}` : "none",
                      cursor:"pointer",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.paper}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {cover
                        ? <img src={cover} alt="" style={{ width:36, height:52, objectFit:"cover", borderRadius:4, flexShrink:0, border:`1px solid ${C.border}` }} />
                        : <div style={{ width:36, height:52, borderRadius:4, background:C.border, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <IconLogo size={18} />
                          </div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:T.body, fontSize:14, fontWeight:500, color:C.charcoal, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.title}</div>
                        {auth && <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginTop:2 }}>{auth}</div>}
                        {b.number_of_pages_median && <div style={{ fontFamily:T.body, fontSize:11, color:C.teal, marginTop:2 }}>{b.number_of_pages_median} pages</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* "My book isn't here" — show after a search completes */}
            {searchDone && !searching && (
              <div style={{ marginTop:12, textAlign:"center" }}>
                {results.length === 0 && (
                  <p style={{ fontFamily:T.heading, fontSize:14, color:C.secondary, fontStyle:"italic", marginBottom:10 }}>
                    No results found.
                  </p>
                )}
                <button onClick={() => setManualMode(true)} style={{
                  background:"none", border:"none", cursor:"pointer",
                  fontFamily:T.body, fontSize:13, color:C.teal,
                  textDecoration:"underline", textDecorationColor: C.border, textUnderlineOffset:3,
                  padding:"4px 0"
                }}>My book isn't here — add it manually</button>
              </div>
            )}
          </>
        )}

        {/* ── SELECTED BOOK CARD ── */}
        {bookSelected && (
          <div style={{ display:"flex", alignItems:"center", gap:14, background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:14, padding:"14px 16px", marginBottom:20 }}>
            {coverUrl
              ? <img src={coverUrl} alt="" style={{ width:44, height:64, objectFit:"cover", borderRadius:6, border:`1px solid ${C.gold}`, flexShrink:0 }} />
              : <div style={{ width:44, height:64, borderRadius:6, background:C.goldLight, border:`1px solid ${C.gold}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}><IconLogo size={24} /></div>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:T.body, fontSize:14, fontWeight:600, color:C.charcoal, marginBottom:2 }}>{title}</div>
              {author && <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginBottom:4 }}>{author}</div>}
              <div style={{ fontFamily:T.body, fontSize:12, color:C.teal }}>{pages} pages · Open Library</div>
            </div>
            <button onClick={clearSearch} style={{ background:"none", border:"none", cursor:"pointer", color:C.secondary, fontSize:20, padding:4, flexShrink:0, lineHeight:1 }}>×</button>
          </div>
        )}

        {/* ── MANUAL ENTRY ── */}
        {manualMode && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"16px 16px 4px", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontFamily:T.body, fontSize:13, fontWeight:500, color:C.charcoal }}>Enter book details</span>
              <button onClick={clearSearch} style={{ background:"none", border:"none", cursor:"pointer", color:C.secondary, fontSize:18, padding:2, lineHeight:1 }}>×</button>
            </div>
            <Label>Book title</Label>
            <PaceInput type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. The Remains of the Day" />
            <Label>Total pages</Label>
            <PaceInput type="number" value={pages} onChange={e=>setPages(e.target.value)} placeholder="e.g. 258" min="1" />
            <Label>Pages already read <span style={{fontWeight:400,textTransform:"none",fontSize:11,color:C.border}}>(optional)</span></Label>
            <PaceInput type="number" value={alreadyRead} onChange={e=>setAlreadyRead(e.target.value)} placeholder="e.g. 0" min="0" />
          </div>
        )}

        {/* ── PAGES ALREADY READ (shown after search selection too) ── */}
        {bookSelected && (
          <>
            <Label>Pages already read <span style={{fontWeight:400,textTransform:"none",fontSize:11,color:C.border}}>(optional)</span></Label>
            <PaceInput type="number" value={alreadyRead} onChange={e=>setAlreadyRead(e.target.value)} placeholder="e.g. 0" min="0" />
          </>
        )}

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
        <IconLogo size={48} />
        <div style={{ fontFamily:T.heading, fontSize:17, color:C.secondary, marginTop:24, marginBottom:8, letterSpacing:".02em" }}>
          Your daily reading goal
        </div>
        <div style={{ fontFamily:T.body, fontSize:72, fontWeight:600, color:C.teal, lineHeight:1, marginBottom:4 }}>
          {book.basePPD}
        </div>
        <div style={{ fontFamily:T.heading, fontSize:22, color:C.secondary, marginBottom:28, fontStyle:"italic" }}>pages per day</div>

        <Card style={{ width:"100%", textAlign:"center", background:C.goldLight, border:`1px solid ${C.gold}` }}>
          <div style={{ fontFamily:T.body, fontSize:13, color:C.charcoal, lineHeight:1.7 }}>
            {book.startingPage > 0 && <><strong>{book.totalPages - book.startingPage}</strong> pages remaining · </>}
            <strong>{book.readingDays.length}</strong> reading days ·
            finish by <strong>{fmtShort(parseDate(book.dueDate))}</strong>
          </div>
          {book.startingPage > 0 && (
            <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginTop:6 }}>
              Starting from p.{book.startingPage} of {book.totalPages}
            </div>
          )}
          <div style={{ fontFamily:T.heading, fontSize:15, color:C.secondary, marginTop:6, fontStyle:"italic" }}>
            One page at a time.
          </div>
        </Card>
      </div>
      <div style={{ padding:"0 20px 40px" }}>
        <BtnPrimary onClick={onStart}>Begin tracking</BtnPrimary>
        <BtnSecondary onClick={onBack} style={{ marginTop:10 }}>Adjust plan</BtnSecondary>
      </div>
    </div>
  );
}

// ─── TRACKER SCREEN ───────────────────────────────────────────────────────────
function Tracker({ book, onUpdate, onBack, onDelete, colorIdx }) {
  const [logValue,   setLogValue]   = useState("");
  const [logDate,    setLogDate]    = useState(toInput(TODAY));
  const [logMode,    setLogMode]    = useState("pages");
  const [toast,      setToast]      = useState(null);   // { text, id }
  const [rippling,   setRippling]   = useState(false);
  const [justDone,   setJustDone]   = useState(false);  // triggered on completion
  const [pulseBadge, setPulseBadge] = useState(false);  // goal-met pulse
  const [prevLeft,   setPrevLeft]   = useState(null);   // for animated countdown

  const left   = Math.max(0, book.totalPages - book.pagesRead);
  const pct    = Math.round((book.pagesRead / book.totalPages) * 100);
  const ag     = getAdaptiveGoal(book);
  const status = getScheduleStatus(book);
  const streak = calcStreak(book);
  const done   = book.pagesRead >= book.totalPages;
  const todayRead      = book.dailyTotals[tkey()] || 0;
  const todayRemaining = Math.max(0, ag - todayRead);
  const goalMet        = todayRead >= ag;
  const goalRecalc     = ag !== book.basePPD && !done;
  const spineC         = SPINE_COLORS[colorIdx % SPINE_COLORS.length];

  const showToast = (text) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast(t => t?.id === id ? null : t), 1800);
  };

  const handleLog = () => {
    const val = parseInt(logValue);
    if (!val || val < 1) return alert(logMode === "pages" ? "Enter pages read." : "Enter the page you ended on.");
    if (!logDate)        return alert("Pick a date.");
    if (done)            return alert("You've already reached the final page.");

    let toLog;
    if (logMode === "endpage") {
      if (val <= book.pagesRead) return alert(`You're already on page ${book.pagesRead}. Enter a page number higher than that.`);
      if (val > book.totalPages)  return alert(`This book only has ${book.totalPages} pages.`);
      toLog = val - book.pagesRead;
    } else {
      toLog = Math.min(val, left);
    }

    const newPagesRead = book.pagesRead + toLog;
    const isNowDone    = newPagesRead >= book.totalPages;
    const wasGoalMet   = todayRead >= ag;
    const willGoalMet  = (todayRead + toLog) >= ag;

    const updated = {
      ...book,
      pagesRead: newPagesRead,
      dailyTotals: { ...book.dailyTotals, [logDate]: (book.dailyTotals[logDate]||0) + toLog },
      log: [...book.log, {
        date: logDate, pages: toLog,
        ts: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        mode: logMode, endPage: logMode === "endpage" ? val : null,
      }],
      ...(isNowDone && !book.completedDate ? { completedDate: tkey() } : {}),
    };

    // Ripple on button
    setRippling(true);
    setTimeout(() => setRippling(false), 600);

    // Toast
    showToast(isNowDone ? "Final page reached 📖" : `+${toLog} pages`);

    // Completion animation
    if (isNowDone) setTimeout(() => setJustDone(true), 200);

    // Goal-met pulse (only on crossing threshold)
    if (!wasGoalMet && willGoalMet && !isNowDone) {
      setTimeout(() => { setPulseBadge(true); setTimeout(() => setPulseBadge(false), 600); }, 300);
    }

    onUpdate(updated);
    setLogValue("");
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
          <button onClick={onDelete} style={{ background:"none", border:"none", cursor:"pointer", color:C.secondary, padding:6, display:"flex", alignItems:"center" }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={C.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
        }
      />

      <div style={{ padding:"16px 20px 80px" }}>
        {/* Book identity strip */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          {book.coverUrl && (
            <img src={book.coverUrl} alt=""
              style={{ width:48, height:70, objectFit:"cover", borderRadius:8,
                border:`1px solid ${C.border}`, flexShrink:0,
                boxShadow:"0 2px 10px rgba(0,0,0,0.12)" }}
            />
          )}
          <div>
            <p style={{ fontFamily:T.body, fontSize:13, color:C.secondary, marginBottom:2 }}>
              {book.totalPages} pages · Due {fmtShort(parseDate(book.dueDate))}
            </p>
            {book.author && (
              <p style={{ fontFamily:T.heading, fontSize:15, color:C.secondary, fontStyle:"italic" }}>
                by {book.author}
              </p>
            )}
          </div>
        </div>

        {/* Today's goal hero */}
        {!done && (
          <Card style={{ background: goalMet ? C.sageBg : C.teal, border: goalMet ? `1px solid ${C.sage}` : "none", textAlign:"center", padding:"24px 20px" }}>
            {goalMet ? (
              <>
                <div style={{ fontFamily:T.body, fontSize:12, color:C.sage, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Today's reading done</div>
                <div style={{ fontFamily:T.body, fontSize:48, fontWeight:600, color:C.teal, lineHeight:1 }}>0</div>
                <div style={{ fontFamily:T.heading, fontSize:18, color:C.secondary, fontStyle:"italic", marginTop:4 }}>pages left today</div>
                {todayRead > ag
                  ? <div style={{ fontFamily:T.body, fontSize:13, color:C.sage, marginTop:10 }}>
                      {todayRead - ag} pages ahead — tomorrow's goal is a little lighter.
                    </div>
                  : <div style={{ fontFamily:T.body, fontSize:13, color:C.sage, marginTop:10 }}>
                      Exactly on pace. Nice work.
                    </div>
                }
              </>
            ) : (
              <>
                <div style={{ fontFamily:T.body, fontSize:12, color:"rgba(255,255,255,.65)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>
                  {todayRead > 0 ? "Still to read today" : "Read today's pages"}
                </div>
                <div style={{ fontFamily:T.body, fontSize:64, fontWeight:600, color:"#fff", lineHeight:1 }}>
                  {todayRead > 0 ? todayRemaining : ag}
                </div>
                <div style={{ fontFamily:T.heading, fontSize:18, color:"rgba(255,255,255,.75)", fontStyle:"italic", marginTop:4, marginBottom: todayRead > 0 ? 6 : 16 }}>
                  pages {todayRead > 0 ? "to go" : "today"}
                </div>
                {todayRead > 0 && (
                  <div style={{ fontFamily:T.body, fontSize:13, color:"rgba(255,255,255,.6)", marginBottom:10 }}>
                    {todayRead} of {ag} read · up to p.{Math.min(book.totalPages, book.pagesRead)}
                  </div>
                )}
                {todayRead === 0 && book.pagesRead > 0 && (
                  <div style={{ fontFamily:T.body, fontSize:13, color:"rgba(255,255,255,.7)" }}>
                    p.{book.pagesRead} → p.{Math.min(book.totalPages, book.pagesRead + ag)}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {done && (
          <div style={{ animation: justDone ? "pageFan 700ms ease-out forwards" : "fadeSlideUp 400ms ease-out" }}>
            <Card style={{ background:C.sageBg, border:`1px solid ${C.sage}`, textAlign:"center", padding:"28px 20px" }}>
              {/* Animated bookmark filling to 100% */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
                <BookmarkProgress pct={100} size={44} />
              </div>
              <div style={{ fontFamily:T.heading, fontSize:26, color:C.charcoal, marginBottom:6 }}>You reached the final page.</div>
              <div style={{ fontFamily:T.body, fontSize:13, color:C.secondary, marginBottom:10 }}>{book.title}</div>
              {book.completedDate && (
                <div style={{ fontFamily:T.heading, fontSize:13, color:C.sage, fontStyle:"italic" }}>
                  Finished {fmtShort(parseDate(book.completedDate))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Status & streak row */}
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <div style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px 14px", boxShadow:C.shadow }}>
            <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Schedule</div>
            <div style={{ fontFamily:T.body, fontSize:13, color:status.color, display:"flex", alignItems:"center", gap:6, fontWeight:500 }}>
              {status.icon === "ahead"   && <IconStatusAhead size={16} />}
              {status.icon === "ontrack" && <IconStatusOnTrack size={16} />}
              {status.icon === "behind"  && <IconStatusBehind size={16} />}
              {status.label}
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
            <div key={left} style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color:C.charcoal, animation:"countDown 350ms ease-out" }}>{left}</div>
            <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary }}>of {book.totalPages}</div>
          </Card>
          <Card style={{ padding:"14px 16px", marginBottom:0 }}>
            <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Read so far</div>
            <div key={book.pagesRead} style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color:C.teal, animation:"countDown 350ms ease-out" }}>{book.pagesRead}</div>
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
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:10, display:"flex", alignItems:"center", gap:7 }}>
          <IconHistory size={16} color={C.secondary} /> Days of steady reading
        </div>
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
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:12 }}>Log reading</div>

        {/* Mode toggle */}
        <div style={{ display:"flex", background:C.border, borderRadius:12, padding:3, marginBottom:14 }}>
          {[["pages","Pages read"],["endpage","Ended on page"]].map(([mode, label]) => (
            <button key={mode} onClick={() => { setLogMode(mode); setLogValue(""); }} style={{
              flex:1, padding:"9px 0", fontSize:13, fontWeight:500, fontFamily:T.body,
              border:"none", borderRadius:10, cursor:"pointer", transition:"all .15s",
              background: logMode === mode ? C.surface : "transparent",
              color:       logMode === mode ? C.teal    : C.secondary,
              boxShadow:   logMode === mode ? C.shadow  : "none",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10, alignItems:"end" }}>
          <div>
            <Label>Date</Label>
            <PaceInput type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} max={book.dueDate} style={{ marginBottom:0 }} />
          </div>
          <div>
            <Label>{logMode === "pages" ? "Pages read" : "Page number"}</Label>
            <PaceInput
              type="number" value={logValue} onChange={e=>setLogValue(e.target.value)} min="1"
              placeholder={logMode === "pages" ? "e.g. 30" : `e.g. ${book.pagesRead + ag}`}
              style={{ marginBottom:0 }}
            />
          </div>
          {/* Log button with ripple effect */}
          <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:0 }}>
            {rippling && (
              <span style={{
                position:"absolute", width:44, height:44, borderRadius:"50%",
                background:C.teal, opacity:0.3,
                animation:"ripple 600ms ease-out forwards", pointerEvents:"none"
              }}/>
            )}
            <button onClick={handleLog} style={{
              padding:"13px 16px", background:C.teal, border:"none", borderRadius:14,
              color:"#fff", cursor:"pointer", lineHeight:1, boxShadow:C.shadow,
              display:"flex", alignItems:"center", justifyContent:"center", position:"relative", zIndex:1
            }}><IconLogReading size={22} color="#fff" /></button>
            {/* Floating toast */}
            {toast && (
              <div key={toast.id} style={{
                position:"absolute", bottom:"calc(100% + 10px)", left:"50%",
                transform:"translateX(-50%)",
                background:C.charcoal, color:"#fff",
                fontFamily:T.body, fontSize:12, fontWeight:500,
                padding:"6px 12px", borderRadius:20, whiteSpace:"nowrap",
                animation:"floatUp 1.8s ease-out forwards", pointerEvents:"none", zIndex:10
              }}>{toast.text}</div>
            )}
          </div>
        </div>

        {logMode === "endpage" && book.pagesRead > 0 && (
          <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginTop:6, padding:"6px 0" }}>
            You're currently on page <strong style={{ color:C.teal }}>{book.pagesRead}</strong>. Enter the page you stopped on.
          </div>
        )}

        {/* Today's status */}
        {todayRead > 0 && !done && (
          <div style={{
            fontFamily:T.body, fontSize:13, marginTop:10, padding:"10px 14px", borderRadius:12,
            background: goalMet ? C.sageBg : C.terraBg,
            border:`1px solid ${goalMet ? C.sage : C.terra}`,
            color: goalMet ? C.sage : C.terra,
            animation: pulseBadge ? "pulseBadge 600ms ease-in-out" : "none",
            transition: "background 600ms ease, color 600ms ease, border-color 600ms ease",
          }}>
            {goalMet
              ? `Today's goal met — ${todayRead} pages read today.`
              : `${todayRead} of ${ag} pages today — ${todayRemaining} to go.`}
          </div>
        )}

        {/* Log history */}
        <Divider />
        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:10, display:"flex", alignItems:"center", gap:7 }}>
          <IconHistory size={16} color={C.secondary} /> Reading history
        </div>
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
                    <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, marginTop:2 }}>
                      {e.ts}{e.endPage ? ` · ended on p.${e.endPage}` : ""}
                    </div>
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

// ─── STATS HELPERS ───────────────────────────────────────────────────────────
function computeStats(books) {
  const allLogs = books.flatMap(b => b.log || []);

  // Total pages read across all books
  const totalPagesRead = books.reduce((s, b) => s + (b.pagesRead || 0), 0);

  // Books completed
  const completed = books.filter(b => b.pagesRead >= b.totalPages);
  const completedCount = completed.length;

  // On-time rate
  const onTime = completed.filter(b => {
    if (!b.completedDate || !b.dueDate) return false;
    return b.completedDate <= b.dueDate;
  }).length;
  const onTimeRate = completedCount > 0 ? Math.round((onTime / completedCount) * 100) : null;

  // Average pages/day over last 7 and 30 days
  const dayTotals = {};
  allLogs.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.pages; });
  const avg = (days) => {
    let total = 0, count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(TODAY); d.setDate(d.getDate() - i);
      const k = dkey(d);
      if (dayTotals[k]) { total += dayTotals[k]; count++; }
    }
    return count > 0 ? Math.round(total / days) : 0;
  };
  const avg7  = avg(7);
  const avg30 = avg(30);

  // Best reading day of week
  const byDow = [0,0,0,0,0,0,0];
  allLogs.forEach(e => {
    const d = parseDate(e.date);
    byDow[d.getDay()] += e.pages;
  });
  const bestDow = byDow.indexOf(Math.max(...byDow));
  const DOW_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const bestDay = Math.max(...byDow) > 0 ? DOW_NAMES[bestDow] : null;

  // All-time best streak across all books
  let bestStreak = 0;
  books.forEach(b => {
    const s = calcStreak(b);
    if (s > bestStreak) bestStreak = s;
  });

  // Total reading sessions
  const sessions = allLogs.length;

  return { totalPagesRead, completedCount, onTimeRate, avg7, avg30, bestDay, bestStreak, sessions };
}

// ─── STATS SCREEN ────────────────────────────────────────────────────────────
function Stats({ books, onBack }) {
  const s = computeStats(books);
  const completed = books.filter(b => b.pagesRead >= b.totalPages);

  return (
    <div style={{ minHeight:"100vh", background:C.paper, paddingBottom:80 }}>
      <div style={{ padding:"24px 20px 0", display:"flex", alignItems:"center", gap:10 }}>
        <IconLogo size={22} />
        <span style={{ fontFamily:T.heading, fontSize:24, fontWeight:500, color:C.charcoal }}>Reading stats</span>
      </div>

      <div style={{ padding:"20px 20px 0" }}>
        {books.length === 0 ? (
          <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
            <div style={{ fontFamily:T.heading, fontSize:22, color:C.secondary, fontStyle:"italic", marginBottom:8 }}>
              Nothing to show yet.
            </div>
            <div style={{ fontFamily:T.body, fontSize:13, color:C.secondary }}>
              Add a book and start reading to see your stats here.
            </div>
          </div>
        ) : (
          <>
            {/* Hero stat */}
            <div style={{ background:C.teal, borderRadius:20, padding:"24px 22px", marginBottom:14, boxShadow:C.shadowMd }}>
              <div style={{ fontFamily:T.body, fontSize:11, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>Total pages read</div>
              <div style={{ fontFamily:T.body, fontSize:56, fontWeight:700, color:"#fff", lineHeight:1 }}>{s.totalPagesRead.toLocaleString()}</div>
              <div style={{ fontFamily:T.heading, fontSize:16, color:"rgba(255,255,255,.65)", fontStyle:"italic", marginTop:6 }}>across {s.sessions} reading session{s.sessions !== 1 ? "s" : ""}</div>
            </div>

            {/* 2-col stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <StatMini label="Books finished" value={s.completedCount} sub={s.completedCount === 1 ? "book" : "books"} />
              <StatMini label="Best streak" value={s.bestStreak} sub="days in a row" color={s.bestStreak > 0 ? C.gold : undefined} />
              <StatMini label="Avg pages/day" value={s.avg7 || "—"} sub="last 7 days" />
              <StatMini label="Avg pages/day" value={s.avg30 || "—"} sub="last 30 days" />
            </div>

            {/* On-time rate */}
            {s.onTimeRate !== null && (
              <Card style={{ marginBottom:10, padding:"16px 18px" }}>
                <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>Finished on time</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
                  <span style={{ fontFamily:T.body, fontSize:36, fontWeight:600, color: s.onTimeRate >= 80 ? C.sage : s.onTimeRate >= 50 ? C.gold : C.terra }}>{s.onTimeRate}%</span>
                  <span style={{ fontFamily:T.body, fontSize:13, color:C.secondary }}>of books completed on time</span>
                </div>
                <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${s.onTimeRate}%`, background: s.onTimeRate >= 80 ? C.sage : s.onTimeRate >= 50 ? C.gold : C.terra, borderRadius:3, transition:"width 1s ease" }} />
                </div>
              </Card>
            )}

            {/* Best reading day */}
            {s.bestDay && (
              <Card style={{ marginBottom:10, padding:"16px 18px" }}>
                <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>Most productive day</div>
                <div style={{ fontFamily:T.heading, fontSize:28, color:C.charcoal, fontWeight:500 }}>{s.bestDay}</div>
                <div style={{ fontFamily:T.heading, fontSize:13, color:C.secondary, fontStyle:"italic", marginTop:2 }}>You tend to read most on {s.bestDay}s</div>
              </Card>
            )}

            {/* Completed books list */}
            {completed.length > 0 && (
              <>
                <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", margin:"16px 0 10px" }}>Finished books</div>
                {completed.map((b, i) => {
                  const spineC = SPINE_COLORS[books.indexOf(b) % SPINE_COLORS.length];
                  const onTime = b.completedDate && b.dueDate && b.completedDate <= b.dueDate;
                  return (
                    <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom: i < completed.length-1 ? `1px solid ${C.border}` : "none" }}>
                      {b.coverUrl
                        ? <img src={b.coverUrl} alt="" style={{ width:36, height:52, objectFit:"cover", borderRadius:5, border:`1px solid ${C.border}`, flexShrink:0 }} />
                        : <div style={{ width:4, alignSelf:"stretch", background:spineC, borderRadius:2, flexShrink:0 }} />
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:T.heading, fontSize:16, color:C.charcoal, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.title}</div>
                        {b.author && <div style={{ fontFamily:T.body, fontSize:12, color:C.secondary, marginTop:1 }}>{b.author}</div>}
                        <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, marginTop:2 }}>
                          {b.totalPages} pages {b.completedDate ? `· finished ${fmtShort(parseDate(b.completedDate))}` : ""}
                        </div>
                      </div>
                      <div style={{ fontFamily:T.body, fontSize:11, padding:"4px 10px", borderRadius:12, background: onTime ? C.sageBg : C.terraBg, color: onTime ? C.sage : C.terra, flexShrink:0 }}>
                        {onTime ? "On time" : "Late"}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value, sub, color }) {
  return (
    <Card style={{ padding:"14px 16px", marginBottom:0 }}>
      <div style={{ fontFamily:T.body, fontSize:10, color:C.secondary, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:T.body, fontSize:28, fontWeight:600, color: color || C.charcoal, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:T.body, fontSize:11, color:C.secondary, marginTop:3 }}>{sub}</div>
    </Card>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab }) {
  const tabs = [
    { key:"shelf", icon:<IconShelf size={22} />, label:"Shelf" },
    { key:"stats", icon:<IconHistory size={22} />, label:"Stats" },
  ];
  return (
    <div style={{
      position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
      width:"100%", maxWidth:480,
      background:C.surface, borderTop:`1px solid ${C.border}`,
      display:"flex", zIndex:100,
      paddingBottom:"env(safe-area-inset-bottom, 0px)",
    }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onTab(t.key)} style={{
          flex:1, padding:"10px 0 8px", background:"none", border:"none", cursor:"pointer",
          display:"flex", flexDirection:"column", alignItems:"center", gap:3,
          color: tab === t.key ? C.teal : C.secondary,
          transition:"color .15s",
        }}>
          <span style={{ color: tab === t.key ? C.teal : C.secondary, display:"flex" }}>
            {t.icon}
          </span>
          <span style={{ fontFamily:T.body, fontSize:10, fontWeight: tab===t.key ? 600 : 400, letterSpacing:".04em" }}>
            {t.label.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,      setScreen]      = useState("shelf");
  const [tab,         setTab]         = useState("shelf"); // "shelf" | "stats"
  const [books,       setBooks]       = useState(() => loadBooks());
  const [curId,       setCurId]       = useState(null);
  const [pendingBook, setPendingBook] = useState(null);

  useEffect(() => saveBooks(books), [books]);

  const curBook  = books.find(b => b.id === curId);
  const colorIdx = books.findIndex(b => b.id === curId);

  const handleSaveBook = data => {
    const book = { ...data, id:"b"+Date.now(), pagesRead:data.startingPage||0, log:[], dailyTotals:{} };
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
    setTab("shelf");
  };

  const handleTab = (t) => { setTab(t); setScreen("shelf"); };

  // Screens that show the bottom nav
  const showNav = screen === "shelf";

  return (
    <>
      {screen === "shelf" && tab === "shelf" && (
        <Shelf books={books} onOpen={id=>{setCurId(id);setScreen("track");}} onAdd={()=>setScreen("add")} />
      )}
      {screen === "shelf" && tab === "stats" && (
        <Stats books={books} />
      )}
      {screen === "add" && (
        <AddBook onSave={handleSaveBook} onBack={()=>setScreen("shelf")} />
      )}
      {screen === "plan" && pendingBook && (
        <PlanScreen book={pendingBook} onStart={handleStartTracker} onBack={()=>setScreen("add")} />
      )}
      {screen === "track" && curBook && (
        <Tracker book={curBook} onUpdate={handleUpdateBook} onBack={()=>setScreen("shelf")} onDelete={handleDeleteBook} colorIdx={colorIdx} />
      )}
      {showNav && <BottomNav tab={tab} onTab={handleTab} />}
    </>
  );
}
