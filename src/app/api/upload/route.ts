import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイド用Supabaseクライアント（service role key使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: '画像アップロード機能が設定されていません' },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（10MB制限）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'JPEG、PNG、GIF、WebP形式のみ対応しています' },
        { status: 400 }
      );
    }

    // ユニークなファイル名を生成
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${randomStr}.${extension}`;

    // ファイルをArrayBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('threads-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);

      // バケットが存在しない場合のエラーメッセージ
      if (error.message.includes('not found') || error.message.includes('does not exist') || error.message.includes('Bucket')) {
        return NextResponse.json(
          {
            error: 'ストレージバケットが設定されていません',
            details: 'Supabaseダッシュボードで「threads-images」バケットを作成し、公開アクセスを有効にしてください。',
            instructions: [
              '1. Supabaseダッシュボードにアクセス',
              '2. Storage → New bucket',
              '3. 名前: threads-images',
              '4. Public bucket: ON',
              '5. 保存'
            ]
          },
          { status: 500 }
        );
      }

      // RLS（Row Level Security）エラー
      if (error.message.includes('policy') || error.message.includes('permission') || error.message.includes('403')) {
        return NextResponse.json(
          {
            error: 'ストレージのアクセス権限エラー',
            details: 'バケットのアクセスポリシーを確認してください。公開バケットとして設定するか、適切なRLSポリシーを設定してください。'
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `アップロードに失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    // 公開URLを取得
    const { data: publicUrlData } = supabase.storage
      .from('threads-images')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      fileName: fileName,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '画像のアップロードに失敗しました' },
      { status: 500 }
    );
  }
}
