import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIAL_ARC_END_DEGREES,
  DIAL_ARC_MID_DEGREES,
  DIAL_ARC_START_DEGREES,
  clampDialAngle,
  clampDialValue,
  dialAngleToValue,
  getDialScoreZoneSegments,
  pointOnCircle,
  pointerValueFromCenter,
  valueToDialAngle,
} from '../dialMath.js';

describe('dial value-angle conversion', () => {
  it('maps boundary values to boundary angles', () => {
    assert.equal(valueToDialAngle(0), DIAL_ARC_START_DEGREES);
    assert.equal(valueToDialAngle(50), DIAL_ARC_MID_DEGREES);
    assert.equal(valueToDialAngle(100), DIAL_ARC_END_DEGREES);
  });

  it('maps boundary angles back to boundary values', () => {
    assert.equal(dialAngleToValue(DIAL_ARC_START_DEGREES), 0);
    assert.equal(dialAngleToValue(DIAL_ARC_MID_DEGREES), 50);
    assert.equal(dialAngleToValue(DIAL_ARC_END_DEGREES), 100);
  });

  it('clamps out-of-range values and angles', () => {
    assert.equal(clampDialValue(-10), 0);
    assert.equal(clampDialValue(140), 100);
    assert.equal(clampDialAngle(120), DIAL_ARC_START_DEGREES);
    assert.equal(clampDialAngle(20), DIAL_ARC_END_DEGREES);
    assert.equal(clampDialAngle(350), DIAL_ARC_END_DEGREES);
    assert.equal(clampDialAngle(180), DIAL_ARC_START_DEGREES);
  });
});

describe('pointer-to-value mapping', () => {
  it('converts pointer location around center to 0-100 range', () => {
    const centerX = 200;
    const centerY = 200;
    const radius = 100;

    const minPoint = pointOnCircle(centerX, centerY, radius, DIAL_ARC_START_DEGREES);
    const midPoint = pointOnCircle(centerX, centerY, radius, DIAL_ARC_MID_DEGREES);
    const maxPoint = pointOnCircle(centerX, centerY, radius, DIAL_ARC_END_DEGREES);

    assert.equal(
      Math.round(pointerValueFromCenter(minPoint.x, minPoint.y, centerX, centerY)),
      0,
    );
    assert.equal(
      Math.round(pointerValueFromCenter(midPoint.x, midPoint.y, centerX, centerY)),
      50,
    );
    assert.equal(
      Math.round(pointerValueFromCenter(maxPoint.x, maxPoint.y, centerX, centerY)),
      100,
    );
  });
});

describe('score-zone segments', () => {
  it('builds all five scoring segments around a centered target', () => {
    assert.deepEqual(getDialScoreZoneSegments(50), [
      { name: 'outer-left', startValue: 32.5, endValue: 39.5, midpointValue: 36 },
      { name: 'adjacent-left', startValue: 39.5, endValue: 46.5, midpointValue: 43 },
      { name: 'bullseye', startValue: 46.5, endValue: 53.5, midpointValue: 50 },
      { name: 'adjacent-right', startValue: 53.5, endValue: 60.5, midpointValue: 57 },
      { name: 'outer-right', startValue: 60.5, endValue: 67.5, midpointValue: 64 },
    ]);
  });

  it('clips left-side zones when target is at the left edge', () => {
    assert.deepEqual(getDialScoreZoneSegments(0), [
      { name: 'bullseye', startValue: 0, endValue: 3.5, midpointValue: 1.75 },
      { name: 'adjacent-right', startValue: 3.5, endValue: 10.5, midpointValue: 7 },
      { name: 'outer-right', startValue: 10.5, endValue: 17.5, midpointValue: 14 },
    ]);
  });

  it('clips left-side zones when target is near the left edge', () => {
    assert.deepEqual(getDialScoreZoneSegments(4), [
      { name: 'adjacent-left', startValue: 0, endValue: 0.5, midpointValue: 0.25 },
      { name: 'bullseye', startValue: 0.5, endValue: 7.5, midpointValue: 4 },
      { name: 'adjacent-right', startValue: 7.5, endValue: 14.5, midpointValue: 11 },
      { name: 'outer-right', startValue: 14.5, endValue: 21.5, midpointValue: 18 },
    ]);
  });

  it('clips right-side zones when target is near the right edge', () => {
    assert.deepEqual(getDialScoreZoneSegments(96), [
      { name: 'outer-left', startValue: 78.5, endValue: 85.5, midpointValue: 82 },
      { name: 'adjacent-left', startValue: 85.5, endValue: 92.5, midpointValue: 89 },
      { name: 'bullseye', startValue: 92.5, endValue: 99.5, midpointValue: 96 },
      { name: 'adjacent-right', startValue: 99.5, endValue: 100, midpointValue: 99.75 },
    ]);
  });

  it('clips right-side zones when target is at the right edge', () => {
    assert.deepEqual(getDialScoreZoneSegments(100), [
      { name: 'outer-left', startValue: 82.5, endValue: 89.5, midpointValue: 86 },
      { name: 'adjacent-left', startValue: 89.5, endValue: 96.5, midpointValue: 93 },
      { name: 'bullseye', startValue: 96.5, endValue: 100, midpointValue: 98.25 },
    ]);
  });
});
