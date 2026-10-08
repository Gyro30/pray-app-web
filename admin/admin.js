import {config} from "../config.js";
import {PortalApi,errorText} from "../portal-api.js";
const api=new PortalApi(config),$=id=>document.getElementById(id);
let access=null,section=null,generation=0,lastActivity=Date.now(),busy=false;
const labels={moderation:"Revisiones",analytics:"Métricas",runtime:"Configuración",users:"Usuarios",premium_grants:"Premium",access:"Permisos",audit:"Actividad"};
const permissions={moderation:"Revisar denuncias",analytics:"Ver analíticas",runtime:"Cambiar configuración",users:"Suspender y eliminar usuarios",premium_grants:"Conceder Premium perpetuo"};
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
 if(access.is_owner)available.push("access","audit");
 if(!available.includes(section))section=available[0];
 $("tabs").replaceChildren();
 for(const id of available){const b=button(labels[id],()=>load(id));b.setAttribute("aria-current",String(section===id));$("tabs").append(b);}
 $("identity").textContent=access.is_owner?"Cuenta propietaria":"Acceso según permisos asignados";
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
 section=id;const current=++generation;$("panel").replaceChildren();message("Cargando…");
 try{
  access=await api.rpc("get_admin_access");if(current!==generation)return;tabs();
  const area=section;let data;
  if(area==="moderation")data=await Promise.all([api.rpc("get_content_moderation_queue"),api.rpc("get_user_moderation_queue")]);
  else if(area==="analytics")data=await api.rpc("get_product_metrics");
  else if(area==="runtime")data=await api.rpc("get_runtime_config");
  else if(area==="audit")data=await api.rpc("admin_get_audit");
  else data=await api.rpc("admin_find_users");
  if(current!==generation)return;
  message("");
  if(area==="moderation")renderModeration(data,current);
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
 const panel=$("panel");panel.append(node("h2","Motivos pendientes de revisión"));
 if(!contents.length)panel.append(node("p","No hay motivos pendientes.","muted"));
 for(const item of contents){
  const c=card(item.title);c.append(node("p",item.reason+" · "+date(item.reported_at),"muted"));
  const preview=node("div");c.append(preview);
  const open=button("Revisar caso",async()=>{
   open.disabled=true;
   try{
    const report=await api.rpc("admin_get_report",{p_report_id:item.report_id});
    if(current!==generation)return;preview.replaceChildren();
    for(const [title,value] of [["Motivo",report.notes],["Comentario",report.completed_comment],["Denuncia",report.details]]){
     if(value){preview.append(node("h4",title),node("p",value,"case-text"));}
    }
    const l=node("label","Nota de moderación (no incluyas información personal)"),note=node("textarea");note.maxLength=2000;l.append(note);preview.append(l);
    const actions=node("div",undefined,"actions");
    for(const [value,title] of [["approve","Aprobar publicación"],["remove","Retirar publicación"]])
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
  const c=card(item.display_name||"Cuenta de Pray");c.append(node("p",item.reason+" · "+date(item.reported_at),"muted"),node("p",item.details||"Sin detalles","case-text"));
  const note=field(c,"Nota de resolución");note.maxLength=500;
  const actions=node("div",undefined,"actions");
  for(const [value,title] of [["dismiss","Cerrar denuncia"],["suspend","Suspender cuenta"]])
   actions.append(button(title,()=>{if(value==="suspend"&&note.value.trim().length<5){message("Escribe el motivo de la suspensión.",true);return;}
    if(confirm(title+"?"))action(async()=>{const ok=await api.rpc("moderate_user_report",{p_report_id:item.report_id,p_action:value,p_note:note.value.trim()||null});if(ok!==true)throw Error("REPORT_NO_LONGER_PENDING");});
   },value==="suspend"?"danger":"secondary"));
  c.append(actions);panel.append(c);
 }
 panel.append(node("p","Se muestran hasta 50 casos por cola, en orden de llegada. Al resolverlos aparecen los siguientes.","muted"));
}
function renderMetrics(data){
 const panel=$("panel");panel.append(node("h2","Uso de Pray"),node("p","La actividad diaria y la retención incluyen únicamente a quienes aceptaron compartir métricas. No contienen textos de oración.","notice"));
 const grid=node("div",undefined,"metrics");
 for(const [key,label] of [["registered_accounts","Cuentas registradas"],["active_groups","Grupos"],["dau","Activos hoy"],["wau","Activos en 7 días"],["mau","Activos en 30 días"],["paid_subscribers","Suscripciones verificadas"],["owner_grants","Premium concedidos"]]){
  const c=node("div",undefined,"metric");c.append(node("strong",Number(data[key]??0).toLocaleString("es-PE")),node("span",label));grid.append(c);
 }panel.append(grid,node("h2","Retención observada"));
 const list=node("ul",undefined,"stat-list");
 for(const r of data.retention??[])list.append(node("li","Día "+r.day+": "+(r.rate===null?"sin muestra suficiente":(Number(r.rate)*100).toFixed(1)+"%")+" · "+r.returned+"/"+r.eligible));
 panel.append(list,node("h2","Eventos · últimos 30 días"));
 const events=node("ul");for(const [name,count] of Object.entries(data.events??{}))events.append(node("li",name+": "+count));
 if(!events.children.length)events.append(node("li","Aún no hay eventos compartidos."));
 panel.append(events,node("p","Los fallos y ANR del conjunto de instalaciones se revisan en Android vitals de Google Play.","muted"));
}
function renderRuntime(data){
 if(!Number.isInteger(data.free_monthly_publication_limit))throw Error("SERVICE_NOT_DEPLOYED");
 const c=card("Configuración remota"),form=node("div",undefined,"grid-form");
 const mode=select(form,"Monetización",[["FREE_ALL","Gratis · sin monetización"],["PARTIAL","Parcial · plan gratuito"],["FINAL","Completa · Free y Premium"]],data.monetization_mode);
 const phases=["PRE_RELEASE","CLOSED_TEST","SOFT_LAUNCH","COMMUNITY_GROWTH","PARTIAL_MONETIZATION","PREMIUM_LAUNCH","SCALE"];
 const phase=select(form,"Fase de publicación",phases.map(v=>[v,v]),data.rollout_phase);
 const limit=field(form,"Máximo de grupos del plan gratuito","number",data.free_group_limit);limit.min=0;limit.max=10000;
 const publications=field(form,"Publicaciones por mes del plan gratuito (UTC)","number",data.free_monthly_publication_limit);publications.min=0;publications.max=10000;
 const flags={};
 for(const [key,title] of [["ads_enabled","Publicidad discreta"],["banner_enabled","Espacio de banner"],["support_enabled","Apoyo voluntario"],["premium_purchase_enabled","Compra Premium"],["analytics_enabled","Métricas opcionales"],["translations_enabled","Traducciones"],["maintenance_mode","Mantenimiento"]])
  flags[key]=check(form,title,data[key]);
 c.append(node("p","FREE_ALL mantiene invisible toda monetización. Cambiar el modo no configura pagos ni anuncios: cada proveedor debe estar listo. La fase y las opciones remotas siguen controlando la disponibilidad.","notice"),form);
 const version=field(c,"Versión mínima (vacía = sin bloqueo)","text",data.minimum_supported_version??"");version.maxLength=30;
 const recommended=field(c,"Versión recomendada","text",data.recommended_version??"");recommended.maxLength=30;
 c.append(button("Guardar configuración",()=>{
  const n=Number(limit.value),monthly=Number(publications.value);if(limit.value.trim()===""||publications.value.trim()===""||!Number.isInteger(n)||n<0||n>10000||!Number.isInteger(monthly)||monthly<0||monthly>10000){message("Revisa los límites del plan gratuito.",true);return;}
  if(!confirm("Aplicar "+mode.value+" / "+phase.value+" a todos los usuarios?\nGrupos del plan gratuito: "+n+". Publicaciones por mes: "+monthly+"."))return;
  action(()=>api.rpc("admin_set_runtime_config",{p_expected_updated_at:data.updated_at,p_patch:{
   monetization_mode:mode.value,rollout_phase:phase.value,free_group_limit:n,free_monthly_publication_limit:monthly,
   minimum_supported_version:version.value.trim()||null,recommended_version:recommended.value.trim()||null,
   ...Object.fromEntries(Object.entries(flags).map(([k,v])=>[k,v.checked]))}}));
 },""));$("panel").append(c);
}
function renderUsers(data,area){
 const panel=$("panel"),search=node("div",undefined,"toolbar"),form=node("form"),label=node("label","Buscar por correo, nombre o UUID"),query=node("input");query.type="search";query.maxLength=120;label.append(query);form.append(label,button("Buscar",()=>form.requestSubmit()));
 form.addEventListener("submit",async e=>{e.preventDefault();const current=++generation;message("Buscando…");try{
  const users=await api.rpc("admin_find_users",{p_query:query.value.trim()});if(current!==generation)return;
  container.replaceChildren();for(const u of users)container.append(userCard(u,area));message(users.length?"":"No encontramos cuentas.");
 }catch(e){if(current===generation)message(errorText(e),true);}});
 search.append(form);panel.append(search,node("p","Hasta 50 resultados. El acceso a esta lista requiere permisos de usuarios, concesiones o propiedad.","muted"));
 const container=node("div");for(const u of data)container.append(userCard(u,area));panel.append(container);
}
function userCard(user,area){
 const c=card(user.display_name||user.email||"Cuenta");c.append(node("p",user.email||"Sin correo","muted"),node("p",user.id,"small"),node("p",user.moderation_status+" · "+user.plan_code+(user.is_perpetual?" · Perpetuo":"")));
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
   if(confirm((user.is_perpetual?"Revocar la concesión":"Conceder Premium perpetuo")+" a "+(user.email||user.id)+"?"))action(()=>api.rpc("admin_set_perpetual_premium",{p_user_id:user.id,p_enabled:!user.is_perpetual}));
  },""),node("p","Esta concesión no registra una compra. Revocarla no cancela una suscripción pagada válida.","small"));
 }else if(area==="users"&&can("users")){
  if(user.is_owner||(user.role&&!access.is_owner)){c.append(node("p","Cuenta administrativa protegida.","notice"));return c;}
  const note=field(c,"Motivo de la acción (mínimo 5 caracteres)");note.maxLength=500;
  const row=node("div",undefined,"actions"),status=user.moderation_status==="suspended"?"active":"suspended";
  row.append(button(status==="active"?"Restablecer cuenta":"Suspender cuenta",()=>{
   if(note.value.trim().length<5){message("Escribe el motivo de la acción.",true);return;}
   if(confirm("Cambiar el estado de esta cuenta?"))action(()=>api.rpc("admin_set_user_status",{p_user_id:user.id,p_status:status,p_note:note.value.trim()}));
  },status==="active"?"secondary":"danger"));
  row.append(button("Eliminar cuenta",()=>{
   const value=prompt("Esta acción elimina la cuenta y sus datos. Para confirmar escribe:\nELIMINAR "+user.id);
   if(value!=="ELIMINAR "+user.id)return;
   action(async()=>{await api.refresh();await api.request("/functions/v1/admin-portal",{action:"delete_user",user_id:user.id,confirmation:value});});
  },"danger"));c.append(row);
 }return c;
}
function renderAudit(data){
 $("panel").append(node("h2","Actividad administrativa"),node("p","Últimas 50 acciones. Este registro no contiene oraciones, correos ni códigos de acceso.","notice"));
 const wrap=node("div",undefined,"table-wrap"),t=node("table"),head=node("tr");for(const title of ["Fecha","Acción","Cuenta / caso"])head.append(node("th",title));t.append(head);
 for(const row of data){const r=node("tr");for(const value of [date(row.occurred_at),row.action,row.target_id||row.object_id||"—"])r.append(node("td",value));t.append(r);}wrap.append(t);$("panel").append(wrap);
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const b=$("login-form").querySelector("button");b.disabled=true;message("Validando acceso…");
 let password=$("password").value;$("password").value="";
 try{await api.login($("email").value.trim(),password);password="";access=await api.rpc("get_admin_access");
  $("login").hidden=true;$("workspace").hidden=false;$("logout").hidden=false;lastActivity=Date.now();tabs();await load(section);
 }catch(e){reset();message(errorText(e),true);}finally{password="";b.disabled=false;}
});
$("logout").addEventListener("click",async()=>{try{await api.logout();}catch{/* local credentials must clear even offline */}finally{reset();message("Sesión cerrada.");}});
$("refresh").addEventListener("click",()=>load(section));
for(const event of ["pointerdown","keydown"])document.addEventListener(event,()=>lastActivity=Date.now(),{passive:true});
setInterval(()=>{if(api.session&&Date.now()-lastActivity>15*60*1000){api.logout().catch(()=>{});reset();message("Sesión cerrada por inactividad.");}},30000);
addEventListener("pagehide",()=>{reset();});
