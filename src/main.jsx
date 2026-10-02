import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Menu, Search, Settings, HelpCircle, Plus, Inbox, Star, Clock3,
  Send, FileText, MoreHorizontal, Trash2, Archive, Mail, ChevronLeft,
  ChevronRight, Paperclip, Image, Link2, Smile, X, RefreshCw
} from "lucide-react";
import "./styles.css";

const initialMessages = [
  { id: 1, from: "Google", email: "noreply@google.com", subject: "Security alert", body: "A new sign-in was detected on your Google Account.", time: "8:42 AM", read: false, starred: true, label: "Inbox" },
  { id: 2, from: "GitHub", email: "noreply@github.com", subject: "Your repository was updated", body: "There are new changes in one of your repositories.", time: "7:35 AM", read: false, starred: false, label: "Inbox" },
  { id: 3, from: "LinkedIn", email: "messages@linkedin.com", subject: "You have new connection suggestions", body: "Check out people you may know.", time: "Yesterday", read: true, starred: false, label: "Inbox" },
  { id: 4, from: "Oracle", email: "learning@oracle.com", subject: "New learning resources", body: "Explore new cloud learning paths and certifications.", time: "Yesterday", read: true, starred: true, label: "Inbox" },
  { id: 5, from: "Adroit Technologies", email: "training@example.com", subject: "Training schedule", body: "Please review the updated training schedule.", time: "Sep 30", read: true, starred: false, label: "Inbox" }
];

function App() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("mailbox-messages");
    return saved ? JSON.parse(saved) : initialMessages;
  });
  const [folder, setFolder] = useState("Inbox");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [dark, setDark] = useState(false);

  const save = (next) => {
    setMessages(next);
    localStorage.setItem("mailbox-messages", JSON.stringify(next));
  };

  const visible = useMemo(() => {
    let list = messages;
    if (folder === "Starred") list = list.filter(m => m.starred);
    if (folder === "Sent") list = list.filter(m => m.label === "Sent");
    if (folder === "Trash") list = list.filter(m => m.label === "Trash");
    if (folder === "Drafts") list = list.filter(m => m.label === "Drafts");
    if (folder === "Inbox") list = list.filter(m => m.label === "Inbox");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(m => `${m.from} ${m.email} ${m.subject} ${m.body}`.toLowerCase().includes(q));
    }
    return list;
  }, [messages, folder, query]);

  const toggleStar = (id) => save(messages.map(m => m.id === id ? { ...m, starred: !m.starred } : m));
  const deleteMessage = (id) => {
    save(messages.map(m => m.id === id ? { ...m, label: "Trash" } : m));
    setSelected(null);
  };
  const openMessage = (message) => {
    save(messages.map(m => m.id === message.id ? { ...m, read: true } : m));
    setSelected(message.id);
  };
  const sendMessage = (to, subject, body) => {
    const next = {
      id: Date.now(), from: "Me", email: "me@example.com",
      subject: subject || "(no subject)", body: `To: ${to}\n\n${body}`,
      time: "Just now", read: true, starred: false, label: "Sent"
    };
    save([next, ...messages]);
    setCompose(false);
  };

  const selectedMessage = messages.find(m => m.id === selected);

  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <div className="brand">
          <button className="icon-btn" onClick={() => setSidebar(!sidebar)}><Menu size={22}/></button>
          <div className="logo"><Mail size={24}/></div>
          <span>MailBox</span>
        </div>
        <div className="search">
          <Search size={20}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search mail"/>
          {query && <button className="clear" onClick={() => setQuery("")}><X size={17}/></button>}
        </div>
        <div className="top-actions">
          <button className="icon-btn" title="Help"><HelpCircle size={20}/></button>
          <button className="icon-btn" title="Settings"><Settings size={20}/></button>
          <button className="icon-btn" onClick={() => setDark(!dark)} title="Theme">◐</button>
          <button className="avatar">T</button>
        </div>
      </header>

      <div className="layout">
        {sidebar && <aside className="sidebar">
          <button className="compose-btn" onClick={() => setCompose(true)}><Plus size={21}/> Compose</button>
          <NavItem icon={<Inbox/>} label="Inbox" active={folder==="Inbox"} count={messages.filter(m=>m.label==="Inbox"&&!m.read).length} onClick={()=>setFolder("Inbox")}/>
          <NavItem icon={<Star/>} label="Starred" active={folder==="Starred"} onClick={()=>setFolder("Starred")}/>
          <NavItem icon={<Clock3/>} label="Snoozed" onClick={()=>setFolder("Snoozed")}/>
          <NavItem icon={<Send/>} label="Sent" active={folder==="Sent"} onClick={()=>setFolder("Sent")}/>
          <NavItem icon={<FileText/>} label="Drafts" active={folder==="Drafts"} onClick={()=>setFolder("Drafts")}/>
          <NavItem icon={<Trash2/>} label="Trash" active={folder==="Trash"} onClick={()=>setFolder("Trash")}/>
          <div className="side-section">Labels</div>
          <div className="label-row"><span className="dot blue"></span>Work</div>
          <div className="label-row"><span className="dot green"></span>Learning</div>
        </aside>}

        <main className="content">
          {selectedMessage ? (
            <MessageView message={selectedMessage} onBack={()=>setSelected(null)} onDelete={()=>deleteMessage(selectedMessage.id)} onStar={()=>toggleStar(selectedMessage.id)}/>
          ) : (
            <>
              <div className="toolbar">
                <label className="check"><input type="checkbox"/><span></span></label>
                <button className="icon-btn" onClick={()=>setMessages([...messages])}><RefreshCw size={18}/></button>
                <button className="icon-btn"><MoreHorizontal size={19}/></button>
                <div className="spacer"></div>
                <span className="range">{visible.length ? `1–${visible.length}` : "0"} of {visible.length}</span>
                <button className="icon-btn"><ChevronLeft size={18}/></button>
                <button className="icon-btn"><ChevronRight size={18}/></button>
              </div>
              <div className="message-list">
                {visible.length === 0 && <div className="empty"><Mail size={42}/><h3>No messages</h3><p>There are no messages in this folder.</p></div>}
                {visible.map(message => (
                  <div className={message.read ? "message" : "message unread"} key={message.id} onClick={()=>openMessage(message)}>
                    <label className="check" onClick={e=>e.stopPropagation()}><input type="checkbox"/><span></span></label>
                    <button className={message.starred ? "star starred" : "star"} onClick={e=>{e.stopPropagation();toggleStar(message.id)}}><Star size={18}/></button>
                    <div className="sender">{message.from}</div>
                    <div className="subject"><b>{message.subject}</b> <span>— {message.body}</span></div>
                    <div className="time">{message.time}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {compose && <Compose onClose={()=>setCompose(false)} onSend={sendMessage}/>}
    </div>
  );
}

function NavItem({icon,label,active,count,onClick}) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>
    {icon}<span>{label}</span>{count > 0 && <b>{count}</b>}
  </button>
}

function MessageView({message,onBack,onDelete,onStar}) {
  return <div className="message-view">
    <div className="message-toolbar">
      <button className="icon-btn" onClick={onBack}><ChevronLeft/></button>
      <button className="icon-btn"><Archive/></button>
      <button className="icon-btn" onClick={onDelete}><Trash2/></button>
      <button className={message.starred ? "star starred" : "star"} onClick={onStar}><Star/></button>
    </div>
    <h1>{message.subject}</h1>
    <div className="message-header">
      <div className="avatar small">{message.from[0]}</div>
      <div><b>{message.from}</b><div className="muted">&lt;{message.email}&gt;</div></div>
      <div className="spacer"></div><span className="muted">{message.time}</span>
    </div>
    <div className="message-body">{message.body}</div>
    <div className="reply-box">Click Compose to send a new message.</div>
  </div>
}

function Compose({onClose,onSend}) {
  const [to,setTo]=useState("");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  return <div className="compose-window">
    <div className="compose-title"><b>New Message</b><button onClick={onClose}><X size={18}/></button></div>
    <input placeholder="Recipients" value={to} onChange={e=>setTo(e.target.value)}/>
    <input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)}/>
    <textarea placeholder="Write your message..." value={body} onChange={e=>setBody(e.target.value)}/>
    <div className="compose-tools"><Paperclip size={18}/><Image size={18}/><Link2 size={18}/><Smile size={18}/></div>
    <div className="compose-footer"><button className="send-btn" onClick={()=>onSend(to,subject,body)}>Send</button><button className="trash-btn" onClick={onClose}><Trash2 size={18}/></button></div>
  </div>
}

createRoot(document.getElementById("root")).render(<App/>);