// McLeod Pitch Method (NSDF) with parabolic interpolation.
(function (g) {
  const cache = {};
  function fftInPlace(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    let tw = cache[n];
    if (!tw) {
      tw = cache[n] = { c: new Float64Array(n >> 1), s: new Float64Array(n >> 1) };
      for (let i = 0; i < n >> 1; i++) { tw.c[i] = Math.cos(2 * Math.PI * i / n); tw.s[i] = -Math.sin(2 * Math.PI * i / n); }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const wr = tw.c[k * step], wi = tw.s[k * step];
          const a = i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }
  // Autocorrelation r[t] = sum x[j]x[j+t] via FFT, O(N log N).
  function acfFFT(x) {
    const N = x.length;
    let n = 1;
    while (n < 2 * N) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < N; i++) re[i] = x[i];
    fftInPlace(re, im);
    for (let i = 0; i < n; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
    fftInPlace(re, im); // real-symmetric input: forward FFT == n * inverse
    for (let i = 0; i < N; i++) re[i] /= n;
    return re;
  }
  function detectPitch(buf, sr, minF, maxF, k) {
    minF = minF || 27; maxF = maxF || 2100; k = k || 0.9;
    const N = buf.length;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += buf[i];
    mean /= N;
    const x = new Float32Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) { const v = buf[i] - mean; x[i] = v; e += v * v; }
    const rms = Math.sqrt(e / N);
    if (rms < 1e-5) return null;

    const minT = Math.max(2, Math.floor(sr / maxF));
    const maxT = N >> 1;
    const maxP = Math.min(Math.ceil(sr / minF), maxT);
    const r = acfFFT(x);
    const nsdf = new Float32Array(maxT + 2);
    let m = 2 * e;
    for (let t = 1; t <= maxT + 1; t++) {
      m -= x[N - t] * x[N - t] + x[t - 1] * x[t - 1];
      nsdf[t] = m > 0 ? (2 * r[t]) / m : 0;
    }

    // Key maxima: highest point in each positive lobe after the first zero crossing.
    const peaks = [];
    let t = 1;
    while (t <= maxT && nsdf[t] > 0) t++;
    while (t <= maxT) {
      while (t <= maxT && nsdf[t] <= 0) t++;
      let best = -1, bi = -1;
      while (t <= maxT && nsdf[t] > 0) {
        if (nsdf[t] > best) { best = nsdf[t]; bi = t; }
        t++;
      }
      if (bi > 0 && bi >= minT && bi <= maxP) peaks.push(bi);
    }
    if (!peaks.length) return null;
    let top = 0;
    for (const p of peaks) if (nsdf[p] > top) top = nsdf[p];
    const th = k * top;
    let p = peaks[0];
    for (const q of peaks) if (nsdf[q] >= th) { p = q; break; }

    const interp = (q) => {
      const a = nsdf[q - 1], b = nsdf[q], c = nsdf[q + 1];
      const den = a - 2 * b + c;
      const sh = den !== 0 ? (0.5 * (a - c)) / den : 0;
      return q + Math.max(-1, Math.min(1, sh));
    };
    let period = interp(p);
    const b = nsdf[p];
    // Refine on the n-th multiple of the period: error shrinks by ~1/n.
    const n = Math.floor((N / 3) / period);
    if (n >= 2) {
      const c0 = Math.round(n * period);
      let q = c0;
      for (let d = -3; d <= 3; d++) {
        const i = c0 + d;
        if (i > 1 && i < maxT && nsdf[i] > nsdf[q]) q = i;
      }
      if (q > 1 && q < maxT && nsdf[q] > 0.5 * b) {
        const pn = interp(q) / n;
        if (Math.abs(pn - period) < 0.5) period = pn;
      }
    }
    return { freq: sr / period, clarity: b, rms: rms };
  }
  g.detectPitch = detectPitch;
  if (typeof module !== "undefined") module.exports = detectPitch;
})(typeof self !== "undefined" ? self : globalThis);
