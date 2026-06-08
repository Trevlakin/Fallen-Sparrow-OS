/**
 * Lightweight CSV parse for column mapping UI (header row + data rows).
 */
export function parseCsvText(csv: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    const next = csv[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === "\n" || (c === "\r" && next !== "\n")) && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      if (current.trim().length > 0) lines.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim().length > 0) lines.push(current);

  const records = lines.map(parseCsvLine).filter((row) => row.some((cell) => cell.length > 0));
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...rows] = records;
  return { headers: headers ?? [], rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}
