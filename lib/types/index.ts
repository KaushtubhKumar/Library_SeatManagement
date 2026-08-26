export type SeatState = "FREE" | "LOCKED" | "BOOKED" | "OCCUPIED" | "MAINTENANCE";
export type ZoneType = "SILENT" | "DISCUSSION" | "GROUP";
export type SeatType = "SINGLE" | "CARREL" | "GROUP_TABLE";

export interface FloorSummary {
  id: string;
  floorNumber: number;
  imageUrl: string | null;
  totalSeats: number;
  freeSeats: number;
}

export interface SeatDTO {
  id: string;
  seatCode: string;
  seatType: SeatType;
  hasPowerSocket: boolean;
  hasWindow: boolean;
  posX: number;
  posY: number;
  currentState: SeatState;
}

export interface ZoneDTO {
  id: string;
  name: string;
  zoneType: ZoneType;
  declaredNoiseLevel: number;
  seats: SeatDTO[];
}

export interface FloorDetail {
  id: string;
  floorNumber: number;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface SeatUpdateEvent {
  seatId: string;
  state: SeatState;
  bookingId?: string;
  source?: string;
}

export interface BookingDTO {
  id: string;
  seatId: string;
  status: "ACTIVE" | "CHECKED_IN" | "EXPIRED" | "CANCELLED" | "COMPLETED";
  startTime: string;
  expiryTime: string;
  checkedInAt: string | null;
  qrToken: string;
  qrCodeDataUrl: string | null;
  bookingCode: string;
}
