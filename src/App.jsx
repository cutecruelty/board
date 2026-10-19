import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import Login from "./pages/Login";
import Board from "./pages/Board";
import Boards from "./pages/Boards";
import Register from "./pages/Register";

export default function App() {
  return (
    <Routes>
      <Route path="/boards" element={<Boards />} />
      <Route path="/board" element={<Board />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}
