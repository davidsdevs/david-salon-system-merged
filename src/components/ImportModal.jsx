import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const ImportModal = ({ 
  isOpen, 
  onClose, 
  onImport, 
  templateColumns, 
  templateName,
  sampleData = [],
  validationRules = null,
  title = "Import Data"
}) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(null);

    // Preview CSV file
    if (selectedFile.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').slice(0, 6); // Preview first 5 rows
        setPreview(lines);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      let data = [];

      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Validate headers
        const missingHeaders = templateColumns.filter(col => !headers.includes(col));
        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values.length === headers.length && values.some(v => v)) {
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }
        }
      } else {
        // Parse Excel file using xlsx
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setError('Excel file is empty');
          setLoading(false);
          return;
        }
        
        // First row should be headers
        const headers = jsonData[0].map(h => String(h).trim());
        
        // Validate headers
        const missingHeaders = templateColumns.filter(col => !headers.includes(col));
        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }
        
        // Parse data rows
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index] !== undefined ? String(row[index]).trim() : '';
          });
          
          // Only add row if it has at least one non-empty value
          if (Object.values(rowData).some(v => v)) {
            data.push(rowData);
          }
        }
      }

      // Validate data if validation rules provided
      if (validationRules) {
        const validationErrors = [];
        data.forEach((row, index) => {
          Object.keys(validationRules).forEach(column => {
            const rule = validationRules[column];
            const value = row[column];
            
            if (rule.required && !value) {
              validationErrors.push(`Row ${index + 2}: ${column} is required`);
            }
            if (rule.type === 'number' && value && isNaN(value)) {
              validationErrors.push(`Row ${index + 2}: ${column} must be a number`);
            }
            if (rule.type === 'email' && value && !value.includes('@')) {
              validationErrors.push(`Row ${index + 2}: ${column} must be a valid email`);
            }
          });
        });

        if (validationErrors.length > 0) {
          setError(`Validation errors:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more` : ''}`);
          setLoading(false);
          return;
        }
      }

      // Call the import handler
      const result = await onImport(data);
      
      if (result && result.success !== false) {
        setSuccess(`Successfully imported ${data.length} records`);
        setTimeout(() => {
          onClose();
          setFile(null);
          setPreview(null);
          setSuccess(null);
        }, 2000);
      } else {
        setError(result?.error || 'Import failed');
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'An error occurred during import');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template
    const headers = templateColumns.join(',');
    const sampleRows = sampleData.length > 0 
      ? sampleData.map(row => templateColumns.map(col => `"${row[col] || ''}"`).join(','))
      : [templateColumns.map(() => '""').join(',')];
    
    const csvContent = [headers, ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateName}_template_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-6">
        {/* Template Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Import Template</h3>
              <p className="text-sm text-blue-700 mb-3">
                Download the template file to see the required format and sample data.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>
        </div>

        {/* Required Columns */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Required Columns:</h4>
          <div className="flex flex-wrap gap-2">
            {templateColumns.map((col, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {col}
              </span>
            ))}
          </div>
        </div>

        {/* Sample Data Preview */}
        {sampleData.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Sample Data:</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {templateColumns.map((col, index) => (
                      <th
                        key={index}
                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sampleData.slice(0, 3).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {templateColumns.map((col, colIndex) => (
                        <td key={colIndex} className="px-3 py-2 text-sm text-gray-900">
                          {row[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File (CSV or Excel)
          </label>
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#160B53] transition-colors">
                <Upload className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Choose file or drag and drop'}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* File Preview */}
        {preview && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">File Preview (first 5 rows):</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-40 overflow-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {preview.join('\n')}
              </pre>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Import Error</p>
                <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Import Successful</p>
                <p className="text-sm text-green-700 mt-1">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="bg-[#160B53] hover:bg-[#12094A] text-white"
          >
            {loading ? 'Importing...' : 'Import Data'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportModal;

