// Visual fixture only: real panel/shared frontend, simulated HA and board data.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../custom_components/sen65_air_monitor/frontend');
const port=Number(process.argv[2]||8769);
const files=new Set(['panel.js','index.html','style.css','transport.js','app.js','history.js','home-assistant.js']);
const allowed=new Set(['/api/state','/api/weather','/api/history','/api/temp_unit','/api/check_update','/api/perform_update','/api/weather/refresh']);
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SEN65 · HA panel preview</title><style>html,body{height:100%;margin:0;background:#0b111b;color:#e9eff6;font-family:system-ui}header{box-sizing:border-box;height:48px;padding:14px 16px;font-size:11px;border-bottom:1px solid #ffffff24}sen65-air-monitor-panel{height:calc(100% - 48px)!important}</style><header>Preview · Simulated HA and boards · No real installation or device changes</header><sen65-air-monitor-panel></sen65-air-monitor-panel><script type="module" src="/sen65_air_monitor_static/panel.js"></script><script>customElements.whenDefined('sen65-air-monitor-panel').then(()=>{const panel=document.querySelector('sen65-air-monitor-panel');panel.hass={callWS:async message=>{if(message.type==='sen65_air_monitor/list')return [{entry_id:'living',title:'Living room · Sample'},{entry_id:'office',title:'Office · Sample'}];const response=await fetch('/fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});if(!response.ok)throw new Error('Fixture request failed.');return response.json();}};});</script></html>`;
http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(page);return;}
  if(url.pathname==='/fixture'&&req.method==='POST'){
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw new Error('Too large');}
      const message=JSON.parse(body),endpoint=new URL(message.path,'http://127.0.0.1:8768');
      if(message.type!=='sen65_air_monitor/request'||!['living','office'].includes(message.entry_id)||endpoint.origin!=='http://127.0.0.1:8768'||!allowed.has(endpoint.pathname)||!['GET','POST'].includes(message.method))throw new Error('Invalid request');
      const response=await fetch(endpoint,{method:message.method,body:message.method==='POST'&&message.body?message.body:undefined});
      const data=await response.json();
      if(endpoint.pathname==='/api/state'&&message.entry_id==='office')Object.assign(data,{temp:21.2,rh:42.0});
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:response.status,data}));
    }catch{res.writeHead(400,{'Content-Type':'application/json'});res.end('{"error":"Invalid fixture operation."}');}return;
  }
  if(url.pathname.startsWith('/sen65_air_monitor_static/')){
    const name=url.pathname.slice('/sen65_air_monitor_static/'.length);
    if(files.has(name)){res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,name)));return;}
  }
  res.writeHead(404);res.end();
}).listen(port,'127.0.0.1',()=>console.log(`HA panel fixture: http://127.0.0.1:${port}/`));
