import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  }, [statusFilter, searchQuery, sortBy, sortOrder]);

  const updateActiveDocumentStatuses = useCallback(async () => {
    try {
      const activeDocIds = documents
        .filter(doc => doc.status === 'processing' || doc.status === 'queued')
        .map(doc => doc.id);

      if (activeDocIds.length === 0) return;

      const updatedDocs = await documentAPI.listDocuments();

      setDocuments(prevDocs =>
        prevDocs.map(doc => {
          const updated = updatedDocs.find(u => u.id === doc.id);
          return updated
            ? { ...doc, status: updated.status, progress: updated.progress }
            : doc;
        })
      );
    } catch (err: any) {
      console.error('Failed to update document statuses', err);
    }
  }, [documents]);

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

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  useEffect(() => {
    const hasActiveDocuments = documents.some(
      doc => doc.status === 'processing' || doc.status === 'queued'
    );
    setShouldPoll(hasActiveDocuments);
  }, [documents]);

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

    try {
      if (fileArray.length === 1) {
        await documentAPI.uploadDocument(fileArray[0]);
        setSuccess(`Uploaded "${fileArray[0].name}"`);
      } else {
        await documentAPI.uploadMultipleDocuments(fileArray);
        setSuccess(`Uploaded ${fileArray.length} documents`);
      }

      await fetchDocuments();
    } catch (err: any) {
      setError('Upload failed');
      console.error(err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = async (docId: number) => {
    setError('');
    setSuccess('');
    try {
      await documentAPI.retryDocument(docId);
      setSuccess('Retry started');
      await fetchDocuments();
    } catch (err: any) {
      setError('Retry failed');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="topbar">
        <h1 className="logo">DocuFlow</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </header>

      <div className="dashboard-main">
        {/* Upload */}
        <section className="upload-card">
          <div
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="upload-title">Upload Documents</p>
            <p className="upload-sub">Drag & drop or click to upload</p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            hidden
          />
        </section>

        {/* Alerts */}
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {/* Controls */}
        <section className="controls">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="finalized">Finalized</option>
            <option value="failed">Failed</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at">Date</option>
            <option value="filename">Name</option>
            <option value="status">Status</option>
          </select>

          <button
            onClick={() =>
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
            }
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <button onClick={fetchDocuments}>Refresh</button>
        </section>

        {/* Documents */}
        {loading ? (
          <p className="loading">Loading documents...</p>
        ) : filteredDocuments.length === 0 ? (
          <p className="empty">
            {documents.length === 0
              ? 'No documents uploaded yet.'
              : 'No results found.'}
          </p>
        ) : (
          <div className="grid">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="doc-card">
                <div className="doc-header">
                  <h3>{doc.filename}</h3>
                  <span className={`status ${doc.status}`}>
                    {doc.status}
                  </span>
                </div>

                <div className="doc-meta">
                  <span>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                  {doc.file_size && (
                    <span>
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>

                <div className="doc-actions">
                  <Link
                    to={`/document/${doc.id}`}
                    className="btn-outline"
                  >
                    View
                  </Link>

                  {doc.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(doc.id)}
                      className="btn-danger"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;