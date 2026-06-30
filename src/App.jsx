import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import './App.css'

function App() {
  // Game variable for handling the chess-game logic (referenced throughout the code therefore a global var) 
  const [Game, setGame] = useState(() => new Chess())
  
  // Predetermined variables I need (using react)
  const [SelectedSquare, setSelectedSquare] = useState(null) // Type Square object || null
  const [LegalMoveSquares, setLegalMoveSquares] = useState([]) // Type array[] of Square objects
  const [PgnInput, setPgnInput] = useState('')
  const [LoadError, setLoadError] = useState('')
  const [BoardWidth, setBoardWidth] = useState(480) // Default 480x480 boardsize.

  useEffect(() => { // This is reactive effectant for devices with different aspectratios or sizes than the base 1920x1080
    function updateBoardWidth() {
      // Reserve space for the side panel + gap + page padding
      const Reserved = 320 + 32 + 64
      const Clamped = Math.min(560, Math.max(240, window.innerWidth - Reserved))
      setBoardWidth(Clamped)
    }
    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [])

  // early return demon
  function getStatusMessage() {
    if (Game.isCheckmate()) return (Game.turn() === 'w' ? 'Black' : 'White') + ' wins by checkmate'
    if (Game.isDraw()) return 'Draw'
    if (Game.isCheck()) return (Game.turn() === 'w' ? 'White' : 'Black') + ' is in check'
    return (Game.turn() === 'w' ? 'White' : 'Black') + ' to move'
  }

  // When trying moves (use of local variable vs global variable omg)
  function copyGame() {
    const Copy = new Chess()
    Game.history({ verbose: true }).forEach((move) => Copy.move(move))
    return Copy
  }

  // Trying a move to see if it is viable, a legal move.
  function tryMove(fromSquare, toSquare) {
    const GameCopy = copyGame()
    const Move = GameCopy.move({ from: fromSquare, to: toSquare, promotion: 'q' }) // Promote to a queen preset until I extend this onto a choice.
    if (Move) {
      setGame(GameCopy)
      setSelectedSquare(null)
      setLegalMoveSquares([])
      return true
    }
    return false
  }

  // chessboard calls onPieceDrop with { piece, sourceSquare, targetSquare }
  function onPieceDrop(dropInfo) {
    return tryMove(dropInfo.sourceSquare, dropInfo.targetSquare)
  }

  // calls onSquareClick with { piece, square }
  function onSquareClick(clickInfo) {
    const ClickedSquare = clickInfo.square
    if (Game.isGameOver()) return

    if (SelectedSquare) {
      const Moved = tryMove(SelectedSquare, ClickedSquare)
      if (!Moved) {
        const Piece = Game.get(ClickedSquare)
        if (Piece && Piece.color === Game.turn()) {
          setSelectedSquare(ClickedSquare)
          const Moves = Game.moves({ square: ClickedSquare, verbose: true })
          setLegalMoveSquares(Moves.map((m) => m.to))
        } else {
          setSelectedSquare(null)
          setLegalMoveSquares([])
        }
      }
    } else {
      const Piece = Game.get(ClickedSquare)
      if (Piece && Piece.color === Game.turn()) {
        setSelectedSquare(ClickedSquare)
        const Moves = Game.moves({ square: ClickedSquare, verbose: true })
        setLegalMoveSquares(Moves.map((m) => m.to))
      }
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
    onSquareClick,
    squareStyles: SquareStyles,
    boardStyle: { borderRadius: '12px', cursor: 'pointer' },
    darkSquareStyle: { backgroundColor: '#2c567c' },
    lightSquareStyle: { backgroundColor: '#ffffff' },
  }

  return (
    <main className="Stage">
      <div className="BoardFrame">
        <div className="BoardSizer" style={{ width: BoardWidth }}>
          <Chessboard options={chessboardOptions} />
        </div>
      </div>

      <div className="Panel">
        <p className="Status">{getStatusMessage()}</p>

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