function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.dataset.theme = "dark";
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    delete document.documentElement.dataset.theme;
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.dataset.theme = "dark";
  }
}

class SoundFontPlayer {
  constructor(stopCallback) {
    this.context = new AudioContext();
    this.state = "stopped";
    this.callStop = false;
    this.stopCallback = stopCallback;
    this.prevGain = 5;
    this.cacheUrls = new Array(128);
    this.totalTicks = 0;
  }

  async loadSoundFontDir(programs, dir) {
    const promises = programs.map((program) => {
      const programId = program.toString().padStart(3, "0");
      const url = `${dir}/${programId}.sf3`;
      if (this.cacheUrls[program] == url) return true;
      this.cacheUrls[program] = url;
      return this.fetchBuffer(url);
    });
    const buffers = await Promise.all(promises);
    for (const buffer of buffers) {
      if (buffer instanceof ArrayBuffer) {
        await this.loadSoundFontBuffer(buffer);
      }
    }
  }

  async fetchBuffer(url) {
    const response = await fetch(url);
    if (response.status == 200) {
      return await response.arrayBuffer();
    } else {
      return undefined;
    }
  }

  async loadSoundFontUrl(url) {
    const buffer = await this.fetchBuffer(url);
    const soundFontId = await this.loadSoundFontBuffer(buffer);
    return soundFontId;
  }

  async loadSoundFontBuffer(soundFontBuffer) {
    if (!this.synth) {
      await JSSynthPromise;
      await this.context.audioWorklet.addModule(
        "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/externals/libfluidsynth-2.3.0-with-libsndfile.min.js",
      );
      await this.context.audioWorklet.addModule(
        "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/dist/js-synthesizer.worklet.min.js",
      );
      this.synth = new JSSynth.AudioWorkletNodeSynthesizer();
      this.synth.init(this.context.sampleRate);
      const node = this.synth.createAudioNode(this.context);
      node.connect(this.context.destination);
    }
    const soundFontId = await this.synth.loadSFont(soundFontBuffer);
    return soundFontId;
  }

  async loadNoteSequence(ns) {
    await this.synth.resetPlayer();
    // this.ns = ns;
    // const midiBuffer = core.sequenceProtoToMidi(ns);
    // this.totalTicks = this.calcTick(ns.totalTime);
    this.totalTicks = Infinity;
    const volumebar = document.getElementById("volume");
    const volume = parseInt(volumebar.value);
    this.changeVolume(volume);
    return this.synth.addSMFDataToPlayer(ns);
  }

  resumeContext() {
    this.context.resume();
  }

  async restart(seconds) {
    this.state = "started";
    await this.synth.playPlayer();
    if (seconds) this.seekTo(seconds);
    await this.synth.waitForPlayerStopped();
    await this.synth.waitForVoicesStopped();
    this.state = "paused";
    const currentTick = await this.synth.retrievePlayerCurrentTick();
    if (this.totalTicks <= currentTick) {
      player.seekTo(0);
      this.stopCallback();
    }
  }

  async start(ns, _qpm, seconds) {
    if (ns) await this.loadNoteSequence(ns);
    if (seconds) this.seekTo(seconds);
    this.restart();
  }

  stop() {
    if (this.isPlaying()) {
      this.synth.stopPlayer();
    }
  }

  pause() {
    this.state = "paused";
    this.synth.stopPlayer();
  }

  resume(seconds) {
    this.restart(seconds);
  }

  changeVolume(volume) {
    // 0 <= volume <= 1
    volume = volume / 100;
    this.synth.setGain(volume);
  }

  changeMute(status) {
    if (status) {
      this.prevGain = this.synth.getGain();
      this.synth.setGain(0);
    } else {
      this.synth.setGain(this.prevGain);
    }
  }

  calcTick(seconds) {
    let tick = 0;
    let prevTime = 0;
    let prevQpm = 120;
    for (const tempo of this.ns.tempos) {
      const currTime = tempo.time;
      const currQpm = tempo.qpm;
      if (currTime < seconds) {
        const t = currTime - prevTime;
        tick += prevQpm / 60 * t * this.ns.ticksPerQuarter;
      } else {
        const t = seconds - prevTime;
        tick += prevQpm / 60 * t * this.ns.ticksPerQuarter;
        return Math.round(tick);
      }
      prevTime = currTime;
      prevQpm = currQpm;
    }
    const t = seconds - prevTime;
    tick += prevQpm / 60 * t * this.ns.ticksPerQuarter;
    return Math.floor(tick);
  }

  seekTo(seconds) {
    const tick = this.calcTick(seconds);
    this.synth.seekPlayer(tick);
  }

  isPlaying() {
    if (!this.synth) return false;
    return this.synth.isPlaying();
  }

  getPlayState() {
    if (!this.synth) return "stopped";
    if (this.synth.isPlaying()) return "started";
    return this.state;
  }
}

function stopCallback() {
  clearInterval(timer);
  currentTime = 0;
  currentPos = 0;
  clearPlayer();
}

async function initPlayer() {
  disableController();
  if (player && player.isPlaying()) player.stop();
  currentTime = 0;
  currentPos = 0;

  player = new SoundFontPlayer(stopCallback);
  if (firstRun) {
    firstRun = false;
    await loadSoundFont(player, "Ritsu_v0.0.2.sf3");
  } else {
    await loadSoundFont(player);
  }

  enableController();
}

async function loadSoundFont(player, url) {
  await player.loadSoundFontUrl(url);
}

function disableController() {
  controllerDisabled = true;
  const target = document.getElementById("controller")
    .querySelectorAll("button, input");
  [...target].forEach((node) => {
    node.disabled = true;
  });
}

function enableController() {
  controllerDisabled = false;
  const target = document.getElementById("controller")
    .querySelectorAll("button, input");
  [...target].forEach((node) => {
    node.disabled = false;
  });
}

function unlockAudio() {
  if (!player) return;
  if (!player.synth) return;
  player.resumeContext();
  document.removeEventListener("click", unlockAudio);
}

function play() {
  player.start();
}

function changeVolumebar() {
  const volumebar = document.getElementById("volume");
  const volume = parseInt(volumebar.value);
  volumebar.dataset.value = volume;
  player.changeVolume(volume);
}

function clearPlayer() {
  clearInterval(timer);
}

function typeEvent(event) {
  if (!player || !player.synth) return;
  if (controllerDisabled) return;
  player.resumeContext();
  if (event.keyCode === 13) tts();
}

function initMoras() {
  fetch("mora.lst")
    .then((response) => response.text())
    .then((text) => {
      text.trimEnd().split("\n").forEach((line, i) => {
        moraMap.set(line, i);
      });
    });
}

function getNotes(moraMap, text) {
  const defaultPitch = parseInt(document.getElementById("pitch").value);
  const defaultVelocity = parseInt(document.getElementById("volume").value);
  const maxLength = 2;
  const result = [];
  let pitch = defaultPitch;
  let velocity = defaultVelocity;
  let wait = "0";
  while (text.length > 0) {
    let found = false;
    for (let i = maxLength; 0 < i; i--) {
      const word = text.slice(0, i);
      if (moraMap.has(word)) {
        const note = {
          instrument: moraMap.get(word),
          duration: "4",
          pitch: pitch,
          velocity: velocity,
          wait: wait,
        };
        result.push(structuredClone(note));
        pitch = defaultPitch;
        velocity = defaultVelocity;
        wait = "0";
        text = text.substring(word.length);
        found = true;
        break;
      }
    }
    if (!found) {
      switch (text[0]) {
        case " ":
          wait = "16";
          break;
        case "　":
          wait = "8";
          break;
        case "っ":
          wait = "4";
          break;
        case "…":
        case "･･･":
        case "、":
        case "､":
        case "，":
        case ",":
          wait = "2n";
          break;
        case "。":
        case "｡":
        case "．":
        case ".":
          wait = "1n";
          break;
        case "↑":
        case "↗":
        case "⤴":
        case "⇑":
        case "⇡":
          result.at(-1).pitch += 1;
          break;
        case "⬆":
          result.at(-1).pitch += 4;
          break;
        case "↓":
        case "↘":
        case "⤵":
        case "⇓":
        case "⇣":
          result.at(-1).pitch -= 1;
          break;
        case "⬇":
          result.at(-1).pitch -= 4;
          break;
        case "!":
          result.at(-1).velocity += 8;
          break;
        case "‼":
        case "!!":
          result.at(-1).velocity += 16;
          break;
        case "！":
          result.at(-1).velocity += 32;
          break;
        case "❗":
        case "❕":
          result.at(-1).velocity += 64;
          break;
        case "?": {
          const newInfo = structuredClone(result.at(-1));
          newInfo.duration = "32";
          newInfo.pitch += 1;
          result.push(newInfo);
          break;
        }
        case "??":
        case "?!":
        case "!?":
        case "？":
        case "❓":
        case "❔": {
          const newInfo = structuredClone(result.at(-1));
          newInfo.duration = "16";
          newInfo.pitch += 1;
          result.push(newInfo);
          break;
        }
        case "ー":
          result.at(-1).duration = "2";
          break;
      }
      text = text.substring(1);
    }
  }
  return result;
}

function kanaToHira(str) {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

async function tts() {
  const tempo = parseInt(document.getElementById("rate").value);
  const text = document.getElementById("searchText").value;
  const hira = kanaToHira(text);
  const track = new MidiWriter.Track();
  track.setTempo(tempo);
  getNotes(moraMap, hira).forEach((note) => {
    track.addEvent(
      new MidiWriter.ProgramChangeEvent({ instrument: note.instrument }),
    );
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: note.pitch,
        duration: note.duration,
        velocity: note.velocity,
        wait: note.wait,
      }),
    );
  });
  const write = new MidiWriter.Writer(track);
  const file = write.buildFile();

  await player.loadNoteSequence(file);
  play();
}

function resetPitch() {
  document.getElementById("pitch").value = 60;
}

function resetRate() {
  document.getElementById("rate").value = 480;
}

function resetVolume() {
  document.getElementById("volume").value = 500;
}

function loadLibraries(urls) {
  const promises = urls.map((url) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  });
  return Promise.all(promises);
}

const moraMap = new Map();
let controllerDisabled;
let timer;
let player;
let firstRun = true;
loadConfig();
initMoras();
initPlayer();

Module = {};
const JSSynthPromise = loadLibraries([
  "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/dist/js-synthesizer.min.js",
  "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/externals/libfluidsynth-2.3.0-with-libsndfile.min.js",
]);

document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("search").onclick = tts;
document.getElementById("volume").onchange = changeVolumebar;
document.addEventListener("keydown", typeEvent);
document.getElementById("resetPitch").onclick = resetPitch;
document.getElementById("resetRate").onclick = resetRate;
document.getElementById("resetVolume").onclick = resetVolume;
document.addEventListener("click", unlockAudio);
