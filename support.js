import {config} from "./config.js";
import {PortalApi,errorText} from "./portal-api.js";

const api=new PortalApi(config),$=id=>document.getElementById(id);
const states={new:"Recibida",in_review:"En revisión",resolved:"Resuelta",closed:"Cerrada"};
let busy=false,generation=0,lastActivity=Date.now();
const message=(text,error=false)=>{$("support-status").textContent=text;$("support-status").dataset.error=String(error);};
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=String(text);if(className)element.className=className;return element;}
function reset(){
 generation++;api.clear();busy=false;$("support-history").replaceChildren();$("support-workspace").hidden=true;
 $("support-login").hidden=false;$("support-logout").hidden=true;$("support-password").value="";
 $("support-subject").value="";$("support-message").value="";
}
async function history(){
 const current=generation,data=await api.rpc("get_my_feedback");
 if(current!==generation)return;
 if(!Array.isArray(data))throw Error("REQUEST_FAILED");
 const area=$("support-history");area.replaceChildren();
 if(!data.length){area.append(node("p","Todavía no tienes solicitudes.","small"));return;}
 for(const item of data){
  const card=node("article",undefined,"support-card");
  card.append(node("h3",item.subject),node("p",states[item.status]??"Recibida","small"));
  if(item.created_at)card.append(node("p",new Date(item.created_at).toLocaleString("es-PE"),"small"));
  card.append(node("p",item.message,"support-text"));
  if(item.admin_reply)card.append(node("h4","Respuesta de Pray"),node("p",item.admin_reply,"support-text"));
  area.append(card);
 }
}
async function run(fn){
 if(busy)return;busy=true;const current=generation;
 for(const button of $("support-portal").querySelectorAll("button"))button.disabled=true;
 try{await fn(current);}catch(error){
  if(current!==generation)return;
  if(["AUTH_REQUIRED","INVALID_SESSION"].includes(error.message))reset();
  message(errorText(error),true);
 }finally{
  if(current===generation)busy=false;
  for(const button of $("support-portal").querySelectorAll("button"))button.disabled=false;
 }
}
$("support-login-form").addEventListener("submit",event=>{
 event.preventDefault();run(async current=>{
  const email=$("support-email").value.trim(),password=$("support-password").value;
  $("support-password").value="";message("Iniciando sesión…");
  await api.login(email,password);if(current!==generation)return;
  await history();if(current!==generation)return;
  lastActivity=Date.now();$("support-login").hidden=true;$("support-workspace").hidden=false;$("support-logout").hidden=false;
  message("Envía tu solicitud y consulta la respuesta aquí.");
 });
});
$("support-form").addEventListener("submit",event=>{
 event.preventDefault();run(async current=>{
  const subject=$("support-subject").value.trim(),text=$("support-message").value.trim();
  if(!subject||!text){message("Completa el asunto y el mensaje.",true);return;}
  message("Enviando…");
  const id=await api.rpc("submit_feedback",{p_kind:$("support-kind").value,p_subject:subject,p_message:text});
  if(current!==generation)return;
  if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error("REQUEST_FAILED");
  $("support-subject").value="";$("support-message").value="";
  message("Solicitud recibida. La respuesta aparecerá en Mis solicitudes.");
  try{await history();}catch{if(current===generation)message("Solicitud recibida. Actualiza Mis solicitudes para consultar su estado.");}
 });
});
$("support-refresh").addEventListener("click",()=>run(async()=>{await history();message("Solicitudes actualizadas.");}));
$("support-logout").addEventListener("click",()=>{
 api.logout().catch(()=>{});reset();$("support-email").value="";message("Sesión cerrada.");
});
for(const event of ["pointerdown","keydown"])addEventListener(event,()=>lastActivity=Date.now(),{passive:true});
setInterval(()=>{if(api.session&&Date.now()-lastActivity>15*60*1000){api.logout().catch(()=>{});reset();message("Sesión cerrada por inactividad.");}},30000);
addEventListener("pagehide",()=>{reset();$("support-email").value="";});
$("support-portal").hidden=false;
