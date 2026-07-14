import { useState, useEffect, useRef } from 'react' // https://react.dev/reference/react
import { Chess } from 'chess.js' // https://www.npmjs.com/package/chess.js?activeTab=readme
import { findBestMove } from "./CustomEngine" // No documentation for this, but it is a hand-written engine for the low elo levels.
import { evaluatePosition } from './EvaluationService' // My messaging service wrapping a dedicated stockfish worker for evaluations.
import { Chessboard } from 'react-chessboard' // https://www.npmjs.com/package/react-chessboard?activeTab=readme
import './App.css' // Stylesheet

/*
  Using an array for bot levels, holding Dictionary for Stage, Elo.
  I might add more stages since beginners may be TRUE beginners to chess as a whole rather than
  beginners to competitive scenes.
*/
const BotLevels = [
  { Stage: 'Novice', Elo: 400, Engine: 'custom' }, // New stages for true beginners to the sport
  { Stage: 'Novice', Elo: 600, Engine: 'custom' },
  { Stage: 'Novice', Elo: 800, Engine: 'custom' },
  { Stage: 'Novice', Elo: 1000, Engine: 'custom' },
  { Stage: 'Novice', Elo: 1200, Engine: 'custom' },
  { Stage: 'Beginner', Elo: 1320, Engine: 'stockfish' }, // Original stages from first release of Bot logic.
  { Stage: 'Beginner', Elo: 1550, Engine: 'stockfish' },
  { Stage: 'Intermediate', Elo: 1850, Engine: 'stockfish' },
  { Stage: 'Advanced', Elo: 2250, Engine: 'stockfish' },
  { Stage: 'Advanced', Elo: 2750, Engine: 'stockfish' },
]

function App() {
  // Game variable for handling the chess-game logic (referenced throughout the code therefore a global var) 
  const [Game, setGame] = useState(() => new Chess())
  
  // Predetermined variables I need (using react)
  const [SelectedSquare, setSelectedSquare] = useState(null) // Type Square object || null
  const [LegalMoveSquares, setLegalMoveSquares] = useState([]) // Type array[] of Square objects
  const [PgnInput, setPgnInput] = useState('')
  const [LoadError, setLoadError] = useState('')
  const [BoardWidth, setBoardWidth] = useState(480) // Default 480x480 boardsize.
  const [GameMode, setGameMode] = useState('local') // string-union local/bot
  const [BotLevel, setBotLevel] = useState(3) // level ranging from 1->10 (1-5 custom engine, 6-10 stockfish)
  const [BotThinking, setBotThinking] = useState(false) // controlled via bot logic + gameplay loop.
  const [Evaluation, setEvaluation] = useState({ Centipawns: 0, Mate: null }) // Always from white's perspective, courtesy of EvaluationService.
  const EngineRef = useRef(null) // Reactive Reference to the engine object for stockfish.

  useEffect(() => { // This is reactive effectant for devices with different aspectratios or sizes than the base 1920x1080
    function updateBoardWidth() {
      // Reserve space for the side panel + gap + page padding + the eval bar
      const Reserved = 320 + 32 + 64 + 32
      const Clamped = Math.min(560, Math.max(240, window.innerWidth - Reserved))
      setBoardWidth(Clamped)
    }
    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [])

  useEffect(() => { // Reactive effectant coordinating stockfish engine reference.
    if (GameMode === 'local') return
    if (EngineRef.current) return
    if (BotLevels[BotLevel - 1].Engine === 'custom') return // Exit for custom engine since its a singlethread js file and does not need communication.
    const Engine = new Worker('/stockfish-18-lite-single.js')
    Engine.postMessage('uci')
    Engine.postMessage('setoption name UCI_LimitStrength value true')
    EngineRef.current = Engine
  }, [GameMode, BotLevel])

  useEffect(() => { // Reactive effectant controlling engine BEHAVIOR in-game for example reacting to moves - with elo coordinating.
    if (GameMode !== 'bot') return
    if (Game.turn() !== 'b') return
    if (Game.isGameOver()) return

    if (BotLevels[BotLevel - 1].Engine === 'custom') {
      setBotThinking(true)
      const Timer = setTimeout(() => {
        const BestMove = findBestMove(Game.fen(), BotLevel - 1)
        if (BestMove) {
          const GameCopy = copyGame()
          GameCopy.move(BestMove)
          setGame(GameCopy)
        }
        setBotThinking(false)
      },400) // 400ms delay to simulate thinking time for the bot
      return () => clearTimeout(Timer)
    }

    const Engine = EngineRef.current // Stockfish path only from here down, custom already returned above.
    if (!Engine) return

    function handleEngineMessage(event) {
      const Line = String(event.data)
      if (!Line.startsWith('bestmove')) return
      const MoveText = Line.split(' ')[1]
      const GameCopy = copyGame()
      let Move = null
      try {
        Move = GameCopy.move({
          from: MoveText.slice(0, 2),
          to: MoveText.slice(2, 4),
          promotion: MoveText.slice(4) || 'q',
        })
      } catch (error) {
        Move = null
      }
      if (Move) {
        setGame(GameCopy)
        setBotThinking(false)
      }
    }

    Engine.addEventListener('message', handleEngineMessage)
    Engine.postMessage('setoption name UCI_Elo value ' + BotLevels[BotLevel - 1].Elo)
    Engine.postMessage('position fen ' + Game.fen())
    Engine.postMessage('go movetime 800')

    return () => {
      Engine.removeEventListener('message', handleEngineMessage)
      Engine.postMessage('stop')
    }
  }, [Game, GameMode, BotLevel])

  useEffect(() => { // Reactive effectant asking the evaluation service to score every new position.
    let Cancelled = false // Guards against an old evaluation arriving AFTER a newer move already happened.
    evaluatePosition(Game.fen()).then((Result) => {
      if (!Cancelled) setEvaluation(Result)
    })
    return () => { Cancelled = true }
  }, [Game])

  // early return demon
  function getStatusMessage() {
    if (Game.isCheckmate()) return (Game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate'
    if (Game.isDraw()) return 'Draw'
    if (Game.isCheck()) return (Game.turn() === 'w' ? 'White' : 'Black') + ' is in check'
    return (Game.turn() === 'w' ? 'White' : 'Black') + ' to move'
  }

  // Result headline for the game-over popup. Bot mode talks TO the player since they are always white.
  function getResultMessage() {
    if (Game.isCheckmate()) {
      if (GameMode === 'bot') return Game.turn() === 'w' ? 'You lost by checkmate' : 'You won by checkmate!'
      return (Game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate'
    }
    if (Game.isStalemate()) return 'Draw by stalemate'
    if (Game.isThreefoldRepetition()) return 'Draw by repetition'
    if (Game.isInsufficientMaterial()) return 'Draw by insufficient material'
    return 'Draw'
  }

  // How much of the eval bar should be white, as a percentage. Clamped at +-10 pawns so the bar
  // never fully empties from a normal advantage - only a found mate pins it to 0 or 100.
  function getWhiteBarPercent() {
    if (Evaluation.Mate !== null) return Evaluation.Mate > 0 ? 100 : 0
    const Clamped = Math.min(1000, Math.max(-1000, Evaluation.Centipawns))
    return 50 + (Clamped / 1000) * 50
  }

  // Little label on the bar, pawns to one decimal like chess.com, or 'M3' when mate was found.
  function getEvalText() {
    if (Evaluation.Mate !== null) return 'M' + Math.abs(Evaluation.Mate)
    return (Evaluation.Centipawns / 100).toFixed(1)
  }

  // When trying moves (use of local variable vs global variable omg)
  function copyGame() {
    const Copy = new Chess()
    Game.history({ verbose: true }).forEach((move) => Copy.move(move))
    return Copy
  }

  // Trying a move to see if it is viable, a legal move.
  function tryMove(fromSquare, toSquare) {
    if (GameMode === 'bot' && Game.turn() === 'b') return false
    const GameCopy = copyGame()
    let Move = null
    try {
      Move = GameCopy.move({ from: fromSquare, to: toSquare, promotion: 'q' }) // Promote to a queen preset until I extend this onto a choice.
    } catch (error) {
      Move = null // chess.js throws on illegal moves instead of returning null, so treat that as "not a move"
    }
    if (Move) {
      setGame(GameCopy)
      setSelectedSquare(null)
      setLegalMoveSquares([])
      return true
    }
    return false
  }

  // Selects a square and shows its legal moves, if it holds a piece belonging to the side to move.
  function selectSquare(square) {
    if (GameMode === 'bot' && Game.turn() === 'b') return false
    const Piece = Game.get(square)
    if (Piece && Piece.color === Game.turn()) {
      setSelectedSquare(square)
      const Moves = Game.moves({ square, verbose: true })
      setLegalMoveSquares(Moves.map((m) => m.to))
      return true
    }
    return false
  }

  // chessboard calls onPieceDrop with { piece, sourceSquare, targetSquare }
  function onPieceDrop(dropInfo) {
    return tryMove(dropInfo.sourceSquare, dropInfo.targetSquare)
  }

  // chessboard calls onPieceDrag with { isSparePiece, piece, square } as soon as a drag begins
  function onPieceDrag(dragInfo) {
    if (dragInfo.isSparePiece || !dragInfo.square) return
    if (Game.isGameOver()) return
    selectSquare(dragInfo.square)
  }

  // calls onSquareClick with { piece, square }
  // Abstracted logic from previous to a "selectSquare" function to share with onPieceDrag
  function onSquareClick(clickInfo) {
    const ClickedSquare = clickInfo.square
    if (Game.isGameOver()) return

    if (SelectedSquare) {
      const Moved = tryMove(SelectedSquare, ClickedSquare)
      if (!Moved && !selectSquare(ClickedSquare)) {
        setSelectedSquare(null)
        setLegalMoveSquares([])
      }
    } else {
      selectSquare(ClickedSquare)
    }
  }

  // Using chessjs function loadPgn to arrange the board as required.
  function loadFromPgn() {
    const NewGame = new Chess()
    try {
      NewGame.loadPgn(PgnInput.trim())
      setGame(NewGame)
      setSelectedSquare(null)
      setLegalMoveSquares([])
      setLoadError('')
    } catch (error) {
      setLoadError('Invalid PGN — check the format and try again.')
    }
  }

  // Handling games loop.
  function resetGame() {
    setGame(new Chess())
    setSelectedSquare(null)
    setLegalMoveSquares([])
    setPgnInput('')
    setLoadError('')
    setBotThinking(false)
  }

  function switchMode(newMode) {
    if (newMode === GameMode) return
    setGameMode(newMode)
    resetGame()
  }
  // Hashmap for [squares] indexed with their styling data. Used to show highlights or errored squares (In the future for blinking illegal attempts)
  const SquareStyles = {}
  if (SelectedSquare) {
    SquareStyles[SelectedSquare] = { backgroundColor: 'rgba(141, 141, 141, 0.45)' }
  }
  LegalMoveSquares.forEach((square) => {
    SquareStyles[square] = { backgroundColor: 'rgba(102, 255, 102, 0.45)' }
  })

  const chessboardOptions = {
    id: 'ChessCoachBoard',
    position: Game.fen(),
    onPieceDrop,
    onPieceDrag,
    onSquareClick,
    squareStyles: SquareStyles,
    boardStyle: { borderRadius: '12px', cursor: 'pointer' },
    darkSquareStyle: { backgroundColor: '#f0d9b5' },
    lightSquareStyle: { backgroundColor: '#b58863' },
  }

  return (
    <main className="Stage">
      <div className="BoardArea">
        <div className="EvalBar" style={{ height: BoardWidth }}>
          <div className="EvalBarWhite" style={{ height: getWhiteBarPercent() + '%' }} />
          <span className="EvalText">{getEvalText()}</span>
        </div>
        <div className="BoardFrame">
          <div className="BoardSizer" style={{ width: BoardWidth }}>
            <Chessboard options={chessboardOptions} />
            {Game.isGameOver() && (
              <div className="ResultOverlay">
                <div className="ResultPopup">
                  <h2>{getResultMessage()}</h2>
                  <button onClick={resetGame}>Play again</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="Panel">
        <p className="Status">{BotThinking ? 'Bot is thinking...' : getStatusMessage()}</p>

        <div className="Section">
          <h3>Opponent</h3>
          <div className="ButtonRow">
            <button
              className={GameMode === 'local' ? 'ModeButtonActive' : ''}
              onClick={() => switchMode('local')}
            >
              Local
            </button>
            <button
              className={GameMode === 'bot' ? 'ModeButtonActive' : ''}
              onClick={() => switchMode('bot')}
            >
              Bot
            </button>
          </div>
          {GameMode === 'bot' && (
            <div className="BotStrength">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={BotLevel}
                onChange={(e) => setBotLevel(Number(e.target.value))}
              />
              <p className="BotStageText">
                Level {BotLevel} of 10 — {BotLevels[BotLevel - 1].Stage} ({BotLevels[BotLevel - 1].Elo})
              </p>
            </div>
          )}
        </div>

        <div className="Section">
          <h3>PGN</h3>
          <pre className="PgnText">{Game.pgn() || '(no moves yet)'}</pre>
        </div>

        <div className="Section">
          <h3>Load PGN</h3>
          <textarea
            className="PgnInput"
            value={PgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            placeholder="Paste PGN here..."
            rows={4}
          />
          {LoadError && <p className="ErrorText">{LoadError}</p>}
          <div className="ButtonRow">
            <button onClick={loadFromPgn}>Load</button>
            <button onClick={resetGame}>Reset</button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App