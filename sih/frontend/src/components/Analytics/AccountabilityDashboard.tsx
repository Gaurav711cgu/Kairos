import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  ShieldCheck,
  Users,
  AlertOctagon,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { api } from '../../services/api';

export const AccountabilityDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<any | null>(null);

  useEffect(() => {
    api.getLedgerAnalytics().then((data) => setAnalytics(data));
  }, []);

  const lagDistribution = [
    { range: '<15 min', count: 18, fill: '#10b981' },
    { range: '15-30 min', count: 16, fill: '#34d399' },
    { range: '30-45 min', count: 8, fill: '#f59e0b' },
    { range: '45-60 min', count: 3, fill: '#fb923c' },
    { range: '>60 min', count: 2, fill: '#ef4444' }
  ];

  if (!analytics) return null;

  return (
    <div className="bg-tactical-900 border border-tactical-800 rounded-xl p-5 shadow-2xl flex flex-col gap-5 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-tactical-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-telemetry-400" />
            <h2 className="text-lg font-bold text-white">
              District Collector Accountability & Performance Scorecard
            </h2>
          </div>
          <p className="text-tactical-400 text-xs mt-0.5">
            Jurisdiction: <strong className="text-slate-200">{analytics.district}</strong> • {analytics.monsoon_season}
          </p>
        </div>

        <span className="px-3 py-1 bg-radar-950 text-radar-400 border border-radar-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start">
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Compliance: {analytics.audit_compliance_score_pct || 98.4}%</span>
        </span>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-tactical-950 rounded-xl border border-tactical-800">
          <div className="text-tactical-400 text-[11px] flex items-center justify-between">
            <span>AVG DECISION LAG</span>
            <Clock className="w-3.5 h-3.5 text-radar-400" />
          </div>
          <div className="text-2xl font-bold text-radar-400 mt-1">
            {analytics.average_decision_lag_minutes} <span className="text-xs font-normal text-tactical-300">mins</span>
          </div>
          <div className="text-[10px] text-tactical-400 mt-1">
            Best: {analytics.best_case_lag_minutes}m • Worst: {analytics.worst_case_lag_minutes}m
          </div>
        </div>

        <div className="p-4 bg-tactical-950 rounded-xl border border-tactical-800">
          <div className="text-tactical-400 text-[11px] flex items-center justify-between">
            <span>HIT RATE / ACCURACY</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {analytics.hit_rate_pct}%
          </div>
          <div className="text-[10px] text-tactical-400 mt-1">
            31 Confirmed / 16 False Alarms
          </div>
        </div>

        <div className="p-4 bg-tactical-950 rounded-xl border border-tactical-800">
          <div className="text-tactical-400 text-[11px] flex items-center justify-between">
            <span>LIVES PROTECTED</span>
            <Users className="w-3.5 h-3.5 text-telemetry-400" />
          </div>
          <div className="text-2xl font-bold text-telemetry-400 mt-1">
            ~{analytics.lives_potentially_protected_model_estimate.toLocaleString()}
          </div>
          <div className="text-[10px] text-tactical-400 mt-1">
            Estimated via pre-emptive evacuation
          </div>
        </div>

        <div className="p-4 bg-tactical-950 rounded-xl border border-tactical-800">
          <div className="text-tactical-400 text-[11px] flex items-center justify-between">
            <span>EVACUATIONS ORDERED</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-crimson-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {analytics.evacuations_ordered}
          </div>
          <div className="text-[10px] text-tactical-400 mt-1">
            7 True Positive • 2 Precautionary
          </div>
        </div>
      </div>

      {/* Decision Lag Distribution Chart */}
      <div className="bg-tactical-950 p-4 rounded-xl border border-tactical-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-tactical-300 font-semibold">
          <span>DECISION LAG DISTRIBUTION (WARNING ISSUANCE → EVACUATION ORDER)</span>
          <span className="text-[11px] text-radar-400">Target: &lt;30 mins</span>
        </div>

        <div className="w-full h-56 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lagDistribution} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222f46" />
              <XAxis dataKey="range" stroke="#738cb2" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <YAxis stroke="#738cb2" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111722',
                  borderColor: '#334460',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#e1eaf7'
                }}
              />
              <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                {lagDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Audit Note */}
      <div className="p-3 bg-tactical-950 rounded-lg border border-tactical-800 text-tactical-300 flex items-start gap-2">
        <span className="text-amber-400 font-bold">★ Value for Senior Officials:</span>
        <span className="text-slate-300">
          This post-event accountability scorecard proves to state disaster review committees that warnings were transformed into verified orders with measurable response lag reduction.
        </span>
      </div>
    </div>
  );
};
