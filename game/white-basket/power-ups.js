"use strict";

const powerItems = {
  clock: { label: "+5秒", color: "#246780" },
  magnet: { label: "磁石！", color: "#824866" },
  star: { label: "スターガード！", color: "#865b1b" },
};

const feverDuration = 5000;
const maxFevers = 2;
const clockBonus = 5000;
const magnetDuration = 3000;
const guardDuration = 5000;

function newPowers() {
  return { fevers: 0, feverEnd: 0, magnetEnd: 0, guardEnd: 0,
    clockOffered: false, extension: 0 };
}

function tryFever(powers, combo, now) {
  if (!combo || combo % 10 !== 0 || now < powers.feverEnd || powers.fevers >= maxFevers) return false;
  powers.fevers += 1;
  powers.feverEnd = now + feverDuration;
  return true;
}

function rollPowerItem(powers, elapsed, random = Math.random) {
  if (elapsed < 4000 || random() >= .045) return null;
  const kind = random();
  if (kind < .30) {
    if (powers.clockOffered || powers.extension) return null;
    powers.clockOffered = true;
    return "clock";
  }
  return kind < .65 ? "magnet" : "star";
}

function activatePower(powers, type, now) {
  if (type === "clock") {
    if (powers.extension) return false;
    powers.extension = clockBonus;
  } else if (type === "magnet") {
    powers.magnetEnd = now + magnetDuration;
  } else if (type === "star") {
    powers.guardEnd = now + guardDuration;
  }
  return true;
}

function pullFishX(x, y, catX, catchY, scale, dt) {
  const dx = catX - x;
  const dy = catchY - y;
  if (dy < -22 * scale || dy > 155 * scale || Math.abs(dx) > 125 * scale) return x;
  const step = Math.min(Math.abs(dx), 230 * dt * scale);
  return x + Math.sign(dx) * step;
}
