'use client';

import { useState, useRef, useCallback } from 'react';
import { parseCSV, generateCsvTemplate, type CsvRow, type CsvValidationError } from '@/lib/csv-utils';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function CsvImportModal({ isOpen, onClose, accountId, onImportComplete }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [validRows, setValidRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<CsvValidationError[]>([]);
  const [invalidRowIndices, setInvalidRowIndices] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // インポート進捗
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const reset = () => {
    setStep('upload');
    setAllRows([]);
    setValidRows([]);
    setErrors([]);
    setInvalidRowIndices(new Set());
    setDragOver(false);
    setFileError(null);
    setImportProgress(0);
    setImportTotal(0);
    setImportSuccessCount(0);
    setImportErrors([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback((file: File) => {
    setFileError(null);

    if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
      setFileError('CSV、TSV、またはTXTファイルを選択してください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || content.trim() === '') {
        setFileError('ファイルが空です');
        return;
      }

      const result = parseCSV(content);

      if (result.rows.length === 0 && result.errors.length > 0) {
        setFileError(result.errors[0].message);
        return;
      }

      setAllRows(result.rows);
      setValidRows(result.validRows);
      setErrors(result.errors);
      setInvalidRowIndices(result.invalidRowIndices);
      setStep('preview');
    };

    reader.onerror = () => {
      setFileError('ファイルの読み込みに失敗しました');
    };

    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduled-posts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;

    setStep('importing');
    setImportTotal(validRows.length);
    setImportProgress(0);
    setImportSuccessCount(0);
    setImportErrors([]);

    let successCount = 0;
    const importErrs: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const scheduledAt = new Date(`${row.scheduledDate.trim()}T${row.scheduledTime.trim()}`);

      try {
        const res = await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            type: row.type?.toLowerCase().trim() || 'text',
            text: row.text,
            mediaUrls: row.mediaUrls ? [row.mediaUrls.trim()] : undefined,
            scheduledAt: scheduledAt.toISOString(),
          }),
        });

        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json().catch(() => ({}));
          importErrs.push(`行${i + 1}: ${data.error || '登録に失敗しました'}`);
        }
      } catch {
        importErrs.push(`行${i + 1}: ネットワークエラー`);
      }

      setImportProgress(i + 1);
      setImportSuccessCount(successCount);
      setImportErrors([...importErrs]);
    }

    setStep('done');
    if (successCount > 0) {
      onImportComplete();
    }
  };

  if (!isOpen) return null;

  // エラーマップ（行番号 → エラーメッセージ配列）
  const errorsByRow = new Map<number, string[]>();
  errors.forEach(err => {
    const rowIndex = err.row - 1; // CsvValidationErrorのrowは1-indexed
    if (!errorsByRow.has(rowIndex)) {
      errorsByRow.set(rowIndex, []);
    }
    errorsByRow.get(rowIndex)!.push(`${err.field}: ${err.message}`);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">CSVインポート</h2>
            <p className="text-sm text-slate-500">CSVファイルから予約投稿を一括登録</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                }`}
              >
                <svg className="w-12 h-12 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">
                  CSVファイルをドラッグ&ドロップ
                </p>
                <p className="text-sm text-slate-500 mb-4">または</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  ファイルを選択
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-slate-400 mt-3">CSV、TSV、TXTファイルに対応</p>
              </div>

              {fileError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {fileError}
                </div>
              )}

              {/* CSVフォーマット説明 */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5">
                <h3 className="font-medium text-slate-900 dark:text-white mb-3">CSVフォーマット</h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <p>以下のカラムに対応しています：</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-1 pr-4 font-medium">カラム名</th>
                          <th className="text-left py-1 pr-4 font-medium">必須</th>
                          <th className="text-left py-1 font-medium">説明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        <tr>
                          <td className="py-1 pr-4"><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">text</code></td>
                          <td className="py-1 pr-4 text-red-500">必須</td>
                          <td className="py-1">投稿テキスト（500文字以下）</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-4"><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">scheduledDate</code></td>
                          <td className="py-1 pr-4 text-red-500">必須</td>
                          <td className="py-1">投稿日（YYYY-MM-DD）</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-4"><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">scheduledTime</code></td>
                          <td className="py-1 pr-4 text-red-500">必須</td>
                          <td className="py-1">投稿時間（HH:MM）</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-4"><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">type</code></td>
                          <td className="py-1 pr-4 text-slate-400">任意</td>
                          <td className="py-1">text / image / video（デフォルト: text）</td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-4"><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">mediaUrls</code></td>
                          <td className="py-1 pr-4 text-slate-400">任意</td>
                          <td className="py-1">メディアURL（image/video時に必要）</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    日本語のカラム名（テキスト、投稿日、投稿時間など）にも対応しています。
                    <br />
                    日付と時間を1カラムにまとめる場合は <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">2026-03-01T10:00</code> の形式も可能です。
                  </p>
                </div>
              </div>

              {/* テンプレートダウンロード */}
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSVテンプレートをダウンロード
              </button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {validRows.length}件 有効
                  </span>
                </div>
                {invalidRowIndices.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {invalidRowIndices.size}件 エラー
                    </span>
                  </div>
                )}
                <span className="text-sm text-slate-500">
                  合計 {allRows.length}件
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-10">#</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">テキスト</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-28">投稿日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-20">時間</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-16">タイプ</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400 w-16">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {allRows.map((row, index) => {
                      const hasError = invalidRowIndices.has(index);
                      const rowErrors = errorsByRow.get(index);
                      return (
                        <tr
                          key={index}
                          className={hasError ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                        >
                          <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2 text-slate-900 dark:text-white">
                            <div className="max-w-xs truncate">{row.text || <span className="text-slate-400">（空）</span>}</div>
                            {rowErrors && (
                              <div className="mt-1 space-y-0.5">
                                {rowErrors.map((err, i) => (
                                  <p key={i} className="text-xs text-red-500">{err}</p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.scheduledDate || '-'}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.scheduledTime || '-'}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.type || 'text'}</td>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                エラー
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-900 dark:text-white">
                  インポート中...
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {importProgress} / {importTotal} 件処理中
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-indigo-600 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>

              <div className="flex justify-center gap-6 text-sm">
                <span className="text-green-600">成功: {importSuccessCount}</span>
                <span className="text-red-600">失敗: {importErrors.length}</span>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                {importSuccessCount > 0 ? (
                  <>
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      インポート完了
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {importSuccessCount}件の予約投稿を登録しました
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-slate-900 dark:text-white">
                      インポートに失敗しました
                    </p>
                  </>
                )}
              </div>

              {importErrors.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <h4 className="font-medium text-red-800 dark:text-red-400 mb-2">エラー詳細</h4>
                  <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          {step === 'upload' && (
            <>
              <div />
              <button onClick={handleClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                キャンセル
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => {
                  setStep('upload');
                  setAllRows([]);
                  setValidRows([]);
                  setErrors([]);
                  setInvalidRowIndices(new Set());
                  setFileError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                やり直す
              </button>
              <div className="flex items-center gap-3">
                <button onClick={handleClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm"
                >
                  {validRows.length}件をインポート
                </button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <>
              <div />
              <p className="text-sm text-slate-500">処理中はこのウィンドウを閉じないでください</p>
            </>
          )}

          {step === 'done' && (
            <>
              <div />
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
              >
                閉じる
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
