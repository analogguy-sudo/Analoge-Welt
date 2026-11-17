// Tests für den N-Rechner. Ausführen im Ordner der App mit:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../nrechner.js");

const at = (time, aperture) => ({ time, aperture });
const calc = (dark, bright, extra = {}) => N.calculate({ mode: "settings", dark, bright, keep: "aperture", baseSec: 600, ...extra });

test("Testfall 1: 1/30 → 1/250 bei f/8 ist N+1", () => {
  const r = calc(at("1/30", "8"), at("1/250", "8"));
  assert.equal(r.stops, 3);
  assert.equal(r.stopsText, "3 Stufen");
  assert.deepEqual(r.exposure, { time: "1/125", aperture: "8" });
  assert.equal(r.highlightZoneText, "VI");
  assert.equal(r.devText, "N+1");
  assert.equal(N.formatMinSec(r.timeSec), "13:15");
});

test("Testfall 2: 4 Stufen ist N", () => {
  const r = calc(at("1/30", "8"), at("1/500", "8"));
  assert.equal(r.stops, 4);
  assert.deepEqual(r.exposure, { time: "1/125", aperture: "8" });
  assert.equal(r.highlightZoneText, "VII");
  assert.equal(r.devText, "N");
  assert.equal(N.formatMinSec(r.timeSec), "10:00");
});

test("Testfall 3: 5 Stufen ist N−1", () => {
  const r = calc(at("1/30", "8"), at("1/1000", "8"));
  assert.equal(r.stops, 5);
  assert.deepEqual(r.exposure, { time: "1/125", aperture: "8" });
  assert.equal(r.highlightZoneText, "VIII");
  assert.equal(r.devText, "N−1");
  assert.equal(N.formatMinSec(r.timeSec), "7:30");
});

test("Testfall 4: Blende statt Zeit verändert, 1/60 f/5.6 → f/16", () => {
  const r = calc(at("1/60", "5.6"), at("1/60", "16"));
  assert.equal(r.stops, 3);
  assert.deepEqual(r.exposure, { time: "1/250", aperture: "5.6" });
  assert.equal(r.highlightZoneText, "VI");
  assert.equal(r.devText, "N+1");
  assert.equal(N.formatMinSec(r.timeSec), "13:15");
});

test("Testfall 5: LW 8 und LW 13 ist N−1", () => {
  const r = N.calculate({ mode: "lw", dark: 8, bright: 13, baseSec: 600 });
  assert.equal(r.stops, 5);
  assert.deepEqual(r.exposure, { lw: 10 });
  assert.equal(r.highlightZoneText, "VIII");
  assert.equal(r.devText, "N−1");
  assert.equal(N.formatMinSec(r.timeSec), "7:30");
});

test("Testfall 6: vertauschte Messungen geben eine Fehlermeldung", () => {
  const r = calc(at("1/30", "8"), at("1/30", "5.6"));
  assert.equal(r.stops, -1);
  assert.match(r.error, /Messungen vertauscht/);
});

test("Zeit behalten, Blende schließen", () => {
  const r = calc(at("1/30", "8"), at("1/250", "8"), { keep: "time" });
  assert.deepEqual(r.exposure, { time: "1/30", aperture: "16" });
});

test("Nennwerte statt aufgedruckter Zahlen: 1/30 → 1/250 sind genau 3 Stufen", () => {
  assert.equal(N.thirdsOf(at("1/250", "8")) - N.thirdsOf(at("1/30", "8")), 9);
});

test("Drittelstufen: 1/30 → 1/40 ist ⅓ Stufe", () => {
  const r = calc(at("1/30", "8"), at("1/40", "8"));
  assert.equal(r.stops, 1 / 3);
  assert.equal(r.stopsText, "⅓ Stufen");
  assert.equal(N.formatStops(10 / 3), "3⅓ Stufen");
  assert.equal(N.formatStops(11 / 3), "3⅔ Stufen");
  assert.equal(N.formatStops(1), "1 Stufe");
});

test("Drittelstufen bei der Blende: f/8 → f/9 → f/10 → f/11", () => {
  assert.equal(N.apertureIndex("9") - N.apertureIndex("8"), 1);
  assert.equal(N.apertureIndex("11") - N.apertureIndex("8"), 3);
  assert.equal(N.apertureIndex("f/5,6"), N.apertureIndex("5.6"));
});

test("Zeitrundung auf 15 Sekunden und alle Faktoren bei 10:00", () => {
  const t = Object.fromEntries(N.timeTable(600).map((x) => [x.label, N.formatMinSec(x.sec)]));
  assert.deepEqual(t, { "N+2": "17:30", "N+1": "13:15", N: "10:00", "N−1": "7:30", "N−2": "6:00" });
  assert.equal(N.devTime(7 * 60 + 10, 1) % 15, 0);
  assert.equal(N.formatMinSec(N.devTime(9 * 60, 1)), "12:00");
  assert.equal(N.parseMinSec("10:00"), 600);
  assert.equal(N.parseMinSec("8,5"), 510);
});

test("Begrenzung auf N±2 mit Hinweis", () => {
  const flat = calc(at("1/30", "8"), at("1/60", "8"));       // 1 Stufe
  assert.equal(flat.devText, "N+2");
  assert.equal(flat.extreme, true);
  const hard = N.calculate({ mode: "lw", dark: 6, bright: 14, baseSec: 600 }); // 8 Stufen
  assert.equal(hard.devText, "N−2");
  assert.equal(hard.extreme, true);
  assert.equal(calc(at("1/30", "8"), at("1/125", "8")).extreme, false); // 2 Stufen ist noch normal
});

test("Genau zwischen zwei Stufen: beide nennen, im Zweifel näher an N", () => {
  const r = N.calculate({ mode: "lw", dark: 8, bright: 11.5, baseSec: 600 });  // 3½ Stufen
  assert.equal(r.stopsText, "3½ Stufen");
  assert.equal(r.devText, "N");
  assert.equal(r.betweenText, "zwischen N und N+1, im Zweifel N");
  const r2 = N.calculate({ mode: "lw", dark: 8, bright: 12.5, baseSec: 600 }); // 4½ Stufen
  assert.equal(r2.betweenText, "zwischen N und N−1, im Zweifel N");
});

test("Begründung in einem Satz", () => {
  assert.equal(calc(at("1/30", "8"), at("1/250", "8")).reason,
    "3 Stufen: Das Licht ist flau. Mit N+1 hebst du die Lichter von Zone VI auf Zone VII.");
});

test("Grenzen der Reihe: kürzer als 1/4000 geht nicht", () => {
  const r = calc(at("1/2000", "8"), at("1/2000", "22"));
  assert.match(r.exposure.error, /1\/4000/);
});

test("Temperaturkorrektur: 20 °C bleibt, wärmer kürzer, kälter länger", () => {
  assert.equal(N.formatMinSec(N.devTime(600, 0, 20)), "10:00");
  assert.equal(N.formatMinSec(N.devTime(600, 0)), "10:00");            // ohne Angabe: 20 °C
  assert.equal(N.formatMinSec(N.devTime(600, 0, 24)), "7:15");
  assert.equal(N.formatMinSec(N.devTime(600, 0, 18)), "11:45");
  assert.equal(N.formatMinSec(N.devTime(600, 1, 22)), "11:15");         // N+1 bei 22 °C
  assert.equal(N.tempInRange(21), true);
  assert.equal(N.tempInRange(26), false);
  const r = N.calculate({ mode: "settings", dark: { time: "1/30", aperture: "8" }, bright: { time: "1/250", aperture: "8" }, keep: "aperture", baseSec: 600, tempC: 22 });
  assert.equal(N.formatMinSec(r.timeSec), "11:15");
});

test("Eigene Faktoren je Film und Entwickler ersetzen den Standard", () => {
  const own = { 1: 1.3, "-1": 0.8 };
  assert.equal(N.formatMinSec(N.devTime(600, 1, 20, own)), "13:00");     // 10:00 × 1,3
  assert.equal(N.formatMinSec(N.devTime(600, -1, 20, own)), "8:00");
  assert.equal(N.formatMinSec(N.devTime(600, 2, 20, own)), "17:30");     // nicht gesetzt: Standard
  assert.equal(N.formatMinSec(N.devTime(600, 0, 20, own)), "10:00");      // N bleibt die Normalzeit
  const t = N.timeTable(600, 20, own);
  assert.equal(t.find((r) => r.dev === 1).own, true);
  assert.equal(t.find((r) => r.dev === 2).own, false);
  const r = N.calculate({ mode: "settings", dark: { time: "1/30", aperture: "8" }, bright: { time: "1/250", aperture: "8" }, keep: "aperture", baseSec: 600, factors: own });
  assert.equal(N.formatMinSec(r.timeSec), "13:00");
});
