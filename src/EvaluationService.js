/*
  A small messaging "API" service wrapping stockfish in its OWN web worker, kept separate from
  the bot opponent worker so their messages never get mixed up. The rest of the app just calls
  evaluatePosition(fen) and gets a Promise back - it never has to know about UCI text protocol.

  Stockfish talks in plain text lines, the two I care about here:
  - "info depth 10 ... score cp 35 ..."  = evaluation so far (centipawns, or "score mate N")
  - "bestmove e2e4 ..."                  = search finished, this is the move it recommends
*/

let EngineWorker = null // Created lazily on the first request so the app boots without spinning up a worker.
let ActiveRequest = null // Only one 'go' command runs at a time, extras wait in the queue below.
const RequestQueue = []

// Starts (or reuses) the evaluation worker.
function getEngineWorker() {
  if (EngineWorker) return EngineWorker
  EngineWorker = new Worker('/stockfish-18-lite-single.js')
  EngineWorker.postMessage('uci')
  EngineWorker.addEventListener('message', handleEngineMessage)
  return EngineWorker
}

// One listener for the workers lifetime, routing lines into whichever request is active.
function handleEngineMessage(event) {
  const Line = String(event.data)
  if (!ActiveRequest) return

  if (Line.startsWith('info') && Line.includes(' score ')) {
    const Parts = Line.split(' ')
    const ScoreIndex = Parts.indexOf('score')
    const ScoreType = Parts[ScoreIndex + 1] // 'cp' (centipawns) or 'mate' (moves until mate)
    const ScoreValue = Number(Parts[ScoreIndex + 2])
    if (ScoreType === 'cp') {
      ActiveRequest.Centipawns = ScoreValue
      ActiveRequest.Mate = null
    }
    if (ScoreType === 'mate') {
      ActiveRequest.Mate = ScoreValue
      ActiveRequest.Centipawns = null
    }
  }

  if (Line.startsWith('bestmove')) {
    const Finished = ActiveRequest
    ActiveRequest = null
    // UCI scores are from the SIDE TO MOVE's point of view, I flip them here so callers
    // always get white's point of view (positive = good for white), like chess.com shows.
    if (Finished.SideToMove === 'b') {
      if (Finished.Centipawns !== null) Finished.Centipawns = -Finished.Centipawns
      if (Finished.Mate !== null) Finished.Mate = -Finished.Mate
    }
    Finished.resolve({
      Centipawns: Finished.Centipawns,
      Mate: Finished.Mate,
      BestMove: Line.split(' ')[1],
    })
    runNextRequest()
  }
}

// Sends the next queued position to the engine, if it is free.
function runNextRequest() {
  if (ActiveRequest || RequestQueue.length === 0) return
  ActiveRequest = RequestQueue.shift()
  const Engine = getEngineWorker()
  Engine.postMessage('position fen ' + ActiveRequest.Fen)
  Engine.postMessage('go depth ' + ActiveRequest.Depth)
}

/*
  The public API. Give it a FEN, get back a Promise of:
  { Centipawns, Mate, BestMove }
  - Centipawns: evaluation in centipawns from white's perspective (null when a mate was found)
  - Mate: moves until forced mate, positive = white mates (null when no mate found)
  - BestMove: stockfish's recommended move in UCI text e.g. 'e2e4'
*/
export function evaluatePosition(fen, depth = 12) {
  return new Promise((resolve) => {
    RequestQueue.push({
      Fen: fen,
      Depth: depth,
      SideToMove: fen.split(' ')[1], // second field of a FEN is whose turn it is ('w' or 'b')
      Centipawns: 0,
      Mate: null,
      resolve,
    })
    runNextRequest()
  })
}
