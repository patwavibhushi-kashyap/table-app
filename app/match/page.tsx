"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { getDishById } from "@/lib/dishes";
import { getDishPhoto } from "@/lib/unsplash";
import type { SessionData, SessionRole } from "@/lib/session";

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const role: SessionRole = searchParams.get("role") === "guest" ? "guest" : "host";
  const dishId = searchParams.get("dish");

  const [session, setSession] = useState<SessionData | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const dish = dishId ? getDishById(dishId) : undefined;

  useEffect(() => {
    if (!dish) return;
    getDishPhoto(dish.id, dish.unsplash_search).then(setPhotoUrl);
  }, [dish]);

  // Stay in sync with the peer: once matchedDish is cleared in Firebase (by either
  // side clicking "Keep swiping"), both devices head back to the swipe screen together.
  useEffect(() => {
    if (!code) {
      router.replace("/");
      return;
    }
    const sessionRef = ref(db, `sessions/${code}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        router.replace("/");
        return;
      }
      const data = snapshot.val() as SessionData;
      setSession(data);
      if (!data.matchedDish) {
        router.push(`/swipe?code=${code}&role=${role}`);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  function handleKeepSwiping() {
    if (!code || !dishId) return;
    // Only write to Firebase here — navigation happens once via the onValue listener
    // above, which both devices share. Pushing here too races that listener's own
    // push for the same route and can abort the in-flight RSC navigation.
    // Recording this dish in dismissedMatches keeps the swipe screen's match detector
    // from instantly re-matching on the same mutual yes.
    const newStatus = session?.guest ? "active" : "solo";
    update(ref(db, `sessions/${code}`), {
      matchedDish: null,
      status: newStatus,
      [`dismissedMatches/${dishId}`]: true,
    });
  }

  function handleFindOnZomato() {
    if (!dish) return;
    window.open(
      `https://www.zomato.com/search?q=${encodeURIComponent(dish.zomato_search)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!dish) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-neutral-400">Loading match...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-orange-400 font-semibold">You both want</p>
      <h1 className="text-4xl font-bold">{dish.name}</h1>
      <span className="w-fit rounded-full bg-orange-500/20 px-3 py-1 text-sm text-orange-400">
        {dish.cuisine}
      </span>

      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={dish.name}
          className="h-80 w-full max-w-sm rounded-2xl object-cover"
        />
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleFindOnZomato}
          className="rounded-full bg-orange-500 px-6 py-3 font-semibold text-white"
        >
          Find it on Zomato
        </button>
        <button
          onClick={handleKeepSwiping}
          className="rounded-full border border-neutral-700 px-6 py-3 font-semibold text-neutral-300"
        >
          Keep swiping
        </button>
      </div>
    </main>
  );
}

export default function Match() {
  return (
    <Suspense fallback={null}>
      <MatchContent />
    </Suspense>
  );
}
