export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface Progress {
  current: number;
  total: number;
  message: string;
  percentage: number;
}

export interface Document {
  id: number;
  filename: string;
  status: string;
  task_id?: string;
  created_at: string;
  file_size?: number;
  file_type?: string;
  progress?: Progress;
  completed_at?: string;
  error_message?: string;
}

export interface UploadResponse {
  message: string;
  document_id: number;
  task_id: string;
  status: string;
}

export interface DocumentDetail {
  id: number;
  filename: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  status: string;
  task_id?: string;
  progress?: Progress;
  metadata?: any;
  processed_output?: any;
  reviewed_result?: any;
  final_result?: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

