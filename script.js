/***********************
 * 기본 설정
 ***********************/
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const size = 15;
const cellSize = 30;
const half = cellSize / 2;

let board = Array.from({ length: size }, () => Array(size).fill(null));
let currentPlayer = "player";
let gameOver = false;

let playerStone = "black";
let aiStone = "white";

let aiLevel = "easy"; // easy, medium, hard

const startBtn = document.getElementById("startBtn");
const difficultySelect = document.getElementById("difficulty");

/***********************
 * 유틸
 ***********************/
function inBounds(x, y) { return x >= 0 && y >= 0 && x < size && y < size; }

function getMouseCell(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  let x = Math.floor(px / cellSize);
  let y = Math.floor(py / cellSize);
  x = Math.max(0, Math.min(size - 1, x));
  y = Math.max(0, Math.min(size - 1, y));
  return { x, y };
}

/***********************
 * 렌더링
 ***********************/
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f0d9b5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i++) {
    ctx.beginPath();
    ctx.moveTo(half, half + i * cellSize);
    ctx.lineTo(half + (size - 1) * cellSize, half + i * cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(half + i * cellSize, half);
    ctx.lineTo(half + i * cellSize, half + (size - 1) * cellSize);
    ctx.stroke();
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x]) drawStone(x, y, board[y][x]);
    }
  }
}

function drawStone(x, y, color) {
  ctx.beginPath();
  ctx.arc(x * cellSize + half, y * cellSize + half, cellSize * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = color === "black" ? "#111" : "#fff";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHover(x, y, color) {
  ctx.beginPath();
  ctx.arc(x * cellSize + half, y * cellSize + half, cellSize * 0.36, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color === "black" ? "#111" : "#fff";
  ctx.stroke();
  ctx.setLineDash([]);
}

/***********************
 * 입력
 ***********************/
canvas.addEventListener("mousemove", e => {
  if (gameOver || currentPlayer !== "player") return;
  const { x, y } = getMouseCell(e);
  if (!inBounds(x, y)) return;
  drawBoard();
  if (!board[y][x]) drawHover(x, y, playerStone);
});

canvas.addEventListener("mouseleave", () => { if (!gameOver) drawBoard(); });

canvas.addEventListener("click", e => {
  if (gameOver || currentPlayer !== "player") return;
  const { x, y } = getMouseCell(e);
  if (!inBounds(x, y) || board[y][x] !== null) return;

  placeStone(x, y, playerStone);
  if (checkWin(x, y, playerStone)) {
    alert(aiLevel === "hard" ? "어려움 난이도에서 승리했습니다!" : "플레이어 승리!");
    gameOver = true;
    return;
  }
  currentPlayer = "ai";
  setTimeout(aiMove, 160);
});

/***********************
 * 게임 로직
 ***********************/
function placeStone(x, y, stone) {
  board[y][x] = stone;
  drawBoard();
}

function checkWin(x, y, stone) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dx,dy] of dirs) {
    let count=1;
    let nx=x+dx, ny=y+dy;
    while(inBounds(nx,ny)&&board[ny][nx]===stone){count++; nx+=dx; ny+=dy;}
    nx=x-dx; ny=y-dy;
    while(inBounds(nx,ny)&&board[ny][nx]===stone){count++; nx-=dx; ny-=dy;}
    if(count>=5) return true;
  }
  return false;
}

/***********************
 * AI
 ***********************/
function aiMove() {
  if(gameOver) return;
  let move;
  if(aiLevel==="easy") move=aiEasy();
  else if(aiLevel==="medium") move=aiMedium();
  else move=aiHard();
  if(move) {
    placeStone(move.x, move.y, aiStone);
    if(checkWin(move.x, move.y, aiStone)) {
      alert("AI 승리!");
      gameOver=true;
      return;
    }
  }
  currentPlayer="player";
}

/* 쉬움 */
function aiEasy() {
  let win=findImmediateWin(aiStone);
  if(win) return win;
  let block=findImmediateWin(playerStone);
  if(block) return block;
  const c=Math.floor(size/2);
  if(board[c][c]===null) return {x:c,y:c};
  const near=getCandidateMoves(1);
  if(near.length) return randomPick(near);
  return randomPick(getAllEmpty());
}

/* 중간 */
function aiMedium() {
  let win=findImmediateWin(aiStone); if(win) return win;
  let block=findImmediateWin(playerStone); if(block) return block;
  const candidates=getCandidateMoves(2);
  const moves=candidates.length?candidates:getAllEmpty();
  let best=null, bestScore=-Infinity;
  for(const {x,y} of moves){
    const off=evaluateMoveScore(x,y,aiStone);
    const def=evaluateMoveScore(x,y,playerStone);
    const centerBias=12-(Math.abs(x-size/2)+Math.abs(y-size/2));
    const neighborBias=countNeighbors(x,y)*2;
    const score=off*1.2+def*1.0+centerBias+neighborBias;
    if(score>bestScore){bestScore=score; best={x,y};}
  }
  return best;
}

function aiHard() {
  // 1. 즉시 승리 체크
  let win = findImmediateWin(aiStone);
  if(win) return win;

  // 2. 플레이어 즉시 승리 차단
  let block = findImmediateWin(playerStone);
  if(block) return block;

  // 3. 후보 수 가져오기 (주변 2칸)
  const candidates = getCandidateMoves(2);

  let bestMove = null;
  let bestScore = -Infinity;

  for(const {x, y} of candidates) {
    // 공격 점수
    const attackScore = evaluateMoveScore(x, y, aiStone);
    // 방어 점수
    const defenseScore = evaluateMoveScore(x, y, playerStone);
    // 중앙 편향 + 주변 돌 가중치
    const centerBias = (size/2 - Math.abs(x-size/2)) + (size/2 - Math.abs(y-size/2));
    const neighborBias = countNeighbors(x, y) * 2;

    // 총 점수: 공격 2배 + 방어 1배 + 기타 가중치
    const score = attackScore*2 + defenseScore*1 + centerBias + neighborBias;

    if(score > bestScore) {
      bestScore = score;
      bestMove = { x, y };
    }
  }

  return bestMove || getCandidateMoves(2)[0]; // 랜덤 제거
}


/* 평가 함수 */
function evaluateBoard(color){
  let score=0;
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(board[y][x]===color){
        const dirs=[[1,0],[0,1],[1,1],[1,-1]];
        for(const [dx,dy] of dirs){
          const {count,openEnds}=getLineInfo(x,y,dx,dy,color);
          score+=patternScore(count,openEnds);
        }
      }
    }
  }
  return score;
}

/***********************
 * AI 보조
 ***********************/
function findImmediateWin(color){
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(board[y][x]===null){
        board[y][x]=color;
        const win=checkWin(x,y,color);
        board[y][x]=null;
        if(win) return {x,y};
      }
    }
  }
  return null;
}

function getAllEmpty(){
  const arr=[];
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(board[y][x]===null) arr.push({x,y});
    }
  }
  return arr;
}

function getCandidateMoves(r=1){
  const set=new Set();
  const add=(x,y)=>set.add(`${x},${y}`);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(board[y][x]!==null){
        for(let dy=-r;dy<=r;dy++){
          for(let dx=-r;dx<=r;dx++){
            const nx=x+dx, ny=y+dy;
            if(inBounds(nx,ny)&&board[ny][nx]===null) add(nx,ny);
          }
        }
      }
    }
  }
  return Array.from(set).map(s=>{const [x,y]=s.split(",").map(Number); return {x,y};});
}

function randomPick(arr){return arr[Math.floor(Math.random()*arr.length)];}

function evaluateMoveScore(x,y,color){
  board[y][x]=color;
  let score=0;
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for(const [dx,dy] of dirs){
    const {count,openEnds}=getLineInfo(x,y,dx,dy,color);
    score+=patternScore(count,openEnds);
  }
  board[y][x]=null;
  return score;
}

function getLineInfo(x,y,dx,dy,color){
  let count=1;
  let nx=x+dx, ny=y+dy;
  while(inBounds(nx,ny)&&board[ny][nx]===color){count++; nx+=dx; ny+=dy;}
  let open1=inBounds(nx,ny)&&board[ny][nx]===null?1:0;
  nx=x-dx; ny=y-dy;
  while(inBounds(nx,ny)&&board[ny][nx]===color){count++; nx-=dx; ny-=dy;}
  let open2=inBounds(nx,ny)&&board[ny][nx]===null?1:0;
  return {count, openEnds: open1+open2};
}

function patternScore(count,open){
  if(count>=5) return 100000;
  if(count===4&&open>=1) return 20000;
  if(count===3&&open===2) return 6000;
  if(count===3&&open===1) return 900;
  if(count===2&&open===2) return 350;
  if(count===2&&open===1) return 70;
  if(count===1&&open===2) return 20;
  return 0;
}

function countNeighbors(x,y){
  let c=0;
  for(let dy=-1;dy<=1;dy++){
    for(let dx=-1;dx<=1;dx++){
      if(dx===0&&dy===0) continue;
      const nx=x+dx, ny=y+dy;
      if(inBounds(nx,ny)&&board[ny][nx]!==null) c++;
    }
  }
  return c;
}

/***********************
 * 시작/리셋
 ***********************/
startBtn.addEventListener("click",()=>{
  board=Array.from({length:size},()=>Array(size).fill(null));
  gameOver=false;
  aiLevel=difficultySelect.value;
  const order=document.querySelector('input[name="order"]:checked')?.value||"first";
  currentPlayer=order==="first"?"player":"ai";
  drawBoard();
  if(currentPlayer==="ai") setTimeout(aiMove,200);
});

difficultySelect.addEventListener("change",(e)=>{aiLevel=e.target.value;});

drawBoard();
