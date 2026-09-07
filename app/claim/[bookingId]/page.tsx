"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IconMapPin, IconSatellite, IconTicket, IconClose, IconCheck } from "@/lib/icons";

type GateState = "loading" | "idle" | "locating" | "claiming" | "success" | "error";

const LOCATING_PHRASES = ["Finding you…", "Checking you're on campus…", "Almost there…"];
const CLAIMING_PHRASES = ["Authorizing…", "Booking your seat…", "Just a moment…", "Locking it in…"];

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

export default function ClaimSeatPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [state, setState] = useState<GateState>("loading");
  const [message, setMessage] = useState("");
  const [seatPreview, setSeatPreview] = useState<{ floor: number; zone: string; seatCode: string } | null>(null);
  const [result, setResult] = useState<{ passcode: string; seat: { floor: number; zone: string; seatCode: string } } | null>(null);

  const isLocating = state === "locating";
  const isClaiming = state === "claiming";
  const locatingPhrase = usePhraseCycle(LOCATING_PHRASES, isLocating);
  const claimingPhrase = usePhraseCycle(CLAIMING_PHRASES, isClaiming);
  const activePhrase = isLocating ? locatingPhrase : isClaiming ? claimingPhrase : "";

  useEffect(() => {
    fetch(`/api/claim/${bookingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSeatPreview(data.seat);
          setState(data.status === "ACTIVE" ? "idle" : "error");
          if (data.status !== "ACTIVE") {
            setMessage(
              data.status === "CHECKED_IN"
                ? "This seat has already been claimed."
                : "This booking is no longer active."
            );
          }
        } else {
          setState("error");
          setMessage("This claim link isn't valid.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Couldn't load this seat. Check your connection.");
      });
  }, [bookingId]);

  function claim() {
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
          const res = await fetch(`/api/claim/${bookingId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
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
                : data.error === "NOT_CLAIMABLE"
                ? "This seat has already been claimed or cancelled."
                : data.error === "BOOKING_EXPIRED"
                ? "This booking's window already expired."
                : "Couldn't claim this seat. Try again."
            );
          }
        } catch {
          setState("error");
          setMessage("Something went wrong. Check your connection and try again.");
        }
      },
      () => {
        setState("error");
        setMessage("Location access is required to claim this seat. Please allow it and retry.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {state === "loading" && <p className="text-neutral-500 text-sm">Loading…</p>}

        {state === "idle" && seatPreview && (
          <>
            <IconMapPin width={44} height={44} className="mx-auto text-accent mb-4" />
            <h1 className="text-3xl font-display font-semibold mb-1">Claim your seat</h1>
            <p className="text-neutral-400 mb-2 text-sm">
              Floor {seatPreview.floor} · {seatPreview.zone} · Seat {seatPreview.seatCode}
            </p>
            <p className="text-neutral-500 mb-8 text-sm leading-relaxed">
              This seat was reserved for you as part of a group booking.
            </p>
            <button
              onClick={claim}
              className="w-full bg-accent hover:bg-accent-hover rounded-xl py-4 font-medium transition-all active:scale-[0.98]"
            >
              Claim this seat
            </button>
          </>
        )}

        {(isLocating || isClaiming) && (
          <>
            {isLocating ? (
              <IconSatellite width={40} height={40} className="mx-auto text-blue-500 animate-pulse mb-4" />
            ) : (
              <IconTicket width={40} height={40} className="mx-auto text-accent animate-pulse mb-4" />
            )}
            <p key={activePhrase} className="text-lg font-medium animate-fade-in">{activePhrase}</p>
          </>
        )}

        {state === "error" && (
          <>
            <IconClose width={40} height={40} className="mx-auto text-danger mb-4" />
            <p className="text-red-400 text-sm mb-6">{message}</p>
            {seatPreview && (
              <button
                onClick={claim}
                className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-xl py-3.5 font-medium transition-colors"
              >
                Try again
              </button>
            )}
          </>
        )}

        {state === "success" && result && (
          <div className="animate-fade-in">
            <IconCheck width={44} height={44} className="mx-auto text-success mb-4" />
            <h1 className="text-3xl font-display font-semibold mb-1">Seat claimed!</h1>
            <p className="text-neutral-400 mb-6 text-sm">
              Floor {result.seat.floor} · {result.seat.zone} · Seat {result.seat.seatCode}
            </p>
            <div className="bg-surface border border-surface-border rounded-xl py-5">
              <p className="text-xs text-neutral-500 mb-1 tracking-wide">Confirmation code</p>
              <p className="text-3xl font-mono tracking-[0.3em] text-success">{result.passcode}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}