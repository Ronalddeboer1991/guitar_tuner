# Guitar Tuner – handoff notes

Acoustic guitar tuner as an installable web app (PWA) for Android. Private use.
Requirements from the user: opens fast, accurate.

## Files
- `index.html` – UI: needle gauge, note/cents/Hz readout, 6 string buttons, tuning picker, A4 reference (415–466 Hz). Settings saved in localStorage.
- `pitch.js` – pitch detection: McLeod Pitch Method (NSDF) with FFT autocorrelation, parabolic interpolation and multi-period refinement.
- `sw.js` – cache-first service worker (offline, instant start). Bump `C = "tuner-vN"` when files change.
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` – install as an app.

## Audio chain
getUserMedia (echoCancellation/noiseSuppression/autoGainControl off) → 50 Hz highpass → AnalyserNode (fftSize 8192) → detectPitch every 40 ms.
Gates: rms ≥ 0.004, clarity ≥ 0.85. Median of the last 7 readings; resets on a jump > 40 cents.
Auto mode picks the nearest string (needs 3 frames before switching). In tune = within ±2 cents.

## Tested (synthetic signals)
- Unit: 27–2100 Hz, 4 timbres, no octave errors; clean error < 0.02 cents.
- End-to-end in headless Chrome with a fake mic: A2 at −7 cents read −7.0 ¢, E4 at +0.8 cents read +0.8 ¢.
- Not yet tested on a real phone or guitar.

## Open items
- Hosting over https (e.g. GitHub Pages from this repo) so the mic works on Android.
- Optional: native Android version (no APK could be built in the original session; the Android SDK was not reachable).
