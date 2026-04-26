import type { Card } from "@shared/schema";

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function issuerLabel(cardType: string): string {
  switch (cardType) {
    case "visa": return "VISA";
    case "mastercard": return "MASTERCARD";
    case "amex": return "AMEX";
    case "discover": return "DISCOVER";
    default: return cardType.toUpperCase();
  }
}

export default function CreditCardFace({ card, onClick }: { card: Card; onClick?: () => void }) {
  const baseColor = card.color;
  const darkColor = darkenHex(baseColor, 40);

  return (
    <div
      className="relative w-full overflow-hidden cursor-pointer select-none"
      style={{
        aspectRatio: "1.586",
        borderRadius: 18,
        background: `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
      onClick={onClick}
      data-testid={`card-face-${card.id}`}
    >
      {/* Shine / gloss overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)",
          borderRadius: 18,
        }}
      />
      {/* Top gloss bar */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "40%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 100%)",
          borderRadius: "18px 18px 0 0",
        }}
      />

      {/* Card content */}
      <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
        {/* Top row: Issuer logo + network */}
        <div className="flex items-start justify-between">
          <span
            className="text-base font-extrabold tracking-[0.15em] uppercase"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {issuerLabel(card.cardType)}
          </span>
          <span
            className="text-[10px] font-bold tracking-widest uppercase opacity-60"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          >
            {card.issuer}
          </span>
        </div>

        {/* Middle row: Chip + card number */}
        <div className="flex items-center gap-4">
          {/* Chip graphic — gold rounded rectangle */}
          <svg width="46" height="34" viewBox="0 0 46 34" fill="none">
            <rect x="1" y="1" width="44" height="32" rx="6" fill="url(#chipGold)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            <line x1="1" y1="17" x2="45" y2="17" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
            <line x1="23" y1="1" x2="23" y2="33" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
            <defs>
              <linearGradient id="chipGold" x1="0" y1="0" x2="46" y2="34" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d4a843" />
                <stop offset="50%" stopColor="#f0d58c" />
                <stop offset="100%" stopColor="#c9972e" />
              </linearGradient>
            </defs>
          </svg>
          <p
            className="font-mono text-[15px] tracking-[0.2em] opacity-85"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
          >
            &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {card.last4}
          </p>
        </div>

        {/* Bottom row: Cardholder + limit */}
        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-sm font-semibold leading-tight truncate max-w-[180px]"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
            >
              {card.name}
            </p>
            <p className="text-[9px] font-medium tracking-[0.2em] uppercase opacity-45 mt-0.5">
              BUSINESS CREDIT
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-medium tracking-widest uppercase opacity-45">Limit</p>
            <p
              className="text-base font-bold"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
            >
              ${card.creditLimit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
