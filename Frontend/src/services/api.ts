import axios from 'axios';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  Document,
  UploadResponse,
  DocumentDetail,
} from '../types/index';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // ⏱ prevents hanging requests
});

/* -------------------- Interceptors -------------------- */

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login'; // auto logout
    }
    return Promise.reject(err);
  }
);

/* -------------------- Helper -------------------- */

const downloadFile = (data: Blob, filename: string) => {
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/* -------------------- Auth API -------------------- */

export const authAPI = {
  register: async (data: RegisterRequest) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },
};

/* -------------------- Document API -------------------- */

export const documentAPI = {
  uploadDocument: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await api.post('/documents/upload', formData);
    return res.data;
  },

  uploadMultipleDocuments: async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const res = await api.post('/documents/upload-multiple', formData);
    return res.data;
  },

  listDocuments: async (
    status?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string
  ): Promise<Document[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);

    const res = await api.get('/documents/', { params });
    return res.data;
  },

  getDocumentDetails: async (docId: number): Promise<DocumentDetail> => {
    const res = await api.get(`/documents/${docId}`);
    return res.data;
  },

  updateReviewedResult: async (docId: number, data: any) => {
    const res = await api.put(`/documents/${docId}/reviewed`, data);
    return res.data;
  },

  finalizeDocument: async (docId: number) => {
    const res = await api.post(`/documents/${docId}/finalize`);
    return res.data;
  },

  retryDocument: async (docId: number) => {
    const res = await api.post(`/documents/${docId}/retry`);
    return res.data;
  },

  exportDocumentJson: async (docId: number) => {
    const res = await api.get(`/documents/${docId}/export-json`, {
      responseType: 'blob',
    });
    downloadFile(res.data, `document_${docId}.json`);
  },

  exportDocumentCsv: async (docId: number) => {
    const res = await api.get(`/documents/${docId}/export-csv`, {
      responseType: 'blob',
    });
    downloadFile(res.data, `document_${docId}.csv`);
  },
};

export default api;