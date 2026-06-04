import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
    value: string;
    onChange: (val: string) => void;
    hasError: boolean;
    disabled: boolean;
}

export function OtpInput({ value, onChange, hasError, disabled }: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        // Auto-focus first input on mount
        if (inputRefs.current[0] && !disabled) {
            inputRefs.current[0].focus();
        }
    }, [disabled]);

    const handleChange = (index: number, digit: string) => {
        if (disabled) return;

        // Only allow digits
        if (digit && !/^\d$/.test(digit)) return;

        const newValue = value.split('');
        newValue[index] = digit;

        // Pad with spaces to maintain 6 characters
        while (newValue.length < 6) newValue.push('');

        onChange(newValue.join(''));

        // Auto-focus next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        if (e.key === 'Backspace') {
            const newValue = value.split('');

            if (!newValue[index] && index > 0) {
                // Current is empty, go back and clear previous
                newValue[index - 1] = '';
                onChange(newValue.join(''));
                inputRefs.current[index - 1]?.focus();
            } else {
                // Clear current
                newValue[index] = '';
                onChange(newValue.join(''));
            }

            e.preventDefault();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

        if (pastedData.length === 6) {
            onChange(pastedData);
            // Focus last input
            inputRefs.current[5]?.focus();
        }
    };

    return (
        <div className={`flex gap-2 justify-center ${hasError ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[index] || ''}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`
            w-12 h-14 text-center text-2xl font-bold rounded-lg
            outline-none transition-all
            ${hasError
                            ? 'border-2 border-red-500 ring-2 ring-red-200'
                            : 'border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                        }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
                />
            ))}
        </div>
    );
}
