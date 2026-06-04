import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  /** Current value (string of up to `length` digits). */
  value: string;
  /** Called with the new full value on every change. */
  onChange: (value: string) => void;
  /** Called once when all `length` digits are filled. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * Accessible 6-box one-time-code input.
 *
 * - auto-focuses the first box on mount
 * - auto-advances focus on digit entry
 * - backspace clears the current box, then moves to the previous one
 * - paste distributes digits across the boxes
 * - fires `onComplete` once every box is filled
 *
 * Styled to match the existing auth OTP boxes (Tailwind + design tokens).
 */
export function OTPInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  error = false,
  autoFocus = true,
}: OTPInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const emit = (next: string) => {
    onChange(next);
    if (next.length === length && !next.includes(' ') && next.replace(/\D/g, '').length === length) {
      onComplete?.(next);
    }
  };

  const setDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const arr = Array.from({ length }, (_, i) => value[i] ?? '');
    arr[index] = digit;
    const next = arr.join('').replace(/\s/g, '');
    emit(next);
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const onKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = Array.from({ length }, (_, i) => value[i] ?? '');
      if (arr[index]) {
        arr[index] = '';
        emit(arr.join(''));
      } else if (index > 0) {
        arr[index - 1] = '';
        emit(arr.join(''));
        inputs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    emit(pasted);
    inputs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div
      className="flex justify-center gap-2"
      role="group"
      aria-label={`Enter the ${length}-digit verification code`}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={d}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-12 w-11 md:h-14 md:w-12 text-center text-lg font-bold rounded-xl border bg-card',
            'focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-destructive' : 'border-border',
          )}
        />
      ))}
    </div>
  );
}

export default OTPInput;
