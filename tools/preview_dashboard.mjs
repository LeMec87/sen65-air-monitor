// Preview fixtures only. No board or Home Assistant request is sent.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../firmware/components/air_monitor_web_ui/web');
const port=Number(process.argv[2]||8768);
let unit='C',haState='detected',historyState='full';
const uptime=90000000;
const fields={particles:['pm1','pm25','pm4','pm10'],gases:['voc','nox'],climate:['temp','rh']};
const state=()=>({temp:23.4,rh:48.2,pm1:3.2,pm25:4.8,pm4:5.1,pm10:6.4,voc:92,nox:1,temp_unit:unit,
  fw_version:'1.0.0',latest_version:'1.0.0',update_configured:true,update_checking:false,update_error:'',has_update:false,update_state:'no_update',update_progress:0});
function history(group) {
  const metrics=fields[group];if(!metrics)return null;
  const count=historyState==='empty'?0:historyState==='one'?1:288;
  const points=Array.from({length:count},(_,i)=>{
    const t=i/287,wave=Math.sin(t*12)*.16+Math.sin(t*31)*.05;
    const vals={pm1:3.2*(.65+.35*t+wave*(1-t)),pm25:4.8*(.65+.35*t+wave*(1-t)),pm4:5.1*(.65+.35*t+wave*(1-t)),pm10:6.4*(.65+.35*t+wave*(1-t)),voc:92*(.65+.35*t+wave*(1-t)),nox:1,temp:23.4+1.8*Math.sin(t*6.283185),rh:48.2-8*Math.sin(t*6.283185)};
    if(historyState==='overlap')for(const key of fields.particles)vals[key]=vals.pm1;
    return [uptime-(count-1-i)*300000,...metrics.map(key=>Number(vals[key].toFixed(2)))];
  });
  return {window_seconds:86400,sample_interval_seconds:300,temperature_unit:'C',uptime_ms:uptime,metrics,points};
}
http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname==='/api/state')return json(state());
  if(url.pathname==='/api/temp_unit'&&req.method==='POST'){unit=url.searchParams.get('unit')==='F'?'F':'C';return json({temp_unit:unit});}
  if(url.pathname==='/api/history'){const data=history(url.searchParams.get('group')||'particles');return json(data||{error:'Invalid group'},data?200:400);}
  if(url.pathname==='/api/home_assistant')return json({network_connected:true,scanning:false,checked:true,api_connected:haState==='connected',error:'',device_host:'sen65-air-monitor-example.local',device_url:'http://sen65-air-monitor-example.local/',api_port:6053,instances:haState==='none'?[]:[{name:'Home · Preview',url:'http://homeassistant.local:8123'}]});
  if(url.pathname==='/api/home_assistant/scan'&&req.method==='POST')return json({ok:true});
  if(url.pathname==='/api/weather')return json({mode:'auto',location:'Berlin, Germany',latitude:52.52,longitude:13.41,kind:4,condition:'Partly cloudy',weather_code:2,age_seconds:60,stale:false,fetching:false,error:''});
  if(url.pathname.startsWith('/api/'))return json({error:'This fixture does not perform device actions.'},409);
  if(url.pathname==='/'){haState=url.searchParams.get('ha')||'detected';historyState=url.searchParams.get('history')||'full';unit=url.searchParams.get('unit')==='F'?'F':'C';}
  const name={'/':'index.html','/style.css':'style.css','/transport.js':'transport.js','/app.js':'app.js','/history.js':'history.js','/home-assistant.js':'home-assistant.js'}[url.pathname];
  if(!name){res.writeHead(404);res.end();return;}
  let content=fs.readFileSync(path.join(root,name));
  if(name==='index.html')content=content.toString().replace('<div class="shell">','<div class="shell"><p class="weather-detail">Preview · Sample history and simulated Home Assistant · No device changes</p>');
  res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(content);
}).listen(port,'127.0.0.1',()=>console.log(`Fixture dashboard: http://127.0.0.1:${port}/`));
