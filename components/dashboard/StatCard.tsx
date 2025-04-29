// components/dashboard/StatCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Assumindo que você usa o componente Card do shadcn/ui
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react"; // Assumindo que você usa ícones Lucide
// Importar estilos utilitários - Ajuste o caminho se necessário
import { NEON_COLOR, baseCardStyle } from '@/components/flow/utils';
import { Loader2 } from 'lucide-react'; // Importar ícone de loader

interface StatCardProps {
  label: string; // Nome da métrica (ex: "Custo Total", "ROI")
  value: any; // Valor formatado da métrica (usando 'any' pois formatMetricValue retorna string, mas a lógica pode lidar com number/null)
  icon?: LucideIcon; // Ícone opcional
  percentageChange?: number | null; // CORRIGIDO: Nome da prop e tipo para variação percentual
  iconColorClass?: string; // Classe Tailwind para cor do ícone (ex: text-green-500)
  isLoading?: boolean; // Prop para estado de carregamento
  isCompact?: boolean; // Prop para estilo compacto (usado em Metrics.tsx)
  accentColor?: string; // ADICIONADO: Prop para cor de destaque (usada em ícones/texto se iconColorClass não for usado)
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, percentageChange, iconColorClass, isLoading, isCompact, accentColor }) => {
  // Estilo neon para o valor e label
  // Usar accentColor se fornecido, senão NEON_COLOR padrão
  const valueNeonStyle = { textShadow: `0 0 6px ${accentColor || NEON_COLOR}, 0 0 10px ${accentColor || NEON_COLOR}` };
  const labelNeonStyle = { textShadow: `0 0 4px ${accentColor || NEON_COLOR}50` };
  // Aplicar filtro neon com accentColor ou NEON_COLOR padrão
  const iconNeonFilterStyle = { filter: `drop-shadow(0 0 4px ${accentColor || NEON_COLOR})` };


  return (
    // Aplicar baseCardStyle ao componente Card principal e ajustar padding/tamanho se compacto
    <Card className={cn(baseCardStyle, isCompact ? "p-3" : "p-4")}> {/* Ajuste de padding */}
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isCompact ? "pb-1" : "pb-2")}> {/* Ajuste de padding */}
        <CardTitle className={cn("font-medium text-gray-400", isCompact ? "text-xs" : "text-sm")} style={labelNeonStyle}> {/* Ajuste de tamanho da fonte */}
          {label} {/* Usar label */}
        </CardTitle>
        {isLoading ? (
             <Loader2 className={cn("h-4 w-4 animate-spin text-gray-400", isCompact ? "h-3 w-3" : "h-4 w-4")} style={iconNeonFilterStyle} /> // Loader com estilo neon
        ) : (
             Icon && <Icon className={cn("h-4 w-4 text-gray-400", isCompact ? "h-3 w-3" : "h-4 w-4", iconColorClass)} style={iconColorClass ? {} : iconNeonFilterStyle} /> // Ícone com estilo neon se iconColorClass não for usado
        )}
      </CardHeader>
      <CardContent className={cn(isCompact ? "pt-1" : "pt-2")}> {/* Ajuste de padding */}
        <div className={cn("font-bold text-white", isCompact ? "text-xl" : "text-2xl")} style={valueNeonStyle}>{value}</div> {/* Ajuste de tamanho da fonte, valor com estilo neon */}
        {/* Usar percentageChange e verificar se é number */}
        {typeof percentageChange === 'number' && (
          <p className={cn(
            "text-xs",
            percentageChange >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(1)}% from last month {/* Formatar variação */}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
