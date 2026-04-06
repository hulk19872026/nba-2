import { useState, useEffect, useRef, useCallback } from "react";

const injectFonts = () => {
  if (document.getElementById("nba-fonts")) return;
  const link = document.createElement("link");
  link.id = "nba-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes typingDot { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
    .msg-enter { animation: fadeIn 0.25s ease-out; }
    .dot-pulse { animation: pulse 1.8s ease-in-out infinite; }
    ::-webkit-scrollbar { width: 4px; } 
    ::-webkit-scrollbar-track { background: #0a101f; }
    ::-webkit-scrollbar-thumb { background: #1e2d48; border-radius:2px; }
    .game-card:hover { border-color: #F5A623 !important; background: #0f1826 !important; }
    .odds-btn:hover { opacity: 0.85; transform: scale(1.02); }
    .send-btn:hover:not(:disabled) { background: #d4921e !important; }
    .tab-btn:hover { background: #141e33 !important; }
    .suggestion-btn:hover { border-color: #F5A623 !important; color: #F5A623 !important; }
  `;
  document.head.appendChild(style);
};

// ════════════════════════════════════════════════
// AGENT SYSTEM
// ════════════════════════════════════════════════

// ANALYTICS AGENT — win probability model
const AnalyticsAgent = {
  name: "AnalyticsAgent",
  calcProb(home, away) {
    const homeWR = home.wins / Math.max(1, home.wins + home.losses);
    const awayWR = away.wins / Math.max(1, away.wins + away.losses);
    const homeNetRtg = home.ppg - home.oppPpg;
    const awayNetRtg = away.ppg - away.oppPpg;
    const homeAdv = 0.035;
    const netFactor = (homeNetRtg - awayNetRtg) / 25;
    const raw = homeWR + homeAdv + netFactor * 0.4;
    const total = raw + awayWR;
    return Math.max(0.1, Math.min(0.9, raw / total));
  },
  toAmerican(prob) {
    if (prob >= 0.5) return Math.round((-prob / (1 - prob)) * 100);
    return Math.round(((1 - prob) / prob) * 100);
  },
  toDecimal(american) {
    return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
  },
};

// DATA AGENT — NBA team & game data
const DataAgent = {
  name: "DataAgent",
  teams: {
    "Boston Celtics":         { abbr:"BOS", wins:54, losses:18, ppg:120.6, oppPpg:109.4 },
    "Oklahoma City Thunder":  { abbr:"OKC", wins:58, losses:14, ppg:119.2, oppPpg:108.5 },
    "Cleveland Cavaliers":    { abbr:"CLE", wins:55, losses:17, ppg:117.8, oppPpg:107.2 },
    "Houston Rockets":        { abbr:"HOU", wins:45, losses:27, ppg:112.4, oppPpg:108.9 },
    "Minnesota Timberwolves": { abbr:"MIN", wins:49, losses:23, ppg:112.3, oppPpg:107.8 },
    "Denver Nuggets":         { abbr:"DEN", wins:44, losses:28, ppg:115.9, oppPpg:113.4 },
    "New York Knicks":        { abbr:"NYK", wins:43, losses:29, ppg:114.7, oppPpg:111.3 },
    "Los Angeles Lakers":     { abbr:"LAL", wins:41, losses:31, ppg:113.2, oppPpg:113.0 },
    "Indiana Pacers":         { abbr:"IND", wins:39, losses:33, ppg:122.8, oppPpg:121.6 },
    "Dallas Mavericks":       { abbr:"DAL", wins:38, losses:34, ppg:116.2, oppPpg:115.4 },
    "Miami Heat":             { abbr:"MIA", wins:38, losses:34, ppg:111.5, oppPpg:112.8 },
    "Orlando Magic":          { abbr:"ORL", wins:38, losses:34, ppg:108.6, oppPpg:107.4 },
    "Golden State Warriors":  { abbr:"GSW", wins:36, losses:36, ppg:115.4, oppPpg:114.8 },
    "Los Angeles Clippers":   { abbr:"LAC", wins:37, losses:35, ppg:112.4, oppPpg:113.2 },
    "Sacramento Kings":       { abbr:"SAC", wins:35, losses:37, ppg:116.8, oppPpg:118.2 },
    "Milwaukee Bucks":        { abbr:"MIL", wins:36, losses:36, ppg:114.1, oppPpg:115.9 },
    "Phoenix Suns":           { abbr:"PHX", wins:30, losses:42, ppg:113.7, oppPpg:117.4 },
    "Atlanta Hawks":          { abbr:"ATL", wins:27, losses:45, ppg:117.4, oppPpg:120.3 },
    "Memphis Grizzlies":      { abbr:"MEM", wins:28, losses:44, ppg:110.3, oppPpg:115.6 },
    "Philadelphia 76ers":     { abbr:"PHI", wins:24, losses:48, ppg:107.8, oppPpg:114.2 },
  },

  buildGames() {
    const matchups = [
      ["New York Knicks",        "Boston Celtics"],
      ["Oklahoma City Thunder",  "Denver Nuggets"],
      ["Los Angeles Lakers",     "Golden State Warriors"],
      ["Minnesota Timberwolves", "Houston Rockets"],
      ["Cleveland Cavaliers",    "Indiana Pacers"],
      ["Dallas Mavericks",       "Phoenix Suns"],
      ["Miami Heat",             "Orlando Magic"],
      ["Milwaukee Bucks",        "Philadelphia 76ers"],
    ];
    const times = ["7:00 PM ET","7:30 PM ET","8:00 PM ET","8:00 PM ET","7:30 PM ET","9:00 PM ET","7:00 PM ET","8:00 PM ET"];
    const today = new Date();

    return matchups.map(([home, away], i) => {
      const h = this.teams[home];
      const a = this.teams[away];
      const homeProb = AnalyticsAgent.calcProb(h, a);
      const awayProb = 1 - homeProb;
      const hOdds = AnalyticsAgent.toAmerican(homeProb);
      const aOdds = AnalyticsAgent.toAmerican(awayProb);
      const netDiff = (h.ppg - h.oppPpg) - (a.ppg - a.oppPpg);
      const spread = -(netDiff / 2 + 1.5);
      const total = Math.round((h.ppg + a.ppg + h.oppPpg + a.oppPpg) / 2);
      const d = new Date(today);
      d.setDate(today.getDate() + Math.floor(i / 4));

      return {
        id: i + 1,
        home, away,
        homeAbbr: h.abbr, awayAbbr: a.abbr,
        homeRecord: `${h.wins}-${h.losses}`, awayRecord: `${a.wins}-${a.losses}`,
        date: d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}),
        time: times[i],
        homeProb: Math.round(homeProb * 100),
        awayProb: Math.round(awayProb * 100),
        homeOdds: hOdds > 0 ? `+${hOdds}` : `${hOdds}`, homeOddsRaw: hOdds,
        awayOdds: aOdds > 0 ? `+${aOdds}` : `${aOdds}`, awayOddsRaw: aOdds,
        spread: spread > 0 ? `+${spread.toFixed(1)}` : `${spread.toFixed(1)}`,
        total, homePpg: h.ppg, awayPpg: a.ppg,
      };
    });
  },

  async searchPlayer(name) {
    const r = await fetch(`/api/players?search=${encodeURIComponent(name)}`);
    const d = await r.json();
    return d.data || [];
  },

  async getStats(playerId) {
    const r = await fetch(`/api/season_averages?player_id=${playerId}`);
    const d = await r.json();
    return d.data[0] || null;
  },
};

// PARLAY AGENT — multi-game odds computation
const ParlayAgent = {
  name: "ParlayAgent",
  calc(selections) {
    if (selections.length < 2) return null;
    const dec = selections.map(s => AnalyticsAgent.toDecimal(s.oddsRaw));
    const combined = dec.reduce((a, b) => a * b, 1);
    const combinedProb = selections.reduce((a, s) => a * (s.prob / 100), 1);
    const american = combined >= 2
      ? `+${Math.round((combined - 1) * 100)}`
      : `-${Math.round(100 / (combined - 1))}`;
    return {
      legs: selections.length,
      decimal: combined.toFixed(2),
      american,
      impliedProb: (combinedProb * 100).toFixed(1),
      payout100: (combined * 100).toFixed(2),
      ev: ((combinedProb * combined - 1) * 100).toFixed(1),
    };
  },
};

// INTERFACE AGENT — Claude-powered orchestrator
const InterfaceAgent = {
  name: "InterfaceAgent",
  async query(userMsg, games, parlayState, extraContext) {
    const systemPrompt = `You are NBA Analytics AI, a unified assistant backed by 4 specialized sub-agents:
- DataAgent: fetches live player stats from balldontlie.io + generates probabilistic game odds
- AnalyticsAgent: logistic regression model using win%, net rating, home-court advantage (3.5%)
- ParlayAgent: computes combined American/decimal odds and expected value
- InterfaceAgent: you — the synthesizing interface

LIVE DATA:
UPCOMING GAMES:
${games.map(g => `${g.awayAbbr} @ ${g.homeAbbr} | ${g.date} ${g.time} | Home ML: ${g.homeOdds} (${g.homeProb}%) Away ML: ${g.awayOdds} (${g.awayProb}%) | Spread: ${g.spread} | O/U: ${g.total} | Records: ${g.awayRecord} vs ${g.homeRecord}`).join("\n")}

${parlayState.selections.length > 0 ? `ACTIVE PARLAY (${parlayState.selections.length} legs):\n${parlayState.selections.map(s=>`- ${s.pick} ${s.odds} (${s.prob}%)`).join("\n")}${parlayState.result ? `\nCombined odds: ${parlayState.result.american} | Implied prob: ${parlayState.result.impliedProb}% | $100 pays: $${parlayState.result.payout100}` : ""}` : "No parlay active."}

${extraContext || ""}

Instructions: Be direct and data-driven. Use the exact numbers from the live data. Format nicely using line breaks. For probabilities mention the model uses net rating + win% + home advantage. Keep responses under 220 words. If asked about parlay additions, tell user to click + next to odds. Don't hallucinate stats not in context.`;

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await resp.json();
    return data.content?.[0]?.text || "Unable to process. Please try again.";
  },
};

// ════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════

const C = {
  bg: "#070D1A", panel: "#0C1424", card: "#0F1B2D",
  border: "#1A2B44", accent: "#F5A623", accentDim: "#8A5A0F",
  green: "#00C853", red: "#FF4444", blue: "#3B9EFF",
  text: "#E8ECF0", muted: "#6B7FA3", dim: "#3D4F6B",
};

function AgentBadge({ name, color = C.accent }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11,
      fontFamily:"'Barlow Condensed',sans-serif", color:C.muted, letterSpacing:"0.5px" }}>
      <span className="dot-pulse" style={{ width:6, height:6, borderRadius:"50%",
        background:color, display:"inline-block" }} />
      {name}
    </span>
  );
}

function ProbBar({ homeProb, awayProb, homeAbbr, awayAbbr }) {
  return (
    <div style={{ margin:"6px 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10,
        color:C.muted, fontFamily:"'Barlow Condensed',sans-serif", marginBottom:3 }}>
        <span>{homeAbbr} {homeProb}%</span>
        <span>{awayProb}% {awayAbbr}</span>
      </div>
      <div style={{ height:4, background:C.border, borderRadius:2, overflow:"hidden", display:"flex" }}>
        <div style={{ width:`${homeProb}%`, background: homeProb > 55 ? C.green : C.accent,
          borderRadius:"2px 0 0 2px", transition:"width 0.6s ease" }} />
        <div style={{ flex:1, background: awayProb > 55 ? C.green : C.red, borderRadius:"0 2px 2px 0" }} />
      </div>
    </div>
  );
}

function GameCard({ game, parlaySelections, onToggle }) {
  const homeSelected = parlaySelections.find(s => s.gameId === game.id && s.side === "home");
  const awaySelected = parlaySelections.find(s => s.gameId === game.id && s.side === "away");
  const anySelected = homeSelected || awaySelected;

  return (
    <div className="game-card" style={{ background: anySelected ? "#101c30" : C.card,
      border: `1px solid ${anySelected ? C.accent : C.border}`, borderRadius:8,
      padding:"10px 12px", marginBottom:8, transition:"all 0.2s", cursor:"default" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
          letterSpacing:"0.5px" }}>{game.date} · {game.time}</span>
        <span style={{ fontSize:10, background:"#1A2B44", color:C.muted, padding:"1px 6px",
          borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif" }}>
          O/U {game.total}
        </span>
      </div>

      {/* Matchup row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        {/* Away team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", flex:1 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
            lineHeight:1 }}>{game.awayAbbr}</span>
          <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {game.awayRecord}
          </span>
        </div>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, color:C.dim,
          fontWeight:600 }}>@</span>
        {/* Home team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flex:1 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
            lineHeight:1 }}>{game.homeAbbr}</span>
          <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {game.homeRecord}
          </span>
        </div>
      </div>

      <ProbBar homeProb={game.homeProb} awayProb={game.awayProb}
        homeAbbr={game.homeAbbr} awayAbbr={game.awayAbbr} />

      {/* Odds row */}
      <div style={{ display:"flex", gap:4, marginTop:6 }}>
        {[
          { side:"away", label:`${game.awayAbbr} ML`, odds:game.awayOdds, selected:!!awaySelected },
          { side:"home", label:`${game.homeAbbr} ML`, odds:game.homeOdds, selected:!!homeSelected },
        ].map(({ side, label, odds, selected }) => (
          <button key={side} className="odds-btn" onClick={() => onToggle(game, side)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              background: selected ? C.accent : "#131f35", border:`1px solid ${selected ? C.accent : C.border}`,
              borderRadius:5, padding:"4px 0", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:9, color: selected ? "#000" : C.muted,
              fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.3px" }}>{label}</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
              color: selected ? "#000" : (odds.startsWith("+") ? C.green : C.text) }}>{odds}</span>
          </button>
        ))}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
          background:"#131f35", border:`1px solid ${C.border}`, borderRadius:5, padding:"4px 6px" }}>
          <span style={{ fontSize:9, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>SPRD</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.muted }}>
            {game.spread}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:12, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>{label}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
        color: highlight ? C.accent : C.text }}>{value}</span>
    </div>
  );
}

function PlayerCard({ stats }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14,
      animation:"fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.text,
          letterSpacing:"1px" }}>{stats.name}</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, color:C.accent }}>
          {stats.team} · {stats.position}
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:C.muted }}>
          {stats.games} GP · {stats.minutes} MIN
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
        {[["PTS",stats.pts,true],["REB",stats.reb,false],["AST",stats.ast,false]].map(([l,v,h]) => (
          <div key={l} style={{ background:C.panel, borderRadius:6, padding:"8px 0", textAlign:"center" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600,
              color: h ? C.accent : C.text }}>{v}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, color:C.muted }}>{l}</div>
          </div>
        ))}
      </div>
      <StatRow label="FG%" value={stats.fg} />
      <StatRow label="3P%" value={stats.fg3} />
      <StatRow label="FT%" value={stats.ft} />
      <StatRow label="STL" value={stats.stl} />
      <StatRow label="BLK" value={stats.blk} />
    </div>
  );
}

function ParlayPanel({ selections, result, onRemove }) {
  return (
    <div style={{ padding:"0 2px" }}>
      {selections.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", color:C.muted, fontSize:14 }}>
            Click + on any odds to add legs
          </div>
        </div>
      ) : (
        <>
          {selections.map((s, i) => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", background:C.card, border:`1px solid ${C.border}`,
              borderRadius:6, padding:"8px 10px", marginBottom:6 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600,
                  fontSize:14, color:C.text }}>Leg {i+1}: {s.pick}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  color: s.odds.startsWith("+") ? C.green : C.text }}>{s.odds}</div>
              </div>
              <button onClick={() => onRemove(s.id)} style={{ background:"transparent",
                border:"none", color:C.red, cursor:"pointer", fontSize:16, padding:"0 4px" }}>×</button>
            </div>
          ))}

          {result && (
            <div style={{ background:"linear-gradient(135deg, #13200F 0%, #0C1A08 100%)",
              border:`1px solid ${C.green}`, borderRadius:8, padding:14, marginTop:8 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:C.green,
                letterSpacing:"1px", marginBottom:8 }}>{result.legs}-LEG PARLAY</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, color:C.muted }}>
                  American Odds
                </span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600,
                  color:C.green }}>{result.american}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[
                  ["Decimal", result.decimal + "x"],
                  ["Implied Prob", result.impliedProb + "%"],
                  ["$100 → $" + result.payout100, "Payout"],
                  ["Model EV", (parseFloat(result.ev) >= 0 ? "+" : "") + result.ev + "%"],
                ].map(([a,b]) => (
                  <div key={a} style={{ background:C.panel, borderRadius:5, padding:"6px 8px" }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                      color:C.green, fontWeight:600 }}>{a}</div>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                      color:C.muted }}>{b}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, padding:"6px 8px", background:"rgba(255,68,68,0.08)",
                border:`1px solid rgba(255,68,68,0.2)`, borderRadius:5 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                  color:"#FF8080" }}>⚠ Model probabilities are estimates. Bet responsibly.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display:"flex", gap:4, padding:"8px 12px", alignItems:"center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.accent,
          display:"inline-block",
          animation:`typingDot 1.2s ease-in-out infinite`,
          animationDelay:`${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  const lines = msg.content.split("\n");

  return (
    <div className="msg-enter" style={{ display:"flex", flexDirection:"column",
      alignItems: isUser ? "flex-end" : "flex-start", marginBottom:12 }}>
      {!isUser && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <div style={{ width:20, height:20, borderRadius:4, background:C.accent,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:700, color:"#000", fontFamily:"'Bebas Neue',sans-serif" }}>AI</div>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
            color:C.muted, letterSpacing:"0.5px" }}>NBA ANALYTICS AI</span>
        </div>
      )}
      <div style={{ maxWidth:"88%", background: isUser ? C.accent : C.card,
        border: isUser ? "none" : `1px solid ${C.border}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
        padding:"10px 14px" }}>
        {lines.map((line, i) => {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} style={{ margin: i === 0 ? 0 : "4px 0 0",
              fontFamily:"'Barlow Condensed',sans-serif", fontSize:15,
              lineHeight:1.5, color: isUser ? "#000" : C.text }}>
              {parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j} style={{ color: isUser ? "#000" : C.accent, fontWeight:700 }}>
                      {part.slice(2,-2)}
                    </strong>
                  : <span key={j}>{part}</span>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════
export default function NBAAnalyticsApp() {
  useEffect(() => { injectFonts(); }, []);

  const [games] = useState(() => DataAgent.buildGames());
  const [tab, setTab] = useState("games");
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "**NBA Analytics AI online.** I run on 4 cooperative sub-agents:\n\n**DataAgent** — live stats via balldontlie.io + probabilistic odds\n**AnalyticsAgent** — net rating + win% + home-court logistic model\n**ParlayAgent** — combined legs with EV calculation\n**InterfaceAgent** — that's me, synthesizing everything\n\nAsk me about player stats, game odds, win probabilities, or build a parlay using the games panel!"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parlaySelections, setParlaySelections] = useState([]);
  const parlayResult = ParlayAgent.calc(parlaySelections);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerData, setPlayerData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const toggleParlay = (game, side) => {
    const pick = side === "home" ? game.home : game.away;
    const odds = side === "home" ? game.homeOdds : game.awayOdds;
    const oddsRaw = side === "home" ? game.homeOddsRaw : game.awayOddsRaw;
    const prob = side === "home" ? game.homeProb : game.awayProb;
    const id = `${game.id}-${side}`;
    setParlaySelections(prev => {
      const existing = prev.find(s => s.gameId === game.id);
      if (existing) {
        if (existing.id === id) return prev.filter(s => s.gameId !== game.id);
        return [...prev.filter(s => s.gameId !== game.id), { id, gameId:game.id, pick, odds, oddsRaw, prob, side }];
      }
      return [...prev, { id, gameId:game.id, pick, odds, oddsRaw, prob, side }];
    });
    if (tab !== "parlay") setTab("parlay");
  };

  const fetchPlayer = async () => {
    if (!playerSearch.trim()) return;
    setPlayerLoading(true);
    setPlayerData(null);
    setPlayerError("");
    try {
      const players = await DataAgent.searchPlayer(playerSearch);
      if (!players.length) { setPlayerError("Player not found."); return; }
      const p = players[0];
      const stats = await DataAgent.getStats(p.id);
      if (!stats) { setPlayerError(`No 2024-25 stats found for ${p.first_name} ${p.last_name}.`); return; }
      setPlayerData({
        name: `${p.first_name} ${p.last_name}`,
        team: p.team?.full_name || "—",
        position: p.position || "—",
        games: stats.games_played,
        minutes: stats.min,
        pts: stats.pts?.toFixed(1), reb: stats.reb?.toFixed(1), ast: stats.ast?.toFixed(1),
        fg: stats.fg_pct ? (stats.fg_pct*100).toFixed(1)+"%" : "—",
        fg3: stats.fg3_pct ? (stats.fg3_pct*100).toFixed(1)+"%" : "—",
        ft: stats.ft_pct ? (stats.ft_pct*100).toFixed(1)+"%" : "—",
        stl: stats.stl?.toFixed(1), blk: stats.blk?.toFixed(1),
      });
    } catch { setPlayerError("API error. balldontlie.io may be rate-limiting."); }
    finally { setPlayerLoading(false); }
  };

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", content:q }]);
    setLoading(true);

    let extraCtx = "";
    const playerMatch = q.match(/(?:stats?|about|points?|scoring|how is|how's)\s+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    if (playerMatch) {
      try {
        const ps = await DataAgent.searchPlayer(playerMatch[1]);
        if (ps.length) {
          const st = await DataAgent.getStats(ps[0].id);
          if (st) extraCtx = `FETCHED PLAYER STATS for ${ps[0].first_name} ${ps[0].last_name} (${ps[0].team?.full_name}): ${st.pts?.toFixed(1)} PPG, ${st.reb?.toFixed(1)} RPG, ${st.ast?.toFixed(1)} APG, FG: ${(st.fg_pct*100).toFixed(1)}%, 3P: ${(st.fg3_pct*100).toFixed(1)}%, ${st.games_played} games`;
        }
      } catch {}
    }

    try {
      const reply = await InterfaceAgent.query(q, games,
        { selections: parlaySelections, result: parlayResult }, extraCtx);
      setMessages(prev => [...prev, { role:"assistant", content:reply }]);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"⚠️ Connection error. Please try again." }]);
    } finally { setLoading(false); }
  };

  const SUGGESTIONS = [
    "Who wins Lakers vs Warriors?",
    "LeBron James stats",
    "Best bet on tonight's games",
    "Explain my parlay",
  ];

  return (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", background:C.bg, color:C.text,
      height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ background:C.panel, borderBottom:`2px solid ${C.accent}`,
        padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:C.accent,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:"#000" }}>NBA</div>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, lineHeight:1,
              letterSpacing:"2px", color:C.text }}>NBA ANALYTICS AI</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
              color:C.muted, letterSpacing:"1px" }}>MULTI-AGENT INTELLIGENCE SYSTEM</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          {["DataAgent","AnalyticsAgent","ParlayAgent","InterfaceAgent"].map(a => (
            <AgentBadge key={a} name={a} />
          ))}
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width:300, background:C.panel, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {[
              { id:"games", label:"GAMES" },
              { id:"stats", label:"PLAYERS" },
              { id:"parlay", label:`PARLAY${parlaySelections.length > 0 ? ` (${parlaySelections.length})` : ""}` },
            ].map(t => (
              <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
                style={{ flex:1, padding:"10px 4px", background:"transparent",
                  border:"none", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
                  color: tab === t.id ? C.accent : C.muted, cursor:"pointer",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:"1px",
                  transition:"all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex:1, overflowY:"auto", padding:10 }}>
            {tab === "games" && games.map(g => (
              <GameCard key={g.id} game={g} parlaySelections={parlaySelections} onToggle={toggleParlay} />
            ))}

            {tab === "stats" && (
              <>
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchPlayer()}
                    placeholder="Search NBA player..."
                    style={{ flex:1, background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13,
                      fontFamily:"'Barlow Condensed',sans-serif", outline:"none" }} />
                  <button onClick={fetchPlayer}
                    style={{ background:C.accent, border:"none", borderRadius:6, padding:"0 12px",
                      color:"#000", fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
                      cursor:"pointer", letterSpacing:"1px" }}>GO</button>
                </div>
                {playerLoading && (
                  <div style={{ textAlign:"center", padding:20, color:C.muted, fontSize:13 }}>
                    Fetching from balldontlie.io...
                  </div>
                )}
                {playerError && (
                  <div style={{ background:"rgba(255,68,68,0.08)", border:`1px solid rgba(255,68,68,0.2)`,
                    borderRadius:6, padding:10, fontSize:13, color:"#FF8080" }}>{playerError}</div>
                )}
                {playerData && <PlayerCard stats={playerData} />}
                {!playerData && !playerLoading && !playerError && (
                  <div style={{ padding:"20px 0" }}>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:10,
                      fontFamily:"'Barlow Condensed',sans-serif" }}>TRY SEARCHING:</div>
                    {["LeBron James","Nikola Jokic","Stephen Curry","Jayson Tatum","Kevin Durant"].map(p => (
                      <button key={p} onClick={() => { setPlayerSearch(p); }}
                        style={{ display:"block", width:"100%", background:C.card,
                          border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px",
                          color:C.muted, textAlign:"left", marginBottom:4, cursor:"pointer",
                          fontFamily:"'Barlow Condensed',sans-serif", fontSize:13,
                          transition:"all 0.15s" }}
                        onMouseEnter={e => { e.target.style.color=C.accent; e.target.style.borderColor=C.accent; }}
                        onMouseLeave={e => { e.target.style.color=C.muted; e.target.style.borderColor=C.border; }}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "parlay" && (
              <ParlayPanel selections={parlaySelections} result={parlayResult}
                onRemove={id => setParlaySelections(prev => prev.filter(s => s.id !== id))} />
            )}
          </div>
        </aside>

        {/* ── CHAT PANEL ── */}
        <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Agent pipeline indicator */}
          <div style={{ borderBottom:`1px solid ${C.border}`, padding:"6px 16px",
            display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
              letterSpacing:"0.5px" }}>PIPELINE:</span>
            {["User Query","InterfaceAgent","DataAgent + AnalyticsAgent","ParlayAgent","Unified Response"].map((s,i,arr) => (
              <span key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color: i === 0 ? C.blue : i === arr.length-1 ? C.green : C.accent,
                  fontFamily:"'Barlow Condensed',sans-serif" }}>{s}</span>
                {i < arr.length - 1 && <span style={{ color:C.dim, fontSize:11 }}>→</span>}
              </span>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
            {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
            {loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ width:20, height:20, borderRadius:4, background:C.accent,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:700, color:"#000", fontFamily:"'Bebas Neue',sans-serif" }}>AI</div>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                    color:C.muted }}>thinking...</span>
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:"4px 14px 14px 14px" }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Quick suggestions */}
          <div style={{ padding:"8px 16px 0", display:"flex", gap:6, flexWrap:"wrap",
            borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}
                style={{ background:"transparent", border:`1px solid ${C.border}`,
                  borderRadius:20, padding:"4px 12px", cursor:"pointer", fontSize:12,
                  color:C.muted, fontFamily:"'Barlow Condensed',sans-serif", transition:"all 0.15s" }}>
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding:12, flexShrink:0 }}>
            <div style={{ display:"flex", gap:8, background:C.card,
              border:`1px solid ${C.border}`, borderRadius:10, padding:"4px 4px 4px 14px",
              transition:"border-color 0.15s" }}
              onFocus={() => {}} >
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about players, odds, win probability, or parlays..."
                disabled={loading}
                style={{ flex:1, background:"transparent", border:"none", outline:"none",
                  color:C.text, fontSize:14, fontFamily:"'Barlow Condensed',sans-serif",
                  padding:"6px 0" }} />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading}
                style={{ background: loading ? C.dim : C.accent, border:"none", borderRadius:7,
                  padding:"8px 18px", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:"1px",
                  color:"#000", transition:"background 0.15s", flexShrink:0 }}>
                {loading ? "..." : "SEND"}
              </button>
            </div>
            <div style={{ textAlign:"center", marginTop:5, fontSize:11, color:C.dim,
              fontFamily:"'Barlow Condensed',sans-serif" }}>
              Stats: balldontlie.io · Odds: AnalyticsAgent model · Not financial advice
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
