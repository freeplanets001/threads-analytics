'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// 投稿時間帯別パフォーマンスチャート
export function PostingHoursChart({
  data,
}: {
  data: Array<{ hour: number; avgEngagement: number }>;
}) {
  const chartData = Array.from({ length: 24 }, (_, i) => {
    const found = data.find((d) => d.hour === i);
    return {
      hour: `${i}時`,
      engagement: found?.avgEngagement || 0,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        時間帯別エンゲージメント
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10 }}
              interval={2}
              stroke="#94a3b8"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="engagement" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 曜日別パフォーマンスチャート
export function PostingDaysChart({
  data,
}: {
  data: Array<{ day: string; avgEngagement: number }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        曜日別エンゲージメント
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis
              dataKey="day"
              type="category"
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="avgEngagement" fill="#06b6d4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// テキスト長さ相関チャート
export function TextLengthChart({
  data,
}: {
  data: Array<{ range: string; avgEngagement: number; count: number }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        文字数とエンゲージメントの相関
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value) => [
                typeof value === 'number' ? value.toFixed(1) : String(value),
                '平均エンゲージメント',
              ]}
            />
            <Bar
              dataKey="avgEngagement"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              name="平均エンゲージメント"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        ※ 文字数（横軸）と平均エンゲージメント（縦軸）
      </p>
    </div>
  );
}

// エンゲージメント内訳パイチャート
export function EngagementPieChart({
  likes,
  replies,
  reposts,
  quotes,
  shares,
}: {
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}) {
  const data = [
    { name: 'いいね', value: likes },
    { name: 'リプライ', value: replies },
    { name: 'リポスト', value: reposts },
    { name: '引用', value: quotes },
    { name: 'シェア', value: shares },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        エンゲージメント内訳
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent || 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// メディアタイプ別パフォーマンス
export function MediaTypeChart({
  data,
}: {
  data: Array<{ type: string; avgEngagement: number; count: number }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        投稿タイプ別パフォーマンス
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="type" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            />
            <Bar
              dataKey="avgEngagement"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              name="平均エンゲージメント"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 競合比較レーダーチャート
export function CompetitorRadarChart({
  myData,
  competitorData,
  myName,
  competitorName,
}: {
  myData: {
    avgLikes: number;
    avgReplies: number;
    avgReposts: number;
    postFrequency: number;
    textLength: number;
  };
  competitorData: {
    avgLikes: number;
    avgReplies: number;
    avgReposts: number;
    postFrequency: number;
    textLength: number;
  };
  myName: string;
  competitorName: string;
}) {
  // 正規化（最大値を100とする）
  const maxValues = {
    avgLikes: Math.max(myData.avgLikes, competitorData.avgLikes) || 1,
    avgReplies: Math.max(myData.avgReplies, competitorData.avgReplies) || 1,
    avgReposts: Math.max(myData.avgReposts, competitorData.avgReposts) || 1,
    postFrequency:
      Math.max(myData.postFrequency, competitorData.postFrequency) || 1,
    textLength: Math.max(myData.textLength, competitorData.textLength) || 1,
  };

  const data = [
    {
      metric: '平均いいね',
      [myName]: (myData.avgLikes / maxValues.avgLikes) * 100,
      [competitorName]: (competitorData.avgLikes / maxValues.avgLikes) * 100,
    },
    {
      metric: '平均リプライ',
      [myName]: (myData.avgReplies / maxValues.avgReplies) * 100,
      [competitorName]:
        (competitorData.avgReplies / maxValues.avgReplies) * 100,
    },
    {
      metric: '平均リポスト',
      [myName]: (myData.avgReposts / maxValues.avgReposts) * 100,
      [competitorName]:
        (competitorData.avgReposts / maxValues.avgReposts) * 100,
    },
    {
      metric: '投稿頻度',
      [myName]: (myData.postFrequency / maxValues.postFrequency) * 100,
      [competitorName]:
        (competitorData.postFrequency / maxValues.postFrequency) * 100,
    },
    {
      metric: '文字数',
      [myName]: (myData.textLength / maxValues.textLength) * 100,
      [competitorName]:
        (competitorData.textLength / maxValues.textLength) * 100,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">競合比較</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 11 }}
              stroke="#64748b"
            />
            <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Radar
              name={myName}
              dataKey={myName}
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.3}
            />
            <Radar
              name={competitorName}
              dataKey={competitorName}
              stroke="#06b6d4"
              fill="#06b6d4"
              fillOpacity={0.3}
            />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// バイラル指標ゲージ
export function ViralMetricsCard({
  viralCoefficient,
  shareRate,
  replyRate,
}: {
  viralCoefficient: number;
  shareRate: number;
  replyRate: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">バイラル指標</h3>
      <div className="space-y-4">
        <MetricBar
          label="バイラル係数"
          value={viralCoefficient}
          max={5}
          color="#8b5cf6"
          description="(リポスト+引用)/閲覧数"
        />
        <MetricBar
          label="シェア率"
          value={shareRate}
          max={5}
          color="#06b6d4"
          description="シェア数/閲覧数"
        />
        <MetricBar
          label="リプライ率"
          value={replyRate}
          max={10}
          color="#10b981"
          description="リプライ数/閲覧数"
        />
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
  description,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  description: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>
          {value.toFixed(2)}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{description}</p>
    </div>
  );
}

// 絵文字・引用投稿比較
export function ContentStrategyChart({
  emojiImpact,
  quotePerformance,
}: {
  emojiImpact: { withEmoji: number; withoutEmoji: number };
  quotePerformance: { quote: number; original: number };
}) {
  const emojiData = [
    { name: '絵文字あり', value: emojiImpact.withEmoji },
    { name: '絵文字なし', value: emojiImpact.withoutEmoji },
  ];

  const quoteData = [
    { name: '引用投稿', value: quotePerformance.quote },
    { name: 'オリジナル', value: quotePerformance.original },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        コンテンツ戦略分析
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-2 text-center">絵文字の効果</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emojiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2 text-center">
            引用投稿の効果
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quoteData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// 時間帯×曜日ヒートマップ
export function PostingHeatmap({
  data,
}: {
  data: Array<{ day: number; hour: number; value: number; count: number }>;
}) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return 'bg-slate-100';
    if (intensity < 0.25) return 'bg-violet-100';
    if (intensity < 0.5) return 'bg-violet-200';
    if (intensity < 0.75) return 'bg-violet-400';
    return 'bg-violet-600';
  };

  const getTextColor = (value: number) => {
    const intensity = value / maxValue;
    return intensity >= 0.5 ? 'text-white' : 'text-slate-600';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        投稿時間ヒートマップ（曜日×時間帯）
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* ヘッダー（時間） */}
          <div className="flex">
            <div className="w-8" />
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 text-center text-xs text-slate-400 pb-1"
              >
                {i % 3 === 0 ? `${i}` : ''}
              </div>
            ))}
          </div>
          {/* 各曜日 */}
          {days.map((day, dayIndex) => (
            <div key={day} className="flex">
              <div className="w-8 text-xs text-slate-500 flex items-center">
                {day}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = data.find(
                  (d) => d.day === dayIndex && d.hour === hour
                );
                const value = cell?.value || 0;
                const count = cell?.count || 0;
                return (
                  <div
                    key={hour}
                    className={`flex-1 h-6 ${getColor(value)} border border-white rounded-sm flex items-center justify-center cursor-default transition-transform hover:scale-110`}
                    title={`${day}曜 ${hour}時: ${value.toFixed(1)} (${count}件)`}
                  >
                    {count > 0 && (
                      <span className={`text-[8px] font-medium ${getTextColor(value)}`}>
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* 凡例 */}
          <div className="flex items-center justify-end mt-3 gap-2 text-xs text-slate-500">
            <span>低</span>
            <div className="flex gap-0.5">
              <div className="w-4 h-4 bg-slate-100 rounded" />
              <div className="w-4 h-4 bg-violet-100 rounded" />
              <div className="w-4 h-4 bg-violet-200 rounded" />
              <div className="w-4 h-4 bg-violet-400 rounded" />
              <div className="w-4 h-4 bg-violet-600 rounded" />
            </div>
            <span>高</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 日別トレンドチャート
export function DailyTrendChart({
  data,
}: {
  data: Array<{ date: string; posts: number; engagement: number; views: number }>;
}) {
  const chartData = data.slice(-30).map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD形式に
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        日別エンゲージメント推移（直近30日）
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="#94a3b8"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="engagement"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="エンゲージメント"
            />
            <Line
              type="monotone"
              dataKey="posts"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              name="投稿数"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ハッシュタグパフォーマンス
export function HashtagChart({
  data,
}: {
  data: Array<{ hashtag: string; count: number; avgEngagement: number }>;
}) {
  const topHashtags = data.slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        ハッシュタグパフォーマンス TOP10
      </h3>
      {topHashtags.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topHashtags} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis
                dataKey="hashtag"
                type="category"
                tick={{ fontSize: 10 }}
                stroke="#94a3b8"
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => [
                  typeof value === 'number' ? value.toFixed(1) : String(value),
                  '平均エンゲージメント',
                ]}
              />
              <Bar
                dataKey="avgEngagement"
                fill="#ec4899"
                radius={[0, 4, 4, 0]}
                name="平均エンゲージメント"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center py-8">
          ハッシュタグが見つかりませんでした
        </p>
      )}
    </div>
  );
}

// キーワードクラウド風表示
export function KeywordList({
  data,
}: {
  data: Array<{ keyword: string; count: number; avgEngagement: number }>;
}) {
  const topKeywords = data.slice(0, 20);
  const maxEngagement = Math.max(...topKeywords.map((k) => k.avgEngagement), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        高エンゲージメントキーワード TOP20
      </h3>
      {topKeywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topKeywords.map((kw, i) => {
            const intensity = kw.avgEngagement / maxEngagement;
            const bgClass =
              intensity > 0.7
                ? 'bg-violet-500 text-white'
                : intensity > 0.4
                  ? 'bg-violet-200 text-violet-800'
                  : 'bg-slate-100 text-slate-600';
            return (
              <span
                key={i}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${bgClass} cursor-default`}
                title={`出現: ${kw.count}回 / 平均エンゲージメント: ${kw.avgEngagement.toFixed(1)}`}
              >
                {kw.keyword}
                <span className="ml-1 opacity-70 text-xs">({kw.count})</span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center py-8">
          キーワードデータがありません
        </p>
      )}
    </div>
  );
}

// AIインサイトカード
export function AIInsightsPanel({
  insights,
}: {
  insights: Array<{
    type: 'success' | 'warning' | 'tip' | 'insight';
    title: string;
    description: string;
  }>;
}) {
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'tip':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'insight':
        return 'bg-violet-50 border-violet-200 text-violet-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '!';
      case 'tip':
        return '★';
      case 'insight':
        return '◆';
      default:
        return '•';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="text-lg">🤖</span>
        AIインサイト
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg border ${getTypeStyles(insight.type)}`}
          >
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getIcon(insight.type)}
              </span>
              <div>
                <h4 className="font-semibold text-sm">{insight.title}</h4>
                <p className="text-sm mt-1 opacity-90">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
