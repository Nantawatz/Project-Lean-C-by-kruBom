'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Download, FolderOpen, Plus, ChevronDown, ChevronRight, Terminal, X, Check, ArrowUpRight, PanelLeftClose, Code2, RotateCcw, Copy, Loader2, Braces, Command, Maximize2, Minimize2, ChevronUp, GripHorizontal, Pencil, WandSparkles, Sun, Moon } from 'lucide-react';
import JSZip from 'jszip';
import { startBrowserRun, type ProgramResult } from '../lib/browser-runner';
import { formatC } from '../lib/formatter';
import { compilationKey } from '../lib/input-flow.mjs';
import { MAX_FILES, MAX_SOURCE_BYTES, safeFilename, requestedFilename, uniqueFilename } from '../lib/security.mjs';

type EditorFile = { id:string; name:string; code:string; input:string; submittedInput?:string };
type Result = ProgramResult;
function highlight(code:string) {
 return code.split(/(\/\/[^\n]*|"(?:\\.|[^"\\])*"|#[^\n]*|\b(?:int|void|return|if|for|while|char|float|double|const|else|struct|sizeof)\b|\b\d+\b)/g).map((t,i) => <span key={i} className={t.startsWith('//')?'tok-comment':t.startsWith('"')?'tok-string':t.startsWith('#')?'tok-pre':/^(int|void|return|if|for|while|char|float|double|const|else|struct|sizeof)$/.test(t)?'tok-key':/^\d+$/.test(t)?'tok-number':''}>{t}</span>);
}
function download(blob:Blob,name:string) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
export default function Home() {
 const [theme,setTheme]=useState<'light'|'dark'>('light'), [themeReady,setThemeReady]=useState(false);
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('c-studio-theme');}catch{}setTheme(saved==='light'||saved==='dark'?saved:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setThemeReady(true);},[]);
 useEffect(()=>{if(!themeReady)return;document.documentElement.dataset.theme=theme;try{localStorage.setItem('c-studio-theme',theme);}catch{}},[theme,themeReady]);
 const [files,setFiles]=useState<EditorFile[]>([{id:'initial',name:'main.c',code:'',input:''}]);
 const [activeId,setActiveId]=useState('initial'), [standard,setStandard]=useState('c17');
 const activeIdRef=useRef('initial');
 const filesRef=useRef(files);filesRef.current=files;
 const [nameDialog,setNameDialog]=useState<{mode:'create'|'rename';id?:string}|null>(null), [draftName,setDraftName]=useState(''), [nameError,setNameError]=useState('');
 const nameInput=useRef<HTMLInputElement>(null);
 const [formatting,setFormatting]=useState(false), formattingRef=useRef(false);
 const [formatBackup,setFormatBackup]=useState<{id:string;original:string;formatted:string}|null>(null);
 const current=files.find(f=>f.id===activeId)!;
 const {code,input,name}=current;
 const sourceKey=useMemo(()=>compilationKey({code,filename:name,standard,files}),[code,name,standard,files]);
 const sourceKeyRef=useRef(sourceKey);sourceKeyRef.current=sourceKey;
 const activeRun=useRef<{id:string;key:string}|null>(null);
 const stdinField=useRef<HTMLTextAreaElement>(null);
 const terminalOutput=useRef<HTMLPreElement>(null);
 function setCode(value:string){setFiles(prev=>prev.map(f=>f.id===activeId?{...f,code:value}:f));}
 function setInput(value:string){setFiles(prev=>prev.map(f=>f.id===activeId?{...f,input:value}:f));}
 const [result,setResult]=useState<Result|null>(null), [busy,setBusy]=useState(false), [menu,setMenu]=useState(false), [help,setHelp]=useState(false), [side,setSide]=useState(true), [tab,setTab]=useState('output'), [toast,setToast]=useState(''), [ready,setReady]=useState(false), [cursor,setCursor]=useState({line:1,col:1});
 const [consoleHeight,setConsoleHeight]=useState(140), [consoleCollapsed,setConsoleCollapsed]=useState(false), [focusMode,setFocusMode]=useState(false), [consoleMax,setConsoleMax]=useState(300);
 const browserJob=useRef<ReturnType<typeof startBrowserRun>|null>(null), running=useRef(false);
 const [runtimeStage,setRuntimeStage]=useState('loading');
 const ide=useRef<HTMLElement>(null), drag=useRef<{y:number;height:number}|null>(null);
 const editor=useRef<HTMLTextAreaElement>(null), pre=useRef<HTMLPreElement>(null), lines=useRef<HTMLDivElement>(null), file=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{localStorage.removeItem('c-studio-project');}catch{}setReady(true);},[]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('c-studio-layout')||'null');if(saved){if(Number.isFinite(saved.height))setConsoleHeight(Math.max(70,Math.min(700,saved.height)));setConsoleCollapsed(saved.collapsed===true);}}catch{}},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem('c-studio-layout',JSON.stringify({height:consoleHeight,collapsed:consoleCollapsed}));}catch{}},[consoleHeight,consoleCollapsed,ready]);
 useEffect(()=>{const element=ide.current;if(!element)return;const observer=new ResizeObserver(()=>setConsoleMax(Math.max(70,element.clientHeight-290)));observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{function escape(e:KeyboardEvent){if(e.key==='Escape')setFocusMode(false);}window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 useEffect(()=>{if(!nameDialog)return;const frame=requestAnimationFrame(()=>{const el=nameInput.current;if(el){el.focus();el.setSelectionRange(0,Math.max(0,el.value.lastIndexOf('.')));}});return()=>cancelAnimationFrame(frame);},[nameDialog]);
 useEffect(()=>()=>browserJob.current?.stop(),[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{if(activeRun.current&&activeRun.current.key!==sourceKey){browserJob.current?.stop();setResult(null);setToast('โค้ดเปลี่ยนแล้ว กรุณากด Run เพื่อเริ่มใหม่');}},[sourceKey]);
 useEffect(()=>{if(terminalOutput.current)terminalOutput.current.scrollTop=terminalOutput.current.scrollHeight;},[result?.transcript,tab]);
 useEffect(()=>{if(result?.awaitingInput&&tab==='input')stdinField.current?.focus();},[result?.awaitingInput,tab]);
 function sendLine(value:string){
  const session=activeRun.current;
  if(!session||session.key!==sourceKeyRef.current)return false;
  try{if(!browserJob.current?.submitInput(value))return false;
   setFiles(prev=>prev.map(f=>f.id===session.id?{...f,input:'',submittedInput:(f.submittedInput||'')+value}:f));
   setResult(previous=>previous?{...previous,awaitingInput:false}:previous);return true;
  }catch(error){setToast(error instanceof Error?error.message:'ส่ง Input ไม่สำเร็จ');return false;}
 }
 function endInput(){if(browserJob.current?.endInput())setResult(previous=>previous?{...previous,awaitingInput:false}:previous);}
 async function run(submitInput=false) {
  if(submitInput&&browserJob.current){sendLine(input+'\n');return;}
  if(running.current||formattingRef.current)return;running.current=true;const sourceId=activeId,key=sourceKey;
  activeRun.current={id:sourceId,key};let firstLine=submitInput?input+'\n':null;
  setFiles(prev=>prev.map(f=>f.id===sourceId?{...f,submittedInput:''}:f));
  setRuntimeStage('loading');setBusy(true);
  setTab('output');setConsoleCollapsed(false);setResult(null);setMenu(false);
  try{
    const activeJob=startBrowserRun({code,input:'',filename:name,standard,files:files.map(f=>({name:f.name,code:f.code})),binary:false,mode:'interactive'},setRuntimeStage,partial=>{
      if(activeIdRef.current!==sourceId||sourceKeyRef.current!==key){activeJob.stop();return;}
      setResult(partial);setTab('input');setConsoleHeight(height=>Math.max(height,240));setConsoleCollapsed(false);
      if(firstLine!==null){const value=firstLine;firstLine=null;if(sendLine(value))return;}
      requestAnimationFrame(()=>stdinField.current?.focus());
    });
    browserJob.current=activeJob;
    const data=await activeJob.promise;
    if(activeIdRef.current===sourceId&&sourceKeyRef.current===key){
      setResult(data);setTab(data.stage==='compile'||data.error||data.reason?'problems':'output');
    }
  }catch(e){setResult({error:e instanceof Error?e.message:'ไม่สามารถเริ่ม compiler ได้'});setTab('problems');}
  finally{browserJob.current=null;activeRun.current=null;running.current=false;setBusy(false);}
 }
 function stopRun(){browserJob.current?.stop();}
 async function exportZip(){const zip=new JSZip();for(const f of files){zip.file(f.name,f.code);zip.file(f.name+'.input.txt',f.submittedInput||f.input);}zip.file('README.md',`# C Studio files

Each tab is a standalone C program. Compile and run one file at a time.
Example: gcc "${name}" -std=${standard} -Wall -o program
Input for each file is saved as <filename>.input.txt.
`);download(await zip.generateAsync({type:'blob'}),'c-studio-project.zip');setMenu(false);setToast('Export ทุกไฟล์เรียบร้อย');}
 function selectFile(id:string){if(id===activeIdRef.current){editor.current?.focus();return;}browserJob.current?.stop();setActiveId(id);activeIdRef.current=id;setResult(null);setCursor({line:1,col:1});requestAnimationFrame(()=>{if(editor.current){editor.current.scrollTop=0;editor.current.scrollLeft=0;editor.current.setSelectionRange(0,0);editor.current.focus();}if(pre.current){pre.current.scrollTop=0;pre.current.scrollLeft=0;}if(lines.current)lines.current.scrollTop=0;});}
 function addFile(source='',filename?:string){if(files.length>=MAX_FILES){setToast('เปิดได้สูงสุด 30 ไฟล์');return;}const nextName=uniqueFilename(filename||'main.c',files.map(f=>f.name));const next={id:crypto.randomUUID(),name:nextName,code:source,input:''};setFiles(prev=>[...prev,next]);selectFile(next.id);}
 function openNameDialog(id?:string){
  if(id){const target=files.find(f=>f.id===id);if(!target)return;setDraftName(target.name);setNameDialog({mode:'rename',id});}
  else{if(files.length>=MAX_FILES){setToast('เปิดได้สูงสุด 30 ไฟล์');return;}const next=uniqueFilename('main.c',files.map(f=>f.name));setDraftName(next);setNameDialog({mode:'create'});}
  setNameError('');setMenu(false);
 }
 function newFile(){openNameDialog();}
 function saveFileName(){
  if(!nameDialog)return;
  try{const others=files.filter(f=>f.id!==nameDialog.id).map(f=>f.name);const next=requestedFilename(draftName,others);
   if(nameDialog.mode==='create')addFile('',next);
   else{setFiles(prev=>prev.map(f=>f.id===nameDialog.id?{...f,name:next}:f));if(activeId===nameDialog.id)setResult(null);}
   setNameDialog(null);setNameError('');requestAnimationFrame(()=>editor.current?.focus());
  }catch(error){setNameError(error instanceof Error?error.message:'ชื่อไฟล์ไม่ถูกต้อง');}
 }
 async function formatFile(){
  if(formattingRef.current||running.current)return;
  if(!code.trim()){setToast('เขียนโค้ดก่อนกด Format');return;}
  const snapshot={id:activeId,code,name};formattingRef.current=true;setFormatting(true);
  try{const formatted=await formatC(snapshot.code,snapshot.name);const target=filesRef.current.find(f=>f.id===snapshot.id);
   if(!target||target.code!==snapshot.code){setToast('โค้ดเปลี่ยนระหว่างจัดรูปแบบ กรุณากด Format อีกครั้ง');return;}
   if(formatted===snapshot.code){setToast('โค้ดจัดรูปแบบเรียบร้อยอยู่แล้ว');return;}
   setFiles(prev=>prev.map(f=>f.id===snapshot.id?{...f,code:formatted}:f));setFormatBackup({id:snapshot.id,original:snapshot.code,formatted});
   setToast('จัดรูปแบบ '+target.name+' แล้ว');if(activeIdRef.current===snapshot.id){setCursor({line:1,col:1});requestAnimationFrame(()=>{const el=editor.current;if(el){el.focus();el.setSelectionRange(0,0);el.scrollTop=0;el.scrollLeft=0;}if(pre.current){pre.current.scrollTop=0;pre.current.scrollLeft=0;}if(lines.current)lines.current.scrollTop=0;});}
  }catch(error){setToast(error instanceof Error?error.message:'จัดรูปแบบไม่สำเร็จ โค้ดเดิมยังอยู่');}
  finally{formattingRef.current=false;setFormatting(false);}
 }
 function undoFormat(){if(formatBackup&&formatBackup.id===activeId&&code===formatBackup.formatted){setCode(formatBackup.original);setFormatBackup(null);setToast('ย้อนกลับก่อนจัดรูปแบบแล้ว');}}

 function closeFile(id:string){const remaining=files.filter(f=>f.id!==id);if(!remaining.length){const blank={id:crypto.randomUUID(),name:'main.c',code:'',input:''};setFiles([blank]);selectFile(blank.id);}else{setFiles(remaining);if(activeId===id){const index=files.findIndex(f=>f.id===id);selectFile(remaining[Math.min(index,remaining.length-1)].id);}}}
 function updateCursor(){const el=editor.current;if(!el)return;const before=code.slice(0,el.selectionStart);setCursor({line:before.split('\n').length,col:before.length-before.lastIndexOf('\n')});}
 const problems=[result?.error,result?.reason,result?.stderr,result?.warnings].filter(Boolean).join('\n');
 return <div className={`app-shell ${focusMode?'focus-mode':''}`}>
  <header className="topbar"><a className="brand" href="/" aria-label="C Studio home"><span className="brand-mark"><Braces size={24}/></span>C Studio<span className="brand-dot">.</span></a><span className="workspace-tag">PERSONAL WORKSPACE</span><button className="theme-toggle" aria-label="Dark mode" aria-pressed={theme==='dark'} disabled={!themeReady} title={theme==='dark'?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Moon size={16}/>:<Sun size={16}/>}<span>{theme==='dark'?'Dark':'Light'}</span></button></header>
  <div className="workspace">
   {side&&<aside className="sidebar"><div className="side-label">WORKSPACE<button title="Hide sidebar" onClick={()=>setSide(false)}><PanelLeftClose size={15}/></button></div><div className="project-title"><ChevronDown size={14}/><FolderOpen size={17}/><strong>My first program</strong><span className="tiny-dot"/></div><div className="file-list">{files.map(f=><button key={f.id} className={f.id===activeId?"file-selected":"file-item"} onClick={()=>selectFile(f.id)}><span className="c-icon">C</span><span>{f.name}</span>{f.id===activeId&&<span className="file-active-dot"/>}</button>)}</div><button className="add-file" onClick={newFile}><Plus size={15}/> New file</button><div className="side-bottom"><div className="tip-icon"><Code2 size={20}/></div><strong>A space to experiment.</strong><p>เขียน ลองรัน และสร้างสิ่งใหม่<br/>ทีละบรรทัด ในแบบของคุณ</p><button onClick={()=>setHelp(true)}>Get to know C Studio <ArrowUpRight size={13}/></button></div><div className="side-footer"><span className="version-dot"/> C Studio <span>v1.0</span></div></aside>}
   <main className="main"><div className="page-heading"><div><div className="eyebrow">LET’S BUILD SOMETHING</div><h1>พื้นที่สำหรับเขียนและรันภาษา <span>C</span></h1><p>พื้นที่เล็ก ๆ สำหรับไอเดียใหญ่ ๆ — เขียน รัน และ Export ภาษา C</p></div><span className="language-badge"><span className="c-icon">C</span>C language</span></div>
    <section className="ide" ref={ide}><div className="editor-toolbar"><div className="breadcrumb">{!side&&<button title="Show sidebar" onClick={()=>setSide(true)}><FolderOpen size={16}/></button>}<FolderOpen size={15}/><span>my-program</span><ChevronRight size={13}/><button className="rename-file-btn" title="เปลี่ยนชื่อไฟล์ (F2)" aria-label="Rename file" onClick={()=>openNameDialog(activeId)}><strong>{name}</strong><Pencil size={12}/></button></div><div className="toolbar-actions"><button className="focus-btn" title={focusMode?'ออกจากโหมดขยาย (Esc)':'ขยายพื้นที่เขียนโค้ด'} aria-label={focusMode?'Exit focus mode':'Expand editor'} aria-pressed={focusMode} onClick={()=>setFocusMode(!focusMode)}>{focusMode?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button className="format-btn" title="จัดรูปแบบโค้ด C (Shift+Alt+F)" aria-label="Format code" disabled={formatting||busy} onClick={formatFile}>{formatting?<Loader2 size={15} className="spin"/>:<WandSparkles size={15}/>}<span>{formatting?'Formatting…':'Format'}</span></button>{formatBackup?.id===activeId&&code===formatBackup.formatted&&<button className="undo-format-btn" title="ย้อนกลับก่อนจัดรูปแบบ" aria-label="Undo format" disabled={formatting||busy} onClick={undoFormat}><RotateCcw size={14}/></button>}<button className="open-btn" title="Open file" aria-label="Open file" onClick={()=>file.current?.click()}><FolderOpen size={15}/><span>Open</span></button><div className="export-wrap"><button className="export-btn" onClick={()=>setMenu(!menu)}><Download size={15}/> Export <ChevronDown size={13}/></button>{menu&&<div className="export-menu"><button onClick={()=>{download(new Blob([code],{type:'text/x-c'}),name);setMenu(false);}}>Source code <span>.c</span></button><button onClick={exportZip}>Project <span>.zip</span></button></div>}</div><button className={`run-btn ${busy?'stop':''}`} onClick={()=>busy?stopRun():run()} disabled={formatting}>{busy?<Square size={14}/>:<Play size={14} fill="currentColor"/>}{busy?'Stop':'Run code'}{!busy&&<kbd>Ctrl ↵</kbd>}</button></div></div>
     <div className="file-tabbar"><div className="file-tabs" role="tablist" aria-label="Open files">{files.map(f=><div className={`file-tab ${f.id===activeId?'active':''}`} key={f.id}><button role="tab" aria-selected={f.id===activeId} onClick={()=>selectFile(f.id)} onDoubleClick={()=>openNameDialog(f.id)} onKeyDown={e=>{if(e.key==='F2'){e.preventDefault();openNameDialog(f.id);}}} title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"><span className="c-icon">C</span>{f.name}</button><button className="close-file" aria-label={`Close ${f.name}`} title={`Close ${f.name}`} onClick={()=>closeFile(f.id)}><X size={12}/></button></div>)}</div><button title="New file" onClick={newFile}><Plus size={16}/></button><span className="autosaved">Temporary files</span></div>
     <div className="code-area"><div ref={lines} className="line-numbers" aria-hidden="true">{code.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><div className="code-content"><pre ref={pre} aria-hidden="true">{highlight(code)}{'\n'}</pre><textarea ref={editor} aria-label="C source code editor" value={code} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={e=>{if(new TextEncoder().encode(e.target.value).length<=MAX_SOURCE_BYTES)setCode(e.target.value);else setToast('โค้ดแต่ละไฟล์ต้องไม่เกิน 100 KB');}} onClick={updateCursor} onKeyUp={updateCursor} onScroll={e=>{if(pre.current){pre.current.scrollTop=e.currentTarget.scrollTop;pre.current.scrollLeft=e.currentTarget.scrollLeft;}if(lines.current)lines.current.scrollTop=e.currentTarget.scrollTop;}} onKeyDown={e=>{if(e.shiftKey&&e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();formatFile();return;}if(e.key==='F2'){e.preventDefault();openNameDialog(activeId);return;}if(e.key==='Tab'){e.preventDefault();const el=e.currentTarget,s=el.selectionStart,end=el.selectionEnd;setCode(code.slice(0,s)+'    '+code.slice(end));requestAnimationFrame(()=>{el.selectionStart=el.selectionEnd=s+4;});}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();download(new Blob([code],{type:'text/x-c'}),name);}}}/></div><span className="editor-watermark">C Studio</span></div>
     <div className="editor-status"><span><i/> {result?.awaitingInput?'Waiting for input…':busy?(runtimeStage==='run'?'Running in browser…':runtimeStage==='compile'?'Compiling C…':'Preparing browser compiler…'):'Ready to code'}</span><div><span>Ln {cursor.line}, Col {cursor.col}</span><span>UTF-8</span><label aria-label="C standard"><select value={standard} onChange={e=>setStandard(e.target.value)}><option value="c99">C99</option><option value="c11">C11</option><option value="c17">C17</option></select></label></div></div>
     <div className="console-resizer" role="separator" aria-label="ปรับความสูง Console" aria-orientation="horizontal" aria-valuemin={70} aria-valuemax={consoleMax} aria-valuenow={Math.min(consoleHeight,consoleMax)} tabIndex={0} title="ลากเพื่อปรับพื้นที่ Editor / Console · ดับเบิลคลิกเพื่อคืนขนาดเดิม" onDoubleClick={()=>{setConsoleHeight(140);setConsoleCollapsed(false);}} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setConsoleCollapsed(false);setConsoleHeight(h=>Math.max(70,Math.min(consoleMax,h+(e.key==='ArrowUp'?20:-20))));}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={y:e.clientY,height:consoleCollapsed?0:Math.min(consoleHeight,consoleMax)};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;setConsoleCollapsed(false);setConsoleHeight(Math.max(70,Math.min(consoleMax,drag.current.height+drag.current.y-e.clientY)));}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}}><GripHorizontal size={17}/></div>
     <div className="console"><div className="console-bar"><div className="console-tabs"><button className={tab==='output'?'active':''} onClick={()=>{setTab('output');setConsoleCollapsed(false);}}><Terminal size={15}/>Output</button><button className={tab==='input'?'active':''} onClick={()=>{setTab('input');setConsoleCollapsed(false);}}>Input <span className="tab-counter">{current.submittedInput?current.submittedInput.split('\n').length-1:input?'1':'0'}</span></button><button className={tab==='problems'?'active':''} onClick={()=>{setTab('problems');setConsoleCollapsed(false);}}>Problems <span className={`tab-counter ${problems?'error-count':''}`}>{problems?'!':'0'}</span></button></div><div className="console-actions"><button title={consoleCollapsed?'แสดง Console':'พับ Console เพื่อเพิ่มพื้นที่เขียนโค้ด'} aria-label={consoleCollapsed?'Show console':'Collapse console'} aria-expanded={!consoleCollapsed} onClick={()=>setConsoleCollapsed(!consoleCollapsed)}>{consoleCollapsed?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button><button title="Copy output" onClick={async()=>{try{await navigator.clipboard.writeText(tab==='problems'?problems:result?.transcript||result?.stdout||'');setToast('คัดลอกแล้ว');}catch{setToast('ไม่สามารถคัดลอกได้');}}}><Copy size={14}/></button><button disabled={busy} title="Clear output" onClick={()=>setResult(null)}><RotateCcw size={14}/></button></div></div>
      <div className="console-body" hidden={consoleCollapsed} style={{height:consoleCollapsed?0:Math.min(consoleHeight,consoleMax)}}>{tab==='input'?<div className={`input-panel ${busy?'interactive-panel':''}`}>
       {(result?.transcript||result?.stdout)&&<pre ref={terminalOutput} className="interactive-transcript" aria-label="Program console">{result.transcript||result.stdout}</pre>}
       {result?.awaitingInput&&<div className="input-ready" role="status"><Terminal size={14}/><span>โปรแกรมกำลังรอค่า Input</span></div>}
       <label htmlFor="stdin">Standard input <span>พิมพ์ค่าแล้วกด Enter ทีละรอบ · Shift+Enter ขึ้นบรรทัดใหม่</span></label>
       <textarea ref={stdinField} id="stdin" enterKeyHint="send" aria-keyshortcuts="Enter" disabled={busy&&!result?.awaitingInput} value={input} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.altKey&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229){e.preventDefault();if(!e.repeat)run(true);}}} onChange={e=>{if(new TextEncoder().encode(e.target.value).length<=MAX_SOURCE_BYTES)setInput(e.target.value);else setToast('Input ต้องไม่เกิน 100 KB');}}/>
       {result?.awaitingInput&&<button className="end-input-btn" onClick={endInput}>จบการป้อนค่า (EOF)</button>}
      </div>:tab==='problems'?<pre className={problems?'problem-output':'no-problems'}>{problems||'✓ No problems to show. Your next idea is waiting.'}</pre>:busy&&!result?.awaitingInput?<div className="empty-console"><Loader2 className="spin" size={23}/><strong>{runtimeStage==='loading'?'Loading browser compiler…':runtimeStage==='compile'?'Compiling your C program…':'Running your program…'}</strong><p>{runtimeStage==='loading'?'เตรียม compiler ครั้งแรก · รอบถัดไปใช้ชุดเดิม':runtimeStage==='compile'?'กำลัง Compile โค้ดด้วย compiler ที่เตรียมไว้':'กด Stop เพื่อหยุด · รันได้สูงสุด 5 วินาที'}</p></div>:result?.awaitingInput?<div className="empty-console input-waiting"><span className="terminal-icon"><Check size={20}/></span><strong>โปรแกรมกำลังรอค่า Input</strong><pre className="waiting-output">{result.transcript||result.stdout}</pre><p>ไปที่แท็บ Input พิมพ์ค่าแล้วกด Enter เพื่อทำงานต่อ</p><button onClick={()=>{setTab('input');setConsoleCollapsed(false);requestAnimationFrame(()=>stdinField.current?.focus());}}>ใส่ค่า Input <ChevronRight size={13}/></button></div>:result?<div className="run-output"><div className="run-meta"><span className={result.code===0?'success-text':'failure-text'}>{result.error?'Run failed':result.reason?result.reason:result.stage==='compile'?'Check the Problems tab':`Process exited with code ${result.code}`}</span><span>{result.duration?`${(result.duration/1000).toFixed(2)}s`:''}</span></div><pre>{result.transcript||result.stdout||result.error||(result.stage==='compile'?'Compilation failed. See Problems.':'(No output)')}</pre></div>:<div className="empty-console"><span className="terminal-icon"><Terminal size={21}/></span><strong>A little code. Endless possibilities.</strong><p>กด <span>Run code</span> เพื่อดูผลลัพธ์ของโปรแกรมที่นี่</p><kbd>Ctrl + Enter</kbd></div>}</div>
     </div></section><footer className="main-footer"><span><span className="mint-dot"/> ไฟล์ชั่วคราว · หายเมื่อรีเฟรชหรือปิดหน้าเว็บ</span><span className="developer-credit">พัฒนาโดย ครูบอม สาขาวิชาเทคโนโลยีสารสนเทศ วิทยาลัยอาชีวศึกษานครศรีธรรมราช</span></footer>
   </main></div>
  <input hidden type="file" accept=".c" ref={file} onChange={async e=>{const element=e.currentTarget,f=element.files?.[0];if(!f)return;try{if(!/\.c$/i.test(f.name)){setToast('รองรับเฉพาะไฟล์ .c เท่านั้น');return;}if(f.size>MAX_SOURCE_BYTES){setToast('ขนาดไฟล์ต้องไม่เกิน 100 KB');return;}addFile(await f.text(),safeFilename(f.name));}catch{setToast('เปิดไฟล์ไม่สำเร็จ');}finally{element.value='';}}}/>
  {nameDialog&&<div className="modal-backdrop" onClick={()=>setNameDialog(null)}><form className="filename-dialog" role="dialog" aria-modal="true" aria-labelledby="filename-title" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();saveFileName();}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setNameDialog(null);editor.current?.focus();}}}><div className="filename-heading"><span className="guide-icon"><Pencil size={20}/></span><button type="button" className="dialog-close" aria-label="Close filename dialog" onClick={()=>setNameDialog(null)}><X size={18}/></button></div><h2 id="filename-title">{nameDialog.mode==='create'?'New file':'Rename file'}</h2><p>{nameDialog.mode==='create'?'ตั้งชื่อไฟล์ใหม่ แล้วเริ่มเขียนได้เลย':'เปลี่ยนชื่อไฟล์ โดยโค้ดและ Input ยังอยู่ครบ'}</p><label htmlFor="filename-input">ชื่อไฟล์</label><input ref={nameInput} id="filename-input" value={draftName} maxLength={102} autoComplete="off" spellCheck={false} aria-invalid={Boolean(nameError)} aria-describedby={nameError?'filename-error':'filename-hint'} onChange={e=>{setDraftName(e.target.value);setNameError('');}}/><span id="filename-hint" className="filename-hint">เช่น hello.c หรือ program.c · หากไม่ใส่นามสกุล จะเติม .c ให้</span>{nameError&&<p id="filename-error" className="filename-error" role="alert">{nameError}</p>}<div className="dialog-actions"><button type="button" className="cancel-btn" onClick={()=>setNameDialog(null)}>ยกเลิก</button><button type="submit" className="run-btn">{nameDialog.mode==='create'?'Create file':'Save name'}</button></div></form></div>}
  {toast&&<div role="status" className="toast"><Check size={17}/>{toast}</div>}
  {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close guide" onClick={()=>setHelp(false)}><X size={20}/></button><span className="guide-icon"><Command size={24}/></span><h2 id="guide-title">Make yourself at home.</h2><p>เริ่มต้นเขียนภาษา C ได้ใน 3 ขั้นตอน</p><ol><li><strong>Write your idea</strong><span>เขียนโค้ดใน Editor หรือเปิดไฟล์ .c จากเครื่อง</span></li><li><strong>Run & explore</strong><span>กด Run เพื่อเริ่มโปรแกรม เมื่อโปรแกรมรอ Input จะเห็นคำถามใน Console พิมพ์ค่าแล้วกด Enter ทีละครั้งจนโปรแกรมจบ ใช้ Shift+Enter ขึ้นบรรทัดใหม่ หรือจบการป้อนค่าด้วยปุ่ม EOF</span></li><li><strong>Take it with you</strong><span>Export เป็นไฟล์ .c หรือโปรเจกต์ .zip</span></li></ol><div className="local-note">Compile และรันใน WebAssembly ภายในเบราว์เซอร์ ไม่ส่งโค้ดไปยังเซิร์ฟเวอร์ โปรแกรมเข้าถึงได้เฉพาะไฟล์เสมือน ไม่มี shell หรือเครือข่าย รองรับ C มาตรฐานสำหรับงานเรียนรู้ แต่ไม่รองรับ Windows API หรือไลบรารีภายนอก ไฟล์จะหายเมื่อรีเฟรชหรือปิดหน้าเว็บ</div><button className="run-btn" onClick={()=>setHelp(false)}>Let’s write some C <ArrowUpRight size={15}/></button></section></div>}
 </div>;
}
