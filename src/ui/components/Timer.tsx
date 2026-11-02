import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../domain/units';
import { playTimerEnd, useCountdown } from '../audio';

/**
 * Countdown timer with an editable duration. Used for rest between sets and for timed exercises.
 * Uses wall-clock end time so it stays accurate when the tab is throttled.
 */
export function Timer({ label, seconds, autoStart = false, countdown = false, paused = false, onDone, onSkip, skipLabel = 'Skip' }: {
  label: string;
  seconds: number;
  autoStart?: boolean;
  countdown?: boolean; // run an audible 3-2-1 before each start/resume
  paused?: boolean; // freezes the countdown (workout paused); resumes where it left off
  onDone?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const [duration, setDuration] = useState(seconds);
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const [counting, setCounting] = useState(false);
  const count = useCountdown(counting, () => { setCounting(false); setRunning(true); });
  const endRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setDuration(seconds);
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!running || paused) return;
    endRef.current = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        setRunning(false);
        playTimerEnd();
        doneRef.current?.();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused]);

  const adjust = (delta: number) => {
    const next = Math.max(5, duration + delta);
    setDuration(next);
    setRemaining((r) => Math.max(0, r + delta));
    if (running) endRef.current += delta * 1000;
  };

  const reset = () => {
    setCounting(false);
    setRunning(false);
    setRemaining(duration);
  };

  return (
    <div className="timer" role="timer" aria-label={label}>
      <div className="timer-label">{label}</div>
      <div className="timer-display" aria-live="off">{count ?? formatClock(remaining)}</div>
      <div className="timer-row">
        <button type="button" onClick={() => adjust(-15)} aria-label="Subtract 15 seconds">−15s</button>
        <label className="timer-edit">
          <span className="sr-only">Duration in seconds</span>
          <input
            type="number" min={5} step={5} value={duration} aria-label="Duration in seconds"
            onChange={(e) => {
              const v = Math.max(5, Number(e.target.value) || 5);
              setDuration(v);
              if (!running) setRemaining(v);
            }}
          /> s
        </label>
        <button type="button" onClick={() => adjust(15)} aria-label="Add 15 seconds">+15s</button>
      </div>
      <div className="timer-row">
        <button type="button" className="primary" onClick={() => {
          if (counting) setCounting(false);
          else if (running) setRunning(false);
          else if (countdown) setCounting(true);
          else setRunning(true);
        }}>
          {counting ? 'Cancel' : running ? 'Pause' : remaining < duration && remaining > 0 ? 'Resume' : 'Start'}
        </button>
        <button type="button" onClick={reset}>Reset</button>
        {onSkip && <button type="button" onClick={onSkip}>{skipLabel}</button>}
      </div>
    </div>
  );
}
