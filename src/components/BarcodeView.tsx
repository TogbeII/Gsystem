import React from "react";

// Standard Code 128B patterns (107 patterns, indexed 0-106)
// Each pattern describes the widths of 3 bars and 3 spaces (sum = 11 modules), except Stop (13 modules).
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (104=StartB, 106=Stop)
];

const START_B = 104;
const STOP = 106;

export function encodeCode128B(text: string): string | null {
  if (!text) return null;
  // Code 128B encodes ASCII 32 to 126
  const clean = text.trim();
  if (clean.length === 0) return null;

  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    let codeVal = charCode - 32;
    if (codeVal < 0 || codeVal > 95) {
      // Fallback mapping for unsupported chars
      codeVal = 0; // Space
    }
    codes.push(codeVal);
    checksum += codeVal * (i + 1);
  }

  const checkVal = checksum % 103;
  codes.push(checkVal);
  codes.push(STOP);

  // Convert codes to bar/space string of widths
  let patternStr = "";
  for (const c of codes) {
    patternStr += CODE128_PATTERNS[c] || "";
  }

  return patternStr;
}

interface BarcodeSvgProps {
  value: string;
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 40,
  barWidth = 1.5,
  showText = true,
  className = "",
  textClassName = ""
}) => {
  const pattern = encodeCode128B(value || "000000");

  if (!pattern) {
    return (
      <div className="flex flex-col items-center justify-center p-2 bg-slate-100 rounded text-slate-400 font-mono text-xs">
        [No Barcode Value]
      </div>
    );
  }

  // Parse pattern into rectangles
  const rects: { x: number; width: number }[] = [];
  let currentX = 10; // Left quiet zone
  let isBar = true;

  for (let i = 0; i < pattern.length; i++) {
    const width = parseInt(pattern[i], 10) * barWidth;
    if (isBar) {
      rects.push({ x: currentX, width });
    }
    currentX += width;
    isBar = !isBar;
  }

  const totalWidth = currentX + 10; // Right quiet zone
  const svgHeight = showText ? height + 16 : height;

  return (
    <div className={`inline-flex flex-col items-center select-none bg-white p-1 rounded ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        width={totalWidth}
        height={svgHeight}
        className="max-w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={totalWidth} height={svgHeight} fill="#ffffff" />
        {rects.map((r, idx) => (
          <rect
            key={idx}
            x={r.x}
            y={2}
            width={r.width}
            height={height}
            fill="#0f172a"
          />
        ))}
        {showText && (
          <text
            x={totalWidth / 2}
            y={height + 13}
            textAnchor="middle"
            fill="#334155"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            {value}
          </text>
        )}
      </svg>
    </div>
  );
};
