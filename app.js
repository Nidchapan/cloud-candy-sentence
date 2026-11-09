"use strict";
const $=id=>document.getElementById(id);let words=[],game=[],mode='th-en',memory='all',category='all',count='10',deck=[],index=0,active=null,actualDirection='th-en';
const truth=v=>['true','1','yes','y'].includes(String(v??'').trim().toLowerCase());

function parseCSV(src){let rows=[],row=[],cell='',quoted=false;src=src.replace(/^\uFEFF/,'');for(let i=0;i<src.length;i++){const c=src[i];if(c==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(v=>v.trim()))rows.push(row);const headers=(rows.shift()||[]).map(v=>v.trim().toLowerCase().replace(/\s+/g,'_'));return rows.map(vals=>Object.fromEntries(headers.map((h,i)=>[h,(vals[i]||'').trim()])));}

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function makeWords(rows){return rows.filter(w=>truth(w.enabled)&&w.word).flatMap(w=>[1,2,3].filter(i=>w[`example_${i}`]&&w[`example_${i}_th`]).map(i=>({...w,en:w[`example_${i}`],th:w[`example_${i}_th`],knownFlag:truth(w.known)})));}

// Count actual English words, not punctuation, ellipses or symbols.
function englishWordCount(text) {
  return (String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
}

function makeGame(rows) {
  return rows.map(r => ({
    en: String(r.english || r.en || r.english_text || r.source_en || '').trim(),
    th: String(r.thai || r.th || r.thai_text || r.translation_th || '').trim(),
    category: 'Game dialogue', word: '', ipa_us: '', pos: ''
  })).filter(r => englishWordCount(r.en) >= 6 && r.th.length > 0);
}
async function getCSV(url){const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);return parseCSV(await response.text());}
async function load(){const messages=[];try{const rows=await getCSV('./data/vocabulary.csv');words=makeWords(rows);const categories=[...new Set(rows.filter(w=>truth(w.enabled)).map(w=>w.category).filter(Boolean))];for(const c of categories){const opt=document.createElement('option');opt.value=c;opt.textContent=c;$('categoryFilter').append(opt);}messages.push(`${words.length.toLocaleString()} vocabulary sentences`);}catch(e){messages.push('Vocabulary unavailable: '+e.message);}try{game=makeGame(await getCSV('./data/localization_en_th.csv'));messages.push(`${game.length.toLocaleString()} game dialogues`);}catch(e){messages.push('Game CSV not installed');}$('dataStatus').textContent=messages.join(' · ');}
const titles={'th-en':'Thai → English','en-th':'English → Thai','mixed':'Mixed Translation','game':'Game Translation'};

function screen(id){['homeView','setupView','practiceView','finishView'].forEach(x=>$(x).hidden=x!==id);window.scrollTo(0,0);}

function openSetup(m){mode=m;memory='all';category='all';count='10';$('setupTitle').textContent=titles[m];$('setupInfo').textContent=m==='game'?'ใช้บทสนทนาจาก localization_en_th.csv':'สุ่มตัวอย่างประโยคจาก vocabulary.csv ตาม category และ known';$('vocabFilters').hidden=m==='game';$('categoryFilter').value='all';document.querySelectorAll('[data-memory]').forEach(b=>b.classList.toggle('active',b.dataset.memory==='all'));document.querySelectorAll('[data-count]').forEach(b=>b.classList.toggle('active',b.dataset.count==='10'));$('setupError').textContent='';screen('setupView');}

function build(){let source=mode==='game'?game:words.filter(w=>(memory==='all'||(memory==='known'?w.knownFlag:!w.knownFlag))&&(category==='all'||w.category===category));source=shuffle(source);const limit=count==='all'?source.length:Number(count);return source.slice(0,limit);}

function start(){deck=build();if(!deck.length){$('setupError').textContent='ไม่มีโจทย์ในกลุ่มที่เลือก กรุณาเปลี่ยนตัวกรองหรือตรวจสอบไฟล์ CSV';return;}index=0;screen('practiceView');render();}

function render(){if ('speechSynthesis' in window) speechSynthesis.cancel();active=deck[index];actualDirection=mode==='mixed'||mode==='game'?(Math.random()<.5?'th-en':'en-th'):mode;const isThai=actualDirection==='th-en';$('progressLabel').textContent=`${index+1} / ${deck.length}`;$('progressFill').style.width=((index+1)/deck.length*100)+'%';$('categoryChip').textContent=active.category||'Vocabulary';$('memoryChip').textContent=mode==='game'?'🎮 Game':active.knownFlag?'⭐ จำได้':'🌱 ยังจำไม่ได้';$('posChip').textContent=active.pos||'';$('posChip').hidden=!active.pos;$('wordLabel').textContent=mode==='game'?'Game dialogue':active.word;$('ipaLabel').textContent=active.ipa_us||'';$('directionLabel').textContent=isThai?'THAI → ENGLISH':'ENGLISH → THAI';$('promptTitle').textContent=isThai?'แปลประโยคนี้เป็นภาษาอังกฤษ':'แปลประโยคนี้เป็นภาษาไทย';$('promptText').textContent=isThai?active.th:active.en;$('solutionText').textContent=isThai?active.en:active.th;$('solution').hidden=true;$('answer').value='';$('answer').placeholder=isThai?'Write your English sentence here…':'พิมพ์คำแปลภาษาไทยของคุณ…';$('revealBtn').textContent='♡ Reveal answer';$('nextBtn').textContent=index===deck.length-1?'Finish →':'Next →';$('speakBtn').hidden=mode==='game'||!active.word;
  $('promptSpeakBtn').hidden=!(isThai ? active.th : active.en);
  $('solutionSpeakBtn').hidden=!(isThai ? active.en : active.th);}

// Use the device's own TTS voices. No audio requests or recordings are stored.
function speakText(text, language) {
  if (!text || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = language === 'th-TH' ? 0.9 : 0.85;
  const voices = synth.getVoices();
  const match = voices.find(v => v.lang.toLowerCase() === language.toLowerCase() && v.localService)
    || voices.find(v => v.lang.toLowerCase() === language.toLowerCase())
    || voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()) && v.localService);
  if (match) utterance.voice = match;
  synth.speak(utterance);
}
function speakWord() { if (active && mode !== 'game') speakText(active.word, 'en-US'); }
function speakPrompt() {
  if (!active) return;
  speakText(actualDirection === 'th-en' ? active.th : active.en,
            actualDirection === 'th-en' ? 'th-TH' : 'en-US');
}
function speakSolution() {
  if (!active) return;
  speakText(actualDirection === 'th-en' ? active.en : active.th,
            actualDirection === 'th-en' ? 'en-US' : 'th-TH');
}

function next(){if(index+1>=deck.length){$('finishText').textContent=`ฝึกครบ ${deck.length} ประโยคแล้ว ♡ ไม่มีการบันทึกประวัติ`;screen('finishView');return;}index++;render();}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>openSetup(b.dataset.mode)));
document.querySelectorAll('[data-memory]').forEach(b=>b.addEventListener('click',()=>{memory=b.dataset.memory;document.querySelectorAll('[data-memory]').forEach(x=>x.classList.toggle('active',x===b));}));
document.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{count=b.dataset.count;document.querySelectorAll('[data-count]').forEach(x=>x.classList.toggle('active',x===b));}));
$('categoryFilter').addEventListener('change',e=>category=e.target.value);
for(const id of ['homeBrand','setupHome','backHome','finishHome'])$(id).addEventListener('click',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();screen('homeView');});
$('startBtn').addEventListener('click',start);$('restartBtn').addEventListener('click',()=>{deck=shuffle(deck);index=0;render();});$('againBtn').addEventListener('click',()=>{screen('setupView');start();});$('speakBtn').addEventListener('click',speakWord);
$('promptSpeakBtn').addEventListener('click',speakPrompt);
$('solutionSpeakBtn').addEventListener('click',speakSolution);$('revealBtn').addEventListener('click',()=>{$('solution').hidden=!$('solution').hidden;$('revealBtn').textContent=$('solution').hidden?'♡ Reveal answer':'♡ Hide answer';});$('rewriteBtn').addEventListener('click',()=>{$('solution').hidden=true;$('revealBtn').textContent='♡ Reveal answer';$('answer').value='';$('answer').focus();});$('nextBtn').addEventListener('click',next);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));load();
