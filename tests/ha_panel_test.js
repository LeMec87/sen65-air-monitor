const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let Panel;
const source=fs.readFileSync(path.resolve(__dirname,'../custom_components/sen65_air_monitor/frontend/panel.js'),'utf8');
assert.match(source,/\[hidden\]\{display:none!important\}/); // Explicit iframe display must not override hidden/offline states.
vm.runInNewContext(source,{HTMLElement:class{},customElements:{define:(name,klass)=>{assert.equal(name,'sen65-air-monitor-panel');Panel=klass;}},location:{origin:'https://ha.example.test'}});
async function main(){
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
  console.log('HA panel bridge and board-switching security tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
