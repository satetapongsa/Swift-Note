import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn, Pin, PinOff, 
  Sun, Moon, RotateCcw, XCircle
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

function App() {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue', tags: '' });
  const [isConfigured, setIsConfigured] = useState(true);
  const [view, setView] = useState('notes'); // 'notes' or 'trash'
  const [theme, setTheme] = useState(() => localStorage.getItem('swift-theme') || 'dark');

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('swift-theme', theme);
  }, [theme]);

  // Firestore Real-time Listener
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

  const handleCreateNote = async () => {
    try {
      const note = {
        title: newNoteData.title || 'Untitled Note',
        content: '',
        color: newNoteData.color,
        tags: newNoteData.tags.split(',').map(t => t.trim()).filter(t => t),
        isPinned: false,
        isDeleted: false,
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
    setNoteToDelete({ id, isPermanent });
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!noteToDelete) return;
    const { id, isPermanent } = noteToDelete;
    
    if (isPermanent) {
      await deleteDoc(doc(db, 'notes', id));
      if (activeNoteId === id) setActiveNoteId(null);
    } else {
      await updateNote(id, { isDeleted: true, isPinned: false });
      if (activeNoteId === id) setActiveNoteId(null);
    }
    
    setShowDeleteModal(false);
    setNoteToDelete(null);
  };

  const restoreFromTrash = async (id, e) => {
    e?.stopPropagation();
    await updateNote(id, { isDeleted: false });
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
                        {note.title}
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
                    <div style={{ marginTop: 4 }}>
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
                      {activeNote.isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                    </button>
                  )}
                  <input className="editor-title-input" value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-icon" onClick={(e) => confirmDelete(activeNote.id, e, activeNote.isDeleted)}>
                    <Trash2 size={20} />
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
                {activeNote.isDeleted && <span className="tag-badge" style={{ background: 'var(--danger)', color: 'white' }}>IN TRASH</span>}
              </div>
            </div>
            <div className="editor-content scroll-hide">
              <textarea className="note-textarea" placeholder="Start writing..." value={activeNote.content || ''} onChange={(e) => updateNote(activeNote.id, { content: e.target.value })} />
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
            <div className="form-group">
              <label>Tags</label>
              <input className="form-input" placeholder="work, idea" value={newNoteData.tags} onChange={(e) => setNewNoteData({...newNoteData, tags: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker" style={{ marginTop: 8 }}>
                {COLORS.map(c => (
                  <div key={c.name} className={`color-dot note-${c.name} ${newNoteData.color === c.name ? 'active' : ''}`} style={{ background: c.value, width: 24, height: 24 }} onClick={() => setNewNoteData({...newNoteData, color: c.name})} />
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button onClick={() => setShowNoteModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateNote}>Create Note</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content" style={{ maxWidth: '360px' }}>
            <h2 style={{ color: 'var(--danger)', fontSize: '1.25rem' }}>
              {noteToDelete?.isPermanent ? 'Delete Permanently?' : 'Move to Trash?'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              {noteToDelete?.isPermanent 
                ? 'This action cannot be undone. This note will be gone forever.' 
                : 'You can still find this note in the Trash Bin later.'}
            </p>
            <div className="form-actions">
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                style={{ background: 'var(--danger)', boxShadow: 'none' }}
                onClick={executeDelete}
              >
                Confirm Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
