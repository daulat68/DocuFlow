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
    <div className="detail-container">
      <div className="detail-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Back to Dashboard
        </button>
        <h1>{document.filename}</h1>
        <span className={`status-badge status-${document.status}`}>
          {document.status.toUpperCase()}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="detail-content">
        {/* Document Info */}
        <section className="info-section">
          <h2>📋 Document Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Document ID:</label>
              <span>{document.id}</span>
            </div>
            <div className="info-item">
              <label>File Type:</label>
              <span>{document.file_type || 'Unknown'}</span>
            </div>
            <div className="info-item">
              <label>File Size:</label>
              <span>
                {document.file_size ? `${(document.file_size / 1024).toFixed(2)} KB` : 'N/A'}
              </span>
            </div>
            <div className="info-item">
              <label>Created:</label>
              <span>{new Date(document.created_at).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <label>Updated:</label>
              <span>{new Date(document.updated_at).toLocaleString()}</span>
            </div>
            {document.completed_at && (
              <div className="info-item">
                <label>Completed:</label>
                <span>{new Date(document.completed_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>

        {/* Progress */}
        {document.progress && document.status === 'processing' && (
          <section className="progress-section">
            <h2>⏳ Processing Progress</h2>
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${document.progress.percentage}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {document.progress.message} ({document.progress.percentage}%)
              </p>
            </div>
          </section>
        )}

        {/* Error Message */}
        {document.error_message && (
          <section className="error-section">
            <h2>❌ Error Details</h2>
            <p className="error-text">{document.error_message}</p>
            <button onClick={handleRetry} className="retry-action-btn">
              🔄 Retry Processing
            </button>
          </section>
        )}

        {/* Processed Output */}
        {document.processed_output && (
          <section className="output-section">
            <h2>🔍 Processed Output (Read-Only)</h2>
            <div className="output-container">
              <pre>{JSON.stringify(document.processed_output, null, 2)}</pre>
            </div>
          </section>
        )}

        {/* Review/Edit Section */}
        {document.status !== 'finalized' && document.reviewed_result && (
          <section className="review-section">
            <div className="review-header">
              <h2>✏️ Review & Edit</h2>
              <div className="review-actions">
                {!editing ? (
                  <button onClick={handleEdit} className="edit-btn">
                    ✏️ Edit
                  </button>
                ) : (
                  <>
                    <button onClick={handleSaveEdit} className="save-btn">
                      💾 Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditedDataString('');
                      }}
                      className="cancel-btn"
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <textarea
                value={editedDataString}
                onChange={(e) => setEditedDataString(e.target.value)}
                className="review-textarea"
                rows={15}
              />
            ) : (
              <div className="review-output">
                <pre>{JSON.stringify(editedData, null, 2)}</pre>
              </div>
            )}

            {!editing && document.status !== 'finalized' && (
              <button onClick={handleFinalize} className="finalize-btn">
                🔒 Finalize & Lock
              </button>
            )}
          </section>
        )}

        {/* Final Result (if finalized) */}
        {document.final_result && (
          <section className="final-section">
            <h2>🔒 Finalized Result (Locked)</h2>
            <div className="final-output">
              <pre>{JSON.stringify(document.final_result, null, 2)}</pre>
            </div>
          </section>
        )}

        {/* Export Actions */}
        {(document.processed_output || document.reviewed_result || document.final_result) && (
          <section className="export-section">
            <h2>📥 Export Results</h2>
            <div className="export-buttons">
              <button
                onClick={() => handleExport('json')}
                disabled={exporting !== null}
                className="export-btn json-btn"
              >
                {exporting === 'json' ? 'Exporting JSON...' : '📄 Export as JSON'}
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
                className="export-btn csv-btn"
              >
                {exporting === 'csv' ? 'Exporting CSV...' : '📊 Export as CSV'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default DocumentDetailPage;
