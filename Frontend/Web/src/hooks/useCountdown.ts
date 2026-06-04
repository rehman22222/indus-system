import { useState, useEffect, useCallback } from 'react';

export function useCountdown(initialSeconds: number) {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (!isRunning || seconds <= 0) {
            if (seconds <= 0 && isRunning) setIsRunning(false);
            return;
        }
        const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [seconds, isRunning]);

    const start = useCallback(() => {
        setSeconds(initialSeconds);
        setIsRunning(true);
    }, [initialSeconds]);

    const reset = useCallback(() => {
        setSeconds(0);
        setIsRunning(false);
    }, []);

    const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    return { seconds, isRunning, formatted, start, reset };
}
