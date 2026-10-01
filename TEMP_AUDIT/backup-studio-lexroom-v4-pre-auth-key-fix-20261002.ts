import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const URL=Deno.env.get("SUPABASE_URL")!, KEY=Deno.env.get("SUPABASE_SECRET_KEYS")!;
const supabase=createClient(URL,KEY);
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","content-type":"application/json"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return out({ok:true}); if(req.method!=="POST")return out({ok:false,error:"Metodo non consentito"},405);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim(); if(!token)return out({ok:false,error:"Autenticazione richiesta"},401);
 const {data:{user},error:ue}=await supabase.auth.getUser(token); if(ue||!user)return out({ok:false,error:"Sessione non valida"},401);
 const {data:role}=await supabase.from("studio_utenti").select("role").eq("user_id",user.id).maybeSingle(); if(!role||!["studio","admin"].includes(role.role))return out({ok:false,error:"Funzione riservata allo Studio"},403);
 const body=await req.json(), practiceId=String(body.practiceId||""), action=String(body.action||"analyze");
 if(!practiceId)return out({ok:false,error:"practiceId obbligatorio"},400);
 const {data:practice,error:pe}=await supabase.from("studio_pratiche").select("*").eq("id",practiceId).single(); if(pe||!practice)return out({ok:false,error:"Pratica non trovata"},404);
 if(action==="approve"){
   const {data:draft,error:de}=await supabase.from("studio_bozze").select("*").eq("pratica_id",practiceId).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(de||!draft)return out({ok:false,error:"Nessuna bozza da approvare"},400);
   const {data:approved,error:ae}=await supabase.from("studio_bozze").update({status:"approvata",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",draft.id).select("*").single();
   if(ae)return out({ok:false,error:ae.message},500);
   await supabase.from("studio_pratiche").update({status:"approvata",ai_status:"bozza_approvata"}).eq("id",practiceId);
   await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"bozza_approvata",details:{bozza_id:draft.id}});
   return out({ok:true,draft:approved});
 }
 if(action==="lab_send"){
   const to=String(body.to||""), subject=String(body.subject||"Comunicazione Studio Legale Silella");
   if(!to)return out({ok:false,error:"Destinatario obbligatorio"},400);
   const {data:draft,error:de}=await supabase.from("studio_bozze").select("*").eq("pratica_id",practiceId).eq("status","approvata").order("approved_at",{ascending:false}).limit(1).maybeSingle();
   if(de||!draft)return out({ok:false,error:"La pratica deve avere una bozza approvata prima di preparare l'invio."},400);
   const {data:comm,error:ce}=await supabase.from("studio_comunicazioni").insert({pratica_id:practiceId,bozza_id:draft.id,channel:"email",recipient:to,subject,body:draft.content,status:"da_inviare",created_by:user.id}).select("*").single();
   if(ce)return out({ok:false,error:ce.message},500);
   await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_comunicazione_preparata",details:{recipient:to,mode:"gratuita"}});
   return out({ok:true,communication:comm,text:"Comunicazione preparata in LAB. Nessuna email reale è stata inviata."});
 }
 if(action==="send_email"){
   const apiKey=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("RESEND_FROM_EMAIL"), to=String(body.to||""), subject=String(body.subject||"Comunicazione Studio Legale Silella");
   if(!apiKey||!from)return out({ok:false,error:"Invio email configurato ma mancano RESEND_API_KEY e/o RESEND_FROM_EMAIL nei secrets della funzione."},503);
   const {data:draft,error:de}=await supabase.from("studio_bozze").select("*").eq("pratica_id",practiceId).eq("status","approvata").order("approved_at",{ascending:false}).limit(1).maybeSingle();
   if(de||!draft)return out({ok:false,error:"La pratica deve avere una bozza approvata prima dell'invio."},400);
   if(!to)return out({ok:false,error:"Destinatario obbligatorio"},400);
   const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({from,to,subject,text:draft.content})});
   const rd=await rr.json().catch(()=>({})); if(!rr.ok)return out({ok:false,error:rd.message||"Invio email fallito"},502);
   const {data:comm,error:ce}=await supabase.from("studio_comunicazioni").insert({pratica_id:practiceId,bozza_id:draft.id,channel:"email",recipient:to,subject,body:draft.content,status:"inviata",external_id:rd.id||null,created_by:user.id,sent_at:new Date().toISOString()}).select("*").single();
   if(ce)return out({ok:false,error:ce.message},500);
   await supabase.from("studio_pratiche").update({status:"trasmessa"}).eq("id",practiceId);
   await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"email_inviata",details:{recipient:to,external_id:rd.id||null}});
   return out({ok:true,communication:comm});
 }
 const {data:docs}=await supabase.from("studio_documenti").select("id,file_name,mime_type,size_bytes,storage_path").eq("pratica_id",practiceId);
 const {data:models}=await supabase.from("studio_modelli").select("id,title,legal_area,content").eq("active",true).order("created_at",{ascending:false});
 if(action==="lab_analyze"||action==="lab_draft"){
   const {data:labModels}=await supabase.from("studio_modelli").select("id,title,legal_area,content").eq("active",true).order("created_at",{ascending:false});
   const modelNames=(labModels||[]).map((m:any)=>m.title).filter(Boolean);
   const docNames=(docs||[]).map((d:any)=>d.file_name).filter(Boolean);
   const labText=action==="lab_draft"
     ? `BOZZA LAB — SIMULAZIONE GRATUITA\n\nOggetto: ${practice.description}\n\nCliente: ${practice.client_name}\nControparte: ${practice.counterparty||"Non indicata"}\nMateria: ${practice.legal_area||"Non indicata"}\n\nDOCUMENTI PRESENTI: ${docNames.join(", ")||"Nessuno"}\nMODELLI DELLO STUDIO DISPONIBILI: ${modelNames.join(", ")||"Nessuno"}\n\nQuesta è una bozza dimostrativa generata dalla modalità LAB. Non contiene un'analisi giuridica automatica del contenuto dei documenti. I fatti, le norme e le fonti devono essere verificati dal professionista.\n\nSTRUTTURA PROPOSTA\n1. Premessa e oggetto della pratica\n2. Fatti rilevanti da verificare\n3. Documenti da esaminare\n4. Questioni giuridiche da approfondire\n5. Richieste/posizione del cliente\n6. Comunicazione da sottoporre alla revisione dell'Avvocato`
     : `ANALISI LAB — SIMULAZIONE GRATUITA\n\nPratica: ${practice.client_name}\nMateria: ${practice.legal_area||"Non indicata"}\nControparte: ${practice.counterparty||"Non indicata"}\nDescrizione: ${practice.description}\n\nDOCUMENTI PRESENTI\n${docNames.map((n:string)=>"• "+n).join("\\n")||"• Nessun documento"}\n\nMODELLI DELLO STUDIO\n${modelNames.map((n:string)=>"• "+n).join("\\n")||"• Nessun modello"}\n\nDATI DA VERIFICARE\n• Contenuto effettivo dei documenti\n• Date e scadenze\n• Importi\n• Identità e riferimenti delle parti\n• Norme e precedenti applicabili\n\nNOTA LAB\nQuesta analisi dimostrativa verifica il flusso software gratuitamente. Non è un'analisi giuridica AI e non sostituisce la revisione professionale.`;
   if(action==="lab_draft"){
     const {data:draft,error:de}=await supabase.from("studio_bozze").insert({pratica_id:practiceId,content:labText,status:"in_revisione",created_by:user.id}).select("*").single();
     if(de)return out({ok:false,error:de.message},500);
     await supabase.from("studio_pratiche").update({ai_status:"bozza_pronta",status:"revisione_studio"}).eq("id",practiceId);
     await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_bozza_generata",details:{mode:"gratuita",provider:"simulazione"}});
     return out({ok:true,draft,text:labText,mode:"lab"});
   }
   const {data:analysis,error:ae}=await supabase.from("studio_ai_analisi").insert({pratica_id:practiceId,status:"completata",summary:labText,provider:"lab_simulazione",model:"lab-gratuita",created_by:user.id,completed_at:new Date().toISOString()}).select("*").single();
   if(ae)return out({ok:false,error:ae.message},500);
   await supabase.from("studio_pratiche").update({ai_status:"analisi_completata",status:"revisione_studio"}).eq("id",practiceId);
   await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lab_analisi_completata",details:{mode:"gratuita",provider:"simulazione"}});
   return out({ok:true,analysis,text:labText,mode:"lab"});
 }
 const apiKey=Deno.env.get("OPENAI_API_KEY"); if(!apiKey)return out({ok:false,error:"Manca OPENAI_API_KEY nei secrets della funzione Lexroom."},503);
 const model=Deno.env.get("OPENAI_MODEL")||"gpt-5-mini";
 const prompt=action==="draft"
 ? `Sei Lexroom, assistente AI interno di uno studio legale. Genera una BOZZA, non un parere definitivo. Usa solo i dati forniti e i modelli dello Studio. Non inventare fatti o fonti. Segnala dati mancanti o da verificare. PRATICA: ${JSON.stringify(practice)} MODELLI: ${JSON.stringify(models)} DOCUMENTI: ${JSON.stringify(docs)}`
 : `Sei Lexroom, assistente AI interno di uno studio legale. Analizza la pratica in modo strutturato. Non inventare fatti o fonti. Indica dati, questioni, elementi mancanti e verifiche necessarie. PRATICA: ${JSON.stringify(practice)} MODELLI: ${JSON.stringify(models)} DOCUMENTI: ${JSON.stringify(docs)}`;
 const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${apiKey}`},body:JSON.stringify({model,input:prompt})});
 const data=await response.json().catch(()=>({})); if(!response.ok)return out({ok:false,error:"Provider AI: "+(data.error?.message||"errore")},502);
 const text=data.output_text||data.output?.map((x:any)=>x.content?.map((c:any)=>c.text||"").join("")).join("\n")||"";
 if(action==="draft"){
   const {data:draft,error:de}=await supabase.from("studio_bozze").insert({pratica_id:practiceId,content:text,status:"in_revisione",created_by:user.id}).select("*").single(); if(de)return out({ok:false,error:de.message},500);
   await supabase.from("studio_pratiche").update({ai_status:"bozza_pronta",status:"revisione_studio"}).eq("id",practiceId);
   await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lexroom_bozza_generata",details:{model}});
   return out({ok:true,draft,text});
 }
 const {data:analysis,error:ae}=await supabase.from("studio_ai_analisi").insert({pratica_id:practiceId,status:"completata",summary:text,provider:"openai",model,created_by:user.id,completed_at:new Date().toISOString()}).select("*").single(); if(ae)return out({ok:false,error:ae.message},500);
 await supabase.from("studio_pratiche").update({ai_status:"analisi_completata",status:"revisione_studio"}).eq("id",practiceId);
 await supabase.from("studio_audit").insert({pratica_id:practiceId,actor_user_id:user.id,event_type:"lexroom_analisi_completata",details:{model}});
 return out({ok:true,analysis,text});
});