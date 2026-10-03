import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
let SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!SERVICE_KEY && rawSecretKeys) {
  try {
    const parsed = JSON.parse(rawSecretKeys);
    SERVICE_KEY = parsed.default || Object.values(parsed)[0] || "";
  } catch (_) {}
}
if (!SERVICE_KEY) throw new Error("Chiave server Supabase non configurata");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
  status, headers: {"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type"}
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ok:true});
  if (req.method !== "POST") return json({ok:false,error:"Metodo non consentito"},405);

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i,"").trim();
  if (!token) return json({ok:false,error:"Autenticazione richiesta"},401);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ok:false,error:"Sessione non valida"},401);
  const user = userData.user;

  const form = await req.formData();
  const clientName = String(form.get("clientName") || "").trim();
  const taxId = String(form.get("taxId") || "").trim();
  const legalArea = String(form.get("legalArea") || "").trim();
  const counterparty = String(form.get("counterparty") || "").trim();
  const description = String(form.get("description") || "").trim();

  if (!clientName || !taxId || !description) {
    return json({ok:false,error:"Nome, codice fiscale/P.IVA e descrizione sono obbligatori"},400);
  }

  const { data: client, error: clientError } = await supabase
    .from("studio_clienti").select("id,full_name,tax_id").eq("user_id", user.id).maybeSingle();
  if (clientError) return json({ok:false,error:"Impossibile individuare il cliente: "+clientError.message},500);
  if (!client) return json({ok:false,error:"Cliente non presente in Rubrica Clienti"},400);

  const { data: practice, error: insertError } = await supabase
    .from("studio_pratiche").insert({
      client_id: client.id, client_name: clientName, tax_id: taxId, legal_area: legalArea || null,
      counterparty: counterparty || null, description, status:"nuova",
      intake_source:"portale", owner_user_id:null, client_user_id:user.id, ai_status:"non_avviata"
    }).select("*").single();
  if (insertError) return json({ok:false,error:insertError.message},500);

  const uploaded:string[]=[]; const documentRows:any[]=[];
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File) || !entry.size) continue;
    if (entry.size > 10*1024*1024) return json({ok:false,error:"Un file supera il limite di 10 MB"},400);
    const allowed=["application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(entry.type)) return json({ok:false,error:"Tipo file non consentito: "+entry.type},400);
    const safeName=entry.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=practice.id+"/"+crypto.randomUUID()+"-"+safeName;
    const {error:uploadError}=await supabase.storage.from("studio-legale-documenti").upload(path,entry,{contentType:entry.type,upsert:false});
    if(uploadError)return json({ok:false,error:"Upload fallito: "+uploadError.message},500);
    uploaded.push(entry.name);
    documentRows.push({pratica_id:practice.id,owner_user_id:user.id,file_name:entry.name,storage_path:path,mime_type:entry.type,size_bytes:entry.size});
  }

  if(documentRows.length){
    const {error:docError}=await supabase.from("studio_documenti").insert(documentRows);
    if(docError)return json({ok:false,error:docError.message},500);
    const portalRows=documentRows.map((d:any)=>({pratica_id:practice.id,cliente_id:client.id,sender_user_id:user.id,recipient_user_id:null,file_name:d.file_name,storage_path:d.storage_path,mime_type:d.mime_type,size_bytes:d.size_bytes,direction:"client_to_studio",document_kind:"pratica",status:"caricato",signature_mode:"nessuna",version:1}));
    const {error:portalError}=await supabase.from("studio_portale_documenti").insert(portalRows);
    if(portalError)return json({ok:false,error:portalError.message},500);
  }

  await supabase.from("studio_pratiche").update({file_names:uploaded.join(", ")}).eq("id",practice.id);
  const {data:studioUsers}=await supabase.from("studio_utenti").select("user_id").in("role",["studio","admin"]);
  if(studioUsers?.length){
    await supabase.from("studio_notifiche").insert(studioUsers.map((u:any)=>({
      recipient_user_id:u.user_id,
      tipo:"nuova_pratica",
      titolo:"Nuova pratica ricevuta",
      messaggio:"Il cliente "+client.full_name+" ha inviato una nuova richiesta.",
      pratica_id:practice.id
    })));
  }
  await supabase.from("studio_audit").insert({pratica_id:practice.id,actor_user_id:user.id,event_type:"pratica_creata",details:{files:uploaded,cliente_id:client.id}});
  return json({ok:true,practice:{...practice,file_names:uploaded.join(", ")},files:uploaded,cliente_id:client.id});
});