export const DEFAULT_OCTAVE = 5;

export function buildKeyMap(octave = DEFAULT_OCTAVE) {
  const notesByKey = {
    a: "C",
    w: "C#",
    s: "D",
    e: "D#",
    d: "E",
    f: "F",
    t: "F#",
    g: "G",
    y: "G#",
    h: "A",
    u: "A#",
    j: "B",
  };

  return Object.fromEntries(
    Object.entries(notesByKey).map(([key, note]) => [key, `${note}${octave}`]),
  );
}

export function normalizePitchOctave(pitch, octave = DEFAULT_OCTAVE) {
  if (!pitch) return pitch;

  const match = /^([A-G](?:#|b)?)(\d+)$/i.exec(pitch);
  if (!match) return pitch;

  const [, noteName] = match;
  return `${noteName}${octave}`;
}

export const keyMap = buildKeyMap(DEFAULT_OCTAVE);