import { lightTheme, darkTheme, type ThemePalette } from '../lib/theme';

/**
 * Converts an "R G B" channel string to a CSS rgb() value.
 * Falls through to raw string for non-channel values (shadows, hex, etc.).
 */
function toCSS(value: string): string | null {
  const parts = value.split(' ');
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return null;
}

function isHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6,8}$/.test(value);
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-5 w-5 shrink-0 rounded border border-black/20"
      style={{ backgroundColor: color }}
    />
  );
}

function TokenRow({
  token,
  lightVal,
  darkVal,
}: {
  token: string;
  lightVal: string;
  darkVal: string;
}) {
  const lightRGB = toCSS(lightVal);
  const darkRGB = toCSS(darkVal);
  const lightIsHex = isHex(lightVal);
  const darkIsHex = isHex(darkVal);
  const lightColor = lightRGB ?? (lightIsHex ? lightVal : null);
  const darkColor = darkRGB ?? (darkIsHex ? darkVal : null);

  return (
    <tr className="border-t border-black/10">
      <td className="px-3 py-2 font-mono text-xs" style={{ color: '#2C2418' }}>
        {token}
      </td>
      <td className="px-3 py-2" style={{ backgroundColor: 'rgb(250, 247, 242)' }}>
        <div className="flex items-center gap-2">
          {lightColor && <Swatch color={lightColor} />}
          <span className="font-mono text-[11px]" style={{ color: '#6B5E4F' }}>
            {lightRGB ? lightVal : lightVal.length > 40 ? lightVal.slice(0, 40) + '...' : lightVal}
          </span>
        </div>
      </td>
      <td className="px-3 py-2" style={{ backgroundColor: 'rgb(19, 17, 24)' }}>
        <div className="flex items-center gap-2">
          {darkColor && <Swatch color={darkColor} />}
          <span className="font-mono text-[11px]" style={{ color: '#C0B8AE' }}>
            {darkRGB ? darkVal : darkVal.length > 40 ? darkVal.slice(0, 40) + '...' : darkVal}
          </span>
        </div>
      </td>
    </tr>
  );
}

export const ThemeDebug = () => {
  const tokens = Object.keys(lightTheme) as (keyof ThemePalette)[];

  const groups: { label: string; tokens: (keyof ThemePalette)[] }[] = [
    {
      label: 'Base',
      tokens: ['canvas', 'surface', 'ink', 'ink-light', 'ink-muted', 'ink-faint'],
    },
    {
      label: 'Warm Scale',
      tokens: ['warm-50', 'warm-100', 'warm-200', 'warm-300', 'warm-400', 'warm-500'],
    },
    {
      label: 'Spectrum',
      tokens: ['spectrum-left', 'spectrum-mid', 'spectrum-right'],
    },
    {
      label: 'Personality',
      tokens: ['lumen', 'lumen-light', 'sage', 'sage-light', 'flux', 'flux-light'],
    },
    {
      label: 'Scoring',
      tokens: ['score-bullseye', 'score-adjacent', 'score-outer', 'score-miss'],
    },
    {
      label: 'Shadows',
      tokens: ['shadow-glow', 'shadow-card', 'shadow-card-hover'],
    },
    {
      label: 'Dial',
      tokens: [
        'dial-track', 'dial-hand', 'dial-hub-fill', 'dial-hub-stroke', 'dial-hub-center',
        'dial-zone-outer', 'dial-zone-adjacent', 'dial-zone-bullseye',
        'dial-zone-label-outer', 'dial-zone-label-adjacent', 'dial-zone-label-bullseye',
      ],
    },
    {
      label: 'Utility',
      tokens: ['focus-ring', 'selection-bg', 'canvas-hex'],
    },
  ];

  // Catch any tokens not in a group
  const grouped = new Set(groups.flatMap((g) => g.tokens));
  const ungrouped = tokens.filter((t) => !grouped.has(t));
  if (ungrouped.length > 0) {
    groups.push({ label: 'Other', tokens: ungrouped });
  }

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{ backgroundColor: '#E8E4DE', color: '#2C2418' }}
    >
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight">Theme Debug</h1>
        <p className="mt-1 text-sm" style={{ color: '#6B5E4F' }}>
          All {tokens.length} tokens &mdash; light vs dark side by side
        </p>

        {groups.map((group) => (
          <div key={group.label} className="mt-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest" style={{ color: '#9C8E7D' }}>
              {group.label}
            </h2>
            <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg text-left">
              <thead>
                <tr>
                  <th
                    className="w-[28%] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: '#F0ECE6', color: '#9C8E7D' }}
                  >
                    Token
                  </th>
                  <th
                    className="w-[36%] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: 'rgb(250, 247, 242)', color: '#9C8E7D' }}
                  >
                    Light
                  </th>
                  <th
                    className="w-[36%] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: 'rgb(19, 17, 24)', color: '#887F77' }}
                  >
                    Dark
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.tokens.map((token) => (
                  <TokenRow
                    key={token}
                    token={token}
                    lightVal={lightTheme[token]}
                    darkVal={darkTheme[token]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </main>
  );
};
