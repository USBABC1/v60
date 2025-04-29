// zap.ts
// C:\Users\ADM\Desktop\v13-main\types\zap.ts
import { Node, Edge } from '@xyflow/react';

// --- Tipos Gerais ---
export type CampaignSelectItem = { id: string; name: string; };
export type FlowData = { id: number; name: string; status: 'active' | 'inactive' | 'draft'; campaign_id?: string | null; elements?: { nodes: Node<any>[]; edges: Edge[] }; updated_at?: string; };
export interface AppSettings { defaultMessageDelayMs: number; unknownMessageResponse: 'ignore' | 'defaultReply' | 'forwardAdmin'; defaultReplyMessage: string; adminForwardNumber: string; defaultInputTimeoutSeconds: number; enableBusinessHours: boolean; businessHoursStart: string; businessHoursEnd: string; outsideHoursMessage: string; }
export interface Contact { jid: string; name?: string; notify?: string; imgUrl?: string; }

// --- Tipos de Dados dos Nós (Adicione todos os necessários) ---
export interface TextMessageData { text: string; }
export interface ButtonOption { id: string; text: string; }
export interface ButtonMessageData { text: string; buttons: ButtonOption[]; footer?: string; }
export interface ImageData { url: string; caption?: string; }
export interface DelayData { duration: number; unit: 'seconds' | 'minutes'; }
export interface ListItem { id: string; title: string; description?: string; }
export interface ListSection { id: string; title: string; rows: ListItem[]; }
export interface ListMessageData { buttonText: string; title: string; text: string; sections: ListSection[]; footer?: string; }
export interface WaitInputData { variableName: string; message?: string; timeoutSeconds?: number; }
export interface SetVariableData { variableName: string; value: string; }
export interface ConditionData { variableName: string; comparison: 'equals' | 'contains' | 'startsWith' | 'isSet' | 'isNotSet' | 'greaterThan' | 'lessThan'; value?: string; }
export interface ApiCallData { apiUrl: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; headers?: string; body?: string; saveResponseTo?: string; }
export interface AssignAgentData { department?: string; agentId?: string; message?: string; }
export interface EndFlowData { reason?: string; }
export interface GoToFlowData { targetFlowId: number | string; }
export interface TagContactData { tagName: string; action: 'add' | 'remove'; }
export interface AudioMessageData { url: string; caption?: string; }
export interface FileMessageData { url: string; filename?: string; }
export interface LocationMessageData { latitude: string; longitude: string; }
export interface TimeConditionData { startTime: string; endTime: string; }
export interface LoopData { repetitions: number; }
export interface WebhookCallData { url: string; method: 'GET' | 'POST'; headers?: string; body?: string; saveResponseTo?: string; }
export interface GPTQueryData { prompt: string; apiKeyVariable?: string; saveResponseTo: string; }

// --- Outros Tipos ---
export interface NodeContextMenuProps { id: string; top: number; left: number; nodeType: string | undefined; }