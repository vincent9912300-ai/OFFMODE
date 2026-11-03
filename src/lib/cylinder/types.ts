import type { Mesh } from 'ogl';

export interface ParticleUserData {
  baseAngle: number;
  angleSpan: number;
  baseY: number;
  speed: number;
  radius: number;
}

export interface CameraAnimation {
  x: number;
  y: number;
  z: number;
}

export interface CylinderConfig {
  radius: number;
  height: number;
  radialSegments: number;
  heightSegments: number;
}

export interface ParticleConfig {
  numParticles: number;
  particleRadius: number;
  segments: number;
  angleSpan: number;
}

export type ParticleMesh = Mesh & { userData: ParticleUserData };

export type TextPosition =
  | 'top'
  | 'top-left'
  | 'left'
  | 'right'
  | 'center'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';
