"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, CalendarDays, Camera, Check, ChevronRight, Clock3, ImageUp, LoaderCircle, LogIn, LogOut, MapPin, Sparkles, Trash2, UserRound } from "lucide-react";

type User = { displayName: string; email: string } | null;
type Course = { id?: number; name: string; day: number; startMinutes: number; endMinutes: number };
type OCRLine = { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } };
type TesseractResult = { data?: { lines?: OCRLine[]; text?: string } };
declare global { interface Window { Tesseract?: { recognize: (image: File, language: string, options?: { logger?: (message: { status?: string; progress?: number }) => void }) => Promise<TesseractResult> } } }

const days = ["월", "화", "수", "목", "금"];
const jobs = [
  { company: "브릭오븐 베이커리", title: "점심 피크 포장 및 매장 보조", time: "12:30 - 14:30", distance: "도보 8분", pay: "32,000원", tag: "10분 내 마감", color: "blue" },
  { company: "PLAYGROUND POP-UP", title: "팝업스토어 입장 안내 및 굿즈 정리", time: "12:20 - 14:50", distance: "버스 11분", pay: "38,000원", tag: "NEW", color: "pink" },
  { company: "카페 오브젝트", title: "테이크아웃 음료 픽업 및 테이블 정리", time: "13:00 - 15:00", distance: "도보 12분", pay: "30,000원", tag: "초보 가능", color: "lime" },
];

function minutesToTime(value: number) { const h = String(Math.floor(value / 60)).padStart(2, "0"); const m = String(value % 60).padStart(2, "0"); return `${h}:${m}`; }
function timeToMinutes(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m; }
function cleanName(value: string) { return value.replace(/[|_[\]{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40); }

function parseTimetable(lines: OCRLine[], width: number, height: number): Course[] {
  const ignore = /^(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|시간표|everytime|에브리타임|\d{1,2}(:\d{2})?)$/i;
  const candidates = lines.map((line) => {
    const box = line.bbox; const name = cleanName(line.text ?? "");
    if (!box || !name || ignore.test(name)) return null;
    const x = (box.x0 + box.x1) / 2 / width; const y = (box.y0 + box.y1) / 2 / height;
    if (x < .08 || x > .99 || y < .1 || y > .97) return null;
    const day = Math.max(0, Math.min(4, Math.floor((x - .08) / .184)));
    const rawMinutes = 540 + ((y - .14) / .79) * 780;
    const startMinutes = Math.max(480, Math.min(1260, Math.round(rawMinutes / 30) * 30));
    return { name, day, startMinutes, endMinutes: Math.min(1320, startMinutes + 90) };
  }).filter(Boolean) as Course[];
  const merged: Course[] = [];
  for (const item of candidates.sort((a,b) => a.day-b.day || a.startMinutes-b.startMinutes)) {
    const previous = merged[merged.length - 1];
    if (previous && previous.day === item.day && Math.abs(previous.startMinutes - item.startMinutes) <= 30) {
      if (!previous.name.includes(item.name)) previous.name = `${previous.name} ${item.name}`.slice(0, 40);
    } else merged.push(item);
  }
  return merged.slice(0, 30);
}

function loadOCR() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ocr="tesseract"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("load failed")), { once: true }); return; }
    const script = document.createElement("script"); script.dataset.ocr = "tesseract"; script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error("load failed")); document.head.appendChild(script);
  });
}

export default function GonggangApp({ user, signInPath, signOutPath }: { user: User; signInPath: string; signOutPath: string }) {
  const [view, setView] = useState<"jobs"|"schedule"|"applications">("jobs");
  const [courses, setCourses] = useState<Course[]>([]);
  const [detected, setDetected] = useState<Course[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle"|"reading"|"review"|"saved"|"error">("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/schedule").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => setCourses(data.courses ?? [])).catch(() => {});
  }, [user]);

  const gaps = useMemo(() => {
    const today = new Date().getDay(); const day = today >= 1 && today <= 5 ? today - 1 : 0;
    const todayCourses = courses.filter(c => c.day === day).sort((a,b) => a.startMinutes-b.startMinutes);
    if (!todayCourses.length) return "오늘은 수업이 없어요";
    for (let i=0;i<todayCourses.length-1;i++) if (todayCourses[i+1].startMinutes-todayCourses[i].endMinutes>=60) return `${minutesToTime(todayCourses[i].endMinutes)} - ${minutesToTime(todayCourses[i+1].startMinutes)}`;
    return "수업 전후 시간을 확인해보세요";
  }, [courses]);

  async function analyze(file?: File) {
    if (!file || !file.type.startsWith("image/")) { setMessage("PNG 또는 JPG 시간표 이미지를 올려주세요."); setStatus("error"); return; }
    if (file.size > 12 * 1024 * 1024) { setMessage("이미지는 12MB 이하로 올려주세요."); setStatus("error"); return; }
    if (preview) URL.revokeObjectURL(preview); const url = URL.createObjectURL(file); setPreview(url); setStatus("reading"); setProgress(3); setMessage("이미지에서 수업명과 위치를 읽고 있어요.");
    try {
      await loadOCR(); if (!window.Tesseract) throw new Error("OCR unavailable");
      const image = new Image(); image.src = url; await image.decode();
      const result = await window.Tesseract.recognize(file, "kor+eng", { logger: (m) => { if (typeof m.progress === "number") setProgress(Math.round(m.progress * 100)); } });
      const parsed = parseTimetable(result.data?.lines ?? [], image.naturalWidth, image.naturalHeight);
      if (!parsed.length) throw new Error("no courses");
      setDetected(parsed); setStatus("review"); setMessage(`${parsed.length}개 수업을 찾았어요. 저장 전에 시간만 확인해주세요.`);
    } catch {
      setDetected([{ name: "수업명을 입력하세요", day: 0, startMinutes: 600, endMinutes: 690 }]); setStatus("review"); setMessage("자동 인식이 어려워요. 아래에서 수업을 직접 확인해 주세요.");
    }
  }

  function updateCourse(index: number, patch: Partial<Course>) { setDetected((current) => current.map((course, i) => i === index ? { ...course, ...patch } : course)); }
  async function saveSchedule() {
    if (!user) { window.location.href = signInPath; return; }
    setMessage("내 시간표에 저장하고 있어요.");
    try {
      const response = await fetch("/api/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courses: detected }) });
      if (!response.ok) throw new Error(); setCourses(detected); setStatus("saved"); setMessage("내 시간표에 반영됐어요. 이제 공강 맞춤 알바를 추천할게요.");
    } catch { setStatus("error"); setMessage("저장하지 못했어요. 잠시 후 다시 시도해주세요."); }
  }

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView("jobs")}><span>ㄱㅈ</span>공강잡</button>
      <nav>
        <button className={view==="jobs"?"active":""} onClick={() => setView("jobs")}><BriefcaseBusiness/>알바 찾기</button>
        <button className={view==="schedule"?"active":""} onClick={() => setView("schedule")}><CalendarDays/>내 시간표</button>
        <button className={view==="applications"?"active":""} onClick={() => setView("applications")}><Check/>지원 내역</button>
      </nav>
      {user ? <a className="account" href={signOutPath} target="_top"><span>{user.displayName.slice(0,1)}</span><b>{user.displayName.split("@")[0]}</b><LogOut/></a> : <a className="login" href={signInPath} target="_top"><LogIn/>학생 로그인</a>}
    </header>

    {view === "jobs" && <section className="page jobs-page">
      <div className="hero"><div><p className="kicker">TODAY · CAMPUS JOB</p><h1>{user ? `${user.displayName.split("@")[0]}님, ` : "오늘 "}<span>공강을 수입으로</span><br/>바꿔볼까요?</h1></div><button className="campus"><span/>한국체육대학교 · 3km</button></div>
      <div className="gap-panel"><div><small>오늘의 공강</small><strong>{gaps}</strong><p>{courses.length ? "내 시간표를 기준으로 계산했어요" : "시간표를 올리면 자동으로 계산해드려요"}</p></div><button onClick={() => setView("schedule")}><ImageUp/>시간표 사진으로 등록<ChevronRight/></button></div>
      <div className="section-title"><div><p className="kicker">JUST FOR YOUR GAP</p><h2>공강 안에 끝나는 알바</h2></div><span>학교 주변 실시간 공고</span></div>
      <div className="job-grid">{jobs.map((job, index) => <article className={`job-card ${index===0?"featured":""}`} key={job.company}><span className={`tag ${job.color}`}>{job.tag}</span><p className="company">{job.company}</p><h3>{job.title}</h3><div className="job-meta"><span><Clock3/>{job.time}</span><span><MapPin/>{job.distance}</span></div><div className="pay"><div><small>예상 수입</small><strong>{job.pay}</strong></div><button onClick={() => setMessage(user ? "지원서를 사업주에게 보냈어요." : "지원하려면 먼저 학생 로그인이 필요해요.")}>{user ? "바로 지원" : "로그인 후 지원"}</button></div></article>)}</div>
    </section>}

    {view === "schedule" && <section className="page schedule-page">
      <div className="section-title schedule-title"><div><p className="kicker">SMART TIMETABLE</p><h1>시간표 사진 한 장이면 끝.</h1><p>에브리타임 또는 학교 시간표를 캡처해 올리면 수업을 자동으로 읽고 공강을 계산해요.</p></div>{user ? <div className="signed-chip"><UserRound/> {user.email}</div> : <a className="login" href={signInPath} target="_top"><LogIn/>시간표 저장을 위해 로그인</a>}</div>
      <div className="schedule-workspace">
        <div className="upload-column">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => analyze(e.target.files?.[0])}/>
          <button className={`dropzone ${dragging?"dragging":""}`} onClick={() => fileRef.current?.click()} onDragOver={(e) => {e.preventDefault();setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={(e) => {e.preventDefault();setDragging(false);analyze(e.dataTransfer.files[0])}}>
            {preview ? <img src={preview} alt="업로드한 시간표 미리보기"/> : <><span className="upload-icon"><Camera/></span><strong>시간표 캡처 올리기</strong><p>눌러서 선택하거나 여기에 끌어놓으세요</p><small>에브리타임 · 학교 포털 · PNG/JPG</small></>}
            {status==="reading" && <div className="scan-overlay"><LoaderCircle/><strong>{progress}% 분석 중</strong><div><i style={{width:`${progress}%`}}/></div></div>}
          </button>
          <div className="privacy-note"><span>✓</span><p><strong>사진은 서버에 저장하지 않아요.</strong><br/>업로드한 기기 안에서만 시간표를 분석합니다.</p></div>
        </div>
        <div className="review-column">
          <div className="review-head"><div><Sparkles/><span><strong>AI 분석 결과</strong><small>{detected.length ? `${detected.length}개 수업 감지` : "사진을 올리면 여기에 표시돼요"}</small></span></div>{detected.length>0 && <button onClick={() => setDetected([...detected,{name:"새 수업",day:0,startMinutes:600,endMinutes:690}])}>＋ 수업 추가</button>}</div>
          {!detected.length ? <div className="review-empty"><CalendarDays/><p>시간표를 올리면<br/>수업명·요일·시간을 자동으로 정리해요.</p></div> : <div className="course-list">{detected.map((course,index) => <div className="course-row" key={index}><input aria-label="수업명" value={course.name} onChange={(e) => updateCourse(index,{name:e.target.value})}/><select aria-label="요일" value={course.day} onChange={(e) => updateCourse(index,{day:Number(e.target.value)})}>{days.map((day,i)=><option key={day} value={i}>{day}요일</option>)}</select><input aria-label="시작 시간" type="time" value={minutesToTime(course.startMinutes)} onChange={(e)=>updateCourse(index,{startMinutes:timeToMinutes(e.target.value)})}/><span>—</span><input aria-label="종료 시간" type="time" value={minutesToTime(course.endMinutes)} onChange={(e)=>updateCourse(index,{endMinutes:timeToMinutes(e.target.value)})}/><button aria-label="수업 삭제" onClick={()=>setDetected(detected.filter((_,i)=>i!==index))}><Trash2/></button></div>)}</div>}
          {message && <p className={`message ${status}`}>{message}</p>}
          {detected.length>0 && <button className="save-button" onClick={saveSchedule}>{user ? "내 시간표에 반영하기" : "로그인하고 내 시간표에 저장"}<ChevronRight/></button>}
        </div>
      </div>
      {courses.length>0 && <div className="my-schedule"><div className="section-title"><div><p className="kicker">MY WEEK</p><h2>저장된 시간표</h2></div><span>{courses.length}개 수업</span></div><div className="week-grid">{days.map((day,dayIndex)=><div key={day}><b>{day}</b>{courses.filter(c=>c.day===dayIndex).map((course,i)=><article key={i}><strong>{course.name}</strong><span>{minutesToTime(course.startMinutes)} - {minutesToTime(course.endMinutes)}</span></article>)}</div>)}</div></div>}
    </section>}

    {view === "applications" && <section className="page empty-page"><Check/><h1>지원 내역</h1><p>{user ? "아직 지원한 공고가 없어요." : "로그인하면 지원 현황을 확인할 수 있어요."}</p>{!user && <a className="login" href={signInPath} target="_top"><LogIn/>학생 로그인</a>}</section>}

    <nav className="mobile-nav"><button className={view==="jobs"?"active":""} onClick={()=>setView("jobs")}><BriefcaseBusiness/><span>알바</span></button><button className={view==="schedule"?"active":""} onClick={()=>setView("schedule")}><CalendarDays/><span>시간표</span></button><button className={view==="applications"?"active":""} onClick={()=>setView("applications")}><Check/><span>지원내역</span></button></nav>
    {message && view==="jobs" && <button className="toast" onClick={()=>setMessage("")}>{message}</button>}
  </main>;
}
