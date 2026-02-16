'use client';

import { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  text: string | null;
  type: string;
  usageCount: number;
  createdAt: string;
}

interface TemplateManagerProps {
  onSelectTemplate?: (template: Template) => void;
  maxTemplates?: number;
}

// プリセットカテゴリ
const CATEGORIES = [
  { id: 'general', name: '一般', icon: '📝' },
  { id: 'promotion', name: 'プロモーション', icon: '📢' },
  { id: 'question', name: '質問・アンケート', icon: '❓' },
  { id: 'announcement', name: 'お知らせ', icon: '📣' },
  { id: 'tips', name: 'Tips・ノウハウ', icon: '💡' },
  { id: 'greeting', name: '挨拶', icon: '👋' },
];

// プリセットテンプレート
const PRESET_TEMPLATES: Omit<Template, 'id' | 'usageCount' | 'createdAt'>[] = [
  {
    name: '朝の挨拶',
    description: '毎朝の挨拶用',
    category: 'greeting',
    text: 'おはようございます！\n\n今日も一日頑張りましょう 💪\n\n#おはよう #朝活',
    type: 'text',
  },
  {
    name: '質問テンプレート',
    description: 'フォロワーへの質問',
    category: 'question',
    text: '【質問】\n\n{{質問内容}}\n\nコメントで教えてください 👇',
    type: 'text',
  },
  {
    name: 'Tips共有',
    description: 'ノウハウ共有用',
    category: 'tips',
    text: '💡 今日のTips\n\n{{Tipsの内容}}\n\n参考になったら保存してね 📌',
    type: 'text',
  },
  {
    name: 'お知らせ',
    description: '告知・お知らせ用',
    category: 'announcement',
    text: '📣 お知らせ\n\n{{お知らせ内容}}\n\n詳細はプロフィールのリンクから！',
    type: 'text',
  },
];

export function TemplateManager({ onSelectTemplate, maxTemplates = -1 }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 編集用
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('general');
  const [templateText, setTemplateText] = useState('');
  const [saving, setSaving] = useState(false);

  // テンプレート読み込み（localStorage使用）
  useEffect(() => {
    const saved = localStorage.getItem('post_templates');
    if (saved) {
      setTemplates(JSON.parse(saved));
    } else {
      // 初回はプリセットを設定
      const initial = PRESET_TEMPLATES.map((t, i) => ({
        ...t,
        id: `preset-${i}`,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      }));
      setTemplates(initial);
      localStorage.setItem('post_templates', JSON.stringify(initial));
    }
    setLoading(false);
  }, []);

  // テンプレート保存
  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('post_templates', JSON.stringify(newTemplates));
  };

  // テンプレート追加/編集
  const handleSave = () => {
    if (!templateName.trim() || !templateText.trim()) return;

    if (maxTemplates !== -1 && templates.length >= maxTemplates && !editingTemplate) {
      alert(`テンプレートは最大${maxTemplates}件までです`);
      return;
    }

    setSaving(true);

    const newTemplate: Template = {
      id: editingTemplate?.id || `custom-${Date.now()}`,
      name: templateName,
      description: templateDesc || null,
      category: templateCategory,
      text: templateText,
      type: 'text',
      usageCount: editingTemplate?.usageCount || 0,
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
    };

    if (editingTemplate) {
      saveTemplates(templates.map(t => t.id === editingTemplate.id ? newTemplate : t));
    } else {
      saveTemplates([...templates, newTemplate]);
    }

    setShowEditor(false);
    setEditingTemplate(null);
    resetForm();
    setSaving(false);
  };

  // 削除
  const handleDelete = (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return;
    saveTemplates(templates.filter(t => t.id !== id));
  };

  // テンプレート変数を置換
  const replaceVariables = (text: string): string => {
    const now = new Date();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const replacements: Record<string, string> = {
      '日付': `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
      'date': `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`,
      '時刻': `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      'time': `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      '曜日': `${dayNames[now.getDay()]}曜日`,
      'day': `${dayNames[now.getDay()]}曜日`,
      '年': `${now.getFullYear()}`,
      'year': `${now.getFullYear()}`,
      '月': `${now.getMonth() + 1}`,
      'month': `${now.getMonth() + 1}`,
      '日': `${now.getDate()}`,
    };
    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  };

  // 使用
  const handleUse = (template: Template) => {
    // 使用回数を増やす
    saveTemplates(templates.map(t =>
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    ));

    if (onSelectTemplate) {
      // 変数を置換してからコールバック
      const resolvedTemplate = {
        ...template,
        text: template.text ? replaceVariables(template.text) : template.text,
      };
      onSelectTemplate(resolvedTemplate);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setTemplateName('');
    setTemplateDesc('');
    setTemplateCategory('general');
    setTemplateText('');
  };

  // 編集開始
  const startEdit = (template: Template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDesc(template.description || '');
    setTemplateCategory(template.category || 'general');
    setTemplateText(template.text || '');
    setShowEditor(true);
  };

  // フィルター
  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">投稿テンプレート</h2>
            <p className="text-sm text-slate-500 mt-1">
              よく使うフォーマットを保存して再利用できます
              {maxTemplates !== -1 && (
                <span className="ml-2 text-amber-600">
                  ({templates.length}/{maxTemplates}件)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingTemplate(null);
              setShowEditor(true);
            }}
            disabled={maxTemplates !== -1 && templates.length >= maxTemplates}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
          >
            + 新規テンプレート
          </button>
        </div>

        {/* カテゴリフィルター */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              selectedCategory === 'all'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            すべて
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                selectedCategory === cat.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* エディター */}
      {showEditor && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">
            {editingTemplate ? 'テンプレートを編集' : '新規テンプレート'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">テンプレート名 *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="例: 朝の挨拶"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">カテゴリ</label>
                <select
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">説明（任意）</label>
              <input
                type="text"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="このテンプレートの用途..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                テンプレート内容 *
              </label>
              <textarea
                value={templateText}
                onChange={(e) => setTemplateText(e.target.value)}
                placeholder="投稿テンプレートを入力..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none font-mono text-sm text-slate-900 placeholder-slate-400"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-slate-400 mr-1">自動変数:</span>
                {[
                  { tag: '{{日付}}', label: '日付' },
                  { tag: '{{時刻}}', label: '時刻' },
                  { tag: '{{曜日}}', label: '曜日' },
                  { tag: '{{年}}', label: '年' },
                  { tag: '{{月}}', label: '月' },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => setTemplateText(prev => prev + v.tag)}
                    className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !templateName.trim() || !templateText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* テンプレート一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-8 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500">テンプレートがありません</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-slate-900">{template.name}</h4>
                  {template.description && (
                    <p className="text-xs text-slate-500">{template.description}</p>
                  )}
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  {CATEGORIES.find(c => c.id === template.category)?.icon || '📝'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono">
                  {template.text}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  使用回数: {template.usageCount}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleUse(template)}
                    className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                  >
                    使用
                  </button>
                  <button
                    onClick={() => startEdit(template)}
                    className="p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
