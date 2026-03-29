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
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: async (data: RegisterRequest): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },
};

export const documentAPI = {
  uploadDocument: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>(
      '/documents/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  uploadMultipleDocuments: async (files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post<any>(
      '/documents/upload-multiple',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
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

    const response = await api.get<Document[]>('/documents/', { params });
    return response.data;
  },

  getDocumentDetails: async (docId: number): Promise<DocumentDetail> => {
    const response = await api.get<DocumentDetail>(`/documents/${docId}`);
    return response.data;
  },

  getDocumentProgress: async (docId: number): Promise<any> => {
    const response = await api.get<any>(`/documents/${docId}/progress`);
    return response.data;
  },

  updateReviewedResult: async (docId: number, data: any): Promise<any> => {
    const response = await api.put<any>(
      `/documents/${docId}/reviewed`,
      data
    );
    return response.data;
  },

  finalizeDocument: async (docId: number): Promise<any> => {
    const response = await api.post<any>(
      `/documents/${docId}/finalize`
    );
    return response.data;
  },

  retryDocument: async (docId: number): Promise<any> => {
    const response = await api.post<any>(
      `/documents/${docId}/retry`
    );
    return response.data;
  },

  exportDocumentJson: async (docId: number, useFinal: boolean = true): Promise<void> => {
    const response = await api.get(
      `/documents/${docId}/export-json`,
      {
        params: { use_final: useFinal },
        responseType: 'blob'
      }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `document_${docId}.json`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  exportDocumentCsv: async (docId: number, useFinal: boolean = true): Promise<void> => {
    const response = await api.get(
      `/documents/${docId}/export-csv`,
      {
        params: { use_final: useFinal },
        responseType: 'blob'
      }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `document_${docId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default api;

