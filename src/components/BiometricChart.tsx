"use client";
import React from 'react';
import { 
  ComposedChart, Line, Area, XAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

interface ChartData {
  date: string;
  temp: number | null;
  heraScore: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const score = payload[0].payload.heraScore;
    const temp = payload[0].payload.temp;
    const status = score > 5000 ? "⚠️ PEAK" : "Running";
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700">
        <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
        <p className="text-lg font-black text-rose-400">Score: {score}</p>
        <p className="text-xs font-mono text-slate-300">Temp: {temp ? temp.toFixed(2) : '--'}</p>
        <p className="text-xs font-mono tracking-widest mt-1 text-emerald-400">{status}</p>
      </div>
    );
  }
  return null;
};

export const BiometricChart = ({ data }: { data: ChartData[] }) => {
  return (
    <div className="h-64 w-full transition-all duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF0066" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#E0F2FE" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5B21B6" />
              <stop offset="100%" stopColor="#FF0066" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} minTickGap={20} />
          <ReferenceLine y={5000} yAxisId="right" stroke="#FF0066" strokeDasharray="3 3" label={{ position: 'right', value: 'TARGET', fill: '#FF0066', fontSize: 9, fontWeight: 'bold' }} />
          <Area type="monotone" dataKey="heraScore" stroke="none" fill="url(#scoreGradient)" yAxisId="right" animationDuration={1000} />
          <Line type="monotone" dataKey="temp" stroke="url(#lineGradient)" strokeWidth={3} dot={{r: 2, fill: 'white', strokeWidth: 2}} activeDot={{r: 6, fill: '#FF0066'}} yAxisId="left" animationDuration={1500} connectNulls />
          <Tooltip content={<CustomTooltip />} cursor={{stroke: '#cbd5e1', strokeWidth: 1}} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
