const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{value:'',textContent:'',innerHTML:'',disabled:false,classList:{toggle(){},add(){},remove(){},contains(){return false}},addEventListener(name,fn){this[name]=fn},focus(){this.focused=true},reset(){}}]));
let rows=[],writes=[],authCalls=[];
function query(){
 let operation='select',payload,filters=[];
 const q={select(){return q},update(v){operation='update';payload=v;return q},insert(v){operation='insert';payload=v;return q},delete(){operation='delete';return q},eq(k,v){filters.push(r=>r[k]===v);return q},neq(k,v){filters.push(r=>r[k]!==v);return q},gte(k,v){filters.push(r=>r[k]>=v);return q},then(resolve,reject){try{
 const matches=rows.filter(r=>filters.every(f=>f(r)));
 if(operation==='update'){matches.forEach(r=>Object.assign(r,payload));writes.push({operation,ids:matches.map(r=>r.id)})}
 if(operation==='delete'){rows=rows.filter(r=>!matches.includes(r));writes.push({operation,ids:matches.map(r=>r.id)})}
 if(operation==='insert'){rows.push({...payload,id:'new-'+rows.length});writes.push({operation})}
 return Promise.resolve({data:matches,error:null}).then(resolve,reject);
 }catch(e){return Promise.reject(e).then(resolve,reject)}}};return q;
}
const auth={onAuthStateChange(){},getSession:async()=>({data:{session:null}}),signInWithPassword:async v=>{authCalls.push(v);return {error:{message:'Invalid login credentials'}}},updateUser:async()=>{throw Error('must not update real credentials')}};
const context=vm.createContext({console,Intl,Date,URLSearchParams,document:{getElementById:id=>{assert(elements.has(id),'missing DOM id '+id);return elements.get(id)},querySelectorAll:()=>[],body:{classList:{toggle(){},contains(){return false},add(){}}}},window:{supabase:{createClient:()=>({auth,from:query})}},localStorage:{getItem(){return null},setItem(){}},location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},setTimeout,confirm:()=>false,prompt:()=>null});
vm.runInContext(source,context); // Full startup must compile and bind every required handler.
function run(code){return vm.runInContext(code,context)}
function baseRow(n,date,status='pending'){return {id:'row-'+n,user_id:'owner',recurring_rule_id:'rule',occurrence_number:n,transaction_date:date,status,amount:10}}
async function sync(rule,fixtures){rows=structuredClone(fixtures);writes=[];context.rule=rule;run("user={id:'owner'}");await run('syncFutureOccurrences(rule)')}
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 for(const [input,expected] of [['1.000,00',1000],['R$ 2.345,67',2345.67],['1000.50',1000.5],['1.000',1000],['0',0],['0,01',.01]]){context.input=input;assert.equal(run('parseMoney(input)'),expected)}
 for(const input of ['', 'abc','-2','1,2,3','1.23,45','Infinity']){context.input=input;assert.throws(()=>run('parseMoney(input)'))}
 await elements.get('forgotBtn').onclick();assert.match(elements.get('notice').textContent,/Informe seu e-mail/);
 assert(!/<input id="password"[^>]*minlength/.test(html));
 elements.get('email').value='test@example.invalid';elements.get('password').value='123456';
 await elements.get('authForm').onsubmit({preventDefault(){},submitter:{value:'login'}});assert.equal(authCalls.length,1,'six-character existing password must reach auth');
 await elements.get('authForm').onsubmit({preventDefault(){},submitter:{value:'signup'}});assert.match(elements.get('notice').textContent,/8 caracteres/);
 elements.get('newPassword').value='123456';elements.get('confirmPassword').value='123456';await elements.get('resetForm').submit({preventDefault(){},submitter:{}});assert.match(elements.get('notice').textContent,/8 caracteres/);
 const month=run('isoToday.slice(0,7)');const [year,m]=month.split('-').map(Number);
 function date(offset,day='10'){return new Date(Date.UTC(year,m-1+offset,Number(day))).toISOString().slice(0,10)}
 const rule={id:'rule',start_month:date(0,'01'),end_month:null,day_of_month:31,recurrence_kind:'installment',total_installments:2,amount:100,type:'expense',active:true};
 await sync(rule,[baseRow(1,date(0)),baseRow(2,date(1)),baseRow(3,date(2)),baseRow(4,date(3),'paid'),baseRow(5,date(-1)),{...baseRow(6,date(4)),user_id:'other'}]);
 assert(!rows.some(r=>r.id==='row-3'),'shortened installments trim unpaid future');assert(rows.some(r=>r.id==='row-4'&&r.status==='paid'&&r.amount===10));assert(rows.some(r=>r.id==='row-5'));assert(rows.some(r=>r.user_id==='other'));
 assert.equal(rows.find(r=>r.id==='row-1').transaction_date,new Date(Date.UTC(year,m,0)).toISOString().slice(0,10),'day 31 clamps to month end');
 await sync({...rule,recurrence_kind:'monthly',total_installments:null,end_month:date(0,'01')},[baseRow(1,date(0)),baseRow(2,date(1))]);assert.equal(rows.length,1,'end month removes later unpaid occurrences');
 await sync({...rule,active:false},[]);assert.equal(writes.length,0,'paused rule does not generate entries');
 await sync(rule,[]);assert.equal(rows.length,2);await sync(rule,rows);assert.equal(rows.length,2,'retry does not duplicate occurrences');
 context.fixture=[{id:'x',date:month+'-05',description:'<img src=x>',amount:1000,type:'income',status:'paid',category:'Outros'},{id:'y',date:month+'-06',description:'Despesa',amount:400,type:'expense',status:'paid',category:'Moradia'},{id:'z',date:month+'-07',due:month+'-10',description:'Pendente',amount:150,type:'expense',status:'pending',category:'Moradia'}];
 run('data=fixture; renderAll()');
 assert.match(elements.get('metrics').innerHTML,/600,00/,'balance uses paid transactions only');
 assert.match(elements.get('metrics').innerHTML,/150,00/,'pending payable total');
 assert.match(elements.get('categoryLegend').innerHTML,/400,00/,'category chart uses paid expenses');
 assert.match(elements.get('recentTable').innerHTML,/&lt;img src=x&gt;/,'dashboard escapes descriptions');
 assert.equal((elements.get('cashflowChart').innerHTML.match(/class="flow-group"/g)||[]).length,6,'cash flow shows six months');
 run("data=[]; goals=[]; recurring=[]; cashAccounts=[]; renderAll()");
 assert.match(elements.get('recentTable').innerHTML,/Nenhuma transação/);
 console.log('PASS: startup, money formats, login/reset validation, recovery feedback, recurrence shortening/end date, paid/history/user preservation, month end, pause and idempotent retry');
})().catch(e=>{console.error(e);process.exitCode=1});

