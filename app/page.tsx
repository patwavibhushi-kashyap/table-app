"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession, joinSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "join">("choice");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const newCode = await createSession();
      router.push(`/waiting-room?code=${newCode}&role=host`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) {
      setError("Enter a 4-digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await joinSession(code);
      router.push(`/swipe?code=${code}&role=guest`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center">
      <main className="flex min-h-screen w-full max-w-[390px] flex-col px-7 pb-12 pt-24">
        <div className="w-full text-center">
          <h1 className="text-8xl font-black leading-none tracking-tighter">
            TABLE
          </h1>
          <p className="mt-6 text-center text-lg font-light text-neutral-400">
            swipe dishes. match tastes. eat.
          </p>
        </div>

        <div className="flex-1" />

        {mode === "choice" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-semibold text-white transition-opacity disabled:opacity-50"
            >
              Create a session
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={loading}
              className="w-full rounded-2xl border border-neutral-700 px-6 py-4 text-base font-semibold text-neutral-300 transition-opacity disabled:opacity-50"
            >
              Join a session
            </button>
          </div>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="4-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-6 py-4 text-center text-2xl tracking-widest text-white outline-none focus:border-neutral-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-base font-semibold text-white transition-opacity disabled:opacity-50"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choice");
                setError(null);
              }}
              className="py-2 text-sm text-neutral-400"
            >
              Back
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}
      </main>
    </div>
  );
}
