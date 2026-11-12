const messages = {
  en: {
    title: 'Seed — a little garden',
    eyebrow: 'A LITTLE GARDEN',
    heading: 'It all begins<br />with a <em>seed.</em>',
    idle: 'Drag the seed onto the soil.<br />Give nature a little time.',
    growing: 'A little patience, and your garden will bloom.<br />Rotate the scene and take a closer look.',
    grown: 'One little seed. A whole little world.<br />Plant another — it will be different.',
    scene: 'A three-dimensional island of soil. Drag to rotate and scroll to zoom.',
    error: 'Unable to load the 3D scene. Check your internet connection and browser WebGL support, then refresh the page.',
    planting: 'Plant a tree',
    seed: 'Pick up the seed. Drag it onto the soil, or click it and choose a planting spot.',
    trayTitle: 'Your first little seed',
    hint: 'Drag or click to plant',
    armedHint: 'Click the soil to choose a spot',
    plant: 'Plant',
    growth: 'Tree growth',
    awakening: 'Life is waking up',
    reaching: 'Reaching for the sun',
    unfolding: 'The canopy is unfolding',
    complete: 'Your tree has grown',
    progress: 'Tree growth progress',
    reset: 'New seed',
    unique: 'Every tree is one of a kind',
    rotate: 'Drag the scene to rotate',
    language: 'Language',
    resources: 'Resources',
    stone: 'Stone',
    stoneHint: 'Click the large grey rock: +1 stone',
    mineStone: 'Mine stone (+1)',
    planted: 'The seed is planted. Your tree will grow in about 26 seconds.',
    pickedUp: 'Seed selected. Click the center of the island or the Plant button.',
    putBack: 'The seed has been put back.',
    invalidSpot: 'Plant the seed closer to the center of the island.',
    ready: 'A new seed is ready to plant.',
    finished: 'Your tree has grown. Explore it or plant a new one.',
  },
  uk: {
    title: 'Зернятко — маленький сад',
    eyebrow: 'МАЛЕНЬКИЙ САД',
    heading: 'Усе починається<br />з <em>зернятка.</em>',
    idle: 'Перетягни насінину на землю.<br />Дай природі трохи часу.',
    growing: 'Трохи терпіння — і з’явиться твій сад.<br />Можеш обертати його й розглядати.',
    grown: 'Одне зернятко. Цілий маленький світ.<br />Посади ще одне — воно буде іншим.',
    scene: 'Тривимірний острівець землі. Обертайте сцену перетягуванням, наближайте коліщатком.',
    error: 'Не вдалося відкрити 3D-сцену. Перевір підключення до інтернету та підтримку WebGL у браузері, потім онови сторінку.',
    planting: 'Посадка дерева',
    seed: 'Взяти насінину. Перетягни на землю або натисни, а потім обери місце посадки.',
    trayTitle: 'Твоє перше зернятко',
    hint: 'Перетягни або натисни, щоб посадити',
    armedHint: 'Натисни на землю, щоб обрати місце',
    plant: 'Посадити',
    growth: 'Ріст дерева',
    awakening: 'Прокидається життя',
    reaching: 'Тягнеться до сонця',
    unfolding: 'Розгортається крона',
    complete: 'Твоє дерево виросло',
    progress: 'Прогрес росту дерева',
    reset: 'Нове зернятко',
    unique: 'Кожне дерево — неповторне',
    rotate: 'Потягни сцену, щоб обертати',
    language: 'Мова',
    resources: 'Ресурси',
    stone: 'Камінь',
    stoneHint: 'Натисни на великий сірий камінь: +1 stone',
    mineStone: 'Добути камінь (+1)',
    planted: 'Насінину посаджено. Дерево виросте приблизно за 26 секунд.',
    pickedUp: 'Насінину взято. Натисни на центр острівця або кнопку «Посадити».',
    putBack: 'Насінину повернуто.',
    invalidSpot: 'Посади насінину ближче до центру острівця.',
    ready: 'Нова насінина готова до посадки.',
    finished: 'Твоє дерево виросло. Можеш розглянути його або посадити нове.',
  },
};

const storageKey = 'seed-garden-language';
function initialLanguage() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(messages, saved)) return saved;
  } catch { /* Browser storage may be unavailable; language selection still works. */ }
  return (navigator.languages || [navigator.language]).some((language) => /^uk(?:-|$)/i.test(language)) ? 'uk' : 'en';
}

let language = initialLanguage();
const state = { instruction: 'idle', hint: 'hint', growth: 'awakening', announcement: null };
export function translate(key) { return messages[language][key]; }

function renderState() {
  // HTML comes only from the bundled translation dictionaries.
  document.querySelector('#instruction').innerHTML = translate(state.instruction);
  document.querySelector('#tray-hint').textContent = translate(state.hint);
  document.querySelector('#growth-label').textContent = translate(state.growth);
  document.querySelector('#announcement').textContent = state.announcement ? translate(state.announcement) : '';
}

export function setUiState(update) {
  if (Object.entries(update).every(([key, value]) => state[key] === value)) return;
  Object.assign(state, update);
  renderState();
}

export function announce(key) { setUiState({ announcement: key }); }

function renderLanguage() {
  document.documentElement.lang = language;
  document.title = translate('title');
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.innerHTML = translate(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', translate(element.dataset.i18nAria));
  });
  document.querySelectorAll('[data-language]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  renderState();
}

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem(storageKey, language); } catch { /* Keep the choice for this visit. */ }
    renderLanguage();
  });
});
renderLanguage();
