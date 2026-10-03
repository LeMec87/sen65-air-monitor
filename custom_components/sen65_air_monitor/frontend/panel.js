// An HA-native panel containing the exact shared dashboard, with a scoped bridge.
class SEN65AirMonitorPanel extends HTMLElement {
  constructor() {
    super();this._hass=null;this._entries=[];this._selected='';this._loading=false;
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML=`<style>:host{display:block;height:100%;background:#0b111b;color:#e9eff6;font-family:system-ui}[hidden]{display:none!important} .bar{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#142133;border-bottom:1px solid #ffffff24}label{font-size:12px}select{min-height:44px;max-width:100%;color:inherit;background:#1e3044;border:1px solid #ffffff33;border-radius:12px;padding:8px 12px}iframe{display:block;width:100%;height:calc(100% - 65px);border:0}p{padding:16px;font-size:13px}button{min-height:44px;padding:8px 14px;color:inherit;background:#2585d9;border:0;border-radius:12px}</style><div class="bar"><label for="board">Monitor</label><select id="board" aria-label="Select monitor"></select></div><p id="status" role="status">Connecting to Home Assistant…</p><button id="retry" hidden>Try again</button><iframe title="SEN65 Air Monitor dashboard" hidden></iframe>`;
    this._frame=this.shadowRoot.querySelector('iframe');this._select=this.shadowRoot.querySelector('select');
    this._status=this.shadowRoot.querySelector('#status');this._retry=this.shadowRoot.querySelector('#retry');
    this._select.addEventListener('change',()=>this._show(this._select.value));
    this._retry.addEventListener('click',()=>this._load());
    this._receive=event=>this._bridge(event);
  }
  set hass(value){this._hass=value;if(this.isConnected&&!this._entries.length&&!this._loading&&this._retry.hidden)this._load();}
  set panel(value){this._panel=value;}
  connectedCallback(){window.addEventListener('message',this._receive);if(this._hass)this._load();}
  disconnectedCallback(){window.removeEventListener('message',this._receive);this._frame.src='about:blank';this._entries=[];this._selected='';}
  async _load(){
    if(!this._hass||this._loading)return;
    this._loading=true;this._retry.hidden=true;
    try{
      const entries=await this._hass.callWS({type:'sen65_air_monitor/list'});
      if(!this.isConnected)return;
      this._entries=entries;this._select.replaceChildren();
      for(const entry of entries){const option=document.createElement('option');option.value=entry.entry_id;option.textContent=entry.title;this._select.append(option);}
      if(!entries.length)throw new Error('No monitor is available. Check its connection in Settings → Devices & services.');
      this._show(entries.some(e=>e.entry_id===this._selected)?this._selected:entries[0].entry_id);
    }catch(error){this._status.textContent=error.message||'This panel is available to HA administrators. Try again after the monitor connects.';this._status.hidden=false;this._frame.hidden=true;this._retry.hidden=false;}
    finally{this._loading=false;}
  }
  _show(id){
    if(!this._entries.some(e=>e.entry_id===id))return;
    this._selected=id;this._session=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');this._select.value=id;this._status.hidden=true;this._frame.hidden=false;
    this._frame.src='/sen65_air_monitor_static/index.html?ha_entry='+encodeURIComponent(id)+'&ha_session='+encodeURIComponent(this._session);
  }
  async _bridge(event){
    const request=event.data;
    if(event.origin!==location.origin||event.source!==this._frame.contentWindow||request?.type!=='sen65:request'||request.entry_id!==this._selected||request.session!==this._session||!Number.isSafeInteger(request.id))return;
    const frame=event.source,entry=this._selected,session=this._session;
    let result;
    try{result=await this._hass.callWS({type:'sen65_air_monitor/request',entry_id:entry,path:request.path,method:request.method,body:request.body});}
    catch(error){result={error:error.message||'Cannot connect to the monitor through HA.'};}
    // Drop replies to a replaced iframe so board switching cannot mix data.
    if(session!==this._session||entry!==this._selected||frame!==this._frame.contentWindow)return;
    frame.postMessage({type:'sen65:result',id:request.id,session,...result},location.origin);
  }
}
customElements.define('sen65-air-monitor-panel',SEN65AirMonitorPanel);
