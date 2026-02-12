import React, { useState, useEffect, useRef, useCallback, FC, MouseEvent, TouchEvent } from 'react';
import { Zap, Flame, Droplets, Wind, TrendingUp, Leaf, Award, ArrowRight, RotateCcw, Beaker, Thermometer, Snowflake, Info, Play, BookOpen, BarChart3, Package } from 'lucide-react';

interface SpawnedProduct {
  id: number;
  type: 'liquidFuel' | 'syngas' | 'biochar';
  x: number;
  spawnTime: number;
}

const PyrolysisSimulator: FC = () => {
  const [stage, setStage] = useState<number>(0);
  const [plasticRatio, setPlasticRatio] = useState<number>(50);
  const [heatGrid, setHeatGrid] = useState<number[][]>(Array(10).fill(null).map(() => Array(10).fill(0)));
  const [coolingPower, setCoolingPower] = useState<number>(50);
  const [gasTemp, setGasTemp] = useState<number>(600);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [coolingTime, setCoolingTime] = useState<number>(0);
  const [coolingStarted, setCoolingStarted] = useState<boolean>(false);
  const [condensedFuel, setCondensedFuel] = useState<number>(0);
  const [condensationParticles, setCondensationParticles] = useState<{id: number, x: number, speed: number}[]>([]);
  const [sortingProgress, setSortingProgress] = useState<{ biochar: number; syngas: number; liquidFuel: number; }>({ biochar: 0, syngas: 0, liquidFuel: 0 });
  const [sortingComplete, setSortingComplete] = useState<boolean>(false);
  const [spawnedProducts, setSpawnedProducts] = useState<SpawnedProduct[]>([]);
  const [losses, setLosses] = useState<number>(0);
  const [productQueue, setProductQueue] = useState<('liquidFuel' | 'syngas' | 'biochar')[]>([]);
  const [totalSpawned, setTotalSpawned] = useState<number>(0);
  const particleIdRef = useRef<number>(0);
  const spawnIdRef = useRef<number>(0);
  
  // Touch drag state
  const [touchDragType, setTouchDragType] = useState<'liquidFuel' | 'syngas' | 'biochar' | null>(null);
  const [touchDragId, setTouchDragId] = useState<number | null>(null);
  
  const biomassRatio = 100 - plasticRatio;
  
  const handlePlasticChange = (val: string | number) => {
    const clamped = Math.max(0, Math.min(100, parseInt(val.toString()) || 0));
    setPlasticRatio(clamped);
  };
  
  const getProductProbabilities = useCallback(() => {
    const pFrac = plasticRatio / 100;
    const bFrac = biomassRatio / 100;
    const oilProb = pFrac * 0.65 + bFrac * 0.25;
    const gasProb = pFrac * 0.25 + bFrac * 0.35;
    return { oilProb, gasProb };
  }, [plasticRatio, biomassRatio]);
  
  // Pre-generate 15 products when entering stage 3
  useEffect(() => {
    if (stage === 3 && productQueue.length === 0) {
      const { oilProb, gasProb } = getProductProbabilities();
      const queue: ('liquidFuel' | 'syngas' | 'biochar')[] = [];
      for (let i = 0; i < 15; i++) {
        const roll = Math.random();
        let type: 'liquidFuel' | 'syngas' | 'biochar';
        if (roll < oilProb) type = 'liquidFuel';
        else if (roll < oilProb + gasProb) type = 'syngas';
        else type = 'biochar';
        queue.push(type);
      }
      setProductQueue(queue);
    }
  }, [stage, productQueue.length, getProductProbabilities]);
  
  // Spawn products one every 1.5s, max 15
  useEffect(() => {
    if (stage !== 3 || sortingComplete || productQueue.length === 0) return;
    if (totalSpawned >= 15) return;
    
    const interval = setInterval(() => {
      setTotalSpawned(prev => {
        if (prev >= 15) return prev;
        const idx = prev;
        const type = productQueue[idx];
        const id = spawnIdRef.current++;
        const x = 10 + Math.random() * 75;
        setSpawnedProducts(p => [...p, { id, type, x, spawnTime: Date.now() }]);
        return prev + 1;
      });
    }, 1500);
    
    return () => clearInterval(interval);
  }, [stage, sortingComplete, productQueue, totalSpawned]);
  
  // Check sorting completion: all 15 accounted for (sorted + losses)
  useEffect(() => {
    const totalSorted = sortingProgress.biochar + sortingProgress.syngas + sortingProgress.liquidFuel;
    if (totalSorted + losses >= 15 && totalSpawned >= 15) {
      setSortingComplete(true);
    }
  }, [sortingProgress, losses, totalSpawned]);
  
  const handleDrop = (binType: 'liquidFuel' | 'syngas' | 'biochar', productType: 'liquidFuel' | 'syngas' | 'biochar', productId: number) => {
    if (productType === binType) {
      setSortingProgress(prev => ({ ...prev, [binType]: prev[binType] + 1 }));
    } else {
      setLosses(prev => prev + 1);
    }
    setSpawnedProducts(prev => prev.filter(p => p.id !== productId));
  };
  
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
  
  // Cooling: Interactive condensation system based on input ratios
  useEffect(() => {
    if (stage === 4 && coolingStarted && coolingTime < 15) {
      const interval = setInterval(() => {
        setCoolingTime(prev => {
          const next = prev + 0.1;
          if (next >= 15) return 15;
          return next;
        });
        setGasTemp(prev => {
          const heatLoss = coolingPower * 1.5;
          const naturalHeat = 2;
          const newTemp = prev - heatLoss + naturalHeat;
          return Math.max(100, Math.min(900, newTemp));
        });
        
        // Calculate condensation based on temperature (optimal at 300-400°C)
        const condensationRate = Math.max(0, 1 - Math.abs(gasTemp - 350) / 300);
        if (Math.random() < condensationRate * 0.3) {
          const newParticle = {
            id: particleIdRef.current++,
            x: 20 + Math.random() * 60,
            speed: 0.5 + Math.random() * 1
          };
          setCondensationParticles(prev => [...prev.slice(-20), newParticle]);
        }
        
        // Calculate condensed fuel based on input ratios and cooling efficiency
        const pFrac = plasticRatio / 100;
        const bFrac = biomassRatio / 100;
        const baseLiquid = pFrac * 0.65 + bFrac * 0.25; // Plastic produces more liquid
        const condensationEfficiency = Math.max(0, 1 - Math.abs(gasTemp - 350) / 400);
        const fuelIncrement = baseLiquid * condensationEfficiency * 0.8;
        setCondensedFuel(prev => Math.min(prev + fuelIncrement, baseLiquid * 100));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [stage, coolingPower, coolingStarted, coolingTime, plasticRatio, biomassRatio, gasTemp]);
  
  const calculateYields = () => {
    const metrics = calculateHeatMetrics();
    const pFrac = plasticRatio / 100;
    const bFrac = biomassRatio / 100;
    
    // Base yields that sum to 100%
    const baseLiquid = pFrac * 0.65 + bFrac * 0.25;
    const baseSyngas = pFrac * 0.25 + bFrac * 0.35;
    const baseBiochar = pFrac * 0.10 + bFrac * 0.40;
    
    const uniformityFactor = metrics.uniformity / 100;
    const heatingFactor = Math.min(1, metrics.completeness / 100);
    
    const optimalTemp = 400;
    const tempDiff = Math.abs(gasTemp - optimalTemp);
    const coolingEfficiency = Math.max(0.3, 1 - (tempDiff / 500));
    
    const totalSorted = sortingProgress.biochar + sortingProgress.syngas + sortingProgress.liquidFuel;
    const sortingAccuracy = totalSorted > 0 ? totalSorted / (totalSorted + losses) : 0;
    
    const processEfficiency = uniformityFactor * heatingFactor;
    
    const liquidFuel = baseLiquid * processEfficiency * coolingEfficiency * 100;
    const syngas = baseSyngas * processEfficiency * 100;
    const biochar = baseBiochar * processEfficiency * 100;
    
    const totalYield = liquidFuel + syngas + biochar;
    const processLoss = (losses / 15) * 100;
    const condensationQuality = coolingEfficiency * 100;
    const sortingRecovery = sortingAccuracy * 100;
    const overallEfficiency = (totalYield / 3 + sortingRecovery + condensationQuality) / 3;
    const carbonReduction = (plasticRatio * 0.8 + biomassRatio * 1.2) / 100;
    
    return {
      liquidFuel: liquidFuel.toFixed(1),
      syngas: syngas.toFixed(1),
      biochar: biochar.toFixed(1),
      sortingRecovery: sortingRecovery.toFixed(1),
      condensationQuality: condensationQuality.toFixed(1),
      overallEfficiency: overallEfficiency.toFixed(1),
      carbonReduction: carbonReduction.toFixed(2),
      processLoss: processLoss.toFixed(1)
    };
  };
  
  const handleCellInteraction = (row: number, col: number) => {
    if (stage !== 2) return;
    setHeatGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      newGrid[row][col] = Math.min(100, newGrid[row][col] + 50);
      return newGrid;
    });
  };
  
  const handleMouseDown = (row: number, col: number) => {
    setIsDragging(true);
    handleCellInteraction(row, col);
  };
  
  const handleMouseEnter = (row: number, col: number) => {
    if (isDragging || stage === 2) {
      handleCellInteraction(row, col);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Touch handlers for heat grid
  const handleTouchGrid = (e: TouchEvent<HTMLDivElement>) => {
    if (stage !== 2) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    if (el && el.dataset.row !== undefined) {
      handleCellInteraction(parseInt(el.dataset.row), parseInt(el.dataset.col!));
    }
  };
  
  // Touch handlers for product sorting
  const handleTouchStart = (type: 'liquidFuel' | 'syngas' | 'biochar', id: number) => {
    setTouchDragType(type);
    setTouchDragId(id);
  };
  
  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!touchDragType || touchDragId === null) return;
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    // Walk up to find bin
    let target = el as HTMLElement;
    while (target && !target.dataset.bin) {
      target = target.parentElement as HTMLElement;
    }
    if (target && target.dataset.bin) {
      handleDrop(target.dataset.bin as 'liquidFuel' | 'syngas' | 'biochar', touchDragType, touchDragId);
    }
    setTouchDragType(null);
    setTouchDragId(null);
  };
  
  const FeedstockParticles = () => {
    const particles: JSX.Element[] = [];
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const isPlastic = (i / particleCount) < (plasticRatio / 100);
      particles.push(
        <div
          key={i}
          className={`absolute w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isPlastic ? 'bg-blue-400' : 'bg-emerald-400'}`}
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
    if (diff < 80) return { text: 'OPTIMAL', color: 'text-emerald-400' };
    if (gasTemp > 500) return { text: 'TOO HOT', color: 'text-red-400' };
    if (gasTemp < 300) return { text: 'TOO COLD', color: 'text-cyan-400' };
    return { text: 'ADJUSTING...', color: 'text-yellow-400' };
  };
  
  const feedback = getCoolingFeedback();
  
  const resetGame = () => {
    setStage(0);
    setPlasticRatio(50);
    setHeatGrid(Array(10).fill(null).map(() => Array(10).fill(0)));
    setCoolingPower(50);
    setGasTemp(600);
    setCoolingTime(0);
    setCoolingStarted(false);
    setCondensedFuel(0);
    setCondensationParticles([]);
    setSortingProgress({ biochar: 0, syngas: 0, liquidFuel: 0 });
    setSortingComplete(false);
    setSpawnedProducts([]);
    setLosses(0);
    setProductQueue([]);
    setTotalSpawned(0);
    spawnIdRef.current = 0;
    particleIdRef.current = 0;
  };

  const totalSorted = sortingProgress.biochar + sortingProgress.syngas + sortingProgress.liquidFuel;
  const remaining = 15 - totalSorted - losses;

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
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #0f172a;
          border: 3px solid currentColor;
          cursor: pointer;
          margin-top: -1px;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      {/* Stage 0: Landing */}
      {stage === 0 && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 gradient-mesh">
          <div className="max-w-4xl w-full animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-6 sm:mb-8 bg-slate-900 border border-red-500/30 rounded-2xl animate-pulse-glow">
              <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" strokeWidth={2.5} />
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-2">
              Welcome to <span className="text-red-500">Pyrolysis</span>
            </h1>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-6 text-red-500">Simulator</h2>
            
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-8 sm:mb-12 px-2">
              Experience the future of waste-to-energy. Learn how Microwave-Assisted Pyrolysis transforms waste into valuable resources through a series of interactive challenges.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12">
              {[
                { icon: Info, title: 'EDUCATIONAL', desc: 'Learn the science of thermal decomposition without oxygen.', color: 'text-red-500' },
                { icon: Zap, title: 'INNOVATIVE', desc: 'Discover why microwave technology is a game-changer for heating.', color: 'text-red-500' },
                { icon: Leaf, title: 'SUSTAINABLE', desc: 'See how circular waste recovery helps protect our planet.', color: 'text-red-500' }
              ].map((feature, idx) => (
                <div key={idx} className="card p-4 sm:p-6 text-left animate-slide-in" style={{ animationDelay: `${idx * 0.15}s` }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <feature.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${feature.color}`} />
                    <span className={`text-xs sm:text-sm font-bold title-font tracking-wider ${feature.color}`}>{feature.title}</span>
                  </div>
                  <p className="text-slate-400 text-xs sm:text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setStage(1)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 sm:py-4 sm:px-12 rounded-xl text-base sm:text-lg title-font transition-all duration-300 hover:scale-105 shadow-2xl hover:shadow-red-500/30 inline-flex items-center gap-3"
            >
              <Play className="w-5 h-5" fill="white" />
              START MISSION
            </button>
          </div>
        </div>
      )}

      {/* Stage 1: Feedstock Input */}
      {stage === 1 && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-5xl w-full">
            <div className="card p-4 sm:p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold title-font">Level 1: Feedstock Input</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Select your waste composition. Different inputs affect the final output yields.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Left: Sliders */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Plastic Waste */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" />
                        <span className="font-semibold text-blue-400 text-sm sm:text-base">Plastic Waste</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={plasticRatio}
                          onChange={(e) => handlePlasticChange(e.target.value)}
                          className="w-16 text-right text-lg sm:text-2xl font-bold title-font bg-transparent border-b border-blue-400/50 focus:border-blue-400 outline-none text-white"
                        />
                        <span className="text-lg sm:text-2xl font-bold title-font">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={plasticRatio}
                      onChange={(e) => handlePlasticChange(e.target.value)}
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
                        <span className="font-semibold text-emerald-400 text-sm sm:text-base">Biological Waste</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={biomassRatio}
                          onChange={(e) => handlePlasticChange(100 - (parseInt(e.target.value) || 0))}
                          className="w-16 text-right text-lg sm:text-2xl font-bold title-font bg-transparent border-b border-emerald-400/50 focus:border-emerald-400 outline-none text-white"
                        />
                        <span className="text-lg sm:text-2xl font-bold title-font">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={biomassRatio}
                      onChange={(e) => handlePlasticChange(100 - parseInt(e.target.value))}
                      className="w-full"
                      style={{
                        background: `linear-gradient(to right, #34d399 0%, #34d399 ${biomassRatio}%, #334155 ${biomassRatio}%, #334155 100%)`,
                        color: '#34d399'
                      }}
                    />
                  </div>
                  
                  {/* Info box */}
                  <div className="card-inner p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs sm:text-sm text-slate-300">
                        <p className="mb-1"><span className="text-blue-400 font-semibold">Plastic</span> results in higher liquid fuel recovery but less char.</p>
                        <p><span className="text-emerald-400 font-semibold">Biomass</span> produces more biochar and syngas, with lower liquid fuel.</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right: Reactor */}
                <div className="relative">
                  <div className="card-inner h-60 sm:h-80 overflow-hidden relative">
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
              className="w-full mt-4 sm:mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-3 sm:py-4 px-8 rounded-xl text-base sm:text-lg title-font transition-all duration-300 hover:scale-[1.02]"
            >
              START PROCESS
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Microwave Heating */}
      {stage === 2 && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-4 sm:p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold title-font">Level 2: Microwave Heating</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Tap or drag across the reactor to heat it evenly. Volumetric heating is the key!</p>
              
              {/* Grid */}
              <div className="relative max-w-lg mx-auto mb-6 sm:mb-8">
                <div className="absolute -top-3 right-4 z-10 flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-full px-3 sm:px-4 py-1 sm:py-1.5">
                  <Thermometer className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
                  <span className="text-[10px] sm:text-sm font-bold title-font tracking-wider">REACTOR CORE</span>
                </div>
                <div 
                  className="grid grid-cols-10 gap-0.5 p-2 sm:p-3 card-inner select-none touch-none"
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchMove={handleTouchGrid}
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
                          data-row={rowIdx}
                          data-col={colIdx}
                          className="aspect-square rounded-sm cursor-pointer transition-colors duration-200 hover:brightness-125"
                          style={{ backgroundColor: getColor() }}
                          onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                          onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                          onTouchStart={() => handleCellInteraction(rowIdx, colIdx)}
                        />
                      );
                    })
                  ))}
                </div>
              </div>
              
              {/* Progress bars */}
              <div className="max-w-lg mx-auto space-y-3 sm:space-y-4">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-bold title-font tracking-wider text-slate-400">OVERALL HEAT</span>
                    <span className="text-xs sm:text-sm font-bold title-font">{heatMetrics.completeness.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-slate-800 rounded-full overflow-hidden">
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
                    <span className="text-xs sm:text-sm font-bold title-font tracking-wider text-slate-400">UNIFORMITY SCORE</span>
                    <span className="text-xs sm:text-sm font-bold title-font">{heatMetrics.uniformity.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${heatMetrics.uniformity}%`,
                        background: 'linear-gradient(to right, #ef4444, #f43f5e)'
                      }}
                    />
                  </div>
                </div>
                
                <p className="text-center text-xs sm:text-sm title-font tracking-wider text-slate-500 mt-4">
                  {heatMetrics.completeness === 0 
                    ? 'TAP OR DRAG TO BEGIN HEATING...'
                    : heatMetrics.completeness < 70
                      ? `HEATING IN PROGRESS... ${heatMetrics.completeness.toFixed(0)}%`
                      : 'HEATING COMPLETE'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setStage(3)}
              disabled={heatMetrics.completeness < 70}
              className={`w-full mt-4 sm:mt-6 font-bold py-3 sm:py-4 px-8 rounded-xl text-base sm:text-lg title-font transition-all duration-300 ${
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
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-5xl w-full">
            <div className="card p-4 sm:p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold title-font">Level 3: Output Sorting</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Drag the pyrolysis outputs into their correct bins. Wrong bins count as losses!</p>
              
              {/* Top bins */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <div
                  data-bin="liquidFuel"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType') as 'liquidFuel' | 'syngas' | 'biochar';
                    const productId = parseInt(e.dataTransfer.getData('productId'));
                    handleDrop('liquidFuel', productType, productId);
                  }}
                  className="card-inner p-3 sm:p-6 border-2 border-yellow-600/50 hover:border-yellow-500 transition-colors flex flex-col items-center justify-center min-h-[100px] sm:min-h-[140px]"
                >
                  <Droplets className="w-7 h-7 sm:w-10 sm:h-10 text-yellow-500 mb-1 sm:mb-2" />
                  <span className="text-[10px] sm:text-sm font-bold title-font tracking-wider text-yellow-500">LIQUID FUEL</span>
                  <span className="text-[10px] sm:text-xs text-slate-500 mt-1">{sortingProgress.liquidFuel}</span>
                </div>
                
                <div
                  data-bin="syngas"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType') as 'liquidFuel' | 'syngas' | 'biochar';
                    const productId = parseInt(e.dataTransfer.getData('productId'));
                    handleDrop('syngas', productType, productId);
                  }}
                  className="card-inner p-3 sm:p-6 border-2 border-purple-500/50 hover:border-purple-400 transition-colors flex flex-col items-center justify-center min-h-[100px] sm:min-h-[140px]"
                >
                  <Wind className="w-7 h-7 sm:w-10 sm:h-10 text-purple-400 mb-1 sm:mb-2" />
                  <span className="text-[10px] sm:text-sm font-bold title-font tracking-wider">SYNGAS</span>
                  <span className="text-[10px] sm:text-xs text-slate-500 mt-1">{sortingProgress.syngas}</span>
                </div>
                
                <div
                  data-bin="biochar"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const productType = e.dataTransfer.getData('productType') as 'liquidFuel' | 'syngas' | 'biochar';
                    const productId = parseInt(e.dataTransfer.getData('productId'));
                    handleDrop('biochar', productType, productId);
                  }}
                  className="card-inner p-3 sm:p-6 border-2 border-slate-500/50 hover:border-slate-400 transition-colors flex flex-col items-center justify-center min-h-[100px] sm:min-h-[140px]"
                >
                  <Package className="w-7 h-7 sm:w-10 sm:h-10 text-slate-400 mb-1 sm:mb-2" />
                  <span className="text-[10px] sm:text-sm font-bold title-font tracking-wider">BIOCHAR</span>
                  <span className="text-[10px] sm:text-xs text-slate-500 mt-1">{sortingProgress.biochar}</span>
                </div>
              </div>
              
              {/* Separator */}
              <div className="h-px bg-slate-700 mb-4 sm:mb-6" />
              
              {/* Animated Reactor Output */}
              <div className="card-inner p-4 sm:p-6 mb-4 sm:mb-6 min-h-[180px] sm:min-h-[240px] relative overflow-hidden">
                {/* Reactor glow background */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-950/30 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-orange-900/20 to-transparent pointer-events-none">
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
                <div className="flex gap-2 sm:gap-4 flex-wrap relative z-10 min-h-[140px] sm:min-h-[180px] items-end">
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
                          e.dataTransfer.setData('productId', product.id.toString());
                          e.currentTarget.style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        onTouchStart={() => handleTouchStart(product.type, product.id)}
                        onTouchEnd={handleTouchEnd}
                        className={`spawn-product w-14 h-14 sm:w-20 sm:h-20 ${config.bgClass} border-2 ${config.borderClass} rounded-xl cursor-move hover:scale-110 transition-transform flex flex-col items-center justify-center shadow-lg touch-none`}
                        style={{ animationDelay: `${(product.id % 3) * 0.1}s` }}
                      >
                        <IconComp className={`w-5 h-5 sm:w-7 sm:h-7 ${colorMap[config.color]} mb-0.5 sm:mb-1`} />
                        <span className={`text-[8px] sm:text-[10px] font-bold title-font ${colorMap[config.color]}`}>{config.label}</span>
                      </div>
                    );
                  })}
                  
                  {spawnedProducts.length === 0 && !sortingComplete && (
                    <div className="flex-1 flex items-center justify-center text-slate-600 title-font text-xs sm:text-sm tracking-wider py-8">
                      PRODUCTS GENERATING...
                    </div>
                  )}
                </div>
                
                {/* Feedstock ratio indicator */}
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex items-center gap-1 sm:gap-2 text-[8px] sm:text-[10px] title-font tracking-wider text-slate-500">
                  <span className="text-blue-400">{plasticRatio}% PLASTIC</span>
                  <span>·</span>
                  <span className="text-emerald-400">{biomassRatio}% BIOMASS</span>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                <div className="text-center">
                  <div className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-1">SORTED</div>
                  <div className="text-xl sm:text-2xl font-bold title-font text-red-400">{totalSorted}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-1">REMAINING</div>
                  <div className="text-xl sm:text-2xl font-bold title-font">{Math.max(0, remaining)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-1">LOSSES</div>
                  <div className="text-xl sm:text-2xl font-bold title-font text-yellow-500">{losses}</div>
                </div>
              </div>
              
              <p className="text-center text-xs sm:text-sm title-font tracking-wider text-slate-500">
                {sortingComplete ? 'ALL ITEMS SORTED!' : `SPAWNED ${totalSpawned}/15 — DRAG ITEMS TO BINS...`}
              </p>
            </div>
            
            <button
              onClick={() => setStage(4)}
              disabled={!sortingComplete}
              className={`w-full mt-4 sm:mt-6 font-bold py-3 sm:py-4 px-8 rounded-xl text-base sm:text-lg title-font transition-all duration-300 ${
                sortingComplete
                  ? 'bg-red-500 hover:bg-red-600 text-white hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              {sortingComplete ? 'PROCEED TO COOLING' : `SORT ALL PRODUCTS (${totalSorted + losses}/15)`}
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Syngas Cooling - Pre-start */}
      {stage === 4 && !coolingStarted && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-4 sm:p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Snowflake className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 animate-pulse" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold title-font">Level 4: Syngas Cooling</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Condense the hot syngas into liquid fuel by managing the cooling intensity.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Left: Cooling Chamber Visualization */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Cooling Chamber */}
                  <div className="card-inner p-4 sm:p-6 relative overflow-hidden">
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500">COOLING CHAMBER</span>
                      <Thermometer className="w-4 h-4 text-red-400" />
                    </div>
                    
                    {/* Chamber container */}
                    <div className="mt-6 relative h-32 sm:h-40 bg-slate-900/80 rounded-xl border border-slate-600/50 overflow-hidden">
                      {/* Hot gas inlet pipe (left) */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-12 bg-gradient-to-r from-red-900/60 to-red-700/40 border-r border-red-500/30 rounded-r-lg" />
                      
                      {/* Chamber interior */}
                      <div className="absolute left-8 right-8 top-2 bottom-2 bg-gradient-to-br from-slate-800/60 to-slate-900/80 rounded-lg border border-slate-600/30">
                        {/* Cooling coils */}
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute left-2 right-2 h-1.5 bg-cyan-500/20 rounded-full"
                            style={{ top: `${25 + i * 20}%` }}
                          />
                        ))}
                        
                        {/* Syngas particles animation */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {[...Array(8)].map((_, i) => (
                            <div
                              key={i}
                              className="absolute w-2 h-2 rounded-full bg-purple-500/60 animate-ping"
                              style={{
                                left: `${15 + Math.random() * 70}%`,
                                top: `${20 + Math.random() * 60}%`,
                                animationDelay: `${i * 0.2}s`,
                                animationDuration: '1.5s'
                              }}
                            />
                          ))}
                        </div>
                        
                        {/* Flow indicator */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-12 bg-gradient-to-l from-cyan-900/40 to-cyan-700/20 border-l border-cyan-500/30 rounded-l-lg flex items-center justify-center">
                          <div className="w-2 h-2 bg-cyan-400/50 rounded-full animate-pulse" />
                        </div>
                      </div>
                      
                      {/* Chamber glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none" />
                    </div>
                    
                    {/* Temperature scale */}
                    <div className="mt-3 flex items-center justify-between text-[9px] sm:text-[10px] title-font tracking-wider text-slate-500">
                      <span>600°C</span>
                      <span className="text-cyan-400 font-bold">TARGET 400°C</span>
                      <span>100°C</span>
                    </div>
                  </div>
                  
                  {/* Fuel Recovery Display */}
                  <div className="card-inner p-4 sm:p-6 flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-2">ESTIMATED FUEL RECOVERY</span>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl sm:text-3xl font-bold title-font text-yellow-500">0</span>
                      <span className="text-sm sm:text-base font-bold title-font text-yellow-500/70 mb-1">L</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                </div>
                
                {/* Right: Controls */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Cooling Power Slider */}
                  <div className="card-inner p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Snowflake className="w-5 h-5 text-cyan-400" />
                        <span className="font-semibold text-cyan-400 text-sm sm:text-base">Cooling Power</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold title-font text-cyan-400">{coolingPower}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={coolingPower}
                      onChange={(e) => setCoolingPower(parseInt(e.target.value))}
                      className="w-full cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${coolingPower}%, #334155 ${coolingPower}%, #334155 100%)`,
                        color: '#06b6d4'
                      }}
                    />
                    
                    {/* Power indicator dots */}
                    <div className="flex justify-between mt-3">
                      {[0, 25, 50, 75, 100].map((level) => (
                        <div
                          key={level}
                          className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                            coolingPower >= level ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <div className="card-inner p-3 bg-slate-900/50">
                        <div className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-1">GAS TEMP</div>
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="w-4 h-4 text-red-400" />
                          <span className="font-bold title-font text-base sm:text-lg">600°<span className="text-xs text-slate-500">C</span></span>
                        </div>
                      </div>
                      <div className="card-inner p-3 bg-slate-900/50">
                        <div className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500 mb-1">EFFICIENCY</div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                          </div>
                          <span className="font-bold title-font text-base sm:text-lg">0%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info Cards */}
                  <div className="card-inner p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs sm:text-sm text-slate-300 space-y-2">
                        <p className="flex items-center gap-2">
                          <span className="text-red-400 font-semibold">Too slow</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-slate-400">gas loss</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-cyan-400 font-semibold">Too fast</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-slate-400">trapped impurities</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tips */}
                  <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-cyan-400">!</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold title-font tracking-wider text-cyan-400">PRO TIP</span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400">
                      Maintain <span className="text-white font-semibold">400°C</span> for optimal condensation efficiency
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Status Bar */}
              <div className="mt-6 p-3 sm:p-4 bg-slate-900/60 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-xs sm:text-sm title-font tracking-wider text-slate-400">READY TO START</span>
                  </div>
                  <span className="text-xs sm:text-sm text-slate-500">Duration: 15 seconds</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setCoolingStarted(true)}
              className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold py-4 sm:py-5 px-8 rounded-xl text-base sm:text-lg title-font transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/30 flex items-center justify-center gap-3 animate-pulse-glow"
            >
              <Snowflake className="w-5 h-5" />
              START COOLING
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Cooling active */}
      {stage === 4 && coolingStarted && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-4xl w-full">
            <div className="card p-4 sm:p-8 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Snowflake className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold title-font">Level 4: Syngas Cooling</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base mb-6 sm:mb-8">Maintain optimal temperature at 400°C for maximum condensation</p>
              
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base sm:text-lg font-semibold">Gas Temperature</span>
                  <span className={`text-3xl sm:text-4xl font-bold title-font ${
                    Math.abs(gasTemp - 400) < 80 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {gasTemp.toFixed(0)}°C
                  </span>
                </div>
                
                <div className="relative h-8 sm:h-10 bg-slate-900 rounded-xl overflow-hidden">
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
                    <div className="absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] title-font tracking-wider text-white whitespace-nowrap">
                      OPTIMAL
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`text-center py-2 sm:py-3 rounded-xl font-bold title-font text-sm sm:text-base mb-4 sm:mb-6 ${
                Math.abs(gasTemp - 400) < 80 
                  ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-900/30 text-red-400 border border-red-500/30'
              }`}>
                {coolingTime >= 15 ? 'COOLING COMPLETE' : feedback.text}
              </div>
              
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Snowflake className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold text-cyan-400 text-sm sm:text-base">Cooling Power</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold title-font text-cyan-400">{coolingPower}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={coolingPower}
                  onChange={(e) => setCoolingPower(parseInt(e.target.value))}
                  disabled={coolingTime >= 15}
                  className="w-full"
                  style={{
                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${coolingPower}%, #334155 ${coolingPower}%, #334155 100%)`,
                    color: '#06b6d4'
                  }}
                />
              </div>
              
              <p className="text-center text-xs sm:text-sm text-slate-400">
                Time: <span className="font-bold title-font">{coolingTime.toFixed(1)}s</span> / 15s
                {coolingTime >= 15 && <span className="text-emerald-400 ml-2">— DONE</span>}
              </p>
            </div>
            
            <button
              onClick={() => setStage(5)}
              disabled={coolingTime < 15}
              className={`w-full mt-4 sm:mt-6 font-bold py-3 sm:py-4 px-8 rounded-xl text-base sm:text-lg title-font transition-all duration-300 ${
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
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-5xl w-full animate-fade-in">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold title-font mb-2">MISSION COMPLETE</h2>
              <p className="text-slate-400 text-sm sm:text-base">
                FINAL EFFICIENCY RATING: <span className="text-red-400 font-bold title-font text-lg sm:text-xl">{calculateYields().overallEfficiency}%</span>
              </p>
            </div>
            
            {(() => {
              const results = calculateYields();
              
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    {/* Input Composition */}
                    <div className="card p-4 sm:p-8">
                      <div className="flex items-center gap-2 mb-4 sm:mb-6">
                        <BarChart3 className="w-5 h-5 text-slate-400" />
                        <h4 className="text-xs sm:text-sm font-bold title-font tracking-wider">INPUT COMPOSITION</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 sm:mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="w-4 h-4 text-blue-400" />
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-blue-400">PLASTIC</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold title-font">{plasticRatio}%</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Leaf className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-emerald-400">BIOMASS</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold title-font">{biomassRatio}%</div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500">HEATING EFFICIENCY</span>
                            <span className="text-[10px] sm:text-xs font-bold">{calculateHeatMetrics().completeness.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${calculateHeatMetrics().completeness}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500">SORTING ACCURACY</span>
                            <span className="text-[10px] sm:text-xs font-bold">{results.sortingRecovery}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.sortingRecovery}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500">CONDENSATION QUALITY</span>
                            <span className="text-[10px] sm:text-xs font-bold">{results.condensationQuality}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.condensationQuality}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Resource Recovery */}
                    <div className="card p-4 sm:p-8">
                      <div className="flex items-center gap-2 mb-4 sm:mb-6">
                        <Package className="w-5 h-5 text-slate-400" />
                        <h4 className="text-xs sm:text-sm font-bold title-font tracking-wider">RESOURCE RECOVERY</h4>
                      </div>
                      
                      <div className="space-y-4 sm:space-y-5">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-4 h-4 text-yellow-500" />
                              <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider">LIQUID FUEL</span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold">{results.liquidFuel}%</span>
                          </div>
                          <div className="h-2 sm:h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${results.liquidFuel}%` }} />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Wind className="w-4 h-4 text-purple-400" />
                              <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider">SYNGAS</span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold">{results.syngas}%</span>
                          </div>
                          <div className="h-2 sm:h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${results.syngas}%` }} />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider">BIOCHAR</span>
                            </div>
                            <span className="text-xs sm:text-sm font-bold">{results.biochar}%</span>
                          </div>
                          <div className="h-2 sm:h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-500 rounded-full" style={{ width: `${results.biochar}%` }} />
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-slate-500">SORTING LOSSES</span>
                            <span className="text-xs sm:text-sm font-bold text-red-400">{results.processLoss}%</span>
                          </div>
                          <div className="h-2 sm:h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${results.processLoss}%` }} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Environmental Impact */}
                      <div className="mt-4 sm:mt-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-[10px] sm:text-xs font-bold title-font tracking-wider text-emerald-400 mb-1">ENVIRONMENTAL IMPACT</h5>
                            <p className="text-xs sm:text-sm text-slate-300">Significant carbon reduction through circular waste recovery.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <button
                      onClick={resetGame}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl text-sm sm:text-lg title-font transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 sm:gap-3"
                    >
                      <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                      TRY DIFFERENT INPUTS
                    </button>
                    <button
                      onClick={() => window.open('https://thermowave-dynamics.github.io/technology.html', '_blank')}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl text-sm sm:text-lg title-font transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 sm:gap-3 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
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
