// components/dashboard/MetricProgressIndicator.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface MetricProgressIndicatorProps {
  value: number;
  max: number;
  target: number;
  label: string;
  color?: string;
}

const MetricProgressIndicator: React.FC<MetricProgressIndicatorProps> = ({
  value,
  max,
  target,
  label,
  color = '#1E90FF', // Default color
}) => {
  const validMax = max > 0 ? max : 1; // Avoid division by zero
  const valuePercentage = Math.min(100, Math.max(0, (value / validMax) * 100));
  const targetPercentage = Math.min(100, Math.max(0, (target / validMax) * 100));
  const displayValue = value.toFixed(1); // Format value

  return (
    <div className="flex flex-col items-center w-full px-2">
      {/* Value Display */}
      <span className="text-lg font-bold text-white mb-1 text-shadow-[0_0_4px_rgba(30,144,255,0.5)]">
        {displayValue}%
      </span>

      {/* Progress Bar Area */}
      <div className="relative w-full h-3 bg-[#8BA0D6]/30 rounded-full overflow-hidden my-1">
        {/* Filled Progress */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${valuePercentage}%`, backgroundColor: color, filter: `drop-shadow(0 0 3px ${color})` }}
        />
        {/* Target Marker */}
        {targetPercentage >= 0 && targetPercentage <= 100 && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-white/80"
            style={{ left: `${targetPercentage}%` }}
             title={`Meta: ${target.toFixed(1)}%`}
          />
        )}
      </div>

       {/* Label and Target Info */}
       <div className="flex justify-between w-full mt-1">
           <span className="text-[10px] text-gray-400 text-left leading-tight text-shadow-[0_0_4px_rgba(30,144,255,0.5)] truncate pr-1">
             {label}
           </span>
           <span className="text-[10px] text-gray-400 text-right leading-tight text-shadow-[0_0_4px_rgba(30,144,255,0.5)]">
             Meta: {target.toFixed(1)}%
           </span>
       </div>
    </div>
  );
};

export default MetricProgressIndicator;