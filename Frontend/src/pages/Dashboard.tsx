import React, { useState, useEffect, useRef, useCallback } from 'react'; // Added useCallback
import { useNavigate, Link } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Document } from '../types/index';
import '../styles/Dashboard.css';

const Dashboard: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [shouldPoll, setShouldPoll] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  // FIX: Wrap fetchDocuments in useCallback so it's stable
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await documentAPI.listDocuments(
        statusFilter || undefined,
        searchQuery || undefined,
        sortBy,
        sortOrder
      );
      setDocuments(docs);
      setError('');
    } catch (err: any) {
      setError('Failed to fetch documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, sortBy, sortOrder]); // Re-create only if these change

  // Function to update only active document statuses (non-full reload)
  const updateActiveDocumentStatuses = useCallback(async () => {
    try {
      const activeDocIds = documents
        .filter(doc => doc.status === 'processing' || doc.status === 'queued')
        .map(doc => doc.id);

      if (activeDocIds.length === 0) return;

      // Fetch all documents to get updated statuses
      const updatedDocs = await documentAPI.listDocuments();
      
      // Update only the statuses of active documents in the current list
      setDocuments(prevDocs => 
        prevDocs.map(doc => {
          const updated = updatedDocs.find(u => u.id === doc.id);
          return updated ? { ...doc, status: updated.status, progress: updated.progress } : doc;
        })
      );
    } catch (err: any) {
      console.error('Failed to update document statuses', err);
    }
  }, [documents]);

  // FIX: Wrap applyFiltersAndSort in useCallback
  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...documents];

    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, statusFilter]);

  // Now dependencies are satisfied
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  // Stop polling if no documents have processing/queued status
  useEffect(() => {
    const hasActiveDocuments = documents.some(doc => 
      doc.status === 'processing' || doc.status === 'queued'
    );
    setShouldPoll(hasActiveDocuments);
  }, [documents]);

  // Poll for status updates only (lightweight polling)
  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      updateActiveDocumentStatuses();
    }, 2000);

    return () => clearInterval(interval);
  }, [shouldPoll, updateActiveDocumentStatuses]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setError('');
    setSuccess('');
    const fileArray = Array.from(files);
    
    if (fileArray.length === 1) {
      await uploadSingleFile(fileArray[0]);
    } else {
      await uploadMultipleFiles(fileArray);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadSingleFile = async (file: File) => {
    try {
      await documentAPI.uploadDocument(file);
      setSuccess(`Document "${file.name}" uploaded successfully!`);
      await fetchDocuments();
    } catch (err: any) {
      setError(`Failed to upload "${file.name}"`);
      console.error(err);
    }
  };

  const uploadMultipleFiles = async (files: File[]) => {
    try {
      await documentAPI.uploadMultipleDocuments(files);
      setSuccess(`Successfully uploaded ${files.length} documents!`);
      await fetchDocuments();
    } catch (err: any) {
      setError('Failed to upload multiple documents');
      console.error(err);
    }
  };

  const handleRetry = async (docId: number) => {
    setError('');
    setSuccess('');
    try {
      await documentAPI.retryDocument(docId);
      setSuccess('Document retry initiated');
      await fetchDocuments();
    } catch (err: any) {
      setError('Failed to retry document');
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      queued: '#fff3cd',
      processing: '#cfe2ff',
      completed: '#d1e7dd',
      finalized: '#d1e7dd',
      failed: '#f8d7da'
    };
    return colors[status] || '#e2e3e5';
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>📄 Document Management Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div className="dashboard-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <section className="upload-section">
          <h2>📤 Upload Documents</h2>
          <div className="upload-container">
            <div className="file-upload">
              <label htmlFor="file-input" className="upload-label">
                📁 Drop files here or click to select
                <br />
                <small>(You can upload multiple files at once)</small>
              </label>
              <input
                id="file-input"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="file-input"
              />
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <h2>📊 Your Documents</h2>
          <div className="filters-container">
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Search by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-controls">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                <option value="">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="finalized">Finalized</option>
                <option value="failed">Failed</option>
              </select>

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
                <option value="created_at">Sort by Date</option>
                <option value="filename">Sort by Name</option>
                <option value="status">Sort by Status</option>
              </select>

              <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="sort-toggle">
                {sortOrder === 'asc' ? '⬆️ Ascending' : '⬇️ Descending'}
              </button>

              <button onClick={fetchDocuments} className="refresh-btn">🔄 Refresh</button>
            </div>
          </div>

          {loading ? (
            <p className="loading-text">Loading documents...</p>
          ) : filteredDocuments.length === 0 ? (
            <p className="empty-text">
              {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match filters.'}
            </p>
          ) : (
            <div className="documents-grid">
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="document-card">
                  <div className="card-header">
                    <h3 className="doc-filename">{doc.filename}</h3>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(doc.status), color: '#000' }}>
                      {doc.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="doc-info">
                      <span>📅 {new Date(doc.created_at).toLocaleDateString()}</span>
                      {doc.file_size && <span>💾 {(doc.file_size / 1024).toFixed(2)} KB</span>}
                    </div>
                  </div>
                  <div className="card-actions">
                    <Link to={`/document/${doc.id}`} className="action-btn view-btn"> View</Link>
                    {doc.status === 'failed' && (
                      <button onClick={() => handleRetry(doc.id)} className="action-btn retry-btn">🔄 Retry</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;