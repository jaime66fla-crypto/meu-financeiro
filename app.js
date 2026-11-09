
const fmt = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const APP_URL='https://jaime66fla-crypto.github.io/meu-financeiro/';
const today = new Date(); const isoToday = new Intl.DateTimeFormat('en-CA').format(today); document.getElementById('date').value=isoToday;
let data=[], categories=[], budgets=[], goals=[], recurring=[], cashAccounts=[], editing=null, recurringEditing=null, cashEditing=null, user=null;
const $=id=>document.getElementById(id);
const db=window.supabase.createClient('https://dnfcqeawfcudnyxqzibb.supabase.co','sb_publishable_SMfgKezBGomReUbGJte69Q_6bHamg4j');
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function handleAuthRedirectError(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const code=hash.get('error_code');
  if(!code)return;
  const description=(hash.get('error_description')||'').replace(/\+/g,' ');
  if(code==='otp_expired') notice('Este link expirou ou já foi usado. Solicite um novo link em "Esqueci minha senha".');
  else notice('Não foi possível concluir a autenticação: '+(description||code));
  history.replaceState(null,'',location.pathname+location.search);
}
function notice(s){$('notice').textContent=s}
handleAuthRedirectError();
function fail(e){notice('Não foi possível concluir: '+(e.message||e))}
async function check(q){const r=await q;if(r.error)throw r.error;return r.data}
async function load(){
 const tables=await Promise.all(['transactions','categories','budgets','goals','recurring_rules','cash_accounts'].map(t=>check(db.from(t).select('*').eq('user_id',user.id))));
 categories=tables[1];budgets=tables[2];goals=tables[3];recurring=tables[4].map(r=>({...r,amount:Number(r.amount)}));cashAccounts=tables[5].map(r=>({...r,balance:Number(r.balance)}));
 data=tables[0].map(r=>({...r,amount:Number(r.amount),date:r.transaction_date,due:r.due_date,payment:r.payment_method,category:categories.find(c=>c.id===r.category_id)?.name||'Outros'}));
 renderAll();categoryOptions();recurringCategoryOptions();
}
function categoryOptions(){const old=$('category').value;$('category').innerHTML='<option value="">Sem categoria</option>'+categories.filter(c=>c.type===$('type').value).map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');$('category').value=old}
async function sessionChanged(session){user=session?.user||null;$('authPanel').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);if(user){$('account').textContent=user.email;try{await load()}catch(e){fail(e)}}else{data=[];categories=[];budgets=[];goals=[];recurring=[];cashAccounts=[];renderAll()}}
function sameMonth(d){return d?.slice(0,7)=== $('month').value}
function statusOf(r){if(r.status==='paid')return 'paid'; if(r.status==='overdue'||(r.due&&r.due<isoToday))return 'overdue'; return 'pending'}
function statusLabel(r){return statusOf(r)==='paid'?(r.type==='income'?'Recebido':'Pago'):statusOf(r)==='overdue'?'Vencido':'Pendente'}
function metrics(){const m=data.filter(x=>sameMonth(x.date));const inc=m.filter(x=>x.type==='income'&&x.status==='paid').reduce((s,x)=>s+x.amount,0);const exp=m.filter(x=>x.type==='expense'&&x.status==='paid').reduce((s,x)=>s+x.amount,0);const toPay=m.filter(x=>x.type==='expense'&&x.status!=='paid').reduce((s,x)=>s+x.amount,0);const toGet=m.filter(x=>x.type==='income'&&x.status!=='paid').reduce((s,x)=>s+x.amount,0);return {inc,exp,toPay,toGet,balance:inc-exp}}
function metricCard(label,value,small=''){return `<div class="card metric"><div class="label">${label}</div><div class="value">${fmt.format(value)}</div><small>${small}</small></div>`}
function renderMetrics(){const m=metrics();const saved=cashAccounts.filter(a=>a.active).reduce((s,a)=>s+a.balance,0);document.getElementById('metrics').innerHTML=metricCard('Saldo do mês',m.balance,'recebido - pago')+metricCard('Valor guardado',saved,'caixa / reservas')+metricCard('Receitas recebidas',m.inc,'mês atual')+metricCard('Despesas pagas',m.exp,'mês atual')+metricCard('Ainda a pagar',m.toPay,'pendente');const max=Math.max(m.inc,m.exp,1);document.getElementById('chart').innerHTML=`<div class="barwrap"><div class="bar" style="height:${(m.inc/max)*170}px"></div>Receitas<br><b>${fmt.format(m.inc)}</b></div><div class="barwrap"><div class="bar exp" style="height:${(m.exp/max)*170}px"></div>Despesas<br><b>${fmt.format(m.exp)}</b></div>`;document.getElementById('monthSummary').innerHTML=`<p>A receber: <b>${fmt.format(m.toGet)}</b></p><p>A pagar: <b>${fmt.format(m.toPay)}</b></p><p>Saldo projetado: <b>${fmt.format(m.balance+m.toGet-m.toPay)}</b></p>`}
function table(rows){if(!rows.length)return '<div class="empty">Nenhum lançamento encontrado.</div>';return `<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Status</th><th>Forma</th><th style="text-align:right">Valor</th><th>Ações</th></tr></thead><tbody>${rows.map(r=>{const recurringAction=r.recurring_rule_id?'<span class="badge paid">Recorrente</span>':`<button onclick="makeRecurring('${r.id}')">Tornar recorrente</button>`;return `<tr><td><b>${escapeHTML(r.description)}</b></td><td>${escapeHTML(r.category)}</td><td>${new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR')}</td><td><span class="badge ${statusOf(r)}">${statusLabel(r)}</span></td><td>${escapeHTML(r.payment)}</td><td class="money">${fmt.format(r.amount)}</td><td class="row-actions"><button onclick="editRow('${r.id}')">Editar</button>${recurringAction}<button class="del" onclick="deleteRow('${r.id}')">Excluir</button></td></tr>`}).join('')}</tbody></table>`}
function renderTables(){document.getElementById('recentTable').innerHTML=table([...data].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')).slice(0,6));const sr=document.getElementById('searchReceitas').value.toLowerCase(),fr=document.getElementById('filterReceitas').value;let r=data.filter(x=>sameMonth(x.date)&&x.type==='income'&&x.description.toLowerCase().includes(sr)&&(fr==='all'||statusOf(x)===fr));document.getElementById('receitasTable').innerHTML=table(r);const sd=document.getElementById('searchDespesas').value.toLowerCase(),fd=document.getElementById('filterDespesas').value;let d=data.filter(x=>sameMonth(x.date)&&x.type==='expense'&&x.description.toLowerCase().includes(sd)&&(fd==='all'||statusOf(x)===fd));document.getElementById('despesasTable').innerHTML=table(d)}
function renderBudget(){
 $('budgetCards').innerHTML=budgets.filter(b=>b.month_start.slice(0,7)===$('month').value).map(b=>{const cat=categories.find(c=>c.id===b.category_id)?.name||'Geral';const spent=data.filter(t=>t.type==='expense'&&sameMonth(t.date)&&(!b.category_id||t.category_id===b.category_id)).reduce((s,t)=>s+t.amount,0);return `<div class="card"><b>${escapeHTML(cat)}</b><p>${fmt.format(spent)} / ${fmt.format(b.amount)}</p><div class="progress"><span style="width:${Math.min(100,spent/Math.max(Number(b.amount),1)*100)}%"></span></div><button class="btn" onclick="removePlan('budgets','${b.id}')">Excluir</button></div>`}).join('')||'<div class="card empty">Defina seu primeiro orçamento.</div>';
 $('goalCards').innerHTML=goals.map(g=>`<div class="card"><b>${escapeHTML(g.name)}</b><p>${fmt.format(g.current_amount)} / ${fmt.format(g.target_amount)}</p><p>${g.target_date?new Date(g.target_date+'T12:00:00').toLocaleDateString('pt-BR'): 'Sem prazo'}</p><button class="btn" onclick="updateGoal('${g.id}')">Atualizar valor</button> <button class="btn" onclick="removePlan('goals','${g.id}')">Excluir</button></div>`).join('')||'<div class="card empty">Cadastre uma meta financeira.</div>';
}
function renderReport(){const m=metrics();document.getElementById('reportContent').innerHTML=`<p><b>Receitas recebidas:</b> ${fmt.format(m.inc)}</p><p><b>Despesas pagas:</b> ${fmt.format(m.exp)}</p><p><b>A receber:</b> ${fmt.format(m.toGet)}</p><p><b>A pagar:</b> ${fmt.format(m.toPay)}</p><p><b>Saldo projetado:</b> ${fmt.format(m.balance+m.toGet-m.toPay)}</p>`}
function recurringCategoryOptions(){const old=$('recCategory')?.value;if(!$('recCategory'))return;$('recCategory').innerHTML='<option value="">Sem categoria</option>'+categories.filter(c=>c.type===$('recType').value).map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');$('recCategory').value=old||''}
function recurringTable(rows){if(!rows.length)return '<div class="empty">Nenhuma conta recorrente cadastrada.</div>';return `<table><thead><tr><th>Descrição</th><th>Categoria</th><th>Venc.</th><th>Tipo</th><th>Situação</th><th style="text-align:right">Valor</th><th>Ações</th></tr></thead><tbody>${rows.map(r=>{const cat=categories.find(c=>c.id===r.category_id)?.name||'Sem categoria';const kind=r.recurrence_kind==='installment'?('Parcelada'+(r.total_installments?' · '+r.total_installments+'x':'')):'Mensal';return `<tr><td><b>${escapeHTML(r.description)}</b></td><td>${escapeHTML(cat)}</td><td>Dia ${r.day_of_month}</td><td>${kind}</td><td><span class="badge ${r.active?'paid':'pending'}">${r.active?'Ativa':'Pausada'}</span></td><td class="money">${fmt.format(r.amount)}</td><td class="row-actions"><button onclick="editRecurring('${r.id}')">Editar</button><button onclick="toggleRecurring('${r.id}')">${r.active?'Pausar':'Ativar'}</button><button class="del" onclick="deleteRecurring('${r.id}')">Excluir</button></td></tr>`}).join('')}</tbody></table>`}
function renderRecurring(){if(!$('recurringExpenseTable'))return;const expenses=recurring.filter(r=>r.type==='expense').sort((a,b)=>a.description.localeCompare(b.description));const incomes=recurring.filter(r=>r.type==='income').sort((a,b)=>a.description.localeCompare(b.description));$('recurringExpenseTable').innerHTML=recurringTable(expenses);$('recurringIncomeTable').innerHTML=recurringTable(incomes);const expenseTotal=expenses.filter(r=>r.active).reduce((s,r)=>s+r.amount,0);const incomeTotal=incomes.filter(r=>r.active).reduce((s,r)=>s+r.amount,0);const balance=incomeTotal-expenseTotal;if($('recurringSummary'))$('recurringSummary').innerHTML=metricCard('Recorrentes a pagar',expenseTotal,'contas ativas por mês')+metricCard('Recorrentes a receber',incomeTotal,'receitas ativas por mês')+metricCard('Saldo recorrente',balance,'a receber - a pagar')}
function renderCash(){if(!$('cashSummary'))return;const active=cashAccounts.filter(a=>a.active);const total=active.reduce((s,a)=>s+a.balance,0);$('cashSummary').innerHTML=metricCard('Valor guardado',total,'soma das contas ativas')+metricCard('Contas ativas',active.length,'reservas e saldos cadastrados');$('cashAccountsTable').innerHTML=!cashAccounts.length?'<div class="empty">Nenhuma conta cadastrada.</div>':`<table><thead><tr><th>Conta</th><th>Instituição</th><th>Tipo</th><th>Situação</th><th style="text-align:right">Saldo</th><th>Ações</th></tr></thead><tbody>${cashAccounts.map(a=>`<tr><td><b>${escapeHTML(a.name)}</b></td><td>${escapeHTML(a.institution||'—')}</td><td>${escapeHTML(({reserva:'Reserva',corrente:'Conta corrente',poupanca:'Poupança',dinheiro:'Dinheiro',investimento:'Investimento',outros:'Outros'})[a.account_type]||a.account_type)}</td><td><span class="badge ${a.active?'paid':'pending'}">${a.active?'Ativa':'Inativa'}</span></td><td class="money">${fmt.format(a.balance)}</td><td class="row-actions"><button onclick="editCash('${a.id}')">Editar</button><button onclick="toggleCash('${a.id}')">${a.active?'Desativar':'Ativar'}</button><button class="del" onclick="deleteCash('${a.id}')">Excluir</button></td></tr>`).join('')}</tbody></table>`}
function renderAll(){renderMetrics();renderTables();renderBudget();renderReport();renderRecurring();renderCash()}
function openModal(){document.getElementById('modal').classList.remove('hidden')} function closeModal(){document.getElementById('modal').classList.add('hidden');editing=null;document.getElementById('entryForm').reset();document.getElementById('date').value=isoToday}
window.editRow=id=>{const r=data.find(x=>x.id===id);editing=id;['type','status','description','amount','date','due','payment','notes'].forEach(k=>$(k).value=r[k]||'');categoryOptions();$('category').value=r.category_id||'';$('modalTitle').textContent='Editar lançamento';openModal()};
window.deleteRow=async id=>{if(!confirm('Excluir este lançamento?'))return;try{await check(db.from('transactions').delete().eq('id',id).eq('user_id',user.id).select().single());await load();notice('Lançamento excluído.')}catch(e){fail(e)}};
window.makeRecurring=async id=>{
  const r=data.find(x=>x.id===id);
  if(!r)return;
  const label=r.type==='income'?'receita':'despesa';
  if(r.recurring_rule_id){notice('Esta '+label+' já está vinculada a uma recorrência.');return}
  if(!confirm('Transformar esta '+label+' em recorrente mensal? O lançamento atual será mantido e usado como primeira ocorrência.'))return;
  try{
    const baseDate=r.due||r.date;
    const startMonth=baseDate.slice(0,7)+'-01';
    const day=Number(baseDate.slice(8,10));
    const payload={user_id:user.id,type:r.type,description:r.description,category_id:r.category_id||null,amount:r.amount,day_of_month:day,start_month:startMonth,end_month:null,recurrence_kind:'monthly',total_installments:null,payment_method:r.payment||null,notes:r.notes||'',active:true,updated_at:new Date().toISOString()};
    const rule=await check(db.from('recurring_rules').insert(payload).select().single());
    try{
      await check(db.from('transactions').update({recurring_rule_id:rule.id,occurrence_number:1,updated_at:new Date().toISOString()}).eq('id',r.id).eq('user_id',user.id).select().single());
      await syncFutureOccurrences(rule);
    }catch(inner){
      await db.from('recurring_rules').delete().eq('id',rule.id).eq('user_id',user.id);
      throw inner;
    }
    await load();
    notice((r.type==='income'?'Receita':'Despesa')+' vinculada como recorrente. As próximas ocorrências foram criadas.');
  }catch(e){fail(e)}
};
$('entryForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const r={user_id:user.id,type:$('type').value,status:$('status').value,description:$('description').value.trim(),category_id:$('category').value||null,amount:Number($('amount').value),transaction_date:$('date').value,due_date:$('due').value||null,payment_method:$('payment').value,notes:$('notes').value.trim()};if(!r.description||r.amount<=0)throw Error('Informe descrição e valor maior que zero.');await check(editing?db.from('transactions').update(r).eq('id',editing).eq('user_id',user.id).select().single():db.from('transactions').insert(r).select().single());closeModal();await load();notice('Lançamento salvo.')}catch(e){fail(e)}finally{button.disabled=false}});
document.getElementById('newBtn').onclick=()=>{closeModal();categoryOptions();$('modalTitle').textContent='Novo lançamento';openModal()};document.getElementById('closeModal').onclick=closeModal;document.getElementById('cancelModal').onclick=closeModal;document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));document.getElementById(b.dataset.section).classList.add('active');document.getElementById('pageTitle').textContent=b.textContent});
document.getElementById('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('dark',document.body.classList.contains('dark')?'1':'0')};if(localStorage.getItem('dark')==='1')document.body.classList.add('dark');['searchReceitas','filterReceitas','searchDespesas','filterDespesas'].forEach(id=>document.getElementById(id).addEventListener('input',renderTables));

$('month').value=isoToday.slice(0,7);$('month').onchange=renderAll;$('type').onchange=categoryOptions;
$('authForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter||$('loginBtn');const action=b?.value||'login';if(b)b.disabled=true;notice(action==='signup'?'Criando conta...':'Entrando...');try{const credentials={email:$('email').value.trim().toLowerCase(),password:$('password').value};if(!credentials.email||!credentials.password)throw Error('Informe e-mail e senha.');if(action==='signup'&&credentials.password.length<8)throw Error('Para criar conta, use uma senha com pelo menos 8 caracteres.');const r=action==='signup'?await db.auth.signUp({...credentials,options:{emailRedirectTo:APP_URL}}):await db.auth.signInWithPassword(credentials);if(r.error)throw r.error;if(action==='signup'&&!r.data.session){notice('Confira seu e-mail para confirmar o cadastro.');return}if(!r.data.session)throw Error('Não foi possível iniciar a sessão.');await sessionChanged(r.data.session);notice('Conectado.')}catch(e){const msg=(e?.message||String(e));if(/invalid login credentials/i.test(msg))notice('E-mail ou senha incorretos.');else fail(e)}finally{if(b)b.disabled=false}};
$('logout').onclick=async()=>{try{await check(db.auth.signOut());await sessionChanged(null);notice('Você saiu da conta.')}catch(e){fail(e)}};
$('addCategory').onclick=async()=>{const name=prompt('Nome da categoria:');if(!name?.trim())return;try{await check(db.from('categories').insert({user_id:user.id,name:name.trim(),type:$('type').value}));await load();notice('Categoria criada.')}catch(e){fail(e)}};
function parseMoney(value){
  let text=String(value).trim().replace(/^R\$\s*/, '');
  if(!text)throw Error('Informe um valor.');
  if(text.includes(',')){
    if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text))throw Error('Valor inválido. Exemplo: 1.000,00.');
    text=text.replace(/\./g,'').replace(',','.');
  }else if(/^\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
  else if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('Valor inválido. Exemplo: 1.000,00.');
  const amount=Number(text);
  if(!Number.isFinite(amount)||amount<0)throw Error('Valor inválido.');
  return amount;
}
function moneyInput(label,initial=''){const value=prompt(label,initial);return value===null?null:parseMoney(value)}
$('addBudget').onclick=async()=>{try{const amount=moneyInput('Limite de despesas do mês (R$):');if(amount===null)return;const existing=budgets.find(b=>!b.category_id&&b.month_start=== $('month').value+'-01');await check(existing?db.from('budgets').update({amount}).eq('id',existing.id).eq('user_id',user.id):db.from('budgets').insert({user_id:user.id,amount,month_start:$('month').value+'-01'}));await load()}catch(e){fail(e)}};
$('addGoal').onclick=async()=>{try{const name=prompt('Nome da meta:');if(!name?.trim())return;const target_amount=moneyInput('Valor da meta (R$):');if(target_amount===null)return;await check(db.from('goals').insert({user_id:user.id,name:name.trim(),target_amount,current_amount:0}));await load()}catch(e){fail(e)}};
window.updateGoal=async id=>{try{const g=goals.find(x=>x.id===id);const current_amount=moneyInput('Valor já guardado (R$):',String(g.current_amount));if(current_amount===null)return;await check(db.from('goals').update({current_amount}).eq('id',id).eq('user_id',user.id));await load()}catch(e){fail(e)}};
window.removePlan=async(table,id)=>{if(!['budgets','goals'].includes(table)||!confirm('Excluir este planejamento?'))return;try{await check(db.from(table).delete().eq('id',id).eq('user_id',user.id));await load()}catch(e){fail(e)}};
db.auth.onAuthStateChange((event,session)=>{setTimeout(()=>sessionChanged(session).catch(fail),0);if(event==='PASSWORD_RECOVERY'){$('resetModal').classList.remove('hidden');notice('Defina sua nova senha.')}});
db.auth.getSession().then(({data,error})=>{if(error)throw error;return sessionChanged(data.session)}).catch(fail);

function openRecurringModal(type='expense'){recurringEditing=null;$('recurringForm').reset();$('recType').value=type;$('recActive').value='true';$('recKind').value='monthly';$('recDay').value='10';$('recStart').value=$('month').value;recurringCategoryOptions();$('recurringModalTitle').textContent=type==='expense'?'Conta recorrente a pagar':'Conta recorrente a receber';$('recurringModal').classList.remove('hidden')}
function closeRecurringModal(){$('recurringModal').classList.add('hidden');recurringEditing=null}
function monthStart(v){return v?v+'-01':null}
window.editRecurring=id=>{const r=recurring.find(x=>x.id===id);if(!r)return;recurringEditing=id;$('recType').value=r.type;$('recActive').value=String(r.active);$('recDescription').value=r.description;$('recAmount').value=r.amount;$('recDay').value=r.day_of_month;$('recKind').value=r.recurrence_kind;$('recInstallments').value=r.total_installments||'';$('recStart').value=r.start_month?.slice(0,7)||'';$('recEnd').value=r.end_month?.slice(0,7)||'';$('recPayment').value=r.payment_method||'';$('recNotes').value=r.notes||'';recurringCategoryOptions();$('recCategory').value=r.category_id||'';$('recurringModalTitle').textContent='Editar conta recorrente';$('recurringModal').classList.remove('hidden')};
window.toggleRecurring=async id=>{try{const r=recurring.find(x=>x.id===id);await check(db.from('recurring_rules').update({active:!r.active,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).select().single());await load();notice(r.active?'Recorrência pausada.':'Recorrência ativada.')}catch(e){fail(e)}};
window.deleteRecurring=async id=>{if(!confirm('Excluir esta recorrência? Os lançamentos mensais já existentes serão mantidos.'))return;try{await check(db.from('recurring_rules').delete().eq('id',id).eq('user_id',user.id).select().single());await load();notice('Recorrência excluída.')}catch(e){fail(e)}};
$('recurringForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const payload={user_id:user.id,type:$('recType').value,description:$('recDescription').value.trim(),category_id:$('recCategory').value||null,amount:Number($('recAmount').value),day_of_month:Number($('recDay').value),start_month:monthStart($('recStart').value),end_month:monthStart($('recEnd').value),recurrence_kind:$('recKind').value,total_installments:$('recKind').value==='installment'?Number($('recInstallments').value||0)||null:null,payment_method:$('recPayment').value||null,notes:$('recNotes').value.trim(),active:$('recActive').value==='true',updated_at:new Date().toISOString()};if(!payload.description||payload.amount<=0)throw Error('Informe descrição e valor maior que zero.');if(payload.recurrence_kind==='installment'&&!payload.total_installments)throw Error('Informe o número de parcelas.');let saved;if(recurringEditing){saved=await check(db.from('recurring_rules').update(payload).eq('id',recurringEditing).eq('user_id',user.id).select().single());await syncFutureOccurrences(saved)}else{saved=await check(db.from('recurring_rules').insert(payload).select().single());await syncFutureOccurrences(saved)}closeRecurringModal();await load();notice('Conta recorrente salva.')}catch(e){fail(e)}finally{b.disabled=false}});
async function syncFutureOccurrences(rule){
  const owner=user.id;
  const existingRows=await check(db.from('transactions').select('*').eq('user_id',owner).eq('recurring_rule_id',rule.id));
  const existingByNumber=new Map(existingRows.map(row=>[Number(row.occurrence_number),row]));
  const start=new Date(rule.start_month+'T12:00:00Z');
  const currentMonth=isoToday.slice(0,7)+'-01';
  const maxMonths=rule.recurrence_kind==='installment'?rule.total_installments:Math.max(36,...existingRows.map(row=>Number(row.occurrence_number)||0));
  const validNumbers=new Set();
  for(let i=0;i<maxMonths;i++){
    const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));
    const month=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;
    if(rule.end_month&&month>rule.end_month)break;
    const occurrence=i+1;
    validNumbers.add(occurrence);
    const day=Math.min(rule.day_of_month,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate());
    const date=month.slice(0,8)+String(day).padStart(2,'0');
    const existing=existingByNumber.get(occurrence);
    const values={type:rule.type,description:rule.description,category_id:rule.category_id,amount:rule.amount,transaction_date:date,due_date:date,payment_method:rule.payment_method,notes:rule.notes||'Gerado por conta recorrente'};
    if(existing){
      // Preserve paid entries and the history of earlier months, including moved start dates.
      if(existing.status!=='paid'&&existing.transaction_date>=currentMonth&&month>=currentMonth){
        await check(db.from('transactions').update({...values,updated_at:new Date().toISOString()}).eq('id',existing.id).eq('user_id',owner).neq('status','paid'));
      }
    }else if(rule.active){
      await check(db.from('transactions').insert({...values,user_id:owner,status:'pending',recurring_rule_id:rule.id,occurrence_number:occurrence}));
    }
  }
  // Trim only unpaid future entries outside the new installment count or end month.
  for(const existing of existingRows){
    if(!validNumbers.has(Number(existing.occurrence_number))&&existing.status!=='paid'&&existing.transaction_date>=currentMonth){
      await check(db.from('transactions').delete().eq('id',existing.id).eq('user_id',owner).eq('recurring_rule_id',rule.id).neq('status','paid').gte('transaction_date',currentMonth));
    }
  }
}
$('newRecurringExpense').onclick=()=>openRecurringModal('expense');
$('newRecurringIncome').onclick=()=>openRecurringModal('income');
$('closeRecurringModal').onclick=closeRecurringModal;$('cancelRecurringModal').onclick=closeRecurringModal;$('recType').onchange=recurringCategoryOptions;

function openCashModal(){cashEditing=null;$('cashForm').reset();$('cashActive').value='true';$('cashType').value='reserva';$('cashModalTitle').textContent='Adicionar conta / reserva';$('cashModal').classList.remove('hidden')}
function closeCashModal(){$('cashModal').classList.add('hidden');cashEditing=null}
window.editCash=id=>{const a=cashAccounts.find(x=>x.id===id);if(!a)return;cashEditing=id;$('cashName').value=a.name;$('cashInstitution').value=a.institution||'';$('cashType').value=a.account_type;$('cashBalance').value=a.balance;$('cashActive').value=String(a.active);$('cashNotes').value=a.notes||'';$('cashModalTitle').textContent='Editar conta / reserva';$('cashModal').classList.remove('hidden')};
window.toggleCash=async id=>{try{const a=cashAccounts.find(x=>x.id===id);await check(db.from('cash_accounts').update({active:!a.active,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).select().single());await load();notice(a.active?'Conta desativada.':'Conta ativada.')}catch(e){fail(e)}};
window.deleteCash=async id=>{if(!confirm('Excluir esta conta/reserva?'))return;try{await check(db.from('cash_accounts').delete().eq('id',id).eq('user_id',user.id).select().single());await load();notice('Conta excluída.')}catch(e){fail(e)}};
$('cashForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const payload={user_id:user.id,name:$('cashName').value.trim(),institution:$('cashInstitution').value.trim()||null,account_type:$('cashType').value,balance:Number($('cashBalance').value),active:$('cashActive').value==='true',notes:$('cashNotes').value.trim(),updated_at:new Date().toISOString()};if(!payload.name||payload.balance<0)throw Error('Informe nome e saldo válido.');await check(cashEditing?db.from('cash_accounts').update(payload).eq('id',cashEditing).eq('user_id',user.id).select().single():db.from('cash_accounts').insert(payload).select().single());closeCashModal();await load();notice('Conta/reserva salva.')}catch(e){fail(e)}finally{b.disabled=false}});
$('newCashAccount').onclick=openCashModal;$('closeCashModal').onclick=closeCashModal;$('cancelCashModal').onclick=closeCashModal;

$('forgotBtn').onclick=async()=>{const email=$('email').value.trim().toLowerCase();if(!email){notice('Informe seu e-mail antes de recuperar a senha.');$('email').focus();return}const b=$('forgotBtn');b.disabled=true;try{const redirectTo=APP_URL;const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;notice('Enviamos um link de redefinição para seu e-mail.')}catch(e){fail(e)}finally{b.disabled=false}};
function closeResetModal(){$('resetModal').classList.add('hidden');$('resetForm').reset()}
$('closeResetModal').onclick=closeResetModal;$('cancelResetModal').onclick=closeResetModal;
$('resetForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const p=$('newPassword').value,c=$('confirmPassword').value;if(p.length<8)throw Error('A senha precisa ter pelo menos 8 caracteres.');if(p!==c)throw Error('As senhas não coincidem.');const {error}=await db.auth.updateUser({password:p});if(error)throw error;closeResetModal();notice('Senha alterada com sucesso. Você já pode entrar com a nova senha.')}catch(e){fail(e)}finally{b.disabled=false}});
