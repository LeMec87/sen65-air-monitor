const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let Panel;
const source=fs.readFileSync(path.resolve(__dirname,'../custom_components/sen65_air_monitor/frontend/panel.js'),'utf8');
assert.match(source,/\[hidden\]\{display:none!important\}/); // Explicit iframe display must not override hidden/offline states.
assert.match(source,/flex:1 1 0/);
assert.doesNotMatch(source,/height:calc\(100% - 65px\)/);
const viewport={offsetTop:0,height:800};
const sizeWindow={visualViewport:viewport,innerHeight:800};
vm.runInNewContext(source,{HTMLElement:class{},customElements:{define:(name,klass)=>{assert.equal(name,'sen65-air-monitor-panel');Panel=klass;}},location:{origin:'https://ha.example.test'},window:sizeWindow,getComputedStyle:()=>({paddingBottom:'12px'})});
const fixture=fs.readFileSync(path.resolve(__dirname,'../tools/preview_ha_panel.mjs'),'utf8');
assert.doesNotMatch(fixture,/sen65-air-monitor-panel\{height:/); // The fixture must not conceal component sizing bugs.
async function main(){
  const sizing=Object.create(Panel.prototype),styles=new Map();sizing.isConnected=true;
  sizing.getBoundingClientRect=()=>({top:48});sizing.style={getPropertyValue:k=>styles.get(k),setProperty:(k,v)=>styles.set(k,v)};
  sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'740px');
  viewport.height=500;sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'440px');
  viewport.height=40;sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'0px');
  viewport.height=500;viewport.offsetTop=100;sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'540px');
  sizeWindow.visualViewport=undefined;sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'740px');
  sizeWindow.visualViewport=viewport;viewport.offsetTop=0;viewport.height=40;sizing._fitViewport();
  sizing.isConnected=false;viewport.height=800;sizing._fitViewport();assert.equal(styles.get('--sen65-panel-height'),'0px');
  const sent=[],frame={postMessage:(data,origin)=>sent.push({data,origin})};
  const panel=Object.create(Panel.prototype);panel._selected='a';panel._session='new';panel._frame={contentWindow:frame};
  let calls=0;panel._hass={callWS:async data=>{calls++;assert.equal(data.entry_id,'a');return {status:200,data:{temp:23}};}};
  const data={type:'sen65:request',entry_id:'a',session:'new',id:1,path:'/api/state',method:'GET',body:''};
  for(const event of [{origin:'https://evil.test',source:frame,data},{origin:'https://ha.example.test',source:{},data},{origin:'https://ha.example.test',source:frame,data:{...data,session:'old'}},{origin:'https://ha.example.test',source:frame,data:{...data,entry_id:'b'}}])await panel._bridge(event);
  assert.equal(calls,0);
  await panel._bridge({origin:'https://ha.example.test',source:frame,data});
  assert.equal(calls,1);assert.equal(sent[0].data.data.temp,23);assert.equal(sent[0].data.session,'new');
  let resolve;panel._hass.callWS=()=>new Promise(r=>resolve=r);
  const pending=panel._bridge({origin:'https://ha.example.test',source:frame,data});
  panel._session='switched-away-and-back';resolve({status:200,data:{temp:99}});await pending;
  assert.equal(sent.length,1); // Even switching away and back cannot deliver old data.
  console.log('HA panel sizing, bridge and board-switching security tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
