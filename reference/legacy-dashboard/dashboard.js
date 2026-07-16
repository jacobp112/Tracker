/* ---------- topic data ----------
   Each topic gets a stable id (slug) so saved state survives reordering. */
const TOPICS=[
["Section 1 — Number","Types of Number and BODMAS",2],
["Section 1 — Number","Multiples, Factors and Prime Factors",3],
["Section 1 — Number","LCM and HCF",4],
["Section 1 — Number","Fractions",6],
["Section 1 — Number","Fractions, Decimals and Percentages",9],
["Section 1 — Number","Fractions and Recurring Decimals",10],
["Section 1 — Number","Rounding Numbers",14],
["Section 1 — Number","Estimating",15],
["Section 1 — Number","Bounds",16],
["Section 1 — Number","Standard Form",19],
["Section 2 — Algebra","Algebra Basics",24],
["Section 2 — Algebra","Powers and Roots",25],
["Section 2 — Algebra","Multiplying Out Brackets",27],
["Section 2 — Algebra","Factorising",28],
["Section 2 — Algebra","Manipulating Surds",29],
["Section 2 — Algebra","Solving Equations",32],
["Section 2 — Algebra","Rearranging Formulas",34],
["Section 2 — Algebra","Factorising Quadratics",38],
["Section 2 — Algebra","The Quadratic Formula",40],
["Section 2 — Algebra","Completing the Square",41],
["Section 2 — Algebra","Algebraic Fractions",45],
["Section 2 — Algebra","Sequences",46],
["Section 2 — Algebra","Inequalities",50],
["Section 2 — Algebra","Graphical Inequalities",52],
["Section 2 — Algebra","Iterative Methods",53],
["Section 2 — Algebra","Simultaneous Equations 1",54],
["Section 2 — Algebra","Simultaneous Equations 2",56],
["Section 2 — Algebra","Proof",58],
["Section 2 — Algebra","Functions",60],
["Section 3 — Graphs","Straight Lines and Gradients",64],
["Section 3 — Graphs","y = mx + c",65],
["Section 3 — Graphs","Drawing Straight-Line Graphs",66],
["Section 3 — Graphs","Coordinates and Ratio",68],
["Section 3 — Graphs","Parallel and Perpendicular Lines",69],
["Section 3 — Graphs","Quadratic Graphs",72],
["Section 3 — Graphs","Harder Graphs 1",73],
["Section 3 — Graphs","Harder Graphs 2",74],
["Section 3 — Graphs","Harder Graphs 3",75],
["Section 3 — Graphs","Harder Graphs 4",76],
["Section 3 — Graphs","Solving Equations Using Graphs",77],
["Section 3 — Graphs","Graph Transformations",78],
["Section 3 — Graphs","Real-Life Graphs",82],
["Section 3 — Graphs","Distance-Time Graphs",83],
["Section 3 — Graphs","Velocity-Time Graphs",84],
["Section 3 — Graphs","Gradients of Real-Life Graphs",85],
["Section 4 — Ratio & Proportion","Ratios",89],
["Section 4 — Ratio & Proportion","Direct and Inverse Proportion",94],
["Section 4 — Ratio & Proportion","Percentages",98],
["Section 4 — Ratio & Proportion","Compound Growth and Decay",101],
["Section 4 — Ratio & Proportion","Unit Conversions",104],
["Section 4 — Ratio & Proportion","Speed, Density and Pressure",105],
["Section 5 — Geometry","Geometry",110],
["Section 5 — Geometry","Parallel Lines",111],
["Section 5 — Geometry","Geometry Problems",112],
["Section 5 — Geometry","Polygons",113],
["Section 5 — Geometry","Triangles and Quadrilaterals",114],
["Section 5 — Geometry","Circle Geometry",116],
["Section 5 — Geometry","Congruent Shapes",121],
["Section 5 — Geometry","Similar Shapes",122],
["Section 5 — Geometry","The Four Transformations",123],
["Section 5 — Geometry","Area — Triangles and Quadrilaterals",127],
["Section 5 — Geometry","Area — Circles",128],
["Section 5 — Geometry","3D Shapes — Surface Area",129],
["Section 5 — Geometry","3D Shapes — Volume",130],
["Section 5 — Geometry","More Enlargements and Projections",132],
["Section 5 — Geometry","Triangle Construction",136],
["Section 5 — Geometry","Loci and Construction",137],
["Section 5 — Geometry","Bearings",140],
["Section 6 — Pythagoras & Trig","Pythagoras' Theorem",145],
["Section 6 — Pythagoras & Trig","Trigonometry — Sin, Cos, Tan",146],
["Section 6 — Pythagoras & Trig","Trigonometry — Examples",147],
["Section 6 — Pythagoras & Trig","Trigonometry — Common Values",148],
["Section 6 — Pythagoras & Trig","The Sine and Cosine Rules",151],
["Section 6 — Pythagoras & Trig","3D Pythagoras",153],
["Section 6 — Pythagoras & Trig","3D Trigonometry",154],
["Section 6 — Pythagoras & Trig","Vectors",155],
["Section 7 — Probability & Stats","Probability Basics",160],
["Section 7 — Probability & Stats","Counting Outcomes",161],
["Section 7 — Probability & Stats","Probability Experiments",162],
["Section 7 — Probability & Stats","The AND/OR Rules",166],
["Section 7 — Probability & Stats","Tree Diagrams",167],
["Section 7 — Probability & Stats","Conditional Probability",168],
["Section 7 — Probability & Stats","Sets and Venn Diagrams",169],
["Section 7 — Probability & Stats","Sampling and Data Collection",172],
["Section 7 — Probability & Stats","Mean, Median, Mode and Range",174],
["Section 7 — Probability & Stats","Frequency Tables — Finding Averages",175],
["Section 7 — Probability & Stats","Grouped Frequency Tables",178],
["Section 7 — Probability & Stats","Box Plots",179],
["Section 7 — Probability & Stats","Cumulative Frequency",180],
["Section 7 — Probability & Stats","Histograms and Frequency Density",183],
["Section 7 — Probability & Stats","Scatter Graphs",184],
["Section 7 — Probability & Stats","Other Graphs and Charts",185],
["Section 7 — Probability & Stats","Comparing Data Sets",186]
];
const STATUSES=["Not Started","Learning","Practising","Mastered"];
const REVIEW_DAYS={1:3,2:3,3:6,4:12,5:12}; // legacy — kept for reference

/* ---------- forgetting curve ---------- */
const DECAY_K=8.4;         // baseline calibrated: strength 1 → R=0.7 at ~3 days
const DUE_THRESHOLD=0.7;   // topic is "due" when predicted R drops below this

function topicK(topic){
  return topic.kFactor || DECAY_K;
}

function predictRetention(topic){
  if(!topic.reviewed||topic.status==='Not Started')return null;
  const elapsed=daysBetween(topic.reviewed,todayStr());
  if(elapsed<=0)return 1.0;
  const s=topic.strength||0;
  if(s<=0)return 0.0;
  return Math.exp(-elapsed/(topicK(topic)*s));
}

function topicOCI(topic) {
  const topicTests = state.tests.filter(t => t.topic.toLowerCase() === topic.name.toLowerCase() && t.confidence !== null && t.confidence !== undefined);
  if (!topicTests.length) return 0;
  let sum = 0;
  topicTests.forEach(t => {
    const actualPct = t.outOf ? (t.score / t.outOf) : 0;
    sum += (t.confidence / 5) - actualPct;
  });
  return sum / topicTests.length;
}

function topicHealth(topic) {
  // 1. Retention (30%)
  const R = predictRetention(topic) || 0;
  const retentionScore = R * 100;

  // 2. Error Pressure (25%)
  const activeErrors = state.errors.filter(e => e.topic.toLowerCase() === topic.name.toLowerCase() && e.status === 'active').length;
  let errorScore = 0;
  if (activeErrors === 0) errorScore = 100;
  else if (activeErrors === 1) errorScore = 70;
  else if (activeErrors === 2) errorScore = 40;
  else errorScore = 0;

  // 3. Calibration Accuracy (20%)
  const OCI = topicOCI(topic);
  const topicTests = state.tests.filter(t => t.topic.toLowerCase() === topic.name.toLowerCase() && t.confidence !== null && t.confidence !== undefined);
  const calibrationScore = topicTests.length ? Math.max(0, 100 * (1 - Math.abs(OCI))) : 100;

  // 4. Confidence Fluency (15%)
  const C = topic.conf ? parseInt(topic.conf) : 0;
  const confidenceScore = C ? (C / 5) * 100 : 0;

  // 5. Card Coverage (10%)
  const cardCount = state.cards ? state.cards.filter(c => c.topic.toLowerCase() === topic.name.toLowerCase()).length : 0;
  const cardScore = Math.min(100, cardCount * 20);

  const health = (retentionScore * 0.30) + (errorScore * 0.25) + (calibrationScore * 0.20) + (confidenceScore * 0.15) + (cardScore * 0.10);
  return Math.round(health);
}

function getSectionColor(sectionName) {
  const name = String(sectionName || '').toLowerCase();
  const isDark = document.body.classList.contains('dark-theme');
  if (name.includes('number')) {
    return isDark ? 'hsl(210, 90%, 80%)' : 'hsl(210, 70%, 25%)';
  }
  if (name.includes('algebra')) {
    return isDark ? 'hsl(25, 90%, 78%)' : 'hsl(25, 80%, 30%)';
  }
  if (name.includes('graph')) {
    return isDark ? 'hsl(280, 90%, 82%)' : 'hsl(280, 60%, 30%)';
  }
  if (name.includes('ratio') || name.includes('proportion')) {
    return isDark ? 'hsl(350, 90%, 80%)' : 'hsl(350, 70%, 30%)';
  }
  if (name.includes('geometry')) {
    return isDark ? 'hsl(120, 75%, 78%)' : 'hsl(120, 50%, 25%)';
  }
  if (name.includes('pythagoras') || name.includes('trigonometry')) {
    return isDark ? 'hsl(180, 80%, 78%)' : 'hsl(180, 60%, 25%)';
  }
  if (name.includes('probability') || name.includes('statistics')) {
    return isDark ? 'hsl(45, 90%, 75%)' : 'hsl(45, 80%, 25%)';
  }
  return 'var(--gold)';
}

function getTopicBadgeHtml(t) {
  const totalReviews = (t.reviewHistory || []).length;
  const velocity = totalReviews > 0 ? (t.strength || 0) / totalReviews : 0;

  let badgeHtml = '';
  const isSlowGrowth = totalReviews >= 3 && velocity < 0.5;

  const topicErrors = state.errors.filter(e => e.topic.toLowerCase() === t.name.toLowerCase());
  const topicTests = state.tests.filter(test => test.topic.toLowerCase() === t.name.toLowerCase());
  const lastTestFailed = topicTests.length > 0 && (topicTests[topicTests.length - 1].score / topicTests[topicTests.length - 1].outOf < 0.8);
  const isBoredomZone = String(t.conf) === '5' && totalReviews >= 4 && topicErrors.length === 0 && !lastTestFailed;

  if (isSlowGrowth) {
    badgeHtml += ` <span class="badge-tag slow-growth" title="Slow Growth (Velocity: ${velocity.toFixed(2)}): This topic is not moving despite ${totalReviews} reviews. Consider alternate study methods.">Slow Growth</span>`;
  } else if (isBoredomZone) {
    badgeHtml += ` <span class="badge-tag boredom-zone" title="Boredom Zone: High fluency (5), no errors, and ${totalReviews} reviews. Bjork model suggests removing this from active rotation.">Boredom Zone</span>`;
  }
  const studySignal = getTopicStudySignal(t);
  if(studySignal){
    badgeHtml += ` <span class="badge-tag ${studySignal.cls}" title="${esc(studySignal.detail)}">${esc(studySignal.label)}</span>`;
  }

  // Under-carded badge
  const cardCount = state.cards ? state.cards.filter(c => c.topic.toLowerCase() === t.name.toLowerCase()).length : 0;
  const activeErrors = state.errors.filter(e => e.topic.toLowerCase() === t.name.toLowerCase() && e.status === 'active').length;
  if (activeErrors >= 2 && cardCount === 0) {
    badgeHtml += ` <span class="badge-tag under-carded" title="Under-carded: This topic has 2+ active misconceptions but 0 flashcards. Generate Anki cards during the next session.">Under-carded</span>`;
  }

  // card count glyph
  if (cardCount > 0) {
    badgeHtml += ` <span class="card-count-glyph" title="${cardCount} Anki cards generated">▦ ${cardCount}</span>`;
  }

  // health chip
  const health = topicHealth(t);
  if (t.status === 'Practising' || t.status === 'Mastered') {
    badgeHtml += ` <span class="health-chip h-${health < 40 ? 'low' : (health <= 70 ? 'mid' : 'high')}" title="Health Score: ${health}/100">${health}%</span>`;
  }

  return badgeHtml;
}

function strengthIncrement(conf,source){
  if(source==='test-pass')return 1.5;
  if(source==='test-fail')return 0.15;
  const c=parseInt(conf)||2;
  if(c<=2)return 0.3;
  if(c===3)return 0.6;
  return 1.0; // 4-5
}

function recordReview(topic,conf,source,actualRetention){
  if(!topic.reviewHistory)topic.reviewHistory=[];
  const date=todayStr();

  // Calculate drift if actualRetention is provided and source is test-pass/fail
  if (actualRetention !== undefined && actualRetention !== null && (source === 'test-pass' || source === 'test-fail')) {
    const predicted = predictRetention(topic);
    if (predicted !== null) {
      const drift = actualRetention - predicted;
      if (!topic.driftHistory) topic.driftHistory = [];
      topic.driftHistory.push(drift);
      if (topic.driftHistory.length > 5) topic.driftHistory.shift();

      // Auto-tuning kFactor if we have 3+ drift entries
      if (topic.driftHistory.length >= 3) {
        const sumDrift = topic.driftHistory.reduce((s, d) => s + d, 0);
        const avgDrift = sumDrift / topic.driftHistory.length;
        const oldK = topic.kFactor || DECAY_K;
        let newK = oldK;
        if (avgDrift < -0.10) {
          newK = oldK * 0.90; // decrease kFactor by 10% (faster decay)
        } else if (avgDrift > 0.10) {
          newK = oldK * 1.10; // increase kFactor by 10% (slower decay)
        }
        // Clamp newK between 50% and 200% of DECAY_K (4.2 and 16.8)
        const minK = DECAY_K * 0.5;
        const maxK = DECAY_K * 2.0;
        newK = Math.max(minK, Math.min(maxK, newK));

        if (Math.abs(newK - oldK) > 0.001) {
          topic.kFactor = Math.round(newK * 100) / 100;
          console.info(`kFactor adjusted for "${topic.name}": ${oldK.toFixed(2)} -> ${topic.kFactor.toFixed(2)} (average drift: ${avgDrift.toFixed(3)})`);
        }
      }
    }
  }

  topic.reviewHistory.push({date,confidence:parseInt(conf)||2,source:source||'study'});
  topic.strength=(topic.strength||0)+strengthIncrement(conf,source);
  topic.reviewed=date;
  checkBackupNudge(true);
}

/* slug: stable identity independent of array order */
function slug(section,name){
  return (section.split('—')[0].trim()+'-'+name)
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

/* ---------- state ---------- */
let state={
  topics:[],
  tests:[],
  errors:[],
  cards:[],
  questionResults:[],
  sessions:[],
  prereqGaps:[],
  activeTest:null,
  pendingMarking:[],
  dismissedRecommendations:[]
};
const todayStr=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const daysBetween=(a,b)=>{
  const parseDate=(s)=>{
    const parts=String(s).split('-');
    if(parts.length!==3)return new Date(s).getTime();
    return Date.UTC(parseInt(parts[0],10),parseInt(parts[1],10)-1,parseInt(parts[2],10));
  };
  const t1=parseDate(a);
  const t2=parseDate(b);
  return Math.round((t2-t1)/86400000);
};

const formatStudyTime=(seconds)=>{
  const total=Math.max(0,Math.floor(Number(seconds)||0));
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  if(h)return `${h}h ${String(m).padStart(2,'0')}m`;
  if(m)return `${m}m ${String(s).padStart(2,'0')}s`;
  return `${s}s`;
};

let activeTopicTimerId=null;
let activeTopicTimerStartedAt=0;
let activeTopicTimerTick=null;

function getTopicStudySeconds(topic){
  const base=Number(topic.studySeconds||0);
  if(topic&&activeTopicTimerId===topic.id&&activeTopicTimerStartedAt){
    return base+Math.max(0,(Date.now()-activeTopicTimerStartedAt)/1000);
  }
  return base;
}

function getTopicStudySignal(topic){
  if(!topic)return null;
  const seconds=getTopicStudySeconds(topic);
  const minutes=seconds/60;
  const conf=parseInt(topic.conf,10)||0;
  const reviews=(topic.reviewHistory||[]).length;
  const topicTests=state.tests.filter(t=>t.topic&&t.topic.toLowerCase()===topic.name.toLowerCase());
  const lastTest=topicTests[topicTests.length-1];
  const lastTestFailed=!!(lastTest&&lastTest.outOf&&(lastTest.score/lastTest.outOf)<0.8);

  if(minutes>=45&&conf<=2){
    return {cls:'friction-zone',label:'Friction',detail:'High time with low fluency. Change method: re-teach, worked examples, then retrieval.'};
  }
  if(minutes>=25&&reviews===0){
    return {cls:'needs-retrieval',label:'Needs retrieval',detail:'Time has gone in, but no retrieval review is logged yet.'};
  }
  if(minutes<=12&&conf>=4&&lastTestFailed){
    return {cls:'brittle-fluency',label:'Brittle',detail:'Fast confidence, but the latest test missed the 80% threshold.'};
  }
  if(minutes>=20&&conf>=4&&!lastTestFailed&&topic.status!=='Not Started'){
    return {cls:'ready-test',label:'Ready test',detail:'Good fluency after meaningful time. Validate with a timed question set.'};
  }
  if(minutes>0&&minutes<=10&&conf>=4&&!lastTestFailed){
    return {cls:'efficient',label:'Efficient',detail:'Low time and high fluency. Keep it light unless tests expose weakness.'};
  }
  return null;
}

function getStudyPaceSummary(){
  const studied=state.topics.filter(t=>getTopicStudySeconds(t)>=60&&t.status!=='Not Started');
  if(!studied.length)return 'Start a timer on a topic to build a realistic pacing estimate.';
  const totalSeconds=studied.reduce((sum,t)=>sum+getTopicStudySeconds(t),0);
  const avgSeconds=totalSeconds/studied.length;
  const remaining=state.topics.filter(t=>t.status!=='Mastered').length;
  return `Average active topic time: ${formatStudyTime(avgSeconds)}. Estimated time for ${remaining} unmastered topic${remaining===1?'':'s'}: ${formatStudyTime(avgSeconds*remaining)}.`;
}

function updateVisibleStudyTimers(topic){
  if(!topic)return;
  const seconds=getTopicStudySeconds(topic);
  document.querySelectorAll(`[data-study-time-id="${topic.id}"]`).forEach(el=>{
    el.textContent=formatStudyTime(seconds);
  });
  document.querySelectorAll(`[data-study-state-id="${topic.id}"]`).forEach(el=>{
    el.textContent=activeTopicTimerId===topic.id?'Running':'Total';
  });
}

function stopTopicTimer(commit=true){
  if(!activeTopicTimerId)return 0;
  const topic=state.topics.find(t=>t.id===activeTopicTimerId);
  const elapsed=Math.max(0,(Date.now()-activeTopicTimerStartedAt)/1000);
  if(activeTopicTimerTick){
    clearInterval(activeTopicTimerTick);
    activeTopicTimerTick=null;
  }
  if(commit&&topic){
    topic.studySeconds=Number(topic.studySeconds||0)+elapsed;
    topic.lastStudySeconds=elapsed;
    scheduleAutosave();
    saveTopics();
  }
  activeTopicTimerId=null;
  activeTopicTimerStartedAt=0;
  if(topic){
    updateVisibleStudyTimers(topic);
    updateTrackerRow(topic.id);
    const drawer=document.getElementById('topicDrawer');
    if(drawer&&drawer.classList.contains('open')){
      renderDrawerBody(topic);
    }
  }
  return elapsed;
}

function startTopicTimer(topic){
  if(!topic)return;
  if(activeTopicTimerId===topic.id)return;
  stopTopicTimer(true);
  activeTopicTimerId=topic.id;
  activeTopicTimerStartedAt=Date.now();
  if(topic.status==='Not Started'){
    topic.status='Learning';
  }
  updateTrackerRow(topic.id);
  updateVisibleStudyTimers(topic);
  activeTopicTimerTick=setInterval(()=>updateVisibleStudyTimers(topic),1000);
  scheduleAutosave();
}

function freshTopics(){
  return TOPICS.map((x,i)=>({
    id:slug(x[0],x[1]),i,section:x[0],name:x[1],page:x[2],
    status:"Not Started",conf:"",reviewed:"",note:"",
    strength:0,reviewHistory:[],studySeconds:0,lastStudySeconds:0
  }));
}

/* merge saved state onto current TOPICS by id, so reordering/adding is safe */
function migrateStrength(s){
  // infer strength from confidence for legacy data without strength field
  if(s.strength!==undefined&&s.strength!==null)return s.strength;
  if(!s.reviewed)return 0;
  const c=parseInt(s.conf)||2;
  return ({1:1.0,2:1.3,3:2.0,4:3.5,5:5.0})[c]||1.0;
}
function migrateHistory(s){
  if(Array.isArray(s.reviewHistory)&&s.reviewHistory.length)return s.reviewHistory;
  if(!s.reviewed)return [];
  return [{date:s.reviewed,confidence:parseInt(s.conf)||2,source:'study'}];
}
function migrateStudySeconds(s){
  if(s.studySeconds!==undefined&&s.studySeconds!==null)return Number(s.studySeconds)||0;
  if(s.studyMinutes!==undefined&&s.studyMinutes!==null)return (Number(s.studyMinutes)||0)*60;
  return 0;
}
function mergeTopics(saved){
  const byId={};
  if(Array.isArray(saved))saved.forEach(t=>{if(t&&t.id)byId[t.id]=t;});
  return freshTopics().map(t=>{
    const s=byId[t.id];
    if(!s)return t;
    return {...t,status:s.status||"Not Started",conf:s.conf||"",
      reviewed:s.reviewed||"",note:s.note||"",
      strength:migrateStrength(s),reviewHistory:migrateHistory(s),
      studySeconds:migrateStudySeconds(s),lastStudySeconds:Number(s.lastStudySeconds||0)};
  });
}

let storageOK=true;
/* storage: use localStorage (works when opening the HTML file directly) */
function storageGet(key){
  try{ return localStorage.getItem(key); }catch(e){ return null; }
}
function storageSet(key,val){
  try{ localStorage.setItem(key,val); return true; }catch(e){ return false; }
}
async function loadState(){
  // topics
  let topicsVal = storageGet('phase0:topics');
  if(!topicsVal) topicsVal = storageGet('phase0:topics:prev');
  if(topicsVal){
    try {
      state.topics = mergeTopics(JSON.parse(topicsVal));
    } catch(e) {
      storageSet('phase0:topics:corrupt', topicsVal);
      const prevVal = storageGet('phase0:topics:prev');
      if(prevVal && prevVal !== topicsVal){
        try {
          state.topics = mergeTopics(JSON.parse(prevVal));
        } catch(err) {
          storageSet('phase0:topics:prev:corrupt', prevVal);
          state.topics = freshTopics();
        }
      } else {
        state.topics = freshTopics();
      }
    }
  } else {
    state.topics = freshTopics();
  }

  // tests
  let testsVal = storageGet('phase0:tests');
  if(!testsVal) testsVal = storageGet('phase0:tests:prev');
  if(testsVal){
    try {
      state.tests = JSON.parse(testsVal);
    } catch(e) {
      storageSet('phase0:tests:corrupt', testsVal);
      const prevVal = storageGet('phase0:tests:prev');
      if(prevVal && prevVal !== testsVal){
        try {
          state.tests = JSON.parse(prevVal);
        } catch(err) {
          storageSet('phase0:tests:prev:corrupt', prevVal);
          state.tests = [];
        }
      } else {
        state.tests = [];
      }
    }
  } else {
    state.tests = [];
  }

  // errorlog
  let errorsVal = storageGet('phase0:errorlog');
  if(!errorsVal) errorsVal = storageGet('phase0:errorlog:prev');
  if(errorsVal){
    try {
      state.errors = JSON.parse(errorsVal).map(err => ({
        ...err,
        status: err.status || 'active'
      }));
    } catch(e) {
      storageSet('phase0:errorlog:corrupt', errorsVal);
      const prevVal = storageGet('phase0:errorlog:prev');
      if(prevVal && prevVal !== errorsVal){
        try {
          state.errors = JSON.parse(prevVal).map(err => ({
            ...err,
            status: err.status || 'active'
          }));
        } catch(err) {
          storageSet('phase0:errorlog:prev:corrupt', prevVal);
          state.errors = [];
        }
      } else {
        state.errors = [];
      }
    }
  } else {
    state.errors = [];
  }

  // cards
  let cardsVal = storageGet('phase0:cards');
  if(!cardsVal) cardsVal = storageGet('phase0:cards:prev');
  if(cardsVal){
    try { state.cards = JSON.parse(cardsVal); }
    catch(e) { state.cards = []; }
  } else { state.cards = []; }

  // questionResults
  let qrVal = storageGet('phase0:questionResults');
  if(!qrVal) qrVal = storageGet('phase0:questionResults:prev');
  if(qrVal){
    try { state.questionResults = JSON.parse(qrVal); }
    catch(e) { state.questionResults = []; }
  } else { state.questionResults = []; }

  // sessions
  let sessionsVal = storageGet('phase0:sessions');
  if(!sessionsVal) sessionsVal = storageGet('phase0:sessions:prev');
  if(sessionsVal){
    try { state.sessions = JSON.parse(sessionsVal); }
    catch(e) { state.sessions = []; }
  } else { state.sessions = []; }

  // prereqGaps
  let gapsVal = storageGet('phase0:prereqGaps');
  if(!gapsVal) gapsVal = storageGet('phase0:prereqGaps:prev');
  if(gapsVal){
    try { state.prereqGaps = JSON.parse(gapsVal); }
    catch(e) { state.prereqGaps = []; }
  } else { state.prereqGaps = []; }

  // activeTest
  let activeVal = storageGet('phase0:activeTest');
  if(activeVal){
    try { state.activeTest = JSON.parse(activeVal); }
    catch(e) { state.activeTest = null; }
  } else { state.activeTest = null; }

  // pendingMarking
  let pmVal = storageGet('phase0:pendingMarking');
  if(pmVal){
    try { state.pendingMarking = JSON.parse(pmVal); }
    catch(e) { state.pendingMarking = []; }
  } else { state.pendingMarking = []; }

  // dismissedRecommendations
  let dismissedVal = storageGet('phase0:dismissedRecommendations');
  if(dismissedVal){
    try { state.dismissedRecommendations = JSON.parse(dismissedVal); }
    catch(e) { state.dismissedRecommendations = []; }
  } else { state.dismissedRecommendations = []; }
}
async function saveTopics(){
  try{
    const old=storageGet('phase0:topics');
    if(old)storageSet('phase0:topics:prev',old);
    const ok=storageSet('phase0:topics',JSON.stringify(state.topics));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveTests(){
  try{
    const old=storageGet('phase0:tests');
    if(old)storageSet('phase0:tests:prev',old);
    const ok=storageSet('phase0:tests',JSON.stringify(state.tests));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveErrors(){
  try{
    const old=storageGet('phase0:errorlog');
    if(old)storageSet('phase0:errorlog:prev',old);
    const ok=storageSet('phase0:errorlog',JSON.stringify(state.errors));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveCards(){
  try{
    const old=storageGet('phase0:cards');
    if(old)storageSet('phase0:cards:prev',old);
    const ok=storageSet('phase0:cards',JSON.stringify(state.cards));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveQuestionResults(){
  try{
    const old=storageGet('phase0:questionResults');
    if(old)storageSet('phase0:questionResults:prev',old);
    const ok=storageSet('phase0:questionResults',JSON.stringify(state.questionResults));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveSessions(){
  try{
    const old=storageGet('phase0:sessions');
    if(old)storageSet('phase0:sessions:prev',old);
    const ok=storageSet('phase0:sessions',JSON.stringify(state.sessions));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function savePrereqGaps(){
  try{
    const old=storageGet('phase0:prereqGaps');
    if(old)storageSet('phase0:prereqGaps:prev',old);
    const ok=storageSet('phase0:prereqGaps',JSON.stringify(state.prereqGaps));
    if(!ok)throw new Error('write failed');
    return true;
  }catch(e){storageOK=false;return false;}
}
async function saveActiveTest(){
  let ok=false;
  if(storageOK){
    if(state.activeTest) ok=storageSet('phase0:activeTest',JSON.stringify(state.activeTest));
    else { localStorage.removeItem('phase0:activeTest'); ok=true; }
  }
  return ok;
}

async function savePendingMarking(){
  let ok=false;
  if(storageOK){
    ok=storageSet('phase0:pendingMarking',JSON.stringify(state.pendingMarking || []));
  }
  return ok;
}

async function saveDismissedRecommendations(){
  let ok=false;
  if(storageOK){
    ok=storageSet('phase0:dismissedRecommendations',JSON.stringify(state.dismissedRecommendations || []));
  }
  return ok;
}

/* ---------- autosave: debounced, fires on every state mutation ---------- */
let _autosaveTimer=null;
function scheduleAutosave(){
  clearTimeout(_autosaveTimer);
  _autosaveTimer=setTimeout(async()=>{
    const a=await saveTopics();
    const b=await saveTests();
    const c=await saveErrors();
    const d=await saveCards();
    const e=await saveQuestionResults();
    const f=await saveSessions();
    const g=await savePrereqGaps();
    const h=await saveActiveTest();
    const i=await saveDismissedRecommendations();
    const j=await savePendingMarking();
    if(!a||!b||!c||!d||!e||!f||!g||!h||!i||!j) toast('Autosave failed — try exporting a backup',true);
  },500);
}

/* ---------- derived ---------- */
function getActiveErrors(topicName) {
  return state.errors.filter(e => e.topic.toLowerCase() === topicName.toLowerCase() && e.status === 'active');
}
function hasPersistentMisconception(topicName) {
  return getActiveErrors(topicName).length >= 3;
}

function counts(){
  const c={"Not Started":0,"Learning":0,"Practising":0,"Mastered":0};
  state.topics.forEach(t=>{if(c[t.status]!==undefined)c[t.status]++;});
  return c;
}
function phaseWeek(){
  const d=new Date(), y=2026;
  const w1=new Date(y,4,18),w1e=new Date(y,4,23),
        w2e=new Date(y,4,30),w3e=new Date(y,5,6);
  if(d<w1)return"Phase 0 begins 18 May.";
  if(d<=w1e)return"Week 1 of 3.";
  if(d<=w2e)return"Week 2 of 3.";
  if(d<=w3e)return"Week 3 of 3.";
  return"Phase 0 study window complete.";
}
function nextTopics(n){
  return state.topics.filter(t=>t.status!=="Mastered").slice(0,n);
}
function optimizePermutation(items) {
  if (items.length <= 1) return items;
  
  let bestPerm = null;
  let maxSwitches = -1;
  let bestUrgencyScore = -1;
  
  const itemsWithRank = items.map((item, idx) => ({ item, rank: idx }));
  const temp = [];
  const used = new Array(items.length).fill(false);
  
  function backtrack() {
    if (temp.length === items.length) {
      let switches = 0;
      for (let i = 0; i < temp.length - 1; i++) {
        if (temp[i].item.section !== temp[i+1].item.section) {
          switches++;
        }
      }
      
      let urgencyScore = 0;
      for (let i = 0; i < temp.length; i++) {
        urgencyScore += (temp.length - i) * (temp.length - temp[i].rank);
      }
      
      if (switches > maxSwitches) {
        maxSwitches = switches;
        bestUrgencyScore = urgencyScore;
        bestPerm = temp.map(x => x.item);
      } else if (switches === maxSwitches) {
        if (urgencyScore > bestUrgencyScore) {
          bestUrgencyScore = urgencyScore;
          bestPerm = temp.map(x => x.item);
        }
      }
      return;
    }
    
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      temp.push(itemsWithRank[i]);
      backtrack();
      temp.pop();
      used[i] = false;
    }
  }
  
  backtrack();
  return bestPerm;
}
function dueForReview(){
  const pool = state.topics.filter(t=>{
    if(!t.reviewed||t.status==='Not Started')return false;
    const R=predictRetention(t);
    return R!==null&&R<DUE_THRESHOLD;
  }).map(t=>({
    ...t,
    retention:predictRetention(t),
    ago:daysBetween(t.reviewed,todayStr())
  })).sort((a,b)=>a.retention-b.retention); // lowest retention first

  if (pool.length === 0) return [];

  const limit = 5;
  const selected = [];
  const poolCopy = [...pool];
  let lastSection = null;

  while (selected.length < limit && poolCopy.length > 0) {
    let idx = poolCopy.findIndex(t => t.section !== lastSection);
    if (idx === -1) {
      idx = 0;
    }
    const nextTopic = poolCopy.splice(idx, 1)[0];
    selected.push(nextTopic);
    lastSection = nextTopic.section;
  }

  return optimizePermutation(selected);
}
// calculate streaks from history
function calculateStreaks(){
  const dates=new Set();
  state.topics.forEach(t=>{
    if(t.reviewed)dates.add(t.reviewed);
    if(t.history){
      t.history.forEach(h=>{
        if(h.date)dates.add(h.date);
      });
    }
  });
  state.tests.forEach(t=>{
    if(t.date)dates.add(t.date);
  });
  const sortedDates=Array.from(dates).sort();
  if(!sortedDates.length)return{current:0,best:0};
  let best=0,tempStreak=0,prevDate=null;
  const oneDayMs=86400000;
  function parseLocalDate(dStr){
    const parts=dStr.split('-');
    return new Date(parts[0],parts[1]-1,parts[2]);
  }
  for(let i=0;i<sortedDates.length;i++){
    const curDate=parseLocalDate(sortedDates[i]);
    if(prevDate===null){
      tempStreak=1;
    }else{
      const diffDays=Math.round((curDate-prevDate)/oneDayMs);
      if(diffDays===1){
        tempStreak++;
      }else if(diffDays>1){
        if(tempStreak>best)best=tempStreak;
        tempStreak=1;
      }
    }
    prevDate=curDate;
  }
  if(tempStreak>best)best=tempStreak;
  const today=new Date();today.setHours(0,0,0,0);
  const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
  const yesterdayStr=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  let current=0;
  const lastActiveStr=sortedDates[sortedDates.length-1];
  if(lastActiveStr===todayStr||lastActiveStr===yesterdayStr){
    current=tempStreak;
  }
  return{current,best};
}

/* ---------- render: HOME ---------- */
function renderHome(){
  const c=counts();
  const engaged=c["Learning"]+c["Practising"]+c["Mastered"];
  const total=state.topics.length;
  const pct=total?Math.round(engaged/total*100):0;

  document.getElementById('statusLine').innerHTML=
    `${phaseWeek()} <em>${engaged}</em> of ${total} topics in progress, `+
    `<em>${c["Mastered"]}</em> fully mastered.`;
  // visual momentum tracker
  const todayDate=new Date();
  let mCount=0;
  let streakHtml='<div class="streak-dots-container">';
  const weekdays=['Su','M','Tu','W','Th','F','Sa'];
  for(let d=6;d>=0;d--){
    const dd=new Date(todayDate);dd.setDate(todayDate.getDate()-d);
    const s=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`;
    const active=state.topics.some(t=>t.reviewed===s) || state.tests.some(t=>t.date===s);
    if(active)mCount++;
    const label=weekdays[dd.getDay()];
    streakHtml+=`
      <div class="streak-day">
        <div class="streak-dot ${active?'active':''} ${d===0?'today':''}" title="${s}${active?' (active)':''}"></div>
        <span class="day-lbl">${label}</span>
      </div>`;
  }
  streakHtml+='</div>';
  const streaks=calculateStreaks();
  let streakText='';
  if(streaks.current>0){
    streakText=`Current streak: ${streaks.current} day${streaks.current===1?'':'s'} · Best: ${streaks.best} day${streaks.best===1?'':'s'}`;
  }else if(streaks.best>0){
    streakText=`Best streak: ${streaks.best} day${streaks.best===1?'':'s'}`;
  }else{
    streakText=`No active streak`;
  }
  document.getElementById('momentum').innerHTML=streakHtml+`<span style="margin-left:14px;font-family:'Newsreader';font-style:italic;font-size:15px;color:var(--ink-soft)">${streakText}</span>`;

  // segmented ring: learning + practising + mastered, each its own arc
  const rEl=document.getElementById('ringMastered');
  const r=rEl?parseFloat(rEl.getAttribute('r')):56, circ=2*Math.PI*r;
  function seg(id,count,offsetCount){
    const el=document.getElementById(id);
    if(!el)return;
    const len=total?circ*(count/total):0;
    el.style.strokeDasharray=`${len} ${circ-len}`;
    el.style.strokeDashoffset=total?-circ*(offsetCount/total):0;
  }
  // draw order (outer call last): mastered, then practising, then learning stacked
  seg('ringMastered',c["Mastered"],0);
  seg('ringPractising',c["Practising"],c["Mastered"]);
  seg('ringLearning',c["Learning"],c["Mastered"]+c["Practising"]);
  document.getElementById('ringPct').textContent=pct+"%";
  document.getElementById('sMastered').textContent=c["Mastered"];
  document.getElementById('sPractising').textContent=c["Practising"];
  document.getElementById('sLearning').textContent=c["Learning"];

  // active misconception alert
  const alertWrap=document.getElementById('misconceptionAlertWrap');
  
  // Group active errors by topic
  const activeErrorsByTopic = {};
  state.errors.forEach(e => {
    if (e.status === 'active') {
      activeErrorsByTopic[e.topic] = activeErrorsByTopic[e.topic] || [];
      activeErrorsByTopic[e.topic].push(e);
    }
  });

  const pmTopic = Object.keys(activeErrorsByTopic).find(t => activeErrorsByTopic[t].length >= 3);
  if (pmTopic) {
    const errCount = activeErrorsByTopic[pmTopic].length;
    alertWrap.innerHTML = `<div class="alert-box" style="background:#fdf2f0; border-left:4px solid var(--rose); padding:16px; width:100%;">
      <div class="icon" aria-hidden="true" style="color:var(--rose); font-size:20px;">⚠</div>
      <div class="content" style="flex:1;">
        <div class="title" style="color:var(--rose); font-weight:700;">Persistent Misconception · ${esc(pmTopic)}</div>
        <div style="margin:4px 0 10px; line-height:1.45; font-family:'Newsreader'; font-size:14.5px;">
          You have logged ${errCount} unresolved errors for this topic. Progress is blocked until you complete a forced retrieval session.
        </div>
        <button class="btn" id="startRetrievalBtn" style="padding:6px 14px; font-size:12px; background:var(--rose); color:#fff; border-color:var(--rose); box-shadow:none;">✦ Start Retrieval Session</button>
      </div>
    </div>`;
    
    setTimeout(() => {
      const btn = document.getElementById('startRetrievalBtn');
      if (btn) {
        btn.addEventListener('click', () => {
          openForcedRetrievalModal(pmTopic);
        });
      }
    }, 0);
  } else {
    const recentActiveConcErr = state.errors.slice().reverse().find(e => e.type === 'Conceptual' && e.status === 'active');
    if (recentActiveConcErr) {
      const mmText = (recentActiveConcErr.fix||recentActiveConcErr.mentalModel) ? 
        `<div style="margin-top:6px; font-style:italic; color:var(--muted); font-size:13px; border-top:1px dotted var(--line); padding-top:4px;">🧠 Mental Model: ${esc(recentActiveConcErr.fix||recentActiveConcErr.mentalModel)}</div>` : '';
      
      alertWrap.innerHTML = `<div class="alert-box" style="width:100%;">
        <div class="icon" aria-hidden="true">⚠</div>
        <div class="content" style="flex:1;">
          <div class="title">Active Misconception · ${esc(recentActiveConcErr.topic)}</div>
          <div style="font-family:'Newsreader'; font-size:14.5px;">${esc(recentActiveConcErr.wrong||recentActiveConcErr.note)}</div>
          ${mmText}
        </div>
      </div>`;
    } else {
      alertWrap.innerHTML = '';
    }
  }

  // start block
  const nx=nextTopics(5);
  const sb=document.getElementById('startBlock');

  // check for recommendation
  const today = todayStr();
  const recSession = (state.sessions || []).slice().reverse().find(s => {
    if (!s.nextSessionRecommendation || !s.sessionDate) return false;
    const days = daysBetween(s.sessionDate, today);
    return days >= 0 && days <= 3 && !state.dismissedRecommendations.includes(s.sessionDate);
  });

  if (recSession) {
    const rec = recSession.nextSessionRecommendation;
    const typeLabel = rec.type ? rec.type.toUpperCase() : 'RECOMMENDED';
    const durationStr = rec.estimatedDurationMin ? ` · ${rec.estimatedDurationMin} mins` : '';
    const topicsHtml = (rec.topics || []).map(tName => {
      const tp = findTopicByName(tName);
      if (tp) {
        return `<span class="clickable-topic" data-id="${tp.id}" style="background:rgba(218,159,72,0.12); color:var(--gold); border:1px solid rgba(218,159,72,0.25); padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; cursor:pointer; display:inline-block; margin-right:6px; margin-bottom:6px;">${esc(tName)}</span>`;
      } else {
        return `<span style="background:var(--line); color:var(--muted); padding:2px 8px; border-radius:4px; font-size:12px; display:inline-block; margin-right:6px; margin-bottom:6px;">${esc(tName)}</span>`;
      }
    }).join('');
    
    sb.innerHTML = `
      <div class="tag" style="background:var(--gold); color:var(--paper-warm)">Tutor Recommendation</div>
      <div style="font-family:'Fraunces', Georgia, serif; font-size:18px; font-weight:600; margin-top:10px; color:var(--ink);">${esc(typeLabel)}${durationStr}</div>
      <div style="font-family:'Newsreader'; font-size:14.5px; color:var(--ink-soft); margin:8px 0; line-height:1.4;">
        ${esc(rec.reason)}
      </div>
      ${topicsHtml ? `<div style="margin-top:10px;">${topicsHtml}</div>` : ''}
      <div style="margin-top:14px; border-top:1px solid var(--line); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-family:'Newsreader'; font-size:12px; color:var(--muted)">Recommended on ${esc(recSession.sessionDate)}</span>
        <a href="#" id="dismissRecLink" style="font-family:'Newsreader'; font-size:13px; color:var(--rose); text-decoration:underline; font-weight:600;">Dismiss</a>
      </div>
    `;
    
    // Bind dismiss link
    setTimeout(() => {
      const dismissEl = document.getElementById('dismissRecLink');
      if (dismissEl) {
        dismissEl.addEventListener('click', async (e) => {
          e.preventDefault();
          state.dismissedRecommendations.push(recSession.sessionDate);
          await saveDismissedRecommendations();
          renderHome();
        });
      }
    }, 0);
  } else if(nx.length){
    sb.innerHTML=`<div class="tag">Start here</div>
      <div class="topic clickable-topic" data-id="${nx[0].id}">${esc(nx[0].name)}</div>
      <div class="pageref">CGP page ${nx[0].page} · ${esc(nx[0].section)}</div>
      <div class="start-actions" style="margin-top:14px;display:flex;align-items:center;gap:12px;border-top:1px solid rgba(176,132,51,0.15);padding-top:12px">
        <span style="font-family:'Newsreader';font-size:13.5px;color:var(--ink-soft)">Log review:</span>
        <div class="confidence-dots" data-start-id="${nx[0].id}">
          <button class="conf-dot" data-val="1" title="1: Complete blank / Looked it up">1</button>
          <button class="conf-dot" data-val="2" title="2: Heavy friction / major struggle">2</button>
          <button class="conf-dot" data-val="3" title="3: Reached answer, minor slip or friction">3</button>
          <button class="conf-dot" data-val="4" title="4: Good retrieval, slight hesitation">4</button>
          <button class="conf-dot" data-val="5" title="5: Instant, frictionless retrieval">5</button>
        </div>
      </div>`;
    // Bind click events on the start block dots
    sb.querySelectorAll('.conf-dot').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const topicId = btn.closest('.confidence-dots').dataset.startId;
        const val = parseInt(btn.dataset.val);
        const tp = state.topics.find(x => x.id === topicId);
        if (!tp) return;
        
        const proceed = async () => {
          if (tp.status === 'Not Started') {
            tp.status = 'Learning';
          }
          tp.conf = String(val);
          tp.reviewed = todayStr();
          
          recordReview(tp, val, 'study');
          scheduleAutosave();
          const ok = await saveTopics();
          toast(ok ? `Logged review for "${tp.name}" (confidence ${val})` : 'Could not save — try again', !ok);
          renderHome();
          if (typeof updateTrackerRow === 'function') {
            updateTrackerRow(tp.id);
          } else {
            renderTracker();
          }
        };

        const intercepted = checkMisconceptionIntercept(tp.name, proceed, () => {});
        if (!intercepted) {
          await proceed();
        }
      });
    });
  }else{
    sb.innerHTML=`<div class="tag">Complete</div>
      <div class="topic">Every topic mastered.</div>`;
  }
  const tl=document.getElementById('thenList');
  tl.innerHTML=nx.slice(1).map(t=>
    `<div class="then-item clickable-topic" data-id="${t.id}"><span>${esc(t.name)}</span><span class="pg">p.${t.page}</span></div>`
  ).join('')||'';

  // review
  const rv=dueForReview();
  const rl=document.getElementById('reviewList');
  rl.innerHTML=rv.length?rv.map(t=>{
    const retPct=t.retention!==null?Math.round(t.retention*100):0;
    let tierClass='tier-amber';
    let urgencyLabel='Maintenance';
    if(retPct<30){
      tierClass='tier-deep-rose';
      urgencyLabel='Forgotten';
    }else if(retPct<50){
      tierClass='tier-rose';
      urgencyLabel='Decaying';
    }
    return `<div class="review-item ${tierClass}"><span class="glyph" aria-hidden="true">↺</span>
     <div style="display:flex;flex-direction:column;gap:2px">
       <span class="name clickable-topic" data-id="${t.id}">${esc(t.name)}</span>
       <span class="ago-lbl" style="font-family:'Newsreader';font-style:italic;font-size:12.2px;color:var(--muted)">${t.ago}d ago · ~${retPct}% predicted · <strong class="urgency-tag">${urgencyLabel}</strong></span>
     </div>
     <div class="confidence-dots" data-review-id="${t.id}" style="margin-left:auto;flex-shrink:0">
       <button class="conf-dot" data-val="1" title="1: Complete blank / Looked it up">1</button>
       <button class="conf-dot" data-val="2" title="2: Heavy friction / major struggle">2</button>
       <button class="conf-dot" data-val="3" title="3: Reached answer, minor slip or friction">3</button>
       <button class="conf-dot" data-val="4" title="4: Good retrieval, slight hesitation">4</button>
       <button class="conf-dot" data-val="5" title="5: Instant, frictionless retrieval">5</button>
     </div>
    </div>`;
  }).join(''):`
    <div class="empty-state-card">
      <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke="currentColor" style="color: var(--gold-soft); opacity: 0.8; stroke-width: 1.5; margin-bottom: 8px;">
        <circle cx="32" cy="32" r="22" />
        <path d="M 32 18 L 32 32 L 42 32" stroke="var(--sage)" stroke-width="2" />
        <path d="M 20 20 L 44 44" stroke="var(--sage)" stroke-width="1.5" stroke-dasharray="3,3" />
      </svg>
      <div class="empty-title">All caught up!</div>
      <div class="empty-desc">Every active topic's predicted retention is currently above the 60% threshold.</div>
      <button class="btn empty-cta" onclick="focusLogForm('tab-tracker', 'search')">Review topics tracker →</button>
    </div>
  `;
  rl.querySelectorAll('.conf-dot').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const topicId = btn.closest('.confidence-dots').dataset.reviewId;
      const val = parseInt(btn.dataset.val);
      const tp=state.topics.find(x=>x.id===topicId);
      if(!tp)return;
      
      const proceed = async () => {
        if (tp.status === 'Not Started') {
          tp.status = 'Learning';
        }
        tp.conf = String(val);
        tp.reviewed = todayStr();
        
        recordReview(tp,val,'study');
        scheduleAutosave();
        const ok=await saveTopics();
        toast(ok?`Logged review for "${tp.name}" (confidence ${val})` : 'Could not save — try again',!ok);
        renderHome();
        if (typeof updateTrackerRow === 'function') {
          updateTrackerRow(tp.id);
        } else {
          renderTracker();
        }
      };

      const intercepted = checkMisconceptionIntercept(tp.name, proceed, () => {});
      if (!intercepted) {
        await proceed();
      }
    });
  });

  // section bars
  const secs=[...new Set(state.topics.map(t=>t.section))];
  document.getElementById('sectionBars').innerHTML=secs.map(s=>{
    const ts=state.topics.filter(t=>t.section===s);
    const done=ts.filter(t=>t.status==="Mastered").length;
    const p=ts.length?Math.round(done/ts.length*100):0;
    return `<div class="secbar-row">
      <div class="secbar-top"><span>${esc(s.replace(/Section \d+ — /,''))}</span>
        <span class="v">${done}/${ts.length}</span></div>
      <div class="secbar-track"><div class="secbar-fill" style="width:${p}%"></div></div>
    </div>`;
  }).join('');

  // recent test results
  const homeTests=document.getElementById('homeTestList');
  if(!state.tests.length){
    homeTests.innerHTML = `
      <div class="empty-state-card">
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke="currentColor" style="color: var(--gold-soft); opacity: 0.8; stroke-width: 1.5; margin-bottom: 8px;">
          <rect x="14" y="10" width="36" height="44" rx="3" />
          <line x1="22" y1="20" x2="42" y2="20" />
          <line x1="22" y1="28" x2="34" y2="28" />
          <line x1="22" y1="36" x2="42" y2="36" />
          <path d="M 40 46 L 44 50 L 52 40" stroke="var(--sage)" stroke-width="2" />
        </svg>
        <div class="empty-title">No tests logged yet</div>
        <div class="empty-desc">Validate your topic mastery with timed diagnostic tests.</div>
        <button class="btn empty-cta" onclick="focusLogForm('tab-tests', 'tTopic')">Log your first test →</button>
      </div>
    `;
  }else{
    const lastTests=state.tests.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
    homeTests.innerHTML=lastTests.map(t=>{
      const pc=t.outOf?Math.round(t.score/t.outOf*100):0;
      const pass=pc>=80;
      return `<div class="mini-test">
        <div class="tname" title="${esc(t.topic)}">${esc(t.topic)}</div>
        <div style="display:flex;align-items:center">
          <span class="tscore">${t.score}/${t.outOf}</span>
          <span class="badge ${pass?'pass':'retry'}">${pass?'✓ PASS':'↻ RETRY'}</span>
        </div>
      </div>`;
    }).join('');
  }
}

/* ---------- render: TRACKER ---------- */
function confBucket(conf){
  const n=parseInt(conf);
  if(!n)return'none';
  if(n<=2)return'lo';
  if(n===3)return'mid';
  return'hi';
}
let openNotes={};
let openSections=null;
function saveOpenSections(){
  storageSet('phase0:open_sections', JSON.stringify([...openSections]));
}
function loadOpenSections(){
  const val = storageGet('phase0:open_sections');
  if(val){
    try {
      openSections = new Set(JSON.parse(val));
    } catch(e) {
      openSections = new Set(state.topics.map(t=>t.section));
    }
  } else {
    openSections = new Set(state.topics.map(t=>t.section));
  }
}
function renderTracker(){
  if(openSections===null){
    loadOpenSections();
  }
  const q=document.getElementById('search').value.toLowerCase();
  const fs=document.getElementById('filterStatus').value;
  const fc=document.getElementById('filterConf').value;
  const list=document.getElementById('topicList');
  const filtered=state.topics.filter(t=>
    (!q||t.name.toLowerCase().includes(q))&&
    (!fs||t.status===fs)&&
    (!fc||confBucket(t.conf)===fc));

  document.getElementById('filterCount').textContent=
    `Showing ${filtered.length} of ${state.topics.length} topics`;

  if(!filtered.length){
    list.innerHTML='<div class="empty-note">No topics match these filters.</div>';return;
  }
  let html='';let lastSec='';
  // compute daily waypoint (only shown when no filters are active)
  const noFilters=!q&&!fs&&!fc;
  const wp=noFilters?dailyTarget():null;
  let waypointInserted=false;
  filtered.forEach(t=>{
    // insert waypoint marker just before the target topic
    if(wp&&!waypointInserted&&wp.target>0&&t.i>=wp.target){
      const mastered=state.topics.filter(x=>x.i<wp.target&&x.status==="Mastered").length;
      const diff=mastered-wp.target;
      let cls='',statusMsg='';
      if(diff>=0){cls='ahead';statusMsg=`${mastered}/${wp.target} done — on track ✔`;}
      else{cls='behind';statusMsg=`${mastered}/${wp.target} done — ${Math.abs(diff)} to catch up`;}
      html+=`<div class="waypoint ${cls}" id="tracker-waypoint">
        <div class="wp-body">
          <span class="wp-flag">▸ Target</span>
          <span class="wp-label">${wp.dateLabel}</span>
          <span class="wp-detail">${statusMsg}</span>
        </div>
      </div>`;
      waypointInserted=true;
    }
    if(t.section!==lastSec){
      if(lastSec!=='') html+='</div>'; // close previous sec-content
      const secTopics=state.topics.filter(x=>x.section===t.section);
      const mastered=secTopics.filter(x=>x.status==="Mastered").length;
      const isOpen = !noFilters || openSections.has(t.section);
      html+=`<div class="sec-accordion ${isOpen?'open':''}" data-sec="${esc(t.section)}">
        <span>${esc(t.section)}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="acc-stats">${mastered}/${secTopics.length} mastered</span>
          <span class="acc-icon" aria-hidden="true">▼</span>
        </div>
      </div><div class="sec-content ${isOpen?'open':''}">`;
      lastSec=t.section;
    }
    const hasNote=t.note&&t.note.trim();
    const totalReviews = (t.reviewHistory || []).length;
    const velocity = totalReviews > 0 ? (t.strength || 0) / totalReviews : 0;

    const badgeHtml = getTopicBadgeHtml(t);
    const health = topicHealth(t);
    let borderColor = 'var(--sage)';
    if (health < 40) borderColor = 'var(--rose)';
    else if (health <= 70) borderColor = 'var(--gold-soft)';

    html+=`<div class="topic-row" id="row-${t.id}" style="border-left: 3px solid ${borderColor};">
      <div class="tname clickable-topic" data-id="${t.id}">${esc(t.name)}${badgeHtml}<span class="sec">CGP p.${t.page}</span></div>
      <div class="tpage">${t.page}</div>
      <select data-id="${t.id}" data-f="status" class="s-${t.status.replace(' ','')}" aria-label="Status for ${esc(t.name)}">
        ${STATUSES.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}
      </select>
      <select data-id="${t.id}" data-f="conf" aria-label="Confidence for ${esc(t.name)}">
        <option value="">–</option>
        ${[1,2,3,4,5].map(n=>`<option ${String(n)===String(t.conf)?'selected':''}>${n}</option>`).join('')}
      </select>
      ${t.status!=='Not Started'?(()=>{
        const R=predictRetention(t);
        if(R===null)return '<div class="ret-cell"></div>';
        const pct=Math.round(R*100);
        const cls=pct>=80?'high':pct>=50?'mid':'low';
        return `<div class="ret-cell" title="Predicted retention — review to confirm">
          <div class="ret-bar-track"><div class="ret-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="ret-pct">~${pct}%</span>
        </div>`;
      })():'<div class="ret-cell"></div>'}
      <div class="time-cell" title="Total study time recorded for this topic">
        <span class="time-value" data-study-time-id="${t.id}">${formatStudyTime(getTopicStudySeconds(t))}</span>
      </div>
      <div class="reviewed-cell">
        <input type="date" data-id="${t.id}" data-f="reviewed" value="${t.reviewed||''}"
          aria-label="Last reviewed date for ${esc(t.name)}">
        <button class="quick-review" data-quick-id="${t.id}" title="Reviewed today" aria-label="Reviewed today">↻</button>
        <button class="note-btn ${hasNote?'has-note':''}" data-note-id="${t.id}"
          aria-label="${hasNote?'Edit':'Add'} note for ${esc(t.name)}"
          title="${hasNote?'Edit note':'Add note'}">✎</button>
      </div>
    </div>`;
    if(openNotes[t.id]){
      html+=`<div class="topic-note-row">
        <textarea data-id="${t.id}" data-f="note"
          placeholder="What tripped you up? What to revisit?"
          aria-label="Note for ${esc(t.name)}">${esc(t.note||'')}</textarea>
      </div>`;
    }
  });
  if(lastSec!=='') html+='</div>'; // close final sec-content

  // if target is past all topics (everything should be done)
  if(wp&&!waypointInserted&&wp.target>0){
    const mastered=state.topics.filter(x=>x.status==="Mastered").length;
    const diff=mastered-wp.target;
    let cls='',statusMsg='';
    if(diff>=0){cls='ahead';statusMsg=`${mastered}/${wp.target} done — on track ✔`;}
    else{cls='behind';statusMsg=`${mastered}/${wp.target} done — ${Math.abs(diff)} to catch up`;}
    html+=`<div class="waypoint ${cls}" id="tracker-waypoint">
        <div class="wp-body">
          <span class="wp-flag">▸ Target</span>
          <span class="wp-label">${wp.dateLabel}</span>
          <span class="wp-detail">${statusMsg}</span>
        </div>
      </div>`;
  }
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  while(tempDiv.firstChild){
    fragment.appendChild(tempDiv.firstChild);
  }
  list.replaceChildren(fragment);
}

function updateTrackerRow(id){
  const t=state.topics.find(x=>x.id===id);
  if(!t)return;

  const row=document.getElementById(`row-${id}`);
  if(!row)return;

  // Update left border based on health
  const health = topicHealth(t);
  let borderColor = 'var(--sage)';
  if (health < 40) borderColor = 'var(--rose)';
  else if (health <= 70) borderColor = 'var(--gold-soft)';
  row.style.borderLeft = `3px solid ${borderColor}`;

  // Rebuild topic name and badges
  const tname = row.querySelector('.tname');
  if (tname) {
    const badgeHtml = getTopicBadgeHtml(t);
    tname.innerHTML = `${esc(t.name)}${badgeHtml}<span class="sec">CGP p.${t.page}</span>`;
  }

  // 1. Update Status select
  const statusSel=row.querySelector(`select[data-f="status"]`);
  if(statusSel){
    statusSel.value=t.status;
    statusSel.className=`s-${t.status.replace(' ','')}`;
  }

  // 2. Update Confidence select
  const confSel=row.querySelector(`select[data-f="conf"]`);
  if(confSel){
    confSel.value=t.conf||'';
  }

  // 3. Update Retention cell
  const retCell=row.querySelector('.ret-cell');
  if(retCell){
    if(t.status!=='Not Started'){
      const R=predictRetention(t);
      if(R===null){
        retCell.innerHTML='';
        retCell.removeAttribute('title');
      }else{
        const pct=Math.round(R*100);
        const cls=pct>=80?'high':pct>=50?'mid':'low';
        retCell.setAttribute('title','Predicted retention — review to confirm');
        retCell.innerHTML=`<div class="ret-bar-track"><div class="ret-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="ret-pct">~${pct}%</span>`;
      }
    }else{
      retCell.innerHTML='';
      retCell.removeAttribute('title');
    }
  }

  // 4. Update Study Time cell
  const timeCell=row.querySelector('.time-cell');
  if(timeCell){
    timeCell.innerHTML=`<span class="time-value" data-study-time-id="${t.id}">${formatStudyTime(getTopicStudySeconds(t))}</span>`;
  }

  // 5. Update Reviewed Date input
  const dateInput=row.querySelector(`input[data-f="reviewed"]`);
  if(dateInput){
    dateInput.value=t.reviewed||'';
  }

  // 6. Update note button class
  const hasNote=t.note&&t.note.trim();
  const noteBtn=row.querySelector(`.note-btn[data-note-id="${t.id}"]`);
  if(noteBtn){
    noteBtn.className=`note-btn ${hasNote?'has-note':''}`;
    noteBtn.setAttribute('aria-label',`${hasNote?'Edit':'Add'} note for ${esc(t.name)}`);
    noteBtn.setAttribute('title',hasNote?'Edit note':'Add note');
  }

  // 7. Check filter/search match
  const q=document.getElementById('search').value.toLowerCase();
  const fs=document.getElementById('filterStatus').value;
  const fc=document.getElementById('filterConf').value;

  const matches=(!q||t.name.toLowerCase().includes(q))&&
                (!fs||t.status===fs)&&
                (!fc||confBucket(t.conf)===fc);

  const nextEl=row.nextElementSibling;
  const isNoteRow=nextEl&&nextEl.classList.contains('topic-note-row');

  if(matches){
    row.style.display='';
    if(isNoteRow){
      nextEl.style.display=openNotes[t.id]?'':'none';
    }
  }else{
    row.style.display='none';
    if(isNoteRow){
      nextEl.style.display='none';
    }
  }

  // 8. Update filterCount text
  const filteredCount=state.topics.filter(x=>
    (!q||x.name.toLowerCase().includes(q))&&
    (!fs||x.status===fs)&&
    (!fc||confBucket(x.conf)===fc)
  ).length;
  document.getElementById('filterCount').textContent=
    `Showing ${filteredCount} of ${state.topics.length} topics`;

  // 9. Update section stats
  const acc=Array.from(document.querySelectorAll('.sec-accordion')).find(el=>el.dataset.sec===t.section);
  if(acc){
    const accStats=acc.querySelector('.acc-stats');
    if(accStats){
      const secTopics=state.topics.filter(x=>x.section===t.section);
      const mastered=secTopics.filter(x=>x.status==="Mastered").length;
      accStats.textContent=`${mastered}/${secTopics.length} mastered`;
    }
  }

  // 10. Update daily target waypoint if present
  const wpEl=document.getElementById('tracker-waypoint');
  if(wpEl){
    const wp=dailyTarget();
    if(wp&&wp.target>0){
      const mastered=state.topics.filter(x=>x.i<wp.target&&x.status==="Mastered").length;
      const diff=mastered-wp.target;
      let cls='',statusMsg='';
      if(diff>=0){cls='ahead';statusMsg=`${mastered}/${wp.target} done — on track ✔`;}
      else{cls='behind';statusMsg=`${mastered}/${wp.target} done — ${Math.abs(diff)} to catch up`;}
      wpEl.className=`waypoint ${cls}`;
      const detailEl=wpEl.querySelector('.wp-detail');
      if(detailEl){
        detailEl.textContent=statusMsg;
      }
    }
  }
}

/* event delegation — listeners bound once, in init() */
async function onTrackerChange(el){
  const id=el.dataset.id,f=el.dataset.f;
  if(!id||!f)return;
  const tp=state.topics.find(x=>x.id===id);
  if(!tp)return;
  tp[f]=el.value;
  // auto-stamp reviewed date and initialise strength when status moves up
  if(f==='status'&&el.value!=='Not Started'){
    if(!tp.reviewed) tp.reviewed=todayStr();
    if(!tp.strength) tp.strength=1.0;
    if(!tp.reviewHistory||!tp.reviewHistory.length){
      tp.reviewHistory=[{date:todayStr(),confidence:parseInt(tp.conf)||2,source:'study'}];
    }
  }
  // record review when confidence or reviewed date changes
  if(f==='conf'&&el.value&&tp.status!=='Not Started'){
    recordReview(tp,el.value,'study');
  }
  if(f==='reviewed'&&el.value&&tp.status!=='Not Started'){
    // manual date set — just update, don't double-record
  }
  scheduleAutosave();
  const ok=await saveTopics();
  toast(ok?'Saved':'Could not save — try again',!ok);
  renderHome();
  updateTrackerRow(id);
}

/* ---------- render: TESTS ---------- */
function renderTests(){
  const list=document.getElementById('testList');
  if(!state.tests.length){
    list.innerHTML = `
      <div class="empty-state-card full">
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="currentColor" style="color: var(--gold-soft); opacity: 0.8; stroke-width: 1.5; margin-bottom: 10px;">
          <rect x="14" y="10" width="36" height="44" rx="3" />
          <line x1="22" y1="20" x2="42" y2="20" />
          <line x1="22" y1="28" x2="34" y2="28" />
          <line x1="22" y1="36" x2="42" y2="36" />
          <path d="M 40 46 L 44 50 L 52 40" stroke="var(--sage)" stroke-width="2" />
        </svg>
        <div class="empty-title">Your test ledger is empty</div>
        <div class="empty-desc">Track scores, diagnostic results, and revision progress in one place.</div>
        <button class="btn empty-cta" onclick="focusLogForm(null, 'tTopic')">Log your first test →</button>
      </div>
    `;
    document.getElementById('testAvgStat').textContent='';
    return;
  }
  const avg=Math.round(state.tests.reduce((acc,t)=>acc+(t.score/(t.outOf||1)),0)/state.tests.length*100);
  document.getElementById('testAvgStat').textContent=`Avg score: ${avg}%`;
  list.innerHTML=state.tests.map((t,idx)=>{
    const pc=t.outOf?Math.round(t.score/t.outOf*100):0;
    const pass=pc>=80;
    const confBadge=t.confidence?`<span style="font-size:11px;color:var(--gold);background:rgba(216,185,105,0.12);padding:1px 4px;border-radius:2px;margin-left:6px;font-family:'Fraunces';font-weight:600">Conf: ${t.confidence}</span>`:'';
    return `<div class="test-row" style="grid-template-columns:88px 1fr 120px 86px 78px 34px">
      <span>${esc(t.date)}</span>
      <span>${esc(t.topic)}${confBadge}${t.note?` <em style="color:var(--muted)">— ${esc(t.note)}</em>`:''}</span>
      <span style="font-style:italic;color:var(--muted)">${esc(t.type)}</span>
      <span>${t.score}/${t.outOf} · ${pc}%</span>
      <span class="scorebadge ${pass?'pass':'retry'}">${pass?'✓ PASS':'↻ RETRY'}</span>
      <button class="del" data-test-idx="${idx}" aria-label="Delete this test result"
        title="Delete">✕</button>
    </div>`;
  }).reverse().join('');
  list.querySelectorAll('.del').forEach(b=>{
    b.addEventListener('click',async()=>{
      if(!confirm('Delete this test result?'))return;
      state.tests.splice(+b.dataset.testIdx,1);
      scheduleAutosave();
      const ok=await saveTests();
      toast(ok?'Result deleted':'Could not save — try again',!ok);
      renderTests();
      if(document.getElementById('tab-charts').getAttribute('aria-selected')==='true')loadChartJS(renderCharts);
    });
  });
}

/* ---------- charts ---------- */
let _chartjsLoading = false;
let _chartjsLoaded = false;
let _chartjsCallbacks = [];
function loadChartJS(callback){
  if(window.Chart || _chartjsLoaded){
    _chartjsLoaded = true;
    callback();
    return;
  }
  _chartjsCallbacks.push(callback);
  if(_chartjsLoading) return;
  _chartjsLoading = true;
  const host = document.getElementById('testChartHost');
  if(host) host.innerHTML = '<div class="loading">Loading charts library…</div>';
  const script = document.createElement('script');
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  script.onload = () => {
    _chartjsLoaded = true;
    _chartjsLoading = false;
    _chartjsCallbacks.forEach(cb => cb());
    _chartjsCallbacks = [];
  };
  script.onerror = () => {
    _chartjsLoading = false;
    if(host) host.innerHTML = '<div class="empty-note" style="color:var(--rose)">Failed to load charts. Please check your connection and try again.</div>';
  };
  document.body.appendChild(script);
}

let charts={};
function renderCharts(){
  const c=counts();
  // --- KPIs ---
  document.getElementById('kpiMastery').textContent=`${c["Mastered"]} / ${PHASE0.totalTopics}`;
  document.getElementById('kpiMasterySub').textContent=`${Math.round(c["Mastered"]/PHASE0.totalTopics*100)}% of Phase 0`;
  
  if(state.tests.length){
    const avg=Math.round(state.tests.reduce((acc,t)=>acc+(t.score/(t.outOf||1)),0)/state.tests.length*100);
    document.getElementById('kpiTestAvg').textContent=`${avg}%`;
    document.getElementById('kpiTestSub').textContent=`From ${state.tests.length} logged tests`;
  }else{
    document.getElementById('kpiTestAvg').textContent=`—`;
    document.getElementById('kpiTestSub').textContent=`No tests logged yet`;
  }
  
  const studied=state.topics.filter(t=>t.status!=='Not Started'&&t.reviewed);
  if(studied.length){
    let sumR=0;
    studied.forEach(t=>{const r=predictRetention(t);if(r!==null)sumR+=Math.max(0,Math.min(1,r));});
    document.getElementById('kpiRetention').textContent=`${Math.round(sumR/studied.length*100)}%`;
  }else{
    document.getElementById('kpiRetention').textContent=`—`;
  }

  // --- Charts ---
  const cFont={family:'Newsreader'};
  if(charts.s)charts.s.destroy();
  charts.s=new Chart(document.getElementById('statusChart'),{
    type:'bar',
    data:{labels:['Not Started','Learning','Practising','Mastered'],
      datasets:[{data:[c["Not Started"],c["Learning"],c["Practising"],c["Mastered"]],
      backgroundColor:['#d8cfb8','#d8b969','#5c7152','#b08433'],borderRadius:4}]},
    options:{indexAxis:'y',plugins:{legend:{display:false}},
      scales:{x:{ticks:{font:cFont,color:'#6f6650',precision:0},grid:{color:'rgba(229,221,200,0.4)',drawBorder:false}},
        y:{ticks:{font:cFont,color:'#11203a'},grid:{display:false}}}}
  });
  const secs=[...new Set(state.topics.map(t=>t.section))];
  if(charts.sec)charts.sec.destroy();
  charts.sec=new Chart(document.getElementById('sectionChart'),{
    type:'bar',
    data:{labels:secs.map(s=>s.replace(/Section \d+ — /,'')),
      datasets:[{data:secs.map(s=>{
        const ts=state.topics.filter(t=>t.section===s);
        return ts.length?Math.round(ts.filter(t=>t.status==="Mastered").length/ts.length*100):0;
      }),backgroundColor:'#b08433',borderRadius:4}]},
    options:{plugins:{legend:{display:false}},
      scales:{y:{max:100,ticks:{font:cFont,color:'#6f6650',callback:v=>v+'%'},grid:{color:'rgba(229,221,200,0.4)',drawBorder:false}},
        x:{ticks:{font:{family:'Newsreader',size:10},color:'#11203a'},grid:{display:false}}}}
  });

  // test chart — show empty state instead of a blank axis
  const host=document.getElementById('testChartHost');
  if(charts.t){charts.t.destroy();charts.t=null;}
  if(!state.tests.length){
    host.innerHTML='<div class="empty-note" style="padding:40px 8px;text-align:center">'
      +'No test results yet. Log one in the Test Log tab and it will chart here.</div>';
    return;
  }
  host.innerHTML='<canvas id="testChart" height="200" aria-label="Line chart of test scores over time" role="img"></canvas>';
  const ordered=state.tests.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const td=ordered.map(t=>({x:t.date,y:t.outOf?Math.round(t.score/t.outOf*100):0}));
  charts.t=new Chart(document.getElementById('testChart'),{
    type:'line',
    data:{labels:td.map(d=>d.x),
      datasets:[{data:td.map(d=>d.y),borderColor:'#9e5c4f',
        backgroundColor:'rgba(158,92,79,.12)',fill:true,tension:.4,
        pointBackgroundColor:'#9e5c4f',pointRadius:4,borderWidth:2}]},
    options:{plugins:{legend:{display:false}},
      scales:{y:{max:100,min:0,ticks:{font:cFont,color:'#6f6650',callback:v=>v+'%'},grid:{color:'rgba(229,221,200,0.4)',drawBorder:false}},
        x:{ticks:{font:{family:'Newsreader',size:10},color:'#6f6650'},grid:{display:false}}}}
  });

  // retention chart
  renderRetentionChart(cFont);

  // year heatmap
  renderHeatmap();

  // calibration curve chart
  renderCalibrationChart(cFont);

  // session mix chart
  renderSessionMix();
}

function renderSessionMix() {
  const container = document.getElementById('sessionMixContainer');
  if (!container) return;

  const today = todayStr();
  const recentSessions = (state.sessions || []).filter(s => {
    if (!s.sessionDate) return false;
    const days = daysBetween(s.sessionDate, today);
    return days >= 0 && days <= 30;
  });

  if (recentSessions.length < 5) {
    container.innerHTML = `<div style="font-family:'Newsreader'; font-size:13px; color:var(--muted); text-align:center; padding:20px 0;">Requires 5+ sessions in the last 30 days to compute session mix (current: ${recentSessions.length}).</div>`;
    return;
  }

  const counts = {
    "first-pass": 0,
    "review": 0,
    "drill": 0,
    "re-teach": 0,
    "interleaved": 0,
    "test": 0,
    "diagnostic": 0,
    "mixed": 0
  };

  recentSessions.forEach(s => {
    const t = s.sessionType || 'mixed';
    if (counts[t] !== undefined) counts[t]++;
    else counts['mixed']++;
  });

  const totalCount = recentSessions.length;
  const actualPct = {};
  for (const t in counts) {
    actualPct[t] = (counts[t] / totalCount) * 100;
  }

  const IDEAL_MIX = {
    "first-pass": 30,
    "review": 20,
    "drill": 20,
    "re-teach": 15,
    "interleaved": 15
  };

  let sumDiff = 0;
  const mainFive = ["first-pass", "review", "drill", "re-teach", "interleaved"];
  const mainFiveTotal = mainFive.reduce((sum, type) => sum + counts[type], 0);

  if (mainFiveTotal > 0) {
    mainFive.forEach(type => {
      const actualPctMain = (counts[type] / mainFiveTotal) * 100;
      const idealPctMain = IDEAL_MIX[type];
      sumDiff += Math.abs(actualPctMain - idealPctMain);
    });
  } else {
    sumDiff = 200;
  }

  const imbalance = Math.round(sumDiff / 2);

  let biggestGapType = '';
  let maxGap = -Infinity;
  if (mainFiveTotal > 0) {
    mainFive.forEach(type => {
      const actualPctMain = (counts[type] / mainFiveTotal) * 100;
      const idealPctMain = IDEAL_MIX[type];
      const gap = idealPctMain - actualPctMain;
      if (gap > maxGap) {
        maxGap = gap;
        biggestGapType = type;
      }
    });
  }

  const typeColors = {
    "first-pass": "#5c7152",
    "review": "#9e5c4f",
    "drill": "#b08433",
    "re-teach": "#d8b969",
    "interleaved": "#8fa5c7",
    "test": "#4a607a",
    "diagnostic": "#7d6993",
    "mixed": "#9da58a"
  };

  let barHtml = '<div style="display:flex; width:100%; height:20px; border-radius:4px; overflow:hidden; background:var(--line);">';
  for (const t in counts) {
    const pct = actualPct[t];
    if (pct > 0) {
      const label = t.replace('-', ' ');
      barHtml += `<div style="width:${pct}%; background:${typeColors[t]}; height:100%;" title="${esc(label)}: ${counts[t]} sessions (${Math.round(pct)}%)"></div>`;
    }
  }
  barHtml += '</div>';

  let legendHtml = '<div style="display:flex; flex-wrap:wrap; gap:12px; font-family:\'Newsreader\'; font-size:12px; color:var(--ink-soft); margin-top:4px;">';
  for (const t in counts) {
    const pct = actualPct[t];
    if (pct > 0) {
      const label = t.replace('-', ' ');
      legendHtml += `<div style="display:flex; align-items:center; gap:5px;">
        <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:${typeColors[t]};"></span>
        <span>${esc(label)} (${Math.round(pct)}%)</span>
      </div>`;
    }
  }
  legendHtml += '</div>';

  let warningHtml = '';
  if (imbalance > 60 && biggestGapType) {
    const niceName = biggestGapType.replace('-', ' ');
    warningHtml = `
      <div class="alert-box" style="background:#fdf2f0; border-left:4px solid var(--rose); padding:12px; margin-top:8px; display:flex; align-items:flex-start; gap:10px;">
        <span style="color:var(--rose); font-size:16px;">⚠</span>
        <div style="font-family:'Newsreader'; font-size:13px; line-height:1.4; color:var(--ink-soft);">
          <strong>Session mix is highly skewed (Imbalance: ${imbalance}/100)</strong>. 
          Your study mix is neglecting <em>${niceName}</em>. Consider booking a <em>${niceName}</em> session next to restore balance.
        </div>
      </div>
    `;
  } else {
    warningHtml = `
      <div style="font-family:'Newsreader'; font-size:12.5px; color:var(--muted); font-style:italic; margin-top:6px;">
        Session mix imbalance: ${imbalance}/100 (ideal mix is well-balanced).
      </div>
    `;
  }

  container.innerHTML = `
    ${barHtml}
    ${legendHtml}
    ${warningHtml}
  `;
}

function renderRetentionChart(cFont){
  if(!cFont)cFont={family:'Newsreader'};
  const sel=document.getElementById('retentionTopicSel');
  const curVal=sel.value;
  // populate selector
  const studied=state.topics.filter(t=>t.status!=='Not Started'&&t.reviewed);
  sel.innerHTML='<option value="__all__">All studied topics (average)</option>';
  studied.forEach(t=>{
    sel.innerHTML+=`<option value="${esc(t.id)}"${t.id===curVal?' selected':''}>${esc(t.name)}</option>`;
  });
  if(curVal&&curVal!=='__all__'&&studied.find(t=>t.id===curVal))sel.value=curVal;

  if(charts.ret)charts.ret.destroy();

  if(!studied.length){
    const canvas=document.getElementById('retentionChart');
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  // build data: plot retention curve for past 30 days + 7 days future
  const selected=sel.value;
  const targets=selected==='__all__'?studied:studied.filter(t=>t.id===selected);
  if(!targets.length)return;

  const today=new Date();today.setHours(0,0,0,0);
  const daysBack=30,daysFwd=7;
  const labels=[],dataPoints=[];

  for(let d=-daysBack;d<=daysFwd;d++){
    const dt=new Date(today);dt.setDate(today.getDate()+d);
    const ds=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    labels.push(d===0?'Today':d>0?'+'+d+'d':d+'d');
    // compute average retention at this date
    let sum=0,count=0;
    targets.forEach(t=>{
      // reconstruct strength at this date from reviewHistory
      let str=0;
      const history=(t.reviewHistory||[]).slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
      let lastRev=null;
      history.forEach(h=>{
        if(new Date(h.date)<=dt){
          str+=strengthIncrement(h.confidence,h.source);
          lastRev=h.date;
        }
      });
      if(!lastRev||t.status==='Not Started')return;
      const elapsed=Math.round((dt-new Date(lastRev))/86400000);
      if(elapsed<0)return;
      const R=elapsed===0?1.0:Math.exp(-elapsed/((t.kFactor||DECAY_K)*(str||1)));
      sum+=Math.max(0,Math.min(1,R));
      count++;
    });
    dataPoints.push(count?Math.round(sum/count*100):null);
  }

  charts.ret=new Chart(document.getElementById('retentionChart'),{
    type:'line',
    data:{labels,
      datasets:[
        {data:dataPoints,borderColor:'var(--gold-bright)',backgroundColor:'rgba(176,132,51,.08)',
          fill:true,tension:.4,pointRadius:0,borderWidth:2},
        {data:labels.map(()=>DUE_THRESHOLD*100),borderColor:'var(--rose)',
          borderDash:[6,4],borderWidth:1,pointRadius:0,fill:false}
      ]},
    options:{plugins:{legend:{display:false}},
      scales:{
        y:{min:0,max:100,ticks:{font:cFont,color:'#6f6650',callback:v=>v+'%'},grid:{color:'rgba(229,221,200,0.4)',drawBorder:false}},
        x:{ticks:{font:{family:'Newsreader',size:9},color:'#6f6650',maxTicksLimit:12},grid:{display:false}}
      }}
  });
}

// re-render retention chart when topic selector changes
document.getElementById('retentionTopicSel').addEventListener('change',()=>loadChartJS(renderRetentionChart));

/* ---------- year heatmap ---------- */
function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  if (!container) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  
  // Align to Sunday 52 weeks ago (364 days ago)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);
  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);

  // Aggregate activity
  const activity = {};
  state.topics.forEach(t => {
    if (t.reviewHistory) {
      t.reviewHistory.forEach(h => {
        if (h.date) {
          activity[h.date] = (activity[h.date] || 0) + 1;
        }
      });
    }
  });
  state.tests.forEach(t => {
    if (t.date) {
      activity[t.date] = (activity[t.date] || 0) + 1;
    }
  });

  const boxSize = 10;
  const boxGap = 3;
  const leftPad = 32;
  const topPad = 22;

  let svg = `<svg viewBox="0 0 725 125" width="100%" height="125" style="display:block; overflow:visible; font-family:'Newsreader', Georgia, serif; font-size:10px; fill:var(--muted)">`;

  // Draw day of week labels
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days.forEach((day, i) => {
    if (i === 1 || i === 3 || i === 5) {
      svg += `<text x="5" y="${topPad + i * (boxSize + boxGap) + 8}">${day}</text>`;
    }
  });

  let currentMonthName = '';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Draw columns (weeks)
  const tempDate = new Date(startDate);
  for (let w = 0; w < 53; w++) {
    const weekStartMonth = tempDate.getMonth();
    const weekStartMonthName = monthNames[weekStartMonth];
    
    if (weekStartMonthName !== currentMonthName) {
      svg += `<text x="${leftPad + w * (boxSize + boxGap)}" y="12" style="font-family:'Fraunces', serif; font-weight:600; font-size:10px; fill:var(--gold)">${weekStartMonthName}</text>`;
      currentMonthName = weekStartMonthName;
    }

    for (let d = 0; d < 7; d++) {
      const dateStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
      const count = activity[dateStr] || 0;
      
      let fillColor = '#f1ebd9'; // Level 0
      if (count >= 5) fillColor = '#384731'; // Level 4+
      else if (count >= 3) fillColor = '#5c7152'; // Level 3
      else if (count === 2) fillColor = '#86a374'; // Level 2
      else if (count === 1) fillColor = '#b7cca7'; // Level 1

      const isFuture = tempDate > today;
      const opacity = isFuture ? '0.18' : '1.0';

      const x = leftPad + w * (boxSize + boxGap);
      const y = topPad + d * (boxSize + boxGap);
      const formattedDate = tempDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const tooltip = `${count} review${count === 1 ? '' : 's'} on ${formattedDate}`;

      svg += `<rect x="${x}" y="${y}" width="${boxSize}" height="${boxSize}" rx="2" ry="2" 
        fill="${fillColor}" opacity="${opacity}" class="heatmap-box" data-tooltip="${tooltip}">
        <title>${tooltip}</title>
      </rect>`;

      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  // Draw Legend
  const legendX = 725 - 120;
  const legendY = topPad + 7 * (boxSize + boxGap) + 12;
  svg += `<g transform="translate(${legendX}, ${legendY})">
    <text x="-28" y="9" style="font-size:9px; fill:var(--muted)">Less</text>
    <rect x="0" y="0" width="10" height="10" rx="1.5" ry="1.5" fill="#f1ebd9"></rect>
    <rect x="13" y="0" width="10" height="10" rx="1.5" ry="1.5" fill="#b7cca7"></rect>
    <rect x="26" y="0" width="10" height="10" rx="1.5" ry="1.5" fill="#86a374"></rect>
    <rect x="39" y="0" width="10" height="10" rx="1.5" ry="1.5" fill="#5c7152"></rect>
    <rect x="52" y="0" width="10" height="10" rx="1.5" ry="1.5" fill="#384731"></rect>
    <text x="66" y="9" style="font-size:9px; fill:var(--muted)">More</text>
  </g>`;

  svg += `</svg>`;
  container.innerHTML = svg;
}

/* ---------- timeline: pace projection ---------- */
/* Phase 0 plan: 93 topics, study window 18 May - 6 Jun 2026 (Mon-Sat, 3 weeks).
   Week 1 topics 1-29, Week 2 30-64, Week 3 65-93. Checkpoint date 6 Jun 2026. */
const PHASE0={
  start:new Date(2026,4,18),
  checkpoint:new Date(2026,5,6),
  totalTopics:93,
  weeks:[
    {name:"Week 1",start:new Date(2026,4,18),end:new Date(2026,4,23),from:0,to:29},
    {name:"Week 2",start:new Date(2026,4,25),end:new Date(2026,4,30),from:29,to:64},
    {name:"Week 3",start:new Date(2026,5,1),end:new Date(2026,5,6),from:64,to:93}
  ]
};

/* ---------- daily waypoint: which topic index you should reach by end of today ---------- */
function dailyTarget(){
  const today=new Date();today.setHours(0,0,0,0);
  // before the study window
  if(today<PHASE0.start) return {target:0,label:'Phase 0 hasn\u2019t started yet',dateLabel:''};
  // after the study window
  if(today>PHASE0.checkpoint) return {target:PHASE0.totalTopics,label:'Phase 0 window is over',dateLabel:''};

  for(const w of PHASE0.weeks){
    const ws=new Date(w.start);ws.setHours(0,0,0,0);
    const we=new Date(w.end);we.setHours(0,0,0,0);
    if(today>=ws && today<=we){
      // count study days (Mon-Sat = 1-6, Sun=0 is rest)
      const studyDays=[];
      for(let d=new Date(ws);d<=we;d.setDate(d.getDate()+1)){
        if(d.getDay()!==0) studyDays.push(new Date(d));
      }
      const totalDays=studyDays.length;
      const topicsInWeek=w.to-w.from;
      // which study day is today? (0-based, or -1 if Sunday)
      const todayDay=today.getDay();
      if(todayDay===0){
        // Sunday: use Saturday's target (end of last study day)
        const prevSat=studyDays.filter(sd=>sd<=today);
        const idx=prevSat.length;
        const target=w.from+Math.round(topicsInWeek*(idx/totalDays));
        return {target,label:`Rest day — ${w.name} target holds at topic ${target}`,
          dateLabel:today.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})};
      }
      const dayIdx=studyDays.findIndex(sd=>sd.getTime()===today.getTime());
      const target=w.from+Math.round(topicsInWeek*((dayIdx+1)/totalDays));
      const dayLabel=today.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
      return {target,label:`${w.name} · reach topic ${target} by end of today`,dateLabel:dayLabel};
    }
    // between weeks (Sunday gap)
    if(today>we){
      const nextWeek=PHASE0.weeks[PHASE0.weeks.indexOf(w)+1];
      if(nextWeek){
        const ns=new Date(nextWeek.start);ns.setHours(0,0,0,0);
        if(today<ns){
          return {target:w.to,label:`Rest day — ${w.name} complete, ${nextWeek.name} starts ${ns.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}`,
            dateLabel:today.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})};
        }
      }
    }
  }
  return {target:0,label:'',dateLabel:''};
}
function fmtDate(d){
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function projection(){
  const today=new Date();today.setHours(0,0,0,0);
  const c=counts();
  const done=c["Mastered"];
  // earliest review date among studied topics = de facto start of real work
  const dates=state.topics.filter(t=>t.reviewed).map(t=>new Date(t.reviewed));
  const realStart=dates.length?new Date(Math.min(...dates)):null;
  // days elapsed since real start (min 1)
  let elapsed=realStart?Math.max(1,Math.round((today-realStart)/86400000)+1):0;
  // pace = mastered per elapsed day; if not started, fall back to plan pace
  const planPace=PHASE0.totalTopics/19; // 19 study days across 3 weeks
  const pace=(done>0&&elapsed>0)?done/elapsed:0;
  const remaining=PHASE0.totalTopics-done;
  // projected days to finish at current pace
  let projFinish=null,daysNeeded=null;
  if(pace>0){
    daysNeeded=Math.ceil(remaining/pace);
    projFinish=new Date(today);projFinish.setDate(today.getDate()+daysNeeded);
  }
  // where you "should" be today vs plan
  let expected=0;
  if(today>=PHASE0.start){
    const totalSpan=(PHASE0.checkpoint-PHASE0.start)/86400000;
    const gone=Math.min(totalSpan,(today-PHASE0.start)/86400000);
    expected=Math.round(gone/totalSpan*PHASE0.totalTopics);
  }
  return {done,elapsed,pace,planPace,remaining,projFinish,daysNeeded,expected,realStart};
}

let paceChart=null;

function renderTimeline(){
  const p = projection();
  const timelineEl = document.getElementById('timeline');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cp = PHASE0.checkpoint;

  let cls = '';
  let msg = '';
  let subtext = '';
  
  const daysLeft = Math.max(1, Math.round((cp - today) / 86400000));
  const requiredPaceVal = Math.max(0, p.remaining / daysLeft);

  if (p.done === 0) {
    msg = 'No topics mastered yet. Once you start marking topics Mastered, this projects your real finish date.';
  } else {
    if (p.projFinish <= cp) {
      const slack = Math.round((cp - p.projFinish) / 86400000);
      cls = 'ahead';
      msg = `On this pace you finish all 93 topics around ${fmtDate(p.projFinish)} — about ${slack} day${slack === 1 ? '' : 's'} ahead of the 6 Jun checkpoint.`;
      subtext = 'Hold the rhythm.';
    } else {
      const over = Math.round((p.projFinish - cp) / 86400000);
      cls = 'behind';
      msg = `On this pace you finish around ${fmtDate(p.projFinish)} — roughly ${over} day${over === 1 ? '' : 's'} past the 6 Jun checkpoint.`;
      const diff = (requiredPaceVal - p.pace).toFixed(1);
      subtext = `Lift daily pace by ${diff} to catch up.`;
    }
  }

  const paceStr = p.pace > 0 ? p.pace.toFixed(1) : '—';
  const requiredStr = requiredPaceVal.toFixed(1);

  const roadmapHtml = PHASE0.weeks.map(w => {
    const inWeek = state.topics.slice(w.from, w.to);
    const m = inWeek.filter(t => t.status === "Mastered").length;
    const pct = Math.round(m / inWeek.length * 100);
    const isDone = today > w.end && pct >= 100;
    const isCurrent = today >= w.start && today <= w.end;
    const statusClass = isDone ? 'done' : isCurrent ? 'active' : 'upcoming';
    
    return `<div class="tl-node ${statusClass}">
      <div class="tl-node-content">
        <div class="tl-node-title">
          ${w.name}
          ${isCurrent ? `<span class="tl-badge-today">Today</span>` : ''}
        </div>
        <div class="tl-node-date">${w.start.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})} – ${w.end.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</div>
        <div class="tl-node-desc">
          ${m}/${inWeek.length} mastered (${pct}%)
          <div style="margin-top:6px;width:100%;height:6px;background:var(--paper-warm);border-radius:3px;overflow:hidden">
            <div style="height:100%;background:${isDone ? 'var(--gold)' : isCurrent ? 'var(--sage)' : 'var(--muted)'};width:${pct}%;transition:width .9s ease"></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const sessions = (state.sessions || []).slice().reverse().slice(0, 30);
  let sessionLogHtml = '';
  if (!sessions.length) {
    sessionLogHtml = `<div class="empty-state-card" style="padding:20px; text-align:center; font-family:'Newsreader'; color:var(--muted)">No sessions recorded yet.</div>`;
  } else {
    sessionLogHtml = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${sessions.map((s, idx) => {
          const typeLabel = s.sessionType ? s.sessionType.replace('-', ' ') : 'mixed';
          const durationStr = s.sessionDurationMin ? `${s.sessionDurationMin}m` : '—';
          const updatesCount = Array.isArray(s.topicUpdates) ? s.topicUpdates.length : 0;
          const errorsCount = Array.isArray(s.errorLog) ? s.errorLog.length : 0;
          const testScore = s.testResult ? `${s.testResult.score}/${s.testResult.outOf}` : '';
          
          const recHtml = s.nextSessionRecommendation 
            ? `<div style="margin-top:8px; border-top:1px dashed var(--line); padding-top:6px;">
                <strong>Next Recommendation:</strong> <span class="shape-pill" style="background:var(--gold-soft);color:var(--ink);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;">${esc(s.nextSessionRecommendation.type)}</span>
                <div style="font-family:'Newsreader'; font-size:12.5px; color:var(--muted); margin-top:4px;">${esc(s.nextSessionRecommendation.reason)}</div>
               </div>`
            : '';
          const focusHtml = Array.isArray(s.sessionFocusTopics) && s.sessionFocusTopics.length
            ? `<div style="margin-top:6px;">
                <strong>Focus Topics:</strong> ${s.sessionFocusTopics.map(esc).join(', ')}
               </div>`
            : '';
            
          return `
            <div class="session-log-row" style="background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; overflow:hidden;">
              <div class="session-log-header" data-toggle-idx="${idx}" style="display:flex; align-items:center; justify-content:space-between; padding:12px; cursor:pointer; user-select:none; font-family:'Newsreader'; font-size:14px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-family:monospace; font-size:12px; color:var(--muted);">${esc(s.sessionDate || '—')}</span>
                  <span style="background:rgba(92,113,82,0.12); color:var(--sage); border:1px solid rgba(92,113,82,0.25); padding:1px 8px; border-radius:12px; font-size:11.5px; font-weight:600; text-transform:uppercase;">${esc(typeLabel)}</span>
                  <span style="color:var(--gold); font-weight:600;">${durationStr}</span>
                </div>
                <div style="display:flex; align-items:center; gap:12px; font-size:13px; color:var(--ink-soft)">
                  <span>${updatesCount} updates</span>
                  <span>${errorsCount} errors</span>
                  ${testScore ? `<span style="font-weight:600; color:var(--gold)">Test: ${testScore}</span>` : ''}
                  <span class="chevron-indicator" style="font-family:'Fraunces'; font-weight:bold; font-size:12px; color:var(--muted); transition: transform 0.2s;">▼</span>
                </div>
              </div>
              <div class="session-log-body" id="session-body-${idx}" style="display:none; padding:0 12px 12px; font-family:'Newsreader'; font-size:13px; color:var(--ink-soft); line-height:1.45;">
                ${focusHtml}
                ${recHtml}
                ${!focusHtml && !recHtml ? '<div style="color:var(--muted); font-style:italic;">No additional details.</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  timelineEl.innerHTML = `
    <div class="hero-banner ${cls}">
      <div class="verdict-title">${msg}</div>
      ${subtext ? `<div class="verdict-subtext">${subtext}</div>` : ''}
    </div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Current Pace</div>
        <div class="kpi-val">${paceStr}</div>
        <div class="kpi-sub">topics / day</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Required Pace</div>
        <div class="kpi-val">${requiredStr}</div>
        <div class="kpi-sub">topics / day to meet 6 Jun</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Projected Finish</div>
        <div class="kpi-val">${p.projFinish ? fmtDate(p.projFinish) : '—'}</div>
        <div class="kpi-sub">Based on current pace</div>
      </div>
    </div>
    <div class="charts-grid">
      <div class="panel">
        <div class="panel-head">The three weeks</div>
        <div class="rule"></div>
        <div class="tl-roadmap">
          ${roadmapHtml}
        </div>
      </div>
      <div class="panel chart-card">
        <div class="chart-title">Planned pace vs your actual pace</div>
        <canvas id="paceChart" height="170" aria-label="Line chart comparing planned and actual progress" role="img"></canvas>
      </div>
    </div>
    <div class="panel" style="margin-top: 20px; width: 100%;">
      <div class="panel-head">Session Log (Last 30 Sessions)</div>
      <div class="rule"></div>
      <div>
        ${sessionLogHtml}
      </div>
    </div>
  `;

  setTimeout(() => {
    document.querySelectorAll('.session-log-header').forEach(header => {
      header.addEventListener('click', () => {
        const idx = header.dataset.toggleIdx;
        const body = document.getElementById(`session-body-${idx}`);
        const chevron = header.querySelector('.chevron-indicator');
        if (body) {
          const isCollapsed = body.style.display === 'none';
          body.style.display = isCollapsed ? 'block' : 'none';
          chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'none';
        }
      });
    });
  }, 0);

  // Draw pace chart
  const labels=[], planned=[], actual=[];
  const span = Math.round((PHASE0.checkpoint - PHASE0.start) / 86400000);
  const masteredDates = state.topics.filter(t => t.status === "Mastered" && t.reviewed)
    .map(t => t.reviewed).sort();
  
  for (let d=0; d<=span; d++) {
    const date = new Date(PHASE0.start);
    date.setDate(PHASE0.start.getDate() + d);
    labels.push(date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}));
    planned.push(Math.round(d / span * PHASE0.totalTopics));
    
    if (date <= today) {
      const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      actual.push(masteredDates.filter(x => x <= ds).length);
    } else {
      actual.push(null);
    }
  }

  const cFont = {family: 'Newsreader'};
  if (paceChart) paceChart.destroy();
  paceChart = new Chart(document.getElementById('paceChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Planned', data: planned, borderColor: '#b08433', borderDash: [6, 4],
          pointRadius: 0, tension: .1, fill: false
        },
        {
          label: 'You', data: actual, borderColor: '#5c7152',
          backgroundColor: 'rgba(92,113,82,.13)', pointBackgroundColor: '#5c7152',
          pointRadius: 3, tension: .25, fill: true, spanGaps: false
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { font: cFont, color: '#11203a' } } },
      scales: {
        y: { max: 93, ticks: { font: cFont, color: '#6f6650' }, grid: { color: 'rgba(229,221,200,0.4)', drawBorder: false } },
        x: { ticks: { font: { family: 'Newsreader', size: 9 }, color: '#6f6650', maxTicksLimit: 10 }, grid: { display: false } }
      }
    }
  });
}

/* ---------- misc ---------- */
function esc(s){
  return String(s).replace(/[&<>"']/g,
    m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

window.focusLogForm = function(tabId, targetInputId) {
  if (tabId) {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      tabEl.click();
      tabEl.focus();
    }
  }
  setTimeout(() => {
    const input = document.getElementById(targetInputId);
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }
  }, 120);
};

let toastT;
function toast(msg,isError,duration){
  const el=document.getElementById('toast');
  el.innerHTML=msg;
  el.classList.toggle('error',!!isError);
  el.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('show'),duration||(isError?3000:1600));
}
function setDate(){
  const d=new Date();
  document.getElementById('datestamp').innerHTML=
    `<span class="big">${d.toLocaleDateString('en-GB',{day:'numeric',month:'long'})}</span>`+
    `${d.toLocaleDateString('en-GB',{weekday:'long',year:'numeric'})}`;
}

/* ---------- tabs (with ARIA + keyboard) ---------- */
const tabs=[...document.querySelectorAll('.tab')];
function activateTab(tab){
  tabs.forEach(t=>{
    const on=t===tab;
    t.setAttribute('aria-selected',on?'true':'false');
    t.tabIndex=on?0:-1;
  });
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(tab.dataset.view).classList.add('active');
  if(tab.dataset.view==='charts')loadChartJS(renderCharts);
  if(tab.dataset.view==='timeline')renderTimeline();
}
tabs.forEach((tab,idx)=>{
  tab.addEventListener('click',()=>activateTab(tab));
  tab.addEventListener('keydown',e=>{
    let target=null;
    if(e.key==='ArrowRight')target=tabs[(idx+1)%tabs.length];
    else if(e.key==='ArrowLeft')target=tabs[(idx-1+tabs.length)%tabs.length];
    else if(e.key==='Home')target=tabs[0];
    else if(e.key==='End')target=tabs[tabs.length-1];
    if(target){e.preventDefault();target.focus();activateTab(target);}
  });
});

/* ---------- events ---------- */
let _searchTimer=null;
document.getElementById('search').addEventListener('input',()=>{
  clearTimeout(_searchTimer);
  _searchTimer=setTimeout(renderTracker,250);
});
document.getElementById('filterStatus').addEventListener('change',renderTracker);
document.getElementById('filterConf').addEventListener('change',renderTracker);

/* delegated tracker handlers — bound once */
const topicList=document.getElementById('topicList');
topicList.addEventListener('change',e=>{
  if(e.target.matches('select[data-f],input[data-f="reviewed"]'))onTrackerChange(e.target);
});
topicList.addEventListener('input',e=>{
  if(e.target.matches('textarea[data-f="note"]')){
    const tp=state.topics.find(x=>x.id===e.target.dataset.id);
    if(tp){
      tp._pendingNote=e.target.value;
      // autosave notes as you type (debounced)
      tp.note=e.target.value;
      scheduleAutosave();
      const btn=topicList.querySelector(`.note-btn[data-note-id="${tp.id}"]`);
      if(btn)btn.classList.toggle('has-note',!!(tp.note&&tp.note.trim()));
    }
  }
});
topicList.addEventListener('blur',async e=>{
  if(e.target.matches('textarea[data-f="note"]')){
    const tp=state.topics.find(x=>x.id===e.target.dataset.id);
    if(tp&&tp._pendingNote!==undefined&&tp._pendingNote!==tp.note){
      tp.note=tp._pendingNote;delete tp._pendingNote;
      const ok=await saveTopics();
      toast(ok?'Note saved':'Could not save — try again',!ok);
      // refresh the pencil icon highlight without collapsing the textarea
      const btn=topicList.querySelector(`.note-btn[data-note-id="${tp.id}"]`);
      if(btn)btn.classList.toggle('has-note',!!(tp.note&&tp.note.trim()));
    }
  }
},true);
topicList.addEventListener('click',async e=>{
  const acc=e.target.closest('.sec-accordion');
  if(acc){
    const sec=acc.dataset.sec;
    if(openSections.has(sec)) openSections.delete(sec);
    else openSections.add(sec);
    saveOpenSections();
    renderTracker();
    return;
  }
  const qbtn=e.target.closest('.quick-review');
  if(qbtn){
    const tp=state.topics.find(x=>x.id===qbtn.dataset.quickId);
    if(tp && tp.status!=='Not Started'){
      recordReview(tp,tp.conf||2,'study');
      scheduleAutosave();
      const ok=await saveTopics();
      toast(ok?'Marked reviewed':'Could not save — try again',!ok);
      renderHome();
      updateTrackerRow(tp.id);
    }
    return;
  }
  const btn=e.target.closest('.note-btn');
  if(!btn)return;
  const id=btn.dataset.noteId;
  openNotes[id]=!openNotes[id];
  renderTracker();
  if(openNotes[id]){
    const ta=topicList.querySelector(`textarea[data-id="${id}"]`);
    if(ta)ta.focus();
  }
});

document.getElementById('resetAll').addEventListener('click',async()=>{
  if(!confirm('Reset every topic to Not Started — clearing status, confidence, dates, notes and study time? Test results are kept. This cannot be undone.'))return;
  stopTopicTimer(false);
  state.topics.forEach(t=>{t.status="Not Started";t.conf="";t.reviewed="";t.note="";t.strength=0;t.reviewHistory=[];t.studySeconds=0;t.lastStudySeconds=0;});
  openNotes={};
  scheduleAutosave();
  const ok=await saveTopics();
  renderTracker();renderHome();
  toast(ok?'All topics reset':'Reset done, but could not save — try again',!ok);
});

document.getElementById('addTest').addEventListener('click',async()=>{
  const date=document.getElementById('tDate').value||todayStr();
  const topic=document.getElementById('tTopic').value.trim();
  const score=+document.getElementById('tScore').value;
  const outOf=+document.getElementById('tOutOf').value;
  if(!topic||!outOf){toast('Add a topic and an "out of" value',true);return;}
  if(score<0||outOf<1){toast('Check the score and "out of" values',true);return;}
  if(score>outOf){toast('Score cannot exceed the "out of" value',true);return;}
  const type=document.getElementById('tTypeSeg').dataset.val||'Topic Test';
  
  const confVal = document.getElementById('tConf').value;
  const confidence = confVal ? parseInt(confVal) : null;

  state.tests.push({date,topic,type,
    score,outOf,confidence,note:document.getElementById('tNote').value.trim()});
  // update matching topic's strength via forgetting curve
  const pct=outOf?Math.round(score/outOf*100):0;
  const matchTopic=state.topics.find(t=>t.name.toLowerCase()===topic.toLowerCase());
  if(matchTopic&&matchTopic.status!=='Not Started'){
    // --- Dynamic K-factor calibration ---
    const pred=predictRetention(matchTopic);
    if(pred!==null){
      const oldK=topicK(matchTopic);
      if(pct<80 && pred>0.85){
        // Overconfidence: system predicted high retention but test failed
        matchTopic.kFactor=Math.round(oldK*0.85*100)/100;
        toast(`Decay engine recalibrated for "${matchTopic.name}" (K ${oldK.toFixed(1)} → ${matchTopic.kFactor.toFixed(1)}, faster decay)`);
      } else if(pct>=90 && pred<0.50){
        // Underconfidence: system predicted low retention but test aced
        matchTopic.kFactor=Math.round(oldK*1.15*100)/100;
        toast(`Decay engine recalibrated for "${matchTopic.name}" (K ${oldK.toFixed(1)} → ${matchTopic.kFactor.toFixed(1)}, slower decay)`);
      }
    }
    recordReview(matchTopic,confidence||matchTopic.conf||2,pct>=80?'test-pass':'test-fail');
  }
  scheduleAutosave();
  const ok=await saveTests();
  ['tTopic','tScore','tOutOf','tNote'].forEach(id=>document.getElementById(id).value='');
  const tConfSelect = document.getElementById('tConf');
  if(tConfSelect) tConfSelect.value = '';
  renderTests();
  toast(ok?'Result logged':'Logged, but could not save — try again',!ok);
});

/* export / import backup */
window.triggerExport = function(){
  document.getElementById('exportData').click();
  document.getElementById('toast').classList.remove('show');
};
function checkBackupNudge(isNewReview){
  let count = parseInt(storageGet('phase0:reviews_since_export') || 0);
  if(isNewReview){
    count++;
    storageSet('phase0:reviews_since_export', count.toString());
  }
  const lastExport = storageGet('phase0:last_export_date') || todayStr();
  const days = Math.max(0, daysBetween(lastExport, todayStr()));
  if(count >= 20 || days >= 7){
    const reason = days >= 7 
      ? `You haven't backed up in ${days} days` 
      : `You have ${count} unbacked-up reviews`;
    toast(
      `${reason} — <button onclick="triggerExport(); event.stopPropagation();" style="background:var(--gold-bright);color:var(--ink);border:none;border-radius:4px;padding:3px 10px;margin-left:8px;font-family:'Fraunces';font-weight:600;cursor:pointer">Export Now</button>`,
      false,
      12000
    );
  }
}
document.getElementById('exportData').addEventListener('click',()=>{
  const payload={app:'phase0-ledger',version:1,exported:new Date().toISOString(),
    topics:state.topics,tests:state.tests,errors:state.errors,
    cards:state.cards || [],questionResults:state.questionResults || [],
    sessions:state.sessions || [],prereqGaps:state.prereqGaps || [],
    pendingMarking:state.pendingMarking || [],
    dismissedRecommendations:state.dismissedRecommendations || []};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`phase0-ledger-backup-${todayStr()}.json`;
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
  toast('Backup downloaded');
  storageSet('phase0:last_export_date', todayStr());
  storageSet('phase0:reviews_since_export', '0');
});

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return '"' + str.replace(/"/g, '""') + '"';
}

const exportAnkiBtn = document.getElementById('exportAnkiCsv');
if (exportAnkiBtn) {
  exportAnkiBtn.addEventListener('click', () => {
    const cards = state.cards || [];
    if (!cards.length) {
      toast('No Anki cards to export.', true);
      return;
    }
    const lines = ['front,back,tags'];
    cards.forEach(c => {
      const cardTags = Array.isArray(c.tags) ? c.tags : [];
      const allTags = ['phase-0', ...cardTags].join(' ');
      lines.push(`${escapeCsvCell(c.front)},${escapeCsvCell(c.back)},${escapeCsvCell(allTags)}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phase0-anki-cards-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Anki CSV exported');
  });
}

document.getElementById('importBtn').addEventListener('click',()=>{
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!data||!Array.isArray(data.topics))throw new Error('bad file');
      if(!confirm('Import this backup? It will replace all current progress.'))return;
      state.topics=mergeTopics(data.topics);
      state.tests=Array.isArray(data.tests)?data.tests:[];
      state.errors=Array.isArray(data.errors)?data.errors:[];
      state.cards=Array.isArray(data.cards)?data.cards:[];
      state.questionResults=Array.isArray(data.questionResults)?data.questionResults:[];
      state.sessions=Array.isArray(data.sessions)?data.sessions:[];
      state.prereqGaps=Array.isArray(data.prereqGaps)?data.prereqGaps:[];
      state.pendingMarking=Array.isArray(data.pendingMarking)?data.pendingMarking:[];
      state.dismissedRecommendations=Array.isArray(data.dismissedRecommendations)?data.dismissedRecommendations:[];
      state.activeTest=null;

      const a=await saveTopics();
      const b=await saveTests();
      const c=await saveErrors();
      const d=await saveCards();
      const e=await saveQuestionResults();
      const f=await saveSessions();
      const g=await savePrereqGaps();
      const h=await saveActiveTest();
      const i=await saveDismissedRecommendations();
      const j=await savePendingMarking();

      openNotes={};
      storageSet('phase0:last_export_date', todayStr());
      storageSet('phase0:reviews_since_export', '0');
      renderHome();renderTracker();renderTests();renderErrors();
      if(typeof renderPendingMarking === 'function') renderPendingMarking();
      toast(a&&b&&c&&d&&e&&f&&g&&h&&i&&j?'Backup imported':'Imported, but could not save some collections',!(a&&b&&c&&d&&e&&f&&g&&h&&i&&j));
    }catch(err){
      toast('Could not read that file — is it a valid backup?',true);
    }
  };
  reader.readAsText(file);
  e.target.value='';
});

function populateTopicDatalist(){
  const dl = document.getElementById('topicDatalist');
  if(!dl) return;
  dl.innerHTML = state.topics.map(t => `<option value="${esc(t.name)}"></option>`).join('');
}

// Add event listener to auto-fill confidence when topic matches
const tTopicInput = document.getElementById('tTopic');
if (tTopicInput) {
  tTopicInput.addEventListener('input', () => {
    const val = tTopicInput.value.trim();
    const match = state.topics.find(t => t.name.toLowerCase() === val.toLowerCase());
    const tConfSelect = document.getElementById('tConf');
    if (match && tConfSelect) {
      tConfSelect.value = match.conf || '';
    }
  });
}

function getGoldAlphaColor(alpha) {
  const isDark = document.body.classList.contains('dark-theme');
  return isDark ? `hsla(43, 60%, 63%, ${alpha})` : `hsla(39, 71%, 33%, ${alpha})`;
}

function renderCalibrationChart(cFont) {
  if(!cFont) cFont={family:'Newsreader'};
  const canvas = document.getElementById('calibrationChart');
  if(!canvas) return;

  if(charts.cal) {
    charts.cal.destroy();
    charts.cal = null;
  }

  const host = document.getElementById('calibrationChartHost');
  const titleEl = host ? host.previousElementSibling : null;
  const insightEl = document.getElementById('calibrationInsight');

  // Group tests by confidence level 1-5
  const confSums = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
  const confCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

  let ociSum = 0;
  let ociCount = 0;
  const groups = {};

  state.tests.forEach(t => {
    let conf = null;
    if (t.confidence) {
      conf = parseInt(t.confidence);
    } else {
      const match = state.topics.find(x => x.name.toLowerCase() === t.topic.toLowerCase());
      if (match && match.conf) {
        conf = parseInt(match.conf);
      }
    }

    if (conf >= 1 && conf <= 5) {
      const scorePct = t.outOf ? (t.score / t.outOf) * 100 : 0;
      confSums[conf] += scorePct;
      confCounts[conf]++;

      const scoreRatio = t.outOf ? (t.score / t.outOf) : 0;
      ociSum += (conf / 5) - scoreRatio;
      ociCount++;

      const roundedScore = Math.round(scorePct);
      const key = `${conf}-${roundedScore}`;
      if (!groups[key]) {
        groups[key] = {
          conf,
          scorePct: roundedScore,
          tests: []
        };
      }
      groups[key].tests.push(t);
    }
  });

  const actualData = [];
  const perfectData = [20, 40, 60, 80, 100];
  const labels = ['1 (Low)', '2', '3', '4', '5 (High)'];

  // Check if we have any data points to render
  let hasData = false;
  for (let c = 1; c <= 5; c++) {
    if (confCounts[c] > 0) {
      actualData.push(Math.round(confSums[c] / confCounts[c]));
      hasData = true;
    } else {
      actualData.push(null);
    }
  }

  if (!hasData) {
    if (host) {
      host.innerHTML = '<div class="empty-note" style="padding:40px 8px;text-align:center">'
        +'No calibration data yet. Log tests with confidence ratings to plot your curve.</div>';
    }
    if (insightEl) insightEl.innerHTML = '';
    if (titleEl) {
      titleEl.innerHTML = 'Calibration Scorecard';
    }
    return;
  }

  const globalOCI = ociCount > 0 ? (ociSum / ociCount) : 0;
  const absOCI = Math.abs(globalOCI);
  let ociColor = 'var(--sage)';
  if (absOCI > 0.15) {
    ociColor = 'var(--rose)';
  } else if (absOCI > 0.08) {
    ociColor = 'var(--gold)';
  }
  const ociSign = globalOCI > 0 ? '+' : '';
  const ociValStr = ociSign + globalOCI.toFixed(2);

  if (titleEl) {
    titleEl.innerHTML = `Calibration Scorecard <span class="oci-header-badge" style="float: right; font-size: 11px; font-family: 'Fraunces'; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: ${ociColor}; border: 1px solid ${ociColor}; padding: 2px 6px; border-radius: 3px;">OCI: ${ociValStr}</span>`;
  }

  const scatterData = [];
  const scatterColors = [];
  const scatterBorderColors = [];
  const scatterTests = [];

  Object.values(groups).forEach(g => {
    const count = g.tests.length;
    // 1 test = 0.20 alpha (light gold), 5 tests = 1.00 alpha (solid gold)
    const alpha = Math.min(1.0, count * 0.20);
    const fillColor = getGoldAlphaColor(alpha);
    const borderColor = getGoldAlphaColor(Math.min(1.0, alpha + 0.15));

    scatterData.push({
      x: g.conf - 1,
      y: g.scorePct
    });
    scatterColors.push(fillColor);
    scatterBorderColors.push(borderColor);
    scatterTests.push(g.tests);
  });

  host.innerHTML = '<canvas id="calibrationChart" height="200" aria-label="Calibration curve showing confidence vs score" role="img"></canvas>';

  charts.cal = new Chart(document.getElementById('calibrationChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Perfect Calibration',
          data: perfectData,
          borderColor: 'var(--muted)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0
        },
        {
          label: 'Individual Tests',
          data: scatterData,
          showLine: false,
          pointBackgroundColor: scatterColors,
          pointBorderColor: scatterBorderColors,
          pointBorderWidth: 1.5,
          pointRadius: 7,
          pointHoverRadius: 9,
          fill: false
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: {
            font: cFont,
            color: 'var(--ink)'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.dataset.label === 'Individual Tests') {
                const testsInGroup = scatterTests[context.dataIndex];
                if (testsInGroup && testsInGroup.length) {
                  if (testsInGroup.length === 1) {
                    const testObj = testsInGroup[0];
                    return `${testObj.topic}: ${testObj.score}/${testObj.outOf} (${Math.round(context.parsed.y)}%)`;
                  } else {
                    const topicsList = testsInGroup.map(t => t.topic).join(', ');
                    const displayTopics = topicsList.length > 50 ? topicsList.slice(0, 47) + '...' : topicsList;
                    return `${testsInGroup.length} tests: ${displayTopics} (${Math.round(context.parsed.y)}%)`;
                  }
                }
              }
              return `${context.dataset.label}: ${context.parsed.y}%`;
            }
          }
        }
      },
      scales: {
        y: {
          max: 100,
          min: 0,
          ticks: {
            font: cFont,
            color: '#6f6650',
            callback: v => v + '%'
          },
          grid: {
            color: 'rgba(229,221,200,0.4)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: cFont,
            color: '#6f6650'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  let maxOverconfidenceTier = 0;
  let maxOverconfidenceDiff = 0;
  let detailsHtml = '';

  for (let c = 1; c <= 5; c++) {
    if (confCounts[c] > 0) {
      const actualScore = Math.round(confSums[c] / confCounts[c]);
      const expectedScore = c * 20;
      const diff = expectedScore - actualScore;

      detailsHtml += `<li>At confidence <strong>${c}/5</strong>, you scored <strong>${actualScore}%</strong> average (expected ~${expectedScore}%).</li>`;

      if (diff > 5) {
        if (diff > maxOverconfidenceDiff) {
          maxOverconfidenceDiff = diff;
          maxOverconfidenceTier = c;
        }
      }
    }
  }

  let summaryMsg = `<strong>Metacognitive Insight:</strong> Your confidence is well-calibrated to your actual performance. Excellent metacognitive accuracy!`;
  if (maxOverconfidenceDiff > 0) {
    const actualScore = Math.round(confSums[maxOverconfidenceTier] / confCounts[maxOverconfidenceTier]);
    summaryMsg = `<strong>Metacognitive Insight:</strong> You show systematic overconfidence. On topics where you felt <strong>${maxOverconfidenceTier}/5</strong> confident, you scored an average of <strong>${actualScore}%</strong> (a gap of <strong>${maxOverconfidenceDiff}%</strong>). This suggests material feels familiar before it is fully retrievable. Run forced-retrieval reps before progressing.`;
  }

  if (insightEl) {
    insightEl.innerHTML = `
      <div class="insight-title">Metacognitive Insight</div>
      <p>${summaryMsg}</p>
      <ul>
        ${detailsHtml}
      </ul>
    `;
  }
}

/* ---------- init ---------- */
(async function(){
  setDate();
  document.getElementById('tDate').value=todayStr();
  document.getElementById('eDate').value=todayStr();
  await loadState();
  if(!storageOK){
    toast('Saving is unavailable here — progress may not persist',true);
  }
  renderHome();renderTracker();renderTests();renderErrors();populateErrorTopicSelect();populateTopicDatalist();
  checkBackupNudge(false);
})();

/* ---------- error log ---------- */
function populateErrorTopicSelect(){
  const sel=document.getElementById('eTopic');
  sel.innerHTML='<option value="">Select topic…</option>';
  state.topics.forEach(t=>{
    sel.innerHTML+=`<option value="${esc(t.name)}">${esc(t.name)}</option>`;
  });
}
function renderErrors(){
  const list=document.getElementById('errorList');
  if(!state.errors.length){
    list.innerHTML = `
      <div class="empty-state-card full">
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="currentColor" style="color: var(--gold-soft); opacity: 0.8; stroke-width: 1.5; margin-bottom: 10px;">
          <rect x="14" y="10" width="36" height="44" rx="3" />
          <line x1="22" y1="20" x2="42" y2="20" />
          <line x1="22" y1="30" x2="32" y2="30" />
          <circle cx="40" cy="35" r="8" stroke="var(--rose)" stroke-width="2" />
          <line x1="45.5" y1="40.5" x2="52" y2="47" stroke="var(--rose)" stroke-width="2" />
        </svg>
        <div class="empty-title">No misconceptions logged yet</div>
        <div class="empty-desc">Log your errors as Conceptual, Procedural, or Strategic to build a focused study plan.</div>
        <button class="btn empty-cta" onclick="focusLogForm(null, 'eTopic')">Log your first error →</button>
      </div>
    `;
    document.getElementById('errorStat').textContent='';
    return;
  }
  const conc=state.errors.filter(e=>e.type==='Conceptual' && e.status==='active').length;
  const closedCount=state.errors.filter(e=>e.status==='closed').length;
  document.getElementById('errorStat').textContent=`${conc} active conceptual · ${closedCount} corrected`;
  
  list.innerHTML=state.errors.slice().reverse().map((e,idx)=>{
    const realIdx=state.errors.length-1-idx;
    const cls=e.type.toLowerCase();
    const isClosed=e.status==='closed';
      const fixText=(e.fix||e.mentalModel)?`<div style="font-size:12.5px; color:var(--sage); margin-top:5px;"><strong>The fix:</strong> ${esc(e.fix||e.mentalModel)}</div>`:'';
      const watchForText=(e.watch||e.watchFor)?`<div style="font-size:12.5px; color:var(--gold); margin-top:3px;"><strong>Watch for:</strong> ${esc(e.watch||e.watchFor)}</div>`:'';
    const closedDateText=isClosed?`<div style="font-size:11px; color:var(--sage); margin-top:5px; font-weight:600;">✓ Corrected on ${esc(e.closedDate)}</div>`:'';
    
    return `<div class="elog-row ${isClosed?'closed':''}">
      <span>${esc(e.date)}</span>
      <span style="font-weight:500;">${esc(e.topic)}</span>
      <span class="etype ${cls}">${esc(e.type)}</span>
      <div style="display:flex; flex-direction:column; padding: 4px 0;">
        <span style="font-size:13.5px; color:var(--ink); line-height:1.4;"><strong>What went wrong:</strong> ${esc(e.wrong||e.note||'')}</span>
        ${fixText}
        ${watchForText}
        ${closedDateText}
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;width:100%;">
        ${!isClosed?`<button class="resolve-btn" data-elog-idx="${realIdx}" title="Mark corrected">✓</button>`:''}
        <button class="del" data-elog-idx="${realIdx}" aria-label="Delete error" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.del').forEach(b=>{
    b.addEventListener('click',async()=>{
      state.errors.splice(+b.dataset.elogIdx,1);
      scheduleAutosave();
      const ok=await saveErrors();
      toast(ok?'Error deleted':'Could not save',!ok);
      renderErrors();
      renderHome();
      if (typeof renderCharts === 'function') renderCharts();
    });
  });

  list.querySelectorAll('.resolve-btn').forEach(b=>{
    b.addEventListener('click',async()=>{
      const idx = +b.dataset.elogIdx;
      state.errors[idx].status = 'closed';
      state.errors[idx].closedDate = todayStr();
      scheduleAutosave();
      const ok=await saveErrors();
      toast(ok?'Error marked corrected':'Could not save',!ok);
      renderErrors();
      renderHome();
      if (typeof renderCharts === 'function') renderCharts();
    });
  });
}
document.getElementById('addError').addEventListener('click',async()=>{
  const date=document.getElementById('eDate').value||todayStr();
  const topic=document.getElementById('eTopic').value;
  const type=document.getElementById('eTypeSeg').dataset.val||'Conceptual';
  const wrong=document.getElementById('eWrong').value.trim();
  const fix=document.getElementById('eFix').value.trim();
  const watch=document.getElementById('eWatch').value.trim();
  if(!topic){toast('Select a topic',true);return;}
  if(!wrong){toast('Describe what went wrong',true);return;}
  if(!fix){toast('Describe the fix',true);return;}
  state.errors.push({
    date,
    topic,
    type,
    wrong,
    fix,
    watch: watch||'',
    status:'active',
    closedDate:''
  });
  scheduleAutosave();
  const ok=await saveErrors();
  document.getElementById('eWrong').value='';
  document.getElementById('eFix').value='';
  document.getElementById('eWatch').value='';
  renderErrors();
  toast(ok?'Error logged':'Logged, but could not save',!ok);
  renderHome();
  if (typeof renderCharts === 'function') renderCharts();
});

/* ---------- session brief generator ---------- */
function generateBrief(){
  const lines=[];
  const wp=dailyTarget();
  const c=counts();
  const today=todayStr();

  // --- situation header ---
  const mastered=c['Mastered'];
  let paceWord='on track';
  if(wp.target>0){
    const done=state.topics.filter(x=>x.i<wp.target&&x.status==='Mastered').length;
    if(done>=wp.target)paceWord='ahead';
    else paceWord='behind ('+done+'/'+wp.target+' mastered)';
  }
  lines.push(phaseWeek()+' Mastered '+mastered+'/93. Waypoint: '+paceWord+'.');
  lines.push('');

  // --- re-teach first (conceptual errors or Learning conf<=2) ---
  const conceptualErrors=state.errors.filter(e=>e.type==='Conceptual');
  const conceptTopics=[...new Set(conceptualErrors.map(e=>e.topic))];
  const learningWeak=state.topics.filter(t=>t.status==='Learning'&&parseInt(t.conf)<=2&&t.conf!=='')
    .map(t=>t.name);
  const reteachSet=[...new Set([...conceptTopics,...learningWeak])];
      if(reteachSet.length){
    lines.push('RE-TEACH FIRST (model gaps — rebuild from intuition, not more practice)');
    reteachSet.forEach(name=>{
      const errs=conceptualErrors.filter(e=>e.topic===name);
      let line='  - '+name;
      if(errs.length){
        line+=' — '+errs.map(e=>e.wrong||e.note).join('; ');
      } else {
        const t=state.topics.find(x=>x.name===name);
        if(t) line+=' — confidence '+t.conf+', status Learning';
      }
      lines.push(line);
    });
    lines.push('');
  }

  // --- drill for fluency (procedural/strategic errors or Practising conf 3) ---
  const procErrors=state.errors.filter(e=>e.type==='Procedural'||e.type==='Strategic');
  const procTopics=[...new Set(procErrors.map(e=>e.topic))]
    .filter(n=>!reteachSet.includes(n));
  const practisingMid=state.topics.filter(t=>t.status==='Practising'&&String(t.conf)==='3')
    .map(t=>t.name).filter(n=>!reteachSet.includes(n));
  const drillSet=[...new Set([...procTopics,...practisingMid])];
  if(drillSet.length){
    lines.push('DRILL FOR FLUENCY (needs reps and varied problems, not re-teaching)');
    drillSet.forEach(name=>{
      const errs=procErrors.filter(e=>e.topic===name);
      let line='  - '+name;
      if(errs.length){
        line+=' — '+errs.map(e=>'['+e.type+'] '+(e.wrong||e.note)).join('; ');
      } else {
        line+=' — Practising, confidence 3';
      }
      lines.push(line);
    });
    lines.push('');
  }

  // --- due for review (spaced repetition — decay model) ---
  const rv=dueForReview();
  if(rv.length){
    lines.push('DUE FOR REVIEW (predicted retention below '+Math.round(DUE_THRESHOLD*100)+'%)');
    rv.forEach(t=>{
      const retPct=t.retention!==null&&t.retention!==undefined?Math.round(t.retention*100):'?';
      lines.push('  - '+t.name+' — ~'+retPct+'% predicted retention, '+t.ago+' days since last review, confidence '+t.conf);
    });
    lines.push('');
  }

  // --- retry (test scores <80%) ---
  const retries=state.tests.filter(t=>{
    if(!t.outOf)return false;
    return Math.round(t.score/t.outOf*100)<80;
  });
  if(retries.length){
    lines.push('RETRY (test scores below 80%)');
    retries.forEach(t=>{
      const pct=Math.round(t.score/t.outOf*100);
      let line='  - '+t.topic+' — '+t.score+'/'+t.outOf+' ('+pct+'%)';
      if(t.note) line+=' — fix: '+t.note;
      lines.push(line);
    });
    lines.push('');
  }

  // --- new material for today ---
  if(wp.target>0){
    const notStarted=state.topics.filter(t=>t.status==='Not Started'&&t.i<wp.target);
    if(notStarted.length){
      lines.push('NEW MATERIAL FOR TODAY (to hit waypoint)');
      notStarted.forEach(t=>{
        lines.push('  - '+t.name+' (p.'+t.page+', '+t.section.replace(/Section \d+ — /,'')+')' );
      });
      lines.push('');
    } else {
      // also show next not-started topics if already past waypoint
      const nextNew=state.topics.filter(t=>t.status==='Not Started').slice(0,3);
      if(nextNew.length){
        lines.push('NEXT UP (ahead of waypoint — keep going)');
        nextNew.forEach(t=>{
          lines.push('  - '+t.name+' (p.'+t.page+', '+t.section.replace(/Section \d+ — /,'')+')' );
        });
        lines.push('');
      }
    }
  }

  // --- closing instruction ---
  lines.push('SESSION ORDER: Re-teach items first (rebuild the mental model) -> fluency drilling -> review items -> new material. At end of session, produce an error log update (topic, error type: Conceptual/Procedural/Strategic, note) and tracker status updates I can paste back in.');

  return lines.join('\n');
}

function generateInterleavedSet() {
  const lines = [];
  const today = todayStr();
  lines.push('ENGINEERED INTERLEAVING SET (Mixed Practice)');
  lines.push('Date: ' + today);
  lines.push('');
  lines.push('Context: Blocked practice builds short-term recognition. Interleaved practice builds long-term retrieval and problem-identification skills.');
  lines.push('');
  lines.push('Your mixed practice topics for today:');
  lines.push('');

  const eligible = state.topics.filter(t => t.status === 'Practising' || t.status === 'Mastered');
  
  const bySection = {};
  eligible.forEach(t => {
    if (!bySection[t.section]) bySection[t.section] = [];
    bySection[t.section].push(t);
  });

  const sections = Object.keys(bySection);
  for (let i = sections.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sections[i], sections[j]] = [sections[j], sections[i]];
  }
  
  const targetCount = Math.max(1, Math.min(sections.length, Math.floor(Math.random() * 3) + 3));
  const selectedSections = sections.slice(0, targetCount);

  if (selectedSections.length === 0) {
    lines.push('  (Not enough Practising or Mastered topics yet to generate a mixed set.)');
  } else {
    selectedSections.forEach((sec, idx) => {
      const tops = bySection[sec];
      const randomTop = tops[Math.floor(Math.random() * tops.length)];
      lines.push(`${idx + 1}. ${randomTop.name}`);
      lines.push(`   - Section: ${sec}`);
      lines.push(`   - Page: ${randomTop.page}`);
      lines.push(`   - Status: ${randomTop.status} (Fluency: ${randomTop.conf || '-'})`);
      lines.push('');
    });
  }

  lines.push('SESSION INSTRUCTIONS: Tackle one question from each topic in a round-robin fashion. DO NOT do all questions from topic 1 before moving to topic 2. The cognitive friction of switching contexts is the entire goal.');

  return lines.join('\n');
}

document.getElementById('genBrief').addEventListener('click',()=>{
  const text=generateBrief();
  document.getElementById('briefText').textContent=text;
  document.getElementById('briefModal').classList.add('open');
});
const genInterleavedBtn = document.getElementById('genInterleaved');
if(genInterleavedBtn) {
  genInterleavedBtn.addEventListener('click',()=>{
    const text=generateInterleavedSet();
    document.getElementById('briefText').textContent=text;
    document.getElementById('briefModal').classList.add('open');
  });
}
document.getElementById('briefCopy').addEventListener('click',()=>{
  const text=document.getElementById('briefText').textContent;
  navigator.clipboard.writeText(text).then(()=>toast('Copied to clipboard')).catch(()=>{
    // fallback
    const range=document.createRange();
    range.selectNodeContents(document.getElementById('briefText'));
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
    document.execCommand('copy');
    toast('Copied to clipboard');
  });
});
[document.getElementById('briefClose'),document.getElementById('briefClose2')].forEach(b=>{
  b.addEventListener('click',()=>document.getElementById('briefModal').classList.remove('open'));
});
document.getElementById('briefModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget)document.getElementById('briefModal').classList.remove('open');
});

/* ---------- import session ---------- */
const VALID_STATUSES=['Learning','Practising','Mastered'];
const VALID_ETYPES=['Conceptual','Procedural','Strategic'];
let _importParsed=null;

function findTopicByName(name){
  const trimmed=(name||'').trim();
  if(!trimmed)return null;
  // exact match first
  let t=state.topics.find(x=>x.name===trimmed);
  if(t)return t;
  // case-insensitive fallback
  const lower=trimmed.toLowerCase();
  t=state.topics.find(x=>x.name.toLowerCase()===lower);
  return t||null;
}

function validateImport(raw){
  let data;
  try{data=JSON.parse(raw);}catch(e){
    return {ok:false,error:'Invalid JSON: '+e.message};
  }
  if(!data||typeof data!=='object'||Array.isArray(data))
    return {ok:false,error:'JSON must be an object, not an array or primitive.'};

  const errs=[];
  const warnings=[];
  const result={topicUpdates:[],errorLog:[],testResult:null,warnings};

  // sessionDate
  if(data.sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.sessionDate))
    errs.push('sessionDate must be YYYY-MM-DD format.');

  // sessionType
  if (data.sessionType !== undefined) {
    const validSessionTypes = ["first-pass", "re-teach", "drill", "review", "interleaved", "test", "diagnostic", "mixed"];
    if (!validSessionTypes.includes(data.sessionType)) {
      errs.push(`sessionType must be one of: ${validSessionTypes.join(', ')}`);
    }
    result.sessionType = data.sessionType;
  }

  // sessionDurationMin
  if (data.sessionDurationMin !== undefined) {
    const min = Number(data.sessionDurationMin);
    if (!Number.isInteger(min) || min < 1 || min > 600) {
      errs.push("sessionDurationMin must be an integer between 1 and 600.");
    }
    result.sessionDurationMin = min;
  }

  // sessionFocusTopics
  if (data.sessionFocusTopics !== undefined) {
    if (!Array.isArray(data.sessionFocusTopics)) {
      errs.push("sessionFocusTopics must be an array of strings.");
    } else {
      result.sessionFocusTopics = [];
      data.sessionFocusTopics.forEach((tName, idx) => {
        const match = findTopicByName(tName);
        if (!match) {
          warnings.push(`sessionFocusTopics[${idx}]: topic "${tName}" not recognized.`);
        }
        result.sessionFocusTopics.push(tName);
      });
    }
  }

  // topicUpdates
  if(data.topicUpdates){
    if(!Array.isArray(data.topicUpdates))
      return {ok:false,error:'topicUpdates must be an array.'};
    data.topicUpdates.forEach((u,i)=>{
      const label='topicUpdates['+i+']';
      if(!u.topic){errs.push(label+': missing "topic" field.');return;}
      const match=findTopicByName(u.topic);
      const entry={raw:u,match,skipped:!match,topic:u.topic.trim()};
      if(u.status && !VALID_STATUSES.includes(u.status))
        errs.push(label+': status "'+u.status+'" not in ['+VALID_STATUSES.join(', ')+'].');
      if(u.confidence!==undefined && u.confidence!==null){
        const c=Number(u.confidence);
        if(!Number.isInteger(c)||c<1||c>5)
          errs.push(label+': confidence must be integer 1-5, got "'+u.confidence+'".');
      }
      if(u.reviewed && !/^\d{4}-\d{2}-\d{2}$/.test(u.reviewed))
        errs.push(label+': reviewed must be YYYY-MM-DD.');
      result.topicUpdates.push(entry);
    });
  }

  // errorLog
  if(data.errorLog){
    if(!Array.isArray(data.errorLog))
      return {ok:false,error:'errorLog must be an array.'};
    data.errorLog.forEach((e,i)=>{
      const label='errorLog['+i+']';
      if(!e.topic) errs.push(label+': missing "topic".');
      if(!e.type) errs.push(label+': missing "type".');
      else if(!VALID_ETYPES.includes(e.type))
        errs.push(label+': type "'+e.type+'" not in ['+VALID_ETYPES.join(', ')+'].');
      if(!e.note) errs.push(label+': missing "note".');
      result.errorLog.push({raw:e,match:findTopicByName(e.topic)});
    });
  }

  // testResult
  if(data.testResult && typeof data.testResult==='object' && !Array.isArray(data.testResult)){
    const t=data.testResult;
    if (t.testId !== undefined) {
      result.testId = t.testId;
    }
    if(!t.topic && !t.testId) errs.push('testResult: missing "topic" or "testId".');

    if (t.questions !== undefined) {
      if (!Array.isArray(t.questions)) {
        errs.push("testResult.questions must be an array.");
      } else {
        const questionsList = [];
        t.questions.forEach((q, idx) => {
          const qLabel = `testResult.questions[${idx}]`;
          if (q.n === undefined || q.n === null || typeof q.n !== 'number' || q.n < 1) {
            errs.push(`${qLabel}: missing or invalid "n" (must be integer >= 1).`);
          }
          if (!q.primaryTopic) {
            errs.push(`${qLabel}: missing "primaryTopic".`);
          } else {
            const match = findTopicByName(q.primaryTopic);
            if (!match) {
              errs.push(`${qLabel}: primaryTopic "${q.primaryTopic}" not recognized.`);
            }
          }
          if (q.score === undefined || q.score === null || typeof q.score !== 'number' || q.score < 0) {
            errs.push(`${qLabel}: missing or invalid "score" (must be >= 0).`);
          }
          if (q.outOf === undefined || q.outOf === null || typeof q.outOf !== 'number' || q.outOf < 1) {
            errs.push(`${qLabel}: missing or invalid "outOf" (must be >= 1).`);
          }
          if (q.score !== undefined && q.outOf !== undefined && q.score > q.outOf) {
            errs.push(`${qLabel}: score (${q.score}) exceeds outOf (${q.outOf}).`);
          }

          if (q.topics !== undefined) {
            if (!Array.isArray(q.topics)) {
              errs.push(`${qLabel}: topics must be an array of strings.`);
            } else {
              q.topics.forEach((topName, tidx) => {
                const match = findTopicByName(topName);
                if (!match) {
                  warnings.push(`${qLabel}.topics[${tidx}]: topic "${topName}" not recognized.`);
                }
              });
            }
          }
          if (q.timeSec !== undefined && (typeof q.timeSec !== 'number' || q.timeSec < 0)) {
            errs.push(`${qLabel}: timeSec must be a number >= 0.`);
          }
          if (q.difficulty !== undefined && !['easy', 'med', 'hard'].includes(q.difficulty)) {
            errs.push(`${qLabel}: difficulty must be one of: easy, med, hard.`);
          }
          if (q.errorType !== undefined && !['Conceptual', 'Procedural', 'Strategic', 'none'].includes(q.errorType)) {
            errs.push(`${qLabel}: errorType must be one of: Conceptual, Procedural, Strategic, none.`);
          }

          questionsList.push({
            n: q.n,
            primaryTopic: q.primaryTopic,
            topics: q.topics || [q.primaryTopic],
            score: q.score,
            outOf: q.outOf,
            timeSec: q.timeSec !== undefined ? q.timeSec : null,
            difficulty: q.difficulty || 'med',
            errorType: q.errorType || 'none',
            errorNote: q.errorNote || ''
          });
        });
        t.questions = questionsList;
      }
    }

    if (t.questions === undefined) {
      if(t.score===undefined||t.score===null) errs.push('testResult: missing "score".');
      if(!t.outOf||t.outOf<1) errs.push('testResult: "outOf" must be >= 1.');
      if(typeof t.score==='number' && typeof t.outOf==='number' && t.score>t.outOf)
        errs.push('testResult: score ('+t.score+') exceeds outOf ('+t.outOf+').');
      if(t.score<0) errs.push('testResult: score must be >= 0.');
    }

    if(t.confidence!==undefined && t.confidence!==null){
      const c=Number(t.confidence);
      if(!Number.isInteger(c)||c<1||c>5)
        errs.push('testResult: confidence must be integer 1-5, got "'+t.confidence+'".');
    }
    result.testResult=t;
  }

  // ankiCards
  if (data.ankiCards !== undefined) {
    if (!Array.isArray(data.ankiCards)) {
      errs.push("ankiCards must be an array.");
    } else {
      result.ankiCards = [];
      data.ankiCards.forEach((c, idx) => {
        const cLabel = `ankiCards[${idx}]`;
        if (!c.id) errs.push(`${cLabel}: missing "id".`);
        if (!c.topic) {
          errs.push(`${cLabel}: missing "topic".`);
        } else {
          const match = findTopicByName(c.topic);
          if (!match) {
            errs.push(`${cLabel}: topic "${c.topic}" not recognized.`);
          }
        }
        if (!c.type || !['basic', 'cloze'].includes(c.type)) {
          errs.push(`${cLabel}: type must be basic or cloze.`);
        }
        if (!c.front || c.front.length > 300) {
          errs.push(`${cLabel}: front must be a string <= 300 chars.`);
        }
        if (!c.back || c.back.length > 300) {
          errs.push(`${cLabel}: back must be a string <= 300 chars.`);
        }

        result.ankiCards.push({
          id: c.id,
          topic: c.topic,
          type: c.type,
          front: c.front,
          back: c.back,
          tags: Array.isArray(c.tags) ? c.tags : [],
          linkedErrorId: c.linkedErrorId || null,
          rationale: c.rationale || ''
        });
      });
    }
  }

  // prerequisiteGaps
  if (data.prerequisiteGaps !== undefined) {
    if (!Array.isArray(data.prerequisiteGaps)) {
      errs.push("prerequisiteGaps must be an array.");
    } else {
      result.prerequisiteGaps = [];
      data.prerequisiteGaps.forEach((g, idx) => {
        const gLabel = `prerequisiteGaps[${idx}]`;
        if (!g.topic) {
          errs.push(`${gLabel}: missing "topic".`);
        } else if (!findTopicByName(g.topic)) {
          errs.push(`${gLabel}: topic "${g.topic}" not recognized.`);
        }
        if (!g.missingPrereq) {
          errs.push(`${gLabel}: missing "missingPrereq".`);
        } else if (!findTopicByName(g.missingPrereq)) {
          errs.push(`${gLabel}: missingPrereq "${g.missingPrereq}" not recognized.`);
        }
        if (!g.evidence) {
          errs.push(`${gLabel}: missing "evidence".`);
        }
        result.prerequisiteGaps.push({
          topic: g.topic,
          missingPrereq: g.missingPrereq,
          evidence: g.evidence
        });
      });
    }
  }

  // tutorElaborationQuality
  if (data.tutorElaborationQuality !== undefined) {
    if (!Array.isArray(data.tutorElaborationQuality)) {
      errs.push("tutorElaborationQuality must be an array.");
    } else {
      result.tutorElaborationQuality = [];
      data.tutorElaborationQuality.forEach((q, idx) => {
        const qLabel = `tutorElaborationQuality[${idx}]`;
        if (!q.topic) {
          errs.push(`${qLabel}: missing "topic".`);
        } else if (!findTopicByName(q.topic)) {
          errs.push(`${qLabel}: topic "${q.topic}" not recognized.`);
        }
        const score = Number(q.score);
        if (!Number.isInteger(score) || score < 1 || score > 5) {
          errs.push(`${qLabel}: score must be an integer between 1 and 5.`);
        }
        result.tutorElaborationQuality.push({
          topic: q.topic,
          score: score,
          notes: q.notes || ''
        });
      });
    }
  }

  // nextSessionRecommendation
  if (data.nextSessionRecommendation !== undefined) {
    const rec = data.nextSessionRecommendation;
    if (typeof rec !== 'object' || Array.isArray(rec)) {
      errs.push("nextSessionRecommendation must be an object.");
    } else {
      const validSessionTypes = ["first-pass", "re-teach", "drill", "review", "interleaved", "test", "diagnostic", "mixed"];
      if (!rec.type || !validSessionTypes.includes(rec.type)) {
        errs.push(`nextSessionRecommendation: type must be one of: ${validSessionTypes.join(', ')}`);
      }
      if (!rec.reason) {
        errs.push("nextSessionRecommendation: missing \"reason\".");
      }
      if (rec.topics !== undefined) {
        if (!Array.isArray(rec.topics)) {
          errs.push("nextSessionRecommendation.topics must be an array.");
        } else {
          rec.topics.forEach((tName, idx) => {
            if (!findTopicByName(tName)) {
              warnings.push(`nextSessionRecommendation.topics[${idx}]: topic "${tName}" not recognized.`);
            }
          });
        }
      }
      if (rec.estimatedDurationMin !== undefined && (typeof rec.estimatedDurationMin !== 'number' || rec.estimatedDurationMin < 1)) {
        errs.push("nextSessionRecommendation.estimatedDurationMin must be a positive integer.");
      }

      result.nextSessionRecommendation = {
        type: rec.type,
        reason: rec.reason,
        topics: rec.topics || [],
        skipNewMaterial: !!rec.skipNewMaterial,
        estimatedDurationMin: rec.estimatedDurationMin || null
      };
    }
  }

  if(errs.length) return {ok:false,error:errs.join('\n')};
  if(!result.topicUpdates.length && !result.errorLog.length && !result.testResult && !result.ankiCards && !result.prerequisiteGaps)
    return {ok:false,error:'Nothing to import: no topicUpdates, errorLog, testResult, ankiCards or prerequisiteGaps found.'};
  
  // copy original properties for apply phase
  result.sessionDate = data.sessionDate;
  return {ok:true,data:result};
}

function renderImportPreview(data){
  let html='';
  // topic updates
  if(data.topicUpdates && data.topicUpdates.length){
    html+='<h3>Topic Updates</h3><table><tr><th>Topic</th><th>Field</th><th>Current</th><th></th><th>New</th></tr>';
    data.topicUpdates.forEach(u=>{
      if(u.skipped){
        html+=`<tr><td class="skip" colspan="5">${esc(u.topic)} — unmatched, will be skipped</td></tr>`;
        return;
      }
      const t=u.match;
      const r=u.raw;
      const rows=[];
      if(r.status) rows.push(['Status',t.status,r.status]);
      if(r.confidence!==undefined&&r.confidence!==null) rows.push(['Confidence',t.conf||'–',String(r.confidence)]);
      if(r.reviewed) rows.push(['Reviewed',t.reviewed||'–',r.reviewed]);
      if(!rows.length) rows.push(['','(no changes)','']);
      rows.forEach((row,ri)=>{
        html+=`<tr>
          ${ri===0?'<td rowspan="'+rows.length+'">'+esc(t.name)+'</td>':''}
          <td>${row[0]}</td>
          <td class="old">${esc(row[1])}</td>
          <td class="arrow">${row[0]?'→':''}</td>
          <td class="new">${esc(row[2])}</td>
        </tr>`;
      });
    });
    html+='</table>';
  }
  // error log
  if(data.errorLog && data.errorLog.length){
    const validErrors=data.errorLog.filter(e=>e.raw.topic&&e.raw.type&&e.raw.note);
    if(validErrors.length){
      html+='<h3>Error Log Entries</h3><table><tr><th>Topic</th><th>Type</th><th>Note</th></tr>';
      validErrors.forEach(e=>{
        html+=`<tr><td>${esc(e.raw.topic)}</td><td>${esc(e.raw.type)}</td><td style="font-style:italic;color:var(--muted)">${esc(e.raw.note)}</td></tr>`;
      });
      html+='</table>';
    }
  }
  // test result
  if(data.testResult){
    const t=data.testResult;
    const pct=t.outOf?Math.round(t.score/t.outOf*100):0;
    html+='<h3>Test Result</h3><table><tr><th>Topic</th><th>Type</th><th>Score</th><th>Verdict</th></tr>';
    html+=`<tr><td>${esc(t.topic || t.testId)}</td><td>${esc(t.type||'Topic Test')}</td>
      <td>${t.score}/${t.outOf} (${pct}%)</td>
      <td style="font-weight:600;color:${pct>=80?'var(--sage)':'var(--rose)'}">${pct>=80?'✓ Pass':'↻ Retry'}</td></tr>`;
    html+='</table>';
  }
  // anki cards
  if(data.ankiCards && data.ankiCards.length){
    html+='<h3>Anki Cards</h3><table><tr><th>Topic</th><th>Type</th><th>Front / Back</th></tr>';
    data.ankiCards.forEach(c=>{
      html+=`<tr><td>${esc(c.topic)}</td><td>${esc(c.type)}</td><td>
        <strong>F:</strong> ${esc(c.front)}<br/>
        <strong>B:</strong> ${esc(c.back)}
      </td></tr>`;
    });
    html+='</table>';
  }
  // prerequisite gaps
  if(data.prerequisiteGaps && data.prerequisiteGaps.length){
    html+='<h3>Prerequisite Gaps</h3><table><tr><th>Topic</th><th>Missing Prereq</th><th>Evidence</th></tr>';
    data.prerequisiteGaps.forEach(g=>{
      html+=`<tr><td>${esc(g.topic)}</td><td>${esc(g.missingPrereq)}</td><td style="font-style:italic;">${esc(g.evidence)}</td></tr>`;
    });
    html+='</table>';
  }
  // next session recommendation
  if(data.nextSessionRecommendation){
    const rec = data.nextSessionRecommendation;
    html+='<h3>Next Session Recommendation</h3><table><tr><th>Type</th><th>Reason</th><th>Skip New?</th></tr>';
    html+=`<tr><td><span class="shape-pill" style="background:var(--gold-soft);color:var(--ink);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;">${esc(rec.type)}</span></td><td>${esc(rec.reason)}</td><td>${rec.skipNewMaterial?'Yes':'No'}</td></tr>`;
    html+='</table>';
  }
  // warnings
  if(data.warnings && data.warnings.length){
    html+='<h3 style="color:var(--rose)">Import Warnings</h3><ul style="color:var(--rose);font-family:\'Newsreader\';font-size:13px;line-height:1.4">';
    data.warnings.forEach(w=>{
      html+=`<li>${esc(w)}</li>`;
    });
    html+='</ul>';
  }
  return html;
}

function mergeMarking(parsed) {
  const activeTest = state.activeTest;
  if (!activeTest || activeTest.testId !== parsed.testResult.testId) {
    return { error: "testId does not match active test" };
  }

  const markedQs = parsed.testResult.questions || [];
  const merged = activeTest.questions.map(q => {
    const m = markedQs.find(x => x.n === q.n);
    return {
      ...q,
      timeSec: Math.round((q.durationMs || 0) / 1000),
      score: m ? m.score : 0,
      errorType: m ? m.errorType : null,
      errorNote: m ? m.errorNote : null,
      testId: activeTest.testId,
      testDate: parsed.sessionDate || todayStr()
    };
  });

  // Push question records to state.questionResults
  state.questionResults.push(...merged);

  // Push canonical test record to state.tests (marks count once)
  state.tests.push({
    date: parsed.sessionDate || todayStr(),
    testId: activeTest.testId,
    topic: activeTest.title,
    type: activeTest.type,
    score: merged.reduce((s, q) => s + (q.score || 0), 0),
    outOf: activeTest.totalMarks,
    confidence: parsed.testResult.confidence || null,
    note: parsed.testResult.note || ''
  });

  // recordReview on each question's primaryTopic ONLY (not topics[])
  merged.forEach(q => {
    if (q.score === null) return;
    const topic = findTopicByName(q.primaryTopic);
    if (!topic) return;
    const pct = q.score / q.outOf;
    const mappedConf = Math.max(1, Math.min(5, Math.round(pct * 5)));
    const source = pct >= 0.8 ? 'test-pass' : 'test-fail';
    recordReview(topic, mappedConf, source, pct);
  });

  // Generate errors from lost marks for questions with errorType !== 'none'
  merged.forEach(q => {
    if (q.errorType && q.errorType !== 'none' && q.errorNote) {
      state.errors.push({
        date: parsed.sessionDate || todayStr(),
        topic: q.primaryTopic,
        type: q.errorType,
        wrong: q.errorNote,
        status: 'active',
        sourceTestId: activeTest.testId
      });
    }
  });

  // Clear the active test
  state.activeTest = null;
}

function applyImport(data){
  let topicCount=0,errorCount=0,testCount=0;
  // apply topic updates
  if (data.topicUpdates) {
    data.topicUpdates.forEach(u=>{
      if(u.skipped||!u.match)return;
      const t=u.match;
      const r=u.raw;
      let changed=false;
      if(r.status && VALID_STATUSES.includes(r.status)){t.status=r.status;changed=true;}
      if(r.confidence!==undefined&&r.confidence!==null){
        const c=Number(r.confidence);
        if(Number.isInteger(c)&&c>=1&&c<=5){t.conf=String(c);changed=true;}
      }
      if(r.reviewed && /^\d{4}-\d{2}-\d{2}$/.test(r.reviewed)){t.reviewed=r.reviewed;changed=true;}
      if(changed){
        recordReview(t,t.conf||2,'tutor');
        topicCount++;
      }
    });
  }
  // append error log entries
  if (data.errorLog) {
    data.errorLog.forEach(e=>{
      const r=e.raw;
      if(!r.topic||!r.type||!r.note)return;
      state.errors.push({date:r.date||todayStr(),topic:r.topic.trim(),type:r.type,note:r.note});
      errorCount++;
    });
  }

  // Intercept merge marking
  let mergedMarking = false;
  if (data.testResult && data.testResult.testId) {
    const activeTest = state.activeTest;
    if (activeTest && activeTest.testId === data.testResult.testId) {
      mergeMarking(data);
      mergedMarking = true;
      testCount++;
    }
  }

  // append test result
  if(data.testResult && !mergedMarking){
    const t=data.testResult;
    if(t.topic && t.outOf>=1){
      state.tests.push({
        date:t.date||todayStr(),topic:t.topic.trim(),
        type:t.type||'Topic Test',score:Number(t.score),
        outOf:Number(t.outOf),
        confidence:t.confidence!==undefined?Number(t.confidence):null,
        note:t.note||''
      });
      testCount++;
    }
  }

  // append cards
  if (data.ankiCards) {
    data.ankiCards.forEach(c => {
      const idx = state.cards.findIndex(card => card.id === c.id);
      if (idx !== -1) {
        state.cards[idx] = { ...state.cards[idx], ...c };
      } else {
        state.cards.push(c);
      }
    });
  }

  // append questionResults
  if (data.testResult && data.testResult.questions && !mergedMarking) {
    data.testResult.questions.forEach(q => {
      state.questionResults.push({
        ...q,
        testId: data.testResult.testId || `t-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
        testDate: data.sessionDate || todayStr()
      });
    });
  }

  // append prerequisiteGaps
  if (data.prerequisiteGaps) {
    data.prerequisiteGaps.forEach(g => {
      state.prereqGaps.push({
        ...g,
        date: data.sessionDate || todayStr()
      });
    });
  }

  // push sessions log
  const topicUpdatesCount = data.topicUpdates ? data.topicUpdates.filter(u=>!u.skipped).length : 0;
  const errorLogCount = data.errorLog ? data.errorLog.length : 0;
  const cardsCount = data.ankiCards ? data.ankiCards.length : 0;
  const questionsCount = (data.testResult && data.testResult.questions) ? data.testResult.questions.length : 0;

  state.sessions.push({
    date: data.sessionDate || todayStr(),
    type: data.sessionType || null,
    durationMin: data.sessionDurationMin || null,
    focusTopics: data.sessionFocusTopics || [],
    counts: {
      topicUpdates: topicUpdatesCount,
      errors: errorLogCount,
      cards: cardsCount,
      questions: questionsCount
    },
    nextRecommendation: data.nextSessionRecommendation || null,
    importedAt: new Date().toISOString()
  });

  return {topicCount,errorCount,testCount};
}

// UI wiring
document.getElementById('openImport').addEventListener('click',()=>{
  document.getElementById('importJsonTa').value='';
  document.getElementById('importError').classList.remove('show');
  document.getElementById('importPreview').classList.remove('show');
  document.getElementById('importPreview').innerHTML='';
  document.getElementById('importApplyBtn').style.display='none';
  document.getElementById('importApplyBtn').disabled=false;
  document.getElementById('importPreviewBtn').style.display='';
  _importParsed=null;
  document.getElementById('importModal').classList.add('open');
});

document.getElementById('importPreviewBtn').addEventListener('click',()=>{
  const raw=document.getElementById('importJsonTa').value.trim();
  const errEl=document.getElementById('importError');
  const prevEl=document.getElementById('importPreview');
  if(!raw){
    errEl.textContent='Paste a JSON block first.';errEl.classList.add('show');
    prevEl.classList.remove('show');return;
  }
  const v=validateImport(raw);
  if(!v.ok){
    errEl.textContent=v.error;errEl.classList.add('show');
    prevEl.classList.remove('show');
    document.getElementById('importApplyBtn').style.display='none';
    _importParsed=null;return;
  }
  errEl.classList.remove('show');
  prevEl.innerHTML=renderImportPreview(v.data);
  prevEl.classList.add('show');
  _importParsed=v.data;
  document.getElementById('importApplyBtn').style.display='';
  document.getElementById('importApplyBtn').disabled=false;
  document.getElementById('importPreviewBtn').style.display='none';
});

document.getElementById('importApplyBtn').addEventListener('click',async()=>{
  if(!_importParsed)return;
  const btn=document.getElementById('importApplyBtn');
  btn.disabled=true;btn.textContent='Applying…';
  const {topicCount,errorCount,testCount}=applyImport(_importParsed);
  scheduleAutosave();
  const a=await saveTopics();
  const b=await saveTests();
  const c=await saveErrors();
  const d=await saveCards();
  const e=await saveQuestionResults();
  const f=await saveSessions();
  const g=await savePrereqGaps();
  const h=await saveActiveTest();
  const i=await saveDismissedRecommendations();
  // re-render everything
  renderHome();renderTracker();renderTests();renderErrors();
  // close modal
  document.getElementById('importModal').classList.remove('open');
  _importParsed=null;
  // toast summary
  const parts=[];
  if(topicCount) parts.push(topicCount+' topic'+(topicCount>1?'s':''));
  if(errorCount) parts.push(errorCount+' error'+(errorCount>1?'s':''));
  if(testCount) parts.push(testCount+' test result'+(testCount>1?'s':''));
  const msg=parts.length?'Imported: '+parts.join(', '):'Nothing to apply';
  const success = a && b && c && d && e && f && g && h && i;
  toast(success?msg:'Applied, but save failed — export a backup',!success);
  btn.textContent='Apply changes';
});

// reset preview when textarea changes
document.getElementById('importJsonTa').addEventListener('input',()=>{
  document.getElementById('importPreview').classList.remove('show');
  document.getElementById('importApplyBtn').style.display='none';
  document.getElementById('importPreviewBtn').style.display='';
  document.getElementById('importError').classList.remove('show');
  _importParsed=null;
});

[document.getElementById('importClose'),document.getElementById('importCancelBtn')].forEach(b=>{
  b.addEventListener('click',()=>{document.getElementById('importModal').classList.remove('open');_importParsed=null;});
});
document.getElementById('importModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget){document.getElementById('importModal').classList.remove('open');_importParsed=null;}
});

// data modal & segmented controls
document.getElementById('openDataModal').addEventListener('click',()=>{
  document.getElementById('dataModal').classList.add('open');
});
document.getElementById('dataClose').addEventListener('click',()=>{
  document.getElementById('dataModal').classList.remove('open');
});
document.getElementById('dataModal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) document.getElementById('dataModal').classList.remove('open');
});
document.addEventListener('click',e=>{
  if(e.target.matches('.seg-btn')){
    const ctrl=e.target.closest('.seg-control');
    if(!ctrl)return;
    ctrl.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    ctrl.dataset.val=e.target.dataset.val;
  }
});

/* ---------- import errors (standalone array) ---------- */
let _errorImportParsed = null;

function validateErrorImport(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    return { ok: false, error: 'Invalid JSON: ' + e.message };
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: 'JSON must be a standalone array of error objects.' };
  }

  const errs = [];
  const validEntries = [];

  data.forEach((e, i) => {
    const label = 'errorLog[' + i + ']';
    if (!e.topic) errs.push(label + ': missing "topic".');
    if (!e.type) errs.push(label + ': missing "type".');
    else if (!VALID_ETYPES.includes(e.type)) {
      errs.push(label + ': type "' + e.type + '" not in [' + VALID_ETYPES.join(', ') + '].');
    }
    // Check for either the combined "note" format or the split "wrong/fix/watch" format
    if (!e.note && !e.wrong) errs.push(label + ': missing "wrong" or "note" description.');
    
    if (e.topic && e.type && (e.note || e.wrong)) {
      validEntries.push(e);
    }
  });

  if (errs.length) return { ok: false, error: errs.join('\n') };
  if (!validEntries.length) return { ok: false, error: 'No valid errors found to import.' };

  return { ok: true, data: validEntries };
}

function renderErrorImportPreview(entries) {
  let html = '<h3>Errors to Import</h3><table><tr><th>Topic</th><th>Type</th><th>Details</th></tr>';
  entries.forEach(e => {
    // Format perfectly for the Block 1 AI output
    const details = e.wrong 
      ? `<div style="margin-bottom:4px"><strong>Wrong:</strong> ${esc(e.wrong)}</div>
         <div style="margin-bottom:4px;color:var(--sage)"><strong>Fix:</strong> ${esc(e.fix || '')}</div>
         <div style="color:var(--gold)"><strong>Watch:</strong> ${esc(e.watch || '')}</div>` 
      : esc(e.note);
      
    html += `<tr>
      <td>${esc(e.topic)}</td>
      <td><span class="etype ${esc(e.type).toLowerCase()}" style="padding:2px 4px; border-radius:2px; font-size:10px">${esc(e.type)}</span></td>
      <td style="font-size:13px; line-height:1.4">${details}</td>
    </tr>`;
  });
  html += '</table>';
  return html;
}

// 1. Open Modal
const openErrorImportBtn = document.getElementById('openErrorImport');
if (openErrorImportBtn) {
  openErrorImportBtn.addEventListener('click', () => {
    document.getElementById('errorImportJsonTa').value = '';
    document.getElementById('errorImportError').classList.remove('show');
    document.getElementById('errorImportPreview').classList.remove('show');
    document.getElementById('errorImportPreview').innerHTML = '';
    document.getElementById('errorImportApplyBtn').style.display = 'none';
    document.getElementById('errorImportApplyBtn').disabled = false;
    document.getElementById('errorImportPreviewBtn').style.display = '';
    _errorImportParsed = null;
    document.getElementById('errorImportModal').classList.add('open');
  });
}

// 2. Preview Button
const errorImportPreviewBtn = document.getElementById('errorImportPreviewBtn');
if (errorImportPreviewBtn) {
  errorImportPreviewBtn.addEventListener('click', () => {
    const raw = document.getElementById('errorImportJsonTa').value.trim();
    const errEl = document.getElementById('errorImportError');
    const prevEl = document.getElementById('errorImportPreview');
    
    if (!raw) {
      errEl.textContent = 'Paste a JSON array first.'; errEl.classList.add('show');
      prevEl.classList.remove('show'); return;
    }
    
    const v = validateErrorImport(raw);
    if (!v.ok) {
      errEl.textContent = v.error; errEl.classList.add('show');
      prevEl.classList.remove('show');
      document.getElementById('errorImportApplyBtn').style.display = 'none';
      _errorImportParsed = null; return;
    }
    
    errEl.classList.remove('show');
    prevEl.innerHTML = renderErrorImportPreview(v.data);
    prevEl.classList.add('show');
    _errorImportParsed = v.data;
    document.getElementById('errorImportApplyBtn').style.display = '';
    document.getElementById('errorImportApplyBtn').disabled = false;
    document.getElementById('errorImportPreviewBtn').style.display = 'none';
  });
}

// 3. Apply Changes Button
const errorImportApplyBtn = document.getElementById('errorImportApplyBtn');
if (errorImportApplyBtn) {
  errorImportApplyBtn.addEventListener('click', async () => {
    if (!_errorImportParsed) return;
    const btn = document.getElementById('errorImportApplyBtn');
    btn.disabled = true; btn.textContent = 'Applying…';
    
    let added = 0;
    _errorImportParsed.forEach(e => {
      state.errors.push({
        id: e.id || null,
        date: e.date || todayStr(),
        topic: e.topic.trim(),
        type: e.type,
        wrong: e.wrong || '',
        fix: e.fix || '',
        watch: e.watch || '',
        note: e.note || '', // Support both schemas
        status: 'active',
        closedDate: ''
      });
      added++;
    });

    scheduleAutosave();
    const ok = await saveErrors();
    
    // Re-render UI
    renderErrors();
    renderHome();
    if (typeof renderCharts === 'function') renderCharts();
    
    document.getElementById('errorImportModal').classList.remove('open');
    _errorImportParsed = null;
    toast(ok ? `Imported ${added} error${added !== 1 ? 's' : ''}` : 'Applied, but save failed', !ok);
    btn.textContent = 'Apply changes';
  });
}

// 4. Reset state when typing
const errorImportJsonTa = document.getElementById('errorImportJsonTa');
if (errorImportJsonTa) {
  errorImportJsonTa.addEventListener('input', () => {
    document.getElementById('errorImportPreview').classList.remove('show');
    document.getElementById('errorImportApplyBtn').style.display = 'none';
    document.getElementById('errorImportPreviewBtn').style.display = '';
    document.getElementById('errorImportError').classList.remove('show');
    _errorImportParsed = null;
  });
}

// 5. Close Modals
['errorImportClose', 'errorImportCancelBtn'].forEach(id => {
  const b = document.getElementById(id);
  if (b) {
    b.addEventListener('click', () => {
      document.getElementById('errorImportModal').classList.remove('open');
      _errorImportParsed = null;
    });
  }
});

const errorImportModal = document.getElementById('errorImportModal');
if (errorImportModal) {
  errorImportModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('errorImportModal').classList.remove('open');
      _errorImportParsed = null;
    }
  });
}

function checkMisconceptionIntercept(topicName, onProceed, onCancel) {
  if (hasPersistentMisconception(topicName)) {
    toast(`Topic progress is blocked: Persistent Misconception`, true);
    if (onCancel) onCancel();
    openForcedRetrievalModal(topicName);
    return true;
  }
  
  const activeConc = state.errors.filter(e => e.topic.toLowerCase() === topicName.toLowerCase() && e.type === 'Conceptual' && e.status === 'active');
  if (activeConc.length > 0) {
    openInterrogationModal(topicName, onProceed, onCancel);
    return true;
  }
  
  return false;
}

function openInterrogationModal(topicName, onProceed, onCancel) {
  const modal = document.getElementById('reviewInterrogationModal');
  const list = document.getElementById('interrogationList');
  const confirmBtn = document.getElementById('interrogationConfirmBtn');
  const cancelBtn = document.getElementById('interrogationCancelBtn');
  const closeBtn = document.getElementById('interrogationClose');
  
  if (!modal || !list || !confirmBtn) return;
  
  const activeConc = state.errors.filter(e => e.topic.toLowerCase() === topicName.toLowerCase() && e.type === 'Conceptual' && e.status === 'active');
  
  list.innerHTML = activeConc.map(e => `
    <div style="background:var(--paper-warm); border-left:3px solid var(--gold-bright); padding:10px 12px; font-family:'Newsreader'; font-size:14px; border-radius:3px;">
      <div style="font-weight:600; color:var(--gold); font-size:11px; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">Conceptual Error</div>
      <div><strong>What went wrong:</strong> ${esc(e.wrong||e.note)}</div>
      <div style="margin-top:6px; color:var(--ink-soft); font-style:italic;"><strong>Correct Mental Model:</strong> ${esc(e.fix||e.mentalModel)}</div>
      ${ (e.watch||e.watchFor) ? `<div style="margin-top:4px; color:var(--muted); font-style:italic;"><strong>Watch for:</strong> ${esc(e.watch||e.watchFor)}</div>` : ''}
    </div>
  `).join('');
  
  modal.classList.add('open');
  
  const cleanUp = () => {
    modal.classList.remove('open');
  };
  
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  
  newConfirm.addEventListener('click', async () => {
    cleanUp();
    state.errors.forEach(e => {
      if (e.topic.toLowerCase() === topicName.toLowerCase() && e.type === 'Conceptual' && e.status === 'active') {
        e.status = 'closed';
        e.closedDate = todayStr();
      }
    });
    scheduleAutosave();
    await saveErrors();
    renderErrors();
    if (typeof renderCharts === 'function') renderCharts();
    if (onProceed) onProceed();
  });
  
  const handleCancel = () => {
    cleanUp();
    if (onCancel) onCancel();
  };
  
  [cancelBtn, closeBtn].forEach(b => {
    if (b) {
      const newB = b.cloneNode(true);
      b.parentNode.replaceChild(newB, b);
      newB.addEventListener('click', handleCancel);
    }
  });
}

function openForcedRetrievalModal(topicName) {
  const modal = document.getElementById('forcedRetrievalModal');
  const list = document.getElementById('forcedRetrievalList');
  const reflect = document.getElementById('forcedRetrievalReflect');
  const confirmBtn = document.getElementById('forcedRetrievalConfirmBtn');
  const cancelBtn = document.getElementById('forcedRetrievalCancelBtn');
  const closeBtn = document.getElementById('forcedRetrievalClose');
  
  if (!modal || !list || !reflect || !confirmBtn) return;
  
  reflect.value = '';
  const active = getActiveErrors(topicName);
  
    list.innerHTML = active.map(e => {
    const mmText = (e.fix||e.mentalModel) ? `<div style="font-style:italic; font-size:12px; color:var(--muted); margin-top:2px;">🧠 Model: ${esc(e.fix||e.mentalModel)}</div>` : '';
    const watchText = (e.watch||e.watchFor) ? `<div style="font-style:italic; font-size:12px; color:var(--gold); margin-top:2px;">Watch for: ${esc(e.watch||e.watchFor)}</div>` : '';
    return `<div style="background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; padding:10px 12px; font-family:'Newsreader'; font-size:14px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="font-weight:600; color:var(--rose); font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">${esc(e.type)}</span>
        <span style="color:var(--muted); font-size:11px;">${esc(e.date)}</span>
      </div>
      <div><strong>What went wrong:</strong> ${esc(e.wrong||e.note)}</div>
      ${mmText}
      ${watchText}
    </div>`;
  }).join('');
  
  modal.classList.add('open');
  
  const cleanUp = () => {
    modal.classList.remove('open');
  };
  
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  
  newConfirm.addEventListener('click', async () => {
    const reflectionText = reflect.value.trim();
    if (!reflectionText) {
      toast('Please write a brief self-correction note to close the loop', true);
      return;
    }
    
    state.errors.forEach(e => {
      if (e.topic.toLowerCase() === topicName.toLowerCase() && e.status === 'active') {
        e.status = 'closed';
        e.closedDate = todayStr();
        e.reflection = reflectionText;
      }
    });
    
    scheduleAutosave();
    const ok = await saveErrors();
    toast(ok ? 'Retrieval session completed!' : 'Saved locally, but server failed', !ok);
    cleanUp();
    renderHome();
    renderTracker();
    renderErrors();
    if (typeof renderCharts === 'function') renderCharts();
  });
  
  [cancelBtn, closeBtn].forEach(b => {
    if (b) {
      const newB = b.cloneNode(true);
      b.parentNode.replaceChild(newB, b);
      newB.addEventListener('click', cleanUp);
    }
  });
}

/* ---------- KEYBOARD SHORTCUTS & COMMAND PALETTE ---------- */

// Modal handlers
function toggleHelpModal() {
  const modal = document.getElementById('helpModal');
  if (!modal) return;
  modal.classList.toggle('open');
}

function closeHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) modal.classList.remove('open');
}

// Help Modal close event wire up
const helpCloseBtn = document.getElementById('helpClose');
if (helpCloseBtn) {
  helpCloseBtn.addEventListener('click', closeHelpModal);
}
const helpModalEl = document.getElementById('helpModal');
if (helpModalEl) {
  helpModalEl.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHelpModal();
  });
}

// Start here logic
function getStartHereTopic() {
  const next = state.topics.filter(t => t.status !== "Mastered");
  return next.length ? next[0] : null;
}

async function markStartHereReviewed(confidence) {
  const tp = getStartHereTopic();
  if (!tp) {
    toast('No active topic to review!', true);
    return;
  }
  
  // Set default confidence if none provided (fall back to current topic conf or 2)
  const conf = confidence || parseInt(tp.conf) || 2;
  
  // Move status out of Not Started
  if (tp.status === 'Not Started') {
    tp.status = 'Learning';
  }
  tp.conf = String(conf);
  tp.reviewed = todayStr();
  
  recordReview(tp, conf, 'study');
  scheduleAutosave();
  const ok = await saveTopics();
  toast(`Marked "${tp.name}" reviewed (confidence ${conf})`, !ok);
  
  renderHome();
  updateTrackerRow(tp.id);
}

// Command Palette Search & Navigation
let paletteActiveIndex = -1;
let paletteTopics = [];

function openCommandPalette() {
  const modal = document.getElementById('commandPaletteModal');
  if (!modal) return;
  
  // Close other modals
  closeHelpModal();
  const importModal = document.getElementById('importModal');
  if (importModal) importModal.classList.remove('open');
  const dataModal = document.getElementById('dataModal');
  if (dataModal) dataModal.classList.remove('open');
  const briefModal = document.getElementById('briefModal');
  if (briefModal) briefModal.classList.remove('open');
  
  modal.classList.add('open');
  const input = document.getElementById('paletteSearch');
  if (input) {
    input.value = '';
    input.focus();
  }
  paletteActiveIndex = 0;
  renderPaletteResults();
}

function closeCommandPalette() {
  const modal = document.getElementById('commandPaletteModal');
  if (modal) modal.classList.remove('open');
}

function renderPaletteResults() {
  const input = document.getElementById('paletteSearch');
  const query = input ? input.value.toLowerCase().trim() : '';
  const resultsDiv = document.getElementById('paletteResults');
  if (!resultsDiv) return;
  
  // Fuzzy filter by name or section name
  paletteTopics = state.topics.filter(t => 
    !query || t.name.toLowerCase().includes(query) || t.section.toLowerCase().includes(query)
  );
  
  if (!paletteTopics.length) {
    resultsDiv.innerHTML = '<div class="empty-note" style="padding: 12px; text-align: center;">No topics match search.</div>';
    paletteActiveIndex = -1;
    return;
  }
  
  // Keep active index in bounds
  if (paletteActiveIndex >= paletteTopics.length) {
    paletteActiveIndex = paletteTopics.length - 1;
  }
  if (paletteActiveIndex < 0 && paletteTopics.length > 0) {
    paletteActiveIndex = 0;
  }
  
  resultsDiv.innerHTML = paletteTopics.map((t, idx) => {
    const selectClass = `s-${t.status.replace(' ', '')}`;
    const isSelected = idx === paletteActiveIndex;
    return `<div class="palette-item ${isSelected ? 'selected' : ''}" data-idx="${idx}" tabindex="0">
      <div>
        <div style="font-weight: 500;">${esc(t.name)}</div>
        <div class="meta">${esc(t.section.replace(/Section \d+ — /, ''))} · Page ${t.page}</div>
      </div>
      <span class="badge ${selectClass}">${t.status}</span>
    </div>`;
  }).join('');
}

function scrollPaletteItemIntoView() {
  const resultsDiv = document.getElementById('paletteResults');
  if (!resultsDiv) return;
  const activeEl = resultsDiv.querySelector('.palette-item.selected');
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest' });
  }
}

function handlePaletteSelect(idx) {
  const t = paletteTopics[idx];
  if (!t) return;
  closeCommandPalette();
  
  // Jump to tracker tab
  const trackerTab = document.getElementById('tab-tracker');
  if (trackerTab) {
    trackerTab.click();
  }
  
  // Ensure openSections is initialized and expanded
  if (openSections === null) {
    loadOpenSections();
  }
  if (!openSections.has(t.section)) {
    openSections.add(t.section);
    saveOpenSections();
    renderTracker();
  }
  
  // Scroll and highlight
  setTimeout(() => {
    const row = document.getElementById(`row-${t.id}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.remove('highlight-flash');
      void row.offsetWidth; // Reflow to restart animation
      row.classList.add('highlight-flash');
      
      const select = row.querySelector('select[data-f="status"]');
      if (select) select.focus();
    }
  }, 120);
}

// Palette Events
const paletteSearch = document.getElementById('paletteSearch');
if (paletteSearch) {
  paletteSearch.addEventListener('input', () => {
    paletteActiveIndex = 0;
    renderPaletteResults();
  });
  
  paletteSearch.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (paletteTopics.length > 0) {
        paletteActiveIndex = (paletteActiveIndex + 1) % paletteTopics.length;
        renderPaletteResults();
        scrollPaletteItemIntoView();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (paletteTopics.length > 0) {
        paletteActiveIndex = (paletteActiveIndex - 1 + paletteTopics.length) % paletteTopics.length;
        renderPaletteResults();
        scrollPaletteItemIntoView();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (paletteActiveIndex >= 0 && paletteActiveIndex < paletteTopics.length) {
        handlePaletteSelect(paletteActiveIndex);
      }
    }
  });
}

const paletteResults = document.getElementById('paletteResults');
if (paletteResults) {
  paletteResults.addEventListener('click', e => {
    const item = e.target.closest('.palette-item');
    if (item) {
      const idx = parseInt(item.dataset.idx);
      handlePaletteSelect(idx);
    }
  });
}

const paletteModalEl = document.getElementById('commandPaletteModal');
if (paletteModalEl) {
  paletteModalEl.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCommandPalette();
  });
}

// Sequence detection
let keySequenceBuffer = '';
let sequenceTimer = null;

// Global Keyboard Shortcut router
document.addEventListener('keydown', e => {
  const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
  
  // Esc is global
  if (e.key === 'Escape') {
    if (isInput) {
      e.target.blur();
    }
    closeHelpModal();
    closeCommandPalette();
    closeTopicDrawer();
    // Close other modal overlays
    const importModal = document.getElementById('importModal');
    if (importModal) importModal.classList.remove('open');
    const dataModal = document.getElementById('dataModal');
    if (dataModal) dataModal.classList.remove('open');
    const briefModal = document.getElementById('briefModal');
    if (briefModal) briefModal.classList.remove('open');
    const riModal = document.getElementById('reviewInterrogationModal');
    if (riModal) riModal.classList.remove('open');
    const frModal = document.getElementById('forcedRetrievalModal');
    if (frModal) frModal.classList.remove('open');
    return;
  }
  
  // Ctrl+K / Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandPalette();
    return;
  }
  
  if (isInput) return;
  
  // Sequence handling
  if (e.key.toLowerCase() === 'g') {
    keySequenceBuffer = 'g';
    clearTimeout(sequenceTimer);
    sequenceTimer = setTimeout(() => { keySequenceBuffer = ''; }, 600);
    return;
  }
  
  if (keySequenceBuffer === 'g') {
    const tabMap = {
      't': 'tab-tracker',
      'h': 'tab-home',
      's': 'tab-tests',
      'p': 'tab-charts',
      'l': 'tab-timeline'
    };
    const tabId = tabMap[e.key.toLowerCase()];
    if (tabId) {
      e.preventDefault();
      const tabEl = document.getElementById(tabId);
      if (tabEl) {
        tabEl.click();
        tabEl.focus();
      }
      keySequenceBuffer = '';
      return;
    }
    keySequenceBuffer = '';
  }
  
  // Single-key globals
  if (e.key === '?') {
    e.preventDefault();
    toggleHelpModal();
    return;
  }
  
  if (e.key === '/') {
    e.preventDefault();
    const trackerTab = document.getElementById('tab-tracker');
    if (trackerTab) {
      trackerTab.click();
    }
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    return;
  }
  
  if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    markStartHereReviewed();
    return;
  }
  
  if (e.key >= '1' && e.key <= '5') {
    e.preventDefault();
    markStartHereReviewed(parseInt(e.key));
    return;
  }
});

/* ---------- TOPIC SIDE DRAWER ---------- */
function openTopicDrawer(topic) {
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer = document.getElementById('topicDrawer');
  if (!backdrop || !drawer) return;

  // Close other modals
  closeHelpModal();
  closeCommandPalette();

  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open');
  backdrop.classList.add('open');

  document.getElementById('drawerKicker').textContent = `CGP SECTION ${topic.section.replace(/Section \d+ — /, '')} · Page ${topic.page}`;
  document.getElementById('drawerTitle').textContent = topic.name;

  renderDrawerBody(topic);
}

function closeTopicDrawer() {
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer = document.getElementById('topicDrawer');
  if (!backdrop || !drawer) return;

  drawer.setAttribute('aria-hidden', 'true');
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
}

function renderDrawerBody(topic) {
  const body = document.getElementById('drawerBody');
  if (!body) return;

  const topicErrors = state.errors.filter(e => e.topic.toLowerCase() === topic.name.toLowerCase());
  const topicTests = state.tests.filter(t => t.topic.toLowerCase() === topic.name.toLowerCase());

  const totalReviews = (topic.reviewHistory || []).length;
  const lastReviewed = topic.reviewed ? fmtDate(new Date(topic.reviewed)) : 'Never';
  const currentConfidence = topic.conf ? topic.conf : '–';
  const studyTime = formatStudyTime(getTopicStudySeconds(topic));
  const isTimingThisTopic = activeTopicTimerId === topic.id;
  const studySignal = getTopicStudySignal(topic);
  const statusHtml = `<span class="badge s-${topic.status.replace(' ', '')}" style="display:inline-block; margin-top:2px;">${topic.status.toUpperCase()}</span>`;

  const sparklineSvg = generateSparklineSvg(topic.reviewHistory || []);
  const retentionSvg = generateTopicRetentionCurveSvg(topic);

  // 1. Prereq Gaps Section
  const lowerName = topic.name.toLowerCase();
  const gaps = state.prereqGaps ? state.prereqGaps.filter(g => g.topic.toLowerCase() === lowerName) : [];
  const dependents = state.prereqGaps ? state.prereqGaps.filter(g => g.missingPrereq.toLowerCase() === lowerName) : [];
  
  let prereqHtml = '';
  if (gaps.length || dependents.length) {
    prereqHtml += `<div class="drawer-section"><div class="drawer-section-title">Prerequisite Gaps & Dependencies</div>`;
    if (gaps.length) {
      prereqHtml += `<div style="font-family:'Newsreader'; font-size:13px; color:var(--ink-soft); margin-bottom:6px;"><strong>Weak Prerequisites:</strong></div>`;
      gaps.forEach(g => {
        const pt = state.topics.find(x => x.name.toLowerCase() === g.missingPrereq.toLowerCase());
        const link = pt ? `<span class="clickable-topic" data-id="${pt.id}" style="color:var(--gold); font-weight:600; text-decoration:underline;">${esc(g.missingPrereq)}</span>` : `<strong>${esc(g.missingPrereq)}</strong>`;
        prereqHtml += `<div style="font-family:'Newsreader'; font-size:12.5px; color:var(--ink-soft); margin-left:10px; margin-bottom:4px;">▸ ${link}: <span style="font-style:italic; color:var(--muted);">${esc(g.evidence)}</span></div>`;
      });
    }
    if (dependents.length) {
      prereqHtml += `<div style="font-family:'Newsreader'; font-size:13px; color:var(--ink-soft); margin-top:6px; margin-bottom:4px;"><strong>Depended on by:</strong></div>`;
      dependents.forEach(g => {
        const pt = state.topics.find(x => x.name.toLowerCase() === g.topic.toLowerCase());
        const link = pt ? `<span class="clickable-topic" data-id="${pt.id}" style="color:var(--gold); font-weight:600; text-decoration:underline;">${esc(g.topic)}</span>` : `<strong>${esc(g.topic)}</strong>`;
        prereqHtml += `<div style="font-family:'Newsreader'; font-size:12.5px; color:var(--ink-soft); margin-left:10px; margin-bottom:2px;">▸ ${link} <span style="font-size:11px; color:var(--muted); font-style:italic;">(observed gap)</span></div>`;
      });
    }
    prereqHtml += `</div>`;
  }

  // 2. Anki Cards list
  const topicCards = state.cards ? state.cards.filter(c => c.topic.toLowerCase() === lowerName) : [];
  let cardsHtml = '';
  if (topicCards.length) {
    cardsHtml += `
      <div class="drawer-section">
        <div class="drawer-section-title">Anki Flashcards (${topicCards.length})</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${topicCards.map(c => {
            let backlinkHtml = '';
            if (c.linkedErrorId) {
              const matchedErr = state.errors.find(e => e.id === c.linkedErrorId);
              if (matchedErr) {
                const shortWrong = (matchedErr.wrong || matchedErr.note || '').substring(0, 40);
                backlinkHtml = `<div style="font-size:10px; color:var(--muted); font-family:'Newsreader'; font-style:italic; margin-top:4px;">→ from error: "${esc(shortWrong)}..."</div>`;
              }
            }
            return `
              <div style="background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; padding:10px; font-family:'Newsreader'; font-size:13.5px;">
                <div style="font-weight:600; color:var(--gold); margin-bottom:2px;">Front:</div>
                <div style="color:var(--ink);">${esc(c.front)}</div>
                <div style="height:1px; background:var(--line); margin:6px 0;"></div>
                <div style="font-weight:600; color:var(--sage); margin-bottom:2px;">Back:</div>
                <div style="color:var(--ink-soft);">${esc(c.back)}</div>
                ${backlinkHtml}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    cardsHtml += `
      <div class="drawer-section">
        <div class="drawer-section-title">Anki Flashcards</div>
        <div class="drawer-empty">No flashcards imported for this topic.</div>
      </div>
    `;
  }

  // 3. Sub-scores table
  const qrMatching = state.questionResults ? state.questionResults.filter(q => {
    const qTopics = Array.isArray(q.topics) ? q.topics : [q.primaryTopic];
    return qTopics.some(t => t.toLowerCase() === lowerName);
  }) : [];

  let subscoresHtml = '';
  if (qrMatching.length) {
    const groups = {};
    qrMatching.forEach(q => {
      if (!groups[q.testId]) {
        groups[q.testId] = {
          testId: q.testId,
          date: q.testDate || '—',
          questions: []
        };
      }
      groups[q.testId].questions.push(q);
    });

    subscoresHtml += `
      <div class="drawer-section">
        <div class="drawer-section-title">Topic Sub-scores by Test</div>
        <table style="width:100%; border-collapse:collapse; font-family:'Newsreader'; font-size:13px; margin-top:4px;">
          <thead>
            <tr style="border-bottom:2px solid var(--gold-soft); text-align:left;">
              <th style="padding:4px; font-family:'Fraunces'; font-size:10px; text-transform:uppercase; color:var(--gold);">Test Date / ID</th>
              <th style="padding:4px; font-family:'Fraunces'; font-size:10px; text-transform:uppercase; color:var(--gold); text-align:center;">Score</th>
              <th style="padding:4px; font-family:'Fraunces'; font-size:10px; text-transform:uppercase; color:var(--gold); text-align:center;">Avg Time</th>
              <th style="padding:4px; font-family:'Fraunces'; font-size:10px; text-transform:uppercase; color:var(--gold); text-align:center;">Type</th>
            </tr>
          </thead>
          <tbody>
    `;

    Object.values(groups).forEach(g => {
      const totalScore = g.questions.reduce((sum, q) => sum + (q.score || 0), 0);
      const totalOutOf = g.questions.reduce((sum, q) => sum + (q.outOf || 0), 0);
      const times = g.questions.filter(q => q.timeSec !== null && q.timeSec !== undefined).map(q => q.timeSec);
      const avgTimeStr = times.length ? `${Math.round(times.reduce((s, t) => s + t, 0) / times.length)}s` : '—';
      const isPrimary = g.questions.some(q => q.primaryTopic.toLowerCase() === lowerName);
      const typeIndicator = isPrimary ? `<span title="Primary tested topic" style="color:var(--gold); font-size:12px;">★</span>` : `<span title="Secondary topic coverage" style="color:var(--muted); font-size:12px;">☆</span>`;

      subscoresHtml += `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:6px 4px; color:var(--ink-soft); font-family:monospace; font-size:11px;">
            ${esc(g.date)} <br/>
            <span style="color:var(--muted); font-size:9px;">${esc(g.testId.substring(0, 10))}</span>
          </td>
          <td style="padding:6px 4px; text-align:center; font-weight:600; color:${totalScore/totalOutOf >= 0.8 ? 'var(--sage)' : 'var(--rose)'}">
            ${totalScore}/${totalOutOf} (${Math.round(totalScore/totalOutOf * 100)}%)
          </td>
          <td style="padding:6px 4px; text-align:center; color:var(--ink-soft);">${avgTimeStr}</td>
          <td style="padding:6px 4px; text-align:center;">${typeIndicator}</td>
        </tr>
      `;
    });

    subscoresHtml += `
          </tbody>
        </table>
      </div>
    `;
  }

  // 4. Speed-accuracy scatter plot SVG
  let speedAccuracyHtml = '';
  const timedQr = qrMatching.filter(q => q.timeSec !== null && q.timeSec !== undefined && q.timeSec > 0);
  
  speedAccuracyHtml += `<div class="drawer-section"><div class="drawer-section-title">Speed vs Accuracy</div>`;
  
  if (timedQr.length < 5) {
    speedAccuracyHtml += `<div class="drawer-empty" style="text-align:center; padding:10px 0;">Requires 5+ timed question results to plot speed-accuracy (current: ${timedQr.length}).</div>`;
  } else {
    const width = 360;
    const height = 180;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 30;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const times = timedQr.map(q => q.timeSec);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const useLog = (maxTime / minTime) > 10;

    const getX = (tSec) => {
      if (useLog) {
        return paddingLeft + (Math.log(tSec) - Math.log(minTime)) / (Math.log(maxTime) - Math.log(minTime)) * plotWidth;
      } else {
        return paddingLeft + (tSec - minTime) / (maxTime - minTime) * plotWidth;
      }
    };
    const getY = (score, outOf) => {
      const pct = outOf ? (score / outOf) : 0;
      return paddingTop + (1 - pct) * plotHeight;
    };

    let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="overflow:visible; background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; margin-top:6px;">`;
    
    [0, 25, 50, 75, 100].forEach(pct => {
      const yVal = getY(pct, 100);
      svg += `<line x1="${paddingLeft}" y1="${yVal}" x2="${width - paddingRight}" y2="${yVal}" stroke="rgba(229,221,200,0.5)" stroke-width="1" />`;
      svg += `<text x="${paddingLeft - 6}" y="${yVal + 3}" font-family="'Newsreader'" font-size="8px" fill="var(--muted)" text-anchor="end">${pct}%</text>`;
    });

    const tickTimes = useLog 
      ? [minTime, Math.sqrt(minTime * maxTime), maxTime] 
      : [minTime, (minTime + maxTime) / 2, maxTime];
    
    tickTimes.forEach(tVal => {
      const xVal = getX(tVal);
      const rounded = Math.round(tVal);
      svg += `<line x1="${xVal}" y1="${paddingTop}" x2="${xVal}" y2="${height - paddingBottom}" stroke="rgba(229,221,200,0.5)" stroke-width="1" />`;
      svg += `<text x="${xVal}" y="${height - paddingBottom + 12}" font-family="'Newsreader'" font-size="8px" fill="var(--muted)" text-anchor="middle">${rounded}s</text>`;
    });

    svg += `<text x="${paddingLeft + plotWidth / 2}" y="${height - 6}" font-family="'Newsreader'" font-size="9px" fill="var(--muted)" text-anchor="middle" font-weight="600">Question Duration (${useLog ? 'Log' : 'Linear'} scale)</text>`;
    svg += `<text x="10" y="${paddingTop + plotHeight / 2}" font-family="'Newsreader'" font-size="9px" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 10 ${paddingTop + plotHeight / 2})" font-weight="600">Score %</text>`;

    if (timedQr.length >= 10) {
      const pts = timedQr.map(q => {
        const px = useLog ? Math.log(q.timeSec) : q.timeSec;
        const py = q.outOf ? (q.score / q.outOf * 100) : 0;
        return { x: px, y: py };
      });
      const n = pts.length;
      const sumX = pts.reduce((s, p) => s + p.x, 0);
      const sumY = pts.reduce((s, p) => s + p.y, 0);
      const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
      const sumXX = pts.reduce((s, p) => s + p.x * p.x, 0);
      
      const denominator = (n * sumXX - sumX * sumX);
      if (Math.abs(denominator) > 0.001) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;

        const regMinX = useLog ? Math.log(minTime) : minTime;
        const regMaxX = useLog ? Math.log(maxTime) : maxTime;

        const y1Val = Math.max(0, Math.min(100, slope * regMinX + intercept));
        const y2Val = Math.max(0, Math.min(100, slope * regMaxX + intercept));

        svg += `<line x1="${getX(minTime)}" y1="${getY(y1Val, 100)}" x2="${getX(maxTime)}" y2="${getY(y2Val, 100)}" stroke="var(--gold-bright)" stroke-dasharray="3,3" stroke-width="1.5" />`;
      }
    }

    timedQr.forEach(q => {
      const cx = getX(q.timeSec);
      const cy = getY(q.score, q.outOf);
      const hasError = q.score < q.outOf || (q.errorType && q.errorType !== 'none');
      const pointColor = hasError ? 'var(--rose)' : 'var(--sage)';
      const desc = `Q${q.n}: ${q.score}/${q.outOf} in ${q.timeSec}s`;

      svg += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${pointColor}" stroke="var(--paper-warm)" stroke-width="1">
        <title>${desc}</title>
      </circle>`;
    });

    svg += `</svg>`;
    speedAccuracyHtml += svg;
  }
  speedAccuracyHtml += `</div>`;

  const actionHtml = `
    <div class="drawer-section">
      <div class="drawer-section-title">Study & Review</div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn study-now-btn" id="drawerStudyNow" style="flex:1; padding:8px 12px; font-size:12.5px;">${isTimingThisTopic?'Timer running':'✦ Study this now'}</button>
          <button type="button" class="btn ghost" id="drawerStopStudy" style="padding:8px 12px; font-size:12.5px; ${isTimingThisTopic?'':'display:none;'}">Stop</button>
        </div>
        <div style="font-family:'Fraunces'; font-size:20px; color:var(--ink);" aria-live="polite">
          <span data-study-time-id="${topic.id}">${studyTime}</span>
          <span data-study-state-id="${topic.id}" style="font-family:'Newsreader'; font-size:12px; color:var(--muted); margin-left:6px;">${isTimingThisTopic?'Running':'Total'}</span>
        </div>
        <div style="font-family:'Newsreader'; font-size:12px; color:var(--muted); font-style:italic;">
          ${esc(getStudyPaceSummary())}
        </div>
        <div style="font-family:'Newsreader'; font-size:14px; color:var(--ink-soft); margin-top:4px;">
          Or log a review score directly:
        </div>
        <div class="confidence-dots" style="margin-left:0; align-self:flex-start;">
          <button class="conf-dot" data-val="1" title="1: Complete blank / Looked it up">1</button>
          <button class="conf-dot" data-val="2" title="2: Heavy friction / major struggle">2</button>
          <button class="conf-dot" data-val="3" title="3: Reached answer, minor slip or friction">3</button>
          <button class="conf-dot" data-val="4" title="4: Good retrieval, slight hesitation">4</button>
          <button class="conf-dot" data-val="5" title="5: Instant, frictionless retrieval">5</button>
        </div>
      </div>
    </div>
  `;

  const velocity = totalReviews > 0 ? (topic.strength || 0) / totalReviews : 0;
  const velocityHtml = totalReviews > 0 ? velocity.toFixed(2) : '–';

  let html = `
    <!-- Stats Row -->
    <div class="drawer-stat-row">
      <div class="drawer-stat-card">
        <span class="label">Status</span>
        <span class="value" style="font-size:14px; padding-top:2px;">${statusHtml}</span>
      </div>
      <div class="drawer-stat-card">
        <span class="label">Fluency</span>
        <span class="value">${currentConfidence}</span>
      </div>
      <div class="drawer-stat-card">
        <span class="label">Reviews</span>
        <span class="value">${totalReviews}</span>
      </div>
      <div class="drawer-stat-card">
        <span class="label">Study Time</span>
        <span class="value" title="Accumulated time logged with this topic" data-study-time-id="${topic.id}">${studyTime}</span>
      </div>
      <div class="drawer-stat-card">
        <span class="label">Signal</span>
        <span class="value" title="${studySignal ? esc(studySignal.detail) : 'No timer-based signal yet.'}" style="font-size:14px;">${studySignal ? esc(studySignal.label) : '–'}</span>
      </div>
      <div class="drawer-stat-card">
        <span class="label">Velocity</span>
        <span class="value" title="Learning Velocity: Strength gain per review session">${velocityHtml}</span>
      </div>
    </div>

    <!-- Sparkline (Review History) -->
    <div class="drawer-section">
      <div class="drawer-section-title">Fluency History</div>
      <div style="background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; padding:12px; display:flex; flex-direction:column; gap:6px;">
        ${sparklineSvg}
        <div style="display:flex; justify-content:space-between; font-family:'Newsreader'; font-size:11px; color:var(--muted); font-style:italic;">
          <span>First review</span>
          <span>Last: ${lastReviewed}</span>
        </div>
      </div>
    </div>

    <!-- Topic Retention Curve -->
    <div class="drawer-section">
      <div class="drawer-section-title">Predicted Retention Decay (30 days)</div>
      <div style="background:var(--paper-warm); border:1px solid var(--line); border-radius:4px; padding:12px; display:flex; flex-direction:column; gap:6px;">
        ${retentionSvg}
        <div style="display:flex; justify-content:space-between; font-family:'Newsreader'; font-size:11px; color:var(--muted); font-style:italic;">
          <span>Today</span>
          <span>In 30 days</span>
        </div>
      </div>
    </div>

    <!-- Action Section -->
    ${actionHtml}

    <!-- Prerequisite Gaps & Dependencies -->
    ${prereqHtml}

    <!-- Anki Flashcards -->
    ${cardsHtml}

    <!-- Error Log -->
    <div class="drawer-section">
      <div class="drawer-section-title">Logged Misconceptions</div>
      ${topicErrors.length ? `
        <div class="drawer-timeline">
          ${topicErrors.map(e => {
            const typeClass = e.type.toLowerCase();
            const mmText = (e.fix||e.mentalModel) ? `<div style="margin-top:6px; color:var(--ink-soft); font-style:italic;"><strong>The fix:</strong> ${esc(e.fix||e.mentalModel)}</div>` : '';
            const watchText = (e.watch||e.watchFor) ? `<div style="margin-top:2px; color:var(--muted); font-style:italic;"><strong>Watch for:</strong> ${esc(e.watch||e.watchFor)}</div>` : '';
            return `
              <div class="drawer-timeline-node">
                <div class="drawer-timeline-meta">${fmtDateString(e.date)} · <span class="etype ${typeClass}" style="font-size:9px; padding:1px 4px; border-radius:2px;">${e.type}</span></div>
                <div class="drawer-timeline-desc">${esc(e.wrong||e.note)}</div>
                ${mmText}
                ${watchText}
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="drawer-empty">No active misconceptions logged.</div>`}
    </div>

    <!-- Topic Sub-scores -->
    ${subscoresHtml}

    <!-- Speed-accuracy Scatter Plot -->
    ${speedAccuracyHtml}

    <!-- Test Log -->
    <div class="drawer-section">
      <div class="drawer-section-title">Test History</div>
      ${topicTests.length ? `
        <div class="drawer-timeline">
          ${topicTests.map(t => {
            const pct = t.outOf ? Math.round(t.score / t.outOf * 100) : 0;
            const pass = pct >= 80;
            return `
              <div class="drawer-timeline-node ${pass ? 'pass' : 'retry'}">
                <div class="drawer-timeline-meta">${fmtDateString(t.date)} · Score: ${t.score}/${t.outOf} (${pct}%)</div>
                <div class="drawer-timeline-desc" style="font-style:italic; color:var(--muted);">${esc(t.type)}${t.note ? ` — ${esc(t.note)}` : ''}</div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `<div class="drawer-empty">No test results recorded.</div>`}
    </div>
  `;

  body.innerHTML = html;

  // Bind study now button
  const studyBtn = body.querySelector('#drawerStudyNow');
  if (studyBtn) {
    studyBtn.addEventListener('click', e => {
      e.preventDefault();
      if(activeTopicTimerId !== topic.id){
        startTopicTimer(topic);
        toast(`Started timer for "${topic.name}"`);
        renderDrawerBody(topic);
      }
    });
  }

  const stopStudyBtn = body.querySelector('#drawerStopStudy');
  if(stopStudyBtn){
    stopStudyBtn.addEventListener('click', e => {
      e.preventDefault();
      const elapsed = stopTopicTimer(true);
      toast(`Stopped timer for "${topic.name}" (+${formatStudyTime(elapsed)})`);
      renderDrawerBody(topic);
    });
  }

  // Bind confidence dots in the drawer
  body.querySelectorAll('.conf-dot').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = parseInt(btn.dataset.val);
      if (topic.status === 'Not Started') {
        topic.status = 'Learning';
      }
      topic.conf = String(val);
      topic.reviewed = todayStr();

      recordReview(topic, val, 'study');
      scheduleAutosave();
      const ok = await saveTopics();
      toast(ok ? `Logged review for "${topic.name}" (confidence ${val})` : 'Could not save — try again', !ok);
      
      // Update UI components
      renderHome();
      if (typeof updateTrackerRow === 'function') {
        updateTrackerRow(topic.id);
      } else {
        renderTracker();
      }

      // Re-render drawer body to show updated state immediately
      renderDrawerBody(topic);
    });
  });
}

function generateSparklineSvg(history) {
  if (!history.length) {
    return `<div class="drawer-empty" style="text-align:center; padding:10px 0;">No review history yet.</div>`;
  }

  const width = 360;
  const height = 40;
  const paddingX = 10;
  const paddingY = 6;
  const points = [];

  const sorted = history.slice().sort((a,b) => new Date(a.date) - new Date(b.date));

  for (let i = 0; i < sorted.length; i++) {
    const x = paddingX + (sorted.length > 1 ? i * (width - 2 * paddingX) / (sorted.length - 1) : (width - 2 * paddingX) / 2);
    const conf = sorted[i].confidence || 2;
    const y = (height - paddingY) - (conf - 1) * (height - 2 * paddingY) / 4;
    points.push({ x, y, conf, date: sorted[i].date });
  }

  let pathD = '';
  let areaD = '';

  if (points.length === 1) {
    pathD = `M ${points[0].x - 2} ${points[0].y} A 2 2 0 1 1 ${points[0].x + 2} ${points[0].y}`;
  } else {
    pathD = `M ${points[0].x} ${points[0].y}`;
    areaD = `M ${points[0].x} ${height} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
      areaD += ` L ${points[i].x} ${points[i].y}`;
    }
    areaD += ` L ${points[points.length - 1].x} ${height} Z`;
  }

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="overflow:visible;">`;
  if (points.length > 1) {
    svg += `<path d="${areaD}" fill="rgba(176,132,51,0.06)" />`;
    svg += `<path d="${pathD}" fill="none" stroke="var(--gold-bright)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  points.forEach(p => {
    svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--gold)" stroke="var(--paper-warm)" stroke-width="1">
      <title>Confidence ${p.conf} on ${p.date}</title>
    </circle>`;
  });
  svg += `</svg>`;

  return svg;
}

function generateTopicRetentionCurveSvg(topic) {
  if (topic.status === 'Not Started' || !topic.reviewed) {
    return `<div class="drawer-empty" style="text-align:center; padding:10px 0;">No reviews logged yet to project retention.</div>`;
  }

  const width = 360;
  const height = 60;
  const paddingX = 10;
  const paddingY = 8;

  const lastRev = topic.reviewed;
  const today = new Date();
  today.setHours(0,0,0,0);
  const startElapsed = Math.max(0, Math.round((today - new Date(lastRev)) / 86400000));

  const points = [];
  const totalDays = 30;

  for (let d = 0; d <= totalDays; d++) {
    const elapsed = startElapsed + d;
    const R = elapsed === 0 ? 1.0 : Math.exp(-elapsed / (topicK(topic) * (topic.strength || 1)));
    const x = paddingX + d * (width - 2 * paddingX) / totalDays;
    const y = (height - paddingY) - R * (height - 2 * paddingY);
    points.push({ x, y, R });
  }

  let pathD = `M ${points[0].x} ${points[0].y}`;
  let areaD = `M ${points[0].x} ${height} L ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
    areaD += ` L ${points[i].x} ${points[i].y}`;
  }
  areaD += ` L ${points[points.length - 1].x} ${height} Z`;

  const thresholdY = (height - paddingY) - DUE_THRESHOLD * (height - 2 * paddingY);
  const currentR = points[0].R;
  const curveStroke = currentR >= DUE_THRESHOLD ? 'var(--sage)' : 'var(--rose)';
  const fillGradient = currentR >= DUE_THRESHOLD ? 'rgba(92,113,82,0.06)' : 'rgba(158,92,79,0.06)';

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="overflow:visible;">`;
  svg += `<line x1="${paddingX}" y1="${thresholdY}" x2="${width - paddingX}" y2="${thresholdY}" stroke="var(--rose)" stroke-dasharray="3,3" stroke-opacity="0.6" />`;
  svg += `<text x="${width - 45}" y="${thresholdY - 3}" font-family="'Newsreader',serif" font-size="8px" fill="var(--rose)" opacity="0.8">Due (60%)</text>`;
  
  svg += `<path d="${areaD}" fill="${fillGradient}" />`;
  svg += `<path d="${pathD}" fill="none" stroke="${curveStroke}" stroke-width="2" stroke-linecap="round" />`;

  svg += `<circle cx="${points[0].x}" cy="${points[0].y}" r="4" fill="${curveStroke}" stroke="var(--paper-warm)" stroke-width="1.5">
    <title>Today: ~${Math.round(currentR * 100)}% retention</title>
  </circle>`;

  svg += `</svg>`;
  return svg;
}

function fmtDateString(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Side drawer event wire-ups
const drawerCloseBtn = document.getElementById('drawerClose');
if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeTopicDrawer);

const drawerBackdropEl = document.getElementById('drawerBackdrop');
if (drawerBackdropEl) drawerBackdropEl.addEventListener('click', closeTopicDrawer);

window.addEventListener('beforeunload', () => {
  stopTopicTimer(true);
});

// Click delegation for opening drawer
document.addEventListener('click', e => {
  const clickable = e.target.closest('.clickable-topic');
  if (clickable) {
    e.preventDefault();
    const id = clickable.dataset.id;
    if (id) {
      const topic = state.topics.find(t => t.id === id);
      if (topic) {
        openTopicDrawer(topic);
      }
    }
  }
});

// Theme Toggle
const toggleThemeBtn = document.getElementById('toggleTheme');
if (toggleThemeBtn) {
  if (localStorage.getItem('phase0:dark_mode') === 'true') {
    document.body.classList.add('dark-theme');
  }
  toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('phase0:dark_mode', document.body.classList.contains('dark-theme'));
    if (document.getElementById('tab-charts')?.getAttribute('aria-selected') === 'true') {
      if (typeof renderCharts === 'function') renderCharts();
    }
  });
}

/* ============================================================
   CHUNK B — Test-taking workflow
   - state.activeTest: currently being sat (one at a time)
   - state.pendingMarking[]: submitted-but-unmarked tests
   ============================================================ */

// Load activeTest and pendingMarking from localStorage on first access
function loadTestState(){
  if(state.activeTest === undefined){
    try{
      const raw = storageGet('phase0:activeTest');
      state.activeTest = raw ? JSON.parse(raw) : null;
    }catch(e){ state.activeTest = null; }
  }
  if(state.pendingMarking === undefined){
    try{
      const raw = storageGet('phase0:pendingMarking');
      state.pendingMarking = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(state.pendingMarking)) state.pendingMarking = [];
    }catch(e){ state.pendingMarking = []; }
  }
}
async function saveActiveTest(){
  try{
    if(state.activeTest) storageSet('phase0:activeTest', JSON.stringify(state.activeTest));
    else localStorage.removeItem('phase0:activeTest');
    return true;
  }catch(e){ return false; }
}
async function savePendingMarking(){
  try{
    storageSet('phase0:pendingMarking', JSON.stringify(state.pendingMarking || []));
    return true;
  }catch(e){ return false; }
}

// Compute elapsed test time, accounting for pauses
function activeTestElapsedMs(t){
  if(!t || !t.startedAt) return 0;
  const start = new Date(t.startedAt).getTime();
  const now = t.pausedAt ? new Date(t.pausedAt).getTime() : Date.now();
  let elapsed = now - start;
  (t.pauseLog || []).forEach(p => {
    if(p.pausedAt && p.resumedAt){
      elapsed -= (new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime());
    }
  });
  return Math.max(0, elapsed);
}
function fmtMS(ms){
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const sec = s % 60;
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

// Flatten test JSON questions to a tick-list, expanding multi-part questions
function flattenTestQuestions(testJson){
  const out = [];
  (testJson.questions || []).forEach(q => {
    if(Array.isArray(q.parts) && q.parts.length){
      q.parts.forEach(p => {
        out.push({
          n: q.n, partLabel: p.label || '',
          marks: p.marks || 0,
          topics: p.topics || q.topics || (testJson.testMeta && testJson.testMeta.topic ? [testJson.testMeta.topic] : []),
          primaryTopic: p.primaryTopic || q.primaryTopic || (Array.isArray(p.topics||q.topics) ? (p.topics||q.topics)[0] : (testJson.testMeta && testJson.testMeta.topic))
        });
      });
    } else {
      out.push({
        n: q.n, partLabel: '',
        marks: q.marks || 0,
        topics: q.topics || (testJson.testMeta && testJson.testMeta.topic ? [testJson.testMeta.topic] : []),
        primaryTopic: q.primaryTopic || (Array.isArray(q.topics) ? q.topics[0] : (testJson.testMeta && testJson.testMeta.topic))
      });
    }
  });
  return out;
}

// ---------- Resume banner ----------
function renderResumeBanner(){
  loadTestState();
  const banner = document.getElementById('resumeTestBanner');
  if(!banner) return;
  if(state.activeTest && !state.activeTest.submitted){
    banner.style.display = 'flex';
    const elapsedMs = activeTestElapsedMs(state.activeTest);
    const mins = Math.floor(elapsedMs / 60000);
    const title = (state.activeTest.testJson && state.activeTest.testJson.testMeta && state.activeTest.testJson.testMeta.topic) || 'Untitled test';
    document.getElementById('resumeTestDetail').textContent =
      title + ' · started ' + (mins < 1 ? 'less than a minute ago' : mins + ' min ago');
  } else {
    banner.style.display = 'none';
  }
}

// ---------- Sit a test modal (paste + preview) ----------
let _sitTestParsed = null;

function openSitTestModal(){
  document.getElementById('sitTestJsonTa').value = '';
  document.getElementById('sitTestError').classList.remove('show');
  document.getElementById('sitTestPreview').classList.remove('show');
  document.getElementById('sitTestPreview').innerHTML = '';
  document.getElementById('sitTestStartBtn').style.display = 'none';
  document.getElementById('sitTestPredictBtn').style.display = 'none';
  document.getElementById('sitTestPreviewBtn').style.display = '';
  _sitTestParsed = null;
  document.getElementById('sitTestModal').classList.add('open');
}

function previewSitTest(){
  const raw = document.getElementById('sitTestJsonTa').value.trim();
  const errEl = document.getElementById('sitTestError');
  const prevEl = document.getElementById('sitTestPreview');
  if(!raw){
    errEl.textContent = 'Paste a test JSON first.';
    errEl.classList.add('show');
    prevEl.classList.remove('show');
    return;
  }
  let parsed;
  try{ parsed = JSON.parse(raw); }
  catch(e){
    errEl.textContent = 'Invalid JSON: ' + e.message;
    errEl.classList.add('show');
    prevEl.classList.remove('show');
    return;
  }
  if(!parsed || typeof parsed !== 'object'){
    errEl.textContent = 'JSON must be an object.';
    errEl.classList.add('show');
    return;
  }
  if(!Array.isArray(parsed.questions) || parsed.questions.length === 0){
    errEl.textContent = 'Test JSON must have a non-empty "questions" array.';
    errEl.classList.add('show');
    return;
  }
  errEl.classList.remove('show');
  const flat = flattenTestQuestions(parsed);
  const topics = new Set();
  flat.forEach(q => (q.topics || []).forEach(t => topics.add(t)));
  const meta = parsed.testMeta || {};
  let html = '<h3>Test preview</h3><div style="font-family:\'Newsreader\';font-size:14px;line-height:1.6">';
  if(meta.topic) html += '<div><strong>Main topic:</strong> ' + esc(meta.topic) + '</div>';
  if(meta.type) html += '<div><strong>Type:</strong> ' + esc(meta.type) + '</div>';
  if(meta.totalMarks) html += '<div><strong>Total marks:</strong> ' + meta.totalMarks + '</div>';
  if(meta.timeAllowedMins) html += '<div><strong>Time allowed:</strong> ' + meta.timeAllowedMins + ' min</div>';
  html += '<div><strong>Questions:</strong> ' + flat.length + '</div>';
  html += '<div><strong>Topics referenced:</strong> ' + Array.from(topics).map(esc).join(', ') + '</div>';
  if(flat.some(q => !q.topics || !q.topics.length)){
    html += '<div style="color:var(--rose);margin-top:8px"><em>Warning: some questions have no topic tags. They will fall back to the test\'s main topic.</em></div>';
  }
  html += '</div>';
  prevEl.innerHTML = html;
  prevEl.classList.add('show');
  _sitTestParsed = parsed;
  document.getElementById('sitTestStartBtn').style.display = '';
  document.getElementById('sitTestPredictBtn').style.display = '';
  document.getElementById('sitTestPreviewBtn').style.display = 'none';
}

function startActiveTest(predictions){
  if(!_sitTestParsed) return;
  if(state.activeTest && !state.activeTest.submitted){
    if(!confirm('A test is already in progress. Starting a new one will discard the current one. Continue?')) return;
  }
  state.activeTest = {
    id: 'at-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
    testJson: _sitTestParsed,
    flatQuestions: flattenTestQuestions(_sitTestParsed),
    startedAt: new Date().toISOString(),
    ticks: [],          // [{idx, tickedAt, elapsedSec}]
    pauseLog: [],       // [{pausedAt, resumedAt}]
    pausedAt: null,     // ISO if currently paused
    predictions: predictions || null,
    submitted: false
  };
  saveActiveTest();
  document.getElementById('sitTestModal').classList.remove('open');
  _sitTestParsed = null;
  openActiveTestModal();
  renderResumeBanner();
}

// ---------- Predictions sub-flow ----------
function openPredictionsFlow(){
  if(!_sitTestParsed) return;
  const flat = flattenTestQuestions(_sitTestParsed);
  const predictions = {};
  // Replace preview content with a per-question prediction grid
  const prevEl = document.getElementById('sitTestPreview');
  let html = '<h3>Predict your score per question</h3>';
  html += '<p style="font-family:\'Newsreader\';font-size:13px;color:var(--muted);margin-bottom:10px">Rate your expected mark for each (0-100%). Optional but trains calibration. Skip any you\'re unsure of.</p>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">';
  flat.forEach((q,i) => {
    const label = 'Q' + q.n + (q.partLabel ? q.partLabel : '');
    html += '<div style="display:flex;align-items:center;gap:6px;font-family:\'Newsreader\';font-size:13px">'
      + '<span style="min-width:36px">' + label + '</span>'
      + '<input type="number" min="0" max="100" placeholder="%" data-pred-idx="' + i + '" style="width:60px;padding:4px 6px;font-size:13px;border:1px solid var(--line);border-radius:3px">'
      + '</div>';
  });
  html += '</div>';
  prevEl.innerHTML = html;
  prevEl.classList.add('show');
  // Now wire the start button to read predictions
  document.getElementById('sitTestStartBtn').textContent = 'Start with predictions';
  document.getElementById('sitTestPredictBtn').style.display = 'none';
  document.getElementById('sitTestStartBtn').onclick = () => {
    const preds = {};
    document.querySelectorAll('[data-pred-idx]').forEach(input => {
      const v = parseInt(input.value, 10);
      if(!isNaN(v) && v >= 0 && v <= 100) preds[input.dataset.predIdx] = v;
    });
    startActiveTest(Object.keys(preds).length ? preds : null);
  };
}

// ---------- Active test modal (sitting interface) ----------
let _activeTestInterval = null;

function openActiveTestModal(){
  loadTestState();
  if(!state.activeTest){
    document.getElementById('activeTestModal').classList.remove('open');
    return;
  }
  document.getElementById('activeTestModal').classList.add('open');
  const title = (state.activeTest.testJson.testMeta && state.activeTest.testJson.testMeta.topic) || 'Test in progress';
  document.getElementById('activeTestTitle').textContent = title;
  renderActiveTestList();
  updateActiveTestTimer();
  if(state.activeTest.pausedAt){
    document.getElementById('activeTestPaused').style.display = '';
    document.getElementById('activeTestPauseBtn').style.display = 'none';
    document.getElementById('activeTestResumeBtn').style.display = '';
  } else {
    document.getElementById('activeTestPaused').style.display = 'none';
    document.getElementById('activeTestPauseBtn').style.display = '';
    document.getElementById('activeTestResumeBtn').style.display = 'none';
  }
  startActiveTestTicker();
}
function closeActiveTestModal(){
  document.getElementById('activeTestModal').classList.remove('open');
  stopActiveTestTicker();
}
function startActiveTestTicker(){
  stopActiveTestTicker();
  _activeTestInterval = setInterval(updateActiveTestTimer, 1000);
}
function stopActiveTestTicker(){
  if(_activeTestInterval){ clearInterval(_activeTestInterval); _activeTestInterval = null; }
}
function updateActiveTestTimer(){
  if(!state.activeTest) return;
  document.getElementById('activeTestTimer').textContent = fmtMS(activeTestElapsedMs(state.activeTest));
}
function renderActiveTestList(){
  const list = document.getElementById('activeTestList');
  const t = state.activeTest;
  if(!t){ list.innerHTML = ''; return; }
  const flat = t.flatQuestions;
  const ticksByIdx = {};
  t.ticks.forEach(tk => { ticksByIdx[tk.idx] = tk; });
  // last ticked index + 1 is next enabled; if none, 0 is enabled
  let nextEnabledIdx = 0;
  for(let i = 0; i < flat.length; i++){
    if(ticksByIdx[i]) nextEnabledIdx = i + 1;
    else break;
  }
  list.innerHTML = flat.map((q,i) => {
    const tick = ticksByIdx[i];
    const isDone = !!tick;
    const isEnabled = i === nextEnabledIdx && !t.pausedAt;
    const label = 'Q' + q.n + (q.partLabel ? q.partLabel : '');
    const elapsedStr = tick ? fmtMS(tick.elapsedSec * 1000) : '';
    const topicTags = (q.topics || []).map(tn =>
      '<span style="font-size:10px;font-family:\'Newsreader\';background:rgba(218,159,72,0.12);color:var(--ink);padding:1px 6px;border-radius:3px;margin-right:4px">' + esc(tn) + '</span>'
    ).join('');
    const checkboxAttr = isDone ? 'checked disabled' : (isEnabled ? '' : 'disabled');
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:' + (isDone?'rgba(154,170,118,0.10)':(isEnabled?'rgba(218,159,72,0.06)':'transparent')) + ';border-radius:4px;border:1px solid ' + (isDone?'rgba(154,170,118,0.3)':'var(--line)') + '">'
      + '<input type="checkbox" data-tick-idx="' + i + '" ' + checkboxAttr + ' style="width:18px;height:18px;cursor:' + (isEnabled?'pointer':'default') + '">'
      + '<span style="font-family:\'Fraunces\',Georgia,serif;font-weight:600;min-width:48px">' + label + '</span>'
      + '<span style="flex:1">' + topicTags + '</span>'
      + (q.marks ? '<span style="font-size:11px;color:var(--muted);font-family:\'Newsreader\'">' + q.marks + ' mk</span>' : '')
      + (elapsedStr ? '<span style="font-size:12px;color:var(--gold);font-family:\'Fraunces\',Georgia,serif;font-weight:600;min-width:56px;text-align:right">' + elapsedStr + '</span>' : '<span style="min-width:56px"></span>')
      + '</div>';
  }).join('');
  // wire checkboxes
  list.querySelectorAll('input[data-tick-idx]').forEach(cb => {
    cb.addEventListener('change', e => {
      if(!e.target.checked) return;
      tickQuestion(parseInt(e.target.dataset.tickIdx, 10));
    });
  });
}
function tickQuestion(idx){
  const t = state.activeTest;
  if(!t || t.pausedAt) return;
  // verify sequential
  for(let i = 0; i < idx; i++){
    if(!t.ticks.find(tk => tk.idx === i)){
      toast('Tick the previous question first', true);
      renderActiveTestList();
      return;
    }
  }
  // compute elapsed since previous tick (or test start)
  const prevTickTime = t.ticks.length
    ? new Date(t.ticks[t.ticks.length - 1].tickedAt).getTime()
    : new Date(t.startedAt).getTime();
  const now = Date.now();
  // subtract any pause time that occurred between prev tick and now
  let pausedDuring = 0;
  (t.pauseLog || []).forEach(p => {
    if(!p.pausedAt || !p.resumedAt) return;
    const ps = new Date(p.pausedAt).getTime();
    const pe = new Date(p.resumedAt).getTime();
    if(pe > prevTickTime && ps < now){
      pausedDuring += Math.min(pe, now) - Math.max(ps, prevTickTime);
    }
  });
  const elapsedSec = Math.max(1, Math.round((now - prevTickTime - pausedDuring) / 1000));
  t.ticks.push({ idx, tickedAt: new Date(now).toISOString(), elapsedSec });
  saveActiveTest();
  renderActiveTestList();
}
function pauseActiveTest(){
  const t = state.activeTest;
  if(!t || t.pausedAt) return;
  t.pausedAt = new Date().toISOString();
  if(!t.pauseLog) t.pauseLog = [];
  t.pauseLog.push({ pausedAt: t.pausedAt, resumedAt: null });
  saveActiveTest();
  document.getElementById('activeTestPaused').style.display = '';
  document.getElementById('activeTestPauseBtn').style.display = 'none';
  document.getElementById('activeTestResumeBtn').style.display = '';
  renderActiveTestList();
}
function resumeActiveTest(){
  const t = state.activeTest;
  if(!t || !t.pausedAt) return;
  const resumed = new Date().toISOString();
  const last = t.pauseLog && t.pauseLog[t.pauseLog.length - 1];
  if(last && !last.resumedAt) last.resumedAt = resumed;
  t.pausedAt = null;
  saveActiveTest();
  document.getElementById('activeTestPaused').style.display = 'none';
  document.getElementById('activeTestPauseBtn').style.display = '';
  document.getElementById('activeTestResumeBtn').style.display = 'none';
  renderActiveTestList();
}
function confirmSubmitActiveTest(){
  if(!state.activeTest) return;
  document.getElementById('submitConfirmModal').classList.add('open');
}
async function submitActiveTest(){
  document.getElementById('submitConfirmModal').classList.remove('open');
  const t = state.activeTest;
  if(!t) return;
  t.submitted = true;
  t.submittedAt = new Date().toISOString();
  // close any open pause
  if(t.pausedAt){
    const last = t.pauseLog && t.pauseLog[t.pauseLog.length - 1];
    if(last && !last.resumedAt) last.resumedAt = t.submittedAt;
    t.pausedAt = null;
  }
  t.totalElapsedSec = Math.round(activeTestElapsedMs(t) / 1000);

  // Apply time-per-question to each tagged topic's studySeconds
  const ticksByIdx = {};
  t.ticks.forEach(tk => { ticksByIdx[tk.idx] = tk; });
  const flat = t.flatQuestions;
  const topicTimeAdded = {};
  flat.forEach((q, idx) => {
    const tick = ticksByIdx[idx];
    if(!tick) return;
    const topics = (q.topics && q.topics.length) ? q.topics : (q.primaryTopic ? [q.primaryTopic] : []);
    topics.forEach(tn => {
      const match = findTopicByName(tn);
      if(match){
        match.studySeconds = (match.studySeconds || 0) + tick.elapsedSec;
        topicTimeAdded[match.name] = (topicTimeAdded[match.name] || 0) + tick.elapsedSec;
      }
    });
  });

  // Move to pendingMarking
  if(!state.pendingMarking) state.pendingMarking = [];
  state.pendingMarking.push({
    id: t.id,
    testJson: t.testJson,
    flatQuestions: t.flatQuestions,
    ticks: t.ticks,
    totalElapsedSec: t.totalElapsedSec,
    submittedAt: t.submittedAt,
    predictions: t.predictions || null
  });
  state.activeTest = null;
  await saveActiveTest();
  await savePendingMarking();
  await saveTopics(); // for studySeconds updates
  closeActiveTestModal();
  renderResumeBanner();
  renderPendingMarking();
  if(typeof renderTracker === 'function') renderTracker();
  if(typeof renderHome === 'function') renderHome();
  const parts = Object.entries(topicTimeAdded).map(([n, s]) => n + ' (+' + Math.round(s/60) + ' min)').join(', ');
  const idHint = ' Tip: include testId "' + t.id + '" in your tutor prompt to auto-link the marking.';
  toast('Test submitted. ' + (parts ? 'Time added: ' + parts + '.' : '') + idHint, false, 8000);
}
async function abandonActiveTest(){
  if(!confirm('Abandon this test? Your ticks and timer will be discarded. Per-question time will not be saved to topics.')) return;
  state.activeTest = null;
  await saveActiveTest();
  closeActiveTestModal();
  renderResumeBanner();
}

// ---------- Pending marking panel ----------
function renderPendingMarking(){
  loadTestState();
  const panel = document.getElementById('pendingMarkingPanel');
  const list = document.getElementById('pendingMarkingList');
  const stat = document.getElementById('pendingMarkingStat');
  if(!panel || !list) return;
  const pending = state.pendingMarking || [];
  if(!pending.length){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';
  stat.textContent = pending.length + ' awaiting · paste marking JSON into Import Session when tutor returns it';
  list.innerHTML = pending.map(p => {
    const meta = (p.testJson && p.testJson.testMeta) || {};
    const title = meta.topic || 'Untitled test';
    const submittedDate = p.submittedAt ? p.submittedAt.slice(0, 10) : '';
    const minutes = Math.round((p.totalElapsedSec || 0) / 60);
    const tickCount = (p.ticks || []).length;
    const flatCount = (p.flatQuestions || []).length;
    return '<div style="display:flex;align-items:center;gap:14px;padding:10px 12px;border-bottom:1px solid var(--line);font-family:\'Newsreader\';font-size:14px">'
      + '<div style="flex:1">'
      + '<div style="font-weight:600">' + esc(title) + (meta.type ? ' · ' + esc(meta.type) : '') + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">Submitted ' + esc(submittedDate) + ' · ' + minutes + ' min · ' + tickCount + '/' + flatCount + ' ticked</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px;font-family:monospace">testId: <span data-copy-id="' + esc(p.id) + '" style="cursor:pointer;text-decoration:underline" title="Click to copy">' + esc(p.id) + '</span></div>'
      + '</div>'
      + '<button class="btn ghost" data-discard-pending="' + esc(p.id) + '" style="padding:4px 10px;font-size:11px">Discard</button>'
      + '</div>';
  }).join('');
  list.querySelectorAll('[data-discard-pending]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.discardPending;
      if(!confirm('Discard this pending test? Its time has already been logged to topics.')) return;
      state.pendingMarking = state.pendingMarking.filter(p => p.id !== id);
      await savePendingMarking();
      renderPendingMarking();
    });
  });
  list.querySelectorAll('[data-copy-id]').forEach(span => {
    span.addEventListener('click', e => {
      const id = e.target.dataset.copyId;
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(id).then(()=>{
          if(typeof toast === 'function') toast('testId copied — include it in your tutor prompt so marking auto-links');
        }).catch(()=>{});
      }
    });
  });
}

// ---------- Wire up DOM ----------
(function wireChunkB(){
  loadTestState();

  // Sit a test button
  const openBtn = document.getElementById('openSitTest');
  if(openBtn) openBtn.addEventListener('click', openSitTestModal);

  // Sit-test modal buttons
  const closeBtns = ['sitTestClose', 'sitTestCancelBtn'];
  closeBtns.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', () => {
      document.getElementById('sitTestModal').classList.remove('open');
    });
  });
  const previewBtn = document.getElementById('sitTestPreviewBtn');
  if(previewBtn) previewBtn.addEventListener('click', previewSitTest);
  const predictBtn = document.getElementById('sitTestPredictBtn');
  if(predictBtn) predictBtn.addEventListener('click', openPredictionsFlow);
  const startBtn = document.getElementById('sitTestStartBtn');
  if(startBtn) startBtn.addEventListener('click', () => startActiveTest(null));

  // Reset preview when textarea changes
  const ta = document.getElementById('sitTestJsonTa');
  if(ta) ta.addEventListener('input', () => {
    document.getElementById('sitTestPreview').classList.remove('show');
    document.getElementById('sitTestStartBtn').style.display = 'none';
    document.getElementById('sitTestPredictBtn').style.display = 'none';
    document.getElementById('sitTestPreviewBtn').style.display = '';
    document.getElementById('sitTestError').classList.remove('show');
    document.getElementById('sitTestStartBtn').textContent = 'Start test';
    document.getElementById('sitTestStartBtn').onclick = () => startActiveTest(null);
    _sitTestParsed = null;
  });

  // Active test modal buttons
  const pauseBtn = document.getElementById('activeTestPauseBtn');
  if(pauseBtn) pauseBtn.addEventListener('click', pauseActiveTest);
  const resumeBtn2 = document.getElementById('activeTestResumeBtn');
  if(resumeBtn2) resumeBtn2.addEventListener('click', resumeActiveTest);
  const submitBtn = document.getElementById('activeTestSubmitBtn');
  if(submitBtn) submitBtn.addEventListener('click', confirmSubmitActiveTest);
  const abandonBtn = document.getElementById('activeTestAbandonBtn');
  if(abandonBtn) abandonBtn.addEventListener('click', abandonActiveTest);

  // Submit confirm modal
  const sy = document.getElementById('submitConfirmYes');
  if(sy) sy.addEventListener('click', submitActiveTest);
  const sn = document.getElementById('submitConfirmNo');
  if(sn) sn.addEventListener('click', () => document.getElementById('submitConfirmModal').classList.remove('open'));
  const sc = document.getElementById('submitConfirmClose');
  if(sc) sc.addEventListener('click', () => document.getElementById('submitConfirmModal').classList.remove('open'));

  // Resume / discard banner buttons
  const resumeBtn = document.getElementById('resumeTestBtn');
  if(resumeBtn) resumeBtn.addEventListener('click', openActiveTestModal);
  const discardBtn = document.getElementById('discardTestBtn');
  if(discardBtn) discardBtn.addEventListener('click', async () => {
    if(!confirm('Discard this in-progress test? Time will not be saved.')) return;
    state.activeTest = null;
    await saveActiveTest();
    renderResumeBanner();
  });

  // Initial render
  renderResumeBanner();
  renderPendingMarking();
})();
