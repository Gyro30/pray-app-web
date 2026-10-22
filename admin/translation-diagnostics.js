export function translationDiagnostics(management,c){
 const base=management.base_values??management, effective=management;
 const card=c.card("Traducci�n � disponibilidad y diagn�stico"),grid=c.node("div",undefined,"diagnostic-grid");
 for(const [title,text] of [["Permiso base",base.translations_enabled?"Habilitado en configuraci�n":"Deshabilitado en configuraci�n"],["Disponibilidad efectiva",effective.maintenance_mode?"Pausada por mantenimiento":effective.translations_enabled?"Permitida por el servidor":"Deshabilitada por el servidor"],["Proveedor real","Sin comprobar en esta sesi�n"]]){
  const item=c.node("div",undefined,"diagnostic-state");item.append(c.node("strong",title),c.node("p",text));grid.append(item);
 }
 const result=c.node("p","Una opci�n habilitada no demuestra que Azure pueda traducir. La app requiere adem�s acceso a la funci�n y su interruptor de traducci�n encendido.","diagnostic-result");result.setAttribute("role","status");
 const actions=c.node("div",undefined,"actions");let pending=false;
 async function run(probe){
  if(pending)return;pending=true;for(const b of actions.children)b.disabled=true;
  result.textContent=probe?"Probando una frase de demostraci�n�":"Consultando configuraci�n t�cnica�";
  try{
   await c.api.refresh();if(!c.isCurrent())return;
   const data=await c.api.request("/functions/v1/translate-prayer",{mode:probe?"provider_probe":"health"});
   if(!c.isCurrent())return;
   if(probe){
    if(data.probeAvailable!==true){result.textContent="Prueba no disponible: falta desplegar la funci�n translate-prayer actualizada.";return;}
    const reasons={TRANSLATION_CACHE_UNAVAILABLE:"La cach� de traducci�n no es compatible. Aplica 45_TRANSLATION_CACHE_REPAIR.sql antes de repetir la prueba.",TRANSLATION_PROVIDER_AUTH_FAILED:"El proveedor rechaz� la autorizaci�n. Revisa clave, regi�n y acceso al recurso de Azure.",TRANSLATION_PROVIDER_QUOTA:"El proveedor alcanz� su cuota o l�mite de solicitudes.",TRANSLATION_BUDGET_EXCEEDED:"Se agot� el presupuesto interno de caracteres.",PROVIDER_NOT_CONFIGURED:"Falta configurar el proveedor.",FEATURE_DISABLED:"La funci�n est� pausada o deshabilitada.",TRANSLATION_PROVIDER_ERROR:"El proveedor devolvi� un error. Revisa sus registros y configuraci�n.",TRANSLATION_PROVIDER_TIMEOUT:"El proveedor no respondi� a tiempo."};
    result.textContent=(data.ok?"Traducci�n real comprobada con �xito.":reasons[data.reason]??"No se pudo completar la prueba.")+"\nComprobaci�n: "+new Date().toLocaleString("es-PE")+". Es una prueba puntual; no garantiza disponibilidad futura.";
   }else result.textContent="Configuraci�n t�cnica: "+(data.provider??"sin proveedor")+"; clave presente: "+(data.providerConfigured?"s�":"no")+"; cach�: "+(data.cacheReady??data.cache?"disponible":"no disponible")+". A�n no se ha comprobado una traducci�n real.";
  }catch(e){if(c.isCurrent())result.textContent="No se pudo verificar la traducci�n. Puede requerirse desplegar la funci�n actualizada, renovar la sesi�n o revisar la configuraci�n del proveedor. No se considera operativa.";}
  finally{pending=false;if(c.isCurrent())for(const b of actions.children)b.disabled=false;}
 }
 actions.append(c.button("Consultar estado t�cnico",()=>run(false)),c.button("Probar traducci�n real",()=>run(true),""));
 card.append(grid,result,actions,c.node("p","La prueba real env�a solo �Hello.� (6 caracteres) a espa�ol. Requiere permiso de configuraci�n, respeta el presupuesto y admite hasta 3 intentos por minuto. No utiliza oraciones ni contenido de usuarios.","small"));return card;
}
