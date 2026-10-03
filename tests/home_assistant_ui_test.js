// Exercise setup-state transitions without contacting a board or HA server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = path.resolve(__dirname, '../firmware/components/air_monitor_web_ui/web');

class Element {
  constructor() { this.textContent=''; this.dataset={}; this.hidden=false; this.disabled=false; this.value=''; this.children=[]; this.listeners={}; }
  addEventListener(type, callback) { this.listeners[type]=callback; }
  replaceChildren(...children) { this.children=children; this.value=''; }
  appendChild(child) { this.children.push(child); if(this.children.length===1)this.value=child.value; }
}

async function main() {
  const elements=new Map([...fs.readFileSync(path.join(web,'index.html'),'utf8').matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
  const base={network_connected:true,scanning:false,api_connected:false,error:'',device_host:'sen65-example.local',device_url:'http://sen65-example.local/',instances:[{name:'Home',url:'http://homeassistant.local:8123'}]};
  let payload=base, unavailable=false, responseStatus=200, interval;
  const context={URL,console,document:{getElementById:id=>elements.get(id),createElement:()=>new Element()},
    fetch:async()=>{if(unavailable)throw new Error('Failed to fetch');return {ok:responseStatus===200,status:responseStatus,json:async()=>payload};},
    setInterval:callback=>{interval=callback;},setTimeout:()=>{},navigator:{}};
  context.airMonitorFetch=context.fetch;
  vm.runInNewContext(fs.readFileSync(path.join(web,'home-assistant.js'),'utf8'),context);
  const $=id=>elements.get(id),flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush();
  assert.equal($('ha-status').textContent,'Detected');
  assert.equal($('ha-connect-body').hidden,false);
  assert.equal($('ha-copy-url').disabled,false);
  assert.equal($('ha-dashboards').href,'http://homeassistant.local:8123/sen65-air-monitor');
  assert.equal($('ha-https-warning').hidden,true);

  payload={...base,api_connected:true}; await interval();
  assert.equal($('ha-status').textContent,'Connected');
  assert.equal($('ha-connect-body').hidden,false); // Native ESPHome does not install our panel.
  assert.equal($('ha-connected-note').hidden,false);
  assert.equal($('ha-connect-step').dataset.connected,'false');
  assert.equal($('ha-copy-url').disabled,false);

  unavailable=true; await interval();
  assert.equal($('ha-status').textContent,'Unavailable');
  assert.equal($('ha-connect-body').hidden,false);
  assert.equal($('ha-connected-note').hidden,true);
  for(const id of ['ha-copy-url','ha-copy-host','ha-download'])assert.equal($(id).disabled,true);
  assert.equal($('ha-device-url').textContent,'Unavailable');

  unavailable=false; responseStatus=404; await interval();
  assert.ok($('ha-message').textContent.includes('latest firmware'));
  responseStatus=200;

  unavailable=false; payload={...base,instances:[]}; await interval();
  assert.equal($('ha-status').textContent,'Not found');
  assert.equal($('ha-copy-url').disabled,false);
  assert.equal($('ha-dashboards').href,'https://my.home-assistant.io/');
  assert.equal($('ha-https-warning').hidden,true);

  $('ha-manual-url').value='https://ha.example.test/';
  $('ha-manual-form').listeners.submit({preventDefault(){}});
  assert.equal($('ha-dashboards').href,'https://ha.example.test/sen65-air-monitor');
  assert.equal($('ha-https-warning').hidden,true);
  $('ha-manual-url').value='javascript:alert(1)';
  $('ha-manual-form').listeners.submit({preventDefault(){}});
  assert.equal($('ha-action-status').dataset.error,'true');
  assert.equal($('ha-dashboards').href,'https://ha.example.test/sen65-air-monitor');

  payload={...base,network_connected:false,instances:[]}; await interval();
  assert.equal($('ha-status').textContent,'Wi-Fi disconnected');
  assert.equal($('ha-scan').disabled,true);
  console.log('Home Assistant UI transition tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
