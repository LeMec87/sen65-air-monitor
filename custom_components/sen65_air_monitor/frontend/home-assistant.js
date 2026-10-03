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
  function setupState(data) {
    const connected=data.api_connected===true,detected=Array.isArray(data.instances)&&data.instances.length>0;
    return {connected,detected,
      label:connected?'Connected':data.scanning?'Searching…':detected?'Detected':data.network_connected?'Not found':'Wi-Fi disconnected',
      message:data.error?'Discovery is unavailable. Try again under Advanced options.':connected?'ESPHome connected. Install the dashboard integration below if needed.':detected?'Home Assistant found. Set up your dashboard below.':data.scanning?'Looking for Home Assistant…':'Cannot find HA? Enter its address under Advanced options.'};
  }
  function setupLinks(base) {
    const origin=webURL(base);
    return {open:origin||'https://my.home-assistant.io/',dashboards:origin?origin+'/config/lovelace/dashboards':'https://my.home-assistant.io/redirect/lovelace_dashboards/',panel:origin?origin+'/sen65-air-monitor':'https://my.home-assistant.io/'};
  }
  globalThis.AirMonitorHAModel={webURL,dashboardYAML,setupState,setupLinks};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  if(globalThis.AirMonitorEmbeddedHA){
    $('ha-status').textContent='Panel installed';$('ha-status').className='fw-badge fw-badge--ok';
    $('ha-message').textContent='You are using the dashboard through Home Assistant. No separate HTTPS address or Cloudflare route is needed.';
    document.querySelector('.ha-setup').hidden=true;document.querySelector('.ha-advanced').hidden=true;
    $('ha-https-warning').hidden=true;$('ha-notice').hidden=true;$('ha-nav-dot').hidden=false;
    return;
  }
  let data=null,manual='',pending=false;
  const action=$('ha-action-status'),instances=$('ha-instance');
  const message=(text,error=false)=>{action.textContent=text;action.dataset.error=String(error);};
  function selectedURL() { return manual||webURL(instances.value)||''; }
  function updateLinks() {
    const base=selectedURL(),links=setupLinks(base);
    $('ha-open').href=links.open;
    $('ha-dashboards').href=links.panel;
    // The integration uses HA's own origin; HTTPS advice applies only to legacy embeds.
    $('ha-https-warning').hidden=true;
  }
  function render(next) {
    data=next;const known=Array.isArray(data.instances)?data.instances:[];
    const state=setupState(data),{connected,detected}=state;
    const badge=$('ha-status');
    badge.textContent=state.label;
    badge.className='fw-badge '+(connected||detected?'fw-badge--ok':'fw-badge--unknown');
    $('ha-message').textContent=state.message;
    $('ha-message').dataset.error=String(Boolean(data.error));
    $('ha-nav-dot').hidden=!(connected||detected);
    $('ha-notice').hidden=!(connected||detected);
    $('ha-notice').textContent=connected?'Home Assistant connected · Add dashboard':'Home Assistant detected · Set up';
    $('ha-connect-step').dataset.connected='false';
    $('ha-connect-number').textContent='1';
    $('ha-connect-title').textContent='Install the HA integration';
    $('ha-connect-body').hidden=false;
    $('ha-connected-note').hidden=!connected;
    const current=instances.value;instances.replaceChildren();
    if(!known.length){const option=document.createElement('option');option.textContent='No instance found';option.value='';instances.appendChild(option);}
    known.forEach(instance=>{const option=document.createElement('option');option.textContent=String(instance.name||'Home Assistant')+(instance.url?' · '+instance.url:' · use a manual URL');option.value=webURL(instance.url)||'';instances.appendChild(option);});
    if(known.some(instance=>webURL(instance.url)===current))instances.value=current;
    instances.disabled=known.length<2;
    $('ha-scan').disabled=data.scanning||pending||!data.network_connected;
    $('ha-device-host').textContent=data.device_host||'Unavailable';
    $('ha-device-url').textContent=webURL(data.device_url)?data.device_url:'Unavailable';
    $('ha-download').disabled=!webURL(data.device_url);
    $('ha-copy-url').disabled=!webURL(data.device_url);
    $('ha-copy-host').disabled=!data.device_host;
    updateLinks();
  }
  async function poll() {
    try {
      const response=await airMonitorFetch('/api/home_assistant',{cache:'no-store'});
      if(!response.ok)throw new Error(response.status===404?'Install the latest firmware to use HA setup.':'Cannot reach the monitor. Reconnect and try again.');
      render(await response.json());
    }catch(error){
      data=null;
      $('ha-message').textContent=error.message==='Install the latest firmware to use HA setup.'?error.message:'Cannot reach the monitor. Reconnect and try again.';$('ha-message').dataset.error='true';
      $('ha-status').textContent='Unavailable';$('ha-status').className='fw-badge fw-badge--unknown';
      $('ha-scan').disabled=false;$('ha-nav-dot').hidden=true;$('ha-notice').hidden=true;
      $('ha-connect-step').dataset.connected='false';$('ha-connect-number').textContent='1';
      $('ha-connect-title').textContent='Install the HA integration';$('ha-connect-body').hidden=false;$('ha-connected-note').hidden=true;
      for(const id of ['ha-download','ha-copy-url','ha-copy-host'])$(id).disabled=true;
      $('ha-device-host').textContent='Unavailable';$('ha-device-url').textContent='Unavailable';
    }
  }
  async function copy(text,success='Copied.') {
    if(!text||text==='Unavailable'||text==='Loading…'){message('Wait until the device details are available.',true);return;}
    try { if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);message(success); }
    catch {
      const field=document.createElement('textarea');field.value=text;field.setAttribute('aria-label','Text to copy');field.className='weather-input';action.replaceChildren(field);field.focus();field.select();
      const ok=document.execCommand&&document.execCommand('copy');
      if(ok)message(success);else field.insertAdjacentText('afterend',' Select this text and copy it manually.');
    }
  }
  $('ha-copy-host').addEventListener('click',()=>copy(data&&data.device_host));
  $('ha-copy-url').addEventListener('click',()=>copy(data&&data.device_url,'Dashboard link copied. Paste it into the Webpage dashboard in HA.'));
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
    try {const response=await airMonitorFetch('/api/home_assistant/scan',{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Search could not start.');message('Local discovery requested.');}
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
