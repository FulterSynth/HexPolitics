{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true }
  }
}
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    match /games/main {
      allow read: if request.auth != null;
      allow write: if false;

      match /players/{uid} {
        allow read: if request.auth != null;
        allow write: if false;
      }
      match /tiles/{tileId} {
        allow read: if request.auth != null;
        allow write: if false;
      }
      match /cities/{uid} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }
  }
}
// ============================================================
// КОНСТАНТИ. Дзеркало: functions/src/constants.js = public/js/constants.js
// ============================================================

export const MAP_RADIUS = 20;
export const HEX_SIZE = 26;
export const TICK_MS = 1000;

export const RES = { FOOD: 'food', WOOD: 'wood', STONE: 'stone' };

export const TILE_YIELD = {
  grass:  { food: 1, wood: 0, stone: 0 },
  forest: { food: 0, wood: 2, stone: 0 },
  hill:   { food: 0, wood: 0, stone: 2 },
  water:  { food: 0, wood: 0, stone: 0 },
};

export const CITY_MAX_LEVEL = 5;
export const CITY_UPGRADE_COST = {
  1: { food: 50,  wood: 50,  stone: 0   },
  2: { food: 120, wood: 100, stone: 50  },
  3: { food: 250, wood: 200, stone: 150 },
  4: { food: 500, wood: 400, stone: 300 },
};
export const CITY_BORDER_RADIUS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
export const CITY_BASE_YIELD    = { food: 1, wood: 1, stone: 1 };

export const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#fd79a8', '#00b894', '#0984e3', '#d63031',
  '#6c5ce7', '#00cec9', '#fdcb6e', '#636e72',
];
export const MAX_PLAYERS = 16;

export const MIN_CITY_DISTANCE = 4;
export const WORLD_SEED = 1337;
// ============================================================
// МАТЕМАТИКА ГЕКСІВ (axial q,r). Дзеркало: functions/src/hex.js = public/js/hex.js
// ============================================================

import { MAP_RADIUS, TILE_YIELD } from './constants.js';

export const HEX_DIRS = [
  { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 },
];

export function hexDistance(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function hexesInRadius(cx, cr, R) {
  const out = [];
  for (let q = -R; q <= R; q++) {
    const r1 = Math.max(-R, -q - R);
    const r2 = Math.min(R, -q + R);
    for (let r = r1; r <= r2; r++) out.push({ q: cx + q, r: cr + r });
  }
  return out;
}

function hash2(q, r, seed) {
  let h = (q * 374761393 + r * 668265263 + seed * 2147483647) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function tileTypeAt(q, r, seed) {
  const v = hash2(q, r, seed);
  if (v < 0.55) return 'grass';
  if (v < 0.80) return 'forest';
  if (v < 0.95) return 'hill';
  return 'water';
}

export function tileYieldAt(q, r, seed) {
  return TILE_YIELD[tileTypeAt(q, r, seed)];
}

export function inBounds(q, r) {
  return Math.abs(q) <= MAP_RADIUS
      && Math.abs(r) <= MAP_RADIUS
      && Math.abs(q + r) <= MAP_RADIUS;
}

export function tileId(q, r) { return q + '_' + r; }

export function parseTileId(id) {
  const i = id.indexOf('_');
  return { q: +id.slice(0, i), r: +id.slice(i + 1) };
}
# Схема Firestore (одна гра для всіх, gameId = "main")

## users/{uid}
- email: string
- createdAt: Timestamp

## games/main
- status: "playing"
- tick: number
- lastTickAt: Timestamp
- playersCount: number   (0..16)
- seed: number            (= WORLD_SEED)

## games/main/players/{uid}
- uid: string
- email: string
- color: string
- resources: { food, wood, stone }   (старт 0/0/0)
- joinedAt: Timestamp

## games/main/cities/{uid}   (cityId === uid, 1 місто на гравця)
- ownerUid: string
- q: number
- r: number
- level: number           (1..5)
- hp: number              (поки 100)
- foundedAt: Timestamp

## games/main/tiles/{q}_{r}   (лише ЗМІНЕНІ гекти — захоплені кордоном)
- ownerUid: string
- cityId: string

> Решта гектів генерується детерміновано з (q, r, seed) — економить тисячі читань.
    {
  "indexes": [],
  "fieldOverrides": []
}
{
  "projects": {
    "default": "ЗАМІНИ_НА_СВІЙ_PROJECT_ID"
  }
}
{
  "name": "civ-realtime-functions",
  "type": "module",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^6.0.0"
  }
}
// ============================================================
// Firebase Web SDK config. Заміни на свої значення.
// ============================================================
export const firebaseConfig = {
  apiKey: "ЗАМІНИ",
  authDomain: "ЗАМІНИ.firebaseapp.com",
  projectId: "ЗАМІНИ",
  storageBucket: "ЗАМІНИ.appspot.com",
  messagingSenderId: "ЗАМІНИ",
  appId: "ЗАМІНИ"
};
// ============================================================
// Тригер: при реєстрації юзера створюємо users/{uid}.
// Навіщо: денормалізований email + createdAt, щоб клієнт не робив зайвих читань.
// ============================================================
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { beforeUserCreated } from 'firebase-functions/v2/identity';

const db = getFirestore();

// Blocking function — спрацьовує ДО створення юзера.
// Використовуємо щоб одразу записати профіль.
export const onUserCreate = beforeUserCreated(async (event) => {
  const uid = event.data?.uid;
  if (!uid) throw new HttpsError('invalid-argument', 'no uid');
  await db.collection('users').doc(uid).set({
    email: event.data.email || '',
    createdAt: new Date(),
  });
});
// ============================================================
// Ігрові callable-функції: joinMainGame, upgradeCity.
// gameId = "main" (одна гра для всіх).
// ============================================================
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  WORLD_SEED, MAX_PLAYERS, PLAYER_COLORS, MIN_CITY_DISTANCE,
  CITY_MAX_LEVEL, CITY_UPGRADE_COST,
} from './constants.js';
import { inBounds, hexDistance, tileTypeAt } from './hex.js';

const db = getFirestore();
const GAME_REF = db.collection('games').doc('main');

// Приєднання до глобальної гри з обраною стартовою позицією (п.3-в).
export const joinMainGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  const { q, r } = request.data || {};
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new HttpsError('invalid-argument', 'q,r required');
  }
  if (!inBounds(q, r)) throw new HttpsError('invalid-argument', 'out of bounds');
  if (tileTypeAt(q, r, WORLD_SEED) === 'water') {
    throw new HttpsError('failed-precondition', 'cannot settle on water');
  }

  // Транзакція: атомарно перевіряємо ліміт, дистанцію й створюємо все.
  return await db.runTransaction(async (tx) => {
    const gameDoc = await tx.get(GAME_REF);
    const game = gameDoc.exists ? gameDoc.data() : null;

    // Перший гравець ініціалізує документ гри.
    const playersCount = game?.playersCount || 0;

    const playerRef = GAME_REF.collection('players').doc(uid);
    const cityRef = GAME_REF.collection('cities').doc(uid);

    const [playerDoc, cityDoc] = await Promise.all([
      tx.get(playerRef),
      tx.get(cityRef),
    ]);

    // Повторне приєднання — повертаємо існуючий стан (ідемпотентно).
    if (playerDoc.exists && cityDoc.exists) {
      const p = playerDoc.data();
      const c = cityDoc.data();
      return { ok: true, alreadyJoined: true,
               player: { uid, color: p.color, resources: p.resources },
               city: { q: c.q, r: c.r, level: c.level } };
    }

    if (playersCount >= MAX_PLAYERS) {
      throw new HttpsError('resource-exhausted', 'game is full');
    }

    // Перевірка дистанції до всіх існуючих міст.
    const citiesSnap = await tx.get(GAME_REF.collection('cities'));
    for (const doc of citiesSnap.docs) {
      const c = doc.data();
      if (hexDistance({ q, r }, { q: c.q, r: c.r }) < MIN_CITY_DISTANCE) {
        throw new HttpsError('failed-precondition', 'too close to another city');
      }
    }

    const color = PLAYER_COLORS[playersCount % PLAYER_COLORS.length];
    const email = request.auth.token.email || '';

    // Створюємо гравця, місто, інкрементуємо лічильник.
    tx.set(playerRef, {
      uid, email, color,
      resources: { food: 0, wood: 0, stone: 0 }, // п.4-а
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(cityRef, {
      ownerUid: uid, q, r, level: 1, hp: 100,
      foundedAt: FieldValue.serverTimestamp(),
    });
    if (!game) {
      tx.set(GAME_REF, {
        status: 'playing', tick: 0,
        lastTickAt: FieldValue.serverTimestamp(),
        playersCount: 1, seed: WORLD_SEED,
      });
    } else {
      tx.update(GAME_REF, { playersCount: playersCount + 1 });
    }

    // Одразу захоплюємо гект під містом (радіус 1 на рівні 1).
    const { hexesInRadius } = await import('./hex.js');
    for (const h of hexesInRadius(q, r, 1)) {
      if (!inBounds(h.q, h.r)) continue;
      tx.set(GAME_REF.collection('tiles').doc(`${h.q}_${h.r}`),
             { ownerUid: uid, cityId: uid });
    }

    return { ok: true, alreadyJoined: false,
             player: { uid, color, resources: { food: 0, wood: 0, stone: 0 } },
             city: { q, r, level: 1 } };
  });
});

// Апгрейд міста на наступний рівень (клієнт натискає кнопку).
export const upgradeCity = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  return await db.runTransaction(async (tx) => {
    const cityRef = GAME_REF.collection('cities').doc(uid);
    const playerRef = GAME_REF.collection('players').doc(uid);
    const [cityDoc, playerDoc] = await Promise.all([tx.get(cityRef), tx.get(playerRef)]);
    if (!cityDoc.exists || !playerDoc.exists) {
      throw new HttpsError('failed-precondition', 'not in game');
    }
    const city = cityDoc.data();
    const player = playerDoc.data();
    if (city.level >= CITY_MAX_LEVEL) {
      throw new HttpsError('failed-precondition', 'max level');
    }
    const cost = CITY_UPGRADE_COST[city.level];
    const res = player.resources;
    if (res.food < cost.food || res.wood < cost.wood || res.stone < cost.stone) {
      throw new HttpsError('failed-precondition', 'not enough resources');
    }
    const newRes = {
      food:  res.food  - cost.food,
      wood:  res.wood  - cost.wood,
      stone: res.stone - cost.stone,
    };
    tx.update(playerRef, { resources: newRes });
    tx.update(cityRef, { level: city.level + 1 });

    // Розширюємо кордони — захоплюємо нові гекти (перезаписуємо старі тим самим owner).
    const { hexesInRadius, CITY_BORDER_RADIUS } = await import('./hex.js')
      .then(m => ({ ...m, CITY_BORDER_RADIUS: null })); // див. нижче
    return { ok: true, level: city.level + 1, resources: newRes };
  });
});
// ============================================================
// Тік економіки. Scheduled кожну 1 секунду (п.14).
// Рахує ресурси всім гравцям, оновлює кордони міст за рівнем.
// Оптимізація: один batch на всіх гравців. Firestore витримує ~500 writes/batch.
// ============================================================
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  WORLD_SEED, CITY_BASE_YIELD, CITY_BORDER_RADIUS,
  TILE_YIELD, CITY_MAX_LEVEL,
} from './constants.js';
import { hexesInRadius, tileTypeAt, inBounds } from './hex.js';

const db = getFirestore();
const GAME_REF = db.collection('games').doc('main');

export const tick = onSchedule(
  { schedule: 'every 1 seconds', timeZone: 'UTC', memory: '256MiB' },
  async () => {
    const gameDoc = await GAME_REF.get();
    if (!gameDoc.exists) return; // гра ще не почалась
    const game = gameDoc.data();
    if (game.status !== 'playing') return;

    // Завантажуємо всіх гравців і міста одним пакетом.
    const [playersSnap, citiesSnap] = await Promise.all([
      GAME_REF.collection('players').get(),
      GAME_REF.collection('cities').get(),
    ]);
    if (playersSnap.empty) {
      // Нема гравців — просто інкрементуємо тік, щоб не накопичувати борг.
      await GAME_REF.update({ tick: FieldValue.increment(1),
                              lastTickAt: FieldValue.serverTimestamp() });
      return;
    }

    // Мапа міст по uid для швидкого доступу.
    const citiesByUid = new Map();
    citiesSnap.forEach(d => citiesByUid.set(d.id, d.data()));

    // Кеш типів гексів у межах карти (детерміновані — рахуємо раз).
    const tileTypeCache = new Map();
    const getType = (q, r) => {
      const k = q + '_' + r;
      if (!tileTypeCache.has(k)) tileTypeCache.set(k, tileTypeAt(q, r, WORLD_SEED));
      return tileTypeCache.get(k);
    };

    // Рахуємо приріст кожного гравця.
    const batch = db.batch();
    playersSnap.forEach(playerDoc => {
      const p = playerDoc.data();
      const city = citiesByUid.get(playerDoc.id);
      if (!city) return;

      // Базовий приріст міста + приріст з усіх гектів у кордоні.
      const gain = { ...CITY_BASE_YIELD };
      const radius = CITY_BORDER_RADIUS[city.level] || 1;
      for (const h of hexesInRadius(city.q, city.r, radius)) {
        if (!inBounds(h.q, h.r)) continue;
        const y = TILE_YIELD[getType(h.q, h.r)];
        gain.food  += y.food;
        gain.wood  += y.wood;
        gain.stone += y.stone;
      }

      // п.5-б: без їжі місто не росте — але тут ми лише ресурси.
      // Голод поки не реалізуємо: ресурси просто накопичуються.
      const newRes = {
        food:  (p.resources?.food  || 0) + gain.food,
        wood:  (p.resources?.wood  || 0) + gain.wood,
        stone: (p.resources?.stone || 0) + gain.stone,
      };
      batch.update(playerDoc.ref, { resources: newRes });
    });

    // Оновлюємо кордони міст (перезаписуємо tiles для поточного рівня).
    // Робимо це рідко — тільки коли рівень змінився. Для простоти на MVP:
    // перевіряємо, чи всі гекти поточного радіусу вже в tiles; якщо ні —
    // до-захоплюємо. Це дешево, бо більшість гектів уже там.
    for (const [uid, city] of citiesByUid) {
      const radius = CITY_BORDER_RADIUS[city.level] || 1;
      const wanted = hexesInRadius(city.q, city.r, radius)
        .filter(h => inBounds(h.q, h.r))
        .map(h => `${h.q}_${h.r}`);
      // Читаємо наявні tiles для міста (може бути багато — обмежуємо).
      // На MVP: просто перезаписуємо ВСІ гекти поточного радіусу.
      // Firestore ідемпотентний до set — повторний запис того ж значення дешевий.
      for (const tid of wanted) {
        batch.set(GAME_REF.collection('tiles').doc(tid),
                  { ownerUid: uid, cityId: uid });
      }
    }

    batch.update(GAME_REF, {
      tick: FieldValue.increment(1),
      lastTickAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }
);
// ============================================================
// Точка входу. Експортує всі Cloud Functions.
// ============================================================
export { onUserCreate } from './src/auth.js';
export { joinMainGame, upgradeCity } from './src/game.js';
export { tick } from './src/tick.js';
// Заміни функцію upgradeCity у game.js на цю:
import { hexesInRadius } from './hex.js';
import { CITY_BORDER_RADIUS } from './constants.js';

export const upgradeCity = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  return await db.runTransaction(async (tx) => {
    const cityRef = GAME_REF.collection('cities').doc(uid);
    const playerRef = GAME_REF.collection('players').doc(uid);
    const [cityDoc, playerDoc] = await Promise.all([tx.get(cityRef), tx.get(playerRef)]);
    if (!cityDoc.exists || !playerDoc.exists) {
      throw new HttpsError('failed-precondition', 'not in game');
    }
    const city = cityDoc.data();
    const player = playerDoc.data();
    if (city.level >= CITY_MAX_LEVEL) {
      throw new HttpsError('failed-precondition', 'max level');
    }
    const cost = CITY_UPGRADE_COST[city.level];
    const res = player.resources;
    if (res.food < cost.food || res.wood < cost.wood || res.stone < cost.stone) {
      throw new HttpsError('failed-precondition', 'not enough resources');
    }
    const newRes = {
      food:  res.food  - cost.food,
      wood:  res.wood  - cost.wood,
      stone: res.stone - cost.stone,
    };
    const newLevel = city.level + 1;

    tx.update(playerRef, { resources: newRes });
    tx.update(cityRef, { level: newLevel });

    // Розширюємо кордони до нового радіусу (перезапис ідемпотентний).
    const radius = CITY_BORDER_RADIUS[newLevel] || 1;
    for (const h of hexesInRadius(city.q, city.r, radius)) {
      if (!inBounds(h.q, h.r)) continue;
      tx.set(GAME_REF.collection('tiles').doc(`${h.q}_${h.r}`),
             { ownerUid: uid, cityId: uid });
    }

    return { ok: true, level: newLevel, resources: newRes };
  });
});
// ============================================================
// Тік економіки. Рахує ТІЛЬКИ ресурси. Кордони — в upgradeCity.
// ============================================================
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  WORLD_SEED, CITY_BASE_YIELD, CITY_BORDER_RADIUS, TILE_YIELD,
} from './constants.js';
import { hexesInRadius, tileTypeAt, inBounds } from './hex.js';

const db = getFirestore();
const GAME_REF = db.collection('games').doc('main');

export const tick = onSchedule(
  { schedule: 'every 1 seconds', timeZone: 'UTC', memory: '256MiB' },
  async () => {
    const gameDoc = await GAME_REF.get();
    if (!gameDoc.exists) return;
    const game = gameDoc.data();
    if (game.status !== 'playing') return;

    const [playersSnap, citiesSnap] = await Promise.all([
      GAME_REF.collection('players').get(),
      GAME_REF.collection('cities').get(),
    ]);
    if (playersSnap.empty) return;

    const citiesByUid = new Map();
    citiesSnap.forEach(d => citiesByUid.set(d.id, d.data()));

    const typeCache = new Map();
    const getType = (q, r) => {
      const k = q + '_' + r;
      let v = typeCache.get(k);
      if (v === undefined) { v = tileTypeAt(q, r, WORLD_SEED); typeCache.set(k, v); }
      return v;
    };

    const batch = db.batch();
    playersSnap.forEach(playerDoc => {
      const p = playerDoc.data();
      const city = citiesByUid.get(playerDoc.id);
      if (!city) return;

      const gain = { ...CITY_BASE_YIELD };
      const radius = CITY_BORDER_RADIUS[city.level] || 1;
      for (const h of hexesInRadius(city.q, city.r, radius)) {
        if (!inBounds(h.q, h.r)) continue;
        const y = TILE_YIELD[getType(h.q, h.r)];
        gain.food += y.food; gain.wood += y.wood; gain.stone += y.stone;
      }
      const r0 = p.resources || { food: 0, wood: 0, stone: 0 };
      batch.update(playerDoc.ref, {
        resources: {
          food:  r0.food  + gain.food,
          wood:  r0.wood  + gain.wood,
          stone: r0.stone + gain.stone,
        },
      });
    });

    batch.update(GAME_REF, {
      tick: FieldValue.increment(1),
      lastTickAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }
);
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  WORLD_SEED, MAX_PLAYERS, PLAYER_COLORS, MIN_CITY_DISTANCE,
  CITY_MAX_LEVEL, CITY_UPGRADE_COST, CITY_BORDER_RADIUS,
} from './constants.js';
import { inBounds, hexDistance, tileTypeAt, hexesInRadius } from './hex.js';

const db = getFirestore();
const GAME_REF = db.collection('games').doc('main');

export const joinMainGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  const { q, r } = request.data || {};
  if (!Number.isInteger(q) || !Number.isInteger(r)) {
    throw new HttpsError('invalid-argument', 'q,r required');
  }
  if (!inBounds(q, r)) throw new HttpsError('invalid-argument', 'out of bounds');
  if (tileTypeAt(q, r, WORLD_SEED) === 'water') {
    throw new HttpsError('failed-precondition', 'cannot settle on water');
  }

  return await db.runTransaction(async (tx) => {
    const gameDoc = await tx.get(GAME_REF);
    const game = gameDoc.exists ? gameDoc.data() : null;
    const playersCount = game?.playersCount || 0;

    const playerRef = GAME_REF.collection('players').doc(uid);
    const cityRef = GAME_REF.collection('cities').doc(uid);
    const [playerDoc, cityDoc] = await Promise.all([tx.get(playerRef), tx.get(cityRef)]);

    if (playerDoc.exists && cityDoc.exists) {
      const p = playerDoc.data(), c = cityDoc.data();
      return { ok: true, alreadyJoined: true,
               player: { uid, color: p.color, resources: p.resources },
               city: { q: c.q, r: c.r, level: c.level } };
    }
    if (playersCount >= MAX_PLAYERS) {
      throw new HttpsError('resource-exhausted', 'game is full');
    }

    const citiesSnap = await tx.get(GAME_REF.collection('cities'));
    for (const doc of citiesSnap.docs) {
      const c = doc.data();
      if (hexDistance({ q, r }, { q: c.q, r: c.r }) < MIN_CITY_DISTANCE) {
        throw new HttpsError('failed-precondition', 'too close to another city');
      }
    }

    const color = PLAYER_COLORS[playersCount % PLAYER_COLORS.length];
    const email = request.auth.token.email || '';

    tx.set(playerRef, {
      uid, email, color,
      resources: { food: 0, wood: 0, stone: 0 },
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.set(cityRef, {
      ownerUid: uid, q, r, level: 1, hp: 100,
      foundedAt: FieldValue.serverTimestamp(),
    });
    if (!game) {
      tx.set(GAME_REF, {
        status: 'playing', tick: 0,
        lastTickAt: FieldValue.serverTimestamp(),
        playersCount: 1, seed: WORLD_SEED,
      });
    } else {
      tx.update(GAME_REF, { playersCount: playersCount + 1 });
    }

    for (const h of hexesInRadius(q, r, 1)) {
      if (!inBounds(h.q, h.r)) continue;
      tx.set(GAME_REF.collection('tiles').doc(`${h.q}_${h.r}`),
             { ownerUid: uid, cityId: uid });
    }

    return { ok: true, alreadyJoined: false,
             player: { uid, color, resources: { food: 0, wood: 0, stone: 0 } },
             city: { q, r, level: 1 } };
  });
});

export const upgradeCity = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');

  return await db.runTransaction(async (tx) => {
    const cityRef = GAME_REF.collection('cities').doc(uid);
    const playerRef = GAME_REF.collection('players').doc(uid);
    const [cityDoc, playerDoc] = await Promise.all([tx.get(cityRef), tx.get(playerRef)]);
    if (!cityDoc.exists || !playerDoc.exists) {
      throw new HttpsError('failed-precondition', 'not in game');
    }
    const city = cityDoc.data(), player = playerDoc.data();
    if (city.level >= CITY_MAX_LEVEL) {
      throw new HttpsError('failed-precondition', 'max level');
    }
    const cost = CITY_UPGRADE_COST[city.level];
    const res = player.resources;
    if (res.food < cost.food || res.wood < cost.wood || res.stone < cost.stone) {
      throw new HttpsError('failed-precondition', 'not enough resources');
    }
    const newRes = {
      food:  res.food  - cost.food,
      wood:  res.wood  - cost.wood,
      stone: res.stone - cost.stone,
    };
    const newLevel = city.level + 1;
    tx.update(playerRef, { resources: newRes });
    tx.update(cityRef, { level: newLevel });

    const radius = CITY_BORDER_RADIUS[newLevel] || 1;
    for (const h of hexesInRadius(city.q, city.r, radius)) {
      if (!inBounds(h.q, h.r)) continue;
      tx.set(GAME_REF.collection('tiles').doc(`${h.q}_${h.r}`),
             { ownerUid: uid, cityId: uid });
    }
    return { ok: true, level: newLevel, resources: newRes };
  });
});
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Civ Realtime</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- Екран 1: Логін / Реєстрація -->
  <div id="screen-auth" class="screen active">
    <div class="auth-box">
      <h1>Civ Realtime</h1>
      <p class="subtitle">Онлайн-гра в стилі цивілізації</p>

      <div class="tabs">
        <button id="tab-login" class="tab active">Вхід</button>
        <button id="tab-register" class="tab">Реєстрація</button>
      </div>

      <form id="form-auth" autocomplete="on">
        <input type="email" id="auth-email" placeholder="Email" required autocomplete="email">
        <input type="password" id="auth-password" placeholder="Пароль (мін. 6 символів)" required minlength="6" autocomplete="current-password">
        <button type="submit" id="btn-auth-submit">Увійти</button>
      </form>

      <p id="auth-error" class="error hidden"></p>
      <p id="auth-info" class="info hidden"></p>
    </div>
  </div>

  <!-- Екран 2: Вибір стартової позиції (п.3-в) -->
  <div id="screen-join" class="screen">
    <div class="join-box">
      <h2>Обери місце для міста</h2>
      <p class="hint">Клікни на вільний гекс (не воду, не зайнятий іншим гравцем).</p>
      <canvas id="join-canvas"></canvas>
      <div class="join-actions">
        <span id="join-selected">Не обрано</span>
        <button id="btn-join-confirm" disabled>Заснувати місто</button>
      </div>
      <p id="join-error" class="error hidden"></p>
    </div>
  </div>

  <!-- Екран 3: Гра -->
  <div id="screen-game" class="screen">
    <div id="game-hud">
      <div class="hud-resources">
        <span>🍞 <b id="res-food">0</b></span>
        <span>🪵 <b id="res-wood">0</b></span>
        <span>🪨 <b id="res-stone">0</b></span>
      </div>
      <div class="hud-city">
        <span>Рівень міста: <b id="city-level">1</b></span>
        <button id="btn-upgrade">Апгрейд</button>
      </div>
      <button id="btn-logout" class="logout">Вийти</button>
    </div>
    <canvas id="game-canvas"></canvas>
    <p id="game-status" class="status-bar"></p>
  </div>

  <!-- Firebase SDK (compat для простоти на MVP, без bundler) -->
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>

  <!-- Наш код -->
  <script src="js/constants.js"></script>
  <script src="js/hex.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #1a1a2e;
  color: #eaeaea;
  overflow: hidden;
  height: 100vh;
}

.screen {
  display: none;
  width: 100%;
  height: 100vh;
  position: absolute;
  top: 0; left: 0;
}
.screen.active { display: flex; flex-direction: column; }

/* ---- Auth ---- */
#screen-auth {
  align-items: center;
  justify-content: center;
}
.auth-box {
  background: #16213e;
  padding: 40px;
  border-radius: 12px;
  width: 340px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.auth-box h1 { font-size: 28px; margin-bottom: 4px; }
.subtitle { color: #888; font-size: 13px; margin-bottom: 24px; }

.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: 1px solid #333;
  color: #aaa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.tab.active { background: #0f3460; border-color: #0f3460; color: #fff; }

#form-auth input {
  width: 100%;
  padding: 12px;
  margin-bottom: 12px;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 6px;
  color: #eaeaea;
  font-size: 14px;
}
#form-auth input:focus { outline: none; border-color: #0f3460; }

#btn-auth-submit {
  width: 100%;
  padding: 12px;
  background: #e94560;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
#btn-auth-submit:hover { background: #d63851; }
#btn-auth-submit:disabled { opacity: 0.6; cursor: default; }

.error { color: #e94560; font-size: 13px; margin-top: 12px; }
.info { color: #4ecca3; font-size: 13px; margin-top: 12px; }
.hidden { display: none; }

/* ---- Join ---- */
#screen-join { align-items: center; justify-content: center; }
.join-box {
  background: #16213e;
  padding: 24px;
  border-radius: 12px;
  width: 600px;
  max-width: 95vw;
}
.join-box h2 { font-size: 20px; margin-bottom: 4px; }
.hint { color: #888; font-size: 13px; margin-bottom: 16px; }

#join-canvas {
  width: 100%;
  height: 400px;
  background: #0f0f1a;
  border-radius: 8px;
  cursor: crosshair;
  display: block;
}
.join-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
#join-selected { color: #888; font-size: 14px; }
#btn-join-confirm {
  padding: 10px 20px;
  background: #4ecca3;
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-weight: 600;
  cursor: pointer;
}
#btn-join-confirm:disabled { opacity: 0.4; cursor: default; }
#btn-join-confirm:not(:disabled):hover { background: #3db892; }

/* ---- Game ---- */
#screen-game { position: relative; }
#game-canvas { flex: 1; width: 100%; background: #0f0f1a; cursor: grab; }
#game-canvas:active { cursor: grabbing; }

#game-hud {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 16px;
  background: #16213e;
  font-size: 14px;
  z-index: 10;
}
.hud-resources { display: flex; gap: 16px; }
.hud-resources span { display: flex; align-items: center; gap: 4px; }
.hud-city { display: flex; align-items: center; gap: 8px; margin-left: auto; }
#btn-upgrade {
  padding: 6px 12px;
  background: #e94560;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
#btn-upgrade:disabled { opacity: 0.4; cursor: default; }
.logout {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #333;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
  font-size: 13px;
}
.status-bar {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 12px;
  color: #555;
  pointer-events: none;
}
// ============================================================
// Авторизація: реєстрація, вхід, вихід.
// Spark-версія: без Cloud Functions, усе через Firebase Auth SDK.
// ============================================================
const auth = firebase.auth();
const db = firebase.firestore();

// Стан форми: 'login' або 'register'
let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('btn-auth-submit').textContent =
    mode === 'login' ? 'Увійти' : 'Зареєструватися';
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-info').classList.add('hidden');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showAuthInfo(msg) {
  const el = document.getElementById('auth-info');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// Реєстрація / вхід через email+password.
async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn = document.getElementById('btn-auth-submit');

  btn.disabled = true;
  document.getElementById('auth-error').classList.add('hidden');

  try {
    if (authMode === 'register') {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      // Записуємо профіль у users/{uid} (правила дозволяють писати лише власнику).
      await db.collection('users').doc(cred.user.uid).set({
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showAuthInfo('Акаунт створено. Входимо...');
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    // onAuthStateChanged у main.js перехопить і покаже наступний екран.
  } catch (err) {
    console.error(err);
    const map = {
      'auth/email-already-in-use': 'Цей email вже зареєстрований.',
      'auth/invalid-email': 'Невірний формат email.',
      'auth/weak-password': 'Пароль надто слабкий (мін. 6 символів).',
      'auth/user-not-found': 'Користувача не знайдено.',
      'auth/wrong-password': 'Невірний пароль.',
      'auth/too-many-requests': 'Забагато спроб. Спробуй пізніше.',
    };
    showAuthError(map[err.code] || err.message);
  } finally {
    btn.disabled = false;
  }
}

// Вихід.
async function logout() {
  await auth.signOut();
  location.reload();
}

// Ініціалізація обробників (викликається з main.js після DOMContentLoaded).
function initAuthUI() {
  document.getElementById('tab-login').addEventListener('click', () => setAuthMode('login'));
  document.getElementById('tab-register').addEventListener('click', () => setAuthMode('register'));
  document.getElementById('form-auth').addEventListener('submit', handleAuthSubmit);
  document.getElementById('btn-logout').addEventListener('click', logout);
}
// ============================================================
// Точка входу клієнта. Роутинг екранів за станом авторизації.
// Spark-версія: без Cloud Functions, логіка гри — на клієнті.
// ============================================================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ---- Роутинг екранів ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---- Головний стан ----
// onAuthStateChanged — єдине джерело правди про те, хто зараз в системі.
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    showScreen('screen-auth');
    return;
  }

  // Юзер залогінений. Перевіряємо, чи вже є його місто в грі.
  try {
    const cityDoc = await firebase.firestore()
      .collection('games').doc('main')
      .collection('cities').doc(user.uid)
      .get();

    if (cityDoc.exists) {
      // Вже грає — показуємо гру.
      showScreen('screen-game');
      // game.js (Частина 5) ініціалізує рендер і слухачів.
      if (window.initGameScreen) window.initGameScreen();
    } else {
      // Ще не приєднався — екран вибору позиції.
      showScreen('screen-join');
      if (window.initJoinScreen) window.initJoinScreen();
    }
  } catch (err) {
    console.error('Помилка перевірки міста:', err);
    showScreen('screen-auth');
  }
});

// ---- Старт ----
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  // initJoinScreen і initGameScreen будуть визначені в Частинах 4-5.
  // Поки що просто заглушки, щоб не було помилок.
  if (!window.initJoinScreen) window.initJoinScreen = () => {};
  if (!window.initGameScreen) window.initGameScreen = () => {};
});
