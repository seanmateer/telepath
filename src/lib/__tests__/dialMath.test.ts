import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIAL_ARC_END_DEGREES,
  DIAL_ARC_MID_DEGREES,
  DIAL_ARC_START_DEGREES,
  clampDialAngle,
  clampDialValue,
  dialAngleToValue,
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
    assert.equal(clampDialAngle(60), DIAL_ARC_END_DEGREES);
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
