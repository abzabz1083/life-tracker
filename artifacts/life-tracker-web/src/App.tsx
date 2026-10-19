import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowUpRight, AudioLines, BookOpen, Bookmark, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, Dumbbell, FileText, Heart, Home, LoaderCircle,
  Mic, Plus, Search, Settings2, Sparkles, Trash2, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  getGetLifeTrackerSessionQueryKey, getHealthCheckQueryKey,
  searchLifeNutrition, useCreateLifeInsight, useEstimateLifeNutrition, useGetLifeTrackerSession, useHealthCheck,
  useIdentifyExerciseMachine, useSendLifeTelegramTest, useSyncLifeReminderSnapshot, useTranscribeLifeVoiceNote,
  useLogoutLifeTracker, useParseLifeVoiceCommand, useUnlockLifeTracker,
} from '@workspace/api-client-react';
import type { LifeVoiceCommand, NutritionFood } from '@workspace/api-client-react';
import { HealthDashboard } from '@/components/HealthDashboard';
import { SettingsDashboard } from '@/components/SettingsDashboard';
import { StudyDashboard } from '@/components/StudyDashboard';
import { getSelectedWeeklyWord } from '@/lib/word-of-week';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, inferExpenseCategory, normalizeMoneyCategory } from '@/lib/money-category';
import {
  addDailyNonNegotiable,
  archiveDailyNonNegotiable as archiveDailyNonNegotiableItems,
  createDefaultLifeData,
  dateKey,
  makeId,
  normalizeLifeData,
  toggleDailyNonNegotiableCheck,
  type Bill,
  type Currency,
  type DailySummary,
  type LifeData,
  type Meal,
  type MoneyEntry,
  type Settings,
  type SavedWord,
  type StudyModule,
  type Task,
  type VoiceNote,
  type WeeklyReview,
  type WorkoutEntry,
} from '@/lib/life-data';
import './index.css';
import './money-history.css';
import './auth.css';
import './weekly-review.css';
import './word-of-week.css';
import './daily-reflection.css';
import './non-negotiables.css';
import '@/components/completion-times.css';

const STORE='life-tracker-web-v1';
const basePath=import.meta.env.BASE_URL.replace(/\/$/,'');
const monthKey=()=>dateKey().slice(0,7);
const money=(n:number,c:Currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
const formatClock=(value:string)=>{const timestamp=new Date(value);return Number.isFinite(timestamp.getTime())?new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(timestamp):'time not recorded'};
const humanDate=()=>new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
const getRate=async(from:Currency,to:Currency)=>{if(from===to)return 1;const r=await fetch(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);if(!r.ok)throw new Error(`Currency conversion from ${from} to ${to} is unavailable.`);const result=await r.json() as {rate?:number};if(typeof result.rate!=='number'||!Number.isFinite(result.rate))throw new Error(`No ${from} to ${to} rate was returned.`);return result.rate};
const convert=async(amount:number,from:Currency,to:Currency)=>Math.round(amount*await getRate(from,to)*100)/100;
const cls=(...items:(string|false|undefined)[])=>items.filter(Boolean).join(' ');
function useLife(){
 const [data,setData]=useState<LifeData>(createDefaultLifeData); const [ready,setReady]=useState(false);
 useEffect(()=>{try{const stored=localStorage.getItem(STORE);if(stored)setData(normalizeLifeData(JSON.parse(stored)))}catch{}setReady(true)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(STORE,JSON.stringify(data))},[data,ready]);
 const update=<K extends keyof LifeData>(key:K,value:LifeData[K])=>setData(prev=>({...prev,[key]:value}));
 return {data,update,ready};
}
function IconButton({children,onClick,label,testId,className=''}:{children:ReactNode;onClick:()=>void;label:string;testId:string;className?:string}){
 return <button aria-label={label} title={label} data-testid={testId} onClick={onClick} className={cls('icon-button',className)}>{children}</button>
}
function Button({children,onClick,secondary=false,disabled=false,testId,type='button'}:{children:ReactNode;onClick?:()=>void;secondary?:boolean;disabled?:boolean;testId:string;type?:'button'|'submit'}){
 return <button type={type} data-testid={testId} onClick={onClick} disabled={disabled} className={cls('button',secondary&&'button-secondary')}>{children}</button>
}
function Field({label,value,onChange,placeholder='',type='text',testId,multiline=false,step}:{label:string;value:string|number;onChange:(v:string)=>void;placeholder?:string;type?:string;testId:string;multiline?:boolean;step?:string}){
 return <label className="field"><span>{label}</span>{multiline?<textarea data-testid={testId} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>:<input data-testid={testId} type={type} step={step} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>
}
function Panel({children,className='',testId}:{children:ReactNode;className?:string;testId?:string}){return <section className={cls('panel',className)} data-testid={testId}>{children}</section>}
function PanelTitle({children,detail}:{children:ReactNode;detail?:ReactNode}){return <div className="panel-title"><h2>{children}</h2>{detail&&<span>{detail}</span>}</div>}
function Empty({title,detail,icon:Icon=FileText}:{title:string;detail:string;icon?:typeof FileText}){return <div className="empty-state"><span className="empty-icon"><Icon size={19}/></span><strong>{title}</strong><p>{detail}</p></div>}
function TopHeading({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}){return <header className="page-heading animate-in"><p className="eyebrow">{eyebrow}</p><h1 className="serif">{title}</h1><p className="subheading">{subtitle}</p></header>}
const nav=[{href:'/user-portal',label:'Today',icon:Home},{href:'/money',label:'Money',icon:Wallet},{href:'/study',label:'Study',icon:BookOpen},{href:'/health',label:'Health',icon:Heart},{href:'/settings',label:'Settings',icon:Settings2}];
function AppShell({children}:{children:ReactNode}){
 const [path]=useLocation(); const health=useHealthCheck({query:{queryKey:getHealthCheckQueryKey(),refetchInterval:60000}});
 return <div className="app-shell"><aside className="sidebar"><Link href="/user-portal" className="brand"><span className="brand-mark"><Check size={19}/></span><span>daybook<small>PERSONAL TRACKER</small></span></Link><div className="nav-label">YOUR SPACE</div><nav>{nav.map(item=><Link href={item.href} key={item.href} data-testid={`nav-${item.label.toLowerCase()}`} className={cls('nav-item',path===item.href&&'active')}><item.icon size={17}/><span>{item.label}</span>{path===item.href&&<span className="nav-dot"/>}</Link>)}</nav><div className="sidebar-bottom"><div className={cls('service-dot',health.isSuccess?'online':'offline')}/><div><strong>{health.isLoading?'Checking service':health.isError?'Service unavailable':'All systems ready'}</strong><small>Private to this browser</small></div></div></aside><main className="main-area"><div className="mobile-brand"><span className="brand-mark"><Check size={17}/></span>daybook</div><div className="content-wrap">{children}<footer className="footer-note"><span>YOUR LIFE, IN VIEW</span><span>Stored on this device</span></footer></div></main><nav className="mobile-nav">{nav.map(item=><Link href={item.href} key={item.href} data-testid={`mobile-nav-${item.label.toLowerCase()}`} className={cls(path===item.href&&'active')}><item.icon size={19}/><span>{item.label}</span></Link>)}</nav></div>
}
function HomePage({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
  const [task,setTask]=useState('');const [transcript,setTranscript]=useState('');const [voiceCommand,setVoiceCommand]=useState<LifeVoiceCommand|null>(null);const [voiceTaskId,setVoiceTaskId]=useState('');const [voiceFoods,setVoiceFoods]=useState<NutritionFood[]>([]);const [voiceFoodId,setVoiceFoodId]=useState('');const [voiceFoodLoading,setVoiceFoodLoading]=useState(false);const [voiceError,setVoiceError]=useState('');const [recording,setRecording]=useState(false);const [reviewError,setReviewError]=useState('');const [dailyError,setDailyError]=useState('');const [clock,setClock]=useState(()=>new Date());
  const [nonNegotiableTitle,setNonNegotiableTitle]=useState('');
  const [nonNegotiableError,setNonNegotiableError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);
 const transcribe=useTranscribeLifeVoiceNote();const parseVoice=useParseLifeVoiceCommand();const voiceNutrition=useEstimateLifeNutrition();const insight=useCreateLifeInsight();
   const todayDate=dateKey();const dayTasks=data.tasks.filter(t=>t.date===todayDate);const completedTasks=dayTasks.filter(t=>t.done).length;const unfinishedTasks=dayTasks.length-completedTasks;const completionPercent=dayTasks.length?Math.round(completedTasks/dayTasks.length*100):0;const todayMeals=data.meals.filter(m=>m.date===todayDate);const calories=todayMeals.reduce((s,m)=>s+m.calories,0);const thisMonth=data.money.filter(m=>m.date.startsWith(monthKey()));const spend=thisMonth.filter(m=>m.kind==='expense').reduce((s,m)=>s+m.baseAmount,0);const billTotal=data.bills.reduce((s,b)=>s+b.baseAmount,0);
   const activeNonNegotiables=data.nonNegotiables.filter(item=>!item.archivedAt);
   const todayNonNegotiableChecks=data.nonNegotiableChecks.filter(item=>item.date===todayDate);
   const checkedNonNegotiableIds=new Set(todayNonNegotiableChecks.map(item=>item.itemId));
   const checkedNonNegotiableCount=activeNonNegotiables.filter(item=>checkedNonNegotiableIds.has(item.id)).length;
   const nonNegotiablePercent=activeNonNegotiables.length?Math.round(checkedNonNegotiableCount/activeNonNegotiables.length*100):0;
  useEffect(()=>{const timer=window.setInterval(()=>setClock(new Date()),30000);return()=>window.clearInterval(timer)},[]);
  const dailyWindowOpen=clock.getHours()>=22||clock.getHours()<3;
  const reflectionDate=(()=>{const localDate=new Date(clock);if(clock.getHours()<3)localDate.setDate(localDate.getDate()-1);return dateKey(localDate)})();
  const existingDailySummary=data.dailySummaries.find(item=>item.date===reflectionDate);
 const today=new Date();const isReviewSunday=today.getDay()===0;const weekEnd=dateKey(today);const weekStartDate=new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7));const weekStart=dateKey(weekStartDate);const currentWeekReview=data.weeklyReviews.find(item=>item.weekEnd===weekEnd);const isInReviewWeek=(date:string)=>date>=weekStart&&date<=weekEnd;
 const reviewTasks=data.tasks.filter(item=>isInReviewWeek(item.date));const reviewMoney=data.money.filter(item=>isInReviewWeek(item.date));const reviewIncome=reviewMoney.filter(item=>item.kind==='income').reduce((sum,item)=>sum+item.baseAmount,0);const reviewSpending=reviewMoney.filter(item=>item.kind==='expense').reduce((sum,item)=>sum+item.baseAmount,0);const reviewMeals=data.meals.filter(item=>isInReviewWeek(item.date));const reviewCalories=reviewMeals.reduce((sum,item)=>sum+item.calories,0);const reviewChecks=data.dayChecks.filter(item=>isInReviewWeek(item.date));const reviewWorkouts=data.workouts.filter(item=>isInReviewWeek(item.date));const reviewNotes=data.voiceNotes.filter(item=>dateKey(new Date(item.createdAt))>=weekStart&&dateKey(new Date(item.createdAt))<=weekEnd);const modulesAddedThisWeek=data.modules.filter(item=>{const created=dateKey(new Date(item.createdAt));return isInReviewWeek(created)}).length;
 const weekRangeLabel=`${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(weekStartDate)} – ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(today)}`;
 const addTask=()=>{if(!task.trim())return;update('tasks',[{id:makeId(),title:task.trim(),done:false,date:dateKey()},...data.tasks]);setTask('')};
  const toggle=(id:string)=>{const taskToToggle=data.tasks.find(t=>t.id===id);if(!taskToToggle)return;const completedAt=taskToToggle.done?undefined:new Date().toISOString();update('tasks',data.tasks.map(t=>t.id===id?{...t,done:!t.done,completedAt}:t));if(completedAt)update('completionEvents',[{id:makeId(),kind:'task',itemId:taskToToggle.id,title:taskToToggle.title,completedAt},...data.completionEvents])};
  const addNonNegotiable=()=>{
   const result=addDailyNonNegotiable(data.nonNegotiables,nonNegotiableTitle,makeId(),new Date().toISOString());
   if(result.error){
    setNonNegotiableError(result.error);
    return;
   }
   update('nonNegotiables',result.items);
   setNonNegotiableTitle('');
   setNonNegotiableError('');
  };
  const toggleNonNegotiable=(id:string)=>{
   const item=activeNonNegotiables.find(entry=>entry.id===id);
   if(!item)return;
   const existing=data.nonNegotiableChecks.find(check=>check.itemId===id&&check.date===todayDate);
   const completedAt=new Date().toISOString();
   const result=toggleDailyNonNegotiableCheck(data.nonNegotiableChecks,id,todayDate,completedAt);
   update('nonNegotiableChecks',result.checks);
   if(!existing&&result.completed)update('completionEvents',[{id:makeId(),kind:'non_negotiable',itemId:id,title:item.title,completedAt},...data.completionEvents]);
  };
  const archiveNonNegotiable=(id:string)=>{
   const item=activeNonNegotiables.find(entry=>entry.id===id);
   if(!item||!window.confirm(`Remove “${item.title}” from future daily checklists? Past completions will remain in History.`))return;
   update('nonNegotiables',archiveDailyNonNegotiableItems(data.nonNegotiables,id,new Date().toISOString()));
   setNonNegotiableError('');
  };
  const normalizeVoiceTask=(value:string)=>value.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
   const record=async()=>{setVoiceError('');if(recording){recorder.current?.stop();setRecording(false);return}try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Voice recording is not supported in this browser.');const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mr=new MediaRecorder(stream);recorder.current=mr;chunks.current=[];mr.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());try{const blob=new Blob(chunks.current,{type:mr.mimeType||'audio/webm'});const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));const format=(mr.mimeType.split('/')[1]?.split(';')[0]||'webm') as 'm4a'|'mp3'|'wav'|'webm'|'mp4'|'flac'|'ogg';const result=await transcribe.mutateAsync({data:{audioBase64:btoa(binary),format:['m4a','mp3','wav','webm','mp4','flac','ogg'].includes(format)?format:'webm'}});const text=result.transcript.trim();setTranscript(text);setVoiceCommand(null);setVoiceTaskId('');setVoiceFoods([]);setVoiceFoodId('');if(text){update('voiceNotes',[{id:makeId(),text,createdAt:new Date().toISOString()},...data.voiceNotes]);try{const command=await parseVoice.mutateAsync({data:{transcript:text}});setVoiceCommand(command);const target=command.targetTitle||command.title;const exact=data.tasks.filter(item=>!item.done&&normalizeVoiceTask(item.title)===normalizeVoiceTask(target));setVoiceTaskId(exact.length===1?exact[0].id:'')}catch(error){setVoiceError(error instanceof Error?error.message:'AI could not identify an action. The transcript is saved.')}}}catch(e){setVoiceError(e instanceof Error?e.message:'Could not transcribe this recording.')}};mr.start();setRecording(true)}catch(e){setVoiceError(e instanceof Error?e.message:'Microphone access could not be started.')}}
  const openVoiceTasks=data.tasks.filter(item=>!item.done);
  const targetVoiceTask=voiceCommand?.targetTitle||voiceCommand?.title||'';
  const voiceMoneyCategory=voiceCommand?.action==='expense'?inferExpenseCategory(voiceCommand.title,voiceCommand.category):voiceCommand?.action==='income'?normalizeMoneyCategory('income',voiceCommand.category,voiceCommand.title):'';
  const exactVoiceTasks=openVoiceTasks.filter(item=>normalizeVoiceTask(item.title)===normalizeVoiceTask(targetVoiceTask));
  const selectedVoiceTaskId=voiceTaskId||(exactVoiceTasks.length===1?exactVoiceTasks[0].id:'');
   const clearVoice=()=>{setTranscript('');setVoiceCommand(null);setVoiceTaskId('');setVoiceFoods([]);setVoiceFoodId('');setVoiceError('')};
  const saveVoiceAction=async()=>{if(!voiceCommand)return;try{if(voiceCommand.action==='add_task'){update('tasks',[{id:makeId(),title:voiceCommand.title.trim(),done:false,date:dateKey()},...data.tasks]);clearVoice();return}if(voiceCommand.action==='complete_task'){const selected=data.tasks.find(item=>item.id===selectedVoiceTaskId&&!item.done);if(!selected){setVoiceError('Choose the open task you meant to complete.');return}const completedAt=new Date().toISOString();update('tasks',data.tasks.map(item=>item.id===selected.id?{...item,done:true,completedAt}:item));update('completionEvents',[{id:makeId(),kind:'task',itemId:selected.id,title:selected.title,completedAt},...data.completionEvents]);clearVoice();return}if(voiceCommand.action==='income'||voiceCommand.action==='expense'){if(!voiceCommand.amount){setVoiceError('The amount is missing, so nothing was saved.');return}const currency=voiceCommand.currency??data.settings.baseCurrency;const baseAmount=await convert(voiceCommand.amount,currency,data.settings.baseCurrency);const category=normalizeMoneyCategory(voiceCommand.action,voiceCommand.category,voiceCommand.title);update('money',[{id:makeId(),kind:voiceCommand.action,title:voiceCommand.title||'Voice entry',category,amount:voiceCommand.amount,currency,baseAmount,date:dateKey()},...data.money]);clearVoice();return}setVoiceError('This voice note needs a food lookup before it can be saved.')}catch(error){setVoiceError(error instanceof Error?error.message:'Nothing was saved. Please try again.')}}
   const lookupVoiceMeal=async()=>{if(!voiceCommand?.foodName)return;setVoiceFoodLoading(true);setVoiceError('');try{let foods:NutritionFood[]=[];try{foods=await searchLifeNutrition({query:voiceCommand.foodName})}catch(error){if(authErrorStatus(error)===401)throw error}if(!foods.length){foods=[await voiceNutrition.mutateAsync({data:{food:voiceCommand.foodName}})]}setVoiceFoods(foods);setVoiceFoodId('')}catch(error){setVoiceError(error instanceof Error?error.message:'Food details could not be found. Nothing was saved.')}finally{setVoiceFoodLoading(false)}};
   const saveVoiceMeal=()=>{if(!voiceCommand?.grams)return;const food=voiceFoods.find(item=>item.id===voiceFoodId);if(!food){setVoiceError('Choose the exact nutrition match before saving.');return}if(food.source==='Claude estimate'&&!window.confirm('Claude nutrition is only an estimate and may be wrong. Use a package label for accurate values. Log this estimate anyway?'))return;const amount=voiceCommand.grams;update('meals',[{id:makeId(),name:food.name,grams:amount,calories:Math.round(food.calories*amount*10/100)/10,protein:Math.round(food.protein*amount/10)/10,carbs:Math.round(food.carbs*amount/10)/10,fat:Math.round(food.fat*amount/10)/10,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}),date:dateKey(),source:food.source},...data.meals]);clearVoice()};
  const createReview=async()=>{if(!isReviewSunday){setReviewError('Weekly reviews can only be created on Sundays.');return}setReviewError('');const snapshot=[`Weekly review period: ${weekStart} to ${weekEnd} (${weekRangeLabel}).`,`Daily tasks: ${reviewTasks.filter(item=>item.done).length} of ${reviewTasks.length} completed.`,`Money this week: ${money(reviewIncome,data.settings.baseCurrency)} income and ${money(reviewSpending,data.settings.baseCurrency)} spending. Monthly recurring bills currently total ${money(billTotal,data.settings.baseCurrency)}. Monthly income target: ${money(data.settings.monthlyIncomeTarget,data.settings.baseCurrency)}.`,`Meals: ${reviewMeals.length} logged across the week, ${Math.round(reviewCalories/7)} average kcal per day against a ${data.settings.calorieTarget} kcal daily target; totals: ${Math.round(reviewMeals.reduce((sum,item)=>sum+item.protein,0))} g protein, ${Math.round(reviewMeals.reduce((sum,item)=>sum+item.carbs,0))} g carbs, ${Math.round(reviewMeals.reduce((sum,item)=>sum+item.fat,0))} g fat. Daily carb target: ${data.settings.carbsTarget || 'not set'} g; daily fat target: ${data.settings.fatTarget || 'not set'} g. These figures include logged meals only.`,`Gym and diet check-ins: ${reviewChecks.filter(item=>item.gym==='went').length} gym days attended, ${reviewChecks.filter(item=>item.gym==='missed').length} missed, ${reviewChecks.filter(item=>item.diet==='good').length} good diet days, ${reviewChecks.filter(item=>item.diet==='off').length} off-track days.`,`Training: ${reviewWorkouts.length} workout logs${reviewWorkouts.length?` (${reviewWorkouts.slice(0,8).map(item=>`${item.exercise} ${item.weight} kg, ${item.sets} sets × ${item.reps} reps`).join('; ')})`:''}.`,`Learning: ${modulesAddedThisWeek} modules added this week; ${data.modules.filter(item=>item.done).length} of ${data.modules.length} modules currently marked complete.`,`Voice notes: ${reviewNotes.length} recorded this week.`,`Give a concise, supportive weekly reflection based only on these records. Point out one or two observed patterns and suggest one practical focus for next week. Do not invent missing information or make medical or financial guarantees.`].join('\n');try{const result=await insight.mutateAsync({data:{snapshot}});const savedReview:WeeklyReview={id:currentWeekReview?.id??makeId(),weekStart,weekEnd,createdAt:new Date().toISOString(),summary:result.summary,snapshot};update('weeklyReviews',[savedReview,...data.weeklyReviews.filter(item=>item.weekEnd!==weekEnd)])}catch{setReviewError(currentWeekReview?'Could not refresh this review. Your saved copy in history was not changed. Please try again.':'Could not create your review just now. Nothing was added to history. Please try again.')}}
  const createDailySummary=async()=>{
   if(!dailyWindowOpen||existingDailySummary||insight.isPending)return;
   setDailyError('');
   const tasks=data.tasks.filter(item=>item.date===reflectionDate);
   const done=tasks.filter(item=>item.done).length;
   const remaining=tasks.length-done;
   const openTasks=tasks.filter(item=>!item.done);
   const meals=data.meals.filter(item=>item.date===reflectionDate);
   const workouts=data.workouts.filter(item=>item.date===reflectionDate);
   const check=data.dayChecks.find(item=>item.date===reflectionDate);
   const dayNonNegotiables=data.nonNegotiables.filter(item=>{
    const createdAt=new Date(item.createdAt);
    if(!Number.isFinite(createdAt.getTime())||dateKey(createdAt)>reflectionDate)return false;
    if(!item.archivedAt)return true;
    const archivedAt=new Date(item.archivedAt);
    return !Number.isFinite(archivedAt.getTime())||dateKey(archivedAt)>=reflectionDate;
   });
   const dayNonNegotiableIds=new Set(data.nonNegotiableChecks.filter(item=>item.date===reflectionDate).map(item=>item.itemId));
   const completedNonNegotiables=dayNonNegotiables.filter(item=>dayNonNegotiableIds.has(item.id)).length;
   const pendingNonNegotiables=dayNonNegotiables.filter(item=>!dayNonNegotiableIds.has(item.id));
   const nonNegotiableDetail=dayNonNegotiables.length
    ?`Daily non-negotiables: ${completedNonNegotiables}/${dayNonNegotiables.length} complete.${pendingNonNegotiables.length?` Still unchecked: ${pendingNonNegotiables.map(item=>item.title).join('; ')}.`:''}`
    :'No daily non-negotiables were set for this date.';
   const mealDetail=meals.length?`${meals.length} meal(s), ${Math.round(meals.reduce((sum,item)=>sum+item.calories,0))} kcal, ${Math.round(meals.reduce((sum,item)=>sum+item.protein,0))} g protein.`:'No meals were logged for this date.';
   const workoutDetail=workouts.length?`${workouts.length} workout log(s): ${workouts.map(item=>`${item.exercise}, ${item.weight} kg, ${item.sets} sets × ${item.reps} reps`).join('; ')}.`:'No workouts were logged for this date.';
   const checkDetail=check&&(check.gym||check.diet)?`Gym check-in: ${check.gym??'not recorded'}; diet check-in: ${check.diet??'not recorded'}.`:'No gym or diet check-in was recorded for this date.';
   const snapshot=[
    `Daily reflection date: ${reflectionDate} (browser local calendar date).`,
    `Tasks: ${done}/${tasks.length} done; unfinished: ${remaining}. Completion ratio: ${done}/${tasks.length} (${tasks.length?Math.round(done/tasks.length*100):0}%). Open tasks are not counted as complete.`,
    openTasks.length?`Unfinished tasks: ${openTasks.map(item=>item.title).join('; ')}.`:'No unfinished tasks.',
    nonNegotiableDetail,
    `Meals: ${mealDetail}`,
    `Workouts: ${workoutDetail}`,
    `Daily check-in: ${checkDetail}`,
    'Use only the records above. If a category has no data, state that explicitly. Write a concise, kind daily reflection without inventing events.',
   ].join('\n');
   try{
    const result=await insight.mutateAsync({data:{snapshot}});
    const saved:DailySummary={id:makeId(),date:reflectionDate,createdAt:new Date().toISOString(),summary:result.summary,snapshot};
    update('dailySummaries',[saved,...data.dailySummaries.filter(item=>item.date!==reflectionDate)]);
   }catch(error){
    setDailyError(error instanceof Error?error.message:'Could not create this reflection. Nothing was saved; please try again.');
   }
  };
  return <><TopHeading eyebrow={humanDate()} title="A little more in focus." subtitle="Your day, gathered in one calm place."/><div className="dashboard-grid">
   <Panel className="welcome-panel"><div className="welcome-orbit"><Activity size={30}/></div><div><span className="eyebrow light">A DAILY CHECK-IN</span><h2 className="serif">Make room for<br/>what matters.</h2><p>Your next small step is enough.</p></div><div className="welcome-bottom"><span data-testid="task-completion-ratio">{completedTasks} of {dayTasks.length} done · {unfinishedTasks} remaining · {completionPercent}%</span><span className="progressline" role="progressbar" aria-label="Today's task completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}><i style={{width:`${completionPercent}%`}}/></span></div></Panel>
    <Panel className="task-panel"><PanelTitle detail={`${dayTasks.filter(t=>!t.done).length} to go`}>Today’s list</PanelTitle>{dayTasks.length?dayTasks.map(t=><div className="task-row" key={t.id}><button className={cls('task-check',t.done&&'checked')} onClick={()=>toggle(t.id)} data-testid={`toggle-task-${t.id}`} aria-label={`${t.done?'Reopen':'Complete'} ${t.title}`}>{t.done&&<Check size={13}/>}</button><div className="task-row-copy"><span className={cls(t.done&&'strike')} data-testid={`task-title-${t.id}`}>{t.title}</span>{t.done&&<small className="task-completion-time" data-testid={`task-completed-at-${t.id}`}>{t.completedAt?`Completed at ${formatClock(t.completedAt)}`:'Completed · time not recorded'}</small>}</div></div>):<Empty title="A fresh page" detail="Add one thing you’d like to move forward today." icon={CheckCircle2}/>}<form className="inline-form" onSubmit={e=>{e.preventDefault();addTask()}}><input data-testid="task-title" value={task} onChange={e=>setTask(e.target.value)} placeholder="Add a task for today"/><button disabled={!task.trim()} data-testid="add-task" aria-label="Add task"><Plus size={18}/></button></form></Panel>
    <Panel className="nonnegotiables-panel" testId="nonnegotiables-panel">
     <div className="nonnegotiables-heading"><div><span className="eyebrow">DAILY STANDARD</span><h2>Non-negotiables</h2><p>Small commitments that repeat every day.</p></div><strong data-testid="nonnegotiable-progress">{activeNonNegotiables.length?`${checkedNonNegotiableCount} of ${activeNonNegotiables.length} complete`:'None set yet'}</strong></div>
     {activeNonNegotiables.length?<><div className="nonnegotiables-list">{activeNonNegotiables.map(item=>{
      const check=todayNonNegotiableChecks.find(entry=>entry.itemId===item.id);
      return <div className="nonnegotiable-row" key={item.id}>
       <button className={cls('task-check',check&&'checked')} onClick={()=>toggleNonNegotiable(item.id)} data-testid={`toggle-nonnegotiable-${item.id}`} aria-label={`${check?'Mark incomplete':'Complete'} ${item.title}`}>{check&&<Check size={13}/>}</button>
       <div className="nonnegotiable-copy"><span className={cls(check&&'strike')} data-testid={`nonnegotiable-title-${item.id}`}>{item.title}</span>{check&&<small data-testid={`nonnegotiable-time-${item.id}`}>Completed at {formatClock(check.completedAt)}</small>}</div>
       <IconButton onClick={()=>archiveNonNegotiable(item.id)} label={`Remove ${item.title} from daily list`} testId={`archive-nonnegotiable-${item.id}`}><Trash2 size={14}/></IconButton>
      </div>;
     })}</div><div className="nonnegotiable-progress-track" role="progressbar" aria-label="Daily non-negotiables completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nonNegotiablePercent}><i style={{width:`${nonNegotiablePercent}%`}}/></div></>:<Empty title="Set your daily standard" detail="Add the habits or actions you want to check off every day." icon={CheckCircle2}/>}
     <form className="inline-form nonnegotiables-form" onSubmit={event=>{event.preventDefault();addNonNegotiable()}}><input data-testid="nonnegotiable-title" maxLength={120} value={nonNegotiableTitle} onChange={event=>{setNonNegotiableTitle(event.target.value);setNonNegotiableError('')}} placeholder="Add a daily non-negotiable"/><button disabled={!nonNegotiableTitle.trim()} data-testid="add-nonnegotiable" aria-label="Add daily non-negotiable"><Plus size={18}/></button></form>
     {nonNegotiableError&&<p className="form-error" data-testid="nonnegotiable-error">{nonNegotiableError}</p>}
    </Panel>
    <Panel className="voice-panel"><div className="voice-heading"><div className="voice-icon"><AudioLines size={18}/></div><div><PanelTitle detail="VOICE NOTES">Capture as it comes</PanelTitle><p>Speak a task, completion, income, expense or meal. Review the action before saving.</p></div></div><Button testId="voice-record" onClick={()=>void record()} disabled={transcribe.isPending||parseVoice.isPending}>{transcribe.isPending?<LoaderCircle className="spin" size={16}/>:parseVoice.isPending?<LoaderCircle className="spin" size={16}/>:recording?<span className="record-dot"/>:<Mic size={16}/>}{transcribe.isPending?'Transcribing…':parseVoice.isPending?'Understanding…':recording?'Finish recording':'Start voice note'}</Button>{voiceError&&<p className="form-error" data-testid="voice-error">{voiceError}</p>}{transcript&&<div className="transcript-box"><p data-testid="voice-transcript">{transcript}</p>{voiceCommand?.action==='add_task'&&<><small>Task · {voiceCommand.title}</small><Button testId="voice-save-task" onClick={()=>void saveVoiceAction()}><Check size={15}/>Add task</Button></>}{voiceCommand?.action==='complete_task'&&<><small>Mark a task complete. Confirm the match before saving.</small><label className="field"><span>Task</span><select data-testid="voice-task-match" value={selectedVoiceTaskId} onChange={event=>setVoiceTaskId(event.target.value)}><option value="">Choose an open task</option>{openVoiceTasks.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><Button testId="voice-complete-task" disabled={!selectedVoiceTaskId} onClick={()=>void saveVoiceAction()}><Check size={15}/>Mark complete</Button></>}{(voiceCommand?.action==='income'||voiceCommand?.action==='expense')&&<><small>Possible {voiceCommand.action} · {money(voiceCommand.amount??0,voiceCommand.currency??data.settings.baseCurrency)} · Category: {voiceMoneyCategory} · convert to {data.settings.baseCurrency} on save</small><Button testId={voiceCommand.action==='expense'?'save-voice-expense':'save-voice-income'} onClick={()=>void saveVoiceAction()}><ArrowDownLeft size={15}/>Log {voiceCommand.action}</Button></>}{voiceCommand?.action==='meal'&&<><small>Meal · {voiceCommand.foodName} · {voiceCommand.grams} g</small>{voiceFoods.length>0&&<><label className="field"><span>Nutrition match</span><select data-testid="voice-food-match" value={voiceFoodId} onChange={event=>setVoiceFoodId(event.target.value)}>{voiceFoods.map(food=><option key={food.id} value={food.id}>{food.name} · {food.source}</option>)}</select></label>{(()=>{const food=voiceFoods.find(item=>item.id===voiceFoodId);return food?<small>At {voiceCommand.grams} g: {Math.round(food.calories*voiceCommand.grams!/100)} kcal · P {Math.round(food.protein*voiceCommand.grams!/10)/10} · C {Math.round(food.carbs*voiceCommand.grams!/10)/10} · F {Math.round(food.fat*voiceCommand.grams!/10)/10} g</small>:null})()}<Button testId="voice-save-meal" disabled={!voiceFoodId} onClick={saveVoiceMeal}><Check size={15}/>Log meal</Button></>}{!voiceFoods.length&&<Button testId="voice-lookup-meal" disabled={voiceFoodLoading||voiceNutrition.isPending} onClick={()=>void lookupVoiceMeal()}>{voiceFoodLoading||voiceNutrition.isPending?<LoaderCircle className="spin" size={15}/>:<Search size={15}/>}Find and review nutrition</Button>}</>}{voiceCommand?.action==='unknown'&&<><small>{voiceCommand.clarification||'No clear action was found. You can still keep this as a task.'}</small><Button secondary testId="voice-to-task" onClick={()=>{update('tasks',[{id:makeId(),title:transcript,done:false,date:dateKey()},...data.tasks]);clearVoice()}}><Check size={15}/>Add transcript as task</Button></>}{!voiceCommand&&<small>Transcript saved. AI action detection did not complete; you can still add it as a task.</small>}</div>}</Panel>
  <Panel className="pulse-panel"><div className="pulse-top"><span className="eyebrow">AT A GLANCE</span><Heart size={18}/></div><div className="pulse-stats"><div><strong data-testid="today-calories">{Math.round(calories).toLocaleString()}</strong><small>kcal today</small></div><div><strong>{money(spend+billTotal,data.settings.baseCurrency)}</strong><small>spend + bills</small></div></div><div className="pulse-bottom"><span>Calories</span><span>{Math.round(calories)} / {data.settings.calorieTarget} kcal</span></div><div className="thin-track"><i style={{width:`${Math.min(100,calories/Math.max(1,data.settings.calorieTarget)*100)}%`}}/></div></Panel>
    <Panel className="review-panel"><div className="review-mark"><Sparkles size={18}/></div><div><span className="eyebrow">A MOMENT TO REFLECT</span><h2>Weekly review</h2><p>{isReviewSunday?`This review covers Monday–Sunday · ${weekRangeLabel}.`:'Weekly reviews are available on Sundays and cover Monday through Sunday.'}</p></div><Button testId="create-review" onClick={()=>void createReview()} disabled={!isReviewSunday||insight.isPending}>{insight.isPending?<LoaderCircle className="spin" size={15}/>:isReviewSunday?<Sparkles size={15}/>:<Clock3 size={15}/>} {insight.isPending?'Thinking…':!isReviewSunday?'Available on Sundays':currentWeekReview?'Refresh this week’s review':'Create this week’s review'}</Button>{reviewError&&<p className="form-error">{reviewError}</p>}{currentWeekReview&&<div className="review-result" data-testid="ai-review"><div className="review-saved-heading"><span>Saved · {weekRangeLabel}</span><Link href="/settings" className="text-link">Review history <ChevronRight size={14}/></Link></div><p>{currentWeekReview.summary}</p></div>}</Panel>
    <Panel className="daily-reflection-panel" data-testid="daily-reflection-panel"><div className="daily-reflection-heading"><span className="review-mark"><Bookmark size={17}/></span><div><span className="eyebrow">DAILY REFLECTION</span><h2>{existingDailySummary?'Saved for this day':'A note to close the day'}</h2><p>{dailyWindowOpen?`Available now · ${reflectionDate}`:'Available daily from 10:00 p.m. to 2:59 a.m. local time.'}</p></div></div><Button testId="create-daily-summary" onClick={()=>void createDailySummary()} disabled={!dailyWindowOpen||Boolean(existingDailySummary)||insight.isPending}>{insight.isPending?<LoaderCircle className="spin" size={15}/>:existingDailySummary?<Check size={15}/>:dailyWindowOpen?<Sparkles size={15}/>:<Clock3 size={15}/>} {insight.isPending?'Reflecting…':existingDailySummary?'Saved':'Create daily reflection'}</Button>{dailyError&&<p className="form-error" data-testid="daily-summary-error">{dailyError}</p>}{existingDailySummary&&<div className="review-result" data-testid="daily-summary-result"><div className="review-saved-heading"><span>Saved · {reflectionDate}</span><Link href="/settings" className="text-link">History <ChevronRight size={14}/></Link></div><p>{existingDailySummary.summary}</p></div>}</Panel>
  <Panel className="bills-panel"><PanelTitle detail="THIS MONTH">On the horizon</PanelTitle>{data.bills.length?data.bills.slice().sort((a,b)=>a.dueDay-b.dueDay).slice(0,4).map(b=><div className="bill-line" key={b.id}><div className="bill-date"><strong>{String(b.dueDay).padStart(2,'0')}</strong><small>DAY</small></div><span>{b.title}</span><b>{money(b.baseAmount,data.settings.baseCurrency)}</b></div>):<Empty title="Nothing due yet" detail="Add a recurring bill in Money to see it here." icon={Clock3}/>}<Link href="/money" className="text-link">Open money plan <ChevronRight size={15}/></Link></Panel>
 </div></>
}
const currencies:Currency[]=['GBP','USD','AED','EUR'];
function MoneyPage({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
 const [kind,setKind]=useState<'expense'|'income'>('expense');
 const [title,setTitle]=useState('');
 const [category,setCategory]=useState('Food');
 const [amount,setAmount]=useState('');
 const [currency,setCurrency]=useState<Currency>(data.settings.baseCurrency);
 const [selectedMonth,setSelectedMonth]=useState(monthKey());
 const [transactionDate,setTransactionDate]=useState(dateKey());
 const [billTitle,setBillTitle]=useState('');
 const [billAmount,setBillAmount]=useState('');
 const [billCurrency,setBillCurrency]=useState<Currency>(data.settings.baseCurrency);
 const [dueDay,setDueDay]=useState('1');
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);

 const monthDate=(()=>{const [year,month]=selectedMonth.split('-').map(Number);return new Date(year,month-1,1)})();
 const monthLabel=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(monthDate);
 const entries=data.money.filter(entry=>entry.date.startsWith(selectedMonth)).sort((left,right)=>right.date.localeCompare(left.date)||right.id.localeCompare(left.id));
 const income=entries.filter(entry=>entry.kind==='income').reduce((sum,entry)=>sum+entry.baseAmount,0);
 const spent=entries.filter(entry=>entry.kind==='expense').reduce((sum,entry)=>sum+entry.baseAmount,0);
 const bills=data.bills.reduce((sum,bill)=>sum+bill.baseAmount,0);
 const commitment=spent+bills;
 const remaining=data.settings.monthlyIncomeTarget-commitment;
 const budgetLeft=data.settings.monthlySpendingBudget-commitment;
 const categories=Object.entries(entries.filter(entry=>entry.kind==='expense').reduce<Record<string,number>>((acc,entry)=>{
  const name=normalizeMoneyCategory(entry.kind,entry.category,entry.title);
  acc[name]=(acc[name]||0)+entry.baseAmount;
  return acc;
 },{})).sort((a,b)=>b[1]-a[1]);
 const largestCategory=categories[0]?.[1]||1;

 const setMonth=(nextMonth:string)=>{
  if(!/^\d{4}-\d{2}$/.test(nextMonth))return;
  setSelectedMonth(nextMonth);
  setTransactionDate(nextMonth===monthKey()?dateKey():`${nextMonth}-01`);
 };
 const shiftMonth=(offset:number)=>{
  const [year,month]=selectedMonth.split('-').map(Number);
  setMonth(dateKey(new Date(year,month-1+offset,1)).slice(0,7));
 };
 const addEntry=async()=>{
  const value=Number(amount);
  if(!title.trim()||!Number.isFinite(value)||value<=0){setError('Add a description and a valid amount.');return}
  if(!transactionDate.startsWith(selectedMonth)){setError('Choose a transaction date in the month you are viewing.');return}
  setSaving(true);setError('');
  try{
   const baseAmount=await convert(value,currency,data.settings.baseCurrency);
   update('money',[{id:makeId(),kind,title:title.trim(),category:normalizeMoneyCategory(kind,category,title),amount:value,currency,baseAmount,date:transactionDate},...data.money]);
   setTitle('');setCategory(kind==='income'?'Salary':'Food');setAmount('');
  }catch(e){setError(e instanceof Error?e.message:'Conversion failed. Nothing was saved.')}
  finally{setSaving(false)}
 };
 const deleteEntry=(entry:MoneyEntry)=>{
  if(!window.confirm(`Delete “${entry.title}” from ${monthLabel}? This cannot be undone.`))return;
  update('money',data.money.filter(item=>item.id!==entry.id));
 };
 const addBill=async()=>{
  const value=Number(billAmount),day=Number(dueDay);
  if(!billTitle.trim()||!Number.isFinite(value)||value<=0||!Number.isInteger(day)||day<1||day>31){setError('Add a name, valid amount and due day from 1 to 31.');return}
  setSaving(true);setError('');
  try{
   const baseAmount=await convert(value,billCurrency,data.settings.baseCurrency);
   update('bills',[{id:makeId(),title:billTitle.trim(),amount:value,currency:billCurrency,baseAmount,dueDay:day},...data.bills]);
   setBillTitle('');setBillAmount('');
  }catch(e){setError(e instanceof Error?e.message:'Conversion failed. Nothing was saved.')}
  finally{setSaving(false)}
 };

 return <>
  <TopHeading eyebrow="Your money" title="A plan you can trust." subtitle="See what comes in, what goes out, and what your life costs each month."/>
  <div className="money-month-toolbar" data-testid="money-month-navigation">
   <div className="money-month-copy"><span className="eyebrow">MONTHLY VIEW</span><h2>{monthLabel}</h2><p>Review this month’s income, spending and transactions.</p></div>
   <div className="money-month-controls">
    <button type="button" className="month-nav-button" aria-label="Previous month" data-testid="previous-money-month" onClick={()=>shiftMonth(-1)}><ChevronLeft size={17}/></button>
    <label className="field"><span>Choose month</span><input type="month" value={selectedMonth} data-testid="money-month-select" onChange={event=>setMonth(event.target.value)}/></label>
    <button type="button" className="month-nav-button" aria-label="Next month" data-testid="next-money-month" onClick={()=>shiftMonth(1)}><ChevronRight size={17}/></button>
   </div>
   <span className="money-month-count" data-testid="month-transaction-count">{entries.length} {entries.length===1?'transaction':'transactions'}</span>
  </div>
  <div className="money-overview">
   <Panel className="money-total">
    <span className="eyebrow light">{monthLabel.toLocaleUpperCase()} · MONTHLY COMMITMENT</span>
    <strong className="serif" data-testid="money-commitment">{money(commitment,data.settings.baseCurrency)}</strong>
    <p>Selected-month expenses plus the current recurring bill plan.</p>
    <div className="money-total-foot"><span>Income logged<b>{money(income,data.settings.baseCurrency)}</b></span><span>Expenses<b>{money(spent,data.settings.baseCurrency)}</b></span></div>
   </Panel>
   <Panel className="afford-panel">
    <PanelTitle detail="YOUR BASE CURRENCY">Affordability</PanelTitle>
    <div className="afford-line"><span>Monthly income target</span><b>{data.settings.monthlyIncomeTarget?money(data.settings.monthlyIncomeTarget,data.settings.baseCurrency):'Not set'}</b></div>
    <div className="afford-line"><span>After commitments</span><b className={remaining<0?'negative':''}>{data.settings.monthlyIncomeTarget?money(remaining,data.settings.baseCurrency):'Set a target in Settings'}</b></div>
    {data.settings.monthlySpendingBudget>0?<><div className="afford-line"><span>Budget remaining</span><b className={budgetLeft<0?'negative':''}>{money(budgetLeft,data.settings.baseCurrency)}</b></div><div className="thin-track"><i style={{width:`${Math.min(100,commitment/data.settings.monthlySpendingBudget*100)}%`}}/></div></>:<p className="quiet-note">Add a spending budget in Settings to track your monthly pace.</p>}
   </Panel>
  </div>
  <div className="two-column">
   <Panel>
    <PanelTitle>Add a transaction</PanelTitle>
    <div className="segmented">
     <button data-testid="kind-expense" className={kind==='expense'?'selected':''} onClick={()=>{setKind('expense');setCategory('Food')}}>Expense</button>
     <button data-testid="kind-income" className={kind==='income'?'selected':''} onClick={()=>{setKind('income');setCategory('Salary')}}>Income</button>
    </div>
    <Field label="Description" value={title} onChange={setTitle} placeholder="Groceries, salary, travel…" testId="money-title"/>
    <label className="field"><span>Category</span><select data-testid="money-category" value={category} onChange={event=>setCategory(event.target.value)}>{(kind==='expense'?EXPENSE_CATEGORIES:INCOME_CATEGORIES).map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    <div className="form-split">
     <Field label="Amount" value={amount} onChange={setAmount} placeholder="0.00" type="number" step="0.01" testId="money-amount"/>
     <label className="field"><span>Currency · converted on save</span><select data-testid="money-currency" value={currency} onChange={event=>setCurrency(event.target.value as Currency)}>{currencies.map(item=><option key={item}>{item}</option>)}</select></label>
    </div>
    <Field label="Transaction date" value={transactionDate} onChange={setTransactionDate} type="date" testId="money-date"/>
    <Button testId="save-transaction" onClick={()=>void addEntry()} disabled={saving||!title.trim()||!amount}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}Save transaction</Button>
    {error&&<p className="form-error" data-testid="money-error">{error}</p>}
   </Panel>
   <Panel>
    <PanelTitle detail="REPEATS MONTHLY">Add a recurring bill</PanelTitle>
    {data.bills.length?data.bills.map(bill=><div className="bill-line bill-edit" key={bill.id}><span className="due-pill">Day {bill.dueDay}</span><span>{bill.title}</span><b>{money(bill.baseAmount,data.settings.baseCurrency)}</b><IconButton label={`Remove ${bill.title}`} testId={`remove-bill-${bill.id}`} onClick={()=>update('bills',data.bills.filter(item=>item.id!==bill.id))}><X size={16}/></IconButton></div>):<Empty title="No bills in the plan" detail="Add recurring payments to understand your monthly baseline." icon={Clock3}/>}
    <div className="divider"/>
    <Field label="Bill name" value={billTitle} onChange={setBillTitle} placeholder="Rent, phone, internet…" testId="bill-title"/>
    <div className="form-split"><Field label="Amount" value={billAmount} onChange={setBillAmount} type="number" step="0.01" placeholder="0.00" testId="bill-amount"/><Field label="Due day" value={dueDay} onChange={setDueDay} type="number" placeholder="1–31" testId="bill-due-day"/></div>
    <label className="field"><span>Currency · converted on save</span><select data-testid="bill-currency" value={billCurrency} onChange={event=>setBillCurrency(event.target.value as Currency)}>{currencies.map(item=><option key={item}>{item}</option>)}</select></label>
    <Button testId="add-bill" onClick={()=>void addBill()} disabled={saving||!billTitle.trim()||!billAmount}><Plus size={16}/>Add recurring bill</Button>
   </Panel>
  </div>
  <div className="two-column money-bottom">
   <Panel>
    <PanelTitle detail={monthLabel}>Spending by category</PanelTitle>
    {categories.length?categories.map(([name,total])=><div className="category-row" key={name}><div><span>{name}</span><b>{money(total,data.settings.baseCurrency)}</b></div><div className="category-track"><i style={{width:`${Math.max(4,total/largestCategory*100)}%`}}/></div></div>):<Empty title="No spending in this month" detail={`There are no expense transactions recorded for ${monthLabel}.`} icon={TrendingUp}/>}
   </Panel>
   <Panel>
    <PanelTitle detail={`${entries.length} ${entries.length===1?'TRANSACTION':'TRANSACTIONS'}`}>Transactions · {monthLabel}</PanelTitle>
    {entries.length?entries.map(entry=><div className="activity-row" key={entry.id}><div className={cls('activity-mark',entry.kind)}>{entry.kind==='income'?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</div><div className="activity-copy"><b>{entry.title}</b><small>{normalizeMoneyCategory(entry.kind,entry.category,entry.title)} · {entry.date}</small></div><strong className={entry.kind==='income'?'income-value':''}>{entry.kind==='expense'?'−':'+'}{money(entry.baseAmount,data.settings.baseCurrency)}</strong><button type="button" className="activity-delete" aria-label={`Delete ${entry.title}`} title={`Delete ${entry.title}`} data-testid={`remove-entry-${entry.id}`} onClick={()=>deleteEntry(entry)}><Trash2 size={14}/><span>Delete</span></button></div>):<Empty title="No transactions this month" detail="Entries you add for this month will appear here." icon={Wallet}/>}
   </Panel>
  </div>
 </>
}
function StudyPage({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
 const [category,setCategory]=useState('');const [title,setTitle]=useState('');const [notes,setNotes]=useState('');
 const groups=useMemo(()=>{const map=new Map<string,StudyModule[]>();data.modules.forEach(m=>map.set(m.category,[...(map.get(m.category)||[]),m]));return [...map.entries()]},[data.modules]);
  const add=()=>{const c=category.trim()||'General';if(!title.trim())return;const moduleNumber=data.modules.filter(m=>m.category.toLowerCase()===c.toLowerCase()).reduce((n,m)=>Math.max(n,m.moduleNumber),0)+1;update('modules',[{id:makeId(),category:c,title:title.trim(),moduleNumber,notes:notes.trim(),createdAt:new Date().toISOString(),done:false},...data.modules]);setTitle('');setNotes('')};
 return <><TopHeading eyebrow="Learning library" title="Keep what you learn." subtitle="A growing shelf of your study, organized by subject and in sequence."/><div className="study-layout"><Panel className="study-form"><div className="study-form-intro"><div className="round-icon"><BookOpen size={19}/></div><span className="eyebrow">A NEW ENTRY</span><h2 className="serif">Add a module</h2><p>Keep a breadcrumb trail of the ideas you’re collecting.</p></div><Field label="Category" value={category} onChange={setCategory} placeholder="Design, finance, languages…" testId="module-category"/><Field label="Module name" value={title} onChange={setTitle} placeholder="What did you study?" testId="module-title"/><Field label="Notes and takeaways" value={notes} onChange={setNotes} placeholder="Capture an idea worth remembering…" testId="module-notes" multiline/><Button testId="add-module" onClick={add} disabled={!title.trim()}><Plus size={16}/>Save module</Button><p className="quiet-note">Numbers are assigned automatically within each category.</p></Panel><div className="study-library"><Panel><PanelTitle detail={`${data.modules.length} SAVED`}>Your library</PanelTitle>{groups.length?groups.map(([group,mods])=><section className="module-group" key={group}><header><h3>{group}</h3><span>{mods.length} {mods.length===1?'module':'modules'}</span></header>{mods.slice().sort((a,b)=>a.moduleNumber-b.moduleNumber).map(m=><article className="module-item" key={m.id}><div className="module-number">{String(m.moduleNumber).padStart(2,'0')}</div><div className="module-body"><b>{m.title}</b><small>{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(m.createdAt))}</small>{m.notes&&<p>{m.notes}</p>}</div><IconButton label={`Delete ${m.title}`} testId={`remove-module-${m.id}`} onClick={()=>update('modules',data.modules.filter(x=>x.id!==m.id))}><Trash2 size={15}/></IconButton></article>)}</section>):<Empty title="Your first module starts here" detail="Add a subject and a title. Each module will be numbered as your library grows." icon={BookOpen}/>}</Panel><Panel className="study-rhythm"><span className="eyebrow">YOUR STUDY RHYTHM</span><strong className="serif">{data.modules.length}</strong><p>modules saved across {new Set(data.modules.map(m=>m.category)).size} {new Set(data.modules.map(m=>m.category)).size===1?'subject':'subjects'}</p></Panel></div></div></>
}
type Food={id:string;name:string;source:string;calories:number;protein:number;carbs:number;fat:number};
function nutritionValue(list:Array<{nutrientName?:string;value?:number;unitName?:string}>|undefined,kind:'calories'|'protein'|'carbs'|'fat'){
 const values=list||[];if(kind==='calories'){const kcal=values.find(n=>/energy|calorie/i.test(n.nutrientName||'')&&/kcal/i.test(n.unitName||''));if(kcal)return Math.max(0,Number(kcal.value||0));const energy=values.find(n=>/energy|calorie/i.test(n.nutrientName||''));return Math.max(0,Number(energy?.value||0)/(energy&&/kj/i.test(energy.unitName||'')?4.184:1))}
 const regex={protein:/protein/i,carbs:/carbohydrate/i,fat:/total lipid|total fat/i};return Math.max(0,Number(values.find(n=>regex[kind].test(n.nutrientName||''))?.value||0))
}
async function searchFood(query:string):Promise<Food[]>{
 const found:Food[]=[];let completedQueries=0;
 try{const url=new URL('https://api.nal.usda.gov/fdc/v1/foods/search');url.searchParams.set('query',query);url.searchParams.set('api_key','DEMO_KEY');url.searchParams.set('pageSize','5');url.searchParams.set('dataType','Foundation,SR Legacy,Survey (FNDDS)');const res=await fetch(url);if(res.ok){completedQueries++;const body=await res.json() as {foods?:Array<{fdcId:number;description:string;foodNutrients?:Array<{nutrientName?:string;value?:number;unitName?:string}>}>};for(const f of body.foods||[]){const calories=nutritionValue(f.foodNutrients,'calories');if(f.description&&calories>0)found.push({id:`usda-${f.fdcId}`,name:f.description,source:'USDA FoodData Central',calories,protein:nutritionValue(f.foodNutrients,'protein'),carbs:nutritionValue(f.foodNutrients,'carbs'),fat:nutritionValue(f.foodNutrients,'fat')})}}}catch{}
 try{const res=await fetch(`https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=5&fields=code,product_name,brands,nutriments`);if(res.ok){completedQueries++;const body=await res.json() as {products?:Array<{code?:string;product_name?:string;brands?:string;nutriments?:Record<string,number>}>};for(const p of body.products||[]){const n=p.nutriments||{};const calories=Number(n['energy-kcal_100g']||n['energy-kcal_value']||0);if(p.product_name&&calories>0)found.push({id:`off-${p.code||makeId()}`,name:p.brands?`${p.product_name} · ${p.brands}`:p.product_name,source:'Open Food Facts',calories,protein:Number(n.proteins_100g||0),carbs:Number(n.carbohydrates_100g||0),fat:Number(n.fat_100g||0)})}}}catch{}
 if(!completedQueries)throw new Error('Food databases are unavailable.');
 return found
}
async function compressPhoto(file:File):Promise<Blob>{const image=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const context=canvas.getContext('2d');if(!context){image.close();throw new Error('Could not prepare this photo.')}context.drawImage(image,0,0,canvas.width,canvas.height);image.close();return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not compress this photo.')),'image/jpeg',0.82))}
function openDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('life-tracker-images',1);req.onupgradeneeded=()=>req.result.createObjectStore('workout-images');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function storeImage(key:string,blob:Blob){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('workout-images','readwrite');tx.objectStore('workout-images').put(blob,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}
async function loadImage(key:string){const db=await openDb();const blob=await new Promise<Blob|undefined>((resolve,reject)=>{const r=db.transaction('workout-images').objectStore('workout-images').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return blob}
function HealthPage({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
 const [tab,setTab]=useState<'food'|'training'>('food');const [query,setQuery]=useState('');const [results,setResults]=useState<Food[]>([]);const [searching,setSearching]=useState(false);const [foodError,setFoodError]=useState('');const [grams,setGrams]=useState('100');const [mealTime,setMealTime]=useState(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}));const [manual,setManual]=useState(false);const [manualValues,setManualValues]=useState(['','','','']);const [exercise,setExercise]=useState('');const [weight,setWeight]=useState('');const [reps,setReps]=useState('');const [sets,setSets]=useState('');const [finishTime,setFinishTime]=useState(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}));const [photoBlob,setPhotoBlob]=useState<Blob|null>(null);const [photoPreview,setPhotoPreview]=useState('');const [suggestion,setSuggestion]=useState('');const [exerciseError,setExerciseError]=useState('');const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
 const identify=useIdentifyExerciseMachine();const today=data.meals.filter(m=>m.date===dateKey());const calories=today.reduce((s,m)=>s+m.calories,0);const protein=today.reduce((s,m)=>s+m.protein,0);const carbs=today.reduce((s,m)=>s+m.carbs,0);const fats=today.reduce((s,m)=>s+m.fat,0);
 useEffect(()=>{let alive=true;data.workouts.filter(w=>w.photoKey).forEach(w=>{if(w.photoKey&&!photoUrls[w.photoKey])void loadImage(w.photoKey).then(blob=>{if(alive&&blob)setPhotoUrls(prev=>({...prev,[w.photoKey!]:URL.createObjectURL(blob)}))}).catch(()=>{})});return()=>{alive=false}},[data.workouts]);
 const lookup=async()=>{if(!query.trim())return;setSearching(true);setFoodError('');setResults([]);try{const found=await searchFood(query.trim());setResults(found);if(!found.length)setFoodError('No matches found. You can enter the nutrition from a verified label.')}catch{setFoodError('Nutrition search is unavailable. Try again or enter the label values.')}finally{setSearching(false)}};
 const logFood=(food:Food)=>{const amount=Number(grams);if(!Number.isFinite(amount)||amount<=0){setFoodError('Enter a valid portion in grams first.');return}const factor=amount/100;update('meals',[{id:makeId(),name:food.name,grams:amount,calories:Math.round(food.calories*factor),protein:Math.round(food.protein*factor*10)/10,carbs:Math.round(food.carbs*factor*10)/10,fat:Math.round(food.fat*factor*10)/10,time:mealTime||'12:00',date:dateKey(),source:food.source},...data.meals]);setResults([]);setQuery('')};
 const logManual=()=>{const vals=manualValues.map(Number);const amount=Number(grams);if(!query.trim()||!Number.isFinite(amount)||amount<=0||vals.some(v=>!Number.isFinite(v)||v<0)){setFoodError('Enter a food name, portion and valid macro values.');return}update('meals',[{id:makeId(),name:query.trim(),grams:amount,calories:vals[0],protein:vals[1],carbs:vals[2],fat:vals[3],time:mealTime||'12:00',date:dateKey(),source:'Food label / manual'},...data.meals]);setQuery('');setManual(false)};
 const choosePhoto=async(file?:File)=>{if(!file)return;setExerciseError('');setSuggestion('');const accepted=['image/jpeg','image/png','image/webp'];if(!accepted.includes(file.type)){setExerciseError('Choose a JPEG, PNG or WebP image.');return}try{const compressed=await compressPhoto(file);setPhotoBlob(compressed);setPhotoPreview(URL.createObjectURL(compressed));const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(compressed)});const result=await identify.mutateAsync({data:{imageBase64:base64,mimeType:'image/jpeg'}});setSuggestion(result.suggestion);const name=result.suggestion.split(/[.\n]/)[0].replace(/^likely (an? )?/i,'').trim();if(name)setExercise(name)}catch(e){setExerciseError(e instanceof Error?e.message:'Could not identify this equipment.')}}
 const saveWorkout=async()=>{const w=Number(weight),r=Number(reps),s=Number(sets);if(!exercise.trim()||!Number.isFinite(w)||w<0||!Number.isInteger(r)||r<1||!Number.isInteger(s)||s<1){setExerciseError('Add an exercise name, weight, reps and sets.');return}let photoKey:string|undefined;if(photoBlob){photoKey=makeId();try{await storeImage(photoKey,photoBlob)}catch{setExerciseError('Image could not be saved locally. Workout was not saved.');return}}const record:WorkoutEntry={id:makeId(),exercise:exercise.trim(),weight:w,reps:r,sets:s,finishedAt:finishTime,date:dateKey(),photoKey};update('workouts',[record,...data.workouts]);setWeight('');setReps('');setSets('');setPhotoBlob(null);setPhotoPreview('');setSuggestion('');setExerciseError('')};
 const exerciseHistory=useMemo(()=>data.workouts.filter(w=>w.exercise.toLowerCase()===exercise.trim().toLowerCase()).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-8),[data.workouts,exercise]);
 const graphValues=exerciseHistory.map(w=>w.weight);const graphMin=Math.min(...graphValues),graphMax=Math.max(...graphValues);const points=graphValues.map((v,i)=>`${graphValues.length===1?160:12+i/(graphValues.length-1)*296},${96-((v-graphMin)/Math.max(1,graphMax-graphMin))*72}`).join(' ');
 return <><TopHeading eyebrow="Nutrition & training" title="Care for your energy." subtitle="Small, steady records of what fuels you and how you grow stronger."/><div className="health-switch"><button className={tab==='food'?'selected':''} onClick={()=>setTab('food')} data-testid="health-tab-food"><Heart size={16}/>Food & macros</button><button className={tab==='training'?'selected':''} onClick={()=>setTab('training')} data-testid="health-tab-training"><Dumbbell size={16}/>Training</button></div>{tab==='food'?<div className="health-layout"><div className="health-left"><Panel className="nutrition-card"><div className="nutrition-top"><div><span className="eyebrow">TODAY · NUTRITION</span><div className="calorie-number" data-testid="daily-calories">{Math.round(calories).toLocaleString()}<small> kcal</small></div><p>of {data.settings.calorieTarget.toLocaleString()} kcal target</p></div><div className="macro-donut" style={{'--progress':`${Math.min(100,calories/Math.max(1,data.settings.calorieTarget)*100)}%`} as CSSProperties}><span><Heart size={17}/></span></div></div><div className="nutrition-track"><i style={{width:`${Math.min(100,calories/Math.max(1,data.settings.calorieTarget)*100)}%`}}/></div><div className="nutrition-macros"><div><small>PROTEIN</small><b>{Math.round(protein)} <i>/ {data.settings.proteinTarget}g</i></b></div><div><small>CARBS</small><b>{Math.round(carbs)} <i>g</i></b></div><div><small>FAT</small><b>{Math.round(fats)} <i>g</i></b></div></div></Panel>
 <Panel><PanelTitle>Log a meal</PanelTitle><p className="panel-copy">Search USDA for everyday foods or Open Food Facts for branded products. Values are scaled to your portion.</p><Field label="Food or product" value={query} onChange={setQuery} placeholder="Try “oats” or a packaged product" testId="food-search"/><div className="form-split"><Field label="Portion (g)" value={grams} onChange={setGrams} type="number" testId="food-grams"/><Field label="Meal time" value={mealTime} onChange={setMealTime} type="time" testId="food-time"/></div><Button testId="search-food" onClick={()=>void lookup()} disabled={!query.trim()||searching}>{searching?<LoaderCircle className="spin" size={16}/>:<Search size={16}/>}Search food data</Button>{foodError&&<p className="form-error" data-testid="food-error">{foodError}</p>}{results.map(f=><div className="food-result" key={f.id}><div><b>{f.name}</b><small>{f.source} · per 100g · {Math.round(f.calories)} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g</small></div><Button secondary testId={`log-food-${f.id}`} onClick={()=>logFood(f)}>Log</Button></div>)}<button className="plain-link" data-testid="manual-food-toggle" onClick={()=>setManual(v=>!v)}>{manual?'Close manual entry':'Enter macros from food label'}</button>{manual&&<div className="manual-entry"><p>Enter macros for the selected portion ({grams || 0} g).</p><div className="form-split">{['Calories (kcal)','Protein (g)'].map((x,i)=><Field key={x} label={x} value={manualValues[i]} onChange={v=>setManualValues(prev=>prev.map((a,j)=>i===j?v:a))} type="number" testId={`manual-${i}`}/>)}</div><div className="form-split">{['Carbs (g)','Fat (g)'].map((x,i)=><Field key={x} label={x} value={manualValues[i+2]} onChange={v=>setManualValues(prev=>prev.map((a,j)=>i+2===j?v:a))} type="number" testId={`manual-${i+2}`}/>)}</div><Button testId="save-manual-meal" onClick={logManual}><Check size={15}/>Save meal</Button></div>}</Panel></div><Panel className="meals-card"><PanelTitle detail={`${today.length} LOGGED`}>Today’s meals</PanelTitle>{today.length?today.map(m=><div className="meal-entry" key={m.id}><div className="meal-time">{m.time}</div><div className="meal-description"><b>{m.name}</b><small>{m.grams} g · {m.source}</small><span>P {m.protein} · C {m.carbs} · F {m.fat} g</span></div><strong>{Math.round(m.calories)}<small> kcal</small></strong><IconButton label={`Remove ${m.name}`} testId={`remove-meal-${m.id}`} onClick={()=>update('meals',data.meals.filter(x=>x.id!==m.id))}><Trash2 size={15}/></IconButton></div>):<Empty title="A clear start to the day" detail="Search for something you ate, or enter values from a food label." icon={Heart}/>}</Panel></div>:<div className="training-layout"><Panel className="training-form"><div className="training-intro"><div className="round-icon"><Dumbbell size={19}/></div><span className="eyebrow">STRENGTH NOTES</span><h2 className="serif">Log your workout</h2><p>Record a set, and give your progress somewhere to go.</p></div><label className="photo-drop" data-testid="equipment-photo-drop"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>void choosePhoto(e.currentTarget.files?.[0])}/><span className="photo-icon">{identify.isPending?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}</span><b>{identify.isPending?'Reading equipment…':'Identify equipment from a photo'}</b><small>Optional · JPEG, PNG or WebP</small></label>{photoPreview&&<img className="machine-preview" src={photoPreview} alt="Selected exercise equipment"/>}{suggestion&&<div className="suggestion-box" data-testid="exercise-suggestion"><span className="eyebrow">SUGGESTION</span><p>{suggestion}</p></div>}<Field label="Exercise or machine" value={exercise} onChange={setExercise} placeholder="e.g. Seated row" testId="exercise-name"/><div className="form-triple"><Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="0" type="number" testId="workout-weight"/><Field label="Reps" value={reps} onChange={setReps} placeholder="0" type="number" testId="workout-reps"/><Field label="Sets" value={sets} onChange={setSets} placeholder="0" type="number" testId="workout-sets"/></div><Field label="Finished at" value={finishTime} onChange={setFinishTime} type="time" testId="workout-time"/>{exerciseError&&<p className="form-error" data-testid="workout-error">{exerciseError}</p>}<Button testId="save-workout" onClick={()=>void saveWorkout()} disabled={!exercise.trim()||!weight||!reps||!sets}><Check size={16}/>Save workout</Button></Panel>
 <div className="training-records"><Panel><PanelTitle detail="WEIGHT LIFTED">Progress history</PanelTitle><label className="field"><span>Choose an exercise to view</span><select data-testid="exercise-history-select" value={exercise} onChange={e=>setExercise(e.target.value)}><option value="">Select or type an exercise</option>{[...new Set(data.workouts.map(w=>w.exercise))].map(n=><option key={n}>{n}</option>)}</select></label>{exerciseHistory.length?<><h3 className="chart-title">{exerciseHistory[exerciseHistory.length-1].exercise}</h3><svg className="progress-chart" viewBox="0 0 320 110" preserveAspectRatio="none" aria-label="Workout weight progress chart"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{graphValues.map((v,i)=><circle key={`${i}-${v}`} cx={graphValues.length===1?160:12+i/(graphValues.length-1)*296} cy={96-((v-graphMin)/Math.max(1,graphMax-graphMin))*72} r="4" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="2"/>)}</svg><div className="chart-caption"><span>{exerciseHistory.length} recent sessions</span><span>{graphMin===graphMax?`${graphMax} kg`:`${graphMin}–${graphMax} kg`}</span></div>{exerciseHistory.slice().reverse().map(w=><div className="workout-row" key={w.id}><div><b>{w.weight} kg <span>·</span> {w.sets} × {w.reps}</b><small>{w.date} · finished {w.finishedAt}</small></div><IconButton label="Delete workout" testId={`remove-workout-${w.id}`} onClick={()=>update('workouts',data.workouts.filter(x=>x.id!==w.id))}><Trash2 size={15}/></IconButton></div>)}</>:<Empty title="Progress appears with each log" detail="Use the same exercise name each time to build a weight history." icon={TrendingUp}/>}</Panel>{data.workouts.some(w=>w.photoKey)&&<Panel><PanelTitle>Equipment photos</PanelTitle><div className="equipment-gallery">{data.workouts.filter(w=>w.photoKey).map(w=><div key={w.id}>{photoUrls[w.photoKey!]&&<img src={photoUrls[w.photoKey!]} alt={`${w.exercise} equipment`}/>}<small>{w.exercise}</small></div>)}</div></Panel>}</div></div>}</>
}
function SettingsPage({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
 const [token,setToken]=useState('');const [show,setShow]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const send=useSendLifeTelegramTest();
 const [currencyError,setCurrencyError]=useState('');const [changingCurrency,setChangingCurrency]=useState(false);
 const change=(key:keyof Settings,value:string|number)=>update('settings',{...data.settings,[key]:value} as Settings);
 const changeBaseCurrency=async(next:Currency)=>{const previous=data.settings.baseCurrency;if(next===previous)return;setCurrencyError('');setChangingCurrency(true);try{const rate=await getRate(previous,next);const revalue=(amount:number)=>Math.round(amount*rate*100)/100;update('money',data.money.map(entry=>({...entry,baseAmount:revalue(entry.baseAmount)})));update('bills',data.bills.map(bill=>({...bill,baseAmount:revalue(bill.baseAmount)})));update('settings',{...data.settings,baseCurrency:next,monthlyIncomeTarget:revalue(data.settings.monthlyIncomeTarget),monthlySpendingBudget:revalue(data.settings.monthlySpendingBudget)})}catch(e){setCurrencyError(e instanceof Error?`${e.message} Your settings and records were not changed.`:'Currency could not be changed. Your records were not changed.')}finally{setChangingCurrency(false)}};
 const test=async()=>{setMessage('');setError('');if(!token.trim()||!data.settings.telegramChatId.trim()){setError('Enter both your bot token and chat ID before testing.');return}try{const result=await send.mutateAsync({data:{token:token.trim(),chatId:data.settings.telegramChatId.trim()}});if(result.sent)setMessage('Test message sent. Telegram is connected.');else setError(result.error||'Telegram did not accept the test message.')}catch(e){setError(e instanceof Error?e.message:'Telegram connection failed. Check the token and chat ID.')}}
 return <><TopHeading eyebrow="Personal preferences" title="Make it yours." subtitle="Set the targets and reminders that make this space feel personal."/><div className="settings-layout"><Panel><div className="setting-icon"><Wallet size={18}/></div><PanelTitle>Money preferences</PanelTitle><label className="field"><span>Main currency</span><select data-testid="setting-currency" value={data.settings.baseCurrency} disabled={changingCurrency} onChange={e=>void changeBaseCurrency(e.target.value as Currency)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></label><p className="quiet-note">New amounts use this currency. Changing it revalues existing totals at the current exchange rate.</p>{currencyError&&<p className="form-error" data-testid="currency-error">{currencyError}</p>}<Field label={`Monthly income target (${data.settings.baseCurrency})`} value={data.settings.monthlyIncomeTarget||''} onChange={v=>change('monthlyIncomeTarget',Number(v)||0)} placeholder="Set a monthly target" type="number" testId="setting-income-target"/><Field label={`Monthly spending budget (${data.settings.baseCurrency})`} value={data.settings.monthlySpendingBudget||''} onChange={v=>change('monthlySpendingBudget',Number(v)||0)} placeholder="Set a comfortable limit" type="number" testId="setting-spending-budget"/></Panel><Panel><div className="setting-icon"><Heart size={18}/></div><PanelTitle>Nutrition & check-ins</PanelTitle><Field label="Daily calorie target" value={data.settings.calorieTarget} onChange={v=>change('calorieTarget',Number(v)||0)} type="number" testId="setting-calorie-target"/><Field label="Daily protein target (g)" value={data.settings.proteinTarget} onChange={v=>change('proteinTarget',Number(v)||0)} type="number" testId="setting-protein-target"/><div className="form-split"><Field label="Meal check-in time" value={data.settings.mealPrompt} onChange={v=>change('mealPrompt',v)} type="time" testId="setting-meal-prompt"/><Field label="Workout check-in time" value={data.settings.workoutPrompt} onChange={v=>change('workoutPrompt',v)} type="time" testId="setting-workout-prompt"/></div><p className="quiet-note">These times are saved as personal preferences and used as suggested log times.</p></Panel><Panel className="telegram-panel"><div className="setting-icon"><Activity size={18}/></div><PanelTitle>Telegram connection</PanelTitle><p className="panel-copy">Send a one-time test message to check your bot setup. Create a bot with Telegram’s BotFather, then add its token and your chat ID.</p><Field label="Bot API token" value={token} onChange={setToken} placeholder="Token stays in memory only" type={show?'text':'password'} testId="telegram-token"/><button className="plain-link" data-testid="toggle-token-visibility" onClick={()=>setShow(v=>!v)}>{show?'Hide token':'Show token'}</button><Field label="Telegram chat ID" value={data.settings.telegramChatId} onChange={v=>change('telegramChatId',v)} placeholder="Your personal or group chat ID" testId="telegram-chat-id"/><Button testId="test-telegram" onClick={()=>void test()} disabled={send.isPending||!token.trim()||!data.settings.telegramChatId.trim()}>{send.isPending?<LoaderCircle className="spin" size={16}/>:<ArrowUpRight size={16}/>}Send test message</Button>{message&&<p className="success-note" data-testid="telegram-status">{message}</p>}{error&&<p className="form-error" data-testid="telegram-error">{error}</p>}<div className="privacy-callout"><CheckCircle2 size={16}/><p>Your bot token is never written to local storage. It stays in this page’s memory and is sent to the test endpoint only when you ask to send a message.</p></div></Panel><Panel className="privacy-panel"><div className="setting-icon"><Settings2 size={18}/></div><PanelTitle>Data & privacy</PanelTitle><p>Your tasks, money, meals, workouts, notes and modules are stored in this browser. Workout photos are kept in IndexedDB on this device.</p><p>Voice transcription, exercise photo identification and AI reviews send only the recording, image or summary you request to the service. Nutrition search uses USDA FoodData Central and Open Food Facts; check labels when precision matters.</p><div className="storage-badge"><span className="service-dot online"/>Local-first by design</div></Panel></div></>
}
 function WordOfWeekPanel({data,update}:{data:LifeData;update:<K extends keyof LifeData>(key:K,value:LifeData[K])=>void}){
  const today=new Date();const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7));const week=dateKey(monday);const selection=data.weeklyWordSelection?.week===week?data.weeklyWordSelection:undefined;const word=getSelectedWeeklyWord(selection,today);const saved=data.savedWords.some(item=>item.word.trim().toLocaleLowerCase()===word.word.toLocaleLowerCase());
 const saveWord=()=>{if(saved)return;const entry:SavedWord={id:makeId(),word:word.word,partOfSpeech:word.partOfSpeech,definition:word.definition,sentence:word.sentence,conversation:[...word.conversation],week,date:dateKey(today),savedAt:new Date().toISOString()};update('savedWords',[entry,...data.savedWords])};
 return <Panel className="word-of-week-panel">
  <div className="word-week-intro">
   <span className="eyebrow">WORD OF THE WEEK</span>
   <h2 className="serif word-week-title">{word.word}</h2>
   <p className="word-week-part">{word.partOfSpeech}</p>
   <p className="word-week-definition">{word.definition}</p>
  </div>
  <div className="word-week-examples">
   <div className="word-week-example">
    <span className="word-week-example-label">IN A SENTENCE</span>
    <p>“{word.sentence}”</p>
   </div>
   <div className="word-week-example">
    <span className="word-week-example-label">IN CONVERSATION</span>
    <p><span className="word-week-speaker">A:</span> {word.conversation[0]}</p>
    <p><span className="word-week-speaker">B:</span> {word.conversation[1]}</p>
   </div>
  </div>
   <div className="word-week-save"><span data-testid="word-save-status">{saved?'Saved to your words':`Week of ${week}`}</span><Button testId="save-weekly-word" onClick={saveWord} disabled={saved}>{saved?<Check size={15}/>:<Bookmark size={15}/>} {saved?'Saved':'Save this word'}</Button></div>
 </Panel>
}
function NotFound(){return <div className="not-found"><span className="eyebrow">PAGE NOT FOUND</span><h1 className="serif">Let’s find your way back.</h1><Link href="/user-portal" className="button"><Home size={16}/>Return to today</Link></div>}
const queryClient=new QueryClient();
function TrackerRouter({onSignOut}:{onSignOut:()=>Promise<void>}){
 const {data,update,ready}=useLife();
 const [path]=useLocation();
 const reminderSync=useSyncLifeReminderSnapshot();
 useEffect(()=>{
  if(!ready)return;
  void reminderSync.mutateAsync({data:{
   tasks:data.tasks.map(({id,title,done,date})=>({id,title,done,date})),
   modules:data.modules.map(({id,title,category,moduleNumber,done})=>({id,title,category,moduleNumber,done:Boolean(done)})),
  }}).catch(()=>{});
 },[ready,data.tasks,data.modules]);
 const route=path==='/user-portal'?'/':path;
 const page=route==='/'?<HomePage data={data} update={update}/>
  :route==='/money'?<MoneyPage data={data} update={update}/>
  :route==='/study'?<StudyDashboard data={data} update={update}/>
  :route==='/health'?<HealthDashboard data={data} update={update}/>
   :route==='/settings'?<SettingsDashboard data={data} update={update} onSignOut={onSignOut}/>
  :<NotFound/>;
  return <AppShell>{!ready?<div className="loading-surface"><div className="skeleton skeleton-heading"/><div className="skeleton-grid"><div className="skeleton"/><div className="skeleton"/></div></div>:<>{page}{route==='/'&&<WordOfWeekPanel data={data} update={update}/>}</>}</AppShell>
}
function AuthLoading(){return <div className="auth-loading" role="status">Opening your private tracker…</div>}

function PasscodePage({
 configured,
 error,
 pending,
 onUnlock,
}:{
 configured:boolean;
 error:string;
 pending:boolean;
 onUnlock:(passcode:string)=>Promise<void>;
}){
 const [passcode,setPasscode]=useState('');
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  void onUnlock(passcode);
 };
 return <main className="auth-landing passcode-page">
  <section className="auth-story">
   <div className="auth-brand"><span className="auth-brand-mark"><Check size={19}/></span><span>daybook</span></div>
   <p className="auth-kicker">A PRIVATE SPACE FOR YOUR EVERYDAY</p>
   <h1>Make room for the life you’re building.</h1>
   <p className="auth-description">Your daily tasks, learning, spending, meals, and training in one calm place.</p>
   <div className="auth-features">
    <div className="auth-feature"><span className="auth-feature-mark"/>Daily tasks and study modules</div>
    <div className="auth-feature"><span className="auth-feature-mark"/>Food, macros, and gym progress</div>
    <div className="auth-feature"><span className="auth-feature-mark"/>Monthly money reviews</div>
    <div className="auth-feature"><span className="auth-feature-mark"/>Optional Telegram reminders</div>
   </div>
  </section>
  <section className="auth-card-wrap passcode-card">
   <h2>Unlock your tracker</h2>
   <p>Enter your passcode to continue.</p>
   {!configured && <p className="passcode-message" role="alert">Passcode access is not configured on the server yet.</p>}
   <form className="passcode-form" onSubmit={submit}>
    <label htmlFor="tracker-passcode">Passcode</label>
    <input
     id="tracker-passcode"
     data-testid="tracker-passcode"
     type="password"
     inputMode="numeric"
     autoComplete="current-password"
     value={passcode}
     onChange={(event)=>setPasscode(event.target.value)}
     maxLength={128}
     required
     aria-describedby={error ? "passcode-error" : undefined}
    />
    {error && <p className="passcode-message" id="passcode-error" role="alert">{error}</p>}
    <button
     className="auth-action-primary"
     data-testid="unlock-tracker"
     type="submit"
     disabled={!configured || pending || passcode.length < 4}
    >
     {pending ? "Checking passcode…" : "Unlock tracker"}
    </button>
   </form>
   <div className="auth-local-note"><Check size={15}/><span>Your main tracker records stay in this browser. Telegram reminder settings are stored on the server with encrypted credentials.</span></div>
  </section>
 </main>
}

function AuthUnavailable({onRetry}:{onRetry:()=>void}){
 return <main className="auth-screen">
  <section className="auth-card-wrap passcode-card">
   <h2>Tracker unavailable</h2>
   <p>Passcode access could not be checked. Check your connection and try again.</p>
   <button className="auth-action-primary" type="button" onClick={onRetry}>Try again</button>
  </section>
 </main>
}

function authErrorStatus(error:unknown):number|undefined{
 if(typeof error!=='object'||error===null||!('status' in error))return undefined;
 const status=(error as {status?:unknown}).status;
 return typeof status==='number'?status:undefined;
}

function AuthGate(){
 const session=useGetLifeTrackerSession({query:{queryKey:getGetLifeTrackerSessionQueryKey(),retry:false,refetchOnWindowFocus:true}});
 const unlock=useUnlockLifeTracker();
 const logout=useLogoutLifeTracker();
 const queryClient=useQueryClient();
 const [,setLocation]=useLocation();
 const [loginError,setLoginError]=useState('');
 useEffect(()=>{
  const requireUnlock=()=>queryClient.setQueryData(getGetLifeTrackerSessionQueryKey(),{configured:true,authenticated:false});
  window.addEventListener('life-tracker-auth-expired',requireUnlock);
  return()=>window.removeEventListener('life-tracker-auth-expired',requireUnlock);
 },[queryClient]);
 const handleUnlock=async(passcode:string)=>{
  setLoginError('');
  try{
   const result=await unlock.mutateAsync({data:{passcode}});
    queryClient.setQueryData(getGetLifeTrackerSessionQueryKey(),{
     configured:result.configured,
     authenticated:result.authenticated,
    });
  }catch(error){
   const status=authErrorStatus(error);
   setLoginError(status===401?'That passcode was not accepted.'
    :status===429?'Too many attempts. Wait a little before trying again.'
    :status===503?'Passcode access is not configured on the server yet.'
    :'Could not check the passcode. Please try again.');
  }
 };
 const handleSignOut=async()=>{
  await logout.mutateAsync();
  queryClient.clear();
  queryClient.setQueryData(getGetLifeTrackerSessionQueryKey(),{configured:true,authenticated:false});
  setLocation('/');
 };

 if(session.isPending)return <AuthLoading/>;
 if(session.isError)return <AuthUnavailable onRetry={()=>{void session.refetch()}}/>;
 if(!session.data?.authenticated){
  return <PasscodePage
   configured={session.data?.configured??false}
   error={loginError}
   pending={unlock.isPending}
   onUnlock={handleUnlock}
  />;
 }
 return <TrackerRouter onSignOut={handleSignOut}/>;
}

function App(){
 return <WouterRouter base={basePath}>
  <QueryClientProvider client={queryClient}><AuthGate/></QueryClientProvider>
 </WouterRouter>;
}
export default App;
