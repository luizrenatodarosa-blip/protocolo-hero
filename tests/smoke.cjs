'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
assert(m,'script principal não encontrado');

const nodes=new Map();
function node(key){
  if(!nodes.has(key))nodes.set(key,{
    innerHTML:'',style:{},value:'',textContent:'',
    classList:{add(){},remove(){}},
    setAttribute(){},addEventListener(){},remove(){},focus(){},select(){}
  });
  return nodes.get(key);
}
const storage=new Map();
const context={
  console,Date,Math,JSON,Promise,setTimeout,clearTimeout,setInterval,clearInterval,
  localStorage:{
    getItem:k=>storage.has(k)?storage.get(k):null,
    setItem:(k,v)=>storage.set(k,String(v)),
    removeItem:k=>storage.delete(k)
  },
  navigator:{vibrate(){},serviceWorker:null,storage:{persist:async()=>true}},
  location:{protocol:'https:'},
  document:{
    visibilityState:'visible',
    body:node('body'),
    querySelector:s=>node(s),
    querySelectorAll:()=>[],
    addEventListener(){},
    createElement:()=>node('created')
  },
  window:null
};
context.window=context;
context.window.addEventListener=()=>{};
context.window.scrollTo=()=>{};
vm.createContext(context);

const checks=`
const assert=(cond,msg)=>{if(!cond)throw new Error(msg)};

// Migração/shape
assert(Store.d.version==='2.0.0-beta.2','versão V2');
assert(Array.isArray(Store.d.history),'history array');
assert(Array.isArray(Store.d.runs),'runs array');
assert(Array.isArray(Store.d.padel),'padel array');

// 3 treinos x 3 equipamentos: iniciar + navegar sem sair dos limites
for(const w of ['A','B','C'])for(const eq of ['gym','trx','db']){
  Store.d.session=null;
  draft={w,eq,tip:null,energy:'normal',pain:'none',short:false,warmup:false};
  startSession();
  const n=WORKOUTS[w][eq].length;
  assert(Store.d.session.ex.length===n,w+'/'+eq+' exercícios');
  assert(Store.d.session.ex[0].sets.every(x=>Object.prototype.hasOwnProperty.call(x,'kg')),w+'/'+eq+' carga por série');
  for(let i=0;i<n+5;i++)goExercise(1);
  assert(Store.d.session.i===n-1,w+'/'+eq+' limite superior');
  for(let i=0;i<n+5;i++)goExercise(-1);
  assert(Store.d.session.i===0,w+'/'+eq+' limite inferior');
}

// Sessão antiga: reconstrução sem apagar dados úteis
Store.d.session={w:'A',eq:'gym',i:99,ex:[{name:WORKOUTS.A.gym[0].name,kg:'35',sets:[{r:'11',d:1}],rest:90}]};
normalizeSession();
assert(Store.d.session.i===WORKOUTS.A.gym.length-1,'corrige índice legado');
assert(Store.d.session.ex.length===WORKOUTS.A.gym.length,'reconstrói exercícios');
assert(Store.d.session.ex[0].sets[0].kg==='35','migra carga antiga para série');
assert(Store.d.session.ex[0].sets[0].r==='11','preserva reps antigas');

// Cancelar sessão não apaga histórico
Store.d.history=[{id:'keep',w:'A',t:1,ex:[]}];
Store.d.session={w:'A',eq:'gym',i:0,ex:[]};
discardSession();
assert(Store.d.session===null,'sessão cancelada');
assert(Store.d.history.length===1&&Store.d.history[0].id==='keep','histórico preservado');

// Plano dinâmico: adiar/trocar sem perder ao normalizar
Store.d.session=null;
draft={w:'A',eq:'trx',tip:null,energy:'normal',pain:'none',short:false,warmup:false};
startSession();
const first=Store.d.session.plan[0];
deferExercise();
assert(Store.d.session.plan.at(-1)===first,'adiar exercício para o fim');
normalizeSession();
assert(Store.d.session.plan.at(-1)===first,'ordem dinâmica persistida');
const alts=equivalentExercises();
assert(alts.length>0,'equivalentes disponíveis');
replaceCurrent(alts[0].name);
assert(Store.d.session.plan[Store.d.session.i]===alts[0].name,'troca exercício');

// Persistência primária
Store.d.gymName='Academia Teste';
assert(Store.save()===true,'save retorna sucesso');
assert(JSON.parse(localStorage.getItem('hero_v1')).gymName==='Academia Teste','localStorage persistiu');

console.log('HERO V2 smoke tests: OK');
`;
vm.runInContext(m[1]+'\n'+checks,context,{filename:'hero-v2-inline.js'});
