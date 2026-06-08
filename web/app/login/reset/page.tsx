"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    setMessage("Resetting password...");

    try {
      const res = await fetch(`${API}/business/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("✅ Password updated successfully");
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch (err) {
      setMessage("❌ Network error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-black text-white">
      <h1 className="text-2xl mb-6">Reset Password</h1>

      <input
        placeholder="Email"
        className="mb-3 p-3 rounded bg-gray-800"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="OTP"
        className="mb-3 p-3 rounded bg-gray-800"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />

      <input
        type="password"
        placeholder="New Password"
        className="mb-3 p-3 rounded bg-gray-800"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />

      <button
        onClick={handleReset}
        className="bg-white text-black px-6 py-3 rounded"
      >
        Reset Password
      </button>

      <p className="mt-4">{message}</p>
    </div>
  );
}