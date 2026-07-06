// Глобальные настройки игры
const CONFIG = {
  WORLD: 3200,          // размер карты в пикселях
  BOT_COUNT: 23,
  PLAYER_R: 16,
  BASE_SPEED: 250,
  SPRINT_MULT: 1.3,
  PICKUP_RADIUS: 52,
  MELEE_RANGE: 58,
  MELEE_DMG: 18,
  MELEE_CD: 0.45,
  HEAL_TIME: 2.0,       // сколько секунд занимает аптечка
  HEAL_AMOUNT: 60,
  LOOT_COUNT: 150,
};

const WEAPONS = {
  pistol:  { name: 'Пистолет',  dmg: 15, rof: 0.30, mag: 12, reload: 1.1, spread: 0.055, speed: 950,  range: 620,  pellets: 1, auto: false, len: 22, color: '#b8bec8', tier: '#b0b6bf' },
  smg:     { name: 'ПП «Оса»',  dmg: 10, rof: 0.09, mag: 30, reload: 1.5, spread: 0.10,  speed: 900,  range: 520,  pellets: 1, auto: true,  len: 27, color: '#7f8c8d', tier: '#5dade2' },
  rifle:   { name: 'Автомат',   dmg: 22, rof: 0.15, mag: 30, reload: 1.9, spread: 0.045, speed: 1100, range: 820,  pellets: 1, auto: true,  len: 34, color: '#8a6a3b', tier: '#a569bd' },
  shotgun: { name: 'Дробовик',  dmg: 9,  rof: 0.85, mag: 5,  reload: 2.2, spread: 0.17,  speed: 800,  range: 340,  pellets: 8, auto: false, len: 32, color: '#a3622f', tier: '#58d68d' },
  sniper:  { name: 'Снайперка', dmg: 80, rof: 1.45, mag: 5,  reload: 2.6, spread: 0.008, speed: 1600, range: 1500, pellets: 1, auto: false, len: 44, color: '#44525f', tier: '#f5b041' },
};

// Фазы зоны: ожидание (с), время сужения (с), урон в секунду, множитель радиуса
const ZONE_PHASES = [
  { wait: 20, shrink: 22, dps: 2,  scale: 0.62 },
  { wait: 15, shrink: 18, dps: 4,  scale: 0.58 },
  { wait: 12, shrink: 15, dps: 7,  scale: 0.55 },
  { wait: 10, shrink: 12, dps: 10, scale: 0.50 },
  { wait: 9,  shrink: 10, dps: 14, scale: 0.45 },
  { wait: 8,  shrink: 9,  dps: 20, scale: 0.02 },
];

// Веса выпадения оружия в луте
const WEAPON_DROP_WEIGHTS = [
  ['pistol', 28], ['smg', 24], ['rifle', 22], ['shotgun', 16], ['sniper', 10],
];

const BOT_NAMES = [
  'Хищник', 'Ворон', 'Шторм', 'Кобра', 'Тень', 'Беркут', 'Клык', 'Гроза',
  'Штык', 'Рысь', 'Волк', 'Сокол', 'Барс', 'Кремень', 'Шершень', 'Гюрза',
  'Тайфун', 'Мираж', 'Зверь', 'Феникс', 'Стрелок', 'Егерь', 'Призрак',
  'Сталкер', 'Комбат', 'Ратник', 'Витязь', 'Смерч', 'Гром', 'Вепрь',
];

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8'];
