import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Menu, Search, Settings, HelpCircle, Plus, Inbox, Star, Clock3, Send,
  FileText, MoreHorizontal, Trash2, Archive, Mail, ChevronLeft, ChevronRight,
  Paperclip, Image, Link2, Smile, X, RefreshCw, LogIn, LogOut, LoaderCircle
} from "lucide-react";
import "./styles.css";

// Replace this placeholder with your Google OAuth Web Client ID.
const GOOGLE_CLIENT_ID = "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const demoMessages = [
  { id:"demo-1",from:"Google",email:"noreply@google.com",subject:"Security alert",body:"A new sign-in was detected on your Google Account.",time:"8:42 AM",read:false,starred:true,label:"Inbox",demo:true },
  { id:"demo-2",from:"GitHub",email:"noreply@github.com",subject:"Your repository was updated",body:"There are new changes in one of your repositories.",time:"7:35 AM",read:false,starred:false,label:"Inbox",demo:true },
  { id:"demo-3",from:"LinkedIn",email:"messages@linkedin.com",subject:"You have new connection suggestions",body:"Check out people you may know.",time:"Yesterday",read:true,starred:false,label:"Inbox",demo:true },
  { id:"demo-4",from:"Oracle",email:"learning@oracle.com",subject:"New learning resources",body:"Explore new cloud learning paths and certifications.",time:"Yesterday",read:true,starred:true,label:"Inbox",demo:true },
  { id:"demo-5",from:"Adroit Technologies",email:"training@example.com",subject:"Training schedule",body:"Please review the updated training schedule.",time:"Sep 30",read:true,starred:false,label:"Inbox",demo:true }
];

function loadGoogleScript() {
  return new Promise((resolve,reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const old = document.querySelector('script[data-gis="1"]');
    if (old) { old.addEventListener("load",resolve,{once:true}); old.addEventListener("error",reject,{once:true}); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.dataset.gis = "1";
    s.onload = resolve; s.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(s);
  });
}

function header(headers,name) {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeData(value) {
  const v = (value || "").replace(/-/g,"+").replace(/_/g,"/");
  const padded = v + "=".repeat((4 - v.length % 4) % 4);
  try {
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin,c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ""; }
}

function bodyFromPayload(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeData(payload.body.data);
  for (const p of payload.parts || []) {
    if (p.mimeType === "text/plain" && p.body?.data) return decodeData(p.body.data);
  }
  for (const p of payload.parts || []) {
    const text = bodyFromPayload(p);
    if (text) return text;
  }
  return payload.body?.data ? decodeData(payload.body.data) : "";
}

function mapMessage(item, full) {
  const p = full?.payload || item?.payload || {};
  const hs = p.headers || [];
  const rawFrom = header(hs,"From");
  const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  const from = match ? match[1].replace(/^"|"$/g,"") : (rawFrom || "Unknown sender");
  const email = match ? match[2] : rawFrom;
  const subject = header(hs,"Subject") || "(no subject)";
  const date = header(hs,"Date");
  const d = date ? new Date(date) : null;
  const time = d && !Number.isNaN(d.getTime()) ? d.toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "";
  const labels = full?.labelIds || item?.labelIds || [];
  return {
    id:item.id,threadId:item.threadId,from,email,subject,
    body:full ? (bodyFromPayload(p) || item.snippet || "") : (item.snippet || ""),
    snippet:item.snippet || "",time,
    read:!labels.includes("UNREAD"),starred:labels.includes("STARRED"),
    label:labels.includes("SENT")?"Sent":labels.includes("TRASH")?"Trash":labels.includes("DRAFT")?"Drafts":"Inbox",
    labelIds:labels,demo:false
  };
}

async function gmail(path, credentialValue, options={}) {
  const res = await fetch(GMAIL_API + path, {
    ...options,
    headers:{Authorization:"Bearer " + credentialValue,"Content-Type":"application/json",...(options.headers||{})}
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Gmail request failed (" + res.status + ")");
  return data;
}

function encodeMail(to,subject,body) {
  const mime = [
    "To: " + to,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "Subject: " + (subject || "(no subject)"),
    "",
    body || ""
  ].join("\r\n");
  const bytes = new TextEncoder().encode(mime);
  let binary = "";
  for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function App() {
  const [messages,setMessages] = useState(() => {
    const saved=localStorage.getItem("mailbox-messages");
    return saved ? JSON.parse(saved) : demoMessages;
  });
  const [folder,setFolder]=useState("Inbox");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(null);
  const [compose,setCompose]=useState(false);
  const [sidebar,setSidebar]=useState(true);
  const [dark,setDark]=useState(false);
  const [credential,setCredential]=useState("");
  const [account,setAccount]=useState("");
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState("");
  const client=useRef(null);

  const connected=Boolean(credential);

  const save=next=>{setMessages(next);localStorage.setItem("mailbox-messages",JSON.stringify(next));};

  useEffect(()=>{if(credential) refresh(credential);},[credential]);

  async function refresh(value=credential) {
    if(!value) return;
    setLoading(true);
    try {
      const list=await gmail("/messages?labelIds=INBOX&maxResults=30",value);
      const rows=await Promise.all((list.messages||[]).map(x=>gmail("/messages/"+x.id+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",value)));
      save(rows.map(x=>mapMessage(x,x)));
      setStatus("Gmail inbox synchronized.");
    } catch(e) { setStatus(e.message); }
    finally { setLoading(false); }
  }

  async function connect() {
    if(GOOGLE_CLIENT_ID.startsWith("PASTE_")) {
      setStatus("First add your Google OAuth Client ID in src/main.jsx.");
      return;
    }
    try {
      setLoading(true); setStatus("Opening Google sign-in...");
      await loadGoogleScript();
      client.current=window.google.accounts.oauth2.initTokenClient({
        client_id:GOOGLE_CLIENT_ID,
        scope:GOOGLE_SCOPE,
        callback:async response=>{
          if(response.error){setStatus(response.error_description||"Google authorization failed.");setLoading(false);return;}
          setCredential(response.access_token);
          try {
            const profile=await gmail("/profile",response.access_token);
            setAccount(profile.emailAddress||"");
          } catch {}
          setStatus("Gmail connected.");
          setLoading(false);
        }
      });
      client.current.requestAccessToken({prompt:"consent"});
    } catch(e) { setStatus(e.message);setLoading(false); }
  }

  function disconnect() {
    if(credential && window.google?.accounts?.oauth2) {
      try { window.google.accounts.oauth2.revoke(credential,()=>{}); } catch {}
    }
    setCredential("");setAccount("");setMessages(demoMessages);setSelected(null);setStatus("Gmail disconnected.");
  }

  async function toggleStar(id) {
    const m=messages.find(x=>x.id===id); if(!m) return;
    if(connected && !m.demo) {
      try {
        await gmail("/messages/"+id+"/modify",credential,{method:"POST",body:JSON.stringify({
          addLabelIds:m.starred?[]:["STARRED"],removeLabelIds:m.starred?["STARRED"]:[]
        })});
        await refresh();
      } catch(e){setStatus(e.message);}
    } else save(messages.map(x=>x.id===id?{...x,starred:!x.starred}:x));
  }

  async function remove(id) {
    const m=messages.find(x=>x.id===id);
    if(connected && m && !m.demo) {
      try { await gmail("/messages/"+id+"/trash",credential,{method:"POST"});setSelected(null);await refresh(); }
      catch(e){setStatus(e.message);}
    } else { save(messages.map(x=>x.id===id?{...x,label:"Trash"}:x));setSelected(null); }
  }

  async function openMessage(m) {
    if(connected && !m.demo) {
      try {
        const full=await gmail("/messages/"+m.id+"?format=full",credential);
        const updated=mapMessage(m,full);
        setMessages(prev=>prev.map(x=>x.id===m.id?updated:x));
        setSelected(m.id);
        if(m.labelIds?.includes("UNREAD")) await gmail("/messages/"+m.id+"/modify",credential,{method:"POST",body:JSON.stringify({removeLabelIds:["UNREAD"]})});
      } catch(e){setStatus(e.message);}
    } else { save(messages.map(x=>x.id===m.id?{...x,read:true}:x));setSelected(m.id); }
  }

  async function sendMessage(to,subject,body) {
    if(!to.trim()){setStatus("Enter a recipient email address.");return;}
    if(!connected){
      save([{id:Date.now(),from:"Me",email:"me@example.com",subject:subject||"(no subject)",body:"To: "+to+"\n\n"+body,time:"Just now",read:true,starred:false,label:"Sent",demo:true},...messages]);
      setCompose(false);setStatus("Demo message saved locally. Connect Gmail to send a real email.");return;
    }
    try {
      setLoading(true);setStatus("Sending through Gmail...");
      await gmail("/messages/send",credential,{method:"POST",body:JSON.stringify({raw:encodeMail(to,subject,body)})});
      setCompose(false);setFolder("Sent");setStatus("Email sent to "+to);await refresh();
    } catch(e){setStatus(e.message);}
    finally{setLoading(false);}
  }

  const visible=useMemo(()=>{
    let list=messages;
    if(folder==="Starred")list=list.filter(m=>m.starred);
    if(folder==="Sent")list=list.filter(m=>m.label==="Sent");
    if(folder==="Trash")list=list.filter(m=>m.label==="Trash");
    if(folder==="Drafts")list=list.filter(m=>m.label==="Drafts");
    if(folder==="Inbox")list=list.filter(m=>m.label==="Inbox");
    if(query.trim()){const q=query.toLowerCase();list=list.filter(m=>(m.from+" "+m.email+" "+m.subject+" "+m.body).toLowerCase().includes(q));}
    return list;
  },[messages,folder,query]);

  const selectedMessage=messages.find(m=>m.id===selected);

  return <div className={dark?"app dark":"app"}>
    <header className="topbar">
      <div className="brand"><button className="icon-btn" onClick={()=>setSidebar(!sidebar)}><Menu size={22}/></button><div className="logo"><Mail size={24}/></div><span>MailBox</span></div>
      <div className="search"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search mail"/>{query&&<button className="clear" onClick={()=>setQuery("")}><X size={17}/></button>}</div>
      <div className="top-actions">
        <button className="icon-btn" title="Help"><HelpCircle size={20}/></button>
        <button className="icon-btn" title="Settings"><Settings size={20}/></button>
        <button className="icon-btn" onClick={()=>setDark(!dark)} title="Theme">◐</button>
        {connected?<button className="account-pill" onClick={disconnect}><span className="avatar">T</span><span>{account||"Gmail connected"}</span><LogOut size={16}/></button>:<button className="google-login" onClick={connect} disabled={loading}>{loading?<LoaderCircle size={16} className="spin"/>:<LogIn size={16}/>} Connect Gmail</button>}
      </div>
    </header>
    <div className="layout">
      {sidebar&&<aside className="sidebar">
        <button className="compose-btn" onClick={()=>setCompose(true)}><Plus size={21}/> Compose</button>
        <NavItem icon={<Inbox/>} label="Inbox" active={folder==="Inbox"} count={messages.filter(m=>m.label==="Inbox"&&!m.read).length} onClick={()=>setFolder("Inbox")}/>
        <NavItem icon={<Star/>} label="Starred" active={folder==="Starred"} onClick={()=>setFolder("Starred")}/>
        <NavItem icon={<Clock3/>} label="Snoozed" onClick={()=>setFolder("Snoozed")}/>
        <NavItem icon={<Send/>} label="Sent" active={folder==="Sent"} onClick={()=>setFolder("Sent")}/>
        <NavItem icon={<FileText/>} label="Drafts" active={folder==="Drafts"} onClick={()=>setFolder("Drafts")}/>
        <NavItem icon={<Trash2/>} label="Trash" active={folder==="Trash"} onClick={()=>setFolder("Trash")}/>
        <div className="side-section">Labels</div><div className="label-row"><span className="dot blue"></span>Work</div><div className="label-row"><span className="dot green"></span>Learning</div>
        {status&&<div className="status-box">{status}</div>}
      </aside>}
      <main className="content">
        {selectedMessage?<MessageView message={selectedMessage} onBack={()=>setSelected(null)} onDelete={()=>remove(selectedMessage.id)} onStar={()=>toggleStar(selectedMessage.id)}/>:<>
          <div className="toolbar"><label className="check"><input type="checkbox"/><span></span></label><button className="icon-btn" onClick={()=>refresh()} disabled={!connected||loading}>{loading?<LoaderCircle size={18} className="spin"/>:<RefreshCw size={18}/>}</button><button className="icon-btn"><MoreHorizontal size={19}/></button><div className="spacer"></div><span className="range">{visible.length?"1–"+visible.length:"0"} of {visible.length}</span><button className="icon-btn"><ChevronLeft size={18}/></button><button className="icon-btn"><ChevronRight size={18}/></button></div>
          <div className="message-list">
            {visible.length===0&&<div className="empty"><Mail size={42}/><h3>No messages</h3><p>There are no messages in this folder.</p></div>}
            {visible.map(m=><div className={m.read?"message":"message unread"} key={m.id} onClick={()=>openMessage(m)}>
              <label className="check" onClick={e=>e.stopPropagation()}><input type="checkbox"/><span></span></label>
              <button className={m.starred?"star starred":"star"} onClick={e=>{e.stopPropagation();toggleStar(m.id)}}><Star size={18}/></button>
              <div className="sender">{m.from}</div><div className="subject"><b>{m.subject}</b> <span>— {m.body}</span></div><div className="time">{m.time}</div>
            </div>)}
          </div>
        </>}
      </main>
    </div>
    {compose&&<Compose onClose={()=>setCompose(false)} onSend={sendMessage}/>}
  </div>;
}

function NavItem({icon,label,active,count,onClick}) {
  return <button className={active?"nav-item active":"nav-item"} onClick={onClick}>{icon}<span>{label}</span>{count>0&&<b>{count}</b>}</button>;
}

function MessageView({message,onBack,onDelete,onStar}) {
  return <div className="message-view"><div className="message-toolbar"><button className="icon-btn" onClick={onBack}><ChevronLeft/></button><button className="icon-btn"><Archive/></button><button className="icon-btn" onClick={onDelete}><Trash2/></button><button className={message.starred?"star starred":"star"} onClick={onStar}><Star/></button></div><h1>{message.subject}</h1><div className="message-header"><div className="avatar small">{message.from[0]}</div><div><b>{message.from}</b><div className="muted">&lt;{message.email}&gt;</div></div><div className="spacer"></div><span className="muted">{message.time}</span></div><div className="message-body">{message.body||message.snippet}</div><div className="reply-box">Use Compose to send a new message through Gmail.</div></div>;
}

function Compose({onClose,onSend}) {
  const [to,setTo]=useState("");const [subject,setSubject]=useState("");const [body,setBody]=useState("");
  return <div className="compose-window"><div className="compose-title"><b>New Message</b><button onClick={onClose}><X size={18}/></button></div><input placeholder="Recipients" value={to} onChange={e=>setTo(e.target.value)}/><input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)}/><textarea placeholder="Write your message..." value={body} onChange={e=>setBody(e.target.value)}/><div className="compose-tools"><Paperclip size={18}/><Image size={18}/><Link2 size={18}/><Smile size={18}/></div><div className="compose-footer"><button className="send-btn" onClick={()=>onSend(to,subject,body)}>Send</button><button className="trash-btn" onClick={onClose}><Trash2 size={18}/></button></div></div>;
}

createRoot(document.getElementById("root")).render(<App/>);