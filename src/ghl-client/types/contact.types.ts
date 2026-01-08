export interface GhlContact {
  id: string;
  locationId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dateAdded?: string;
  dateUpdated?: string;
  customFields?: Array<{
    id: string;
    key: string;
    field_value: any;
  }>;
  tags?: string[];
  source?: string;
}

export interface GhlContactsResponse {
  contacts: GhlContact[];
  meta?: {
    total: number;
    nextPageUrl?: string;
  };
}

export interface GetContactsParams {
  locationId?: string;
  limit?: number;
  skip?: number;
  query?: string;
  startAfter?: string;
  startAfterId?: string;
}
