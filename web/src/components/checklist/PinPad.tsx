interface PinPadProps {
  pin: string;
  error: string;
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBack: () => void;
}

export function PinPad({ pin, error, onDigit, onClear, onBack }: PinPadProps) {
  const pinDisplay = [0, 1, 2, 3].map((i) => pin[i] ?? "•");

  return (
    <>
      <div className="pin-display" aria-live="polite">
        {pinDisplay.map((d, idx) => (
          <span key={idx}>{d}</span>
        ))}
      </div>
      {error && <p className="pin-error">{error}</p>}
      <div className="pin-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map(
          (key) => (
            <button
              key={key}
              type="button"
              className="pin-key"
              onClick={() => {
                if (key === "clear") onClear();
                else if (key === "back") onBack();
                else onDigit(key);
              }}
            >
              {key === "clear" ? "C" : key === "back" ? "←" : key}
            </button>
          ),
        )}
      </div>
    </>
  );
}
