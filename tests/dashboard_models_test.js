// Exercise the same pure helpers loaded by the dashboard, without a browser.
const assert = require('node:assert/strict');
require('../firmware/components/air_monitor_web_ui/web/history.js');
require('../firmware/components/air_monitor_web_ui/web/home-assistant.js');
const h = globalThis.AirMonitorHistoryModel, ha = globalThis.AirMonitorHAModel;
for (const [group, fields] of Object.entries(h.groups)) {
  const payload = {uptime_ms:90000000,metrics:fields.map(f=>f.key),points:[]};
  assert.deepEqual(h.decode(payload, group), []);
  payload.points = [[89900000,...fields.map(()=>2)]];
  assert.equal(h.decode(payload,group)[0].age,100);
  payload.points = Array.from({length:288},(_,i)=>[90000000-(287-i)*300000,...fields.map(()=>2)]);
  assert.equal(h.decode(payload,group).length,288);
  payload.points.push(payload.points[0]);
  assert.throws(()=>h.decode(payload,group));
}
assert.throws(()=>h.decode({uptime_ms:0,metrics:[],points:[]},'climate'));
assert.throws(()=>h.decode({uptime_ms:-1,metrics:['voc','nox'],points:[]},'gases'));
const rollover={uptime_ms:1000,metrics:['temp','rh'],points:[[0xfffffff0,20,null],[1000,NaN,Infinity]]};
assert.equal(h.decode(rollover,'climate')[0].age,1.016);
assert.deepEqual(h.decode(rollover,'climate')[1].values,[null,null]);
assert.equal(h.decode({uptime_ms:90000000,metrics:['voc','nox'],points:[[0,1,2],[90000000,3,4]]},'gases').length,1);
assert.equal(h.value('temp',20,'F'),68);
assert.equal(h.value('temp',null,'F'),null);
assert.equal(h.value('rh',20,'F'),20);
assert.equal(h.unitFor('temp','F'),'°F');
assert.equal(h.unitFor('pm25','C'),'µg/m³');
assert.equal(h.nearest([{age:100},{age:20}],27),1);
assert.equal(h.nearest([],10),-1);
assert.deepEqual(h.bounds([null,NaN],false),[0,1]);
assert.equal(h.bounds([0,0],false)[0],0);
assert.ok(h.bounds([-10,-10],true)[0]<-10);
for(const v of [0,1,23.4,74.12,500,1000]){
  const [lo,hi]=h.bounds([v,v],false),step=(hi-lo)/4;
  assert.equal(new Set(Array.from({length:5},(_,i)=>h.tick(hi-step*i,step))).size,5);
}
assert.equal(new Set(h.groups.particles.map(f=>f.dash)).size,4);
assert.equal(ha.webURL('http://homeassistant.local:8123/a'),'http://homeassistant.local:8123');
assert.equal(ha.webURL('https://example.test/'),'https://example.test');
for(const url of ['javascript:alert(1)','file:///tmp/x','http://user:secret@example.test','http://example.test\n',''])assert.equal(ha.webURL(url),null);
assert.throws(()=>ha.dashboardYAML('javascript:alert(1)'));
const yaml=ha.dashboardYAML('http://sen65-air-monitor-example.local/');
assert.ok(yaml.includes('type: iframe')&&yaml.includes('type: panel'));
assert.ok(!yaml.includes('disable_sandbox'));
assert.ok(yaml.includes('url: "http://sen65-air-monitor-example.local/"'));
const connected=ha.setupState({api_connected:true,instances:[],network_connected:true});
assert.equal(connected.label,'Connected');
assert.equal(connected.connected,true);
assert.ok(connected.message.includes('dashboard integration'));
assert.equal(ha.setupState({api_connected:false,instances:[{}],network_connected:true}).label,'Detected');
assert.equal(ha.setupState({api_connected:false,instances:[],network_connected:true}).label,'Not found');
assert.equal(ha.setupState({api_connected:false,instances:[],network_connected:false}).label,'Wi-Fi disconnected');
assert.equal(ha.setupState({scanning:true,instances:[]}).label,'Searching…');
assert.ok(ha.setupState({error:'internal failure'}).message.includes('Advanced options'));
assert.equal(ha.setupLinks('https://ha.example.test/').dashboards,'https://ha.example.test/config/lovelace/dashboards');
assert.equal(ha.setupLinks('https://ha.example.test/').panel,'https://ha.example.test/sen65-air-monitor');
assert.equal(ha.setupLinks('http://homeassistant.local:8123/').open,'http://homeassistant.local:8123');
assert.ok(ha.setupLinks('javascript:alert(1)').dashboards.startsWith('https://my.home-assistant.io/'));
console.log('Dashboard model tests passed.');
