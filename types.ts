
export interface SoilParams {
  height: number; // Wall Height (m)
  // Backfill Properties
  gammaDry: number; // Backfill Dry Unit Weight (kN/m³)
  gammaSat: number; // Backfill Saturated Unit Weight (kN/m³)
  phi: number; // Backfill Friction Angle (degrees)
  cohesion: number; // Backfill Cohesion (kPa)
  surcharge: number; // Surcharge Load (kN/m²)
  slopeAngle: number; // Backfill Slope Angle (degrees)
  wallFriction: number; // Wall Friction Angle (degrees)
  waterDepth: number; // Depth of water table from top of backfill (m)
  enableGroundwater: boolean; // Toggle for groundwater analysis
  enableTensionCrack: boolean; // Toggle for tension crack analysis
  
  // Foundation Soil Properties
  foundationGamma: number; // Foundation Unit Weight (kN/m³)
  foundationPhi: number; // Foundation Friction Angle (degrees)
  foundationCohesion: number; // Foundation Cohesion (kPa)
  foundationSoilHeight: number; // Height of soil in front of wall (m) from base bottom
  allowableBearing: number; // Allowable Bearing Capacity (kPa)

  // Structural Material Properties (New)
  concreteGamma: number; // Unit weight of concrete (kN/m³)
  fPrimeC: number; // Concrete compressive strength (MPa)
  fy: number; // Rebar yield strength (MPa)
  es: number; // Elastic modulus of steel (GPa)
  concreteCover: number; // Concrete cover (cm)
}

export interface WallDimensions {
  B: number; // Base Width
  toe: number; // Toe Width
  stemTop: number; // Stem Top Width
  stemBottom: number; // Stem Bottom Width
  stemBatterSide: 'heel' | 'toe'; // Which side is battered/sloped
  baseThickness: number; // Base Slab Thickness
  keyDepth: number; // Shear Key Depth (m)
  keyBottomWidth: number; // Width of shear key at bottom (m)
}

export interface ForceVector {
  label: string;
  value: number;
  unit: string;
  x: number; // meters from Heel Right
  y: number; // meters from Base Bottom
  dirX: number; // component
  dirY: number; // component
  color: string;
}

export interface CalculationDetail {
  item: string;
  formula: string;
  value: string;
  unit: string;
  category: 'Coefficients' | 'Forces' | 'Moments' | 'Stability' | 'Bearing' | 'Structural';
}

export interface CalculationResult {
  ka: number;
  kp: number;
  pa: number; // Total Active Force
  pp: number; // Total Passive Force
  waterForce: number; // Hydrostatic Force
  overturningMoment: number;
  resistingMoment: number;
  fsOverturning: number;
  fsSliding: number;
  eccentricity: number; // e
  qMax: number; // Max Bearing Pressure
  qMin: number; // Min Bearing Pressure
  isBearingSafe: boolean;
  totalWeight: number;
  maxStemMoment: number;
  tensionCrackDepth: number;
  delta: number; // Wall Friction Angle
  beta: number; // Wall Back Angle
  forceVectors: ForceVector[];
  details: CalculationDetail[]; // New field for the table
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface FormulaData {
  title: string;
  tex: string;
  description: string;
}
