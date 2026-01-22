'use client';

import { useState, useEffect } from 'react';

interface HashtagSuggesterProps {
  text: string;
  onInsert?: (hashtag: string) => void;
  pastHashtags?: Array<{ tag: string; avgEngagement: number; count: number }>;
}

// 日本語のトピック別ハッシュタグ辞書
const HASHTAG_DICTIONARY: Record<string, string[]> = {
  // テクノロジー
  'プログラミング': ['#プログラミング', '#エンジニア', '#開発', '#コード', '#tech'],
  'AI': ['#AI', '#人工知能', '#ChatGPT', '#機械学習', '#DeepLearning'],
  'Web': ['#Web開発', '#フロントエンド', '#バックエンド', '#JavaScript', '#React'],
  'アプリ': ['#アプリ開発', '#モバイルアプリ', '#iOS', '#Android', '#スマホアプリ'],

  // ビジネス
  'ビジネス': ['#ビジネス', '#仕事', '#キャリア', '#働き方', '#副業'],
  'マーケティング': ['#マーケティング', '#SNSマーケティング', '#集客', '#ブランディング'],
  '起業': ['#起業', '#スタートアップ', '#経営', '#独立', '#フリーランス'],
  '投資': ['#投資', '#資産運用', '#株式投資', '#NISA', '#お金'],

  // ライフスタイル
  '朝活': ['#朝活', '#早起き', '#モーニングルーティン', '#朝時間'],
  '習慣': ['#習慣', '#継続', '#毎日コツコツ', '#ルーティン'],
  '健康': ['#健康', '#ヘルシー', '#運動', '#筋トレ', '#ダイエット'],
  '読書': ['#読書', '#本', '#読書記録', '#おすすめ本', '#ビジネス書'],

  // クリエイティブ
  'デザイン': ['#デザイン', '#UI', '#UX', '#グラフィック', '#Figma'],
  '写真': ['#写真', '#カメラ', '#photography', '#ファインダー越しの私の世界'],
  '音楽': ['#音楽', '#music', '#作曲', '#DTM'],

  // SNS
  'Threads': ['#Threads', '#スレッズ', '#threads日記'],
  'SNS': ['#SNS', '#SNS運用', '#フォロバ', '#相互フォロー'],
};

// テキストからキーワードを抽出
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // 辞書のキーワードをチェック
  Object.keys(HASHTAG_DICTIONARY).forEach(keyword => {
    if (text.includes(keyword) || text.toLowerCase().includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });

  // 追加のキーワード検出
  const additionalPatterns = [
    { pattern: /プログラ|コード|開発|エンジニア/i, keyword: 'プログラミング' },
    { pattern: /AI|人工知能|ChatGPT|Claude/i, keyword: 'AI' },
    { pattern: /朝|おはよう|早起き/i, keyword: '朝活' },
    { pattern: /読んだ|本|書籍/i, keyword: '読書' },
    { pattern: /運動|筋トレ|ジム|走/i, keyword: '健康' },
    { pattern: /デザイン|UI|UX|figma/i, keyword: 'デザイン' },
    { pattern: /ビジネス|仕事|会社|働/i, keyword: 'ビジネス' },
    { pattern: /副業|稼|収入|フリーランス/i, keyword: '起業' },
    { pattern: /継続|毎日|習慣|ルーティン/i, keyword: '習慣' },
    { pattern: /threads|スレッズ/i, keyword: 'Threads' },
  ];

  additionalPatterns.forEach(({ pattern, keyword }) => {
    if (pattern.test(text) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  return keywords;
}

export function HashtagSuggester({ text, onInsert, pastHashtags = [] }: HashtagSuggesterProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // テキストが変更されたら提案を更新
  useEffect(() => {
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    // キーワードを抽出
    const keywords = extractKeywords(text);

    // ハッシュタグを収集
    const hashtagSet = new Set<string>();

    // 辞書からハッシュタグを追加
    keywords.forEach(keyword => {
      const tags = HASHTAG_DICTIONARY[keyword];
      if (tags) {
        tags.slice(0, 3).forEach(tag => hashtagSet.add(tag));
      }
    });

    // 過去の高パフォーマンスハッシュタグも追加
    if (pastHashtags.length > 0) {
      const topPastTags = pastHashtags
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 3);
      topPastTags.forEach(t => {
        if (!t.tag.startsWith('#')) {
          hashtagSet.add('#' + t.tag);
        } else {
          hashtagSet.add(t.tag);
        }
      });
    }

    // テキスト内の既存ハッシュタグを除外
    const existingTags = text.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g) || [];
    existingTags.forEach(tag => hashtagSet.delete(tag));

    setSuggestions(Array.from(hashtagSet).slice(0, 10));
    setLoading(false);
  }, [text, pastHashtags]);

  // 既存のハッシュタグをテキストから抽出
  const existingTags = text.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g) || [];

  if (!text.trim()) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        おすすめハッシュタグ
      </h4>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          分析中...
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-slate-500">テキストを入力するとハッシュタグを提案します</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((tag, i) => (
              <button
                key={i}
                onClick={() => onInsert?.(tag)}
                className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {existingTags.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 mb-2">現在のハッシュタグ ({existingTags.length}件)</p>
              <div className="flex flex-wrap gap-1">
                {existingTags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {pastHashtags.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 mb-2">あなたの高パフォーマンスタグ</p>
          <div className="flex flex-wrap gap-2">
            {pastHashtags.slice(0, 5).map((t, i) => (
              <button
                key={i}
                onClick={() => onInsert?.(t.tag.startsWith('#') ? t.tag : '#' + t.tag)}
                className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs hover:bg-emerald-100"
              >
                {t.tag.startsWith('#') ? t.tag : '#' + t.tag}
                <span className="ml-1 text-emerald-500">({t.count}回使用)</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ハッシュタグをテキストに追加するユーティリティ
export function appendHashtag(currentText: string, hashtag: string): string {
  const trimmed = currentText.trim();
  if (trimmed.includes(hashtag)) {
    return currentText;
  }
  return trimmed + (trimmed ? ' ' : '') + hashtag;
}
