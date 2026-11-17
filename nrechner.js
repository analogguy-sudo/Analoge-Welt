/* N-Rechner: Rechenlogik ohne Oberfläche (im Browser als window.NRechner, in Node über require).
   Grundlage: Handbuch „Analoge Welt“, Teil 5, „Kontrast über die Entwicklung steuern“.
   Alle Werte laufen über ihre Position in der Drittelstufen-Reihe, damit 1/30 → 1/250 genau 3 Stufen sind. */
(function (root) {
  "use strict";

  // Zeitfaktoren je Entwicklungsstufe. Hier anpassen, wenn eigene Tests andere Werte ergeben.
  const FACTORS = { 2: 1.75, 1: 4 / 3, 0: 1, "-1": 0.75, "-2": 0.6 };
  const MAX_DEV = 2;              // weiter als N±2 wird nicht gerechnet
  const TARGET_ZONE = 7;          // die Lichter sollen auf Zone VII landen
  const SHADOW_ZONE = 3;          // die Schatten legst du auf Zone III
  const ROUND_SEC = 15;           // Entwicklungszeit auf 15 Sekunden runden
  // Temperaturkorrektur (Richtwert für Schwarzweiß-Entwickler): pro °C wärmer etwa 8 % kürzer, pro °C kälter länger.
  const BASE_TEMP = 20, TEMP_FACTOR_PER_C = 0.92, TEMP_MIN = 18, TEMP_MAX = 24;

  // Belichtungszeiten in Drittelstufen, von lang nach kurz (jeder Schritt = ⅓ Stufe weniger Licht).
  // Ganze Stufen stehen an jeder dritten Stelle: 30 s, 15 s, 8 s … 1/30, 1/60, 1/125 … 1/4000.
  const TIMES = [
    "30 s", "25 s", "20 s", "15 s", "13 s", "10 s", "8 s", "6 s", "5 s", "4 s", "3,2 s", "2,5 s", "2 s",
    "1,6 s", "1,3 s", "1 s", "0,8 s", "0,6 s", "1/2", "0,4 s", "0,3 s", "1/4", "1/5", "1/6", "1/8",
    "1/10", "1/13", "1/15", "1/20", "1/25", "1/30", "1/40", "1/50", "1/60", "1/80", "1/100", "1/125",
    "1/160", "1/200", "1/250", "1/320", "1/400", "1/500", "1/640", "1/800", "1/1000", "1/1250", "1/1600",
    "1/2000", "1/2500", "1/3200", "1/4000",
  ];
  // Blenden in Drittelstufen, von offen nach geschlossen (jeder Schritt = ⅓ Stufe weniger Licht).
  const APERTURES = [
    "1.4", "1.6", "1.8", "2", "2.2", "2.5", "2.8", "3.2", "3.5", "4", "4.5", "5", "5.6", "6.3", "7.1",
    "8", "9", "10", "11", "13", "14", "16", "18", "20", "22", "25", "29", "32",
  ];

  const isFull = (i) => i % 3 === 0;
  const timeIndex = (t) => TIMES.indexOf(String(t).trim());
  const apertureIndex = (a) => APERTURES.indexOf(String(a).trim().replace(/^f\//i, "").replace(",", "."));

  // Lichtwert in Drittelstufen (relativ): kürzere Zeit oder kleinere Öffnung braucht mehr Licht
  function thirdsOf(setting) {
    const t = timeIndex(setting.time), a = apertureIndex(setting.aperture);
    if (t < 0 || a < 0) return NaN;
    return t + a;
  }

  // Auf Drittel- oder Halbstufen runden (Handbelichtungsmesser zeigen beides)
  function roundStops(x) {
    const s6 = Math.round(x * 6);
    if (s6 % 2 === 0 || s6 % 3 === 0) return s6 / 6;
    return Math.round(x * 3) / 3;
  }

  const FRACTIONS = { 0: "", 2: "⅓", 3: "½", 4: "⅔" };
  function formatStops(s) {
    const neg = s < 0, a = Math.abs(s), whole = Math.floor(a + 1e-9), sixths = Math.round((a - whole) * 6);
    const w = sixths === 6 ? whole + 1 : whole, f = sixths === 6 ? "" : FRACTIONS[sixths] ?? "";
    const num = (w === 0 && f ? "" : String(w)) + f;
    const unit = a === 1 ? "Stufe" : "Stufen";
    return (neg ? "−" : "") + num + " " + unit;
  }

  function zoneRoman(n) {
    const r = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return r[Math.max(0, Math.min(10, Math.round(n)))];
  }
  const labelN = (dev) => (dev === 0 ? "N" : dev > 0 ? "N+" + dev : "N−" + Math.abs(dev));

  // Entwicklungsstufe aus dem Kontrast (Stufen zwischen dunkler und heller Fläche)
  function development(stops) {
    if (!(stops >= 0)) return { error: "Die helle Fläche muss mehr Licht zeigen als die dunkle. Messungen vertauscht?" };
    const raw = TARGET_ZONE - (SHADOW_ZONE + stops);          // = 4 − Stufen
    let dev, between = null;
    if (Math.abs(raw - Math.round(raw)) > 0.49 && Math.abs(raw - Math.round(raw)) < 0.51) {
      const lo = Math.floor(raw), hi = Math.ceil(raw);
      dev = Math.abs(lo) <= Math.abs(hi) ? lo : hi;            // im Zweifel näher an N
      between = [dev, dev === lo ? hi : lo];
    } else dev = Math.round(raw);
    const extreme = dev > MAX_DEV || dev < -MAX_DEV || stops < 2 || stops > 6;
    dev = Math.max(-MAX_DEV, Math.min(MAX_DEV, dev));
    if (between) between = between.map((d) => Math.max(-MAX_DEV, Math.min(MAX_DEV, d)));
    if (between && between[0] === between[1]) between = null;
    return { dev, between, extreme, highlightZone: SHADOW_ZONE + stops };
  }

  // Belichtung: Schatten auf Zone III, also Schattenmessung minus 2 Stufen
  function exposure(dark, keep) {
    const shift = (5 - SHADOW_ZONE) * 3;                       // 2 Stufen = 6 Drittel
    const t = timeIndex(dark.time), a = apertureIndex(dark.aperture);
    if (keep === "time") {
      if (a + shift >= APERTURES.length) return { error: "Weiter als f/32 lässt sich die Blende nicht schließen. Nimm eine kürzere Zeit." };
      return { time: TIMES[t], aperture: APERTURES[a + shift] };
    }
    if (t + shift >= TIMES.length) return { error: "Kürzer als 1/4000 geht nicht. Schließe stattdessen die Blende." };
    return { time: TIMES[t + shift], aperture: APERTURES[a] };
  }

  function parseMinSec(s) {
    s = String(s ?? "").trim().replace(",", ".");
    const m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) return +m[1] * 60 + +m[2];
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n * 60;
  }
  function formatMinSec(sec) {
    const r = Math.round(sec);
    return Math.floor(r / 60) + ":" + String(r % 60).padStart(2, "0");
  }
  // Faktor für eine andere Temperatur als 20 °C (Normalzeit aus dem Datenblatt gilt für 20 °C)
  function tempFactor(tempC) {
    const t = tempC == null || tempC === "" ? BASE_TEMP : +tempC;
    return isFinite(t) ? Math.pow(TEMP_FACTOR_PER_C, t - BASE_TEMP) : NaN;
  }
  // Ist die Temperatur noch im Bereich, in dem die Korrektur verlässlich ist?
  const tempInRange = (tempC) => +tempC >= TEMP_MIN && +tempC <= TEMP_MAX;
  // Entwicklungszeit für eine Stufe (und Temperatur), gerundet auf 15 Sekunden
  function devTime(baseSec, dev, tempC) {
    return Math.round((baseSec * FACTORS[dev] * tempFactor(tempC)) / ROUND_SEC) * ROUND_SEC;
  }
  function timeTable(baseSec, tempC) {
    return [2, 1, 0, -1, -2].map((dev) => ({ dev, label: labelN(dev), factor: FACTORS[dev], sec: devTime(baseSec, dev, tempC) }));
  }

  function reason(stops, dev, zone) {
    const s = formatStops(stops), z = zoneRoman(zone);
    if (dev === 0) return `${s}: normaler Kontrast. Die Lichter landen von selbst auf Zone VII, also N.`;
    if (dev > 0) return `${s}: Das Licht ist ${dev > 1 ? "sehr " : ""}flau. Mit ${labelN(dev)} hebst du die Lichter von Zone ${z} auf Zone VII.`;
    return `${s}: Das Licht ist ${dev < -1 ? "sehr " : ""}hart. Mit ${labelN(dev)} holst du die Lichter von Zone ${z} auf Zone VII zurück.`;
  }

  /* Alles in einem Schritt.
     input: { mode: "settings" | "lw", dark, bright, keep: "aperture" | "time", baseSec }
       settings: dark/bright = { time: "1/30", aperture: "8" }
       lw:       dark/bright = Zahl (Lichtwert) */
  function calculate(input) {
    let stops, expo;
    if (input.mode === "lw") {
      const d = +input.dark, b = +input.bright;
      if (!isFinite(d) || !isFinite(b) || input.dark === "" || input.bright === "") return { error: "Gib beide Lichtwerte ein." };
      stops = roundStops(b - d);
      expo = { lw: d + (5 - SHADOW_ZONE) };
    } else {
      const d = thirdsOf(input.dark), b = thirdsOf(input.bright);
      if (isNaN(d) || isNaN(b)) return { error: "Wähle Zeit und Blende für beide Messungen." };
      stops = (b - d) / 3;
      expo = exposure(input.dark, input.keep);
    }
    const devInfo = development(stops);
    if (devInfo.error) return { error: devInfo.error, stops };
    const res = {
      stops, stopsText: formatStops(stops),
      exposure: expo,
      highlightZone: devInfo.highlightZone, highlightZoneText: zoneRoman(devInfo.highlightZone),
      dev: devInfo.dev, devText: labelN(devInfo.dev),
      between: devInfo.between, betweenText: devInfo.between ? `zwischen ${labelN(devInfo.between[0])} und ${labelN(devInfo.between[1])}, im Zweifel ${labelN(devInfo.dev)}` : null,
      extreme: devInfo.extreme,
      reason: reason(stops, devInfo.dev, devInfo.highlightZone),
    };
    if (input.baseSec > 0) res.timeSec = devTime(input.baseSec, devInfo.dev, input.tempC);
    return res;
  }

  const api = {
    FACTORS, TIMES, APERTURES, isFull, timeIndex, apertureIndex, thirdsOf, roundStops, formatStops,
    zoneRoman, labelN, development, exposure, parseMinSec, formatMinSec, devTime, timeTable, calculate,
    tempFactor, tempInRange, BASE_TEMP, TEMP_MIN, TEMP_MAX,
    EXTREME_HINT: "Extremfall. Mehr Kontrast holst du einfacher beim Vergrößern (härtere Gradation). Bei sehr hartem Licht hilft Standentwicklung.",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NRechner = api;
})(typeof window !== "undefined" ? window : globalThis);
