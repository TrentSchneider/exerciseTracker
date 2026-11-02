import { useEffect, useRef, useState } from 'react';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return null;
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // audio is best-effort
  }
}

function tone(freq: number, startOffset: number, length: number, volume = 0.3) {
  const c = context();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(c.destination);
    const t = c.currentTime + startOffset;
    osc.start(t);
    osc.stop(t + length);
  } catch {
    /* audio is best-effort */
  }
}

/** One short tick per countdown number. */
export const playTick = () => tone(660, 0, 0.15);
/** Higher, longer tone signalling "go". */
export const playGo = () => tone(1100, 0, 0.5);
/** Timer finished: three quick beeps. */
export function playTimerEnd() {
  navigator.vibrate?.([200, 100, 200]);
  [0, 0.3, 0.6].forEach((o) => tone(880, o, 0.2));
}

export const COUNTDOWN_SECONDS = 3;

/**
 * Runs a 3-2-1 countdown with an audio cue per number and a final "go" cue whenever `active` becomes true.
 * Returns the number currently shown, or null when idle.
 */
export function useCountdown(active: boolean, onComplete: () => void): number | null {
  const [n, setN] = useState<number | null>(null);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    if (!active) {
      setN(null);
      return;
    }
    let k = COUNTDOWN_SECONDS;
    setN(k);
    playTick();
    const t = setInterval(() => {
      k -= 1;
      if (k > 0) {
        setN(k);
        playTick();
      } else {
        clearInterval(t);
        setN(null);
        playGo();
        doneRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  return n;
}
