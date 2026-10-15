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
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BuildingList from "./pages/BuildingList";
import BuildingDetail from "./pages/BuildingDetail";  // ← tambah ini
import BookingForm from "./pages/BookingForm";
import BookingConfirm from "./pages/BookingConfirm"; 
import MyBookings from "./pages/MyBookings";

function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Home - Cakra Space</h1>
        <p className="mt-4">
          Status login: {isAuthenticated ? "Sudah login" : "Belum login"}
        </p>
        {user && <p>Selamat datang, {user.name}!</p>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/buildings" element={<BuildingList />} />
        <Route path="/buildings/:id" element={<BuildingDetail />} />  {/* ← tambah ini */}
        <Route path="/booking/:roomId" element={<BookingForm />} />  {/* ← tambah ini */}
        <Route path="/booking/confirm/:id" element={<BookingConfirm />} /> 
        <Route path="/my-bookings" element={<MyBookings />} />
      </Routes>
    </BrowserRouter>
  );
}