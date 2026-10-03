import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function makePdf(title: string, version: string, content: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595;
  const pageH = 842;
  const margin = 48;
  const bodySize = 9.5;
  const lineHeight = 13.5;
  const maxWidth = pageW - margin * 2;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const addPage = () => {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - margin;
  };

  const drawLine = (text: string, isBold = false, size = bodySize) => {
    if (y < margin + 32) addPage();
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: isBold ? bold : regular,
      color: rgb(0.08, 0.12, 0.20),
      maxWidth
    });
    y -= lineHeight;
  };

  page.drawText(title, {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: rgb(0.05, 0.09, 0.18),
    maxWidth
  });
  y -= 22;
  page.drawText("Versione " + version, {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.40, 0.48)
  });
  y -= 22;

  for (const raw of content.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      y -= 7;
      continue;
    }

    const heading = /^\d+\.\s/.test(line) || /^[A-ZÀÈÉÌÒÙ].{0,70}$/.test(line);
    const size = heading ? 10.5 : bodySize;
    const font = heading ? bold : regular;
    const words = line.split(/\s+/);
    let current = "";

    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        drawLine(current, heading, size);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) drawLine(current, heading, size);
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText("Portale Clienti · Documento privacy · Pagina " + (i + 1) + "/" + pages.length, {
      x: margin,
      y: 22,
      size: 7.5,
      font: regular,
      color: rgb(0.42, 0.46, 0.52)
    });
  });

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return response({ ok: false, error: "Sessione non valida." }, 401);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "send") {
      const { data: actor } = await admin.from("studio_utenti").select("role").eq("user_id", user.id).maybeSingle();
      if (!actor || !["studio", "admin"].includes(actor.role)) return response({ ok: false, error: "Permessi insufficienti." }, 403);

      const informativeId = String(body.informative_id || "");
      const clientId = String(body.client_id || "");
      if (!informativeId || !clientId) return response({ ok: false, error: "Informativa e cliente sono obbligatori." }, 400);

      const { data: informative, error: ie } = await admin
        .from("studio_privacy_informative")
        .select("id,titolo,versione,contenuto,stato")
        .eq("id", informativeId)
        .maybeSingle();
      if (ie || !informative) return response({ ok: false, error: "Informativa non trovata." }, 404);
      if (informative.stato !== "attiva") return response({ ok: false, error: "L'informativa deve essere nello stato Attiva prima dell'invio al cliente." }, 400);

      const { data: client, error: ce } = await admin
        .from("studio_clienti")
        .select("id,user_id,full_name")
        .eq("id", clientId)
        .maybeSingle();
      if (ce || !client) return response({ ok: false, error: "Cliente non trovato." }, 404);
      if (!client.user_id) return response({ ok: false, error: "Il cliente non ha ancora un accesso attivo al Portale." }, 400);

      const pdf = await makePdf(informative.titolo, informative.versione, informative.contenuto);
      const safeVersion = String(informative.versione).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = "studio/" + client.id + "/privacy/" + safeVersion + "-" + crypto.randomUUID() + ".pdf";
      const { error: uploadError } = await admin.storage
        .from("studio-legale-documenti")
        .upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (uploadError) return response({ ok: false, error: uploadError.message }, 400);

      const { data: doc, error: docError } = await admin
        .from("studio_portale_documenti")
        .insert({
          cliente_id: client.id,
          sender_user_id: user.id,
          recipient_user_id: client.user_id,
          file_name: "Informativa_Privacy_v" + informative.versione + ".pdf",
          storage_path: path,
          mime_type: "application/pdf",
          size_bytes: pdf.byteLength,
          direction: "studio_to_client",
          document_kind: "privacy_informativa",
          status: "da_firmare",
          signature_mode: "download_upload",
          version: 1,
          notes: "Informativa privacy " + informative.versione + " · informativa_id=" + informative.id
        })
        .select("id")
        .single();
      if (docError) {
        await admin.storage.from("studio-legale-documenti").remove([path]);
        return response({ ok: false, error: docError.message }, 400);
      }

      return response({ ok: true, document_id: doc.id, client_id: client.id, informative_id: informative.id });
    }

    if (action === "confirm") {
      const { data: actor } = await admin.from("studio_utenti").select("role").eq("user_id", user.id).maybeSingle();
      if (!actor || actor.role !== "cliente") return response({ ok: false, error: "Solo un cliente autenticato può confermare questo documento." }, 403);

      const originalId = String(body.original_document_id || "");
      const returnedId = String(body.returned_document_id || "");
      if (!originalId || !returnedId) return response({ ok: false, error: "Documento originale e documento restituito sono obbligatori." }, 400);

      const { data: original, error: oe } = await admin
        .from("studio_portale_documenti")
        .select("id,cliente_id,recipient_user_id,status,document_kind,notes")
        .eq("id", originalId)
        .maybeSingle();
      if (oe || !original) return response({ ok: false, error: "Documento originale non trovato." }, 404);
      if (original.recipient_user_id !== user.id || original.document_kind !== "privacy_informativa") return response({ ok: false, error: "Documento non associato a questo cliente." }, 403);

      const match = String(original.notes || "").match(/informativa_id=([0-9a-f-]{36})/i);
      if (!match) return response({ ok: false, error: "Informativa collegata non identificabile." }, 400);
      const informativeId = match[1];

      const { data: returned, error: re } = await admin
        .from("studio_portale_documenti")
        .select("id,storage_path,parent_document_id,sender_user_id,status")
        .eq("id", returnedId)
        .maybeSingle();
      if (re || !returned || returned.parent_document_id !== originalId || returned.sender_user_id !== user.id || returned.status !== "restituito") {
        return response({ ok: false, error: "Documento restituito non valido." }, 400);
      }

      const { data: existing } = await admin
        .from("studio_privacy_consensi")
        .select("id")
        .eq("user_id", user.id)
        .eq("informativa_id", informativeId)
        .eq("tipo_azione", "presa_visione")
        .limit(1);
      if (!(existing && existing.length)) {
        const { error: consentError } = await admin.from("studio_privacy_consensi").insert({
          cliente_id: original.cliente_id,
          user_id: user.id,
          informativa_id: informativeId,
          tipo_azione: "presa_visione",
          finalita: "Presa visione dell'informativa privacy",
          esito: "registrato",
          fonte: "portale",
          evidenza: "Documento restituito: " + returned.storage_path,
          registrato_at: new Date().toISOString()
        });
        if (consentError) return response({ ok: false, error: consentError.message }, 400);
      }
      const {data:client}=await admin.from("studio_clienti").select("full_name").eq("id",original.cliente_id).maybeSingle();
      const {data:studioUsers}=await admin.from("studio_utenti").select("user_id").in("role",["studio","admin"]);
      if(studioUsers?.length){
        await admin.from("studio_notifiche").insert(studioUsers.map((u:any)=>({
          recipient_user_id:u.user_id,
          tipo:"privacy_restituita",
          titolo:"Informativa privacy restituita",
          messaggio:"Il cliente "+(client?.full_name||"ha restituito")+" il documento privacy firmato.",
          documento_id:returned.id
        })));
      }
      return response({ ok: true, privacy_consent_recorded: true });
    }

    return response({ ok: false, error: "Azione non supportata." }, 400);
  } catch (e) {
    return response({ ok: false, error: e?.message || "Errore interno." }, 500);
  }
});