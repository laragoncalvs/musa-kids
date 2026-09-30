import Soundfont from "soundfont-player";
import * as THREE from "three";
import {
  DEFAULT_OCTAVE,
  buildKeyMap,
  normalizePitchOctave,
} from "./keyMap.js";
import { allCubes } from "./cubes.js";
import { loadedTexturesAlt } from "./cubes.js";

const partiturasDisponiveis = Object.fromEntries(
  Object.entries(import.meta.glob("./partituras/*.json", { eager: true })).map(
    ([path, mod]) => [path.replace("./partituras/", "").replace(".json", ""), mod.default ?? mod],
  ),
);

const notasJson = partiturasDisponiveis.furelise ?? [];
const lagoJson = partiturasDisponiveis.lago ?? [];
const littlestar = partiturasDisponiveis.littlestar ?? [];
const jinglebell = partiturasDisponiveis.jinglebell ?? [];
const odeToJoy = partiturasDisponiveis.ode ?? [];

let audioContext = null;
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}
const pitchToKey = {};
const OCTAVE_SEQUENCE = [4, 2, 7];
const TEMPO_SEQUENCE = [
  { label: "padrão", multiplier: 1.5 },
  { label: "devagar", multiplier: 2.2 },
  { label: "rápido", multiplier: 0.8 },
];
const FASE_JOGO = localStorage.getItem("faseJogo") === "andamento"
  ? "andamento"
  : "oitavas";
const MAX_TENTATIVAS_POR_ETAPA = 5;
const META_PONTUACAO = 800;
let octaveAtual = FASE_JOGO === "andamento"
  ? OCTAVE_SEQUENCE[0]
  : Number(localStorage.getItem("octave") || OCTAVE_SEQUENCE[0]);
let activeKeyMap = buildKeyMap(octaveAtual);
let tentativasPorEtapa = [0, 0, 0];
let faseEtapaIndex = 0;
let fatorTempoPartitura = 1;
let faseEmAndamento = false;

let piano = null;
let pianoLoaded = false;
let pianoLoadingPromise = null;
let modoAtual = null;
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
criarPianoGrafico();
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

function rebuildPitchToKey() {
  Object.keys(pitchToKey).forEach((pitch) => delete pitchToKey[pitch]);
  for (const [key, pitch] of Object.entries(activeKeyMap)) {
    const norm = normalizePitch(pitch);
    if (pitchToKey[norm] !== undefined) {
      colisoes.push({ pitch: norm, teclas: [pitchToKey[norm], key] });
    }
    pitchToKey[norm] = key;
  }
}

rebuildPitchToKey();

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
const PIANO_HEIGHT = isMobile || FASE_JOGO === "andamento" ? 0 : 170;
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


const scaleMultiplier = isMobile ? 0.45 : 1;
const planeGeometry2 = new THREE.PlaneGeometry(10 * scaleMultiplier, 2);
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
  { length: 8 },
  (_, i) => new THREE.Mesh(lineGeometry, lineMaterial),
);
lines.forEach((line, i) => {
  line.rotation.x = -Math.PI / 2;
  line.position.x =
    [ 0.7, -0.7, 2, -2, 3.5, -3.5, 5, -5][i] *
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
const VELOCIDADE_CUBO = 0.08;

function addCubeToScene(letter, delay, speed) {
  spawnEvents.push({ letter, delay, speed, spawned: false });
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
  const note = activeKeyMap[normalizedKey];
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
    const cubeNote = activeKeyMap[cube.userData.letter];
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
      if (!cube.userData.hit && activeKeyMap[cube.userData.letter] === note) {
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
        const fasePassou = pontuation > META_PONTUACAO;
        const atingiuLimite = tentativasPorEtapa[faseEtapaIndex] >= MAX_TENTATIVAS_POR_ETAPA;

        if (faseEmAndamento && !fasePassou && !atingiuLimite) {
          finalizarFaseAtual();
          return;
        }

        const quantidadeEtapas = FASE_JOGO === "oitavas"
          ? OCTAVE_SEQUENCE.length
          : TEMPO_SEQUENCE.length;
        if (faseEmAndamento && fasePassou && faseEtapaIndex < quantidadeEtapas - 1) {
          finalizarFaseAtual();
          return;
        }

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
          if (typeof plane2 !== "undefined" && plane2) plane2.visible = false;
          if (typeof lines !== "undefined" && Array.isArray(lines))
            lines.forEach((l) => (l.visible = false));
          const pianoGraphic = document.getElementById("pianoGraphic");
          if (pianoGraphic) pianoGraphic.style.display = "none";
          pontuacaoFinal.style.display = "block";
          animarPontuacaoFinal();
        }
        abrirPosTeste();
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
    modoAtual === "jogar"
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
  const fimDiv = document.getElementById("fimDaCena");
  if (fimDiv) fimDiv.style.display = "none";
  const pianoGraphic = document.getElementById("pianoGraphic");
  if (pianoGraphic) {
    pianoGraphic.style.display = FASE_JOGO === "andamento" ? "none" : "flex";
  }
}

function atualizarEstadoFase() {
  const nome = obterNomeDaMusica(musica);
  const elemento = document.getElementById("nomeDaMusica");
  if (elemento) {
    const etapa = FASE_JOGO === "oitavas"
      ? `${octaveAtual}ª oitava`
      : `Andamento ${TEMPO_SEQUENCE[faseEtapaIndex].label}`;
    elemento.textContent = `${nome} • ${etapa}`;
  }
}

function iniciarFaseAtual() {
  faseEmAndamento = true;
  if (FASE_JOGO === "oitavas") {
    octaveAtual = OCTAVE_SEQUENCE[faseEtapaIndex];
    fatorTempoPartitura = 1;
  } else {
    octaveAtual = OCTAVE_SEQUENCE[0];
    fatorTempoPartitura = TEMPO_SEQUENCE[faseEtapaIndex].multiplier;
  }
  activeKeyMap = buildKeyMap(octaveAtual);
  localStorage.setItem("octave", String(octaveAtual));
  rebuildPitchToKey();
  criarPianoGrafico();
  resetarCena();
  carregarPartituraAtual();
  atualizarEstadoFase();

  startTime = performance.now();
  pauseStartTime = null;
  pausedTimeOffset = 0;
  fimTimeout = null;

  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;

  if (!pianoLoaded) {
    Soundfont.instrument(getAudioContext(), "acoustic_grand_piano", {
      gain: 1.5,
    }).then((loadedPiano) => {
      piano = loadedPiano;
      pianoLoaded = true;
      render();
    });
    return;
  }

  render();
}

function mostrarAvisoEtapa(index, aoFechar) {
  const modal = document.getElementById("avisoOitavaModal");
  const conteudo = document.getElementById("avisoOitavaConteudo");
  const mensagensOitavas = {
    2: "Agora vamos para a 2ª oitava. Ela é mais grave.",
    4: "Vamos começar pela 4ª oitava. Ela fica bem no centro do piano.",
    7: "Agora vamos para a 7ª oitava. Ela é mais aguda.",
  };
  const mensagensAndamento = [
    "Vamos começar no andamento padrão.",
    "Agora vamos tocar mais devagar.",
    "Agora vamos tocar mais rápido.",
  ];

  if (!modal || !conteudo) {
    aoFechar();
    return;
  }

  conteudo.textContent = FASE_JOGO === "oitavas"
    ? mensagensOitavas[OCTAVE_SEQUENCE[index]]
    : mensagensAndamento[index];
  modal.style.display = "flex";
  window.setTimeout(() => {
    modal.style.display = "none";
    aoFechar();
  }, 2200);
}

function finalizarFaseAtual() {
  const tentativasAtuais = tentativasPorEtapa[faseEtapaIndex] + 1;
  tentativasPorEtapa[faseEtapaIndex] = tentativasAtuais;
  const quantidadeEtapas = FASE_JOGO === "oitavas"
    ? OCTAVE_SEQUENCE.length
    : TEMPO_SEQUENCE.length;

  if (pontuation > META_PONTUACAO) {
    if (faseEtapaIndex < quantidadeEtapas - 1) {
      faseEtapaIndex += 1;
      mostrarAvisoEtapa(faseEtapaIndex, iniciarFaseAtual);
      return;
    }

    faseEmAndamento = false;
    return;
  }

  if (tentativasAtuais >= MAX_TENTATIVAS_POR_ETAPA) {
    faseEmAndamento = false;
    return;
  }

  setTimeout(() => {
    iniciarFaseAtual();
  }, 1200);
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
  if (FASE_JOGO === "andamento") {
    pianoDiv.style.display = "none";
    return;
  }
  pianoDiv.style.display = "flex";

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
    const noteName = note.slice(0, -1);
    const noteOctave = Number(note.slice(-1));
    const whiteKey = document.createElementNS(svgNS, "rect");
    whiteKey.setAttribute("x", (i * whiteWidth).toString());
    whiteKey.setAttribute("y", "0");
    whiteKey.setAttribute("width", whiteWidth.toString());
    whiteKey.setAttribute("height", height.toString());
    whiteKey.setAttribute("fill", "#f8f5ee");
    whiteKey.setAttribute("stroke", "#b5ae9d");
    whiteKey.setAttribute("stroke-width", "1");
    whiteKey.classList.add("white-key");
    if (noteOctave === octaveAtual) whiteKey.classList.add("current-octave");
    whiteKey.dataset.note = note;
    whiteKey.dataset.isBlack = "false";
    whitesGroup.appendChild(whiteKey);
    pianoSvgKeys[normalizePitch(note)] = whiteKey;

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
      if (noteOctave === octaveAtual) blackKey.classList.add("current-octave");
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
const preTesteModal = document.getElementById("preTesteModal");
const preTesteIniciarBtn = document.getElementById("preTesteIniciarBtn");
const preTesteForm = document.getElementById("preTesteForm");
const preTesteProgresso = document.getElementById("preTesteProgresso");
const preTesteTitulo = document.getElementById("preTesteTitulo");
const perguntasPreTeste = Array.from(
  document.querySelectorAll("[data-pretest-question]"),
);

const respostasPreTeste = {
  q1: null,
  q2: null,
  q3: null,
};
const respostasPosTeste = {
  q1: null,
  q2: null,
  q3: null,
};
let respostasQuestionarioAtual = respostasPreTeste;
let questionarioAtual = "pre";
let perguntaAtualIndex = 0;

function configurarPerguntasDaFase() {
  if (FASE_JOGO === "andamento") {
    perguntasPreTeste[0].innerHTML = `
      <p>Questão 1: Esse andamento está rápido ou devagar?</p>
      <div class="preteste-controls">
        <button class="preteste-play" data-sequence="C4,E4,G4,C5" data-interval="0.28" type="button" aria-label="Reproduzir sequência rápida" title="Reproduzir sequência"><span aria-hidden="true">&#9654;</span></button>
      </div>
      <div class="preteste-opcoes">
        <button class="preteste-option" data-question="q1" data-answer="rapido" type="button">rápido</button>
        <button class="preteste-option" data-question="q1" data-answer="devagar" type="button">devagar</button>
        <button class="preteste-option" data-question="q1" data-answer="medio" type="button">médio</button>
        <button class="preteste-option" data-question="q1" data-answer="nao-sei" type="button">não sei</button>
      </div>`;
    perguntasPreTeste[1].innerHTML = `
      <p>Questão 2: O segundo som está mais rápido que o primeiro?</p>
      <div class="preteste-controls">
        <div class="preteste-audio-item"><span>Primeiro</span><button class="preteste-play" data-sequence="C4,D4,E4" data-interval="0.62" type="button" aria-label="Reproduzir primeiro som" title="Reproduzir primeiro som"><span aria-hidden="true">&#9654;</span></button></div>
        <span aria-hidden="true">e</span>
        <div class="preteste-audio-item"><span>Segundo</span><button class="preteste-play" data-sequence="G4,A4,B4" data-interval="0.28" type="button" aria-label="Reproduzir segundo som" title="Reproduzir segundo som"><span aria-hidden="true">&#9654;</span></button></div>
      </div>
      <div class="preteste-opcoes">
        <button class="preteste-option" data-question="q2" data-answer="mais-rapido" type="button">mais rápido</button>
        <button class="preteste-option" data-question="q2" data-answer="mais-devagar" type="button">mais devagar</button>
        <button class="preteste-option" data-question="q2" data-answer="igual" type="button">igual</button>
        <button class="preteste-option" data-question="q2" data-answer="nao-sei" type="button">não sei</button>
      </div>`;
    perguntasPreTeste[2].innerHTML = `
      <p>Questão 3: Essas sequências têm o mesmo andamento?</p>
      <div class="preteste-controls">
        <div class="preteste-audio-item"><span>Sequência A</span><button class="preteste-play" data-sequence="C4,E4,G4" data-interval="0.42" type="button" aria-label="Reproduzir sequência A" title="Reproduzir sequência A"><span aria-hidden="true">&#9654;</span></button></div>
        <span aria-hidden="true">e</span>
        <div class="preteste-audio-item"><span>Sequência B</span><button class="preteste-play" data-sequence="G3,B3,D4" data-interval="0.42" type="button" aria-label="Reproduzir sequência B" title="Reproduzir sequência B"><span aria-hidden="true">&#9654;</span></button></div>
      </div>
      <div class="preteste-opcoes">
        <button class="preteste-option" data-question="q3" data-answer="sim" type="button">sim</button>
        <button class="preteste-option" data-question="q3" data-answer="nao" type="button">não</button>
        <button class="preteste-option" data-question="q3" data-answer="nao-sei" type="button">não sei</button>
      </div>`;
  }

  if (preTesteTitulo) {
    preTesteTitulo.textContent = FASE_JOGO === "andamento"
      ? "Pré-teste de andamento"
      : "Pré-teste de oitavas";
  }
}

configurarPerguntasDaFase();

async function obterPianoPreTeste() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || ctx.state === "interrupted") {
    await ctx.resume();
  }

  if (pianoLoaded && piano) return piano;
  if (!pianoLoadingPromise) {
    pianoLoadingPromise = Soundfont.instrument(ctx, "acoustic_grand_piano", {
      gain: 1.5,
    }).then((loadedPiano) => {
      piano = loadedPiano;
      pianoLoaded = true;
      return piano;
    }).finally(() => {
      pianoLoadingPromise = null;
    });
  }
  return pianoLoadingPromise;
}

async function tocarNotaPreTeste(pitch, when = getAudioContext().currentTime) {
  const instrumento = await obterPianoPreTeste();
  instrumento.play(pitch, when, { duration: 0.5 });
}

async function tocarSequenciaPreTeste(notas, intervalo = 0.65) {
  const sequencia = (notas || "").split(",").map((note) => note.trim()).filter(Boolean);
  if (!sequencia.length) return;

  const instrumento = await obterPianoPreTeste();
  const inicio = getAudioContext().currentTime + 0.05;
  const duracao = Math.min(0.55, intervalo * 0.9);
  sequencia.forEach((nota, index) => {
    instrumento.play(nota, inicio + index * intervalo, { duration: duracao });
  });
}

function atualizarBotaoInicioPreTeste() {
  perguntasPreTeste.forEach((pergunta, index) => {
    pergunta.hidden = index !== perguntaAtualIndex;
  });
  const chavePerguntaAtual = perguntasPreTeste[perguntaAtualIndex]?.dataset.pretestQuestion;
  const respostaSelecionada = Boolean(respostasQuestionarioAtual[chavePerguntaAtual]);
  const ultimaPergunta = perguntaAtualIndex === perguntasPreTeste.length - 1;

  if (preTesteProgresso) {
    preTesteProgresso.textContent = `Questão ${perguntaAtualIndex + 1} de ${perguntasPreTeste.length}`;
  }
  if (preTesteIniciarBtn) {
    preTesteIniciarBtn.hidden = !respostaSelecionada;
    preTesteIniciarBtn.textContent = ultimaPergunta
      ? questionarioAtual === "pre" ? "Iniciar jogo" : "Concluir"
      : "Avançar";
  }
}

function registrarRespostaPreTeste(pergunta, resposta) {
  respostasQuestionarioAtual[pergunta] = resposta;
  const botoes = document.querySelectorAll(`[data-question="${pergunta}"]`);
  botoes.forEach((botao) => {
    const selecionado = botao.dataset.answer === resposta;
    botao.classList.toggle("selecionado", selecionado);
  });
  atualizarBotaoInicioPreTeste();
}

function prepararQuestionario(titulo, textoBotao) {
  respostasQuestionarioAtual = questionarioAtual === "pre"
    ? respostasPreTeste
    : respostasPosTeste;
  perguntaAtualIndex = 0;
  perguntasPreTeste.forEach((pergunta) => {
    pergunta.hidden = pergunta.dataset.pretestQuestion !== "q1";
  });
  document.querySelectorAll(".preteste-option.selecionado").forEach((botao) => {
    botao.classList.remove("selecionado");
  });
  if (preTesteTitulo) preTesteTitulo.textContent = titulo;
  if (preTesteIniciarBtn) {
    preTesteIniciarBtn.textContent = textoBotao || "Avançar";
    preTesteIniciarBtn.hidden = true;
  }
  if (preTesteProgresso) preTesteProgresso.textContent = "Questão 1 de 3";
}

function abrirPosTeste() {
  questionarioAtual = "pos";
  prepararQuestionario(
    FASE_JOGO === "andamento" ? "Pós-teste de andamento" : "Pós-teste de oitavas",
    "Concluir",
  );
  if (preTesteModal) {
    preTesteModal.style.zIndex = "30001";
    preTesteModal.style.display = "flex";
  }
}

preTesteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const perguntaAtual = perguntasPreTeste[perguntaAtualIndex];
  const chavePerguntaAtual = perguntaAtual?.dataset.pretestQuestion;
  if (!respostasQuestionarioAtual[chavePerguntaAtual]) return;

  if (perguntaAtualIndex < perguntasPreTeste.length - 1) {
    perguntaAtualIndex += 1;
    atualizarBotaoInicioPreTeste();
    return;
  }

  if (preTesteModal) preTesteModal.style.display = "none";
  if (questionarioAtual === "pos") {
    if (preTesteModal) preTesteModal.style.zIndex = "12000";
    return;
  }

  mostrarAvisoEtapa(0, () => {
    iniciarPartidaJogo();
  });
});

document.addEventListener("click", (event) => {
  const playNoteButton = event.target.closest(".preteste-play");
  if (playNoteButton) {
    const note = playNoteButton.dataset.pretestNote;
    const sequence = playNoteButton.dataset.sequence;
    if (note) tocarNotaPreTeste(note).catch(console.error);
    else if (sequence) {
      tocarSequenciaPreTeste(
        sequence,
        Number(playNoteButton.dataset.interval) || 0.65,
      ).catch(console.error);
    }
    return;
  }

  const playSequenceButton = event.target.closest(".preteste-play-sequence");
  if (playSequenceButton) {
    const sequence = playSequenceButton.dataset.sequence;
    tocarSequenciaPreTeste(sequence).catch(console.error);
    return;
  }

  const optionButton = event.target.closest(".preteste-option");
  if (optionButton) {
    const pergunta = optionButton.dataset.question;
    const resposta = optionButton.dataset.answer;
    if (pergunta && resposta) {
      registrarRespostaPreTeste(pergunta, resposta);
    }
    return;
  }

});

const nomesDasMusicas = {
  littlestar: "Twinkle, Twinkle, Little Star - Unknown artist",
  jinglebell: "Cai Cai Balão",
  elvis: "Beethoven - Für Elise",
  bethoven: "Bethoven - Ode á Alegria",
  tchai: "Tchaikovsky - Lago dos Cisnes",
};

function obterNomeDaMusica(musicaKey) {
  return nomesDasMusicas[musicaKey] || "Música";
}

const musicaArmazenada = localStorage.getItem("musica") || "elvis";
musica = musicaArmazenada;

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
  canvas.style.display = "none";
  window.location.href = "selector.html";
});

function iniciarPartidaJogo() {
  criarPianoVirtual();

  document.getElementById("gameMenu").style.display = "none";
  pontuacao.style.display = "block";
  document.getElementById("nomeDaMusica").style.display = "block";
  canvas.style.display = "inline";
  progressBar.style.width = "0%";
  progressContainer.style.display = "flex";
  document.getElementById("pontuacaoContainer").style.display = "block";
  document.getElementById("pontuacaoTitle").style.display = "block";

  modoAtual = "jogar";
  faseEtapaIndex = 0;
  tentativasPorEtapa = [0, 0, 0];
  pontuation = 0;
  atualizarPontuacao();
  iniciarFaseAtual();
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

rebuildPitchToKey();

function carregarNotas(notes = []) {
  const notasAjustadas = (notes ?? []).map((note) => ({
    ...note,
    pitch: normalizePitchOctave(note.pitch, octaveAtual),
  }));

  for (const note of notasAjustadas) {
    const key = pitchToKey[note.pitch];
    if (!key) {
      console.warn(`⚠️ Sem mapeamento: ${note.pitch}`);
      continue;
    }
    addCubeToScene(key, note.start_ms, VELOCIDADE_CUBO);
  }
  if (FASE_JOGO === "andamento") {
    spawnEvents.forEach((event) => {
      event.delay *= fatorTempoPartitura;
    });
  }
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

