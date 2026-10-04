import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const PUBLISHABLE_KEYS = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!);
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
const supabaseAdmin = createClient(URL, SECRET_KEYS["default"]);

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json"
};
const out = (x:any, s=200) => new Response(JSON.stringify(x), {status:s, headers:cors});

async function requireStudio(req:Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
  if(!token) throw new Response(JSON.stringify({ok:false,error:"Autenticazione richiesta"}), {status:401,headers:cors});
  const auth = createClient(URL, PUBLISHABLE_KEYS["default"], {global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user},error} = await auth.auth.getUser(token);
  if(error || !user) throw new Response(JSON.stringify({ok:false,error:"Sessione non valida"}), {status:401,headers:cors});
  const {data:role} = await supabaseAdmin.from("studio_utenti").select("role").eq("user_id",user.id).maybeSingle();
  if(!role || !["studio","admin"].includes(role.role)) throw new Response(JSON.stringify({ok:false,error:"Funzione riservata allo Studio"}), {status:403,headers:cors});
  return user;
}

function clean(v:any,max=12000){ return String(v ?? "").slice(0,max); }

async function gemini(prompt:string) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if(!key) return {error:"Manca GEMINI_API_KEY nei secrets della funzione. Il codice è pronto, ma serve la chiave gratuita di Google AI Studio."};
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{temperature:0.2,maxOutputTokens:3000}
    })
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) return {error:"Gemini: "+(data?.error?.message||"errore del provider")};
  const text = data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("\n").trim() || "";
  if(!text) return {error:"Gemini non ha restituito testo."};
  return {text,model};
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return out({ok:true});
  if(req.method!=="POST") return out({ok:false,error:"Metodo non consentito"},405);
  let user:any;
  try { user=await requireStudio(req); } catch(e) { return e; }

  try {
    const body=await req.json();
    const action=String(body.action||"analyze");
    const practiceId=String(body.practiceId||"");

    if(action==="rag_ai"){
      const query=clean(body.query,4000);
      if(!query) return out({ok:false,error:"Inserisci una domanda per la Ricerca RAG."},400);
      const [{data:models},{data:practices},{data:audit}] = await Promise.all([
        supabaseAdmin.from("studio_modelli").select("title,legal_area,content").eq("active",true).order("created_at",{ascending:false}).limit(30),
        supabaseAdmin.from("studio_pratiche").select("id,client_name,legal_area,counterparty,description,status").order("created_at",{ascending:false}).limit(30),
        supabaseAdmin.from("studio_audit").select("event_type,pratica_id,details,created_at").order("created_at",{ascending:false}).limit(80)
      ]);
      const result=await gemini(`Sei un assistente AI per uno studio legale italiano in ambiente LAB gratuito.
Rispondi alla domanda dell'avvocato usando ESCLUSIVAMENTE il contesto applicativo fornito. Non inventare norme, sentenze o fatti. Se manca una fonte, dichiaralo chiaramente. Distingui sempre tra dato presente, inferenza e verifica necessaria.
DOMANDA:
${query}
MODELLI DELLO STUDIO:
${JSON.stringify(models||[])}
FASCICOLI RECENTI:
${JSON.stringify(practices||[])}
AUDIT RECENTE:
${JSON.stringify(audit||[])}
Rispondi in italiano, in modo strutturato e operativo.`);
      if(result.error) return out({ok:false,error:result.error},503);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId||null,actor_user_id:user.id,event_type:"ai_rag_query",details:{model:result.model,query}});
      return out({ok:true,text:result.text,model:result.model});
    }

    if(action==="archive_ai"){
      const query=clean(body.query||"Analizza l'archivio recente e indica gli eventi più rilevanti.",5000);
      const {data:audit}=await supabaseAdmin.from("studio_audit").select("event_type,pratica_id,actor_user_id,details,created_at").order("created_at",{ascending:false}).limit(200);
      const result=await gemini(`Sei un assistente AI per l'archivio e audit trail di uno studio legale.
Analizza solo gli eventi forniti. Non inventare eventi. Evidenzia cronologia, anomalie, passaggi mancanti e punti da verificare.
RICHIESTA:
${query}
AUDIT:
${JSON.stringify(audit||[])}
Rispondi in italiano con sezioni: Sintesi, Eventi rilevanti, Anomalie/attenzioni, Verifiche consigliate.`);
      if(result.error) return out({ok:false,error:result.error},503);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId||null,actor_user_id:user.id,event_type:"ai_archive_analysis",details:{model:result.model,query}});
      return out({ok:true,text:result.text,model:result.model});
    }

    if(!practiceId && ["matter_ai","draft_ai","lab_analyze","lab_draft","approve","lab_send","send_email"].includes(action))
      return out({ok:false,error:"practiceId obbligatorio"},400);

    if(action==="approve"){
      const {data:draft}=await supabaseAdmin.from("studio_bozze").select("*").eq("pratica_id",practiceId).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(!draft) return out({ok:false,error:"Nessuna bozza da approvare"},400);
      const {data:approved,error}=await supabaseAdmin.from("studio_bozze").update({status:"approvata",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",draft.id).select("*").single();
      if(error) return out({ok:false,error:error.message},500);
      await supabaseAdmin.from("studio_pratiche").update({status:"approvata",ai_status:"bozza_approvata"}).eq("id",practiceId);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"bozza_approvata",details:{bozza_id:draft.id}});
      return out({ok:true,draft:approved,text:approved.content});
    }

    const {data:practice,error:pe}=await supabaseAdmin.from("studio_pratiche").select("*").eq("id",practiceId).single();
    if(pe||!practice) return out({ok:false,error:"Pratica non trovata"},404);
    const [{data:docs},{data:models}]=await Promise.all([
      supabaseAdmin.from("studio_documenti").select("id,file_name,mime_type,size_bytes,storage_path").eq("pratica_id",practiceId),
      supabaseAdmin.from("studio_modelli").select("id,title,legal_area,content").eq("active",true).order("created_at",{ascending:false}).limit(30)
    ]);

    if(action==="matter_ai" || action==="draft_ai"){
      const instructions=clean(body.instructions||"",6000);
      const prompt = action==="draft_ai"
        ? `Sei Lexroom, assistente AI interno di uno studio legale italiano. Genera una BOZZA da sottoporre obbligatoriamente alla revisione dell'avvocato. Non inventare fatti, norme, sentenze o documenti. Se un elemento non è disponibile, scrivi "DA VERIFICARE". Usa i modelli dello Studio solo come riferimento.
PRATICA:
${JSON.stringify(practice)}
DOCUMENTI DISPONIBILI:
${JSON.stringify(docs||[])}
MODELLI DELLO STUDIO:
${JSON.stringify(models||[])}
ISTRUZIONI DELL'AVVOCATO:
${instructions}
Produci una bozza professionale in italiano, con oggetto, fatti disponibili, questioni, impostazione e testo proposto. Indica chiaramente ciò che richiede verifica professionale.`
        : `Sei Lexroom, assistente AI interno di uno studio legale italiano. Analizza il fascicolo senza inventare fatti o fonti.
PRATICA:
${JSON.stringify(practice)}
DOCUMENTI DISPONIBILI:
${JSON.stringify(docs||[])}
MODELLI DELLO STUDIO:
${JSON.stringify(models||[])}
ISTRUZIONI:
${instructions}
Rispondi in italiano con: Sintesi del fascicolo; Fatti disponibili; Questioni giuridiche da approfondire; Informazioni/documenti mancanti; Verifiche consigliate. Specifica che si tratta di supporto AI e non di parere definitivo.`;
      const result=await gemini(prompt);
      if(result.error) return out({ok:false,error:result.error},503);
      if(action==="draft_ai"){
        const {data:draft,error}=await supabaseAdmin.from("studio_bozze").insert({pratica_id:practiceId,content:result.text,status:"in_revisione",created_by:user.id}).select("*").single();
        if(error) return out({ok:false,error:error.message},500);
        await supabaseAdmin.from("studio_pratiche").update({ai_status:"bozza_pronta",status:"revisione_studio"}).eq("id",practiceId);
        await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"gemini_bozza_generata",details:{model:result.model,mode:"free"}});
        return out({ok:true,draft,text:result.text,model:result.model});
      }
      const {data:analysis,error}=await supabaseAdmin.from("studio_ai_analisi").insert({pratica_id:practiceId,status:"completata",summary:result.text,provider:"google_gemini",model:result.model,created_by:user.id,completed_at:new Date().toISOString()}).select("*").single();
      if(error) return out({ok:false,error:error.message},500);
      await supabaseAdmin.from("studio_pratiche").update({ai_status:"analisi_completata",status:"revisione_studio"}).eq("id",practiceId);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"gemini_analisi_completata",details:{model:result.model,mode:"free"}});
      return out({ok:true,analysis,text:result.text,model:result.model});
    }

    if(action==="lab_analyze" || action==="lab_draft"){
      const docNames=(docs||[]).map((d:any)=>d.file_name).filter(Boolean);
      const modelNames=(models||[]).map((m:any)=>m.title).filter(Boolean);
      const labText=action==="lab_draft"
        ? `BOZZA LAB — SIMULAZIONE GRATUITA

Oggetto: ${practice.description}
Cliente: ${practice.client_name}
Controparte: ${practice.counterparty||"Non indicata"}
Materia: ${practice.legal_area||"Non indicata"}

DOCUMENTI: ${docNames.join(", ")||"Nessuno"}
MODELLI: ${modelNames.join(", ")||"Nessuno"}

Questa è una simulazione LAB. Il contenuto effettivo dei documenti, i fatti, le norme e le fonti devono essere verificati dal professionista.

STRUTTURA PROPOSTA
1. Premessa e oggetto
2. Fatti rilevanti da verificare
3. Documenti da esaminare
4. Questioni giuridiche
5. Posizione del cliente
6. Comunicazione da sottoporre alla revisione dell'Avvocato`
        : `ANALISI LAB — SIMULAZIONE GRATUITA

Pratica: ${practice.client_name}
Materia: ${practice.legal_area||"Non indicata"}
Controparte: ${practice.counterparty||"Non indicata"}
Descrizione: ${practice.description}

DOCUMENTI PRESENTI:
${docNames.map((n:string)=>"• "+n).join("\n")||"• Nessun documento"}

MODELLI DELLO STUDIO:
${modelNames.map((n:string)=>"• "+n).join("\n")||"• Nessun modello"}

Questa analisi verifica il flusso software gratuitamente e non è un'analisi giuridica AI.`;
      if(action==="lab_draft"){
        const {data:draft,error}=await supabaseAdmin.from("studio_bozze").insert({pratica_id:practiceId,content:labText,status:"in_revisione",created_by:user.id}).select("*").single();
        if(error)return out({ok:false,error:error.message},500);
        await supabaseAdmin.from("studio_pratiche").update({ai_status:"bozza_pronta",status:"revisione_studio"}).eq("id",practiceId);
        await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_bozza_generata",details:{mode:"gratuita",provider:"simulazione"}});
        return out({ok:true,draft,text:labText,mode:"lab"});
      }
      const {data:analysis,error}=await supabaseAdmin.from("studio_ai_analisi").insert({pratica_id:practiceId,status:"completata",summary:labText,provider:"lab_simulazione",model:"lab-gratuita",created_by:user.id,completed_at:new Date().toISOString()}).select("*").single();
      if(error)return out({ok:false,error:error.message},500);
      await supabaseAdmin.from("studio_pratiche").update({ai_status:"analisi_completata",status:"revisione_studio"}).eq("id",practiceId);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_analisi_completata",details:{mode:"gratuita",provider:"simulazione"}});
      return out({ok:true,analysis,text:labText,mode:"lab"});
    }

    if(action==="lab_send"){
      const to=clean(body.to,320),subject=clean(body.subject||"Comunicazione Studio Legale Silella",300);
      const {data:draft}=await supabaseAdmin.from("studio_bozze").select("*").eq("pratica_id",practiceId).eq("status","approvata").order("approved_at",{ascending:false}).limit(1).maybeSingle();
      if(!draft)return out({ok:false,error:"La pratica deve avere una bozza approvata prima di preparare l'invio."},400);
      const {data:comm,error}=await supabaseAdmin.from("studio_comunicazioni").insert({pratica_id:practiceId,bozza_id:draft.id,channel:"email",recipient:to,subject,body:draft.content,status:"da_inviare",created_by:user.id}).select("*").single();
      if(error)return out({ok:false,error:error.message},500);
      await supabaseAdmin.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_comunicazione_preparata",details:{recipient:to,mode:"gratuita"}});
      return out({ok:true,communication:comm,text:"Comunicazione preparata in LAB. Nessuna email reale è stata inviata."});
    }

    return out({ok:false,error:"Azione non riconosciuta"},400);
  } catch(e:any) {
    console.error(e);
    return out({ok:false,error:e?.message||"Errore interno"},500);
  }
});