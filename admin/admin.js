import {config} from "../config.js";
import {PortalApi,errorText} from "../portal-api.js";
import {translationDiagnostics} from "./translation-diagnostics.js";
import {renderCases,operationalControls,renderAnnouncements} from "./admin-operations.js";
const api=new PortalApi(config),$=id=>document.getElementById(id);
let access=null,section=null,generation=0,lastActivity=Date.now(),busy=false;
const labels={moderation:"Revisiones",analytics:"M�tricas",runtime:"Configuraci�n",users:"Usuarios",premium_grants:"Premium",access:"Permisos",audit:"Actividad",announcements:"Avisos",feedback:"Soporte"};
const permissions={moderation:"Revisar denuncias",analytics:"Ver anal�ticas",runtime:"Cambiar configuraci�n",users:"Suspender y eliminar usuarios",premium_grants:"Conceder Premium perpetuo",announcements:"Publicar avisos y fijar motivos p�blicos"};
const can=p=>access?.is_owner||access?.permissions.includes(p);
const message=(text,error=false)=>{$("status").textContent=text;$("status").dataset.error=String(error);};
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;}
function button(text,handler,kind="secondary"){const b=node("button",text,kind);b.type="button";b.addEventListener("click",handler);return b;}
function card(title){const c=node("article",undefined,"card");c.append(node("h3",title));return c;}
function field(parent,title,kind="text",value=""){const l=node("label",title),i=node("input");i.type=kind;i.value=value;l.append(i);parent.append(l);return i;}
let controlId=0;
function select(parent,title,options,value){const wrap=node("div"),l=node("label",title),s=node("select");s.id="select-"+(++controlId);l.htmlFor=s.id;for(const [key,name] of options)s.append(new Option(name,key));s.value=value;wrap.append(l,s);parent.append(wrap);return s;}
function check(parent,title,checked){const l=node("label"),i=node("input");i.type="checkbox";i.checked=!!checked;l.append(i,document.createTextNode(title));parent.append(l);return i;}
const date=value=>value?new Date(value).toLocaleString("es-PE"):"";
function reset(){
 generation++;access=null;section=null;busy=false;api.clear();$("panel").replaceChildren();$("tabs").replaceChildren();$("identity").textContent="";
 $("workspace").hidden=true;$("login").hidden=false;$("logout").hidden=true;$("password").value="";
}
function tabs(){
 const available=Object.keys(permissions).filter(can);
 if(can("moderation"))available.push("feedback");
 if(access.is_owner)available.push("access","audit");
 if(!available.includes(section))section=available[0];
 $("tabs").replaceChildren();
 for(const [title,ids] of [["Comunidad",["moderation","feedback","announcements"]],["Seguimiento",["analytics","audit"]],["Administraci�n",["runtime","users","premium_grants","access"]]]){
  const group=node("div",undefined,"nav-group");group.append(node("p",title,"nav-label"));
  for(const id of ids.filter(id=>available.includes(id))){const b=button(labels[id],()=>load(id));b.setAttribute("aria-current",String(section===id));group.append(b);}
  if(group.children.length>1)$("tabs").append(group);
 }
 const descriptions={moderation:"Denuncias, historial y decisiones de moderaci�n.",feedback:"Solicitudes y respuestas privadas de soporte.",announcements:"Avisos oficiales y motivos destacados.",analytics:"Uso agregado y m�tricas con consentimiento.",audit:"Registro de acciones administrativas.",runtime:"Configuraci�n base, disponibilidad efectiva y programaci�n.",users:"Busca una cuenta antes de aplicar una acci�n.",premium_grants:"Concesiones independientes de las compras.",access:"Permisos administrativos por persona."};
 $("section-description").textContent=descriptions[section]??"";
 $("identity").textContent=access.is_owner?"Cuenta propietaria":"Acceso seg�n permisos asignados";
}
async function action(fn){
 if(busy)return;busy=true;
 for(const b of $("panel").querySelectorAll("button"))b.disabled=true;
 const epoch=api.epoch;
 try{access=await api.rpc("get_admin_access");await fn();if(epoch!==api.epoch)return;message("Cambio guardado.");await load(section);}
 catch(e){if(epoch!==api.epoch)return;message(errorText(e),true);if(["ADMIN_FORBIDDEN","AUTH_REQUIRED","INVALID_SESSION"].includes(e.message))reset();}
 finally{busy=false;for(const b of $("panel").querySelectorAll("button"))b.disabled=false;}
}
async function load(id){
 if(busy&&id!==section)return;
 section=id;const current=++generation;$("panel").replaceChildren();message("Cargando�");
 try{
  access=await api.rpc("get_admin_access");if(current!==generation)return;tabs();
  const area=section;let data;
  if(area==="moderation"){
   try{data=await api.rpc("admin_get_moderation_cases",{p_limit:40,p_offset:0});}
   catch(e){if(e.message!=="SERVICE_NOT_DEPLOYED")throw e;data=await Promise.all([api.rpc("get_content_moderation_queue"),api.rpc("get_user_moderation_queue")]);}
  }
  else if(area==="analytics")data=await api.rpc("get_product_metrics");
  else if(area==="runtime"){
   try{data=await api.rpc("admin_get_runtime_management");}
   catch(e){if(e.message!=="SERVICE_NOT_DEPLOYED")throw e;data=await api.rpc("get_runtime_config");}
  }
  else if(area==="announcements")data=await api.rpc("admin_get_announcements");
  else if(area==="feedback")data=await api.rpc("get_feedback_moderation_queue");
  else if(area==="audit")data=await api.rpc("admin_get_audit");
  else data=await api.rpc("admin_find_users");
  if(current!==generation)return;
  message("");
  if(area==="moderation"){
   if(Array.isArray(data[0]))renderModeration(data,current);
   else renderCases(data,operationContext(current));
  }
  else if(area==="announcements")renderAnnouncements(data,operationContext(current));
  else if(area==="feedback")renderFeedback(data);
  else if(area==="analytics")renderMetrics(data);
  else if(area==="runtime")renderRuntime(data);
  else if(area==="audit")renderAudit(data);
  else renderUsers(data,area);
 }catch(e){
  if(current!==generation)return;message(errorText(e),true);
  if(["ADMIN_FORBIDDEN","AUTH_REQUIRED","INVALID_SESSION"].includes(e.message))reset();
 }
}
function renderModeration([contents,users],current){
 const panel=$("panel");panel.append(node("h2","Motivos pendientes de revisi�n"));
 if(!contents.length)panel.append(node("p","No hay motivos pendientes.","muted"));
 for(const item of contents){
  const c=card(item.title);c.append(node("p",item.reason+" � "+date(item.reported_at),"muted"));
  const preview=node("div");c.append(preview);
  const open=button("Revisar caso",async()=>{
   open.disabled=true;
   try{
    const report=await api.rpc("admin_get_report",{p_report_id:item.report_id});
    if(current!==generation)return;preview.replaceChildren();
    for(const [title,value] of [["Motivo",report.notes],["Comentario",report.completed_comment],["Denuncia",report.details]]){
     if(value){preview.append(node("h4",title),node("p",value,"case-text"));}
    }
    const l=node("label","Nota de moderaci�n (no incluyas informaci�n personal)"),note=node("textarea");note.maxLength=2000;l.append(note);preview.append(l);
    const actions=node("div",undefined,"actions");
    for(const [value,title] of [["approve","Aprobar publicaci�n"],["remove","Retirar publicaci�n"]])
     actions.append(button(title,()=>{if(confirm(title+"?"))action(async()=>{
      const ok=await api.rpc("moderate_content_report",{p_report_id:item.report_id,p_action:value,p_note:note.value.trim()||null});
      if(ok!==true)throw Error("REPORT_NO_LONGER_PENDING");
     });},value==="remove"?"danger":""));
    preview.append(actions);open.hidden=true;
   }catch(e){if(current===generation)message(errorText(e),true);}finally{open.disabled=false;}
  });c.append(open);panel.append(c);
 }
 panel.append(node("h2","Denuncias sobre usuarios"));
 if(!users.length)panel.append(node("p","No hay denuncias pendientes.","muted"));
 for(const item of users){
  const c=card(item.display_name||"Cuenta de Pray");c.append(node("p",item.reason+" � "+date(item.reported_at),"muted"),node("p",item.details||"Sin detalles","case-text"));
  const note=field(c,"Nota de resoluci�n");note.maxLength=500;
  const actions=node("div",undefined,"actions");
  for(const [value,title] of [["dismiss","Cerrar denuncia"],["suspend","Suspender cuenta"]])
   actions.append(button(title,()=>{if(value==="suspend"&&note.value.trim().length<5){message("Escribe el motivo de la suspensi�n.",true);return;}
    if(confirm(title+"?"))action(async()=>{const ok=await api.rpc("moderate_user_report",{p_report_id:item.report_id,p_action:value,p_note:note.value.trim()||null});if(ok!==true)throw Error("REPORT_NO_LONGER_PENDING");});
   },value==="suspend"?"danger":"secondary"));
  c.append(actions);panel.append(c);
 }
 panel.append(node("p","Se muestran hasta 50 casos por cola, en orden de llegada. Al resolverlos aparecen los siguientes.","muted"));
}
function renderMetrics(data){
 const panel=$("panel");panel.append(node("h2","Uso de Pray"),node("p","La actividad diaria y la retenci�n incluyen �nicamente a quienes aceptaron compartir m�tricas. No contienen textos de oraci�n.","notice"));
 const grid=node("div",undefined,"metrics");
 for(const [key,label] of [["registered_accounts","Cuentas registradas"],["active_groups","Grupos"],["dau","Activos hoy"],["wau","Activos en 7 d�as"],["mau","Activos en 30 d�as"],["paid_subscribers","Suscripciones verificadas"],["owner_grants","Premium concedidos"]]){
  const c=node("div",undefined,"metric");c.append(node("strong",Number(data[key]??0).toLocaleString("es-PE")),node("span",label));grid.append(c);
 }panel.append(grid,node("h2","Retenci�n observada"));
 const list=node("ul",undefined,"stat-list");
 for(const r of data.retention??[])list.append(node("li","D�a "+r.day+": "+(r.rate===null?"sin muestra suficiente":(Number(r.rate)*100).toFixed(1)+"%")+" � "+r.returned+"/"+r.eligible));
 panel.append(list,node("h2","Eventos � �ltimos 30 d�as"));
 const events=node("ul");for(const [name,count] of Object.entries(data.events??{}))events.append(node("li",name+": "+count));
 if(!events.children.length)events.append(node("li","A�n no hay eventos compartidos."));
 panel.append(events,node("p","Los fallos y ANR del conjunto de instalaciones se revisan en Android vitals de Google Play.","muted"));
}
function operationContext(current=generation){
 const epoch=api.epoch;
 return {api,panel:$("panel"),node,button,card,field,select,check,message,date,action,
  isCurrent:()=>current===generation&&epoch===api.epoch,
  error:e=>{message(errorText(e),true);if(["ADMIN_FORBIDDEN","AUTH_REQUIRED","INVALID_SESSION"].includes(e.message))reset();}};
}
function renderRuntime(management){
 const data=management.base_values??management;
 if(!Number.isInteger(data.free_monthly_publication_limit))throw Error("SERVICE_NOT_DEPLOYED");
 const context=operationContext();
 $("panel").append(translationDiagnostics(management,context));
 const c=card("Configuraci�n base"),form=node("div",undefined,"grid-form");
 function group(title){const box=node("fieldset",undefined,"config-group");box.append(node("legend",title));form.append(box);return box;}
 const release=group("Lanzamiento y l�mites");
 const mode=select(release,"Monetizaci�n",[["FREE_ALL","Gratis � sin monetizaci�n"],["PARTIAL","Parcial � plan gratuito"],["FINAL","Completa � Free y Premium"]],data.monetization_mode);
 const phases=["PRE_RELEASE","CLOSED_TEST","SOFT_LAUNCH","COMMUNITY_GROWTH","PARTIAL_MONETIZATION","PREMIUM_LAUNCH","SCALE"];
 const phase=select(release,"Fase de publicaci�n",phases.map(v=>[v,v]),data.rollout_phase);
 const limit=field(release,"M�ximo de grupos del plan gratuito","number",data.free_group_limit);limit.min=0;limit.max=10000;
 const publications=field(release,"Publicaciones por mes del plan gratuito (UTC)","number",data.free_monthly_publication_limit);publications.min=0;publications.max=10000;
 const flags={};
 const community=group("Comunidad y contenido"),growth=group("Difusi�n"),commercial=group("Monetizaci�n"),operations=group("Operaci�n y privacidad");
 const flagGroup=key=>["ads_enabled","banner_enabled","support_enabled","premium_purchase_enabled"].includes(key)?commercial:["referrals_enabled","share_cards_enabled","review_prompt_enabled","church_program_enabled"].includes(key)?growth:["analytics_enabled","maintenance_mode"].includes(key)?operations:community;
 for(const [key,title] of [["public_feed_enabled","Publicaciones en Comunidad"],["feedback_enabled","Sugerencias y soporte"],["referrals_enabled","Invitaciones por enlace"],["share_cards_enabled","Tarjetas para compartir"],["review_prompt_enabled","Invitaci�n a valorar"],["church_program_enabled","Programa de comunidades"],["ads_enabled","Publicidad discreta"],["banner_enabled","Espacio de banner"],["support_enabled","Apoyo voluntario"],["premium_purchase_enabled","Compra Premium"],["analytics_enabled","M�tricas opcionales"],["translations_enabled","Permitir traducciones (no acredita funcionamiento)"],["maintenance_mode","Mantenimiento"]])
  flags[key]=check(flagGroup(key),title,data[key]);
 let operational=null;
 if(Array.isArray(data.enabled_themes)){
  for(const [key,title] of [["groups_enabled","Publicaci�n y entrada a grupos"],["announcements_enabled","Avisos oficiales"],["custom_backgrounds_enabled","Fondos personalizados"]])flags[key]=check(flagGroup(key),title,data[key]);
  operational=operationalControls(group("Cat�logo de temas"),data,management,operationContext());
 }
 c.append(node("p","Editas los valores base. Los per�odos programados pueden cambiar temporalmente la disponibilidad efectiva. FREE_ALL mantiene invisible toda monetizaci�n. Cambiar el modo no configura pagos ni anuncios: cada proveedor debe estar listo. La fase y las opciones remotas siguen controlando la disponibilidad.","notice"),form);
 const versions=group("Compatibilidad de versiones");
 const version=field(versions,"Versi�n m�nima (vac�a = sin bloqueo)","text",data.minimum_supported_version??"");version.maxLength=30;
 const recommended=field(versions,"Versi�n recomendada","text",data.recommended_version??"");recommended.maxLength=30;
 c.append(button("Guardar configuraci�n",()=>{
  const n=Number(limit.value),monthly=Number(publications.value);if(limit.value.trim()===""||publications.value.trim()===""||!Number.isInteger(n)||n<0||n>10000||!Number.isInteger(monthly)||monthly<0||monthly>10000){message("Revisa los l�mites del plan gratuito.",true);return;}
  if(!confirm("Aplicar "+mode.value+" / "+phase.value+" a todos los usuarios?\nGrupos del plan gratuito: "+n+". Publicaciones por mes: "+monthly+"."))return;
  action(()=>api.rpc("admin_set_runtime_config",{p_expected_updated_at:data.updated_at,p_patch:{
   monetization_mode:mode.value,rollout_phase:phase.value,free_group_limit:n,free_monthly_publication_limit:monthly,
   minimum_supported_version:version.value.trim()||null,recommended_version:recommended.value.trim()||null,
   ...(operational?.readPatch()??{}),
   ...Object.fromEntries(Object.entries(flags).map(([k,v])=>[k,v.checked]))}}));
 },""));$("panel").append(c);
 if(operational)$("panel").append(operational.schedule);
}
function renderUsers(data,area){
 const panel=$("panel"),search=node("div",undefined,"toolbar"),form=node("form"),label=node("label","Buscar por correo, nombre o UUID"),query=node("input");query.type="search";query.maxLength=120;label.append(query);form.append(label,button("Buscar",()=>form.requestSubmit()));
 form.addEventListener("submit",async e=>{e.preventDefault();const current=++generation;message("Buscando�");try{
  const users=await api.rpc("admin_find_users",{p_query:query.value.trim()});if(current!==generation)return;
  container.replaceChildren();for(const u of users)container.append(userCard(u,area));message(users.length?"":"No encontramos cuentas.");
 }catch(e){if(current===generation)message(errorText(e),true);}});
 search.append(form);panel.append(search,node("p","Hasta 50 resultados. El acceso a esta lista requiere permisos de usuarios, concesiones o propiedad.","muted"));
 const container=node("div");for(const u of data)container.append(userCard(u,area));panel.append(container);
}
function userCard(user,area){
 const c=card(user.display_name||user.email||"Cuenta");c.append(node("p",user.email||"Sin correo","muted"),node("p",user.id,"small"),node("p",user.moderation_status+" � "+user.plan_code+(user.is_perpetual?" � Perpetuo":"")));
 if(area==="access"&&access.is_owner){
  if(user.is_owner){c.append(node("p","Propietario: protegido. La propiedad se administra solo desde Supabase.","notice"));return c;}
  const checks={},grid=node("div",undefined,"permission-row");
  for(const [key,title] of Object.entries(permissions))checks[key]=check(grid,title,(user.permissions??[]).includes(key)||(user.role==="admin"&&["moderation","analytics","runtime"].includes(key))||(user.role==="moderator"&&key==="moderation"));
  c.append(grid,button("Guardar permisos",()=>{
   const selected=Object.keys(checks).filter(k=>checks[k].checked);
   if(confirm("Actualizar acceso de "+(user.email||user.id)+"?"))action(()=>api.rpc("admin_set_access",{p_user_id:user.id,p_permissions:selected,p_enabled:selected.length>0}));
  },""));
 }else if(area==="premium_grants"&&can("premium_grants")){
  c.append(button(user.is_perpetual?"Revocar Premium concedido":"Conceder Premium perpetuo",()=>{
   if(confirm((user.is_perpetual?"Revocar la concesi�n":"Conceder Premium perpetuo")+" a "+(user.email||user.id)+"?"))action(()=>api.rpc("admin_set_perpetual_premium",{p_user_id:user.id,p_enabled:!user.is_perpetual}));
  },""),node("p","Esta concesi�n no registra una compra. Revocarla no cancela una suscripci�n pagada v�lida.","small"));
 }else if(area==="users"&&can("users")){
  if(user.is_owner||(user.role&&!access.is_owner)){c.append(node("p","Cuenta administrativa protegida.","notice"));return c;}
  const note=field(c,"Motivo de la acci�n (m�nimo 5 caracteres)");note.maxLength=500;
  const row=node("div",undefined,"actions"),status=user.moderation_status==="suspended"?"active":"suspended";
  row.append(button(status==="active"?"Restablecer cuenta":"Suspender cuenta",()=>{
   if(note.value.trim().length<5){message("Escribe el motivo de la acci�n.",true);return;}
   if(confirm("Cambiar el estado de esta cuenta?"))action(()=>api.rpc("admin_set_user_status",{p_user_id:user.id,p_status:status,p_note:note.value.trim()}));
  },status==="active"?"secondary":"danger"));
  row.append(button("Eliminar cuenta",()=>{
   const value=prompt("Esta acci�n elimina la cuenta y sus datos. Para confirmar escribe:\nELIMINAR "+user.id);
   if(value!=="ELIMINAR "+user.id)return;
   action(async()=>{await api.refresh();await api.request("/functions/v1/admin-portal",{action:"delete_user",user_id:user.id,confirmation:value});});
  },"danger"));c.append(row);
 }return c;
}
function renderFeedback(data){
 const panel=$("panel"),states={new:"Recibida",in_review:"En revisi�n",resolved:"Resuelta",closed:"Cerrada"};
 panel.append(node("h2","Solicitudes de soporte"),node("p","Las solicitudes y respuestas se guardan en Pray. No se env�an a una bandeja de correo.","notice"));
 if(!Array.isArray(data))throw Error("REQUEST_FAILED");
 if(!data.length)panel.append(node("p","No hay solicitudes pendientes.","muted"));
 for(const item of data){
  const c=card(item.subject);c.append(node("p",(item.display_name||"Cuenta de Pray")+" � "+(states[item.status]??item.status)+" � "+date(item.created_at),"muted"),node("p",item.message,"case-text"));
  const label=node("label","Respuesta para la persona"),reply=node("textarea");reply.maxLength=2000;reply.value=item.admin_reply??"";label.append(reply);c.append(label);
  const row=node("div",undefined,"actions");
  for(const [value,title] of [["review","Marcar en revisi�n"],["resolve","Responder y resolver"],["close","Cerrar solicitud"]]){
   row.append(button(title,()=>action(async()=>{
    if(value==="resolve"&&!reply.value.trim())throw Error("FEEDBACK_MESSAGE_INVALID");
    if(value==="close"&&!confirm("Cerrar esta solicitud?"))return;
    const result=await api.rpc("moderate_feedback",{p_feedback_id:item.id,p_action:value,p_reply:reply.value.trim()||null});
    if(result!==true)throw Error("REPORT_NO_LONGER_PENDING");
   })));
  }c.append(row);panel.append(c);
 }
}
function renderAudit(data){
 $("panel").append(node("h2","Actividad administrativa"),node("p","�ltimas 50 acciones. Este registro no contiene oraciones, correos ni c�digos de acceso.","notice"));
 const wrap=node("div",undefined,"table-wrap"),t=node("table"),head=node("tr");for(const title of ["Fecha","Acci�n","Cuenta / caso"])head.append(node("th",title));t.append(head);
 for(const row of data){const r=node("tr");for(const value of [date(row.occurred_at),row.action,row.target_id||row.object_id||"�"])r.append(node("td",value));t.append(r);}wrap.append(t);$("panel").append(wrap);
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const b=$("login-form").querySelector("button");b.disabled=true;message("Validando acceso�");
 let password=$("password").value;$("password").value="";
 try{await api.login($("email").value.trim(),password);password="";access=await api.rpc("get_admin_access");
  $("login").hidden=true;$("workspace").hidden=false;$("logout").hidden=false;lastActivity=Date.now();tabs();await load(section);
 }catch(e){reset();message(errorText(e),true);}finally{password="";b.disabled=false;}
});
$("logout").addEventListener("click",async()=>{try{await api.logout();}catch{/* local credentials must clear even offline */}finally{reset();message("Sesi�n cerrada.");}});
$("refresh").addEventListener("click",()=>load(section));
for(const event of ["pointerdown","keydown"])document.addEventListener(event,()=>lastActivity=Date.now(),{passive:true});
setInterval(()=>{if(api.session&&Date.now()-lastActivity>15*60*1000){api.logout().catch(()=>{});reset();message("Sesi�n cerrada por inactividad.");}},30000);
addEventListener("pagehide",()=>{reset();});
