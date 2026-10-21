import ApiClient from "./ApiClient";
import SessionStore from "./SessionStore";
import AuthApi from "./AuthApi";
import BuildingApi from "./BuildingApi";
import BookingApi from "./BookingApi";
import PaymentApi from "./PaymentApi";
import MemberApi from "./MemberApi";
import ManageApi from "./ManageApi";

// alamat API diatur lewat VITE_API_URL di .env
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const session = new SessionStore();
export const client = new ApiClient(API_BASE_URL, session);

export const api = {
  auth: new AuthApi(client),
  buildings: new BuildingApi(client),
  bookings: new BookingApi(client),
  payments: new PaymentApi(client),
  member: new MemberApi(client),
  manage: new ManageApi(client),
};
