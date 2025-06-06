import { useState, useEffect, useRef } from 'react';
import { HiVolumeUp, HiVolumeOff } from 'react-icons/hi';

const GRID_SIZE = 8;
const COLORS = ['bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500'];
const GAME_TIME = 60; // 60 seconds
const TARGET_SCORE = 1000;

interface Tile {
  color: string;
  isRemoving: boolean;
  isNew: boolean;
  isSpecial: boolean;
  specialType?: 'row' | 'column' | 'color';
}

export default function Home() {
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [selectedTiles, setSelectedTiles] = useState<[number, number][]>([]);
  const [score, setScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showSpecialEffect, setShowSpecialEffect] = useState(false);
  const [specialEffectType, setSpecialEffectType] = useState<string>('');
  const [level, setLevel] = useState(1);
  const [muted, setMuted] = useState(false);

  const matchSound = useRef<HTMLAudioElement | null>(null);
  const comboSound = useRef<HTMLAudioElement | null>(null);
  const popSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    matchSound.current = new Audio('/sounds/match.mp3');
    comboSound.current = new Audio('/sounds/combo.mp3');
    popSound.current = new Audio('/sounds/pop.mp3');
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      const newGrid = Array(GRID_SIZE).fill(null).map(() =>
        Array(GRID_SIZE).fill(null).map(() => ({
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          isRemoving: false,
          isNew: false,
          isSpecial: false
        }))
      );
      setGrid(newGrid);
      setScore(0);
      setCombo(0);
      setTimeLeft(GAME_TIME);
      setSelectedTiles([]);
    }
  }, [gameState, level]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  // 게임 오버 시 즉시 처리: 타일 애니메이션 등과 무관하게 바로 메시지 표시
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'playing') {
      setGameState('lost');
    }
  }, [timeLeft, gameState]);

  useEffect(() => {
    if (score >= TARGET_SCORE) {
      setTimeout(() => {
        setLevel(l => l + 1);
        setGameState('playing');
      }, 1000);
    }
  }, [score]);

  const playSound = (soundPath: string, repeat = 1) => {
    if (muted) return;
    for (let i = 0; i < repeat; i++) {
      setTimeout(() => {
        const audio = new Audio(soundPath);
        audio.play().catch(() => {});
      }, i * 120);
    }
  };

  const processManualMatch = async (tiles: [number, number][]) => {
    setIsProcessing(true);
    const [[r1, c1], [r2, c2], [r3, c3]] = tiles;
    // Remove the selected tiles
    const newGrid = grid.map(row => row.map(tile => ({ ...tile })));
    newGrid[r1][c1].isRemoving = true;
    newGrid[r2][c2].isRemoving = true;
    newGrid[r3][c3].isRemoving = true;
    setGrid(newGrid);
    playSound('/sounds/pop.mp3', 3); // '뿅뿅뿅' 효과음
    await new Promise(resolve => setTimeout(resolve, 300));
    // True gravity: for each column, let all tiles above fall down to fill empty spaces
    const columns = [c1, c2, c3];
    for (const col of columns) {
      let pointer = GRID_SIZE - 1;
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (!newGrid[row][col].isRemoving) {
          if (pointer !== row) {
            newGrid[pointer][col] = { ...newGrid[row][col], isNew: false };
          }
          pointer--;
        }
      }
      // Fill the rest with new tiles
      while (pointer >= 0) {
        newGrid[pointer][col] = {
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          isRemoving: false,
          isNew: true,
          isSpecial: false
        };
        pointer--;
      }
    }
    setGrid(newGrid);
    await new Promise(resolve => setTimeout(resolve, 300));
    setGrid(newGrid.map(row => row.map(tile => ({ ...tile, isNew: false }))));
    setScore(prev => prev + 30); // 10점씩 3개
    setCombo(0);
    setIsProcessing(false);
  };

  const handleTileClick = async (row: number, col: number) => {
    if (isProcessing || gameState !== 'playing') return;
    // 이미 선택된 타일이면 선택 해제(토글)
    if (selectedTiles.some(([r, c]) => r === row && c === col)) {
      setSelectedTiles(selectedTiles.filter(([r, c]) => !(r === row && c === col)));
      return;
    }
    const newSelected = [...selectedTiles, [row, col]];
    setSelectedTiles(newSelected);
    if (newSelected.length === 3) {
      const [a, b, c] = newSelected;
      const colorA = grid[a[0]][a[1]].color;
      const colorB = grid[b[0]][b[1]].color;
      const colorC = grid[c[0]][c[1]].color;
      if (colorA === colorB && colorB === colorC) {
        await processManualMatch(newSelected);
      }
      setTimeout(() => setSelectedTiles([]), 100); // 선택 초기화
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto relative">
        {/* Sound toggle button */}
        <button
          onClick={() => setMuted(m => !m)}
          className="absolute top-2 right-2 z-10 p-2 bg-white rounded-full shadow hover:bg-gray-200 transition-colors border border-gray-300"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <span role="img" aria-label="muted">🔇</span>
          ) : (
            <span role="img" aria-label="sound">🔊</span>
          )}
        </button>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-green-700 mb-2">LEVEL {level}</h2>
            <h1 className="text-3xl font-bold text-gray-800">Match-3 Game</h1>
            <div className="flex justify-center items-center gap-4">
              <p className="text-xl text-gray-600">Score: {score}/{TARGET_SCORE}</p>
              <div className="relative">
                <p className="text-xl text-purple-600">Combo: {combo}x</p>
                {showCombo && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 animate-bounce text-2xl font-bold text-purple-600">
                    {combo}x COMBO!
                  </div>
                )}
              </div>
              <p className="text-xl text-red-600">Time: {timeLeft}s</p>
            </div>
            {showSpecialEffect && (
              <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-yellow-400 animate-pulse">
                {specialEffectType.toUpperCase()} CLEAR!
              </div>
            )}
            {gameState !== 'playing' && (
              <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
                <div className={`text-6xl font-extrabold mb-4 ${gameState === 'won' ? 'text-green-500' : 'text-red-500'} drop-shadow-lg`} style={gameState === 'lost' ? {textShadow:'-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 2px 2px 8px #fff, 0 0 8px #f00'} : {}}>
                  {gameState === 'won' ? 'You Win!' : "Time's Up!"}
                </div>
                <div className="text-3xl font-bold text-black bg-white bg-opacity-80 px-6 py-2 rounded shadow-lg">
                  Final Score: {score}
                </div>
              </div>
            )}
            <button
              onClick={() => { setLevel(1); setGameState('playing'); }}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {gameState === 'playing' ? 'Restart Game' : 'New Game'}
            </button>
          </div>
          <div className={`grid grid-cols-8 gap-1 bg-white p-4 rounded-lg shadow-lg transition-all duration-500 ${gameState !== 'playing' ? 'filter blur-sm brightness-75' : ''}`}>
            {grid.map((row, rowIndex) =>
              row.map((tile, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`w-12 h-12 ${tile.color} rounded-lg cursor-pointer transition-all duration-300
                    ${selectedTiles.some(([r, c]) => r === rowIndex && c === colIndex) ? 'ring-4 ring-blue-500' : ''}
                    ${isProcessing ? 'pointer-events-none' : ''}
                    ${tile.isRemoving ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
                    ${tile.isNew ? 'animate-bounce' : ''}
                    ${tile.isSpecial ? 'ring-2 ring-yellow-400 animate-pulse' : ''}`}
                  onClick={() => handleTileClick(rowIndex, colIndex)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 