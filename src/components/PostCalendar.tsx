'use client';

import { useState, useMemo } from 'react';

interface Post {
  id: string;
  text?: string;
  timestamp: string;
  insights?: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
  };
}

interface ScheduledPost {
  id: string;
  text: string;
  scheduledAt: string;
  status: 'pending' | 'posted' | 'failed';
}

interface PostCalendarProps {
  posts: Post[];
  scheduledPosts?: ScheduledPost[];
  onPostClick?: (post: Post) => void;
  onScheduledClick?: (post: ScheduledPost) => void;
}

const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function PostCalendar({ posts, scheduledPosts = [], onPostClick, onScheduledClick }: PostCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 月の日数と最初の曜日を計算
  const { daysInMonth, firstDayOfWeek, calendarDays } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    // カレンダーの日を生成
    const days: (number | null)[] = [];

    // 前月の空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // 今月の日
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return { daysInMonth, firstDayOfWeek, calendarDays: days };
  }, [year, month]);

  // 日ごとの投稿をマッピング
  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    posts.forEach(post => {
      const date = new Date(post.timestamp);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const key = date.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    });
    return map;
  }, [posts, year, month]);

  // 日ごとの予約投稿をマッピング
  const scheduledByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    scheduledPosts.forEach(post => {
      const date = new Date(post.scheduledAt);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const key = date.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    });
    return map;
  }, [scheduledPosts, year, month]);

  // 前月/次月へ移動
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // 選択された日の投稿を取得
  const selectedDayPosts = selectedDate ? postsByDate[selectedDate] || [] : [];
  const selectedDayScheduled = selectedDate ? scheduledByDate[selectedDate] || [] : [];

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white min-w-[120px] text-center">
              {year}年 {MONTHS[month]}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg"
          >
            今日
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-sm font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayPosts = day ? postsByDate[day.toString()] : undefined;
            const dayScheduled = day ? scheduledByDate[day.toString()] : undefined;
            const isSelected = selectedDate === day?.toString();
            const dayOfWeek = i % 7;

            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(day.toString())}
                className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 border-r border-b border-slate-200 dark:border-slate-700 last:border-r-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  isSelected ? 'bg-violet-50 dark:bg-violet-900/30' : ''
                } ${!day ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
              >
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-1 ${
                      isToday(day)
                        ? 'w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center'
                        : dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayPosts && dayPosts.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-violet-500 rounded-full" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
                            {dayPosts.length}件投稿
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 md:hidden">
                            {dayPosts.length}
                          </span>
                        </div>
                      )}
                      {dayScheduled && dayScheduled.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-amber-500 rounded-full" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
                            {dayScheduled.length}件予約
                          </span>
                          <span className="text-xs text-amber-500 md:hidden">
                            {dayScheduled.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択された日の詳細 */}
      {selectedDate && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            {month + 1}月{selectedDate}日の投稿
          </h3>

          {selectedDayPosts.length === 0 && selectedDayScheduled.length === 0 ? (
            <p className="text-sm text-slate-500">この日の投稿はありません</p>
          ) : (
            <div className="space-y-4">
              {/* 投稿済み */}
              {selectedDayPosts.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-violet-500 rounded-full" />
                    投稿済み ({selectedDayPosts.length}件)
                  </p>
                  <div className="space-y-2">
                    {selectedDayPosts.map(post => (
                      <div
                        key={post.id}
                        onClick={() => onPostClick?.(post)}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                          {post.text || '(メディアのみ)'}
                        </p>
                        <div className="mt-2 flex gap-3 text-xs text-slate-500">
                          <span>{new Date(post.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                          {post.insights && (
                            <>
                              <span>閲覧 {post.insights.views}</span>
                              <span>いいね {post.insights.likes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 予約投稿 */}
              {selectedDayScheduled.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-500 rounded-full" />
                    予約投稿 ({selectedDayScheduled.length}件)
                  </p>
                  <div className="space-y-2">
                    {selectedDayScheduled.map(post => (
                      <div
                        key={post.id}
                        onClick={() => onScheduledClick?.(post)}
                        className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      >
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                          {post.text}
                        </p>
                        <div className="mt-2 flex gap-3 text-xs text-slate-500">
                          <span>{new Date(post.scheduledAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`${
                            post.status === 'pending' ? 'text-amber-600' :
                            post.status === 'posted' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {post.status === 'pending' ? '予約中' : post.status === 'posted' ? '投稿済み' : '失敗'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-violet-500 rounded-full" />
          <span>投稿済み</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-amber-500 rounded-full" />
          <span>予約投稿</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">今</span>
          <span>今日</span>
        </div>
      </div>
    </div>
  );
}
