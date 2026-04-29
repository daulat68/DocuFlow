import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { DocumentDetail as DocumentDetailType } from '../types/index';
import '../styles/DocumentDetail.css';

const DocumentDetailPage: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const [document, setDocument] = useState<DocumentDetailType | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [editedDataString, setEditedDataString] = useState<string>('');
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [shouldPoll, setShouldPoll] = useState(true);
  const navigate = useNavigate();

  const fetchDocumentDetails = async () => {
    if (!docId) return;
    
    try {
      const doc = await documentAPI.getDocumentDetails(parseInt(docId));
      setDocument(doc);
      if (!editedData) {
        setEditedData(doc.reviewed_result || doc.processed_output);
      }
    } catch (err: any) {
      setError('Failed to fetch document details');
      console.error(err);
    }
  };

  // Stop polling when document is finalized
  useEffect(() => {
    if (document?.status === 'finalized') {
      setShouldPoll(false);
    }
  }, [document?.status]);

  // Poll for document updates
  useEffect(() => {
    if (!shouldPoll || !docId) return;

    fetchDocumentDetails();
    const interval = setInterval(fetchDocumentDetails, 2000);

    return () => clearInterval(interval);
  }, [docId, shouldPoll]);

  const handleEdit = () => {
    if (document?.status === 'finalized') {
      setError('Cannot edit a finalized document');
      return;
    }
    // Convert editedData to string for editing
    setEditedDataString(JSON.stringify(editedData, null, 2));
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!docId) return;

    try {
      // Parse the string back to JSON before saving
      const parsedData = JSON.parse(editedDataString);
      await documentAPI.updateReviewedResult(parseInt(docId), parsedData);
      setSuccess('Reviewed result saved successfully!');
      setEditing(false);
      await fetchDocumentDetails();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your edits.');
      } else {
        setError('Failed to save reviewed result');
      }
      console.error(err);
    }
  };

  const handleFinalize = async () => {
    if (!docId) return;

    if (window.confirm('Are you sure you want to finalize this document? This action cannot be undone.')) {
      try {
        await documentAPI.finalizeDocument(parseInt(docId));
        setSuccess('Document finalized successfully!');
        await fetchDocumentDetails();
      } catch (err: any) {
        setError('Failed to finalize document');
        console.error(err);
      }
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!docId) return;

    setExporting(format);

    try {
      if (format === 'json') {
        await documentAPI.exportDocumentJson(parseInt(docId));
      } else {
        await documentAPI.exportDocumentCsv(parseInt(docId));
      }
      setSuccess(`Exported as ${format.toUpperCase()}!`);
    } catch (err: any) {
      setError(`Failed to export as ${format.toUpperCase()}`);
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const handleRetry = async () => {
    if (!docId) return;

    try {
      await documentAPI.retryDocument(parseInt(docId));
      setSuccess('Retry initiated!');
      await fetchDocumentDetails();
    } catch (err: any) {
      setError('Failed to retry document');
      console.error(err);
    }
  };

  if (!docId) {
    return <div className="error-message">Invalid document ID</div>;
  }

  if (!document) {
    return (
      <div className="detail-container">
        <div className="loading-text">Loading document details...</div>
      </div>
    );
  }

  return (
    <div className="detail">
      
      {/* Header */}
      <div className="detail-top">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Back
        </button>

        <div>
          <h1>{document.filename}</h1>
          <span className={`status ${document.status}`}>
            {document.status}
          </span>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="detail-grid">

        {/* LEFT SIDE */}
        <div className="left-panel">

          <div className="card">
            <h3>Document Info</h3>
            <p>ID: {document.id}</p>
            <p>Type: {document.file_type || 'Unknown'}</p>
            <p>
              Size: {document.file_size
                ? `${(document.file_size / 1024).toFixed(2)} KB`
                : 'N/A'}
            </p>
            <p>Created: {new Date(document.created_at).toLocaleString()}</p>
          </div>

          {document.progress && document.status === 'processing' && (
            <div className="card">
              <h3>Processing</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${document.progress.percentage}%` }}
                />
              </div>
              <p>{document.progress.message}</p>
            </div>
          )}

          {document.error_message && (
            <div className="card error">
              <h3>Error</h3>
              <p>{document.error_message}</p>
              <button onClick={handleRetry}>Retry</button>
            </div>
          )}

        </div>

        {/* RIGHT SIDE */}
        <div className="right-panel">

          {(document.processed_output || editedData) && (
            <div className="card">
              <div className="card-header">
                <h3>Document Data</h3>

                <div className="header-actions">
                  {!editing ? (
                    <button onClick={handleEdit}>Edit</button>
                  ) : (
                    <>
                      <button onClick={handleSaveEdit}>Save</button>
                      <button onClick={() => setEditing(false)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <textarea
                  value={editedDataString}
                  onChange={(e) => setEditedDataString(e.target.value)}
                  className="editor"
                />
              ) : (
                <pre className="code-block">
                  {JSON.stringify(
                    editedData || document.processed_output,
                    null,
                    2
                  )}
                </pre>
              )}

              {/* Actions */}
              {!editing && document.status !== 'finalized' && (
                <button onClick={handleFinalize} className="final-btn">
                  Finalize
                </button>
              )}
            </div>
          )}

          {document.final_result && (
            <div className="card">
              <h3>Final Result</h3>
              <pre className="code-block">
                {JSON.stringify(document.final_result, null, 2)}
              </pre>
            </div>
          )}

          <div className="card">
            <h3>Export</h3>
            <div className="actions">
              <button onClick={() => handleExport('json')}>
                JSON
              </button>
              <button onClick={() => handleExport('csv')}>
                CSV
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default DocumentDetailPage;
