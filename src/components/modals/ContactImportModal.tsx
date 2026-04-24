import React, { useCallback, useState } from 'react';
import { FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { AVAILABLE_FIELDS } from './contact-import-modal/constants';
import {
  ContactImportCompleteStep,
  ContactImportingStep,
  ContactImportMappingStep,
  ContactImportUploadStep,
} from './contact-import-modal/ContactImportSteps';
import { ContactImportModalProps, ContactImportStep, ImportError, ImportJob } from './contact-import-modal/types';
import { autoMapColumns, buildTemplateCsv, formatPhoneNumber, parseCsvText } from './contact-import-modal/utils';

export default function ContactImportModal({ isOpen, onClose, onImportComplete }: ContactImportModalProps) {
  const { user } = useAuth();

  const [step, setStep] = useState<ContactImportStep>('upload');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_duplicate'>('skip');

  const downloadTemplate = useCallback(() => {
    const csvContent = buildTemplateCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template downloaded successfully!');
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file.');
      return;
    }

    setLoading(true);
    try {
      const text = await uploadedFile.text();
      const data = parseCsvText(text);

      setFile(uploadedFile);
      setCsvData(data);
      
      if (data.length > 0) {
        setColumnMapping(autoMapColumns(data[0]));
      }
      
      setStep('mapping');
    } catch (error) {
      toast.error('Failed to parse CSV file. Please check the file format.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStartImport = async () => {
    if (!file || csvData.length === 0) return;

    // Validate required fields
    const hasRequiredField = Object.values(columnMapping).includes('first_name');
    if (!hasRequiredField) {
      toast.error('First Name is required. Please map at least one column to First Name.');
      return;
    }

    setStep('importing');
    setLoading(true);

    try {
      // Start import job
      const { data: jobId, error: jobError } = await supabase
        .rpc('start_contact_import_job', {
          p_user_id: user.id,
          p_file_name: file.name,
          p_file_size: file.size,
          p_import_settings: {
            duplicate_handling: duplicateHandling,
            has_header: true
          },
          p_column_mapping: columnMapping
        });

      if (jobError) throw jobError;

      // Process CSV data
      const dataRows = csvData.slice(1);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: ImportError[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNumber = i + 2; // +2 because we start from row 2 (after header)

        try {
          // Map row data to contact fields
          const contactData: any = {};
          const tags: string[] = [];
          
          Object.entries(columnMapping).forEach(([columnKey, fieldName]) => {
            const columnIndex = parseInt(columnKey.replace('column_', ''));
            const value = row[columnIndex]?.trim();
            
            if (value && fieldName) { // Only process if fieldName is not undefined (not skipped)
              if (fieldName === 'tags') {
                tags.push(...value.split(';').map(tag => tag.trim()).filter(tag => tag));
              } else if (fieldName === 'contact_type') {
                // Validate contact type
                const validTypes = ['internal', 'external', 'partner', 'vendor', 'customer', 'prospect'];
                contactData[fieldName] = validTypes.includes(value.toLowerCase()) ? value.toLowerCase() : 'external';
              } else if (fieldName === 'phone' || fieldName === 'mobile') {
                // Format phone numbers with international code
                contactData[fieldName] = formatPhoneNumber(value);
              } else {
                contactData[fieldName] = value;
              }
            }
          });

          // Validate required fields
          if (!contactData.first_name) {
            errors.push({
              row_number: rowNumber,
              error_type: 'missing_required',
              error_message: 'First name is required',
              raw_value: row.join(', ')
            });
            errorCount++;
            continue;
          }

          // Create contact
          const { error: createError } = await supabase
            .rpc('create_contact_with_validation', {
              p_user_id: user.id,
              p_first_name: contactData.first_name,
              p_last_name: contactData.last_name || null,
              p_organization: contactData.organization || null,
              p_job_title: contactData.job_title || null,
              p_contact_type: contactData.contact_type || 'external',
              p_email: contactData.email || null,
              p_phone: contactData.phone || null,
              p_mobile: contactData.mobile || null,
              p_notes: contactData.notes || null,
              p_tags: tags,
              p_custom_fields: {
                department: contactData.department || null
              }
            });

          if (createError) {
            errors.push({
              row_number: rowNumber,
              error_type: 'validation_error',
              error_message: createError.message,
              raw_value: row.join(', ')
            });
            errorCount++;
          } else {
            successCount++;
          }

          // Update progress
          setImportJob(prev => prev ? {
            ...prev,
            processed_rows: i + 1,
            successful_imports: successCount,
            failed_imports: errorCount
          } : null);

        } catch (error: any) {
          errors.push({
            row_number: rowNumber,
            error_type: 'system_error',
            error_message: error.message || 'Unknown error',
            raw_value: row.join(', ')
          });
          errorCount++;
        }
      }

      // Complete import job
      await supabase
        .rpc('complete_import_job', {
          p_job_id: jobId,
          p_user_id: user.id,
          p_status: errorCount === 0 ? 'completed' : 'partially_completed',
          p_results: {
            total_processed: dataRows.length,
            successful: successCount,
            failed: errorCount
          },
          p_error_details: errors.length > 0 ? { errors } : {}
        });

      setImportJob({
        id: jobId,
        status: errorCount === 0 ? 'completed' : 'partially_completed',
        total_rows: dataRows.length,
        processed_rows: dataRows.length,
        successful_imports: successCount,
        failed_imports: errorCount,
        duplicate_contacts: 0,
        error_details: { errors }
      });

      setImportErrors(errors);
      setStep('complete');

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} contacts${errorCount > 0 ? ` (${errorCount} errors)` : ''}.`);
      }

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import contacts. Please try again.');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setColumnMapping({});
    setImportJob(null);
    setImportErrors([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Contacts from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <ContactImportUploadStep
              loading={loading}
              onDownloadTemplate={downloadTemplate}
              onFileUpload={handleFileUpload}
            />
          )}
          {step === 'mapping' && (
            <ContactImportMappingStep
              csvData={csvData}
              columnMapping={columnMapping}
              duplicateHandling={duplicateHandling}
              availableFields={AVAILABLE_FIELDS}
              onDuplicateHandlingChange={(value) => setDuplicateHandling(value)}
              onColumnMappingChange={(columnKey, value) =>
                setColumnMapping((prev) => ({
                  ...prev,
                  [columnKey]: value === '__SKIP__' ? undefined : value,
                }))
              }
              onBack={() => setStep('upload')}
              onStartImport={handleStartImport}
            />
          )}
          {step === 'importing' && <ContactImportingStep importJob={importJob} />}
          {step === 'complete' && (
            <ContactImportCompleteStep
              importJob={importJob}
              importErrors={importErrors}
              onResetImport={resetImport}
              onDone={() => {
                onImportComplete();
                onClose();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
