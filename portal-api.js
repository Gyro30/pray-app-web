// Public client key is supplied by config.js. Never use a server secret here.
export class PortalApi {
 constructor(config){this.config=config;this.session=null;this.epoch=0;this.pending=new Set();this.refreshing=null;}
 clear(){this.epoch++;this.session=null;this.refreshing=null;for(const c of this.pending)c.abort();this.pending.clear();}
 async request(path,payload,{auth=true,method="POST"}={}){
  const epoch=this.epoch,controller=new AbortController();this.pending.add(controller);
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   if(auth&&!this.session)throw Error("AUTH_REQUIRED");
   const headers={apikey:this.config.key,"Content-Type":"application/json"};
   if(auth)headers.Authorization="Bearer "+this.session.access_token;
   const res=await fetch(this.config.url+path,{method,headers,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",
    ...(method==="GET"?{}:{body:JSON.stringify(payload)}),signal:controller.signal});
   const data=await res.json().catch(()=>({}));
   if(epoch!==this.epoch)throw Error("SESSION_CHANGED");
   if(!res.ok){
    const value=data.error??data.message;
    const code=typeof value==="string"&&Object.hasOwn(errorMessages,value)?value:
     res.status===401?"INVALID_SESSION":res.status===404?"SERVICE_NOT_DEPLOYED":res.status===429?"RATE_LIMITED":"REQUEST_FAILED";
    throw Error(code);
   }
   return data;
  }finally{clearTimeout(timer);this.pending.delete(controller);}
 }
 async login(email,password){
  this.clear();
  const session=await this.request("/auth/v1/token?grant_type=password",{email,password},{auth:false});
  if(!session.access_token||!session.refresh_token)throw Error("INVALID_SESSION");
  this.session={...session,expires_at:Date.now()/1000+session.expires_in};
 }
 async refresh(){
  if(!this.session)throw Error("AUTH_REQUIRED");
  if(this.session.expires_at>Date.now()/1000+60)return;
  if(this.refreshing)return this.refreshing;
  const current=(async()=>{
   const data=await this.request("/auth/v1/token?grant_type=refresh_token",{refresh_token:this.session.refresh_token},{auth:false});
   if(!data.access_token||!data.refresh_token){this.clear();throw Error("INVALID_SESSION");}
   this.session={...data,expires_at:Date.now()/1000+data.expires_in};
  })();
  this.refreshing=current;
  try{await current;}finally{if(this.refreshing===current)this.refreshing=null;}
 }
 async rpc(name,args={}){
  await this.refresh();return this.request("/rest/v1/rpc/"+name,args);
 }
 async logout(){
  try{if(this.session)await this.request("/auth/v1/logout?scope=local",{});}finally{this.clear();}
 }
}
const errorMessages={
 AUTH_REQUIRED:"Inicia sesión para continuar.",INVALID_SESSION:"La sesión venció. Vuelve a ingresar.",
 ADMIN_FORBIDDEN:"Tu cuenta no tiene permiso para esta acción.",OWNER_REQUIRED:"Solo el propietario puede realizar esta acción.",
 OWNER_PROTECTED:"La cuenta propietaria está protegida.",STAFF_PROTECTED:"Esta cuenta administrativa está protegida.",
 SERVICE_NOT_DEPLOYED:"El servicio aún no está habilitado. Puedes usar el correo de soporte.",
 SERVICE_UNAVAILABLE:"El servicio no está disponible temporalmente. Intenta nuevamente.",
 RATE_LIMITED:"Demasiados intentos. Espera unos minutos.",INVALID_EMAIL:"Escribe un correo válido.",
 INVALID_CODE:"Escribe el código recibido por correo.",INVALID_OR_EXPIRED_CODE:"El código no es válido, venció o alcanzó el límite de intentos. Solicita uno nuevo.",
 DELETION_CONFIRMATION_INVALID:"La confirmación venció o no es válida. Inicia de nuevo.",
 DELETION_BUSY:"La eliminación está en curso. Espera un minuto antes de volver a confirmar.",
 LAST_OWNER:"Antes de eliminar esta cuenta, transfiere la propiedad administrativa desde Supabase.",
 ACCOUNT_DATA_DELETE_FAILED:"No se pudo completar la limpieza de datos. La cuenta no se ha eliminado; intenta nuevamente.",
 AUTH_USER_DELETE_FAILED:"La limpieza terminó, pero falta cerrar la cuenta. Vuelve a confirmar para completar la eliminación.",
 CONFIRMATION_RETRY_REQUIRED:"No recibimos la confirmación final. Espera un minuto y vuelve a confirmar.",
 CONFIG_CHANGED:"Otra persona cambió la configuración. Recarga y revisa los valores antes de guardar.",
 REPORT_NO_LONGER_PENDING:"Este caso ya no está pendiente. Actualiza la lista.",
 SESSION_CHANGED:"La sesión cambió. Vuelve a ingresar.",
 CONFIRMATION_REQUIRED:"Escribe exactamente la confirmación solicitada.",
 INVALID_PERMISSIONS:"Revisa los permisos seleccionados.",USER_NOT_FOUND:"No encontramos esta cuenta."
};
export const errorText=error=>errorMessages[error?.message]??(error?.name==="AbortError"?"La solicitud tardó demasiado. Intenta nuevamente.":"No se pudo completar la acción. Revisa los datos e intenta nuevamente.");
