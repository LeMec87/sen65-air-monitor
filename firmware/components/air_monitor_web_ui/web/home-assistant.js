(function () {
  'use strict';
  function webURL(raw) {
    try { const url=new URL(raw);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!/[\x00-\x20]/.test(raw)?url.origin:null; }
    catch { return null; }
  }
  function dashboardYAML(url) {
    if(!webURL(url))throw new Error('No valid dashboard URL is available.');
    return 'title: SEN65 Air Monitor\nviews:\n  - title: Air Monitor\n    path: air-monitor\n    type: panel\n    cards:\n      - type: iframe\n        url: '+JSON.stringify(url)+'\n        aspect_ratio: 100%\n';
  }
  globalThis.AirMonitorHAModel={webURL,dashboardYAML};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  let data=null,manual='',pending=false;
  const action=$('ha-action-status'),instances=$('ha-instance');
  const message=(text,error=false)=>{action.textContent=text;action.dataset.error=String(error);};
  function selectedURL() { return manual||webURL(instances.value)||''; }
  function updateLinks() {
    const base=selectedURL();
    $('ha-open').href=base||'https://my.home-assistant.io/';
    $('ha-dashboards').href=base?base+'/config/lovelace/dashboards':'https://my.home-assistant.io/redirect/lovelace_dashboards/';
    $('ha-open').textContent=manual?'Open manually selected HA':'Open Home Assistant';
  }
  function render(next) {
    data=next;const known=Array.isArray(data.instances)?data.instances:[];
    const connected=data.api_connected===true,detected=known.length>0;
    const badge=$('ha-status');
    badge.textContent=connected?'API connected':data.scanning?'Searching…':detected?'Detected':data.network_connected?'Not found':'Wi-Fi disconnected';
    badge.className='fw-badge '+(connected||detected?'fw-badge--ok':'fw-badge--unknown');
    $('ha-message').textContent=data.error|| (connected?'A Home Assistant client is currently connected to this board.':detected?'Home Assistant was discovered locally. Integration starts only when you confirm it in Home Assistant.':data.scanning?'Looking for Home Assistant on this network…':'No Home Assistant advertisement was found. Check its Zeroconf settings, network isolation, or enter its URL below.');
    $('ha-message').dataset.error=String(Boolean(data.error));
    $('ha-nav-dot').hidden=!(connected||detected);
    $('ha-notice').hidden=!(connected||detected);
    $('ha-notice').textContent=connected?'Home Assistant API connected · View setup':'Home Assistant detected · Set up';
    const current=instances.value;instances.replaceChildren();
    if(!known.length){const option=document.createElement('option');option.textContent='No instance found';option.value='';instances.appendChild(option);}
    known.forEach(instance=>{const option=document.createElement('option');option.textContent=String(instance.name||'Home Assistant')+(instance.url?' · '+instance.url:' · use a manual URL');option.value=webURL(instance.url)||'';instances.appendChild(option);});
    if(known.some(instance=>webURL(instance.url)===current))instances.value=current;
    instances.disabled=known.length<2;
    $('ha-scan').disabled=data.scanning||pending||!data.network_connected;
    $('ha-device-host').textContent=data.device_host||'Unavailable';
    $('ha-device-url').textContent=webURL(data.device_url)?data.device_url:'Unavailable';
    $('ha-download').disabled=!webURL(data.device_url);
    updateLinks();
  }
  async function poll() {
    try {
      const response=await fetch('/api/home_assistant',{cache:'no-store'});
      if(!response.ok)throw new Error(response.status===404?'Install the new firmware for local HA discovery.':'Discovery status is unavailable.');
      render(await response.json());
    }catch(error){$('ha-message').textContent=error.message;$('ha-message').dataset.error='true';$('ha-status').textContent='Unavailable';$('ha-status').className='fw-badge fw-badge--unknown';$('ha-scan').disabled=false;$('ha-nav-dot').hidden=true;$('ha-notice').hidden=true;}
  }
  async function copy(text) {
    if(!text||text==='Unavailable'||text==='Loading…'){message('Wait until the device details are available.',true);return;}
    try { if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);message('Copied.'); }
    catch {
      const field=document.createElement('textarea');field.value=text;field.setAttribute('aria-label','Text to copy');field.className='weather-input';action.replaceChildren(field);field.focus();field.select();
      const ok=document.execCommand&&document.execCommand('copy');
      if(ok)message('Copied.');else field.insertAdjacentText('afterend',' Select this text and copy it manually.');
    }
  }
  $('ha-copy-host').addEventListener('click',()=>copy(data&&data.device_host));
  $('ha-copy-url').addEventListener('click',()=>copy(data&&data.device_url));
  $('ha-notice').addEventListener('click',()=>$('nav-ha').click());
  instances.addEventListener('change',()=>{manual='';$('ha-manual-url').value='';updateLinks();});
  $('ha-manual-form').addEventListener('submit',event=>{
    event.preventDefault();const entered=$('ha-manual-url').value.trim();
    if(!entered){manual='';updateLinks();message('Using the discovered address again.');return;}
    const url=webURL(entered);if(!url){message('Enter an HTTP or HTTPS URL without credentials.',true);return;}
    manual=url;updateLinks();message('Manual URL selected. This does not verify detection or connect the integration.');
  });
  $('ha-scan').addEventListener('click',async()=>{
    pending=true;$('ha-scan').disabled=true;
    try {const response=await fetch('/api/home_assistant/scan',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Search could not start.');message('Local discovery requested.');}
    catch(error){message(error.message,true);}
    finally{pending=false;poll();setTimeout(poll,3500);}
  });
  $('ha-download').addEventListener('click',()=>{
    try {const yaml=dashboardYAML(data&&data.device_url);const url=URL.createObjectURL(new Blob([yaml],{type:'text/yaml'}));const link=document.createElement('a');link.href=url;link.download='sen65-air-monitor-dashboard.yaml';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Use this YAML only in a new, dedicated dashboard. Keep existing HA dashboards unchanged.');}
    catch(error){message(error.message,true);}
  });
  $('nav-ha').addEventListener('click',poll);
  setInterval(poll,15000);poll();
})();
