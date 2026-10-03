// Shared dashboard transport. HA mode never sends board requests from the browser.
(function () {
  'use strict';
  const params=new URLSearchParams(location.search),entry=params.get('ha_entry'),session=params.get('ha_session');
  const embedded=Boolean(entry&&window.parent!==window&&location.pathname.startsWith('/sen65_air_monitor_static/'));
  globalThis.AirMonitorEmbeddedHA=embedded;
  if(!embedded){globalThis.airMonitorFetch=(...args)=>fetch(...args);return;}
  document.documentElement.dataset.haEmbedded='true';
  const pending=new Map();let sequence=0;
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='sen65:result'||event.data.session!==session)return;
    const request=pending.get(event.data.id);if(!request)return;
    pending.delete(event.data.id);clearTimeout(request.timeout);request.cleanup();
    if(event.data.error)request.reject(new Error(event.data.error));
    else request.resolve(new Response(JSON.stringify(event.data.data),{status:event.data.status,headers:{'Content-Type':'application/json'}}));
  });
  globalThis.airMonitorFetch=(path,options={})=>new Promise((resolve,reject)=>{
    const method=(options.method||'GET').toUpperCase();
    if(typeof path!=='string'||!path.startsWith('/api/')||!['GET','POST'].includes(method)){
      reject(new Error('Unsupported dashboard request.'));return;
    }
    if(options.signal?.aborted){reject(new DOMException('Request cancelled','AbortError'));return;}
    const id=++sequence;
    const abort=()=>{const request=pending.get(id);if(!request)return;pending.delete(id);clearTimeout(request.timeout);request.cleanup();reject(new DOMException('Request cancelled','AbortError'));};
    const timeout=setTimeout(()=>{pending.delete(id);options.signal?.removeEventListener('abort',abort);reject(new Error('Home Assistant did not respond.'));},15000);
    pending.set(id,{resolve,reject,timeout,cleanup:()=>options.signal?.removeEventListener('abort',abort)});
    options.signal?.addEventListener('abort',abort,{once:true});
    window.parent.postMessage({type:'sen65:request',id,session,entry_id:entry,path,method,body:options.body?String(options.body):''},location.origin);
  });
})();
