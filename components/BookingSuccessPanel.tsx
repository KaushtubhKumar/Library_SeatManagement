"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { BookingDTO } from "@/lib/types";
import { IconCheck, IconClose } from "@/lib/icons";

interface Props {
  booking: BookingDTO;
  onClose: () => void;
}

export default function BookingSuccessPanel({ booking, onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus] = useState(booking.status);

  useEffect(() => {
    const expiry = new Date(booking.expiryTime).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiry - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [booking.expiryTime]);

  // Poll booking status so the panel reflects check-in if it happens
  // via the scanner page in another tab/device.
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/bookings`);
      const data = await res.json();
      const mine = data.bookings?.find((b: BookingDTO) => b.id === booking.id);
      if (mine) setStatus(mine.status);
    }, 4000);
    return () => clearInterval(interval);
  }, [booking.id]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const expired = secondsLeft === 0 && status === "ACTIVE";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-6 text-center">
        {status === "CHECKED_IN" ? (
          <>
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-emerald-950 border-2 border-emerald-700 flex items-center justify-center"><IconCheck width={22} height={22} className="text-emerald-400" /></div>
            <h3 className="text-lg font-semibold mb-1">Checked in</h3>
            <p className="text-neutral-400 text-sm mb-5">
              Your seat is yours for the next 4 hours.
            </p>
          </>
        ) : expired ? (
          <>
            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-red-950 border-2 border-red-800 flex items-center justify-center"><IconClose width={22} height={22} className="text-red-400" /></div>
            <h3 className="text-lg font-semibold mb-1">Booking expired</h3>
            <p className="text-neutral-400 text-sm mb-5">
              You didn&apos;t check in within 30 minutes. The seat is free again.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold mb-1">Booking confirmed</h3>
            <p className="text-neutral-400 text-sm mb-4">
              Scan this QR at the seat within{" "}
              <span className="text-accent font-mono">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>{" "}
              to check in.
            </p>

            {booking.qrCodeDataUrl && (
              <div className="bg-white rounded-xl p-3 inline-block mb-4">
                <Image
                  src={booking.qrCodeDataUrl}
                  alt="Booking QR code"
                  width={200}
                  height={200}
                />
              </div>
            )}

            <p className="text-xs text-neutral-500 mb-1">Can&apos;t scan? Give this code:</p>
            <p className="font-mono text-lg tracking-wider mb-5">{booking.bookingCode}</p>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-lg py-3 font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}