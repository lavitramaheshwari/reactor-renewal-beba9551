import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Flame, Droplets, Wind, TrendingUp, Leaf, Award, ArrowRight, RotateCcw, Beaker, Thermometer, Snowflake, Info, Play, BookOpen, BarChart3, Package } from 'lucide-react';

const PyrolysisSimulator = () => {
  const [stage, setStage] = useState(0);
  const [plasticRatio, setPlasticRatio] = useState(50);
  const [heatGrid, setHeatGrid] = useState(Array(10).fill().map(() => Array(10).fill(0)));
  const [coolingPower, setCoolingPower] = useState(50);
  const [gasTemp, setGasTemp] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const [coolingTime, setCoolingTime] = useState(0);
  const [coolingStarted, setCoolingStarted] = useState(false);
  const [sortingProgress, setSortingProgress] = useState({ biochar: 0, syngas: 0, liquidFuel: 0 });
  const [sortingComplete, setSortingComplete] = useState(false);
  const [spawnedProducts, setSpawnedProducts] = useState([]);
  const spawnIdRef = useRef(0);
  
  const biomassRatio = 100 - plasticRatio;
  
  // Microwave pyrolysis product generation based on feedstock composition
  // Real yields: Plastic → ~65% oil, ~25% syngas, ~10% char
  //              Biomass → ~25% oil, ~35% syngas, ~40% char
  const getProductProbabilities = useCallback(() => {
    const pFrac = plasticRatio / 100;
    const bFrac = biomassRatio / 100;
    const oilProb = pFrac * 0.65 + bFrac * 0.25;
    const gasProb = pFrac * 0.25 + bFrac * 0.35;
    // charProb is remainder
    return { oilProb, gasProb };
  }, [plasticRatio, biomassRatio]);
  
  // Spawn products in reactor during sorting stage
  useEffect(() => {
    if (stage !== 3 || sortingComplete) return;
    
    const interval = setInterval(() => {
      const { oilProb, gasProb } = getProductProbabilities();
      const roll = Math.random();
      let type;
      if (roll < oilProb) type = 'liquidFuel';
      else if (roll < oilProb + gasProb) type = 'syngas';
      else type = 'biochar';
      
      const id = spawnIdRef.current++;
      const x = 10 + Math.random() * 75;
      
      setSpawnedProducts(prev => {
        // Keep max 12 visible products
        const filtered = prev.length >= 12 ? prev.slice(1) : prev;
        return [...filtered, { id, type, x, spawnTime: Date.now() }];
      });
    }, 800);
    
    return () => clearInterval(interval);
  }, [stage, sortingComplete, getProductProbabilities]);
  
  useEffect(() => {
    if (sortingProgress.biochar === 10 && sortingProgress.syngas === 10 && sortingProgress.liquidFuel === 10) {
      setSortingComplete(true);
    }
  }, [sortingProgress]);
  
  const calculateHeatMetrics = () => {
    const flatGrid = heatGrid.flat();
    const totalHeat = flatGrid.reduce((sum, val) => sum + val, 0);
    const avgHeat = totalHeat / 100;
    const variance = flatGrid.reduce((sum, val) => sum + Math.pow(val - avgHeat, 2), 0) / 100;
    const stdDev = Math.sqrt(variance);
    const uniformity = Math.max(0, 100 - stdDev);
    return {
      averageHeat: avgHeat,
      uniformity: uniformity,
      completeness: Math.min(100, (avgHeat / 80) * 100)
    };
  };
  
  const heatMetrics = calculateHeatMetrics();
  
  useEffect(() => {
    if (stage === 4 && coolingStarted) {
      const interval = setInterval(() => {
        setCoolingTime(prev => prev + 0.1);
        setGasTemp(prev => {
          const heatLoss = coolingPower * 0.8;
          const naturalHeat = 10;
          const newTemp = prev - heatLoss + naturalHeat;
          return Math.max(100, Math.min(900, newTemp));
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [stage, coolingPower, coolingStarted]);
  
  const calculateYields = () => {
    const metrics = calculateHeatMetrics();
    const plasticToLiquid = (plasticRatio / 100) * 0.75;
    const biomassToLiquid = (biomassRatio / 100) * 0.25;
    const biomassToBiochar = (biomassRatio / 100) * 0.40;
    const plasticToBiochar = (plasticRatio / 100) * 0.08;
    const biomassToSyngas = (biomassRatio / 100) * 0.50;
    const plasticToSyngas = (plasticRatio / 100) * 0.30;
    const uniformityFactor = metrics.uniformity / 100;
    const heatingFactor = Math.min(1, metrics.completeness / 100);
    const optimalTemp = 400;
    const tempDiff = Math.abs(gasTemp - optimalTemp);
    const coolingEfficiency = Math.max(0.5, 1 - (tempDiff / 600));
    const sortingBonus = ((sortingProgress.biochar + sortingProgress.syngas + sortingProgress.liquidFuel) / 30);
    const sortingFactor = 1 + (sortingBonus * 0.3);
    const liquidFuel = ((plasticToLiquid + biomassToLiquid) * uniformityFactor * heatingFactor * coolingEfficiency * sortingFactor) * 100;
    const syngas = ((biomassToSyngas + plasticToSyngas) * uniformityFactor * heatingFactor * coolingEfficiency * sortingFactor) * 100;
    const biochar = ((biomassToBiochar + plasticToBiochar) * uniformityFactor * heatingFactor * sortingFactor) * 100;
    const sortingRecovery = sortingBonus * 100;
    const condensationQuality = coolingEfficiency * 100;
    const overallEfficiency = (liquidFuel + syngas + biochar) / 3;
    const carbonReduction = (plasticRatio * 0.8 + biomassRatio * 1.2) / 100;
    return {
      liquidFuel: Math.min(100, liquidFuel.toFixed(1)),
      syngas: Math.min(100, syngas.toFixed(1)),
      biochar: Math.min(100, biochar.toFixed(1)),
      sortingRecovery: sortingRecovery.toFixed(1),
      condensationQuality: condensationQuality.toFixed(1),
      overallEfficiency: overallEfficiency.toFixed(1),
      carbonReduction: carbonReduction.toFixed(2)
    };
  };
  
  const handleCellInteraction = (row, col) => {
    if (stage !== 2) return;
    setHeatGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      newGrid[row][col] = Math.min(100, newGrid[row][col] + 50);
      return newGrid;
    });
  };
  
  const handleMouseDown = (row, col) => {
    setIsDragging(true);
    handleCellInteraction(row, col);
  };
  
  const handleMouseEnter = (row, col) => {
    if (isDragging || stage === 2) {
      handleCellInteraction(row, col);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const FeedstockParticles = () => {
    const particles = [];
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const isPlastic = (i / particleCount) < (plasticRatio / 100);
      particles.push(
        <div
          key={i}
          className={`absolute w-2.5 h-2.5 rounded-full ${isPlastic ? 'bg-blue-400' : 'bg-emerald-400'}`}
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${5 + Math.random() * 60}%`,
            animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
            opacity: 0.7 + Math.random() * 0.3
          }}
        />
      );
    }
    return particles;
  };
  
  const getCoolingFeedback = () => {
    const diff = Math.abs(gasTemp - 400);
    if (diff < 50) return { text: 'OPTIMAL', color: 'text-emerald-400' };
    if (gasTemp > 500) return { text: 'TOO HOT', color: 'text-red-400' };
    if (gasTemp < 300) return { text: 'TOO COLD', color: 'text-cyan-400' };
    return { text: 'ADJUSTING...', color: 'text-yellow-400' };
  };
  
  const feedback = getCoolingFeedback();
  
  const resetGame = () => {
    setStage(0);
    setPlasticRatio(50);
    setHeatGrid(Array(10).fill().map(() => Array(10).fill(0)));
    setCoolingPower(50);
    setGasTemp(800);
    setCoolingTime(0);
    setCoolingStarted(false);
    setSortingProgress({ biochar: 0, syngas: 0, liquidFuel: 0 });
    setSortingComplete(false);
    setSpawnedProducts([]);
    spawnIdRef.current = 0;
  };

  const totalSorted = sortingProgress.biochar + sortingProgress.syngas + sortingProgress.liquidFuel;
  const remaining = 30 - totalSorted;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
        
        * { font-family: 'Inter', sans-serif; }
        h1, h2, h3, h4, .title-font { font-family: 'Orbitron', sans-serif; }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-10px) translateX(5px); }
          50% { transform: translateY(-5px) translateX(-5px); }
          75% { transform: translateY(-15px) translateX(3px); }
        }
        
        @keyframes slideInUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.7), 0 0 60px rgba(239, 68, 68, 0.3); }
        }
        
        @keyframes bubbleUp {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { opacity: 1; }
          100% { transform: translateY(-20px) scale(0.5); opacity: 0; }
        }
        
        @keyframes spawnRise {
          0% { transform: translateY(100%) scale(0.3); opacity: 0; }
          20% { opacity: 1; transform: translateY(60%) scale(0.8); }
          40% { transform: translateY(30%) scale(1); }
          100% { transform: translateY(0%) scale(1); opacity: 1; }
        }
        
        @keyframes reactorGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes smokePuff {
          0% { transform: translateY(0) scale(1); opacity: 0.4; }
          100% { transform: translateY(-40px) scale(2); opacity: 0; }
        }
        
        .spawn-product {
          animation: spawnRise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .animate-slide-in { animation: slideInUp 0.6s ease-out; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        
        .card {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(100, 116, 139, 0.2);
          border-radius: 1rem;
        }
        
        .card-inner {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(100, 116, 139, 0.15);
          border-radius: 0.75rem;
        }
        
        .gradient-mesh {
          background: 
            radial-gradient(at 20% 30%, rgba(239, 68, 68, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 70%, rgba(6, 182, 212, 0.08) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(16, 185, 129, 0.05) 0px, transparent 50%);
        }
        
        input[type="range"] {
          -webkit-appearance: none;
          height: 8px;
          border-radius: 4px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #0f172a;
          border: 3px solid currentColor;
          cursor: pointer;
          margin-top: -1px;
        }
      `}</style>

      {/* Stage 0: Landing */}
      {stage === 0 && (
        <div className="min-h-screen flex items-center justify-center p-8 gradient-mesh">
          <div className="max-w-4xl w-full animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-8 bg-slate-900 border border-red-500/30 rounded-2xl animate-pulse-glow">
              <Zap className="w-10 h-10 text-red-500" strokeWidth={2.5} />
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black mb-2">
              Welcome to <span className="text-red-500">Pyrolysis</span>
            </h1>
            <h2 className="text-5xl md:text-6xl font-black mb-6 text-red-500">Simulator</h2>
            
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-12">
              Experience the future of waste-to-energy. Learn how Microwave-Assisted Pyrolysis transforms waste into valuable resources through a series of interactive challenges.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              {[
                { icon: Info, title: 'EDUCATIONAL', desc: 'Learn the science of thermal decomposition without oxygen.', color: 'text-red-500' },
                { icon: Zap, title: 'INNOVATIVE', desc: 'Discover why microwave technology is a game-changer for heating.', color: 'text-red-500' },
                { icon: Leaf, title: 'SUSTAINABLE', desc: 'See how circular waste recovery helps protect our planet.', color: 'text-red-500' }
              ].map((feature, idx) => (
                <div key={idx} className="card p-6 text-left animate-slide-in" style={{ animationDelay: `${idx * 0.15}s` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                    <span className={`text-sm font-bold title-font tracking-wider ${feature.color}`}>{feature.title}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setStage(1)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-12 rounded-xl text-lg title-font transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-red-500/30 inline-flex items-center gap-3"
            >
              <Play className="w-5 h-5" fill="white" />
              START MISSION
            </button>
          </div>
        </div>
      )}

      {/* Stage 1: Feedstock Input */}
      {stage === 1 && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-5xl w-full">
            <div className="card p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-7 h-7 text-red-500" />
                <h2 className="text-2xl md:text-3xl font-bold title-font">Level 1: Feedstock Input</h2>
              </div>
              <p className="text-slate-400 mb-8">Select your waste composition. Different inputs affect the final output yields.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Sliders */}
                <div className="space-y-8">
                  {/* Plastic Waste */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold text-blue-400">Plastic Waste</span>
                      </div>
                      <span className="text-2xl font-bold title-font">{plasticRatio}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={plasticRatio}
                      onChange={(e) => setPlasticRatio(parseInt(e.target.value))}
                      className="w-full"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${plasticRatio}%, #334155 ${plasticRatio}%, #334155 100%)`,
                        color: '#3b82f6'
                      }}
                    />
                  </div>
                  
                  {/* Biological Waste */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Leaf className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold text-emerald-400">Biological Waste</span>
                      </div>
                      <span className="text-2xl font-bold title-font">{biomassRatio}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={biomassRatio}
                      readOnly
                      className="w-full pointer-events-none"
                      style={{
                        background: `linear-gradient(to right, #34d399 0%, #34d399 ${biomassRatio}%, #334155 ${biomassRatio}%, #334155 100%)`,
                        color: '#34d399'
                      }}
                    />
                  </div>
                  
                  {/* Info box */}
                  <div className="card-inner p-5">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-300">
                        <p className="mb-1"><span className="text-blue-400 font-semibold">Plastic</span> results in higher liquid fuel recovery but less char.</p>
                        <p><span className="text-emerald-400 font-semibold">Biomass</span> produces more biochar and syngas, with lower liquid fuel.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right: Reactor */}
                <div className="relative">
                  <div className="card-inner h-80 overflow-hidden relative">
                    <FeedstockParticles />
                  </div>
                  {/* Funnel */}
                  <div className="flex justify-center mt-[-1px]">
                    <svg width="120" height="60" viewBox="0 0 120 60" className="text-slate-700">
                      <path d="M10,0 L110,0 L75,50 L45,50 Z" fill="currentColor" stroke="#475569" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setStage(2)}
              className="w-full mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 hover:scale-[1.02]"
            >
              START PROCESS
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Microwave Heating */}
      {stage === 2 && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-7 h-7 text-orange-400" />
                <h2 className="text-2xl md:text-3xl font-bold title-font">Level 2: Microwave Heating</h2>
              </div>
              <p className="text-slate-400 mb-8">Use the microwave beam to heat the reactor chamber evenly. Volumetric heating is the key to efficiency!</p>
              
              {/* Grid with label */}
              <div className="relative max-w-lg mx-auto mb-8">
                <div className="absolute -top-3 right-4 z-10 flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-full px-4 py-1.5">
                  <Thermometer className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-bold title-font tracking-wider">REACTOR CORE</span>
                </div>
                <div 
                  className="grid grid-cols-10 gap-0.5 p-3 card-inner select-none"
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {heatGrid.map((row, rowIdx) => (
                    row.map((cell, colIdx) => {
                      const heatLevel = cell;
                      const getColor = () => {
                        if (heatLevel === 0) return 'rgb(120, 100, 30)';
                        if (heatLevel < 30) return 'rgb(160, 110, 20)';
                        if (heatLevel < 60) return 'rgb(200, 80, 20)';
                        if (heatLevel < 90) return 'rgb(230, 50, 30)';
                        return 'rgb(255, 30, 50)';
                      };
                      return (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className="aspect-square rounded-sm cursor-pointer transition-colors duration-200 hover:brightness-125"
                          style={{ backgroundColor: getColor() }}
                          onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                          onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                        />
                      );
                    })
                  ))}
                </div>
              </div>
              
              {/* Progress bars */}
              <div className="max-w-lg mx-auto space-y-4">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-bold title-font tracking-wider text-slate-400">OVERALL HEAT</span>
                    <span className="text-sm font-bold title-font">{heatMetrics.completeness.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${heatMetrics.completeness}%`,
                        background: 'linear-gradient(to right, #f97316, #eab308)'
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-bold title-font tracking-wider text-slate-400">UNIFORMITY SCORE</span>
                    <span className="text-sm font-bold title-font">{heatMetrics.uniformity.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${heatMetrics.uniformity}%`,
                        background: 'linear-gradient(to right, #ef4444, #f43f5e)'
                      }}
                    />
                  </div>
                </div>
                
                <p className="text-center text-sm title-font tracking-wider text-slate-500 mt-4">
                  {heatMetrics.completeness === 0 
                    ? 'APPLY BEAM TO BEGIN HEATING...'
                    : heatMetrics.completeness < 70
                      ? `HEATING IN PROGRESS... ${heatMetrics.completeness.toFixed(0)}%`
                      : 'HEATING COMPLETE'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setStage(3)}
              disabled={heatMetrics.completeness < 70}
              className={`w-full mt-6 font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 ${
                heatMetrics.completeness >= 70
                  ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {heatMetrics.completeness >= 70 ? 'PROCEED TO SORTING' : `HEAT TO 70% TO PROCEED`}
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Product Sorting */}
      {stage === 3 && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-5xl w-full">
            <div className="card p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Package className="w-7 h-7 text-purple-400" />
                <h2 className="text-2xl md:text-3xl font-bold title-font">Level 3: Output Sorting</h2>
              </div>
              <p className="text-slate-400 mb-8">Drag the pyrolysis outputs into their correct containment bins. Efficiency depends on recovery accuracy.</p>
              
              {/* Top bins */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType');
                    if (productType === 'liquidFuel' && sortingProgress.liquidFuel < 10) {
                      setSortingProgress(prev => ({ ...prev, liquidFuel: prev.liquidFuel + 1 }));
                    }
                  }}
                  className="card-inner p-6 border-2 border-yellow-600/50 hover:border-yellow-500 transition-colors flex flex-col items-center justify-center min-h-[140px]"
                >
                  <Droplets className="w-10 h-10 text-yellow-500 mb-2" />
                  <span className="text-sm font-bold title-font tracking-wider text-yellow-500">LIQUID FUEL</span>
                  <span className="text-xs text-slate-500 mt-1">{sortingProgress.liquidFuel}/10</span>
                </div>
                
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType');
                    if (productType === 'syngas' && sortingProgress.syngas < 10) {
                      setSortingProgress(prev => ({ ...prev, syngas: prev.syngas + 1 }));
                    }
                  }}
                  className="card-inner p-6 border-2 border-purple-500/50 hover:border-purple-400 transition-colors flex flex-col items-center justify-center min-h-[140px]"
                >
                  <Wind className="w-10 h-10 text-purple-400 mb-2" />
                  <span className="text-sm font-bold title-font tracking-wider">SYNGAS</span>
                  <span className="text-xs text-slate-500 mt-1">{sortingProgress.syngas}/10</span>
                </div>
                
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType');
                    if (productType === 'biochar' && sortingProgress.biochar < 10) {
                      setSortingProgress(prev => ({ ...prev, biochar: prev.biochar + 1 }));
                    }
                  }}
                  className="card-inner p-6 border-2 border-slate-500/50 hover:border-slate-400 transition-colors flex flex-col items-center justify-center min-h-[140px]"
                >
                  <Package className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="text-sm font-bold title-font tracking-wider">BIOCHAR</span>
                  <span className="text-xs text-slate-500 mt-1">{sortingProgress.biochar}/10</span>
                </div>
              </div>
              
              {/* Separator */}
              <div className="h-px bg-slate-700 mb-6" />
              
              {/* Animated Reactor Output */}
              <div className="card-inner p-6 mb-6 min-h-[240px] relative overflow-hidden">
                {/* Reactor glow background */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-950/30 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-orange-900/20 to-transparent pointer-events-none">
                  {/* Smoke particles */}
                  {!sortingComplete && [...Array(5)].map((_, i) => (
                    <div
                      key={`smoke-${i}`}
                      className="absolute rounded-full bg-slate-500/20"
                      style={{
                        width: `${8 + Math.random() * 12}px`,
                        height: `${8 + Math.random() * 12}px`,
                        left: `${20 + Math.random() * 60}%`,
                        bottom: '0',
                        animation: `smokePuff ${2 + Math.random() * 2}s ease-out infinite`,
                        animationDelay: `${Math.random() * 3}s`
                      }}
                    />
                  ))}
                </div>
                
                {/* Spawned products */}
                <div className="flex gap-4 flex-wrap relative z-10 min-h-[180px] items-end">
                  {spawnedProducts.map((product) => {
                    const config = {
                      biochar: { icon: Package, color: 'slate', bgClass: 'bg-slate-800', borderClass: 'border-slate-500', label: 'CHAR' },
                      syngas: { icon: Wind, color: 'purple', bgClass: 'bg-purple-900/30', borderClass: 'border-purple-500', label: 'GAS' },
                      liquidFuel: { icon: Droplets, color: 'yellow', bgClass: 'bg-yellow-900/30', borderClass: 'border-yellow-500', label: 'OIL' }
                    }[product.type];
                    const IconComp = config.icon;
                    const colorMap = { slate: 'text-slate-400', purple: 'text-purple-400', yellow: 'text-yellow-500' };
                    
                    return (
                      <div
                        key={product.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('productType', product.type);
                          e.currentTarget.style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                          // Remove from spawned after successful drag
                          setSpawnedProducts(prev => prev.filter(p => p.id !== product.id));
                        }}
                        className={`spawn-product w-20 h-20 ${config.bgClass} border-2 ${config.borderClass} rounded-xl cursor-move hover:scale-110 transition-transform flex flex-col items-center justify-center shadow-lg`}
                        style={{ animationDelay: `${(product.id % 3) * 0.1}s` }}
                      >
                        <IconComp className={`w-7 h-7 ${colorMap[config.color]} mb-1`} />
                        <span className={`text-[10px] font-bold title-font ${colorMap[config.color]}`}>{config.label}</span>
                      </div>
                    );
                  })}
                  
                  {spawnedProducts.length === 0 && !sortingComplete && (
                    <div className="flex-1 flex items-center justify-center text-slate-600 title-font text-sm tracking-wider py-8">
                      PRODUCTS GENERATING...
                    </div>
                  )}
                </div>
                
                {/* Feedstock ratio indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-2 text-[10px] title-font tracking-wider text-slate-500">
                  <span className="text-blue-400">{plasticRatio}% PLASTIC</span>
                  <span>·</span>
                  <span className="text-emerald-400">{biomassRatio}% BIOMASS</span>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xs font-bold title-font tracking-wider text-slate-500 mb-1">RECOVERED</div>
                  <div className="text-2xl font-bold title-font text-red-400">{totalSorted}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold title-font tracking-wider text-slate-500 mb-1">REMAINING</div>
                  <div className="text-2xl font-bold title-font">{remaining}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold title-font tracking-wider text-slate-500 mb-1">LOSSES</div>
                  <div className="text-2xl font-bold title-font text-yellow-500">0</div>
                </div>
              </div>
              
              <p className="text-center text-sm title-font tracking-wider text-slate-500">
                {sortingComplete ? 'ALL ITEMS SORTED!' : 'DRAG ITEMS TO THE TOP BINS...'}
              </p>
            </div>
            
            <button
              onClick={() => setStage(4)}
              disabled={!sortingComplete}
              className={`w-full mt-6 font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 ${
                sortingComplete
                  ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {sortingComplete ? 'PROCEED TO COOLING' : `SORT ALL PRODUCTS (${totalSorted}/30)`}
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Syngas Cooling - Pre-start */}
      {stage === 4 && !coolingStarted && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Snowflake className="w-7 h-7 text-cyan-400" />
                <h2 className="text-2xl md:text-3xl font-bold title-font">Level 4: Syngas Cooling</h2>
              </div>
              <p className="text-slate-400 mb-8">Condense the hot syngas into liquid fuel by managing the cooling intensity. Balance is key to maximizing recovery.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Condenser visualization */}
                <div className="space-y-6">
                  <div className="card-inner p-6 flex items-center justify-center h-36">
                    <div className="flex gap-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-500/50" />
                      ))}
                    </div>
                  </div>
                  <div className="card-inner p-6 flex items-center justify-center h-40">
                    <span className="text-sm font-bold title-font tracking-wider text-slate-500">FUEL RECOVERY</span>
                  </div>
                </div>
                
                {/* Right: Controls */}
                <div className="space-y-6">
                  <div className="card-inner p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Snowflake className="w-5 h-5 text-cyan-400" />
                        <span className="font-semibold text-cyan-400">Cooling Power</span>
                      </div>
                      <span className="text-xl font-bold title-font">0%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={0}
                      readOnly
                      className="w-full pointer-events-none"
                      style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 0%, #334155 0%, #334155 100%)`, color: '#06b6d4' }}
                    />
                    
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="card-inner p-3">
                        <div className="text-xs font-bold title-font tracking-wider text-slate-500 mb-1">GAS TEMP</div>
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-4 h-4 text-red-400" />
                          <span className="font-bold title-font">100°</span>
                        </div>
                      </div>
                      <div className="card-inner p-3">
                        <div className="text-xs font-bold title-font tracking-wider text-slate-500 mb-1">EFFICIENCY</div>
                        <span className="font-bold title-font">0%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-inner p-5">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-300">
                        <p className="mb-1">Cooling too <span className="text-red-400 font-semibold">slowly</span> results in gas loss as it escapes the system.</p>
                        <p>Cooling too <span className="text-cyan-400 font-semibold">fast</span> can trap impurities or lead to inefficient condensation.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-sm title-font tracking-wider text-slate-500 mb-2">ADJUST COOLING TO TARGET THE CONDENSATION SWEET SPOT...</p>
                <p className={`text-lg font-bold title-font ${feedback.color}`}>{feedback.text}</p>
              </div>
            </div>
            
            <button
              onClick={() => setCoolingStarted(true)}
              className="w-full mt-6 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-3"
            >
              <Snowflake className="w-5 h-5" />
              START COOLING
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Cooling active */}
      {stage === 4 && coolingStarted && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Snowflake className="w-7 h-7 text-cyan-400" />
                <h2 className="text-2xl md:text-3xl font-bold title-font">Level 4: Syngas Cooling</h2>
              </div>
              <p className="text-slate-400 mb-8">Maintain optimal temperature at 400°C for maximum condensation</p>
              
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold">Gas Temperature</span>
                  <span className={`text-4xl font-bold title-font ${
                    Math.abs(gasTemp - 400) < 50 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {gasTemp.toFixed(0)}°C
                  </span>
                </div>
                
                <div className="relative h-10 bg-slate-900 rounded-xl overflow-hidden">
                  <div 
                    className="absolute h-full transition-all duration-300"
                    style={{ 
                      width: `${(gasTemp / 900) * 100}%`,
                      background: 'linear-gradient(to right, #06b6d4, #10b981, #f97316, #ef4444)'
                    }}
                  />
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white"
                    style={{ left: `${(400 / 900) * 100}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] title-font tracking-wider text-white whitespace-nowrap">
                      OPTIMAL
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`text-center py-3 rounded-xl font-bold title-font mb-6 ${
                Math.abs(gasTemp - 400) < 50 
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-900/30 text-red-400 border border-red-500/30'
              }`}>
                {feedback.text}
              </div>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Snowflake className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold text-cyan-400">Cooling Power</span>
                  </div>
                  <span className="text-2xl font-bold title-font text-cyan-400">{coolingPower}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={coolingPower}
                  onChange={(e) => setCoolingPower(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${coolingPower}%, #334155 ${coolingPower}%, #334155 100%)`,
                    color: '#06b6d4'
                  }}
                />
              </div>
              
              <p className="text-center text-sm text-slate-400">
                Time Elapsed: <span className="font-bold title-font">{coolingTime.toFixed(1)}s</span> / 15s
              </p>
            </div>
            
            <button
              onClick={() => setStage(5)}
              disabled={coolingTime < 15}
              className={`w-full mt-6 font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 ${
                coolingTime >= 15
                  ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {coolingTime >= 15 ? 'VIEW RESULTS' : `COOLING... (${Math.max(0, (15 - coolingTime)).toFixed(1)}s)`}
            </button>
          </div>
        </div>
      )}

      {/* Stage 5: Results */}
      {stage === 5 && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-5xl w-full animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold title-font mb-2">MISSION COMPLETE</h2>
              <p className="text-slate-400">
                FINAL EFFICIENCY RATING: <span className="text-red-400 font-bold title-font text-xl">{calculateYields().overallEfficiency}%</span>
              </p>
            </div>
            
            {(() => {
              const results = calculateYields();
              const processLoss = Math.max(0, 100 - parseFloat(results.liquidFuel) - parseFloat(results.syngas) - parseFloat(results.biochar));
              
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Input Composition */}
                    <div className="card p-8">
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-slate-400" />
                        <h4 className="text-sm font-bold title-font tracking-wider">INPUT COMPOSITION</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold title-font tracking-wider text-blue-400">PLASTIC</span>
                          </div>
                          <div className="text-3xl font-bold title-font">{plasticRatio}%</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Leaf className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold title-font tracking-wider text-emerald-400">BIOMASS</span>
                          </div>
                          <div className="text-3xl font-bold title-font">{biomassRatio}%</div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold title-font tracking-wider text-slate-500">HEATING EFFICIENCY</span>
                            <span className="text-xs font-bold">{calculateHeatMetrics().completeness.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${calculateHeatMetrics().completeness}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold title-font tracking-wider text-slate-500">SORTING RECOVERY</span>
                            <span className="text-xs font-bold">{results.sortingRecovery}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.sortingRecovery}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-bold title-font tracking-wider text-slate-500">CONDENSATION QUALITY</span>
                            <span className="text-xs font-bold">{results.condensationQuality}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.condensationQuality}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Resource Recovery */}
                    <div className="card p-8">
                      <div className="flex items-center gap-2 mb-6">
                        <Package className="w-5 h-5 text-slate-400" />
                        <h4 className="text-sm font-bold title-font tracking-wider">RESOURCE RECOVERY</h4>
                      </div>
                      
                      <div className="space-y-5">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-4 h-4 text-yellow-500" />
                              <span className="text-xs font-bold title-font tracking-wider">LIQUID FUEL</span>
                            </div>
                            <span className="text-sm font-bold">{results.liquidFuel}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${results.liquidFuel}%` }} />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Wind className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-bold title-font tracking-wider">SYNGAS</span>
                            </div>
                            <span className="text-sm font-bold">{results.syngas}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${results.syngas}%` }} />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-bold title-font tracking-wider">BIOCHAR</span>
                            </div>
                            <span className="text-sm font-bold">{results.biochar}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-500 rounded-full" style={{ width: `${results.biochar}%` }} />
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold title-font tracking-wider text-slate-500">PROCESS LOSSES</span>
                            <span className="text-sm font-bold text-red-400">{processLoss.toFixed(0)}%</span>
                          </div>
                          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${processLoss}%` }} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Environmental Impact */}
                      <div className="mt-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <Leaf className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-xs font-bold title-font tracking-wider text-emerald-400 mb-1">ENVIRONMENTAL IMPACT</h5>
                            <p className="text-sm text-slate-300">Significant carbon reduction through circular waste recovery.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={resetGame}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                      <RotateCcw className="w-5 h-5" />
                      TRY DIFFERENT INPUTS
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-xl text-lg title-font transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                      <BookOpen className="w-5 h-5" />
                      LEARN HOW THIS WORKS
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PyrolysisSimulator;
