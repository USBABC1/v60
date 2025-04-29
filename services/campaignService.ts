// C:\Users\ADM\Desktop\USB MKT PRO V3\services\campaignService.ts
import axios from 'axios';
import { Campaign } from '@/entities/Campaign';

export const CampaignService = {
  async list(): Promise<Campaign[]> {
    const response = await axios.get('/api/campaigns');
    return response.data;
  }
};