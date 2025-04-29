// components/dashboard/EchartsScatterGLChart.tsx
import React, { useEffect } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent // Import TitleComponent if you want titles
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import 'echarts-gl'; // IMPORTANT: Import echarts-gl

// Register necessary components
echarts.use([
  ScatterChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
  TitleComponent // Register TitleComponent
]);

interface DeviceData {
  name: string;
  value: number; // Percentage value (0-100)
  color: string; // Hex color string (might not be directly used by visualMap easily)
}

interface EchartsScatterGLChartProps {
  data: DeviceData[];
  theme?: string; // Optional theme prop
}

const EchartsScatterGLChart: React.FC<EchartsScatterGLChartProps> = ({
  data,
  theme = 'dark' // Default to dark theme
}) => {
  // Map device data to ECharts format [x, y, value, name]
  // x: index/category, y: percentage value, value: percentage value (for visualMap)
  const chartData = data.map((item, index) => [
      index + 1,      // X: Assign simple index (1, 2, 3...)
      item.value,     // Y: Use the percentage value
      item.value,     // Value: Use percentage for visual mapping
      item.name       // Name: For tooltips
  ]);

  const option = {
    backgroundColor: 'transparent', // Use parent card background
    grid: { // Adjust grid padding
        top: 10,
        bottom: 30,
        left: 30,
        right: 10
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        // params.value should be [x, y, value, name]
        if (params.value && params.value.length >= 4) {
          return `${params.value[3]}: ${params.value[1].toFixed(1)}%`;
        }
        return '';
      },
      backgroundColor: 'rgba(14, 16, 21, 0.8)', // Match other tooltips
      borderColor: '#1E90FF4D',
      textStyle: {
          color: '#e2e8f0',
          fontSize: 11,
          textShadow: '0 0 4px #1E90FF'
      },
      extraCssText: 'backdrop-filter: blur(4px); border-radius: 6px; box-shadow: 5px 5px 10px rgba(0,0,0,0.4), -5px -5px 10px rgba(255,255,255,0.05); padding: 4px 8px;',
    },
    xAxis: {
      show: false, // Hide X axis labels/ticks as they are just indices
      type: 'value',
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%',
        color: '#a0aec0',
        fontSize: 10,
        textShadow: '0 0 4px #1E90FF'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#1E90FF',
          opacity: 0.1
        }
      },
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max: 100, // Max percentage
      dimension: 2, // Map the 3rd element (index 2) of data item [x, y, *value*, name]
      orient: 'horizontal',
      left: 'center',
      top: 'bottom', // Position at the bottom
      text: ['Alto %', 'Baixo %'],
      calculable: true,
      itemHeight: 120, // Make gradient bar thinner
      itemWidth: 10, // Reduce width
      textStyle: {
          color: '#a0aec0',
          fontSize: 9,
          textShadow: '0 0 4px #1E90FF'
      },
      inRange: {
        // Use the colors from your device data if possible and desired
        // Or define a gradient like the ECharts example
        color: ['#67e8f9', '#22d3ee', '#0ea5e9', '#1E90FF'] // Cyan -> Blue gradient
        // symbolSize: [5, 50] // Map value to size
      },
      formatter: (value: number) => `${value.toFixed(0)}%` // Format labels on gradient bar
    },
    series: [{
      name: 'Dispositivos',
      type: 'scatterGL', // Use scatterGL
      data: chartData,
      symbolSize: (val: number[]) => {
          // val is [x, y, value, name]
          // Scale size based on value (index 2) - adjust multiplier as needed
          return Math.max(5, val[2] * 0.5);
      },
      itemStyle: {
        // Color is controlled by visualMap based on the 3rd dimension ('value')
         opacity: 0.8,
         borderWidth: 0.5,
         borderColor: 'rgba(255, 255, 255, 0.3)' // Slight border
      },
      emphasis: {
        itemStyle: {
            opacity: 1,
            borderColor: 'rgba(255, 255, 255, 0.8)',
            borderWidth: 1
        }
      },
      progressive: 1e6, // Optimization for large datasets (may not be needed here)
      blendMode: 'lighter' // Similar effect to the example
    }]
  };

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: '100%', width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
      theme={theme} // Apply theme if needed
    />
  );
};

export default EchartsScatterGLChart;