import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface MetricData {
  name: string;
  value: number;
  color: string;
}

interface MetricVisualizerProps {
  metrics: MetricData[];
  isLoading?: boolean;
}

const MetricVisualizer: React.FC<MetricVisualizerProps> = ({ metrics, isLoading = false }) => {
  const [rotating, setRotating] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Instead of actual THREE.js implementation (which would require actual THREE.js),
  // we'll create a visual representation with CSS and React
  
  // Find the max value for scaling
  const maxValue = metrics.length > 0 ? Math.max(...metrics.map(item => item.value)) : 100;
  
  return (
    <div className="w-full h-full relative select-none">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex justify-center items-center z-10 bg-black/20 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      )}
      
      {/* Grid floor */}
      <div className="absolute inset-0 border-t border-blue-500/20"></div>
      <div className="absolute inset-0 flex items-end">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`grid-x-${i}`} className="flex-1 border-r border-blue-500/20 h-full"></div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-start">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`grid-y-${i}`} className="flex-1 border-b border-blue-500/20 w-full"></div>
        ))}
      </div>
      
      {/* 3D Bar visualization */}
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
        <div className={`relative flex items-end justify-center w-4/5 h-3/4 transition-transform duration-1000 ${rotating ? 'animate-[spin_20s_linear_infinite]' : ''}`}>
          {metrics.map((metric, index) => {
            // Calculate height based on value relative to max
            const heightPercent = (metric.value / maxValue) * 100;
            const rotation = (index / metrics.length) * 360;
            const distance = metrics.length > 3 ? 120 : 100; // Distance from center
            
            return (
              <div 
                key={metric.name}
                className="absolute transform-gpu transition-all duration-300 ease-out"
                style={{
                  transform: `rotateY(${rotation}deg) translateZ(${distance}px)`,
                  transformOrigin: 'center center'
                }}
              >
                {/* Bar */}
                <div className="flex flex-col items-center">
                  <div 
                    className="w-16 rounded shadow-lg relative mb-4 transition-all duration-500"
                    style={{ 
                      height: `${heightPercent * 0.7}%`,
                      minHeight: '40px',
                      background: metric.color,
                      boxShadow: `0 0 15px ${metric.color}66`
                    }}
                  >
                    {/* Top face with highlight */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-2 rounded-t"
                      style={{ 
                        background: `linear-gradient(to right, ${metric.color}bb, ${metric.color}ff)` 
                      }}
                    ></div>
                    
                    {/* Side highlight */}
                    <div 
                      className="absolute top-0 bottom-0 left-0 w-1 rounded-l"
                      style={{ 
                        background: `linear-gradient(to bottom, ${metric.color}dd, ${metric.color}77)` 
                      }}
                    ></div>
                  </div>
                  
                  {/* Label */}
                  <div className="text-center bg-black/30 px-2 py-1 rounded backdrop-blur-sm w-20">
                    <div className="text-xs font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{metric.name}</div>
                    <div className="text-xs font-medium text-white/80">{metric.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-2 right-2 z-10">
        <button 
          onClick={() => setRotating(!rotating)}
          className="bg-gray-800/50 hover:bg-gray-700/50 text-white text-xs rounded px-2 py-1 backdrop-blur-sm"
        >
          {rotating ? 'Pause' : 'Rotate'}
        </button>
      </div>
      
      {/* No data message */}
      {metrics.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          Sem dados para visualizar
        </div>
      )}
    </div>
  );
};

export default MetricVisualizer;