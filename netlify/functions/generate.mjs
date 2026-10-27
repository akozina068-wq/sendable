cat /tmp/sb/netlify/functions/generate.mjs
Response
// Sendable — turns a CV + a job ad into ready application text with Claude.
// Needs ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables.
// Optional: SB_MODEL (defaults below).

function env(name) {
  try { const v = globalThis.Netlify?.env?.get(name); if (v) return v; } catch {}
  return process.env[name];
}
const API_KEY = () => env("ANTHROPIC_API_KEY");
const MODEL = env("SB_MODEL") || "claude-haiku-4-5";
const MAX = 12000;

// Simple per-instance rate limit (resets when the function cold-starts).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

const SYSTEM = `You help a UK job applicant turn their own CV and a specific job advert into ready-to-submit application text.
Hard rules:
- Use ONLY facts found in the candidate's CV. Never invent employers, dates, qualifications, skills or achievements. If the CV lacks something the job wants, do not fabricate it.
- British English throughout. Plain, human, specific. No clichés ("team player", "hit the ground running"), no keyword stuffing.
- The cover letter is ~230-280 words, addressed to the hiring manager, tailored to THIS advert, drawn from the CV.
- "why_us" answers the common screening question "Why do you want to work here / for this role?" in ~120-160 words, specific to the advert.
- "summary" is a clean, reusable recap of the CV the person would otherwise retype: roles (title, employer, dates), education, and key skills. Use short lines, no prose.
- If the CV is empty, too short or clearly not a CV, return all three fields as an empty string "" and put one short sentence in "note" telling them what to paste. Otherwise "note" is "".
Return ONLY valid JSON, no prose, exactly:
{"cover_letter":"...","why_us":"...","summary":"...","note":""}`;

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!API_KEY()) return json({ error: "Server not configured" }, 500);

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many tries. Give it an hour." }, 429);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const cv = String(body?.cv || "").trim().slice(0, MAX);
  const jobAd = String(body?.job || "").trim().slice(0, MAX);
  if (cv.length < 80) return json({ error: "Paste a bit more of your CV so there is something to work from." }, 400);
  if (jobAd.length < 40) return json({ error: "Paste the job advert too, so we can tailor it." }, 400);

  const user = `CANDIDATE CV:
"""${cv}"""

JOB ADVERT:
"""${jobAd}"""

Write the cover letter, the "why_us" answer and the reusable summary, using only what is in the CV.`;

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch {
    return json({ error: "Sendable is busy right now. Try again in a moment." }, 502);
  }
  if (!res.ok) {
    console.error("Anthropic error", res.status, await res.text());
    return json({ error: "Sendable is busy right now. Try again in a moment." }, 502);
  }

  const data = await res.json();
  const textOut = (data.content || []).map((b) => b.text || "").join("");
  const m = textOut.match(/\{[\s\S]*\}/);
  let out;
  try { out = JSON.parse(m ? m[0] : textOut); } catch {
    console.error("Bad model JSON", textOut);
    return json({ error: "Couldn't put that together. Try again." }, 502);
  }

  return json({
    cover_letter: String(out.cover_letter || ""),
    why_us: String(out.why_us || ""),
    summary: String(out.summary || ""),
    note: String(out.note || ""),
  });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const config = { path: "/api/generate" };
  
    
