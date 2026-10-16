// import { BrowserRouter, Routes, Route } from "react-router-dom";

// function Home() {
//   return <h1>Home - Cakra Space</h1>;
// }

// function Login() {
//   return <h1>Halaman Login</h1>;
// }

// function Register() {
//   return <h1>Halaman Register</h1>;
// }

// export default function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<Home />} />
//         <Route path="/login" element={<Login />} />
//         <Route path="/register" element={<Register />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BuildingList from "./pages/BuildingList";
import BuildingDetail from "./pages/BuildingDetail";
import BookingForm from "./pages/BookingForm";
import BookingConfirm from "./pages/BookingConfirm";
import MyBookings from "./pages/MyBookings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/buildings" element={<BuildingList />} />
        <Route path="/buildings/:id" element={<BuildingDetail />} />
        <Route path="/booking/:roomId" element={<BookingForm />} />
        <Route path="/booking/confirm/:id" element={<BookingConfirm />} />
        <Route path="/my-bookings" element={<MyBookings />} />
      </Routes>
    </BrowserRouter>
  );
}