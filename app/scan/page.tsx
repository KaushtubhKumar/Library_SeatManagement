"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Link from "next/link";

type ScanState = "idle" | "scanning" | "checking-in" | "success" | "error";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setState("scanning");
        scanLoop();
      } catch {
        setState("error");
        setMessage("Camera access denied. You can enter your booking code manually below instead.");
      }
    }

    function scanLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        handleScannedToken(code.data);
        return; // stop the loop, we found something
      }

      rafRef.current = requestAnimationFrame(scanLoop);
    }

    startCamera();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleScannedToken(qrToken: string) {
    setState("checking-in");
    try {
      // The token is a signed JWT containing bookingId — decode just
      // enough client-side to know which booking endpoint to hit.
      // (Signature is verified server-side; we don't trust this parse
      // for anything security-relevant, just routing.)
      const payloadB64 = qrToken.split(".")[1];
      const payload = JSON.parse(atob(payloadB64));
      const bookingId = payload.bookingId;

      const res = await fetch(`/api/bookings/${bookingId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json();

      if (data.ok) {
        setState("success");
        setMessage("Checked in! Enjoy your session.");
      } else {
        setState("error");
        setMessage(
          data.error === "BOOKING_EXPIRED"
            ? "This booking already expired."
            : data.error === "INVALID_QR"
            ? "That QR code doesn't look right. Try scanning again."
            : "Couldn't check you in. Try again or ask a librarian."
        );
      }
    } catch {
      setState("error");
      setMessage("Something went wrong reading that code.");
    }
  }

  async function handleManualSubmit() {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setState("checking-in");
    try {
      const lookup = await fetch(`/api/bookings/lookup?code=${encodeURIComponent(code)}`);
      const lookupData = await lookup.json();
      if (!lookupData.ok) {
        setState("error");
        setMessage("Couldn't find a booking with that code. Double-check and try again.");
        return;
      }

      const res = await fetch(`/api/bookings/${lookupData.bookingId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingCode: code }),
      });
      const data = await res.json();

      if (data.ok) {
        setState("success");
        setMessage("Checked in! Enjoy your session.");
      } else {
        setState("error");
        setMessage(
          data.error === "BOOKING_EXPIRED"
            ? "This booking already expired."
            : data.error === "INVALID_CODE"
            ? "That code doesn't match this booking. Try again."
            : "Couldn't check you in. Try again or ask a librarian."
        );
      }
    } catch {
      setState("error");
      setMessage("Something went wrong checking that code.");
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-8 flex flex-col items-center">
      <div className="max-w-sm w-full">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold mt-2 mb-6 text-center">Check In</h1>

        {(state === "idle" || state === "scanning" || state === "checking-in") && (
          <div className="relative rounded-xl overflow-hidden border border-neutral-800 aspect-square bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {state === "checking-in" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <p>Checking in…</p>
              </div>
            )}
            {state === "scanning" && (
              <div className="absolute inset-0 border-4 border-accent/50 m-8 rounded-lg pointer-events-none" />
            )}
          </div>
        )}

        {state === "success" && (
          <div className="text-center py-10">
            <div className="text-green-400 text-5xl mb-3">✓</div>
            <p>{message}</p>
          </div>
        )}

        {state === "error" && (
          <div className="text-center py-6">
            <p className="text-red-400 mb-4">{message}</p>
          </div>
        )}

        {state !== "success" && (
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <p className="text-xs text-neutral-500 text-center mb-2">
              Camera not working? Enter your booking code instead:
            </p>
            <div className="flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                placeholder="LB2-4F9K"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-center font-mono tracking-wider uppercase placeholder:text-neutral-600 focus:outline-none focus:border-accent"
                maxLength={10}
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim() || state === "checking-in"}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent rounded-lg px-4 font-medium transition-colors"
              >
                Check in
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-neutral-500 text-center mt-4">
          Point your camera at the QR code shown after booking.
        </p>
      </div>
    </main>
  );
}