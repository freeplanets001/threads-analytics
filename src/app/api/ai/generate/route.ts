import { NextRequest, NextResponse } from 'next/server';

// テキスト生成（OpenAI互換API - Groqも対応）
export async function POST(request: NextRequest) {
  try {
    const { type, prompt, options } = await request.json();

    if (type === 'text') {
      return generateText(prompt, options);
    } else if (type === 'image') {
      return generateImage(prompt, options);
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

async function generateText(prompt: string, options?: { tone?: string; length?: string }) {
  // Groq API（無料で高速）を優先、なければOpenAIを使用
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const apiUrl = process.env.GROQ_API_KEY
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = process.env.GROQ_API_KEY ? 'llama-3.1-70b-versatile' : 'gpt-3.5-turbo';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI APIキーが設定されていません' },
      { status: 500 }
    );
  }

  const systemPrompt = `あなたはThreadsの投稿を作成するアシスタントです。
以下のルールに従って投稿文を生成してください：
- 500文字以内（Threadsの制限）
- 絵文字を適度に使用
- 読みやすく、エンゲージメントを高める文体
- ハッシュタグは最大5個まで
${options?.tone ? `- トーン: ${options.tone}` : ''}
${options?.length === 'short' ? '- 100文字以内の短い投稿' : ''}
${options?.length === 'long' ? '- 300-500文字の長めの投稿' : ''}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Text generation failed');
  }

  const data = await response.json();
  const generatedText = data.choices[0]?.message?.content || '';

  return NextResponse.json({
    success: true,
    text: generatedText.trim(),
    model,
  });
}

async function generateImage(prompt: string, options?: { style?: string; size?: string }) {
  // Hugging Face API（無料）を優先
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (hfApiKey) {
    // Hugging Face Stable Diffusion
    const response = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: 'blurry, bad quality, distorted',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Image generation failed');
    }

    // Hugging Faceは画像バイナリを返す
    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
      provider: 'huggingface',
    });
  } else if (openaiApiKey) {
    // OpenAI DALL-E（有料だが高品質）
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: options?.size || '1024x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Image generation failed');
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;

    return NextResponse.json({
      success: true,
      imageUrl,
      provider: 'openai',
    });
  } else {
    return NextResponse.json(
      { error: '画像生成APIキーが設定されていません' },
      { status: 500 }
    );
  }
}

// 投稿改善提案
export async function PUT(request: NextRequest) {
  try {
    const { text, targetMetric } = await request.json();

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    const apiUrl = process.env.GROQ_API_KEY
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = process.env.GROQ_API_KEY ? 'llama-3.1-70b-versatile' : 'gpt-3.5-turbo';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI APIキーが設定されていません' },
        { status: 500 }
      );
    }

    const systemPrompt = `あなたはSNSマーケティングの専門家です。
与えられたThreadsの投稿文を分析し、改善提案を行ってください。
${targetMetric === 'engagement' ? 'エンゲージメント（いいね、リプライ）を最大化することを目指してください。' : ''}
${targetMetric === 'reach' ? 'リーチ（閲覧数）を最大化することを目指してください。' : ''}
${targetMetric === 'viral' ? 'バイラル性（リポスト、引用）を最大化することを目指してください。' : ''}

以下の形式で回答してください：
1. 現状の分析
2. 改善点
3. 改善後の投稿文`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下の投稿を改善してください：\n\n${text}` },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Improvement failed');
    }

    const data = await response.json();
    const suggestion = data.choices[0]?.message?.content || '';

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
