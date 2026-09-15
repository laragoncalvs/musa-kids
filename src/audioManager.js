import Soundfont from 'soundfont-player';

let audioContext = null;
let piano = null;
let pianoLoaded = false;
let pianoLoadingPromise = null;
let audioDesbloqueado = false;

function log(msg) {
    console.log(msg);
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;font-size:11px;z-index:9999;padding:4px;word-break:break-all;';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

function criarContexto() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        log('ctx criado state=' + audioContext.state);
    }
}

function tocarSilencio() {
    if (!audioContext) return;
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// Chama isso uma vez, no primeiro toque em qualquer lugar da tela
export function inicializarAudioNoFirstTouch() {
    const eventos = ['touchstart', 'pointerdown', 'click'];

    async function handler(e) {
        if (audioDesbloqueado) return;

        criarContexto();

        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }

        tocarSilencio();
        audioDesbloqueado = true;
        log('audio desbloqueado no first touch, state=' + audioContext.state);

        // Remove os listeners — só precisa acontecer uma vez
        eventos.forEach(ev => document.removeEventListener(ev, handler));

        // Já começa a carregar o piano em background
        carregarPiano().catch(err => log('erro pre-carga piano: ' + err));
    }

    eventos.forEach(ev => document.addEventListener(ev, handler, { once: false, passive: true }));
}

export async function garantirAudio() {
    criarContexto();
    if (audioContext.state !== 'running') {
        await audioContext.resume();
        tocarSilencio();
    }
    return audioContext;
}

export async function carregarPiano() {
    if (pianoLoaded && piano) return piano;
    if (pianoLoadingPromise) return pianoLoadingPromise;

    pianoLoadingPromise = (async () => {
        const ctx = await garantirAudio();
        log('carregando soundfont...');
        piano = await Soundfont.instrument(ctx, 'acoustic_grand_piano', {
            gain: 4,
            format: 'mp3',
            soundfont: 'MusyngKite',
        });
        pianoLoaded = true;
        log('soundfont pronto');
        return piano;
    })();

    return pianoLoadingPromise;
}

export function testarBeep() {
    if (!audioContext) { log('sem contexto'); return; }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 440;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
    log('beep disparado');
}

export function getPiano() {
    return piano;
}