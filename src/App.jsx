import { BrowserRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import BuildingList from "./pages/BuildingList";
import BuildingDetail from "./pages/BuildingDetail";
import BookingForm from "./pages/BookingForm";
import BookingConfirm from "./pages/BookingConfirm";
import MyBookings from "./pages/MyBookings";
import AdminDashboard from "./pages/AdminDashboard";
import SandboxPay from "./pages/SandboxPay";
import NotFound from "./pages/NotFound";

const member = (page) => <RequireAuth role="member">{page}</RequireAuth>;
const staff = (page) => <RequireAuth role="staff">{page}</RequireAuth>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* jadwal dan slot boleh dilihat tanpa login, login diminta saat menekan booking */}
        <Route path="/buildings" element={<BuildingList />} />
        <Route path="/buildings/:id" element={<BuildingDetail />} />
        <Route path="/buildings/:id/booking" element={<BookingForm />} />
        <Route path="/booking/:roomId" element={<BookingForm />} />

        <Route path="/booking/confirm/:id" element={member(<BookingConfirm />)} />
        <Route path="/my-bookings" element={member(<MyBookings />)} />
        <Route path="/dashboard" element={member(<Dashboard />)} />
        <Route path="/admin-dashboard" element={staff(<AdminDashboard />)} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />

        <Route path="/sandbox-pay/:ref" element={<SandboxPay />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
