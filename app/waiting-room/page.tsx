"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      router.replace("/");
      return;
    }

    const sessionRef = ref(db, `sessions/${code}`);
    const unsubscribe = onValue(
      sessionRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("This session no longer exists.");
          return;
        }
        const session = snapshot.val();
        if (session.status === "active" || session.guest) {
          router.push(`/swipe?code=${code}&role=${role ?? "host"}`);
        }
      },
      () => setError("Lost connection to the session.")
    );

    return () => unsubscribe();
  }, [code, role, router]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <p className="text-neutral-500">Share this code with your co-eater</p>
      <p className="text-7xl font-bold tracking-widest">{code}</p>
      <p className="text-neutral-500 animate-pulse">Waiting for them to join…</p>
    </main>
  );
}

export default function WaitingRoom() {
  return (
    <Suspense fallback={null}>
      <WaitingRoomContent />
    </Suspense>
  );
}
