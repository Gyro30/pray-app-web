"use strict";
// Only this capability is carried into Play's current Install Referrer API.
const tokens=new URLSearchParams(location.search).getAll("token");
const token=tokens.length===1 && /^[a-f0-9]{64}$/.test(tokens[0]) ? tokens[0] : null;
const play="https://play.google.com/store/apps/details?id=com.gyro.prayapp";
const open=document.getElementById("open");
const install=document.getElementById("install");
const published=document.body.dataset.playPublished==="true";
if (!token) {
  document.getElementById("status").textContent="La invitación no es válida. Solicita un nuevo enlace a quien te invitó.";
  document.getElementById("coming").hidden=true;
} else {
  const store=play+"&referrer="+encodeURIComponent("pray_referral="+token);
  const landing="https://gyro30.github.io/pray-app-web/join/?token="+token;
  open.href="intent://join?token="+token+"#Intent;scheme=prayapp;package=com.gyro.prayapp;S.browser_fallback_url="+encodeURIComponent(published?store:landing)+";end";
  open.hidden=false;
  install.href=store; install.hidden=!published;
  document.getElementById("coming").hidden=published;
  let counted=false;
  async function countOpen() {
    if (counted) return;
    counted=true;
    let visit;
    try {
      visit=sessionStorage.getItem("pray_invite_visit");
      if (!visit) { visit=crypto.randomUUID(); sessionStorage.setItem("pray_invite_visit",visit); }
    } catch { visit=crypto.randomUUID(); }
    try {
      await fetch("https://duhfkkohhesiagwwzpqc.supabase.co/rest/v1/rpc/open_referral_link",{
        method:"POST",keepalive:true,headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aGZra29oaGVzaWFnd3d6cHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzU5ODcsImV4cCI6MjA3NjgxMTk4N30.5uiYlAxVqV0xLueGPp-imX5G365-u9J9xu6QEfwmZTY","Content-Type":"application/json"},
        body:JSON.stringify({p_token:token,p_visit_id:visit}),signal:AbortSignal.timeout(3000)
      });
    } catch { } // Click counting never prevents an invitation from opening.
  }
  open.addEventListener("click",()=>{void countOpen();});
  install.addEventListener("click",()=>{void countOpen();});
}
