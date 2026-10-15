export const mockBuildings = [
  {
    id: 1,
    name: "Cakra Space Sudirman",
    city: "Jakarta",
    address: "Jl. Jend. Sudirman No. 1",
    status: "active",
    image: "https://placehold.co/400x200?text=Sudirman",
  },
  {
    id: 2,
    name: "Cakra Space Dago",
    city: "Bandung",
    address: "Jl. Ir. H. Juanda No. 2",
    status: "active",
    image: "https://placehold.co/400x200?text=Dago",
  },
  {
    id: 3,
    name: "Cakra Space Diponegoro",
    city: "Surabaya",
    address: "Jl. Diponegoro No. 3",
    status: "draft",
    image: "https://placehold.co/400x200?text=Diponegoro",
  },
  {
    id: 4,
    name: "Cakra Space Malioboro",
    city: "Yogyakarta",
    address: "Jl. Malioboro No. 4",
    status: "active",
    image: "https://placehold.co/400x200?text=Malioboro",
  },
];
export const mockRooms = [
  // Ruang di gedung 1 (Sudirman)
  {
    id: 101,
    buildingId: 1,
    name: "Hot Desk A1",
    type: "hot_desk",
    capacity: 1,
    price_per_hour: 25000,
    facilities: ["WiFi", "Colokan Listrik"],
  },
  {
    id: 102,
    buildingId: 1,
    name: "Hot Desk A2",
    type: "hot_desk",
    capacity: 1,
    price_per_hour: 25000,
    facilities: ["WiFi", "Colokan Listrik"],
  },
  {
    id: 103,
    buildingId: 1,
    name: "Meeting Room Merdeka",
    type: "meeting_room",
    capacity: 8,
    price_per_hour: 150000,
    facilities: ["WiFi", "Proyektor", "Whiteboard", "AC"],
  },
  {
    id: 104,
    buildingId: 1,
    name: "Meeting Room Nusantara",
    type: "meeting_room",
    capacity: 12,
    price_per_hour: 250000,
    facilities: ["WiFi", "TV", "Whiteboard", "AC", "Sound System"],
  },
  
  // Ruang di gedung 2 (Dago)
  {
    id: 201,
    buildingId: 2,
    name: "Dedicated Desk B1",
    type: "dedicated_desk",
    capacity: 1,
    price_per_hour: 35000,
    facilities: ["WiFi", "Loker", "Colokan Listrik"],
  },
  {
    id: 202,
    buildingId: 2,
    name: "Meeting Room Tangkuban",
    type: "meeting_room",
    capacity: 6,
    price_per_hour: 120000,
    facilities: ["WiFi", "Proyektor", "AC"],
  },
];
export const mockBookings = [];