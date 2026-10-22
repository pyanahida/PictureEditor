(function(global) {
  'use strict';

  const PROFILE = {
    exposure:   { pos: 1.5, neg: 2.0 },
    brightness: { scale: 80 },
    contrast:   { pos: 1.2, neg: 0.8 },
    highlights: { pos: 0.9, neg: 0.7 },
    shadows:    { pos: 0.9, neg: 0.7 },
    whites:     { pos: 0.8, neg: 0.6, pivot: 200, span: 55 },
    blacks:     { pos: 0.8, neg: 0.6, pivot: 55,  span: 55 },
    saturation: { pos: 1.5, neg: 0.8 },
    vibrance:   { scale: 0.8 }
  };

  const HSL_COLORS = [
    { name: 'red',    hue: 0 },
    { name: 'orange', hue: 30 },
    { name: 'yellow', hue: 60 },
    { name: 'green',  hue: 120 },
    { name: 'blue',   hue: 240 },
    { name: 'purple', hue: 280 }
  ];

  function applyCurves(data, curves) {
    const lutW = new Uint8ClampedArray(256);
    const lutR = new Uint8ClampedArray(256);
    const lutG = new Uint8ClampedArray(256);
    const lutB = new Uint8ClampedArray(256);

    for (let i = 0; i < 256; i++) {
      lutW[i] = global.Utils.evalCurve(curves.w, i);
      lutR[i] = global.Utils.evalCurve(curves.r, i);
      lutG[i] = global.Utils.evalCurve(curves.g, i);
      lutB[i] = global.Utils.evalCurve(curves.b, i);
    }

    for (let i = 0; i < data.length; i += 4) {
      data[i] = lutW[lutR[data[i]]];
      data[i + 1] = lutW[lutG[data[i + 1]]];
      data[i + 2] = lutW[lutB[data[i + 2]]];
    }
  }

  function applyColorBalance(data, temp, tint) {
    // temp: -100 (blue) to 100 (yellow)
    // tint: -100 (green) to 100 (magenta/red)
    const tR = temp > 0 ? (temp / 100) * 50 : 0;
    const tB = temp < 0 ? (-temp / 100) * 50 : 0;
    
    const tiG = tint < 0 ? (-tint / 100) * 50 : 0;
    const tiR = tint > 0 ? (tint / 100) * 50 : 0;

    if (temp === 0 && tint === 0) return;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + tR + tiR));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + tiG));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + tB));
    }
  }

  function processPixels(data, w, h, values) {
    const expF = values.exposure >= 0
      ? 1 + (values.exposure / 100) * PROFILE.exposure.pos
      : 1 / (1 + (-values.exposure / 100) * PROFILE.exposure.neg);

    const brightOff = (values.brightness / 100) * PROFILE.brightness.scale / 255;

    const contrastF = values.contrast >= 0
      ? 1 + (values.contrast / 100) * PROFILE.contrast.pos
      : 1 / (1 + (-values.contrast / 100) * PROFILE.contrast.neg);

    const hlF = values.highlights >= 0
      ? 1 + (values.highlights / 100) * PROFILE.highlights.pos
      : 1 / (1 + (-values.highlights / 100) * PROFILE.highlights.neg);

    const shF = values.shadows >= 0
      ? 1 + (values.shadows / 100) * PROFILE.shadows.pos
      : 1 / (1 + (-values.shadows / 100) * PROFILE.shadows.neg);

    const wP = PROFILE.whites;
    const whF = values.whites >= 0
      ? 1 + (values.whites / 100) * wP.pos
      : 1 / (1 + (-values.whites / 100) * wP.neg);

    const bP = PROFILE.blacks;
    const blF = values.blacks >= 0
      ? 1 + (values.blacks / 100) * bP.pos
      : 1 / (1 + (-values.blacks / 100) * bP.neg);

    const satF = values.saturation >= 0
      ? 1 + (values.saturation / 100) * PROFILE.saturation.pos
      : 1 / (1 + (-values.saturation / 100) * PROFILE.saturation.neg);

    const vibAmount = (values.vibrance / 100) * PROFILE.vibrance.scale;

    for (let i = 0; i < data.length; i += 4) {
      let r = global.Utils.srgbToLinear(data[i]);
      let g = global.Utils.srgbToLinear(data[i + 1]);
      let b = global.Utils.srgbToLinear(data[i + 2]);

      r *= expF; g *= expF; b *= expF;
      r += brightOff; g += brightOff; b += brightOff;

      r = (r - 0.5) * contrastF + 0.5;
      g = (g - 0.5) * contrastF + 0.5;
      b = (b - 0.5) * contrastF + 0.5;

      let rr = global.Utils.linearToSrgb(r);
      let gg = global.Utils.linearToSrgb(g);
      let bb = global.Utils.linearToSrgb(b);

      let luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;

      if (luma > 128) {
        const weight = (luma - 128) / 127;
        rr += (rr * (hlF - 1)) * weight;
        gg += (gg * (hlF - 1)) * weight;
        bb += (bb * (hlF - 1)) * weight;
      }
      if (luma < 128) {
        const weight = (128 - luma) / 128;
        rr += (rr * (shF - 1)) * weight;
        gg += (gg * (shF - 1)) * weight;
        bb += (bb * (shF - 1)) * weight;
      }

      luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;

      if (luma > wP.pivot) {
        const t = Math.min(1, (luma - wP.pivot) / wP.span);
        const weight = t * t * (3 - 2 * t);
        rr += (rr * (whF - 1)) * weight;
        gg += (gg * (whF - 1)) * weight;
        bb += (bb * (whF - 1)) * weight;
      }
      if (luma < bP.pivot) {
        const t = Math.min(1, (bP.pivot - luma) / bP.span);
        const weight = t * t * (3 - 2 * t);
        rr += (rr * (blF - 1)) * weight;
        gg += (gg * (blF - 1)) * weight;
        bb += (bb * (blF - 1)) * weight;
      }

      data[i]     = Math.min(255, Math.max(0, rr));
      data[i + 1] = Math.min(255, Math.max(0, gg));
      data[i + 2] = Math.min(255, Math.max(0, bb));
    }

    if (values.clarity !== 0) {
      applyClarity(data, w, h, values.clarity);
    }
    if (values.saturation !== 0 || values.vibrance !== 0) {
      applySaturation(data, satF, vibAmount);
    }
    if (values.temp !== 0 || values.tint !== 0) {
      applyColorBalance(data, values.temp, values.tint);
    }
    
    if (!values.hslIdentity) {
      applyHsl(data, values.hsl);
    }
    
    if (!values.postIdentity) {
      applyPosterization(data, values.post);
    }

    if (values.curvesIdentity === false) {
      applyCurves(data, values.curves);
    }
  }

  function applyClarity(data, w, h, amount) {
    const src = new Uint8ClampedArray(data);
    const strength = (amount / 100) * 0.5;
    for (let y = 1; y < h - 1; y++) {
      const rowBase = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = (rowBase + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[i + c];
          const up    = src[i - w * 4 + c];
          const down  = src[i + w * 4 + c];
          const left  = src[i - 4 + c];
          const right = src[i + 4 + c];
          const lap = center * 5 - up - down - left - right;
          data[i + c] = Math.min(255, Math.max(0, center + lap * strength));
        }
      }
    }
  }

  function applySaturation(data, satF, vibAmount) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      const vibFactor = 1 + vibAmount * Math.max(0, 1 - sat);
      const combined = satF * vibFactor;
      data[i]     = Math.min(255, Math.max(0, gray + (r - gray) * combined));
      data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * combined));
      data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * combined));
    }
  }

  function applyHsl(data, hslValues) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let [h, s, l] = global.Utils.rgbToHsl(r, g, b);
      
      if (s === 0) continue;
      
      let hueShift = 0;
      let satShift = 0;
      let lumShift = 0;
      
      HSL_COLORS.forEach(c => {
        const targetHue = c.hue;
        let dist = Math.abs(h - targetHue);
        if (dist > 180) dist = 360 - dist;
        
        const influence = Math.max(0, 1 - (dist / 30));
        
        if (influence > 0) {
          hueShift += (hslValues[c.name].hue / 100) * 30 * influence;
          satShift += (hslValues[c.name].saturation / 100) * influence;
          lumShift += (hslValues[c.name].luminance / 100) * 0.5 * influence;
        }
      });
      
      if (hueShift !== 0 || satShift !== 0 || lumShift !== 0) {
        h = (h + hueShift + 360) % 360;
        s = Math.min(1, Math.max(0, s + satShift));
        l = Math.min(1, Math.max(0, l + lumShift));
        
        const [nr, ng, nb] = global.Utils.hslToRgb(h, s, l);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
  }

  function applyPosterization(data, postValues) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const [h, s, l] = global.Utils.rgbToHsl(r, g, b);
      
      if (s === 0) continue;

      let hlShift = 0;
      let shShift = 0;

      HSL_COLORS.forEach(c => {
        const targetHue = c.hue;
        let dist = Math.abs(h - targetHue);
        if (dist > 180) dist = 360 - dist;
        
        const influence = Math.max(0, 1 - (dist / 30));
        
        if (influence > 0) {
          hlShift += (postValues[c.name].highlights / 100) * influence;
          shShift += (postValues[c.name].shadows / 100) * influence;
        }
      });

      if (hlShift !== 0 || shShift !== 0) {
        let newL = l;
        let newS = s;
        if (l > 0.5) {
          newL += hlShift * 0.5 * (l - 0.5) * 2;
          newS += hlShift * 0.5;
        } else {
          newL -= shShift * 0.5 * (0.5 - l) * 2;
          newS += shShift * 0.5;
        }
        newL = Math.min(1, Math.max(0, newL));
        newS = Math.min(1, Math.max(0, newS));
        
        const [nr, ng, nb] = global.Utils.hslToRgb(h, newS, newL);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
  }

  global.Pipeline = {
    processPixels
  };

})(window);
