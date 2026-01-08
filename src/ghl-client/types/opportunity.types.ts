export interface GhlOpportunity {
  id: string;
  locationId: string;
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status: string;
  name?: string;
  monetaryValue?: number;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  source?: string;
}

export interface GhlOpportunitiesResponse {
  opportunities: GhlOpportunity[];
  meta?: {
    total: number;
    nextPageUrl?: string;
  };
}

export interface GetOpportunitiesParams {
  locationId?: string;
  limit?: number;
  offset?: number;
  pipelineId?: string;
  status?: string;
  startAfter?: string;
  startAfterId?: string;
}
