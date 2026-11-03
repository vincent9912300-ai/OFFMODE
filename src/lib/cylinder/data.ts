import type { CylinderConfig, TextPosition } from './types';

export const cylinderConfig: CylinderConfig = {
  radius: 2.5,
  height: 1.2,
  radialSegments: 64,
  heightSegments: 1,
};

export const particleConfig = {
  numParticles: 12,
  particleRadius: 3.3,
  segments: 20,
  angleSpan: 0.3,
};

export const imageConfig = {
  width: 1024,
  height: 1024,
};

export interface Perspective {
  title: string;
  description?: string;
  position: TextPosition;
  /** progress window in 0..1 of the whole cinematic scroll */
  range: [number, number];
}

export const perspectives: Perspective[] = [
  { title: 'WEAR YOUR MOOD', description: 'SYSTEM:OFFMODE', position: 'top', range: [0.06, 0.24] },
  { title: 'FW26', description: 'THE COLLECTION', position: 'center', range: [0.24, 0.42] },
  { title: 'OFFMODE', description: 'SELECTED LOOKS', position: 'left', range: [0.42, 0.6] },
  { title: 'KINETIC', description: 'MOTION STUDY', position: 'right', range: [0.6, 0.78] },
  { title: 'OFFMODE', description: 'ENTER THE LOOKS', position: 'bottom', range: [0.86, 0.96] },
];
