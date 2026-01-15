import React, { useState, useMemo } from 'react';
import { WallDimensions, SoilParams, CalculationResult, FormulaData } from '../types';
import { getDiagramData } from '../utils/calculations';
import { Eye, EyeOff, Ruler, Move, Maximize, FileText } from 'lucide-react';

interface WallVisualizerProps {
  dims: WallDimensions;
  soil: SoilParams;
  results: CalculationResult;
  onFormulaClick?: (data: FormulaData) => void;
}

const WallVisualizer: React.FC<WallVisualizerProps> = ({ dims, soil, results }) => {
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [showForces, setShowForces] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  // Diagram Data
  const diagramData = useMemo(() => getDiagramData(soil, dims, results.ka, results.kp), [soil, dims, results]);

  // SVG Viewbox setup
  const scale = 40; 
  // Increase width to prevent right-side diagrams from being cut off (圖被擋住)
  const canvasHeight = 650; 
  const canvasWidth = 850; 
  
  const wallBaseY = canvasHeight - 150; 
  // Shift wall position left to give more room for right-side diagrams
  const wallHeelX = canvasWidth / 2 - 50; 
  
  // --- Points ---
  // Coordinate System: Wall Heel Bottom Right is (wallHeelX, wallBaseY) in SVG pixels
  // Note: All X coord calcs are: wallHeelX - (distance from heel right) * scale
  
  // Base Points
  const p1 = { x: wallHeelX, y: wallBaseY }; // Heel Bottom Right
  const p2 = { x: wallHeelX - dims.B * scale, y: wallBaseY }; // Toe Bottom Left
  const p3 = { x: wallHeelX - dims.B * scale, y: wallBaseY - dims.baseThickness * scale }; // Toe Top Left
  const p8 = { x: wallHeelX, y: wallBaseY - dims.baseThickness * scale }; // Heel Top Right
  
  // Stem Points Logic
  // Reference everything from Toe Tip (p2.x) to simplify direction logic
  // p2.x is Leftmost point.
  // Stem Base always starts at: p2.x + dims.toe * scale
  // Stem Base ends at: p2.x + (dims.toe + dims.stemBottom) * scale
  
  const stemBaseLeftX = p2.x + dims.toe * scale;
  const stemBaseRightX = p2.x + (dims.toe + dims.stemBottom) * scale;
  
  let stemTopLeftX, stemTopRightX;
  
  if (dims.stemBatterSide === 'heel') {
      // Batter on Heel (Back). Front Face is Vertical.
      // Front Face aligns with Stem Base Left
      stemTopLeftX = stemBaseLeftX;
      // Back Face is calculated from Front Face + Top Width
      stemTopRightX = stemTopLeftX + dims.stemTop * scale;
  } else {
      // Batter on Toe (Front). Back Face is Vertical.
      // Back Face aligns with Stem Base Right
      stemTopRightX = stemBaseRightX;
      // Front Face is calculated from Back Face - Top Width
      stemTopLeftX = stemTopRightX - dims.stemTop * scale;
  }

  const p4 = { x: stemBaseLeftX, y: wallBaseY - dims.baseThickness * scale }; // Stem Bottom Left
  const p5 = { x: stemTopLeftX, y: wallBaseY - soil.height * scale }; // Stem Top Left
  const p6 = { x: stemTopRightX, y: wallBaseY - soil.height * scale }; // Stem Top Right
  const p7 = { x: stemBaseRightX, y: wallBaseY - dims.baseThickness * scale }; // Stem Bottom Right

  // Key Points
  // Assume Key is centered under stem base
  const keyCenterX = (p4.x + p7.x) / 2;
  const keyXRight = keyCenterX + (dims.keyBottomWidth/2) * scale;
  const keyXLeft = keyCenterX - (dims.keyBottomWidth/2) * scale;
  const keyYBottom = wallBaseY + dims.keyDepth * scale;

  // --- Paths ---
  const foundationSoilPath = `M 0,${wallBaseY} L ${canvasWidth},${wallBaseY} L ${canvasWidth},${canvasHeight} L 0,${canvasHeight} Z`;

  const soilTopY = wallBaseY - soil.height * scale;
  const farRightY = soilTopY - (Math.tan(soil.slopeAngle * Math.PI/180) * (canvasWidth - p6.x));
  
  const backfillPath = `
    M ${p6.x},${p6.y} 
    L ${canvasWidth},${farRightY} 
    L ${canvasWidth},${wallBaseY} 
    L ${p1.x},${wallBaseY}
    L ${p8.x},${p8.y}
    L ${p7.x},${p7.y}
    Z
  `;

  // Construct Wall Path
  let wallPath = `M ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} L ${p5.x},${p5.y} L ${p6.x},${p6.y} L ${p7.x},${p7.y} L ${p8.x},${p8.y} L ${p1.x},${p1.y}`;
  if (dims.keyDepth > 0) {
      wallPath += ` L ${keyXRight},${wallBaseY} L ${keyXRight},${keyYBottom} L ${keyXLeft},${keyYBottom} L ${keyXLeft},${wallBaseY}`;
  }
  wallPath += ` Z`;

  // Front Ground Line (Passive Soil Surface)
  const groundYFront = wallBaseY - soil.foundationSoilHeight * scale;
  const groundLineFront = `M 0,${groundYFront} L ${p2.x},${groundYFront}`;
  
  // Passive Soil Block (if height > 0)
  // Drawn above wallBaseY up to groundYFront
  let passiveSoilBlock = '';
  if (soil.foundationSoilHeight > 0) {
      // Path: from wallBaseY up to groundYFront, constrained by Toe
      // If soil > baseThickness, it covers the toe
      if (soil.foundationSoilHeight > dims.baseThickness) {
          passiveSoilBlock = `
             M 0,${wallBaseY}
             L ${p2.x},${wallBaseY}
             L ${p2.x},${p3.y}
             L ${p4.x},${p3.y}
             L ${p4.x},${groundYFront}
             L 0,${groundYFront}
             Z
          `;
      } else {
         passiveSoilBlock = `
             M 0,${wallBaseY}
             L ${p2.x},${wallBaseY}
             L ${p2.x},${groundYFront}
             L 0,${groundYFront}
             Z
          `;
      }
  }

  const waterY = soilTopY + Math.min(soil.height, soil.enableGroundwater ? soil.waterDepth : 999) * scale;
  const waterLine = `M ${p6.x},${waterY} L ${canvasWidth},${waterY}`;
  
  const crackDepth = Math.min(soil.height, results.tensionCrackDepth);
  const crackY = soilTopY + crackDepth * scale;
  const crackLine = `M ${p6.x},${crackY} L ${canvasWidth},${crackY}`;

  // --- Diagrams ---
  // 1. Active Pressure (Right side, behind wall)
  // Draw diagram on the back face (p6 to p7 line)
  // For simplicity, we draw it slightly offset to the right of the back face points
  
  const maxActiveP = Math.max(...diagramData.active.map(pt => pt.p), 0);
  const activeDiagramWidth = maxActiveP * scale * 0.05;

  // We need to map y-coordinates to x-coordinates along the back face
  // Back face slope:
  const backFaceSlope = (p7.x - p6.x) / (p7.y - p6.y); // dx/dy
  
  // Function to get X on back face for a given Y
  const getBackFaceX = (y: number) => {
      // y is svg y coord
      // relative y from top (p6)
      const dy = y - p6.y;
      return p6.x + dy * backFaceSlope;
  };

  const offset = 30;

  let activePoly = `M ${p6.x + offset},${p6.y}`;
  diagramData.active.forEach(pt => {
      const y = soilTopY + pt.y * scale;
      const x_base = getBackFaceX(y);
      activePoly += ` L ${x_base + offset + pt.p * scale * 0.05},${y}`;
  });
  // Close shape
  const lastPtY = soilTopY + diagramData.active[diagramData.active.length-1].y * scale;
  activePoly += ` L ${getBackFaceX(lastPtY) + offset},${lastPtY} Z`;

  // 2. Water Pressure (Shifted right)
  const waterXOffset = offset + activeDiagramWidth + 50;
  
  let waterPoly = `M ${getBackFaceX(waterY) + waterXOffset},${waterY}`;
  diagramData.water.forEach(pt => {
      const y = soilTopY + pt.y * scale;
      if(y >= waterY) {
         const x_base = getBackFaceX(y);
         waterPoly += ` L ${x_base + waterXOffset + pt.p * scale * 0.05},${y}`;
      }
  });
  waterPoly += ` L ${getBackFaceX(lastPtY) + waterXOffset},${lastPtY} Z`;

  // 3. Passive Pressure (Left side, front of toe)
  const passiveX = p2.x - 30;
  let passivePoly = `M ${passiveX},${groundYFront}`;
  diagramData.passive.forEach(pt => {
     const y = groundYFront + pt.y * scale;
     const x = passiveX - pt.p * scale * 0.05;
     passivePoly += ` L ${x},${y}`;
  });
  const passiveBottomY = wallBaseY + dims.keyDepth * scale;
  passivePoly += ` L ${passiveX},${passiveBottomY} Z`;

  // 4. Uplift Pressure (Bottom)
  const upliftY = dims.keyDepth > 0 ? keyYBottom + 20 : wallBaseY + 20;
  const upliftPoly = `
     M ${p2.x},${upliftY}
     L ${p2.x},${upliftY + diagramData.uplift.toe * scale * 0.05}
     L ${p1.x},${upliftY + diagramData.uplift.heel * scale * 0.05}
     L ${p1.x},${upliftY}
     Z
  `;

  // Stack counters for dimension lines to avoid overlap
  let vertDimStack = 0;
  let horzDimStack = 0;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-sky-50/30 rounded-xl border border-slate-200 shadow-inner group">
      <svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="soilPattern" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <line x1="0" y="0" x2="0" y2="10" stroke="#a18072" strokeWidth="1" opacity="0.4" />
          </pattern>
          <pattern id="foundationPattern" patternUnits="userSpaceOnUse" width="16" height="16">
            <path d="M0,0 L16,16 M8,0 L16,8 M0,8 L8,16" stroke="#94a3b8" strokeWidth="1" opacity="0.2"/>
          </pattern>
          <pattern id="concretePattern" patternUnits="userSpaceOnUse" width="8" height="8">
             <circle cx="2" cy="2" r="0.5" fill="#94a3b8" />
          </pattern>
          <linearGradient id="activeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="passiveGrad" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
           <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
          <marker id="arrowHead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill="#334155" />
          </marker>
          <marker id="dimArrowStart" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
             <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill="#64748b" />
          </marker>
          <marker id="dimArrowEnd" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
             <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill="#64748b" />
          </marker>
          {results.forceVectors.map((vec, i) => (
             <marker key={`m-${i}`} id={`dimArrowStart-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
               <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill={vec.color} />
             </marker>
          ))}
          {results.forceVectors.map((vec, i) => (
             <marker key={`me-${i}`} id={`dimArrowEnd-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
               <path d="M0,0 L6,3 L0,6 L1.5,3 z" fill={vec.color} />
             </marker>
          ))}
        </defs>

        <path d={foundationSoilPath} fill="url(#foundationPattern)" />
        <path d={backfillPath} fill="url(#soilPattern)" stroke="#a18072" strokeWidth="2" />
        
        {/* Passive Soil Block */}
        {soil.foundationSoilHeight > 0 && (
           <path d={passiveSoilBlock} fill="url(#foundationPattern)" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
        )}

        {soil.enableGroundwater && soil.waterDepth < soil.height && (
            <g>
                <path d={waterLine} stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 4" />
                <path d={`M ${canvasWidth - 20},${waterY} l -5,-5 l 10,0 z`} fill="#3b82f6" />
                <text x={canvasWidth - 30} y={waterY - 10} fill="#3b82f6" fontSize="10" textAnchor="end">Water Table</text>
            </g>
        )}

        {results.tensionCrackDepth > 0 && (
             <g>
                <path d={crackLine} stroke="#dc2626" strokeWidth="1" strokeDasharray="2 2" />
                <text x={canvasWidth - 10} y={crackY - 5} fill="#dc2626" fontSize="10" textAnchor="end">Zc={(results.tensionCrackDepth).toFixed(2)}m</text>
            </g>
        )}

        <path d={wallPath} fill="url(#concretePattern)" stroke="#475569" strokeWidth="2" className="drop-shadow-lg" />
        <path d={groundLineFront} stroke="#64748b" strokeWidth="2" strokeDasharray="4 2" />

        {/* Diagrams */}
        {showDiagrams && (
          <g className="animate-in fade-in duration-500">
            {/* Active */}
            <path d={activePoly} fill="url(#activeGrad)" stroke="#ef4444" strokeWidth="1" />
            <text x={p6.x + offset} y={soilTopY - 10} fill="#ef4444" fontSize="12" fontWeight="bold">Active Pressure</text>

            {/* Passive */}
            <path d={passivePoly} fill="url(#passiveGrad)" stroke="#3b82f6" strokeWidth="1" />
            <text x={passiveX} y={groundYFront - 10} fill="#3b82f6" fontSize="12" textAnchor="end" fontWeight="bold">Passive</text>

            {/* Uplift */}
            {soil.enableGroundwater && (
                <g>
                    <path d={upliftPoly} fill="#bae6fd" stroke="#0ea5e9" strokeWidth="1" opacity="0.6"/>
                    <text x={p1.x} y={upliftY + diagramData.uplift.heel * scale * 0.05 + 15} fill="#0ea5e9" fontSize="10" textAnchor="end">Uplift</text>
                </g>
            )}

            {soil.enableGroundwater && soil.waterDepth < soil.height && (
                <g>
                    <path d={waterPoly} fill="url(#waterGrad)" stroke="#3b82f6" strokeWidth="1" />
                    <text x={getBackFaceX(waterY) + waterXOffset} y={waterY + 20} fill="#3b82f6" fontSize="10" fontWeight="bold">Water</text>
                </g>
            )}
          </g>
        )}

        {/* Geometric Dimensions */}
        {showDimensions && (
            <g className="animate-in fade-in duration-500">
                {/* H */}
                <line x1={p2.x - 20} y1={p2.y} x2={p2.x - 20} y2={p5.y} stroke="#64748b" strokeWidth="1" markerStart="url(#dimArrowStart)" markerEnd="url(#dimArrowEnd)" />
                <text x={p2.x - 25} y={(p2.y + p5.y)/2} fill="#64748b" fontSize="11" textAnchor="end" className="font-mono">H={soil.height}m</text>
                
                {/* B */}
                <line x1={p2.x} y1={p2.y + 40} x2={p1.x} y2={p1.y + 40} stroke="#64748b" strokeWidth="1" markerStart="url(#dimArrowStart)" markerEnd="url(#dimArrowEnd)" />
                <line x1={p2.x} y1={p2.y} x2={p2.x} y2={p2.y + 45} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                <line x1={p1.x} y1={p1.y} x2={p1.x} y2={p1.y + 45} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                <text x={(p1.x + p2.x)/2} y={p1.y + 55} fill="#64748b" fontSize="11" textAnchor="middle" className="font-mono">B={dims.B}m</text>

                {/* Key Depth if > 0 */}
                {dims.keyDepth > 0 && (
                    <g>
                        <line x1={keyXRight + 15} y1={wallBaseY} x2={keyXRight + 15} y2={keyYBottom} stroke="#64748b" strokeWidth="1" markerStart="url(#dimArrowStart)" markerEnd="url(#dimArrowEnd)" />
                        <text x={keyXRight + 20} y={(wallBaseY + keyYBottom)/2} fill="#64748b" fontSize="9" alignmentBaseline="middle">D={dims.keyDepth}m</text>
                    </g>
                )}
            </g>
        )}

        {/* Force Vectors & Moment Arms */}
        {results.forceVectors.map((vec, i) => {
            // Coordinate Transform
            const appX = wallHeelX - vec.x * scale;
            const appY = wallBaseY - vec.y * scale;
            const vectorLen = 50; 
            
            // Normalized Direction
            const mag = Math.sqrt(vec.dirX*vec.dirX + vec.dirY*vec.dirY);
            const ndx = vec.dirX / mag;
            const ndy = vec.dirY / mag;
            
            // SVG Direction (Y inverted)
            const sdx = ndx;
            const sdy = -ndy;

            // Draw arrow (Tail -> Head)
            const headX = appX;
            const headY = appY;
            const tailX = appX - sdx * vectorLen;
            const tailY = appY - sdy * vectorLen;

            // Text Position
            const textMargin = 15;
            const textX = tailX - sdx * textMargin;
            const textY = tailY - sdy * textMargin;

            // --- Dimension Logic ---
            let dimElement = null;
            if (showDimensions && showForces) {
                // Determine if Horizontal or Vertical based on major component
                const isVerticalForce = Math.abs(vec.dirY) > Math.abs(vec.dirX);
                
                if (isVerticalForce) {
                   // Vertical Force (e.g., Weight) -> Show horizontal distance from Toe (p2.x)
                   const armVal = dims.B - vec.x;
                   
                   // Stack lines at bottom
                   const stackY = wallBaseY + 70 + (vertDimStack * 15);
                   vertDimStack++;
                   
                   dimElement = (
                       <g className="animate-in fade-in">
                          {/* Extension Line from Force */}
                          <line x1={headX} y1={headY} x2={headX} y2={stackY + 5} stroke={vec.color} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
                          {/* Dimension Line (Toe to Force X) */}
                          <line x1={p2.x} y1={stackY} x2={headX} y2={stackY} stroke={vec.color} strokeWidth="1" markerStart={`url(#dimArrowStart-${i})`} markerEnd={`url(#dimArrowEnd-${i})`} />
                          {/* Text */}
                          <text x={(p2.x + headX)/2} y={stackY - 2} fill={vec.color} fontSize="9" textAnchor="middle">{armVal.toFixed(2)}m</text>
                       </g>
                   );
                } else {
                   // Horizontal Force (e.g., Active Pressure) -> Show vertical distance from Base (wallBaseY)
                   const armVal = vec.y; // vec.y is distance from Base
                   
                   // Stack lines at Right
                   const stackX = p1.x + 60 + (horzDimStack * 25);
                   horzDimStack++;

                   dimElement = (
                       <g className="animate-in fade-in">
                          {/* Extension Line from Force */}
                          <line x1={headX} y1={headY} x2={stackX + 5} y2={headY} stroke={vec.color} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
                          {/* Dimension Line (Base to Force Y) */}
                          <line x1={stackX} y1={wallBaseY} x2={stackX} y2={headY} stroke={vec.color} strokeWidth="1" markerStart={`url(#dimArrowStart-${i})`} markerEnd={`url(#dimArrowEnd-${i})`} />
                          {/* Extension line from Base */}
                          <line x1={p1.x} y1={wallBaseY} x2={stackX + 5} y2={wallBaseY} stroke={vec.color} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
                          
                          {/* Text */}
                          <text x={stackX + 10} y={(wallBaseY + headY)/2} fill={vec.color} fontSize="9" alignmentBaseline="middle">{armVal.toFixed(2)}m</text>
                       </g>
                   );
                }
            }
            
            return (
               <g key={i}>
                   {showForces && (
                     <g className="animate-in zoom-in duration-300">
                        <line x1={tailX} y1={tailY} x2={headX} y2={headY} stroke={vec.color} strokeWidth="2" markerEnd="url(#arrowHead)" />
                        <circle cx={headX} cy={headY} r="3" fill={vec.color} />
                        <g style={{ pointerEvents: 'none' }}>
                            <rect x={textX - 20} y={textY - 18} width="40" height="35" rx="4" fill="white" fillOpacity="0.75" />
                            <text x={textX} y={textY - 8} fill={vec.color} fontSize="12" fontWeight="bold" textAnchor="middle">{vec.label}</text>
                            <text x={textX} y={textY + 6} fill={vec.color} fontSize="10" textAnchor="middle">{vec.value.toFixed(1)} {vec.unit}</text>
                            <text x={textX} y={textY + 16} fill={vec.color} fontSize="9" textAnchor="middle">({(vec.value / 9.81).toFixed(2)} t)</text>
                        </g>
                     </g>
                   )}
                   {dimElement}
               </g>
            );
        })}

      </svg>
      
      {/* Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <button 
          onClick={() => setShowDiagrams(!showDiagrams)}
          className="flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-medium text-slate-700 transition-colors w-32 justify-start"
        >
          {showDiagrams ? <Eye className="w-3 h-3 text-indigo-500" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
          Diagrams
        </button>
        <button 
          onClick={() => setShowForces(!showForces)}
          className="flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-medium text-slate-700 transition-colors w-32 justify-start"
        >
          {showForces ? <Move className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
          Forces
        </button>
        <button 
          onClick={() => setShowDimensions(!showDimensions)}
          className="flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-medium text-slate-700 transition-colors w-32 justify-start"
        >
          {showDimensions ? <Maximize className="w-3 h-3 text-slate-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
          Dimensions
        </button>
      </div>
    </div>
  );
};

export default WallVisualizer;