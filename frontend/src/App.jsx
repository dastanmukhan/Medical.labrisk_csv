import React, { useMemo, useState, useEffect } from 'react';
import { Activity, Beaker, HeartPulse, FlaskConical, Brain, ShieldCheck, Sparkles, Syringe } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

function apiBase(){ return (import.meta.env.VITE_API || 'http://localhost:8000').replace(/\/$/, ''); }

const REFS = {
  HGB: { low: 120, high: 170, unit: 'g/L' },
  MCV: { low: 80, high: 100, unit: 'fL' },
  GLU: { low: 3.9, high: 6.0, unit: 'mmol/L' },
  ALT: { low: 0, high: 45, unit: 'U/L' },
  AST: { low: 0, high: 45, unit: 'U/L' },
  CREA: { low: 62, high: 106, unit: 'µmol/L' },
  TSH: { low: 0.4, high: 4.0, unit: 'mIU/L' },
};

const Gauge = ({value, label, Icon}) => {
  const hue = 130 - (value*1.2);
  return (
    <div className='p-4 bg-white/30 backdrop-blur-md border border-white/20 rounded-2xl shadow-md'>
      <div className='flex items-center gap-2 mb-2'>
        <div className='p-1.5 rounded-lg bg-white/40'><Icon className='w-4 h-4 text-green-800'/></div>
        <span className='text-sm text-green-900 font-semibold'>{label}</span>
      </div>
      <div className='w-full h-2 rounded-full bg-white/50 overflow-hidden'>
        <div className='h-full' style={{width:`${value}%`, background:`linear-gradient(90deg, hsl(${hue} 100% 35%), hsl(${Math.max(hue-30,0)} 100% 40%))`}}/>
      </div>
      <div className='mt-2 text-xl font-bold text-green-900 tabular-nums'>{value}%</div>
    </div>
  );
};

const Pill = ({children}) => <span className='px-2.5 py-1 rounded-full bg-white/50 border border-white/30 text-xs text-green-800 font-medium'>{children}</span>;

export default function App(){
  const [patientId, setPatientId] = useState('');
  const [patientList, setPatientList] = useState([]);
  const [vals, setVals] = useState({HGB:145,MCV:90,GLU:5.1,ALT:28,AST:25,CREA:85,TSH:2.0});
  const [scores, setScores] = useState({Diabetes:0, Anemia:0, Liver:0, Kidney:0, Thyroid:0});
  const [factors, setFactors] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(apiBase()+'/patients').then(r=>r.json()).then(setPatientList).catch(()=>{});
  }, []);

  const radarData = useMemo(()=>Object.entries(scores).map(([k,v])=>({axis:k, score:v})), [scores]);
  const setField = (k, v) => setVals(s=>({...s, [k]: Number(v)}));

  const loadPatient = async () => {
    if(!patientId) return;
    const res = await fetch(apiBase()+`/patient/${patientId}`);
    const data = await res.json();
    if(data && !data.error){
      setVals({
        HGB: Number(data.HGB),
        MCV: Number(data.MCV),
        GLU: Number(data.GLU),
        ALT: Number(data.ALT),
        AST: Number(data.AST),
        CREA: Number(data.CREA),
        TSH: Number(data.TSH),
      });
      setRecs([]); setScores({Diabetes:0, Anemia:0, Liver:0, Kidney:0, Thyroid:0});
    } else {
      alert('Пациент не найден');
    }
  };

  const predict = async () => {
    setLoading(true);
    try{
      const res = await fetch(apiBase()+'/predict', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(vals)});
      const data = await res.json();
      setScores(data.scores||{}); setFactors(data.topFactors||[]); setRecs(data.recommendations||[]);
    }catch(e){ alert('Ошибка запроса к backend: '+e.message); } finally { setLoading(false); }
  };

  return (
    <div className='min-h-screen text-green-950 bg-gradient-to-br from-green-200 via-green-300 to-emerald-200'>
      <header className='max-w-7xl mx-auto px-4 pt-8 pb-4 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-xl bg-white/60 border border-white/30'><Beaker className='w-5 h-5 text-green-900'/></div>
          <h1 className='text-2xl font-extrabold text-green-900'>LabRisk AI</h1>
        </div>
        <div className='flex items-center gap-2 opacity-90 text-sm'><Pill>Demo</Pill><Pill>Prototype</Pill></div>
      </header>

      <section className='max-w-7xl mx-auto px-4 py-6 md:py-10 grid md:grid-cols-2 gap-6 items-center'>
        <div>
          <h2 className='text-4xl font-extrabold text-green-900 leading-tight'>Персональная оценка риска по лабораторным данным</h2>
          <p className='mt-3 text-green-800 font-medium'>Выбери пациента из CSV, подставь его показатели и получи риски + рекомендации.</p>
          <div className='mt-4 flex flex-wrap gap-2'>
            <select className='border border-green-400 rounded-lg px-3 py-2 bg-white/80' value={patientId} onChange={e=>setPatientId(e.target.value)}>
              <option value=''>Выбери пациента</option>
              {patientList.map(id => <option key={id} value={id}>Пациент {id}</option>)}
            </select>
            <button onClick={loadPatient} className='px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700'>Загрузить</button>
            <button onClick={predict} disabled={loading} className='px-4 py-2 rounded-xl bg-green-700 text-white font-semibold hover:bg-green-800'>{loading ? 'Считаю...' : 'Рассчитать риск'}</button>
          </div>
        </div>

        <div className='p-5 rounded-3xl bg-white/60 border border-green-400 shadow-lg backdrop-blur-md'>
          <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <RadarChart cx='50%' cy='50%' outerRadius='80%' data={radarData}>
                <PolarGrid stroke='rgba(0,100,0,0.3)' />
                <PolarAngleAxis dataKey='axis' tick={{ fill: '#064e3b', fontSize: 12, fontWeight:600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#065f46', fontSize: 10 }} />
                <Radar name='Risk' dataKey='score' stroke='#047857' fill='#10b981' fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className='mt-3 grid grid-cols-5 gap-2 text-center text-xs text-green-900 font-semibold'>
            {Object.entries(scores).map(([k,v]) => (
              <div key={k} className='p-2 rounded-lg bg-green-200 border border-green-400 shadow-sm'>
                <div className='text-sm'>{k}</div>
                <div className='font-bold tabular-nums'>{v||0}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className='max-w-7xl mx-auto px-4 pb-14 grid lg:grid-cols-3 gap-6'>
        <section className='lg:col-span-1 p-5 rounded-3xl bg-white/70 border border-green-300 shadow-md'>
          <div className='flex items-center gap-2 mb-4'><FlaskConical className='w-5 h-5 text-green-800'/><h3 className='text-lg font-bold text-green-900'>Лабораторные показатели</h3></div>
          <div className='grid grid-cols-2 gap-3'>
            {Object.keys(REFS).map((k)=> (
              <div key={k} className='p-3 rounded-xl bg-green-50 border border-green-300'>
                <label className='text-xs text-green-800 font-semibold'>{k} <span className='opacity-60'>({REFS[k].unit})</span></label>
                <input type='number' className='mt-1 w-full bg-white border border-green-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400' value={vals[k]} onChange={e=>setField(k, e.target.value)} />
                <div className='mt-1 text-[11px] text-green-600'>Ref: {REFS[k].low}–{REFS[k].high}</div>
              </div>
            ))}
          </div>
        </section>

        <section className='lg:col-span-1 grid gap-3'>
          <Gauge value={scores.Diabetes||0} label='Риск: Диабет' Icon={Activity}/>
          <Gauge value={scores.Anemia||0} label='Риск: Анемия' Icon={Syringe}/>
          <Gauge value={scores.Liver||0} label='Риск: Печень' Icon={HeartPulse}/>
          <Gauge value={scores.Kidney||0} label='Риск: Почки' Icon={ShieldCheck}/>
          <Gauge value={scores.Thyroid||0} label='Риск: Щитовидка' Icon={Brain}/>
        </section>

        <section className='lg:col-span-1 p-5 rounded-3xl bg-white/70 border border-green-300 shadow-md'>
          <div className='flex items-center gap-2 mb-4'><Brain className='w-5 h-5 text-green-800'/><h3 className='text-lg font-bold text-green-900'>Объяснение и рекомендации</h3></div>
          <div className='mb-3'>
            <div className='text-sm text-green-900 mb-1 font-semibold'>Топ факторов (отклонение от середины референса):</div>
            <div className='flex flex-wrap gap-2'>{factors.map(f => <Pill key={f.key}>{f.key}: {f.weight}%</Pill>)}</div>
          </div>
          <ul className='space-y-2 text-sm text-green-900 font-medium'>{recs.map((r,i)=>(<li key={i} className='p-3 rounded-xl bg-green-100 border border-green-400 leading-snug'>• {r}</li>))}</ul>
          <p className='mt-4 text-xs text-green-700'>⚠️ Прототип. Не является медицинским диагнозом.</p>
        </section>
      </main>

      <footer className='max-w-7xl mx-auto px-4 pb-8 text-center text-green-800 font-semibold text-sm'>
        LabRisk AI · CSV demo · React + FastAPI · © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
