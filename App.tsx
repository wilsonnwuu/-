
import React, { useState, useMemo, useEffect } from 'react';
import { SoilParams, AnalysisStatus, WallDimensions } from './types';
import { calculateStability, suggestDimensions } from './utils/calculations';
import { analyzeWallDesign } from './services/geminiService';
import InputSlider from './components/InputSlider';
import WallVisualizer from './components/WallVisualizer';
import AnalysisPanel from './components/AnalysisPanel';
import { Layers, Settings2, Info, Ruler, Droplets, ChevronDown, ChevronRight, Scale, Activity, ArrowDownToLine, Triangle, Calculator, Construction } from 'lucide-react';

const App: React.FC = () => {
  const [soil, setSoil] = useState<SoilParams>({
    height: 3.0,
    // Backfill
    gammaDry: 18, 
    gammaSat: 20, 
    phi: 30,
    cohesion: 5,
    surcharge: 0,
    slopeAngle: 0,
    wallFriction: 15,
    waterDepth: 2.0, 
    enableGroundwater: false,
    enableTensionCrack: true,
    // Foundation
    foundationGamma: 19,
    foundationPhi: 35,
    foundationCohesion: 20,
    foundationSoilHeight: 0.5,
    allowableBearing: 200,
    // Structural
    concreteGamma: 24, // kN/m3
    fPrimeC: 28, // MPa
    fy: 420, // MPa
    es: 200, // GPa
    concreteCover: 7.5 // cm
  });

  const [dims, setDims] = useState<WallDimensions>(suggestDimensions(3.0));
  const [isManualMode, setIsManualMode] = useState(false);
  
  // UI State
  const [showUnitWeightDetails, setShowUnitWeightDetails] = useState(false);
  const [showFoundationDetails, setShowFoundationDetails] = useState(true);
  const [showStructuralDetails, setShowStructuralDetails] = useState(false);

  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [activeTab, setActiveTab] = useState<'input' | 'visual'>('input');
  
  useEffect(() => {
    if (!isManualMode) {
      setDims(suggestDimensions(soil.height));
    }
  }, [soil.height, isManualMode]);

  const results = useMemo(() => calculateStability(soil, dims), [soil, dims]);

  const handleAnalyze = async () => {
    setStatus(AnalysisStatus.LOADING);
    setAiResponse(null);
    try {
      const response = await analyzeWallDesign(soil, dims, results);
      setAiResponse(response);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (error) {
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const updateSoil = (key: keyof SoilParams, val: number | boolean) => {
    setSoil(prev => ({ ...prev, [key]: val }));
  };

  const updateDims = (key: keyof WallDimensions, val: any) => {
    setDims(prev => ({ ...prev, [key]: val }));
    setIsManualMode(true);
  };

  // Helper to update Stem Bottom based on desired Beta angle
  const updateBeta = (betaDeg: number) => {
     if (dims.stemBatterSide !== 'heel') return;
     const stemH = soil.height - dims.baseThickness;
     const angleRad = (90 - betaDeg) * (Math.PI / 180);
     const deltaW = stemH * Math.tan(angleRad);
     const newStemBottom = dims.stemTop + deltaW;
     const maxStemBottom = dims.B - dims.toe - 0.05; 
     if (newStemBottom >= dims.stemTop && newStemBottom <= maxStemBottom && newStemBottom < 5) {
         setDims(prev => ({ ...prev, stemBottom: newStemBottom }));
         setIsManualMode(true);
     }
  };

  const resetDimensions = () => {
    setDims(suggestDimensions(soil.height));
    setIsManualMode(false);
  };
  
  const setTypicalWallFriction = () => {
      updateSoil('wallFriction', soil.phi / 2);
  };

  const toTons = (val: number) => (val / 9.81).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-2 rounded-lg shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800">GeoWall<span className="text-indigo-600">.AI</span></span>
          </div>
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Advanced Retaining Structure Design
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-4rem)]">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Input Panel */}
          <div className={`lg:col-span-3 h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${activeTab === 'visual' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-500" />
                Parameters
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                
                {/* Global Geometry & Loads */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Geometry & Load</h3>
                  <InputSlider 
                    label="Wall Height (H)" value={soil.height} min={1} max={10} step={0.1} unit="m"
                    onChange={(v) => updateSoil('height', v)}
                    description="Total height from base to top"
                  />
                  <InputSlider 
                    label="Surcharge (q)" value={soil.surcharge} min={0} max={50} step={1} unit="kN/m²"
                    onChange={(v) => updateSoil('surcharge', v)}
                    description={`Traffic or building load (~${toTons(soil.surcharge)} t/m²)`}
                  />
                   <InputSlider 
                    label="Backfill Slope" value={soil.slopeAngle} min={0} max={30} step={1} unit="deg"
                    onChange={(v) => updateSoil('slopeAngle', v)}
                    description="Angle of soil behind wall"
                  />
                </section>

                <div className="h-px bg-slate-100 my-2"></div>

                {/* Backfill Soil Properties */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Backfill Soil</h3>
                  
                  {/* Collapsible Unit Weight Section */}
                  <div className="mb-5 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                    <button 
                      onClick={() => setShowUnitWeightDetails(!showUnitWeightDetails)}
                      className="w-full flex items-center justify-between p-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                         <Scale className="w-4 h-4 text-slate-500" />
                         <span>Backfill Unit Weight (γ)</span>
                      </div>
                      {showUnitWeightDetails ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                    </button>
                    
                    {showUnitWeightDetails ? (
                       <div className="p-3 pt-0 border-t border-slate-200 bg-white">
                          <div className="mt-3">
                            <InputSlider 
                              label="Dry/Bulk (γ_dry)" value={soil.gammaDry} min={14} max={22} step={0.5} unit="kN/m³"
                              onChange={(v) => updateSoil('gammaDry', v)}
                              description={`Above water (~${toTons(soil.gammaDry)} t/m³)`}
                            />
                            <InputSlider 
                              label="Saturated (γ_sat)" value={soil.gammaSat} min={18} max={24} step={0.5} unit="kN/m³"
                              onChange={(v) => updateSoil('gammaSat', v)}
                              description={`Below water (~${toTons(soil.gammaSat)} t/m³)`}
                            />
                          </div>
                       </div>
                    ) : (
                       <div className="px-3 pb-2 flex justify-between items-center text-xs text-slate-500">
                          <span>γ_dry: {soil.gammaDry} kN/m³</span>
                          <span className="text-slate-400">({toTons(soil.gammaDry)} t)</span>
                       </div>
                    )}
                  </div>

                  <InputSlider 
                    label="Friction Angle (Φ)" value={soil.phi} min={20} max={45} step={1} unit="deg"
                    onChange={(v) => updateSoil('phi', v)}
                    description="Internal soil friction"
                  />
                  
                  <div className="mb-5">
                      <div className="flex justify-between items-center mb-1">
                          <label className="text-sm font-semibold text-slate-700">Wall Friction (δ)</label>
                          <button onClick={setTypicalWallFriction} className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1">
                              <Calculator className="w-3 h-3"/> Set δ=φ/2
                          </button>
                      </div>
                      <InputSlider 
                        label="" value={soil.wallFriction} min={0} max={30} step={1} unit="deg"
                        onChange={(v) => updateSoil('wallFriction', v)}
                        description="Angle between soil and wall back"
                      />
                  </div>

                  <InputSlider 
                    label="Cohesion (c)" value={soil.cohesion} min={0} max={50} step={1} unit="kPa"
                    onChange={(v) => updateSoil('cohesion', v)}
                    description={`Soil cohesion (~${toTons(soil.cohesion)} t/m²)`}
                  />
                  
                  {/* Tension Crack Toggle */}
                  <div className="flex justify-between items-center mb-2 px-1">
                     <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                       <Activity className="w-3 h-3 text-slate-500"/> Tension Crack (Zc)
                     </label>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={soil.enableTensionCrack} 
                          onChange={(e) => updateSoil('enableTensionCrack', e.target.checked)} 
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                     </label>
                  </div>
                </section>

                <div className="h-px bg-slate-100 my-2"></div>

                {/* Foundation Soil Properties */}
                <section>
                    <button 
                      onClick={() => setShowFoundationDetails(!showFoundationDetails)}
                      className="w-full flex items-center justify-between mb-4 group"
                    >
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                           <ArrowDownToLine className="w-3 h-3"/> Foundation Soil
                       </h3>
                       {showFoundationDetails ? <ChevronDown className="w-3 h-3 text-slate-400"/> : <ChevronRight className="w-3 h-3 text-slate-400"/>}
                    </button>
                    
                    {showFoundationDetails && (
                        <div className="animate-in slide-in-from-top-2 fade-in space-y-5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                             <InputSlider 
                                label="Passive Height (D)" value={soil.foundationSoilHeight} min={0} max={2.5} step={0.1} unit="m"
                                onChange={(v) => updateSoil('foundationSoilHeight', v)}
                                description="Soil height above base (Front)"
                             />
                             <InputSlider 
                                label="Unit Weight (γ_fdn)" value={soil.foundationGamma} min={16} max={24} step={0.5} unit="kN/m³"
                                onChange={(v) => updateSoil('foundationGamma', v)}
                                description={`Foundation Soil Weight (~${toTons(soil.foundationGamma)} t)`}
                             />
                             <InputSlider 
                                label="Friction Angle (Φ_fdn)" value={soil.foundationPhi} min={20} max={45} step={1} unit="deg"
                                onChange={(v) => updateSoil('foundationPhi', v)}
                                description="Base sliding friction"
                             />
                             <InputSlider 
                                label="Cohesion (c_fdn)" value={soil.foundationCohesion} min={0} max={100} step={5} unit="kPa"
                                onChange={(v) => updateSoil('foundationCohesion', v)}
                                description={`Base adhesion (~${toTons(soil.foundationCohesion)} t)`}
                             />
                             <InputSlider 
                                label="Allowable Bearing (q_all)" value={soil.allowableBearing} min={50} max={500} step={10} unit="kPa"
                                onChange={(v) => updateSoil('allowableBearing', v)}
                                description={`Max safe soil pressure (~${toTons(soil.allowableBearing)} t)`}
                             />
                        </div>
                    )}
                </section>

                <div className="h-px bg-slate-100 my-2"></div>
                
                {/* Structural Materials (New) */}
                <section>
                    <button 
                      onClick={() => setShowStructuralDetails(!showStructuralDetails)}
                      className="w-full flex items-center justify-between mb-4 group"
                    >
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                           <Construction className="w-3 h-3"/> Structural Materials
                       </h3>
                       {showStructuralDetails ? <ChevronDown className="w-3 h-3 text-slate-400"/> : <ChevronRight className="w-3 h-3 text-slate-400"/>}
                    </button>
                    
                    {showStructuralDetails && (
                        <div className="animate-in slide-in-from-top-2 fade-in space-y-5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                             <InputSlider 
                                label="Concrete Unit Wt (γc)" value={soil.concreteGamma} min={20} max={25} step={0.1} unit="kN/m³"
                                onChange={(v) => updateSoil('concreteGamma', v)}
                             />
                             <InputSlider 
                                label="Conc. Strength (f'c)" value={soil.fPrimeC} min={14} max={42} step={1} unit="MPa"
                                onChange={(v) => updateSoil('fPrimeC', v)}
                                description="Standard: 21, 28, 35 MPa"
                             />
                             <InputSlider 
                                label="Rebar Yield (fy)" value={soil.fy} min={280} max={560} step={10} unit="MPa"
                                onChange={(v) => updateSoil('fy', v)}
                                description="Standard: 280, 420 MPa"
                             />
                             <InputSlider 
                                label="Steel Modulus (Es)" value={soil.es} min={190} max={210} step={1} unit="GPa"
                                onChange={(v) => updateSoil('es', v)}
                             />
                             <InputSlider 
                                label="Concrete Cover (c)" value={soil.concreteCover} min={3} max={10} step={0.5} unit="cm"
                                onChange={(v) => updateSoil('concreteCover', v)}
                             />
                        </div>
                    )}
                </section>
                
                {/* Groundwater Toggle Section */}
                <section className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mt-4">
                   <div className="flex justify-between items-center mb-3">
                     <h4 className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                       <Droplets className="w-3 h-3"/> Groundwater
                     </h4>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={soil.enableGroundwater} 
                          onChange={(e) => updateSoil('enableGroundwater', e.target.checked)} 
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-blue-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                     </label>
                   </div>
                   
                   {soil.enableGroundwater && (
                      <div className="animate-in slide-in-from-top-2 fade-in">
                        <InputSlider 
                          label="Water Depth" value={soil.waterDepth} min={0} max={soil.height} step={0.1} unit="m"
                          onChange={(v) => updateSoil('waterDepth', v)}
                          description="Depth from top of wall"
                        />
                      </div>
                   )}
                </section>

                <div className="h-px bg-slate-100 my-2"></div>

                {/* Wall Dimensions */}
                <section className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                   <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                       <Ruler className="w-3 h-3" /> Wall Dimensions
                     </h3>
                     {isManualMode && (
                       <button onClick={resetDimensions} className="text-[10px] text-indigo-600 hover:underline">
                         Auto-Reset
                       </button>
                     )}
                   </div>
                   
                   <div className="mb-4 space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2 flex items-center gap-1">
                            <Triangle className="w-3 h-3 rotate-90" /> Stem Slope Side
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
                            <button
                            onClick={() => updateDims('stemBatterSide', 'toe')}
                            className={`px-3 py-2 text-xs font-medium rounded-md transition-all ${
                                dims.stemBatterSide === 'toe' 
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                                : 'text-slate-500 hover:bg-slate-200'
                            }`}
                            >
                            Front Slope
                            </button>
                            <button
                            onClick={() => updateDims('stemBatterSide', 'heel')}
                            className={`px-3 py-2 text-xs font-medium rounded-md transition-all ${
                                dims.stemBatterSide === 'heel' 
                                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                                : 'text-slate-500 hover:bg-slate-200'
                            }`}
                            >
                            Back Slope
                            </button>
                        </div>
                      </div>

                      {dims.stemBatterSide === 'heel' && (
                          <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 animate-in fade-in">
                              <InputSlider 
                                label="Back Angle (β)" 
                                value={parseFloat(results.beta.toFixed(1))} 
                                min={60} max={90} step={0.1} unit="deg"
                                onChange={(v) => updateBeta(v)}
                                description="Adjusts Stem Base width"
                              />
                          </div>
                      )}
                      
                      {dims.stemBatterSide === 'toe' && (
                         <p className="text-xs text-slate-400 italic px-1">
                            Back face is vertical (β = 90°).
                         </p>
                      )}
                   </div>

                   <InputSlider 
                    label="Base Width (B)" value={dims.B} min={0.5} max={8.0} step={0.1} unit="m"
                    onChange={(v) => updateDims('B', v)}
                  />
                  <InputSlider 
                    label="Toe Width" value={dims.toe} min={0.1} max={3.0} step={0.1} unit="m"
                    onChange={(v) => updateDims('toe', v)}
                  />
                  <InputSlider 
                    label="Stem Base" value={dims.stemBottom} min={0.2} max={1.5} step={0.05} unit="m"
                    onChange={(v) => updateDims('stemBottom', v)}
                  />
                   <InputSlider 
                    label="Stem Top" value={dims.stemTop} min={0.2} max={0.8} step={0.05} unit="m"
                    onChange={(v) => updateDims('stemTop', v)}
                  />
                   <InputSlider 
                    label="Base Slab" value={dims.baseThickness} min={0.2} max={1.5} step={0.05} unit="m"
                    onChange={(v) => updateDims('baseThickness', v)}
                  />
                  
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-sm font-semibold text-slate-700">Shear Key</label>
                       <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={dims.keyDepth > 0} 
                              onChange={(e) => updateDims('keyDepth', e.target.checked ? 0.4 : 0)} 
                              className="sr-only peer" 
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:bg-indigo-600"></div>
                       </label>
                    </div>
                    {dims.keyDepth > 0 && (
                      <InputSlider 
                        label="Key Depth" value={dims.keyDepth} min={0.2} max={1.5} step={0.1} unit="m"
                        onChange={(v) => updateDims('keyDepth', v)}
                      />
                    )}
                  </div>

                </section>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className={`lg:col-span-9 h-full flex flex-col gap-6 ${activeTab === 'input' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-1 min-h-[300px] lg:min-h-[40%] bg-white rounded-xl shadow-sm border border-slate-200 p-2 relative">
               <WallVisualizer dims={dims} soil={soil} results={results} />
            </div>
            <div className="flex-1 min-h-[40%]">
               <AnalysisPanel results={results} aiResponse={aiResponse} status={status} onAnalyze={handleAnalyze} />
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex p-2 z-50">
        <button onClick={() => setActiveTab('input')} className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${activeTab === 'input' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>
          <Settings2 className="w-4 h-4" /> Parameters
        </button>
        <button onClick={() => setActiveTab('visual')} className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${activeTab === 'visual' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>
          <Info className="w-4 h-4" /> Analysis
        </button>
      </div>
    </div>
  );
};

export default App;
