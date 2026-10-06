(function () {
  'use strict';
  function webURL(raw) {
    try { const url=new URL(raw);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!/[\x00-\x20]/.test(raw)?url.origin:null; }
    catch { return null; }
  }
  function setupState(data) {
    const connected=data.api_connected===true,detected=Array.isArray(data.instances)&&data.instances.length>0;
    return {connected,detected,
      label:connected?'Connected':data.scanning?'Searching…':detected?'Detected':data.network_connected?'Not found':'Wi-Fi disconnected',
      message:data.error?'Discovery is unavailable. You can still add the board manually through ESPHome. See Advanced options.':connected?'Home Assistant is connected through ESPHome.':detected?'Home Assistant found. Connect your board through ESPHome below.':data.scanning?'Looking for Home Assistant…':'No HA instance detected. Add the board manually through ESPHome.'};
  }
  function setupLinks(base) {
    const origin=webURL(base);
    return {open:origin||'https://my.home-assistant.io/',integrate:origin?origin+'/config/integrations/dashboard/add?domain=esphome':'https://my.home-assistant.io/redirect/config_flow_start/?domain=esphome'};
  }
  globalThis.AirMonitorHAModel={webURL,setupState,setupLinks};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  let data=null,manual='',pending=false;
  const action=$('ha-action-status'),instances=$('ha-instance');
  const message=(text,error=false)=>{action.textContent=text;action.dataset.error=String(error);};
  function selectedURL() { return manual||webURL(instances.value)||''; }
  function updateLinks() {
    const base=selectedURL(),links=setupLinks(base);
    $('ha-open').href=links.open;
    $('ha-integrate').href=links.integrate;
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
    $('ha-notice').textContent=connected?'ESPHome connected · View setup':'Home Assistant detected · Connect with ESPHome';
    $('ha-connect-step').dataset.connected=String(connected);
    $('ha-connect-number').textContent=connected?'✓':'1';
    $('ha-connect-title').textContent=connected?'Connected through ESPHome':'Add the ESPHome device';
    $('ha-connect-body').hidden=connected;
    $('ha-connected-note').hidden=!connected;
    const current=instances.value;instances.replaceChildren();
    if(!known.length){const option=document.createElement('option');option.textContent='No instance found';option.value='';instances.appendChild(option);}
    known.forEach(instance=>{const option=document.createElement('option');option.textContent=String(instance.name||'Home Assistant')+(instance.url?' · '+instance.url:' · use a manual URL');option.value=webURL(instance.url)||'';instances.appendChild(option);});
    if(known.some(instance=>webURL(instance.url)===current))instances.value=current;
    instances.disabled=known.length<2;
    $('ha-scan').disabled=data.scanning||pending||!data.network_connected;
    $('ha-device-host').textContent=data.device_host||'Unavailable';
    $('ha-copy-host').disabled=!data.device_host;
    updateLinks();
  }
  async function poll() {
    try {
      const response=await airMonitorFetch('/api/home_assistant',{cache:'no-store'});
      if(!response.ok)throw new Error(response.status===404?'Setup status is unavailable on this firmware. Add the board manually through ESPHome using its local IP.':'Cannot reach the monitor. Reconnect and try again.');
      render(await response.json());
    }catch(error){
      data=null;
      $('ha-message').textContent=error.message.startsWith('Setup status is unavailable')?error.message:'Cannot reach the monitor. Reconnect and try again.';$('ha-message').dataset.error='true';
      $('ha-status').textContent='Unavailable';$('ha-status').className='fw-badge fw-badge--unknown';
      $('ha-scan').disabled=false;$('ha-nav-dot').hidden=true;$('ha-notice').hidden=true;
      $('ha-connect-step').dataset.connected='false';$('ha-connect-number').textContent='1';
      $('ha-connect-title').textContent='Add the ESPHome device';$('ha-connect-body').hidden=false;$('ha-connected-note').hidden=true;
      $('ha-copy-host').disabled=true;
      $('ha-device-host').textContent='Unavailable';
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
  $('nav-ha').addEventListener('click',poll);
  setInterval(poll,15000);poll();
})();
