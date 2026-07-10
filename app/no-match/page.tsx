"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { dishes } from "@/lib/dishes";
import { reshuffleSession } from "@/lib/session";
import type { SessionData, SessionRole } from "@/lib/session";

const TOTAL_DISHES = dishes.length;

function NoMatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const role: SessionRole = searchParams.get("role") === "guest" ? "guest" : "host";

  // Safety net: if a match appears (peer's swipe completed the match right as we
  // exhausted our pile) or someone else already reshuffled, follow them there.
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
      if (data.matchedDish) {
        router.push(`/match?code=${code}&role=${role}&dish=${data.matchedDish}`);
        return;
      }
      const ownCount = Object.keys(data.swipes?.[role] ?? {}).length;
      if (ownCount < TOTAL_DISHES) {
        router.push(`/swipe?code=${code}&role=${role}`);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  async function handleReshuffle() {
    if (!code) return;
    // Only write to Firebase here — navigation happens via the onValue listener
    // above (own swipe count drops below TOTAL_DISHES once cleared), which both
    // devices share. Pushing here too races that listener's own push.
    await reshuffleSession(code);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-bold">No match</h1>
      <p className="max-w-sm text-neutral-400">
        85 dishes and you couldn&apos;t agree on one? Iconic.
      </p>
      <button
        onClick={handleReshuffle}
        className="rounded-full bg-orange-500 px-6 py-3 font-semibold text-white"
      >
        Reshuffle and go again
      </button>
    </main>
  );
}

export default function NoMatch() {
  return (
    <Suspense fallback={null}>
      <NoMatchContent />
    </Suspense>
  );
}
