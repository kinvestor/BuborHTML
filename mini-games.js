// ============================================================
//               МИНИ-ИГРЫ ДЛЯ БУБОРА
//    (вызываются через портал, начиная с 3-го уровня)
// ============================================================

// Состояние мини-игры
let miniGameState = {
    active: false,
    type: null, // 'bobrostroy' | 'orehopad' | 'volk' | 'memo' | 'prigskok' | 'mish'
    score: 0,
    timeLeft: 0,
    isGameOver: false,
    isWin: false
};

// Список посещённых мини-игр (id)
let visitedMiniGameIds = [];

// Загрузка посещённых мини-игр
function loadVisitedMiniGames() {
    const saved = localStorage.getItem('bobr_visitedMiniGames');
    if (saved) {
        try { visitedMiniGameIds = JSON.parse(saved); } catch(e) { visitedMiniGameIds = []; }
    }
}

function saveVisitedMiniGames() {
    localStorage.setItem('bobr_visitedMiniGames', JSON.stringify(visitedMiniGameIds));
}

// Выбор случайной непосещённой мини-игры
function getRandomMiniGameId() {
    const allGames = ['bobrostroy', 'orehopad', 'volk', 'memo', 'prigskok', 'mish'];
    const available = allGames.filter(id => !visitedMiniGameIds.includes(id));
    if (available.length === 0) {
        // Все посещены — сбрасываем
        visitedMiniGameIds = [];
        saveVisitedMiniGames();
        return allGames[Math.floor(Math.random() * allGames.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
}

// ============================================================
//          СИСТЕМА ВХОДА/ВЫХОДА ИЗ МИНИ-ИГРЫ
// ============================================================

// Сохраняем состояние уровня перед входом в мини-игру
let savedLevelState = null;

function enterMiniGame(gameId) {
    // Сохраняем состояние уровня
    savedLevelState = {
        level: level,
        lives: lives,
        score: score,
        timeLeft: timeLeft,
        collectedNuts: collectedNuts,
        totalNuts: totalNuts,
        platforms: JSON.parse(JSON.stringify(platforms)),
        nuts: JSON.parse(JSON.stringify(nuts)),
        traps: JSON.parse(JSON.stringify(traps)),
        enemy: enemy ? JSON.parse(JSON.stringify(enemy)) : null,
        isBonusLevel: isBonusLevel,
        isInvincible: gameState.isInvincible,
        player: JSON.parse(JSON.stringify(player))
    };

    // Останавливаем таймер уровня
    clearInterval(timerInterval);

    // Прячем HUD уровня
    document.getElementById('gameHud').style.display = 'none';

    // Не ставим isPaused — иначе update() не вызывается!
    // Вместо этого update() проверяет miniGameState.active

    // Инициализируем мини-игру
    miniGameState.active = true;
    miniGameState.type = gameId;
    miniGameState.score = 0;
    miniGameState.isGameOver = false;
    miniGameState.isWin = false;

    // Воспроизводим звук входа в портал
    try {
        const portalSound = new Audio('sounds/powerup.mp3');
        portalSound.volume = 0.5;
        portalSound.play();
    } catch(e) {}

    // Добавляем в посещённые
    if (!visitedMiniGameIds.includes(gameId)) {
        visitedMiniGameIds.push(gameId);
        saveVisitedMiniGames();
    }

    // Ачивка за первое вхождение
    unlockAchievement('portal_first_find', '🌀 "Нашёл портал!" — первый раз войти в портал');
    
    // Проверка на все 6
    if (visitedMiniGameIds.length >= 6) {
        unlockAchievement('portal_master', '🌀🌀 "Хранитель порталов" — посетить все 6 мини-игр');
    }

    // Запускаем конкретную мини-игру
    switch(gameId) {
        case 'bobrostroy': initBobrostroy(); break;
        case 'orehopad': initOrehopad(); break;
        case 'volk': initVolk(); break;
        case 'memo': initMemo(); break;
        case 'prigskok': initPrigskok(); break;
        case 'mish': initMish(); break;
    }
}

function exitMiniGame(reward) {
    // Скрываем мини-игру
    miniGameState.active = false;
    miniGameState.type = null;

    // Возвращаем HUD
    document.getElementById('gameHud').style.display = 'block';

    // Восстанавливаем состояние уровня
    if (savedLevelState) {
        level = savedLevelState.level;
        lives = savedLevelState.lives;
        score = savedLevelState.score + (reward || 0);
        timeLeft = savedLevelState.timeLeft;
        collectedNuts = savedLevelState.collectedNuts;
        totalNuts = savedLevelState.totalNuts;
        platforms = savedLevelState.platforms;
        nuts = savedLevelState.nuts;
        traps = savedLevelState.traps;
        enemy = savedLevelState.enemy;
        isBonusLevel = savedLevelState.isBonusLevel;
        gameState.isInvincible = savedLevelState.isInvincible;
        player = savedLevelState.player;
        savedLevelState = null;
    }

    // Возобновляем таймер
    startTimer();

    // Снимаем с паузы
    gameState.isPaused = false;

    // Показываем уведомление о награде
    if (reward > 0) {
        showNotification(`🎉 Награда: +${reward} боброчков!`, 3000);
    }
}

// ============================================================
//          МИНИ-ИГРА 1: БОБРОСТРОЙ (Catch & Stack)
// ============================================================

let brosState = {
    logs: [],
    bucket: { x: 0, y: 0, width: 120, height: 30 },
    missed: 0,
    maxMissed: 5,
    wall: [],
    spawnTimer: 0,
    logSpeed: 3,
    score: 0
};

function initBobrostroy() {
    brosState = {
        logs: [],
        bucket: { x: canvas.width / 2 - 60, y: canvas.height - 80, width: 120, height: 30 },
        missed: 0,
        maxMissed: 5,
        wall: [],
        spawnTimer: 0,
        logSpeed: 3,
        score: 0
    };
    miniGameState.timeLeft = 45;
    // Показываем инструкцию
    showMiniGameInstruction('🏗️ Бобрострой', 'Лови брёвна корзиной ←→ и строй стену! Пропустишь 5 — проигрыш.');
}

function updateBobrostroy() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;

    // Спавн брёвен
    brosState.spawnTimer--;
    if (brosState.spawnTimer <= 0) {
        const logWidth = 40 + Math.random() * 60;
        brosState.logs.push({
            x: Math.random() * (canvas.width - logWidth),
            y: -30,
            width: logWidth,
            height: 20,
            speed: brosState.logSpeed + Math.random() * 2,
            color: `hsl(${30 + Math.random() * 20}, 50%, ${35 + Math.random() * 20}%)`
        });
        brosState.spawnTimer = 25 + Math.floor(Math.random() * 30);
    }

    // Движение корзины
    if (keys.ArrowLeft || keys.KeyA) brosState.bucket.x -= 6;
    if (keys.ArrowRight || keys.KeyD) brosState.bucket.x += 6;
    brosState.bucket.x = Math.max(0, Math.min(canvas.width - brosState.bucket.width, brosState.bucket.x));

    // Движение брёвен
    for (let i = brosState.logs.length - 1; i >= 0; i--) {
        const log = brosState.logs[i];
        log.y += log.speed;

        // Проверка ловли
        if (log.y + log.height >= brosState.bucket.y &&
            log.y <= brosState.bucket.y + brosState.bucket.height &&
            log.x + log.width > brosState.bucket.x &&
            log.x < brosState.bucket.x + brosState.bucket.width) {
            // Поймал!
            brosState.wall.push({ width: log.width, height: 20 });
            brosState.score += 10;
            brosState.logs.splice(i, 1);
            continue;
        }

        // Проверка пропуска
        if (log.y > canvas.height) {
            brosState.missed++;
            brosState.logs.splice(i, 1);
            if (brosState.missed >= brosState.maxMissed) {
                miniGameState.isGameOver = true;
                finishMiniGame(brosState.score, 'bobrostroy');
                return;
            }
        }
    }

    // Проверка победы (набрали 10 брёвен)
    if (brosState.wall.length >= 10) {
        miniGameState.isWin = true;
        finishMiniGame(brosState.score + 50, 'bobrostroy');
        return;
    }
}

function renderBobrostroy() {
    // Фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Стена из брёвен (снизу)
    let wallY = canvas.height - 50;
    brosState.wall.forEach((log, i) => {
        const logX = 50 + (i % 5) * 70;
        const logY = wallY - Math.floor(i / 5) * 25;
        ctx.fillStyle = log.color || '#8B4513';
        ctx.fillRect(logX, logY, 60, 20);
        ctx.strokeStyle = '#5D2E0C';
        ctx.lineWidth = 1;
        ctx.strokeRect(logX, logY, 60, 20);
    });

    // Падающие брёвна
    brosState.logs.forEach(log => {
        ctx.fillStyle = log.color || '#8B4513';
        ctx.fillRect(log.x, log.y, log.width, log.height);
        ctx.strokeStyle = '#5D2E0C';
        ctx.lineWidth = 1;
        ctx.strokeRect(log.x, log.y, log.width, log.height);
    });

    // Корзина
    ctx.fillStyle = '#D2691E';
    roundRect(ctx, brosState.bucket.x, brosState.bucket.y, brosState.bucket.width, brosState.bucket.height, 10);
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    roundRect(ctx, brosState.bucket.x, brosState.bucket.y, brosState.bucket.width, brosState.bucket.height, 10);
    ctx.stroke();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '24px Comic Sans MS, cursive';
    ctx.textAlign = 'left';
    ctx.fillText(`🏗️ Брёвен: ${brosState.wall.length}/10`, 20, 40);
    ctx.fillText(`❌ Пропущено: ${brosState.missed}/${brosState.maxMissed}`, 20, 70);
    ctx.fillText(`💰 ${brosState.score}`, 20, 100);
}

// ============================================================
//          МИНИ-ИГРА 2: ОРЕХОПАД (Catch the nuts)
// ============================================================

let orehopadState = {
    items: [],
    basket: { x: 0, y: 0, width: 100, height: 30 },
    spawnTimer: 0,
    score: 0,
    speed: 2,
    lives: 3
};

function initOrehopad() {
    orehopadState = {
        items: [],
        basket: { x: canvas.width / 2 - 50, y: canvas.height - 80, width: 100, height: 30 },
        spawnTimer: 0,
        score: 0,
        speed: 2,
        lives: 3
    };
    miniGameState.timeLeft = 30;
    showMiniGameInstruction('🌰 Орехопад', 'Лови орехи 🥜, уворачивайся от камней! ❌');
}

function updateOrehopad() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;

    // Спавн
    orehopadState.spawnTimer--;
    if (orehopadState.spawnTimer <= 0) {
        const isNut = Math.random() < 0.65;
        orehopadState.items.push({
            x: Math.random() * (canvas.width - 30),
            y: -30,
            width: 30,
            height: 30,
            speed: orehopadState.speed + Math.random() * 2,
            isNut: isNut,
            rotation: 0
        });
        orehopadState.spawnTimer = 20 + Math.floor(Math.random() * 25);
    }

    // Движение корзины
    if (keys.ArrowLeft || keys.KeyA) orehopadState.basket.x -= 7;
    if (keys.ArrowRight || keys.KeyD) orehopadState.basket.x += 7;
    orehopadState.basket.x = Math.max(0, Math.min(canvas.width - orehopadState.basket.width, orehopadState.basket.x));

    // Движение предметов
    for (let i = orehopadState.items.length - 1; i >= 0; i--) {
        const item = orehopadState.items[i];
        item.y += item.speed;
        item.rotation += 0.05;

        // Проверка ловли
        if (item.y + item.height >= orehopadState.basket.y &&
            item.y <= orehopadState.basket.y + orehopadState.basket.height &&
            item.x + item.width > orehopadState.basket.x &&
            item.x < orehopadState.basket.x + orehopadState.basket.width) {
            if (item.isNut) {
                orehopadState.score += 10;
            } else {
                orehopadState.lives--;
                if (orehopadState.lives <= 0) {
                    miniGameState.isGameOver = true;
                    finishMiniGame(orehopadState.score, 'orehopad');
                    return;
                }
            }
            orehopadState.items.splice(i, 1);
            continue;
        }

        if (item.y > canvas.height) {
            if (item.isNut) {
                orehopadState.lives--;
                if (orehopadState.lives <= 0) {
                    miniGameState.isGameOver = true;
                    finishMiniGame(orehopadState.score, 'orehopad');
                    return;
                }
            }
            orehopadState.items.splice(i, 1);
        }
    }

    // Победа по таймеру
    if (miniGameState.timeLeft <= 0) {
        miniGameState.isWin = true;
        const bonus = orehopadState.score >= 100 ? 100 : 50;
        if (orehopadState.score >= 100) {
            unlockAchievement('minigame_nutfall_record', '🌰 "Ореховый король" — набрать 100+ в Орехопаде');
        }
        finishMiniGame(orehopadState.score + bonus, 'orehopad');
    }
}

function renderOrehopad() {
    ctx.fillStyle = '#2d1b00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Предметы
    orehopadState.items.forEach(item => {
        ctx.save();
        ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
        ctx.rotate(item.rotation);
        if (item.isNut) {
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#D2691E';
            ctx.beginPath();
            ctx.arc(-5, -5, 8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#777';
            ctx.beginPath();
            ctx.arc(-3, -3, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });

    // Корзина
    ctx.fillStyle = '#8B4513';
    roundRect(ctx, orehopadState.basket.x, orehopadState.basket.y, orehopadState.basket.width, orehopadState.basket.height, 8);
    ctx.fill();
    ctx.strokeStyle = '#5D2E0C';
    ctx.lineWidth = 2;
    roundRect(ctx, orehopadState.basket.x, orehopadState.basket.y, orehopadState.basket.width, orehopadState.basket.height, 8);
    ctx.stroke();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '24px Comic Sans MS, cursive';
    ctx.textAlign = 'left';
    ctx.fillText(`🌰 Орехов: ${orehopadState.score}`, 20, 40);
    ctx.fillText(`❤️ x${orehopadState.lives}`, 20, 70);
    ctx.fillText(`⏱ ${miniGameState.timeLeft}с`, canvas.width - 120, 40);
}

// ============================================================
//          МИНИ-ИГРА 3: ВОЛК У РЕКИ (Frogger)
// ============================================================

let volkState = {
    frog: { x: 0, y: 0, width: 40, height: 40 },
    platforms: [],
    wolf: { x: 0, y: 0, width: 60, height: 30 },
    finishY: 0,
    score: 0,
    timer: 0
};

function initVolk() {
    const startY = canvas.height - 100;
    volkState = {
        frog: { x: canvas.width / 2 - 20, y: startY, width: 40, height: 40 },
        platforms: [],
        wolf: { x: 0, y: canvas.height - 30, width: 60, height: 30 },
        finishY: 60,
        score: 0,
        timer: 0
    };
    // Создаём платформы-кувшинки
    for (let i = 0; i < 5; i++) {
        const rowY = startY - 80 - i * 90;
        for (let j = 0; j < 3; j++) {
            volkState.platforms.push({
                x: 80 + j * 200 + Math.random() * 60,
                y: rowY,
                width: 80,
                height: 20,
                dx: (Math.random() - 0.5) * 2
            });
        }
    }
    miniGameState.timeLeft = 30;
    showMiniGameInstruction('🐺 Волк у реки', 'Прыгай по кувшинкам ↑←→ на другой берег! Волк снизу!');
}

function updateVolk() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;

    // Движение лягушки
    if (keys.ArrowLeft || keys.KeyA) { volkState.frog.x -= 5; keys.ArrowLeft = false; keys.KeyA = false; }
    if (keys.ArrowRight || keys.KeyD) { volkState.frog.x += 5; keys.ArrowRight = false; keys.KeyD = false; }
    if (keys.ArrowUp || keys.KeyW || keys[" "]) {
        volkState.frog.y -= 90;
        keys.ArrowUp = false; keys.KeyW = false; keys[" "] = false;
    }
    if (keys.ArrowDown || keys.KeyS) { volkState.frog.y += 90; keys.ArrowDown = false; keys.KeyS = false; }
    
    volkState.frog.x = Math.max(0, Math.min(canvas.width - volkState.frog.width, volkState.frog.x));

    // Движение волка вверх
    volkState.wolf.y = Math.max(0, volkState.wolf.y - 0.2);
    // Волк двигается к лягушке по X
    const dx = volkState.frog.x - volkState.wolf.x;
    volkState.wolf.x += Math.sign(dx) * 1.5;

    // Проверка на воде — если не на платформе, тонем
    let onPlatform = false;
    volkState.platforms.forEach(p => {
        p.x += p.dx;
        if (p.x + p.width < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = -p.width;

        if (volkState.frog.x + volkState.frog.width > p.x &&
            volkState.frog.x < p.x + p.width &&
            volkState.frog.y + volkState.frog.height >= p.y &&
            volkState.frog.y + volkState.frog.height <= p.y + p.height + 5) {
            onPlatform = true;
        }
    });

    // Если не на платформе и не на старте/финише — тонет
    if (!onPlatform && volkState.frog.y > 60 && volkState.frog.y < canvas.height - 100) {
        volkState.frog.y += 5;
        if (volkState.frog.y > canvas.height) {
            miniGameState.isGameOver = true;
            finishMiniGame(volkState.score, 'volk');
            return;
        }
    }

    // Проверка столкновения с волком
    if (Math.abs(volkState.frog.x - volkState.wolf.x) < 40 &&
        Math.abs(volkState.frog.y - volkState.wolf.y) < 40) {
        miniGameState.isGameOver = true;
        finishMiniGame(volkState.score, 'volk');
        return;
    }

    // Победа — добрался до финиша
    if (volkState.frog.y <= volkState.finishY + 10) {
        miniGameState.isWin = true;
        unlockAchievement('minigame_frogger_complete', '🐺 "Переплывший реку" — пройти Волка у реки');
        finishMiniGame(100, 'volk');
        return;
    }
}

function renderVolk() {
    // Река
    ctx.fillStyle = '#1a5276';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Волны
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.sin(Date.now() / 1000 + i) * 0.05})`;
        ctx.fillRect(i, 60 + Math.sin(Date.now() / 800 + i) * 10, 30, 2);
    }

    // Платформы
    volkState.platforms.forEach(p => {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2 - 3, p.width / 3, p.height / 3, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Волк
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(volkState.wolf.x + 30, volkState.wolf.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(volkState.wolf.x + 20, volkState.wolf.y - 5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(volkState.wolf.x + 25, volkState.wolf.y + 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Лягушка-Бубор
    ctx.fillStyle = '#4CAF50';
    roundRect(ctx, volkState.frog.x, volkState.frog.y, volkState.frog.width, volkState.frog.height, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(volkState.frog.x + 10, volkState.frog.y + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(volkState.frog.x + 30, volkState.frog.y + 10, 5, 0, Math.PI * 2);
    ctx.fill();

    // Финиш
    ctx.fillStyle = '#FFD700';
    ctx.font = '30px Comic Sans MS, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 ФИНИШ', canvas.width / 2, 50);

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '20px Comic Sans MS, cursive';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${miniGameState.timeLeft}с`, 20, 40);
}

// ============================================================
//          МИНИ-ИГРА 4: БОБРО-МЕМОРИ (Memory)
// ============================================================

let memoState = {
    cards: [],
    firstPick: null,
    secondPick: null,
    canPick: true,
    pairs: 0,
    totalPairs: 8,
    score: 0,
    cleared: 0,
    matchedIds: []
};

const MEMO_EMOJIS = ['🐹', '🌰', '🪵', '🍎', '🍄', '🏠', '🐺', '⭐'];

function initMemo() {
    // Размеры карт — динамически от ширины экрана
    const cardW = Math.min(140, (canvas.width - 60) / 4 - 20);
    const cardH = Math.min(120, (canvas.height - 120) / 4 - 20);
    const gapX = cardW + 20;
    const gapY = cardH + 20;
    const gridW = gapX * 4;
    const gridH = gapY * 4;
    const startX = (canvas.width - gridW) / 2 + 10;
    const startY = (canvas.height - gridH) / 2 + 10;
    
    memoState = {
        cards: [],
        firstPick: null,
        secondPick: null,
        canPick: true,
        pairs: 0,
        totalPairs: 8,
        score: 0,
        cleared: 0,
        matchedIds: [],
        startTime: Date.now()
    };
    
    // Создаём карты (4x4)
    let emojis = [...MEMO_EMOJIS, ...MEMO_EMOJIS];
    // Перемешиваем
    for (let i = emojis.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
    }
    
    for (let i = 0; i < 16; i++) {
        memoState.cards.push({
            id: i,
            emoji: emojis[i],
            flipped: false,
            matched: false,
            x: startX + (i % 4) * gapX,
            y: startY + Math.floor(i / 4) * gapY,
            width: cardW,
            height: cardH
        });
    }
    
    miniGameState.timeLeft = 45;
    showMiniGameInstruction('🃏 Бобро-мемори', 'Найди все пары! Открывай по 2 карты.');
}

function updateMemo() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;

    // Обработка кликов по картам
    // (в render будет обработчик)
    
    // Проверка победы
    if (memoState.cleared >= memoState.totalPairs) {
        miniGameState.isWin = true;
        const elapsed = (Date.now() - memoState.startTime) / 1000;
        if (elapsed < 20) {
            unlockAchievement('minigame_memory_complete', '🃏 "Феноменальная память" — пройти Мемори за 20 сек');
        }
        finishMiniGame(100 + memoState.score, 'memo');
    }
}

function renderMemo() {
    ctx.fillStyle = '#1a1a3e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка
    memoState.cards.forEach(card => {
        const x = card.x, y = card.y, w = card.width, h = card.height;
        
        if (card.matched) {
            ctx.fillStyle = 'rgba(255,215,0,0.3)';
            roundRect(ctx, x, y, w, h, 12);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.font = '50px Comic Sans MS, cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.emoji, x + w / 2, y + h / 2);
            return;
        }

        if (card.flipped) {
            // Лицевая сторона
            ctx.fillStyle = '#FFD700';
            roundRect(ctx, x, y, w, h, 12);
            ctx.fill();
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 3;
            roundRect(ctx, x, y, w, h, 12);
            ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.font = '60px Comic Sans MS, cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.emoji, x + w / 2, y + h / 2);
        } else {
            // Рубашка
            ctx.fillStyle = '#4a0e4e';
            roundRect(ctx, x, y, w, h, 12);
            ctx.fill();
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 3;
            roundRect(ctx, x, y, w, h, 12);
            ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.font = '40px Comic Sans MS, cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + w / 2, y + h / 2);
        }
    });

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '24px Comic Sans MS, cursive';
    ctx.textAlign = 'center';
    ctx.fillText(`🃏 Пары: ${memoState.cleared}/${memoState.totalPairs}   ⏱ ${miniGameState.timeLeft}с`, canvas.width / 2, 30);
}

// Обработка клика по карте (вызывается из render при клике)
function handleMemoClick(mx, my) {
    if (!memoState.canPick || miniGameState.isGameOver || miniGameState.isWin) return;
    
    for (const card of memoState.cards) {
        if (card.matched) continue;
        if (card.flipped) continue;
        if (mx >= card.x && mx <= card.x + card.width &&
            my >= card.y && my <= card.y + card.height) {
            
            card.flipped = true;
            
            if (memoState.firstPick === null) {
                memoState.firstPick = card;
            } else {
                memoState.secondPick = card;
                memoState.canPick = false;
                
                // Проверяем совпадение
                if (memoState.firstPick.emoji === memoState.secondPick.emoji) {
                    // Совпадение!
                    memoState.firstPick.matched = true;
                    memoState.secondPick.matched = true;
                    memoState.cleared++;
                    memoState.score += 20;
                    memoState.firstPick = null;
                    memoState.secondPick = null;
                    memoState.canPick = true;
                } else {
                    // Не совпало — переворачиваем обратно
                    setTimeout(() => {
                        memoState.firstPick.flipped = false;
                        memoState.secondPick.flipped = false;
                        memoState.firstPick = null;
                        memoState.secondPick = null;
                        memoState.canPick = true;
                    }, 600);
                }
            }
            break;
        }
    }
}

// ============================================================
//          МИНИ-ИГРА 5: ПРЫГ-СКОК (Endless Runner)
// ============================================================

let prigState = {
    bobr: { x: 100, y: 0, width: 50, height: 50, dy: 0, jumping: false, grounded: false },
    obstacles: [],
    groundY: 0,
    score: 0,
    speed: 5,
    spawnTimer: 0,
    maxScore: 0
};

function initPrigskok() {
    prigState = {
        bobr: { x: 100, y: canvas.height - 150, width: 50, height: 50, dy: 0, jumping: false, grounded: false },
        obstacles: [],
        groundY: canvas.height - 50,
        score: 0,
        speed: 5,
        spawnTimer: 60,
        maxScore: 0
    };
    showMiniGameInstruction('⚡ Прыг-скок', 'Прыгай через препятствия! (Пробел/↑)');
}

function updatePrigskok() {
    if (miniGameState.isGameOver) return;

    // Ускорение со временем
    prigState.speed = 5 + Math.floor(prigState.score / 100) * 0.5;

    // Гравитация
    prigState.bobr.dy += 0.6;
    prigState.bobr.y += prigState.bobr.dy;

    // Пол
    if (prigState.bobr.y + prigState.bobr.height >= prigState.groundY) {
        prigState.bobr.y = prigState.groundY - prigState.bobr.height;
        prigState.bobr.dy = 0;
        prigState.bobr.grounded = true;
        prigState.bobr.jumping = false;
    } else {
        prigState.bobr.grounded = false;
    }

    // Прыжок
    if ((keys[" "] || keys["KeyW"] || keys["ArrowUp"]) && prigState.bobr.grounded) {
        prigState.bobr.dy = -12;
        prigState.bobr.jumping = true;
        prigState.bobr.grounded = false;
        keys[" "] = false; keys["KeyW"] = false; keys["ArrowUp"] = false;
    }

    // Спавн препятствий
    prigState.spawnTimer--;
    if (prigState.spawnTimer <= 0) {
        const obsHeight = 20 + Math.random() * 40;
        prigState.obstacles.push({
            x: canvas.width + 20,
            y: prigState.groundY - obsHeight,
            width: 20 + Math.random() * 20,
            height: obsHeight,
            type: Math.random() < 0.3 ? 'double' : 'single'
        });
        prigState.spawnTimer = 40 + Math.floor(Math.random() * 30);
    }

    // Движение препятствий
    for (let i = prigState.obstacles.length - 1; i >= 0; i--) {
        const obs = prigState.obstacles[i];
        obs.x -= prigState.speed;
        if (obs.x + obs.width < 0) {
            prigState.obstacles.splice(i, 1);
            prigState.score += 10;
        }
    }

    // Столкновения
    for (const obs of prigState.obstacles) {
        if (prigState.bobr.x < obs.x + obs.width &&
            prigState.bobr.x + prigState.bobr.width > obs.x &&
            prigState.bobr.y < obs.y + obs.height &&
            prigState.bobr.y + prigState.bobr.height > obs.y) {
            miniGameState.isGameOver = true;
            prigState.maxScore = Math.max(prigState.maxScore, prigState.score);
            if (prigState.score >= 500) {
                unlockAchievement('minigame_dino_record', '⚡ "Скорость света" — пробежать 500+ в Прыг-скок');
            }
            finishMiniGame(Math.floor(prigState.score / 2), 'prigskok');
            return;
        }
    }

    // Счёт увеличивается со временем
    prigState.score += 0.2;
}

function renderPrigskok() {
    // Небо
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Облака
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(150 + Math.sin(Date.now() / 3000) * 100, 80, 40, 0, Math.PI * 2);
    ctx.arc(200 + Math.sin(Date.now() / 3000) * 100, 70, 30, 0, Math.PI * 2);
    ctx.arc(100 + Math.sin(Date.now() / 3000) * 100, 75, 35, 0, Math.PI * 2);
    ctx.fill();

    // Земля
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, prigState.groundY, canvas.width, canvas.height - prigState.groundY);
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(0, prigState.groundY, canvas.width, 5);

    // Препятствия
    prigState.obstacles.forEach(obs => {
        ctx.fillStyle = '#555';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#333';
        ctx.fillRect(obs.x - 2, obs.y - 10, obs.width + 4, 10);
    });

    // Бубор
    ctx.fillStyle = '#8B4513';
    roundRect(ctx, prigState.bobr.x, prigState.bobr.y, prigState.bobr.width, prigState.bobr.height, 10);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(prigState.bobr.x + 35, prigState.bobr.y + 15, 8, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    ctx.fillStyle = '#333';
    ctx.font = '28px Comic Sans MS, cursive';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${Math.floor(prigState.score)}`, canvas.width / 2, 50);
    ctx.font = '18px Comic Sans MS, cursive';
    ctx.fillText(`🚀 ${prigState.speed.toFixed(1)}`, canvas.width / 2, 80);
}

// ============================================================
//          МИНИ-ИГРА 6: МЕТКИЙ БОБР (Target Shoot)
// ============================================================

let mishState = {
    targets: [],
    crosshair: { x: 0, y: 0 },
    score: 0,
    spawnTimer: 0,
    totalSpawned: 0,
    maxTargets: 20,
    accuracy: 0,
    shots: 0,
    hits: 0,
    timeLeft: 30
};

function initMish() {
    mishState = {
        targets: [],
        crosshair: { x: canvas.width / 2, y: canvas.height / 2 },
        score: 0,
        spawnTimer: 0,
        totalSpawned: 0,
        maxTargets: 20,
        accuracy: 0,
        shots: 0,
        hits: 0,
        timeLeft: 30
    };
    showMiniGameInstruction('🎯 Меткий бобр', 'Целься мышкой и стреляй пробелом! Сбей все мишени!');
}

function updateMish() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;

    // Движение прицела за мышкой
    // (обрабатывается в render через mousemove)

    // Спавн мишеней
    mishState.spawnTimer--;
    if (mishState.spawnTimer <= 0 && mishState.totalSpawned < mishState.maxTargets) {
        mishState.targets.push({
            x: 50 + Math.random() * (canvas.width - 100),
            y: 50 + Math.random() * (canvas.height - 150),
            radius: 25 + Math.random() * 15,
            value: 10 + Math.floor(Math.random() * 5) * 10,
            life: 120 + Math.floor(Math.random() * 60),
            dx: (Math.random() - 0.5) * 2,
            dy: (Math.random() - 0.5) * 2
        });
        mishState.totalSpawned++;
        mishState.spawnTimer = 20 + Math.floor(Math.random() * 40);
    }

    // Движение мишеней
    for (let i = mishState.targets.length - 1; i >= 0; i--) {
        const t = mishState.targets[i];
        t.x += t.dx;
        t.y += t.dy;
        t.life--;

        // Отскакивание от стен
        if (t.x - t.radius < 0 || t.x + t.radius > canvas.width) t.dx *= -1;
        if (t.y - t.radius < 0 || t.y + t.radius > canvas.height - 100) t.dy *= -1;

        // Исчезновение
        if (t.life <= 0) {
            mishState.targets.splice(i, 1);
        }
    }

    // Проверка победы
    if (mishState.totalSpawned >= mishState.maxTargets && mishState.targets.length === 0) {
        miniGameState.isWin = true;
        if (mishState.hits >= 20) {
            unlockAchievement('minigame_mish_record', '🎯 "Снайпер" — сбить 20 мишеней в Метком бобре');
        }
        finishMiniGame(100 + mishState.score, 'mish');
    }

    // Таймер
    if (miniGameState.timeLeft <= 0) {
        miniGameState.isGameOver = true;
        finishMiniGame(mishState.score, 'mish');
    }
}

function renderMish() {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Звёзды
    for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(Date.now() / 1000 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc((i * 37 + 17) % canvas.width, (i * 53 + 13) % canvas.height, 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }

    // Мишени
    mishState.targets.forEach(t => {
        // Мишень
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Очки
        ctx.fillStyle = '#fff';
        ctx.font = '16px Comic Sans MS, cursive';
        ctx.textAlign = 'center';
        ctx.fillText(`+${t.value}`, t.x, t.y + t.radius + 20);
    });

    // Прицел
    const cx = mishState.crosshair.x;
    const cy = mishState.crosshair.y;
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '24px Comic Sans MS, cursive';
    ctx.textAlign = 'left';
    ctx.fillText(`🎯 ${mishState.hits}/${mishState.maxTargets}`, 20, 40);
    ctx.fillText(`💰 ${mishState.score}`, 20, 70);
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${miniGameState.timeLeft}с`, canvas.width - 20, 40);
}

function handleMishShot() {
    if (miniGameState.isGameOver || miniGameState.isWin) return;
    
    mishState.shots++;
    const cx = mishState.crosshair.x;
    const cy = mishState.crosshair.y;

    for (let i = mishState.targets.length - 1; i >= 0; i--) {
        const t = mishState.targets[i];
        const dist = Math.sqrt((cx - t.x) ** 2 + (cy - t.y) ** 2);
        if (dist <= t.radius) {
            mishState.targets.splice(i, 1);
            mishState.score += t.value;
            mishState.hits++;
            mishState.accuracy = (mishState.hits / mishState.shots) * 100;
            return;
        }
    }
}

// ============================================================
//          ОБЩИЙ ЦИКЛ ОБНОВЛЕНИЯ МИНИ-ИГР
// ============================================================

function updateMiniGame() {
    if (!miniGameState.active) return;

    // Таймер
    if (miniGameState.timeLeft > 0 && !miniGameState.isGameOver && !miniGameState.isWin) {
        // Уменьшаем раз в ~60 кадров (1 сек)
        if (frameIndex % 60 === 0 && frameIndex > 0) {
            miniGameState.timeLeft--;
        }
    }

    switch(miniGameState.type) {
        case 'bobrostroy': updateBobrostroy(); break;
        case 'orehopad': updateOrehopad(); break;
        case 'volk': updateVolk(); break;
        case 'memo': updateMemo(); break;
        case 'prigskok': updatePrigskok(); break;
        case 'mish': updateMish(); break;
    }
}

function renderMiniGame() {
    if (!miniGameState.active) return;

    switch(miniGameState.type) {
        case 'bobrostroy': renderBobrostroy(); break;
        case 'orehopad': renderOrehopad(); break;
        case 'volk': renderVolk(); break;
        case 'memo': renderMemo(); break;
        case 'prigskok': renderPrigskok(); break;
        case 'mish': renderMish(); break;
    }

    // Кнопка выхода
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '20px Comic Sans MS, cursive';
    ctx.textAlign = 'right';
    ctx.fillText('❌ ESC — выйти', canvas.width - 20, canvas.height - 20);
}

// ============================================================
//          ЗАВЕРШЕНИЕ МИНИ-ИГРЫ (с экраном результатов)
// ============================================================

function finishMiniGame(reward, gameId) {
    miniGameState.isGameOver = true;
    
    // Дополнительные ачивки
    if (gameId === 'bobrostroy' && reward > 50) {
        unlockAchievement('minigame_bobrostroy_complete', '🏗️ "Великий строитель" — пройти Бобрострой');
    }
    
    // Показываем экран результатов
    showMiniGameResultScreen(reward);
}

function showMiniGameResultScreen(reward) {
    // Определяем название мини-игры
    const names = {
        'bobrostroy': '🏗️ Бобрострой',
        'orehopad': '🌰 Орехопад',
        'volk': '🐺 Волк у реки',
        'memo': '🃏 Бобро-мемори',
        'prigskok': '⚡ Прыг-скок',
        'mish': '🎯 Меткий бобр'
    };
    const title = names[miniGameState.type] || '🎮 Мини-игра';
    const won = miniGameState.isWin;
    
    // Создаём DOM-экран результата
    const overlay = document.createElement('div');
    overlay.id = 'miniGameResult';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Comic Sans MS', cursive;
        animation: resultFadeIn 0.5s ease-out;
    `;
    overlay.innerHTML = `
        <div style="text-align:center; padding: 40px; border-radius: 20px; 
            background: ${won ? 'linear-gradient(135deg, #1a1a2e, #16213e)' : 'linear-gradient(135deg, #2e1a1a, #3e1616)'};
            border: 3px solid ${won ? '#FFD700' : '#ff4444'};
            box-shadow: 0 0 40px ${won ? 'rgba(255,215,0,0.3)' : 'rgba(255,68,68,0.3)'};">
            <div style="font-size: 80px; margin-bottom: 10px;">${won ? '🎉' : '😞'}</div>
            <h2 style="color: ${won ? '#FFD700' : '#ff6666'}; font-size: 36px; margin: 10px 0;">
                ${won ? 'Победа!' : 'Конец игры'}
            </h2>
            <p style="color: #fff; font-size: 24px; margin: 10px 0;">${title}</p>
            <p style="color: #FFD700; font-size: 32px; margin: 15px 0;">
                ${won ? `💰 +${reward} боброчков!` : `💰 Заработано: ${reward} боброчков`}
            </p>
            <div style="margin-top: 20px;">
                <button id="miniGameContinueBtn" style="
                    padding: 14px 40px; font-size: 22px;
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    color: #333; border: none; border-radius: 12px;
                    cursor: pointer; font-family: inherit;
                    box-shadow: 0 4px 15px rgba(255,215,0,0.3);
                    transition: transform 0.2s;
                ">▶ Продолжить приключение</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Добавляем анимацию появления, если ещё нет
    if (!document.getElementById('miniGameResultStyle')) {
        const style = document.createElement('style');
        style.id = 'miniGameResultStyle';
        style.textContent = `
            @keyframes resultFadeIn {
                0% { opacity: 0; transform: scale(0.8); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Обработчик кнопки "Продолжить"
    document.getElementById('miniGameContinueBtn').onclick = function() {
        // Удаляем экран результата
        document.body.removeChild(overlay);
        // Выходим из мини-игры с наградой
        exitMiniGame(reward);
    };
}

// ============================================================
//          ПОРТАЛ НА УРОВНЕ
// ============================================================

let portalItem = null;
let portalRotation = 0;

function spawnPortal() {
    // С 3-го уровня, шанс 20%
    if (level < 3) { portalItem = null; return; }
    if (Math.random() > 0.20) { portalItem = null; return; }
    
    // Ставим на случайной верхней платформе
    const elevatedPlatforms = platforms.filter(p => p.y < canvas.height * 0.4 && !p.isFalling && p.width >= 60);
    if (elevatedPlatforms.length === 0) { portalItem = null; return; }
    
    const p = elevatedPlatforms[Math.floor(Math.random() * elevatedPlatforms.length)];
    portalItem = {
        x: p.x + Math.random() * (p.width - 50),
        y: p.y - 60,
        width: 50,
        height: 60,
        hue: 0
    };
}

function renderPortal() {
    if (!portalItem || miniGameState.active) return;
    
    portalRotation += 0.03;
    portalItem.hue = (portalItem.hue + 1) % 360;
    
    const cx = portalItem.x + portalItem.width / 2;
    const cy = portalItem.y + portalItem.height / 2;
    const r = 28;
    
    // Внешнее свечение
    const gradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, r + 15);
    gradient.addColorStop(0, `hsla(${portalItem.hue}, 100%, 70%, 0.3)`);
    gradient.addColorStop(1, `hsla(${portalItem.hue + 60}, 100%, 50%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Вращающийся портал
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(portalRotation);
    
    // Овальная форма портала
    ctx.fillStyle = `hsla(${portalItem.hue}, 100%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Внутренняя часть
    ctx.fillStyle = `hsla(${portalItem.hue + 120}, 100%, 80%, 0.8)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.6, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Яркий центр
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Частицы вокруг портала
    for (let i = 0; i < 3; i++) {
        const angle = portalRotation + (i * Math.PI * 2 / 3);
        const dist = r + 10 + Math.sin(portalRotation * 2 + i) * 8;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        ctx.fillStyle = `hsla(${portalItem.hue + i * 40}, 100%, 70%, 0.8)`;
        ctx.beginPath();
        ctx.arc(px, py, 3 + Math.sin(portalRotation * 3 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Подпись
    ctx.fillStyle = `hsla(${portalItem.hue}, 100%, 80%, ${0.6 + Math.sin(Date.now() / 500) * 0.3})`;
    ctx.font = '16px Comic Sans MS, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('🌀 Портал', cx, portalItem.y - 15);
}

function checkPortalCollision() {
    if (!portalItem || miniGameState.active || gameState.isPaused) return false;
    
    if (rectCollide(player, portalItem)) {
        // Нашли портал!
        portalItem = null; // убираем портал с уровня
        
        // Эффект затемнения и входа
        createPortalFlashEffect();
        
        // Выбираем случайную непосещённую мини-игру
        const gameId = getRandomMiniGameId();
        
        // Входим
        setTimeout(() => {
            enterMiniGame(gameId);
        }, 1000); // 1 сек на анимацию
        
        return true;
    }
    return false;
}

function createPortalFlashEffect() {
    // Эффект вспышки при входе в портал (просто визуальное затемнение)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: radial-gradient(circle, rgba(180,0,255,0.8), rgba(0,0,0,0.9));
        z-index: 9999; pointer-events: none;
        animation: portalFlash 1s ease-in-out forwards;
    `;
    document.body.appendChild(overlay);
    
    // Добавляем анимацию, если ещё нет
    if (!document.getElementById('portalFlashStyle')) {
        const style = document.createElement('style');
        style.id = 'portalFlashStyle';
        style.textContent = `
            @keyframes portalFlash {
                0% { opacity: 1; transform: scale(0.5); border-radius: 50%; }
                50% { opacity: 1; transform: scale(1.2); }
                100% { opacity: 0; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
    }, 1000);
}

// ============================================================
//          ИНСТРУКЦИЯ МИНИ-ИГРЫ
// ============================================================

let miniGameInstruction = null;

function showMiniGameInstruction(title, desc) {
    miniGameInstruction = { title, desc, timer: 120 };
}

function renderMiniGameInstruction() {
    if (!miniGameInstruction) return;
    
    miniGameInstruction.timer--;
    if (miniGameInstruction.timer <= 0) {
        miniGameInstruction = null;
        return;
    }
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(canvas.width / 2 - 250, canvas.height / 2 - 80, 500, 160);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = '32px Comic Sans MS, cursive';
    ctx.textAlign = 'center';
    ctx.fillText(miniGameInstruction.title, canvas.width / 2, canvas.height / 2 - 30);
    
    ctx.fillStyle = '#fff';
    ctx.font = '20px Comic Sans MS, cursive';
    ctx.fillText(miniGameInstruction.desc, canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Comic Sans MS, cursive';
    ctx.fillText('Приготовься...', canvas.width / 2, canvas.height / 2 + 55);
}

// ============================================================
//          ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ СОБЫТИЙ МИНИ-ИГР
// ============================================================

// Добавляем обработчики при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Клик для Мемори и Меткого бобра
    document.addEventListener('click', function(e) {
        if (!miniGameState.active) return;
        
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        if (miniGameState.type === 'memo') {
            handleMemoClick(mx, my);
        } else if (miniGameState.type === 'mish') {
            handleMishShot();
        }
    });
    
    // Движение мыши для прицела в Метком бобре
    document.addEventListener('mousemove', function(e) {
        if (!miniGameState.active || miniGameState.type !== 'mish') return;
        
        const rect = canvas.getBoundingClientRect();
        mishState.crosshair.x = e.clientX - rect.left;
        mishState.crosshair.y = e.clientY - rect.top;
    });
    
    // Escape для выхода из мини-игры
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && miniGameState.active) {
            // Выход без награды
            exitMiniGame(0);
        }
    });
});

// ============================================================
//          ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function roundRect(ctx, x, y, w, h, r) {
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
}