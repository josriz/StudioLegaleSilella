import { corsHeaders } from "npm:@supabase/supabase-js@2.112.3/cors";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const MANUAL_URL = "https://raw.githubusercontent.com/josriz/StudioLegaleSilella/main/manuale.html";
const GEMINI_MODEL = "gemini-3.5-flash";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}
function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9àèéìòù]+/gi, " ").replace(/\s+/g, " ").trim();
}
function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
function buildContext(manual: string, question: string) {
  const q = normalize(question);
  const terms = [...new Set(q.split(" ").filter(t => t.length >= 3))];
  const rawBlocks = manual.split(/(?=<h[23][^>]*>)/i);
  const blocks = rawBlocks.map(stripHtml).map(x => x.trim()).filter(x => x.length >= 80);
  const scored = blocks.map((text, index) => {
    const n = normalize(text); let score = 0;
    for (const term of terms) if (n.includes(term)) score += term.length >= 7 ? 3 : 1;
    if (n.includes(q) && q.length > 10) score += 15;
    return { text, score, index };
  }).sort((a,b) => b.score-a.score || a.index-b.index);
  const selected: string[] = [];
  for (const item of scored) { if (item.score <= 0) continue; selected.push(item.text.slice(0,2200)); if (selected.length >= 8) break; }
  return selected.length ? selected.join("\n\n--- PASSAGGIO MANUALE ---\n\n") : "NESSUN PASSAGGIO RILEVANTE TROVATO NEL MANUALE.";
}
async function authorizedUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim(); if (!token) return null;
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !secretKey) throw new Error("Configurazione backend Supabase incompleta.");
  const admin = createClient(url, secretKey, { auth: { autoRefreshToken:false, persistSession:false } });
  const { data:userData, error:userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return null;
  const { data:profile, error:profileError } = await admin.from("studio_utenti").select("role").eq("user_id",userData.user.id).maybeSingle();
  if (profileError || !["studio","admin"].includes(profile?.role)) return null;
  return userData.user;
}
async function callGemini(question: string, history: Array<{role:string;content:string}>, context: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY"); if (!apiKey) throw new Error("GEMINI_API_KEY non configurata.");
  const contents = [...history.slice(-6).map(item => ({ role:item.role==="assistant"?"model":"user", parts:[{text:String(item.content).slice(0,1800)}] })), {role:"user",parts:[{text:question}]}];
  const systemInstruction = `Sei "Assistente Operativo Studio Legale Silella".
Rispondi esclusivamente come assistente all USO DEL GESTIONALE, non come consulente legale.
La tua unica fonte autorizzata è il MANUALE OPERATIVO fornito nel contesto.
Non inventare menu, pulsanti, campi, URL, funzioni o procedure.
Quando la risposta è presente, indica in modo operativo: DOVE → COSA CLICCARE → COSA COMPILARE → COSA CONTROLLARE → RISULTATO.
Se il contesto non contiene una risposta sufficientemente sicura, rispondi chiaramente: "Non trovo nel Manuale Operativo una procedura sufficientemente sicura per questa richiesta. Non voglio inventare una risposta."
Puoi poi indicare quale parola o area del manuale conviene cercare.
Non eseguire, simulare o dichiarare di aver eseguito operazioni sui dati.
Non affermare mai che un invio PEC, deposito PCT, firma digitale o altra trasmissione esterna è avvenuta se il manuale non lo documenta come operazione reale.
Mantieni le risposte brevi ma complete e in italiano.

CONTESTO DEL MANUALE:
__CONTEXT__`;
  const prompt = systemInstruction.replace("__CONTEXT__", context);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method:"POST", headers:{"x-goog-api-key":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({system_instruction:{parts:[{text:prompt}]},contents,generationConfig:{maxOutputTokens:700}})
  });
  const body = await response.json();
  if (!response.ok) { console.error("Gemini error",response.status,body?.error?.message||"unknown"); throw new Error("Il servizio IA non ha risposto correttamente."); }
  const text = body?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||"").join("").trim();
  if (!text) throw new Error("Risposta IA vuota.");
  return text;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  if (req.method !== "POST") return json({error:"Metodo non consentito."},405);
  try {
    const user = await authorizedUser(req); if (!user) return json({error:"Accesso Studio richiesto."},401);
    const body = await req.json().catch(()=>null);
    const question = String(body?.message||"").trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    if (!question) return json({error:"Scrivi una domanda."},400);
    if (question.length > 1200) return json({error:"La domanda è troppo lunga."},400);
    const manualResponse = await fetch(MANUAL_URL,{headers:{"User-Agent":"StudioLegaleSilella-Assistente/1.0"}});
    if (!manualResponse.ok) throw new Error("Manuale Operativo non raggiungibile.");
    const context = buildContext(await manualResponse.text(),question);
    const answer = await callGemini(question,history,context);
    return json({answer,source:"Manuale Operativo Online — Studio Legale Silella"});
  } catch(error) {
    console.error("studio-assistente-manuale:",error);
    return json({error:error instanceof Error?error.message:"Errore interno dell assistente."},500);
  }
});