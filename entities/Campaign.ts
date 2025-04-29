// entities/Campaign.ts

// Interface para tipagem de uma campanha
export interface Campaign {
    id: number | string;
    name: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    status?: string;
    revenue?: number;
    leads?: number;
    clicks?: number;
    sales?: number;
    platform?: string | string[]; // Permitir array para consistência com API
    objective?: string | string[]; // Permitir array
    daily_budget?: number;
    duration?: number;
    industry?: string | null;
    targetAudience?: string | null;
    segmentation?: string | null;
    adFormat?: string | string[]; // Permitir array

    // --- CAMPOS LTV ---
    avgTicket?: number | null;
    purchaseFrequency?: number | null;
    customerLifespan?: number | null;

    // --- CAMPOS DE CUSTO (NOVOS) ---
    cost_traffic?: number | null;
    cost_creative?: number | null;
    cost_operational?: number | null;

    // --- Métricas e Dados Adicionais ---
    metrics?: {
      cost?: number;
      impressions?: number;
      ctr?: number;
      cpc?: number;
    };
    dailyData?: {
        date: string;
        revenue?: number;
        clicks?: number;
        leads?: number;
        cost?: number;
    }[];
    created_at?: string;
    updated_at?: string;
}

// Função para listar campanhas via API (Mantida - Opcional)
// Esta função é para buscar dados no FRONTEND, se necessário
// Não impacta a definição da interface usada pelo backend/tipagem
export async function list(): Promise<Campaign[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/'; // Usa relativo por padrão
    console.log(`[Campaign Entity] Fetching from: ${baseUrl}api/campaigns`);
    const response = await fetch(`${baseUrl}api/campaigns`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
       let errorBody = `Erro ${response.status}`;
       try { errorBody = await response.text(); } catch (_) {}
      console.error(`[Campaign Entity] Erro ${response.status}: ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`Erro ao buscar campanhas (${response.status})`);
    }

    const data = await response.json();
     console.log(`[Campaign Entity] Received ${data?.length ?? 0} campaigns.`);
    return data as Campaign[];
  } catch (error) {
    console.error('[Campaign Entity] Erro ao listar campanhas:', error);
    return [];
  }
}
