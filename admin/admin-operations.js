import {themes} from "./theme-catalog.js";

const localInput=value=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function dates(start,end,c){
 const a=new Date(start.value),b=end.value?new Date(end.value):null;
 if(!Number.isFinite(a.getTime())||(b&&(!Number.isFinite(b.getTime())||b<=a))){c.message("Revisa las fechas de inicio y fin.",true);return null;}
 return [a.toISOString(),b?.toISOString()??null];
}
function themeChecks(parent,ids,c){
 const grid=c.node("div",undefined,"permission-row"),checks=new Map();
 for(const t of themes){const i=c.check(grid,t.title,ids.includes(t.id));if(t.id==="light"){i.checked=true;i.disabled=true;}checks.set(t.id,i);}
 parent.append(grid);
 return ()=>[...new Set([...ids.filter(id=>!checks.has(id)),...[...checks].filter(([,v])=>v.checked).map(([id])=>id)])];
}

export function operationalControls(parent,base,management,c){
 parent.append(c.node("h3","Temas disponibles"),c.node("p","Light permanece disponible como alternativa. Desactivar un tema lo oculta y cambia temporalmente al tema permitido; se conserva la preferencia del usuario.","muted"));
 const readThemes=themeChecks(parent,base.enabled_themes,c);
 const schedule=c.card("Programar funciones y temas");
 schedule.append(c.node("p","Los períodos prevalecen sobre la configuración base. Al terminar, vuelve a aplicarse la base. Las fechas usan la zona horaria de este navegador; el servidor decide cuándo empieza y termina cada período.","notice"));
 const label=c.field(schedule,"Nombre del período");label.maxLength=120;
 const start=c.field(schedule,"Inicio","datetime-local",localInput(Date.now()+3600000));
 const end=c.field(schedule,"Fin","datetime-local",localInput(Date.now()+7200000));
 const feature=c.select(schedule,"Función del período",[
  ["public_feed_enabled","Publicaciones en Comunidad"],["groups_enabled","Publicación y entrada a grupos"],["translations_enabled","Traducciones"],
  ["announcements_enabled","Avisos oficiales"],["custom_backgrounds_enabled","Fondos personalizados"],["feedback_enabled","Sugerencias y soporte"],
  ["referrals_enabled","Invitaciones por enlace"],["share_cards_enabled","Tarjetas para compartir"],["analytics_enabled","Analítica opcional"],
  ["review_prompt_enabled","Invitación a valorar"],["enabled_themes","Selección de temas"]],"public_feed_enabled");
 const on=c.select(schedule,"Durante este período",[["true","Activada"],["false","Desactivada"]],"true");
 const themed=c.node("div");themed.hidden=true;themed.append(c.node("p","Temas disponibles durante el período:"));const selected=themeChecks(themed,base.enabled_themes,c);schedule.append(themed);
 feature.addEventListener("change",()=>{themed.hidden=feature.value!=="enabled_themes";on.parentElement.hidden=!themed.hidden;});
 schedule.append(c.button("Programar",()=>{
  if(!label.value.trim()){c.message("Escribe un nombre para el período.",true);return;}
  const times=dates(start,end,c);if(!times||!times[1])return;
  const patch=feature.value==="enabled_themes"?{enabled_themes:selected()}:{[feature.value]:on.value==="true"};
  if(!confirm("Programar este cambio para todos los usuarios?"))return;
  c.action(()=>c.api.rpc("admin_save_feature_window",{p_id:null,p_label:label.value.trim(),p_starts_at:times[0],p_ends_at:times[1],p_patch:patch,p_enabled:true}));
 },""));
 for(const w of management.windows??[]){
  const item=c.card(w.label);item.append(c.node("p",c.date(w.starts_at)+" → "+c.date(w.ends_at),"muted"));
  item.append(c.node("p",w.enabled?(new Date(w.ends_at)<=Date.now()?"Finalizado":new Date(w.starts_at)>Date.now()?"Programado":"Activo"):"Cancelado"));
  for(const [key,value] of Object.entries(w.patch))item.append(c.node("p",key+": "+(Array.isArray(value)?value.join(", "):value?"Activada":"Desactivada"),"small"));
  if(w.enabled&&new Date(w.ends_at)>Date.now())item.append(c.button("Cancelar período",()=>{if(confirm("Cancelar este período y volver a la base donde corresponda?"))c.action(()=>c.api.rpc("admin_cancel_feature_window",{p_id:w.id}));}));
  schedule.append(item);
 }
 return {readPatch:()=>({enabled_themes:readThemes()}),schedule};
}

export function renderCases(initial,c){
 const panel=c.panel;let rows=[...initial],offset=rows.length,loading=false;
 panel.append(c.node("h2","Casos de moderación"),c.node("p","Orden de llegada combinado para motivos y usuarios. El historial incluye publicaciones públicas y motivos grupales denunciados. Las denuncias son solicitudes de revisión, no infracciones confirmadas.","notice"));
 const mode=c.select(panel,"Organizar casos",[["arrival","Orden de llegada"],["person","Por persona"],["date","Por fecha"]],"arrival");
 const list=c.node("div");panel.append(list);
 const more=c.button("Cargar más casos",async()=>{
  if(loading)return;loading=true;more.disabled=true;
  try{const next=await c.api.rpc("admin_get_moderation_cases",{p_limit:40,p_offset:offset});if(!c.isCurrent())return;
   offset+=next.length;for(const x of next)if(!rows.some(y=>y.report_id===x.report_id))rows.push(x);more.hidden=next.length<40;draw();
  }catch(e){if(c.isCurrent())c.error(e);}finally{loading=false;more.disabled=false;}
 });more.hidden=initial.length<40;panel.append(more);
 mode.addEventListener("change",draw);
 function draw(){
  list.replaceChildren();if(!rows.length){list.append(c.node("p","No hay casos pendientes.","muted"));return;}
  const groups=new Map();
  for(const r of rows){const key=mode.value==="person"?(r.subject_id??r.report_id):mode.value==="date"?new Date(r.reported_at).toLocaleDateString("es-PE"):"all";
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  for(const [key,items] of groups){
   if(mode.value!=="arrival")list.append(c.node("h3",(mode.value==="person"?items[0].display_name+" · "+String(key).slice(0,8):key)+" · "+items.length+" casos cargados"));
   for(const item of items)list.append(caseCard(item,c));
  }
 }
 draw();
}
function historyButton(parent,user,c){
 if(!user)return;const view=c.node("div");let offset=0;
 const load=c.button("Ver historial de publicaciones y casos",async()=>{
  load.disabled=true;
  try{const data=await c.api.rpc("admin_get_user_history",{p_user_id:user,p_limit:20,p_offset:offset});if(!c.isCurrent())return;
   if(offset===0)view.append(c.node("p","Solo publicaciones públicas y motivos grupales denunciados. Los demás motivos privados no son accesibles.","notice"));
   view.append(c.node("h4","Publicaciones"));
   for(const p of data.publications){const card=c.card(p.title);card.append(c.node("p",c.date(p.created_at)+" · "+(p.scope==="public"?"Pública":"Grupo · motivo denunciado")+" · "+p.moderation_status,"muted"));
    if(p.notes)card.append(c.node("p",p.notes,"case-text"));if(p.completed_comment)card.append(c.node("p",p.completed_comment,"case-text"));view.append(card);}
   view.append(c.node("h4","Denuncias y decisiones"));
   for(const r of data.cases){const card=c.card(r.title||"Denuncia sobre la cuenta");card.append(c.node("p",c.date(r.reported_at)+" · "+r.status+(r.resolution?" · "+r.resolution:""),"muted"),c.node("p",r.reason));
    if(r.notes)card.append(c.node("p",r.notes,"case-text"));view.append(card);}
   if(!data.publications.length&&!data.cases.length)view.append(c.node("p","No hay más registros.","muted"));
   offset+=20;load.textContent="Cargar más historial";load.hidden=data.publications.length<20&&data.cases.length<20;
  }catch(e){if(c.isCurrent())c.error(e);}finally{load.disabled=false;}
 });parent.append(load,view);
}
function caseCard(item,c){
 const card=c.card(item.title||"Denuncia sobre usuario");card.append(c.node("p",item.display_name+" · "+c.date(item.reported_at),"muted"),c.node("p",item.reason));
 if(item.group_id)card.append(c.node("p","Grupo privado · contenido denunciado","small"));
 const view=c.node("div");card.append(view);
 const open=c.button("Abrir caso",async()=>{
  open.disabled=true;
  try{
   const report=item.kind==="content"?await c.api.rpc("admin_get_report",{p_report_id:item.report_id}):item;
   if(!c.isCurrent())return;view.replaceChildren();
   if(report.evidence_available===false)view.append(c.node("p","El texto de esta versión anterior no se conservó. Revisa la información disponible antes de decidir.","notice"));
   for(const [title,value] of [["Versión denunciada",report.notes],["Comentario",report.completed_comment],["Detalles de la denuncia",report.details]])if(value)view.append(c.node("h4",title),c.node("p",value,"case-text"));
   historyButton(view,item.subject_id,c);
   const label=c.node("label","Nota interna de moderación"),note=c.node("textarea");note.maxLength=2000;label.append(note);view.append(label,c.node("p","El usuario recibirá el resultado de la revisión. Esta nota interna y la identidad de quien denunció no se envían.","small"));
   const actions=c.node("div",undefined,"actions");
   for(const [value,title] of item.kind==="content"?[["approve","Aprobar versión denunciada"],["remove","Retirar versión denunciada"]]:[["dismiss","Cerrar denuncia"],["suspend","Suspender cuenta"]])
    actions.append(c.button(title,()=>{
     if(value==="suspend"&&note.value.trim().length<5){c.message("Escribe el motivo de la suspensión.",true);return;}
     if(confirm(title+"?"))c.action(async()=>{const ok=await c.api.rpc(item.kind==="content"?"moderate_content_report":"moderate_user_report",{p_report_id:item.report_id,p_action:value,p_note:note.value.trim()||null});if(ok!==true)throw Error("REPORT_NO_LONGER_PENDING");});
    },value==="remove"||value==="suspend"?"danger":"secondary"));
   view.append(actions);open.hidden=true;
  }catch(e){if(c.isCurrent())c.error(e);}finally{open.disabled=false;}
 });card.append(open);return card;
}

export function renderAnnouncements(rows,c){
 const panel=c.panel;panel.append(c.node("h2","Avisos para toda la comunidad"),c.node("p","Estos mensajes son públicos y aparecen como avisos oficiales en Comunidad. Incluye solo información que pueda leer cualquier persona.","notice"));
 const editor=c.card("Nuevo aviso"),title=c.field(editor,"Título del aviso");title.maxLength=120;
 const label=c.node("label","Mensaje público"),body=c.node("textarea");body.maxLength=4000;body.rows=5;label.append(body);editor.append(label);
 const start=c.field(editor,"Publicar desde","datetime-local",localInput(Date.now()));
 const end=c.field(editor,"Retirar el (opcional)","datetime-local");let editing=null;
 const save=(enabled)=>{
  if(!title.value.trim()||!body.value.trim()){c.message("Completa el título y el mensaje.",true);return;}
  const times=dates(start,end,c);if(!times)return;
  if(enabled&&!confirm("Publicar este aviso para toda la comunidad desde la fecha indicada?"))return;
  c.action(()=>c.api.rpc("admin_save_announcement",{p_id:editing,p_title:title.value.trim(),p_body:body.value.trim(),p_starts_at:times[0],p_ends_at:times[1],p_enabled:enabled}));
 };
 const actions=c.node("div",undefined,"actions");actions.append(c.button("Guardar borrador",()=>save(false)),c.button("Publicar o programar aviso",()=>save(true),""));editor.append(actions);panel.append(editor);
 for(const row of rows){
  const card=c.card(row.title);card.append(c.node("p",row.body,"case-text"),c.node("p",row.enabled?(new Date(row.starts_at)>Date.now()?"Programado":row.ends_at&&new Date(row.ends_at)<=Date.now()?"Finalizado":"Publicado"):"Borrador / retirado","muted"),c.node("p",c.date(row.starts_at)+(row.ends_at?" → "+c.date(row.ends_at):""),"small"));
  card.append(c.button("Editar",()=>{editing=row.id;title.value=row.title;body.value=row.body;start.value=localInput(row.starts_at);end.value=row.ends_at?localInput(row.ends_at):"";editor.querySelector("h3").textContent="Editar aviso";title.focus();}));
  if(row.enabled)card.append(c.button("Retirar aviso",()=>{if(confirm("Retirar este aviso de Comunidad?"))c.action(()=>c.api.rpc("admin_save_announcement",{p_id:row.id,p_title:row.title,p_body:row.body,p_starts_at:row.starts_at,p_ends_at:row.ends_at,p_enabled:false}));},"danger"));
  panel.append(card);
 }
}
