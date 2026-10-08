import {config} from "./config.js";
import {PortalApi,errorText} from "./portal-api.js";
const api=new PortalApi(config),$=id=>document.getElementById(id);
let challenge=null,ticket=null,email="",busy=false,epoch=0;
const message=(text,error=false)=>{$("deletion-status").textContent=text;$("deletion-status").dataset.error=String(error);};
function start(){epoch++;api.clear();challenge=null;ticket=null;email="";$("code").value="";$("delete-confirm").value="";
 $("request-form").hidden=false;$("verify-form").hidden=true;$("confirm-form").hidden=true;$("restart").hidden=true;}
async function run(fn){
 if(busy)return;busy=true;const current=epoch;
 for(const b of $("email-deletion").querySelectorAll("button"))b.disabled=true;
 try{await fn(current);}catch(e){if(current===epoch)message(errorText(e),true);}
 finally{busy=false;for(const b of $("email-deletion").querySelectorAll("button"))b.disabled=false;}
}
$("request-form").addEventListener("submit",e=>{
 e.preventDefault();run(async current=>{
  const address=$("delete-email").value.trim().toLowerCase();
  const data=await api.request("/functions/v1/delete-account-email",{action:"request",email:address},{auth:false});
  if(current!==epoch)return;
  if(data.ok!==true||!data.challenge_id||!data.request_secret)throw Error("SERVICE_UNAVAILABLE");
  challenge=data;email=address;
  $("request-form").hidden=true;$("verify-form").hidden=false;$("restart").hidden=false;
  message("Si el correo pertenece a una cuenta existente, recibirás un código. Caduca en 10 minutos. Revisa también la carpeta de spam.");
  $("code").focus();
 });
});
$("verify-form").addEventListener("submit",e=>{
 e.preventDefault();run(async current=>{
  if(!challenge)throw Error("DELETION_CONFIRMATION_INVALID");
  const data=await api.request("/functions/v1/delete-account-email",{action:"verify",email,
   challenge_id:challenge.challenge_id,request_secret:challenge.request_secret,code:$("code").value.trim()},{auth:false});
  $("code").value="";
  if(current!==epoch)return;
  if(data.ok!==true||!data.deletion_ticket)throw Error("INVALID_OR_EXPIRED_CODE");
  ticket=data.deletion_ticket;challenge.request_secret=null;
  $("verify-form").hidden=true;$("confirm-form").hidden=false;
  message("Correo verificado. Revisa los datos que se eliminarán y confirma solo si deseas continuar.");
  $("delete-confirm").focus();
 });
});
$("confirm-form").addEventListener("submit",e=>{
 e.preventDefault();run(async current=>{
  if(!challenge||!ticket)throw Error("DELETION_CONFIRMATION_INVALID");
  if($("delete-confirm").value!=="ELIMINAR")throw Error("CONFIRMATION_REQUIRED");
  message("Eliminando la cuenta. Espera la confirmación…");
  const data=await api.request("/functions/v1/delete-account-email",{action:"confirm",
   challenge_id:challenge.challenge_id,deletion_ticket:ticket,confirmation:"ELIMINAR"},{auth:false});
  if(current!==epoch)return;
  if(data.ok!==true)throw Error("CONFIRMATION_RETRY_REQUIRED");
  epoch++;api.clear();ticket=null;challenge=null;email="";
  $("request-form").hidden=true;$("verify-form").hidden=true;$("confirm-form").hidden=true;$("restart").hidden=true;$("delete-email").value="";
  message("Tu cuenta y sus datos del servidor fueron eliminados. Si conservas la app en un dispositivo sin conexión, borra sus datos desde Ajustes de Android.");
 });
});
$("restart").addEventListener("click",()=>{start();message("Puedes solicitar un nuevo código.");});
addEventListener("pagehide",()=>{start();$("delete-email").value="";});
$("email-deletion").hidden=false;
