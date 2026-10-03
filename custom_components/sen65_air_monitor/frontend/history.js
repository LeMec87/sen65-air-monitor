/* Local history only: the board owns the samples; the browser never invents them. */
(function () {
  'use strict';
  const groups = {
    particles: [{key:'pm1',label:'PM1',color:'#92caff',dash:''},{key:'pm25',label:'PM2.5',color:'#51b666',dash:'9 5'},{key:'pm4',label:'PM4',color:'#f28f16',dash:'2 5'},{key:'pm10',label:'PM10',color:'#f26513',dash:'9 4 2 4'}],
    gases: [{key:'voc',label:'VOC',color:'#92caff',dash:''},{key:'nox',label:'NOx',color:'#f26513',dash:'9 5'}],
    climate: [{key:'temp',label:'Temperature',color:'#92caff',dash:''},{key:'rh',label:'Humidity',color:'#51b666',dash:'9 5'}]
  };
  function decode(payload, group) {
    const fields = groups[group];
    if (!fields || !Number.isInteger(payload.uptime_ms) || payload.uptime_ms < 0 || payload.uptime_ms > 0xffffffff ||
        !Array.isArray(payload.metrics) || payload.metrics.join(',') !== fields.map(f=>f.key).join(',') ||
        !Array.isArray(payload.points) || payload.points.length > 288) throw new Error('Invalid history response.');
    return payload.points.filter(row => Array.isArray(row) && row.length === fields.length+1 &&
      Number.isInteger(row[0]) && row[0]>=0 && row[0]<=0xffffffff).map(row => ({
        id:row[0], age:((payload.uptime_ms-row[0])>>>0)/1000,
        values:row.slice(1).map(v=>typeof v==='number' && Number.isFinite(v) ? v : null)
      })).filter(point=>point.age<=86400);
  }
  function value(key, raw, unit) { return raw === null ? null : key==='temp' && unit==='F' ? raw*9/5+32 : raw; }
  function unitFor(key, unit) { return key==='temp' ? '°'+unit : key==='rh' ? '%' : key==='voc'||key==='nox' ? 'index' : 'µg/m³'; }
  function bounds(values, allowNegative) {
    const finite = values.filter(v=>typeof v==='number' && Number.isFinite(v));
    if (!finite.length) return [0,1];
    let lo=Math.min(...finite), hi=Math.max(...finite), range=Math.max(hi-lo,1);
    lo-=range*.12; hi+=range*.12;
    if (!allowNegative) lo=Math.max(0,lo);
    return [lo,hi>lo?hi:lo+1];
  }
  function nearest(points, age) {
    let best=-1, distance=Infinity;
    points.forEach((point,i)=>{const d=Math.abs(point.age-age);if(d<distance){best=i;distance=d;}});
    return best;
  }
  function tick(v, step) { return Number(v.toFixed(step<.1?2:step<1?1:Math.abs(v)<10?2:1)).toString(); }
  globalThis.AirMonitorHistoryModel = {groups,decode,value,unitFor,bounds,nearest,tick};
  if (typeof document === 'undefined') return;
  const $=id=>document.getElementById(id);
  const svg=$('history-svg'), plot=$('history-plot'), legend=$('history-legend'), slider=$('history-point');
  const status=$('history-status'), values=$('history-values'), selectedTime=$('history-selected-time');
  let group='particles', points=[], unit=typeof currentTempUnit!=='undefined'&&currentTempUnit==='F'?'F':'C', receivedAt=Date.now(), selectedId=null, followLatest=true;
  let serial=0, pending=false, stale=false;
  const hidden=new Set();
  const number=v=>v===null?'—':Number(v).toFixed(1);
  const svgNS='http://www.w3.org/2000/svg';
  function node(name, attrs, text) {
    const element=document.createElementNS(svgNS,name);
    Object.entries(attrs||{}).forEach(([key,v])=>element.setAttribute(key,String(v)));
    if(text!==undefined)element.textContent=text;
    svg.appendChild(element);return element;
  }
  function selectedIndex() {
    if (!points.length) return -1;
    if(followLatest)return points.length-1;
    const index=points.findIndex(p=>p.id===selectedId);
    return index<0?0:index;
  }
  function drawLegend() {
    legend.replaceChildren();
    groups[group].forEach(field=>{
      const button=document.createElement('button');button.type='button';
      button.setAttribute('aria-pressed',String(!hidden.has(field.key)));
      button.setAttribute('aria-label','Show '+field.label+' trace');
      const sample=document.createElementNS(svgNS,'svg');sample.setAttribute('viewBox','0 0 24 12');sample.setAttribute('aria-hidden','true');
      const line=document.createElementNS(svgNS,'line');
      Object.entries({x1:1,y1:6,x2:23,y2:6,stroke:field.color,'stroke-width':3,'stroke-dasharray':field.dash}).forEach(([k,v])=>line.setAttribute(k,v));
      sample.appendChild(line);button.appendChild(sample);button.appendChild(document.createTextNode(field.label));
      button.addEventListener('click',()=>{if(hidden.has(field.key))hidden.delete(field.key);else hidden.add(field.key);button.setAttribute('aria-pressed',String(!hidden.has(field.key)));draw();});
      legend.appendChild(button);
    });
  }
  function draw() {
    svg.replaceChildren();values.replaceChildren();
    const fields=groups[group], dual=group!=='particles';
    const width=Math.max(260,plot.clientWidth||760), height=320;
    const stackedAxes=dual&&width<420;
    const left=52,right=width-(dual?52:16),top=stackedAxes?54:38,bottom=253;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('aria-label',`${group} history. ${points.length} five-minute samples. Use the point slider to inspect values.`);
    const series=fields.map((field,index)=>points.map(p=>value(field.key,p.values[index],unit)));
    const ranges=dual?series.map((v,i)=>bounds(v,fields[i].key==='temp')):[bounds(series.flat(),false)];
    const text=(x,y,s,anchor='start')=>node('text',{x,y,fill:'#b7c7d9','font-size':12,'font-family':'inherit','text-anchor':anchor},s);
    const x=age=>left+(1-age/86400)*(right-left);
    const y=(v,index)=>{const [lo,hi]=ranges[dual?index:0];return bottom-(v-lo)/(hi-lo)*(bottom-top);};
    for(let i=0;i<5;i++){
      const yy=top+i*(bottom-top)/4;
      node('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#ffffff25','stroke-dasharray':'3 5'});
      const [lo,hi]=ranges[0];text(left-8,yy+4,tick(hi-(hi-lo)*i/4,(hi-lo)/4),'end');
      if(dual){const [rlo,rhi]=ranges[1];text(right+8,yy+4,tick(rhi-(rhi-rlo)*i/4,(rhi-rlo)/4));}
    }
    text(left,20,group==='particles'?'µg/m³':fields[0].label+' · '+unitFor(fields[0].key,unit));
    if(dual)text(right,stackedAxes?36:20,fields[1].label+' · '+unitFor(fields[1].key,unit),'end');
    for(let i=0;i<3;i++)text(left+i*(right-left)/2,280,['−24h','−12h','Now'][i],i===0?'start':i===2?'end':'middle');
    text((left+right)/2,305,'Time','middle');
    const defs=node('defs');const clip=document.createElementNS(svgNS,'clipPath');clip.id='history-clip';
    const rect=document.createElementNS(svgNS,'rect');Object.entries({x:left,y:top,width:right-left,height:bottom-top}).forEach(([k,v])=>rect.setAttribute(k,v));clip.appendChild(rect);defs.appendChild(clip);
    if(!points.length)text((left+right)/2,145,'Waiting for recorded readings','middle');
    fields.forEach((field,index)=>{
      if(hidden.has(field.key))return;
      let d='',previous=false;
      points.forEach((point,i)=>{const v=series[index][i];if(v===null){previous=false;return;}d+=(previous?'L':'M')+x(point.age).toFixed(2)+' '+y(v,index).toFixed(2)+' ';previous=true;});
      node('path',{d,fill:'none',stroke:field.color,'stroke-width':3,'stroke-dasharray':field.dash,'stroke-linejoin':'round','clip-path':'url(#history-clip)'});
    });
    const index=selectedIndex();slider.disabled=index<0;slider.max=String(Math.max(0,points.length-1));slider.value=String(Math.max(0,index));
    $('history-latest').disabled=index<0;
    if(index<0){selectedTime.textContent='No history yet';return;}
    const point=points[index];selectedId=point.id;
    node('line',{x1:x(point.age),y1:top,x2:x(point.age),y2:bottom,stroke:'#f2f7fc','stroke-width':1,'stroke-dasharray':'4 4'});
    const moment=new Date(receivedAt-point.age*1000);
    selectedTime.textContent=moment.toLocaleString('en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+(stale?' · last received':'');
    fields.forEach((field,i)=>{
      const v=series[i][index],isHidden=hidden.has(field.key);
      if(v!==null&&!isHidden)node('circle',{cx:x(point.age),cy:y(v,i),r:4,fill:field.color,stroke:'#0b111b','stroke-width':2});
      const item=document.createElement('div');item.className='history-value';item.style.setProperty('--trace',field.color);item.dataset.hidden=String(isHidden);
      const label=document.createElement('span');label.textContent=field.label+(isHidden?' · hidden':'');
      const reading=document.createElement('strong');reading.textContent=number(v);
      const suffix=document.createElement('small');suffix.textContent=unitFor(field.key,unit);
      item.append(label,reading,suffix);values.appendChild(item);
    });
  }
  async function poll() {
    const request=++serial;pending=true;$('history-refresh').disabled=true;
    try {
      const response=await airMonitorFetch('/api/history?group='+group,{cache:'no-store'});
      if(!response.ok)throw new Error(response.status===404?'Install the new firmware to enable web history.':'Could not load history.');
      const payload=await response.json();if(request!==serial)return;
      const next=decode(payload,group);receivedAt=Date.now();points=next;stale=false;
      if(!followLatest&&selectedId!==null&&!points.some(p=>p.id===selectedId)){
        selectedId=points.length?points[0].id:null;
        status.textContent='The selected sample is no longer in the 24-hour window. Showing the oldest available point.';
      }else status.textContent=points.length?`${points.length} recorded ${points.length===1?'point':'points'} · five-minute averages. Select a moment below.`:'History starts after sensor startup. A line needs two recorded points.';
      status.dataset.error='false';draw();
    }catch(error){if(request===serial){stale=true;status.textContent=error.message+' Displayed history may be stale.';status.dataset.error='true';draw();}}
    finally{if(request===serial){pending=false;$('history-refresh').disabled=false;}}
  }
  document.querySelectorAll('[data-history-group]').forEach(button=>button.addEventListener('click',()=>{
    group=button.dataset.historyGroup;points=[];selectedId=null;followLatest=true;
    document.querySelectorAll('[data-history-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    status.textContent='Loading history…';drawLegend();draw();poll();
  }));
  slider.addEventListener('input',()=>{const point=points[Number(slider.value)];if(point){followLatest=false;selectedId=point.id;draw();}});
  svg.addEventListener('click',event=>{
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const pos=svg.createSVGPoint();pos.x=event.clientX;pos.y=event.clientY;
    const width=svg.viewBox.baseVal.width,right=width-(group!=='particles'?52:16);
    const local=pos.matrixTransform(matrix.inverse());
    const age=Math.max(0,Math.min(86400,(1-(local.x-52)/(right-52))*86400));
    const index=nearest(points,age);if(index>=0){followLatest=false;selectedId=points[index].id;draw();}
  });
  $('history-latest').addEventListener('click',()=>{followLatest=true;draw();});
  $('history-refresh').addEventListener('click',poll);
  $('nav-history').addEventListener('click',()=>{requestAnimationFrame(draw);if(!pending)poll();});
  document.addEventListener('monitor:unit',event=>{unit=event.detail==='F'?'F':'C';draw();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>draw()).observe(plot);
  setInterval(()=>{if($('tab-history').classList.contains('tab-panel--active')&&!pending)poll();},30000);
  drawLegend();draw();
})();
