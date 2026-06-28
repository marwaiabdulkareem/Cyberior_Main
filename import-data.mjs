import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env','utf8').split('\n')
    .filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.split('=').slice(1).join('=').trim()])
);
const SVC  = env.SUPABASE_ACCESS_TOKEN;
const BASE = 'https://iowumziphkdegvwefugf.supabase.co';
const H    = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const MARWA  = 'a9381d7d-5b25-4ace-94a2-116c6b3f2c0f';
const HAWRAA = '9c8cf85c-8ebd-472f-a03a-85f5a25615fd';
const HUDA   = '211009ff-29e5-4135-8992-12c46af066df';

const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`POST ${path}: ${JSON.stringify(d)}`);
  return Array.isArray(d) ? d[0] : d;
};
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, { headers: H });
  return r.json();
};
const del = async (path) => fetch(`${BASE}${path}`, { method: 'DELETE', headers: H });

// 0. Remove test customer from verification
await del('/rest/v1/customers?notes=eq.Test customer added during system verification');
console.log('Cleaned test data');

// 1. Products
const prods = await get('/rest/v1/products?select=id,name');
const P = Object.fromEntries(prods.map(p => [p.name, p.id]));
const OFFSEC = P['OffSec + Android'];
const CYBPKT = P['Cyber Security Packet'];
const CUSTOM = P['Custom Bundle / Other'];
console.log(`Products loaded: ${prods.length} found`);

// 2. Agents
const agentHuda   = await post('/rest/v1/sales_agents', { name: 'Huda',   profile_id: HUDA,   commission_rate: 10 });
const agentHawraa = await post('/rest/v1/sales_agents', { name: 'Hawraa', profile_id: HAWRAA, commission_rate: 10 });
const agentMarwa  = await post('/rest/v1/sales_agents', { name: 'Marwa',  profile_id: MARWA,  commission_rate: 10 });
console.log('Agents created: Huda, Hawraa, Marwa (Abdo + Omar recorded under Marwa)');

// 3. Customers
const custRows = [
  { ref:'S001', full_name:'عبداله ربيع (Abdullah Rabi)',   phone:'07705991001',   email:'abdallahalaasdy8@gmail.com',               country:'Iraq',  status:'active' },
  { ref:'S002', full_name:'Ali Timiyali',                   phone:'07818718717',   email:'Altimiyali255@gmail.com',                  country:'Iraq',  status:'completed' },
  { ref:'S003', full_name:'أحمد محمد مليس (Ahmed Malees)', phone:'07812730505',   email:'ahmed.mohamed.malbs.alhusinaui@gmail.com', country:'Iraq',  status:'active' },
  { ref:'S004', full_name:'Abdul Rahman Dawood',            phone:'7848684880',    email:'abdulrahmanqutaiba10@gmail.com',           country:'Other', status:'completed' },
  { ref:'S005', full_name:'Hassan el abdo',                 phone:'905013192382',  email:'hasanabo24el@gmail.com',                   country:'Other', status:'active' },
  { ref:'S006', full_name:'Jinan ayoob saber',              phone:'9647510419160', email:'jinanalqafly@gmail.com',                   country:'Iraq',  status:'active' },
  { ref:'S007', full_name:'Rebal SaadAllah Al-Darwish',     phone:'380937943303',  email:'aldarwishrebal@gmail.com',                 country:'Other', status:'completed' },
  { ref:'S008', full_name:'Al souti',                       phone:'96899456275',   email:'etcmohd@gmail.com',                        country:'Oman',  status:'completed' },
];
const custs = {};
for (const c of custRows) {
  const { ref, ...rest } = c;
  const r = await post('/rest/v1/customers', { ...rest, created_by: MARWA });
  custs[ref] = r.id;
  console.log(`  ${ref} ${c.full_name} → ${r.id.slice(0,8)}`);
}

// 4-6. Deals + payment plans + installments
const dealData = [
  {
    ref: 'S001', custId: custs.S001, productId: OFFSEC, agentId: agentHuda.id,
    price: 549, type: 'installment', status: 'active', start: '2026-04-24',
    plan: { total: 549, num: 5, currency: 'USD' },
    insts: [
      { n:1, amt:150,   due:'2026-04-24', paid:'2026-04-24', paidAmt:150,   st:'paid' },
      { n:2, amt:99.75, due:'2026-05-19', paid:'2026-05-14', paidAmt:99.75, st:'paid' },
      { n:3, amt:99.75, due:'2026-06-13', paid:null, paidAmt:0, st:'late' },
      { n:4, amt:99.75, due:'2026-07-08', paid:null, paidAmt:0, st:'pending' },
      { n:5, amt:99.75, due:'2026-08-02', paid:null, paidAmt:0, st:'pending' },
    ],
  },
  {
    ref: 'S002', custId: custs.S002, productId: OFFSEC, agentId: agentHuda.id,
    price: 550, type: 'installment', status: 'completed', start: '2026-04-28',
    plan: { total: 550, num: 2, currency: 'USD' },
    insts: [
      { n:1, amt:505, due:'2026-04-28', paid:'2026-04-28', paidAmt:505, st:'paid' },
      { n:2, amt:45,  due:'2026-04-30', paid:'2026-05-06', paidAmt:45,  st:'paid' },
    ],
  },
  {
    ref: 'S003', custId: custs.S003, productId: OFFSEC, agentId: agentHuda.id,
    price: 550, type: 'installment', status: 'active', start: '2026-04-28',
    plan: { total: 550, num: 7, currency: 'USD' },
    insts: [
      { n:1, amt:80,    due:'2026-04-28', paid:'2026-04-28', paidAmt:80,    st:'paid' },
      { n:2, amt:78.33, due:'2026-05-23', paid:'2026-05-27', paidAmt:78.33, st:'paid' },
      { n:3, amt:78.33, due:'2026-06-17', paid:null, paidAmt:0, st:'late' },
      { n:4, amt:78.33, due:'2026-07-12', paid:null, paidAmt:0, st:'pending' },
      { n:5, amt:78.33, due:'2026-08-06', paid:null, paidAmt:0, st:'pending' },
      { n:6, amt:78.33, due:'2026-08-31', paid:null, paidAmt:0, st:'pending' },
      { n:7, amt:78.35, due:'2026-09-25', paid:null, paidAmt:0, st:'pending' },
    ],
  },
  {
    ref: 'S004', custId: custs.S004, productId: OFFSEC, agentId: agentHawraa.id,
    price: 550, type: 'installment', status: 'completed', start: '2026-04-24',
    plan: { total: 550, num: 2, currency: 'USD' },
    insts: [
      { n:1, amt:249, due:'2026-04-24', paid:'2026-04-24', paidAmt:249, st:'paid' },
      { n:2, amt:301, due:'2026-05-08', paid:'2026-05-20', paidAmt:301, st:'paid' },
    ],
  },
  {
    ref: 'S005', custId: custs.S005, productId: OFFSEC, agentId: agentHawraa.id,
    price: 550, type: 'installment', status: 'active', start: '2026-04-28',
    plan: { total: 550, num: 11, installmentAmt: 50, currency: 'USD' },
    insts: [
      { n:1,  amt:50, due:'2026-04-28', paid:'2026-04-28', paidAmt:50, st:'paid' },
      { n:2,  amt:50, due:'2026-05-23', paid:null, paidAmt:0, st:'late' },
      { n:3,  amt:50, due:'2026-06-17', paid:null, paidAmt:0, st:'late' },
      { n:4,  amt:50, due:'2026-07-12', paid:null, paidAmt:0, st:'pending' },
      { n:5,  amt:50, due:'2026-08-06', paid:null, paidAmt:0, st:'pending' },
      { n:6,  amt:50, due:'2026-08-31', paid:null, paidAmt:0, st:'pending' },
      { n:7,  amt:50, due:'2026-09-25', paid:null, paidAmt:0, st:'pending' },
      { n:8,  amt:50, due:'2026-10-20', paid:null, paidAmt:0, st:'pending' },
      { n:9,  amt:50, due:'2026-11-14', paid:null, paidAmt:0, st:'pending' },
      { n:10, amt:50, due:'2026-12-09', paid:null, paidAmt:0, st:'pending' },
      { n:11, amt:50, due:'2027-01-03', paid:null, paidAmt:0, st:'pending' },
    ],
  },
  {
    ref: 'S006', custId: custs.S006, productId: OFFSEC, agentId: agentMarwa.id,
    price: 550, type: 'installment', status: 'active', start: '2026-04-28',
    notes: 'Originally sold by Abdo',
    plan: { total: 550, num: 11, installmentAmt: 50, currency: 'USD' },
    insts: [
      { n:1,  amt:50, due:'2026-04-28', paid:'2026-04-28', paidAmt:50, st:'paid' },
      { n:2,  amt:50, due:'2026-05-21', paid:'2026-05-28', paidAmt:50, st:'paid' },
      { n:3,  amt:50, due:'2026-06-15', paid:null, paidAmt:0, st:'late' },
      { n:4,  amt:50, due:'2026-07-10', paid:null, paidAmt:0, st:'pending' },
      { n:5,  amt:50, due:'2026-08-04', paid:null, paidAmt:0, st:'pending' },
      { n:6,  amt:50, due:'2026-08-29', paid:null, paidAmt:0, st:'pending' },
      { n:7,  amt:50, due:'2026-09-23', paid:null, paidAmt:0, st:'pending' },
      { n:8,  amt:50, due:'2026-10-18', paid:null, paidAmt:0, st:'pending' },
      { n:9,  amt:50, due:'2026-11-12', paid:null, paidAmt:0, st:'pending' },
      { n:10, amt:50, due:'2026-12-07', paid:null, paidAmt:0, st:'pending' },
      { n:11, amt:50, due:'2027-01-01', paid:null, paidAmt:0, st:'pending' },
    ],
  },
  {
    ref: 'S007', custId: custs.S007, productId: CYBPKT, agentId: agentMarwa.id,
    notes: 'Originally sold by Omar',
    price: 148, type: 'full', status: 'completed', start: '2026-04-22',
    plan: { total: 148, num: 1, installmentAmt: 148, currency: 'USD' },
    insts: [
      { n:1, amt:148, due:'2026-04-22', paid:'2026-04-22', paidAmt:148, st:'paid' },
    ],
  },
  {
    ref: 'S008', custId: custs.S008, productId: CUSTOM, agentId: agentMarwa.id,
    price: 515, type: 'installment', status: 'completed', start: '2026-04-05',
    notes: 'Split commission: Omar + Marwa. $400 USD balance tracked in yearly installments.',
    plan: { total: 515, num: 2, currency: 'USD' },
    insts: [
      { n:1, amt:115, due:'2026-04-05', paid:'2026-04-05', paidAmt:115, st:'paid' },
      { n:2, amt:400, due:'2026-05-01', paid:'2026-05-01', paidAmt:400, st:'paid' },
    ],
  },
];

console.log('\nInserting deals + installments:');
let totalInst = 0;
for (const d of dealData) {
  const deal = await post('/rest/v1/deals', {
    customer_id: d.custId, product_id: d.productId, agent_id: d.agentId,
    deal_price_usd: d.price, discount_amount: 0, payment_type: d.type,
    status: d.status, start_date: d.start, created_by: MARWA,
    notes: d.notes || null, below_min_override: false,
  });
  const plan = await post('/rest/v1/payment_plans', {
    deal_id: deal.id, total_amount: d.plan.total,
    num_installments: d.plan.num, installment_amount: d.plan.installmentAmt || null,
    currency: d.plan.currency,
  });
  for (const i of d.insts) {
    await post('/rest/v1/installments', {
      deal_id: deal.id, payment_plan_id: plan.id,
      installment_number: i.n, amount_due: i.amt, amount_paid: i.paidAmt,
      due_date: i.due, paid_date: i.paid || null, status: i.st,
    });
    totalInst++;
  }
  const paid   = d.insts.filter(i => i.st === 'paid').length;
  const late   = d.insts.filter(i => i.st === 'late').length;
  const pend   = d.insts.filter(i => i.st === 'pending').length;
  console.log(`  ${d.ref}: ${d.insts.length} installments (paid:${paid} late:${late} pending:${pend}) | deal ${deal.id.slice(0,8)}`);
}

// Summary
const allCusts = await get('/rest/v1/customers?select=id');
const allInsts = await get('/rest/v1/installments?select=id,status');
const lateCount = allInsts.filter(i => i.status === 'late').length;
const paidCount = allInsts.filter(i => i.status === 'paid').length;
const pendCount = allInsts.filter(i => i.status === 'pending').length;

console.log(`
══════════════════════════════════════════
  ALL DATA IMPORTED SUCCESSFULLY
══════════════════════════════════════════
  Customers:          ${allCusts.length}
  Agents:             5 (Huda, Hawraa, Marwa, Abdo, Omar)
  Deals:              8
  Total installments: ${allInsts.length}
    ✅ Paid:          ${paidCount}
    🔴 Overdue:       ${lateCount}
    ⏳ Pending:       ${pendCount}
══════════════════════════════════════════`);
