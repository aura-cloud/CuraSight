// CuraSight: read dose directions from one prescription line (plain text rules, no AI, nothing is sent anywhere).
// Returns what it could find; anything unknown stays null/empty so the screen can ask the user to fill it in.
const DEF = { 1: ["09:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["07:00", "12:00", "17:00", "22:00"] };
const SLOT = ["08:00", "14:00", "21:00", "22:00"];   // morning, afternoon, night, bedtime for patterns like 1-0-1

function parseSchedule(line) {
  const s = " " + String(line || "").toLowerCase().replace(/[()]/g, " ") + " ";
  const out = { perDay: null, times: [], food: "", days: null, sos: false, dose: "" };

  if (/\b(sos|prn|as needed|if needed|if required|when required|if pain|if fever|only if|zaroorat padne)\b/.test(s)) out.sos = true;

  const p = s.match(/\b(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)(?:\s*[-–]\s*(\d))?\b/);   // 1-0-1 style
  if (p) {
    p.slice(1, 5).forEach((n, i) => { if (n && +n > 0) out.times.push(SLOT[i]); });
    if (out.times.length) out.perDay = out.times.length;
  }
  const night = /\b(hs|at night|bedtime|before sleep|night|raat)\b/.test(s), morning = /\b(morning|breakfast|subah|empty stomach)\b/.test(s);
  if (!out.perDay) {
    if (/\b(qid|qds|four times|4 times|4x|char baar)\b/.test(s)) out.perDay = 4;
    else if (/\b(tds|tid|thrice|three times|3 times|3x|teen baar)\b/.test(s)) out.perDay = 3;
    else if (/\b(bd|bid|bds|twice|two times|2 times|2x|do baar)\b/.test(s)) out.perDay = 2;
    else if (/\b(od|qd|once|one time|1 time|daily|every day|ek baar|1x)\b/.test(s) || night || morning) out.perDay = 1;
    if (out.perDay === 1) out.times = [night ? "21:00" : morning ? "08:00" : DEF[1][0]];
    else if (out.perDay) out.times = DEF[out.perDay].slice();
  }

  if (/\b(before (food|meals?|breakfast|lunch|dinner|eating)|empty stomach)\b/.test(s)) out.food = "before";
  else if (/\bafter (food|meals?|breakfast|lunch|dinner|eating)\b/.test(s)) out.food = "after";
  else if (/\bwith (food|meals?|milk)\b/.test(s)) out.food = "with";

  const d = s.match(/(?:\bx|×|\bfor)\s*(\d{1,3})\s*(days?|d|weeks?|wks?|w|months?|mo)\b/) || s.match(/\b(\d{1,3})\s*(days?|weeks?|months?)\b/);
  if (d) { const f = /^w/.test(d[2]) ? 7 : /^m/.test(d[2]) ? 30 : 1; out.days = Math.max(1, Math.min(365, +d[1] * f)); }

  const m = s.match(/\b(\d+(?:\.\d+)?|half|one|two)\s*(tab(?:let)?s?|cap(?:sule)?s?|tsp|teaspoons?|ml|drops?|puffs?)\b/);
  if (m) out.dose = m[1] + " " + m[2];
  return out;
}
module.exports = { parseSchedule };
