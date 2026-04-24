import React from 'react';
import { AlertCircle, CheckCircle, FileDown, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ContactField, ImportError, ImportJob } from './types';

interface UploadStepProps {
  loading: boolean;
  onDownloadTemplate: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ContactImportUploadStep({ loading, onDownloadTemplate, onFileUpload }: UploadStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
        <p className="text-muted-foreground mb-4">Select a CSV file containing your contact data</p>
        <Button variant="outline" onClick={onDownloadTemplate} className="mb-4" disabled={loading}>
          <FileDown className="w-4 h-4 mr-2" />
          Download CSV Template
        </Button>
      </div>

      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
        <Input type="file" accept=".csv" onChange={onFileUpload} disabled={loading} className="cursor-pointer" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>• Download the template above for proper format and examples</p>
          <p>• First row should contain column headers</p>
          <p>• At minimum, include a "First Name" column</p>
          <p>• Separate multiple tags with semicolons (;)</p>
          <p>• Use standard contact types: internal, external, partner, vendor, customer, prospect</p>
          <p>• Phone numbers can be in any standard format (+1-555-0123, (555) 012-3456, etc.)</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface MappingStepProps {
  csvData: string[][];
  columnMapping: Record<string, string>;
  duplicateHandling: 'skip' | 'update' | 'create_duplicate';
  availableFields: ContactField[];
  onDuplicateHandlingChange: (value: 'skip' | 'update' | 'create_duplicate') => void;
  onColumnMappingChange: (columnKey: string, value: string) => void;
  onBack: () => void;
  onStartImport: () => void;
}

export function ContactImportMappingStep({
  csvData,
  columnMapping,
  duplicateHandling,
  availableFields,
  onDuplicateHandlingChange,
  onColumnMappingChange,
  onBack,
  onStartImport,
}: MappingStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Map CSV Columns</h3>
        <p className="text-muted-foreground mb-4">Map your CSV columns to contact fields. Preview shows first 3 rows.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duplicate-handling">Duplicate Handling</Label>
        <Select value={duplicateHandling} onValueChange={onDuplicateHandlingChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">Skip duplicates</SelectItem>
            <SelectItem value="update">Update existing</SelectItem>
            <SelectItem value="create_duplicate">Create duplicates</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        {csvData[0]?.map((header, index) => {
          const columnKey = `column_${index}`;
          const previewData = csvData.slice(1, 4).map((row) => row[index]).filter(Boolean);

          return (
            <Card key={columnKey}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <Label className="font-medium">{header}</Label>
                    <div className="text-sm text-muted-foreground mt-1">
                      Preview: {previewData.slice(0, 3).join(', ')}
                      {previewData.length > 3 && '...'}
                    </div>
                  </div>
                  <div className="w-48">
                    <Select
                      value={columnMapping[columnKey] || '__SKIP__'}
                      onValueChange={(value) => onColumnMappingChange(columnKey, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Skip column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__SKIP__">Skip column</SelectItem>
                        {availableFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label} {field.required && '*'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onStartImport}
          disabled={!Object.values(columnMapping).includes('first_name')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Start Import
        </Button>
      </div>
    </div>
  );
}

interface ImportingStepProps {
  importJob: ImportJob | null;
}

export function ContactImportingStep({ importJob }: ImportingStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Importing Contacts</h3>
        <p className="text-muted-foreground">Processing your contact data...</p>
      </div>

      {importJob && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>
              {importJob.processed_rows} / {importJob.total_rows}
            </span>
          </div>
          <Progress value={(importJob.processed_rows / importJob.total_rows) * 100} className="w-full" />
        </div>
      )}
    </div>
  );
}

interface CompleteStepProps {
  importJob: ImportJob | null;
  importErrors: ImportError[];
  onResetImport: () => void;
  onDone: () => void;
}

export function ContactImportCompleteStep({ importJob, importErrors, onResetImport, onDone }: CompleteStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        {importJob?.status === 'completed' ? (
          <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
        ) : (
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-600 mb-4" />
        )}
        <h3 className="text-lg font-medium mb-2">
          Import {importJob?.status === 'completed' ? 'Complete' : 'Completed with Errors'}
        </h3>
      </div>

      {importJob && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600">{importJob.successful_imports}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600">{importJob.failed_imports}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{importJob.total_rows}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
        </div>
      )}

      {importErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-600" />
              Import Errors ({importErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 overflow-y-auto">
              <div className="space-y-2">
                {importErrors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-sm p-2 border rounded">
                    <div className="font-medium">
                      Row {error.row_number}: {error.error_type}
                    </div>
                    <div className="text-muted-foreground">{error.error_message}</div>
                    {error.raw_value && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Data: {error.raw_value.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
                {importErrors.length > 10 && (
                  <div className="text-sm text-muted-foreground text-center">
                    ... and {importErrors.length - 10} more errors
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onResetImport}>
          Import Another File
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
