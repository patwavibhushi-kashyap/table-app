import { ref, get, update, runTransaction, serverTimestamp } from "firebase/database";
import { db } from "./firebase";
import { shuffleDishIds } from "./dishes";

export type SessionStatus = "waiting" | "active" | "matched" | "solo";

export type SessionRole = "host" | "guest";

export interface SessionData {
  status: SessionStatus;
  createdAt: number;
  host?: { joinedAt: number };
  guest?: { joinedAt: number };
  dishOrder?: string[];
  swipes?: {
    host?: Record<string, boolean>;
    guest?: Record<string, boolean>;
  };
  matchedDish?: string | null;
  // Dishes both people already matched on and dismissed via "Keep swiping" — excluded
  // from future match detection so the same mutual yes doesn't instantly re-match.
  dismissedMatches?: Record<string, boolean>;
}

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function createSession(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const sessionRef = ref(db, `sessions/${code}`);
    const snapshot = await get(sessionRef);
    if (!snapshot.exists()) {
      await update(sessionRef, {
        status: "waiting",
        createdAt: serverTimestamp(),
        host: { joinedAt: serverTimestamp() },
        dishOrder: shuffleDishIds(),
      });
      return code;
    }
  }
  throw new Error("Could not generate a unique session code. Try again.");
}

export async function reshuffleSession(code: string): Promise<void> {
  await update(ref(db, `sessions/${code}`), {
    dishOrder: shuffleDishIds(),
    swipes: null,
    matchedDish: null,
    dismissedMatches: null,
  });
}

export async function joinSession(code: string): Promise<void> {
  const sessionRef = ref(db, `sessions/${code}`);
  const snapshot = await get(sessionRef);
  if (!snapshot.exists()) {
    throw new Error("That code doesn't exist. Double check and try again.");
  }

  // Transact on `status` so two guests racing to join the same code can't both succeed.
  // The update function can fire speculatively with `null` before the SDK has a locally
  // cached value for this path (even though the server value is "waiting" — confirmed by
  // the `get()` above), so only abort when we've seen a concrete non-waiting status.
  const statusRef = ref(db, `sessions/${code}/status`);
  const result = await runTransaction(statusRef, (currentStatus) => {
    if (currentStatus === "waiting" || currentStatus === null || currentStatus === undefined) {
      return "active";
    }
    return; // abort: already active/matched/solo
  });

  if (!result.committed) {
    throw new Error("That session already has two people in it.");
  }

  await update(sessionRef, {
    guest: { joinedAt: serverTimestamp() },
  });
}
