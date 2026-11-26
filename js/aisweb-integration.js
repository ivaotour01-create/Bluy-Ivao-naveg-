// IVÃO NAVEG — liga consultas AISWEB às telas já existentes sem substituir funções locais.
(() => {
  'use strict';
  if (window.__IVAO_AISWEB_INTEGRATION__) return;
  window.__IVAO_AISWEB_INTEGRATION__ = true;
  const $ = id => document.getElementById(id);
  const validICAO = value => /^[A-Z0-9]{4}$/.test(value);
  function makeOutput(id) {
    let el = $(id);
    if (!el) {
      el = document.createElement('pre'); el.id = id;
      el.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:340px;overflow:auto;background:#f4f7fa;border:1px solid #ccd8e3;border-radius:8px;padding:10px;font-size:12px;margin-top:8px';
    }
    return el;
  }
  async function query(area, params, output, status, label) {
    output.textContent = ''; status.textContent = `Consultando ${label} no AISWEB…`;
    try {
      const qs = new URLSearchParams({ area, ...params });
      const response = await fetch('/api/aisweb?' + qs.toString(), { method: 'GET', cache: 'no-store', headers: { Accept: 'application/xml, text/xml, application/json' } });
      const body = await response.text();
      if (!response.ok) {
        let message = body; try { const parsed = JSON.parse(body); message = parsed.error || body; } catch (_) {}
        throw new Error(message.slice(0, 700) || `HTTP ${response.status}`);
      }
      output.textContent = body;
      status.textContent = `${label}: resposta recebida. Confira conteúdo, emissão e validade diretamente no AISWEB oficial.`;
    } catch (error) {
      status.textContent = `Consulta ${label} não concluída: ${error.message}. Erro ou resposta vazia não significa ausência de informação aeronáutica.`;
    }
  }
  function addQueryButton(anchorId, buttonId, label, outputId, build) {
    const anchor = $(anchorId); if (!anchor || $(buttonId)) return;
    const button = document.createElement('button'); button.type = 'button'; button.id = buttonId;
    button.className = 'btn secondary'; button.textContent = label; button.style.marginTop = '8px';
    const output = makeOutput(outputId);
    const status = document.createElement('p'); status.id = buttonId + 'Status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    anchor.insertAdjacentElement('afterend', button); button.insertAdjacentElement('afterend', status); status.insertAdjacentElement('afterend', output);
    button.addEventListener('click', async () => {
      const request = build();
      if (!request) return;
      button.disabled = true;
      try { await query(request.area, request.params, output, status, request.label); }
      finally { button.disabled = false; }
    });
  }
  function init() {
    addQueryButton('saveMetar', 'ivaoFetchMetar', 'Consultar METAR oficial (AISWEB)', 'ivaoMetarOutput', () => {
      const code = ($('metarStation')?.value || '').trim().toUpperCase();
      if (!validICAO(code)) { alert('Informe um indicativo ICAO válido com quatro caracteres.'); return null; }
      return { area: 'met', params: { IcaoCode: code, type: 'metar' }, label: `METAR ${code}` };
    });
    addQueryButton('saveTaf', 'ivaoFetchTaf', 'Consultar TAF oficial (AISWEB)', 'ivaoTafOutput', () => {
      const code = ($('tafStation')?.value || '').trim().toUpperCase();
      if (!validICAO(code)) { alert('Informe um indicativo ICAO válido com quatro caracteres.'); return null; }
      return { area: 'met', params: { IcaoCode: code, type: 'taf' }, label: `TAF ${code}` };
    });
    addQueryButton('openNotam', 'ivaoFetchNotam', 'Consultar NOTAM oficial (AISWEB)', 'ivaoNotamOutput', () => {
      const code = ($('notamQuery')?.value || '').trim().toUpperCase();
      if (!validICAO(code)) { alert('Informe um indicativo ICAO de quatro caracteres.'); return null; }
      return { area: 'notam', params: { IcaoCode: code }, label: `NOTAM ${code}` };
    });
    addQueryButton('saveAirport', 'ivaoFetchRotaer', 'Consultar ROTAER oficial (AISWEB)', 'ivaoRotaerOutput', () => {
      const code = ($('adicao')?.value || '').trim().toUpperCase();
      if (!validICAO(code)) { alert('Informe um código ICAO de quatro caracteres no campo de aeródromo.'); return null; }
      return { area: 'rotaer', params: { aero: code }, label: `ROTAER ${code}` };
    });
    const home = $('#inicio') || document.querySelector('main') || document.body;
    if (!$('#ivaoAiswebHealth')) {
      const box = document.createElement('p'); box.id = 'ivaoAiswebHealth'; box.className = 'notice';
      box.textContent = 'Verificando configuração AISWEB…'; home.appendChild(box);
      fetch('/api/health', { cache: 'no-store' }).then(r => r.json()).then(data => {
        box.textContent = `AISWEB: API Key ${data.credentials.apiKeyConfigured ? 'presente' : 'ausente'} · API Pass ${data.credentials.apiPassConfigured ? 'presente' : 'ausente'} · autenticação não testada`;
      }).catch(() => { box.textContent = 'Diagnóstico AISWEB indisponível.'; });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
