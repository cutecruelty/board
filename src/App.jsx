import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";

function Login() {
  return <h1>Login</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
