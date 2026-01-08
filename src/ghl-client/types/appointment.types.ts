export interface GhlAppointment {
  id: string;
  locationId: string;
  contactId?: string;
  calendarId?: string;
  title?: string;
  startTime: string;
  endTime?: string;
  status?: string;
  assignedUserId?: string;
  appointmentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlAppointmentsResponse {
  events: GhlAppointment[];
  meta?: {
    total: number;
    nextPageUrl?: string;
  };
}

export interface GetAppointmentsParams {
  locationId?: string;
  calendarId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  skip?: number;
}
