// components/dashboard/StatCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  change?: string;
  changeLabel?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconColorClass?: string;
  valueColorClass?: string;
  isLoading?: boolean;
  isCompact?: boolean;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    description,
    change,
    changeLabel,
    icon: IconComponent,
    iconColorClass = '#1E90FF',
    valueColorClass = 'text-white',
    isLoading = false,
    isCompact = false, // Usaremos para ajustar padding/fontes
    className
}) => {
    const changeIsPositive = change && change.startsWith('+');
    const changeIsNegative = change && change.startsWith('-');
    // Ajusta estilos baseados em isCompact
    const cardPadding = isCompact ? "p-2" : "p-3"; // Menor padding se compacto
    const cardMinHeight = isCompact ? "min-h-[75px]" : "min-h-[90px]"; // Menor altura mínima
    const headerPaddingBottom = isCompact ? "pb-0.5" : "pb-1";
    const contentPaddingTop = isCompact ? "pt-0.5" : "pt-1";
    const valueTextSize = isCompact ? "text-md" : "text-lg"; // Tamanho do valor
    const titleTextSize = isCompact ? "text-[10px]" : "text-xs"; // Tamanho do título
    const descriptionTextSize = "text-[10px]";
    const iconSize = isCompact ? "h-3.5 w-3.5" : "h-4 w-4";
    const changeTextSize = isCompact ? "text-[10px]" : "text-xs";
    const changeIconSize = "h-2.5 w-2.5";

    const cardBaseClass = "bg-[#141414]/80 backdrop-blur-sm border-none shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] rounded-lg";
    const neonColor = iconColorClass;
    const neonColorMuted = '#4682B4';

  return (
    <Card className={cn(cardBaseClass, isLoading && "opacity-60", cardPadding, cardMinHeight, "overflow-hidden flex flex-col justify-between", className)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 p-0 flex-shrink-0", headerPaddingBottom)}>
        <CardTitle
         className={cn("font-medium text-gray-300", titleTextSize)}
         style={{ textShadow: `0 0 4px ${neonColorMuted}` }}
        >
            {title}
        </CardTitle>
        {IconComponent && <IconComponent
            className={cn("text-muted-foreground", iconSize, iconColorClass.startsWith('#') ? '' : iconColorClass)}
            style={{ filter: `drop-shadow(0 0 4px ${neonColor})` }}
            strokeWidth={1.5}
        />}
      </CardHeader>
      <CardContent className={cn("p-0 flex-grow", contentPaddingTop)}>
         {isLoading ? (
            <div className={cn("flex items-center", isCompact ? "h-[18px]" : "h-[20px]")}>
                <Loader2 className={cn("animate-spin text-gray-400", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} style={{ filter: `drop-shadow(0 0 4px ${neonColor})`}}/>
            </div>
         ) : (
            <div>
                <div className={cn("font-bold", valueTextSize, valueColorClass)} style={{ textShadow: `0 0 5px ${neonColor}, 0 0 8px ${neonColor}` }} >
                    {value}
                 </div>
                {change && (
                  <div className={cn("flex items-center text-muted-foreground mt-0.5", changeTextSize)}> {/* Reduzido mt */}
                    <span className={cn( "flex items-center", changeIsPositive ? 'text-green-400' : changeIsNegative ? 'text-red-400' : '', changeTextSize )} style={{ textShadow: `0 0 3px ${changeIsPositive ? '#32CD32' : changeIsNegative ? '#FF4444' : neonColorMuted }`}}>
                        {changeIsPositive && <ArrowUpIcon className={cn("mr-1", changeIconSize)} />}
                        {changeIsNegative && <ArrowDownIcon className={cn("mr-1", changeIconSize)} />}
                        {change}
                    </span>
                     {changeLabel && <span className={cn("ml-1 whitespace-nowrap", changeTextSize)}>{changeLabel}</span>}
                  </div>
                )}
            </div>
         )}
      </CardContent>
       {!isLoading && description && (
           <CardDescription className={cn("text-gray-400 pt-1 mt-1 text-center border-t border-white/10", descriptionTextSize)} style={{ textShadow: `0 0 3px ${neonColorMuted}50` }}>
               {description}
           </CardDescription>
       )}
    </Card>
  );
};
export default StatCard;
