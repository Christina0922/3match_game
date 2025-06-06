import { useState, useEffect, useRef } from 'react';
import { HiVolumeUp, HiVolumeOff } from 'react-icons/hi';

const COLORS = ['bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500'];
const GAME_TIME = 60; // 60 seconds
const BASE_SCORE = 500; // 레벨 1의 목표 점수
const SCORE_INCREMENT = 100; // 레벨당 증가 점수
const MAX_LEVEL = 100; // 최대 레벨

// 레벨별 그리드 크기 계산 함수
const getGridSize = (level: number) => {
  if (level <= 10) return 8;
  if (level <= 20) return 9;
  if (level <= 30) return 10;
  if (level <= 40) return 11;
  if (level <= 50) return 12;
  if (level <= 60) return 13;
  if (level <= 70) return 14;
  if (level <= 80) return 15;
  if (level <= 90) return 16;
  return 17;
};

// 레벨별 타일 크기 계산 함수
const getTileSize = (level: number) => {
  const gridSize = getGridSize(level);
  // 기본 컨테이너 크기 (예: 400px)
  const containerSize = 400;
  // 그리드 크기에 따라 타일 크기 계산
  const tileSize = Math.floor(containerSize / gridSize);
  return tileSize;
};

// 레벨별 목표 점수 계산 함수
const getTargetScore = (level: number) => {
  return BASE_SCORE + (level - 1) * SCORE_INCREMENT;
};

// Web Audio API를 사용하여 소리 생성 함수
const createPopSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // 소리 설정 - 더 부드럽고 낮은 음으로 조정
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 음 (더 낮은 음)
  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime); // 볼륨 낮춤 (0.3 → 0.15)

  // 소리 시작
  oscillator.start();
  
  // 소리 감소 - 더 천천히 감소하도록 조정
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // 0.1 → 0.3
  
  // 소리 종료
  oscillator.stop(audioContext.currentTime + 0.3); // 0.1 → 0.3
};

interface Tile {
  color: string;
  isRemoving: boolean;
  isNew: boolean;
  isSpecial: boolean;
  specialType?: 'row' | 'column' | 'color';
}

type TilePosition = [number, number];

export default function Home() {
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [selectedTiles, setSelectedTiles] = useState<TilePosition[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'gameOver' | 'completed'>('playing');
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTouchTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [clearedLevel, setClearedLevel] = useState<number|null>(null);

  // 그리드 초기화 함수
  const initializeGrid = () => {
    const gridSize = getGridSize(level);
    const newGrid: Tile[][] = [];
    for (let i = 0; i < gridSize; i++) {
      const row: Tile[] = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          isRemoving: false,
          isNew: false,
          isSpecial: false,
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
  };

  // 레벨 변경 시 그리드 재초기화
  useEffect(() => {
    initializeGrid();
  }, [level]);

  useEffect(() => {
    if (gameState === 'playing') {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState('gameOver');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  // 게임 오버 시 즉시 처리: 타일 애니메이션 등과 무관하게 바로 메시지 표시
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'playing') {
      setGameState('gameOver');
    }
  }, [timeLeft, gameState]);

  useEffect(() => {
    if (score >= getTargetScore(level)) {
      if (level >= MAX_LEVEL) {
        setTimeout(() => {
          setGameState('completed');
        }, 1000);
      } else if (!showLevelUp) {
        setClearedLevel(level);
        setShowLevelUp(true);
        setTimeout(() => {
          setShowLevelUp(false);
          setLevel(l => l + 1);
          setScore(0);
          setGameState('playing');
        }, 1500);
      }
    }
  }, [score, level]);

  const playSound = (soundPath: string, repeat = 1) => {
    if (isMuted || !audioContextRef.current) return;
    
    // AudioContext가 일시 중지된 상태라면 재개
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    // 첫 번째 소리는 즉시 재생
    createPopSound(audioContextRef.current);

    // 나머지 반복 소리는 약간의 딜레이를 두고 재생 (간격도 좀 더 길게)
    for (let i = 1; i < repeat; i++) {
      setTimeout(() => {
        if (audioContextRef.current) {
          createPopSound(audioContextRef.current);
        }
      }, i * 200);
    }
  };

  // 소리 파일 경로 상수 정의
  const SOUNDS = {
    POP: '/sounds/pop.mp3',
    COMBO: '/sounds/combo.mp3',
    MATCH: '/sounds/match.mp3'
  };

  const processManualMatch = async (tiles: TilePosition[]) => {
    setIsProcessing(true);
    const [[r1, c1], [r2, c2], [r3, c3]] = tiles;
    // Remove the selected tiles
    const newGrid = grid.map(row => row.map(tile => ({ ...tile })));
    newGrid[r1][c1].isRemoving = true;
    newGrid[r2][c2].isRemoving = true;
    newGrid[r3][c3].isRemoving = true;
    setGrid(newGrid);
    
    // 소리 재생 - 정확히 3번만
    if (!isMuted && audioContextRef.current) {
      createPopSound(audioContextRef.current);
      setTimeout(() => createPopSound(audioContextRef.current), 150);
      setTimeout(() => createPopSound(audioContextRef.current), 300);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    // True gravity: for each column, let all tiles above fall down to fill empty spaces
    const columns = [c1, c2, c3];
    const gridSize = getGridSize(level);
    for (const col of columns) {
      let pointer = gridSize - 1;
      for (let row = gridSize - 1; row >= 0; row--) {
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

    // 타일 선택 시 즉시 소리 재생
    if (!isMuted && audioContextRef.current) {
      createPopSound(audioContextRef.current);
    }

    const newSelected = [...selectedTiles, [row, col]] as TilePosition[];
    setSelectedTiles(newSelected);

    if (newSelected.length === 3) {
      const [[a1, a2], [b1, b2], [c1, c2]] = newSelected;
      const colorA = grid[a1][a2].color;
      const colorB = grid[b1][b2].color;
      const colorC = grid[c1][c2].color;
      if (colorA === colorB && colorB === colorC) {
        await processManualMatch(newSelected);
      }
      setTimeout(() => setSelectedTiles([]), 100);
    }
  };

  // 터치 종료 핸들러 (필요시 동작 추가)
  const handleTouchEnd = () => {
    // 현재는 아무 동작 없음
  };

  const handleRestart = () => {
    setScore(0);
    setCombo(0);
    setShowCombo(false);
    setTimeLeft(GAME_TIME);
    setSelectedTiles([]);
    setLevel(1);
    setGameState('playing');
    initializeGrid();
  };

  // 터치 이벤트 핸들러 추가
  const handleTouchStart = (e: React.TouchEvent, i: number, j: number) => {};
  const handleTouchMove = (e: React.TouchEvent, i: number, j: number) => {};

  return (
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="max-w-2xl mx-auto relative px-2 sm:px-4">
        {/* Sound toggle button */}
        <button
          onClick={() => setIsMuted(m => !m)}
          className="absolute top-2 right-2 z-10 p-2 bg-white rounded-full shadow hover:bg-gray-200 transition-colors border border-gray-300"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <HiVolumeOff className="w-5 h-5" />
          ) : (
            <HiVolumeUp className="w-5 h-5" />
          )}
        </button>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-2 sm:mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-green-700 mb-1 sm:mb-2">
              LEVEL {level}/{MAX_LEVEL}
              <span className="text-sm sm:text-base font-normal text-gray-600 ml-2">
                (다음 레벨까지 {getTargetScore(level) - score}점)
              </span>
            </h2>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Match-3 Game</h1>
            <div className="flex justify-center items-center gap-2 sm:gap-4 text-sm sm:text-xl">
              <p className="text-gray-600">Score: {score}/{getTargetScore(level)}</p>
              <div className="relative">
                <p className="text-purple-600">Combo: {combo}x</p>
                {showCombo && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 animate-bounce text-xl sm:text-2xl font-bold text-purple-600">
                    {combo}x COMBO!
                  </div>
                )}
              </div>
              <p className="text-red-600">Time: {timeLeft}s</p>
            </div>
            {gameState !== 'playing' && (
              <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
                <div className={`text-6xl font-extrabold mb-4 ${gameState === 'completed' ? 'text-green-500' : 'text-red-500'} drop-shadow-lg`} style={gameState === 'gameOver' ? {textShadow:'-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 2px 2px 8px #fff, 0 0 8px #f00'} : {}}>
                  {gameState === 'completed' ? 'You Win!' : "Time's Up!"}
                </div>
                <div className="text-3xl font-bold text-black bg-white bg-opacity-80 px-6 py-2 rounded shadow-lg">
                  Final Score: {score}
                </div>
              </div>
            )}
            {gameState === 'completed' && (
              <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white p-8 rounded-lg shadow-xl text-center">
                  <h2 className="text-3xl font-bold text-green-600 mb-4">축하합니다! 🎉</h2>
                  <p className="text-xl text-gray-700 mb-2">모든 레벨을 클리어하셨습니다!</p>
                  <p className="text-lg text-gray-600 mb-6">총 {score}점을 획득하셨습니다!</p>
                  <button
                    onClick={handleRestart}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    다시 시작하기
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleRestart}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {gameState === 'playing' ? 'Restart Game' : 'New Game'}
            </button>
          </div>
          <div className="grid gap-4 sm:gap-6 px-4 sm:px-0" style={{ 
            gridTemplateColumns: `repeat(${getGridSize(level)}, minmax(0, 1fr))`,
            maxWidth: 'min(100vw, 600px)',
            margin: '0 auto',
            height: `${getTileSize(level) * getGridSize(level)}px`
          }}>
            {grid.map((row, i) =>
              row.map((tile, j) => (
                <div
                  key={`${i}-${j}`}
                  className={`rounded-lg transition-all duration-200 cursor-pointer ${
                    tile.color
                  } ${
                    selectedTiles.some(([r, c]) => r === i && c === j)
                      ? 'ring-4 ring-blue-500 scale-95'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    width: `${getTileSize(level)}px`,
                    height: `${getTileSize(level)}px`
                  }}
                  onClick={() => handleTileClick(i, j)}
                  onTouchStart={(e) => handleTouchStart(e, i, j)}
                  onTouchMove={(e) => handleTouchMove(e, i, j)}
                  onTouchEnd={handleTouchEnd}
                />
              ))
            )}
          </div>
          {showLevelUp && clearedLevel !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-xl px-10 py-8 text-center">
                <div className="text-4xl font-extrabold text-green-600 mb-2">LEVEL {clearedLevel} CLEAR!</div>
                <div className="text-xl text-gray-700">다음 레벨로 이동합니다</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 