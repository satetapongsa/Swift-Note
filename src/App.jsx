import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn, Pin, PinOff, 
  Sun, Moon, RotateCcw, XCircle, Copy, Type, Link as LinkIcon, Check,
  Download, Bell, Lock, Unlock, Cloud, CloudOff, Eye, EyeOff,
  Maximize2, Minimize2, CopyPlus, Archive, ExternalLink, Clock, Layout, ChevronRight, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const ACCENT_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Crimson', value: '#e11d48' },
  { name: 'Gold', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' }
];

const BGS = [{ id: 'default', label: 'Default' }, { id: 'sunset', label: 'Sunset' }, { id: 'ocean', label: 'Ocean' }, { id: 'forest', label: 'Forest' }, { id: 'glass', label: 'Glass' }];
const FONTS = [{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }, { id: 'mono', label: 'Mono' }, { id: 'hand', label: 'Hand' } ];
const FONT_SIZES = [ { id: 'xs', label: 'Tiny' }, { id: 's', label: 'Small' }, { id: 'm', label: 'Medium' }, { id: 'l', label: 'Large' }, { id: 'xl', label: 'X-Large' }, { id: 'xxl', label: 'Huge' } ];

const TEMPLATES = [
  { name: 'Meeting', content: '# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n- \n\n## Action Items\n- [ ] ' },
  { name: 'To-Do', content: '# Tasks for Today\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3' },
  { name: 'Journal', content: '# Daily Journal\n\nToday I felt... \n\n## Highlights\n1. \n2. \n3.' }
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
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue' });
  const [isConfigured, setIsConfigured] = useState(true);
  const [view, setView] = useState('notes'); 
  const [theme, setTheme] = useState(() => localStorage.getItem('swift-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('swift-fsize') || 'm');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('swift-font') || 'sans');
  const [editorBg, setEditorBg] = useState(() => localStorage.getItem('swift-ebg') || 'default');
  const [accentCode, setAccentCode] = useState(() => localStorage.getItem('swift-accent') || '#3b82f6');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
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
  useEffect(() => { localStorage.setItem('swift-font', fontFamily); }, [fontFamily]);
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
        setIsSyncing(false);
      }, () => { setIsSyncing(false); });
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach(n => { if (!n.isDeleted && !n.isArchived && n.tags) n.tags.forEach(t => tags.add(t)); });
    return Array.from(tags).filter(t => !['todo', 'doing', 'done'].includes(t));
  }, [notes]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => {
      if (view === 'trash') return n.isDeleted;
      if (view === 'archive') return n.isArchived && !n.isDeleted;
      if (view === 'kanban') return !n.isDeleted && !n.isArchived && (n.tags?.includes('todo') || n.tags?.includes('doing') || n.tags?.includes('done'));
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
    if (!activeNote || !activeNote.content) return { words: 0, chars: 0, readingTime: 1 };
    const words = activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
    return { words, chars: activeNote.content.length, readingTime: Math.ceil(words / 200) || 1 };
  }, [activeNote]);

  const updateNote = async (id, updates) => {
    if (!id) return;
    try {
      setIsSyncing(true);
      await updateDoc(doc(db, 'notes', id), { ...updates, lastModified: serverTimestamp() });
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const confirmDelete = async (id, e, isPermanent = false) => {
    if (e) e.stopPropagation();
    if (window.confirm(isPermanent ? 'Delete permanently?' : 'Move to trash?')) {
      if (isPermanent) await deleteDoc(doc(db, 'notes', id));
      else await updateNote(id, { isDeleted: true, isPinned: false });
      if (activeNoteId === id) setActiveNoteId(null);
    }
  };

  const setKanbanStatus = async (id, oldTags, newStatus) => {
    const cleanTags = (oldTags || []).filter(t => !['todo', 'doing', 'done'].includes(t));
    await updateNote(id, { tags: [...cleanTags, newStatus] });
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    let html = text
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*)\*/gim, '<i>$1</i>')
      .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
      .replace(/\n/gim, '<br />');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const isLocked = activeNote?.password && !unlockedNotes[activeNote.id];

  if (sharedNote) {
    return (
      <div className="app-container" style={{ padding: '40px', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div style={{ maxWidth: 800, width: '100%', background: 'var(--surface-color)', padding: 40, borderRadius: 20, border: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 20 }}>{sharedNote.title}</h1>
          <div className="markdown-preview">{renderMarkdown(sharedNote.content)}</div>
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
            <h1 onClick={() => window.location.href = '/'}>Swift Notes</h1>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="btn-primary" onClick={() => setShowNoteModal(true)}><Plus size={20} /></button>
          </div>
        </div>

        <div className="sidebar-content scroll-hide">
          <div className="sidebar-section">
            <div className={`nav-item ${view === 'notes' ? 'active' : ''}`} onClick={() => {setView('notes'); setSelectedTag(null)}}><FileText size={18} /> <span>All Notes</span></div>
            <div className={`nav-item ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}><Layout size={18} /> <span>Kanban Board</span></div>
            <div className={`nav-item ${view === 'archive' ? 'active' : ''}`} onClick={() => setView('archive')}><Archive size={18} /> <span>Archive</span></div>
            <div className={`nav-item ${view === 'trash' ? 'active' : ''}`} onClick={() => setView('trash')}><Trash2 size={18} /> <span>Trash Bin</span></div>
          </div>

          <div className="sidebar-section">
            <div style={{ position: 'relative', padding: '0 12px' }}>
              <Search size={14} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input className="search-box" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 32 }} />
            </div>
            <div className="tags-cloud">
              {allTags.map(tag => <span key={tag} className={`tag-pill ${selectedTag === tag ? 'active' : ''}`} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}>#{tag}</span>)}
            </div>
          </div>

          <div className="sidebar-section scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="notes-list">
              {filteredNotes.map(n => (
                <div key={n.id} className={`note-item ${activeNoteId === n.id ? 'active' : ''} note-${n.color}`} onClick={() => setActiveNoteId(n.id)}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {n.password && <Lock size={12} />} {n.isPinned && <Pin size={12} fill="currentColor" />} {n.title || 'Untitled'}
                    </h3>
                    <button className="btn-icon-small" onClick={(e) => confirmDelete(n.id, e, n.isDeleted)}><Trash2 size={12} /></button>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 6, justifyContent: 'center' }}>
            {ACCENT_COLORS.map(c => <div key={c.name} onClick={() => setAccentCode(c.value)} style={{ width: 16, height: 16, borderRadius: '50%', background: c.value, cursor: 'pointer', border: accentCode === c.value ? '2px solid white' : 'none' }} />)}
          </div>
        </div>
      </aside>

      <main className={`editor bg-${editorBg}`} style={{ position: 'relative' }}>
        {view === 'kanban' ? (
          <div className="kanban-container scroll-hide">
            {['todo', 'doing', 'done'].map(status => (
              <div key={status} className="kanban-column">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
                  <h2>{status}</h2>
                  <Plus size={14} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={async () => {
                    const docRef = await addDoc(collection(db, 'notes'), { title: 'New task', content: '', color: 'blue', isPinned: false, isDeleted: false, isArchived: false, isPublic: false, tags: [status], createdAt: serverTimestamp(), lastModified: serverTimestamp() });
                    setActiveNoteId(docRef.id); setView('notes');
                  }} />
                </div>
                <div className="kanban-notes">
                  {notes.filter(n => !n.isDeleted && !n.isArchived && n.tags?.includes(status)).map(n => (
                    <div key={n.id} className={`note-item note-${n.color}`} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => { setActiveNoteId(n.id); setView('notes'); }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: 6 }}>{n.title}</h4>
                      <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 8 }}>{n.content?.substring(0, 40)}...</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {status !== 'todo' && <button className="btn-icon-small" onClick={(e) => { e.stopPropagation(); setKanbanStatus(n.id, n.tags, status === 'done' ? 'doing' : 'todo'); }}><ChevronLeft size={10} /></button>}
                        {status !== 'done' && <button className="btn-icon-small" onClick={(e) => { e.stopPropagation(); setKanbanStatus(n.id, n.tags, status === 'todo' ? 'doing' : 'done'); }}><ChevronRight size={10} /></button>}
                        <button className="btn-icon-small" onClick={(e) => confirmDelete(n.id, e, false)} style={{ marginLeft: 'auto' }}><Trash2 size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeNote ? (
          <>
            <AnimatePresence>
              {isLocked && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="locked-overlay" style={{ backdropFilter: 'blur(12px)', zIndex: 100 }}>
                  <Lock size={64} style={{ opacity: 0.05, marginBottom: 20 }} />
                  <h3 style={{ marginBottom: 16 }}>This note is protected</h3>
                  <input type="password" className="form-input" placeholder="Password" value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && passInput === activeNote.password && setUnlockedNotes({...unlockedNotes, [activeNote.id]: true})} style={{ width: 220, textAlign: 'center' }} />
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => passInput === activeNote.password ? setUnlockedNotes({...unlockedNotes, [activeNote.id]: true}) : alert("Password Incorrect")}>Enter Secure Note</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="editor-header">
              <div className="editor-header-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <button className="btn-icon" onClick={() => setIsFocusMode(!isFocusMode)}>{isFocusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
                  <button className="btn-icon" onClick={() => setIsPreview(!isPreview)} title="Toggle Markdown">{isPreview ? <EyeOff size={18} color="var(--accent-color)" /> : <Eye size={18} />}</button>
                  <input className="editor-title-input" value={activeNote.title || ''} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} placeholder="Title..." />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                   <button className="btn-icon" onClick={async () => {
                    const docRef = await addDoc(collection(db, 'notes'), { ...activeNote, title: activeNote.title + ' (Copy)', createdAt: serverTimestamp(), lastModified: serverTimestamp() });
                    setActiveNoteId(docRef.id);
                  }} title="Duplicate"><CopyPlus size={18} /></button>
                  <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isPublic: !activeNote.isPublic })} title="Share Link">{activeNote.isPublic ? <ExternalLink size={18} color="var(--success)" /> : <Share2 size={18} />}</button>
                  {activeNote.isPublic && <button className="btn-icon" onClick={() => {navigator.clipboard.writeText(`${window.location.origin}?share=${activeNote.id}`); alert("Copied!");}}><LinkIcon size={18} /></button>}
                  <button className="btn-icon" onClick={() => setShowReminderModal(true)} title="Reminder"><Bell size={18} color={activeNote.reminderDate ? 'var(--accent-color)' : 'inherit'} /></button>
                  <button className="btn-icon" onClick={() => setShowLockModal(true)} title="Lock">{activeNote.password ? <Lock size={18} color="var(--danger)" /> : <Unlock size={18} />}</button>
                  <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isArchived: !activeNote.isArchived })} title="Archive">{activeNote.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}</button>
                  <button className="btn-icon" onClick={(e) => confirmDelete(activeNote.id, e, activeNote.isDeleted)} title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
              <div className="editor-toolbar" style={{ overflowX: 'auto' }}>
                 <div className="color-picker" style={{ display: 'flex', gap: 6 }}>
                  {['blue', 'purple', 'green', 'yellow', 'red'].map(c => <div key={c} className={`color-dot note-${c} ${activeNote.color === c ? 'active' : ''}`} style={{ width: 12, height: 12, borderRadius: '50%', cursor: 'pointer' }} onClick={() => updateNote(activeNote.id, { color: c })} />)}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 12px' }} />
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                  {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                  {FONT_SIZES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select onChange={(e) => e.target.value && updateNote(activeNote.id, { content: (activeNote.content || '') + '\n' + e.target.value })} style={{ padding: '4px 8px', borderRadius: 8, background: 'var(--surface-color)', color: 'white', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                  <option value="">Templates</option>
                  {TEMPLATES.map(t => <option key={t.name} value={t.content}>{t.name}</option>)}
                </select>
                <div className="tag-input-container" style={{ marginLeft: 16 }}>
                  <Hash size={14} />
                  <input className="tag-input" placeholder="Add tag..." onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      const val = e.target.value.trim().toLowerCase();
                      if (!activeNote.tags?.includes(val)) updateNote(activeNote.id, { tags: [...(activeNote.tags || []), val] });
                      e.target.value = '';
                    }
                  }} />
                </div>
              </div>
            </div>
            <div className="editor-content scroll-hide" style={{ height: 'calc(100% - 160px)' }}>
              {isPreview ? (
                <div className={`markdown-preview font-${fontFamily} font-size-${fontSize}`}>
                  {renderMarkdown(activeNote.content)}
                </div>
              ) : (
                <textarea className={`note-textarea font-${fontFamily} font-size-${fontSize}`} value={activeNote.content || ''} onChange={(e) => updateNote(activeNote.id, { content: e.target.value })} placeholder="Start writing your thoughts..." />
              )}
            </div>
            <div className="word-count-bar">
               <span><b>{stats.words}</b> words | <b>{stats.chars}</b> chars | <b>{stats.readingTime}</b> min read</span>
               <div className={`cloud-icon ${isSyncing ? 'syncing' : ''}`} style={{ marginLeft: 'auto' }}><Cloud size={14} /> <span>{isSyncing ? 'Syncing...' : 'Synced'}</span></div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ opacity: 0.05, marginBottom: 24, animation: 'pulse 3s infinite' }}><FileText size={160} /></div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Swift Notes</h2>
            <p style={{ opacity: 0.6, maxWidth: 300, fontSize: '0.9rem' }}>Select a note or create a new one to begin your journey.</p>
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => setShowNoteModal(true)}>Create First Note</button>
          </div>
        )}
      </main>

      {showNoteModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>Start Something New</h2>
            <div className="form-group">
              <label>Note Title</label>
              <input className="form-input" value={newNoteData.title} onChange={(e) => setNewNoteData({...newNoteData, title: e.target.value})} autoFocus placeholder="e.g. My Secret Project" />
            </div>
            <div className="form-actions">
              <button onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const docRef = await addDoc(collection(db, 'notes'), { title: newNoteData.title || 'Untitled', content: '', color: 'blue', isPinned: false, isDeleted: false, isArchived: false, isPublic: false, tags: [], createdAt: serverTimestamp(), lastModified: serverTimestamp() });
                setActiveNoteId(docRef.id); setShowNoteModal(false); setView('notes');
              }}>Create Note</button>
            </div>
          </motion.div>
        </div>
      )}

      {showLockModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>Security Settings</h2>
            <div className="form-group">
              <label>Password Protection</label>
              <input type="text" className="form-input" placeholder="Enter password (empty to remove)" onKeyDown={(e) => e.key === 'Enter' && (updateNote(activeNote.id, { password: e.target.value || null }), setShowLockModal(false))} />
            </div>
            <div className="form-actions"><button onClick={() => setShowLockModal(false)}>Close</button></div>
          </motion.div>
        </div>
      )}

      {showReminderModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>Set Event Reminder</h2>
            <div className="form-group">
              <label>Execution Time</label>
              <input type="datetime-local" className="form-input" onChange={(e) => { 
                  const time = new Date(e.target.value).getTime();
                  updateNote(activeNote.id, { reminderDate: time, reminderFired: false }); 
                  setShowReminderModal(false); 
              }} />
            </div>
            <div className="form-actions"><button onClick={() => setShowReminderModal(false)}>Close</button></div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
