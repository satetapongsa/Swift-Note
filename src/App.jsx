import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Trash2, FileText, Share2, MoreHorizontal, 
  Hash, Calendar, Palette, LogIn
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
  const [newNoteData, setNewNoteData] = useState({ title: '', color: 'blue', tags: '' });
  const [isConfigured, setIsConfigured] = useState(true);

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
        console.error("Firebase Error:", error);
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
    if (!searchTerm) return notes;
    const s = searchTerm.toLowerCase();
    return notes.filter(n => 
      n.title?.toLowerCase().includes(s) ||
      n.content?.toLowerCase().includes(s) ||
      n.tags?.some(t => t.toLowerCase().includes(s))
    );
  }, [notes, searchTerm]);

  const handleCreateNote = async () => {
    try {
      const note = {
        title: newNoteData.title || 'Untitled Note',
        content: '',
        color: newNoteData.color,
        tags: newNoteData.tags.split(',').map(t => t.trim()).filter(t => t),
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'notes'), note);
      setActiveNoteId(docRef.id);
      setShowNoteModal(false); // Modal closes automatically
      setNewNoteData({ title: '', color: 'blue', tags: '' });
    } catch (e) {
      alert("Failed to create note. Please check your Firebase settings.");
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
      console.error("Update error:", e);
    }
  };

  const deleteNote = async (id, e) => {
    e?.stopPropagation();
    if (confirm('Delete this note?')) {
      try {
        await deleteDoc(doc(db, 'notes', id));
        if (activeNoteId === id) setActiveNoteId(null);
      } catch (e) {
        alert("Delete failed.");
      }
    }
  };

  if (!isConfigured) {
    return (
      <div className="empty-state" style={{ height: '100vh', background: 'var(--bg-color)', justifyContent: 'center' }}>
        <LogIn size={48} style={{ color: 'var(--danger)', marginBottom: 20 }} />
        <h2 style={{ color: 'white' }}>Firebase Connection Error</h2>
        <p style={{ maxWidth: '400px', textAlign: 'center', marginTop: 10 }}>
          Make sure <code>src/firebase.js</code> has your valid credentials.
        </p>
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
          <button className="btn-primary" onClick={() => setShowNoteModal(true)}>
            <Plus size={20} />
            <span>New</span>
          </button>
        </div>

        <div className="sidebar-content scroll-hide">
          <div className="sidebar-section">
            <div style={{ position: 'relative', margin: '8px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                className="search-box" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>

          <div className="sidebar-section scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="notes-list">
              <AnimatePresence>
                {filteredNotes.map(note => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`note-item ${activeNoteId === note.id ? 'active' : ''} note-${note.color}`}
                    onClick={() => setActiveNoteId(note.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: '0.9rem' }}>{note.title}</h3>
                      <button onClick={(e) => deleteNote(note.id, e)}><Trash2 size={12} /></button>
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
                <input 
                  className="editor-title-input" 
                  value={activeNote.title}
                  onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-icon">
                    <Trash2 size={20} onClick={(e) => deleteNote(activeNote.id, e)} />
                  </button>
                </div>
              </div>
              <div className="editor-toolbar">
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div 
                      key={c.name}
                      className={`color-dot note-${c.name} ${activeNote.color === c.name ? 'active' : ''}`}
                      style={{ background: c.value }}
                      onClick={() => updateNote(activeNote.id, { color: c.name })}
                    />
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
                <div className="tag-input-container">
                  <Hash size={14} />
                  <input 
                    className="tag-input" 
                    placeholder="Tag..." 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        const newTag = e.target.value.trim();
                        if (!activeNote.tags?.includes(newTag)) {
                          updateNote(activeNote.id, { tags: [...(activeNote.tags || []), newTag] });
                        }
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="editor-content scroll-hide">
              <textarea 
                className="note-textarea"
                placeholder="Start writing..."
                value={activeNote.content || ''}
                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
              />
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2 }}>
              <FileText size={80} style={{ color: 'var(--border-color)', marginBottom: 24 }} />
            </motion.div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: 8 }}>Pick a note to edit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Your notes are synced in real-time across all devices.
            </p>
          </div>
        )}
      </main>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2 style={{ fontSize: '1.2rem' }}>New Note</h2>
            <div className="form-group">
              <label>Title</label>
              <input 
                className="form-input" 
                value={newNoteData.title}
                onChange={(e) => setNewNoteData({...newNoteData, title: e.target.value})}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Tags</label>
              <input 
                className="form-input" 
                placeholder="work, idea, personal"
                value={newNoteData.tags}
                onChange={(e) => setNewNoteData({...newNoteData, tags: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker" style={{ marginTop: 8 }}>
                {COLORS.map(c => (
                  <div 
                    key={c.name}
                    className={`color-dot note-${c.name} ${newNoteData.color === c.name ? 'active' : ''}`}
                    style={{ background: c.value, width: 24, height: 24 }}
                    onClick={() => setNewNoteData({...newNoteData, color: c.name})}
                  />
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
    </div>
  );
}

export default App;
