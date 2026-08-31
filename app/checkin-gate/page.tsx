"use client";

import { useEffect, useState } from "react";

type GateState = "idle" | "locating" | "claiming" | "success" | "error";

const LOCATING_PHRASES = ["Finding you…", "Checking you're on campus…", "Almost there…"];
const CLAIMING_PHRASES = ["Authorizing…", "Booking your seat…", "Just a moment…", "Locking it in…"];

/** Cycles through a phrase list every ~1.1s while `active` is true. */
function usePhraseCycle(phrases: string[], active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), 1100);
    return () => clearInterval(id);
  }, [active, phrases.length]);
  return phrases[index];
}

export default function CheckinGatePage() {
  const [state, setState] = useState<GateState>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{
    passcode: string;
    seat: { floor: number; zone: string; seatCode: string };
  } | null>(null);

  const isLocating = state === "locating";
  const isClaiming = state === "claiming";
  const isBusy = isLocating || isClaiming;

  const locatingPhrase = usePhraseCycle(LOCATING_PHRASES, isLocating);
  const claimingPhrase = usePhraseCycle(CLAIMING_PHRASES, isClaiming);
  const activePhrase = isLocating ? locatingPhrase : isClaiming ? claimingPhrase : "";

  function claimSeat() {
    setState("locating");
    setMessage("");

    if (!("geolocation" in navigator)) {
      setState("error");
      setMessage("This device can't share its location. Ask a librarian for help.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState("claiming");
        try {
          const res = await fetch("/api/checkin-gate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          const data = await res.json();

          if (data.ok) {
            setResult({ passcode: data.passcode, seat: data.seat });
            setState("success");
          } else {
            setState("error");
            setMessage(
              data.error === "OUTSIDE_LIBRARY"
                ? "You don't seem to be at the library yet. Move closer and try again."
                : data.error === "NO_ACTIVE_BOOKING"
                ? "You don't have an active booking to claim."
                : data.error === "BOOKING_EXPIRED"
                ? "Your booking window already expired."
                : data.error === "NOT_LOGGED_IN"
                ? "Open the app and book a seat first."
                : "Couldn't claim your seat. Try again."
            );
          }
        } catch {
          setState("error");
          setMessage("Something went wrong. Check your connection and try again.");
        }
      },
      () => {
        setState("error");
        setMessage("Location access is required to claim your seat here. Please allow it and retry.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-neutral-100 flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {state === "idle" && (
          <>
            <PulseRing state="idle" />
            <h1 className="text-3xl font-display font-semibold mb-2 mt-6">Claim your seat</h1>
            <p className="text-neutral-400 mb-8 text-sm leading-relaxed">
              You're at the library entrance. Confirm your location to claim
              your booked seat — no code needed.
            </p>
            <button
              onClick={claimSeat}
              className="w-full bg-accent hover:bg-accent-hover rounded-xl py-4 font-medium transition-all active:scale-[0.98] shadow-lg shadow-accent/20"
            >
              Claim my seat
            </button>
          </>
        )}

        {isBusy && (
          <>
            <PulseRing state={isLocating ? "locating" : "claiming"} />
            <p key={activePhrase} className="text-lg font-medium mt-6 animate-fade-in">
              {activePhrase}
            </p>
            <p className="text-neutral-500 text-sm mt-2">
              {isLocating ? "Confirming you're on campus" : "Reserving your spot"}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-red-950 border-2 border-red-800 flex items-center justify-center text-3xl">
              ✕
            </div>
            <p className="text-red-400 text-sm mt-6 mb-6 leading-relaxed">{message}</p>
            <button
              onClick={claimSeat}
              className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-xl py-3.5 font-medium transition-colors"
            >
              Try again
            </button>
          </>
        )}

        {state === "success" && result && (
          <div className="animate-fade-in">
            <div className="relative w-24 h-24 mx-auto mb-2">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-emerald-950 border-2 border-emerald-700 flex items-center justify-center text-4xl">
                ✓
              </div>
            </div>
            <h1 className="text-3xl font-display italic font-semibold mb-1 mt-4">Seat claimed!</h1>
            <p className="text-neutral-400 mb-6 text-sm">
              Floor {result.seat.floor} · {result.seat.zone} · Seat{" "}
              {result.seat.seatCode}
            </p>
            <div className="bg-surface border border-surface-border rounded-xl py-5">
              <p className="text-xs text-neutral-500 mb-1 tracking-wide uppercase">
                Confirmation code
              </p>
              <p className="text-3xl font-mono tracking-[0.3em] text-emerald-400">
                {result.passcode}
              </p>
            </div>
            <p className="text-xs text-neutral-600 mt-4">
              Enjoy your session. This seat is now yours.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

/** Animated ring that idles, spins while working, states differ by color/speed. */
function PulseRing({ state }: { state: "idle" | "locating" | "claiming" }) {
  const ringColor =
    state === "idle" ? "border-neutral-700" : state === "locating" ? "border-blue-600" : "border-accent";

  return (
    <div className="relative w-28 h-28 mx-auto">
      {state !== "idle" && (
        <div
          className={`absolute inset-0 rounded-full border-4 border-t-transparent ${ringColor} animate-spin`}
          style={{ animationDuration: "1.1s" }}
        />
      )}
      <div
        className={`absolute inset-3 rounded-full border-2 ${ringColor} ${
          state !== "idle" ? "animate-pulse" : ""
        } flex items-center justify-center bg-surface`}
      >
        <span className="text-3xl">{state === "idle" ? "📍" : state === "locating" ? "🛰️" : "🎫"}</span>
      </div>
    </div>
  );
}