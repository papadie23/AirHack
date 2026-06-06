/**
 * llm-dispatcher.ts — AI Analysis Engine for Airport Traffic Flow
 *
 * Uses the Google Gemini SDK when GEMINI_API_KEY is set in the environment.
 * Falls back to deterministic rule-based responses so the UI works without a key.
 *
 * Exposed surface:
 *   analyzeTraffic(snapshot, flights?)  → structured AnalysisReport
 *   chatQuery(userMessage, snapshot, history?)  → natural-language answer for staff
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TrafficSnapshot, ZoneReading } from "./video-flow";
import { snapshotSummary } from "./video-flow";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BottleneckAlert {
  zone: string;
  severity: "low" | "medium" | "high";
  message: string;
  suggestion: string;
}

export interface AnalysisReport {
  alerts: BottleneckAlert[];
  summary: string;
  generatedAt: string;
  source: "llm" | "rule-based";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Airport system prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ești un sistem AI de optimizare a fluxului de pasageri la Aeroportul Internațional Iași (LRIA / IAS).
Rolul tău este să asiste personalul operațional cu:
- Detecția și avertizarea timpurie pentru aglomerare în zone cheie (porți, sosiri, securitate)
- Sugestii operaționale concrete pentru redistribuirea fluxului
- Răspunsuri clare și concise la întrebările personalului

Zone monitorizate:
• Poarta — capacitate 120 persoane
• Check In — capacitate 80 persoane
• Zona Sosiri (Disembarcare) — capacitate 200 persoane

Praguri de alertă: AVERTISMENT la 65%, CRITIC la 85% din capacitate.

Răspunde ÎNTOTDEAUNA în limba română. Fii concis și orientat pe acțiune.
Evită jargonul tehnic inutil. Personalul are nevoie de instrucțiuni clare.`;

// ── Rule-based fallback (no API key) ─────────────────────────────────────────

function ruleBasedAnalysis(snapshot: TrafficSnapshot): AnalysisReport {
  const alerts: BottleneckAlert[] = [];

  for (const r of snapshot.readings) {
    const pct = r.count / r.capacity;

    if (r.alertLevel === "critical") {
      alerts.push({
        zone: r.label,
        severity: "high",
        message: `CRITIC: ${r.label} este la ${Math.round(pct * 100)}% din capacitate (${r.count}/${r.capacity} persoane).`,
        suggestion: getSuggestion(r),
      });
    } else if (r.alertLevel === "warning") {
      alerts.push({
        zone: r.label,
        severity: "medium",
        message: `AVERTISMENT: ${r.label} se apropie de capacitate (${Math.round(pct * 100)}%).`,
        suggestion: getSuggestion(r),
      });
    }
  }

  const criticalZones = alerts.filter(a => a.severity === "high").map(a => a.zone);
  const warnZones     = alerts.filter(a => a.severity === "medium").map(a => a.zone);

  let summary = "Toate zonele funcționează la parametri normali.";
  if (criticalZones.length > 0) {
    summary = `SITUAȚIE CRITICĂ în: ${criticalZones.join(", ")}. Intervenție imediată necesară.`;
  } else if (warnZones.length > 0) {
    summary = `Aglomerare moderată în: ${warnZones.join(", ")}. Monitorizare atentă recomandată.`;
  }

  return {
    alerts,
    summary,
    generatedAt: new Date().toISOString(),
    source: "rule-based",
  };
}

function getSuggestion(r: ZoneReading): string {
  switch (r.zoneId) {
    case "gate1":
      return "Redirecționați pasagerii spre zona de așteptare din hol. Activați Poarta 1B dacă disponibilă.";
    case "gate2":
      return "Alertați personalul de la Check In. Deschideți ghișee suplimentare sau redirecționați pasagerii spre self check-in.";
    case "disembark":
      return "Măriți numărul de agenți la Controlul Pașapoartelor. Anunțați pasagerii care așteaptă bagajele să rămână în zona caruselului.";
    default:
      return "Contactați supervizorul operațional pentru instrucțiuni.";
  }
}

// ── Gemini client ─────────────────────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_genAI) _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

// ── analyzeTraffic ─────────────────────────────────────────────────────────────

export async function analyzeTraffic(
  snapshot: TrafficSnapshot,
  flightContext?: string,
): Promise<AnalysisReport> {
  const genAI = getGenAI();
  const ruleReport = ruleBasedAnalysis(snapshot);

  if (!genAI) return ruleReport;

  const situationText = snapshotSummary(snapshot);
  const flightLine = flightContext ? `\nContext zboruri: ${flightContext}` : "";

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = `Analizează situația curentă și generează un raport operațional JSON cu câmpurile:
- "alerts": array de { zone, severity (low/medium/high), message, suggestion }
- "summary": string rezumat executiv (max 2 propoziții)

${situationText}${flightLine}

Returnează DOAR JSON valid, fără text suplimentar.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim()) as {
      alerts: BottleneckAlert[];
      summary: string;
    };

    return {
      alerts: parsed.alerts ?? ruleReport.alerts,
      summary: parsed.summary ?? ruleReport.summary,
      generatedAt: new Date().toISOString(),
      source: "llm",
    };
  } catch {
    return { ...ruleReport, source: "rule-based" };
  }
}

// ── chatQuery ─────────────────────────────────────────────────────────────────

export async function chatQuery(
  userMessage: string,
  snapshot: TrafficSnapshot,
  history: ChatMessage[] = [],
): Promise<string> {
  const genAI = getGenAI();
  const situationText = snapshotSummary(snapshot);

  if (!genAI) {
    // Deterministic mock replies based on keywords
    const msg = userMessage.toLowerCase();
    if (msg.includes("poarta") || msg.includes("gate")) {
      const r = snapshot.readings.find(x => x.zoneId === "gate1");
      return r
        ? `Poarta: ${r.count}/${r.capacity} persoane (${Math.round(r.count/r.capacity*100)}%) — stare: ${r.alertLevel}.`
        : "Date indisponibile momentan pentru Poartă.";
    }
    if (msg.includes("check in") || msg.includes("checkin")) {
      const r = snapshot.readings.find(x => x.zoneId === "gate2");
      return r
        ? `Check In: ${r.count}/${r.capacity} persoane (${Math.round(r.count/r.capacity*100)}%) — stare: ${r.alertLevel}.`
        : "Date indisponibile momentan pentru Check In.";
    }
    if (msg.includes("sosiri") || msg.includes("disembarc") || msg.includes("disembark")) {
      const r = snapshot.readings.find(x => x.zoneId === "disembark");
      return r
        ? `Zona Sosiri: ${r.count}/${r.capacity} persoane (${Math.round(r.count/r.capacity*100)}%) — stare: ${r.alertLevel}.`
        : "Date indisponibile pentru Zona Sosiri.";
    }
    if (msg.includes("critic") || msg.includes("urgent") || msg.includes("aglomera")) {
      const critical = snapshot.readings.filter(r => r.alertLevel === "critical");
      if (critical.length === 0) return "Nicio zonă critică în acest moment. Fluxul este la parametri normali.";
      return `Zone critice: ${critical.map(r => r.label).join(", ")}. Contactați supervizorul imediat.`;
    }
    return `Date curente: ${snapshot.readings.map(r => `${r.label}: ${r.count} persoane`).join("; ")}. [Mod demo — configurați GEMINI_API_KEY pentru răspunsuri AI complete.]`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build Gemini chat history (last 6 turns, alternating user/model)
    const recentHistory = history.slice(-6);
    const geminiHistory = recentHistory.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    const messageWithContext = `Situație curentă în aeroport:\n${situationText}\n\nÎntrebare operator: ${userMessage}`;
    const result = await chat.sendMessage(messageWithContext);
    return result.response.text();
  } catch (err) {
    return `Serviciul AI temporar indisponibil. Verificați manual zonele afișate pe dashboard. (${String(err)})`;
  }
}
