export type ContactImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export interface ImportJob {
  id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  successful_imports: number;
  failed_imports: number;
  duplicate_contacts: number;
  error_details: unknown;
}

export interface ImportError {
  row_number: number;
  error_type: string;
  error_message: string;
  raw_value?: string;
  suggested_fix?: string;
}

export interface ContactField {
  value: string;
  label: string;
  required: boolean;
}
