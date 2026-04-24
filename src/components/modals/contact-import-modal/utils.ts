import { CONTACT_TEMPLATE_HEADERS, CONTACT_TEMPLATE_SAMPLE_ROWS } from './constants';

export const formatPhoneNumber = (phoneNumber: string, defaultCountryCode: string = '+1'): string => {
  if (!phoneNumber) return '';

  const digitsOnly = phoneNumber.replace(/\D/g, '');
  if (!digitsOnly) return '';

  if (digitsOnly.length >= 11) {
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    return `+${digitsOnly.slice(0, digitsOnly.length - 10)}-${digitsOnly.slice(-10, -7)}-${digitsOnly.slice(
      -7,
      -4,
    )}-${digitsOnly.slice(-4)}`;
  }

  if (digitsOnly.length === 10) {
    return `${defaultCountryCode} (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  if (digitsOnly.length === 7) {
    return `${defaultCountryCode} (555) ${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
  }

  return `${defaultCountryCode} ${digitsOnly}`;
};

export const parseCsvText = (text: string): string[][] =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    });

export const autoMapColumns = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    const columnKey = `column_${index}`;

    if (normalizedHeader.includes('first') && normalizedHeader.includes('name')) {
      mapping[columnKey] = 'first_name';
    } else if (normalizedHeader.includes('last') && normalizedHeader.includes('name')) {
      mapping[columnKey] = 'last_name';
    } else if (normalizedHeader.includes('email')) {
      mapping[columnKey] = 'email';
    } else if (
      normalizedHeader.includes('mobile') ||
      normalizedHeader.includes('cell') ||
      normalizedHeader.includes('cellular') ||
      normalizedHeader === 'mobile'
    ) {
      mapping[columnKey] = 'mobile';
    } else if (normalizedHeader.includes('phone') && !normalizedHeader.includes('mobile')) {
      mapping[columnKey] = 'phone';
    } else if (normalizedHeader.includes('company') || normalizedHeader.includes('organization')) {
      mapping[columnKey] = 'organization';
    } else if (normalizedHeader.includes('title') || normalizedHeader.includes('position')) {
      mapping[columnKey] = 'job_title';
    } else if (normalizedHeader.includes('department')) {
      mapping[columnKey] = 'department';
    } else if (normalizedHeader.includes('note')) {
      mapping[columnKey] = 'notes';
    } else if (normalizedHeader.includes('tag')) {
      mapping[columnKey] = 'tags';
    } else if (
      normalizedHeader.includes('contact_type') ||
      normalizedHeader.includes('contacttype') ||
      (normalizedHeader.includes('type') && normalizedHeader.includes('contact'))
    ) {
      mapping[columnKey] = 'contact_type';
    }
  });

  return mapping;
};

export const buildTemplateCsv = (): string => {
  const rows = [
    CONTACT_TEMPLATE_HEADERS.join(','),
    ...CONTACT_TEMPLATE_SAMPLE_ROWS.map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    ),
  ];
  return rows.join('\n');
};
