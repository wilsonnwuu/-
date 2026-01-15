
import { SoilParams, WallDimensions, CalculationResult, ForceVector, CalculationDetail } from '../types';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const GAMMA_WATER = 9.81; // kN/m^3

/**
 * Calculates a preliminary wall geometry based on height.
 */
export const suggestDimensions = (height: number): WallDimensions => {
  return {
    B: Number((0.6 * height).toFixed(2)),
    toe: Number((0.2 * height).toFixed(2)),
    stemTop: 0.3,
    stemBottom: Number((0.1 * height + 0.3).toFixed(2)),
    stemBatterSide: 'toe', // Default to vertical back (batter on toe side)
    baseThickness: Number((0.1 * height).toFixed(2)),
    keyDepth: 0,
    keyBottomWidth: 0.3,
  };
};

/**
 * Advanced Stability Calculation with Water Table, Tension Crack, Coulomb Theory, Eccentricity, and Bearing Capacity
 */
export const calculateStability = (params: SoilParams, dims: WallDimensions): CalculationResult => {
  const { 
    height, 
    // Backfill
    gammaDry, gammaSat, phi, cohesion, surcharge, slopeAngle, wallFriction,
    enableGroundwater, enableTensionCrack,
    // Foundation
    foundationGamma, foundationPhi, foundationCohesion, foundationSoilHeight, allowableBearing,
    // Structural
    concreteGamma, fPrimeC, fy, es, concreteCover
  } = params;

  const details: CalculationDetail[] = [];
  
  // Use user-defined concrete unit weight (default handled in App state)
  const GAMMA_CONCRETE = concreteGamma;

  // Handle Toggle: If GW disabled, set waterDepth > height (effective infinity)
  const waterDepth = enableGroundwater ? params.waterDepth : 999;

  // Angles to Radians
  const phiRad = phi * DEG_TO_RAD;
  const slopeRad = slopeAngle * DEG_TO_RAD;
  const fdnPhiRad = foundationPhi * DEG_TO_RAD;
  const deltaDeg = wallFriction;
  const deltaRad = deltaDeg * DEG_TO_RAD;

  // --- Structural Parameters Derivation ---
  // Ec = 4700 * sqrt(f'c) (MPa)
  const Ec_MPa = 4700 * Math.sqrt(fPrimeC);
  // Es is in GPa, convert to MPa -> * 1000
  const Es_MPa = es * 1000;
  // n = Es / Ec (Nearest integer)
  const n = Math.round(Es_MPa / Ec_MPa);
  
  // Allowable Stresses (WSD Approximation)
  const fc_allow = 0.45 * fPrimeC;
  const fs_allow = 0.5 * fy; // Simplified WSD

  details.push({ category: 'Structural', item: 'Unit Weight (γc)', formula: 'Input', value: GAMMA_CONCRETE.toFixed(1), unit: 'kN/m³' });
  details.push({ category: 'Structural', item: 'Comp. Strength (f\'c)', formula: 'Input', value: fPrimeC.toFixed(0), unit: 'MPa' });
  details.push({ category: 'Structural', item: 'Yield Strength (fy)', formula: 'Input', value: fy.toFixed(0), unit: 'MPa' });
  details.push({ category: 'Structural', item: 'Modulus Ratio (n)', formula: 'Es/Ec', value: n.toString(), unit: '-' });
  details.push({ category: 'Structural', item: 'Allowable Conc. (fc)', formula: '0.45 f\'c', value: fc_allow.toFixed(1), unit: 'MPa' });
  details.push({ category: 'Structural', item: 'Allowable Steel (fs)', formula: '0.5 fy', value: fs_allow.toFixed(0), unit: 'MPa' });
  details.push({ category: 'Structural', item: 'Concrete Cover (c)', formula: 'Input', value: concreteCover.toFixed(1), unit: 'cm' });


  // --- 1. Geometry Calculation ---
  const stemH = height - dims.baseThickness;
  const stemWidthDiff = Math.max(0, dims.stemBottom - dims.stemTop);
  
  // Wall Back Face Angle (Beta)
  let betaDeg = 90;
  let frontFaceAngleDeg = 90;

  if (dims.stemBatterSide === 'heel' && stemWidthDiff > 0) {
      // Batter on Heel (Back). Front is Vertical.
      const thetaRad = Math.atan(stemH / stemWidthDiff);
      betaDeg = thetaRad * RAD_TO_DEG;
      frontFaceAngleDeg = 90;
  } else if (dims.stemBatterSide === 'toe' && stemWidthDiff > 0) {
      // Batter on Toe (Front). Back is Vertical.
      betaDeg = 90;
      const thetaRad = Math.atan(stemH / stemWidthDiff);
      frontFaceAngleDeg = thetaRad * RAD_TO_DEG;
  }
  const betaRad = betaDeg * DEG_TO_RAD;
  const frontFaceAngleRad = frontFaceAngleDeg * DEG_TO_RAD;

  details.push({ category: 'Coefficients', item: 'Wall Inclination (β)', formula: 'Geometry', value: betaDeg.toFixed(1), unit: 'deg' });
  details.push({ category: 'Coefficients', item: 'Wall Friction (δ)', formula: 'User Input', value: deltaDeg.toFixed(1), unit: 'deg' });

  // --- 2. Active Coefficient (Ka) - Coulomb ---
  // Ka = sin²(β+φ) / [ sin²(β) * sin(β-δ) * (1 + sqrt( sin(φ+δ)sin(φ-α) / sin(β-δ)sin(α+β) ))² ]
  
  const sinBeta = Math.sin(betaRad);
  const sinBetaPhi = Math.sin(betaRad + phiRad);
  const sinBetaDelta = Math.sin(betaRad - deltaRad);
  const sinPhiDelta = Math.sin(phiRad + deltaRad);
  const sinPhiAlpha = Math.sin(phiRad - slopeRad);
  const sinAlphaBeta = Math.sin(slopeRad + betaRad);

  let ka = 0.33;
  if (phi >= slopeAngle) {
      const numerator = Math.pow(sinBetaPhi, 2);
      const sqrtTermInner = (sinPhiDelta * sinPhiAlpha) / (sinBetaDelta * sinAlphaBeta);
      const denominator = Math.pow(sinBeta, 2) * sinBetaDelta * Math.pow(1 + Math.sqrt(Math.max(0, sqrtTermInner)), 2);
      ka = numerator / denominator;
  }
  if (isNaN(ka) || !isFinite(ka)) ka = 0.33;

  details.push({ category: 'Coefficients', item: 'Active Coeff (Ka)', formula: 'Coulomb', value: ka.toFixed(3), unit: '-' });

  // --- 3. Passive Coefficient (Kp) - Coulomb ---
  
  const betaPassiveRad = frontFaceAngleRad; // Angle of front face
  const cosFdnPhi = Math.cos(fdnPhiRad);
  const cosDelta = Math.cos(deltaRad);
  const sinFdnPhiDelta = Math.sin(fdnPhiRad + deltaRad);
  const sinFdnPhi = Math.sin(fdnPhiRad);
  
  let kp = 0;
  // Denom factor inside sqrt (assuming alpha=0 for passive front soil)
  const sqrtInnerKp = (sinFdnPhiDelta * sinFdnPhi) / (cosDelta); 
  
  // Simplified Coulomb Kp (Vertical Face approx or general logic)
  const kp_numerator = Math.pow(cosFdnPhi, 2);
  const kp_denominator = cosDelta * Math.pow(1 - Math.sqrt(Math.max(0, sqrtInnerKp)), 2);
  kp = kp_numerator / kp_denominator;

  details.push({ category: 'Coefficients', item: 'Passive Coeff (Kp)', formula: 'Coulomb (δ included)', value: kp.toFixed(3), unit: '-' });


  // --- 4. Forces Calculation ---
  const safeWaterDepth = Math.min(Math.max(0, waterDepth), height);
  const dryHeight = safeWaterDepth;
  const wetHeight = height - safeWaterDepth;

  let Pa_total = 0;
  let Water_Force = 0;
  let Mo_water = 0;
  let pa_moment_sum = 0;

  // A. Dry Zone (Backfill)
  const sv_top = surcharge;
  const sv_bot_dry = surcharge + gammaDry * dryHeight;
  const sqrtKa = Math.sqrt(ka);
  
  // Tension Crack
  let tensionCrackDepth = 0;
  if (enableTensionCrack && gammaDry > 0 && ka > 0) {
    tensionCrackDepth = ((2 * cohesion) / sqrtKa - surcharge) / gammaDry;
  }
  tensionCrackDepth = Math.max(0, Math.min(tensionCrackDepth, height));

  const pa_top = Math.max(0, ka * sv_top - 2 * cohesion * sqrtKa);
  const pa_bot_dry = Math.max(0, ka * sv_bot_dry - 2 * cohesion * sqrtKa);

  // Function to calc area of trapezoid from y1 to y2
  const calcActiveForce = (y_start: number, y_end: number, p_start: number, p_end: number) => {
      const h = y_end - y_start;
      if (h <= 0) return { F: 0, M: 0 };
      const F = 0.5 * (p_start + p_end) * h;
      const y_centroid_from_bottom = (h / 3) * ((2 * p_start + p_end) / (p_start + p_end));
      // Moment arm relative to Base Bottom:
      const arm = (height - y_end) + y_centroid_from_bottom; 
      return { F, M: F * arm };
  };

  // Dry Zone Force
  let p_at_zc = 0; 
  if (tensionCrackDepth < dryHeight) {
      const sv_at_zc = surcharge + gammaDry * tensionCrackDepth;
      p_at_zc = Math.max(0, ka * sv_at_zc - 2 * cohesion * sqrtKa);
  }

  const dryRes = calcActiveForce(tensionCrackDepth, dryHeight, p_at_zc, pa_bot_dry);
  Pa_total += dryRes.F;
  pa_moment_sum += dryRes.M;

  // B. Wet Zone Forces
  let wetRes = {F:0, M:0};
  if (wetHeight > 0) {
    const gammaEff = gammaSat - GAMMA_WATER;
    const sv_bot_eff = sv_bot_dry + gammaEff * wetHeight;

    const pa_top_wet = Math.max(0, ka * sv_bot_dry - 2 * cohesion * sqrtKa); 
    const pa_bot_wet = Math.max(0, ka * sv_bot_eff - 2 * cohesion * sqrtKa);

    wetRes = calcActiveForce(dryHeight, height, pa_top_wet, pa_bot_wet);
    Pa_total += wetRes.F;
    pa_moment_sum += wetRes.M;

    // Water Pressure
    const u_bot = GAMMA_WATER * wetHeight;
    const F_water_mag = 0.5 * u_bot * wetHeight;
    
    // Water force acts normal to the back face (beta)
    const water_angle_below_horz = 90 - betaDeg; 
    const water_rad = water_angle_below_horz * DEG_TO_RAD;

    const Pwx = F_water_mag * Math.cos(water_rad);
    // Pwy stabilizes
    
    Water_Force = Pwx;
    Mo_water = Pwx * (wetHeight / 3); 
  }

  // --- Resolve Pa (Active) ---
  // Pa acts at angle δ to the Normal of the back face.
  // Angle below horizontal = (90 - Beta) + Delta
  const theta_total = (90 - betaDeg) + deltaDeg; 
  const theta_total_rad = theta_total * DEG_TO_RAD;
  
  const Pax = Pa_total * Math.cos(theta_total_rad);
  const Pay = Pa_total * Math.sin(theta_total_rad);
  
  // Moment Arms
  const y_Pa_from_base = Pa_total > 0 ? pa_moment_sum / Pa_total : height/3;
  // X location relative to Toe (assuming Heel is at B)
  const x_Pa_app = (dims.toe + dims.stemBottom) - (y_Pa_from_base / Math.tan(betaRad));
  
  const Mo_Pa_Horz = Pax * y_Pa_from_base;
  const Mr_Pa_Vert = Pay * x_Pa_app; 

  const overturningMoment = Mo_Pa_Horz + Mo_water;
  
  // --- Passive Force (Pp) ---
  const D = foundationSoilHeight + dims.keyDepth;
  // Pp = 0.5 * gamma * Kp * D^2 + 2 * c * sqrt(Kp) * D
  const pp_soil_term = 0.5 * foundationGamma * kp * Math.pow(D, 2);
  const pp_coh_term = 2 * foundationCohesion * Math.sqrt(kp) * D;
  const Pp_mag = pp_soil_term + pp_coh_term;
  
  // Direction of Pp:
  const Pp_angle_rad = deltaRad; 
  
  const Ppx = Pp_mag * Math.cos(Pp_angle_rad);
  const Ppy = Pp_mag * Math.sin(Pp_angle_rad); // Stabilizing vertical force
  
  const y_Pp = D / 3; // Centroid approx
  const Mr_Pp = Ppx * y_Pp; 

  // --- Resisting Forces (Weights) ---
  // NOTE: Using GAMMA_CONCRETE from user input now
  
  // 1. Concrete Parts
  const W_base = (dims.B * dims.baseThickness) * GAMMA_CONCRETE;
  const C_base_x = dims.B / 2;
  
  // Stem
  let W_stem = 0; 
  let M_stem = 0; // about Toe
  const stemH_concrete = height - dims.baseThickness;
  
  // Rect Part
  const stemRectArea = dims.stemTop * stemH_concrete;
  // Tri Part
  const stemTriArea = 0.5 * (dims.stemBottom - dims.stemTop) * stemH_concrete;
  
  if (dims.stemBatterSide === 'heel') {
      // Front Vertical. Rect is left, Tri is right.
      // Rect Centroid
      const x_rect = dims.toe + dims.stemTop/2;
      // Tri Centroid
      const x_tri = dims.toe + dims.stemTop + (dims.stemBottom - dims.stemTop)/3;
      
      W_stem = (stemRectArea + stemTriArea) * GAMMA_CONCRETE;
      M_stem = (stemRectArea * x_rect + stemTriArea * x_tri) * GAMMA_CONCRETE;
  } else {
      // Back Vertical. Tri is left, Rect is right.
      // Tri Centroid (heavier side on right) -> Tri is on left (slope).
      // Width starts at Toe.
      const x_tri = dims.toe + (2/3)*(dims.stemBottom - dims.stemTop);
      const x_rect = dims.toe + (dims.stemBottom - dims.stemTop) + dims.stemTop/2;
      
      W_stem = (stemRectArea + stemTriArea) * GAMMA_CONCRETE;
      M_stem = (stemRectArea * x_tri + stemTriArea * x_rect) * GAMMA_CONCRETE;
  }
  
  const W_key = (dims.keyDepth * dims.keyBottomWidth) * GAMMA_CONCRETE;
  const x_key = dims.toe + dims.stemBottom - dims.keyBottomWidth/2;

  // 2. Soil Weights
  let W_soil = 0; 
  let M_soil = 0;
  
  // Rectangular block over Heel
  const heelLen = Math.max(0, dims.B - dims.toe - dims.stemBottom);
  const volHeel = heelLen * stemH_concrete;
  const x_heel = dims.B - heelLen/2;
  W_soil += volHeel * gammaDry;
  M_soil += (volHeel * gammaDry) * x_heel;
  
  // Wedge over batter (if batter on heel)
  if (dims.stemBatterSide === 'heel') {
      const batterW = dims.stemBottom - dims.stemTop;
      const volWedge = 0.5 * batterW * stemH_concrete;
      const x_wedge = dims.toe + dims.stemTop + (2/3)*batterW;
      W_soil += volWedge * gammaDry;
      M_soil += (volWedge * gammaDry) * x_wedge;
  }
  
  // Passive Soil on Toe (if embedded)
  let W_soil_toe = 0;
  let M_soil_toe = 0;
  const toeSoilH = Math.max(0, foundationSoilHeight - dims.baseThickness);
  if (toeSoilH > 0) {
      const volToe = dims.toe * toeSoilH;
      const x_toe_soil = dims.toe / 2;
      W_soil_toe = volToe * foundationGamma;
      M_soil_toe = W_soil_toe * x_toe_soil;
  }

  // 3. Surcharge Vertical Load
  const W_surcharge = surcharge * (heelLen + (dims.stemBatterSide === 'heel' ? (dims.stemBottom - dims.stemTop) : 0));
  const C_surcharge = dims.B - (heelLen + (dims.stemBatterSide === 'heel' ? (dims.stemBottom - dims.stemTop) : 0)) / 2;
  const M_surcharge = W_surcharge * C_surcharge;
  
  // 4. Water Vertical Stabilizing
  let Pwy = 0;
  let Mr_water_vert = 0;
  if (wetHeight > 0) {
      const u_bot = GAMMA_WATER * wetHeight;
      const F_water_mag = 0.5 * u_bot * wetHeight;
      const water_angle_below_horz = 90 - betaDeg;
      Pwy = F_water_mag * Math.sin(water_angle_below_horz * DEG_TO_RAD);
      
      const y_water_app = wetHeight / 3;
      const x_water_toe = dims.B - (y_water_app / Math.tan(betaRad));
      Mr_water_vert = Pwy * x_water_toe;
  }

  // 5. Uplift
  let Uplift_Force = 0;
  let Mr_Uplift = 0; 
  if (wetHeight > 0) {
      const u_heel = (height - safeWaterDepth) * GAMMA_WATER;
      Uplift_Force = 0.5 * u_heel * dims.B;
      Mr_Uplift = Uplift_Force * (2/3 * dims.B); 
  }

  // --- Summaries ---
  
  const Sum_V_down = W_base + W_stem + W_key + W_soil + W_soil_toe + W_surcharge + Pay + Pwy;
  const Sum_V_up = Uplift_Force + Ppy; // Ppy acts up
  const V_net = Sum_V_down - Sum_V_up;
  
  const Mr_weights = (W_base * C_base_x) + M_stem + (W_key * x_key) + M_soil + M_soil_toe + M_surcharge;
  const Mr_forces = Mr_Pa_Vert + Mr_water_vert + Mr_Pp; // Mr_Pp is Ppx * arm
  
  const Mo_total = overturningMoment + Mr_Uplift;
  const Mr_total = Mr_weights + Mr_forces;
  
  const fsOverturning = Mo_total > 0 ? Mr_total / Mo_total : 999;
  
  details.push({ category: 'Stability', item: 'FS Overturning', formula: 'ΣMr / ΣMo', value: fsOverturning.toFixed(2), unit: '-' });

  // Sliding
  // Driving: Pax + Water_Force
  // Resisting: V_net * tan(delta_base) + c_base*B + Ppx
  const Driving_Horz = Pax + Water_Force;
  const mu = Math.tan(0.67 * fdnPhiRad); // Base friction
  const F_friction = V_net * mu;
  const F_adhesion = foundationCohesion * dims.B * 0.5; // usually reduced
  const Resisting_Horz = F_friction + F_adhesion + Ppx;
  
  const fsSliding = Driving_Horz > 0 ? Resisting_Horz / Driving_Horz : 999;
  
  details.push({ category: 'Stability', item: 'FS Sliding', formula: 'ΣFr / ΣFd', value: fsSliding.toFixed(2), unit: '-' });

  // --- Eccentricity & Bearing Capacity ---
  
  // Net Moment about Toe
  const M_net = Mr_total - Mo_total;
  // Location of Resultant from Toe
  const x_bar = V_net > 0 ? M_net / V_net : 0;
  // Eccentricity e = B/2 - x_bar
  const e = (dims.B / 2) - x_bar;
  
  details.push({ category: 'Bearing', item: 'Resultant Loc (x̄)', formula: 'M_net / V_net', value: x_bar.toFixed(2), unit: 'm' });
  details.push({ category: 'Bearing', item: 'Eccentricity (e)', formula: 'B/2 - x̄', value: e.toFixed(2), unit: 'm' });
  
  // Bearing Pressures
  let qMax = 0;
  let qMin = 0;
  
  if (Math.abs(e) <= dims.B / 6) {
      qMax = (V_net / dims.B) * (1 + (6 * e / dims.B));
      qMin = (V_net / dims.B) * (1 - (6 * e / dims.B));
  } else {
      if (x_bar > 0) {
          qMax = (2 * V_net) / (3 * x_bar);
          qMin = 0; // Tension implied
      } else {
          qMax = 9999; // Failure
          qMin = 0;
      }
  }
  
  const isBearingSafe = qMax <= allowableBearing && qMin >= 0 && Math.abs(e) <= dims.B/6;

  details.push({ category: 'Bearing', item: 'Max Pressure (q_max)', formula: 'V/B(1+6e/B)', value: qMax.toFixed(2), unit: 'kPa' });
  details.push({ category: 'Bearing', item: 'Min Pressure (q_min)', formula: 'V/B(1-6e/B)', value: qMin.toFixed(2), unit: 'kPa' });
  details.push({ category: 'Bearing', item: 'Allowable (q_all)', formula: 'Input', value: allowableBearing.toFixed(0), unit: 'kPa' });

  // --- Vectors ---
  const vectors: ForceVector[] = [];
  
  // Weights (grouped)
  const W_total_group = W_base + W_stem + W_key + W_soil + W_soil_toe + W_surcharge;
  const x_W_group = Mr_weights / W_total_group; // Centroid of weights
  
  vectors.push({ label: 'W', value: W_total_group, unit: 'kN', x: dims.B - x_W_group, y: height/2, dirX: 0, dirY: -1, color: '#475569' });
  
  // Pa
  vectors.push({ label: 'Pa', value: Pa_total, unit: 'kN', x: dims.B - x_Pa_app, y: y_Pa_from_base, dirX: -Math.cos(theta_total_rad), dirY: -Math.sin(theta_total_rad), color: '#ef4444' });
  
  // Pp
  if (Pp_mag > 0) {
      vectors.push({ 
          label: 'Pp', value: Pp_mag, unit: 'kN', 
          x: dims.B, y: y_Pp, 
          dirX: Math.cos(deltaRad), 
          dirY: Math.sin(deltaRad),
          color: '#3b82f6' 
      });
  }
  
  // Friction
  vectors.push({ label: 'Ff', value: F_friction + F_adhesion, unit: 'kN', x: dims.B / 2, y: 0, dirX: 1, dirY: 0, color: '#16a34a' });
  
  // Bearing Reaction
  vectors.push({ label: 'N', value: V_net, unit: 'kN', x: dims.B - x_bar, y: 0, dirX: 0, dirY: 1, color: '#8b5cf6' });

  return {
    ka, kp,
    pa: Pa_total,
    pp: Pp_mag,
    waterForce: Water_Force,
    overturningMoment: Mo_total,
    resistingMoment: Mr_total,
    fsOverturning,
    fsSliding,
    eccentricity: e,
    qMax, qMin, isBearingSafe,
    totalWeight: V_net,
    maxStemMoment: 0, 
    tensionCrackDepth,
    delta: deltaDeg,
    beta: betaDeg,
    forceVectors: vectors,
    details
  };
};

export const getDiagramData = (params: SoilParams, dims: WallDimensions, ka: number, kp: number) => {
    const { height, gammaDry, gammaSat, surcharge, cohesion, waterDepth, enableGroundwater, enableTensionCrack, foundationSoilHeight, foundationGamma, foundationCohesion } = params;
    
    // ... diagram logic remains the same ...
    const active: {y: number, p: number}[] = [];
    const sqrtKa = Math.sqrt(ka);
    let zc = 0;
    if (enableTensionCrack && gammaDry > 0) zc = ((2 * cohesion) / sqrtKa - surcharge) / gammaDry;
    zc = Math.max(0, zc);

    const points = [0, zc, waterDepth, height].filter(y => y >= 0 && y <= height).sort((a,b) => a-b);
    Array.from(new Set(points)).forEach(y => {
        let sv_eff = surcharge;
        if (y <= waterDepth) sv_eff += gammaDry * y;
        else sv_eff += gammaDry * waterDepth + (gammaSat - 9.81) * (y - waterDepth);
        let pa = ka * sv_eff - 2 * cohesion * sqrtKa;
        if (enableTensionCrack && y < zc) pa = 0;
        if (pa < 0) pa = 0;
        active.push({ y, p: pa });
    });

    const water: {y: number, p: number}[] = [];
    if (enableGroundwater && waterDepth < height) {
        water.push({ y: waterDepth, p: 0 });
        water.push({ y: height, p: (height - waterDepth) * 9.81 });
    }

    const passive: {y: number, p: number}[] = [];
    const embedment = foundationSoilHeight + dims.keyDepth;
    const pp_top = 2 * foundationCohesion * Math.sqrt(kp);
    passive.push({ y: 0, p: pp_top });
    const sv_bot_passive = foundationGamma * embedment;
    const pp_bot = kp * sv_bot_passive + 2 * foundationCohesion * Math.sqrt(kp);
    passive.push({ y: embedment, p: pp_bot });

    const safeWaterDepth = Math.min(Math.max(0, waterDepth), height);
    const u_heel = enableGroundwater ? Math.max(0, (height - safeWaterDepth) * 9.81) : 0;

    return { active, passive, water, uplift: { heel: u_heel, toe: 0 } };
};
