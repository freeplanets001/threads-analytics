'use client';

import { useState, useEffect, useCallback } from 'react';

interface ABTestManagerProps {
  accountId: string;
  accessToken: string;
  onRefresh?: () => void;
}

interface ABTest {
  id: string;
  name: string;
  variantA: { text: string; scheduledPostId?: string; status: string; postedId?: string };
  variantB: { text: string; scheduledPostId?: string; status: string; postedId?: string };
  createdAt: string;
  resultA?: PostResult;
  resultB?: PostResult;
}

interface PostResult {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
}

export function ABTestManager({ accountId, accessToken, onRefresh }: ABTestManagerProps) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [testName, setTestName] = useState('');
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTimeA, setScheduleTimeA] = useState('');
  const [scheduleTimeB, setScheduleTimeB] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // localStorage から読み込み
  useEffect(() => {
    const saved = localStorage.getItem(`ab_tests_${accountId}`);
    if (saved) {
      try { setTests(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [accountId]);

  const saveTests = (newTests: ABTest[]) => {
    setTests(newTests);
    localStorage.setItem(`ab_tests_${accountId}`, JSON.stringify(newTests));
  };

  // A/Bテスト作成: 2つの予約投稿を作成
  const createTest = async () => {
    if (!testName.trim() || !textA.trim() || !textB.trim() || !scheduleDate || !scheduleTimeA || !scheduleTimeB) return;

    setCreating(true);
    setError(null);

    try {
      const scheduledAtA = new Date(`${scheduleDate}T${scheduleTimeA}`);
      const scheduledAtB = new Date(`${scheduleDate}T${scheduleTimeB}`);
      const now = new Date();

      if (scheduledAtA <= now || scheduledAtB <= now) {
        setError('未来の日時を指定してください');
        setCreating(false);
        return;
      }

      // Variant A を予約
      const resA = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          type: 'text',
          text: `[A/B: ${testName} - A] ${textA}`,
          scheduledAt: scheduledAtA.toISOString(),
        }),
      });

      if (!resA.ok) {
        const data = await resA.json();
        setError(`Variant A: ${data.error}`);
        setCreating(false);
        return;
      }

      const dataA = await resA.json();

      // Variant B を予約
      const resB = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          type: 'text',
          text: `[A/B: ${testName} - B] ${textB}`,
          scheduledAt: scheduledAtB.toISOString(),
        }),
      });

      if (!resB.ok) {
        const data = await resB.json();
        setError(`Variant B: ${data.error}`);
        setCreating(false);
        return;
      }

      const dataB = await resB.json();

      const newTest: ABTest = {
        id: `ab-${Date.now()}`,
        name: testName,
        variantA: {
          text: textA,
          scheduledPostId: dataA.post?.id,
          status: 'pending',
        },
        variantB: {
          text: textB,
          scheduledPostId: dataB.post?.id,
          status: 'pending',
        },
        createdAt: new Date().toISOString(),
      };

      saveTests([newTest, ...tests]);
      setShowCreator(false);
      setTestName('');
      setTextA('');
      setTextB('');
      setScheduleDate('');
      setScheduleTimeA('');
      setScheduleTimeB('');
      onRefresh?.();
    } catch {
      setError('テスト作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  // 投稿結果を取得
  const fetchResults = useCallback(async () => {
    if (!accessToken) return;
    setLoadingResults(true);

    try {
      const res = await fetch(`/api/threads/me?token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) { setLoadingResults(false); return; }
      const data = await res.json();
      const threads = data.threads?.data || [];

      const updatedTests = tests.map(test => {
        const updated = { ...test };

        // Variant A の結果を検索
        if (test.variantA.scheduledPostId) {
          // postedId を予約投稿から取得するため、投稿テキストで検索
          const matchA = threads.find((t: { text?: string }) =>
            t.text?.includes(`[A/B: ${test.name} - A]`)
          );
          if (matchA) {
            updated.variantA = { ...updated.variantA, status: 'completed', postedId: matchA.id };
            updated.resultA = matchA.insights || { views: 0, likes: 0, replies: 0, reposts: 0 };
          }
        }

        // Variant B の結果を検索
        if (test.variantB.scheduledPostId) {
          const matchB = threads.find((t: { text?: string }) =>
            t.text?.includes(`[A/B: ${test.name} - B]`)
          );
          if (matchB) {
            updated.variantB = { ...updated.variantB, status: 'completed', postedId: matchB.id };
            updated.resultB = matchB.insights || { views: 0, likes: 0, replies: 0, reposts: 0 };
          }
        }

        return updated;
      });

      saveTests(updatedTests);
    } catch {
      console.error('Failed to fetch AB test results');
    } finally {
      setLoadingResults(false);
    }
  }, [accessToken, tests]);

  const deleteTest = (id: string) => {
    saveTests(tests.filter(t => t.id !== id));
  };

  const getWinner = (test: ABTest): 'A' | 'B' | 'tie' | null => {
    if (!test.resultA || !test.resultB) return null;
    const scoreA = test.resultA.views + test.resultA.likes * 5 + test.resultA.replies * 3 + test.resultA.reposts * 4;
    const scoreB = test.resultB.views + test.resultB.likes * 5 + test.resultB.replies * 3 + test.resultB.reposts * 4;
    if (scoreA > scoreB * 1.05) return 'A';
    if (scoreB > scoreA * 1.05) return 'B';
    return 'tie';
  };

  const MetricBar = ({ label, valueA, valueB }: { label: string; valueA: number; valueB: number }) => {
    const max = Math.max(valueA, valueB, 1);
    return (
      <div className="space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 w-10 text-right">{valueA}</span>
          <div className="flex-1 flex gap-0.5">
            <div className="h-3 bg-blue-400 rounded-l" style={{ width: `${(valueA / max) * 100}%` }} />
            <div className="h-3 bg-orange-400 rounded-r" style={{ width: `${(valueB / max) * 100}%` }} />
          </div>
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400 w-10">{valueB}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">A/Bテスト</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              2つのバリエーションを投稿し、パフォーマンスを比較します
            </p>
          </div>
          <div className="flex gap-2">
            {tests.some(t => t.variantA.status === 'pending' || t.variantB.status === 'pending' || (!t.resultA && t.variantA.postedId)) && (
              <button
                onClick={fetchResults}
                disabled={loadingResults}
                className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {loadingResults ? '取得中...' : '結果を更新'}
              </button>
            )}
            <button
              onClick={() => setShowCreator(!showCreator)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              + 新規テスト
            </button>
          </div>
        </div>
      </div>

      {/* テスト作成フォーム */}
      {showCreator && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">新規A/Bテスト</h3>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">{error}</p>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">テスト名</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="例: CTA比較テスト"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="inline-block w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs text-center leading-5 mr-1">A</span>
                  <span className="text-slate-600 dark:text-slate-300">バリアント A</span>
                </label>
                <textarea
                  value={textA}
                  onChange={(e) => setTextA(e.target.value)}
                  placeholder="バリアントAのテキスト..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg h-28 resize-none text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  <span className="inline-block w-5 h-5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs text-center leading-5 mr-1">B</span>
                  <span className="text-slate-600 dark:text-slate-300">バリアント B</span>
                </label>
                <textarea
                  value={textB}
                  onChange={(e) => setTextB(e.target.value)}
                  placeholder="バリアントBのテキスト..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg h-28 resize-none text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">投稿日</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">A の投稿時間</label>
                <input
                  type="time"
                  value={scheduleTimeA}
                  onChange={(e) => setScheduleTimeA(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">B の投稿時間</label>
                <input
                  type="time"
                  value={scheduleTimeB}
                  onChange={(e) => setScheduleTimeB(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              比較を公正にするため、同じ日の近い時間帯（1〜2時間差）に設定することをお勧めします
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreator(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={createTest}
                disabled={creating || !testName.trim() || !textA.trim() || !textB.trim() || !scheduleDate || !scheduleTimeA || !scheduleTimeB}
                className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? '作成中...' : 'テストを作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* テスト一覧 */}
      {tests.length > 0 ? (
        <div className="space-y-4">
          {tests.map(test => {
            const winner = getWinner(test);
            return (
              <div key={test.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{test.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      作成日: {new Date(test.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {winner === 'A' && <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">A 勝利</span>}
                    {winner === 'B' && <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full font-medium">B 勝利</span>}
                    {winner === 'tie' && <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-medium">引き分け</span>}
                    {!winner && <span className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">結果待ち</span>}
                    <button onClick={() => deleteTest(test.id)} className="text-slate-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                  {/* Variant A */}
                  <div className={`p-4 ${winner === 'A' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-bold flex items-center justify-center">A</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        test.variantA.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {test.variantA.status === 'completed' ? '投稿済み' : '待機中'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap line-clamp-3 mb-3">{test.variantA.text}</p>
                    {test.resultA && (
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultA.views}</p>
                          <p className="text-xs text-slate-500">閲覧</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultA.likes}</p>
                          <p className="text-xs text-slate-500">いいね</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultA.replies}</p>
                          <p className="text-xs text-slate-500">リプライ</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultA.reposts}</p>
                          <p className="text-xs text-slate-500">リポスト</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Variant B */}
                  <div className={`p-4 ${winner === 'B' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-bold flex items-center justify-center">B</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        test.variantB.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {test.variantB.status === 'completed' ? '投稿済み' : '待機中'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap line-clamp-3 mb-3">{test.variantB.text}</p>
                    {test.resultB && (
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultB.views}</p>
                          <p className="text-xs text-slate-500">閲覧</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultB.likes}</p>
                          <p className="text-xs text-slate-500">いいね</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultB.replies}</p>
                          <p className="text-xs text-slate-500">リプライ</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{test.resultB.reposts}</p>
                          <p className="text-xs text-slate-500">リポスト</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 比較バー（両方の結果がある場合） */}
                {test.resultA && test.resultB && (
                  <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-4 text-xs mb-2">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> A</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded" /> B</span>
                    </div>
                    <MetricBar label="閲覧数" valueA={test.resultA.views} valueB={test.resultB.views} />
                    <MetricBar label="いいね" valueA={test.resultA.likes} valueB={test.resultB.likes} />
                    <MetricBar label="リプライ" valueA={test.resultA.replies} valueB={test.resultB.replies} />
                    <MetricBar label="リポスト" valueA={test.resultA.reposts} valueB={test.resultB.reposts} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showCreator ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 mb-2">A/Bテストがありません</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">「新規テスト」ボタンからテストを作成してください</p>
        </div>
      ) : null}
    </div>
  );
}
