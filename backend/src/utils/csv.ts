export function formatCsvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    })
    .join(',');
}

export function generateCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = formatCsvRow(headers);
  const dataLines = rows.map((r) => formatCsvRow(r));
  return [headerLine, ...dataLines].join('\r\n');
}
