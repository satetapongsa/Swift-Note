import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Trash2, Edit3, Save, FileText, ChevronRight, Share2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const LOCAL_STORAGE_KEY = 'swift-notes-data';

function App() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Real-time synchronization across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        setNotes(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const activeNote = useMemo(() => 
    notes.find(note => note.id === activeNoteId), 
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    return notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.lastModified - a.lastModified);
  }, [notes, searchTerm]);

  const addNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      lastModified: Date.now(),
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  const updateNote = (id, updates) => {
    setNotes(prevNotes => prevNotes.map(note => 
      note.id === id ? { ...note, ...updates, lastModified: Date.now() } : note
    ));
  };

  const deleteNote = (id, e) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      setNotes(notes.filter(note => note.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Swift Notes
          </motion.h1>
          <button className="btn-primary" onClick={addNote}>
            <Plus size={20} />
            <span>New Note</span>
          </button>
        </div>

        <div className="search-container">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              className="search-box" 
              placeholder="Search notes..." 
              style={{ paddingLeft: '36px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="notes-list scroll-hide">
          <AnimatePresence initial={false}>
            {filteredNotes.map(note => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`note-item ${activeNoteId === note.id ? 'active' : ''}`}
                onClick={() => setActiveNoteId(note.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3>{note.title || 'Untitled Note'}</h3>
                    <p>{note.content || 'No content yet...'}</p>
                  </div>
                  <button className="btn-icon" style={{ opacity: 0.5 }} onClick={(e) => deleteNote(note.id, e)}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="last-edited" style={{ marginTop: 8 }}>
                  {new Date(note.lastModified).toLocaleDateString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content */}
      <main className="editor">
        {activeNote ? (
          <>
            <div className="editor-header">
              <input 
                className="editor-title-input" 
                value={activeNote.title}
                onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                placeholder="Note Title"
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-icon"><Share2 size={20} /></button>
                <button className="btn-icon"><MoreHorizontal size={20} /></button>
              </div>
            </div>
            <div className="editor-content scroll-hide">
              <textarea 
                className="note-textarea"
                placeholder="Start writing your thoughts..."
                value={activeNote.content}
                onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
              />
            </div>
          </>
        ) : (
          <div className="empty-state">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
            >
              <FileText size={64} style={{ color: 'var(--border-color)' }} />
            </motion.div>
            <h2>Select a note to view or edit</h2>
            <p>Choose from the list on the left or create a new one.</p>
            <button className="btn-primary" onClick={addNote} style={{ marginTop: 12 }}>
              <Plus size={20} />
              Create First Note
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
