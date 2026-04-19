import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn, Pin, PinOff, 
  Sun, Moon, RotateCcw, XCircle, Sparkles, Copy, Type, Link as LinkIcon, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

// Replace with your Google Gemini API Key
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

const COLORS = [
  { name: 'blue', value: '#3b82f6' },
  { name: 'purple', value: '#a855f7' },
  { name: 'green', value: '#10b981' },
  { name: 'yellow', value: '#eab308' },
  { name: 'red', value: '#ef4444' }
];

const FONT_SIZES = ['s', 'm', 'l', 'xl'];

function App() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue', tags: '' });
  const [isConfigured, setIsConfigured] = useState(true);
  const [view, setView] = useState('notes'); 
  const [theme, setTheme] = useState(() => localStorage.getItem('swift-theme') || 'dark');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('swift-fsize') || 'm');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('swift-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('swift-fsize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    try {
      const q = query(collection(db, 'notes'), orderBy('lastModified', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastModified: doc.data().lastModified?.toMillis() || Date.now()
        }));
        setNotes(notesData);
        setIsConfigured(true);
      }, (error) => {
        if (error.code === 'permission-denied' || error.message.includes('apiKey')) {
          setIsConfigured(false);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      setIsConfigured(false);
    }
  }, []);

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
      const note = {
        title: newNoteData.title || 'Untitled Note',
        content: '',
        color: newNoteData.color,
        tags: newNoteData.tags.split(',').map(t => t.trim()).filter(t => t),
        isPinned: false,
        isDeleted: false,
        summary: null,
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
    }
  };

  const updateNote = async (id, updates) => {
    try {
      const noteRef = doc(db, 'notes', id);
      await updateDoc(noteRef, {
        ...updates,
        lastModified: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
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

  const restoreFromTrash = async (id, e) => {
    e?.stopPropagation();
    await updateNote(id, { isDeleted: false });
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

  const handleAISummary = async () => {
    if (!activeNote || !activeNote.content) return;
    
    setIsSummarizing(true);
    try {
      if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
        // Simulated AI for demo
        await new Promise(r => setTimeout(r, 2000));
        const mockSummary = "สรุปโดยสังเขป: โน้ตนี้กล่าวถึง " + activeNote.title + " ซึ่งประกอบไปด้วยรายละเอียดหลักเรื่อง " + activeNote.content.substring(0, 50) + "... และอื่นๆ (กรุณาใส่ Gemini API Key เพื่อรับการสรุปฉบับจริง)";
        updateNote(activeNote.id, { summary: mockSummary });
      } else {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `สรุปเนื้อหาในโน้ตตัวนี้ให้สั้น กระชับ และดูเป็นมืออาชีพในภาษาไทย: ${activeNote.content}` }] }]
          })
        });
        const data = await response.json();
        const fullSummary = data.candidates[0].content.parts[0].text;
        updateNote(activeNote.id, { summary: fullSummary });
      }
    } catch (error) {
      alert("AI Error: " + error.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const highlightSearch = (text) => {
    if (!searchTerm || !text) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <span key={i} className="search-highlight">{part}</span> 
        : part
    );
  };

  const renderContent = (content) => {
    if (!content) return '';
    // Simple Auto-linker
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlPattern);
    return parts.map((part, i) => {
      if (part.match(urlPattern)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>{part}</a>;
      }
      return part;
    });
  };

  if (!isConfigured) {
    return (
      <div className="empty-state" style={{ height: '100vh', background: 'var(--bg-color)', justifyContent: 'center' }}>
        <LogIn size={48} style={{ color: 'var(--danger)', marginBottom: 20 }} />
        <h2 style={{ color: 'white' }}>Connection Setup Needed</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Check your Firebase settings.</p>
      </div>
    );
  }

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
                      <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                        {note.isPinned && <Pin size={12} className="pinned-indicator" fill="currentColor" />}
                        {highlightSearch(note.title)}
                      </h3>
                      {view === 'trash' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={(e) => restoreFromTrash(note.id, e)}><RotateCcw size={12} /></button>
                          <button onClick={(e) => confirmDelete(note.id, e, true)}><Trash2 size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={(e) => confirmDelete(note.id, e)}><Trash2 size={12} /></button>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
                      {highlightSearch(note.content?.substring(0, 40))}...
                    </p>
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
      <main className="editor">
        {activeNote ? (
          <>
            <div className="editor-header">
              <div className="editor-header-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  {!activeNote.isDeleted && (
                    <button className="btn-icon" onClick={() => updateNote(activeNote.id, { isPinned: !activeNote.isPinned })}>
                      {activeNote.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
                    </button>
                  )}
                  <input className="editor-title-input" value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={`btn-icon ${isSummarizing ? 'animate-pulse' : ''}`} onClick={handleAISummary} title="AI Summary">
                    <Sparkles size={18} color={isSummarizing ? 'var(--accent-color)' : 'inherit'} />
                  </button>
                  <button className="btn-icon" onClick={copyToClipboard} title="Copy to Clipboard">
                    {copyStatus ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
                  </button>
                  <button className="btn-icon" onClick={() => setFontSize(FONT_SIZES[(FONT_SIZES.indexOf(fontSize) + 1) % FONT_SIZES.length])}>
                    <Type size={18} />
                  </button>
                  <button className="btn-icon" onClick={(e) => confirmDelete(activeNote.id, e, activeNote.isDeleted)}>
                    <Trash2 size={18} />
                  </button>
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
              <AnimatePresence>
                {activeNote.summary && (
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ai-summary-box">
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{activeNote.summary}</p>
                    <button style={{ position: 'absolute', bottom: 8, right: 12, fontSize: '0.7rem', color: 'var(--accent-color)' }} onClick={() => updateNote(activeNote.id, { summary: null })}>Clear</button>
                  </motion.div>
                )}
              </AnimatePresence>
              <textarea 
                className={`note-textarea font-size-${fontSize}`} 
                placeholder="Start writing..." 
                value={activeNote.content || ''} 
                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })} 
              />
            </div>
            <div className="word-count-bar">
              <span><b>{stats.words}</b> words</span>
              <span><b>{stats.chars}</b> characters</span>
              <span style={{ marginLeft: 'auto', opacity: 0.5 }}>Last edited: {new Date(activeNote.lastModified).toLocaleString()}</span>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ opacity: 0.1, marginBottom: 24 }}>
              <FileText size={160} style={{ color: 'var(--text-primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: 8, opacity: 0.8 }}>Pick a note to edit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', opacity: 0.6 }}>
              Your notes are synced in real-time across all devices.
            </p>
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
    </div>
  );
}

export default App;
