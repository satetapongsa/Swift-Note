import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn, Pin, PinOff, 
  Sun, Moon, RotateCcw, XCircle, Copy, Type, Link as LinkIcon, Check,
  Download, Bell, Lock, Unlock, Cloud, CloudOff, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const COLORS = [
  { name: 'blue', value: '#3b82f6' },
  { name: 'purple', value: '#a855f7' },
  { name: 'green', value: '#10b981' },
  { name: 'yellow', value: '#eab308' },
  { name: 'red', value: '#ef4444' }
];

const FONT_SIZES = [
  { id: 'xs', label: 'Tiny' },
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'xl', label: 'X-Large' },
  { id: 'xxl', label: 'Huge' }
];

function App() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue', tags: '' });
  const [isConfigured, setIsConfigured] = useState(true);
  const [view, setView] = useState('notes'); 
  const [theme, setTheme] = useState(() => localStorage.getItem('swift-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('swift-fsize') || 'm');
  const [copyStatus, setCopyStatus] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unlockedNotes, setUnlockedNotes] = useState({}); // { id: true }
  const [passInput, setPassInput] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('swift-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('swift-fsize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    try {
      setIsSyncing(true);
      const q = query(collection(db, 'notes'), orderBy('lastModified', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastModified: doc.data().lastModified?.toMillis() || Date.now()
        }));
        setNotes(notesData);
        setIsConfigured(true);
        setIsSyncing(false);
      }, (error) => {
        if (error.code === 'permission-denied' || error.message.includes('apiKey')) {
          setIsConfigured(false);
        }
        setIsSyncing(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setIsConfigured(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      notes.forEach(note => {
        if (note.reminderDate && !note.isDeleted && !note.reminderFired) {
          if (note.reminderDate <= now) {
            new Notification(`Swift Notes: ${note.title}`, {
              body: "Time for your scheduled note!",
              icon: "/logo.png"
            });
            updateNote(note.id, { reminderFired: true });
          }
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [notes]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => view === 'trash' ? n.isDeleted : !n.isDeleted);
    result = result.sort((a, b) => {
      if (a.isPinned === b.isPinned) return b.lastModified - a.lastModified;
      return a.isPinned ? -1 : 1;
    });

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(n => 
        n.title?.toLowerCase().includes(s) ||
        n.content?.toLowerCase().includes(s) ||
        n.tags?.some(t => t.toLowerCase().includes(s))
      );
    }
    return result;
  }, [notes, searchTerm, view]);

  const stats = useMemo(() => {
    if (!activeNote || !activeNote.content) return { words: 0, chars: 0 };
    const text = activeNote.content.trim();
    return {
      words: text ? text.split(/\s+/).length : 0,
      chars: text.length
    };
  }, [activeNote]);

  const handleCreateNote = async () => {
    try {
      setIsSyncing(true);
      const note = {
        title: newNoteData.title || 'Untitled Note',
        content: '',
        color: newNoteData.color,
        tags: newNoteData.tags.split(',').map(t => t.trim()).filter(t => t),
        isPinned: false,
        isDeleted: false,
        password: null,
        reminderDate: null,
        reminderFired: false,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'notes'), note);
      setActiveNoteId(docRef.id);
      setShowNoteModal(false);
      setNewNoteData({ title: '', color: 'blue', tags: '' });
      setView('notes');
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateNote = async (id, updates) => {
    try {
      setIsSyncing(true);
      const noteRef = doc(db, 'notes', id);
      await updateDoc(noteRef, {
        ...updates,
        lastModified: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmDelete = (id, e, isPermanent = false) => {
    e?.stopPropagation();
    if (confirm(isPermanent ? 'Delete permanently?' : 'Move to trash?')) {
      if (isPermanent) deletePermanently(id);
      else moveToTrash(id);
    }
  };

  const moveToTrash = async (id) => {
    await updateNote(id, { isDeleted: true, isPinned: false });
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const deletePermanently = async (id) => {
    await deleteDoc(doc(db, 'notes', id));
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const copyToClipboard = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleExport = () => {
    if (!activeNote) return;
    const blob = new Blob([`# ${activeNote.title}\n\n${activeNote.content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLocked = activeNote?.password && !unlockedNotes[activeNote.id];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
            <h1>Swift Notes</h1>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-primary" onClick={() => setShowNoteModal(true)}>
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="sidebar-content scroll-hide">
          <div className="sidebar-section">
            <div className={`nav-item ${view === 'notes' ? 'active' : ''}`} onClick={() => setView('notes')}>
              <FileText size={18} /> <span>All Notes</span>
            </div>
            <div className={`nav-item ${view === 'trash' ? 'active' : ''}`} onClick={() => setView('trash')}>
              <Trash2 size={18} /> <span>Trash Bin</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div style={{ position: 'relative', margin: '8px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input className="search-box" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '32px' }} />
            </div>
          </div>

          <div className="sidebar-section scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="notes-list">
              <AnimatePresence>
                {filteredNotes.map(note => (
                  <motion.div
                    key={note.id} layout
                    className={`note-item ${activeNoteId === note.id ? 'active' : ''} note-${note.color}`}
                    onClick={() => setActiveNoteId(note.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {note.password && <Lock size={12} style={{ opacity: 0.5 }} />}
                        {note.isPinned && <Pin size={12} className="pinned-indicator" fill="currentColor" />}
                        {note.title}
                      </h3>
                      <button onClick={(e) => confirmDelete(note.id, e, view === 'trash')}><Trash2 size={12} /></button>
                    </div>
                    {note.reminderDate && !note.reminderFired && (
                      <div className="reminder-badge">
                        <Bell size={10} /> {new Date(note.reminderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      {note.tags?.slice(0, 2).map(tag => <span key={tag} className="tag-badge">#{tag}</span>)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </aside>

      {/* Editor */}
      <main className="editor" style={{ position: 'relative' }}>
        {activeNote ? (
          <>
            {isLocked && (
              <div className="locked-overlay">
                <Lock size={64} style={{ color: 'var(--accent-color)', opacity: 0.2 }} />
                <h3>This note is locked</h3>
                <div className="form-group" style={{ width: '240px' }}>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Enter password" 
                    value={passInput}
                    onChange={(e) => setPassInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && passInput === activeNote.password) {
                        setUnlockedNotes({...unlockedNotes, [activeNote.id]: true});
                        setPassInput('');
                      }
                    }}
                  />
                </div>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    if (passInput === activeNote.password) {
                      setUnlockedNotes({...unlockedNotes, [activeNote.id]: true});
                      setPassInput('');
                    } else {
                      alert("Wrong password!");
                    }
                  }}
                >
                  Unlock Note
                </button>
              </div>
            )}

            <div className="editor-header">
              <div className="editor-header-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isPinned: !activeNote.isPinned })}>
                    {activeNote.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
                  </button>
                  <input className="editor-title-input" value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => setShowReminderModal(true)} title="Set Reminder">
                    <Bell size={18} color={activeNote.reminderDate ? 'var(--accent-color)' : 'inherit'} />
                  </button>
                  <button className="btn-icon" onClick={() => setShowLockModal(true)} title="Secure Note">
                    {activeNote.password ? <Lock size={18} color="var(--danger)" /> : <Unlock size={18} />}
                  </button>
                  <button className="btn-icon" onClick={handleExport} title="Export to MD"><Download size={18} /></button>
                  <button className="btn-icon" onClick={copyToClipboard} title="Copy Content">{copyStatus ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}</button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-color)', padding: '0 8px', borderRadius: '8px', border: '1px solid var(--border-color)', marginLeft: '4px' }}>
                    <Type size={14} style={{ color: 'var(--text-secondary)', marginRight: '4px' }} />
                    <select 
                      value={fontSize} 
                      onChange={(e) => setFontSize(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none', padding: '4px 0' }}
                    >
                      {FONT_SIZES.map(f => <option key={f.id} value={f.id} style={{ background: 'var(--surface-color)' }}>{f.label}</option>)}
                    </select>
                  </div>

                  <button className="btn-icon" onClick={(e) => confirmDelete(activeNote.id, e, activeNote.isDeleted)}><Trash2 size={18} /></button>
                </div>
              </div>
              <div className="editor-toolbar">
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div key={c.name} className={`color-dot note-${c.name} ${activeNote.color === c.name ? 'active' : ''}`} style={{ background: c.value }} onClick={() => updateNote(activeNote.id, { color: c.name })} />
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
                <div className="tag-input-container">
                  <Hash size={14} />
                  <input className="tag-input" placeholder="Tag..." onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      const newTag = e.target.value.trim();
                      if (!activeNote.tags?.includes(newTag)) updateNote(activeNote.id, { tags: [...(activeNote.tags || []), newTag] });
                      e.target.value = '';
                    }
                  }} />
                </div>
              </div>
            </div>
            <div className="editor-content scroll-hide">
              <textarea 
                className={`note-textarea font-size-${fontSize}`} 
                placeholder="Start writing..." 
                value={activeNote.content || ''} 
                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })} 
              />
            </div>
            <div className="word-count-bar">
              <span><b>{stats.words}</b> words | <b>{stats.chars}</b> chars</span>
              <div className={`cloud-icon ${isSyncing ? 'syncing' : ''}`} style={{ marginLeft: 'auto' }}>
                <Cloud size={14} /> <span>{isSyncing ? 'Syncing...' : 'Synced'}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ opacity: 0.05, marginBottom: 24 }}>
              <FileText size={160} style={{ color: 'var(--text-primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: 8, opacity: 0.8 }}>Pick a note to edit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', opacity: 0.6 }}>Synced in real-time across devices.</p>
          </div>
        )}
      </main>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>New Note</h2>
            <div className="form-group">
              <label>Title</label>
              <input className="form-input" value={newNoteData.title} onChange={(e) => setNewNoteData({...newNoteData, title: e.target.value})} autoFocus />
            </div>
            <div className="form-actions">
              <button onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateNote}>Create Note</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Security Modal */}
      {showLockModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>Secure Note</h2>
            <div className="form-group">
              <label>Set Password (Leave blank to remove)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter password" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateNote(activeNote.id, { password: e.target.value || null });
                    setShowLockModal(false);
                  }
                }}
              />
            </div>
            <div className="form-actions">
              <button onClick={() => setShowLockModal(false)}>Close</button>
              <button className="btn-primary" onClick={(e) => {
                const val = e.target.parentElement.previousElementSibling.querySelector('input').value;
                updateNote(activeNote.id, { password: val || null });
                setShowLockModal(false);
              }}>Save Password</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2>Set Reminder</h2>
            <div className="form-group">
              <label>Reminder Time</label>
              <input 
                type="datetime-local" 
                className="form-input" 
                onChange={(e) => {
                  const date = new Date(e.target.value).getTime();
                  updateNote(activeNote.id, { reminderDate: date, reminderFired: false });
                  setShowReminderModal(false);
                }}
              />
            </div>
            <div className="form-actions">
              <button onClick={() => {
                updateNote(activeNote.id, { reminderDate: null, reminderFired: false });
                setShowReminderModal(false);
              }}>Clear Reminder</button>
              <button onClick={() => setShowReminderModal(false)}>Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
