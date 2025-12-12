/**
 * Excel Export Utility
 * Uses SheetJS (xlsx) library to export data to Excel format
 */

import * as XLSX from 'xlsx';

/**
 * Export data array to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file (without extension)
 * @param {string} sheetName - Name of the Excel sheet (default: 'Sheet1')
 * @param {Array} headers - Optional custom headers array [{key: 'fieldName', label: 'Display Name'}]
 */
export const exportToExcel = (data, fileName = 'export', sheetName = 'Sheet1', headers = null) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // If custom headers provided, map data accordingly
    let exportData;
    if (headers && Array.isArray(headers)) {
      exportData = data.map(row => {
        const mappedRow = {};
        headers.forEach(header => {
          // Support nested keys (e.g., 'user.name')
          const keys = header.key.split('.');
          let value = row;
          for (const key of keys) {
            value = value?.[key];
            if (value === undefined) break;
          }
          mappedRow[header.label] = value ?? '';
        });
        return mappedRow;
      });
    } else {
      // Use data as-is
      exportData = data;
    }

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file and download
    const excelFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, excelFileName);

    return { success: true, fileName: excelFileName };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};

/**
 * Export multiple sheets to Excel file
 * @param {Array} sheets - Array of {name: 'SheetName', data: [...], headers: [...]}
 * @param {string} fileName - Name of the file (without extension)
 */
export const exportMultipleSheets = (sheets, fileName = 'export') => {
  try {
    if (!sheets || sheets.length === 0) {
      throw new Error('No sheets to export');
    }

    const workbook = XLSX.utils.book_new();

    sheets.forEach(sheet => {
      let exportData;
      
      // If custom headers provided, map data accordingly
      if (sheet.headers && Array.isArray(sheet.headers)) {
        exportData = sheet.data.map(row => {
          const mappedRow = {};
          sheet.headers.forEach(header => {
            const keys = header.key.split('.');
            let value = row;
            for (const key of keys) {
              value = value?.[key];
              if (value === undefined) break;
            }
            mappedRow[header.label] = value ?? '';
          });
          return mappedRow;
        });
      } else {
        exportData = sheet.data;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name || 'Sheet1');
    });

    // Generate Excel file and download
    const excelFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, excelFileName);

    return { success: true, fileName: excelFileName };
  } catch (error) {
    console.error('Error exporting multiple sheets to Excel:', error);
    throw error;
  }
};

/**
 * Export HTML table to Excel
 * @param {string|HTMLElement} tableIdOrElement - Table ID or table element
 * @param {string} fileName - Name of the file (without extension)
 * @param {string} sheetName - Name of the Excel sheet
 */
export const exportTableToExcel = (tableIdOrElement, fileName = 'table_export', sheetName = 'Sheet1') => {
  try {
    let table;
    if (typeof tableIdOrElement === 'string') {
      table = document.getElementById(tableIdOrElement);
    } else {
      table = tableIdOrElement;
    }

    if (!table) {
      throw new Error('Table not found');
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, excelFileName);

    return { success: true, fileName: excelFileName };
  } catch (error) {
    console.error('Error exporting table to Excel:', error);
    throw error;
  }
};

/**
 * Format date for Excel export
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateForExcel = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return '';
  }
};

/**
 * Format currency for Excel export
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: '₱')
 * @returns {string} Formatted currency string
 */
export const formatCurrencyForExcel = (amount, currency = '₱') => {
  if (amount === null || amount === undefined) return '';
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '';
  return `${currency}${num.toFixed(2)}`;
};














