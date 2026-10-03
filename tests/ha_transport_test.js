// Test the shared transport without a browser, board, HA token or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../firmware/components/air_monitor_web_ui/web/transport.js'),'utf8');
async function main(){
  const origin='https://ha.example.test',parent={postMessage:message=>sent.push(message)},sent=[],listeners={};
  const context={URLSearchParams,Response,DOMException,setTimeout,clearTimeout,location:{origin,pathname:'/sen65_air_monitor_static/index.html',search:'?ha_entry=board1&ha_session=session1'},document:{documentElement:{dataset:{}}},window:{parent,addEventListener:(type,callback)=>listeners[type]=callback},fetch:()=>{throw new Error('Browser must not request the LAN board');}};
  vm.runInNewContext(source,context);
  const request=context.airMonitorFetch('/api/state');
  assert.equal(sent[0].entry_id,'board1');assert.equal(sent[0].session,'session1');
  const reply={type:'sen65:result',id:sent[0].id,session:'session1',status:200,data:{temp:23}};
  listeners.message({origin:'https://evil.test',source:parent,data:reply});
  listeners.message({origin,source:{},data:reply});
  listeners.message({origin,source:parent,data:{...reply,session:'old-session'}});
  listeners.message({origin,source:parent,data:reply});
  assert.equal((await (await request).json()).temp,23);
  const write=context.airMonitorFetch('/api/weather',{method:'POST',body:new URLSearchParams({mode:'auto'})});
  assert.equal(sent[1].body,'mode=auto');
  listeners.message({origin,source:parent,data:{...reply,id:sent[1].id,status:409,data:{error:'Busy'}}});
  assert.equal((await write).ok,false);
  await assert.rejects(context.airMonitorFetch('https://evil.test/api/state'));
  const controller=new AbortController();const abort=context.airMonitorFetch('/api/state',{signal:controller.signal});controller.abort();
  await assert.rejects(abort,error=>error.name==='AbortError');
  const direct={...context,location:{origin:'http://board.local',pathname:'/',search:''},window:{parent:{},addEventListener(){}},fetch:async url=>url};direct.window.parent=direct.window;
  vm.runInNewContext(source,direct);
  assert.equal(await direct.airMonitorFetch('/api/state'),'/api/state');
  assert.equal(direct.AirMonitorEmbeddedHA,false);
  console.log('HA transport security and standalone-mode tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
