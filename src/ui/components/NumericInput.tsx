import { useEffect, useRef, useState, type ComponentProps } from 'react';

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number;
  min: number;
  max?: number;
  onChange?: (value: number) => void;
};

export function NumericInput({ value, min, max, onChange, onBlur, ...props }: Props) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);
  const emitted = useRef<number[]>([]);
  const lastValid = useRef(value);

  useEffect(() => {
    if (editing.current && emitted.current.includes(value)) return;
    emitted.current = [];
    lastValid.current = value;
    setText(String(value));
  }, [value]);

  const emit = (next: number) => {
    lastValid.current = next;
    emitted.current.push(next);
    onChange?.(next);
  };

  return (
    <input
      {...props} type="number" min={min} max={max} value={text}
      onFocus={(event) => { editing.current = true; props.onFocus?.(event); }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next) && next >= min && (max === undefined || next <= max)) emit(next);
      }}
      onBlur={(event) => {
        editing.current = false;
        const entered = event.target.valueAsNumber;
        const next = Number.isFinite(entered) ? Math.min(max ?? Infinity, Math.max(min, entered)) : lastValid.current;
        setText(String(next));
        if (next !== lastValid.current) emit(next);
        onBlur?.(event);
      }}
    />
  );
}
