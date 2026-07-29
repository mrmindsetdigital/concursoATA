/* ================= Concurso ATA — App ================= */

const SUBJECT_META = {
  lingua_portuguesa: {icon:'📖', desc:'Interpretação, gramática, ortografia, coesão e reescrita de texto.'},
  matematica: {icon:'🔢', desc:'Aritmética, porcentagem, lógica proposicional, conjuntos e contagem.'},
  informatica: {icon:'💻', desc:'Windows, pacote Office, internet, nuvem e segurança da informação.'},
  atualidades: {icon:'🌎', desc:'Sociedade, política, economia e sustentabilidade.'},
  gestao_pessoas: {icon:'🤝', desc:'Atendimento ao público, comunicação, motivação e trabalho em equipe.'},
  etica: {icon:'⚖️', desc:'Ética, moral, Decreto 1.171/1994 e Comissão de Ética Pública.'},
  administracao_publica: {icon:'🏛️', desc:'Princípios administrativos, poderes, organização e processo administrativo.'},
  regime_juridico: {icon:'📜', desc:'Lei 8.112/1990, regime disciplinar, provimento e improbidade.'},
};

const answerState = {}; // { num: {selected:'a', revealed:true} }
let sidebarOpenSubjects = {};

/* ---------------- Utility ---------------- */
function slugify(s){ return s.toLowerCase(); }
function qs(sel,root){ return (root||document).querySelector(sel); }
function el(tag, attrs, ...kids){
  const e = document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k === 'html') e.innerHTML = attrs[k];
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach(k=>{ if(k==null) return; e.appendChild(k instanceof Node ? k : document.createTextNode(String(k))); });
  return e;
}

/* ---------------- Sidebar ---------------- */
function buildSidebar(){
  const sb = qs('#sidebar');
  sb.innerHTML = '';
  sb.appendChild(el('h4',null,'Matérias'));
  Object.keys(APOSTILA).forEach(slug=>{
    const subj = APOSTILA[slug];
    const meta = SUBJECT_META[slug] || {icon:'📄'};
    const block = el('div',{class:'subject-block'});
    const btn = el('button',{class:'subject-btn', onclick:()=>toggleSubject(slug)},
      el('span',null, meta.icon+' '+subj.title),
      el('span',{class:'car'},'▶')
    );
    btn.id = 'sbtn-'+slug;
    const list = el('div',{class:'topic-list'}); list.id = 'slist-'+slug;
    subj.topics.forEach((t,i)=>{
      const a = el('a',{href:'#/artigo/'+slug+'/'+i}, t.title);
      a.dataset.slug = slug; a.dataset.idx = i;
      list.appendChild(a);
    });
    const qlink = el('a',{class:'qbank-link', href:'#/questoes/'+slug}, '📝 Banco de questões ('+countQuestions(slug)+')');
    block.appendChild(btn); block.appendChild(list); block.appendChild(qlink);
    sb.appendChild(block);
  });
  const simBox = el('div',{class:'sidebar-simulado'},
    el('a',{href:'#/simulado'},'🎯 Simulado de Concurso Público'),
    el('p',null,'Monte uma prova misturando questões de todas as matérias.')
  );
  sb.appendChild(simBox);
}
function toggleSubject(slug, forceOpen){
  const list = qs('#slist-'+slug), btn = qs('#sbtn-'+slug);
  const shouldOpen = forceOpen!==undefined ? forceOpen : !list.classList.contains('open');
  list.classList.toggle('open', shouldOpen);
  btn.classList.toggle('open', shouldOpen);
  sidebarOpenSubjects[slug] = shouldOpen;
}
function countQuestions(slug){ return QUESTOES.filter(q=>q.subject===slug).length; }
function markActiveTopic(slug, idx){
  document.querySelectorAll('.topic-list a').forEach(a=>a.classList.remove('active'));
  const a = document.querySelector('.topic-list a[data-slug="'+slug+'"][data-idx="'+idx+'"]');
  if(a) a.classList.add('active');
}

/* ---------------- Content formatting ---------------- */
function formatContent(blocks){
  if(typeof blocks === 'string'){
    // legacy fallback
    return blocks.split(/\n\n+/).map(p=>'<p>'+escapeHtml(p)+'</p>').join('');
  }
  let html = '';
  let pendingCaption = null;
  let listBuffer = [];
  function flushList(){
    if(listBuffer.length){
      html += '<ul>'+listBuffer.map(li=>'<li>'+escapeHtml(li)+'</li>').join('')+'</ul>';
      listBuffer = [];
    }
  }
  (blocks||[]).forEach(b=>{
    if(b.type === 'tablecap'){
      pendingCaption = b.text;
      return;
    }
    if(b.type === 'table'){
      flushList();
      const rows = b.rows||[];
      let t = '<table>';
      if(pendingCaption){ t += '<caption>'+escapeHtml(pendingCaption)+'</caption>'; pendingCaption=null; }
      rows.forEach((r,ri)=>{
        const tag = ri===0 ? 'th' : 'td';
        t += '<tr>'+r.map(c=>'<'+tag+'>'+escapeHtml(c||'')+'</'+tag+'>').join('')+'</tr>';
      });
      t += '</table>';
      html += t;
      return;
    }
    if(pendingCaption){
      html += '<span class="tbl-label">'+escapeHtml(pendingCaption)+'</span>';
      pendingCaption = null;
    }
    const txt = b.text||'';
    const bulletMatch = /^[•\-\*]\s+(.*)/.exec(txt);
    if(bulletMatch){
      listBuffer.push(bulletMatch[1]);
      return;
    }
    flushList();
    if(b.type === 'h3'){
      const isSubLabel = /^[IVXLC]+\.\s/.test(txt) || (txt.length<70 && /^\d+\.\s/.test(txt) && !/^[A-ZÀ-Ú\s\-]+$/.test(txt));
      html += (isSubLabel ? '<h4>' : '<h3>')+escapeHtml(txt)+(isSubLabel?'</h4>':'</h3>');
    } else {
      html += '<p>'+escapeHtml(txt)+'</p>';
    }
  });
  flushList();
  return html;
}
function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------- Router ---------------- */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', ()=>{ buildSidebar(); route(); setupHighlighter(); setupSearch(); setupMobileMenu(); });

function route(){
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  window.scrollTo(0,0);
  closeMobileSidebar();
  if(parts.length===0){ renderHome(); return; }
  if(parts[0]==='artigo'){ renderArticle(parts[1], parseInt(parts[2]||'0',10)); return; }
  if(parts[0]==='questoes'){ renderQuestionBank(parts[1]); return; }
  if(parts[0]==='simulado'){ renderSimulado(parts[1]); return; }
  renderHome();
}

/* ---------------- Home ---------------- */
function renderHome(){
  const main = qs('#main'); main.className='main';
  main.innerHTML = '';
  const hero = el('div',{class:'home-hero'},
    el('h1',null,'📘 Concurso ATA'),
    el('p',null,'Enciclopédia de estudos criada a partir da sua apostila e do caderno de 500 questões — organizada por matéria, com explicações detalhadas, marca-texto e banco de questões com correção instantânea.'),
    el('a',{class:'btn', href:'#/simulado'},'🎯 Começar um simulado')
  );
  main.appendChild(hero);
  main.appendChild(el('h4',{style:'font-family:Georgia,serif;font-size:20px;margin-bottom:10px;'},'Matérias do edital'));
  const grid = el('div',{class:'home-grid'});
  Object.keys(APOSTILA).forEach(slug=>{
    const subj = APOSTILA[slug];
    const meta = SUBJECT_META[slug]||{icon:'📄',desc:''};
    grid.appendChild(el('a',{class:'home-card', href:'#/artigo/'+slug+'/0'},
      el('h3',null, meta.icon+' '+subj.title),
      el('p',null, meta.desc),
      el('span',{class:'count'}, subj.topics.length+' tópicos · '+countQuestions(slug)+' questões')
    ));
  });
  main.appendChild(grid);
}

/* ---------------- Article ---------------- */
function renderArticle(slug, idx){
  const subj = APOSTILA[slug];
  const main = qs('#main'); main.className='main';
  if(!subj){ main.innerHTML='<p>Matéria não encontrada.</p>'; return; }
  const topic = subj.topics[idx] || subj.topics[0];
  toggleSubject(slug, true);
  markActiveTopic(slug, idx);
  main.innerHTML = '';
  main.appendChild(el('div',{class:'crumbs'},
    el('a',{href:'#/'},'Início'),' › ',
    el('a',{href:'#/artigo/'+slug+'/0'}, subj.title),' › ', topic.title
  ));
  main.appendChild(el('h1',{class:'article-title'}, topic.title));
  main.appendChild(el('div',{class:'article-sub'}, '📄 '+subj.title+' · apostila págs. '+topic.start+'–'+(topic.end-1)));
  main.appendChild(el('div',{class:'hl-hint'},'💡 Selecione um trecho do texto para marcar com o marca-texto (e clique num trecho já marcado para apagar).'));
  const content = el('div',{class:'article-content', html: formatContent(topic.blocks)});
  main.appendChild(content);

  // topic navigation
  const nav = el('div',{style:'display:flex;justify-content:space-between;margin-top:30px;gap:10px;flex-wrap:wrap;'});
  if(idx>0) nav.appendChild(el('a',{class:'btn secondary', href:'#/artigo/'+slug+'/'+(idx-1)},'← '+subj.topics[idx-1].title));
  else nav.appendChild(el('span',null));
  if(idx < subj.topics.length-1) nav.appendChild(el('a',{class:'btn secondary', href:'#/artigo/'+slug+'/'+(idx+1)}, subj.topics[idx+1].title+' →'));
  main.appendChild(nav);

  main.appendChild(el('div',{class:'jump-box'},
    el('div',{class:'jb-text'}, 'Quer treinar? Essa matéria tem ', el('b',null,countQuestions(slug)+' questões'), ' do caderno de exercícios.'),
    el('a',{class:'btn', href:'#/questoes/'+slug}, '📝 Ir para as questões')
  ));
}

/* ---------------- Question rendering (shared) ---------------- */
function renderQuestionCard(q){
  const card = el('div',{class:'qcard', id:'qc-'+q.num});
  card.appendChild(el('div',{class:'qnum'}, (SUBJECT_META[q.subject]?SUBJECT_META[q.subject].icon:'📄')+' Questão '+q.num+' · '+(APOSTILA[q.subject]?APOSTILA[q.subject].title:q.subject)));
  card.appendChild(el('div',{class:'qstem'}, q.stem));
  const optsWrap = el('div',{class:'qopts'});
  ['a','b','c','d','e'].forEach(letter=>{
    if(!q.alts[letter]) return;
    const opt = el('div',{class:'qopt', 'data-letter':letter, onclick:()=>selectAnswer(q.num, letter)},
      el('span',{class:'opt-letter'}, letter.toUpperCase()+')'),
      el('span',null, q.alts[letter])
    );
    optsWrap.appendChild(opt);
  });
  card.appendChild(optsWrap);
  const fb = el('div',{class:'qfeedback', id:'fb-'+q.num});
  card.appendChild(fb);
  const footer = el('div',{class:'qcard-footer'},
    el('button',{class:'undo-btn', id:'undo-'+q.num, onclick:()=>undoAnswer(q.num)},'↺ Desfazer e refazer')
  );
  card.appendChild(footer);
  const st = answerState[q.num];
  if(st && st.revealed) applyAnswerUI(q);
  return card;
}
function selectAnswer(num, letter){
  if(answerState[num] && answerState[num].revealed) return;
  answerState[num] = {selected: letter, revealed: true};
  const q = QUESTOES.find(x=>x.num===num);
  applyAnswerUI(q);
}
function applyAnswerUI(q){
  const st = answerState[q.num];
  const card = qs('#qc-'+q.num);
  if(!card) return;
  card.querySelectorAll('.qopt').forEach(o=>{
    const l = o.dataset.letter;
    o.classList.add('disabled');
    if(l === q.correct) o.classList.add('correct');
    else if(l === st.selected) o.classList.add('wrong');
  });
  const fb = qs('#fb-'+q.num);
  const isCorrect = st.selected === q.correct;
  fb.innerHTML = '';
  fb.appendChild(el('div',{class:'fb-row', style: isCorrect? 'color:var(--good);font-weight:700;' : 'color:var(--bad);font-weight:700;'},
    isCorrect ? '✔ Você acertou!' : '✘ Você errou — a alternativa correta é a '+q.correct.toUpperCase()+'.'
  ));
  if(q.comment){
    fb.appendChild(el('div',{class:'fb-row'}, el('b',{class:'lbl'},'Explicação da resposta'), q.comment));
  }
  fb.appendChild(el('div',{class:'fb-row tip'}, el('b',{class:'lbl'},'⏱ Como resolver rápido na prova'), q.tip));
  fb.classList.add('show');
  const undoBtn = qs('#undo-'+q.num);
  if(undoBtn) undoBtn.classList.add('show');
}
function undoAnswer(num){
  delete answerState[num];
  const card = qs('#qc-'+num);
  if(!card) return;
  card.querySelectorAll('.qopt').forEach(o=>{ o.classList.remove('correct','wrong','disabled'); });
  const fb = qs('#fb-'+num); fb.classList.remove('show'); fb.innerHTML='';
  const undoBtn = qs('#undo-'+num); if(undoBtn) undoBtn.classList.remove('show');
}

/* ---------------- Question bank per subject ---------------- */
let qbFilter = 'all';
function renderQuestionBank(slug){
  const subj = APOSTILA[slug];
  const main = qs('#main'); main.className='main';
  if(!subj){ main.innerHTML='<p>Matéria não encontrada.</p>'; return; }
  const list = QUESTOES.filter(q=>q.subject===slug);
  qbFilter = 'all';
  main.innerHTML='';
  main.appendChild(el('div',{class:'crumbs'}, el('a',{href:'#/'},'Início'),' › ', el('a',{href:'#/artigo/'+slug+'/0'}, subj.title),' › Banco de questões'));
  main.appendChild(el('div',{class:'qb-header'},
    el('h1',{class:'article-title', style:'border:none;margin-bottom:0;'}, '📝 Questões — '+subj.title),
  ));
  main.appendChild(el('div',{class:'article-sub'}, list.length+' questões do caderno de exercícios. Clique numa alternativa para responder — o gabarito e a estratégia de prova aparecem na hora.'));

  const statsBox = el('div',{class:'qb-stats', id:'qbStats'});
  main.appendChild(statsBox);
  const filterbar = el('div',{class:'filterbar'},
    el('button',{class:'active','data-f':'all', onclick:e=>setFilter(e,'all',slug)},'Todas'),
    el('button',{'data-f':'pending', onclick:e=>setFilter(e,'pending',slug)},'Não respondidas'),
    el('button',{'data-f':'correct', onclick:e=>setFilter(e,'correct',slug)},'Acertei'),
    el('button',{'data-f':'wrong', onclick:e=>setFilter(e,'wrong',slug)},'Errei'),
  );
  main.appendChild(filterbar);
  const container = el('div',{id:'qbList'});
  main.appendChild(container);
  renderQBList(slug);
}
function setFilter(e, f, slug){
  qbFilter = f;
  document.querySelectorAll('.filterbar button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  renderQBList(slug);
}
function renderQBList(slug){
  const list = QUESTOES.filter(q=>q.subject===slug);
  const container = qs('#qbList');
  container.innerHTML='';
  let answered=0, correct=0, wrong=0;
  list.forEach(q=>{
    const st = answerState[q.num];
    if(st && st.revealed){ answered++; if(st.selected===q.correct) correct++; else wrong++; }
  });
  const statsBox = qs('#qbStats');
  statsBox.innerHTML='';
  statsBox.appendChild(el('div',{class:'stat-chip'}, el('b',null,answered+'/'+list.length), 'respondidas'));
  statsBox.appendChild(el('div',{class:'stat-chip green'}, el('b',null,correct), 'acertos'));
  statsBox.appendChild(el('div',{class:'stat-chip red'}, el('b',null,wrong), 'erros'));

  let filtered = list;
  if(qbFilter==='pending') filtered = list.filter(q=>!(answerState[q.num]&&answerState[q.num].revealed));
  if(qbFilter==='correct') filtered = list.filter(q=>answerState[q.num]&&answerState[q.num].revealed&&answerState[q.num].selected===q.correct);
  if(qbFilter==='wrong') filtered = list.filter(q=>answerState[q.num]&&answerState[q.num].revealed&&answerState[q.num].selected!==q.correct);
  if(filtered.length===0){ container.appendChild(el('p',{style:'color:var(--muted)'},'Nenhuma questão nesse filtro.')); return; }
  filtered.forEach(q=> container.appendChild(renderQuestionCard(q)));
}

/* ---------------- Simulado (mixed exam) ---------------- */
function renderSimulado(mode){
  const main = qs('#main'); main.className='main';
  main.innerHTML='';
  main.appendChild(el('div',{class:'crumbs'}, el('a',{href:'#/'},'Início'),' › Simulado'));
  main.appendChild(el('h1',{class:'article-title'}, '🎯 Simulado de Concurso Público'));
  main.appendChild(el('div',{class:'article-sub'},'Monte uma prova simulada misturando questões de várias matérias, como cai no concurso de verdade.'));

  const cfg = el('div',{class:'sim-config'});
  cfg.appendChild(el('label',null,'Quantidade de questões'));
  const qtyInput = el('input',{type:'number', min:'5', max:'500', value:'20', id:'simQty'});
  cfg.appendChild(qtyInput);
  cfg.appendChild(el('label',null,'Matérias incluídas'));
  const chkWrap = el('div',null);
  Object.keys(APOSTILA).forEach(slug=>{
    const row = el('div',{class:'chk-row'});
    const chk = el('input',{type:'checkbox', checked:'checked', id:'chk-'+slug});
    row.appendChild(chk);
    row.appendChild(el('label',{for:'chk-'+slug, style:'margin:0;font-weight:400;'}, APOSTILA[slug].title+' ('+countQuestions(slug)+')'));
    chkWrap.appendChild(row);
  });
  cfg.appendChild(chkWrap);
  cfg.appendChild(el('div',{style:'margin-top:18px;'},
    el('button',{class:'btn', onclick:startSimulado},'▶ Gerar simulado')
  ));
  main.appendChild(cfg);
  main.appendChild(el('div',{id:'simResult', style:'margin-top:26px;'}));
}
function startSimulado(){
  const qty = Math.max(1, parseInt(qs('#simQty').value,10)||20);
  const selectedSubjects = Object.keys(APOSTILA).filter(slug=>qs('#chk-'+slug).checked);
  let pool = QUESTOES.filter(q=>selectedSubjects.includes(q.subject));
  // shuffle
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  pool = pool.slice(0, Math.min(qty, pool.length));
  const result = qs('#simResult');
  result.innerHTML='';
  result.appendChild(el('div',{class:'qb-stats', id:'qbStatsSim'}));
  result.appendChild(el('div',{class:'filterbar'}, el('button',{class:'active'},'Sua prova gerada — '+pool.length+' questões')));
  const container = el('div',null);
  pool.forEach(q=> container.appendChild(renderQuestionCard(q)));
  result.appendChild(container);
  refreshSimStats(pool);
  // patch selectAnswer calls to also refresh sim stats: simplest = observe clicks via delegation already re-renders per card manually
  container.addEventListener('click', ()=> setTimeout(()=>refreshSimStats(pool), 30));
}
function refreshSimStats(pool){
  const box = qs('#qbStatsSim'); if(!box) return;
  let answered=0, correct=0, wrong=0;
  pool.forEach(q=>{ const st=answerState[q.num]; if(st&&st.revealed){answered++; if(st.selected===q.correct) correct++; else wrong++;} });
  box.innerHTML='';
  box.appendChild(el('div',{class:'stat-chip'}, el('b',null,answered+'/'+pool.length), 'respondidas'));
  box.appendChild(el('div',{class:'stat-chip green'}, el('b',null,correct), 'acertos'));
  box.appendChild(el('div',{class:'stat-chip red'}, el('b',null,wrong), 'erros'));
}

/* ---------------- Highlighter (marca-texto) ---------------- */
function setupHighlighter(){
  const toolbar = qs('#hlToolbar');
  document.addEventListener('mouseup', (e)=>{
    if(e.target && e.target.closest && e.target.closest('mark')) return; // handled separately
    const sel = window.getSelection();
    if(!sel || sel.isCollapsed || sel.rangeCount===0){ toolbar.style.display='none'; return; }
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const articleEl = (container.nodeType===1?container:container.parentElement)?.closest('.article-content');
    if(!articleEl){ toolbar.style.display='none'; return; }
    const rect = range.getBoundingClientRect();
    if(rect.width===0 && rect.height===0){ toolbar.style.display='none'; return; }
    toolbar.style.display='flex';
    toolbar.style.top = (window.scrollY + rect.top - 42)+'px';
    toolbar.style.left = Math.max(10, window.scrollX + rect.left)+'px';
    toolbar.dataset.pendingRange = '1';
    toolbar._range = range.cloneRange();
  });
  toolbar.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      const color = btn.dataset.c;
      const range = toolbar._range;
      if(range && color !== 'erase'){
        wrapRangeWithMark(range, color);
      }
      toolbar.style.display='none';
      window.getSelection().removeAllRanges();
    });
  });
  document.addEventListener('click', (e)=>{
    const mk = e.target.closest('mark');
    if(mk){
      const parent = mk.parentNode;
      while(mk.firstChild) parent.insertBefore(mk.firstChild, mk);
      parent.removeChild(mk);
      parent.normalize();
    } else if(!e.target.closest('.hl-toolbar')){
      toolbar.style.display='none';
    }
  });
}
function wrapRangeWithMark(range, color){
  try{
    const mark = document.createElement('mark');
    mark.className = color;
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  }catch(err){ /* selection spanning complex nodes - ignore */ }
}

/* ---------------- Search ---------------- */
function setupSearch(){
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  input.addEventListener('input', ()=>{
    const term = input.value.trim().toLowerCase();
    if(term.length < 2){ results.style.display='none'; return; }
    const hits = [];
    Object.keys(APOSTILA).forEach(slug=>{
      APOSTILA[slug].topics.forEach((t,i)=>{
        if(t.title.toLowerCase().includes(term)){
          hits.push({type:'Tópico', label:t.title, sub:APOSTILA[slug].title, href:'#/artigo/'+slug+'/'+i});
        }
      });
    });
    QUESTOES.forEach(q=>{
      if(hits.length>25) return;
      if(q.stem.toLowerCase().includes(term)){
        hits.push({type:'Questão '+q.num, label:q.stem.slice(0,80)+'...', sub:APOSTILA[q.subject]?APOSTILA[q.subject].title:'', href:'#/questoes/'+q.subject});
      }
    });
    results.innerHTML='';
    if(hits.length===0){ results.innerHTML = '<a>Nenhum resultado</a>'; results.style.display='block'; return; }
    hits.slice(0,30).forEach(h=>{
      results.appendChild(el('a',{href:h.href, onclick:()=>{results.style.display='none'; input.value='';}}, h.label, el('span',{class:'sr-tag'}, h.type+' · '+h.sub)));
    });
    results.style.display='block';
  });
  document.addEventListener('click',(e)=>{ if(!e.target.closest('.search-wrap')) results.style.display='none'; });
}

/* ---------------- Mobile menu ---------------- */
function setupMobileMenu(){
  qs('#menuToggle').addEventListener('click', ()=>{
    qs('#sidebar').classList.toggle('mobile-open');
  });
}
function closeMobileSidebar(){
  qs('#sidebar')?.classList.remove('mobile-open');
}
