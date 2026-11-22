const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),source=fs.readFileSync('app.js','utf8');
const els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',reset(){},showModal(){},close(){}}]));
const store={};const ctx={document:{getElementById:id=>els[id]},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},Intl,Date,JSON,Number,String,Array,Set,Math,crypto:{randomUUID:()=> 'test-id'},alert:()=>{},confirm:()=>true};vm.createContext(ctx);vm.runInContext(source,ctx);
els.month.value='2026-11';els.type.value='income';els.description.value='Salário';els.amount.value='2000';els.date.value='2026-11-10';els.category.value='Trabalho';els.form.onsubmit({preventDefault(){}});assert.equal(JSON.parse(store['poupemais.local.v1'])[0].cents,200000);assert.match(els.income.textContent,/2.000,00/);
els.type.value='expense';els.description.value='Conta';els.amount.value='300';els.date.value='2026-11-11';ctx.crypto.randomUUID=()=> 'test-2';els.form.onsubmit({preventDefault(){}});assert.match(els.balance.textContent,/1.700,00/);els.month.value='2026-12';els.month.onchange();assert.match(els.balance.textContent,/0,00/);console.log('Local transactions and monthly totals verified');

