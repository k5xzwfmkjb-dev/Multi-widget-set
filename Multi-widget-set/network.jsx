export const command = `
ssid=$(networksetup -getairportnetwork en0 2>/dev/null | awk -F': ' '{print $2}')
ip=$(ipconfig getifaddr en0 2>/dev/null)
ping=$(ping -c 1 -t 1 1.1.1.1 2>/dev/null | tail -1 | awk -F'/' '{print $5}')
if [ -z "$ip" ]; then status="OFFLINE"; else status="ONLINE"; fi
echo "\${status}|\${ssid:-N/A}|\${ip:-N/A}|\${ping:-N/A}"
`;

export const refreshFrequency = 5000;

export const className = `
  top: 20px;
  left: 400px;
  width: 280px;
  font-family: 'VT323', monospace;
  z-index: 10;
`;

// ctOS-profiler-style HUD: clipped-corner panel, scan sweep, bracketed
// status tags, cyan/yellow duotone. Same command + data contract as the
// original widget — only the render/style layer changed.

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

  .nw-root{
    --cyan: #5ff0ff;
    --yellow: #e8b84d;
    --red: #ff5f72;
    --dim: #6b8291;
    --bg: #060a0f;
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

  .nw-root::before{
    /* faint circuit-grid backdrop */
    content: "";
    position: absolute; inset: 0;
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: 0.15;
    pointer-events: none;
  }

  .nw-root::after{
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(0deg, rgba(232,184,77,0.05) 0px, rgba(232,184,77,0.05) 1px, transparent 1px, transparent 4px);
    pointer-events: none;
  }

  .nw-head{
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }

  .nw-title{
    font-weight: 400;
    font-size: 20px;
    letter-spacing: 0.04em;
    color: var(--yellow);
    text-shadow: 0 0 6px rgba(232,184,77,0.5);
  }

  .nw-id{
    font-size: 14px;
    color: var(--dim);
    letter-spacing: 0.05em;
  }

  .nw-row{
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    font-size: 16px;
    border-bottom: 1px dashed rgba(232,184,77,0.1);
  }
  .nw-row:last-of-type{ border-bottom: none; }

  .nw-key{
    color: var(--dim);
    letter-spacing: 0.06em;
  }

  .nw-val{
    color: #dff7f4;
    letter-spacing: 0.02em;
  }

  .nw-tag{
    font-weight: 400;
    font-size: 15px;
    letter-spacing: 0.06em;
    padding: 0px 10px 2px;
    border: 1px solid currentColor;
    clip-path: polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px);
  }
  .nw-tag.on{ color: var(--cyan); text-shadow: 0 0 6px rgba(95,240,255,0.6); }
  .nw-tag.off{ color: var(--red); text-shadow: 0 0 6px rgba(255,95,114,0.6); }

  .nw-dot{
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    margin-right: 6px;
  }
  .nw-dot.on{ background: var(--cyan); box-shadow: 0 0 6px var(--cyan); }
  .nw-dot.off{ background: var(--red); box-shadow: 0 0 6px var(--red); }

  .nw-foot{
    margin-top: 10px;
    font-size: 13px;
    color: var(--dim);
    letter-spacing: 0.08em;
    text-align: right;
  }
`;

export const render = ({ output }) => {
  const [status, ssid, ip, ping] = (output || "").trim().split("|");
  const online = status === "ONLINE";

  return (
    <div className="nw-root">
      <style>{STYLE}</style>
      <div className="nw-head">
        <span className="nw-title">NET_UPLINK</span>
        <span className="nw-id">0x4F2A</span>
      </div>

      <div className="nw-row">
        <span className="nw-key">
          <span className={`nw-dot ${online ? "on" : "off"}`} />
          status
        </span>
        <span className={`nw-tag ${online ? "on" : "off"}`}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      <div className="nw-row">
        <span className="nw-key">ssid</span>
        <span className="nw-val">{ssid || "N/A"}</span>
      </div>
      <div className="nw-row">
        <span className="nw-key">ip</span>
        <span className="nw-val">{ip || "N/A"}</span>
      </div>
      <div className="nw-row">
        <span className="nw-key">latency</span>
        <span className="nw-val">{ping || "N/A"} ms</span>
      </div>

      <div className="nw-foot">ctOS // node linked</div>
    </div>
  );
};
