"use strict";

// Uses the caller's transform, with the center of the cat's feet at (0, 0).
const drawCatFace = (() => {
  const shape = (data) => new Path2D(data);
  const ear = shape("M-47 -68 C-57 -79 -55 -99 -48 -108 C-42 -115 -24 -106 -10 -94Z");
  const innerEar = shape("M-46 -77 C-51 -85 -50 -99 -46 -103 C-42 -108 -32 -99 -25 -89Z");
  const head = shape("M-53 -53 C-53 -76 -31 -97 0 -97 C31 -97 53 -76 53 -53 C53 -41 44 -35 33 -33 Q0 -29 -33 -33 C-44 -35 -53 -41 -53 -53Z");
  const smile = shape("M-30 -63 C-25 -72 -15 -72 -9 -64 C-7 -61 -9 -59 -12 -61 C-17 -66 -23 -66 -28 -61 C-30 -59 -32 -61 -30 -63Z");
  const blackEye = shape("M-34 -66 L-10 -62 C-11 -55 -16 -51 -23 -51 C-30 -51 -35 -57 -34 -66Z");
  const lid = shape("M-35 -66 L-10 -62");
  const brow = shape("M-27 -75 L-17 -69");
  const whiskers = shape("M-49 -54 L-40 -54 M-48 -46 L-40 -49");
  const worriedBrow = shape("M-28 -66 Q-21 -66 -16 -71");
  const grin = shape("M-9 -49 Q0 -54 9 -49 Q8 -38 0 -38 Q-8 -38 -9 -49Z");
  const frown = shape("M-6 -40 Q0 -45 6 -40");
  const nose = shape("M-5.5 -56 C-5.5 -59 5.5 -59 5.5 -56 C5.5 -54 2.5 -53 1.8 -51.5 Q0 -49 -1.8 -51.5 C-2.5 -53 -5.5 -54 -5.5 -56Z");

  function fill(ctx, path, paint) {
    ctx.fillStyle = paint;
    ctx.fill(path);
  }

  function stroke(ctx, path, paint, width) {
    ctx.strokeStyle = paint;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }

  function gradient(ctx, top, bottom, light, shade) {
    const paint = ctx.createLinearGradient(0, top, 0, bottom);
    paint.addColorStop(0, light);
    paint.addColorStop(1, shade);
    return paint;
  }

  function oval(ctx, x, y, rx, ry, paint) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = paint;
    ctx.fill();
  }

  function mirrored(ctx, draw) {
    draw();
    ctx.save();
    ctx.scale(-1, 1);
    draw();
    ctx.restore();
  }

  function drawEars(ctx, black) {
    const fur = gradient(ctx, -111, -71, black ? "#424143" : "#fffdf9", black ? "#171619" : "#ccb6a7");
    const lining = gradient(ctx, -105, -78, black ? "#bd4351" : "#db8a75", black ? "#ff9caa" : "#ffc7ba");
    mirrored(ctx, () => {
      fill(ctx, ear, fur);
      stroke(ctx, ear, black ? "#171619" : "#c7afa0", 1.4);
      fill(ctx, innerEar, lining);
    });
  }

  function drawEyes(ctx, black, expression) {
    mirrored(ctx, () => {
      if (expression === "sad") {
        stroke(ctx, worriedBrow, black ? "#faf6f2" : "#563c30", 2.4);
        oval(ctx, -22, -61, 2.6, 3.4, black ? "#faf6f2" : "#563c30");
      } else if (black) {
        fill(ctx, blackEye, gradient(ctx, -66, -51, "#fffdfa", "#dad8dd"));
        ctx.save();
        ctx.clip(blackEye);
        oval(ctx, -20, -62, 5.8, 7, "#101013");
        ctx.restore();
        stroke(ctx, lid, "#100e11", 2.6);
        stroke(ctx, brow, "#fcfaf6", 4);
      } else {
        ctx.save();
        if (expression === "happy") ctx.translate(0, -2);
        fill(ctx, smile, gradient(ctx, -70, -60, "#5a4030", "#312116"));
        ctx.restore();
      }
    });
  }

  function drawMuzzle(ctx, black, expression) {
    if (expression === "happy") fill(ctx, grin, black ? "#873f56" : "#a95264");
    if (expression === "sad") stroke(ctx, frown, black ? "#d9c5c8" : "#664339", 2);
    const puff = gradient(ctx, -56, -42, black ? "#424144" : "#fffefa", black ? "#1a191c" : "#ddc2ad");
    mirrored(ctx, () => {
      oval(ctx, -6.8, -49.5, 7.8, 5.7, puff);
      stroke(ctx, whiskers, black ? "#737275" : "#d4bcab", 4.8);
      ctx.save();
      ctx.translate(0, -.65);
      stroke(ctx, whiskers, black ? "#979598" : "#fff8ee", 3.2);
      ctx.restore();
    });
    fill(ctx, nose, gradient(ctx, -59, -50, "#ffd1ce", "#e97477"));
    stroke(ctx, nose, "#c86c70", .65);
  }

  return function drawCatFace(ctx, { coat = "white", expression = "calm" } = {}) {
    const black = coat === "black";
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawEars(ctx, black);
    const fur = ctx.createRadialGradient(-8, -84, 4, 0, -71, 61);
    fur.addColorStop(0, black ? "#444347" : "#fffefa");
    fur.addColorStop(.63, black ? "#2d2c2e" : "#f5ece6");
    fur.addColorStop(1, black ? "#151416" : "#d0b5a0");
    fill(ctx, head, fur);
    stroke(ctx, head, black ? "#171619" : "#b59b8b", 1.45);
    drawEyes(ctx, black, expression);
    drawMuzzle(ctx, black, expression);
    ctx.restore();
  };
})();
