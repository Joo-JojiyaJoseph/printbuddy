// On-device document analysis. Pixels never leave the phone; nothing is sent to any AI service.

/** Count inked and coloured pixels in RGBA data. "Coloured" = clearly not a grey (channels differ by more than 40). */
export function analyzePixels(data) {
  let ink = 0, colour = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (r < 235 || g < 235 || b < 235) {
      ink++
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colour++
    }
  }
  return { ink, colour, total: data.length / 4 }
}

/** Combine per-page results into the facts the assistant needs. */
export function summarize(pages) {
  const usable = pages.filter(Boolean)
  if (!usable.length) return null
  const colourPixels = usable.reduce((a, p) => a + p.colour, 0)
  const totalPixels = usable.reduce((a, p) => a + p.total, 0)
  const colourPages = usable.filter((p) => p.colour / p.total > 0.002).length
  const wide = usable.filter((p) => p.w > p.h).length
  return {
    sampled: usable.length,
    hasColour: colourPixels / totalPixels > 0.002,
    colourPages,
    mostlyLandscape: wide > usable.length / 2,
    mostlyPortrait: wide < usable.length / 2,
  }
}
