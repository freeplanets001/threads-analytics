'use client';

import { useState, useRef, useCallback } from 'react';

export type MediaType = 'image' | 'video' | 'any';

interface MediaUploadProps {
  onUpload: (url: string) => void;
  currentUrl?: string;
  onRemove?: () => void;
  accept?: MediaType;
  compact?: boolean;
  label?: string;
}

export function MediaUpload({
  onUpload,
  currentUrl,
  onRemove,
  accept = 'any',
  compact = false,
  label
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

  const getAllowedTypes = () => {
    if (accept === 'image') return allowedImageTypes;
    if (accept === 'video') return allowedVideoTypes;
    return [...allowedImageTypes, ...allowedVideoTypes];
  };

  const getAcceptString = () => {
    if (accept === 'image') return 'image/jpeg,image/png,image/gif,image/webp';
    if (accept === 'video') return 'video/mp4,video/quicktime,video/webm';
    return 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm';
  };

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setUploadProgress('ファイルを準備中...');

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 動画100MB、画像10MB

    // ファイルサイズチェック
    if (file.size > maxSize) {
      setError(`ファイルサイズは${isVideo ? '100MB' : '10MB'}以下にしてください`);
      setUploading(false);
      return;
    }

    // ファイルタイプチェック
    const allowedTypes = getAllowedTypes();
    if (!allowedTypes.includes(file.type)) {
      const typeMsg = accept === 'image'
        ? 'JPEG、PNG、GIF、WebP形式のみ対応しています'
        : accept === 'video'
        ? 'MP4、MOV、WebM形式のみ対応しています'
        : 'JPEG、PNG、GIF、WebP、MP4、MOV、WebM形式のみ対応しています';
      setError(typeMsg);
      setUploading(false);
      return;
    }

    // プレビュー表示
    if (file.type.startsWith('image/')) {
      setPreviewType('image');
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setPreviewType('video');
      setPreview(URL.createObjectURL(file));
    }

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
        if (data.details) {
          errorMessage += '\n\n' + data.details;
        }
        if (data.instructions && Array.isArray(data.instructions)) {
          errorMessage += '\n\n手順:\n' + data.instructions.join('\n');
        }
        setError(errorMessage);
        setPreview(null);
        setPreviewType(null);
      } else {
        setUploadProgress('完了!');
        onUpload(data.url);
        setTimeout(() => setUploadProgress(''), 1000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました。ネットワーク接続を確認してください。');
      setPreview(null);
      setPreviewType(null);
    } finally {
      setUploading(false);
    }
  }, [accept, onUpload]);

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
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (accept === 'image' && !isImage) {
        setError('画像ファイルのみアップロードできます');
        return;
      }
      if (accept === 'video' && !isVideo) {
        setError('動画ファイルのみアップロードできます');
        return;
      }
      if (isImage || isVideo) {
        handleUpload(file);
      } else {
        setError('画像または動画ファイルのみアップロードできます');
      }
    }
  }, [accept, handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleRemove = useCallback(() => {
    if (preview && previewType === 'video' && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setPreviewType(null);
    setError(null);
    setUploadProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  }, [preview, previewType, onRemove]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // クリップボードからの貼り付け対応
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const isImage = items[i].type.startsWith('image/');
      const isVideo = items[i].type.startsWith('video/');

      if ((accept === 'image' && isImage) ||
          (accept === 'video' && isVideo) ||
          (accept === 'any' && (isImage || isVideo))) {
        const file = items[i].getAsFile();
        if (file) {
          handleUpload(file);
          break;
        }
      }
    }
  }, [accept, handleUpload]);

  const getIcon = () => {
    if (isDragging) return '📥';
    if (accept === 'video') return '🎬';
    if (accept === 'image') return '📷';
    return '📁';
  };

  const getTypeLabel = () => {
    if (accept === 'video') return '動画';
    if (accept === 'image') return '画像';
    return 'メディア';
  };

  const getFormatInfo = () => {
    if (accept === 'image') return 'JPEG, PNG, GIF, WebP（最大10MB）';
    if (accept === 'video') return 'MP4, MOV, WebM（最大100MB）';
    return '画像: JPEG, PNG, GIF, WebP（最大10MB）\n動画: MP4, MOV, WebM（最大100MB）';
  };

  return (
    <div className="space-y-2" onPaste={handlePaste}>
      {label && (
        <label className="text-sm font-medium text-slate-700 block">
          {label}
        </label>
      )}

      {/* プレビュー表示 */}
      {preview ? (
        <div className={`relative inline-block ${compact ? 'max-w-[150px]' : ''}`}>
          {previewType === 'image' ? (
            <img
              src={preview}
              alt="Preview"
              className={`max-w-full rounded-lg border border-slate-200 ${compact ? 'max-h-24' : 'max-h-48'}`}
            />
          ) : (
            <video
              src={preview}
              controls
              className={`max-w-full rounded-lg border border-slate-200 ${compact ? 'max-h-24' : 'max-h-48'}`}
            />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2 text-white">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">{uploadProgress}</span>
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
            border-2 border-dashed rounded-lg text-center cursor-pointer transition-all
            ${compact ? 'p-3' : 'p-6'}
            ${isDragging
              ? 'border-violet-500 bg-violet-50 scale-[1.02]'
              : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString()}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className={`space-y-1 ${compact ? '' : 'space-y-2'}`}>
            <div className={compact ? 'text-2xl' : 'text-4xl'}>
              {getIcon()}
            </div>
            <p className={`text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              {isDragging ? (
                <span className="text-violet-600 font-medium">ここにドロップ!</span>
              ) : (
                <>
                  <span className="font-medium">クリックして{getTypeLabel()}を選択</span>
                  {!compact && (
                    <>
                      <br />
                      <span className="text-xs text-slate-400">またはドラッグ&ドロップ / Ctrl+V で貼り付け</span>
                    </>
                  )}
                </>
              )}
            </p>
            {!compact && (
              <p className="text-xs text-slate-400 whitespace-pre-line">
                {getFormatInfo()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className={`text-red-600 bg-red-50 rounded-lg whitespace-pre-wrap ${compact ? 'text-xs p-2' : 'text-sm p-3'}`}>
          {error}
        </div>
      )}

      {/* 成功時のメッセージ */}
      {uploadProgress === '完了!' && !error && !compact && (
        <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
          {getTypeLabel()}のアップロードが完了しました
        </p>
      )}
    </div>
  );
}
