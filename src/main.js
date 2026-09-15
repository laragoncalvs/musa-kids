import Soundfont from "soundfont-player";
import * as THREE from "three";
import { createClient } from "@supabase/supabase-js";
import { keyMap } from "./keyMap.js";
import { allCubes } from "./cubes.js";
import { loadedTexturesAlt } from "./cubes.js";
import notasJson from "./partituras/furelise.json";
import lagoJson from "./partituras/lago.json";
import littlestar from "./partituras/littlestar.json";
import jinglebell from "./partituras/jinglebell.json";
import odeToJoy from "./partituras/ode.json";

let audioContext = null;
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}
const pitchToKey = {};

let piano = null;
let pianoLoaded = false;
let modoAtual = null;
let modoMusica = null;
let multiplicadorTempo = 1;
let teclaListener = null;
let animationId = null;
let startTime = null;
let pauseStartTime = null;
let pausedTimeOffset = 0;
let fimTimeout = null;
let musica = null;
let pontuation = 0;
let sessaoJogo = 0;
let totalNotas = 0;
let pontosParaAcerto = 0;
const PONTUACAO_MAXIMA = 1000;
let duracaoTotal = 0;
const pianoSvgKeys = {};

function normalizePitch(pitch) {
  if (!pitch) return pitch;
  if (pitch.startsWith("B#")) {
    const octave = Number(pitch.slice(2));
    return `C${octave + 1}`;
  }
  if (pitch.startsWith("E#")) {
    const octave = Number(pitch.slice(2));
    return `F${octave}`;
  }
  return pitch;
}

function normalizeKeyForMap(key) {
  if (!key) return key;
  const special = {
    enter: "Enter",
    shift: "Shift",
    "/": "//",
    "-": "-",
    "[": "[",
    "]": "]",
    "=": "=",
    ";": ";",
    ",": ",",
    ".": ".",
    "'": "'",
    ç: "ç",
    "\\": "\\",
  };
  const lower = key.toLowerCase();
  return special[lower] ?? lower;
}
const colisoes = [];

for (const [key, pitch] of Object.entries(keyMap)) {
  const norm = normalizePitch(pitch); // mesma função do projeto
  if (pitchToKey[norm] !== undefined) {
    colisoes.push({ pitch: norm, teclas: [pitchToKey[norm], key] });
  }
  pitchToKey[norm] = key;
}

console.log(colisoes);
function highlightPianoKey(pitch) {
  const normalized = normalizePitch(pitch);
  const key = pianoSvgKeys[normalized];
  if (!key) return;
  key.classList.add("active");
  if (key.highlightTimeout) clearTimeout(key.highlightTimeout);
  key.highlightTimeout = setTimeout(() => key.classList.remove("active"), 180);
}

function createAlphaGradientTexture(colorHex, direction = "bottom-to-top") {
  const size = 256;
  const canvas = document.createElement("canvas");
  if (["left-to-right", "right-to-left"].includes(direction)) {
    canvas.width = size;
    canvas.height = 1;
  } else {
    canvas.width = 1;
    canvas.height = size;
  }
  const context = canvas.getContext("2d");
  let x0 = 0,
    y0 = 0,
    x1 = 0,
    y1 = 0;
  switch (direction) {
    case "top-to-bottom":
      x0 = 0;
      y0 = 0;
      x1 = 0;
      y1 = size;
      break;
    case "bottom-to-top":
      x0 = 0;
      y0 = size;
      x1 = 0;
      y1 = 0;
      break;
    case "left-to-right":
      x0 = 0;
      y0 = 0;
      x1 = size;
      y1 = 0;
      break;
    case "right-to-left":
      x0 = size;
      y0 = 0;
      x1 = 0;
      y1 = 0;
      break;
    default:
      x0 = 0;
      y0 = size;
      x1 = 0;
      y1 = 0;
  }
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, hexToRgba(colorHex, 0.0));
  gradient.addColorStop(0.7, hexToRgba(colorHex, 0.7));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const gradientTexture = createAlphaGradientTexture("#E323CA", "top-to-bottom");
const gradientTexture2 = createAlphaGradientTexture("#E323CA", "bottom-to-top");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0912);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 9, 6);
camera.lookAt(0, 1, 0);

const isMobile =
  /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
const PIANO_HEIGHT = isMobile ? 0 : 170;
if (isMobile) {
  camera.position.set(0, 7.5, 4);
  camera.fov = 90;
  camera.updateProjectionMatrix();
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
const canvasHeight = Math.max(0, window.innerHeight - PIANO_HEIGHT);
renderer.setSize(window.innerWidth, canvasHeight);
renderer.domElement.style.display = "block";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.position = "relative";
renderer.domElement.style.zIndex = "1";
const gameArea = document.getElementById("gameArea");
if (gameArea) {
  gameArea.appendChild(renderer.domElement);
} else {
  document.body.appendChild(renderer.domElement);
}

criarPianoGrafico();

const scaleMultiplier = isMobile ? 0.45 : 1;
const planeGeometry2 = new THREE.PlaneGeometry(13.5 * scaleMultiplier, 2);
const planeMaterial2 = new THREE.MeshStandardMaterial({
  color: 0xe323ca,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5,
});
const plane2 = new THREE.Mesh(planeGeometry2, planeMaterial2);
plane2.rotation.x = -Math.PI / 2;
plane2.position.z = 3;
scene.add(plane2);

const lineGeometry = new THREE.PlaneGeometry(0.04, 9 * scaleMultiplier);
const lineMaterial = new THREE.MeshStandardMaterial({
  color: 0xe323ca,
  map: gradientTexture,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
const lines = Array.from(
  { length: 13 },
  (_, i) => new THREE.Mesh(lineGeometry, lineMaterial),
);
lines.forEach((line, i) => {
  line.rotation.x = -Math.PI / 2;
  line.position.x =
    [0, 1.1, -1.1, 2.2, -2.2, 3.3, -3.3, 4.4, -4.4, 5.5, -5.5, 6.7, -6.7][i] *
    scaleMultiplier;
  line.position.z = -2.5;
  scene.add(line);
});

if (isMobile) {
  plane2.position.z = 3.5;
  plane2.scale.set(1, 0.6);
  lines.forEach((line) => {
    line.scale.set(1, 2.8);
    line.position.z = -2.8;
  });
}
scene.add(new THREE.AmbientLight(0xffffff, 2));
const directionalLight = new THREE.DirectionalLight(0xf5f591, 4);
directionalLight.position.set(0, 10, 0);
scene.add(directionalLight);

window.addEventListener("resize", () => {
  const pianoDiv = document.getElementById("pianoVirtual");
  const pianoHeight = pianoDiv ? pianoDiv.getBoundingClientRect().height : 0;
  const height = Math.max(0, window.innerHeight - PIANO_HEIGHT - pianoHeight);
  camera.aspect = window.innerWidth / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, height);
  const gameArea = document.getElementById("gameArea");
  if (gameArea) gameArea.style.height = height + "px";
  renderer.domElement.style.height = height + "px";
});

const activeCubes = [];
const spawnEvents = [];
const VELOCIDADE_CUBO = 0.1;

function addCubeToScene(letter, delay, speed) {
  spawnEvents.push({ letter, delay, speed, spawned: false });
}

function aplicarMultiplicadorTempo() {
  spawnEvents.forEach((event) => {
    event.delay *= multiplicadorTempo;
    event.speed /= multiplicadorTempo;
  });
}

function spawnCube(letter, speed) {
  const baseCube = allCubes[letter];
  if (!baseCube) return;
  const geometry = baseCube.geometry.clone();
  let newMaterials;
  if (Array.isArray(baseCube.material)) {
    newMaterials = baseCube.material.map((mat) => mat.clone());
  } else {
    newMaterials = baseCube.material.clone();
  }
  const cube = new THREE.Mesh(geometry, newMaterials);
  cube.position.copy(baseCube.position);
  cube.position.x *= scaleMultiplier - 0.03;
  cube.userData = { speed, letter, hit: false, opacity: 1.0 };
  if (isMobile) cube.scale.set(0.5, 0.5, 0.5);
  scene.add(cube);
  activeCubes.push(cube);
}

// ─── PROCESSARTECLA — lógica central, chamada pelo mobile E pelo desktop ───

function processarTecla(key) {
  const normalizedKey = normalizeKeyForMap(key);
  const note = keyMap[normalizedKey];
  if (!note) return;
  highlightPianoKey(note);
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") ctx.resume();
  if (!piano) return;
  piano.play(note);

  if (modoAtual !== "jogar") return;

  let acertou = false;
  let cuboMaisProximoNaArea = null;
  let menorDistanciaArea = Infinity;

  for (let i = 0; i < activeCubes.length; i++) {
    const cube = activeCubes[i];
    const cubeNote = keyMap[cube.userData.letter];
    const near = Math.abs(cube.position.z - plane2.position.z) < 1;
    if (!cube.userData.hit && cubeNote === note && near) {
      const distancia = Math.abs(cube.position.z - plane2.position.z);
      if (distancia < menorDistanciaArea) {
        menorDistanciaArea = distancia;
        cuboMaisProximoNaArea = cube;
      }
    }
  }

  if (cuboMaisProximoNaArea) {
    cuboMaisProximoNaArea.userData.hit = true;
    acertou = true;
    const letra = cuboMaisProximoNaArea.userData.letter;
    if (Array.isArray(cuboMaisProximoNaArea.material)) {
      cuboMaisProximoNaArea.material.forEach((mat, idx) => {
        if (mat instanceof THREE.MeshStandardMaterial && mat.color) {
          mat.color.set(0x51b79f);
        }
        if (idx === 2 && mat instanceof THREE.MeshBasicMaterial) {
          const novaTextura = loadedTexturesAlt[letra];
          if (novaTextura) {
            mat.map = novaTextura;
            mat.needsUpdate = true;
          }
        }
      });
    }
    const sessaoAtual = sessaoJogo;
    setTimeout(() => {
      if (sessaoAtual !== sessaoJogo) return;
      pontuation = Math.min(PONTUACAO_MAXIMA, pontuation + pontosParaAcerto);
      showPointsAnimation(pontosParaAcerto);
      atualizarPontuacao();
      scene.remove(cuboMaisProximoNaArea);
      const index = activeCubes.indexOf(cuboMaisProximoNaArea);
      if (index !== -1) activeCubes.splice(index, 1);
    }, 400);
  }

  if (!acertou) {
    let cuboMaisProximo = null;
    let menorDistancia = Infinity;
    for (let i = 0; i < activeCubes.length; i++) {
      const cube = activeCubes[i];
      if (!cube.userData.hit && keyMap[cube.userData.letter] === note) {
        const distancia = Math.abs(cube.position.z - plane2.position.z);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          cuboMaisProximo = cube;
        }
      }
    }
    if (cuboMaisProximo) {
      reduzirOpacidadeCubo(cuboMaisProximo);
    } else {
      const penalidade = pontosParaAcerto * 0.1;
      pontuation = Math.max(0, pontuation - penalidade);
      showPointsAnimation(-penalidade);
      atualizarPontuacao();
    }
  }
}

function render() {
  animationId = requestAnimationFrame(render);
  const elapsedTime = performance.now() - startTime - pausedTimeOffset;

  spawnEvents.forEach((event) => {
    if (elapsedTime > event.delay && !event.spawned) {
      spawnCube(event.letter, event.speed);
      event.spawned = true;
    }
  });

  if (startTime && duracaoTotal > 0) {
    const tempoAtual = elapsedTime;
    const progresso = Math.min(tempoAtual / duracaoTotal, 1);
    progressBar.style.width = progresso * 100 + "%";
    if (progresso >= 1) progressContainer.style.display = "none";
  }

  for (let i = activeCubes.length - 1; i >= 0; i--) {
    const cube = activeCubes[i];
    cube.position.z += cube.userData.speed;
    const zAlvo = plane2.position.z;
    const offset = 0.8;

    if (!cube.userData.hit && cube.position.z >= zAlvo - offset) {
      if (modoAtual === "autoplay") {
        cube.userData.hit = true;
        const letra = cube.userData.letter;
        if (Array.isArray(cube.material)) {
          cube.material.forEach((mat, idx) => {
            if (mat instanceof THREE.MeshStandardMaterial && mat.color) {
              mat.color.set(0x51b79f);
            }
            if (idx === 2 && mat instanceof THREE.MeshBasicMaterial) {
              const novaTextura = loadedTexturesAlt[letra];
              if (novaTextura) {
                mat.map = novaTextura;
                mat.needsUpdate = true;
              } else {
                console.warn(
                  `Textura alternativa não encontrada para: ${letra}`,
                );
              }
            }
          });
        }
        const note = keyMap[cube.userData.letter];
        if (note) highlightPianoKey(note);
        if (piano && note) piano.play(note);
        setTimeout(() => {
          if (scene.children.includes(cube)) scene.remove(cube);
          const index = activeCubes.indexOf(cube);
          if (index !== -1) activeCubes.splice(index, 1);
        }, 400);
      }
    }

    if (
      modoAtual === "jogar" &&
      !cube.userData.hit &&
      cube.position.z > zAlvo + 1.5
    ) {
      cube.userData.hit = true;
      const penalidade = pontosParaAcerto * 0.05;
      pontuation = Math.max(0, pontuation - penalidade);
      showPointsAnimation(-penalidade);
      atualizarPontuacao();
      scene.remove(cube);
      activeCubes.splice(i, 1);
    }
  }

  renderer.render(scene, camera);

  if (activeCubes.length === 0 && spawnEvents.every((e) => e.spawned)) {
    if (!fimTimeout) {
      fimTimeout = setTimeout(() => {
        desabilitarTeclado();

        cancelAnimationFrame(animationId);
        animationId = null;
        const canvas = renderer.domElement;
        canvas.style.display = "none";
        const fimDiv = document.getElementById("fimDaCena");
        const pontuacaoFinal = document.getElementById("pontuacaoFinal");
        if (fimDiv) {
          fimDiv.style.display = "flex";
          atualizarEstrelas();
          // esconder elementos de cena que podem aparecer atrás do overlay
          if (typeof plane2 !== "undefined" && plane2) plane2.visible = false;
          if (typeof lines !== "undefined" && Array.isArray(lines))
            lines.forEach((l) => (l.visible = false));
          const pianoGraphic = document.getElementById("pianoGraphic");
          if (pianoGraphic) pianoGraphic.style.display = "none";
          if (modoAtual === "jogar") {
            pontuacaoFinal.style.display = "block";
            animarPontuacaoFinal();
            setTimeout(() => {
              verificarEAdicionarAoRanking().catch(console.error);
            }, 2200);
          } else {
            pontuacaoFinal.style.display = "none";
          }
        }
        document.getElementById("botoesMusica").style.display = "none";
        document.getElementById("pontuacaoContainer").style.display = "none";
        document.getElementById("pontuacaoTitle").style.display = "none";
        document.getElementById("pontuacao").style.display = "none";
        document.getElementById("gameMenu").style.display = "none";
      }, 1000);
    }
  }
}

window.addEventListener("pagehide", () => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
});
window.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (startTime !== null && pauseStartTime === null) {
      pauseStartTime = performance.now();
    }
    return;
  }

  if (pauseStartTime !== null) {
    pausedTimeOffset += performance.now() - pauseStartTime;
    pauseStartTime = null;
  }

  if (
    animationId === null &&
    startTime !== null &&
    (modoAtual === "autoplay" || modoAtual === "jogar")
  ) {
    render();
  }
});

function resetarCena() {
  sessaoJogo += 1;
  pontuation = 0;
  atualizarPontuacao();
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  for (let cube of activeCubes) scene.remove(cube);
  activeCubes.length = 0;
  spawnEvents.length = 0;
  startTime = null;
  pauseStartTime = null;
  pausedTimeOffset = 0;
  fimTimeout = null;
  const rankingEntry = document.getElementById("rankingEntry");
  if (rankingEntry) rankingEntry.remove();
  const fimDiv = document.getElementById("fimDaCena");
  if (fimDiv) fimDiv.style.display = "none";
  const pianoGraphic = document.getElementById("pianoGraphic");
  if (pianoGraphic) pianoGraphic.style.display = "flex";
}

// ─── PIANO VIRTUAL — mobile, sem KeyboardEvent sintético ───
function desabilitarTeclado() {
  const teclado = document.getElementById("pianoVirtual");
  if (teclado) {
    teclado.style.display = "none";
  }
}

function criarPianoVirtual() {
  if (!isMobile) return;

  const linhas = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];

  document.getElementById("pianoVirtual")?.remove();

  const pianoDiv = document.createElement("div");
  pianoDiv.id = "pianoVirtual";
  pianoDiv.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 6px 4px 14px;
        background: #1a1a1c;
        border-top: 1px solid rgba(227,35,202,0.35);
        z-index: 5;
        touch-action: none;
        display: flex;
        flex-direction: column;
        gap: 5px;
    `;

  linhas.forEach((linha) => {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; justify-content: center; gap: 5px;";

    linha.forEach((key) => {
      const btn = document.createElement("button");
      btn.textContent = key.toUpperCase();
      btn.dataset.key = key.toLowerCase();
      btn.style.cssText = `
                flex: 1;
                max-width: 38px;
                height: 42px;
                border-radius: 8px;
                border: none;
                background: #3a3a3e;
                color: #ffffff;
                font-size: 16px;
                font-weight: 500;
                font-family: -apple-system, 'SF Pro Text', Helvetica, sans-serif;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 0 0 #000;
                touch-action: manipulation;
                user-select: none;
                -webkit-user-select: none;
                letter-spacing: 0.5px;
            `;

      btn.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();

          // Feedback visual
          btn.style.background = "#E323CA";
          btn.style.transform = "scale(0.94)";
          setTimeout(() => {
            btn.style.background = "#3a3a3e";
            btn.style.transform = "scale(1)";
          }, 120);

          // Desbloqueia AudioContext se necessário (gesto real)
          const ctx = getAudioContext();
          if (ctx.state === "suspended" || ctx.state === "interrupted")
            ctx.resume();
          processarTecla(key.toLowerCase());
        },
        { passive: false },
      );

      row.appendChild(btn);
    });

    pianoDiv.appendChild(row);
  });

  document.body.appendChild(pianoDiv);

  // calcula altura real do teclado após renderização e ajusta canvas / container
  const alturaEstimada = pianoDiv.getBoundingClientRect().height || 4 * 47 + 20;
  const newCanvasHeight = Math.max(
    0,
    window.innerHeight - alturaEstimada - PIANO_HEIGHT,
  );
  renderer.setSize(window.innerWidth, newCanvasHeight);
  const gameArea = document.getElementById("gameArea");
  if (gameArea) gameArea.style.height = newCanvasHeight + "px";
  renderer.domElement.style.height = newCanvasHeight + "px";
}

function criarPianoGrafico() {
  const pianoDiv = document.getElementById("pianoGraphic");
  if (!pianoDiv) return;
  pianoDiv.innerHTML = "";
  Object.keys(pianoSvgKeys).forEach((pitch) => delete pianoSvgKeys[pitch]);

  const svgNS = "http://www.w3.org/2000/svg";
  const width = 1040;
  const height = 150;
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "100%";

  const noteOrder = ["A", "B", "C", "D", "E", "F", "G"];
  const whiteNotes = [];
  let octave = 0;
  for (let i = 0; whiteNotes.length < 52; i++) {
    const noteName = noteOrder[i % 7];
    whiteNotes.push(`${noteName}${octave}`);
    if (noteName === "B") octave++;
  }

  const whiteWidth = width / whiteNotes.length;
  const blackAfter = { A: true, C: true, D: true, F: true, G: true };

  // criar grupos para controlar a ordem de pintura (brancas primeiro, pretas depois)
  const whitesGroup = document.createElementNS(svgNS, "g");
  const blacksGroup = document.createElementNS(svgNS, "g");
  const blackKeys = [];

  for (let i = 0; i < whiteNotes.length; i++) {
    const note = whiteNotes[i];
    const whiteKey = document.createElementNS(svgNS, "rect");
    whiteKey.setAttribute("x", (i * whiteWidth).toString());
    whiteKey.setAttribute("y", "0");
    whiteKey.setAttribute("width", whiteWidth.toString());
    whiteKey.setAttribute("height", height.toString());
    whiteKey.setAttribute("fill", "#f8f5ee");
    whiteKey.setAttribute("stroke", "#b5ae9d");
    whiteKey.setAttribute("stroke-width", "1");
    whiteKey.classList.add("white-key");
    whiteKey.dataset.note = note;
    whiteKey.dataset.isBlack = "false";
    whitesGroup.appendChild(whiteKey);
    pianoSvgKeys[normalizePitch(note)] = whiteKey;

    const noteName = note.slice(0, -1);
    const noteOctave = Number(note.slice(-1));
    if (blackAfter[noteName] && i < whiteNotes.length - 1) {
      const blackNote = `${noteName}#${noteOctave}`;
      const blackWidth = whiteWidth * 0.72;
      const blackKey = document.createElementNS(svgNS, "rect");
      blackKey.setAttribute(
        "x",
        ((i + 1) * whiteWidth - blackWidth / 2).toString(),
      );
      blackKey.setAttribute("y", "0");
      blackKey.setAttribute("width", blackWidth.toString());
      blackKey.setAttribute("height", (height * 0.58).toString());
      blackKey.setAttribute("rx", "4");
      blackKey.setAttribute("ry", "4");
      blackKey.setAttribute("fill", "#2a2a2a");
      blackKey.setAttribute("stroke", "#3a3a3a");
      blackKey.setAttribute("stroke-width", "1");
      blackKey.classList.add("black-key");
      blackKey.dataset.note = blackNote;
      blackKey.dataset.isBlack = "true";
      blackKeys.push({ key: blackKey, pitch: normalizePitch(blackNote) });
    }
  }

  // anexa brancas primeiro, depois pretas para garantir sobreposição correta
  svg.appendChild(whitesGroup);
  for (const { key, pitch } of blackKeys) {
    blacksGroup.appendChild(key);
    pianoSvgKeys[pitch] = key;
  }
  svg.appendChild(blacksGroup);

  pianoDiv.appendChild(svg);
}

function atualizarPontuacao() {
  if (pontuacao) {
    pontuacao.textContent = `000${Math.floor(pontuation)}`;
  }
  const pontuacaoBar = document.getElementById("pontuacaoBar");
  if (pontuacaoBar) {
    const percentual = (pontuation / PONTUACAO_MAXIMA) * 100;
    pontuacaoBar.style.width = percentual + "%";
  }
}

function animarPontuacaoFinal() {
  desabilitarTeclado();

  const pontuacaoFinal = document.getElementById("pontuacaoFinal");
  const pontuacaoMaxima = Math.floor(pontuation);
  const duracao = 2000;
  const inicio = performance.now();
  function animar(agora) {
    const decorrido = agora - inicio;
    const progresso = Math.min(decorrido / duracao, 1);
    pontuacaoFinal.textContent = Math.floor(progresso * pontuacaoMaxima);
    if (progresso < 1) requestAnimationFrame(animar);
  }
  requestAnimationFrame(animar);
}

function atualizarEstrelas() {
  const estrelas = document.querySelector(".estrelas");
  const fraseMotivacao = document.getElementById("fraseMotivacao");
  if (modoAtual === "autoplay") {
    if (estrelas) estrelas.style.display = "none";
    if (fraseMotivacao) fraseMotivacao.style.display = "none";
    return;
  }
  if (estrelas) estrelas.style.display = "block";
  if (fraseMotivacao) fraseMotivacao.style.display = "block";
  const estrelasSpans = document.querySelectorAll(".estrelas span");
  const pontuacaoAtual = Math.floor(pontuation);
  let quantidadeEstrelas = 1;
  let frase = "Bom trabalho!";
  if (pontuacaoAtual < 700) {
    quantidadeEstrelas = 1;
    frase = "Boa tentativa. Continue praticando!";
  } else if (pontuacaoAtual < 850) {
    quantidadeEstrelas = 2;
    frase = "Excelente desempenho. Você está quase lá!";
  } else {
    quantidadeEstrelas = 3;
    frase = "Perfeito! Você é um maestro!";
  }
  estrelasSpans.forEach((estrela, index) => {
    estrela.textContent = index < quantidadeEstrelas ? "★" : "☆";
  });
  if (fraseMotivacao) fraseMotivacao.textContent = frase;
}

function showPointsAnimation(points) {
  const roundedPoints = Math.round(points);
  if (roundedPoints === 0) return;
  const pontosDiv = document.createElement("div");
  pontosDiv.className = `floating-points ${roundedPoints >= 0 ? "positive" : "negative"}`;
  pontosDiv.textContent =
    roundedPoints >= 0 ? `+${roundedPoints}` : `${roundedPoints}`;
  pontosDiv.style.left = Math.random() * (window.innerWidth - 200) + 100 + "px";
  pontosDiv.style.top = window.innerHeight * 0.3 + Math.random() * 200 + "px";
  document.body.appendChild(pontosDiv);
  setTimeout(() => pontosDiv.remove(), 2000);
}

function atualizarOpacidadeCubo(cube) {
  if (Array.isArray(cube.material)) {
    cube.material.forEach((mat) => {
      if (
        mat instanceof THREE.MeshStandardMaterial ||
        mat instanceof THREE.MeshBasicMaterial
      ) {
        mat.opacity = cube.userData.opacity;
        mat.transparent = true;
        mat.needsUpdate = true;
      }
    });
  }
}

function reduzirOpacidadeCubo(cube) {
  cube.userData.opacity = Math.max(0, cube.userData.opacity - 1 / 3);
  atualizarOpacidadeCubo(cube);
  if (cube.userData.opacity <= 0.05) {
    scene.remove(cube);
    const index = activeCubes.indexOf(cube);
    if (index !== -1) activeCubes.splice(index, 1);
  }
}
console.log(pitchToKey["C4"]); 
console.log(allCubes["a"]); 
const canvas = renderer.domElement;
const resetar = document.getElementById("resetarButton");
const voltar = document.getElementById("voltarButton");
const pontuacao = document.getElementById("pontuacao");
const gameMenu = document.getElementById("gameMenu");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const autoplayButton = document.getElementById("autoplayButton");
const jogarButton = document.getElementById("jogarButton");

const nomesDasMusicas = {
  littlestar: "Twinkle, Twinkle, Little Star - Unknown artist",
  jinglebell: "Jingle Bell Rock - Bobby Helms",
  elvis: "Beethoven - Für Elise",
  bethoven: "Bethoven - Ode á Alegria",
  tchai: "Tchaikovsky - Lago dos Cisnes",
};

function obterNomeDaMusica(musicaKey) {
  return nomesDasMusicas[musicaKey] || "Música";
}

const musicaArmazenada = localStorage.getItem("musica") || "elvis";
const modoArmazenado = localStorage.getItem("modo") || "autoplay";
modoMusica = localStorage.getItem("modoMusica") || "jogador";
musica = musicaArmazenada;
multiplicadorTempo = modoMusica === "aprendiz" ? 1.428571 : 1;

if (animationId !== null) {
  cancelAnimationFrame(animationId);
  animationId = null;
}

voltar.addEventListener("click", () => {
  modoAtual = null;
  progressContainer.style.display = "none";
  pontuacao.style.display = "none";
  document.getElementById("pontuacaoContainer").style.display = "none";
  document.getElementById("gameMenu").style.display = "none";
  document.getElementById("nomeDaMusica").style.display = "none";
  document.getElementById("botoesMusica").style.display = "none";
  document.getElementById("botoesJogar").classList.remove("ativo");
  document.getElementById("botoesAutoplay").classList.remove("ativo");
  canvas.style.display = "none";
  window.location.href = "selector.html";
});

autoplayButton.addEventListener("click", () => {
  if (modoAtual === "autoplay") return;
  desabilitarTeclado();

  progressBar.style.width = "0%";
  progressContainer.style.display = "flex";
  pontuacao.style.display = "none";
  document.getElementById("pontuacaoContainer").style.display = "none";
  document.getElementById("pontuacaoTitle").style.display = "none";
  document.getElementById("gameMenu").style.display = "flex";
  document.getElementById("nomeDaMusica").textContent =
    obterNomeDaMusica(musica);
  document.getElementById("nomeDaMusica").style.display = "block";
  document.getElementById("botoesMusica").style.display = "flex";
  document.getElementById("botoesAutoplay").classList.add("ativo");
  document.getElementById("botoesJogar").classList.remove("ativo");
  canvas.style.display = "inline";

  modoAtual = "autoplay";
  pontuation = 0;
  atualizarPontuacao();
  resetarCena();
  carregarPartituraAtual();
  pauseStartTime = null;
  pausedTimeOffset = 0;

  if (teclaListener) {
    document.removeEventListener("keydown", teclaListener);
    teclaListener = null;
  }
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") ctx.resume();
  if (!pianoLoaded) {
    Soundfont.instrument(getAudioContext(), "acoustic_grand_piano", {
      gain: 1.5,
    }).then((loadedPiano) => {
      piano = loadedPiano;
      pianoLoaded = true;
      startTime = performance.now();
      render();
    });
  } else {
    startTime = performance.now();
    render();
  }
});

function iniciarPartidaJogo() {
  criarPianoVirtual();

  document.getElementById("gameMenu").style.display = "flex";
  pontuacao.style.display = "block";
  document.getElementById("nomeDaMusica").textContent =
    obterNomeDaMusica(musica);
  document.getElementById("nomeDaMusica").style.display = "block";
  canvas.style.display = "inline";
  progressBar.style.width = "0%";
  progressContainer.style.display = "flex";
  document.getElementById("pontuacaoContainer").style.display = "block";
  document.getElementById("pontuacaoTitle").style.display = "block";
  document.getElementById("botoesMusica").style.display = "flex";
  document.getElementById("botoesJogar").classList.add("ativo");
  document.getElementById("botoesAutoplay").classList.remove("ativo");

  modoAtual = "jogar";
  pontuation = 0;
  atualizarPontuacao();
  resetarCena();
  carregarPartituraAtual();
  pauseStartTime = null;
  pausedTimeOffset = 0;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (teclaListener) document.removeEventListener("keydown", teclaListener);

  teclaListener = (e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    processarTecla(e.key.toLowerCase());
  };
  document.addEventListener("keydown", teclaListener);

  const ctx = getAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") ctx.resume();
  if (!pianoLoaded) {
    Soundfont.instrument(getAudioContext(), "acoustic_grand_piano", {
      gain: 1.5,
    }).then((loadedPiano) => {
      piano = loadedPiano;
      pianoLoaded = true;
      startTime = performance.now();
      render();
    });
  } else {
    startTime = performance.now();
    render();
  }
}

function mostrarFormularioNomeJogador(callback) {
  const modal = document.getElementById("nomeJogadorModal");
  const input = document.getElementById("nomeJogadorInput");
  const btn = document.getElementById("nomeJogadorConfirmarBtn");
  if (!modal || !input || !btn) return callback();

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  resetarCena();

  const nomeAtual = (localStorage.getItem("rankingNomeUsuario") || "").trim();
  if (nomeAtual) {
    localStorage.setItem("rankingNomeUsuario", nomeAtual.slice(0, MAX_USUARIO_LENGTH));
    callback(nomeAtual);
    return;
  }

  modal.style.display = "flex";
  input.value = "";
  input.style.borderColor = "";
  input.focus();
  input.select();

  const confirmar = () => {
    const nome = input.value.trim();
    if (!nome) {
      input.style.borderColor = "red";
      return;
    }
    const nomeFormatado = nome.slice(0, MAX_USUARIO_LENGTH);
    localStorage.setItem("rankingNomeUsuario", nomeFormatado);
    modal.style.display = "none";
    callback(nomeFormatado);
  };

  btn.onclick = confirmar;
  input.onkeydown = (event) => {
    if (event.key === "Enter") confirmar();
  };
}

jogarButton.addEventListener("click", () => {
  if (modoAtual === "jogar") return;

  const iniciar = () => {
    iniciarPartidaJogo();
  };

  const nomeSalvo = (localStorage.getItem("rankingNomeUsuario") || "").trim();
  if (!nomeSalvo) {
    mostrarFormularioNomeJogador(iniciar);
    return;
  }

  iniciar();
});

resetar.addEventListener("click", () => {
  resetarCena();
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (teclaListener) {
    document.removeEventListener("keydown", teclaListener);
    teclaListener = null;
  }

  carregarPartituraAtual();
  pauseStartTime = null;
  pausedTimeOffset = 0;

  if (modoAtual === "jogar") {
    teclaListener = (e) => {
      if (document.activeElement?.tagName === "INPUT") return;
      processarTecla(e.key.toLowerCase());
    };
    document.addEventListener("keydown", teclaListener);
  }

  const ctx = getAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") ctx.resume();
  if (!pianoLoaded) {
    Soundfont.instrument(getAudioContext(), "acoustic_grand_piano", {
      gain: 1.5,
    }).then((loadedPiano) => {
      piano = loadedPiano;
      pianoLoaded = true;
      startTime = performance.now();
      render();
    });
  } else {
    startTime = performance.now();
    render();
  }
});

// ─── Helper partitura ───────────────────────────────────────

function carregarPartituraAtual() {
  if (musica === "bethoven") carregarPartituraOdeToJoy();
  else if (musica === "tchai") carregarPartituraCisne();
  else if (musica === "littlestar") carregarPartituraTwinkle();
  else if (musica === "jinglebell") carregarPartituraJingleBell();
  else carregarPartituraFurElise();
}

for (const [key, pitch] of Object.entries(keyMap))
  pitchToKey[normalizePitch(pitch)] = key;

function carregarNotas(notes) {
  for (const note of notes) {
    const key = pitchToKey[note.pitch];
    if (!key) {
      console.warn(`⚠️ Sem mapeamento: ${note.pitch}`);
      continue;
    }
    addCubeToScene(key, note.start_ms, VELOCIDADE_CUBO);
  }
  aplicarMultiplicadorTempo();
  totalNotas = spawnEvents.length;
  pontosParaAcerto = PONTUACAO_MAXIMA / totalNotas;
  duracaoTotal = Math.max(...spawnEvents.map((e) => e.delay)) + 5000;
}

function carregarPartituraFurElise() {
  carregarNotas(notasJson);
}
function carregarPartituraCisne() {
  carregarNotas(lagoJson);
}
function carregarPartituraTwinkle() {
  carregarNotas(littlestar);
}
function carregarPartituraOdeToJoy() {
  carregarNotas(odeToJoy);
}
function carregarPartituraJingleBell() {
  carregarNotas(jinglebell);
}

// ─── Ranking ─────────────────────────────────────────────────

function obterIdentificadorUnico() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

const MAX_USUARIO_LENGTH = 15;
const MAX_RANKING = 10;
const DATA_INICIAL_RANKING = "26/08/2026";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[Supabase] Variáveis de ambiente faltando.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let rankingCache = null;

function getRankingKey(musicaKey, modoMusica) {
  return `${musicaKey}_jogar_${modoMusica}`;
}

function obterChaveData(data) {
  const [dia, mes, ano] = String(data || "").split("/");
  if (!dia || !mes || !ano) return "";
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

async function carregarRankingGlobal() {
  if (rankingCache) return rankingCache;
  try {
    const { data, error } = await supabase.from("rankings").select("*");
    if (error) {
      console.error("Erro ao carregar ranking:", error);
      return {};
    }
    rankingCache = {};
    const dataMinima = obterChaveData(DATA_INICIAL_RANKING);
    if (data) {
      data.forEach((row) => {
        if (obterChaveData(row.data) < dataMinima) return;
        const key = getRankingKey(row.musica, row.modo);
        if (!rankingCache[key]) rankingCache[key] = [];
        rankingCache[key].push({
          id: row.id,
          nome: row.nome,
          pontuacao: row.pontuacao,
          data: row.data,
          dispositivo_movel: row.dispositivo_movel ?? false,
          device_id: row.device_id ?? null, // ← novo
        });
      });
      Object.keys(rankingCache).forEach((key) => {
        rankingCache[key].sort((a, b) => b.pontuacao - a.pontuacao);
      });
    }
    return rankingCache;
  } catch (err) {
    console.error(err);
    return {};
  }
}


async function salvarRankingGlobal(dados) {
  rankingCache = dados;
  try {
    const registros = [];
    Object.entries(dados).forEach(([key, lista]) => {
      const [mus, , modo] = key.split("_");
      lista.forEach((item) => {
        const r = {
          musica: mus,
          modo,
          nome: item.nome,
          pontuacao: item.pontuacao,
          data: item.data,
          dispositivo_movel: item.dispositivo_movel ?? false,
          device_id: item.device_id ?? null, // ← novo
        };
        if (item.id != null) r.id = item.id;
        registros.push(r);
      });
    });
    const inserir = registros.filter((r) => r.id == null);
    const atualizar = registros.filter((r) => r.id != null);
    if (atualizar.length)
      await supabase.from("rankings").upsert(atualizar, { onConflict: ["id"] });
    if (inserir.length) await supabase.from("rankings").insert(inserir);
  } catch (err) {
    console.error(err);
  }
}

async function carregarRanking(musicaKey, modoMusica) {
  const dados = await carregarRankingGlobal();
  return dados[getRankingKey(musicaKey, modoMusica)] || [];
}

async function inserirNoRanking(nome, pontuacaoAtual, musicaKey, modoMusica) {
  const nomeTrimmed = (nome || "").trim().slice(0, MAX_USUARIO_LENGTH);
  if (!nomeTrimmed) return null;

  const dados = await carregarRankingGlobal();
  const key = getRankingKey(musicaKey, modoMusica);
  const lista = dados[key] || [];
  const nomeLower = nomeTrimmed.toLowerCase();
  const deviceId = obterIdentificadorUnico();

  const novaEntrada = {
    nome: nomeTrimmed,
    pontuacao: Math.floor(pontuacaoAtual),
    data: new Date().toLocaleDateString("pt-BR"),
    dispositivo_movel: isMobile,
    device_id: deviceId,
    // sem id → sempre insert como nova tentativa
  };

  lista.push(novaEntrada); // ← sempre adiciona, sem verificar duplicata por nome
  lista.sort((a, b) => b.pontuacao - a.pontuacao);
  dados[key] = lista;
  rankingCache = dados;

  await salvarRankingGlobal(dados);

  // Recarrega do banco para pegar o id real gerado
  rankingCache = null;
  const listaAtualizada = await carregarRanking(musicaKey, modoMusica);

  return (
    listaAtualizada.findIndex((e) => e.nome.toLowerCase() === nomeLower) + 1
  );
}
async function exibirListaRanking(nomeDestaque, listaJaCarregada = null) {
  const listaFull = listaJaCarregada || [];
  const listaDiv = document.getElementById("rankingLista");
  if (!listaDiv) return;
  if (listaFull.length === 0) {
    listaDiv.innerHTML =
      '<p style="color:rgba(255,255,255,0.3);font-size:0.5rem;text-align:center;">Nenhuma pontuação ainda.</p>';
    return;
  }
  // Only show the top MAX_RANKING entries in the UI
  const lista = listaFull.slice(0, MAX_RANKING);
  let html = '<ol id="rankingOl">';
  lista.forEach((entry, i) => {
    const destaque =
      entry.nome.toLowerCase() === nomeDestaque.toLowerCase()
        ? " ranking-destaque"
        : "";
    html += `<li class="ranking-item${destaque}">
            <span class="ranking-pos">${i + 1}º</span>
            <span class="ranking-nome">${entry.nome}</span>
            <span class="ranking-pts">${entry.pontuacao}</span>
            <span class="ranking-data">${entry.data}</span>
        </li>`;
  });
  html += "</ol>";
  listaDiv.innerHTML = html;
}

function criarContainerRanking(msgHtml, incluirFormulario) {
  if (document.getElementById("rankingEntry")) return false;
  const fimDiv = document.getElementById("fimDaCena");
  const botoesDiv = document.getElementById("fimDaCena-buttons");
  if (!fimDiv || !botoesDiv) return false;
  const rankingDiv = document.createElement("div");
  rankingDiv.id = "rankingEntry";
  rankingDiv.innerHTML = `
        <p id="rankingMsg">${msgHtml}</p>
        ${
          incluirFormulario
            ? `<div id="rankingInputWrapper">
            <input type="text" id="rankingNomeInput" maxlength="${MAX_USUARIO_LENGTH}"
                placeholder="Seu nome" autocomplete="off" />
            <button id="rankingConfirmarBtn">Confirmar</button>
        </div>`
            : ""
        }
        <div id="rankingLista"><p style="color:rgba(255,255,255,0.3);font-size:0.5rem;text-align:center;">Carregando...</p></div>
    `;
  fimDiv.insertBefore(rankingDiv, botoesDiv);
  return true;
}

function exibirFormularioRanking(posicao, nomePreenchido = null) {
  if (!criarContainerRanking("", false)) return;

  const modo = localStorage.getItem("modoMusica") || "jogador";
  carregarRanking(musica, modo)
    .then((listaNova) => exibirListaRanking(nomePreenchido || "", listaNova))
    .catch(console.error);
}

async function verificarEAdicionarAoRanking() {
  if (modoAtual !== "jogar") return;
  const pontuacaoAtual = Math.floor(pontuation);
  if (pontuacaoAtual <= 0) return;

  const nome = (localStorage.getItem("rankingNomeUsuario") || "").trim();
  if (!nome) return;

  rankingCache = null;
  const modo = localStorage.getItem("modoMusica") || "jogador";
  try {
    const lista = await carregarRanking(musica, modo);
    const cabe =
      lista.length < MAX_RANKING ||
      pontuacaoAtual > lista[lista.length - 1].pontuacao;

    if (!cabe) {
      rankingCache = null;
      return;
    }

    const pos = await inserirNoRanking(nome, pontuacaoAtual, musica, modo);
    const listaNova = await carregarRanking(musica, modo);
    exibirFormularioRanking(pos, nome);
    await exibirListaRanking(nome, listaNova);
    rankingCache = null;
  } catch (err) {
    console.error(err);
  }
}
