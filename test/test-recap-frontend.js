const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { File } = require('node:buffer');
const { inspectFiles, buildBatch, packRecap } = require('../src/utils/hierarchy-recap-batch');
const fixture = require('./recap-fixture');

async function run() {
  const html = await fs.readFile(path.join(__dirname, '../public/index.html'), 'utf8');
  class Element {
    constructor(id = '') { this.id=id; this.value=''; this.checked=false; this.disabled=false; this.hidden=false; this.style={}; this.dataset={}; this.listeners={}; this.options=[]; this.children=[]; this.textContent=''; this.innerHTML=''; this.attributes={};const classes=new Set();this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle:(n,force)=>{const on=force===undefined?!classes.has(n):force;if(on)classes.add(n);else classes.delete(n);return on;}}; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    async fire(type, target = this, extra = {}) { for (const fn of this.listeners[type] || []) await fn({target,preventDefault(){},stopPropagation(){},...extra}); }
    querySelectorAll(selector){return this.id==='recapBatchReview' && selector==='input, select, button' ? ['recapFiscalYear','recapNewUnitName','recapAddUnit','recapClearFiles','recapInspectFiles'].map(get) : [];}
    querySelector(){return new Element();}
    appendChild(child){this.children.push(child);this.options.push(child);if (!this.value) this.value=child.value;return child;}
    contains(){return true;}
    closest(){return null;}
    click(){}
    focus(){}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    select(){}
    removeAttribute(){}
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id,new Element(id)); return elements.get(id); };
  const alerts=[], exports=[], pdfs=[], activeIntervals=new Set();
  const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
  const XLSX={utils:{
    aoa_to_sheet:rows=>({rows}),
    book_new:()=>({sheets:[]}),
    book_append_sheet:(wb,sheet,name)=>wb.sheets.push({sheet,name})
  },writeFile:wb=>exports.push(wb)};
  class Pdf {
    constructor(){this.tables=[];this.internal={pageSize:{getWidth:()=>297,getHeight:()=>210}};pdfs.push(this);}
    setFontSize(){} setTextColor(){} setFont(){} text(){} addPage(){} setFillColor(){} rect(){}
    autoTable(table){this.tables.push(table);this.lastAutoTable={finalY:50};}
    save(){}
  }
  const context = {
    console, FormData, Blob, AbortController, crypto:webcrypto, Set, Map, Date, URL, setTimeout, clearTimeout,
    setInterval(fn,ms){const timer=setInterval(fn,ms);activeIntervals.add(timer);return timer;},
    clearInterval(timer){clearInterval(timer);activeIntervals.delete(timer);},
    document:{ getElementById:get,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element(),body:{appendChild(){},removeChild(){}} },
    localStorage:{getItem(){return null;},setItem(){}},
    innerWidth:1200,addEventListener(){},alert:msg=>alerts.push(msg),XLSX,jspdf:{jsPDF:Pdf},
    async fetch(url, options) {
      const gate=context.fetchGate;context.fetchGate=null;
      if(gate) await gate.promise;
      if(context.nextFailure){const error=context.nextFailure;context.nextFailure=null;throw error;}
      const files = await Promise.all(options.body.getAll('files').map(async file => ({originalname:file.name,buffer:Buffer.from(await file.arrayBuffer())})));
      const data = url.endsWith('/inspect') ? await inspectFiles(files) : packRecap(await buildBatch(files,JSON.parse(options.body.get('manifest'))));
      if(gate)gate.finished.resolve();
      return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};
    }
  };
  context.window=context;
  vm.createContext(context);
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (match[1].trim()) vm.runInContext(match[1],context);
  }
  vm.runInContext(await fs.readFile(path.join(__dirname,'../public/recap-batch.js'),'utf8'),context);
  async function idle() {
    for (let i=0;i<200;i++) {
      await new Promise(r=>setTimeout(r,10));
      if (!get('recapFiscalYear').disabled && !get('statusRecap').textContent.includes('Memeriksa') && !get('statusRecap').textContent.includes('Membuat')) return;
    }
    throw Error('UI request did not finish');
  }
  const a=await fixture(), b=await fixture({unit:'BPKK Kendari',location:'KOTA KENDARI',kppn:'060',amount:20000});
  const uploads=[new File([a.buffer], '<img src=x onerror=bad()>.xlsx'),new File([b.buffer], 'renamed.xlsx')];
  const inspectGate=deferred();inspectGate.finished=deferred();context.fetchGate=inspectGate;
  await get('fileInputRecap').fire('change',{files:uploads});
  assert.equal(get('recapLoading').hidden,false);
  assert.ok(get('recapLoadingTitle').textContent.includes('2 file XLSX'));
  assert.ok(get('recapLoadingHelp').textContent.includes('aktif kembali'));
  assert.equal(get('recapFiscalYear').disabled,true);
  assert.equal(get('fileInputRecap').disabled,true);
  assert.equal(get('btnProcessRecap').disabled,true);
  assert.ok(get('btnProcessRecap').innerHTML.includes('fa-spinner'));
  assert.equal(get('recapCancelRequest').disabled,false);
  assert.equal(activeIntervals.size,1);
  await get('recapCancelRequest').fire('click');
  assert.equal(get('recapLoading').hidden,true);
  assert.equal(get('recapFiscalYear').disabled,false);
  assert.equal(get('fileInputRecap').disabled,false);
  assert.equal(activeIntervals.size,0);
  inspectGate.resolve();await inspectGate.finished.promise;
  await new Promise(r=>setTimeout(r,0));
  assert.ok(get('recapBatchFiles').innerHTML.includes('Pemeriksaan dibatalkan'));
  assert.ok(get('statusRecap').textContent.includes('Permintaan dibatalkan'));
  await get('recapInspectFiles').fire('click');
  await idle();
  assert.equal(get('recapLoading').hidden,true);
  assert.equal(activeIntervals.size,0);
  assert.equal(get('btnProcessRecap').disabled,true);
  assert.ok(get('recapBatchFiles').innerHTML.includes('&lt;img'));
  get('recapFiscalYear').value='2027';
  await get('recapFiscalYear').fire('input');
  for (const index of [0,1]) await get('recapBatchFiles').fire('change',{dataset:{action:'confirm',index:String(index)},checked:true});
  assert.equal(get('btnProcessRecap').disabled,false, get('recapBatchFiles').innerHTML + ' STATUS: ' + get('statusRecap').innerHTML);
  const batchGate=deferred();batchGate.finished=deferred();context.fetchGate=batchGate;
  const batchClick=get('btnProcessRecap').fire('click');
  assert.equal(get('recapLoading').hidden,false);
  assert.ok(get('recapLoadingTitle').textContent.includes('Membuat rekap'));
  assert.equal(get('recapFiscalYear').disabled,true);
  batchGate.resolve();await batchClick;await idle();
  assert.equal(get('recapLoading').hidden,true);
  assert.equal(get('recapFiscalYear').disabled,false);
  assert.equal(activeIntervals.size,0);
  const total=vm.runInContext('currentRecapData.rootSummary.totalVal',context);
  assert.equal(total,60000);
  assert.equal(vm.runInContext('currentRecapData.rootSummary.digit6List.flatMap(a=>a.details).length',context),4);
  assert.equal(vm.runInContext('currentRecapData.detailRecords',context),undefined);
  assert.equal(get('recapResultPanel').style.display,'block');
  assert.ok(get('tbodyRecapD6').innerHTML.includes('&lt;script&gt;'));
  assert.ok(get('tbodyRecapD6').innerHTML.includes('BPKK Bekasi'));
  assert.ok(get('tbodyRecapD6').innerHTML.includes('RKK_MULTIYEAR_SATKER'));
  vm.runInContext('downloadRecapExcel(); downloadRecapPdf(); downloadTreeExcel(); downloadTreePdf();',context);
  assert.deepEqual(alerts,[]);
  assert.equal(exports.length,2);
  assert.ok(exports.every(w=>w.sheets.some(s=>s.name==='Sumber dan Atribusi')));
  assert.equal(pdfs.length,2);
  assert.ok(pdfs.every(d=>d.tables.length===2));

  // Facet regression: normal travel accounts must not inherit block codes/PLN
  // from unrelated accounts in the same root scope.
  const originalData = vm.runInContext('currentRecapData',context);
  const detail = (rowNum, tagging, val, isBlocked, blockCode = '') => ({rowNum,tagging,val,isBlocked,blockCode,uraian:'Item ' + rowNum});
  const facetSummary = {
    ...originalData.rootSummary, totalVal:1550,totalRM:100,totalPNBP:950,totalPLN:500,totalBlocked:1200,childrenKeys:[],
    digit6List:[
      {code:'524111',name:'Perjalanan RM',tagging:'RM',totalVal:100,totalBlocked:0,details:[detail(1,'RM',100,false)]},
      {code:'524111',name:'Perjalanan PNP',tagging:'PNBP',totalVal:200,totalBlocked:0,details:[detail(2,'PNBP',200,false)]},
      {code:'521211',name:'Bahan campuran',tagging:'PNBP',blockCode:'A',totalVal:750,totalBlocked:700,
        details:[detail(3,'PNBP',300,true,'A'),detail(4,'PNBP',400,true,'B'),detail(5,'PNBP',50,false)]},
      {code:'521811',name:'Persediaan PLN',tagging:'PLN',totalVal:500,totalBlocked:500,details:[detail(6,'PLN',500,true)]}
    ]
  };
  context.facetData={...originalData,rootSummary:facetSummary,nodeSummaries:{ROOT:facetSummary},
    hierarchyTree:{...facetSummary,children:[]},childrenMap:{},nodesByLevel:{0:[],1:[],2:[],3:[],4:[],5:[],6:[]}};
  vm.runInContext("applyBatchRecap(facetData); selectedD6Codes=new Set(['524111']);renderRecapForSelectedNode(false);",context);
  const evaluate = code => vm.runInContext(code,context);
  assert.equal(evaluate("currentAvailableD6Tags.join(',')"),'RM,PNP');
  assert.equal(evaluate('currentAvailableBlockCodes.length'),0);
  assert.equal(get('btnMultiSelectD6BlockCode').disabled,false);
  assert.equal(get('listMultiSelectD6Tag').innerHTML.includes('value="PLN"'),false);
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),300);

  assert.equal(evaluate("currentAvailableD6Statuses.join(',')"),'NORMAL');
  assert.equal(get('listMultiSelectD6Blocked').innerHTML.includes('value="BLOCKED"'),false);
  await get('btnMultiSelectD6BlockCode').fire('click');
  assert.equal(get('dropdownMultiSelectD6BlockCode').classList.contains('show'),true);
  assert.equal(get('btnMultiSelectD6BlockCode').getAttribute('aria-expanded'),'true');
  assert.ok(get('listMultiSelectD6BlockCode').innerHTML.includes('Detail normal tetap tampil'));
  assert.equal(get('btnSelectAllD6BlockCodes').disabled,true);
  assert.equal(get('btnClearD6BlockCodes').disabled,true);
  await get('btnMultiSelectD6Blocked').fire('click');
  assert.equal(get('dropdownMultiSelectD6BlockCode').classList.contains('show'),false);
  assert.equal(get('btnMultiSelectD6BlockCode').getAttribute('aria-expanded'),'false');
  assert.equal(get('dropdownMultiSelectD6Blocked').classList.contains('show'),true);
  evaluate('closeAllDropdowns();');

  await get('btnClearD6BlockCodes').fire('click');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),300,'Clearing block codes must not remove normal rows');
  evaluate("handleD6TagCheckboxChange({value:'PNP',checked:false});");
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),100);
  await get('btnSelectAllD6Tags').fire('click');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),300);
  evaluate("selectedD6Codes=new Set(['521211']);renderRecapForSelectedNode(false);");
  assert.equal(evaluate("currentAvailableD6Tags.join(',')"),'PNP');
  assert.equal(evaluate("currentAvailableBlockCodes.map(c=>c.code).join(',')"),'A,B');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),50);
  await get('btnSelectAllD6BlockCodes').fire('click');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),750);
  evaluate("handleD6BlockCodeCheckboxChange({value:'A',checked:false});");
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),450,'Match detail B, not account-level A; retain normal detail');
  evaluate("allD6Statuses=false; selectedD6Blocked=new Set(['BLOCKED']);renderRecapForSelectedNode(false);");
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),400);
  await get('btnClearD6BlockCodes').fire('click');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),0);
  await get('btnSelectAllD6BlockCodes').fire('click');
  evaluate("allD6Statuses=false; selectedD6Blocked=new Set(['NORMAL']);renderRecapForSelectedNode(false);");
  assert.equal(evaluate('currentAvailableBlockCodes.length'),0);
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),50);
  evaluate("allD6Statuses=true; selectedD6Blocked=new Set(['BLOCKED','NORMAL']); selectedD6Codes=new Set(['521811']);renderRecapForSelectedNode(false);");
  assert.equal(evaluate("currentAvailableD6Tags.join(',')"),'PLN');
  assert.equal(evaluate("currentAvailableBlockCodes[0].code"),'Tanpa Kode');
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),500);
  evaluate("setD6BlockFilter('Tanpa Kode');");
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),500,'Uncoded blocked details must have an explicit category');
  get('searchD6').value='not found';
  await get('searchD6').fire('input');
  assert.equal(evaluate('currentAvailableD6Tags.length'),0);
  assert.equal(evaluate('currentAvailableBlockCodes.length'),0);
  assert.equal(evaluate('getFilteredRecapData().totals.totalVal'),0);

  const emptySummary={...facetSummary,totalVal:0,totalRM:0,totalPNBP:0,totalPLN:0,totalBlocked:0,digit6List:[]};
  context.emptyData={...context.facetData,rootSummary:emptySummary,nodeSummaries:{ROOT:emptySummary},hierarchyTree:{...emptySummary,children:[]}};
  evaluate("applyBatchRecap(emptyData);currentNodeOptions=[];renderSearchableParentNodeList();");
  for(const [button,dropdown,list] of [
    ['btnMultiSelectD6Code','dropdownMultiSelectD6Code','listMultiSelectD6Code'],
    ['btnMultiSelectD6Tag','dropdownMultiSelectD6Tag','listMultiSelectD6Tag'],
    ['btnMultiSelectD6Blocked','dropdownMultiSelectD6Blocked','listMultiSelectD6Blocked'],
    ['btnMultiSelectD6BlockCode','dropdownMultiSelectD6BlockCode','listMultiSelectD6BlockCode'],
    ['btnSearchableParentNode','dropdownSearchableParentNode','listSearchableParentNode']
  ]) {
    assert.equal(get(button).disabled,false);
    assert.equal(get(button).classList.contains('filter-empty'),true);
    await get(button).fire('click');
    assert.equal(get(dropdown).classList.contains('show'),true,'Empty filter must respond to click: '+button);
    assert.equal(get(button).getAttribute('aria-expanded'),'true');
    assert.ok(get(list).innerHTML.includes('Tidak ada pilihan untuk filter ini'));
    evaluate('closeAllDropdowns();');
    assert.equal(get(button).getAttribute('aria-expanded'),'false');
  }

  context.originalData=originalData;
  evaluate('applyBatchRecap(originalData);');

  get('recapOwnerFilter').value='bpkk-bekasi';
  await get('recapOwnerFilter').fire('change');
  await idle();
  assert.equal(vm.runInContext('currentRecapData.rootSummary.totalVal',context),20000);
  assert.ok(get('recapBatchSummary').textContent.includes('1 sumber'));
  // Input changes invalidate results, and changing owner requires reconfirmation.
  await get('recapBatchFiles').fire('change',{dataset:{action:'owner',index:'1'},value:'bpkk-bekasi'});
  assert.equal(get('btnProcessRecap').disabled,true);
  assert.equal(get('recapResultPanel').style.display,'none');
  assert.equal(vm.runInContext('currentRecapData',context),null);
  get('recapNewUnitName').value='Unit Baru <b>test</b>';
  await get('recapAddUnit').fire('click');
  assert.ok(get('recapBatchFiles').innerHTML.includes('Unit Baru &lt;b&gt;test&lt;/b&gt;'));
  await get('recapClearFiles').fire('click');
  assert.equal(get('recapBatchReview').hidden,true);
  assert.equal(get('recapFiscalYear').value,'');
  assert.equal(get('btnProcessRecap').disabled,true);
  context.nextFailure=new Error('Jaringan pengujian terputus');
  await get('fileInputRecap').fire('change',{files:[uploads[0]]});
  await idle();
  assert.equal(get('recapLoading').hidden,true);
  assert.equal(get('recapInspectFiles').disabled,false);
  assert.equal(get('recapFiscalYear').disabled,false);
  assert.equal(activeIntervals.size,0);
  assert.ok(get('statusRecap').textContent.includes('Jaringan pengujian terputus'));
  await get('recapClearFiles').fire('click');
  console.log('Frontend: multiple upload, year/owner confirmation, compact hydration, escaped evidence/details, owner filter, dynamic funding/status/block-code facets, all five empty-filter buttons, loading/cancellation/retry/error recovery, uncoded blocked details, reset and four exports passed (DOM simulation; visual browser unavailable).');
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports=run;
