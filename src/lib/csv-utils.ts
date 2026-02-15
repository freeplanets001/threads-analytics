/**
 * CSV一括インポート/エクスポート用ユーティリティ
 */

export interface CsvRow {
  text: string;
  scheduledDate: string;
  scheduledTime: string;
  type: string;
  mediaUrls: string;
}

export interface CsvValidationError {
  row: number;
  field: string;
  message: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: CsvValidationError[];
  validRows: CsvRow[];
  invalidRowIndices: Set<number>;
}

// CSV行をパース（引用符対応）
function parseCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// セパレータ自動検出
function detectSeparator(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

// ヘッダーマッピング（日本語ヘッダーにも対応）
const HEADER_MAP: Record<string, keyof CsvRow> = {
  text: 'text',
  'テキスト': 'text',
  '投稿内容': 'text',
  '本文': 'text',
  scheduleddate: 'scheduledDate',
  scheduled_date: 'scheduledDate',
  date: 'scheduledDate',
  '投稿日': 'scheduledDate',
  '日付': 'scheduledDate',
  scheduledtime: 'scheduledTime',
  scheduled_time: 'scheduledTime',
  time: 'scheduledTime',
  '投稿時間': 'scheduledTime',
  '時間': 'scheduledTime',
  type: 'type',
  mediatype: 'type',
  media_type: 'type',
  'メディアタイプ': 'type',
  'タイプ': 'type',
  mediaurls: 'mediaUrls',
  media_urls: 'mediaUrls',
  mediaurl: 'mediaUrls',
  media_url: 'mediaUrls',
  'メディアURL': 'mediaUrls',
  '画像URL': 'mediaUrls',
};

// ヘッダー行からカラムインデックスをマッピング
function mapHeaders(headers: string[]): Map<number, keyof CsvRow> {
  const mapping = new Map<number, keyof CsvRow>();
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().replace(/["\s]/g, '');
    const mapped = HEADER_MAP[normalized];
    if (mapped) {
      mapping.set(index, mapped);
    }
  });
  return mapping;
}

// 引用符内の改行を考慮してCSVを論理行に分割
function splitCsvIntoLogicalLines(content: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      // ダブルクォート内のエスケープ("") かどうか
      if (inQuotes && content[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === '\n' || (char === '\r' && content[i + 1] === '\n')) && !inQuotes) {
      if (current.trim() !== '') {
        lines.push(current);
      }
      current = '';
      if (char === '\r') i++; // skip \n in \r\n
    } else if (char === '\r' && !inQuotes) {
      if (current.trim() !== '') {
        lines.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') {
    lines.push(current);
  }
  return lines;
}

// ヘッダー行を自動検出（シート名などの非ヘッダー行をスキップ）
function findHeaderLineIndex(lines: string[], separator: string): number {
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const fields = parseCsvLine(lines[i], separator);
    const mapping = mapHeaders(fields);
    const hasText = Array.from(mapping.values()).includes('text');
    const hasDate = Array.from(mapping.values()).includes('scheduledDate');
    if (hasText && hasDate) {
      return i;
    }
  }
  return 0; // 見つからなければ最初の行をヘッダーとする
}

// CSV文字列をパース
export function parseCSV(content: string): CsvParseResult {
  // 引用符内の改行に対応した行分割
  const lines = splitCsvIntoLogicalLines(content);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ row: 0, field: 'file', message: 'ヘッダー行とデータ行が必要です' }],
      validRows: [],
      invalidRowIndices: new Set(),
    };
  }

  const separator = detectSeparator(lines[0]);

  // ヘッダー行を自動検出（「表1」などのシート名をスキップ）
  const headerIndex = findHeaderLineIndex(lines, separator);
  const headerFields = parseCsvLine(lines[headerIndex], separator);
  const headerMapping = mapHeaders(headerFields);

  // 最低限 text と scheduledDate が必要
  const hasText = Array.from(headerMapping.values()).includes('text');
  const hasDate = Array.from(headerMapping.values()).includes('scheduledDate');

  if (!hasText || !hasDate) {
    const missing: string[] = [];
    if (!hasText) missing.push('text（テキスト）');
    if (!hasDate) missing.push('scheduledDate（投稿日）');
    return {
      rows: [],
      errors: [{ row: 0, field: 'header', message: `必須カラムが見つかりません: ${missing.join(', ')}` }],
      validRows: [],
      invalidRowIndices: new Set(),
    };
  }

  const rows: CsvRow[] = [];
  const allErrors: CsvValidationError[] = [];
  const invalidRowIndices = new Set<number>();

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i], separator);
    const row: CsvRow = {
      text: '',
      scheduledDate: '',
      scheduledTime: '',
      type: 'text',
      mediaUrls: '',
    };

    headerMapping.forEach((key, colIndex) => {
      if (colIndex < fields.length) {
        row[key] = fields[colIndex];
      }
    });

    // scheduledTime が未指定の場合、scheduledDate から抽出を試みる
    if (!row.scheduledTime && row.scheduledDate) {
      const match = row.scheduledDate.match(/[T\s](\d{1,2}:\d{2})/);
      if (match) {
        row.scheduledTime = match[1];
        row.scheduledDate = row.scheduledDate.split(/[T\s]/)[0];
      }
    }

    // type が投稿タイプのカラムにマッピングされている場合、不正な値はデフォルトに
    if (row.type && !['text', 'image', 'video', 'carousel', 'thread'].includes(row.type.toLowerCase().trim())) {
      row.type = 'text';
    }

    const rowIndex = i - headerIndex - 1;
    const rowErrors = validateCsvRow(row, i);
    rows.push(row);

    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors);
      invalidRowIndices.add(rowIndex);
    }
  }

  const validRows = rows.filter((_, index) => !invalidRowIndices.has(index));

  return { rows, errors: allErrors, validRows, invalidRowIndices };
}

// 行単位のバリデーション
export function validateCsvRow(row: CsvRow, rowNumber: number): CsvValidationError[] {
  const errors: CsvValidationError[] = [];

  // text: 必須、500文字以下（スレッドの場合は ||| 区切りで各パート500文字以下）
  if (!row.text || row.text.trim() === '') {
    errors.push({ row: rowNumber, field: 'text', message: 'テキストは必須です' });
  } else if (row.type?.toLowerCase().trim() === 'thread') {
    const parts = row.text.split('|||').map(p => p.trim());
    if (parts.length < 2) {
      errors.push({ row: rowNumber, field: 'text', message: 'スレッドは ||| で区切って2つ以上の投稿を指定してください' });
    } else {
      parts.forEach((part, i) => {
        if (!part) {
          errors.push({ row: rowNumber, field: 'text', message: `スレッド投稿${i + 1}が空です` });
        } else if (part.length > 500) {
          errors.push({ row: rowNumber, field: 'text', message: `スレッド投稿${i + 1}が500文字を超えています（${part.length}文字）` });
        }
      });
    }
  } else if (row.text.length > 500) {
    errors.push({ row: rowNumber, field: 'text', message: `テキストが500文字を超えています（${row.text.length}文字）` });
  }

  // scheduledDate: 必須、有効な日付
  if (!row.scheduledDate || row.scheduledDate.trim() === '') {
    errors.push({ row: rowNumber, field: 'scheduledDate', message: '投稿日は必須です' });
  } else {
    const dateStr = row.scheduledDate.trim();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      errors.push({ row: rowNumber, field: 'scheduledDate', message: `無効な日付形式です: ${dateStr}` });
    }
  }

  // scheduledTime: 必須、HH:MM形式
  if (!row.scheduledTime || row.scheduledTime.trim() === '') {
    errors.push({ row: rowNumber, field: 'scheduledTime', message: '投稿時間は必須です' });
  } else {
    const timeStr = row.scheduledTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
      errors.push({ row: rowNumber, field: 'scheduledTime', message: `無効な時間形式です: ${timeStr}（HH:MM形式で入力）` });
    } else {
      const [h, m] = timeStr.split(':').map(Number);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        errors.push({ row: rowNumber, field: 'scheduledTime', message: `無効な時間です: ${timeStr}` });
      }
    }
  }

  // 日時の組み合わせが5分以上未来かチェック
  if (row.scheduledDate && row.scheduledTime && errors.filter(e => e.field === 'scheduledDate' || e.field === 'scheduledTime').length === 0) {
    const scheduledAt = new Date(`${row.scheduledDate.trim()}T${row.scheduledTime.trim()}`);
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    if (scheduledAt < minTime) {
      errors.push({ row: rowNumber, field: 'scheduledDate', message: '予約時間は5分以上先に設定してください' });
    }
  }

  // type: オプション、有効な値のみ
  if (row.type && row.type.trim() !== '') {
    const validTypes = ['text', 'image', 'video', 'carousel', 'thread'];
    if (!validTypes.includes(row.type.toLowerCase().trim())) {
      errors.push({ row: rowNumber, field: 'type', message: `無効なタイプです: ${row.type}（text, image, video, carousel, thread）` });
    }
  }

  // mediaUrls: type が image/video の場合は推奨
  if (row.type && ['image', 'video'].includes(row.type.toLowerCase().trim())) {
    if (!row.mediaUrls || row.mediaUrls.trim() === '') {
      errors.push({ row: rowNumber, field: 'mediaUrls', message: `${row.type}タイプにはメディアURLが必要です` });
    }
  }

  // mediaUrls: 値がある場合はURL形式チェック
  if (row.mediaUrls && row.mediaUrls.trim() !== '') {
    try {
      new URL(row.mediaUrls.trim());
    } catch {
      errors.push({ row: rowNumber, field: 'mediaUrls', message: `無効なURL形式です: ${row.mediaUrls}` });
    }
  }

  return errors;
}

// CSVテンプレートを生成
export function generateCsvTemplate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dateStr2 = dayAfter.toISOString().split('T')[0];

  return [
    'text,scheduledDate,scheduledTime,type,mediaUrls',
    `"おはようございます！今日も一日頑張りましょう",${dateStr},08:00,text,`,
    `"新しいプロジェクトを始めました！詳細はプロフィールリンクから",${dateStr},12:00,text,`,
    `"今日のランチはカレーでした🍛",${dateStr2},19:00,text,`,
    `"スレッドの1つ目の投稿|||スレッドの2つ目の投稿|||スレッドの3つ目の投稿",${dateStr2},20:00,thread,`,
  ].join('\n');
}

// 予約投稿をCSVエクスポート
export function exportScheduledPostsToCsv(posts: Array<{
  text: string | null;
  threadPosts?: string | null;
  scheduledAt: string | Date;
  type: string;
  mediaUrls?: string | null;
  status: string;
}>): string {
  const BOM = '\uFEFF';
  const header = 'text,scheduledDate,scheduledTime,type,mediaUrls,status';
  const rows = posts.map(post => {
    const date = new Date(post.scheduledAt);
    const dateStr = date.toISOString().split('T')[0];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    // スレッド投稿の場合、各投稿を ||| で結合してtextカラムに格納
    let textContent = post.text || '';
    if (post.type === 'thread' && post.threadPosts) {
      try {
        const threads = JSON.parse(post.threadPosts) as Array<{ text: string }>;
        textContent = threads.map(t => t.text).join('|||');
      } catch {
        textContent = post.text || '';
      }
    }

    const text = textContent.replace(/"/g, '""');
    // mediaUrlsがJSON文字列の場合、URLのみ抽出
    let mediaUrlsStr = '';
    if (post.mediaUrls) {
      try {
        const parsed = JSON.parse(post.mediaUrls);
        if (Array.isArray(parsed)) {
          mediaUrlsStr = parsed.join(' ');
        } else {
          mediaUrlsStr = post.mediaUrls;
        }
      } catch {
        mediaUrlsStr = post.mediaUrls;
      }
    }
    const escapedMediaUrls = mediaUrlsStr.replace(/"/g, '""');
    return `"${text}",${dateStr},${timeStr},${post.type},"${escapedMediaUrls}",${post.status}`;
  });

  return BOM + [header, ...rows].join('\n');
}
