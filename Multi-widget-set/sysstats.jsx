export const command = `
cpu=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | tr -d '%')
mem=$(vm_stat | awk '
  /Pages free/ {free=$3}
  /Pages active/ {active=$3}
  /Pages inactive/ {inactive=$3}
  /Pages wired/ {wired=$4}
  /Pages occupied/ {comp=$5}
  END {
    gsub(/\\./,"",free); gsub(/\\./,"",active); gsub(/\\./,"",inactive); gsub(/\\./,"",wired);
    used=(active+wired)*4096/1048576
    total=(active+inactive+free+wired)*4096/1048576
    printf "%.0f|%.0f", used, total
  }')
disk=$(df -h / | tail -1 | awk '{print $5"|"$3"|"$2}')
batt=$(pmset -g batt | grep -Eo "\\d+%" | tr -d '%')
echo "\${cpu}|\${mem}|\${disk}|\${batt}"
`;

export const refreshFrequency = 5000;

export const className = `
  top: 20px;
  left: 90px;
  width: 300px;
  font-family: 'VT323', monospace;
  z-index: 10;
`;

// Same ctOS-profiler HUD language as network.jsx: clipped-corner panel,
// scan sweep, circuit grid, cyan/yellow duotone, VT323. Bars became
// segmented HUD meters instead of the win98 diagonal stripe fill.

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

  .ss-root{
    --cyan: #5ff0ff;
    --green: #5fd68a;
    --yellow: #e8b84d;
    --red: #ff5f72;
    --dim: #6b8291;
    --panel: #0a1118;
    --line: rgba(232,184,77,0.18);

    position: relative;
    width: 100%;
    background: var(--panel);
    color: #cdeeea;
    padding: 14px 16px 12px;
    box-sizing: border-box;
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .ss-root::before{
    content: "";
    position: absolute; inset: 0;
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: 0.15;
    pointer-events: none;
  }

  .ss-root::after{
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(0deg, rgba(232,184,77,0.05) 0px, rgba(232,184,77,0.05) 1px, transparent 1px, transparent 4px);
    pointer-events: none;
  }

  .ss-head{
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }

  .ss-title{
    font-weight: 400;
    font-size: 20px;
    letter-spacing: 0.04em;
    color: var(--yellow);
    text-shadow: 0 0 6px rgba(232,184,77,0.5);
  }

  .ss-id{
    font-size: 14px;
    color: var(--dim);
    letter-spacing: 0.05em;
  }

  .ss-meter{
    position: relative;
    margin-bottom: 10px;
  }
  .ss-meter:last-of-type{ margin-bottom: 0; }

  .ss-meter-label{
    display: flex;
    justify-content: space-between;
    font-size: 16px;
    color: var(--dim);
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .ss-meter-label > span:last-child{
    color: #dff7f4;
  }

  .ss-bar-outer{
    height: 14px;
    background: rgba(232,184,77,0.06);
    border: 1px solid var(--line);
    padding: 2px;
    display: flex;
    gap: 2px;
  }

  .ss-bar-seg{
    flex: 1 0 6px;
    background: rgba(232,184,77,0.08);
  }
  .ss-bar-seg.fill{
    background: var(--green);
  }
  .ss-bar-seg.fill.warn{
    background: var(--yellow);
  }
  .ss-bar-seg.fill.hot{
    background: var(--red);
  }

  .ss-foot{
    margin-top: 12px;
    font-size: 13px;
    color: var(--dim);
    letter-spacing: 0.08em;
    text-align: right;
  }
`;

const SEGMENTS = 24;

// Two color modes. "load" is for anything where a high number is the bad
// state (cpu, disk): green low, yellow mid, red high. "charge" is for
// anything where a LOW number is the bad state (battery): the scale is
// flipped so it goes red as the value drops, not as it climbs.
// Thresholds are per-metric because "getting high" doesn't mean the same
// thing for cpu (spikes are normal) as it does for ram (a sustained 60%+
// on unified memory is worth a glance).
function segmentClass(pct, i, { warn = 70, hot = 90, mode = "load" } = {}) {
  const filled = i < Math.round((pct / 100) * SEGMENTS);
  if (!filled) return "ss-bar-seg";
  if (mode === "charge") {
    if (pct <= hot) return "ss-bar-seg fill hot";
    if (pct <= warn) return "ss-bar-seg fill warn";
    return "ss-bar-seg fill";
  }
  if (pct >= hot) return "ss-bar-seg fill hot";
  if (pct >= warn) return "ss-bar-seg fill warn";
  return "ss-bar-seg fill";
}

function Meter({ label, value, pct, thresholds }) {
  return (
    <div className="ss-meter">
      <div className="ss-meter-label">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="ss-bar-outer">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div key={i} className={segmentClass(pct, i, thresholds)} />
        ))}
      </div>
    </div>
  );
}

export const render = ({ output }) => {
  const parts = (output || "").trim().split("|");
  const cpu = parseFloat(parts[0]) || 0;
  const memUsed = parts[1] || "?";
  const memTotal = parts[2] || "?";
  const diskPct = parts[3] || "0%";
  const diskUsed = parts[4] || "?";
  const diskTotal = parts[5] || "?";
  const batt = parts[6] || "?";

  const memPct = (memUsed / memTotal) * 100 || 0;
  const diskPctNum = parseFloat(diskPct) || 0;
  const battPct = parseFloat(batt) || 0;

  return (
    <div className="ss-root">
      <style>{STYLE}</style>
      <div className="ss-head">
        <span className="ss-title">SYS_MONITOR</span>
        <span className="ss-id">0x91C7</span>
      </div>

      <Meter label="cpu" value={`${cpu}%`} pct={cpu} />
      <Meter
        label="ram"
        value={`${memUsed} / ${memTotal} MB`}
        pct={memPct}
        thresholds={{ warn: 50, hot: 85 }}
      />
      <Meter
        label="disk"
        value={`${diskUsed} / ${diskTotal}`}
        pct={diskPctNum}
      />
      <Meter
        label="battery"
        value={`${batt}%`}
        pct={battPct}
        thresholds={{ mode: "charge", warn: 50, hot: 20 }}
      />

      <div className="ss-foot">ctOS // device profile</div>
    </div>
  );
};
