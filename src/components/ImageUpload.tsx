'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentUrl?: string;
  onRemove?: () => void;
}

export function ImageUpload({ onUpload, currentUrl, onRemove }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setUploadProgress('ファイルを準備中...');

    // ファイルサイズチェック（10MB）
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズは10MB以下にしてください');
      setUploading(false);
      return;
    }

    // ファイルタイプチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('JPEG、PNG、GIF、WebP形式のみ対応しています');
      setUploading(false);
      return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setUploadProgress('アップロード中...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        let errorMessage = data.error || 'アップロードに失敗しました';

        // 詳細情報があれば追加
        if (data.details) {
          errorMessage += '\n\n' + data.details;
        }

        // 手順があれば追加
        if (data.instructions && Array.isArray(data.instructions)) {
          errorMessage += '\n\n手順:\n' + data.instructions.join('\n');
        }

        setError(errorMessage);
        setPreview(null);
      } else {
        setUploadProgress('完了!');
        onUpload(data.url);
        setTimeout(() => setUploadProgress(''), 1000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました。ネットワーク接続を確認してください。');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handleUpload(file);
      } else {
        setError('画像ファイルのみアップロードできます');
      }
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    setError(null);
    setUploadProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  }, [onRemove]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // クリップボードからの貼り付け対応
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleUpload(file);
          break;
        }
      }
    }
  }, [handleUpload]);

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      {/* プレビュー表示 */}
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="max-w-full max-h-48 rounded-lg border border-slate-200"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">{uploadProgress}</span>
              </div>
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600 shadow-lg"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        /* ドロップゾーン */
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-violet-500 bg-violet-50 scale-[1.02]'
              : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-2">
            <div className="text-4xl">
              {isDragging ? '📥' : '📷'}
            </div>
            <p className="text-sm text-slate-600">
              {isDragging ? (
                <span className="text-violet-600 font-medium">ここにドロップ!</span>
              ) : (
                <>
                  <span className="font-medium">クリックして画像を選択</span>
                  <br />
                  <span className="text-xs text-slate-400">またはドラッグ&ドロップ / Ctrl+V で貼り付け</span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-400">
              JPEG, PNG, GIF, WebP（最大10MB）
            </p>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* 成功時のメッセージ */}
      {uploadProgress === '完了!' && !error && (
        <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
          画像のアップロードが完了しました
        </p>
      )}
    </div>
  );
}
