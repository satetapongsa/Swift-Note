import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn, Pin, PinOff, 
  Sun, Moon, RotateCcw, XCircle, Copy, Type, Link as LinkIcon, Check,
  Download, Bell, Lock, Unlock, Cloud, CloudOff, Eye, EyeOff,
  Maximize2, Minimize2, CopyPlus, Archive, ExternalLink, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const ACCENT_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Crimson', value: '#e11d48' },
  { name: 'Gold', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' }
];

const BGS = [
  { id: 'default', label: 'Default' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'forest', label: 'Forest' },
  { id: 'glass', label: 'Glass' }
];

const FONT_SIZES = [
  { id: 'xs', label: 'Tiny' }, { id: 's', label: 'Small' }, { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' }, { id: 'xl', label: 'X-Large' }, { id: 'xxl', label: 'Huge' }
];

function App() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [sharedNote, setSharedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue', tags: '' });
  const [isConfigured, setIsConfigured] = useState(true);
  const [view, setView] = useState('notes'); 
  const [theme, setTheme] = useState(() => localStorage.getItem('swift-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('swift-fsize') || 'm');
  const [editorBg, setEditorBg] = useState(() => localStorage.getItem('swift-ebg') || 'default');
  const [accentCode, setAccentCode] = useState(() => localStorage.getItem('swift-accent') || '#3b82f6');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unlockedNotes, setUnlockedNotes] = useState({}); 
  const [passInput, setPassInput] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('swift-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--dynamic-accent', accentCode);
    localStorage.setItem('swift-accent', accentCode);
  }, [accentCode]);

  useEffect(() => { localStorage.setItem('swift-fsize', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('swift-ebg', editorBg); }, [editorBg]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('share');
    if (sharedId) {
      getDoc(doc(db, 'notes', sharedId)).then(snap => {
        if (snap.exists() && snap.data().isPublic) setSharedNote({ id: snap.id, ...snap.data() });
      });
    }
  }, []);

  useEffect(() => {
    try {
      setIsSyncing(true);
      const q = query(collection(db, 'notes'), orderBy('lastModified', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id, ...doc.data(), lastModified: doc.data().lastModified?.toMillis() || Date.now()
        }));
        setNotes(notesData);
        setIsConfigured(true);
        setIsSyncing(false);
      }, () => { setIsSyncing(false); });
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, []);
  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach(n => {
      if (!n.isDeleted && !n.isArchived && n.tags) n.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags);
  }, [notes]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => {
      if (view === 'trash') return n.isDeleted;
      if (view === 'archive') return n.isArchived && !n.isDeleted;
      return !n.isArchived && !n.isDeleted;
    });
    if (selectedTag) result = result.filter(n => n.tags?.includes(selectedTag));
    result = result.sort((a, b) => (a.isPinned === b.isPinned ? b.lastModified - a.lastModified : (a.isPinned ? -1 : 1)));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(n => n.title?.toLowerCase().includes(s) || n.content?.toLowerCase().includes(s));
    }
    return result;
  }, [notes, searchTerm, view, selectedTag]);

  const stats = useMemo(() => {
    if (!activeNote || !activeNote.content) return { words: 0, chars: 0, readingTime: 0 };
    const words = activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
    return { words, chars: activeNote.content.length, readingTime: Math.ceil(words / 200) || 1 };
  }, [activeNote]);

  const updateNote = async (id, updates) => {
    try {
      setIsSyncing(true);
      await updateDoc(doc(db, 'notes', id), { ...updates, lastModified: serverTimestamp() });
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const confirmDelete = (id, e, isPermanent = false) => {
    e?.stopPropagation();
    if (window.confirm(isPermanent ? 'Delete permanently?' : 'Move to trash?')) {
      if (isPermanent) deleteDoc(doc(db, 'notes', id));
      else updateNote(id, { isDeleted: true, isPinned: false });
    }
  };

  const isLocked = activeNote?.password && !unlockedNotes[activeNote.id];

  if (sharedNote) {
    return (
      <div className="app-container" style={{ padding: '40px', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: 800, width: '100%', background: 'var(--surface-color)', padding: 40, borderRadius: 20, border: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 20 }}>{sharedNote.title}</h1>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-primary)' }}>{sharedNote.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isFocusMode ? 'focus-mode' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px' }} />
            <h1 style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Swift Notes</h1>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="btn-primary" onClick={() => setShowNoteModal(true)}><Plus size={20} /></button>
          </div>
        </div>

        <div className="sidebar-content scroll-hide">
          <div className="sidebar-section">
            <div className={`nav-item ${view === 'notes' ? 'active' : ''}`} onClick={() => setView('notes')}><FileText size={18} /> <span>All Notes</span></div>
            <div className={`nav-item ${view === 'archive' ? 'active' : ''}`} onClick={() => setView('archive')}><Archive size={18} /> <span>Archive</span></div>
            <div className={`nav-item ${view === 'trash' ? 'active' : ''}`} onClick={() => setView('trash')}><Trash2 size={18} /> <span>Trash Bin</span></div>
          </div>

          <div className="sidebar-section">
            <div style={{ position: 'relative', margin: '8px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="search-box" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '32px' }} />
            </div>
            <div className="tags-cloud">
              {allTags.map(tag => <span key={tag} className={`tag-pill ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}>#{tag}</span>)}
            </div>
          </div>

          <div className="sidebar-section scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="notes-list">
              {filteredNotes.map(n => (
                <div key={n.id} className={`note-item ${activeNoteId === n.id ? 'active' : ''} note-${n.color}`} onClick={() => setActiveNoteId(n.id)}>
                   <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {n.password && <Lock size={12} />} {n.isPinned && <Pin size={12} fill="currentColor" />} {n.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
            {ACCENT_COLORS.map(c => <div key={c.name} onClick={() => setAccentCode(c.value)} style={{ width: 18, height: 18, borderRadius: '50%', background: c.value, cursor: 'pointer', border: accentCode === c.value ? '2px solid white' : 'none' }} />)}
          </div>
        </div>
      </aside>

      <main className={`editor bg-${editorBg}`} style={{ position: 'relative' }}>
        {activeNote ? (
          <>
            {isLocked && (
              <div className="locked-overlay">
                <Lock size={64} style={{ opacity: 0.1 }} />
                <h3>Note is Locked</h3>
                <input type="password" className="form-input" placeholder="Enter Password" value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && passInput === activeNote.password && setUnlockedNotes({...unlockedNotes, [activeNote.id]: true})} style={{ width: 200 }} />
              </div>
            )}
            <div className="editor-header">
              <div className="editor-header-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button className="btn-icon" onClick={() => setIsFocusMode(!isFocusMode)}>{isFocusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
                  <input className="editor-title-input" value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isPublic: !activeNote.isPublic })}>{activeNote.isPublic ? <ExternalLink size={18} color="var(--success)" /> : <Share2 size={18} />}</button>
                  {activeNote.isPublic && <button className="btn-icon" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}?share=${activeNote.id}`); alert("Copied!");}}><LinkIcon size={18} /></button>}
                  <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isArchived: !activeNote.isArchived })}>{activeNote.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}</button>
                  <button className="btn-icon" onClick={() => setShowReminderModal(true)}><Bell size={18} /></button>
                  <button className="btn-icon" onClick={() => setShowLockModal(true)}>{activeNote.password ? <Lock size={18} color="var(--danger)" /> : <Unlock size={18} />}</button>
                  <button className="btn-icon" onClick={() => {
                    const blob = new Blob([`# ${activeNote.title}\n\n${activeNote.content}`], { type: 'text/markdown' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${activeNote.title}.md`; a.click();
                  }}><Download size={18} /></button>
                  <button className="btn-icon" onClick={() => { navigator.clipboard.writeText(activeNote.content); setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000); }}>{copyStatus ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}</button>
                  <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{ background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }}>
                    {FONT_SIZES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <select value={editorBg} onChange={(e) => setEditorBg(e.target.value)} style={{ background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }}>
                    {BGS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                  <button className="btn-icon" onClick={(e) => confirmDelete(activeNote.id, e, activeNote.isDeleted)}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
            <div className="editor-content scroll-hide">
              <textarea className={`note-textarea font-size-${fontSize}`} value={activeNote.content || ''} onChange={(e) => updateNote(activeNote.id, { content: e.target.value })} />
            </div>
            <div className="word-count-bar">
               <span><b>{stats.words}</b> words | <b>{stats.chars}</b> chars | <Clock size={12} style={{ display: 'inline', marginBottom: -2 }} /> <b>{stats.readingTime}</b> min read</span>
               <div className={`cloud-icon ${isSyncing ? 'syncing' : ''}`} style={{ marginLeft: 'auto' }}><Cloud size={14} /> <span>{isSyncing ? 'Syncing...' : 'Synced'}</span></div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ opacity: 0.05, marginBottom: 24 }}><FileText size={160} /></div>
            <h2>Pick a note to edit</h2>
            <p style={{ opacity: 0.6 }}>Synced in real-time across devices.</p>
          </div>
        )}
      </main>

      {showNoteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>New Note</h2>
            <input className="form-input" value={newNoteData.title} onChange={(e) => setNewNoteData({...newNoteData, title: e.target.value})} autoFocus placeholder="Title" />
            <div className="form-actions">
              <button onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const docRef = await addDoc(collection(db, 'notes'), { title: newNoteData.title, content: '', color: 'blue', isPinned: false, isDeleted: false, isArchived: false, isPublic: false, createdAt: serverTimestamp(), lastModified: serverTimestamp() });
                setActiveNoteId(docRef.id); setShowNoteModal(false);
              }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Secure Note</h2>
            <input type="text" className="form-input" placeholder="New Password (Leave blank to unlock)" onKeyDown={(e) => e.key === 'Enter' && (updateNote(activeNote.id, { password: e.target.value || null }), setShowLockModal(false))} />
            <div className="form-actions"><button onClick={() => setShowLockModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Set Reminder</h2>
            <input type="datetime-local" className="form-input" onChange={(e) => { updateNote(activeNote.id, { reminderDate: new Date(e.target.value).getTime(), reminderFired: false }); setShowReminderModal(false); }} />
            <div className="form-actions"><button onClick={() => setShowReminderModal(false)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
