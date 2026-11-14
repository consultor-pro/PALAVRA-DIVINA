// ===== Bíblia: leitura, busca e referências =====
(() => {
'use strict';
const { Store, Modal, App, Acoes, toast, esc, norm, copiar } = window.PD;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const USFM = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');

// códigos alternativos (BibleWorks / VPL do eBible)
const ALIAS = { SOL: 'SNG', EZE: 'EZK', JOE: 'JOL', NAH: 'NAM', MAR: 'MRK', JOH: 'JHN', PHI: 'PHP', JAM: 'JAS', '1JO': '1JN', '2JO': '2JN', '3JO': '3JN' };

const VERSOES = {
  blivre: {
    id: 'blivre', sigla: 'BLIVRE', nome: 'Bíblia Livre', ebible: 'porbr2018', arquivo: 'biblia-blivre.json',
    link: 'https://eBible.org/Scriptures/porbr2018_vpl.zip',
    creditos: 'Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio e Marco Teles — http://sites.google.com/site/biblialivre/. Atualizada a partir da tradução de João Ferreira de Almeida. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Texto obtido via eBible.org.'
  },
  nbv: {
    id: 'nbv', sigla: 'NBV', nome: 'Nova Bíblia Viva (Biblica Open)', ebible: 'poronbv', arquivo: 'biblia-nbv.json',
    link: 'https://eBible.org/Scriptures/poronbv_vpl.zip',
    creditos: 'Biblica® Open Nova Bíblia Viva™, Copyright © 2007, 2010 Biblica, Inc. “Biblica” é marca registrada de Biblica, Inc. Usado sob a licença Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (https://creativecommons.org/licenses/by-sa/4.0). Texto obtido via eBible.org.'
  }
};

const B = {
  dados: {},          // id -> {id, livros:[[ [versos] ]]}
  normCache: {},      // id -> versos normalizados
  pos: { v: 'blivre', l: 0, c: 0 },
  sel: new Set(), hl: null, aba: 'ler',
  busca: { q: '', v: 'blivre', livro: '' }
};
try { Object.assign(B.pos, JSON.parse(localStorage.getItem('pd-bib-pos') || '{}')); } catch (e) {}
const salvarPos = () => { try { localStorage.setItem('pd-bib-pos', JSON.stringify(B.pos)); } catch (e) {} };

/* ---------- armazenamento das versões (IndexedDB) ---------- */
function idbTx(modo, fn) {
  return new Promise((res, rej) => {
    if (!Store.idb) return rej(new Error('sem idb'));
    const t = Store.idb.transaction('biblias', modo), r = fn(t.objectStore('biblias'));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
async function carregarInstaladas() {
  try { (await idbTx('readonly', os => os.getAll())).forEach(b => { B.dados[b.id] = b; }); } catch (e) {}
  // Versões que vêm junto com o app (se existirem) são instaladas automaticamente
  for (const v of Object.values(VERSOES)) {
    if (B.dados[v.id]) continue;
    try {
      const r = await fetch(v.arquivo); if (!r.ok) continue;
      const j = await r.json(); if (!j.livros || j.livros.length !== 66) continue;
      await instalar(v.id, j.livros, true);
    } catch (e) {}
  }
}
async function instalar(id, livros, silencioso) {
  const obj = { id, livros, instalado: Date.now() };
  B.dados[id] = obj; delete B.normCache[id];
  try { await idbTx('readwrite', os => os.put(obj)); } catch (e) { if (!silencioso) toast('Não foi possível salvar no aparelho'); }
}
async function remover(id) {
  delete B.dados[id]; delete B.normCache[id];
  try { await idbTx('readwrite', os => os.delete(id)); } catch (e) {}
}
const instaladas = () => Object.values(VERSOES).filter(v => B.dados[v.id]);
function versaoAtiva(pref) {
  if (B.dados[pref]) return pref;
  const i = instaladas(); return i.length ? i[0].id : null;
}

/* ---------- importação do arquivo do eBible ---------- */
function carregarScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
function parseVPL(txt) {
  const livros = USFM.map(() => []);
  let n = 0;
  txt.replace(/^﻿/, '').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([1-3]?[A-Z]{2,3})\s+(\d+):(\d+)\s+(.*)$/);
    if (!m) return;
    const b = USFM.indexOf(ALIAS[m[1]] || m[1]); if (b < 0) return;
    const c = +m[2] - 1, v = +m[3] - 1; if (c < 0 || v < 0) return;
    const t = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    (livros[b][c] = livros[b][c] || [])[v] = t; n++;
  });
  livros.forEach(lv => { for (let c = 0; c < lv.length; c++) { lv[c] = lv[c] || []; for (let v = 0; v < lv[c].length; v++) lv[c][v] = lv[c][v] || ''; } });
  return { livros, n };
}
function parseUSFMText(arqs) {
  // arqs: [{nome, texto}] arquivos .usfm
  const livros = USFM.map(() => []); let n = 0;
  arqs.forEach(({ texto }) => {
    const id = (texto.match(/\\id\s+([1-3]?[A-Z]{2,3})/) || [])[1]; const b = USFM.indexOf(ALIAS[id] || id); if (b < 0) return;
    let c = -1;
    texto.split(/\\c\s+/).slice(1).forEach(bloco => {
      c = parseInt(bloco, 10) - 1; if (c < 0) return;
      const caps = livros[b][c] = [];
      bloco.split(/\\v\s+/).slice(1).forEach(vb => {
        const m = vb.match(/^(\d+)[-\d]*\s*([\s\S]*)$/); if (!m) return;
        let t = m[2].replace(/\\f\s[\s\S]*?\\f\*/g, '').replace(/\\x\s[\s\S]*?\\x\*/g, '').replace(/\\w\s([^|\\]*)\|?[^\\]*\\w\*/g, '$1')
          .replace(/\\(s\d?|ms\d?|mt\d?|r|d|sp|cl)\s[^\n]*/g, '').replace(/\\[a-z]+\d?\*?/g, '').replace(/\s+/g, ' ').trim();
        caps[+m[1] - 1] = t; n++;
      });
    });
  });
  return { livros, n };
}
async function importarArquivo(file, id) {
  toast('Lendo arquivo…');
  let res;
  if (/\.json$/i.test(file.name)) {
    const j = JSON.parse(await file.text()); res = { livros: j.livros, n: 1 };
  } else if (/\.txt$/i.test(file.name)) {
    res = parseVPL(await file.text());
  } else {
    if (!window.JSZip) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip = await JSZip.loadAsync(file);
    const nomes = Object.keys(zip.files);
    const vpl = nomes.find(n => /vpl\.txt$/i.test(n));
    if (vpl) res = parseVPL(await zip.file(vpl).async('string'));
    else {
      const us = nomes.filter(n => /\.(usfm|sfm)$/i.test(n));
      if (!us.length) throw new Error('formato');
      res = parseUSFMText(await Promise.all(us.map(async n => ({ nome: n, texto: await zip.file(n).async('string') }))));
    }
  }
  if (!res || !res.livros || res.livros.filter(l => l && l.length).length < 60) throw new Error('incompleto');
  await instalar(id, res.livros);
  toast(VERSOES[id].sigla + ' instalada ✓');
}

/* ---------- referências (Mc 4.35-41; Sl 23) ---------- */
const MAPA = {};
LIVROS.forEach((l, i) => { MAPA[norm(l.a).replace(/\s/g, '')] = i; MAPA[norm(l.n).replace(/\s/g, '')] = i; });
Object.assign(MAPA, { gen: 0, ex: 1, exo: 1, lev: 2, num: 3, deut: 4, jos: 5, juiz: 6, jui: 6, rute: 7, '1sam': 8, '2sam': 9, '1reis': 10, '2reis': 11, '1cron': 12, '2cron': 13, esd: 14, nee: 15, est: 16, sal: 18, salmo: 18, prov: 19, ecl: 20, cant: 21, ctc: 21, is: 22, isa: 22, jer: 23, lam: 24, ez: 25, eze: 25, dan: 26, os: 27, jl: 28, am: 29, abd: 30, obd: 30, jon: 31, miq: 32, na: 33, hab: 34, sof: 35, ag: 36, zac: 37, mal: 38, mat: 39, mar: 40, luc: 41, jo: 42, joao: 42, atos: 43, rom: 44, '1cor': 45, '2cor': 46, gal: 47, ef: 48, efe: 48, fil: 49, col: 50, '1tes': 51, '2tes': 52, '1tim': 53, '2tim': 54, tit: 55, film: 56, heb: 57, tg: 58, tia: 58, '1ped': 59, '2ped': 60, '1jo': 61, '2jo': 62, '3jo': 63, jud: 64, apoc: 65 });
const REF_RE = /((?:[1-3]\s?)?[A-Za-zÀ-ú]{1,15})\.?\s*(\d{1,3})(?:\s*[.:,]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?/g;
function parseRefs(txt) {
  const out = []; let ultimoLivro = null; let m;
  String(txt || '').split(/[;\n]/).forEach(parte => {
    parte = parte.trim(); if (!parte) return;
    const re = new RegExp(REF_RE.source, 'g');
    const mm = re.exec(parte);
    if (mm) {
      const chave = norm(mm[1]).replace(/\s/g, '');
      const l = mm[1].trim().toLowerCase() === 'jó' ? 17 : MAPA[chave];
      if (l !== undefined) { ultimoLivro = l; out.push({ l, c: +mm[2] - 1, v1: mm[3] ? +mm[3] - 1 : null, v2: mm[4] ? +mm[4] - 1 : (mm[3] ? +mm[3] - 1 : null), txt: mm[0] }); return; }
    }
    // "4.12" sem livro: usa o último livro citado
    const so = parte.match(/^(\d{1,3})(?:\s*[.:]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/);
    if (so && ultimoLivro !== null) out.push({ l: ultimoLivro, c: +so[1] - 1, v1: so[2] ? +so[2] - 1 : null, v2: so[3] ? +so[3] - 1 : (so[2] ? +so[2] - 1 : null), txt: parte });
  });
  return out;
}
const nomeRef = r => `${LIVROS[r.l].n} ${r.c + 1}${r.v1 !== null ? ':' + (r.v1 + 1) + (r.v2 !== r.v1 ? '-' + (r.v2 + 1) : '') : ''}`;
function textoRef(r, vid) {
  const cap = B.dados[vid]?.livros[r.l]?.[r.c]; if (!cap) return null;
  const a = r.v1 === null ? 0 : r.v1, z = r.v1 === null ? cap.length - 1 : Math.min(r.v2, cap.length - 1);
  const vs = []; for (let i = a; i <= z; i++) if (cap[i] !== undefined) vs.push({ n: i + 1, t: cap[i] });
  return vs;
}
function abrirRefs(txt) {
  const refs = parseRefs(txt);
  if (!refs.length) { toast('Referência não reconhecida'); return; }
  let vid = versaoAtiva(B.pos.v);
  if (!vid) { Modal.open(`<h2>Nenhuma versão instalada</h2><p class="muted">Instale a Bíblia na aba Bíblia → Versões para ver o texto das referências.</p><div class="row"><button class="btn" id="ir-versoes">Instalar versões</button><button class="btn sec" data-close>Fechar</button></div>`); $('#ir-versoes').onclick = () => { Modal.close(); irAba('versoes'); App.go('biblia'); }; return; }
  const draw = () => {
    const corpo = refs.map(r => {
      const vs = textoRef(r, vid);
      return `<div style="margin-bottom:14px"><div class="row"><b style="color:var(--gold2)" class="sp">${esc(nomeRef(r))}</b><button class="btn ghost sm" data-ir="${r.l},${r.c},${r.v1 ?? ''}">Abrir capítulo</button></div>
        <div>${vs && vs.length ? vs.map(v => `<sup style="color:var(--gold)">${v.n}</sup> ${esc(v.t)}`).join(' ') : '<span class="muted">Texto não encontrado nesta versão.</span>'}</div></div>`;
    }).join('');
    $('#modal-box').innerHTML = `<div class="row" style="margin-bottom:10px"><h2 class="sp" style="margin:0">📖 Texto bíblico</h2>${seletorVersao('rv', vid)}</div>${corpo}
      <div class="row"><button class="btn sec" id="rv-copiar">📋 Copiar</button><button class="btn ghost" data-close>Fechar</button></div>`;
    $('#rv').onchange = e => { vid = e.target.value; draw(); };
    $('#rv-copiar').onclick = () => copiar(refs.map(r => nomeRef(r) + ' (' + VERSOES[vid].sigla + ')\n' + (textoRef(r, vid) || []).map(v => v.n + ' ' + v.t).join(' ')).join('\n\n'));
    $$('#modal-box [data-ir]').forEach(b => b.onclick = () => { const [l, c, v] = b.dataset.ir.split(','); Modal.close(); document.getElementById('pulpito').classList.contains('on') && $('#p-fechar').click(); abrirLeitura(vid, +l, +c, v === '' ? null : +v); });
  };
  Modal.open(''); draw();
}
function seletorVersao(id, atual) {
  const ins = instaladas();
  return `<select id="${id}" style="width:auto">${ins.map(v => `<option value="${v.id}" ${v.id === atual ? 'selected' : ''}>${v.sigla}</option>`).join('')}</select>`;
}

/* ---------- palavras difíceis (glossário) ---------- */
const GL = { exato: {}, acento: {}, frase: {}, prefixo: [] };
(window.GLOSSARIO || []).forEach((g, i) => g.f.forEach(f => {
  f = f.trim(); if (!f) return;
  if (f[0] === '=') GL.acento[f.slice(1).toLowerCase()] = i;
  else if (f.includes(' ')) GL.frase[norm(f)] = i;
  else if (f.endsWith('*')) GL.prefixo.push([norm(f.slice(0, -1)), i]);
  else GL.exato[norm(f)] = i;
}));
GL.prefixo.sort((a, b) => b[0].length - a[0].length);
let glOn = true; try { glOn = localStorage.getItem('pd-gl') !== '0'; } catch (e) {}
function glPalavra(w) {
  const lw = w.toLowerCase(); if (GL.acento[lw] !== undefined) return GL.acento[lw];
  const n = norm(w); if (GL.exato[n] !== undefined) return GL.exato[n];
  if (n.length >= 4) for (const [p, i] of GL.prefixo) if (n.startsWith(p)) return i;
  return -1;
}
function marcarGlossario(txt) {
  if (!glOn || !window.GLOSSARIO) return esc(txt);
  const toks = txt.match(/[A-Za-zÀ-ÿ]+(?:-[A-Za-zÀ-ÿ]+)*|[^A-Za-zÀ-ÿ]+/g) || [];
  const ehPal = t => /^[A-Za-zÀ-ÿ]/.test(t);
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!ehPal(t)) { out += esc(t); continue; }
    let achou = false;
    // frases de 3 e 2 palavras (separadas só por espaço)
    for (const n of [3, 2]) {
      const idx = []; let j = i, ok = true;
      for (let k = 0; k < n; k++) {
        if (!toks[j] || !ehPal(toks[j])) { ok = false; break; }
        idx.push(j); if (k < n - 1) { if (!/^\s+$/.test(toks[j + 1] || '')) { ok = false; break; } j += 2; }
      }
      if (!ok) continue;
      const g = GL.frase[norm(idx.map(x => toks[x]).join(' '))];
      if (g !== undefined) { out += `<span class="gl" data-g="${g}">${esc(toks.slice(i, idx[idx.length - 1] + 1).join(''))}</span>`; i = idx[idx.length - 1]; achou = true; break; }
    }
    if (achou) continue;
    const g = glPalavra(t);
    out += g >= 0 ? `<span class="gl" data-g="${g}">${esc(t)}</span>` : esc(t);
  }
  return out;
}
function abrirGlossario(i) {
  const g = GLOSSARIO[i]; if (!g) return;
  const dic = DICIONARIO.find(d => norm(d.t) === norm(g.t) && d.r);
  Modal.open(`<div class="row" style="align-items:flex-start"><h2 class="sp" style="margin:0">${esc(g.t)}</h2><span class="badge">${esc(g.c)}</span></div>
    <p style="font-size:1.05rem;line-height:1.6">${esc(g.d)}</p>
    ${dic ? `<p class="muted" style="font-size:.9rem">📖 Veja também: ${esc(dic.r)}</p>` : ''}
    <div class="row"><button class="btn sec" id="gl-busca">🔎 Buscar na Bíblia</button><button class="btn" data-close>Entendi</button></div>`);
  $('#gl-busca').onclick = () => { Modal.close(); B.busca.q = g.t.split(' ')[0]; irAba('buscar'); };
}

/* ---------- abas ---------- */
function irAba(a) {
  B.aba = a;
  $$('#bib-abas .chip').forEach(c => c.classList.toggle('on', c.dataset.aba === a));
  $$('.bib-aba').forEach(d => d.style.display = d.id === 'aba-' + a ? '' : 'none');
  if (a === 'ler') renderLer(); if (a === 'buscar') renderBuscar(); if (a === 'versoes') renderVersoes();
  selbar();
}
$('#bib-abas').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) irAba(c.dataset.aba); });

function semVersao(alvo) {
  if (B.carregando) { $(alvo).innerHTML = `<div class="empty"><div class="big">📖</div><p>Preparando a Bíblia no aparelho…<br><span style="font-size:.85rem">Na primeira vez pode levar alguns segundos.</span></p></div>`; return; }
  $(alvo).innerHTML = `<div class="empty"><div class="big">📖</div><p>Nenhuma versão da Bíblia instalada ainda.</p><button class="btn" id="ir-inst">Instalar versões</button></div>`;
  $('#ir-inst').onclick = () => irAba('versoes');
}

/* ---------- LER ---------- */
function abrirLeitura(v, l, c, verso) {
  B.pos = { v, l, c }; salvarPos(); B.sel.clear(); B.hl = verso;
  App.go('biblia'); irAba('ler');
  if (verso !== null && verso !== undefined) setTimeout(() => $(`#vers li[data-v="${verso}"]`)?.scrollIntoView({ block: 'center' }), 60);
}
function renderLer() {
  const vid = versaoAtiva(B.pos.v); if (!vid) return semVersao('#aba-ler');
  B.pos.v = vid;
  const livro = B.dados[vid].livros[B.pos.l] || [];
  if (B.pos.c >= livro.length) B.pos.c = 0;
  const cap = livro[B.pos.c] || [];
  let fs = 18; try { fs = +localStorage.getItem('pd-bib-fs') || 18; } catch (e) {}
  $('#aba-ler').innerHTML = `
    <div class="row">${seletorVersao('ler-v', vid)}
      <select id="ler-l" style="flex:1;min-width:0">${LIVROS.map((l, i) => `<option value="${i}" ${i === B.pos.l ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select>
      <select id="ler-c" style="width:auto">${livro.map((_, i) => `<option value="${i}" ${i === B.pos.c ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
    <div class="navcap"><button class="btn sec sm" id="ler-ant">‹ Anterior</button><span class="sp" style="text-align:center"><h2 style="margin:0">${esc(LIVROS[B.pos.l].n)} ${B.pos.c + 1}</h2></span><button class="btn sec sm" id="ler-prox">Próximo ›</button></div>
    <div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="chip ${glOn ? 'on' : ''}" id="ler-gl" title="Destacar palavras difíceis">💡 Palavras difíceis</button><span class="sp"></span><button class="iconbtn" id="ler-menos">A−</button><button class="iconbtn" id="ler-mais">A+</button></div>
    <ol class="vers card" id="vers" style="font-size:${fs}px;padding:10px">${cap.map((t, i) => `<li data-v="${i}" class="${B.sel.has(i) ? 'sel' : ''} ${B.hl === i ? 'hl' : ''}"><sup>${i + 1}</sup>${marcarGlossario(t)}</li>`).join('') || '<li class="muted">Capítulo vazio nesta versão.</li>'}</ol>
    <div class="navcap"><button class="btn sec sm" id="ler-ant2">‹ Anterior</button><span class="sp"></span><button class="btn sec sm" id="ler-prox2">Próximo ›</button></div>
    <p class="muted" style="font-size:.75rem">${glOn ? 'Toque numa palavra sublinhada para ver o significado; toque no restante do versículo para selecioná-lo. ' : 'Toque nos versículos para selecionar. '}${esc(VERSOES[vid].sigla)} — ${esc(VERSOES[vid].nome)}. Créditos em Ferramentas → Sobre.</p>`;
  $('#ler-v').onchange = e => { B.pos.v = e.target.value; salvarPos(); renderLer(); };
  $('#ler-l').onchange = e => { B.pos.l = +e.target.value; B.pos.c = 0; mudou(); };
  $('#ler-c').onchange = e => { B.pos.c = +e.target.value; mudou(); };
  const mover = d => {
    let { l, c } = B.pos; c += d;
    if (c < 0) { l--; if (l < 0) return; c = (B.dados[vid].livros[l] || []).length - 1; }
    if (c >= (B.dados[vid].livros[l] || []).length) { l++; if (l > 65) return; c = 0; }
    B.pos.l = l; B.pos.c = c; mudou();
  };
  ['ler-ant', 'ler-ant2'].forEach(i => $('#' + i).onclick = () => mover(-1));
  ['ler-prox', 'ler-prox2'].forEach(i => $('#' + i).onclick = () => mover(1));
  const fsSet = d => { fs = Math.max(14, Math.min(34, fs + d)); $('#vers').style.fontSize = fs + 'px'; try { localStorage.setItem('pd-bib-fs', fs); } catch (e) {} };
  $('#ler-menos').onclick = () => fsSet(-2); $('#ler-mais').onclick = () => fsSet(2);
  $('#ler-gl').onclick = () => { glOn = !glOn; try { localStorage.setItem('pd-gl', glOn ? '1' : '0'); } catch (e) {} renderLer(); if (glOn) toast('Toque nas palavras sublinhadas para ver o significado'); };
  $('#vers').onclick = e => { const gw = e.target.closest('.gl'); if (gw) { abrirGlossario(+gw.dataset.g); return; } const li = e.target.closest('li[data-v]'); if (!li) return; const v = +li.dataset.v; B.sel.has(v) ? B.sel.delete(v) : B.sel.add(v); li.classList.toggle('sel'); selbar(); };
  selbar();
}
function mudou() { B.sel.clear(); B.hl = null; salvarPos(); renderLer(); window.scrollTo(0, 0); }

// barra de ações dos versículos selecionados
const bar = document.createElement('div'); bar.className = 'selbar'; document.body.appendChild(bar);
function selecionados() {
  const vid = B.pos.v, cap = B.dados[vid]?.livros[B.pos.l]?.[B.pos.c] || [];
  const vs = [...B.sel].sort((a, b) => a - b);
  if (!vs.length) return null;
  // referência compacta: 1-3,5
  const grupos = []; vs.forEach(v => { const g = grupos[grupos.length - 1]; if (g && v === g[1] + 1) g[1] = v; else grupos.push([v, v]); });
  const ref = `${LIVROS[B.pos.l].n} ${B.pos.c + 1}:${grupos.map(g => g[0] === g[1] ? g[0] + 1 : (g[0] + 1) + '-' + (g[1] + 1)).join(',')}`;
  return { ref, sigla: VERSOES[vid].sigla, texto: vs.map(v => (vs.length > 1 ? (v + 1) + ' ' : '') + cap[v]).join(' ') };
}
function selbar() {
  const on = App.view === 'biblia' && B.aba === 'ler' && B.sel.size > 0;
  bar.classList.toggle('on', on); if (!on) return;
  bar.innerHTML = `<span class="muted" style="align-self:center;padding:0 6px">${B.sel.size} selecionado(s)</span>
    <button class="btn sm" id="sb-ins">✍️ Inserir no esboço</button><button class="btn sec sm" id="sb-cp">📋 Copiar</button><button class="iconbtn" id="sb-x">✕</button>`;
  $('#sb-cp').onclick = () => { const s = selecionados(); copiar(`"${s.texto}" (${s.ref} ${s.sigla})`); };
  $('#sb-x').onclick = () => { B.sel.clear(); renderLer(); };
  $('#sb-ins').onclick = () => inserirNoEsboco(selecionados());
}
const _go = App.go.bind(App);
App.go = function (v, p) { _go(v, p); selbar(); if (v === 'biblia') irAba(B.aba); };

function inserirNoEsboco(s) {
  const lista = Store.all('esboco');
  if (!lista.length) { toast('Crie um esboço primeiro'); return; }
  Modal.open(`<h2>Inserir em qual esboço?</h2><p class="muted" style="margin-top:0">${esc(s.ref)} (${esc(s.sigla)})</p>
    <div class="list">${lista.map(e => `<div class="item" data-e="${esc(e.id)}"><div>📜</div><div><b>${esc(e.titulo || 'Sem título')}</b><div class="meta">${esc(e.texto || '')}</div></div></div>`).join('')}</div>
    <button class="btn sec" data-close style="width:100%;justify-content:center">Cancelar</button>`);
  $$('#modal-box [data-e]').forEach(el => el.onclick = () => {
    const e = Store.get(el.dataset.e);
    const alvos = [['introducao', 'Introdução'], ...(e.pontos || []).map((p, i) => ['p' + i, `Ponto ${i + 1}${p.t ? ': ' + p.t : ''}`]), ['conclusao', 'Conclusão'], ['notas', 'Anotações']];
    Modal.open(`<h2>Inserir onde?</h2><div class="list">${alvos.map(a => `<div class="item" data-a="${a[0]}"><div>➕</div><div><b>${esc(a[1])}</b></div></div>`).join('')}</div><button class="btn sec" data-close style="width:100%;justify-content:center">Cancelar</button>`);
    $$('#modal-box [data-a]').forEach(ae => ae.onclick = () => {
      const bloco = `"${s.texto}" (${s.ref} ${s.sigla})`, a = ae.dataset.a, c = JSON.parse(JSON.stringify(e));
      if (a[0] === 'p' && /^p\d+$/.test(a)) { const p = c.pontos[+a.slice(1)]; p.exp = (p.exp ? p.exp + '\n' : '') + bloco; p.ref = p.ref ? (p.ref.includes(s.ref) ? p.ref : p.ref + '; ' + s.ref) : s.ref; }
      else c[a] = (c[a] ? c[a] + '\n' : '') + bloco;
      Store.put(c); Modal.close(); B.sel.clear(); renderLer(); toast('Inserido no esboço ✓');
    });
  });
}

/* ---------- BUSCAR ---------- */
function versosNorm(vid) {
  if (B.normCache[vid]) return B.normCache[vid];
  const out = [];
  B.dados[vid].livros.forEach((lv, l) => lv.forEach((cap, c) => (cap || []).forEach((t, v) => out.push([l, c, v, norm(t)]))));
  return B.normCache[vid] = out;
}
function renderBuscar() {
  const vid = versaoAtiva(B.busca.v); if (!vid) return semVersao('#aba-buscar');
  B.busca.v = vid;
  const grp = (nome, f) => `<optgroup label="${nome}">${LIVROS.map((l, i) => f(l) ? `<option value="${i}" ${String(i) === B.busca.livro ? 'selected' : ''}>${esc(l.n)}</option>` : '').join('')}</optgroup>`;
  $('#aba-buscar').innerHTML = `
    <form id="bf" class="row"><input type="search" id="bq" placeholder="Palavra ou frase (ex.: graça, pão da vida)" value="${esc(B.busca.q)}" style="flex:1;min-width:180px"><button class="btn">Buscar</button></form>
    <div class="row" style="margin-top:8px">${seletorVersao('bv', vid)}
      <select id="bl" style="flex:1;min-width:0">
        <option value="">📚 Bíblia inteira</option>
        <option value="AT" ${B.busca.livro === 'AT' ? 'selected' : ''}>Antigo Testamento</option>
        <option value="NT" ${B.busca.livro === 'NT' ? 'selected' : ''}>Novo Testamento</option>
        ${[...new Set(LIVROS.map(l => l.g))].map(g => `<option value="g:${esc(g)}" ${B.busca.livro === 'g:' + g ? 'selected' : ''}>Grupo: ${esc(g)}</option>`).join('')}
        ${grp('Antigo Testamento', l => l.at)}${grp('Novo Testamento', l => !l.at)}
      </select></div>
    <div id="bres" style="margin-top:12px"></div>`;
  $('#bf').onsubmit = e => { e.preventDefault(); B.busca.q = $('#bq').value; buscar(); };
  $('#bv').onchange = e => { B.busca.v = e.target.value; buscar(); };
  $('#bl').onchange = e => { B.busca.livro = e.target.value; buscar(); };
  if (B.busca.q) buscar();
}
function buscar() {
  const vid = B.busca.v, q = norm(B.busca.q).trim(), out = $('#bres');
  if (q.length < 2) { out.innerHTML = '<p class="muted">Digite pelo menos 2 letras.</p>'; return; }
  const f = B.busca.livro;
  const passa = l => !f || (f === 'AT' ? LIVROS[l].at : f === 'NT' ? !LIVROS[l].at : f.startsWith('g:') ? LIVROS[l].g === f.slice(2) : l === +f);
  const termos = q.split(/\s+/).filter(Boolean);
  const exata = /^".*"$/.test(B.busca.q.trim()) ? norm(B.busca.q.trim().slice(1, -1)) : null;
  const achados = [];
  for (const [l, c, v, t] of versosNorm(vid)) {
    if (!passa(l)) continue;
    if (exata ? t.includes(exata) : termos.every(x => t.includes(x))) achados.push([l, c, v]);
  }
  const porLivro = {}; achados.forEach(a => porLivro[a[0]] = (porLivro[a[0]] || 0) + 1);
  const MAX = 300;
  const marca = txt => {
    let h = esc(txt); const tn = norm(txt);
    // destaca termos preservando acentos: localiza posições no texto normalizado
    const pos = []; (exata ? [exata] : termos).forEach(x => { let i = 0; while ((i = tn.indexOf(x, i)) >= 0) { pos.push([i, i + x.length]); i += x.length; } });
    if (!pos.length) return h;
    pos.sort((a, b) => a[0] - b[0]); let r = '', u = 0;
    pos.forEach(([a, b]) => { if (a < u) return; r += esc(txt.slice(u, a)) + '<mark>' + esc(txt.slice(a, b)) + '</mark>'; u = b; });
    return r + esc(txt.slice(u));
  };
  out.innerHTML = `<p class="muted" style="margin-top:0"><b style="color:var(--cream)">${achados.length}</b> versículo(s) encontrados${achados.length > MAX ? ` — mostrando os ${MAX} primeiros. Use o filtro de livro para refinar.` : ''}.<br><span style="font-size:.8rem">Dica: use aspas para frase exata, ex.: "pão da vida".</span></p>
    ${Object.keys(porLivro).length > 1 ? `<div class="chips" style="margin-bottom:10px">${Object.entries(porLivro).map(([l, n]) => `<button class="chip" data-fl="${l}">${esc(LIVROS[l].a)} (${n})</button>`).join('')}</div>` : ''}
    ${achados.slice(0, MAX).map(([l, c, v]) => `<div class="res" data-r="${l},${c},${v}"><b>${esc(LIVROS[l].n)} ${c + 1}:${v + 1}</b><div>${marca(B.dados[vid].livros[l][c][v])}</div></div>`).join('') || '<div class="empty">Nada encontrado.</div>'}`;
  $$('#bres [data-fl]').forEach(b => b.onclick = () => { B.busca.livro = b.dataset.fl; $('#bl').value = b.dataset.fl; buscar(); });
  $$('#bres [data-r]').forEach(d => d.onclick = () => { const [l, c, v] = d.dataset.r.split(',').map(Number); abrirLeitura(vid, l, c, v); });
}

/* ---------- VERSÕES ---------- */
function renderVersoes() {
  $('#aba-versoes').innerHTML = `<h2>Versões da Bíblia</h2>
    <p class="muted" style="margin-top:0">As versões ficam salvas no aparelho (IndexedDB) e funcionam sem internet.</p>
    ${Object.values(VERSOES).map(v => {
      const inst = B.dados[v.id];
      return `<div class="card"><div class="row"><div class="sp"><b>${esc(v.nome)}</b> <span class="badge ${inst ? 'pregado' : ''}">${inst ? '✓ Instalada' : 'Não instalada'}</span><div class="muted" style="font-size:.85rem">${esc(v.sigla)}</div></div></div>
        <div class="row" style="margin-top:10px">
          ${inst ? `<button class="btn danger sm" data-rm="${v.id}">Remover</button>` : `<button class="btn sm" data-imp="${v.id}">⬆️ Importar arquivo</button>`}
        </div>
        ${inst ? '' : `<p class="muted" style="font-size:.85rem;margin:10px 0 0">1. Baixe o arquivo oficial gratuito: <a href="${v.link}" target="_blank" rel="noopener">${esc(v.link.replace('https://', ''))}</a><br>2. Toque em “Importar arquivo” e escolha o .zip baixado (não precisa descompactar).</p>`}
      </div>`;
    }).join('')}
    <input type="file" id="bib-arq" accept=".zip,.txt,.json" hidden>`;
  let alvo = null;
  $$('#aba-versoes [data-imp]').forEach(b => b.onclick = () => { alvo = b.dataset.imp; $('#bib-arq').click(); });
  $('#bib-arq').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !alvo) return;
    try { await importarArquivo(f, alvo); renderVersoes(); }
    catch (err) { toast(err && err.message === 'incompleto' ? 'Arquivo incompleto: a Bíblia precisa ter os 66 livros' : 'Não consegui ler este arquivo'); }
  };
  $$('#aba-versoes [data-rm]').forEach(b => b.onclick = () => PD.confirmar('Remover esta versão?', 'Você poderá instalar de novo depois.', async () => { await remover(b.dataset.rm); renderVersoes(); }));
}

/* ---------- Sobre / créditos ---------- */
Acoes.sobre = () => {
  Modal.open(`<h2>Sobre o Palavra Divina</h2>
    <p class="muted" style="margin-top:0">App de apoio ao pregador. Todos os seus dados ficam salvos somente neste aparelho.</p>
    <h3 style="color:var(--gold2);margin-top:14px">Textos bíblicos</h3>
    ${Object.values(VERSOES).map(v => `<p style="font-size:.88rem"><b>${esc(v.sigla)}</b> — ${esc(v.creditos)}</p>`).join('')}
    <p class="muted" style="font-size:.8rem">Os textos são exibidos sem alterações. O dicionário, os resumos dos livros, os modelos e as dicas foram escritos para este app.</p>
    <button class="btn sec" data-close style="width:100%;justify-content:center">Fechar</button>`);
};

/* ---------- Links de referência no editor e no púlpito ---------- */
function linkificar(el) {
  if (!el || el.dataset.lk) return; el.dataset.lk = 1;
  const txt = el.textContent; if (!parseRefs(txt).length) return;
  el.innerHTML = el.innerHTML.replace(/(📖\s*)?(.*)/s, (m, ic, resto) => `${ic || ''}<a class="ref-link">${resto}</a>`);
  el.querySelector('a').onclick = () => abrirRefs(txt.replace('📖', ''));
}
new MutationObserver(() => $$('#p-conteudo .ref').forEach(linkificar)).observe(document.getElementById('p-conteudo'), { childList: true });
function botoesEditor() {
  $$('#editor input[data-k="texto"], #editor input[data-p="ref"]').forEach(inp => {
    if (inp.nextElementSibling && inp.nextElementSibling.classList.contains('vt')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm vt'; b.textContent = '📖 Ver texto'; b.style.marginTop = '6px';
    b.onclick = () => abrirRefs(inp.value);
    inp.after(b);
  });
}
new MutationObserver(botoesEditor).observe(document.getElementById('editor'), { childList: true, subtree: true });

/* ---------- início ---------- */
window.Biblia = {
  _ok: false,
  async init() {
    if (this._ok) return; this._ok = true;
    B.carregando = true; if (App.view === 'biblia') irAba(B.aba);
    try { await carregarInstaladas(); } finally { B.carregando = false; }
    if (App.view === 'biblia') irAba(B.aba);
  },
  abrirRefs, parseRefs
};
if (Store.idb) Biblia.init();
})();
