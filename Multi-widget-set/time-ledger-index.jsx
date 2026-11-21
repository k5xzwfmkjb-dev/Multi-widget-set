import { React, run } from "uebersicht";

// Übersicht 1.x has no in-widget state API — everything is driven by
// re-running `command` on a timer and rendering whatever it outputs.
// Button clicks fire off a one-off shell command via run() that mutates
// small files on disk; the next poll picks up the change.
//
// Archiving: on every tick, the command checks whether the ISO week has
// rolled over since the last tick (tracked in `.current-week`). If it
// has, it snapshots the just-finished week's values/goals as one JSON
// line appended to `history.jsonl` before moving on. This means past
// weeks survive even though the per-week value files just sit there
// unaggregated — history.jsonl is the durable record.

export const command = `
mkdir -p "$HOME/.time-ledger"
DIR="$HOME/.time-ledger"
WEEK=$(date +%G-W%V)
TODAY_DOW=$(date +%u)
WEEKDATES=""
for off in 1 2 3 4 5 6 7; do
  DELTA=$((off - TODAY_DOW))
  if [ $DELTA -ge 0 ]; then
    D=$(date -v+\${DELTA}d +%Y-%m-%d)
  else
    D=$(date -v\${DELTA}d +%Y-%m-%d)
  fi
  WEEKDATES="$WEEKDATES $D"
done
MARKER="$DIR/.current-week"
PREV=$(cat "$MARKER" 2>/dev/null)

if [ -n "$PREV" ] && [ "$PREV" != "$WEEK" ]; then
  ENTRY='{"week":"'"$PREV"'","archived_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","vals":{'
  first=1
  for cat in workout projects gamedev Work_hours; do
    f="$DIR/$PREV.$cat"
    v=$(cat "$f" 2>/dev/null)
    if [ -z "$v" ]; then v=0; fi
    gf="$DIR/goal.$cat"
    g=$(cat "$gf" 2>/dev/null)
    if [ $first -eq 0 ]; then ENTRY="$ENTRY,"; fi
    ENTRY="$ENTRY\\"$cat\\":{\\"v\\":$v,\\"g\\":\\"$g\\"}"
    first=0
  done
  ENTRY="$ENTRY}}"
  printf '%s\\n' "$ENTRY" >> "$DIR/history.jsonl"
  find "$DIR" -maxdepth 1 -name "day.*" -mtime +35 -delete 2>/dev/null
fi
echo "$WEEK" > "$MARKER"

HIST=$(tail -n 8 "$DIR/history.jsonl" 2>/dev/null | paste -sd, -)

printf '{"week":"%s","vals":{' "$WEEK"
first=1
for cat in workout projects gamedev Work_hours; do
  f="$DIR/$WEEK.$cat"
  v=$(cat "$f" 2>/dev/null)
  if [ -z "$v" ]; then v=0; fi
  gf="$DIR/goal.$cat"
  g=$(cat "$gf" 2>/dev/null)
  DAYS=""
  di=0
  for D in $WEEKDATES; do
    dv=$(cat "$DIR/day.$D.$cat" 2>/dev/null)
    if [ -z "$dv" ]; then dv=0; fi
    if [ $di -gt 0 ]; then DAYS="$DAYS,"; fi
    DAYS="$DAYS$dv"
    di=$((di+1))
  done
  if [ $first -eq 0 ]; then printf ','; fi
  printf '"%s":{"v":%s,"g":"%s","d":"%s"}' "$cat" "$v" "$g" "$DAYS"
  first=0
done
printf '},"history":[%s]}' "$HIST"
`;
export const refreshFrequency = 2000;

export const className = `
  top: 20px;
  left: 700px;
  width: 700px;
  font-family: 'VT323', monospace;
  z-index: 1;
`;

// Same ctOS-profiler HUD language as the other three widgets: clipped
// panel, scan sweep, circuit grid, VT323. Cyan/yellow stay the primary
// duotone; orange and magenta are added here only to keep the four
// gauges visually distinguishable, same role the original navy/green/
// purple/teal set played.

const CATS = [
  {
    id: "workout",
    name: "WORKOUT",
    color: "#5ff0ff",
    unit: "days",
    noun: "workout",
  },
  {
    id: "projects",
    name: "PROJECTS",
    color: "#e8b84d",
    unit: "hours",
  },
  {
    id: "gamedev",
    name: "GAME_DEV",
    color: "#ff9d5c",
    unit: "hours",
  },
  { id: "Work_hours", name: "WORK HOURS", color: "#c78fe8", unit: "hours" },
];
const DEFAULT_GOALS = {
  workout: 5,
  projects: 10,
  gamedev: 8,
  Work_hours: 35,
};

// Category names and gauges read as the same yellow used for titles
// elsewhere, rather than each category's own color, so they stand out
// against the dark teal panel instead of blending in. Per-category
// colors are still kept on CATS and used in the collapsed history strip,
// where they're the only way to tell the rows apart at a glance.
const GAUGE_YELLOW = "#e8b84d";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

  .tl-root{
    --cyan: #5ff0ff;
    --yellow: #e8b84d;
    --red: #ff5f72;
    --dim: #6b8291;
    --panel: #0a1118;
    --line: rgba(232,184,77,0.18);

    position: relative;
    background: var(--panel);
    color: #cdeeea;
    padding: 16px;
    box-sizing: border-box;
    clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
    border: 1px solid var(--line);
    overflow: hidden;
    font-family: 'VT323', monospace;
    zoom: 1.25;
  }

  .tl-root::before{
    content: "";
    position: absolute; inset: 0;
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: 0.12;
    pointer-events: none;
  }

  .tl-root::after{
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(0deg, rgba(232,184,77,0.05) 0px, rgba(232,184,77,0.05) 1px, transparent 1px, transparent 4px);
    pointer-events: none;
  }

  .tl-head{
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  .tl-title{
    font-weight: 400;
    font-size: 26px;
    letter-spacing: 0.04em;
    color: var(--yellow);
    text-shadow: 0 0 6px rgba(232,184,77,0.45);
  }
  .tl-id{ font-size: 14px; color: var(--dim); letter-spacing: 0.05em; }
  .tl-head-right{ display: flex; align-items: baseline; gap: 12px; }
  .tl-week-stat{ font-size: 15px; letter-spacing: 0.04em; }
  .tl-eyebrow{
    position: relative; z-index: 1;
    font-size: 15px; letter-spacing: 0.06em; color: var(--dim); text-transform: uppercase;
    margin-bottom: 10px;
  }

  .tl-grid{ position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }

  .tl-card{
    position: relative;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--line);
    padding: 9px;
    min-width: 0;
    box-sizing: border-box;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }
  .tl-card-head{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .tl-card-title{ font-size: 15px; font-weight: 400; letter-spacing: 0.03em; }
  .tl-card-goal{ font-size: 13px; color: var(--dim); display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
  .tl-goal-edit{
    background: rgba(0,0,0,0.4); border: 1px solid var(--line); color: var(--yellow);
    font-family: inherit; font-size: 14px; width: 38px; padding: 2px 3px;
  }
  .tl-tag{
    font-size: 13px;
    letter-spacing: 0.04em;
    padding: 0 8px 1px;
    border: 1px solid currentColor;
    clip-path: polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px);
  }
  .tl-tag-onpace{ color: var(--cyan); }
  .tl-tag-behind{ color: var(--red); }
  .tl-tag-complete{ color: var(--yellow); text-shadow: 0 0 6px rgba(232,184,77,0.5); }

  .tl-card-lastwk{ font-size: 11px; color: var(--dim); letter-spacing: 0.04em; margin-top: 2px; }

  .tl-gauge-wrap{ display: flex; justify-content: center; margin: 1px 0 3px; }

  .tl-daily-strip{ display: flex; gap: 2px; justify-content: center; margin: 0 0 1px; }
  .tl-daily-seg{ flex: 1; max-width: 16px; height: 5px; background: rgba(232,184,77,0.08); border: 1px solid var(--line); }
  .tl-daily-seg.filled{ background: var(--yellow); border-color: var(--yellow); }
  .tl-daily-seg.today{ box-shadow: 0 0 0 1px var(--cyan) inset; }
  .tl-daily-labels{ display: flex; gap: 2px; justify-content: center; margin-bottom: 5px; }
  .tl-daily-labels span{ flex: 1; max-width: 16px; text-align: center; font-size: 9px; line-height: 1; color: var(--dim); }
  .tl-daily-labels span.today{ color: var(--cyan); }

  .tl-quick-row{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px; margin-bottom: 5px; }
  .tl-qbtn{
    background: rgba(232,184,77,0.05); border: 1px solid var(--line); color: var(--cyan);
    font-family: inherit; font-size: 14px; padding: 1px 7px; cursor: pointer; text-align: center;
    clip-path: polygon(4px 0, 100% 0, 100% 100%, 0 100%, 0 4px);
  }
  .tl-qbtn:hover{ border-color: var(--yellow); color: var(--yellow); }
  .tl-qbtn.minus{ opacity: 0.55; }
  .tl-custom-row{ display: flex; gap: 5px; }
  .tl-custom-row input{
    flex: 1; background: rgba(0,0,0,0.4); border: 1px solid var(--line); color: var(--yellow);
    font-family: inherit; font-size: 14px; padding: 2px 5px; min-width: 0;
  }
  .tl-custom-row button{
    background: rgba(232,184,77,0.05); border: 1px solid var(--line); color: var(--cyan);
    font-family: inherit; font-size: 14px; padding: 2px 8px; cursor: pointer;
    clip-path: polygon(4px 0, 100% 0, 100% 100%, 0 100%, 0 4px);
  }
  .tl-custom-row button:hover{ border-color: var(--yellow); color: var(--yellow); }

  .tl-history{ position: relative; z-index: 1; margin-top: 8px; }
  .tl-history-checkbox{ display: none; }
  .tl-history-label{ font-size: 15px; color: var(--dim); cursor: pointer; letter-spacing: 0.05em; }
  .tl-history-label:hover{ color: var(--yellow); }
  .tl-history-panel{ display: none; margin-top: 6px; max-height: 120px; overflow-y: auto; border-top: 1px solid var(--line); padding-top: 6px; }
  .tl-history-checkbox:checked ~ .tl-history-panel{ display: block; }
  .tl-history-row{ display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 13px; padding: 3px 0; border-bottom: 1px dashed rgba(232,184,77,0.1); flex-wrap: wrap; }
  .tl-history-week{ color: var(--yellow); flex-shrink: 0; }
  .tl-history-vals{ display: flex; gap: 10px; flex-wrap: wrap; }
  .tl-history-chip{ white-space: nowrap; }
`;

function weekLabel(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} \u2013 ${fmt(sunday)}`;
}

function fmtValue(val, cat) {
  if (cat.unit === "hours") {
    const rounded = Math.round(val * 100) / 100;
    return rounded % 1 === 0 ? `${rounded}h` : `${rounded.toFixed(1)}h`;
  }
  return `${Math.round(val)}`;
}

function makeTicks(cx, cy, rOuter, count, color) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const major = i % 3 === 0;
    const rInner = major ? rOuter - 6 : rOuter - 3;
    const x1 = cx + rInner * Math.cos(angle);
    const y1 = cy + rInner * Math.sin(angle);
    const x2 = cx + rOuter * Math.cos(angle);
    const y2 = cy + rOuter * Math.sin(angle);
    out += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-opacity="${major ? 0.6 : 0.35}" stroke-width="${major ? 1.4 : 0.8}" />`;
  }
  return out;
}

function goalLabel(cat, goal) {
  if (cat.unit === "hours") return `of ${fmtValue(goal, cat)} goal`;
  const noun = cat.noun || cat.name.toLowerCase();
  return `of ${Math.round(goal)} ${goal == 1 ? noun : noun + "s"}`;
}

function gaugeSvg(cat, val, goal) {
  const cx = 44,
    cy = 44,
    r = 31,
    sw = 5;
  const circumference = 2 * Math.PI * r;
  const frac = goal > 0 ? Math.min(val / goal, 1) : 0;
  const offset = circumference * (1 - frac);
  return `
  <svg width="88" height="88" viewBox="0 0 88 88">
    <g>${makeTicks(cx, cy, r + 10, 24, cat.color)}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${sw}" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cat.color}" stroke-opacity="0.2" stroke-width="${sw + 4}" stroke-linecap="round"
      stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cat.color}" stroke-width="${sw}" stroke-linecap="round"
      stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})" />
    <text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="19" font-weight="400" fill="#eafffb" font-family="'VT323', monospace">${fmtValue(val, cat)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="${cat.color}" fill-opacity="0.95" font-family="'VT323', monospace">${goalLabel(cat, goal)}</text>
  </svg>`;
}

function quickAdds(cat) {
  if (cat.unit === "hours")
    return [
      { l: "\u221215m", d: -0.25, minus: true },
      { l: "+15m", d: 0.25 },
      { l: "+30m", d: 0.5 },
      { l: "+1h", d: 1 },
    ];
  return [
    { l: "\u22121", d: -1, minus: true },
    { l: "+1", d: 1 },
    { l: "+3", d: 3 },
    { l: "+5", d: 5 },
  ];
}

function addDeltaCommand(catId, delta) {
  return `mkdir -p "$HOME/.time-ledger"
WEEK=$(date +%G-W%V)
TODAY=$(date +%Y-%m-%d)
F="$HOME/.time-ledger/$WEEK.${catId}"
V=$(cat "$F" 2>/dev/null)
if [ -z "$V" ]; then V=0; fi
NEW=$(awk -v v="$V" -v d="${delta}" 'BEGIN{r=v+d; if(r<0) r=0; printf "%.2f", r}')
echo "$NEW" > "$F"
DF="$HOME/.time-ledger/day.$TODAY.${catId}"
DV=$(cat "$DF" 2>/dev/null)
if [ -z "$DV" ]; then DV=0; fi
DNEW=$(awk -v v="$DV" -v d="${delta}" 'BEGIN{r=v+d; if(r<0) r=0; printf "%.2f", r}')
echo "$DNEW" > "$DF"`;
}

function setGoalCommand(catId, value) {
  return `mkdir -p "$HOME/.time-ledger"
echo "${value}" > "$HOME/.time-ledger/goal.${catId}"`;
}

function parseOutput(output) {
  let data = null;
  try {
    data = JSON.parse(output);
  } catch (e) {
    data = null;
  }
  if (!data || !data.vals) data = { vals: {} };
  const values = {};
  const goals = {};
  const daily = {};
  CATS.forEach((c) => {
    const entry = data.vals[c.id] || {};
    values[c.id] =
      typeof entry.v === "number" ? entry.v : parseFloat(entry.v) || 0;
    const gNum = parseFloat(entry.g);
    goals[c.id] = !isNaN(gNum) && gNum > 0 ? gNum : DEFAULT_GOALS[c.id];
    daily[c.id] =
      typeof entry.d === "string" && entry.d.length
        ? entry.d.split(",").map((n) => parseFloat(n) || 0)
        : [0, 0, 0, 0, 0, 0, 0];
  });
  const history = Array.isArray(data.history) ? data.history : [];
  return { values, goals, daily, history };
}

// Mon=1 .. Sun=7, matching the WEEKDATES ordering built in `command`.
function currentWeekday(d = new Date()) {
  return ((d.getDay() + 6) % 7) + 1;
}

// "behind" / "onpace" / "complete" relative to a linear pace through the
// week (goal met early always reads as complete, regardless of pace).
function paceStatus(pct, expectedPct) {
  if (pct >= 100) return "complete";
  if (pct + 10 < expectedPct) return "behind";
  return "onpace";
}

// % of goal hit in the most recently archived (fully completed) week,
// for the small "last wk" comparison line on each card.
function lastWeekPct(catId, history) {
  if (!history || history.length === 0) return null;
  const last = history[history.length - 1];
  const entry = last && last.vals && last.vals[catId];
  if (!entry) return null;
  const v = parseFloat(entry.v) || 0;
  const g = parseFloat(entry.g) || 0;
  if (g <= 0) return null;
  return Math.round((v / g) * 100);
}

function Card({ cat, values, goals, daily, history, weekday }) {
  const val = values[cat.id];
  const goal = goals[cat.id];
  const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
  const expectedPct = Math.round((weekday / 7) * 100);
  const status = paceStatus(pct, expectedPct);
  const lastPct = lastWeekPct(cat.id, history);
  const days = daily[cat.id] || [0, 0, 0, 0, 0, 0, 0];
  const todayIdx = weekday - 1;
  const inputId = `tl-custom-${cat.id}`;

  const logCustom = () => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const v = parseFloat(el.value);
    if (!isNaN(v) && v !== 0) {
      run(addDeltaCommand(cat.id, v));
      el.value = "";
    }
  };

  return (
    <div className="tl-card">
      <div className="tl-card-head">
        <div>
          <div className="tl-card-title" style={{ color: GAUGE_YELLOW }}>
            {cat.name}
          </div>
          <div className="tl-card-goal">
            goal:
            <input
              className="tl-goal-edit"
              type="number"
              step="1"
              min="0"
              defaultValue={goal}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) run(setGoalCommand(cat.id, v));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
              }}
            />
            {cat.unit === "hours" ? "h" : cat.noun || ""}
          </div>
          {lastPct !== null && (
            <div className="tl-card-lastwk">last wk: {lastPct}%</div>
          )}
        </div>
        <div className={`tl-tag tl-tag-${status}`}>{pct}%</div>
      </div>
      <div
        className="tl-gauge-wrap"
        dangerouslySetInnerHTML={{
          __html: gaugeSvg({ ...cat, color: GAUGE_YELLOW }, val, goal),
        }}
      />
      <div className="tl-daily-strip">
        {days.map((v, i) => (
          <div
            key={i}
            className={`tl-daily-seg${v > 0 ? " filled" : ""}${
              i === todayIdx ? " today" : ""
            }`}
          />
        ))}
      </div>
      <div className="tl-daily-labels">
        {WEEKDAY_LABELS.map((l, i) => (
          <span key={i} className={i === todayIdx ? "today" : ""}>
            {l}
          </span>
        ))}
      </div>
      <div className="tl-quick-row">
        {quickAdds(cat).map((q) => (
          <button
            key={q.l}
            className={`tl-qbtn${q.minus ? " minus" : ""}`}
            onClick={() => run(addDeltaCommand(cat.id, q.d))}
          >
            {q.l}
          </button>
        ))}
      </div>
      <div className="tl-custom-row">
        <input
          id={inputId}
          type="number"
          step={cat.unit === "hours" ? "0.25" : "1"}
          min="0"
          placeholder={cat.unit === "hours" ? "hrs" : cat.noun || "amt"}
          onKeyDown={(e) => {
            if (e.key === "Enter") logCustom();
          }}
        />
        <button onClick={logCustom}>Log</button>
      </div>
    </div>
  );
}

function HistoryStrip({ history }) {
  if (!history || history.length === 0) return null;
  const rows = [...history].reverse();
  return (
    <div className="tl-history">
      <input
        type="checkbox"
        id="tl-history-toggle"
        className="tl-history-checkbox"
      />
      <label htmlFor="tl-history-toggle" className="tl-history-label">
        [+] history ({history.length})
      </label>
      <div className="tl-history-panel">
        {rows.map((h, i) => (
          <div className="tl-history-row" key={h.week || i}>
            <span className="tl-history-week">{h.week}</span>
            <span className="tl-history-vals">
              {CATS.map((c) => {
                const entry = h.vals && h.vals[c.id];
                if (!entry) return null;
                return (
                  <span
                    key={c.id}
                    className="tl-history-chip"
                    style={{ color: c.color }}
                  >
                    {c.name}: {fmtValue(parseFloat(entry.v) || 0, c)}/{entry.g}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const render = ({ output }) => {
  const { values, goals, daily, history } = parseOutput(output || "");
  const weekday = currentWeekday();
  const expectedPct = Math.round((weekday / 7) * 100);
  const catPcts = CATS.map((c) => {
    const g = goals[c.id];
    const v = values[c.id];
    return g > 0 ? Math.min(Math.round((v / g) * 100), 100) : 0;
  });
  const avgPct = Math.round(
    catPcts.reduce((a, b) => a + b, 0) / catPcts.length
  );
  const avgStatus = paceStatus(avgPct, expectedPct);

  return (
    <div className="tl-root">
      <style>{STYLE}</style>
      <div className="tl-head">
        <span className="tl-title">TIME_LEDGER</span>
        <div className="tl-head-right">
          <span className={`tl-week-stat tl-tag-${avgStatus}`}>
            {avgPct}% wk
          </span>
          <span className="tl-id">0x7B3D</span>
        </div>
      </div>
      <div className="tl-eyebrow">
        // week of {weekLabel(new Date())} &middot; day {weekday}/7
      </div>
      <div className="tl-grid">
        {CATS.map((cat) => (
          <Card
            key={cat.id}
            cat={cat}
            values={values}
            goals={goals}
            daily={daily}
            history={history}
            weekday={weekday}
          />
        ))}
      </div>
      <HistoryStrip history={history} />
    </div>
  );
};
