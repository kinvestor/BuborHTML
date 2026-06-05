// ============================================================
//          ЭФФЕКТЫ ПРЫЖКА (ДЕКОРАТИВНЫЕ ЧАСТИЦЫ)
//          Добавка к functions.js — можно покупать в магазине скинов
// ============================================================

// Массив частиц эффекта прыжка (дополняет jumpParticles из functions.js)
// Если jumpParticles не объявлен, создаём его
if (typeof jumpParticles === 'undefined') {
    var jumpParticles = [];
}

// Создать частицы эффекта прыжка в позиции (x, y)
function spawnJumpEffect(x, y) {
    if (typeof activeJumpEffect === 'undefined' || !activeJumpEffect) return;
    
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
            default:
                return;
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

// Обновить и отрисовать jump-частицы на canvas
// Вызывать в render() после отрисовки runningParticles
function renderJumpParticles(ctx) {
    if (!ctx || !jumpParticles || jumpParticles.length === 0) return;
    
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

// Патчим render() чтобы добавить отрисовку jump-частиц
// Сохраняем оригинальный render
const _origRender = typeof render !== 'undefined' ? render : null;

if (typeof render !== 'undefined') {
    const __origRender = render;
    render = function() {
        __origRender();
        // Рисуем jump-частицы ПОСЛЕ runningParticles в render()
        if (typeof ctx !== 'undefined' && ctx) {
            renderJumpParticles(ctx);
        }
    };
}