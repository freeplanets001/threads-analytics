'use client';

import { useState } from 'react';
import Link from 'next/link';

type Section = 'intro' | 'setup' | 'token' | 'features' | 'plans' | 'faq';

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('intro');

  const sections: { id: Section; title: string }[] = [
    { id: 'intro', title: 'はじめに' },
    { id: 'setup', title: 'Threads API設定' },
    { id: 'token', title: 'トークン取得' },
    { id: 'features', title: '機能一覧' },
    { id: 'plans', title: '料金プラン' },
    { id: 'faq', title: 'よくある質問' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Threads Studio
          </Link>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <div className="sticky top-24 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 bg-white rounded-2xl border border-slate-200 p-8">
            {/* はじめに */}
            {activeSection === 'intro' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  Threads Studio へようこそ
                </h1>
                <p className="text-lg text-slate-600">
                  Threads Studio は、Meta社のThreadsアプリのための高機能な分析・投稿管理ツールです。
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-violet-50 rounded-xl">
                    <h3 className="font-semibold text-violet-900 mb-2">詳細な分析</h3>
                    <p className="text-sm text-violet-700">
                      閲覧数、エンゲージメント、フォロワー推移など、あらゆる指標を可視化
                    </p>
                  </div>
                  <div className="p-5 bg-cyan-50 rounded-xl">
                    <h3 className="font-semibold text-cyan-900 mb-2">投稿管理</h3>
                    <p className="text-sm text-cyan-700">
                      テキスト、画像、動画、カルーセル、スレッド投稿に対応
                    </p>
                  </div>
                  <div className="p-5 bg-emerald-50 rounded-xl">
                    <h3 className="font-semibold text-emerald-900 mb-2">AI支援</h3>
                    <p className="text-sm text-emerald-700">
                      AIによる投稿文生成、改善提案、画像生成機能
                    </p>
                  </div>
                  <div className="p-5 bg-amber-50 rounded-xl">
                    <h3 className="font-semibold text-amber-900 mb-2">予約投稿</h3>
                    <p className="text-sm text-amber-700">
                      最適な時間に自動投稿される予約機能（Pro以上）
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Threads API設定 */}
            {activeSection === 'setup' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  Threads API 設定ガイド
                </h1>
                <p className="text-slate-600">
                  Threads Studioを使用するには、Meta for Developersでアプリを作成し、
                  Threads APIのアクセス権限を取得する必要があります。
                </p>

                <div className="space-y-8">
                  {/* Step 1 */}
                  <div className="border-l-4 border-violet-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Step 1: Meta for Developersにアクセス
                    </h3>
                    <ol className="list-decimal ml-4 space-y-2 text-slate-600">
                      <li>
                        <a
                          href="https://developers.facebook.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 hover:underline"
                        >
                          developers.facebook.com
                        </a>
                        にアクセス
                      </li>
                      <li>Facebookアカウントでログイン（Meta社のサービスのため必須）</li>
                      <li>開発者として登録していない場合は「開始する」をクリック</li>
                    </ol>
                  </div>

                  {/* Step 2 */}
                  <div className="border-l-4 border-cyan-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Step 2: アプリを作成
                    </h3>
                    <ol className="list-decimal ml-4 space-y-2 text-slate-600">
                      <li>「マイアプリ」→「アプリを作成」をクリック</li>
                      <li>ユースケースで「その他」を選択</li>
                      <li>アプリタイプで「ビジネス」を選択</li>
                      <li>アプリ名を入力（例: 「My Threads Analytics」）</li>
                      <li>「アプリを作成」をクリック</li>
                    </ol>
                  </div>

                  {/* Step 3 */}
                  <div className="border-l-4 border-emerald-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Step 3: Threads APIを追加
                    </h3>
                    <ol className="list-decimal ml-4 space-y-2 text-slate-600">
                      <li>アプリダッシュボードで「製品を追加」をクリック</li>
                      <li>「Threads API」を見つけて「設定」をクリック</li>
                      <li>「スコープを追加」でアクセス権限を設定：
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                          <li><code className="bg-slate-100 px-1 rounded">threads_basic</code> - 基本情報の読み取り（必須）</li>
                          <li><code className="bg-slate-100 px-1 rounded">threads_content_publish</code> - 投稿機能（必須）</li>
                          <li><code className="bg-slate-100 px-1 rounded">threads_manage_insights</code> - インサイト取得（推奨）</li>
                          <li><code className="bg-slate-100 px-1 rounded">threads_manage_replies</code> - リプライ管理（推奨）</li>
                        </ul>
                      </li>
                    </ol>
                  </div>

                  {/* Step 4 */}
                  <div className="border-l-4 border-amber-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Step 4: Threadsアカウントを追加
                    </h3>
                    <ol className="list-decimal ml-4 space-y-2 text-slate-600">
                      <li>アプリの役割設定で「役割」→「Threadsテスター」をクリック</li>
                      <li>自分のThreadsアカウントのユーザー名を入力して追加</li>
                      <li>Threadsアプリで招待を承認</li>
                    </ol>
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>注意:</strong> 開発モードでは、テスターとして追加されたアカウントのみAPIを使用できます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* トークン取得 */}
            {activeSection === 'token' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  アクセストークンの取得方法
                </h1>

                <div className="space-y-8">
                  {/* Graph API Explorer */}
                  <div className="border-l-4 border-violet-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Graph API Explorerを使用
                    </h3>
                    <ol className="list-decimal ml-4 space-y-2 text-slate-600">
                      <li>
                        <a
                          href="https://developers.facebook.com/tools/explorer/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 hover:underline"
                        >
                          Graph API Explorer
                        </a>
                        にアクセス
                      </li>
                      <li>右上の「Meta App」で作成したアプリを選択</li>
                      <li>「ユーザーまたはページ」で「ユーザートークン」を選択</li>
                      <li>「権限を追加」で以下を選択：
                        <ul className="list-disc ml-4 mt-2">
                          <li>threads_basic</li>
                          <li>threads_content_publish</li>
                          <li>threads_manage_insights</li>
                          <li>threads_manage_replies</li>
                        </ul>
                      </li>
                      <li>「Generate Access Token」をクリック</li>
                      <li>Threadsへのアクセスを許可</li>
                    </ol>
                  </div>

                  {/* 長期トークン */}
                  <div className="border-l-4 border-emerald-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      長期トークンへの変換
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Graph API Explorerで取得したトークンは短期（1時間）です。
                      当サイトのトークン変換ツールを使って60日間有効な長期トークンに変換できます。
                    </p>
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <p className="text-sm text-emerald-800">
                        <strong>ヒント:</strong> ダッシュボードの「トークン変換ツール」で
                        短期トークンを貼り付けるだけで自動的に長期トークンに変換されます。
                      </p>
                    </div>
                  </div>

                  {/* トークンの注意事項 */}
                  <div className="border-l-4 border-red-500 pl-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      セキュリティ上の注意
                    </h3>
                    <ul className="list-disc ml-4 space-y-2 text-slate-600">
                      <li>アクセストークンは他人と共有しないでください</li>
                      <li>トークンが漏洩した場合はすぐにGraph API Explorerで無効化してください</li>
                      <li>当サービスではトークンは暗号化して安全に保存されます</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 機能一覧 */}
            {activeSection === 'features' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  機能一覧
                </h1>

                <div className="space-y-6">
                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3">分析機能</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>・ KPI指標（閲覧数、いいね、リプライ、リポスト、引用、シェア）</li>
                      <li>・ エンゲージメント率・バイラル係数の計算</li>
                      <li>・ 最適な投稿時間帯の分析</li>
                      <li>・ キーワード・ハッシュタグ分析</li>
                      <li>・ AIによるインサイト提案</li>
                      <li>・ 投稿ヒートマップ</li>
                      <li>・ ファン分析（誰がよくリプライしてくれるか）</li>
                    </ul>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3">投稿機能</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>・ テキスト投稿</li>
                      <li>・ 画像投稿（URL指定）</li>
                      <li>・ 動画投稿（URL指定）</li>
                      <li>・ カルーセル投稿（複数画像/動画）</li>
                      <li>・ スレッド投稿（複数投稿を連結）</li>
                      <li>・ 下書き保存</li>
                      <li>・ 予約投稿（Pro以上）</li>
                    </ul>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3">AI機能</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>・ 投稿文の自動生成</li>
                      <li>・ 投稿の改善提案</li>
                      <li>・ 画像の自動生成（Stable Diffusion）</li>
                    </ul>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-3">エクスポート</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>・ JSON形式でのエクスポート</li>
                      <li>・ CSV形式でのエクスポート（Excel対応）</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 料金プラン */}
            {activeSection === 'plans' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  料金プラン
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Free */}
                  <div className="p-6 border border-slate-200 rounded-xl">
                    <h3 className="text-xl font-bold text-slate-900">Free</h3>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      ¥0 <span className="text-sm font-normal text-slate-500">/月</span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        1アカウント連携
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        基本分析機能
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        下書き3件まで
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        投稿機能
                      </li>
                      <li className="flex items-center gap-2 text-slate-400">
                        <span>×</span>
                        予約投稿
                      </li>
                    </ul>
                  </div>

                  {/* Pro */}
                  <div className="p-6 border-2 border-violet-500 rounded-xl relative">
                    <div className="absolute -top-3 left-4 px-2 bg-violet-500 text-white text-xs font-semibold rounded">
                      人気
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Pro</h3>
                    <p className="text-3xl font-bold text-violet-600 mt-2">
                      ¥980 <span className="text-sm font-normal text-slate-500">/月</span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        3アカウント連携
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        全分析機能
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        下書き無制限
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        予約投稿10件/月
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        AI機能
                      </li>
                    </ul>
                  </div>

                  {/* Business */}
                  <div className="p-6 border border-slate-200 rounded-xl">
                    <h3 className="text-xl font-bold text-slate-900">Business</h3>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      ¥2,980 <span className="text-sm font-normal text-slate-500">/月</span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        無制限アカウント
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        全分析機能
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        下書き無制限
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        予約投稿無制限
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-500">✓</span>
                        優先サポート
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ */}
            {activeSection === 'faq' && (
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">
                  よくある質問
                </h1>

                <div className="space-y-4">
                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Q: Threadsアカウントの情報は安全ですか？
                    </h3>
                    <p className="text-slate-600">
                      A: はい。アクセストークンは暗号化して保存され、Meta社の公式APIを通じてのみアクセスします。
                      パスワードを直接保存することはありません。
                    </p>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Q: トークンの有効期限が切れたらどうすればいいですか？
                    </h3>
                    <p className="text-slate-600">
                      A: 長期トークンの有効期限は60日です。期限が近づいたら、
                      Graph API Explorerで新しいトークンを取得し、ダッシュボードで更新してください。
                    </p>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Q: 投稿の制限はありますか？
                    </h3>
                    <p className="text-slate-600">
                      A: Threads APIには24時間あたり250投稿の制限があります（Meta社の制限）。
                      当サービスでは投稿前に残り投稿数を確認できます。
                    </p>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Q: 複数のThreadsアカウントを管理できますか？
                    </h3>
                    <p className="text-slate-600">
                      A: はい。Freeプランでは1アカウント、Proプランでは3アカウント、
                      Businessプランでは無制限のアカウントを連携できます。
                    </p>
                  </div>

                  <div className="p-5 border border-slate-200 rounded-xl">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      Q: AI機能の利用にコストはかかりますか？
                    </h3>
                    <p className="text-slate-600">
                      A: Proプラン以上に含まれています。追加料金なしでAIによる投稿生成や
                      改善提案を利用できます。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
