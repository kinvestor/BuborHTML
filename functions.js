// ============================================================
//                    ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

// Система профилей
let currentProfile = null; // имя текущего профиля
let profiles = {}; // { "имя": { level, score, lives, ... } }

// Delta time для независимости от FPS
let lastFrameTime = 0;
let deltaTime = 0;
const FIXED_TIMESTEP = 1000 / 60; // ~16.67ms

// Состояние игры
const gameState = {
    isPaused: false,
    isInvincible: false,
    gameOver: false,
    levelChanging: false,
    isFacingLeft: false,
    isGameStarted: false,
    isStorySkippable: false,
    // Ачивки
    achievements: [],
    hasFallenOnce: false, // для ачивки "Бобр-пирдун"
    hasHat: false,
    hasTailTrail: false,
    hasMagnet: false,
    extraLivesBought: 0,
    // Двойной прыжок
    hasDoubleJump: false,
    canDoubleJump: false,
    doubleJumpPurchased: false,
    // Активные купленные скины
    activeSkin: null, // оставляем для обратной совместимости
    activeWearable: null,
    activeTrail: null,
    // Мобильное управление
    touchLeft: false,
    touchRight: false,
    touchJump: false,
    // Статистика профиля
    totalDeaths: 0,
    totalLevelsCompleted: 0,
    totalPlayTime: 0,
    sessionStartTime: null,
    // Ежедневные задания
    dailyChallenges: [],
    dailyChallengeDate: '',
    dailyRewardClaimed: false
};

// ============================================================
//               УЛУЧШЕНИЯ ДОМИКА (HOME UPGRADES)
// ============================================================

const HOME_UPGRADES = [
    { id: 'hut', name: '🏡 Хатка бобра', desc: 'Уютная хатка с анимацией смены фона!', cost: 2000, levelReq: 6, imgFrom: 'base', imgTo: 'base_1' },
    { id: 'furniture', name: '🪑 Бобро-мебель', desc: 'Стильная мебель внутри хатки!', cost: 5000, levelReq: 12, imgFrom: 'base_1', imgTo: 'base_2' },
    { id: 'superDam', name: '🌊 Супер-плотина!', desc: 'Эпичная плотина с водопадом!', cost: 10000, levelReq: 18, imgFrom: 'base_2', imgTo: 'base_3' }
];

// Купленные улучшения домика
let homeUpgrades = { hut: false, furniture: false, superDam: false };

// Загрузить улучшения домика из профиля
function loadHomeUpgrades() {
    if (currentProfile && profiles[currentProfile] && profiles[currentProfile].homeUpgrades) {
        homeUpgrades = { ...homeUpgrades, ...profiles[currentProfile].homeUpgrades };
    }
    // Применяем текущий фон
    applyHomeBackground();
}

// Применить фон домика
function applyHomeBackground() {
    const homeTab = document.getElementById('homeTab');
    if (!homeTab) return;
    
    let imgName = 'base.jpg';
    if (homeUpgrades.superDam) imgName = 'base_3.jpeg';
    else if (homeUpgrades.furniture) imgName = 'base_2.jpeg';
    else if (homeUpgrades.hut) imgName = 'base_1.jpeg';
    
    homeTab.style.backgroundImage = `url('img/home/${imgName}')`;
}

// Купить улучшение домика
function buyHomeUpgrade(upgradeId) {
    const upgrade = HOME_UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) { showNotification('Улучшение не найдено!', 2000); return; }
    
    if (homeUpgrades[upgradeId]) {
        showNotification('Это улучшение уже куплено! ✅', 2000);
        return;
    }
    
    if (level < upgrade.levelReq) {
        showNotification(`🔒 Требуется уровень ${upgrade.levelReq}+`, 2500);
        return;
    }
    
    if (score < upgrade.cost) {
        showNotification(`💰 Не хватает боброчков! Нужно ${upgrade.cost}`, 2500);
        return;
    }
    
    score -= upgrade.cost;
    homeUpgrades[upgradeId] = true;
    saveHomeUpgrades();
    
    // Анимация смены фона
    animateHomeUpgrade(upgrade);
    
    showNotification(`🎉 ${upgrade.name} построено!`, 3000);
    renderHomeTab();
}

// Анимация смены фона домика
function animateHomeUpgrade(upgrade) {
    const homeTab = document.getElementById('homeTab');
    if (!homeTab) return;
    
    // Затемняем через панель
    const panel = homeTab.querySelector('.home-panel');
    if (panel) panel.style.opacity = '0.3';
    
    // 1. Затемнение
    homeTab.style.transition = 'opacity 0.5s ease';
    homeTab.style.opacity = '0.3';
    
    // 2. Через 500мс меняем картинку с эффектом
    setTimeout(() => {
        // Показываем новый фон
        const newImg = `url('img/home/${upgrade.imgTo}.jpeg')`;
        homeTab.style.backgroundImage = newImg;
        
        // Эффект "появления" — через яркую вспышку
        homeTab.style.transition = 'opacity 0.8s ease, filter 0.8s ease';
        homeTab.style.filter = 'brightness(2) saturate(1.5)';
        homeTab.style.opacity = '1';
        
        // Восстанавливаем панель
        if (panel) panel.style.opacity = '1';
        
        // 3. Сброс фильтра 
        setTimeout(() => {
            homeTab.style.filter = 'brightness(1) saturate(1)';
        }, 800);
    }, 500);
}

// Сохранить улучшения домика
function saveHomeUpgrades() {
    if (currentProfile && profiles[currentProfile]) {
        profiles[currentProfile].homeUpgrades = { ...homeUpgrades };
        saveProfiles();
    }
}

// ============================================================
//          ПОЛНОЭКРАННЫЙ РЕЖИМ
// ============================================================

function goFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
        el.requestFullscreen().then(() => {
            resizeCanvas();
        }).catch(() => {});
    } else if (el.webkitRequestFullscreen) { // Safari/Chrome legacy
        el.webkitRequestFullscreen();
        setTimeout(resizeCanvas, 200);
    } else if (el.msRequestFullscreen) { // IE/Edge legacy
        el.msRequestFullscreen();
        setTimeout(resizeCanvas, 200);
    }
}

function resizeCanvas() {
    if (!canvas) return;
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Если размер изменился — перезапускаем уровень, чтобы платформы/объекты встали правильно
    if (oldWidth !== canvas.width || oldHeight !== canvas.height) {
        player.y = canvas.height - 150;
        // Если игра запущена — перезапускаем уровень
        if (gameState.isGameStarted) {
            resetLevel();
        }
    }
}

// Флаг, что кнопка прыжка была отпущена (для корректного двойного прыжка)
let jumpButtonReleased = true;

// Игрок
let player = {
    x: 50,
    y: 0,
    width: 50,
    height: 50,
    dx: 0,
    dy: 0,
    speed: 5,
    jumping: false,
    grounded: false,
    hue: 0,
    rotation: 0
};

let canvas, ctx;
let keys = {};
let platforms = [];
let nuts = [];
let level = 1;
let collectedNuts = 0;
let destroyedTraps = 0;
let destroyedEnemies = 0;
let totalNuts = 0;
let countdownValue = 4;
let currentBackgroundImg = null;
let collectiblesName = "Орешков: ";
let victoryMusic = null;
let lives = 3;
let score = 0;
let timeLeft = 50;

// Бонусы
let TimeAdd = null;
let LiveAdd = null;
// Страховочная платформа
let safetyPlatformBonus = null;
let hasSafetyPlatform = false;
let safetyPlatform = null;
// Ранги
let playerRank = { id: 'bobrenok', name: 'Бобрёнок', bonus: null, condition: 0 };
const RANKS = [
    { id: 'bobrenok',   name: '🟤 Бобрёнок',        condition: 0 },
    { id: 'uchenik',    name: '⚪ Бобр-ученик',      condition: 3 },
    { id: 'rabotnik',   name: '🟢 Бобр-работник',    condition: 6 },
    { id: 'stroitel',   name: '🔵 Бобр-строитель',   condition: 10 },
    { id: 'master',     name: '🟣 Бобр-мастер',      condition: 15 },
    { id: 'zolotoy',    name: '🟡 Золотой бобр',     condition: 20 },
    { id: 'geroy',      name: '🟠 Бобр-герой',       condition: 25 },
    { id: 'legend',     name: '🔴 Легендарный бобр', condition: 30 },
    { id: 'king',       name: '👑 Бобр-король',      condition: 48 }
];

// ============================================================
//               СКИНЫ (МАГАЗИН)
// ============================================================

// Массив данных всех скинов
const SKINS_DATA = [
    // Доступны сразу (Бобрёнок) — категория: wearable
    { id: 'hat',        name: '🎩 Шляпа',          cost: 200, rank: 'bobrenok', emoji: '🎩', category: 'wearable' },
    { id: 'glasses',    name: '🥽 Очки',            cost: 250, rank: 'bobrenok', emoji: '🥽', category: 'wearable' },
    // Бобр-ученик (ур.3)
    { id: 'scarf',      name: '🧣 Шарф',           cost: 300, rank: 'uchenik', emoji: '🧣', category: 'wearable' },
    { id: 'tailTrail',  name: '🔥 Огненный след',  cost: 350, rank: 'uchenik', emoji: '🔥', category: 'trail' },
    // Бобр-работник (ур.6)
    { id: 'vest',       name: '🦺 Жилет',          cost: 450, rank: 'rabotnik', emoji: '🦺', category: 'wearable' },
    // Бобр-строитель (ур.10)
    { id: 'backpack',   name: '🎒 Рюкзак',         cost: 500, rank: 'stroitel', emoji: '🎒', category: 'wearable' },
    // Бобр-мастер (ур.15)
    { id: 'sword',      name: '🗡️ Меч',           cost: 650, rank: 'master', emoji: '🗡️', category: 'wearable' },
    // Золотой бобр (ур.20)
    { id: 'rainbow',    name: '🌈 Радужный след',  cost: 750, rank: 'zolotoy', emoji: '🌈', category: 'trail' },
    // Бобр-герой (ур.25)
    { id: 'helmet',     name: '🪖 Каска',          cost: 900, rank: 'geroy', emoji: '🪖', category: 'wearable' },
    // Легендарный бобр (ур.30)
    { id: 'crown',      name: '👑 Корона',         cost: 1100, rank: 'legend', emoji: '👑', category: 'wearable' },
    // Бобр-король (ур.36)
    { id: 'lightning',  name: '⚡ Аура молний',    cost: 1400, rank: 'king', emoji: '⚡', category: 'trail' },
    { id: 'fireworks',  name: '🎆 Фейерверк',      cost: 1800, rank: 'king', emoji: '🎆', category: 'trail' },
    // Эффекты прыжка (декоративные частицы)
    { id: 'jumpStars',   name: '⭐ Звёздочки',      cost: 350, rank: 'uchenik',  emoji: '⭐', category: 'jumpEffect' },
    { id: 'jumpLeaves',  name: '🍃 Листья',         cost: 450, rank: 'rabotnik', emoji: '🍃', category: 'jumpEffect' },
    { id: 'jumpFire',    name: '🔥 Огонь',          cost: 1000, rank: 'geroy',   emoji: '🔥', category: 'jumpEffect' }
];

// Купленные скины (id скинов)
let purchasedSkins = [];
// Активные скины по категориям
let activeWearable = null;
let activeTrail = null;
let activeJumpEffect = null;

// Загрузить купленные скины из localStorage
function loadSkins() {
    const saved = localStorage.getItem('purchasedSkins');
    if (saved) {
        try { purchasedSkins = JSON.parse(saved); } catch(e) { purchasedSkins = []; }
    }
    // Загружаем активные скины по категориям
    const savedWearable = localStorage.getItem('activeWearable');
    if (savedWearable) {
        try { activeWearable = savedWearable; } catch(e) { activeWearable = null; }
    }
    const savedTrail = localStorage.getItem('activeTrail');
    if (savedTrail) {
        try { activeTrail = savedTrail; } catch(e) { activeTrail = null; }
    }
    const savedJumpEffect = localStorage.getItem('activeJumpEffect');
    if (savedJumpEffect) {
        try { activeJumpEffect = savedJumpEffect; } catch(e) { activeJumpEffect = null; }
    }
    // Миграция со старого activeSkin
    const savedActive = localStorage.getItem('activeSkin');
    if (savedActive && !activeWearable && !activeTrail) {
        try {
            const oldActive = savedActive;
            const skinData = SKINS_DATA.find(s => s.id === oldActive);
            if (skinData) {
                if (skinData.category === 'wearable') activeWearable = oldActive;
                else if (skinData.category === 'trail') activeTrail = oldActive;
            }
        } catch(e) {}
    }
    // Миграция старых скинов (hasHat, hasTailTrail)
    if (gameState.hasHat && !purchasedSkins.includes('hat')) {
        purchasedSkins.push('hat');
    }
    if (gameState.hasTailTrail && !purchasedSkins.includes('tailTrail')) {
        purchasedSkins.push('tailTrail');
    }
    saveSkins();
}

function saveSkins() {
    localStorage.setItem('purchasedSkins', JSON.stringify(purchasedSkins));
    localStorage.setItem('activeWearable', activeWearable || '');
    localStorage.setItem('activeTrail', activeTrail || '');
    localStorage.setItem('activeJumpEffect', activeJumpEffect || '');
    // Удаляем старый ключ
    localStorage.removeItem('activeSkin');
}

// Проверить, может ли игрок купить скин (достаточно ли ранг)
function canBuySkin(skinId) {
    const skin = SKINS_DATA.find(s => s.id === skinId);
    if (!skin) return false;
    // Находим ранг скина
    const rank = RANKS.find(r => r.id === skin.rank);
    if (!rank) return false;
    // Проверяем, есть ли у игрока ранг не ниже требуемого
    const currentRankIndex = RANKS.findIndex(r => r.id === playerRank.id);
    const requiredRankIndex = RANKS.findIndex(r => r.id === skin.rank);
    return currentRankIndex >= requiredRankIndex;
}

// Купить скин
function buySkinById(skinId) {
    const skin = SKINS_DATA.find(s => s.id === skinId);
    if (!skin) { showNotification('Скин не найден!'); return; }
    if (purchasedSkins.includes(skinId)) { showNotification('Этот скин уже куплен!'); return; }
    if (!canBuySkin(skinId)) {
        const rank = RANKS.find(r => r.id === skin.rank);
        showNotification(`🔒 Нужно звание: ${rank ? rank.name : '???'}`, 2500);
        return;
    }
    if (score < skin.cost) {
        showNotification(`Недостаточно боброчков! Нужно ${skin.cost}`, 2500);
        return;
    }
    score -= skin.cost;
    purchasedSkins.push(skinId);
    saveSkins();
    // Авто-надеваем в соответствующую категорию
    if (skin.category === 'wearable' && !activeWearable) {
        activeWearable = skinId;
        saveSkins();
    } else if (skin.category === 'trail' && !activeTrail) {
        activeTrail = skinId;
        saveSkins();
    } else if (skin.category === 'jumpEffect' && !activeJumpEffect) {
        activeJumpEffect = skinId;
        saveSkins();
    }
    showNotification(`✅ Куплен скин: ${skin.name}!`, 2500);
    // Обновляем магазин
    renderShopSkins();
}

// Надеть/снять скин
function equipSkin(skinId) {
    if (!purchasedSkins.includes(skinId)) {
        showNotification('Сначала купи этот скин!', 2000);
        return;
    }
    const skin = SKINS_DATA.find(s => s.id === skinId);
    if (!skin) return;
    
    if (skin.category === 'wearable') {
        if (activeWearable === skinId) {
            activeWearable = null;
            showNotification('Скин снят', 1500);
        } else {
            activeWearable = skinId;
            showNotification(`🎭 Надет скин: ${skin.name}`, 2000);
        }
    } else if (skin.category === 'trail') {
        if (activeTrail === skinId) {
            activeTrail = null;
            showNotification('След снят', 1500);
        } else {
            activeTrail = skinId;
            showNotification(`✨ Надет след: ${skin.name}`, 2000);
        }
    } else if (skin.category === 'jumpEffect') {
        if (activeJumpEffect === skinId) {
            activeJumpEffect = null;
            showNotification('Эффект прыжка снят', 1500);
        } else {
            activeJumpEffect = skinId;
            showNotification(`💨 Надет эффект прыжка: ${skin.name}`, 2000);
        }
    }
    saveSkins();
    renderShopSkins();
}

// Рендер вкладки "Домик" 
function renderHomeTab() {
    const container = document.getElementById('homeTab');
    if (!container) return;
    
    // Эффекты: золотая пыль
    let effectsHtml = '';
    for (let i = 1; i <= 8; i++) {
        effectsHtml += `<div class="home-sparkle"></div>`;
    }
    
    // Правая панель с заголовком и улучшениями
    let html = '<div class="home-panel">';
    html += '<div class="home-panel-title">🏡 Улучшения домика</div>';
    html += '<div class="home-upgrades-list">';
    
    HOME_UPGRADES.forEach(u => {
        const owned = homeUpgrades[u.id];
        const levelOk = level >= u.levelReq;
        const canAfford = score >= u.cost;
        const locked = !levelOk && !owned;
        
        let statusHtml, btnHtml;
        if (owned) {
            statusHtml = '<span class="home-status-text status-owned">✅ Построено</span>';
            btnHtml = '';
        } else if (locked) {
            statusHtml = `<span class="home-status-text status-locked">🔒 Уровень ${u.levelReq}+</span>`;
            btnHtml = '';
        } else if (!canAfford) {
            statusHtml = `<span class="home-status-text status-nomoney">💰 Нужно ${u.cost}</span>`;
            btnHtml = `<button class="home-btn home-btn-buy disabled" disabled>💰 ${u.cost}</button>`;
        } else {
            statusHtml = `<span class="home-status-text status-available">💰 ${u.cost}</span>`;
            btnHtml = `<button class="home-btn home-btn-buy" onclick="buyHomeUpgrade('${u.id}')">🏗️ ${u.cost}</button>`;
        }
        
        html += `
            <div class="home-upgrade-row ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
                <div class="home-upgrade-info">
                    <div class="home-upgrade-icon">${u.name.split(' ')[0]}</div>
                    <div class="home-upgrade-text">
                        <div class="home-upgrade-name">${u.name}</div>
                        <div class="home-upgrade-desc">${u.desc}</div>
                        <div class="home-upgrade-level">📊 Уровень ${u.levelReq}+</div>
                        ${statusHtml}
                    </div>
                </div>
                <div class="home-upgrade-action">
                    ${btnHtml}
                </div>
            </div>
        `;
    });
    html += '</div>';
    html += '</div>'; // .home-panel
    
    container.innerHTML = effectsHtml + html;
    
    // Применяем фон на сам контейнер ПОСЛЕ того, как вставили HTML
    applyHomeBackground();
}

// Рендер магазина скинов
function renderShopSkins() {
    const container = document.getElementById('skinsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    // Группируем по рангам для заголовков
    const rankNames = {
        'bobrenok': '🟤 Бобрёнок (сразу)',
        'uchenik': '⚪ Бобр-ученик (ур. 3+)',
        'rabotnik': '🟢 Бобр-работник (ур. 6+)',
        'stroitel': '🔵 Бобр-строитель (ур. 10+)',
        'master': '🟣 Бобр-мастер (ур. 15+)',
        'zolotoy': '🟡 Золотой бобр (ур. 20+)',
        'geroy': '🟠 Бобр-герой (ур. 25+)',
        'legend': '🔴 Легендарный бобр (ур. 30+)',
        'king': '👑 Бобр-король (ур. 36+)'
    };
    
    // Рендерим все скины подряд с метками рангов
    SKINS_DATA.forEach(skin => {
        const isOwned = purchasedSkins.includes(skin.id);
        // Проверка активна ли по категории
        let isActive = false;
        if (skin.category === 'wearable') isActive = (activeWearable === skin.id);
        else if (skin.category === 'trail') isActive = (activeTrail === skin.id);
        else if (skin.category === 'jumpEffect') isActive = (activeJumpEffect === skin.id);
        
        const canBuy = canBuySkin(skin.id) && !isOwned;
        const locked = !canBuySkin(skin.id) && !isOwned;
        const rankName = rankNames[skin.rank] || skin.rank;
        
        const card = document.createElement('div');
        card.className = `skin-card${isOwned ? ' owned' : ''}${isActive ? ' active' : ''}${locked ? ' locked' : ''}`;
        
        let btnHtml = '';
        if (!isOwned) {
            if (locked) {
                btnHtml = `<span class="skin-locked-label">🔒 ${rankName}</span>`;
            } else {
                btnHtml = `<button class="skin-btn skin-btn-buy" onclick="buySkinById('${skin.id}')">💰 ${skin.cost}</button>`;
            }
        } else if (isActive) {
            btnHtml = `<button class="skin-btn skin-btn-active" onclick="equipSkin('${skin.id}')">✅ Надето</button>`;
        } else {
            btnHtml = `<button class="skin-btn skin-btn-equip" onclick="equipSkin('${skin.id}')">${skin.category === 'trail' ? '✨' : '👤'} Надеть</button>`;
        }
        
        card.innerHTML = `
            <div class="skin-icon">${skin.emoji}</div>
            <div class="skin-name">${skin.name}</div>
            <div class="skin-rank">${rankName}</div>
            <div class="skin-actions">${btnHtml}</div>
        `;
        container.appendChild(card);
    });
}

// ============================================================
//          БОНУСНЫЕ ЗАДАНИЯ НА УРОВЕНЬ (CHALLENGES)
// ============================================================

let levelChallenges = [];
let recentChallengeIds = []; // последние 5 id заданий (чтобы не повторялись)
let lastLevelChallengesCompleted = false; // все задания прошлого уровня выполнены?
const CHALLENGE_TYPES = [
    { id: 'full_collect', desc: 'Собери все предметы', 
      canGenerate: () => true,
      check: () => collectedNuts >= totalNuts,
      isFailed: () => timeLeft <= 0 && collectedNuts < totalNuts },
    { id: 'no_damage', desc: 'Пройди без потери жизней', 
      canGenerate: () => true,
      check: () => lives >= 3,
      isFailed: () => lives < 3 },
    { id: 'speed_run', desc: 'Пройди за <30 сек', 
      canGenerate: () => true,
      check: () => timeLeft > 20,
      isFailed: () => timeLeft <= 20 },
    { id: 'all_traps', desc: 'Уничтожь все ловушки', 
      canGenerate: () => getTrapCount() > 0,
      check: () => {
        const total = getTrapCount();
        return total > 0 && destroyedTraps >= total;
      },
      isFailed: () => destroyedTraps < getTrapCount() && collectedNuts >= totalNuts },
    { id: 'few_jumps', desc: 'Меньше 10 прыжков', 
      canGenerate: () => true,
      check: () => totalJumpsThisLevel <= 10,
      isFailed: () => totalJumpsThisLevel > 10 },
    { id: 'combo_master', desc: 'Комбо 5+', 
      canGenerate: () => true,
      check: () => maxCombo >= 5 && collectedNuts >= totalNuts,
      isFailed: () => false }
];
let totalJumpsThisLevel = 0;
let lastBoostLevel = 0; // уровень, на котором последний раз был выбран бонус
let lastChanceUsed = false; // был ли использован "последний шанс"
let wasBonusLevelPromptActive = false; // флаг, что только что был показан бонус-уровень

// Бонус (бафф), выбранный перед уровнем
let activeBoost = null;
// Пулы бонусов по диапазонам уровней
function getBoostPool(levelNum) {
    if (levelNum <= 8) {
        return [
            { id: 'time',    name: '🕐 +10 сек',     desc: '+10 секунд',           cost: 0,  apply: () => { timeLeft += 10; } },
            { id: 'life',    name: '❤️ +1 жизнь',    desc: '+1 жизнь',             cost: 50, apply: () => { lives++; } },
            { id: 'magnet',  name: '🧲 Магнит',       desc: 'Притяжение орехов',    cost: 70, apply: () => { gameState.hasMagnet = true; } }
        ];
    } else if (levelNum <= 20) {
        return [
            { id: 'time',    name: '🕐 +15 сек',     desc: '+15 секунд',           cost: 0,  apply: () => { timeLeft += 15; } },
            { id: 'shield',  name: '🛡️ Неуязвимость', desc: '5 сек защиты',        cost: 100, apply: () => { 
                gameState.isInvincible = true;
                player.hue = 0;
                clearTimeout(invincibilityTimer);
                invincibilityTimer = setTimeout(() => { gameState.isInvincible = false; }, 5000);
            }},
            { id: 'speed',   name: '👟 +30% бег',    desc: '+30% скорости',        cost: 80, apply: () => { player.speed *= 1.3; } }
        ];
    } else {
        return [
            { id: 'time',    name: '🕐 +20 сек',     desc: '+20 секунд',           cost: 0,  apply: () => { timeLeft += 20; } },
            { id: 'double',  name: '💰 ×2 очков',    desc: '×2 за сбор',           cost: 150, apply: () => { /* handled */ } },
            { id: 'aim',     name: '🎯 +5 комбо',    desc: '+5 к комбо',           cost: 120, apply: () => { /* handled */ } }
        ];
    }
}
let isDoubleScoreActive = false;
let isAimBoostActive = false;

// Бонусный уровень
let isBonusLevel = false;
let bonusLevelTimer = 0;
let bonusLevelItems = [];
const BONUS_LEVEL_DURATION = 30; // секунд
const BONUS_LEVEL_TRIGGERS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 39, 42, 45];
let invincibilityBonus = null;
let invincibilityDuration = 10000;
let invincibilityTimer = null;
let nutEffects = [];
let traps = [];
let enemy = null;

// Глобальная статистика (для ачивок)
let totalNutsCollected = 0;
let totalTrapsDestroyed = 0;
let totalEnemiesKilled = 0;
let totalJumps = 0;
let totalPlayTime = 0;
let maxLevelReached = 1;

// ============================================================
//               СИСТЕМА КАРТЫ УРОВНЕЙ
// ============================================================

// Статусы уровней: 0 = locked, 1 = completed, 2 = current
let levelProgress = [];
const BIOMES = [
    { name: '🌲 Лес',           start: 1,  end: 3 },
    { name: '🌿 Болото',        start: 4,  end: 6 },
    { name: '🏘️ Деревня',       start: 7,  end: 9 },
    { name: '🕯️ Пещера',        start: 10, end: 12 },
    { name: '🌾 Саванна',       start: 13, end: 15 },
    { name: '🏜️ Пустыня',       start: 16, end: 18 },
    { name: '⛰️ Горы',          start: 19, end: 21 },
    { name: '🏛️ Руины',         start: 22, end: 24 },
    { name: '🔥 Пожар',         start: 25, end: 27 },
    { name: '🌋 Вулкан',        start: 28, end: 30 },
    { name: '🏴‍☠️ Пираты',      start: 31, end: 33 },
    { name: '🌊 Море',          start: 34, end: 36 },
    { name: '🦖 Джунгли',       start: 37, end: 39 },
    { name: '🏰 Замок',         start: 40, end: 42 },
    { name: '🌌 Космос',        start: 43, end: 45 },
    { name: '❄️ Финал',         start: 46, end: 48 }
];

function initLevelProgress() {
    levelProgress = new Array(49).fill(0); // индекс 0 не используется
    // Первый уровень — текущий
    levelProgress[1] = 2;
}

function saveLevelProgress() {
    localStorage.setItem('levelProgress', JSON.stringify(levelProgress));
}

function loadLevelProgress() {
    const saved = localStorage.getItem('levelProgress');
    if (saved) {
        levelProgress = JSON.parse(saved);
        // Синхронизируем уровень с прогрессом
        if (levelProgress[level] !== 2) {
            // Ищем текущий (2) или первый неразблокированный
            const curIdx = levelProgress.indexOf(2);
            if (curIdx > 0) {
                level = curIdx;
            } else {
                // Если нет текущего — ставим первый непройденный
                for (let i = 1; i <= 36; i++) {
                    if (levelProgress[i] === 0) {
                        level = i;
                        levelProgress[i] = 2;
                        break;
                    }
                }
            }
        }
        // Обновляем maxLevelReached
        for (let i = 36; i >= 1; i--) {
            if (levelProgress[i] === 1 || levelProgress[i] === 2) {
                maxLevelReached = i;
                break;
            }
        }
    } else {
        initLevelProgress();
    }
}

function unlockNextLevel() {
    // Помечаем текущий уровень как пройденный
    if (level >= 1 && level <= 48) {
        levelProgress[level] = 1;
    }
    // Открываем следующий
    const nextLevel = level + 1;
    if (nextLevel <= 48 && levelProgress[nextLevel] === 0) {
        levelProgress[nextLevel] = 2; // новый текущий
    }
    // Обновляем maxLevelReached
    if (level > maxLevelReached) maxLevelReached = level;
    saveLevelProgress();
}

function showLevelMap(fromPause) {
    // Если открыто из паузы, не останавливаем игру — это просто просмотр
    if (!fromPause) {
        // Из главного меню
        document.getElementById('mainMenu').style.display = 'none';
        gameState.isPaused = true;
    }
    
    gameState.levelChanging = false; // сбрасываем блокировку обновления
    
    lowerMusicVolume();
    document.getElementById('levelMap').style.display = 'block';
    renderLevelMap();
}

function showLevelMapFromPause() {
    document.getElementById('pauseScreen').style.display = 'none';
    showLevelMap(true);
}

function closeLevelMap() {
    document.getElementById('levelMap').style.display = 'none';
    restoreMusicVolume();
    
    gameState.levelChanging = false; // сбрасываем блокировку обновления
    
    // Если игра не запущена — возвращаемся в главное меню
    if (!gameState.isGameStarted) {
        document.getElementById('mainMenu').style.display = 'flex';
    } else {
        // Иначе — на паузу
        document.getElementById('pauseScreen').style.display = 'flex';
        gameState.isPaused = true;
    }
}

function renderLevelMap() {
    const container = document.getElementById('levelMapContainer');
    const progressText = document.getElementById('levelMapProgress');
    if (!container) return;
    
    // Считаем пройденные
    const completed = levelProgress.filter(s => s === 1).length;
    const current = levelProgress.indexOf(2);
    progressText.textContent = `Пройдено: ${completed} / 36  |  Текущий: ${current > 0 ? current : 1}`;
    
    container.innerHTML = '';
    
    BIOMES.forEach(biome => {
        const group = document.createElement('div');
        group.className = 'level-node-group';
        
        const label = document.createElement('div');
        label.className = 'biome-label';
        label.textContent = biome.name;
        group.appendChild(label);
        
        for (let i = biome.start; i <= biome.end; i++) {
            const node = document.createElement('div');
            node.className = 'level-node';
            node.textContent = i;
            node.dataset.level = i;
            
            const status = levelProgress[i];
            
            if (status === 1) {
                node.classList.add('completed');
            } else if (status === 2) {
                node.classList.add('current');
            } else {
                node.classList.add('locked');
            }
            
            // Тултип при наведении
            const config = LEVEL_CONFIGS[i];
            const biomeInfo = BIOMES.find(b => i >= b.start && i <= b.end);
            let tooltipText = `Уровень ${i}`;
            if (biomeInfo) tooltipText += ` — ${biomeInfo.name}`;
            if (config && config.collectible) {
                const itemNames = {
                    'nut.png': '🥜 Орешки',
                    'log.png': '🪵 Поленья',
                    'apple.png': '🍎 Яблоки',
                    'mushroom.png': '🍄 Грибы',
                    'savannaplant.png': '🌿 Растения',
                    'cactus.png': '🌵 Кактусы',
                    'stone.png': '🪨 Камни',
                    'artifact.png': '🏺 Артефакты',
                    'treasure.png': '💎 Сокровища',
                    'raspberry.png': '🍓 Ягоды',
                    'volcrystal.png': '💎 Кристаллы'
                };
                const itemName = itemNames[config.collectible] || config.collectible;
                tooltipText += `\nСобираем: ${itemName}`;
            }
            if (status === 0) {
                tooltipText += '\n🔒 Заблокирован';
            } else if (status === 1) {
                tooltipText += '\n✅ Пройден';
            } else {
                tooltipText += '\n▶ Текущий';
            }
            node.title = tooltipText;
            
            // Клик — переход на уровень
            node.addEventListener('click', () => {
                selectLevel(i);
            });
            
            group.appendChild(node);
        }
        
        container.appendChild(group);
    });
}

function selectLevel(num) {
    if (num < 1 || num > 48) return;
    
    const status = levelProgress[num];
    
    // Заблокированный уровень
    if (status === 0) {
        showNotification('🔒 Сначала пройди предыдущие уровни!', 2000);
        return;
    }
    
    // Отменяем любой pending таймер завершения уровня
    if (_completeLevelTimer) {
        clearTimeout(_completeLevelTimer);
        _completeLevelTimer = null;
    }
    
    // Принудительно скрываем экран результатов, если он ещё виден
    const resultScreen = document.getElementById("resultScreen");
    if (resultScreen) {
        resultScreen.classList.remove('result-active');
        resultScreen.style.display = 'none';
        resultScreen.style.pointerEvents = "none";
        const resultContent = document.getElementById("resultContent");
        if (resultContent) resultContent.style.display = "none";
    }
    // Показываем canvas снова
    document.getElementById('gameCanvas').style.display = 'block';
    gameState.levelChanging = false;
    
    // Если игра ещё не запущена (из главного меню) — запускаем
    if (!gameState.isGameStarted) {
        gameState.isGameStarted = true;
        gameState.isPaused = false;
        lastLevelChallengesCompleted = false;
        lastChanceUsed = false;
        
        const storyDiv = document.getElementById('story');
        const mainMenu = document.getElementById('mainMenu');
        if (storyDiv) storyDiv.style.display = 'none';
        if (mainMenu) mainMenu.style.display = 'none';
        
        const bgMusic = document.getElementById('backgroundMusic');
        if (bgMusic && bgMusic.paused) {
            bgMusic.play().catch(() => {});
        }
    }
    
    // Закрываем карту
    document.getElementById('levelMap').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    gameState.isPaused = false;
    
    // Устанавливаем уровень
    level = num;
    
    // Если уровень уже пройден — обновляем, что это текущий
    if (status === 1) {
        // Снимаем флаг "текущий" с других
        for (let i = 1; i <= 36; i++) {
            if (levelProgress[i] === 2) levelProgress[i] = 1;
        }
        levelProgress[num] = 2;
        saveLevelProgress();
    } else if (status === 2) {
        // Уже текущий — просто загружаем
    }
    
    currentBackgroundImg = getBackgroundImage(level);
    applyLevelConfig(level);
    resetLevel();
}

// Интеграция с текущей системой — вызываем после прохождения уровня
function completeLevelAndShowMap() {
    // Сначала стандартная логика завершения
    completeLevel();
    // unlockNextLevel вызывается в completeLevel через setTimeout
    // Но нам нужно показать карту после подсчёта очков
}

// Патчим completeLevel для показа карты после завершения
// Обработка уже есть в completeLevel — показываем либо бонус, либо карту
// Вместо level++ показываем карту

// Анимация спрайта
let frameIndex = 0;
let frameCount = 4;
let frameWidth = 200;
let frameHeight = 200;
let animationSpeed = 8;
let movementCounter = 0;

// Физика
const gravity = 0.6;
const jumpStrength = -12;
let platformSpeed = 2;
let platformDirection = 1;

// Частицы и эффекты
let particles = [];
let explosions = [];
let blink = 1;
let shakeOffsetX = 0;
let shakeOffsetY = 0;
let blinkSpeed = 0.1;

// Screen Shake
let screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };

// ============================================================
//          LOCATION FEATURES - feshki lokatsiy
// ============================================================
let locationFeatureActive = false;
let locationFeatureTimer = 0;
let roosterCrowTimer = 0;
let roosterShakeIntensity = 0;
let disorientationTimer = 0;
let keysInverted = false;
let fallingRocks = [];
let rockWarningDuration = 60;
const ROCK_FALL_SPEED = 6;
let ghostTimer = 0;
let ghostPhase = 0;
let firePlatforms = [];
let fireSpreadTimer = 0;
let screenTilt = 0;
let screenTiltDirection = 1;
const MAX_TILT = 0.04;
let tiltSweepTime = 0;
let LOW_GRAVITY = false;
let ICE_MODE = false;
let iceFriction = 0.98;

// Пещера — мерцающий свет
let caveDarkTimer = 0;
let caveDarkActive = false;
let caveDarkDuration = 0;

// Пустыня — песчаная буря
let sandStormTimer = 0;
let sandStormActive = false;
let sandStormDuration = 0;
const SAND_STORM_PUSH = 0.4;

// Комбо-система
let comboCount = 0;
let comboTimer = 0;
let maxCombo = 0;

// Parallax
let parallaxOffset = 0;
let parallaxLayers = []; // слои для параллакса
let runningParticles = []; // частицы пыли при беге
let jumpParticles = []; // частицы эффекта прыжка
let nutGlowIntensity = 0; // для пульсации свечения

// Таймер
let timerInterval = null;
let _completeLevelTimer = null; // ID таймера для completeLevel

// Изображения
const nutImg = new Image();
nutImg.src = 'nut.png';
const clockImg = new Image();
clockImg.src = 'clock.png';
const liveImg = new Image();
liveImg.src = 'addlive.png';
const invincibilityBonusImg = new Image();
invincibilityBonusImg.src = 'invincibilty.png';
const safetyPlatformImg = new Image();
safetyPlatformImg.src = 'stone.png';
const trapImg = new Image();
trapImg.src = 'trap.png';
const wolfImg = new Image();
wolfImg.src = 'boaricon.png';
const bobrSprite = new Image();
bobrSprite.src = 'bobr-sprite.png';
const groundImg = new Image();
groundImg.src = 'img/grounds/ground.png';

// Ленивая загрузка фонов — не загружаем все 36 сразу
const backgroundImgCache = {};
function getBackgroundImage(levelNum) {
    const config = LEVEL_CONFIGS[levelNum];
    // Если у уровня есть кастомный backImg (например для уровней 34+)
    if (config && config.backImg && config.backImg.length > 0) {
        const cacheKey = 'c_' + levelNum;
        if (!backgroundImgCache[cacheKey]) {
            backgroundImgCache[cacheKey] = new Image();
            backgroundImgCache[cacheKey].src = config.backImg;
        }
        return backgroundImgCache[cacheKey];
    }
    // Иначе — стандартный backXX.jpg
    const idx = Math.max(1, Math.min(levelNum, 48));
    if (!backgroundImgCache[idx]) {
        backgroundImgCache[idx] = new Image();
        backgroundImgCache[idx].src = `img/backs/back${String(idx).padStart(2, '0')}.jpg`;
    }
    return backgroundImgCache[idx];
}
// Предзагружаем только первый фон при старте
const backgroundImgs = [new Image()];
backgroundImgs[0].src = 'img/backs/back01.jpg';
// Кеш для быстрого доступа (для обратной совместимости с currentBackgroundImg)
// Теперь currentBackgroundImg = getBackgroundImage(level) вместо backgroundImgs[level-1]

// Звуки
const jumpSound = new Audio('sounds/jump1.mp3');
const eatSound = new Audio('sounds/eat.mp3');
const addTimeSound = new Audio('sounds/addtime.mp3');

// Вспомогательная функция для приглушения фоновой музыки
function lowerMusicVolume() {
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) bgMusic.volume = musicVolume * 0.2;
}

// Вспомогательная функция для восстановления громкости фоновой музыки
function restoreMusicVolume() {
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) bgMusic.volume = musicVolume;
}

// Звук шагов
const stepsSound = new Audio('sounds/steps.mp3');
stepsSound.volume = 0.3;

// Звук крика петуха (локация Деревня 7-9)
const roosterSound = new Audio('Sounds/kokoko.ogg');
roosterSound.volume = 0.6;

// Новые звуки
const ouchSound = new Audio('sounds/ouch.mp3');
const fallSound = new Audio('sounds/fall.mp3');
const invincibleSound = new Audio('sounds/invincible.mp3');
const hitSound = new Audio('sounds/hit.mp3');
const minekillSound = new Audio('sounds/minekill.mp3');
const levelCompleteSound = new Audio('sounds/levelcomplete.mp3');
const selectSound = new Audio('sounds/select.mp3');
const achievementSound = new Audio('sounds/achievement.mp3');
const newRankSound = new Audio('sounds/newrank.mp3');
const powerupSound = new Audio('sounds/powerup.mp3');

// ============================================================
//                 КОНФИГУРАЦИЯ УРОВНЕЙ
// ============================================================

const LEVEL_CONFIGS = [
    { // 0 - запасной
        collectible: 'nut.png', ground: 'img/grounds/ground.png',
        enemy: 'boaricon.png', name: 'Орешков: ', music: 'sounds/music1.mp3',
        backStory: '', backImg: 'img/backs/story.jpg'
    },
    { // 1 - Лес (начальный)
        collectible: 'nut.png', ground: 'img/grounds/ground.png',
        enemy: 'boaricon.png', name: 'Орешков: ', music: 'sounds/music1.mp3',
        backStory: '', backImg: 'img/backs/back_les1.jpg'
    },
    { // 2
        collectible: 'nut.png', ground: 'img/grounds/ground.png',
        enemy: 'boaricon.png', name: 'Орешков: ', music: 'sounds/music1.mp3',
        backStory: '', backImg: 'img/backs/back_les2.jpg'
    },
    { // 3 - Босс (Лес) — конфиг как у 1-2, смена на болото ТОЛЬКО после прохождения
        collectible: 'nut.png', ground: 'img/grounds/ground.png',
        enemy: 'boaricon.png', name: 'Орешков: ', music: 'sounds/music1.mp3',
        backStory: 'Бубор все лето и осень усердно собирал орешки в лесу.<br>Завершив сбор орешков, Бубор сел на берег реки и с улыбкой посмотрел на свои труды.<br>Он знал, что сделал всё необходимое, чтобы его братья не голодали зимой.<br>Теперь можно приступать к следующей задаче: нам нужны дома, где будет уютно и тепло.<br>С утра пораньше Бубор отправился к болоту за поленьями и бревнами для новых бобриных хаток...',
        backImg: 'img/backs/back_les3.jpg',
        storyImg: 'img/backs/story2.jpg'
    },
    { // 4 - Болото (начинается ПОСЛЕ прохождения 3-го босса)
        collectible: 'log.png', ground: 'img/grounds/groundswamp.png',
        enemy: 'img/char/crocicon.png', name: 'Полешки: ', music: 'sounds/music-swamp.mp3',
        backStory: '', backImg: 'img/backs/back_swamp1.jpg'
    },
    { // 5
        collectible: 'log.png', ground: 'img/grounds/groundswamp.png',
        enemy: 'img/char/crocicon.png', name: 'Полешки: ', music: 'sounds/music-swamp.mp3',
        backStory: '', backImg: 'img/backs/back_swamp2.jpg'
    },
    { // 6 - Босс (Болото) — конфиг как у 4-5, смена на деревню ПОСЛЕ прохождения
        collectible: 'log.png', ground: 'img/grounds/groundswamp.png',
        enemy: 'img/char/crocicon.png', name: 'Полешки: ', music: 'sounds/music-swamp.mp3',
        backStory: 'Пройдя болото, Бубор отправился в дальнюю деревню,<br>где живут добродушные люди, готовые помочь собрать припасы на зиму.<br>Но местные жители предупреждают Бубора о крикливом петухе, который может помешать...',
        backImg: 'img/backs/back_swamp3.jpg',
        storyImg: 'img/backs/story-village.jpg'
    },
    { // 7 - Деревня (начинается ПОСЛЕ прохождения 6-го босса)
        collectible: 'apple.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/roostericon.png', name: 'Яблоки: ', music: 'sounds/music-village.mp3',
        backStory: '', backImg: 'img/backs/back_village1.jpg'
    },
    { // 8
        collectible: 'apple.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/roostericon.png', name: 'Яблоки: ', music: 'sounds/music-village.mp3',
        backStory: '', backImg: 'img/backs/back_village2.jpg'
    },
    { // 9 - Босс (Деревня) — конфиг как у 7-8, смена на пещеру ПОСЛЕ прохождения
        collectible: 'apple.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/roostericon.png', name: 'Яблоки: ', music: 'sounds/music-village.mp3',
        backStory: 'Неожиданно, Бубор проваливается под землю.<br>В подземном царстве полно опасностей.<br>Зато здесь растут вкуснейшие пещерные грибы.<br>В поисках выхода из пещер, наш Бубор решает собрать несколько грибочков на зиму...',
        backImg: 'img/backs/back_village3.jpg',
        storyImg: 'img/backs/story-cave.jpg'
    },
    { // 10 - Пещера (начинается ПОСЛЕ прохождения 9-го босса)
        collectible: 'mushroom.png', ground: 'img/grounds/groundcave.png',
        enemy: 'img/char/spidericon.png', name: 'Грибы: ', music: 'sounds/music-cave.mp3',
        backStory: '', backImg: 'img/backs/back_cave1.jpg'
    },
    { // 11
        collectible: 'mushroom.png', ground: 'img/grounds/groundcave.png',
        enemy: 'img/char/spidericon.png', name: 'Грибы: ', music: 'sounds/music-cave.mp3',
        backStory: '', backImg: 'img/backs/back_cave2.jpg'
    },
    { // 12 - Босс (Пещера) — конфиг как у 10-11, смена на саванну ПОСЛЕ прохождения
        collectible: 'mushroom.png', ground: 'img/grounds/groundcave.png',
        enemy: 'img/char/spidericon.png', name: 'Грибы: ', music: 'sounds/music-cave.mp3',
        backStory: 'После долгого пути Бубор попадает в саванну,<br>где царит жара и царствуют дикие животные.<br>Что можно найти в этом жарком месте?',
        backImg: 'img/backs/back_cave3.jpg',
        storyImg: 'img/backs/story-savanna.jpg'
    },
    { // 13 - Саванна (начинается ПОСЛЕ прохождения 12-го босса)
        collectible: 'savannaplant.png', ground: 'img/grounds/groundsavanna.png',
        enemy: 'img/char/elefanticon.png', name: 'Растения: ', music: 'sounds/music-savanna.mp3',
        backStory: '', backImg: 'img/backs/back_savanna1.jpg'
    },
    { // 14
        collectible: 'savannaplant.png', ground: 'img/grounds/groundsavanna.png',
        enemy: 'img/char/elefanticon.png', name: 'Растения: ', music: 'sounds/music-savanna.mp3',
        backStory: '', backImg: 'img/backs/back_savanna2.jpg'
    },
    { // 15 - Босс (Саванна) — конфиг как у 13-14, смена на пустыню ПОСЛЕ прохождения
        collectible: 'savannaplant.png', ground: 'img/grounds/groundsavanna.png',
        enemy: 'img/char/elefanticon.png', name: 'Растения: ', music: 'sounds/music-savanna.mp3',
        backStory: 'В поисках редких минералов и плодов кактусов бобр отправляется в пустыню.<br>Здесь жарко и сухо, но он полон решимости<br>собрать необычные предметы для пополнения своих запасов',
        backImg: 'img/backs/back_savanna3.jpg',
        storyImg: 'img/backs/story-desert.jpg'
    },
    { // 16 - Пустыня (начинается ПОСЛЕ прохождения 15-го босса)
        collectible: 'cactus.png', ground: 'img/grounds/grounddesert.png',
        enemy: 'img/char/lizicon.png', name: 'Кактусов: ', music: 'sounds/music3.mp3',
        backStory: '', backImg: 'img/backs/back_desert1.jpg'
    },
    { // 17
        collectible: 'cactus.png', ground: 'img/grounds/grounddesert.png',
        enemy: 'img/char/lizicon.png', name: 'Кактусов: ', music: 'sounds/music3.mp3',
        backStory: '', backImg: 'img/backs/back_desert2.jpg'
    },
    { // 18 - Босс (Пустыня) — конфиг как у 16-17, смена на горы ПОСЛЕ прохождения
        collectible: 'cactus.png', ground: 'img/grounds/grounddesert.png',
        enemy: 'img/char/lizicon.png', name: 'Кактусов: ', music: 'sounds/music3.mp3',
        backStory: 'Наш Бобр отправился в горы,<br>чтобы найти крепкие камни и травы для укрепления хаток.<br>Здесь его ждут новые испытания — скалистые тропы и обрывы, и горный козлик',
        backImg: 'img/backs/back_desert3.jpg',
        storyImg: 'img/backs/story-mountains.jpg'
    },
    { // 19 - Горы (начинаются ПОСЛЕ прохождения 18-го босса)
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/goaticon.png', name: 'Камней: ', music: 'sounds/music-mountains.mp3',
        backStory: '', backImg: 'img/backs/back_mountains1.jpg'
    },
    { // 20
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/goaticon.png', name: 'Камней: ', music: 'sounds/music-mountains.mp3',
        backStory: '', backImg: 'img/backs/back_mountains2.jpg'
    },
    { // 21 - Босс (Горы) — конфиг как у 19-20, смена на руины ПОСЛЕ прохождения
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/goaticon.png', name: 'Камней: ', music: 'sounds/music-mountains.mp3',
        backStory: 'Бубор натыкается на древние руины, полные загадок и тайн.<br>Легенда гласит, что здесь сокрыты сокровища и артефакты древней цивилизации.<br>Но духи прошлого охраняют руины, и их можно потревожить, если не быть осторожным.',
        backImg: 'img/backs/back_mountains3.jpg',
        storyImg: 'img/backs/story-ruins.jpg'
    },
    { // 22 - Руины (начинаются ПОСЛЕ прохождения 21-го босса)
        collectible: 'artifact.png', ground: 'img/grounds/groundruins.png',
        enemy: 'img/char/skeltionicon.png', name: 'Артефакты: ', music: 'sounds/music-ruins.mp3',
        backStory: '', backImg: 'img/backs/back_ruins1.jpg'
    },
    { // 23
        collectible: 'artifact.png', ground: 'img/grounds/groundruins.png',
        enemy: 'img/char/skeltionicon.png', name: 'Артефакты: ', music: 'sounds/music-ruins.mp3',
        backStory: '', backImg: 'img/backs/back_ruins2.jpg'
    },
    { // 24 - Босс (Руины) — конфиг как у 22-23, смена на пожар ПОСЛЕ прохождения
        collectible: 'artifact.png', ground: 'img/grounds/groundruins.png',
        enemy: 'img/char/skeltionicon.png', name: 'Артефакты: ', music: 'sounds/music-ruins.mp3',
        backStory: 'Внезапно, Бубор попадает в лес, охваченный огнём.<br>Местные жители просят его помочь собрать последние уцелевшие ягоды и травы,<br>прежде чем огонь уничтожит всё вокруг.',
        backImg: 'img/backs/back_ruins3.jpg',
        storyImg: 'img/backs/story-fire.jpg'
    },
    { // 25 - Пожар (начинается ПОСЛЕ прохождения 24-го босса)
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/phoenixicon.png', name: 'Камней: ', music: 'sounds/music-fire.mp3',
        backStory: '', backImg: 'img/backs/back_fire1.jpg'
    },
    { // 26
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/phoenixicon.png', name: 'Камней: ', music: 'sounds/music-fire.mp3',
        backStory: '', backImg: 'img/backs/back_fire2.jpg'
    },
    { // 27 - Босс (Пожар) — конфиг как у 25-26, смена на вулкан ПОСЛЕ прохождения
        collectible: 'stone.png', ground: 'img/grounds/groundmountains.png',
        enemy: 'img/char/phoenixicon.png', name: 'Камней: ', music: 'sounds/music-fire.mp3',
        backStory: 'Услышав о лавовых кристаллах, которые дарят силу,<br>Бубор решает рискнуть и отправиться к вулкану.<br>Здесь горячий воздух и магма, но бобр знает,<br>что кристаллы помогут холодной зимой.',
        backImg: 'img/backs/back_fire3.jpg',
        storyImg: 'img/backs/story-volcano.jpg'
    },
    { // 28 - Вулкан (начинается ПОСЛЕ прохождения 27-го босса)
        collectible: 'volcrystal.png', ground: 'img/grounds/groundvolcano.png',
        enemy: 'img/char/phoenixicon.png', name: 'Кристалов: ', music: 'sounds/music-volcano.mp3',
        backStory: '', backImg: 'img/backs/back_vulcan1.jpg'
    },
    { // 29
        collectible: 'volcrystal.png', ground: 'img/grounds/groundvolcano.png',
        enemy: 'img/char/phoenixicon.png', name: 'Кристалов: ', music: 'sounds/music-volcano.mp3',
        backStory: '', backImg: 'img/backs/back_vulcan2.jpg'
    },
    { // 30 - Босс (Вулкан) — конфиг как у 28-29, смена на пиратов ПОСЛЕ прохождения
        collectible: 'volcrystal.png', ground: 'img/grounds/groundvolcano.png',
        enemy: 'img/char/phoenixicon.png', name: 'Кристалов: ', music: 'sounds/music-volcano.mp3',
        backStory: 'Судьба забрасывает Бубора на пиратский остров,<br>полный тайн и золота.<br>По легендам, здесь зарыты бесчисленные сокровища, но пираты стерегут каждый уголок острова.',
        backImg: 'img/backs/back_vulcan3.jpg',
        storyImg: 'img/backs/story-pirates.jpg'
    },
    { // 31 - Пиратский остров (начинается ПОСЛЕ прохождения 30-го босса)
        collectible: 'treasure.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/skeltionicon.png', name: 'Сокровища: ', music: 'sounds/music-pirates.mp3',
        backStory: '', backImg: 'img/backs/back_pirate1.jpg'
    },
    { // 32
        collectible: 'treasure.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/skeltionicon.png', name: 'Сокровища: ', music: 'sounds/music-pirates.mp3',
        backStory: '', backImg: 'img/backs/back_pirate2.jpg'
    },
    { // 33 - Босс (Пираты) — конфиг как у 31-32, смена на снег ПОСЛЕ прохождения
        collectible: 'treasure.png', ground: 'img/grounds/groundvillage.png',
        enemy: 'img/char/skeltionicon.png', name: 'Сокровища: ', music: 'sounds/music-pirates.mp3',
        backStory: 'Теперь Бубор не только собрал орешки для братьев,<br>но и накопил достаточно материалов для строительства уютных хаток.<br>Но на этом забота Бубора не закончилась.<br>Он решил, что раз уже всё готово к зиме, можно устроить праздник для братьев.<br>И что может быть лучше, чем пир с сочными зимними ягодами?',
        backImg: 'img/backs/back_pirate3.jpg',
        storyImg: 'img/backs/story3.jpg'
    },
    // ====== ПЕРЕСТАНОВКА: Море, Джунгли, Замок, Космос, Финал ======
    // 34-36: 🌊 Море
    { // 34
        collectible: 'img/items/pearl.png', ground: 'img/grounds/groundsea.png',
        enemy: 'img/char/sharkicon.png', name: 'Жемчуга: ', music: 'sounds/music-sea.mp3',
        backStory: '', backImg: 'img/backs/back_sea1.jpg'
    },
    { // 35
        collectible: 'img/items/pearl.png', ground: 'img/grounds/groundsea.png',
        enemy: 'img/char/sharkicon.png', name: 'Жемчуга: ', music: 'sounds/music-sea.mp3',
        backStory: '', backImg: 'img/backs/back_sea2.jpg'
    },
    { // 36 - Босс (Море)
        collectible: 'img/items/pearl.png', ground: 'img/grounds/groundsea.png',
        enemy: 'img/char/sharkicon.png', name: 'Жемчуга: ', music: 'sounds/music-sea.mp3',
        backStory: 'Бубор переплыл океан и оказался в затопленном городе.<br>Местные рыбки рассказали ему, что на дне моря покоятся древние жемчужины,<br>которые могут подарить невероятную силу тому, кто их соберёт.<br>Но охраняет их огромная акула, что бороздит подводные глубины.',
        backImg: 'img/backs/back_sea3.jpg'
    },
    // 37-39: 🦖 Джунгли
    { // 37
        collectible: 'img/items/banana.png', ground: 'img/grounds/groundjungle.png',
        enemy: 'img/char/dinoicon.png', name: 'Бананов: ', music: 'sounds/music-jungle.mp3',
        backStory: '', backImg: 'img/backs/back_jungle1.jpg'
    },
    { // 38
        collectible: 'img/items/banana.png', ground: 'img/grounds/groundjungle.png',
        enemy: 'img/char/dinoicon.png', name: 'Бананов: ', music: 'sounds/music-jungle.mp3',
        backStory: '', backImg: 'img/backs/back_jungle2.jpg'
    },
    { // 39 - Босс (Джунгли)
        collectible: 'img/items/banana.png', ground: 'img/grounds/groundjungle.png',
        enemy: 'img/char/dinoicon.png', name: 'Бананов: ', music: 'sounds/music-jungle.mp3',
        backStory: 'Густые джунгли полны загадок и опасностей.<br>Бубор пробирается сквозь лианы и кустарники в поисках сладких бананов,<br>но в глубине леса его поджидает свирепый динозавр,<br>который не хочет делиться своими запасами.',
        backImg: 'img/backs/back_jungle3.jpg'
    },
    // 40-42: 🏰 Замок
    { // 40
        collectible: 'img/items/wheet.png', ground: 'img/grounds/groundcastle.png',
        enemy: 'img/char/knighticon.png', name: 'Колосков: ', music: 'sounds/music-castle.mp3',
        backStory: '', backImg: 'img/backs/back_castle1.jpg'
    },
    { // 41
        collectible: 'img/items/wheet.png', ground: 'img/grounds/groundcastle.png',
        enemy: 'img/char/knighticon.png', name: 'Колосков: ', music: 'sounds/music-castle.mp3',
        backStory: '', backImg: 'img/backs/back_castle2.jpg'
    },
    { // 42 - Босс (Замок)
        collectible: 'img/items/wheet.png', ground: 'img/grounds/groundcastle.png',
        enemy: 'img/char/knighticon.png', name: 'Колосков: ', music: 'sounds/music-castle.mp3',
        backStory: 'Бубор попадает в старинный замок, где по легенде хранятся золотые колосья.<br>Но замок охраняет благородный рыцарь, который не пускает чужаков.<br>Бубор должен проявить ловкость и смекалку,<br>чтобы собрать урожай и доказать, что он достоин награды.',
        backImg: 'img/backs/back_castle3.jpg'
    },
    // 43-45: 🌌 Космос
    { // 43
        collectible: 'img/items/aliens.png', ground: 'img/grounds/groundspace.png',
        enemy: 'img/char/alienicon.png', name: 'Артефактов: ', music: 'sounds/music-space.mp3',
        backStory: '', backImg: 'img/backs/back_space1.jpg'
    },
    { // 44
        collectible: 'img/items/aliens.png', ground: 'img/grounds/groundspace.png',
        enemy: 'img/char/alienicon.png', name: 'Артефактов: ', music: 'sounds/music-space.mp3',
        backStory: '', backImg: 'img/backs/back_space2.jpg'
    },
    { // 45 - Босс (Космос)
        collectible: 'img/items/aliens.png', ground: 'img/grounds/groundspace.png',
        enemy: 'img/char/alienicon.png', name: 'Артефактов: ', music: 'sounds/music-space.mp3',
        backStory: 'В далёком космосе, среди звёзд и туманностей,<br>Бубор находит древнюю цивилизацию, оставившую после себя артефакты.<br>Но пришельцы не рады гостю — им нужны эти сокровища самим.<br>Бубору предстоит величайшее приключение в его жизни,<br>чтобы вернуться домой с космическими трофеями для братьев!',
        backImg: 'img/backs/back_space3.jpg'
    },
    // 46-48: ❄️ Финал
    { // 46
        collectible: 'raspberry.png', ground: 'img/grounds/groundice.png',
        enemy: 'img/char/wolficon.png', name: 'Ягодок: ', music: 'sounds/music-ice.mp3',
        backStory: '', backImg: 'img/backs/back_final1.jpg'
    },
    { // 47
        collectible: 'raspberry.png', ground: 'img/grounds/groundice.png',
        enemy: 'img/char/wolficon.png', name: 'Ягодок: ', music: 'sounds/music-ice.mp3',
        backStory: '', backImg: 'img/backs/back_final2.jpg'
    },
    { // 48 - Финальный босс (Финал)
        collectible: 'raspberry.png', ground: 'img/grounds/groundice.png',
        enemy: 'img/char/wolficon.png', name: 'Ягодок: ', music: 'sounds/music-ice.mp3',
        backStory: 'Теперь Бубор не только собрал орешки для братьев,<br>но и накопил достаточно материалов для строительства уютных хаток.<br>Но на этом забота Бубора не закончилась.<br>Он решил, что раз уже всё готово к зиме, можно устроить праздник для братьев.<br>И что может быть лучше, чем пир с сочными зимними ягодами?',
        backImg: 'img/backs/back_final3.jpg'
    }
];

// ============================================================
//                   ИНИЦИАЛИЗАЦИЯ
// ============================================================

function initGame() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    player.y = canvas.height - 150;
    
    currentBackgroundImg = getBackgroundImage(1);
    
    // Загружаем прогресс карты уровней
    loadLevelProgress();
    
    // Обработчики клавиш (добавляем WASD и Escape)
    window.addEventListener("keydown", (e) => {
        keys[e.key] = true;
        keys[e.code] = true;
        if (e.key === "Escape") {
            handleEscape();
        }
    });
    window.addEventListener("keyup", (e) => {
        keys[e.key] = false;
        keys[e.code] = false;
        // Сбрасываем флаг кнопки прыжка при отпускании клавиши прыжка
        if (e.key === " " || e.key === "w" || e.key === "W" || e.code === "KeyW" || e.code === "Space") {
            jumpButtonReleased = true;
        }
    });
    
    // Мобильное управление
    setupMobileControls();
    
    // Загружаем скины
    loadSkins();
    
    // Сохранение при закрытии вкладки
    window.addEventListener('beforeunload', () => {
        if (currentProfile && profiles[currentProfile]) {
            saveProfileData();
        }
    });
    
    // Загружаем туториал
    loadTutorialData();
    
    // Загружаем сохранённый ранг
    const savedRank = localStorage.getItem('playerRank');
    if (savedRank) {
        try {
            const parsed = JSON.parse(savedRank);
            // Проверяем, что ранг валиден и соответствует уровню
            if (parsed && parsed.id) {
                playerRank = parsed;
            }
        } catch(e) {}
    }
    // Слушаем изменение размеров окна (fullscreen, ресайз и т.д.)
    window.addEventListener('resize', resizeCanvas);
    
    // Инициализируем ежедневные задания
    initDailyChallenges();
    
    // Загружаем рекорды
    updateBestScoreDisplay();
}

// ============================================================
//                СОХРАНЕНИЕ / ЗАГРУЗКА
// ============================================================

function saveProgress() {
    const bgMusic = document.getElementById("backgroundMusic");
    const gameData = {
        level: level,
        lives: lives,
        nutImgSrc: nutImg.src,
        groundImgSrc: groundImg.src,
        wolfImgSrc: wolfImg.src,
        collectiblesName: collectiblesName,
        musicSrc: bgMusic ? bgMusic.src : '',
        // Сохраняем улучшения
        hasMagnet: gameState.hasMagnet,
        hasHat: gameState.hasHat,
        hasTailTrail: gameState.hasTailTrail,
        score: score
    };
    localStorage.setItem('gameProgress', JSON.stringify(gameData));
    showNotification("Прогресс сохранён!");
}

function loadProgress() {
    const savedData = localStorage.getItem('gameProgress');
    if (savedData) {
        const gameData = JSON.parse(savedData);
        level = gameData.level || 1;
        lives = gameData.lives || 3;
        score = gameData.score || 0;
        nutImg.src = gameData.nutImgSrc || 'nut.png';
        groundImg.src = gameData.groundImgSrc || 'img/grounds/ground.png';
        wolfImg.src = gameData.wolfImgSrc || 'img/char/wolficon.png';
        collectiblesName = gameData.collectiblesName || "Орешков: ";
        currentBackgroundImg = getBackgroundImage(level);
        
        // Восстанавливаем улучшения
        gameState.hasMagnet = gameData.hasMagnet || false;
        gameState.hasHat = gameData.hasHat || false;
        gameState.hasTailTrail = gameData.hasTailTrail || false;
        
        const bgMusic = document.getElementById("backgroundMusic");
        if (gameData.musicSrc && bgMusic) {
            bgMusic.pause();
            bgMusic.src = gameData.musicSrc;
            bgMusic.load();
            bgMusic.play();
        }
        
        // Загружаем скины и пересчитываем ранг
        loadSkins();
        checkRank();
        
        showNotification("Прогресс загружен!");
        resetLevel();
    } else {
        showNotification("Сохранений не найдено. Начинаем с начала.");
        level = 1;
        lives = 3;
        score = 0;
        resetLevel();
    }
    gameState.isPaused = false;
    togglePauseUI();
}

// ============================================================
//                    УПРАВЛЕНИЕ ПАУЗОЙ
// ============================================================

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    togglePauseUI();
}

function togglePauseUI() {
    const pauseScreen = document.getElementById("pauseScreen");
    const backgroundMusic = document.getElementById("backgroundMusic");
    
    if (!pauseScreen) return;
    
    if (gameState.isPaused) {
        pauseScreen.style.display = "flex";
        if (backgroundMusic) backgroundMusic.pause();
    } else {
        pauseScreen.style.display = "none";
        if (backgroundMusic) backgroundMusic.play();
    }
}

// ============================================================
//                   ОБРАБОТЧИК ESCAPE
// ============================================================

// Последовательное закрытие меню от глубоких к поверхностным
function handleEscape() {
    // Самые глубокие: оверлеи (ежедневные задания, лидеры, статистика, создание профиля)
    const dailyMenu = document.getElementById('dailyMenu');
    if (dailyMenu && dailyMenu.parentNode) {
        document.body.removeChild(dailyMenu);
        document.getElementById('mainMenu').style.display = 'flex';
        return;
    }
    const leaderboardMenu = document.getElementById('leaderboardMenu');
    if (leaderboardMenu && leaderboardMenu.parentNode) {
        document.body.removeChild(leaderboardMenu);
        document.getElementById('mainMenu').style.display = 'flex';
        return;
    }
    const statsMenu = document.getElementById('statsMenu');
    if (statsMenu && statsMenu.parentNode) {
        document.body.removeChild(statsMenu);
        document.getElementById('mainMenu').style.display = 'flex';
        return;
    }
    const profileCreateForm = document.getElementById('profileCreateForm');
    if (profileCreateForm && profileCreateForm.style.display === 'block') {
        hideCreateProfile();
        return;
    }
    // Меню ачивок
    const achievementsMenu = document.getElementById('achievementsMenu');
    if (achievementsMenu && achievementsMenu.style.display === 'block') {
        closeAchievementsMenu();
        return;
    }
    // Меню настроек
    const settingsMenu = document.getElementById('settingsMenu');
    if (settingsMenu && settingsMenu.style.display === 'block') {
        closeSettingsMenu();
        return;
    }
    // Меню улучшений (скины/бонусы/домик) — внутри игры, возврат на паузу
    const upgradesMenu = document.getElementById('upgradesMenu');
    if (upgradesMenu && upgradesMenu.style.display === 'block') {
        closeUpgradesMenu();
        return;
    }
    // Карта уровней
    const levelMap = document.getElementById('levelMap');
    if (levelMap && levelMap.style.display === 'block') {
        closeLevelMap();
        return;
    }
    // Сюжетная вставка
    const story = document.getElementById('story');
    if (story && story.style.display === 'flex') {
        continueAfterStory();
        return;
    }
    // Экран результатов
    const resultScreen = document.getElementById('resultScreen');
    if (resultScreen && resultScreen.style.display === 'flex') {
        // Не закрываем результат через Escape — игрок должен сам нажать кнопку
        return;
    }
    // Пауза (только если игра запущена)
    if (gameState.isGameStarted) {
        togglePause();
    }
}

// ============================================================
//                   МЕНЮ УЛУЧШЕНИЙ
// ============================================================

function openUpgradesMenu() {
    document.getElementById("pauseScreen").style.display = "none";
    document.getElementById("upgradesMenu").style.display = "block";
}

function closeUpgradesMenu() {
    document.getElementById("pauseScreen").style.display = "flex";
    document.getElementById("upgradesMenu").style.display = "none";
}

function showTab(tabId) {
    document.querySelectorAll('.upgradeTab').forEach(tab => {
        tab.style.display = 'none';
    });
    const tab = document.getElementById(tabId + 'Tab');
    if (tab) tab.style.display = 'block';
    // При открытии вкладки скинов — рендерим магазин
    if (tabId === 'skins') {
        renderShopSkins();
    }
    // При открытии вкладки домика — рендерим улучшения
    if (tabId === 'home') {
        renderHomeTab();
    }
}

function buyBonus(type, cost) {
    if (score >= cost) {
        score -= cost;
        if (type === 'extraLife') {
            lives++;
            showNotification('❤️ Куплена дополнительная жизнь!');
        } else if (type === 'magnet') {
            gameState.hasMagnet = true;
            showNotification('🧲 Магнит активирован! Орешки будут притягиваться!');
        } else if (type === 'doubleJump') {
            gameState.hasDoubleJump = true;
            gameState.doubleJumpPurchased = true;
            showNotification('🦘 Двойной прыжок активирован! Прыгай в воздухе ещё раз!');
        }
    } else {
        showNotification('Недостаточно очков!');
    }
}

function buySkin(type, cost) {
    if (score >= cost) {
        score -= cost;
        if (type === 'hat') {
            gameState.hasHat = true;
            showNotification('🎩 Шляпа надета! Бубор выглядит стильно!');
        } else if (type === 'tailTrail') {
            gameState.hasTailTrail = true;
            showNotification('🔥 Огненный след активирован!');
        }
    } else {
        showNotification('Недостаточно очков!');
    }
}

// ============================================================
//                   УВЕДОМЛЕНИЯ
// ============================================================

function showNotification(text, duration = 2000) {
    const existing = document.getElementById('notification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.id = 'notification';
    notif.textContent = text;
    Object.assign(notif.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 40px',
        background: 'rgba(0,0,0,0.85)',
        color: '#FFD700',
        fontSize: '28px',
        fontFamily: "'Comic Sans MS', cursive",
        borderRadius: '15px',
        zIndex: '2000',
        pointerEvents: 'none',
        textAlign: 'center',
        border: '2px solid #FFD700',
        boxShadow: '0 0 20px rgba(255,215,0,0.3)'
    });
    document.body.appendChild(notif);
    setTimeout(() => { if (notif.parentNode) notif.remove(); }, duration);
}

// ============================================================
//                    СТАРТ ИГРЫ
// ============================================================

function startGame() {
    gameState.isGameStarted = true;
    gameState.isPaused = false;
    lastLevelChallengesCompleted = false; // сброс для новой игры
    lastChanceUsed = false;
    // НЕ сбрасываем флаги туториала — обучение показывается только 1 раз для профиля
    // tutorialSkipped не сбрасываем, tutorialCompletedLevels не очищаем
    tutorialSkipped = false;
    
    // Инициализируем карту уровней
    initLevelProgress();
    saveLevelProgress();
    
    const storyDiv = document.getElementById('story');
    const startButton = document.getElementById('start-game');
    const mainMenu = document.getElementById('mainMenu');
    
    if (storyDiv) storyDiv.style.display = 'none';
    if (startButton) startButton.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';
    
    // Запуск музыки после клика пользователя (браузер разрешит)
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(() => {});
    }
    
    resetLevel();
}

function showMainMenu() {
    const storyDiv = document.getElementById('story');
    const mainMenu = document.getElementById('mainMenu');
    
    if (storyDiv) storyDiv.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
}

// ============================================================
//                     ПОРАЖЕНИЕ
// ============================================================

function showLastChance() {
    gameState.isPaused = true;
    const overlay = document.createElement('div');
    overlay.id = 'lastChanceOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    overlay.innerHTML = `
        <h2 style="color: #FF4444; font-size: 52px; text-shadow: 0 0 20px rgba(255,0,0,0.5);">💔 Последний шанс!</h2>
        <p style="color: #fff; font-size: 24px; margin: 20px 0;">Отдай половину очков (${Math.floor(score/2)}) за 1 жизнь?</p>
        <div style="display: flex; gap: 20px; margin-top: 20px;">
            <button id="lastChanceYes" style="padding: 15px 40px; font-size: 24px; background: linear-gradient(135deg,#FF4444,#CC0000); color: #fff; border: none; border-radius: 15px; cursor: pointer; font-family: inherit;">❤️ Да, спаси!</button>
            <button id="lastChanceNo" style="padding: 15px 40px; font-size: 24px; background: #666; color: #fff; border: none; border-radius: 15px; cursor: pointer; font-family: inherit;">💀 Нет, проиграть</button>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('lastChanceYes').onclick = () => {
        document.body.removeChild(overlay);
        score = Math.floor(score / 2);
        lives = 1;
        lastChanceUsed = true;
        gameState.isPaused = false;
        gameState.gameOver = false;
        timeLeft = 50; // сбрасываем таймер, иначе он сразу завершит игру
        // Возвращаем игрока на безопасную платформу, чтобы он не упал снова
        // Ищем статическую платформу с достаточной шириной
        let respawnPlatform = platforms.find(p => 
            !p.isFalling && p.width >= 80 && p.y < canvas.height - 50
        );
        if (respawnPlatform) {
            player.x = respawnPlatform.x + 20;
            player.y = respawnPlatform.y - player.height;
        } else {
            // Запасной вариант: если платформа не найдена — ставим в безопасное место
            player.x = 50;
            player.y = canvas.height - 150;
        }
        player.dx = 0;
        player.dy = 0;
        player.jumping = false;
        player.grounded = false;
        // Если таймер был остановлен — перезапускаем
        clearInterval(timerInterval);
        startTimer();
        showNotification('❤️ Активирован последний шанс! Береги Бубера!', 3000);
    };
    document.getElementById('lastChanceNo').onclick = () => {
        document.body.removeChild(overlay);
        gameLost();
    };
}

function gameLost() {
    gameState.isPaused = true;
    gameState.gameOver = true;
    
    const victoryDiv = document.getElementById("victory");
    if (!victoryDiv) return;
    
    victoryDiv.style.display = "block";
    const title = victoryDiv.querySelector("h1");
    const text = victoryDiv.querySelector("p");
    
    if (title) title.innerHTML = "Бубор засмотрелся на орешки и нечаянно проиграл эту партию. Время подкрепится и попробовать ещё раз!";
    if (text) {
        text.innerHTML = `
            Спасибо за игру!<br>
            Бубор очень старался, и в следующий раз справится!.<br>
            Не отчаивайся. Это было незабываемое приключение!<br><br><br><br>
            Попробуй ещё раз - всё получится!
        `;
    }
    victoryDiv.style.backgroundImage = "url('img/backs/loose.jpg')";
    
    const backgroundMusic = document.getElementById("backgroundMusic");
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    victoryMusic = new Audio('sounds/loose.mp3');
    victoryMusic.play();
}

// ============================================================
//                    ПОБЕДА
// ============================================================

function showVictoryScreen() {
    gameState.isPaused = true;
    const victoryDiv = document.getElementById("victory");
    if (!victoryDiv) return;
    
    victoryDiv.style.display = "block";
    victoryDiv.style.backgroundImage = "url('img/backs/story4.jpg')";
    
    const title = victoryDiv.querySelector("h1");
    const text = victoryDiv.querySelector("p");
    
    if (title) title.innerHTML = "Ура! Это победа!";
    if (text) {
        text.innerHTML = `
            Спасибо за игру, уважаемый друг!<br>Когда Бубор вернулся домой с корзиной малины, его братья, Бобер и Бибор, уже ждали его возле новых уютных хаток.<br>
            Улыбки озаряли их лица, а в воздухе витало чувство тепла и благодарности.<br>Бубор поставил корзину на стол, и все вместе они устроили маленький пир.<br><br><br><br><br>
            Праздник продолжался до позднего вечера. Зима могла быть суровой,<br>но у них теперь было всё, чтобы преодолеть любые трудности вместе.<br>А волк ... убежал в другой лес.
        `;
    }
    
    const backgroundMusic = document.getElementById("backgroundMusic");
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    victoryMusic = new Audio('sounds/bubor.mp3');
    victoryMusic.play();
}

// ============================================================
//                 ПЕРЕЗАПУСК ИГРЫ
// ============================================================

function restartGame() {
    lives = 3;
    score = 0;
    gameState.isPaused = false;
    gameState.gameOver = false;
    timeLeft = 50;
    groundImg.src = 'img/grounds/ground.png';
    level = 1;
    collectedNuts = 0;
    lastLevelChallengesCompleted = false; // сброс при перезапуске
    recentChallengeIds = []; // сброс истории заданий
    
    if (victoryMusic) {
        victoryMusic.pause();
        victoryMusic.currentTime = 0;
    }
    
    const backgroundMusic = document.getElementById("backgroundMusic");
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.src = "sounds/music1.mp3";
        backgroundMusic.load();
        backgroundMusic.play();
    }
    
    document.getElementById("victory").style.display = "none";
    resetLevel();
}

// ============================================================
//               СЮЖЕТНЫЕ ВСТАВКИ (Story Advance)
// ============================================================

// Показывает сюжетную вставку после прохождения босс-уровня
// storyLevel — номер пройденного босс-уровня (3, 6, 9...)
// К этому моменту level уже увеличен на 1 (новый уровень)
// Единая функция показа сюжетной вставки (объединяет showStoryForLevel и StoryAdvance)
function showStoryForLevel(storyLevel) {
    if (storyLevel < 3 || storyLevel > 48 || storyLevel % 3 !== 0) return;
    
    const config = LEVEL_CONFIGS[storyLevel];
    if (!config || !config.backStory) return;
    
    gameState.isPaused = true;
    const storyDiv = document.getElementById('story');
    if (!storyDiv) return;

    storyDiv.style.backgroundImage = `url('${config.storyImg || config.backImg}')`;
    storyDiv.style.textAlign = "center";
    storyDiv.style.fontFamily = "'Comic Sans MS', cursive, sans-serif";
    storyDiv.style.color = "#d6ff00";
    storyDiv.style.fontSize = "32px";
    storyDiv.style.textShadow = "2px 2px 4px rgba(0, 0, 0, 0.7)";
    storyDiv.innerHTML = `<div id="story-text" style="width:60%;line-height:1.5;text-align:center;background-color:rgba(0,0,0,0.5);padding:30px;border-radius:10px;">
        ${config.backStory}
        <br><br>
        <button class="story-continue-btn" onclick="continueAfterStory()">▶ Продолжить</button>
    </div>`;

    gameState.isStorySkippable = true;
    storyDiv.style.display = "flex";
    storyDiv.style.cursor = "default";
}

// Удаляем дублирующую функцию StoryAdvance
function StoryAdvance() { showStoryForLevel(level); }

// Функция продолжения после сюжетной вставки (вызывается кнопкой "Продолжить")
function continueAfterStory() {
    gameState.isStorySkippable = false;
    gameState.levelChanging = false; // <-- сбрасываем блокировку
    const storyDiv = document.getElementById('story');
    if (!storyDiv) return;
    storyDiv.style.display = 'none';
    gameState.isPaused = false;
    restoreMusicVolume();
    // Показываем карту уровней (или меню, если игра не запущена)
    if (!gameState.isGameStarted) {
        document.getElementById('mainMenu').style.display = 'flex';
    } else {
        showLevelMap(true);
    }
}

function applyLevelConfig(levelNum) {
    const idx = Math.min(levelNum, LEVEL_CONFIGS.length - 1);
    const config = LEVEL_CONFIGS[idx];
    if (!config) return;
    
    nutImg.src = config.collectible;
    groundImg.src = config.ground;
    wolfImg.src = config.enemy;
    collectiblesName = config.name;
    
    fadeMusic(config.music);
}

// ============================================================
//                    ПЛАТФОРМЫ
// ============================================================

function createPlatforms() {
    platforms = [];
    const groundHeight = canvas.height - 50;
    
    if (level < 4) {
        platforms.push({
            x: 0, y: groundHeight,
            width: canvas.width, height: 50,
            isMoving: false
        });
    } else {
        let groundWidth = level >= 7 ? canvas.width * 0.1 : canvas.width / 3;
        platforms.push({
            x: 0, y: groundHeight,
            width: Math.max(groundWidth, 100),
            height: 50,
            speed: platformSpeed,
            direction: 1,
            isMoving: true
        });
    }
    
    const numPlatforms = Math.floor(Math.random() * 30) + 20;
    generateAdditionalPlatforms(numPlatforms);
}

function generateAdditionalPlatforms(numPlatforms) {
    const maxLevels = 6;
    let previousPlatforms = [{ x: 0, y: canvas.height - 100, width: canvas.width, height: 50 }];
    
    let fallingCount = 0;
    if (level >= 30) fallingCount = 8;
    else if (level >= 25) fallingCount = 7;
    else if (level >= 20) fallingCount = 6;
    else if (level >= 17) fallingCount = 5;
    else if (level >= 14) fallingCount = 4;
    else if (level >= 11) fallingCount = 3;
    else if (level >= 7) fallingCount = 2;
    
    // Минимальная высота для платформ — не выше 170px от верха (место для HUD)
    const minPlatformY = 170;
    
    for (let i = 0; i < numPlatforms; i++) {
        let platform;
        let valid = false;
        let platformLevel = Math.floor(i % maxLevels);
        let attempts = 0;
        
        while (!valid && attempts < 50) {
            let y = canvas.height - 130 - (platformLevel * 130);
            if (y < minPlatformY) y = minPlatformY;
            platform = {
                x: Math.random() * (canvas.width - 150),
                y: y,
                width: Math.random() * 100 + 50,
                height: 20
            };
            valid = previousPlatforms.some(p => 
                p.y - platform.y <= 150 && Math.abs(p.x - platform.x) <= 200
            ) && !platforms.some(p => 
                Math.sqrt((p.x - platform.x) ** 2 + (p.y - platform.y) ** 2) < 100
            );
            attempts++;
        }
        
        if (platform) {
            if (fallingCount > 0 && Math.random() < 0.2) {
                platform.isFalling = true;
                platform.fallDelay = 100;
                platform.fallSpeed = 2;
                platform.isActivated = false;
                fallingCount--;
            } else {
                platform.isFalling = false;
            }
            
            platforms.push(platform);
            previousPlatforms.push(platform);
        }
    }
}

function getTrapCount() {
    if (level >= 30) return 8;
    if (level >= 25) return 7;
    if (level >= 20) return 6;
    if (level >= 17) return 5;
    if (level >= 14) return 4;
    if (level >= 11) return 3;
    if (level >= 8) return 2;
    if (level >= 5) return 1;
    return 0;
}

// ============================================================
//                ДВИЖУЩИЕСЯ И ПАДАЮЩИЕ ПЛАТФОРМЫ
// ============================================================

function updateMovingPlatform() {
    platforms.forEach(platform => {
        if (platform.isMoving) {
            platform.x += platform.speed * platform.direction;
            if (platform.x <= 0 || platform.x + platform.width >= canvas.width) {
                platform.direction *= -1;
            }
            if (player.y + player.height === platform.y &&
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width) {
                player.x += platform.speed * platform.direction;
            }
        }
        
        if (platform.isFalling) {
            if (!platform.isActivated && player.y + player.height === platform.y &&
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width) {
                platform.isActivated = true;
            }
            if (platform.isActivated) {
                if (platform.fallDelay > 0) {
                    platform.fallDelay--;
                } else {
                    platform.y += platform.fallSpeed * 3.0;
                }
            }
        }
        
        if (platform.y > canvas.height) {
            platforms = platforms.filter(p => p !== platform);
        }
    });
}

// ============================================================
//                     ОРЕШКИ
// ============================================================

function createNuts() {
    nuts = [];
    totalNuts = 15;
    collectedNuts = 0;
    TimeAdd = null;
    LiveAdd = null;
    invincibilityBonus = null;
    
    const elevatedPlatforms = platforms.filter(p => p.y < canvas.height - 100 && !p.isFalling);
    const platformsWithNuts = new Set();
    
    elevatedPlatforms.forEach(platform => {
        if (Math.random() > 0.4 && nuts.length < totalNuts && !platformsWithNuts.has(platform)) {
            const nutX = Math.random() * (platform.width - 35) + platform.x;
            const nutY = platform.y - 35;
            if (nutX >= 0 && nutX <= canvas.width && nutY >= 0 && nutY <= canvas.height) {
                nuts.push({ x: nutX, y: nutY, width: 35, height: 35 });
                platformsWithNuts.add(platform);
            }
        }
    });
    
    const remaining = elevatedPlatforms.filter(p => !platformsWithNuts.has(p));
    while (nuts.length < totalNuts && remaining.length > 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        const p = remaining[idx];
        const nx = Math.random() * (p.width - 30) + p.x;
        const ny = p.y - 30;
        if (nx >= 0 && nx <= canvas.width && ny >= 0 && ny <= canvas.height) {
            nuts.push({ x: nx, y: ny, width: 30, height: 30 });
            platformsWithNuts.add(p);
        }
        remaining.splice(idx, 1);
    }
    
    const avail = elevatedPlatforms.filter(p => !platformsWithNuts.has(p));
    if (avail.length > 0) {
        const idx = Math.floor(Math.random() * avail.length);
        const p = avail[idx];
        const sx = Math.random() * (p.width - 40) + p.x;
        const sy = p.y - 40;
        if (sx >= 0 && sx <= canvas.width && sy >= 0 && sy <= canvas.height) {
            TimeAdd = { x: sx, y: sy, width: 40, height: 40, rotation: 0 };
        }
    }
    
    if (avail.length > 0 && Math.random() < 0.35) {
        const idx = Math.floor(Math.random() * avail.length);
        const p = avail[idx];
        const lx = Math.random() * (p.width - 38) + p.x;
        const ly = p.y - 40;
        if (lx >= 0 && lx <= canvas.width && ly >= 0 && ly <= canvas.height) {
            LiveAdd = { x: lx, y: ly, width: 38, height: 40, scale: 1, pulseDirection: 0.01 };
        }
    }
    
    // Устанавливаем реальное количество орешков (может быть меньше 15 из-за ограниченности платформ)
    totalNuts = nuts.length;
    
    // Неуязвимость — только с 4-го уровня (первые 3 уровня слишком простые для такого бонуса)
    if (level >= 4 && avail.length > 0 && Math.random() < 0.20) {
        const idx = Math.floor(Math.random() * avail.length);
        const p = avail[idx];
        const ix = Math.random() * (p.width - 50) + p.x;
        const iy = p.y - 50;
        if (ix >= 0 && ix <= canvas.width && iy >= 0 && iy <= canvas.height) {
            invincibilityBonus = { x: ix, y: iy, width: 50, height: 50, hue: 0 };
        }
    }
    
    // Страховочная платформа — только с 4-го уровня (шанс 25%)
    if (level >= 4 && avail.length > 0 && Math.random() < 0.25) {
        const idx = Math.floor(Math.random() * avail.length);
        const p = avail[idx];
        const sx = Math.random() * (p.width - 44) + p.x;
        const sy = p.y - 44;
        if (sx >= 0 && sx <= canvas.width && sy >= 0 && sy <= canvas.height) {
            safetyPlatformBonus = { x: sx, y: sy, width: 44, height: 44, scale: 1, pulseDirection: 0.01, hue: 0 };
        }
    }
}

// ============================================================
//                    ЛОВУШКИ
// ============================================================

function createTraps() {
    traps = [];
    const numTraps = getTrapCount();
    if (numTraps === 0) return;
    
    const elevatedPlatforms = platforms.filter(p => p.y < canvas.height - 100 && !p.isFalling);
    const minDistance = 100;
    const maxAttempts = 15;
    
    for (let i = 0; i < numTraps; i++) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < maxAttempts) {
            const randomPlatform = elevatedPlatforms[Math.floor(Math.random() * elevatedPlatforms.length)];
            const tx = randomPlatform.x + Math.random() * (randomPlatform.width - 35);
            const ty = randomPlatform.y - 35;
            
            const tooClose = nuts.some(n =>
                Math.abs(n.y - ty) < minDistance && Math.abs(n.x - tx) < minDistance
            ) || (LiveAdd && Math.abs(LiveAdd.y - ty) < minDistance && Math.abs(LiveAdd.x - tx) < minDistance)
              || (invincibilityBonus && Math.abs(invincibilityBonus.y - ty) < minDistance && Math.abs(invincibilityBonus.x - tx) < minDistance)
              || (TimeAdd && Math.abs(TimeAdd.y - ty) < minDistance && Math.abs(TimeAdd.x - tx) < minDistance);
            
            if (!tooClose) {
                traps.push({ x: tx, y: ty, width: 35, height: 35 });
                placed = true;
            }
            attempts++;
        }
    }
}

// ============================================================
//                      ВРАГ
// ============================================================

// Типы врагов
const ENEMY_TYPES = ['walker', 'jumper', 'chaser'];

// Создать врага со случайным AI
function createEnemy() {
    const platformForEnemy = platforms.find(p =>
        p.y < canvas.height - 200 && p.width >= 100 && !p.isFalling
    );
    
    if (platformForEnemy) {
        // Выбираем тип врага в зависимости от уровня
        let type;
        if (level < 10) type = 'walker';
        else if (level < 20) type = Math.random() < 0.6 ? 'walker' : 'jumper';
        else if (level < 30) type = ENEMY_TYPES[Math.floor(Math.random() * 2)]; // walker или jumper
        else type = ENEMY_TYPES[Math.floor(Math.random() * 3)]; // все три типа
        
        enemy = {
            x: platformForEnemy.x,
            y: platformForEnemy.y - 50,
            width: 50,
            height: 50,
            speed: 1.5 + Math.random() * 0.5,
            direction: 1,
            platform: platformForEnemy,
            type: type,
            // Для jumper
            jumpTimer: 60 + Math.floor(Math.random() * 60),
            jumpCooldown: 0,
            isJumping: false,
            jumpDy: 0,
            // Для chaser
            baseSpeed: 1.5 + Math.random() * 0.5,
            aggroRange: 200,
            isAggro: false
        };
    }
}

function updateEnemy() {
    if (!enemy) return;
    
    switch (enemy.type) {
        case 'walker':
            updateWalkerEnemy();
            break;
        case 'jumper':
            updateJumperEnemy();
            break;
        case 'chaser':
            updateChaserEnemy();
            break;
        default:
            updateWalkerEnemy();
    }
}

// Обычный ходячий враг (вперёд-назад)
function updateWalkerEnemy() {
    enemy.x += enemy.speed * enemy.direction;
    if (enemy.x <= enemy.platform.x - 15 || enemy.x + enemy.width >= enemy.platform.x + enemy.platform.width + 15) {
        enemy.direction *= -1;
    }
}

// Прыгающий враг
function updateJumperEnemy() {
    if (!enemy.isJumping) {
        // Двигается медленно по платформе
        enemy.x += enemy.speed * 0.3 * enemy.direction;
        if (enemy.x <= enemy.platform.x - 15 || enemy.x + enemy.width >= enemy.platform.x + enemy.platform.width + 15) {
            enemy.direction *= -1;
        }
        // Таймер прыжка
        enemy.jumpCooldown--;
        if (enemy.jumpCooldown <= 0) {
            enemy.isJumping = true;
            enemy.jumpDy = -8 - Math.random() * 3;
            enemy.jumpCooldown = enemy.jumpTimer + Math.floor(Math.random() * 30);
        }
    } else {
        // В воздухе
        enemy.jumpDy += 0.5;
        enemy.y += enemy.jumpDy;
        enemy.x += enemy.speed * 0.5 * enemy.direction;
        // Приземление
        if (enemy.y >= enemy.platform.y - enemy.height) {
            enemy.y = enemy.platform.y - enemy.height;
            enemy.isJumping = false;
            enemy.jumpDy = 0;
        }
    }
}

// Преследующий враг
function updateChaserEnemy() {
    const dx = player.x - enemy.x;
    const dist = Math.abs(dx);
    
    if (dist < enemy.aggroRange) {
        // Агрессия — бежит к игроку
        enemy.isAggro = true;
        enemy.speed = enemy.baseSpeed * 2;
        enemy.direction = dx > 0 ? 1 : -1;
    } else {
        enemy.isAggro = false;
        enemy.speed = enemy.baseSpeed;
    }
    
    enemy.x += enemy.speed * enemy.direction;
    
    // Ограничение платформой (но не строгое для chaser — может выйти за край)
    if (!enemy.isAggro) {
        if (enemy.x <= enemy.platform.x - 15 || enemy.x + enemy.width >= enemy.platform.x + enemy.platform.width + 15) {
            enemy.direction *= -1;
        }
    } else {
        // В агрессии не выходит за пределы уровня
        if (enemy.x < 0) { enemy.x = 0; enemy.direction = 1; }
        if (enemy.x + enemy.width > canvas.width) { enemy.x = canvas.width - enemy.width; enemy.direction = -1; }
    }
}

// ============================================================
//                ЗАПУСК УРОВНЯ
// ============================================================

function startLevel() {
    traps = [];
    enemy = null;
    createTraps();
    
    if (level % 3 === 0) {
        createEnemy();
    }
}

// ============================================================
//                  АНИМАЦИЯ БОБРА
// ============================================================

function updateBobrAnimation() {
    if (player.dx < 0) gameState.isFacingLeft = true;
    else if (player.dx > 0) gameState.isFacingLeft = false;
    
    // Анимация прыжка — фиксированный кадр и поджатые лапки
    if (!player.grounded) {
        frameIndex = 2; // Кадр с поджатыми лапками
        // Небольшой наклон назад в воздухе
        player.rotation = Math.min(0.3, Math.max(-0.3, -player.dx * 0.03));
    } else {
        player.rotation = 0;
        if (player.dx !== 0) {
            movementCounter++;
            if (movementCounter >= animationSpeed) {
                frameIndex = (frameIndex + 1) % frameCount;
                movementCounter = 0;
            }
        } else {
            frameIndex = 0;
        }
    }
    
    if (gameState.isInvincible) {
        player.hue = (player.hue + 1) % 360;
    }
}

// ============================================================
//                  СТОЛКНОВЕНИЯ
// ============================================================

function checkCollisions() {
    traps.forEach(trap => {
        if (!rectCollide(player, trap)) return;
        
        ouchSound.play();
        createExplosion(trap.x + trap.width / 2, trap.y + trap.height / 2);
        const explosionRadius = 50;
        
        traps = traps.filter(t => {
            const dist = Math.sqrt((t.x - trap.x) ** 2 + (t.y - trap.y) ** 2);
            if (dist <= explosionRadius) {
                createExplosion(t.x + t.width / 2, t.y + t.height / 2);
                if (!gameState.isInvincible) lives--;
                destroyedTraps++;
                totalTrapsDestroyed++;
                score += 15;
                minekillSound.play();
                return false;
            }
            return true;
        });
    });
    
    if (enemy && rectCollide(player, enemy)) {
        if (gameState.isInvincible) {
            score += 50;
            destroyedEnemies++;
            totalEnemiesKilled++;
            enemy = null;
            hitSound.play();
        } else {
            ouchSound.play();
            lives--;
            if (lives <= 0) {
                if (!lastChanceUsed) {
                    showLastChance();
                    return;
                }
                gameLost();
            } else {
                gameState.gameOver = true;
                const storyDiv = document.getElementById('story');
                if (storyDiv) {
                    storyDiv.style.backgroundImage = "url('img/backs/faling.jpg')";
                    storyDiv.style.textAlign = "center";
                    storyDiv.innerHTML = "<br><br><br><br><br><br>Бубор столкнулся с врагом!<br><br>Попробуй ещё раз!";
                    storyDiv.style.color = "red";
                    storyDiv.style.fontSize = "64px";
                    storyDiv.style.display = "flex";
                }
                startCountdown();
            }
        }
    }
}

function rectCollide(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ============================================================
//                  МАГНИТ ДЛЯ ОРЕШКОВ
// ============================================================

function updateMagnet() {
    if (!gameState.hasMagnet || nuts.length === 0) return;
    
    const magnetRadius = 120;
    const magnetStrength = 3;
    
    nuts.forEach(nut => {
        const dx = player.x + player.width / 2 - nut.x - nut.width / 2;
        const dy = player.y + player.height / 2 - nut.y - nut.height / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < magnetRadius && dist > 0) {
            const pullX = (dx / dist) * magnetStrength;
            const pullY = (dy / dist) * magnetStrength;
            nut.x += pullX;
            nut.y += pullY;
        }
    });
}

// ============================================================
//                     ОБНОВЛЕНИЕ
// ============================================================

function update() {
    if (gameState.isPaused || gameState.gameOver || gameState.levelChanging) return;
    
    // Если активна мини-игра — не обновляем основной игровой цикл
    if (miniGameState.active) {
        updateMiniGame();
        return;
    }
    
    // Бонусный уровень — особая логика
    if (isBonusLevel) {
        updateBonusLevel();
        updateBobrAnimation();
        // Движение игрока
        if (keys.ArrowRight || keys['KeyD'] || gameState.touchRight) player.dx = player.speed;
        else if (keys.ArrowLeft || keys['KeyA'] || gameState.touchLeft) player.dx = -player.speed;
        else player.dx = 0;
        player.dy += gravity;
        player.x += player.dx;
        player.y += player.dy;
        player.grounded = false;
        platforms.forEach(platform => {
            if (player.x < platform.x + platform.width &&
                player.x + player.width > platform.x &&
                player.y + player.height <= platform.y + platform.height &&
                player.y + player.height + player.dy >= platform.y) {
                player.jumping = false;
                player.grounded = true;
                player.dy = 0;
                player.y = platform.y - player.height;
            }
        });
        if ((keys[" "] || keys["KeyW"] || keys["ArrowUp"] || gameState.touchJump) && !player.jumping && player.grounded) {
            player.jumping = true;
            player.dy = jumpStrength;
            jumpSound.play();
        }
        if (player.y + player.height > canvas.height) {
            player.y = canvas.height - 150;
            player.dy = 0;
        }
        return;
    }
    
    updateMovingPlatform();
    updateBobrAnimation();
    updateEnemy();
    updateTrapEffects();
    updateInvincibilityBonus();
    updateMagnet();
    checkCollisions();
    updateParticles();
    updateExplosions();
    updateLocationFeatures();
    
    // Disorientation + Ice + Gravity
    if (!keysInverted) {
        if (keys.ArrowRight || keys.KeyD || gameState.touchRight) player.dx = player.speed;
        else if (keys.ArrowLeft || keys.KeyA || gameState.touchLeft) player.dx = -player.speed;
        else if (!ICE_MODE || !player.grounded) player.dx = 0;
    } else {
        if (keys.ArrowRight || keys.KeyD || gameState.touchRight) player.dx = -player.speed;
        else if (keys.ArrowLeft || keys.KeyA || gameState.touchLeft) player.dx = player.speed;
        else if (!ICE_MODE || !player.grounded) player.dx = 0;
    }
    
    if (LOW_GRAVITY) {
        player.dy += gravity * 0.25;
    } else {
        player.dy += gravity;
    }
    
    if (ICE_MODE && player.grounded && !keys.ArrowRight && !keys.KeyD && !keys.ArrowLeft && !keys.KeyA && !gameState.touchLeft && !gameState.touchRight) {
        player.dx *= iceFriction;
        if (Math.abs(player.dx) < 0.1) player.dx = 0;
    }
    
    // Песчаная буря — сдувает игрока вправо (после обработки клавиш, чтобы не занулялось)
    if (sandStormActive && level >= 16 && level <= 18) {
        player.dx += SAND_STORM_PUSH;
    }
    
    player.x += player.dx;
    player.y += player.dy;
    
    if (player.y + player.height > canvas.height) {
        // Если активна страховочная платформа — не теряем жизнь, возвращаем на платформу
        if (hasSafetyPlatform && safetyPlatform) {
            player.x = safetyPlatform.x + safetyPlatform.width / 2 - player.width / 2;
            player.y = safetyPlatform.y - player.height;
            player.dy = 0;
            player.dx = 0;
            player.jumping = false;
            player.grounded = false;
        } else {
            fallSound.play();
            // Ачивка при первом падении
            if (!gameState.hasFallenOnce) {
                gameState.hasFallenOnce = true;
                unlockAchievement('first_fall', '💨 Бобр-непоседа — первый раз упал!');
            }
            lives--;
            if (lives <= 0) {
                if (!lastChanceUsed) {
                    showLastChance();
                    return;
                }
                gameLost();
                return;
            } else {
                gameState.gameOver = true;
                const storyDiv = document.getElementById('story');
                if (storyDiv) {
                    storyDiv.style.backgroundImage = "url('img/backs/faling.jpg')";
                    storyDiv.style.textAlign = "center";
                    storyDiv.innerHTML = "<br><br><br><br><br><br>Бубор упал с большой высоты!<br><br>Попробуй ещё раз!";
                    storyDiv.style.color = "red";
                    storyDiv.style.fontSize = "64px";
                    storyDiv.style.display = "flex";
                }
                startCountdown();
                return;
            }
        }
    }
    
    player.grounded = false;
    platforms.forEach(platform => {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height <= platform.y + platform.height &&
            player.y + player.height + player.dy >= platform.y) {
            player.jumping = false;
            player.grounded = true;
            player.dy = 0;
            player.y = platform.y - player.height;
        }
    });
    
    if (lives <= 0) {
        if (!lastChanceUsed) {
            showLastChance();
            return;
        }
        gameState.gameOver = true;
        gameLost();
        return;
    }
    
    nuts.forEach((nut, index) => {
        if (rectCollide(player, nut)) {
            nutEffects.push({ x: nut.x, y: nut.y, scale: 1, alpha: 1 });
            nuts.splice(index, 1);
            collectedNuts++;
            totalNutsCollected++;
            // Комбо
            comboCount++;
            comboTimer = 120; // ~2 секунды при 60fps
            if (comboCount > maxCombo) maxCombo = comboCount;
            score += 10 + (comboCount > 1 ? comboCount * 2 : 0); // Бонус за комбо
            eatSound.play();
            // Мгновенные ачивки за сбор
            if (collectedNuts === 1) {
                unlockAchievement('first_nut', '🥜 Первый орешек собран!');
            }
            if (collectedNuts >= totalNuts) {
                unlockAchievement('full_collect', '📦 Все предметы уровня собраны!');
            }
        }
    });
    
    // Таймер комбо — сбрасывается если долго не собирать
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) comboCount = 0;
    }
    
    if (TimeAdd && rectCollide(player, TimeAdd)) {
        TimeAdd = null;
        timeLeft += 10;
        addTimeSound.play();
    }
    
    if (LiveAdd && rectCollide(player, LiveAdd)) {
        LiveAdd = null;
        lives++;
        addTimeSound.play();
    }
    
    if (invincibilityBonus && rectCollide(player, invincibilityBonus)) {
        invincibilityBonus = null;
        gameState.isInvincible = true;
        player.hue = 0;
        clearTimeout(invincibilityTimer);
        invincibleSound.play();
        lowerMusicVolume();
        invincibilityTimer = setTimeout(() => {
            gameState.isInvincible = false;
            invincibleSound.pause();
            invincibleSound.currentTime = 0;
            restoreMusicVolume();
        }, invincibilityDuration);
        powerupSound.play();
    }
    
    // Страховочная платформа — сбор бонуса
    if (safetyPlatformBonus && rectCollide(player, safetyPlatformBonus)) {
        safetyPlatformBonus = null;
        hasSafetyPlatform = true;
        // Создаём платформу от края до края
        safetyPlatform = { x: 0, y: canvas.height - 50, width: canvas.width, height: 50, isMoving: false, isSafety: true };
        platforms.push(safetyPlatform);
        showNotification('🛡️ Страховочная платформа активирована! Падение безопасно!', 2500);
        addTimeSound.play();
    }
    
    // Прыжок + Двойной прыжок
    let jumpStr = jumpStrength;
    if (LOW_GRAVITY) jumpStr = jumpStrength * 0.8;
    if ((keys[" "] || keys["KeyW"] || keys["ArrowUp"] || gameState.touchJump) && !player.jumping && player.grounded) {
        player.jumping = true;
        player.dy = jumpStr;
        jumpButtonReleased = false;
        // Двойной прыжок: даём возможность второго прыжка
        gameState.canDoubleJump = gameState.hasDoubleJump;
        jumpSound.play();
        totalJumps++;
        totalJumpsThisLevel++;
        // Создаём частицы для активного jump-эффекта
        spawnJumpEffect(player.x + player.width / 2, player.y + player.height / 2);
    } else if ((keys[" "] || keys["KeyW"] || keys["ArrowUp"] || gameState.touchJump) && jumpButtonReleased && player.jumping && gameState.canDoubleJump && !player.grounded) {
        // Двойной прыжок в воздухе (такой же силы, как основной)
        player.dy = jumpStr;
        jumpButtonReleased = false;
        gameState.canDoubleJump = false;
        jumpSound.play();
        totalJumps++;
        totalJumpsThisLevel++;
        // Более яркий эффект для двойного прыжка
        spawnJumpEffect(player.x + player.width / 2, player.y + player.height / 2);
        // Добавляем дополнительные частицы для визуального отличия
        for (let i = 0; i < 5; i++) {
            jumpParticles.push({
                x: player.x + player.width / 2 + (Math.random() - 0.5) * 20,
                y: player.y + player.height,
                dx: (Math.random() - 0.5) * 4,
                dy: -Math.random() * 3 - 1,
                size: 4 + Math.random() * 4,
                color: `hsl(${200 + Math.random() * 60}, 100%, 60%)`,
                life: 15 + Math.random() * 10,
                maxLife: 25,
                type: 'jumpStars'
            });
        }
    }
    
    // Обновляем туториал
    updateTutorial();
    
    // Проверка столкновения с порталом
    checkPortalCollision();
    
    // Обновляем мини-игру (если активна)
    updateMiniGame();
    
    if (collectedNuts >= totalNuts && !gameState.levelChanging) {
        gameState.levelChanging = true;
        // Вызываем completeLevel синхронно, без setTimeout.
        // setTimeout(..., 0) даёт разрыв между кадрами, из-за которого
        // render не видит, что resultScreen активен, и экран результатов не показывается.
        // Синхронный вызов гарантирует, что всё произойдёт в рамках одного кадра.
        completeLevel();
    }
}

// ============================================================
//              ЗАВЕРШЕНИЕ УРОВНЯ
// ============================================================

function completeLevel() {
    let baseScore = score;
    const nutPoints = collectedNuts * 10;
    const trapPoints = destroyedTraps * 15;
    const enemyPoints = destroyedEnemies * 50;
    const remainingTimeBonus = Math.max(0, timeLeft) * 5;
    
    score += nutPoints + trapPoints + enemyPoints + remainingTimeBonus;
    
    // Проверка бонусных заданий
    const challengesCompleted = checkChallenges();
    const challengeBonus = challengesCompleted * 30;
    if (challengeBonus > 0) {
        score += challengeBonus;
    }
    
    
    let rating, ratingClass;
    if (collectedNuts >= totalNuts * 0.9) {
        rating = "Отлично!";
        score += 50;
        ratingClass = "result-excellent";
    } else if (collectedNuts >= totalNuts * 0.75) {
        rating = "Хорошо";
        score += 25;
        ratingClass = "result-good";
    } else {
        rating = "Могло быть лучше";
        score += 10;
        ratingClass = "result-average";
    }
    
    levelCompleteSound.play();
    lowerMusicVolume();
    gameState.isPaused = true;
    const resultScreen = document.getElementById("resultScreen");
    if (!resultScreen) return;
    
    // ВАЖНО! Возвращаем display: flex — selectLevel() и resetLevel() скрывают экран с display: none,
    // и без этой строки resultScreen остаётся невидимым на 2+ уровнях
    resultScreen.style.display = "flex";
    resultScreen.className = ratingClass;
    resultScreen.classList.add('result-active');
    resultScreen.style.backgroundImage = "url('img/backs/nextlevel.jpg')";
    resultScreen.style.pointerEvents = "auto";
    
    const resultContent = document.getElementById("resultContent");
    if (resultContent) {
        resultContent.style.display = "block";
    }
    
    // Прячем canvas, чтобы он не перекрывал DOM-экран результатов
    document.getElementById('gameCanvas').style.display = 'none';
    
    // Форсируем браузерный reflow — читаем offsetHeight принудительно
    void resultScreen.offsetHeight;
    void resultContent.offsetHeight;
    
    // Гарантируем, что на следующем кадре render увидит экран результатов
    requestAnimationFrame(() => render());
    
    let details = [
        `<br><b>📊 Результаты уровня ${level}</b><br>`,
        `📦 Собрано: ${collectedNuts} / ${totalNuts}`,
        `💰 Базовый счёт: ${baseScore}`,
        `🥜 За орешки (${collectedNuts} × 10): +${nutPoints}`,
        `💥 За ловушки (${destroyedTraps} × 15): +${trapPoints}`,
        `👾 За врагов (${destroyedEnemies} × 50): +${enemyPoints}`,
        `⏱ За оставшееся время: +${remainingTimeBonus}`,
    ];
    
    if (challengeBonus > 0) {
        details.push(`🎯 Задания (${challengesCompleted}): +${challengeBonus}`);
    }
    
    details.push(`<br><b>🏆 Итог: ${score}</b>`);
    details.push(`⭐ Рейтинг: ${rating}`);
    
    const resultMessage = document.getElementById("resultMessage");
    if (resultMessage) {
        resultMessage.innerHTML = `✅ Уровень пройден!<br>`;
        resultMessage.style.fontSize = "22px";
        details.forEach((d, i) => {
            setTimeout(() => {
                resultMessage.innerHTML += `${d}<br>`;
            }, i * 600);
        });
    }
    
    // Обновляем recentChallengeIds для неповторения заданий
    levelChallenges.forEach(c => {
        if (!recentChallengeIds.includes(c.id)) {
            recentChallengeIds.push(c.id);
        }
    });
    if (recentChallengeIds.length > 5) {
        recentChallengeIds = recentChallengeIds.slice(-5);
    }
    
    // Запоминаем, выполнены ли все задания (для доступа к бонусу на след. уровне)
    lastLevelChallengesCompleted = areAllChallengesCompleted() && levelChallenges.length > 0;
    
    // Запоминаем, был ли пройден босс (каждый 3-й уровень)
    const wasBossLevel = level % 3 === 0;
    const completedLevel = level;
    
    // Проверяем ачивки и обновляем рекорды
    checkAchievements();
    updateBestScore(score);
    
    // Проверяем можно ли войти в бонусный уровень
    const canBonus = canEnterBonusLevel();
    
    // Сохраняем ID таймера, чтобы можно было отменить его при выборе уровня
    _completeLevelTimer = setTimeout(() => {
        // Сначала полностью скрываем экран результатов
        resultScreen.classList.remove('result-active');
        resultScreen.style.display = 'none';
        resultScreen.style.pointerEvents = "none";
        if (resultContent) resultContent.style.display = "none";
        gameState.isPaused = false;
        gameState.levelChanging = false;
        
        // Отмечаем текущий уровень пройденным и открываем следующий
        unlockNextLevel();
        
        // После прохождения любого уровня проверяем ранг
        checkRank(completedLevel + 1);
        
        // Если пройден босс — переходим на следующий уровень,
        // меняем конфиг (музыка, текстуры), показываем сюжет
        if (wasBossLevel && completedLevel < 48) {
            level = completedLevel + 1;
            currentBackgroundImg = getBackgroundImage(level);
            applyLevelConfig(level);
            // Показываем сюжетную вставку для только что пройденного босс-уровня
            showStoryForLevel(completedLevel);
        }
        
        if (canBonus) {
            // Предлагаем бонусный уровень — после него покажем карту
            showBonusLevelPrompt();
        } else if (level >= 48) {
            // Все уровни пройдены — победа
            showVictoryScreen();
        } else {
            // Показываем карту уровней
            showLevelMap(true);
        }
    }, 2000 + (details.length * 800));
}

function showBonusLevelPrompt() {
    gameState.isPaused = true;
    wasBonusLevelPromptActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'bonusPrompt';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    overlay.innerHTML = `
        <h2 style="color: #FFD700; font-size: 48px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">🌟 Бонусный уровень!</h2>
        <p style="color: #fff; font-size: 24px; margin: 20px 0;">Ты выполнил все задания! Хочешь получить награду?</p>
        <div style="display: flex; gap: 20px;">
            <button id="bonusYesBtn" style="padding: 15px 40px; font-size: 24px; background: linear-gradient(135deg,#FFD700,#FFA500); color: #333; border: none; border-radius: 15px; cursor: pointer; font-family: inherit;">🎮 Да!</button>
            <button id="bonusNoBtn" style="padding: 15px 40px; font-size: 24px; background: #666; color: #fff; border: none; border-radius: 15px; cursor: pointer; font-family: inherit;">❌ Нет, дальше</button>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('bonusYesBtn').onclick = () => {
        document.body.removeChild(overlay);
        gameState.isPaused = false;
        enterBonusLevel();
    };
    document.getElementById('bonusNoBtn').onclick = () => {
        document.body.removeChild(overlay);
        gameState.isPaused = false;
        level++;
        if (level > 48) {
            showVictoryScreen();
        } else {
            currentBackgroundImg = getBackgroundImage(level);
            resetLevel();
        }
    };
}

// ============================================================
//                   ТАЙМЕР
// ============================================================

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState.isPaused || gameState.gameOver || gameState.levelChanging) return;
        
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            const minimumRequiredItems = 7;
            if (collectedNuts >= minimumRequiredItems) {
                completeLevel();
            } else {
                lives--;
                if (lives <= 0) {
                    if (!lastChanceUsed) {
                        showLastChance();
                        return;
                    }
                    gameLost();
                } else {
                    gameState.gameOver = true;
                    const overDiv = document.getElementById("gameOver");
                    if (overDiv) overDiv.style.display = "block";
                    const storyDiv = document.getElementById('story');
                    if (storyDiv) {
                        storyDiv.style.backgroundImage = "url('img/backs/wolf.jpg')";
                        storyDiv.style.textAlign = "center";
                        storyDiv.innerHTML = "<br><br><br>Время вышло!<br>Волк нашёл Бубора и сожрал его!<br>Попробуй ещё раз!";
                        storyDiv.style.color = "red";
                        storyDiv.style.fontSize = "64px";
                        storyDiv.style.display = "flex";
                    }
                    startCountdown();
                }
            }
        }
    }, 1000);
}

// ============================================================
//               ОБРАТНЫЙ ОТСЧЁТ
// ============================================================

function startCountdown() {
    const countdown = document.getElementById("countdown");
    if (!countdown) return;
    countdown.style.display = "block";
    countdownValue = 4;
    countdown.innerHTML = countdownValue;
    
    const interval = setInterval(() => {
        countdownValue--;
        if (countdownValue <= 0) {
            clearInterval(interval);
            countdown.style.display = "none";
            countdownValue = 4;
            gameState.gameOver = false;
            resetLevel();
            gameState.isPaused = false;
            
            const storyDiv = document.getElementById('story');
            if (storyDiv) storyDiv.style.display = 'none';
            
            timeLeft = 55;
        } else {
            countdown.innerHTML = countdownValue;
        }
    }, 1000);
}


// ============================================================
//          LOCATION FEATURES - init i update
// ============================================================

function initLocationFeatures() {
    locationFeatureActive = false; locationFeatureTimer = 0;
    roosterCrowTimer = 0; roosterShakeIntensity = 0; disorientationTimer = 0; keysInverted = false;
    fallingRocks = []; ghostTimer = 0; ghostPhase = 0; firePlatforms = []; fireSpreadTimer = 0;
    screenTilt = 0; screenTiltDirection = 1; tiltSweepTime = 0; LOW_GRAVITY = false; ICE_MODE = false;
    caveDarkTimer = 0; caveDarkActive = false; caveDarkDuration = 0;
    sandStormTimer = 0; sandStormActive = false; sandStormDuration = 0;
    if (isBonusLevel) return;
    if (level >= 7 && level <= 9) { locationFeatureActive = true; roosterCrowTimer = 180 + Math.floor(Math.random() * 120); }
    if (level >= 19 && level <= 21) { locationFeatureActive = true; scheduleRockfall(); }
    if (level >= 22 && level <= 24) { locationFeatureActive = true; ghostTimer = 300; ghostPhase = 0; platforms.forEach(p => { p.ghostVisible = true; p.ghostAlpha = 1; }); }
    if (level >= 25 && level <= 27) { locationFeatureActive = true; fireSpreadTimer = 120; firePlatforms = []; const e = platforms.filter(p => p.y < canvas.height - 100 && !p.isFalling && !p.isSafety); e.forEach(p => { if (Math.random() < 0.3) firePlatforms.push({platform:p,burning:false,burnTimer:60+Math.floor(Math.random()*120),life:300}); }); }
    if (level >= 31 && level <= 33) { locationFeatureActive = true; screenTilt = 0; screenTiltDirection = 1; tiltSweepTime = 0; }
    if (level >= 43 && level <= 45) { locationFeatureActive = true; LOW_GRAVITY = true; }
    if (level >= 10 && level <= 12) { locationFeatureActive = true; caveDarkTimer = 480 + Math.floor(Math.random() * 240); caveDarkActive = false; caveDarkDuration = 0; }
    if (level >= 16 && level <= 18) { locationFeatureActive = true; sandStormTimer = 600 + Math.floor(Math.random() * 300); sandStormActive = false; sandStormDuration = 0; }
    if (level >= 46 && level <= 48) { locationFeatureActive = true; ICE_MODE = true; }
}

function scheduleRockfall() {
    const delay = 30 + Math.floor(Math.random() * 90);
    setTimeout(() => {
        if (gameState.isPaused || gameState.gameOver || isBonusLevel) return;
        const high = platforms.filter(p => p.y < canvas.height * 0.5 && !p.isFalling);
        if (high.length > 0) {
            const p = high[Math.floor(Math.random() * high.length)];
            fallingRocks.push({x: p.x + Math.random() * p.width - 15, y: -30, width: 30, height: 30, speedY: ROCK_FALL_SPEED, warningTimer: rockWarningDuration, active: false});
        }
        scheduleRockfall();
    }, delay * (1000/60));
}

function updateLocationFeatures() {
    if (!locationFeatureActive || isBonusLevel) return;
    if (level >= 7 && level <= 9) {
        if (roosterCrowTimer > 0) { roosterCrowTimer--; if (roosterCrowTimer <= 0) { triggerShake(15, 20); disorientationTimer = 90; keysInverted = true; roosterSound.currentTime = 0; roosterSound.play().catch(() => {}); roosterCrowTimer = 300 + Math.floor(Math.random() * 180); } }
        if (disorientationTimer > 0) { disorientationTimer--; if (disorientationTimer <= 0) keysInverted = false; }
    }
    if (level >= 19 && level <= 21) {
        for (let i = fallingRocks.length - 1; i >= 0; i--) {
            const r = fallingRocks[i];
            if (r.warningTimer > 0) { r.warningTimer--; if (r.warningTimer <= 0) r.active = true; }
            if (r.active) r.y += r.speedY;
            if (r.active && rectCollide(player, r)) {
                if (!gameState.isInvincible) { lives--; if (lives <= 0) { if (!lastChanceUsed) { showLastChance(); return; } gameLost(); return; } }
                createExplosion(r.x + r.width/2, r.y + r.height/2); fallingRocks.splice(i,1); continue;
            }
            if (r.y > canvas.height + 50) fallingRocks.splice(i,1);
        }
    }
    if (level >= 22 && level <= 24) {
        ghostTimer--;
        if (ghostTimer <= 0) {
            ghostPhase = (ghostPhase + 1) % 3;
            if (ghostPhase === 1) {
                const rem = platforms.filter(p => !p.isSafety && p.y > 100);
                const cnt = Math.min(3, Math.floor(rem.length * 0.3));
                for (let i = 0; i < cnt && rem.length > 0; i++) { const idx = Math.floor(Math.random() * rem.length); rem[idx].ghostVisible = false; rem.splice(idx,1); }
                ghostTimer = 180;
            } else if (ghostPhase === 2) { platforms.forEach(p => { if (p.ghostVisible === false) p.ghostVisible = true; }); ghostTimer = 300; }
        }
        platforms.forEach(p => {
            if (p.ghostVisible === false) { p.ghostAlpha = (p.ghostAlpha || 1) - 0.02; if (p.ghostAlpha < 0) p.ghostAlpha = 0; }
            else { p.ghostAlpha = Math.min(1, (p.ghostAlpha || 0) + 0.02); }
        });
    }
    if (level >= 25 && level <= 27) {
        fireSpreadTimer--;
        if (fireSpreadTimer <= 0) {
            const unlit = firePlatforms.filter(f => !f.burning);
            if (unlit.length > 0) { const f = unlit[Math.floor(Math.random() * unlit.length)]; f.burning = true; f.burnTimer = 60; }
            fireSpreadTimer = 90 + Math.floor(Math.random() * 60);
        }
        firePlatforms.forEach(f => {
            if (f.burning) { f.burnTimer--; if (f.burnTimer <= 0) { f.life--; if (f.life <= 0) { const idx = platforms.indexOf(f.platform); if (idx >= 0) platforms.splice(idx,1); f.burning = false; } } }
        });
        firePlatforms.forEach(f => {
            if (f.burning && rectCollide(player, f.platform) && !gameState.isInvincible && Math.random() < 0.01) { lives--; if (lives <= 0) { if (!lastChanceUsed) { showLastChance(); return; } gameLost(); return; } }
        });
    }
    if (level >= 10 && level <= 12) {
        if (caveDarkTimer > 0) { caveDarkTimer--; if (caveDarkTimer <= 0) { caveDarkActive = true; caveDarkDuration = 90 + Math.floor(Math.random() * 60); } }
        if (caveDarkActive) {
            caveDarkDuration--;
            if (caveDarkDuration <= 0) { caveDarkActive = false; caveDarkTimer = 480 + Math.floor(Math.random() * 240); }
        }
    }
    if (level >= 16 && level <= 18) {
        if (sandStormTimer > 0) { sandStormTimer--; if (sandStormTimer <= 0) { sandStormActive = true; sandStormDuration = 180 + Math.floor(Math.random() * 120); } }
        if (sandStormActive) {
            sandStormDuration--;
            if (sandStormDuration <= 0) { sandStormActive = false; sandStormTimer = 600 + Math.floor(Math.random() * 300); }
            // Частицы песка
            if (Math.random() < 0.3) {
                particles.push({
                    x: -10, y: Math.random() * canvas.height,
                    speedX: 3 + Math.random() * 4,
                    speedY: -0.5 + Math.random(),
                    size: 2 + Math.random() * 3,
                    color: `rgba(210, 180, 140, ${0.3 + Math.random() * 0.4})`,
                    type: 'sand'
                });
            }
        }
    }
    if (level >= 31 && level <= 33) { tiltSweepTime += 0.02; screenTilt = Math.sin(tiltSweepTime) * MAX_TILT; if (player.grounded) player.dx += Math.sin(tiltSweepTime) * 0.15; }
}

// ============================================================
//                   СБРОС УРОВНЯ
// ============================================================

function triggerShake(intensity, duration) {
    screenShake.intensity = intensity;
    screenShake.duration = duration;
}

function resetLevel() {
    // На бонусном уровне не пересоздаём платформы — они уже установлены в enterBonusLevel()
    if (isBonusLevel) {
        return;
    }
    timeLeft = 50;
    collectedNuts = 0;
    destroyedTraps = 0;
    destroyedEnemies = 0;
    player.x = 50;
    player.y = canvas.height - 150;
    player.dx = 0;
    player.dy = 0;
    player.jumping = false;
    player.grounded = false;
    gameState.gameOver = false;
    gameState.levelChanging = false;
    gameState.isInvincible = false;
    invincibilityBonus = null;
    // Сброс страховочной платформы
    safetyPlatformBonus = null;
    hasSafetyPlatform = false;
    safetyPlatform = null;
    totalJumpsThisLevel = 0;
    maxCombo = 0;
    // Сбрасываем скорость если был бонус скорости
    if (activeBoost === 'speed') {
        player.speed = 5;
    }
    isDoubleScoreActive = false;
    isAimBoostActive = false;
    
    // Магнит сохраняется только если был куплен
    if (activeBoost === 'magnet') gameState.hasMagnet = playerRank.bonus && playerRank.bonus.type === 'extraMagnet' ? false : gameState.hasMagnet;
    
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("countdown").style.display = "none";
    
    clearInterval(timerInterval);
    startTimer();
    
    createPlatforms();
    createNuts();
    startLevel();
    createWeatherEffect();
    
    // Генерируем задания для уровня
    generateChallenges();
    
    // Инициализируем фишку локации
    initLocationFeatures();
    
    // Спавним портал (с 3-го уровня, шанс 20%)
    spawnPortal();
    // Загружаем посещённые мини-игры
    loadVisitedMiniGames();
    
    // Запускаем туториал для этого уровня
    startTutorialForLevel(level);
    
    
    // Показываем canvas (если был скрыт экраном результатов)
    document.getElementById('gameCanvas').style.display = 'block';
    
    // Сбрасываем параллакс-смещение, чтобы не накапливалось между уровнями
    parallaxOffset = 0;
    
    wasBonusLevelPromptActive = false; // сбрасываем флаг
}

// ============================================================
//                  ЭФФЕКТЫ ЛОВУШЕК
// ============================================================

function updateTrapEffects() {
    blink = blink === 1 ? 0.7 : 1;
    shakeOffsetX = Math.random() * 2 - 1;
    shakeOffsetY = Math.random() * 2 - 1;
}

function renderTraps() {
    traps.forEach(trap => {
        ctx.save();
        ctx.globalAlpha = blink;
        ctx.translate(trap.x + shakeOffsetX, trap.y + shakeOffsetY);
        ctx.drawImage(trapImg, 0, 0, trap.width, trap.height);
        ctx.restore();
    });
}

// ============================================================
//                   ВЗРЫВЫ
// ============================================================

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        explosions.push({
            x: x, y: y,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            color: `rgba(255, ${Math.random() * 255}, 0, 1)`,
            life: 30
        });
    }
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const p = explosions[i];
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.1;
        p.life--;
        if (p.life <= 0) explosions.splice(i, 1);
    }
}

function renderExplosions(ctx) {
    explosions.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });
}

// ============================================================
//              БОНУС НЕУЯЗВИМОСТИ
// ============================================================

function updateInvincibilityBonus() {
    if (invincibilityBonus) {
        invincibilityBonus.hue = (invincibilityBonus.hue + 1) % 360;
    }
}

// ============================================================
//                 ПОГОДНЫЕ ЭФФЕКТЫ
// ============================================================

function getWeatherType() {
    if (level >= 4 && level <= 6) return 'rain';
    if (level >= 46 && level <= 48) return 'snow';
    if (level >= 10 && level <= 12) return 'fog';
    if (level >= 24 && level <= 29) return 'ash';
    return null;
}

// ============================================================
//          ЭФФЕКТЫ ПРЫЖКА (ПОКУПНЫЕ ЧАСТИЦЫ)
// ============================================================

// Создать частицы эффекта прыжка в позиции (x, y)
function spawnJumpEffect(x, y) {
    if (!activeJumpEffect) return;
    
    const count = 10;
    for (let i = 0; i < count; i++) {
        let color, size, speedX, speedY;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        
        switch (activeJumpEffect) {
            case 'jumpStars':
                color = Math.random() < 0.5 ? '#FFD700' : '#FFA500';
                size = 2 + Math.random() * 4;
                speedX = Math.cos(angle) * speed;
                speedY = Math.sin(angle) * speed - 1;
                break;
            case 'jumpLeaves':
                color = Math.random() < 0.5 ? '#4CAF50' : '#8BC34A';
                size = 3 + Math.random() * 3;
                speedX = Math.cos(angle) * speed * 0.5;
                speedY = Math.sin(angle) * speed * 0.3 - 0.5;
                break;
            case 'jumpFire':
                color = `hsl(${15 + Math.random() * 20}, 100%, ${50 + Math.random() * 30}%)`;
                size = 3 + Math.random() * 5;
                speedX = Math.cos(angle) * speed * 1.2;
                speedY = Math.sin(angle) * speed * 1.2 - 2;
                break;
        }
        
        jumpParticles.push({
            x: x, y: y,
            dx: speedX || (Math.random() - 0.5) * 4,
            dy: speedY || (Math.random() - 0.5) * 4 - 2,
            size: size || 3,
            color: color || '#FFD700',
            life: 20 + Math.random() * 15,
            maxLife: 35,
            type: activeJumpEffect
        });
    }
}

function createWeatherEffect() {
    particles = [];
    const weather = getWeatherType();
    if (!weather) return;
    
    const count = 100;
    for (let i = 0; i < count; i++) {
        const particle = { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
        
        switch (weather) {
            case 'rain':
                particle.speedY = 5 + Math.random() * 3;
                particle.length = 10 + Math.random() * 10;
                particle.color = 'rgba(0, 119, 190, 0.5)';
                particle.type = 'rain';
                break;
            case 'snow':
                particle.speedY = 1 + Math.random() * 1.5;
                particle.size = 3 + Math.random() * 3;
                particle.color = 'rgba(255, 255, 255, 0.8)';
                particle.type = 'snow';
                break;
            case 'fog':
                particle.speedX = -0.5 + Math.random();
                particle.size = 20 + Math.random() * 30;
                particle.color = 'rgba(200, 200, 200, 0.15)';
                particle.type = 'fog';
                break;
            case 'ash':
                particle.speedY = -0.5 + Math.random() * -1.5;
                particle.size = 2 + Math.random() * 2;
                particle.color = 'rgba(105, 105, 105, 0.5)';
                particle.type = 'ash';
                break;
        }
        particles.push(particle);
    }
}

function updateParticles() {
    const weather = getWeatherType();
    if (!weather) return;
    
    particles.forEach(p => {
        switch (p.type) {
            case 'rain':
                p.y += p.speedY;
                if (p.y > canvas.height) p.y = -p.length;
                break;
            case 'snow':
                p.y += p.speedY;
                if (p.y > canvas.height) p.y = -p.size;
                break;
            case 'fog':
                p.x += p.speedX;
                if (p.x < -p.size) p.x = canvas.width + p.size;
                break;
            case 'ash':
                p.y += p.speedY;
                if (p.y < -p.size) p.y = canvas.height;
                break;
            case 'sand':
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.x > canvas.width + 10) p.x = -10;
                break;
        }
    });
}

function renderParticles() {
    const weather = getWeatherType();
    
    particles.forEach(p => {
        ctx.beginPath();
        switch (p.type) {
            case 'rain':
                if (weather !== 'rain') break;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y + p.length);
                ctx.stroke();
                break;
            case 'snow':
            case 'fog':
            case 'ash':
                if (!weather || weather !== p.type) break;
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'sand':
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'fireTrail':
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                p.life--;
                if (p.life <= 0) p.color = 'rgba(0,0,0,0)';
                break;
        }
        ctx.closePath();
    });
}

// ============================================================
//               ОТРИСОВКА СКИНОВ НА ПЕРСОНАЖЕ
// ============================================================

// Рендер активного скина на бобре (вызывается внутри ctx.save() после отрисовки спрайта)
// Теперь отрисовывает и wearable, и trail скины одновременно
function renderPlayerSkin() {
    const w = player.width;
    const h = player.height;
    
    // Рендерим wearable скин (одежда)
    if (activeWearable) {
        renderSingleSkin(activeWearable, w, h);
    }
    // Рендерим trail скин (след/аура) — частицы и эффекты
    if (activeTrail) {
        renderSingleSkin(activeTrail, w, h);
    }
}

function renderSingleSkin(skinId, w, h) {
    switch (skinId) {
        case 'hat':
            ctx.fillStyle = "#8B4513";
            ctx.beginPath();
            ctx.ellipse(-1, -h / 2 + 2, 18, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#A0522D";
            ctx.fillRect(-13, -h / 2 - 12, 24, 14);
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(-9, -h / 2 - 14, 16, 4);
            break;
            
        case 'glasses':
            ctx.strokeStyle = "#333";
            ctx.lineWidth = 2;
            ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
            ctx.beginPath();
            ctx.ellipse(-8, -h / 2 + 8, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(8, -h / 2 + 8, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-16, -h / 2 + 6);
            ctx.lineTo(-8, -h / 2 + 6);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(16, -h / 2 + 6);
            ctx.lineTo(24, -h / 2 + 4);
            ctx.stroke();
            break;
            
        case 'scarf':
            ctx.fillStyle = "#E74C3C";
            ctx.beginPath();
            ctx.ellipse(0, -h / 2 + 12, 15, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-3, -h / 2 + 11, 8, 16);
            ctx.fillStyle = "#C0392B";
            ctx.fillRect(-3, -h / 2 + 11, 3, 16);
            break;
            
        case 'tailTrail':
            // Обрабатывается в render() как частицы, здесь не нужно
            break;
            
        case 'vest':
            ctx.fillStyle = "#FF6B35";
            ctx.fillRect(-w / 2 + 4, -h / 2 + 14, w - 8, h / 2 - 10);
            ctx.fillStyle = "#FFFF00";
            ctx.fillRect(-w / 2 + 2, -h / 2 + 20, 4, 6);
            ctx.fillRect(w / 2 - 6, -h / 2 + 20, 4, 6);
            break;
            
        case 'backpack':
            ctx.fillStyle = "#2ECC71";
            ctx.fillRect(-w / 2 - 8, -h / 2 + 8, 10, 16);
            ctx.fillStyle = "#27AE60";
            ctx.fillRect(-w / 2 - 7, -h / 2 + 10, 8, 12);
            break;
            
        case 'sword':
            ctx.save();
            ctx.translate(w / 2 + 5, -h / 2 + 20);
            ctx.rotate(-0.3);
            ctx.fillStyle = "#95A5A6";
            ctx.fillRect(0, 0, 4, 24);
            ctx.fillStyle = "#F1C40F";
            ctx.fillRect(-1, 0, 6, 4);
            ctx.fillRect(-1, 20, 6, 4);
            ctx.restore();
            break;
            
        case 'rainbow':
            if (player.dx !== 0 && Date.now() % 2 === 0) {
                const trailX = gameState.isFacingLeft ? w / 2 + 5 : -w / 2 - 5;
                const trailY = h / 4;
                particles.push({
                    x: player.x + player.width / 2 + trailX,
                    y: player.y + player.height / 2 + trailY,
                    speedY: -0.3 + Math.random() * 0.6,
                    size: 3 + Math.random() * 4,
                    color: `hsla(${Math.random() * 360}, 100%, 60%, 0.6)`,
                    type: 'fireTrail',
                    life: 15
                });
            }
            break;
            
        case 'helmet':
            ctx.fillStyle = "#7F8C8D";
            ctx.beginPath();
            ctx.arc(0, -h / 2 + 4, 16, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = "#95A5A6";
            ctx.fillRect(-14, -h / 2, 28, 4);
            break;
            
        case 'crown':
            ctx.fillStyle = "#F1C40F";
            ctx.fillRect(-14, -h / 2 - 2, 28, 6);
            ctx.fillRect(-14, -h / 2 - 10, 5, 10);
            ctx.fillRect(-5, -h / 2 - 12, 5, 12);
            ctx.fillRect(4, -h / 2 - 14, 5, 14);
            ctx.fillRect(10, -h / 2 - 10, 5, 10);
            ctx.fillStyle = "#E74C3C";
            ctx.fillRect(-3, -h / 2 - 10, 3, 3);
            ctx.fillStyle = "#3498DB";
            ctx.fillRect(6, -h / 2 - 12, 3, 3);
            break;
            
        case 'lightning':
            if (Date.now() % 4 === 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 20 + Math.random() * 10;
                const lx = Math.cos(angle) * dist;
                const ly = Math.sin(angle) * dist;
                ctx.save();
                ctx.strokeStyle = "#F1C40F";
                ctx.lineWidth = 2;
                ctx.shadowColor = "#F1C40F";
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx + (Math.random() - 0.5) * 8, ly + 6);
                ctx.stroke();
                ctx.restore();
            }
            break;
            
        case 'fireworks':
            if (!player.grounded && Date.now() % 3 === 0) {
                for (let i = 0; i < 3; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 2;
                    particles.push({
                        x: player.x + player.width / 2,
                        y: player.y + player.height / 2,
                        speedY: Math.sin(angle) * speed,
                        size: 2 + Math.random() * 3,
                        color: `hsla(${Math.random() * 360}, 100%, 60%, 0.8)`,
                        type: 'fireTrail',
                        life: 20
                    });
                }
            }
            break;
    }
}

// ============================================================
//                   ОТРИСОВКА (RENDER)
// ============================================================

function render() {
    // Если виден экран результатов — ничего не рисуем на canvas, пусть DOM resultScreen отображается
    // Используем style.display вместо classList.contains, потому что style.display — inline-стиль,
    // который браузер применяет синхронно, а classList.add может быть отложен.
    const resultScreen = document.getElementById("resultScreen");
    if (resultScreen && resultScreen.style.display === "flex") {
        return;
    }
    
    // Screen Shake
    ctx.save();
    if (screenShake.duration > 0) {
        screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.duration--;
        ctx.translate(screenShake.x, screenShake.y);
    }
    
    // Параллакс-эффект: смещаем фон при движении игрока
    const parallaxSpeed = 0.02;
    parallaxOffset += player.dx * parallaxSpeed;
    
    // Рисуем фон с параллаксом (без смещения при отрицательных значениях)
    ctx.save();
    let bgOffset = (parallaxOffset * 2) % canvas.width;
    if (bgOffset < 0) bgOffset += canvas.width;
    ctx.drawImage(currentBackgroundImg, bgOffset, 0, canvas.width, canvas.height);
    ctx.drawImage(currentBackgroundImg, bgOffset - canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Тёмный фон для бонус-уровня (поверх обычного фона, под всеми объектами)
    if (isBonusLevel) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Песчаная буря — жёлтая дымка
    if (sandStormActive && level >= 16 && level <= 18) {
        ctx.save();
        const sandAlpha = 0.12 + Math.sin(Date.now() / 300) * 0.04;
        ctx.fillStyle = `rgba(210, 180, 140, ${sandAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Дополнительные полосы песка для атмосферы
        for (let i = 0; i < 5; i++) {
            const y = Math.random() * canvas.height;
            const h = 2 + Math.random() * 4;
            ctx.fillStyle = `rgba(220, 190, 150, ${0.05 + Math.random() * 0.08})`;
            ctx.fillRect(0, y, canvas.width, h);
        }
        ctx.restore();
    }
    
    // Пещера — мерцающий свет (затемнение экрана с кругом света вокруг игрока)
    if (caveDarkActive && level >= 10 && level <= 12) {
        ctx.save();
        // Затемняем весь экран
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Вырезаем круг света вокруг игрока
        ctx.globalCompositeOperation = 'destination-out';
        const gradient = ctx.createRadialGradient(
            player.x + player.width / 2, player.y + player.height / 2, 0,
            player.x + player.width / 2, player.y + player.height / 2, 180
        );
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 180, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // Пиратская качка — наклон экрана (31-33)
    if (screenTilt !== 0 && level >= 31 && level <= 33) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(screenTilt);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }
    
    // Платформы всегда отрисовываем (включая бонус-уровень)
    platforms.forEach(platform => {
        ctx.save();
        // Платформы-призраки (руины 22-24) — прозрачность
        if (platform.ghostVisible !== undefined) {
            ctx.globalAlpha = platform.ghostAlpha || 1;
        }
        if (platform.isFalling && platform.fallDelay > 0) {
            ctx.translate(platform.x + platform.width / 2, platform.y + platform.height / 2);
            ctx.rotate(Math.sin(Date.now() / 100) * 0.02);
            ctx.drawImage(groundImg, -platform.width / 2, -platform.height / 2, platform.width, platform.height);
        } else {
            ctx.drawImage(groundImg, platform.x, platform.y, platform.width, platform.height);
        }
        // Огонь на платформах (пожар 25-27)
        if (level >= 25 && level <= 27) {
            const fire = firePlatforms.find(f => f.platform === platform && f.burning);
            if (fire) {
                const fireAlpha = 0.3 + Math.sin(Date.now() / 100 + platform.x) * 0.2;
                ctx.globalAlpha = fireAlpha;
                ctx.fillStyle = '#FF4500';
                ctx.fillRect(platform.x, platform.y - 5, platform.width, 8);
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(platform.x + 2, platform.y - 3, platform.width - 4, 4);
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    });
    
    // Камнепад (горы 19-21) — отрисовка камней и предупреждений
    if (level >= 19 && level <= 21 && fallingRocks.length > 0) {
        fallingRocks.forEach(r => {
            ctx.save();
            if (r.warningTimer > 0 && !r.active) {
                // Жёлтый маркер предупреждения
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 50) * 0.3;
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(r.x, r.y + 60, r.width, 4);
                ctx.globalAlpha = 1;
            } else if (r.active) {
                // Падающий камень
                ctx.fillStyle = '#8B7355';
                ctx.shadowColor = '#555';
                ctx.shadowBlur = 4;
                ctx.fillRect(r.x, r.y, r.width, r.height);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        });
    }
    
    if (!isBonusLevel) {
        renderTraps();
        renderExplosions(ctx);
        renderParticles();
        
        if (enemy) {
            ctx.save();
            if (enemy.direction === -1) {
                ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                ctx.scale(-1, 1);
                ctx.drawImage(wolfImg, -enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
            } else {
                ctx.drawImage(wolfImg, enemy.x, enemy.y, enemy.width, enemy.height);
            }
            ctx.restore();
        }
    }
    
    if (gameState.isInvincible) {
        const gradient = ctx.createRadialGradient(
            player.x + player.width / 2, player.y + player.height / 2, 0,
            player.x + player.width / 2, player.y + player.height / 2, 30
        );
        gradient.addColorStop(0, `hsla(${player.hue}, 100%, 50%, 0.8)`);
        gradient.addColorStop(1, `hsla(${player.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 30, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Огненный след позади бобра при беге (используем activeTrail вместо старого gameState.hasTailTrail)
    if (activeTrail === 'tailTrail' && player.dx !== 0 && Date.now() % 3 === 0) {
        const trailX = gameState.isFacingLeft ? player.x + player.width + 5 : player.x - 5;
        const trailY = player.y + player.height / 2;
        particles.push({
            x: trailX, y: trailY,
            speedY: -0.5 + Math.random(),
            size: 3 + Math.random() * 5,
            color: `hsla(${30 + Math.random() * 30}, 100%, 50%, 0.6)`,
            type: 'fireTrail',
            life: 20
        });
    }
    
    // Тень под игроком (эллипс)
    ctx.save();
    const shadowY = player.y + player.height + 4;
    const shadowScale = player.grounded ? 1 : 0.6;
    const shadowGrad = ctx.createRadialGradient(
        player.x + player.width / 2, shadowY, 0,
        player.x + player.width / 2, shadowY, 20 * shadowScale
    );
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(player.x + player.width / 2, shadowY, 20 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    if (gameState.isFacingLeft) ctx.scale(-1, 1);
    ctx.rotate(player.rotation);
    ctx.drawImage(bobrSprite, frameIndex * frameWidth, 0, frameWidth, frameHeight,
        -player.width / 2, -player.height / 2, player.width, player.height);
    // Отрисовка активного скина
    renderPlayerSkin();
    ctx.restore();
    
    // Обработка частиц огненного следа — с ограничением
    particles = particles.filter(p => p.type !== 'fireTrail' || p.life > 0);
    if (particles.length > 300) particles = particles.slice(-300);
    
    // Свечение предметов — пульсирующее сияние
    nutGlowIntensity = (nutGlowIntensity + 0.02) % (Math.PI * 2);
    const glowAlpha = 0.15 + Math.sin(nutGlowIntensity) * 0.1;
    
    nuts.forEach(nut => {
        ctx.save();
        // Сияние вокруг предмета
        const glowGrad = ctx.createRadialGradient(
            nut.x + nut.width / 2, nut.y + nut.height / 2, 2,
            nut.x + nut.width / 2, nut.y + nut.height / 2, 25
        );
        glowGrad.addColorStop(0, `rgba(255, 215, 0, ${glowAlpha})`);
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(nut.x + nut.width / 2, nut.y + nut.height / 2, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(nutImg, nut.x, nut.y, nut.width, nut.height);
        ctx.restore();
    });
    
    // Звук шагов при беге
    if (player.grounded && Math.abs(player.dx) > 0 && !isBonusLevel) {
        if (!stepsSound.paused) {
            // уже играет
        } else if (Math.random() < 0.02) {
            stepsSound.currentTime = 0;
            stepsSound.play().catch(() => {});
        }
    } else {
        if (!stepsSound.paused) stepsSound.pause();
    }
    
    // Частицы пыли при беге
    if (player.grounded && Math.abs(player.dx) > 0 && Math.random() < 0.3) {
        const dustX = gameState.isFacingLeft ? player.x + player.width : player.x;
        const dustY = player.y + player.height;
        runningParticles.push({
            x: dustX, y: dustY,
            dx: (Math.random() - 0.5) * 2,
            dy: -Math.random() * 2,
            size: 2 + Math.random() * 4,
            alpha: 0.6,
            life: 30
        });
    }
    runningParticles = runningParticles.filter(p => p.life > 0);
    if (runningParticles.length > 50) runningParticles = runningParticles.slice(-50);
    runningParticles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.alpha -= 0.02;
        p.life--;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = '#aa8855';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    
    // Отрисовка частиц эффекта прыжка
    if (jumpParticles.length > 0) {
        for (let i = jumpParticles.length - 1; i >= 0; i--) {
            const p = jumpParticles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.dy += 0.1; // небольшая гравитация
            p.life--;
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (p.life <= 0) {
                jumpParticles.splice(i, 1);
            }
        }
    }
    
    if (!isBonusLevel) {
        nutEffects = nutEffects.filter(e => e.alpha > 0);
        nutEffects.forEach(effect => {
            ctx.save();
            ctx.globalAlpha = effect.alpha;
            ctx.translate(effect.x + 15, effect.y + 15);
            ctx.scale(effect.scale, effect.scale);
            ctx.drawImage(nutImg, -15, -15, 30, 30);
            ctx.restore();
            effect.scale += 0.05;
            effect.alpha -= 0.05;
        });
    }
    
    if (!isBonusLevel && TimeAdd) {
        TimeAdd.rotation += 0.05;
        ctx.save();
        ctx.translate(TimeAdd.x + TimeAdd.width / 2, TimeAdd.y + TimeAdd.height / 2);
        ctx.rotate(TimeAdd.rotation);
        ctx.drawImage(clockImg, -TimeAdd.width / 2, -TimeAdd.height / 2, TimeAdd.width, TimeAdd.height);
        ctx.restore();
    }
    
    if (!isBonusLevel && LiveAdd) {
        LiveAdd.scale += LiveAdd.pulseDirection;
        if (LiveAdd.scale >= 1.1 || LiveAdd.scale <= 0.9) LiveAdd.pulseDirection *= -1;
        ctx.save();
        ctx.translate(LiveAdd.x + LiveAdd.width / 2, LiveAdd.y + LiveAdd.height / 2);
        ctx.scale(LiveAdd.scale, LiveAdd.scale);
        ctx.drawImage(liveImg, -LiveAdd.width / 2, -LiveAdd.height / 2, LiveAdd.width, LiveAdd.height);
        ctx.restore();
    }
    
    if (!isBonusLevel && invincibilityBonus) {
        ctx.save();
        const gradient = ctx.createRadialGradient(
            invincibilityBonus.x + invincibilityBonus.width / 2,
            invincibilityBonus.y + invincibilityBonus.height / 2, 0,
            invincibilityBonus.x + invincibilityBonus.width / 2,
            invincibilityBonus.y + invincibilityBonus.height / 2, 30
        );
        gradient.addColorStop(0, `hsla(${invincibilityBonus.hue}, 100%, 50%, 0.8)`);
        gradient.addColorStop(1, `hsla(${invincibilityBonus.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(invincibilityBonus.x + invincibilityBonus.width / 2,
            invincibilityBonus.y + invincibilityBonus.height / 2, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(invincibilityBonusImg, invincibilityBonus.x, invincibilityBonus.y,
            invincibilityBonus.width, invincibilityBonus.height);
        ctx.restore();
    }
    
    // Отрисовка иконки страховочной платформы
    if (!isBonusLevel && safetyPlatformBonus) {
        safetyPlatformBonus.hue = (safetyPlatformBonus.hue + 1) % 360;
        safetyPlatformBonus.scale += safetyPlatformBonus.pulseDirection;
        if (safetyPlatformBonus.scale >= 1.15 || safetyPlatformBonus.scale <= 0.85) safetyPlatformBonus.pulseDirection *= -1;
        ctx.save();
        // Золотое свечение вокруг камня
        const grad = ctx.createRadialGradient(
            safetyPlatformBonus.x + safetyPlatformBonus.width / 2,
            safetyPlatformBonus.y + safetyPlatformBonus.height / 2, 0,
            safetyPlatformBonus.x + safetyPlatformBonus.width / 2,
            safetyPlatformBonus.y + safetyPlatformBonus.height / 2, 35
        );
        grad.addColorStop(0, `hsla(${safetyPlatformBonus.hue}, 100%, 60%, 0.6)`);
        grad.addColorStop(1, `hsla(${safetyPlatformBonus.hue}, 100%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(safetyPlatformBonus.x + safetyPlatformBonus.width / 2,
            safetyPlatformBonus.y + safetyPlatformBonus.height / 2, 35, 0, Math.PI * 2);
        ctx.fill();
        // Камень с пульсацией
        ctx.translate(safetyPlatformBonus.x + safetyPlatformBonus.width / 2, 
            safetyPlatformBonus.y + safetyPlatformBonus.height / 2);
        ctx.scale(safetyPlatformBonus.scale, safetyPlatformBonus.scale);
        ctx.drawImage(safetyPlatformImg, -safetyPlatformBonus.width / 2, -safetyPlatformBonus.height / 2,
            safetyPlatformBonus.width, safetyPlatformBonus.height);
        ctx.restore();
    }
    
    // Отрисовка страховочной платформы (если активна)
    if (!isBonusLevel && hasSafetyPlatform && safetyPlatform) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(0, 180, 255, 0.25)';
        ctx.fillRect(safetyPlatform.x, safetyPlatform.y, safetyPlatform.width, safetyPlatform.height);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 3;
        ctx.strokeRect(safetyPlatform.x, safetyPlatform.y, safetyPlatform.width, safetyPlatform.height);
        // Надпись на платформе
        ctx.fillStyle = 'rgba(0, 180, 255, 0.7)';
        ctx.font = 'bold 16px "Comic Sans MS", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('🛡️ СТРАХОВКА', safetyPlatform.x + safetyPlatform.width / 2, safetyPlatform.y + 32);
        ctx.restore();
    }
    
    // Отрисовка портала
    renderPortal();
    // Отрисовка инструкции мини-игры
    renderMiniGameInstruction();
    // Отрисовка мини-игр (поверх всего)
    renderMiniGame();
    
    // Отрисовка бонусного уровня поверх всего
    renderBonusLevel();
    
    // Завершаем наклон для пиратской качки (31-33) — перед HUD, чтобы HUD был без наклона
    if (screenTilt !== 0 && level >= 31 && level <= 33) {
        ctx.restore();
    }
    
    DrawHUD();
    
    // Комбо-индикатор — улучшенный
    if (comboCount >= 2) {
        ctx.save();
        
        // Цвет в зависимости от уровня комбо
        let comboColor, glowColor;
        if (comboCount >= 10) { comboColor = '#FF00FF'; glowColor = 'rgba(255,0,255,0.5)'; }
        else if (comboCount >= 5) { comboColor = '#FF4500'; glowColor = 'rgba(255,69,0,0.5)'; }
        else { comboColor = '#FFD700'; glowColor = 'rgba(255,215,0,0.4)'; }
        
        const comboText = `🔥 x${comboCount}`;
        ctx.font = "bold 40px 'Comic Sans MS', cursive";
        const comboWidth = ctx.measureText(comboText).width;
        const boxW = comboWidth + 40;
        const boxH = 60;
        const boxX = canvas.width / 2 - boxW / 2;
        const boxY = 125;
        
        // Фон — скруглённый с градиентом
        const grad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
        grad.addColorStop(0, 'rgba(0,0,0,0.7)');
        grad.addColorStop(1, 'rgba(0,0,0,0.5)');
        roundRect(ctx, boxX, boxY, boxW, boxH, 12, true, grad, true, 'rgba(255,215,0,0.2)', 2);
        
        // Текст с glow
        ctx.fillStyle = comboColor;
        ctx.textAlign = "center";
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 20 + Math.sin(Date.now() / 100) * 5;
        ctx.fillText(comboText, canvas.width / 2, boxY + 42);
        ctx.shadowBlur = 0;
        
        // Полоска обратного отсчёта
        const barW = boxW - 20;
        const barH = 4;
        const barX = boxX + 10;
        const barY = boxY + boxH - 8;
        const progress = comboTimer / 120;
        
        // Фон полоски
        roundRect(ctx, barX, barY, barW, barH, 2, true, 'rgba(255,255,255,0.15)', true, 'rgba(255,255,255,0.2)', 1);
        // Заполненная часть
        const fillW = barW * progress;
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrad.addColorStop(0, '#FFD700');
        barGrad.addColorStop(1, '#FF4500');
        if (fillW > 0) {
            roundRect(ctx, barX, barY, fillW, barH, 2, true, barGrad, false, null);
        }
        
        ctx.restore();
    }
    
    ctx.restore(); // Восстанавливаем screen shake
}

// ============================================================
//                       HUD
// ============================================================

function DrawHUD() {
    // === ПОЛОСКА ВРЕМЕНИ ===
    const barWidth = 200;
    const barHeight = 18;
    const barX = 15;
    const barY = 80;
    const timeRatio = Math.min(1, Math.max(0, timeLeft / 50));
    
    // Фон (закруглённый)
    ctx.save();
    roundRect(ctx, barX, barY, barWidth, barHeight, 9, true, 'rgba(0,0,0,0.6)', false, null);
    
    // Заполненная часть — градиент от зелёного к красному
    const r = Math.floor(255 * (1 - timeRatio));
    const g = Math.floor(255 * timeRatio);
    const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    gradient.addColorStop(0, `rgb(${r}, ${g}, 50)`);
    gradient.addColorStop(1, `rgb(${Math.min(255, r + 50)}, ${Math.max(0, g - 50)}, 50)`);
    const fillW = Math.max(4, barWidth * timeRatio);
    roundRect(ctx, barX, barY, fillW, barHeight, 9, true, gradient, false, null);
    
    // Рамка
    roundRect(ctx, barX, barY, barWidth, barHeight, 9, false, null, true, 'rgba(255,255,255,0.8)', 2);
    
    // Иконка часов + время внутри полоски
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText("⏱ " + timeLeft + "с", barX + barWidth / 2, barY + 14);
    ctx.restore();
    
    // === УРОВЕНЬ ===
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, canvas.width / 2 - 110, 8, 220, 45, 12, true, 'rgba(0,0,0,0.5)', false, null);
    ctx.fillStyle = "gold";
    ctx.font = "bold 32px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText("🌲 Уровень " + level, canvas.width / 2, 42);
    ctx.shadowBlur = 0;
    ctx.restore();
    
    // === ЖИЗНИ (сердечки) ===
    ctx.save();
    const heartSize = 36;
    const heartY = 82; // сдвинуто на 2px вниз
    if (lives >= 8) {
        // Если жизней 8 или больше — показываем 1 сердечко + цифру
        ctx.shadowColor = "rgba(255, 0, 0, 0.4)";
        ctx.shadowBlur = 10;
        ctx.font = `${heartSize}px "Comic Sans MS", cursive`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff0044";
        ctx.fillText("❤️", canvas.width / 2 - 40, heartY);
        ctx.shadowBlur = 0;
        ctx.font = "bold 28px 'Comic Sans MS', cursive";
        ctx.fillStyle = "#ff6666";
        ctx.fillText("× " + lives, canvas.width / 2 + 20, heartY);
    } else {
        const heartStartX = canvas.width / 2 - (lives * heartSize) / 2;
        ctx.font = `${heartSize}px "Comic Sans MS", cursive`;
        ctx.textAlign = "center";
        for (let i = 0; i < lives; i++) {
            const heartX = heartStartX + i * (heartSize + 5) + heartSize / 2;
            ctx.shadowColor = "rgba(255, 0, 0, 0.4)";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#ff0044";
            ctx.fillText("❤️", heartX, heartY);
            ctx.shadowBlur = 0;
        }
    }
    ctx.restore();
    
    // === БОБРОЧКИ (сдвинуты вниз, чтобы не налезать на сердечки) ===
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const scoreText = score + " 🪙";
    ctx.font = "bold 24px 'Comic Sans MS', cursive";
    const scoreW = ctx.measureText(scoreText).width;
    const scoreX = canvas.width / 2;
    roundRect(ctx, scoreX - (scoreW + 30) / 2, 105, scoreW + 30, 35, 10, true, 'rgba(0,0,0,0.5)', false, null);
    ctx.fillStyle = "gold";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 215, 0, 0.3)";
    ctx.shadowBlur = 6;
    ctx.fillText(scoreText, scoreX, 130);
    ctx.shadowBlur = 0;
    ctx.restore();
    
    // === СОБРАННЫЕ ПРЕДМЕТЫ ===
    ctx.save();
    const allCollected = collectedNuts >= totalNuts;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const collectText = "📦 " + collectedNuts + " / " + totalNuts;
    ctx.font = "bold 22px 'Comic Sans MS', cursive";
    const collectW = ctx.measureText(collectText).width;
    roundRect(ctx, 10, 8, collectW + 30, 40, 10, true, 'rgba(0,0,0,0.5)', false, null);
    ctx.fillStyle = allCollected ? "#4CAF50" : "#00ccff";
    ctx.textAlign = "center";
    ctx.fillText(collectText + (allCollected ? " ✅" : ""), 10 + (collectW + 30) / 2, 35);
    ctx.restore();
    
    // === РАНГ (правый верхний угол) ===
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const rankText = playerRank.name;
    ctx.font = "bold 18px 'Comic Sans MS', cursive";
    const rankW = ctx.measureText(rankText).width;
    roundRect(ctx, canvas.width - rankW - 30, 8, rankW + 25, 35, 10, true, 'rgba(0,0,0,0.6)', false, null);
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "left";
    ctx.fillText(playerRank.name, canvas.width - rankW - 17, 32);
    ctx.restore();
    
    // === БОНУСНЫЕ ЗАДАНИЯ ===
    if (levelChallenges.length > 0 && !isBonusLevel) {
        ctx.save();
        const startX = 10;
        const startY = canvas.height - (levelChallenges.length * 30 + 20);
        roundRect(ctx, startX, startY, 280, levelChallenges.length * 30 + 15, 10, true, 'rgba(0,0,0,0.65)', true, 'rgba(255,215,0,0.2)', 1);
        
        ctx.font = "16px 'Comic Sans MS', cursive";
        levelChallenges.forEach((c, i) => {
            const completed = c.check();
            let icon, color;
            if (completed) {
                icon = '✅';
                color = '#4CAF50';
            } else if (c.isFailed && c.isFailed()) {
                icon = '❌';
                color = '#ff4444';
            } else {
                icon = '⬜';
                color = '#ccc';
            }
            ctx.fillStyle = color;
            ctx.textAlign = "left";
            ctx.fillText(`${icon} ${c.desc}`, startX + 12, startY + 24 + i * 30);
        });
        ctx.restore();
    }
    
    // === АКТИВНЫЙ БОНУС ===
    if (activeBoost) {
        ctx.save();
        const pools = [getBoostPool(1), getBoostPool(9), getBoostPool(21)];
        let boost = null;
        for (const p of pools) {
            boost = p.find(b => b.id === activeBoost);
            if (boost) break;
        }
        if (boost) {
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            const bonusText = `⚡ ${boost.name}`;
            ctx.font = "16px 'Comic Sans MS', cursive";
            const bW = ctx.measureText(bonusText).width;
            roundRect(ctx, canvas.width - bW - 30, 50, bW + 25, 30, 8, true, 'rgba(0,0,0,0.6)', true, 'rgba(0,255,0,0.2)', 1);
            ctx.fillStyle = "#00FF00";
            ctx.textAlign = "right";
            ctx.fillText(bonusText, canvas.width - 15, 70);
        }
        ctx.restore();
    }
}

// Вспомогательная функция для закруглённых прямоугольников
function roundRect(ctx, x, y, w, h, r, fill, fillStyle, stroke, strokeStyle, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth || 2;
        ctx.stroke();
    }
}

// ============================================================
//                   ИГРОВОЙ ЦИКЛ
// ============================================================

function gameLoop(timestamp) {
    if (!gameState.isGameStarted) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Delta time для независимости от FPS
    if (lastFrameTime === 0) lastFrameTime = timestamp;
    deltaTime = Math.min((timestamp - lastFrameTime) / FIXED_TIMESTEP, 3); // кап на 3x
    lastFrameTime = timestamp;
    
    // Начинаем отсчёт сессии, если ещё не начат
    if (gameState.sessionStartTime === null) {
        gameState.sessionStartTime = Date.now();
    }
    
    // Обновляем общее время игры (каждую секунду)
    if (gameState.sessionStartTime) {
        const sessionElapsed = Math.floor((Date.now() - gameState.sessionStartTime) / 1000);
        gameState.totalPlayTime = Math.max(gameState.totalPlayTime, sessionElapsed);
    }
    
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// ============================================================
//                     ЗАПУСК
// ============================================================

function initAndStart() {
    initGame();
    requestAnimationFrame(gameLoop);
}

// ============================================================
//              МОБИЛЬНОЕ УПРАВЛЕНИЕ
// ============================================================

function setupMobileControls() {
    const leftBtn = document.getElementById('mobileLeft');
    const rightBtn = document.getElementById('mobileRight');
    const jumpBtn = document.getElementById('mobileJump');
    
    if (!leftBtn) return; // Не на мобильном — не добавляем
    
    function addTouchListeners(btn, key) {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState[key] = true;
            btn.classList.add('active');
        });
        // Для кнопки прыжка — сбрасываем флаг при отпускании
        if (key === 'touchJump') {
            btn.addEventListener('touchend', (e) => {
                jumpButtonReleased = true;
            });
            btn.addEventListener('touchcancel', () => {
                jumpButtonReleased = true;
            });
        }
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState[key] = false;
            btn.classList.remove('active');
        });
        btn.addEventListener('touchcancel', (e) => {
            gameState[key] = false;
            btn.classList.remove('active');
        });
        // Для мыши тоже (на случай если на десктопе)
        btn.addEventListener('mousedown', () => {
            gameState[key] = true;
            btn.classList.add('active');
        });
        btn.addEventListener('mouseup', () => {
            gameState[key] = false;
            btn.classList.remove('active');
        });
        btn.addEventListener('mouseleave', () => {
            gameState[key] = false;
            btn.classList.remove('active');
        });
    }
    
    addTouchListeners(leftBtn, 'touchLeft');
    addTouchListeners(rightBtn, 'touchRight');
    addTouchListeners(jumpBtn, 'touchJump');
}

// ============================================================
//               ТУТОРИАЛ (ОБУЧЕНИЕ)
// ============================================================

// Определения шагов туториала
const TUTORIAL_STEPS = {
    1: [
        {
            id: 'move',
            text: '👋 Нажми <b>←</b> или <b>→</b> чтобы двигать Бубора влево и вправо!',
            check: () => keys.ArrowLeft || keys.KeyA || keys.ArrowRight || keys.KeyD || gameState.touchLeft || gameState.touchRight,
            getHighlight: () => { return { x: canvas.width/2 - 50, y: canvas.height - 100, width: 100, height: 60 }; },
            arrowDir: 'down',
            arrowX: () => canvas.width/2 - 15,
            arrowY: () => canvas.height - 160,
            tooltipPos: 'top'
        },
        {
            id: 'jump',
            text: '🦘 Нажми <b>W</b> или <b>Пробел</b> чтобы прыгнуть!',
            check: () => totalJumps > 0,
            getHighlight: () => { return { x: canvas.width/2 + 150, y: canvas.height - 100, width: 60, height: 60 }; },
            arrowDir: 'up',
            arrowX: () => canvas.width/2 + 165,
            arrowY: () => canvas.height - 180,
            tooltipPos: 'top'
        },
        {
            id: 'collect',
            text: '🥜 Собирай орешки, проходя через них! Они дают очки.',
            check: () => collectedNuts >= 1,
            getHighlight: () => {
                if (nuts.length > 0) {
                    return { x: nuts[0].x - 5, y: nuts[0].y - 5, width: nuts[0].width + 10, height: nuts[0].height + 10 };
                }
                return null;
            },
            arrowDir: 'down',
            arrowX: () => nuts.length > 0 ? nuts[0].x + 10 : canvas.width/2,
            arrowY: () => nuts.length > 0 ? nuts[0].y - 40 : 200,
            tooltipPos: 'top'
        },
        {
            id: 'complete',
            text: '🎯 Собери <b>все</b> предметы на уровне, чтобы пройти его!',
            check: () => collectedNuts >= totalNuts,
            getHighlight: () => null,
            arrowDir: null,
            arrowX: () => 0,
            arrowY: () => 0,
            tooltipPos: 'center'
        }
    ],
    2: [
        {
            id: 'challenges',
            text: '📋 На каждом уровне есть <b>задания</b> (вверху экрана). Выполняй их для бонусных очков!',
            check: () => collectedNuts >= 1,
            getHighlight: () => null,
            arrowDir: 'up',
            arrowX: () => canvas.width/2 - 15,
            arrowY: () => 70,
            tooltipPos: 'bottom'
        },
        {
            id: 'traps_warning',
            text: '⚠️ Осторожно, <b>ловушки</b>! При столкновении теряешь жизнь, но они взрываются и уничтожают соседние!',
            check: () => destroyedTraps >= 1,
            getHighlight: () => {
                return { x: 0, y: 0, width: 0, height: 0 };
            },
            arrowDir: null,
            arrowX: () => 0,
            arrowY: () => 0,
            tooltipPos: 'center'
        },
        {
            id: 'collect2',
            text: '🥜 Собери все предметы!',
            check: () => collectedNuts >= totalNuts,
            getHighlight: () => null,
            arrowDir: null,
            arrowX: () => 0,
            arrowY: () => 0,
            tooltipPos: 'center'
        }
    ],
    3: [
        {
            id: 'combo',
            text: '🔥 <b>Комбо!</b> Собирай предметы подряд без задержки, чтобы множить очки!',
            check: () => comboCount >= 2,
            getHighlight: () => null,
            arrowDir: null,
            arrowX: () => 0,
            arrowY: () => 0,
            tooltipPos: 'center'
        },
        {
            id: 'complete3',
            text: '🎯 Отлично! Теперь ты готов к приключениям! Удачи, Бубор!',
            check: () => collectedNuts >= totalNuts,
            getHighlight: () => null,
            arrowDir: null,
            arrowX: () => 0,
            arrowY: () => 0,
            tooltipPos: 'center'
        }
    ]
};

let tutorialActive = false;
let tutorialCompletedLevels = [];
let currentTutorialStepIndex = 0;
let currentTutorialSteps = null;
let tutorialSkipped = false;

function loadTutorialData() {
    const saved = localStorage.getItem('tutorialCompleted');
    if (saved) {
        try { tutorialCompletedLevels = JSON.parse(saved); } catch(e) { tutorialCompletedLevels = []; }
    }
}

function saveTutorialData() {
    localStorage.setItem('tutorialCompleted', JSON.stringify(tutorialCompletedLevels));
}

function skipTutorial() {
    tutorialSkipped = true;
    hideTutorial();
    // Отмечаем уровни 1-3 как пройденные в обучении
    if (!tutorialCompletedLevels.includes(1)) tutorialCompletedLevels.push(1);
    if (!tutorialCompletedLevels.includes(2)) tutorialCompletedLevels.push(2);
    if (!tutorialCompletedLevels.includes(3)) tutorialCompletedLevels.push(3);
    saveTutorialData();
}

function startTutorialForLevel(levelNum) {
    if (tutorialSkipped) return;
    if (levelNum > 3) return;
    if (tutorialCompletedLevels.includes(levelNum)) return;
    if (!TUTORIAL_STEPS[levelNum]) return;
    
    tutorialActive = true;
    currentTutorialSteps = TUTORIAL_STEPS[levelNum];
    currentTutorialStepIndex = 0;
    showTutorialStep();
}

function showTutorialStep() {
    if (!tutorialActive || !currentTutorialSteps) return;
    if (currentTutorialStepIndex >= currentTutorialSteps.length) {
        completeTutorialForLevel();
        return;
    }
    
    const step = currentTutorialSteps[currentTutorialStepIndex];
    if (!step) return;
    
    const overlay = document.getElementById('tutorialOverlay');
    const highlight = overlay.querySelector('.tutorial-highlight');
    const tooltip = overlay.querySelector('.tutorial-tooltip');
    const arrow = overlay.querySelector('.tutorial-arrow');
    
    overlay.classList.add('show');
    
    // Позиционируем подсветку
    const hlRect = typeof step.getHighlight === 'function' ? step.getHighlight() : null;
    if (hlRect && hlRect.width > 0) {
        highlight.style.display = 'block';
        highlight.style.left = hlRect.x + 'px';
        highlight.style.top = hlRect.y + 'px';
        highlight.style.width = hlRect.width + 'px';
        highlight.style.height = hlRect.height + 'px';
    } else {
        highlight.style.display = 'none';
    }
    
    // Позиционируем тултип
    let tooltipX, tooltipY;
    if (step.tooltipPos === 'center') {
        tooltipX = canvas.width/2 - 180;
        tooltipY = canvas.height/2 - 40;
    } else if (hlRect && hlRect.width > 0) {
        if (step.tooltipPos === 'top') {
            tooltipX = hlRect.x + hlRect.width/2 - 180;
            tooltipY = hlRect.y - 80;
        } else {
            tooltipX = hlRect.x + hlRect.width/2 - 180;
            tooltipY = hlRect.y + hlRect.height + 20;
        }
    } else {
        tooltipX = canvas.width/2 - 180;
        tooltipY = canvas.height/2 - 40;
    }
    
    // Ограничиваем по краям
    tooltipX = Math.max(20, Math.min(canvas.width - 380, tooltipX));
    
    tooltip.style.display = 'block';
    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
    tooltip.innerHTML = step.text;
    // Сбрасываем анимацию для повторного показа
    tooltip.style.animation = 'none';
    tooltip.offsetHeight;
    tooltip.style.animation = 'tutorialTooltipIn 0.4s ease-out';
    
    // Позиционируем стрелку
    const arrowDir = typeof step.arrowDir === 'function' ? step.arrowDir() : step.arrowDir;
    if (arrowDir) {
        arrow.style.display = 'block';
        arrow.textContent = arrowDir === 'up' ? '⬆' : '⬇';
        arrow.className = 'tutorial-arrow' + (arrowDir === 'down' ? ' tutorial-arrow-down' : '');
        const ax = typeof step.arrowX === 'function' ? step.arrowX() : step.arrowX;
        const ay = typeof step.arrowY === 'function' ? step.arrowY() : step.arrowY;
        arrow.style.left = ax + 'px';
        arrow.style.top = ay + 'px';
    } else {
        arrow.style.display = 'none';
    }
    
    // Показываем кнопку пропуска
    overlay.querySelector('.tutorial-skip-btn').style.display = 'block';
    
    // Запускаем авто-пропуск шага через 12 секунд
    startTutorialAutoSkip();
}

let tutorialStepTimer = null; // таймер для авто-пропуска шага

function updateTutorial() {
    if (!tutorialActive || !currentTutorialSteps) return;
    if (!gameState.isGameStarted || gameState.isPaused) return;
    
    const step = currentTutorialSteps[currentTutorialStepIndex];
    if (!step) return;
    
    // Проверяем, выполнено ли условие шага
    if (typeof step.check === 'function' && step.check()) {
        // Сбрасываем таймер авто-пропуска
        if (tutorialStepTimer) {
            clearTimeout(tutorialStepTimer);
            tutorialStepTimer = null;
        }
        // Переходим к следующему шагу
        currentTutorialStepIndex++;
        showTutorialStep();
    }
}

// Запускаем таймер авто-пропуска после каждого показа шага
function startTutorialAutoSkip() {
    if (tutorialStepTimer) clearTimeout(tutorialStepTimer);
    // Автоматически пропускаем шаг через 12 секунд, если игрок не выполнил условие
    tutorialStepTimer = setTimeout(() => {
        if (tutorialActive && currentTutorialSteps) {
            currentTutorialStepIndex++;
            showTutorialStep();
        }
        tutorialStepTimer = null;
    }, 12000);
}

function completeTutorialForLevel() {
    if (!tutorialActive) return;
    tutorialActive = false;
    hideTutorial();
    
    const levelNum = level;
    if (!tutorialCompletedLevels.includes(levelNum)) {
        tutorialCompletedLevels.push(levelNum);
        saveTutorialData();
    }
}

function hideTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    overlay.classList.remove('show');
    overlay.querySelector('.tutorial-highlight').style.display = 'none';
    overlay.querySelector('.tutorial-tooltip').style.display = 'none';
    overlay.querySelector('.tutorial-arrow').style.display = 'none';
    overlay.querySelector('.tutorial-skip-btn').style.display = 'block';
}

// ============================================================
//               ПЛАВНЫЙ ПЕРЕХОД МЕЖДУ УРОВНЯМИ
// ============================================================

function showLevelTransition(callback) {
    const transition = document.getElementById('levelTransition');
    if (!transition) { if (callback) callback(); return; }
    
    transition.classList.add('active');
    
    setTimeout(() => {
        if (callback) callback();
        setTimeout(() => {
            transition.classList.remove('active');
        }, 300);
    }, 500);
}

function fadeBetweenLevels(callback) {
    showLevelTransition(callback);
}

// ============================================================
//               АЧИВКИ
// ============================================================

function unlockAchievement(name, description) {
    if (gameState.achievements.includes(name)) return; // Уже есть
    
    gameState.achievements.push(name);
    achievementSound.play();
    
    // Показываем popup
    const popup = document.getElementById('achievementPopup');
    if (!popup) return;
    
    popup.innerHTML = `🏆 <strong>Ачивка!</strong><br>${description}`;
    popup.classList.add('show');
    
    setTimeout(() => {
        popup.classList.remove('show');
    }, 3000);
    
    // Сохраняем в localStorage
    localStorage.setItem('achievements', JSON.stringify(gameState.achievements));
}

function checkAchievements() {
    // === ПРОГРЕСС ===
    // "Первые шаги" — собрать первый предмет
    if (collectedNuts >= 1) {
        unlockAchievement('first_nut', '🥜 Первый орешек собран!');
    }
    // "Коллекционер" — собрать все предметы на уровне
    if (collectedNuts >= totalNuts) {
        unlockAchievement('full_collect', '📦 Все предметы уровня собраны!');
    }
    // "Марафонец" — пройти 10 уровней
    if (level >= 10) {
        unlockAchievement('levels_10', '🏃 Марафонец — пройдено 10 уровней!');
    }
    // "Серебряный бобр" — пройти 5 уровней
    if (level >= 5) {
        unlockAchievement('levels_5', '🥈 Серебряный бобр — 5 уровней!');
    }
    // "Золотой бобр" — пройти 15 уровней
    if (level >= 15) {
        unlockAchievement('levels_15', '🥇 Золотой бобр — 15 уровней!');
    }
    // "Профессионал" — пройти 25 уровней
    if (level >= 25) {
        unlockAchievement('levels_25', '🏅 Профессионал — пройдено 25 уровней!');
    }
    // "Покоритель" — пройти 36 уровней
    if (level >= 48) {
        unlockAchievement('levels_48', '👑 Покоритель — пройдены все 48 уровней!');
    }
    // "Тысячник" — набрать 5000 очков суммарно
    if (score >= 5000) {
        unlockAchievement('score_5000', '💰 Тысячник — набрано 5000 очков!');
    }
    // "Бобр-миллионер" — набрать 10000 очков
    if (score >= 10000) {
        unlockAchievement('score_10000', '💎 Бобр-миллионер — 10000 очков!');
    }
    
    // === БОЕВЫЕ ===
    // "Разрушитель" — уничтожить 20 ловушек
    if (totalTrapsDestroyed >= 20) {
        unlockAchievement('traps_20', '💥 Разрушитель — 20 ловушек уничтожено!');
    }
    // "Сапёр" — уничтожить 50 ловушек
    if (totalTrapsDestroyed >= 50) {
        unlockAchievement('traps_50', '🧨 Сапёр — 50 ловушек уничтожено!');
    }
    // "Землекоп" — уничтожить 100 ловушек
    if (totalTrapsDestroyed >= 100) {
        unlockAchievement('traps_100', '⛏️ Землекоп — 100 ловушек!');
    }
    // "Охотник 2" — убить 10 врагов
    if (totalEnemiesKilled >= 10) {
        unlockAchievement('hunter_10', '🎯 Охотник — 10 врагов уничтожено!');
    }
    // "Охотник 3" — убить 25 врагов
    if (totalEnemiesKilled >= 25) {
        unlockAchievement('hunter_25', '🏹 Охотник-мастер — 25 врагов!');
    }
    
    // === ЖИВУЧЕСТЬ ===
    // "Живучий" — не потерять жизни на уровне (уже было)
    if (lives >= 3 && level > 1) {
        unlockAchievement('no_damage', '🛡️ Пройден уровень без потери жизней!');
    }
    // "Мастер" — набрать 1000 очков (было, расширено)
    if (score >= 1000) {
        unlockAchievement('master', '⭐ Мастер — набрано 1000 очков!');
    }
    
    // === ПРЫЖКИ ===
    if (totalJumps >= 100) {
        unlockAchievement('jumps_100', '🦘 100 прыжков!');
    }
    if (totalJumps >= 500) {
        unlockAchievement('jumps_500', '🚀 500 прыжков!');
    }
    if (totalJumps >= 1000) {
        unlockAchievement('jumps_1000', '💫 1000 прыжков!');
    }
    
    // === СКОРОСТЬ ===
    if (timeLeft >= 30 && collectedNuts >= totalNuts) {
        unlockAchievement('speedy', '⚡ Скороход — пройдено с >30 сек!');
    }
    if (timeLeft <= 5 && collectedNuts >= totalNuts) {
        unlockAchievement('last_second', '⏰ Торопыга — меньше 5 сек осталось!');
    }
}

// ============================================================
//               ТАБЛИЦА РЕКОРДОВ
// ============================================================

function updateBestScore(score) {
    const bestScore = localStorage.getItem('bestScore');
    if (!bestScore || score > parseInt(bestScore)) {
        localStorage.setItem('bestScore', score.toString());
        updateBestScoreDisplay();
    }
}

function updateBestScoreDisplay() {
    const display = document.getElementById('bestScoreDisplay');
    if (!display) return;
    const bestScore = localStorage.getItem('bestScore');
    display.textContent = bestScore ? `${bestScore} боброчков` : 'Пока нет рекордов';
}

// ============================================================
//               МЕНЮ АЧИВОК
// ============================================================

const ACHIEVEMENTS_LIST = [
    { id: 'first_nut', desc: '🥜 Первый орешек собран!' },
    { id: 'full_collect', desc: '📦 Все предметы уровня собраны!' },
    { id: 'levels_5', desc: '🥈 Серебряный бобр — 5 уровней!' },
    { id: 'levels_10', desc: '🏃 Марафонец — 10 уровней!' },
    { id: 'levels_15', desc: '🥇 Золотой бобр — 15 уровней!' },
    { id: 'levels_25', desc: '🏅 Профессионал — 25 уровней!' },
    { id: 'levels_48', desc: '👑 Покоритель — все 48 уровней!' },
    { id: 'master', desc: '⭐ Мастер — 1000 очков!' },
    { id: 'score_5000', desc: '💰 Тысячник — 5000 очков!' },
    { id: 'score_10000', desc: '💎 Бобр-миллионер — 10000 очков!' },
    { id: 'traps_20', desc: '💥 Разрушитель — 20 ловушек!' },
    { id: 'traps_50', desc: '🧨 Сапёр — 50 ловушек!' },
    { id: 'traps_100', desc: '⛏️ Землекоп — 100 ловушек!' },
    { id: 'hunter', desc: '🎯 Охотник — 3 врага!' },
    { id: 'hunter_10', desc: '🏹 Охотник II — 10 врагов!' },
    { id: 'hunter_25', desc: '💀 Охотник-мастер — 25 врагов!' },
    { id: 'no_damage', desc: '🛡️ Без потери жизней!' },
    { id: 'jumps_100', desc: '🦘 100 прыжков!' },
    { id: 'jumps_500', desc: '🚀 500 прыжков!' },
    { id: 'jumps_1000', desc: '💫 1000 прыжков!' },
    { id: 'speedy', desc: '⚡ Скороход — >30 сек!' },
    { id: 'last_second', desc: '⏰ Торопыга — <5 сек!' },
    { id: 'first_fall', desc: '💨 Бобр-пирдун — первый раз упал!' },
    // Ачивки за мини-игры (порталы)
    { id: 'portal_first_find', desc: '🌀 "Нашёл портал!" — первый раз войти в портал' },
    { id: 'portal_master', desc: '🌀🌀 "Хранитель порталов" — посетить все 6 мини-игр' },
    { id: 'minigame_bobrostroy_complete', desc: '🏗️ "Великий строитель" — пройти Бобрострой' },
    { id: 'minigame_nutfall_record', desc: '🌰 "Ореховый король" — набрать 100+ в Орехопаде' },
    { id: 'minigame_frogger_complete', desc: '🐺 "Переплывший реку" — пройти Волка у реки' },
    { id: 'minigame_memory_complete', desc: '🃏 "Феноменальная память" — пройти Мемори за 20 сек' },
    { id: 'minigame_dino_record', desc: '⚡ "Скорость света" — пробежать 500+ в Прыг-скок' },
    { id: 'minigame_mish_record', desc: '🎯 "Снайпер" — сбить 20 мишеней в Метком бобре' }
];

function showAchievementsMenu() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('achievementsMenu').style.display = 'block';
    
    // Загружаем полученные ачивки
    const saved = localStorage.getItem('achievements');
    const unlocked = saved ? JSON.parse(saved) : [];
    gameState.achievements = unlocked;
    
    const list = document.getElementById('achievementsList');
    const progress = document.getElementById('achievementProgress');
    let count = 0;
    
    list.innerHTML = '';
    ACHIEVEMENTS_LIST.forEach(a => {
        const isUnlocked = unlocked.includes(a.id);
        if (isUnlocked) count++;
        
        const div = document.createElement('div');
        div.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        // Отделяем эмодзи от текста
        const emoji = a.desc.match(/^.{1,2}/)[0];
        const text = a.desc.substring(2);
        
        div.innerHTML = `
            <div class="achievement-icon">${emoji}</div>
            <div class="achievement-info">
                <div class="achievement-name">${text}</div>
                <div class="achievement-status">${isUnlocked ? '✅ Получено' : '🔒 Ещё не получено'}</div>
            </div>
        `;
        list.appendChild(div);
    });
    
    progress.textContent = `Получено: ${count} / ${ACHIEVEMENTS_LIST.length}`;
}

function closeAchievementsMenu() {
    document.getElementById('achievementsMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
}

// ============================================================
//               СИСТЕМА РАНГОВ (ЗВАНИЙ)
// ============================================================

function checkRank(levelForCheck) {
    const checkLevel = (levelForCheck !== undefined) ? levelForCheck : level;
    let newRank = RANKS[0];
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (checkLevel >= RANKS[i].condition) {
            newRank = RANKS[i];
            break;
        }
    }
    if (newRank.id !== playerRank.id) {
        playerRank = newRank;
        newRankSound.play();
        showNotification(`🎖️ Новое звание: ${playerRank.name}!`, 3000);
        applyRankBonus();
        localStorage.setItem('playerRank', JSON.stringify(playerRank));
    }
}

function applyRankBonus() {
    // Не используется
}

function getScoreMultiplier() {
    return 1;
}

// ============================================================
//          БОНУСНЫЕ ЗАДАНИЯ НА УРОВЕНЬ (CHALLENGES)
// ============================================================

function generateChallenges() {
    levelChallenges = [];
    
    // Фильтруем по canGenerate(), исключаем few_jumps и недавние
    const available = CHALLENGE_TYPES.filter(c => {
        if (c.id === 'few_jumps') return false; // добавится отдельно
        if (c.canGenerate && !c.canGenerate()) return false;
        if (recentChallengeIds.includes(c.id)) return false;
        return true;
    });
    
    const numChallenges = Math.min(2, available.length);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numChallenges && i < shuffled.length; i++) {
        levelChallenges.push({ ...shuffled[i], completed: false });
    }
    
    // Добавляем "мало прыжков" отдельно, если не было в последних 5
    const fewJumpsTemplate = CHALLENGE_TYPES.find(c => c.id === 'few_jumps');
    if (fewJumpsTemplate && Math.random() < 0.4 && !recentChallengeIds.includes('few_jumps')) {
        levelChallenges.push({
            ...fewJumpsTemplate,
            completed: false
        });
    }
}

function checkChallenges() {
    let completedCount = 0;
    levelChallenges.forEach(c => {
        if (c.check()) {
            c.completed = true;
            completedCount++;
        }
    });
    return completedCount;
}

function getChallengesCompleted() {
    return levelChallenges.filter(c => c.check()).length;
}

function areAllChallengesCompleted() {
    return levelChallenges.length > 0 && levelChallenges.every(c => c.check());
}

// ============================================================
//          ВЫБОР БОНУСА ПЕРЕД УРОВНЕМ (BOOST SELECTION)
// ============================================================

function showBoostSelection(callback) {
    gameState.isPaused = true;
    
    const overlay = document.createElement('div');
    overlay.id = 'boostOverlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    
    const title = document.createElement('h2');
    title.textContent = '🎒 Выбери бонус на уровень';
    title.style.cssText = 'color: #FFD700; font-size: 42px; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);';
    
    const subtitle = document.createElement('p');
    subtitle.textContent = `Очков: ${score}`;
    subtitle.style.cssText = 'color: #fff; font-size: 20px; margin-bottom: 25px;';
    
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; max-width: 800px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌ Пропустить (без бонуса)';
    closeBtn.style.cssText = 'margin-top: 25px; padding: 12px 30px; font-size: 20px; background: #666; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-family: inherit;';
    
    overlay.appendChild(title);
    overlay.appendChild(subtitle);
    overlay.appendChild(container);
    overlay.appendChild(closeBtn);
    
    const boostPool = getBoostPool(level);
    boostPool.forEach(boost => {
        const card = document.createElement('div');
        const canAfford = score >= boost.cost;
        card.style.cssText = `
            padding: 15px 20px; border-radius: 12px; cursor: ${canAfford ? 'pointer' : 'not-allowed'};
            background: ${canAfford ? 'rgba(255,215,0,0.15)' : 'rgba(100,100,100,0.2)'};
            border: 2px solid ${canAfford ? '#FFD700' : '#666'};
            text-align: center; min-width: 140px;
            transition: transform 0.2s; opacity: ${canAfford ? 1 : 0.5};
        `;
        card.innerHTML = `
            <div style="font-size: 36px; margin-bottom: 5px;">${boost.name.split(' ')[0]}</div>
            <div style="font-size: 18px; color: #FFD700; font-weight: bold;">${boost.name}</div>
            <div style="font-size: 14px; color: #ccc; margin: 5px 0;">${boost.desc}</div>
            <div style="font-size: 16px; color: ${canAfford ? '#4CAF50' : '#ff6b6b'};">
                ${boost.cost > 0 ? `💰 ${boost.cost}` : '🆓 Бесплатно'}
            </div>
        `;
        
        if (canAfford) {
            card.onmouseenter = () => { card.style.transform = 'scale(1.05)'; };
            card.onmouseleave = () => { card.style.transform = 'scale(1)'; };
            card.onclick = () => {
                if (boost.cost > 0) score -= boost.cost;
                activeBoost = boost.id;
                isDoubleScoreActive = (boost.id === 'double');
                isAimBoostActive = (boost.id === 'aim');
                boost.apply();
                document.body.removeChild(overlay);
                gameState.isPaused = false;
                showNotification(`✅ Бонус "${boost.name}" активирован!`, 2000);
                if (callback) callback();
            };
        }
        container.appendChild(card);
    });
    
    closeBtn.onclick = () => {
        activeBoost = null;
        isDoubleScoreActive = false;
        isAimBoostActive = false;
        document.body.removeChild(overlay);
        gameState.isPaused = false;
        if (callback) callback();
    };
    
    document.body.appendChild(overlay);
}

// ============================================================
//               БОНУСНЫЙ УРОВЕНЬ (MINI-GAME)
// ============================================================

function canEnterBonusLevel() {
    return BONUS_LEVEL_TRIGGERS.includes(level) && areAllChallengesCompleted();
}

function enterBonusLevel() {
    isBonusLevel = true;
    bonusLevelTimer = BONUS_LEVEL_DURATION;
    bonusLevelItems = [];
    
    // Очищаем обычные объекты и бонусы
    nuts = [];
    traps = [];
    enemy = null;
    // Останавливаем обычный таймер уровня, чтобы он не вызывал completeLevel()/gameLost()
    clearInterval(timerInterval);
    // Сбрасываем collectedNuts, чтобы при случайном срабатывании таймера не вызвался completeLevel()
    collectedNuts = 0;
    gameState.levelChanging = false;
    TimeAdd = null;
    LiveAdd = null;
    invincibilityBonus = null;
    safetyPlatformBonus = null;
    hasSafetyPlatform = false;
    safetyPlatform = null;
    
    // Заменяем платформы на одну сплошную нижнюю
    platforms = [{ x: 0, y: canvas.height - 50, width: canvas.width, height: 50, isMoving: false }];
    
    // Ставим игрока на платформу
    player.y = canvas.height - 100;
    player.dx = 0;
    player.dy = 0;
    player.jumping = false;
    player.grounded = false;
    
    // Генерируем падающие предметы
    for (let i = 0; i < 40; i++) {
        bonusLevelItems.push({
            x: Math.random() * (canvas.width - 30),
            y: -Math.random() * canvas.height,
            width: 25,
            height: 25,
            speedY: 1 + Math.random() * 2,
            type: Math.random() < 0.7 ? 'nut' : (Math.random() < 0.5 ? 'time' : 'life')
        });
    }
    
    showNotification('🌟 Бонусный уровень! Собирай предметы!', 3000);
    
    // Своя музыка для бонус-уровня
    fadeMusic('sounds/music1.mp3');
    
    // Таймер для бонусного уровня
    window._bonusTimer = setInterval(() => {
        if (gameState.isPaused || gameState.gameOver) return;
        bonusLevelTimer--;
        
        // Спавним новые предметы каждые 2 секунды
        if (bonusLevelTimer % 2 === 0) {
            bonusLevelItems.push({
                x: Math.random() * (canvas.width - 30),
                y: -30,
                width: 25, height: 25,
                speedY: 1 + Math.random() * 2,
                type: Math.random() < 0.7 ? 'nut' : (Math.random() < 0.5 ? 'time' : 'life')
            });
        }
        
        if (bonusLevelTimer <= 0) {
            clearInterval(window._bonusTimer);
            exitBonusLevel();
        }
    }, 1000);
    
    // Показываем UI бонусного уровня
    const bonusUI = document.createElement('div');
    bonusUI.id = 'bonusLevelUI';
    bonusUI.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        color: #FFD700; font-size: 80px; font-family: 'Comic Sans MS', cursive;
        z-index: 1500; text-shadow: 0 0 20px rgba(255,215,0,0.5);
        pointer-events: none; text-align: center;
    `;
    document.body.appendChild(bonusUI);
}

function updateBonusLevel() {
    if (!isBonusLevel) return;
    
    // Обновляем позиции предметов
    bonusLevelItems.forEach(item => {
        item.y += item.speedY;
    });
    
    // Убираем упавшие предметы
    bonusLevelItems = bonusLevelItems.filter(item => item.y < canvas.height + 50);
    
    // Проверяем сбор с анимацией и звуками
    for (let i = bonusLevelItems.length - 1; i >= 0; i--) {
        const item = bonusLevelItems[i];
        if (rectCollide(player, item)) {
            // Визуальный эффект
            let effectColor;
            switch (item.type) {
                case 'nut':
                    score += 25;
                    totalNutsCollected++;
                    effectColor = '#FFD700';
                    break;
                case 'time':
                    timeLeft += 5;
                    effectColor = '#00BFFF';
                    break;
                case 'life':
                    lives++;
                    effectColor = '#FF69B4';
                    break;
            }
            // Эффект сбора
            nutEffects.push({ x: item.x, y: item.y, scale: 1, alpha: 1 });
            for (let j = 0; j < 8; j++) {
                explosions.push({
                    x: item.x + item.width/2, y: item.y + item.height/2,
                    dx: (Math.random() - 0.5) * 4,
                    dy: (Math.random() - 0.5) * 4,
                    color: effectColor,
                    life: 15
                });
            }
            eatSound.play();
            bonusLevelItems.splice(i, 1);
        }
    }
    
    // Обновляем UI
    const bonusUI = document.getElementById('bonusLevelUI');
    if (bonusUI) {
        bonusUI.innerHTML = `🌟 ${bonusLevelTimer}<br><span style="font-size: 30px;">💰 ${score}</span>`;
    }
}

function renderBonusLevel() {
    if (!isBonusLevel) return;
    
    // Рисуем предметы (фон уже отрисован в render() до платформ)
    bonusLevelItems.forEach(item => {
        ctx.save();
        let color;
        if (item.type === 'nut') color = '#FFD700';
        else if (item.type === 'time') color = '#00BFFF';
        else color = '#FF69B4';
        
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(item.x + item.width/2, item.y + item.height/2, item.width/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function exitBonusLevel() {
    isBonusLevel = false;
    bonusLevelItems = [];
    clearInterval(window._bonusTimer);
    
    const bonusUI = document.getElementById('bonusLevelUI');
    if (bonusUI) document.body.removeChild(bonusUI);
    
    showNotification(`🎉 Бонусный уровень пройден! Очки: ${score}!`, 3000);
    
    // Проверяем ранг
    checkRank();
    
    // Бонус-уровень открывается через showBonusLevelPrompt, который уже вызван
    // completeLevel() не вызывается, unlockNextLevel() не вызывался,
    // поэтому level остался прежним. Просто показываем карту уровней
    document.getElementById('levelMap').style.display = 'block';
    renderLevelMap();
    gameState.isPaused = true;
}

// ============================================================
//               ЕЖЕДНЕВНЫЕ ЗАДАНИЯ
// ============================================================

const DAILY_CHALLENGES_POOL = [
    { id: 'dc_collect', name: 'Собери 50 предметов', check: () => totalNutsCollected >= 50, reward: 100 },
    { id: 'dc_jumps', name: 'Сделай 30 прыжков', check: () => totalJumps >= 30, reward: 80 },
    { id: 'dc_traps', name: 'Уничтожь 10 ловушек', check: () => totalTrapsDestroyed >= 10, reward: 120 },
    { id: 'dc_enemies', name: 'Убей 3 врагов', check: () => totalEnemiesKilled >= 3, reward: 150 },
    { id: 'dc_levels', name: 'Пройди 2 уровня', check: () => gameState.totalLevelsCompleted >= 2, reward: 200 },
    { id: 'dc_combo', name: 'Сделай комбо x5', check: () => maxCombo >= 5, reward: 100 }
];

function initDailyChallenges() {
    const today = new Date().toDateString();
    if (gameState.dailyChallengeDate !== today) {
        // Новый день — новые задания
        const shuffled = [...DAILY_CHALLENGES_POOL].sort(() => Math.random() - 0.5);
        gameState.dailyChallenges = shuffled.slice(0, 3).map(c => ({
            ...c,
            completed: false,
            claimed: false
        }));
        gameState.dailyChallengeDate = today;
        gameState.dailyRewardClaimed = false;
        localStorage.setItem('dailyChallenges', JSON.stringify(gameState.dailyChallenges));
        localStorage.setItem('dailyChallengeDate', today);
    } else {
        // Загружаем сохранённые
        const saved = localStorage.getItem('dailyChallenges');
        if (saved) {
            try { gameState.dailyChallenges = JSON.parse(saved); } catch(e) {}
        }
    }
}

function checkDailyChallenges() {
    if (!gameState.dailyChallenges.length) return;
    gameState.dailyChallenges.forEach(c => {
        if (!c.completed && c.check()) {
            c.completed = true;
        }
    });
    localStorage.setItem('dailyChallenges', JSON.stringify(gameState.dailyChallenges));
}

function claimDailyReward(index) {
    const challenge = gameState.dailyChallenges[index];
    if (!challenge || !challenge.completed || challenge.claimed) return;
    challenge.claimed = true;
    score += challenge.reward;
    showNotification(`🎉 Ежедневное задание: +${challenge.reward} боброчков!`, 3000);
    localStorage.setItem('dailyChallenges', JSON.stringify(gameState.dailyChallenges));
}

function showDailyChallengesMenu() {
    document.getElementById('mainMenu').style.display = 'none';
    const overlay = document.createElement('div');
    overlay.id = 'dailyMenu';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    let html = '<h2 style="color:#FFD700;font-size:42px;margin-bottom:20px;">📅 Ежедневные задания</h2>';
    html += `<p style="color:#ccc;font-size:16px;margin-bottom:20px;">${gameState.dailyChallengeDate || 'Сегодня'}</p>`;
    
    gameState.dailyChallenges.forEach((c, i) => {
        const status = c.completed ? (c.claimed ? '✅ Выполнено' : '⬜ Забрать') : '⬜ В процессе';
        const btn = c.completed && !c.claimed 
            ? `<button class="menu-button menu-btn-primary" onclick="claimDailyReward(${i}); document.body.removeChild(document.getElementById('dailyMenu')); showDailyChallengesMenu();">🎁 Забрать ${c.reward}</button>`
            : '';
        html += `
            <div style="background:rgba(255,215,0,0.1);border:1px solid #FFD700;border-radius:10px;padding:15px 25px;margin:8px;min-width:400px;text-align:center;">
                <div style="color:#fff;font-size:20px;">${c.name}</div>
                <div style="color:#FFD700;font-size:14px;margin-top:5px;">💰 ${c.reward} боброчков — ${status}</div>
                ${btn}
            </div>
        `;
    });
    
    html += `<button class="menu-button menu-btn-secondary" onclick="document.body.removeChild(document.getElementById('dailyMenu')); document.getElementById('mainMenu').style.display='flex';" style="margin-top:25px;">← Назад</button>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

// ============================================================
//               ТАБЛИЦА ЛИДЕРОВ
// ============================================================

const LEADERBOARD_KEY = 'bobr_leaderboard';

function addToLeaderboard(profileName, playerScore) {
    const saved = localStorage.getItem(LEADERBOARD_KEY);
    let leaders = saved ? JSON.parse(saved) : [];
    leaders.push({ name: profileName || 'Бобр', score: playerScore, date: new Date().toLocaleDateString() });
    leaders.sort((a, b) => b.score - a.score);
    leaders = leaders.slice(0, 10); // топ-10
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaders));
}

function showLeaderboard() {
    document.getElementById('mainMenu').style.display = 'none';
    const overlay = document.createElement('div');
    overlay.id = 'leaderboardMenu';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    let html = '<h2 style="color:#FFD700;font-size:42px;margin-bottom:20px;">🏆 Таблица лидеров</h2>';
    
    const saved = localStorage.getItem(LEADERBOARD_KEY);
    const leaders = saved ? JSON.parse(saved) : [];
    
    if (leaders.length === 0) {
        html += '<p style="color:#ccc;font-size:20px;">Пока нет записей. Играй и становись лучшим!</p>';
    } else {
        html += '<div style="max-width:500px;width:100%;">';
        leaders.forEach((entry, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
            html += `
                <div style="background:rgba(255,215,0,0.08);border-bottom:1px solid rgba(255,215,0,0.2);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#FFD700;font-size:22px;min-width:40px;">${medal}</span>
                    <span style="color:#fff;font-size:18px;flex:1;margin-left:10px;">${entry.name}</span>
                    <span style="color:#FFD700;font-size:16px;">💰 ${entry.score}</span>
                    <span style="color:#999;font-size:12px;margin-left:10px;">${entry.date}</span>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += `<button class="menu-button menu-btn-secondary" onclick="document.body.removeChild(document.getElementById('leaderboardMenu')); document.getElementById('mainMenu').style.display='flex';" style="margin-top:25px;">← Назад</button>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

// ============================================================
//               СТАТИСТИКА ПРОФИЛЯ
// ============================================================

function showProfileStats() {
    document.getElementById('mainMenu').style.display = 'none';
    const overlay = document.createElement('div');
    overlay.id = 'statsMenu';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 1500;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
    `;
    
    const playTime = gameState.totalPlayTime;
    const hours = Math.floor(playTime / 3600);
    const mins = Math.floor((playTime % 3600) / 60);
    const secs = playTime % 60;
    const timeStr = hours > 0 ? `${hours}ч ${mins}м ${secs}с` : mins > 0 ? `${mins}м ${secs}с` : `${secs}с`;
    
    const stats = [
        ['👤 Профиль', currentProfile || '—'],
        ['🎮 Уровень', level],
        ['💰 Очки', score],
        ['❤️ Жизни', lives],
        ['🥜 Собрано предметов', totalNutsCollected],
        ['💥 Уничтожено ловушек', totalTrapsDestroyed],
        ['👾 Убито врагов', totalEnemiesKilled],
        ['🦘 Прыжков', totalJumps],
        ['🏆 Пройдено уровней', gameState.totalLevelsCompleted],
        ['💀 Смертей', gameState.totalDeaths],
        ['⏱ Время в игре', timeStr],
        ['🏅 Звание', playerRank.name]
    ];
    
    let html = '<h2 style="color:#FFD700;font-size:42px;margin-bottom:20px;">📊 Статистика</h2>';
    html += '<div style="max-width:450px;width:100%;">';
    stats.forEach(([label, value]) => {
        html += `
            <div style="display:flex;justify-content:space-between;padding:8px 20px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <span style="color:#ccc;font-size:18px;">${label}</span>
                <span style="color:#FFD700;font-size:18px;font-weight:bold;">${value}</span>
            </div>
        `;
    });
    html += '</div>';
    
    html += `<button class="menu-button menu-btn-secondary" onclick="document.body.removeChild(document.getElementById('statsMenu')); document.getElementById('mainMenu').style.display='flex';" style="margin-top:25px;">← Назад</button>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

// ============================================================
//               АВТО-ПАУЗА ПРИ СВОРАЧИВАНИИ
// ============================================================

// Добавляем обработчик в initGame
const _origInitGameAutoPause = initGame;
initGame = function() {
    _origInitGameAutoPause();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && gameState.isGameStarted && !gameState.isPaused) {
            togglePause();
        }
    });
};

// ============================================================
//               СЕКРЕТНЫЙ РЕЖИМ ТЕСТОВ
// ============================================================
let secretMenuClicks = 0;
let secretMenuTimer = null;

function onTitleClick() {
    secretMenuClicks++;
    if (secretMenuTimer) clearTimeout(secretMenuTimer);
    secretMenuTimer = setTimeout(() => { secretMenuClicks = 0; }, 2000);
    if (secretMenuClicks >= 7) {
        secretMenuClicks = 0;
        unlockAllLevels();
    }
}

function unlockAllLevels() {
    // Отмечаем все уровни как пройденные (1), ставим 48 как текущий (2)
    for (let i = 1; i <= 48; i++) levelProgress[i] = 1;
    levelProgress[48] = 2;
    level = 48;
    saveLevelProgress();
    // Устанавливаем максимальный ранг
    playerRank = { id: 'king', name: '👑 Бобр-король', bonus: null, condition: 48 };
    localStorage.setItem('playerRank', JSON.stringify(playerRank));
    // Добавляем 20000 очков
    score += 20000;
    // Сохраняем профиль
    saveProfileData();
    showNotification('🔓 Все 48 уровней разблокированы! +20000 🪙 Звание: Бобр-король!', 5000);
}

// ============================================================
//               СИСТЕМА ПРОФИЛЕЙ
// ============================================================

const PROFILES_KEY = 'bobr_profiles';

// Загрузить все профили из localStorage
function loadProfiles() {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
        try { 
            const data = JSON.parse(saved);
            profiles = data.profiles || {};
            currentProfile = data.lastProfile || null;
        } catch(e) { 
            profiles = {}; 
            currentProfile = null;
        }
    } else {
        profiles = {};
        currentProfile = null;
    }
    renderProfileList();
    if (currentProfile && profiles[currentProfile]) {
        // Показываем главное меню
        document.getElementById('profileMenu').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'flex';
        updateProfileIndicator();
    }
}

// Сохранить все профили
function saveProfiles() {
    const data = { profiles, lastProfile: currentProfile };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(data));
}

// Отрендерить список профилей (красивые карточки)
function renderProfileList() {
    const list = document.getElementById('profileList');
    if (!list) return;
    list.innerHTML = '';
    
    const names = Object.keys(profiles);
    if (names.length === 0) {
        list.innerHTML = '<p style="color:#ccc; font-size:18px;">Пока нет профилей. Создай свой!</p>';
        return;
    }
    
    names.forEach(name => {
        const data = profiles[name];
        const rank = data.playerRank ? (data.playerRank.name || '🟤 Бобрёнок') : '🟤 Бобрёнок';
        const lvl = data.level || 1;
        const scr = data.score || 0;
        
        const card = document.createElement('div');
        card.className = 'profile-card';
        
        card.innerHTML = `
            <div class="profile-avatar">👤</div>
            <div class="profile-info">
                <div class="profile-name">${name}</div>
                <div class="profile-stats">🎮 Уровень ${lvl} &nbsp;|&nbsp; 💰 ${scr} боброчков</div>
            </div>
            <div class="profile-rank-badge">${rank}</div>
        `;
        
        card.onclick = () => selectProfile(name);
        list.appendChild(card);
    });
}

// Выбрать профиль
function selectProfile(name) {
    if (!profiles[name]) return;
    currentProfile = name;
    saveProfiles();
    
    // Загружаем данные профиля в игру
    const data = profiles[name];
    level = data.level || 1;
    lives = data.lives || 3;
    score = data.score || 0;
    purchasedSkins = data.purchasedSkins || [];
    activeWearable = data.activeWearable || null;
    activeTrail = data.activeTrail || null;
    playerRank = data.playerRank || { id: 'bobrenok', name: 'Бобрёнок', bonus: null, condition: 0 };
    gameState.achievements = data.achievements || [];
    gameState.hasMagnet = data.hasMagnet || false;
    gameState.hasHat = data.hasHat || false;
    gameState.hasTailTrail = data.hasTailTrail || false;
    levelProgress = data.levelProgress || new Array(37).fill(0);
    if (!levelProgress[1]) levelProgress[1] = 2;
    // Загружаем улучшения домика
    loadHomeUpgrades();
    
    document.getElementById('profileMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    updateProfileIndicator();
    updateBestScoreDisplay();
}

// Показать форму создания профиля
function showCreateProfile() {
    document.getElementById('profileCreateForm').style.display = 'block';
    document.getElementById('newProfileName').value = '';
    document.getElementById('newProfileName').focus();
}

function hideCreateProfile() {
    document.getElementById('profileCreateForm').style.display = 'none';
}

// Создать профиль
function createProfile() {
    const name = document.getElementById('newProfileName').value.trim();
    if (!name) {
        showNotification('Введи имя бобра!', 2000);
        return;
    }
    if (profiles[name]) {
        showNotification('Профиль с таким именем уже есть!', 2000);
        return;
    }
    if (name.length > 20) {
        showNotification('Слишком длинное имя (макс 20 символов)', 2000);
        return;
    }
    
    // Создаём профиль с дефолтными значениями
    profiles[name] = {
        created: new Date().toISOString(),
        level: 1,
        lives: 3,
        score: 0,
        purchasedSkins: [],
        activeWearable: null,
        activeTrail: null,
        playerRank: { id: 'bobrenok', name: 'Бобрёнок', bonus: null, condition: 0 },
        achievements: [],
        hasMagnet: false,
        hasHat: false,
        hasTailTrail: false,
        levelProgress: new Array(37).fill(0)
    };
    profiles[name].levelProgress[1] = 2;
    
    // Сбрасываем туториал для нового профиля — обучение должно показаться
    tutorialCompletedLevels = [];
    tutorialSkipped = false;
    localStorage.removeItem('tutorialCompleted');
    
    hideCreateProfile();
    selectProfile(name);
    showNotification(`✅ Профиль "${name}" создан!`, 2000);
}

// Показать удаление профилей
function showDeleteProfiles() {
    const delList = document.getElementById('profileDeleteList');
    if (!delList) return;
    delList.innerHTML = '';
    
    Object.keys(profiles).forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = `🗑️ ${name}`;
        btn.style.cssText = 'padding: 8px 16px; margin: 5px; font-size: 18px; background: #ff4444; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: inherit;';
        btn.onclick = () => {
            if (confirm(`Удалить профиль "${name}"? Все данные будут потеряны!`)) {
                delete profiles[name];
                if (currentProfile === name) {
                    currentProfile = null;
                    // Cброс игровых переменных
                    level = 1; lives = 3; score = 0;
                    purchasedSkins = []; activeWearable = null; activeTrail = null;
                    playerRank = { id: 'bobrenok', name: 'Бобрёнок', bonus: null, condition: 0 };
                    gameState.achievements = [];
                    levelProgress = new Array(37).fill(0);
                    levelProgress[1] = 2;
                    
                    document.getElementById('mainMenu').style.display = 'none';
                    document.getElementById('profileMenu').style.display = 'flex';
                }
                saveProfiles();
                renderProfileList();
                showDeleteProfiles();
                showNotification(`Профиль "${name}" удалён`, 2000);
            }
        };
        delList.appendChild(btn);
    });
    
    document.getElementById('profileDeleteForm').style.display = 'block';
    document.getElementById('profileCreateForm').style.display = 'none';
}

function hideDeleteProfiles() {
    document.getElementById('profileDeleteForm').style.display = 'none';
}

// Сменить профиль из главного меню
function switchProfile() {
    if (currentProfile && profiles[currentProfile]) {
        // Сохраняем текущее состояние
        saveProfileData();
    }
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('profileMenu').style.display = 'flex';
    renderProfileList();
}

// Сохранить данные текущего профиля
function saveProfileData() {
    if (!currentProfile || !profiles[currentProfile]) return;
    const data = profiles[currentProfile];
    data.level = level;
    data.lives = lives;
    data.score = score;
    data.purchasedSkins = [...purchasedSkins];
    data.activeWearable = activeWearable;
    data.activeTrail = activeTrail;
    data.playerRank = { ...playerRank };
    data.achievements = [...gameState.achievements];
    data.hasMagnet = gameState.hasMagnet;
    data.hasHat = gameState.hasHat;
    data.hasTailTrail = gameState.hasTailTrail;
    data.levelProgress = [...levelProgress];
    saveProfiles();
}

// Показать индикатор профиля в главном меню
function updateProfileIndicator() {
    const el = document.getElementById('profileIndicator');
    if (el && currentProfile) {
        el.textContent = `👤 Профиль: ${currentProfile}`;
    }
}

// Переопределяем saveProgress/loadProgress для работы с профилями
const _originalSaveProgress = saveProgress;
const _originalLoadProgress = loadProgress;

saveProgress = function() {
    saveProfileData();
    showNotification("Прогресс сохранён!");
};

loadProgress = function() {
    if (currentProfile && profiles[currentProfile]) {
        selectProfile(currentProfile);
        showNotification("Прогресс загружен!");
        resetLevel();
    } else {
        showNotification("Нет активного профиля. Создай или выбери!", 2500);
    }
};

// continueAfterStory определена выше рядом с showStoryForLevel

// ============================================================
//               МЕНЮ НАСТРОЕК (SETTINGS)
// ============================================================

// Глобальные переменные громкости
let musicVolume = 0.8; // 0.0 - 1.0
let sfxVolume = 1.0;

// Загрузить настройки громкости из localStorage
function loadVolumeSettings() {
    const savedMusic = localStorage.getItem('musicVolume');
    const savedSfx = localStorage.getItem('sfxVolume');
    if (savedMusic !== null) {
        musicVolume = parseFloat(savedMusic);
        document.getElementById('musicVolume').value = musicVolume * 100;
        document.getElementById('musicVolumeLabel').textContent = Math.round(musicVolume * 100) + '%';
    }
    if (savedSfx !== null) {
        sfxVolume = parseFloat(savedSfx);
        document.getElementById('sfxVolume').value = sfxVolume * 100;
        document.getElementById('sfxVolumeLabel').textContent = Math.round(sfxVolume * 100) + '%';
    }
    // Применяем к текущей музыке
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) bgMusic.volume = musicVolume;
    // Применяем ко всем звуковым эффектам
    [jumpSound, eatSound, addTimeSound, stepsSound, ouchSound, fallSound, invincibleSound, hitSound, minekillSound, levelCompleteSound, selectSound, achievementSound, newRankSound, powerupSound].forEach(s => { if (s) s.volume = sfxVolume; });
}

// Показать меню настроек
function showSettingsMenu() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('settingsMenu').style.display = 'block';
    loadVolumeSettings();
}

// Закрыть меню настроек
function closeSettingsMenu() {
    document.getElementById('settingsMenu').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
}

// Установить громкость музыки
function setMusicVolume(val) {
    musicVolume = val / 100;
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) bgMusic.volume = musicVolume;
    document.getElementById('musicVolumeLabel').textContent = val + '%';
    localStorage.setItem('musicVolume', musicVolume.toString());
}

// Установить громкость звуков
function setSfxVolume(val) {
    sfxVolume = val / 100;
    // Применяем ко всем звуковым эффектам
    [jumpSound, eatSound, addTimeSound, ouchSound, fallSound, invincibleSound, hitSound, minekillSound, levelCompleteSound, selectSound, achievementSound, newRankSound, powerupSound].forEach(s => { if (s) s.volume = sfxVolume; });
    document.getElementById('sfxVolumeLabel').textContent = val + '%';
    localStorage.setItem('sfxVolume', sfxVolume.toString());
}

// Патчим initGame для загрузки настроек
const _origInitGame = initGame;
initGame = function() {
    _origInitGame();
    loadVolumeSettings();
};

// ============================================================
//               ПЛАВНЫЙ ПЕРЕХОД МУЗЫКИ
// ============================================================

function fadeMusic(newSrc, fadeDuration = 800) {
    const audio = document.getElementById('backgroundMusic');
    if (!audio) return;
    
    // Если тот же трек — не делаем ничего
    if (audio.src && audio.src.includes(newSrc)) return;
    
    const steps = 15;
    const stepTime = fadeDuration / steps;
    
    // Fade out
    let vol = 1;
    const fadeOut = setInterval(() => {
        vol -= 1 / steps;
        audio.volume = Math.max(0, vol);
        if (vol <= 0) {
            clearInterval(fadeOut);
            audio.src = newSrc;
            audio.load();
            audio.play().catch(() => {});
            // Fade in
            let vol2 = 0;
            const fadeIn = setInterval(() => {
                vol2 += 1 / steps;
                audio.volume = Math.min(1, vol2);
                if (vol2 >= 1) clearInterval(fadeIn);
            }, stepTime);
        }
    }, stepTime);
}
