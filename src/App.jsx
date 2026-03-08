import { useState, useRef, useEffect } from "react";
import * as mammoth from "mammoth";

const C = {
  bg:"#f9f7f4", surface:"#ffffff", warm:"#f4f1ec", border:"#e8e2d9",
  text:"#1a1714", mid:"#5a5148", dim:"#9a9088",
  gold:"#8B6B1A", goldL:"#fdf6e3", goldB:"#c9a84c",
  blue:"#1a4a78", blueL:"#eef3fa", blueB:"#c4d9ee",
  green:"#1a5a36", greenL:"#eef6f1", greenB:"#b8dac6",
  red:"#78201e", redL:"#fdf0f0", redB:"#e0b0ae",
  purple:"#46327a", purpleL:"#f3f0fa", purpleB:"#cfc8e8",
  orange:"#7a3e10", orangeL:"#fdf4ee", orangeB:"#dfc8b0",
};

// ─── CLIPBOARD — works in sandboxed iframes ──────────────────────────────────
function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
  } catch { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
}

// ─── FILE PARSING ─────────────────────────────────────────────────────────────
async function extractPdfText(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const doExtract = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      window.pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(pdf => {
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++)
          pages.push(pdf.getPage(i).then(p => p.getTextContent().then(tc => tc.items.map(it => it.str).join(" "))));
        Promise.all(pages).then(texts => resolve(texts.join("\n\n"))).catch(reject);
      }).catch(reject);
    };
    if (window.pdfjsLib) { doExtract(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = doExtract; s.onerror = () => reject(new Error("Could not load PDF parser"));
    document.head.appendChild(s);
  });
}
async function parseFile(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) { const b = await file.arrayBuffer(); return await extractPdfText(b); }
  if (n.endsWith(".docx") || n.endsWith(".doc")) { const b = await file.arrayBuffer(); const r = await mammoth.extractRawText({ arrayBuffer: b }); return r.value; }
  return await file.text();
}

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const SYS_LAUNCH = `You are an expert paid media strategist. LAUNCH MODE: help build test architecture BEFORE spending a dollar. Be conversational, ask 1-2 questions at a time. Never assume — always ask if unclear.

CRITICAL RULES — NEVER BREAK:
- NEVER assume existing campaign data or a winners campaign unless told
- NEVER recommend ASC+ unless they confirm pixel maturity + purchase history
- NEVER introduce the 20/25% testing/winners split unless a winners campaign already exists
- NEVER assume a target CPA — calculate it from AOV and margins, or ask
- If info is already given upfront, skip those questions

STEP 1 — ACCOUNT STATUS (always first):
Ask: "Is this a brand new ad account, or do you have existing campaigns running?"
New: no pixel history, start fresh — CBO or ABO only, no ASC
Existing: ask about winners campaign, pixel maturity, current spend

STEP 2 — ECONOMICS (before any budget talk):
Ask: AOV and gross margin %
Calculate CPA target: AOV x margin. Example: $100 AOV, 60% margin = $60 max CPA
If ROAS target given instead: CPA = AOV / target ROAS
Note: daily budget per ad set = 5-10x target CPA

STEP 3 — BUDGET AND STRUCTURE:
Recommend based on budget AND account status:
- New account (any budget): CBO only — 1 campaign, multiple ad sets. No ASC.
- Existing, under $200/day: CBO or ABO
- Existing, $200-500/day: ABO for per-ad-set control
- Existing, $500K+/month: Cost cap
- If winners campaign exists: introduce 20/25% testing vs 75/80% winners split
- If no winners campaign: single testing campaign only

STEP 4 — CONCEPTS AND HYPOTHESES:
How many concepts? Brief description of each.
Per concept: "We are testing [X] because we believe [Y audience] will respond to [Z] because [mechanism]."

STEP 5 — SUCCESS THRESHOLDS (set before launch):
Thumbstop target: aim above 25%, strong above 35%
Hold rate target: aim above 40%
CPA ceiling: from Step 2
Minimum spend before verdict: $20-50 per concept minimum, ideally $100 over 3+ days
Time minimum: 7 days — algorithm needs learning phase

STEP 6 — NAMING CONVENTION:
Format_HookType_Angle_Persona_Date (e.g. UGC_Confessional_LossAversion_ClumsiGirl_0625)

STEP 7 — FINAL OUTPUT:
When all info is gathered, output BOTH sections completely. Never cut off mid-section.

CRITICAL: The CAMPAIGN SETUP CHECKLIST section must use EXACTLY this format with pipe separators. This is machine-parsed to render a visual tree — any deviation breaks the render.

CAMPAIGN SETUP CHECKLIST
CAMPAIGN: [name] | Objective: [X] | Budget: $[X]/day | Type: CBO
AD SET: [name] | Audience: [X] | Placement: Advantage+
AD: [name] | Format: [X] | Hook: [short hook text] | CTA: [X]
AD: [name] | Format: [X] | Hook: [short hook text] | CTA: [X]
AD SET: [name] | Audience: [X] | Placement: Advantage+
AD: [name] | Format: [X] | Hook: [short hook text] | CTA: [X]
AD: [name] | Format: [X] | Hook: [short hook text] | CTA: [X]

Rules for the checklist:
- Each CAMPAIGN:, AD SET:, AD: line starts at the beginning of the line with no indentation, no bullet, no markdown
- Use exactly one pipe | between each field
- Keep field values short (under 60 chars each)
- Output all campaigns, all ad sets, all ads — never truncate

TEST RATIONALE
[One paragraph per concept: what is tested, the hypothesis, what winning looks like in numbers]`;

const SYS_DIAGNOSE = `You are a precision paid media analyst. DIAGNOSE MODE. Dara Denney funnel-layer framework.

Parse any data format. State what you received. Flag missing metrics conversationally — do not halt diagnosis for one missing number.

FUNNEL DIAGNOSIS — layer by layer per concept:

LAYER 1 — THUMBSTOP (3-sec views / impressions x 100)
Below 25%: HOOK PROBLEM — creative issue, not media
25-35%: Solid. Above 35%: Strong
Fix: new first frame, different headline, different opening scene

LAYER 2 — HOLD RATE (15-sec views / 3-sec views x 100)
Below 30%: BODY PROBLEM — hook worked, body did not follow through
40-50%: Average. Above 60%: Strong
Fix: body must logically follow hook. Add second hook at drop-off timestamp.

LAYER 3 — CTR (clicks / impressions x 100)
Strong ecom: 1.5-2.5%
High CTR + low CVR = landing page problem
Good hold + low CTR = offer or CTA problem
Note: CTR drives ~4% of ROI. Diagnostic only.

LAYER 4 — CPA / ROAS / CVR
Compare to THEIR account averages first, then benchmarks
Meta CVR average: 8-9% of clicks

VERDICTS:
SCALE - thumbstop 30%+, hold 40%+, CPA at/below target. Move via original Post ID.
ITERATE - one layer weak. Name exactly what to change.
KILL - 2-3x CPA with no signals after sufficient spend. Or all three layers weak.
FATIGUE - add new creative alongside, never pause.

ALWAYS end with:

SEND TO THE CREATIVE ROOM

WHAT WON:
- Format: [format]
- Angle: [angle]
- Persona: [persona]
- Why it won (mechanism not metrics): [explanation]

WHAT TO BRIEF NEXT:
[Specific creative direction]

WHAT TO AVOID:
[What failed and mechanism behind why]

PATTERNS EMERGING:
[Cross-concept patterns]
---`;

const SYS_REPORT = `You are a performance analyst writing sharp INTERNAL reports. For the strategist, not clients. No polish. Just clarity and truth.

First ask: Diagnose output to build from, or raw data?
- Diagnose output: use as foundation
- Raw data: quick diagnosis first, then report

REPORT FORMAT — complete all sections:

1. WHAT HAPPENED — 2-3 sentences max. TLDR.
2. PERFORMANCE SNAPSHOT — key metrics vs target or prior period
3. CREATIVE BREAKDOWN — per concept: what worked, what did not, WHY. Then cross-concept patterns.
4. HYPOTHESIS VERDICT — did launch hypotheses hold? What changed?
5. WHAT TO DO NEXT — scale which, iterate how, kill what, brief what. Every line is an action.
6. PATTERN LOG — what is this data teaching about this audience. Running intelligence.

Tone: Writing notes to yourself. Ruthlessly honest.`;

const SYS_DISSECT_P1 = `You are a world-class creative strategist who reverse-engineers high-performing ads to extract transferable principles.

Your job right now: dissect this ad in depth. Part 1 only — no brand recommendations yet.

After completing the dissection, end with exactly this line:
---
Want to see how this could work for your brand?

1. HOOK MECHANISM
Name the specific technique (curiosity gap, bold claim, visual contrast, relatable scenario, transformation preview, controversy, pattern interrupt, social proof stack, self-deprecating confession, tribal identity, benign violation, etc.)
Why does it stop the scroll — what does the brain do in the first 0.3 seconds?

2. ANGLE
What exact desire, pain, fear, or aspiration is activated? Not "it solves a problem" — the exact emotional state and why it makes someone stop.

3. PERSONA
Who is this speaking to? Evidence from language, setting, casting, cultural references, humour style.

4. FORMAT LOGIC
Why this format for this message? What would be lost if you changed it?

5. PSYCHOLOGICAL TRIGGER
Name it. Explain exactly HOW it is deployed — the specific mechanic and why the brain responds.

6. STRUCTURE — BEAT BY BEAT
First 3 seconds: what happens and why that order works.
Middle: how it holds attention and builds the case.
CTA: what it asks and why that ask works here.

7. WHY IT IS WORKING
Algorithm: why the platform rewards this (engagement signals, watch time, share/save behaviour).
Human: the psychological mechanism — what emotion does it end on and why does that drive action.

Never say "it feels authentic." Explain what specific choices create that perception.`;

const SYS_DISSECT_P2 = `You are a world-class creative strategist applying a dissected ad's mechanism to a specific brand.

DEFAULT RESPONSE FORMAT — lead with hooks, nothing else unless asked:

Start with ONE sentence stating the transferable mechanism.
Then immediately output hook options in labelled categories.

HOOK CATEGORIES:
Group hooks by the violation type or angle (e.g. Sexual Taboo → Product Context, Relationship Taboo, Wedding Culture, etc.)
Write 4-6 hooks per category. Each hook must be ready to use — exact wording, no placeholders.
End each category with one line: "Phase: [Phase 1 / Phase 2]" and why.

After ALL categories, add one short paragraph (3-5 sentences max): which hooks to test first and why. No essays. No frameworks.

TONE: Direct. Punchy. Like a strategist in a working session, not a consulting report.

DO NOT write:
- Long strategic assessments
- Numbered frameworks
- Lengthy explanations of brand fit
- Multiple pages of analysis

The user will ask follow-up questions if they want more depth. Just give them the hooks.

If the user asks for a brief on a specific hook, output EXACTLY this format:

BRIEF FOR THE CREATIVE ROOM
---
SOURCE AD: [one sentence describing the dissected ad]
TRANSFERABLE PRINCIPLE: [mechanism in one sentence]
STRATEGIC PHASE: [Phase 1 - Direct Response / Phase 2 - Brand Awareness / Both]
HOOK TYPE: [name]
HOOK: [exact hook wording]
ANGLE: [specific desire/pain/fear being activated]
FORMAT: [recommendation and why]
PERSONA: [who this is for — specific]
FIRST 3 SECONDS: [exactly what must happen and why]
BEAT BY BEAT: [Frame 1 / Frame 2 / Frame 3 / CTA — brief, actionable]
WHAT TO AVOID: [3 specific things not to do]
OBJECTIVE: [what this ad must make viewer feel and do]
SUCCESS METRICS: Hook rate target / CTR target / CPA target
---

Only output the brief if specifically asked. Never add it unprompted.`;

// ─── API ─────────────────────────────────────────────────────────────────────
const TOKEN_LIMITS = { launch: 4000, diagnose: 2500, report: 2500, dissect: 4000 };

async function callClaude(messages, system, mode) {
  const max_tokens = TOKEN_LIMITS[mode] || 2500;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens, system, messages }),
  });
  if (!res.ok) throw new Error("API error " + res.status);
  const d = await res.json();
  return d.content?.[0]?.text || "Something went wrong.";
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
function Icon({ name, size = 16 }) {
  const s = size;
  if (name === "launch") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  if (name === "diagnose") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
  if (name === "report") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if (name === "dissect") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
  if (name === "send") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
  if (name === "copy") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
  if (name === "check") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
  if (name === "back") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
  if (name === "image") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
  if (name === "close") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if (name === "context") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if (name === "brand") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
  if (name === "upload") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
  if (name === "trash") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
  if (name === "edit") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  if (name === "file") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  if (name === "new") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
  if (name === "creative") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  if (name === "tree") return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>;
  return null;
}

// ─── CAMPAIGN TREE VISUALISER ─────────────────────────────────────────────────
// Parses CAMPAIGN SETUP CHECKLIST section into a tree and renders it
function parseChecklistTree(text) {
  // Strip markdown bold and clean up
  const clean = text.replace(/\*\*/g, "").replace(/`/g, "");
  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
  const campaigns = [];
  let currentCampaign = null;
  let currentAdSet = null;

  for (const line of lines) {
    // Match CAMPAIGN: with or without leading symbols
    const campMatch = line.match(/^(?:[-*>]\s*)?CAMPAIGN:\s*(.+)/i);
    const adsetMatch = line.match(/^(?:[-*>]\s*)?AD\s*SET:\s*(.+)/i);
    const adMatch = line.match(/^(?:[-*>]\s*)?AD:\s*(.+)/i);

    if (campMatch) {
      const parts = campMatch[1].split("|").map(s => s.trim());
      currentCampaign = { name: parts[0] || "", meta: parts.slice(1), adSets: [] };
      currentAdSet = null;
      campaigns.push(currentCampaign);
    } else if (adsetMatch) {
      if (!currentCampaign) continue;
      const parts = adsetMatch[1].split("|").map(s => s.trim());
      currentAdSet = { name: parts[0] || "", meta: parts.slice(1), ads: [] };
      currentCampaign.adSets.push(currentAdSet);
    } else if (adMatch) {
      if (!currentAdSet) continue;
      const parts = adMatch[1].split("|").map(s => s.trim());
      currentAdSet.ads.push({ name: parts[0] || "", meta: parts.slice(1) });
    }
  }
  return campaigns;
}

// ─── VISUAL CAMPAIGN TREE ─────────────────────────────────────────────────────
function CampaignBox({ label, meta, color, bg, bdr, level }) {
  const levelLabel = ["CAMPAIGN", "AD SET", "AD"][level] || "";
  return (
    <div style={{ background: bg, border: "2px solid " + bdr, borderRadius: 10, padding: "10px 14px", minWidth: level === 2 ? 160 : 200, maxWidth: level === 2 ? 220 : 300, flex: "0 0 auto" }}>
      <div style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, opacity: 0.8 }}>{levelLabel}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.35, marginBottom: meta.length ? 6 : 0 }}>{label}</div>
      {meta.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {meta.map((m, i) => (
            <div key={i} style={{ fontSize: 11, color: C.mid, lineHeight: 1.4 }}>{m}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Connector({ vertical }) {
  return vertical
    ? <div style={{ width: 2, height: 20, background: C.border, margin: "0 auto" }} />
    : <div style={{ height: 2, flex: 1, background: C.border, minWidth: 12 }} />;
}

function CampaignTree({ text }) {
  const campaigns = parseChecklistTree(text);
  if (!campaigns.length) return null;

  return (
    <div style={{ background: C.surface, border: "1px solid " + C.blueB, borderRadius: 14, padding: "18px 16px", margin: "14px 0", overflowX: "auto" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Ads Manager Structure</div>

      {campaigns.map((camp, ci) => (
        <div key={ci} style={{ marginBottom: ci < campaigns.length - 1 ? 28 : 0 }}>
          {/* Campaign row */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
            <CampaignBox label={camp.name} meta={camp.meta} color={C.blue} bg={C.blueL} bdr={C.blueB} level={0} />
          </div>

          {camp.adSets.length > 0 && (
            <>
              {/* Vertical line down from campaign */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Connector vertical />
              </div>

              {/* Horizontal bar across ad sets */}
              {camp.adSets.length > 1 && (
                <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", height: 2, background: C.border, width: Math.min(camp.adSets.length * 240, 720) + "px" }} />
                </div>
              )}

              {/* Ad Sets row */}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                {camp.adSets.map((adSet, si) => (
                  <div key={si} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {/* Vertical tick up to horizontal bar (only if multiple adsets) */}
                    {camp.adSets.length > 1 && <Connector vertical />}
                    <CampaignBox label={adSet.name} meta={adSet.meta} color={C.purple} bg={C.purpleL} bdr={C.purpleB} level={1} />

                    {adSet.ads.length > 0 && (
                      <>
                        <Connector vertical />
                        {/* Horizontal across ads */}
                        {adSet.ads.length > 1 && (
                          <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                            <div style={{ height: 2, background: C.border, width: Math.min(adSet.ads.length * 190, 440) + "px" }} />
                          </div>
                        )}
                        {/* Ads row */}
                        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: adSet.ads.length > 1 ? 0 : 0 }}>
                          {adSet.ads.map((ad, ai) => (
                            <div key={ai} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              {adSet.ads.length > 1 && <Connector vertical />}
                              <CampaignBox label={ad.name} meta={ad.meta} color={C.green} bg={C.greenL} bdr={C.greenB} level={2} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MARKDOWN ────────────────────────────────────────────────────────────────
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return <>{parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  })}</>;
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { copyText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: done ? C.green : C.dim, fontSize: 12, padding: "3px 6px", borderRadius: 5 }}>
      <Icon name={done ? "check" : "copy"} size={13} />
    </button>
  );
}

function MD({ text }) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const l = lines[i];

    // CODE BLOCK — check if it's a campaign tree
    if (l.trim().startsWith("```")) {
      const block = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { block.push(lines[i]); i++; }
      if (lines[i]?.trim().startsWith("```")) i++;
      const blockText = block.join("\n");
      const treeData = parseChecklistTree(blockText);
      if (treeData.length > 0) {
        out.push(<CampaignTree key={"tree-cb" + i} text={blockText} />);
      } else {
        out.push(
          <pre key={"pre" + i} style={{ background: C.warm, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 14px", fontSize: 12, overflowX: "auto", margin: "8px 0", color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {blockText}
          </pre>
        );
      }
      continue;
    }

    // SEND TO THE CREATIVE ROOM block
    if (l.includes("SEND TO THE CREATIVE ROOM")) {
      const block = []; i++;
      while (i < lines.length && lines[i] !== "---") { block.push(lines[i]); i++; }
      if (lines[i] === "---") i++;
      out.push(
        <div key={"cr" + i} style={{ background: C.greenL, border: "1px solid " + C.greenB, borderRadius: 11, padding: "14px 16px", margin: "14px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 9 }}>&#8594; Send to The Creative Room</div>
          {block.map((bl, bi) => bl.trim() ? <p key={bi} style={{ margin: "3px 0", fontSize: 13, color: C.text, lineHeight: 1.65 }}><Inline text={bl} /></p> : <div key={bi} style={{ height: 5 }} />)}
        </div>
      );
      continue;
    }

    // BRIEF FOR THE CREATIVE ROOM block — only trigger on the standalone header line
    if (l.trim() === "BRIEF FOR THE CREATIVE ROOM") {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine === "---") {
        i += 2;
        const block = [];
        while (i < lines.length && lines[i].trim() !== "---") { block.push(lines[i]); i++; }
        if (lines[i]?.trim() === "---") i++;
        const briefText = block.join("\n");
        const formatted = "=== BRIEF FROM THE INTEL ROOM ===\n\n" + briefText + "\n\n=== END BRIEF ===";
        out.push(<BriefBlock key={"bf" + i} content={block} briefText={formatted} />);
        continue;
      }
    }

    // CAMPAIGN SETUP CHECKLIST header trigger
    if (l.trim().startsWith("CAMPAIGN SETUP CHECKLIST")) {
      const checklistLines = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith("TEST RATIONALE") && !lines[i].trim().startsWith("## ") && !lines[i].trim().startsWith("```")) {
        checklistLines.push(lines[i]); i++;
      }
      const checklistText = checklistLines.join("\n");
      const treeData = parseChecklistTree(checklistText);
      if (treeData.length > 0) {
        out.push(<CampaignTree key={"tree" + i} text={checklistText} />);
      } else {
        out.push(
          <div key={"cl" + i} style={{ background: C.blueL, border: "1px solid " + C.blueB, borderRadius: 10, padding: "12px 14px", margin: "8px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Campaign Setup Checklist</div>
            {checklistLines.filter(l => l.trim()).map((pl, pi) => <p key={pi} style={{ margin: "3px 0", fontSize: 13, color: C.text, lineHeight: 1.65 }}><Inline text={pl} /></p>)}
          </div>
        );
      }
      continue;
    }

    // FINAL STRATEGIC NOTE — special callout
    if (l.includes("FINAL STRATEGIC NOTE")) {
      const block = []; i++;
      while (i < lines.length && lines[i] !== "---" && !lines[i].startsWith("#")) { block.push(lines[i]); i++; }
      out.push(
        <div key={"fsn" + i} style={{ background: C.goldL, border: "1px solid #e0cf9a", borderRadius: 11, padding: "14px 16px", margin: "14px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 9 }}>Final Strategic Note</div>
          {block.map((bl, bi) => bl.trim() ? <p key={bi} style={{ margin: "3px 0", fontSize: 13, color: C.text, lineHeight: 1.65 }}><Inline text={bl} /></p> : <div key={bi} style={{ height: 5 }} />)}
        </div>
      );
      continue;
    }

    if (!l.trim()) { out.push(<div key={i} style={{ height: 7 }} />); i++; continue; }

    const verdicts = [
      { re: /^SCALE\b/, bg: C.greenL, bdr: C.greenB, col: C.green },
      { re: /^ITERATE\b/, bg: C.goldL, bdr: "#e0cf9a", col: C.gold },
      { re: /^KILL\b/, bg: C.redL, bdr: C.redB, col: C.red },
      { re: /^FATIGUE\b/, bg: C.purpleL, bdr: C.purpleB, col: C.purple },
    ];
    const vt = verdicts.find(v => v.re.test(l));
    if (vt) { out.push(<div key={i} style={{ display: "inline-flex", background: vt.bg, border: "1px solid " + vt.bdr, borderRadius: 7, padding: "5px 12px", margin: "4px 0", fontSize: 13, color: vt.col, fontWeight: 600 }}><Inline text={l} /></div>); i++; continue; }

    if (l.startsWith("### ")) { out.push(<h3 key={i} style={{ fontSize: 11, fontWeight: 700, color: C.mid, margin: "18px 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{l.slice(4)}</h3>); i++; continue; }
    if (l.startsWith("## ")) { out.push(<h2 key={i} style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: "18px 0 7px", borderBottom: "1px solid " + C.border, paddingBottom: 5 }}>{l.slice(3)}</h2>); i++; continue; }
    if (l.startsWith("# ")) { out.push(<h1 key={i} style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 10px" }}>{l.slice(2)}</h1>); i++; continue; }
    if (l === "---") { out.push(<hr key={i} style={{ border: "none", borderTop: "1px solid " + C.border, margin: "14px 0" }} />); i++; continue; }
    if (l.startsWith("- ") || l.startsWith("* ")) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) { items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}><Inline text={lines[i].slice(2)} /></li>); i++; }
      out.push(<ul key={"ul" + i} style={{ paddingLeft: 18, margin: "6px 0", color: C.text }}>{items}</ul>);
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}><Inline text={lines[i].replace(/^\d+\. /, "")} /></li>); i++; }
      out.push(<ol key={"ol" + i} style={{ paddingLeft: 18, margin: "6px 0", color: C.text }}>{items}</ol>);
      continue;
    }
    out.push(<p key={i} style={{ margin: "3px 0", color: C.text, lineHeight: 1.75, fontSize: 14 }}><Inline text={l} /></p>);
    i++;
  }
  return <div>{out}</div>;
}

function BriefBlock({ content, briefText }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => { copyText(briefText); setCopied(true); setTimeout(() => setCopied(false), 2500); };
  return (
    <div style={{ background: C.orangeL, border: "1px solid " + C.orangeB, borderRadius: 11, padding: "14px 16px", margin: "14px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, letterSpacing: "0.08em", textTransform: "uppercase" }}>&#8594; Brief for The Creative Room</div>
        <button onClick={doCopy} style={{ display: "flex", alignItems: "center", gap: 5, background: copied ? C.greenL : C.surface, border: "1px solid " + (copied ? C.greenB : C.orangeB), borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: copied ? C.green : C.orange, fontWeight: 600, transition: "all 0.2s" }}>
          <Icon name={copied ? "check" : "creative"} size={11} />
          {copied ? "Copied!" : "Copy to Creative Room"}
        </button>
      </div>
      {content.map((bl, bi) => bl.trim() ? <p key={bi} style={{ margin: "3px 0", fontSize: 13, color: C.text, lineHeight: 1.65 }}><Inline text={bl} /></p> : <div key={bi} style={{ height: 5 }} />)}
    </div>
  );
}

function Dots() {
  return <div style={{ display: "flex", gap: 4, alignItems: "center" }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.dim, animation: "dot 1.2s " + (i*0.2) + "s ease-in-out infinite" }} />)}</div>;
}

function Bubble({ role, content, imgPreview }) {
  if (role === "user") return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{ maxWidth: "74%" }}>
        {imgPreview && <img src={imgPreview} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 5, display: "block" }} />}
        {content && <div style={{ background: C.text, color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "10px 14px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{content}</div>}
      </div>
    </div>
  );
  return (
    <div style={{ marginBottom: 14, position: "relative" }}>
      <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: "4px 16px 16px 16px", padding: "14px 36px 14px 16px", fontSize: 14 }}>
        <MD text={content} />

      </div>
      <div style={{ position: "absolute", top: 6, right: 6 }}><CopyBtn text={content} /></div>
    </div>
  );
}

function ImagePicker({ onSelect, current, onClear }) {
  const ref = useRef();
  const load = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = e => onSelect({ data: e.target.result.split(",")[1], preview: e.target.result, type: f.type });
    r.readAsDataURL(f);
  };
  if (current) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.blueL, border: "1px solid " + C.blueB, borderRadius: 8, fontSize: 12, color: C.blue }}>
      <img src={current.preview} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 5 }} />
      <span style={{ flex: 1, fontWeight: 500 }}>Image attached</span>
      <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, display: "flex" }}><Icon name="close" size={14} /></button>
    </div>
  );
  return (
    <div onClick={() => ref.current.click()} onDrop={e => { e.preventDefault(); load(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()}
      style={{ border: "1.5px dashed " + C.border, borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.dim, fontSize: 12 }}>
      <Icon name="image" size={14} /> Upload screenshot or image
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => load(e.target.files[0])} />
    </div>
  );
}

// ─── BRAND PROFILES ──────────────────────────────────────────────────────────
function useBrands() {
  const [brands, setBrands] = useState([]);
  const save = (name, context, editId) => {
    setBrands(prev => editId
      ? prev.map(b => b.id === editId ? { ...b, name, context, updatedAt: Date.now() } : b)
      : [...prev, { id: Date.now().toString(), name, context, updatedAt: Date.now() }]
    );
  };
  const remove = (id) => setBrands(prev => prev.filter(b => b.id !== id));
  return { brands, save, remove };
}

// ─── CONTEXT PANEL ───────────────────────────────────────────────────────────
// ─── HOOK LIBRARY STATE ───────────────────────────────────────────────────────
function useHookLibrary() {
  const [library, setLibrary] = useState([]);
  const saveHooks = (sourceAd, hookType, hooks, brand) => {
    if (!hooks?.length) return;
    const entry = { id: Date.now() + Math.random(), savedAt: new Date().toISOString(), sourceAd: sourceAd || "Unknown ad", hookType: hookType || "General", brand: brand || "", hooks };
    setLibrary(prev => [entry, ...prev]);
  };
  const deleteEntry = (id) => setLibrary(prev => prev.filter(e => e.id !== id));
  const deleteHook = (entryId, hookIdx) => setLibrary(prev =>
    prev.map(e => e.id === entryId ? { ...e, hooks: e.hooks.filter((_, i) => i !== hookIdx) } : e).filter(e => e.hooks.length > 0)
  );
  return { library, saveHooks, deleteEntry, deleteHook };
}

// ─── HOOK PARSER — extracts hooks from Dissect P2 response ───────────────────
function parseHooksFromResponse(text) {
  const hooks = [];
  const lines = text.split("\n");
  let currentCategory = "General";
  let currentPhase = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Category headers like "CATEGORY 1: SEXUAL TABOO" or "## RELATIONSHIP TABOO"
    const catMatch = l.match(/^(?:CATEGORY\s*\d+[:.]\s*)(.+)/i) || l.match(/^#{1,3}\s+(.+)$/);
    if (catMatch && !l.match(/^Hook\s/i) && !l.startsWith("-")) {
      const candidate = catMatch[1].replace(/[*_`]/g, "").trim();
      if (candidate.length > 3 && candidate.length < 80) { currentCategory = candidate; continue; }
    }
    // Phase: lines
    const phaseMatch = l.match(/^Phase[:\s]+(.+)/i);
    if (phaseMatch && !l.match(/^Hook\s/i)) { currentPhase = phaseMatch[1].replace(/[*_]/g, "").trim(); continue; }
    // Hook N: "text" — or Hook N (next line has text)
    const hMatch = l.match(/^(?:Hook\s*\d+[:.]\s*|Option\s*\d+[:.]\s*)(.+)/i);
    if (hMatch) {
      let txt = hMatch[1].replace(/^["']|["']$/g, "").replace(/[*_]/g, "").trim();
      // if the captured text is short/empty, look at next line
      if (txt.length < 5 && i + 1 < lines.length) {
        txt = lines[i+1].replace(/^["'\s*-]+|["'\s]+$/g, "").trim();
        i++;
      }
      if (txt.length > 5) hooks.push({ category: currentCategory, text: txt, phase: currentPhase });
      continue;
    }
    // Quoted lines that look like hooks
    const qMatch = l.match(/^"([^"]{10,})"$/) || l.match(/^'([^']{10,})'$/);
    if (qMatch) hooks.push({ category: currentCategory, text: qMatch[1].trim(), phase: currentPhase });
  }
  return hooks;
}

function ContextPanel({ context, onContext, brands, onSaveBrand, onDeleteBrand, onClose }) {
  const [tab, setTab] = useState("context");
  const [draft, setDraft] = useState(context);
  const [fileName, setFileName] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [brandName, setBrandName] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFile = async (f) => {
    if (!f) return;
    setFileLoading(true); setFileError(""); setFileName(f.name);
    try {
      const text = await parseFile(f);
      if (!text?.trim()) throw new Error("Could not extract text from this file.");
      // REPLACE draft entirely with file content — don't append
      setDraft(text);
    } catch (e) { setFileError(e.message || "Failed to read file."); setFileName(""); }
    setFileLoading(false);
  };

  const saveCtx = () => { onContext(draft); onClose(); };
  const saveBrand = () => {
    if (!brandName.trim() || !draft.trim()) return;
    setSaving(true);
    onSaveBrand(brandName.trim(), draft.trim(), editId);
    setTimeout(() => { setSaving(false); setBrandName(""); setEditId(null); setTab("brands"); }, 400);
  };
  const loadBrand = (b) => { setDraft(b.context); setFileName(""); setFileError(""); setBrandName(""); setEditId(null); onContext(b.context); setTab("context"); };
  const startEdit = (b) => { setDraft(b.context); setBrandName(b.name); setEditId(b.id); setFileName(""); setFileError(""); setTab("context"); };

  return (
    <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 14, marginBottom: 18, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid " + C.border }}>
        {[{ id: "context", label: "Brand Context" }, { id: "brands", label: "Saved Brands (" + brands.length + ")" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "11px 0", border: "none", borderBottom: tab === t.id ? "2px solid " + C.text : "2px solid transparent", background: tab === t.id ? C.surface : C.warm, cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? C.text : C.mid }}>{t.label}</button>
        ))}
        <button onClick={onClose} style={{ padding: "11px 14px", border: "none", background: C.warm, cursor: "pointer", color: C.dim, display: "flex", alignItems: "center", borderLeft: "1px solid " + C.border }}><Icon name="close" size={14} /></button>
      </div>

      {tab === "context" && (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: C.mid, margin: "0 0 12px", lineHeight: 1.5 }}>Add context to make every mode specific to your brand.</p>
          <div onClick={() => !fileLoading && fileRef.current.click()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()}
            style={{ border: "1.5px dashed " + (fileError ? C.red : C.border), borderRadius: 9, padding: "11px 14px", cursor: fileLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}
            onMouseEnter={e => { if (!fileLoading) { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.blueL; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = fileError ? C.red : C.border; e.currentTarget.style.background = "transparent"; }}>
            <Icon name={fileLoading ? "upload" : "file"} size={15} />
            <span style={{ fontSize: 12, color: fileLoading ? C.gold : fileError ? C.red : fileName ? C.text : C.dim, flex: 1 }}>
              {fileLoading ? "Reading " + fileName + "..." : fileError ? fileError : fileName ? "Loaded: " + fileName : "Upload .pdf, .docx, .txt, .md, .csv — or drag and drop"}
            </span>
            {fileName && !fileLoading && !fileError && <button onClick={e => { e.stopPropagation(); setFileName(""); setDraft(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, display: "flex", padding: 0 }}><Icon name="close" size={13} /></button>}
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Or paste your strategy export, brand inputs, brief, or describe your brand..." rows={5} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid " + C.border, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.text, background: C.bg, outline: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ marginTop: 10, padding: "10px 12px", background: C.goldL, border: "1px solid #e0cf9a", borderRadius: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>{editId ? "Update saved brand" : "Save as brand profile"}</div>
            <div style={{ display: "flex", gap: 7 }}>
              <input value={brandName} onChange={e => setBrandName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveBrand()} placeholder={editId ? "Update brand name..." : "Brand name..."} style={{ flex: 1, border: "1px solid #e0cf9a", borderRadius: 7, padding: "6px 10px", fontSize: 12, color: C.text, background: C.surface, outline: "none", fontFamily: "inherit" }} />
              <button onClick={saveBrand} disabled={!brandName.trim() || !draft.trim()} style={{ background: brandName.trim() && draft.trim() ? C.gold : C.border, color: brandName.trim() && draft.trim() ? "#fff" : C.dim, border: "none", borderRadius: 7, padding: "6px 12px", cursor: brandName.trim() && draft.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
                {saving ? "Saved!" : editId ? "Update" : "Save"}
              </button>
              {editId && <button onClick={() => { setEditId(null); setBrandName(""); }} style={{ background: "none", border: "1px solid #e0cf9a", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12, color: C.gold }}>Cancel</button>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={saveCtx} style={{ background: C.text, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Use this context</button>
            <button onClick={() => { setDraft(""); onContext(""); setFileName(""); setEditId(null); }} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 13, color: C.mid }}>Clear</button>
          </div>
        </div>
      )}

      {tab === "brands" && (
        <div style={{ padding: 16 }}>
          {brands.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>No saved brands yet.</div>
              <button onClick={() => setTab("context")} style={{ fontSize: 12, color: C.blue, background: "none", border: "none", cursor: "pointer" }}>Add brand context to get started</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {brands.map(b => (
                <div key={b.id} style={{ border: "1px solid " + C.border, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goldL, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, flexShrink: 0 }}><Icon name="brand" size={15} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{b.context.slice(0, 65).replace(/\n/g, " ")}...</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button onClick={() => loadBrand(b)} style={{ background: C.blueL, border: "1px solid " + C.blueB, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: C.blue, fontWeight: 600 }}>Load</button>
                    <button onClick={() => startEdit(b)} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: C.mid, display: "flex", alignItems: "center" }}><Icon name="edit" size={12} /></button>
                    <button onClick={() => onDeleteBrand(b.id)} style={{ background: "none", border: "1px solid " + C.redB, borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center" }}><Icon name="trash" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CHAT INPUT ───────────────────────────────────────────────────────────────
function ChatInput({ onSend, loading, imgUpload, placeholder }) {
  const [val, setVal] = useState("");
  const [img, setImg] = useState(null);
  const ref = useRef();
  const canSend = (val.trim() || img) && !loading;
  const submit = () => {
    if (!canSend) return;
    onSend(val.trim(), img);
    setVal(""); setImg(null);
    if (ref.current) ref.current.style.height = "auto";
  };
  return (
    <div style={{ borderTop: "1px solid " + C.border, background: C.surface, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
      {imgUpload && <ImagePicker current={img} onSelect={setImg} onClear={() => setImg(null)} />}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={ref} value={val}
          onChange={e => { setVal(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={placeholder || "Type your message..."}
          rows={1}
          style={{ flex: 1, resize: "none", border: "1px solid " + C.border, borderRadius: 10, padding: "9px 12px", fontSize: 14, color: C.text, background: C.bg, outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 130, overflowY: "auto" }}
        />
        <button onClick={submit} disabled={!canSend} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: canSend ? C.text : C.border, color: canSend ? "#fff" : C.dim, cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {loading ? <Dots /> : <Icon name="send" size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── MODE CONFIG ─────────────────────────────────────────────────────────────
const MODE_CFG = {
  launch:  { label: "Launch",  color: C.blue,   system: SYS_LAUNCH,   imgUpload: false, starter: "Let's build your test architecture before you spend a cent.\n\nFirst — is this a brand new ad account, or do you have existing campaigns running?", ph: "Type your answer..." },
  diagnose:{ label: "Diagnose",color: C.purple, system: SYS_DIAGNOSE, imgUpload: false, starter: "Paste your data — any format works. Ads Manager table, CSV, spreadsheet copy, or typed numbers.\n\nI'll parse it and run the funnel diagnosis layer by layer.", ph: "Paste your metrics here..." },
  report:  { label: "Report",  color: C.green,  system: SYS_REPORT,   imgUpload: false, starter: "Let's build your internal report. Do you have Diagnose output to build from, or are you starting from raw data?", ph: "Paste Diagnose output or describe what ran..." },
  dissect: { label: "Dissect", color: C.orange, system: SYS_DISSECT_P1, p2system: SYS_DISSECT_P2, imgUpload: true, starter: "Drop in the ad you want to reverse-engineer.\n\nUpload a screenshot, describe what you saw, or paste a URL and tell me what happened. I'll break down exactly why it works — hook, angle, psychology, format logic, all of it.", ph: "Describe the ad or upload a screenshot..." },
};

// ─── MODE CHAT ────────────────────────────────────────────────────────────────
function ModeChat({ mode, onBack, context, msgs, setMsgs, onSaveHooks, onViewLibrary }) {
  const cfg = MODE_CFG[mode];
  const [loading, setLoading] = useState(false);
  // dissect: "p1" = awaiting ad input, "awaiting" = P1 done, "p2" = brand version
  const [dissectPhase, setDissectPhase] = useState("p1");
  // Sync dissectPhase from session msgs on mount so it survives Back navigation
  useEffect(() => {
    if (mode !== "dissect") return;
    const userMsgs = msgs.filter(m => m.role === "user");
    const assistantMsgs = msgs.filter(m => m.role === "assistant");
    // p2: user clicked brand version (2+ user msgs)
    if (userMsgs.length >= 2) setDissectPhase("p2");
    // awaiting: P1 done — exactly 1 user msg and P1 response received
    else if (userMsgs.length === 1 && assistantMsgs.length >= 2) setDissectPhase("awaiting");
    else setDissectPhase("p1");
  }, []);
  const [savedHooks, setSavedHooks] = useState(false);
  const bottomRef = useRef();
  const scrollToBottom = () => { requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }); };
  useEffect(scrollToBottom, [msgs]);

  const toApi = m => {
    if (m.img) return { role: m.role, content: [{ type: "image", source: { type: "base64", media_type: m.img.type, data: m.img.data } }, ...(m.content ? [{ type: "text", text: m.content }] : [])] };
    return { role: m.role, content: m.content };
  };

  const getSystem = (phase) => {
    if (mode !== "dissect") {
      return context ? cfg.system + "\n\nBRAND CONTEXT:\n" + context : cfg.system;
    }
    const base = phase === "p2" ? cfg.p2system : cfg.system;
    return context ? base + "\n\nBRAND CONTEXT:\n" + context : base;
  };

  const runCall = async (history, phase) => {
    setLoading(true);
    scrollToBottom();
    try {
      const reply = await callClaude(history.slice(1).map(toApi), getSystem(phase), mode);
      setMsgs([...history, { role: "assistant", content: reply }]);
      if (mode === "dissect" && phase === "p1") setDissectPhase("awaiting");
    } catch (e) {
      setMsgs([...history, { role: "assistant", content: "Error: " + e.message }]);
    }
    setLoading(false);
    scrollToBottom();
  };

  const send = async (text, img) => {
    const userMsg = { role: "user", content: text, img: img || null };
    const history = [...msgs, userMsg];
    setMsgs(history);
    let phase = dissectPhase;
    // If awaiting and user says yes/show/go, switch to p2
    if (mode === "dissect" && dissectPhase === "awaiting") {
      const lower = text.toLowerCase();
      if (lower.match(/\b(yes|yeah|sure|show|go|please|do it|yep|absolutely)\b/)) {
        phase = "p2";
        setDissectPhase("p2");
      }
    }
    await runCall(history, phase);
  };

  const showBrandVersion = async () => {
    if (loading) return;
    const userMsg = { role: "user", content: "Yes, show me how this would work for my brand." };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setDissectPhase("p2");
    await runCall(history, "p2");
  };

  const copySession = () => {
    const t = msgs.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    copyText(t);
  };

  const newSession = () => {
    setDissectPhase("p1");
    setSavedHooks(false);
    setMsgs([{ role: "assistant", content: (context ? "**Brand context loaded.**\n\n" : "") + cfg.starter }]);
  };

  const lastMsg = msgs[msgs.length - 1];
  const showBrandPrompt = mode === "dissect" && dissectPhase === "awaiting" && lastMsg?.role === "assistant" && !loading;

  // Simple hook extractor — finds quoted strings and short punchy lines
  const extractHooksSimple = (text) => {
    const hooks = [];
    const lines = text.split("\n");
    let category = "Hooks";
    for (const line of lines) {
      const clean = line.replace(/\*\*/g, "").replace(/[*_`]/g, "").trim();
      if (clean.match(/^(CATEGORY|##)\s*\d*/i) && clean.length < 80) {
        category = clean.replace(/^(CATEGORY|##)\s*\d*[:.]\s*/i, "").trim() || category;
        continue;
      }
      const labeled = clean.match(/^(?:Hook|Option)\s*\d+[:.]\s*(.+)/i);
      if (labeled) { const t = labeled[1].replace(/^["']|["']$/g, "").trim(); if (t.length > 8) hooks.push({ category, text: t, phase: "" }); continue; }
      const quoted = clean.match(/^["'](.{8,120})["']$/);
      if (quoted) { hooks.push({ category, text: quoted[1].trim(), phase: "" }); continue; }
      const bulletQ = clean.match(/^[-•]\s*["'](.{8,120})["']/);
      if (bulletQ) { hooks.push({ category, text: bulletQ[1].trim(), phase: "" }); }
    }
    return hooks;
  };

  const saveParsedHooks = () => {
    const lastSubstantive = [...msgs].reverse().find(m =>
      m.role === "assistant" && m.content && m.content.length > 100
    );
    if (!lastSubstantive) return;
    const firstUserMsg = msgs.find(m => m.role === "user");
    const sourceAd = firstUserMsg?.content?.slice(0, 80) || "Dissected ad";
    const brand = context ? context.split("\n")[0].slice(0, 40) : "";
    let hooks = parseHooksFromResponse(lastSubstantive.content);
    if (hooks.length === 0) hooks = extractHooksSimple(lastSubstantive.content);
    if (hooks.length === 0) {
      hooks = [{ category: "Full response", text: lastSubstantive.content, phase: "" }];
    }
    onSaveHooks(sourceAd, "Dissect", hooks, brand);
    setSavedHooks(true);
    setTimeout(() => setSavedHooks(false), 3000);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid " + C.border, background: C.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.mid, display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0 }}>
            <Icon name="back" size={14} /> Back
          </button>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cfg.label}</span>
          </div>
          {context && <div style={{ fontSize: 11, color: C.green, background: C.greenL, border: "1px solid " + C.greenB, borderRadius: 5, padding: "2px 7px" }}>Context active</div>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {mode === "dissect" && msgs.some(m => m.role === "assistant" && m.content.length > 200) && (
            <button onClick={saveParsedHooks} style={{ display: "flex", alignItems: "center", gap: 4, background: savedHooks ? C.greenL : C.orangeL, border: "1px solid " + (savedHooks ? C.greenB : C.orangeB), borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: savedHooks ? C.green : C.orange, fontWeight: 600, transition: "all 0.2s" }}>
              <Icon name={savedHooks ? "check" : "creative"} size={12} /> {savedHooks ? "Saved!" : "Save to library"}
            </button>
          )}
          <button onClick={newSession} style={{ display: "flex", alignItems: "center", gap: 4, background: C.warm, border: "1px solid " + C.border, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: C.mid }}>
            <Icon name="new" size={12} /> New session
          </button>
          <button onClick={copySession} style={{ display: "flex", alignItems: "center", gap: 4, background: C.warm, border: "1px solid " + C.border, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: C.mid }}>
            <Icon name="copy" size={12} /> Copy session
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 4px" }}>
        {msgs.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} imgPreview={m.img?.preview} />
        ))}
        {loading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: "4px 16px 16px 16px", padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: 8, color: C.dim, fontSize: 13 }}>
              <Dots /> {mode === "dissect" && dissectPhase === "p2" ? "Building your brand's version..." : "Analysing..."}
            </div>
          </div>
        )}
        {showBrandPrompt && (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10, paddingLeft: 2 }}>
            <button onClick={showBrandVersion} style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="creative" size={13} /> Yes — show me my brand's version
            </button>
            <span style={{ fontSize: 12, color: C.dim }}>or type a follow-up</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        onSend={send}
        loading={loading}
        imgUpload={cfg.imgUpload && dissectPhase === "p1"}
        placeholder={showBrandPrompt ? "Type yes, or ask a follow-up question..." : cfg.ph}
      />
    </div>
  );
}


// ─── HOOK LIBRARY SCREEN ─────────────────────────────────────────────────────
function HookLibrary({ library, onDeleteEntry, onDeleteHook, onBack, onBriefHook }) {
  const [search, setSearch] = useState("");
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Phase filter removed — hooks aren't tagged with phases in practice

  const filtered = library.filter(entry =>
    !search || entry.sourceAd.toLowerCase().includes(search.toLowerCase()) ||
    entry.hooks.some(h => h.text.toLowerCase().includes(search.toLowerCase()) || h.category.toLowerCase().includes(search.toLowerCase()))
  );

  const downloadAll = () => {
    const lines = ["THE INTEL ROOM — HOOK LIBRARY", "Generated: " + new Date().toLocaleDateString(), "", ""];
    library.forEach(entry => {
      lines.push("═══════════════════════════════════");
      lines.push("SOURCE: " + entry.sourceAd);
      lines.push("BRAND: " + (entry.brand || "Not specified"));
      lines.push("SAVED: " + new Date(entry.savedAt).toLocaleDateString());
      lines.push("");
      const byCategory = {};
      entry.hooks.forEach(h => {
        if (!byCategory[h.category]) byCategory[h.category] = [];
        byCategory[h.category].push(h);
      });
      Object.entries(byCategory).forEach(([cat, hooks]) => {
        lines.push(cat.toUpperCase());
        hooks.forEach(h => {
          lines.push("  • " + h.text + (h.phase ? " [" + h.phase + "]" : ""));
        });
        lines.push("");
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "hook-library.txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const lines = [];
    library.forEach(entry => {
      lines.push("SOURCE: " + entry.sourceAd);
      entry.hooks.forEach(h => lines.push("• " + h.text + (h.phase ? " [" + h.phase + "]" : "")));
      lines.push("");
    });
    copyText(lines.join("\n"));
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid " + C.border, background: C.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.mid, display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0 }}>
            <Icon name="back" size={14} /> Back
          </button>
          <div style={{ width: 1, height: 14, background: C.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.orange }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Hook Library</span>
            <span style={{ fontSize: 12, color: C.dim, background: C.warm, border: "1px solid " + C.border, borderRadius: 5, padding: "1px 7px" }}>{library.reduce((n, e) => n + e.hooks.length, 0)} hooks</span>
          </div>
        </div>
        {library.length > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={copyAll} style={{ display: "flex", alignItems: "center", gap: 4, background: C.warm, border: "1px solid " + C.border, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: C.mid }}>
              <Icon name="copy" size={12} /> Copy all
            </button>
            <button onClick={downloadAll} style={{ display: "flex", alignItems: "center", gap: 4, background: C.orangeL, border: "1px solid " + C.orangeB, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: C.orange, fontWeight: 600 }}>
              <Icon name="file" size={12} /> Download .txt
            </button>
          </div>
        )}
      </div>

      {library.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.dim, padding: 32, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.orangeL, border: "1px solid " + C.orangeB, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="creative" size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.mid }}>No saved hooks yet</div>
          <div style={{ fontSize: 13, color: C.dim, maxWidth: 300 }}>Run Dissect on any ad, get the brand hook categories, then hit "Save hooks" to build your library.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {/* Search */}
          <div style={{ marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hooks..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid " + C.border, borderRadius: 8, padding: "7px 11px", fontSize: 13, color: C.text, background: C.surface, outline: "none", fontFamily: "inherit" }} />
          </div>

          {/* Entries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(entry => {
              const isExpanded = expandedEntry === entry.id;
              const visibleHooks = entry.hooks.filter(h =>
                !search || h.text.toLowerCase().includes(search.toLowerCase()) || h.category.toLowerCase().includes(search.toLowerCase())
              );
              if (visibleHooks.length === 0) return null;

              // Group by category
              const byCategory = {};
              visibleHooks.forEach(h => {
                if (!byCategory[h.category]) byCategory[h.category] = [];
                byCategory[h.category].push(h);
              });

              return (
                <div key={entry.id} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden" }}>
                  {/* Entry header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: isExpanded ? "1px solid " + C.border : "none", cursor: "pointer" }} onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Source</div>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.sourceAd}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        {entry.brand && <span style={{ fontSize: 11, background: C.goldL, color: C.gold, border: "1px solid #e0cf9a", borderRadius: 4, padding: "1px 6px" }}>{entry.brand}</span>}
                        <span style={{ fontSize: 11, background: C.warm, color: C.dim, border: "1px solid " + C.border, borderRadius: 4, padding: "1px 6px" }}>{visibleHooks.length} hooks</span>
                        <span style={{ fontSize: 11, color: C.dim }}>{new Date(entry.savedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); onDeleteEntry(entry.id); }} style={{ background: "none", border: "1px solid " + C.redB, borderRadius: 6, padding: "3px 7px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center" }}><Icon name="trash" size={11} /></button>
                      <div style={{ color: C.dim, fontSize: 14, display: "flex", alignItems: "center" }}>{isExpanded ? "▲" : "▼"}</div>
                    </div>
                  </div>

                  {/* Hooks by category */}
                  {isExpanded && (
                    <div style={{ padding: "10px 14px 14px" }}>
                      {Object.entries(byCategory).map(([cat, catHooks]) => (
                        <div key={cat} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>{cat}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {catHooks.map((hook, hi) => {
                              const globalIdx = entry.hooks.indexOf(hook);
                              return (
                                <div key={hi} style={{ background: C.orangeL, border: "1px solid " + C.orangeB, borderRadius: 9, padding: "9px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, fontStyle: "italic" }}>"{hook.text}"</div>
                                    {hook.phase && <div style={{ fontSize: 11, color: C.orange, marginTop: 4, fontWeight: 500 }}>{hook.phase}</div>}
                                  </div>
                                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                    <button onClick={() => copyText(hook.text)} title="Copy hook" style={{ background: "none", border: "1px solid " + C.orangeB, borderRadius: 5, padding: "3px 7px", cursor: "pointer", color: C.orange, display: "flex", alignItems: "center" }}><Icon name="copy" size={11} /></button>
                                    <button onClick={() => onBriefHook(hook, entry)} title="Brief this hook" style={{ background: C.orange, border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Brief →</button>
                                    <button onClick={() => onDeleteHook(entry.id, globalIdx)} title="Delete hook" style={{ background: "none", border: "1px solid " + C.redB, borderRadius: 5, padding: "3px 7px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center" }}><Icon name="trash" size={11} /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Copy category */}
                          <button onClick={() => copyText(catHooks.map(h => "• " + h.text).join("\n"))} style={{ marginTop: 5, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.dim, padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="copy" size={11} /> Copy {cat}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
const MODES = [
  { id: "launch",  label: "Launch",  color: C.blue,   bg: C.blueL,   bdr: C.blueB,   icon: "launch",  tagline: "Build the architecture before you spend", desc: "AI guides you through account status, economics, budget split, hypotheses, and success thresholds — before a single dollar goes out.", chips: ["New vs existing account", "AOV to CPA", "Campaign tree", "Hypotheses"] },
  { id: "diagnose",label: "Diagnose",color: C.purple, bg: C.purpleL, bdr: C.purpleB, icon: "diagnose", tagline: "Read the data. Find where it broke.", desc: "Paste metrics in any format. Layer-by-layer funnel analysis, a verdict per concept, and a structured block to send back to The Creative Room.", chips: ["Any data format", "Thumbstop to Hold to CTR", "Scale / Iterate / Kill", "Creative Room block"] },
  { id: "report",  label: "Report",  color: C.green,  bg: C.greenL,  bdr: C.greenB,  icon: "report",  tagline: "Turn diagnosis into a decision log.", desc: "Internal performance report. What happened, what the patterns mean, what to do next.", chips: ["Builds from Diagnose", "Performance snapshot", "Pattern tracking", "Next steps"] },
  { id: "dissect", label: "Dissect", color: C.orange, bg: C.orangeL, bdr: C.orangeB, icon: "dissect", tagline: "Reverse-engineer any ad that's working.", desc: "Upload a screenshot or describe what you saw. Full breakdown plus Phase 1 vs Phase 2 strategic fit assessment — then your brand's version with a ready-to-send Creative Room brief.", chips: ["Image upload", "Strategic phase assessment", "Part 2 always fires", "Brief for Creative Room"] },
];

function Home({ onMode, context, onContext, brands, onSaveBrand, onDeleteBrand, sessions, hookCount, onViewLibrary }) {
  const [showCtx, setShowCtx] = useState(false);
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 18px 40px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>The Intel Room</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>What does the data say?</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {context && <div style={{ fontSize: 11, color: C.green, background: C.greenL, border: "1px solid " + C.greenB, borderRadius: 6, padding: "3px 8px", fontWeight: 500 }}>Context active</div>}
              <button onClick={onViewLibrary} style={{ display: "flex", alignItems: "center", gap: 5, background: hookCount > 0 ? C.orangeL : C.warm, border: "1px solid " + (hookCount > 0 ? C.orangeB : C.border), borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: hookCount > 0 ? C.orange : C.dim, whiteSpace: "nowrap" }}>
                <Icon name="creative" size={12} /> Hook Library{hookCount > 0 ? " (" + hookCount + ")" : ""}
              </button>
              <button onClick={() => setShowCtx(s => !s)} style={{ display: "flex", alignItems: "center", gap: 5, background: context ? C.greenL : C.warm, border: "1px solid " + (context ? C.greenB : C.border), borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: context ? C.green : C.mid, whiteSpace: "nowrap" }}>
                {context ? <><Icon name="check" size={12} /> Manage context</> : <><Icon name="context" size={12} /> Add brand context</>}
              </button>
            </div>
          </div>
          <div style={{ padding: "13px 16px", background: C.surface, border: "1px solid " + C.border, borderRadius: 11 }}>
            <p style={{ fontSize: 13, color: C.mid, margin: 0, lineHeight: 1.7 }}>
              The Intel Room is where performance becomes decisions. <strong style={{ color: C.text }}>Plan test architecture</strong> before you spend. <strong style={{ color: C.text }}>Diagnose what the data means</strong> after you do. <strong style={{ color: C.text }}>Report what happened</strong> for yourself or your team. <strong style={{ color: C.text }}>Dissect any ad</strong> catching your eye to extract what is transferable to your brand.
            </p>
          </div>
        </div>

        {showCtx && <ContextPanel context={context} onContext={onContext} brands={brands} onSaveBrand={onSaveBrand} onDeleteBrand={onDeleteBrand} onClose={() => setShowCtx(false)} />}

        {Object.values(sessions).some(s => s.length > 1) && (
          <div style={{ marginBottom: 14, padding: "9px 13px", background: C.blueL, border: "1px solid " + C.blueB, borderRadius: 9, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.blue }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, flexShrink: 0 }} />
            Active: {Object.entries(sessions).filter(([, s]) => s.length > 1).map(([k]) => MODE_CFG[k].label).join(", ")} — conversations saved
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MODES.map(m => {
            const hasSession = sessions[m.id]?.length > 1;
            return (
              <button key={m.id} onClick={() => onMode(m.id)}
                style={{ background: C.surface, border: "1px solid " + (hasSession ? m.color + "60" : C.border), borderRadius: 13, padding: "16px 18px", cursor: "pointer", textAlign: "left", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.boxShadow = "0 2px 16px " + m.color + "20"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = hasSession ? m.color + "60" : C.border; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: m.color, borderRadius: "13px 0 0 13px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", color: m.color }}><Icon name={m.icon} size={13} /></div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.label}</span>
                      <span style={{ fontSize: 12, color: m.color, fontWeight: 500 }}>&#8212; {m.tagline}</span>
                      {hasSession && <span style={{ fontSize: 10, background: m.bg, color: m.color, border: "1px solid " + m.bdr, borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>IN PROGRESS</span>}
                    </div>
                    <p style={{ fontSize: 13, color: C.mid, margin: "0 0 9px", lineHeight: 1.55 }}>{m.desc}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {m.chips.map((ch, ci) => <span key={ci} style={{ fontSize: 11, background: m.bg, color: m.color, border: "1px solid " + m.bdr, borderRadius: 5, padding: "2px 7px", fontWeight: 500 }}>{ch}</span>)}
                    </div>
                  </div>
                  <span style={{ color: C.dim, fontSize: 16 }}>&#8594;</span>
                </div>
              </button>
            );
          })}
        </div>


      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const submit = () => { if (name.trim()) onComplete(name.trim()); };
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, padding: 24 }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 5 }}>{[C.blue, C.purple, C.green, C.orange].map((col, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: col, opacity: 0.8 }} />)}</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>The Intel Room</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: "0 0 12px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Where performance<br />becomes decisions.</h1>
        <p style={{ fontSize: 14, color: C.mid, margin: "0 0 28px", lineHeight: 1.7, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>Plan test architecture before you spend. Diagnose what the data means. Report what happened. Dissect any ad catching your eye.</p>
        <div style={{ background: C.surface, border: "1px solid " + (focused ? C.text : C.border), borderRadius: 12, padding: "14px 16px", marginBottom: 12, transition: "border-color 0.2s", textAlign: "left" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.mid, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>What is your name?</label>
          <input value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Your name or your team's name..." style={{ width: "100%", border: "none", outline: "none", fontSize: 15, color: C.text, background: "transparent", fontFamily: "inherit" }} />
        </div>
        <button onClick={submit} disabled={!name.trim()} style={{ width: "100%", background: name.trim() ? C.text : C.border, color: name.trim() ? "#fff" : C.dim, border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          Enter the Intel Room &#8594;
        </button>
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12 }}>No login required. Works standalone or alongside The Strategy Room and The Creative Room.</p>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
function makeStarter(mode, context) {
  const cfg = MODE_CFG[mode];
  return [{ role: "assistant", content: (context ? "**Brand context loaded.**\n\n" : "") + cfg.starter }];
}

export default function TheIntelRoom() {
  const [screen, setScreen] = useState("onboarding");
  const [mode, setMode] = useState(null);
  const [context, setContext] = useState("");
  const { brands, save: saveBrand, remove: deleteBrand } = useBrands();
  const { library, saveHooks, deleteEntry, deleteHook } = useHookLibrary();
  const [sessions, setSessions] = useState({
    launch: makeStarter("launch", ""),
    diagnose: makeStarter("diagnose", ""),
    report: makeStarter("report", ""),
    dissect: makeStarter("dissect", ""),
  });
  // For "Brief this hook" — sets a prefilled message and opens Dissect
  const [briefHook, setBriefHook] = useState(null);

  const setModeSession = (m, msgs) => setSessions(prev => ({ ...prev, [m]: msgs }));

  const goToMode = (m) => {
    const session = sessions[m];
    if (session.length === 1) setModeSession(m, makeStarter(m, context));
    setMode(m); setScreen("mode");
  };

  const handleBriefHook = (hook, entry) => {
    // Pre-populate dissect with a brief request for this specific hook
    const briefRequest = "Give me the Creative Room brief for this hook:\n\n\"" + hook.text + "\"\n\nSource: " + entry.sourceAd + (hook.phase ? "\nPhase: " + hook.phase : "");
    const starter = [
      { role: "assistant", content: "Brand context loaded.\n\n" + MODE_CFG.dissect.starter },
      { role: "user", content: briefRequest },
    ];
    setModeSession("dissect", starter);
    setBriefHook(hook);
    setMode("dissect");
    setScreen("mode");
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: C.bg }}>
      <style>{`* { box-sizing: border-box; } button, textarea, input { font-family: inherit; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e8e2d9; border-radius: 3px; } @keyframes dot { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }`}</style>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {screen === "onboarding" && <Onboarding onComplete={() => setScreen("home")} />}
        {screen === "home" && <Home onMode={goToMode} context={context} onContext={setContext} brands={brands} onSaveBrand={saveBrand} onDeleteBrand={deleteBrand} sessions={sessions} hookCount={library.reduce((n, e) => n + e.hooks.length, 0)} onViewLibrary={() => setScreen("library")} />}
        {screen === "mode" && mode && <ModeChat mode={mode} onBack={() => { setMode(null); setScreen("home"); setBriefHook(null); }} context={context} msgs={sessions[mode]} setMsgs={(m) => setModeSession(mode, m)} onSaveHooks={saveHooks} onViewLibrary={() => { setMode(null); setScreen("library"); }} />}
        {screen === "library" && <HookLibrary library={library} onDeleteEntry={deleteEntry} onDeleteHook={deleteHook} onBack={() => setScreen("home")} onBriefHook={handleBriefHook} />}
      </div>
    </div>
  );
}
