const messages = {
  en: {
    title: 'Seed — a little garden',
    eyebrow: 'A LITTLE GARDEN',
    heading: 'It all begins<br />with a <em>seed.</em>',
    idle: 'Drag the seed onto the soil.<br />Give nature a little time.',
    growing: 'A little patience, and your garden will bloom.<br />Rotate the scene and take a closer look.',
    grown: '',
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
    unique: 'Every tree is one of a kind',
    rotate: 'Drag the scene to rotate',
    language: 'Language',
    newGame: 'New game',
    confirmNewGame: 'Start a new game? Your entire garden, all plots, plants and stone will be lost. This cannot be undone.',
    resources: 'Resources',
    stone: 'Stone',
    mineStone: 'Mine stone (+1)',
    plantShop: 'Plant something',
    openShop: 'Open shop',
    closeShop: 'Close shop',
    shears: 'Garden shears',
    shearsHint: 'Tap a flower, bush or mushroom to remove it. No stone is refunded.',
    plantRemoved: 'Plant removed. Its place is free again.',
    removeSlot: 'Remove plant at place',
    placePlant: 'Choose a glowing place',
    places: 'Places',
    flower: 'Flower',
    mushroom: 'Mushroom',
    bush: 'Bush',
    slot: 'Place',
    choosePlant: 'Choose a plant to see free places.',
    chooseSpot: 'Tap a glowing place. Pinch to zoom in.',
    needStone: 'Mine the grey rock to buy plants.',
    gardenFull: 'All 24 places are planted.',
    cancel: 'Cancel',
    itemPlanted: 'Your new plant is planted and saved.',
    planted: 'The seed is planted. Your tree will grow in about 26 seconds.',
    pickedUp: 'Seed selected. Click the center of the island or the Plant button.',
    putBack: 'The seed has been put back.',
    invalidSpot: 'Plant the seed closer to the center of the island.',
    ready: 'A new seed is ready to plant.',
    finished: 'Your tree has grown. Take a closer look.',
    shopIdle: 'Open the bag to choose a free tree seed.',
    treeSeeds: 'Tree seeds',
    smallPlants: 'Plants',
    apple: 'Apple tree',
    pine: 'Spruce',
    free: 'Free',
    treeHint: 'Tap the center of this plot to plant your tree.',
    plantCenter: 'Plant in center',
    nextParcel: 'Next hexagon',
    parcelLimitReached: 'All 12 plots are unlocked.',
    grownTree: 'Grown tree',
    expansionSource: 'Requirements on plot:',
    expansionPrice: 'Expanding costs 150 stone. Plants stay in place.',
    expansionReady: 'Choose a neighboring + to expand for 150 stone.',
    expanded: 'New plot unlocked. Choose its free tree seed in the shop.',
    neighbor: 'Add neighboring plot',
    parcels: 'Garden plots',
    parcel: 'Plot',
    overview: 'Overview',
  },
  uk: {
    title: 'Зернятко — маленький сад',
    eyebrow: 'МАЛЕНЬКИЙ САД',
    heading: 'Усе починається<br />з <em>зернятка.</em>',
    idle: 'Перетягни насінину на землю.<br />Дай природі трохи часу.',
    growing: 'Трохи терпіння — і з’явиться твій сад.<br />Можеш обертати його й розглядати.',
    grown: '',
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
    unique: 'Кожне дерево — неповторне',
    rotate: 'Потягни сцену, щоб обертати',
    language: 'Мова',
    newGame: 'Нова гра',
    confirmNewGame: 'Почати нову гру? Увесь сад, усі ділянки, рослини та каміння буде втрачено. Цю дію не можна скасувати.',
    resources: 'Ресурси',
    stone: 'Камінь',
    mineStone: 'Добути камінь (+1)',
    plantShop: 'Що посадимо?',
    openShop: 'Відкрити магазин',
    closeShop: 'Закрити магазин',
    shears: 'Садові ножиці',
    shearsHint: 'Натисни на квітку, кущ або гриб, щоб видалити. Каміння не повертається.',
    plantRemoved: 'Рослину видалено. Місце знову вільне.',
    removeSlot: 'Видалити рослину на місці',
    placePlant: 'Обери підсвічене місце',
    places: 'Місця',
    flower: 'Квіточка',
    mushroom: 'Грибочок',
    bush: 'Кущ',
    slot: 'Місце',
    choosePlant: 'Обери рослину — побачиш вільні місця.',
    chooseSpot: 'Натисни на світле місце. Наближай двома пальцями.',
    needStone: 'Добувай каміння із сірої скелі для посадок.',
    gardenFull: 'Усі 24 місця вже засаджені.',
    cancel: 'Скасувати',
    itemPlanted: 'Нову рослину посаджено та збережено.',
    planted: 'Насінину посаджено. Дерево виросте приблизно за 26 секунд.',
    pickedUp: 'Насінину взято. Натисни на центр острівця або кнопку «Посадити».',
    putBack: 'Насінину повернуто.',
    invalidSpot: 'Посади насінину ближче до центру острівця.',
    ready: 'Нова насінина готова до посадки.',
    finished: 'Твоє дерево виросло. Можеш розглянути його ближче.',
    shopIdle: 'Відкрий торбинку та обери безкоштовне насіння дерева.',
    treeSeeds: 'Насіння дерев',
    smallPlants: 'Рослини',
    apple: 'Яблуня',
    pine: 'Ялинка',
    free: 'Безкоштовно',
    treeHint: 'Натисни в центрі цієї ділянки, щоб посадити дерево.',
    plantCenter: 'Посадити в центрі',
    nextParcel: 'Наступний шестикутник',
    parcelLimitReached: 'Усі 12 ділянок відкрито.',
    grownTree: 'Виросле дерево',
    expansionSource: 'Умови на ділянці:',
    expansionPrice: 'Розширення коштує 150 stone. Рослини залишаються.',
    expansionReady: 'Обери сусідній +, щоб розширити сад за 150 stone.',
    expanded: 'Нову ділянку відкрито. Обери її безкоштовне насіння дерева в магазині.',
    neighbor: 'Додати сусідню ділянку',
    parcels: 'Ділянки саду',
    parcel: 'Ділянка',
    overview: 'Огляд саду',
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
const state = { instruction: 'shopIdle', growth: 'awakening', announcement: null, plantingStatus: 'choosePlant', placement: 'placePlant' };
export function translate(key) { return messages[language][key]; }

function renderState() {
  // HTML comes only from the bundled translation dictionaries.
  document.querySelector('#instruction').innerHTML = translate(state.instruction);
  document.querySelector('#placement-label').textContent = translate(state.placement);
  document.querySelector('#growth-label').textContent = translate(state.growth);
  document.querySelector('#announcement').textContent = state.announcement ? translate(state.announcement) : '';
  document.querySelector('#planting-status').textContent = translate(state.plantingStatus);
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
  document.querySelectorAll('[data-slot]').forEach((button) => {
    button.textContent = `${translate(button.dataset.removing === 'true' ? 'removeSlot' : 'slot')} ${Number(button.dataset.slot) + 1}`;
  });
  document.querySelectorAll('[data-neighbor]').forEach((button) => {
    button.textContent = `${translate('neighbor')} ${Number(button.dataset.neighbor) + 1}`;
  });
  document.querySelectorAll('[data-parcel]').forEach((button) => {
    button.textContent = `${translate('parcel')} ${Number(button.dataset.parcel) + 1}`;
  });
  const source = document.querySelector('#expansion-source');
  source.textContent = `${translate('parcel')} ${Number(source.dataset.sourceParcel) + 1}`;
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
