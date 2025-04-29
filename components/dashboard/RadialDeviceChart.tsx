// C:\Users\ADM\Desktop\USB MKT PRO V3\components\dashboard\RadialDeviceChart.tsx
import React from 'react';
import {
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip,
  ResponsiveContainer,
  PolarAngleAxis,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface DeviceData {
  name: string;
  value: number;
  color: string;
}

interface RadialDeviceChartProps {
  data: DeviceData[];
}

const neonColor = '#1E90FF';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        className="bg-background/80 backdrop-blur-sm border border-[var(--border)] p-2 rounded-md shadow-lg"
        style={{ borderColor: `${neonColor}4D`, textShadow: `0 0 4px ${neonColor}` }}
      >
        <p className="text-sm font-semibold" style={{ color: data.color }}>{`${data.name}`}</p>
        <p className="text-xs text-foreground">{`Acesso: ${data.value.toFixed(1)}%`}</p>
      </div>
    );
  }
  return null;
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1"> {/* Removed pt-2 */}
      {payload.map((entry: any, index: number) => {
        const { color, value: name } = entry;
        const originalData = props.data.find((d:DeviceData) => d.name === name);
        const percentage = originalData ? originalData.value.toFixed(1) : 'N/A';

        return (
          <li
            key={`item-${index}`}
            className="flex items-center text-xs text-gray-300 whitespace-nowrap"
            style={{ textShadow: `0 0 4px ${neonColor}` }}
          >
            <span className="mr-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, filter: `drop-shadow(0 0 3px ${color})` }} />
            {name}: <span className="font-semibold ml-1">{percentage}%</span>
          </li>
        );
       })}
    </ul>
  );
};


const RadialDeviceChart: React.FC<RadialDeviceChartProps> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        cx="50%"
        // --- Move chart center higher ---
        cy="40%" // Adjusted from 47% to move it up
        innerRadius="25%"
        outerRadius="100%"
        barSize={16}
        data={sortedData}
        startAngle={90}
        endAngle={-270}
        style={{ filter: `drop-shadow(0 0 8px ${neonColor}66)` }}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
            background
            dataKey="value"
            angleAxisId={0}
            cornerRadius={8}
        >
             {sortedData.map((entry, index) => (
                <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{ filter: `drop-shadow(0 0 5px ${entry.color})` }}
                 />
             ))}
        </RadialBar>
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }}/>
         <Legend
             iconSize={10}
             layout="horizontal"
             verticalAlign="bottom"
             align="center"
             // --- Move legend closer using negative margin ---
             wrapperStyle={{ marginTop: '-5px' }} // Changed from paddingTop: '2px'
             content={<CustomLegend data={sortedData} />}
         />
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

export default RadialDeviceChart;