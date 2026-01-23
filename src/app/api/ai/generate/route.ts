import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, isDatabaseAvailable } from '@/lib/db';

// プラン別AI生成制限
const AI_LIMITS: Record<string, number> = {
  free: 10,
  standard: 30,
  pro: 100,
};

// テキスト生成・画像生成（Gemini API対応）
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, prompt, context, postType, options, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI APIキーが設定されていません。設定画面でGemini APIキーを入力してください。' },
        { status: 400 }
      );
    }

    // プラン制限チェック
    if (isDatabaseAvailable() && prisma) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (user && user.role !== 'ADMIN') {
        const plan = user.plan || 'free';
        const dailyLimit = AI_LIMITS[plan] || AI_LIMITS.free;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // リセット日が今日より前ならカウントをリセット
        const resetDate = user.aiUsageResetDate ? new Date(user.aiUsageResetDate) : null;
        const needsReset = !resetDate || resetDate < today;
        const currentCount = needsReset ? 0 : (user.aiUsageCount || 0);

        if (currentCount >= dailyLimit) {
          return NextResponse.json(
            {
              error: `本日のAI生成回数の上限（${dailyLimit}回）に達しました。${plan === 'free' ? 'Standard プラン以上で回数を増やせます。' : plan === 'standard' ? 'Pro プランで回数を増やせます。' : ''}`,
              remaining: 0,
              limit: dailyLimit,
            },
            { status: 429 }
          );
        }

        // 使用量を更新
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            aiUsageCount: needsReset ? 1 : currentCount + 1,
            aiUsageResetDate: today,
          },
        });
      }
    }

    if (type === 'text') {
      return generateTextWithGemini(prompt, apiKey, { ...options, context, postType });
    } else if (type === 'image') {
      return generateImageWithNanoBananaPro(prompt, apiKey, options);
    } else {
      return NextResponse.json({ error: '無効なタイプです' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'AI生成に失敗しました' },
      { status: 500 }
    );
  }
}

async function generateTextWithGemini(
  prompt: string,
  apiKey: string,
  options?: { tone?: string; length?: string; customPrompt?: string; context?: string; postType?: string }
) {
  // カスタムプロンプトがあればそれを使用、なければデフォルト
  const defaultSystemPrompt = `あなたは「Threads（スレッズ）」で10万人以上のフォロワーを持つトップインフルエンサーです。
バズる投稿、高エンゲージメントを獲得する投稿の作成に長けています。

【Threadsの特徴】
- テキスト中心のSNS（最大500文字）
- カジュアルで親しみやすい雰囲気
- 共感・気づき・学びのある投稿が伸びやすい

【バズる投稿の法則】
1. フック（冒頭）: 最初の1行で「読みたい」と思わせる
   - 数字を使う：「3つの理由」「5分で」
   - 逆説・意外性：「実は〇〇は間違い」
   - 共感：「〇〇な人、いませんか？」

2. 本文: 1文は短く、箇条書きや改行を効果的に

3. 締め（CTA）:
   - 質問で終わる：「あなたはどう思いますか？」
   - 共感を求める：「同じ人いたらいいね」

4. 絵文字: 冒頭に1つ、強調部分に1-2個、末尾に1つ（計3-5個）

5. ハッシュタグ: 関連性の高いものを2-3個、末尾に配置`;

  const basePrompt = options?.customPrompt || defaultSystemPrompt;

  // トーンの設定
  let toneInstruction = '';
  if (options?.tone === 'professional') {
    toneInstruction = '専門家・プロフェッショナルとして信頼感のある文体で書いてください。データや根拠を示してください。';
  } else if (options?.tone === 'casual') {
    toneInstruction = '友達に話すようなフレンドリーで軽い文体で書いてください。「〜だよね」「〜かも」などを使用してください。';
  } else {
    toneInstruction = '読者参加型で、質問を多用し、コメントを促す文体で書いてください。';
  }

  // 文字数の設定
  let lengthInstruction = '';
  if (options?.length === 'short') {
    lengthInstruction = '50-100文字程度の短くインパクトのある投稿を作成してください。';
  } else if (options?.length === 'long') {
    lengthInstruction = '300-450文字程度の長めの投稿を作成してください。ストーリー性を持たせてください。';
  } else {
    lengthInstruction = '150-250文字程度の投稿を作成してください。読みやすさとボリュームのバランスを取ってください。';
  }

  // 投稿タイプの指示
  let postTypeInstruction = '';
  switch (options?.postType) {
    case 'tips':
      postTypeInstruction = '【投稿タイプ】Tips・ノウハウ形式で、読者に役立つ情報を提供する投稿を作成してください。箇条書きや番号付きリストを活用してください。';
      break;
    case 'story':
      postTypeInstruction = '【投稿タイプ】体験談・ストーリー形式で、あなた自身の経験を語るような投稿を作成してください。感情を込めて、読者が共感できる内容にしてください。';
      break;
    case 'opinion':
      postTypeInstruction = '【投稿タイプ】意見・考察形式で、テーマに対するあなたの見解や分析を述べる投稿を作成してください。根拠を示しながら主張してください。';
      break;
    case 'announcement':
      postTypeInstruction = '【投稿タイプ】告知・紹介形式で、テーマの魅力や特徴を伝える投稿を作成してください。ワクワク感を演出してください。';
      break;
    case 'question':
      postTypeInstruction = '【投稿タイプ】質問・問いかけ形式で、読者に考えさせたり、コメントを促す投稿を作成してください。';
      break;
    default:
      postTypeInstruction = '【投稿タイプ】テーマに最適な形式を自動で選択して投稿を作成してください。';
  }

  // 追加の文脈情報
  const contextInfo = options?.context
    ? `\n【テーマの詳細・背景情報】\n${options.context}\n`
    : '';

  // 最終的なプロンプトを構築
  const fullPrompt = `${basePrompt}

===

【今回の指示】
テーマ・キーワード: 「${prompt}」
${contextInfo}
${postTypeInstruction}

${toneInstruction}
${lengthInstruction}

【重要な出力ルール - 必ず守ること】
- 投稿文のみを出力してください
- 「以下が投稿です」などの前置きは絶対に書かないでください
- 説明や解説は一切不要です
- そのままコピペして投稿できる形式で出力してください
- 最後に改行してハッシュタグを2-3個配置してください
- 必ず完結した投稿文を出力してください（途中で切れないように）
- 提供された「テーマの詳細・背景情報」がある場合は、必ずその情報に基づいて投稿を作成してください

【フォーマットルール - 絶対禁止事項】
- マークダウン記法は一切使用しないでください
- ###、##、# などの見出し記号は使用禁止
- ** や * などの強調記号は使用禁止
- - や * のリスト記号は使用禁止（代わりに「・」や「→」を使用）
- > の引用記号は使用禁止
- プレーンテキストのみで出力してください
- 箇条書きには「・」「→」「①②③」などを使用してください

上記のテーマで、バズるThreads投稿を1つ作成してください。`;

  // gemini-flash-latest を使用（最新のFlashモデル）
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: fullPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Gemini API error:', error);

    // より詳細なエラーメッセージ
    const errorMessage = error.error?.message || 'Text generation failed';
    if (errorMessage.includes('API key')) {
      throw new Error('APIキーが無効です。正しいGemini APIキーを設定してください。');
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  // デバッグ用ログ
  console.log('Gemini response:', JSON.stringify(data, null, 2));

  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // 生成が途中で止まった場合のチェック
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    console.warn('Generation did not complete normally:', finishReason);
  }

  // テキストのクリーンアップ（マークダウン記号の除去）
  let cleanedText = generatedText.trim();

  // コードブロックの削除
  cleanedText = cleanedText
    .replace(/^```[a-z]*\n?/gm, '')
    .replace(/```$/gm, '');

  // マークダウン記号の除去
  cleanedText = cleanedText
    // 見出し記号（###、##、#）を削除
    .replace(/^#{1,6}\s*/gm, '')
    // 強調記号（**text** や *text*）からテキストを抽出
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // リスト記号（- や *）を「・」に変換
    .replace(/^[\-\*]\s+/gm, '・')
    // 引用記号を削除
    .replace(/^>\s*/gm, '')
    // 連続する空行を1つに
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return NextResponse.json({
    success: true,
    text: cleanedText,
    model: 'gemini-flash-latest',
    finishReason: finishReason,
  });
}

// プロンプトを最適化する関数（日本語対応強化）
async function optimizePrompt(
  prompt: string,
  apiKey: string,
  options?: { translateToEnglish?: boolean; autoOptimize?: boolean; negativePrompt?: string; preserveJapaneseText?: boolean }
): Promise<string> {
  if (!options?.autoOptimize) {
    return prompt;
  }

  try {
    // 日本語テキストを画像内に含めるかどうかを検出
    const wantsJapaneseText = /日本語|japanese|にほんご|漢字|ひらがな|カタカナ/i.test(prompt);
    const preserveJapanese = options.preserveJapaneseText || wantsJapaneseText;

    const systemPrompt = `You are an expert at writing prompts for AI image generation.
Your task is to optimize the following image generation prompt.

Instructions:
- Enhance the prompt with additional descriptive details for better image quality
- Add quality modifiers like "high quality", "detailed", "professional"
- Make the prompt more specific and vivid
${preserveJapanese ? `
CRITICAL - JAPANESE TEXT HANDLING:
- If the user wants Japanese text/characters in the image, KEEP those instructions in the prompt
- Do NOT translate requests for Japanese text into English text requests
- Example: "日本語でテキストを入れて" should result in Japanese text appearing in the image
- Preserve any specific Japanese words/phrases that should appear in the image
` : ''}

IMPORTANT:
- Output ONLY the optimized prompt, nothing else
- Do not include any explanations or additional text
- Keep the core subject/theme intact
- The prompt should be understood by Gemini image generation model

Original prompt: "${prompt}"
${options.negativePrompt ? `\nElements to avoid: ${options.negativePrompt}` : ''}

Optimized prompt:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Prompt optimization failed, using original');
      return prompt;
    }

    const data = await response.json();
    const optimizedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return optimizedPrompt || prompt;
  } catch (error) {
    console.error('Prompt optimization error:', error);
    return prompt;
  }
}

async function generateImageWithNanoBananaPro(
  prompt: string,
  apiKey: string,
  options?: {
    style?: string;
    aspectRatio?: string;
    imageSize?: string;
    negativePrompt?: string;
    autoOptimize?: boolean;
    translateToEnglish?: boolean;
    quality?: string;
    preserveJapaneseText?: boolean;
  }
) {
  // 日本語テキストを画像内に含めるかどうかを検出
  const wantsJapaneseText = /日本語|japanese|にほんご|漢字|ひらがな|カタカナ|テキストは/i.test(prompt);

  // プロンプトの最適化（翻訳はしない - 日本語対応を優先）
  let enhancedPrompt = prompt;

  if (options?.autoOptimize) {
    enhancedPrompt = await optimizePrompt(prompt, apiKey, {
      autoOptimize: true,
      negativePrompt: options.negativePrompt,
      preserveJapaneseText: wantsJapaneseText || options.preserveJapaneseText,
    });
  }

  // 品質に応じた追加プロンプト
  const qualityModifiers = {
    draft: '',
    standard: 'high quality, detailed, professional lighting',
    high: 'masterpiece, best quality, highly detailed, sharp focus, professional photography, 8k resolution, cinematic lighting',
  };
  const qualityMod = qualityModifiers[options?.quality as keyof typeof qualityModifiers] || qualityModifiers.standard;

  // アスペクト比の指示
  const aspectRatioInstruction = options?.aspectRatio
    ? `Aspect ratio: ${options.aspectRatio}.`
    : '';

  // 日本語テキスト指示を強調
  const japaneseTextInstruction = wantsJapaneseText
    ? 'CRITICAL: All text in the image must be written in Japanese (日本語). Use proper Japanese characters (漢字、ひらがな、カタカナ).'
    : '';

  // スタイルの整理
  const styleDescription = options?.style
    ? `Style: ${options.style}.`
    : '';

  // プロンプト構築（より明確で効果的な形式）
  const promptParts = [
    enhancedPrompt,
    styleDescription,
    qualityMod,
    aspectRatioInstruction,
    japaneseTextInstruction,
    options?.negativePrompt ? `Do not include: ${options.negativePrompt}` : '',
  ].filter(Boolean);

  const finalPrompt = promptParts.join(' ');

  // 画像生成対応モデル（Nano Banana Pro = Gemini 3 Pro Image Preview）
  const modelsToTry = [
    'gemini-3-pro-image-preview',  // Nano Banana Pro - 最高品質の画像生成モデル
    'gemini-2.0-flash-exp',        // フォールバック
  ];

  let lastError = '';

  console.log('Final image prompt:', finalPrompt);

  for (const model of modelsToTry) {
    try {
      console.log(`Trying image generation with model: ${model}`);

      // モデルに応じた設定
      const isGemini3Pro = model.includes('gemini-3-pro');

      // Gemini 3 Pro Image Preview用の最適化された設定
      const generationConfig = isGemini3Pro
        ? {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 1.0,  // クリエイティブな生成
          }
        : {
            responseModalities: ['IMAGE', 'TEXT'],
          };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: finalPrompt }
                ]
              }
            ],
            generationConfig,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`${model} API error:`, errorData);
        const errorMessage = errorData.error?.message || '画像生成に失敗しました';

        // 過負荷エラーの場合は次のモデルを試す
        if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
          lastError = errorMessage;
          continue;
        }

        lastError = errorMessage;
        continue;
      }

      const data = await response.json();
      console.log(`${model} response:`, JSON.stringify(data, null, 2));

      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((part: { inlineData?: { mimeType: string; data: string } }) =>
        part.inlineData?.mimeType?.startsWith('image/')
      );

      if (imagePart?.inlineData) {
        const mimeType = imagePart.inlineData.mimeType;
        const base64Data = imagePart.inlineData.data;

        // モデル名を分かりやすく表示
        const providerName = model === 'gemini-3-pro-image-preview'
          ? 'Nano Banana Pro (Gemini 3 Pro)'
          : model;

        return NextResponse.json({
          success: true,
          image: `data:${mimeType};base64,${base64Data}`,
          provider: providerName,
          model: model,
        });
      }

      // 画像が生成されなかった場合
      const textPart = parts.find((part: { text?: string }) => part.text);
      if (textPart?.text) {
        lastError = textPart.text;
        continue;
      }

    } catch (err) {
      console.error(`${model} error:`, err);
      lastError = err instanceof Error ? err.message : 'Unknown error';
      continue;
    }
  }

  // すべてのモデルで失敗した場合
  let suggestion = 'しばらく待ってから再度お試しください。';

  // エラーの種類に応じたアドバイス
  if (lastError.includes('billing') || lastError.includes('quota') || lastError.includes('API key')) {
    suggestion = 'Nano Banana Pro (Gemini 3 Pro Image Preview) は有料モデルです。Google AI Studio で課金設定を有効にしてください。';
  } else if (lastError.includes('overloaded') || lastError.includes('503')) {
    suggestion = 'モデルが過負荷です。しばらく待ってから再度お試しください。';
  } else if (lastError.includes('safety') || lastError.includes('blocked')) {
    suggestion = 'プロンプトが安全ポリシーに抵触した可能性があります。別の表現をお試しください。';
  }

  return NextResponse.json(
    {
      error: `画像生成に失敗しました: ${lastError}`,
      suggestion,
      alternatives: [
        { name: 'Google AI Studio', url: 'https://aistudio.google.com/' },
        { name: 'Ideogram', url: 'https://ideogram.ai/' },
        { name: 'Leonardo.ai', url: 'https://leonardo.ai/' },
      ]
    },
    { status: 503 }
  );
}

// 投稿改善提案
export async function PUT(request: NextRequest) {
  try {
    // 認証チェック
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, targetMetric, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI APIキーが設定されていません。設定画面でGemini APIキーを入力してください。' },
        { status: 400 }
      );
    }

    // プラン制限チェック（POSTと同じロジック）
    if (isDatabaseAvailable() && prisma) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (user && user.role !== 'ADMIN') {
        const plan = user.plan || 'free';
        const dailyLimit = AI_LIMITS[plan] || AI_LIMITS.free;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const resetDate = user.aiUsageResetDate ? new Date(user.aiUsageResetDate) : null;
        const needsReset = !resetDate || resetDate < today;
        const currentCount = needsReset ? 0 : (user.aiUsageCount || 0);

        if (currentCount >= dailyLimit) {
          return NextResponse.json(
            {
              error: `本日のAI生成回数の上限（${dailyLimit}回）に達しました。`,
              remaining: 0,
              limit: dailyLimit,
            },
            { status: 429 }
          );
        }

        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            aiUsageCount: needsReset ? 1 : currentCount + 1,
            aiUsageResetDate: today,
          },
        });
      }
    }

    const systemPrompt = `# あなたの役割
あなたはThreadsで10万人以上のフォロワーを持つSNSマーケティングの専門家です。
投稿の分析と改善提案を行います。

# 目標指標
${targetMetric === 'engagement' ? '【最適化目標】エンゲージメント（いいね・リプライ数）の最大化' : ''}
${targetMetric === 'reach' ? '【最適化目標】リーチ（閲覧数・インプレッション）の最大化' : ''}
${targetMetric === 'viral' ? '【最適化目標】バイラル性（リポスト・引用・シェア）の最大化' : ''}
${!targetMetric ? '【最適化目標】総合的なエンゲージメント向上' : ''}

# 分析観点
1. フック（冒頭）の強さ - 最初の1行で興味を引けているか
2. 感情トリガー - 共感・驚き・学びの要素があるか
3. CTA（行動喚起）- リプライやいいねを促す要素があるか
4. 読みやすさ - 改行・文の長さは適切か
5. ハッシュタグ - 適切なタグが使われているか

# 出力形式（厳守）

## 📊 現状分析
（この投稿の良い点と改善点を2-3行で）

## 💡 改善ポイント
- ポイント1
- ポイント2
- ポイント3

## ✨ 改善後の投稿文
（そのままコピペできる形式で出力。前置きや説明は不要）`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n# 改善対象の投稿\n${text}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
            topP: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Improvement failed');
    }

    const data = await response.json();
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error('AI improvement error:', error);
    return NextResponse.json(
      { error: '改善提案の生成に失敗しました' },
      { status: 500 }
    );
  }
}
