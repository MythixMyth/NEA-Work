import { Chessboard } from 'react-chessboard'
import './App.css'

function App() {
  return (
    <main className="Stage">
      <div className="BoardFrame">
        <Chessboard
          id="ChessCoachBoard"
          position="start"
          arePiecesDraggable={false}
          boardWidth={560}
          customBoardStyle={{ borderRadius: '2px' }}
          customDarkSquareStyle={{ backgroundColor: '#b58863' }}
          customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
        />
      </div>
    </main>
  )
}

export default App
