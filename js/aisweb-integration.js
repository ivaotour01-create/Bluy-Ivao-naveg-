// IVÃO NAVEG — consultas AISWEB e tratamento central de XML (sem alterar os módulos locais).
(() => {
  'use strict';
  if (window.__IVAO_AISWEB_INTEGRATION__) return;
  window.__IVAO_AISWEB_INTEGRATION__ = true;
  const $ = id => document.getElementById(id);
  const validICAO = value => /^[A-Z0-9]{4}$/.test(value);
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABELS = {
    aerodrome:'Aeródromo', airport:'Aeródromo', icao:'Código ICAO', icaocode:'Código ICAO',
    name:'Nome', city:'Localidade', municipality:'Município', uf:'UF', state:'Estado',
    latitude:'Latitude', longitude:'Longitude', elevation:'Elevação', altitude:'Altitude',
    runway:'Pista', rwy:'Pista', runwaydirection:'Cabeceira', direction:'Direção',
    length:'Comprimento', width:'Largura', surface:'Superfície', frequency:'Frequência',
    freq:'Frequência', callsign:'Indicativo', service:'Serviço', hours:'Horários',
    navaid:'Auxílio à navegação', aid:'Auxílio', ils:'ILS', vor:'VOR', dme:'DME',
    publication:'Publicação', amdt:'Emenda', validity:'Validade', date:'Data',
    notam:'NOTAM', number:'Número', identifier:'Identificação', subject:'Assunto',
    condition:'Condição', status:'Situação', text:'Texto', message:'Mensagem', raw:'Mensagem original',
    metar:'METAR', taf:'TAF', wind:'Vento', visibility:'Visibilidade', temperature:'Temperatura',
    dewpoint:'Ponto de orvalho', pressure:'Pressão', qnh:'QNH', phenomenon:'Fenômeno',
    forecast:'Previsão', issued:'Emissão', from:'Início', to:'Fim', start:'Início', end:'Fim',
    coordinates:'Coordenadas', remarks:'Observações', remark:'Observações', category:'Categoria',
    type:'Tipo', operation:'Operação', opr:'Operação', fir:'FIR', location:'Localização'
  };
  const labelFor = key => LABELS[String(key).replace(/[^a-z0-9]/gi,'').toLowerCase()] || String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());
  function createOutput(id) {
    let el=$(id); if(!el){el=document.createElement('div');el.id=id;}
    el.className='ais-result'; el.innerHTML=''; return el;
  }
  function parseXML(text){
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('A resposta recebida não é um XML válido.');
    return doc;
  }
  function leafEntries(node, prefix=''){
    const out=[];
    for(const child of Array.from(node.children||[])){
      const key=child.localName||child.nodeName; const path=prefix?`${prefix} › ${key}`:key;
      const text=Array.from(child.childNodes).filter(n=>n.nodeType===3||n.nodeType===4).map(n=>n.nodeValue).join('').trim();
      if(text && !child.children.length) out.push({key,path,value:text});
      for(const a of Array.from(child.attributes||[])) out.push({key:`${key} (${a.name})`,path,value:a.value});
      if(child.children.length) out.push(...leafEntries(child,path));
    }
    return out;
  }
  function records(doc){
    const root=doc.documentElement; if(!root) return [];
    const candidates=Array.from(root.children).filter(n=>n.children.length>0);
    // Many AISWEB responses wrap one or more records in a collection node.
    const recordNodes=[];
    candidates.forEach(n=>{
      const grand=Array.from(n.children||[]);
      if(grand.length && grand.some(x=>x.children.length||x.textContent.trim())) recordNodes.push(...grand);
      else recordNodes.push(n);
    });
    if(!recordNodes.length) return [root];
    return recordNodes.filter(n=>leafEntries(n).length>0);
  }
  function getMeta(doc){
    const root=doc.documentElement; const meta={};
    if(root) for(const a of Array.from(root.attributes||[])) meta[a.name]=a.value;
    const all=Array.from(doc.getElementsByTagName('*'));
    for(const n of all){const k=(n.localName||n.nodeName).toLowerCase();if(['total','pagesize','rowstart','rowend'].includes(k)&&n.textContent.trim())meta[k]=n.textContent.trim();}
    return meta;
  }
  function decodeMetar(raw){
    const t=raw.trim().toUpperCase(); const out=[];
    const wind=t.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT\b/); if(wind)out.push(['Vento',`${wind[1]}° ${wind[2]} kt${wind[3]?` (rajadas ${wind[3].slice(1)} kt)`:''}`]);
    const vis=t.match(/\b(9999|\d{4})\b/); if(vis)out.push(['Visibilidade',vis[1]==='9999'?'10 km ou mais':`${vis[1]} m`]);
    const temp=t.match(/\b(M?\d{2})\/(M?\d{2})\b/); if(temp)out.push(['Temperatura',`${temp[1].replace('M','-')} °C`]),out.push(['Ponto de orvalho',`${temp[2].replace('M','-')} °C`]);
    const q=t.match(/\bQ(\d{4})\b/); if(q)out.push(['QNH',`${q[1]} hPa`]);
    const wx=t.match(/\b(-|\+|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|FG|BR|SA|DU|HZ|FU|VA|SQ|PO|FC|SS|DS)\b/g); if(wx)out.push(['Fenômenos',wx.join(' ')]);
    return out;
  }
  function decodeTAF(raw){
    const lines=raw.trim().toUpperCase().split(/\s+(?=(?:FM\d{6}|BECMG|TEMPO|PROB\d{2}|\d{4}\/\d{4})\b)/g).filter(Boolean);
    return lines.length>1?lines:[];
  }
  function renderWeather(doc, kind){
    const nodes=records(doc); const textNodes=nodes.flatMap(n=>leafEntries(n)).filter(x=>/^(metar|taf|raw|message|msg|text)$/i.test(x.key));
    const candidates=textNodes.map(x=>x.value).concat(nodes.map(n=>n.textContent.trim()).filter(Boolean),[doc.documentElement?.textContent?.trim()||'']).filter(x=>x.length>5);
    const raw=candidates.find(x=>kind==='METAR'?/\bMETAR\b|\bSPECI\b/.test(x):/\bTAF\b/.test(x))||candidates[0];
    let html='';
    if(raw){html+=`<section class="ais-highlight"><div class="ais-kicker">${kind} OFICIAL · TEXTO RECEBIDO</div><div class="ais-rawline">${escapeHTML(raw)}</div></section>`;
      if(kind==='METAR'){const decoded=decodeMetar(raw);if(decoded.length)html+=`<div class="ais-grid">${decoded.map(([k,v])=>`<article class="ais-field"><span>${escapeHTML(k)}</span><strong>${escapeHTML(v)}</strong></article>`).join('')}</div>`;}
      if(kind==='TAF'){const groups=decodeTAF(raw);if(groups.length)html+=`<h4>Grupos da previsão</h4><div class="ais-list">${groups.map((g,i)=>`<div class="ais-item"><b>Grupo ${i+1}</b><p>${escapeHTML(g)}</p></div>`).join('')}</div>`;}
    }
    if(!html) html=renderGeneric(doc,kind);
    return html;
  }
  function renderGeneric(doc,kind){
    const meta=getMeta(doc); const total=meta.total;
    if(total==='0')return `<div class="ais-empty"><strong>Nenhum registro retornado</strong><p>A consulta ${escapeHTML(kind)} retornou zero registros. Isso não confirma ausência de informação aeronáutica vigente. Confira o código, parâmetros e fonte oficial.</p></div>`;
    const nodes=records(doc); if(!nodes.length)return `<div class="ais-empty">Resposta XML sem registros identificáveis. Confira a consulta na fonte oficial.</div>`;
    let html=''; if(total!==undefined)html+=`<p class="ais-summary">Registros indicados pela resposta: <b>${escapeHTML(total)}</b></p>`;
    html+=nodes.map((node,i)=>{const entries=leafEntries(node); if(!entries.length)return ''; const grouped={}; entries.forEach(e=>{const label=labelFor(e.key);(grouped[label] ||= []).push(e.value)});
      return `<section class="ais-record"><h3>${escapeHTML(kind)}${nodes.length>1?` · Registro ${i+1}`:''}</h3><div class="ais-grid">${Object.entries(grouped).map(([k,vals])=>`<article class="ais-field"><span>${escapeHTML(k)}</span><strong>${vals.map(escapeHTML).join('<br>')}</strong></article>`).join('')}</div></section>`;
    }).join('');
    return html||`<div class="ais-empty">A resposta foi recebida, mas os campos não puderam ser organizados. Consulte o XML original abaixo.</div>`;
  }
  function renderResult(doc,kind,raw){
    const meta=getMeta(doc); let html='';
    if(kind==='METAR'||kind==='TAF') html=renderWeather(doc,kind);
    else html=renderGeneric(doc,kind);
    const metaHtml=Object.keys(meta).length?`<div class="ais-meta">${Object.entries(meta).map(([k,v])=>`<span>${escapeHTML(labelFor(k))}: ${escapeHTML(v)}</span>`).join('')}</div>`:'';
    return `${html}${metaHtml}<details class="ais-xml"><summary>Ver resposta XML original (auditoria)</summary><pre>${escapeHTML(raw)}</pre></details>`;
  }
  async function query(area,params,output,status,label,kind){
    output.textContent=''; status.textContent=`Consultando ${label} no AISWEB…`;
    try{
      const qs=new URLSearchParams({area,...params});
      const response=await fetch('/api/aisweb?'+qs.toString(),{method:'GET',cache:'no-store',headers:{Accept:'application/xml, text/xml, application/json'}});
      const body=await response.text();
      if(!response.ok){let message=body;try{const parsed=JSON.parse(body);message=parsed.error||body}catch(_){}throw new Error(message.slice(0,700)||`HTTP ${response.status}`)}
      const doc=parseXML(body); output.innerHTML=renderResult(doc,kind,body);
      status.textContent=`${label}: resposta recebida. Confirme emissão, validade e dados operacionais nas fontes oficiais.`;
    }catch(error){output.innerHTML=`<div class="ais-empty ais-error"><strong>Não foi possível interpretar a consulta.</strong><p>${escapeHTML(error.message)}</p><p>Falha ou resposta vazia não significa ausência de informação aeronáutica.</p></div>`;status.textContent=`Consulta ${label} não concluída.`}
  }
  function addQueryButton(anchorId,buttonId,label,outputId,build){
    const anchor=$(anchorId);if(!anchor||$(buttonId))return;
    const button=document.createElement('button');button.type='button';button.id=buttonId;button.className='btn secondary';button.textContent=label;button.style.marginTop='8px';
    const output=createOutput(outputId);const status=document.createElement('p');status.id=buttonId+'Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.className='ais-status';
    anchor.insertAdjacentElement('afterend',button);button.insertAdjacentElement('afterend',status);status.insertAdjacentElement('afterend',output);
    button.addEventListener('click',async()=>{const req=build();if(!req)return;button.disabled=true;try{await query(req.area,req.params,output,status,req.label,req.kind)}finally{button.disabled=false}});
  }
  function init(){
    addQueryButton('saveMetar','ivaoFetchMetar','Consultar METAR oficial (AISWEB)','ivaoMetarOutput',()=>{const code=($('metarStation')?.value||'').trim().toUpperCase();if(!validICAO(code)){alert('Informe um indicativo ICAO válido com quatro caracteres.');return null}return{area:'met',params:{IcaoCode:code,type:'metar'},label:`METAR ${code}`,kind:'METAR'}});
    addQueryButton('saveTaf','ivaoFetchTaf','Consultar TAF oficial (AISWEB)','ivaoTafOutput',()=>{const code=($('tafStation')?.value||'').trim().toUpperCase();if(!validICAO(code)){alert('Informe um indicativo ICAO válido com quatro caracteres.');return null}return{area:'met',params:{IcaoCode:code,type:'taf'},label:`TAF ${code}`,kind:'TAF'}});
    addQueryButton('openNotam','ivaoFetchNotam','Consultar NOTAM oficial (AISWEB)','ivaoNotamOutput',()=>{const code=($('notamQuery')?.value||'').trim().toUpperCase();if(!validICAO(code)){alert('Informe um indicativo ICAO de quatro caracteres.');return null}return{area:'notam',params:{IcaoCode:code},label:`NOTAM ${code}`,kind:'NOTAM'}});
    addQueryButton('saveAirport','ivaoFetchRotaer','Consultar ROTAER oficial (AISWEB)','ivaoRotaerOutput',()=>{const code=($('adicao')?.value||'').trim().toUpperCase();if(!validICAO(code)){alert('Informe um código ICAO de quatro caracteres no campo de aeródromo.');return null}return{area:'rotaer',params:{aero:code},label:`ROTAER ${code}`,kind:'ROTAER'}});
    const home=$('#inicio')||document.querySelector('main')||document.body;
    if(!$('#ivaoAiswebHealth')){const box=document.createElement('p');box.id='ivaoAiswebHealth';box.className='notice';box.textContent='Verificando configuração AISWEB…';home.appendChild(box);fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(d=>{box.textContent=`AISWEB: API Key ${d.credentials.apiKeyConfigured?'presente':'ausente'} · API Pass ${d.credentials.apiPassConfigured?'presente':'ausente'}).catch(()=>{box.textContent='Diagnóstico AISWEB indisponível.'})}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
