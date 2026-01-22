'use client';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  suffix?: string;
  description?: string;
}

export function KPICard({
  title,
  value,
  change,
  icon,
  suffix = '',
  description,
}: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {suffix && (
              <span className="text-sm text-slate-500">{suffix}</span>
            )}
          </div>
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  isPositive ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400">vs 前週</span>
            </div>
          )}
          {description && (
            <p className="mt-2 text-xs text-slate-400">{description}</p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
