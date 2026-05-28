// Notification sound types
export type NotificationSoundType = 'short' | 'medium' | 'loud';

// Persistent AudioContext - created once, reused for all sounds
let persistentCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
  if (!persistentCtx || persistentCtx.state === 'closed') {
    persistentCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return persistentCtx;
}

// Call this early to "unlock" audio on user gesture (click/touch/keydown)
export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Play a silent buffer to fully unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioUnlocked = true;
    console.log('[Audio] Unlocked successfully');
  } catch (e) {
    console.warn('[Audio] Failed to unlock:', e);
  }

  // Also request Notification permission early
  requestNotificationPermission();
}

// Auto-unlock on first user interaction
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    unlockAudio();
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
  };
  window.addEventListener('click', unlockHandler);
  window.addEventListener('touchstart', unlockHandler);
  window.addEventListener('keydown', unlockHandler);
}

// ===================== Native Browser Notification =====================

let notificationPermission: NotificationPermission = 'default';

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  notificationPermission = Notification.permission;
  if (notificationPermission === 'default') {
    Notification.requestPermission().then((perm) => {
      notificationPermission = perm;
      console.log('[Notification] Permission:', perm);
    });
  }
}

function showNativeNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: 'new-order',
      requireInteraction: true,
    } as NotificationOptions);
    // Focus tab when clicking notification
    n.onclick = () => {
      window.focus();
      n.close();
    };
    // Auto-close after 15s
    setTimeout(() => n.close(), 15000);
  } catch (e) {
    console.warn('[Notification] Failed:', e);
  }
}

// ===================== Keep-alive for background tabs =====================

// Use a Web Worker to bypass browser throttling of setInterval in background tabs
let keepAliveWorker: Worker | null = null;
let keepAliveCallback: (() => void) | null = null;

function ensureKeepAliveWorker() {
  if (keepAliveWorker) return;
  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(() => self.postMessage('tick'), 10000);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    keepAliveWorker = new Worker(URL.createObjectURL(blob));
    keepAliveWorker.onmessage = () => {
      // Resume AudioContext if it got suspended in background
      if (persistentCtx && persistentCtx.state === 'suspended') {
        persistentCtx.resume().catch(() => {});
      }
      if (keepAliveCallback) keepAliveCallback();
    };
    keepAliveWorker.postMessage('start');
    console.log('[Audio] Keep-alive worker started');
  } catch (e) {
    console.warn('[Audio] Failed to create keep-alive worker:', e);
  }
}

export function setKeepAliveCallback(cb: (() => void) | null) {
  keepAliveCallback = cb;
  if (cb) ensureKeepAliveWorker();
}

// ===================== Sound playback =====================

// Pre-loaded MP3 audio element for "short" sound
let cachedMp3Audio: HTMLAudioElement | null = null;
function getMp3Audio(): HTMLAudioElement {
  if (!cachedMp3Audio) {
    cachedMp3Audio = new Audio('/sounds/venda.mp3');
    cachedMp3Audio.volume = 0.8;
    cachedMp3Audio.load(); // pre-load
  }
  return cachedMp3Audio;
}

// Option 1 - Alerta de Venda: plays uploaded MP3
function playShortSound() {
  try {
    const audio = getMp3Audio();
    audio.currentTime = 0;
    audio.play().catch(() => {
      console.warn('[Audio] MP3 playback blocked, trying AudioContext fallback');
      playMediumSound(); // fallback
    });
  } catch { console.warn('Audio not supported'); }
}

// Option 2 - Urgent alarm style: fast repeating two-tone alert
function playMediumSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    for (let rep = 0; rep < 3; rep++) {
      const baseTime = ctx.currentTime + rep * 0.45;
      const notes = [1046.5, 1318.5, 1568]; // C6, E6, G6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = baseTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.38, t + 0.02);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.12);
        gain.gain.linearRampToValueAtTime(0, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    }
  } catch { console.warn('Audio not supported'); }
}

// Option 3 - Original loud: triple ascending chime repeated twice
function playLoudSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const playChime = (baseTime: number) => {
      const notes = [784, 988, 1318.5]; // G5, B5, E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = baseTime + i * 0.15;
        osc.frequency.setValueAtTime(freq, t);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.03);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.15);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    };

    playChime(ctx.currentTime);
    playChime(ctx.currentTime + 0.7);
  } catch { console.warn('Audio not supported'); }
}

// Play the selected notification sound
export function playNotificationSound(type: NotificationSoundType = 'medium') {
  // Always try to resume context first
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}

  switch (type) {
    case 'short': playShortSound(); break;
    case 'medium': playMediumSound(); break;
    case 'loud': playLoudSound(); break;
  }
}

// Play new order notification (used by AdminOrders)
// Now also triggers a native browser notification for background tab support
export function playNewOrderSound(type: NotificationSoundType = 'medium', orderInfo?: string) {
  playNotificationSound(type);
  if (type === 'short') {
    setTimeout(() => playNotificationSound(type), 500);
  }

  // Always fire native notification — works even when tab is in background
  showNativeNotification(
    '🔔 Novo Pedido!',
    orderInfo || 'Você recebeu um novo pedido. Clique para visualizar.'
  );
}

export const SOUND_OPTIONS: { value: NotificationSoundType; label: string; description: string }[] = [
  { value: 'short', label: 'Alerta de Venda 💰', description: 'Som clássico de venda — celebre cada pedido' },
  { value: 'medium', label: 'Alerta Triplo', description: 'Três toques rápidos ascendentes — urgente e chamativo' },
  { value: 'loud', label: 'Alerta Duplo', description: 'Acorde ascendente repetido duas vezes — impossível ignorar' },
];
