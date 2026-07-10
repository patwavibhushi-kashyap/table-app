"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, onValue, set, update, onDisconnect } from "firebase/database";
import { db } from "@/lib/firebase";
import { getDishById } from "@/lib/dishes";
import { getDishPhoto, preloadImage } from "@/lib/unsplash";
import { useSwipeStore } from "@/store/useSwipeStore";
import type { SessionData, SessionRole } from "@/lib/session";

const PRELOAD_COUNT = 15;
const SWIPE_THRESHOLD = 100;
const THROW_DISTANCE = 600;
const ANIMATION_MS = 250;

function SwipeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const role: SessionRole = searchParams.get("role") === "guest" ? "guest" : "host";

  const [session, setSession] = useState<SessionData | null>(null);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [photosReady, setPhotosReady] = useState(false);

  const { currentIndex, direction, dragX, setCurrentIndex, advance, setDirection, setDragX, reset } =
    useSwipeStore();

  const dishOrderKeyRef = useRef<string | null>(null);
  const matchNavigatedRef = useRef(false);
  const disconnectSetRef = useRef(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  // Main session listener: syncs session state, kicks off photo preload on a new dish
  // order, promotes to solo mode, detects matches, and detects exhaustion.
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

      const dishOrder = data.dishOrder ?? [];
      const dishOrderKey = dishOrder.join(",");
      const ownSwipes = data.swipes?.[role] ?? {};

      if (dishOrderKey !== dishOrderKeyRef.current) {
        dishOrderKeyRef.current = dishOrderKey;
        matchNavigatedRef.current = false;
        reset();
        setCurrentIndex(Object.keys(ownSwipes).length);

        setPhotosReady(false);
        const preloadIds = dishOrder.slice(0, PRELOAD_COUNT);
        Promise.all(
          preloadIds.map(async (id) => {
            const dish = getDishById(id);
            if (!dish) return;
            const url = await getDishPhoto(id, dish.unsplash_search);
            await preloadImage(url);
            setPhotoMap((prev) => ({ ...prev, [id]: url }));
          })
        ).finally(() => setPhotosReady(true));
      }

      // Host manages the transition to solo mode when guest presence disappears.
      if (role === "host" && data.status === "active" && !data.guest) {
        update(ref(db, `sessions/${code}`), { status: "solo" });
      }

      // Mutual-yes match detection for two-person mode. Solo mode resolves matches
      // directly at swipe time instead (see commitSwipe below). Dishes already matched
      // and dismissed via "Keep swiping" are excluded — otherwise the same mutual yes
      // that produced the original match would instantly re-match the moment both
      // devices land back here.
      if (data.status === "active" && !data.matchedDish) {
        const hostSwipes = data.swipes?.host ?? {};
        const guestSwipes = data.swipes?.guest ?? {};
        const dismissed = data.dismissedMatches ?? {};
        const matchedId = Object.keys(hostSwipes).find(
          (id) => hostSwipes[id] === true && guestSwipes[id] === true && !dismissed[id]
        );
        if (matchedId) {
          update(ref(db, `sessions/${code}`), { matchedDish: matchedId, status: "matched" });
        }
      }

      // Both devices react to `matchedDish` appearing in Firebase — this is what makes
      // host and guest land on the match screen at the same moment, regardless of which
      // one actually detected and wrote the match.
      if (data.matchedDish && !matchNavigatedRef.current) {
        matchNavigatedRef.current = true;
        router.push(`/match?code=${code}&role=${role}&dish=${data.matchedDish}`);
        return;
      }

      if (!data.matchedDish && dishOrder.length > 0 && Object.keys(ownSwipes).length >= dishOrder.length) {
        router.push(`/no-match?code=${code}&role=${role}`);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role]);

  // Guest registers an onDisconnect cleanup so the host can detect a drop and go solo.
  useEffect(() => {
    if (!code || role !== "guest" || disconnectSetRef.current) return;
    disconnectSetRef.current = true;
    onDisconnect(ref(db, `sessions/${code}/guest`)).remove();
  }, [code, role]);

  const dishOrder = session?.dishOrder ?? [];
  const dishId = dishOrder[currentIndex];
  const dish = dishId ? getDishById(dishId) : undefined;

  // Lazily preload photos for dishes reached beyond the initial preload batch.
  useEffect(() => {
    if (!dishId || photoMap[dishId]) return;
    const currentDish = getDishById(dishId);
    if (!currentDish) return;
    let cancelled = false;
    getDishPhoto(dishId, currentDish.unsplash_search).then((url) => {
      if (cancelled) return;
      preloadImage(url).then(() => {
        if (!cancelled) setPhotoMap((prev) => ({ ...prev, [dishId]: url }));
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId]);

  function writeSwipe(id: string, liked: boolean) {
    if (!code) return;
    set(ref(db, `sessions/${code}/swipes/${role}/${id}`), liked).then(() => {
      if (liked && session?.status === "solo") {
        update(ref(db, `sessions/${code}`), { matchedDish: id, status: "matched" });
      }
    });
  }

  function commitSwipe(liked: boolean) {
    if (!dishId) return;
    setDirection(liked ? "right" : "left");
    writeSwipe(dishId, liked);
    setTimeout(() => advance(), ANIMATION_MS);
  }

  function onPointerDown(e: ReactPointerEvent) {
    draggingRef.current = true;
    startXRef.current = e.clientX;
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!draggingRef.current) return;
    setDragX(e.clientX - startXRef.current);
  }
  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragX > SWIPE_THRESHOLD) commitSwipe(true);
    else if (dragX < -SWIPE_THRESHOLD) commitSwipe(false);
    else setDragX(0);
  }

  if (!code) return null;

  const loading = !session || dishOrder.length === 0 || !photosReady;

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-neutral-400 animate-pulse">Getting your dishes ready...</p>
      </main>
    );
  }

  if (!dish) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-neutral-400 animate-pulse">Loading next dish...</p>
      </main>
    );
  }

  const photoUrl = photoMap[dishId];
  const isSolo = session?.status === "solo";

  const transform = direction
    ? `translateX(${direction === "right" ? THROW_DISTANCE : -THROW_DISTANCE}px) rotate(${
        direction === "right" ? 25 : -25
      }deg)`
    : `translateX(${dragX}px) rotate(${dragX / 20}deg)`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      {isSolo && role === "host" && (
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
          flying solo
        </span>
      )}

      <p className="text-sm text-neutral-500">
        Dish {currentIndex + 1} of {dishOrder.length}
      </p>

      <div
        className="relative w-full max-w-sm touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          transform,
          opacity: direction ? 0 : 1,
          transition: draggingRef.current ? "none" : `transform ${ANIMATION_MS}ms ease-out, opacity ${ANIMATION_MS}ms ease-out`,
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={dish.name} className="h-80 w-full object-cover" draggable={false} />
          )}
          <div className="flex flex-col gap-1 p-4">
            <h2 className="text-2xl font-bold text-white">{dish.name}</h2>
            <span className="w-fit rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
              {dish.cuisine}
            </span>
            <p className="text-sm text-neutral-400">{dish.description}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <button
          onClick={() => commitSwipe(false)}
          aria-label="No"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-700 text-2xl"
        >
          ✗
        </button>
        <button
          onClick={() => commitSwipe(true)}
          aria-label="Yes"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-2xl text-white"
        >
          ✓
        </button>
      </div>
    </main>
  );
}

export default function Swipe() {
  return (
    <Suspense fallback={null}>
      <SwipeContent />
    </Suspense>
  );
}
