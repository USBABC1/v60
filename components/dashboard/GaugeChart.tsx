// components/dashboard/GaugeChart.tsx
import React from 'react';
import { cn } from '@/lib/utils';

// <<< INTERFACE ATUALIZADA >>>
interface GaugeChartProps {
  value: number;
  max: number;           // Já corrigido
  label: string;
  units?: string;         // <<< ADICIONADO: Unidades (opcional)
  color?: string;
  baseColor?: string;
  size?: number;
  strokeWidth?: number;
  textColor?: string;
  labelColor?: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max, // Já corrigido
  label,
  units = '', // <<< RECEBE A PROP units (padrão string vazia)
  color = '#1E90FF',
  baseColor = '#374151', // Usando um cinza diferente do original
  size = 100,          // Default size se não passado
  strokeWidth = 8,     // Default stroke se não passado
  textColor = '#FFFFFF',
  labelColor = '#A0AEC0',
}) => {
  const validMax = max > 0 ? max : 1;
  const clampedValue = Math.min(validMax, Math.max(0, value));
  const valuePercentage = (clampedValue / validMax) * 100; // Percentual para o gauge

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - valuePercentage / 100); // Offset baseado no percentual
  const viewBoxSize = size; // Viewbox igual ao tamanho
  const center = size / 2;
  const glowId = `gaugeGlow-${label.replace(/\s+/g, '-')}`;
  const neonColor = '#1E90FF'; // Mantido para sombra do texto se precisar

  // Função de cor (mantida)
  const getColor = (val: number, maxVal: number) => {
      const perc = maxVal === 0 ? 0 : (val / maxVal) * 100;
      if (perc >= 75) return '#32CD32';
      if (perc >= 40) return '#FFD700';
      return '#FF4444';
  };
  const finalValueColor = color === '#1E90FF' ? getColor(clampedValue, validMax) : color;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="-rotate-90">
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%"> <feGaussianBlur stdDeviation="4" result="glowBlur" /> <feFlood floodColor={finalValueColor} result="glowColor"/> <feComposite in="glowColor" in2="glowBlur" operator="in" result="coloredGlow"/> <feMerge> <feMergeNode in="coloredGlow" /> <feMergeNode in="SourceGraphic" /> </feMerge> </filter>
        </defs>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={baseColor} strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={finalValueColor} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`} style={{ transition: 'stroke-dashoffset 0.4s ease-out', filter: `url(#${glowId})` }} />
      </svg>
      {/* Texto central */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-bold text-xl" style={{ color: textColor, textShadow: `0 0 5px ${finalValueColor}` }}>
          {/* Exibe o VALOR original, não o percentual (a menos que units seja %) */}
          {value % 1 !== 0 ? value.toFixed(1) : value.toFixed(0)}
          {/* <<< USA A PROP units >>> */}
          {units && <span className="text-xs ml-0.5">{units}</span>}
        </span>
        {label && (
          <span className="text-xs mt-0.5" style={{ color: labelColor }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default GaugeChart;
