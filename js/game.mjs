export function intersects(a, b, padding = 0) {
    return a.x + padding < b.x + b.width
        && a.x + a.width - padding > b.x
        && a.y + padding < b.y + b.height
        && a.y + a.height - padding > b.y;
}

export function createGame({
    canvas,
    scoreElement,
    bestElement,
    startCard,
    stateTitle,
    stateText,
    startButton,
    pauseButton,
    announcement,
    controlButtons,
    soundButton,
    comboElement,
    powerElement,
    onStart = () => {},
    onGameOver = () => {}
}) {
    const context = canvas.getContext('2d');
    const input = { up: false, down: false, left: false, right: false };
    const storageKey = 'feijoada-dayse-game-best-v1';
    const soundStorageKey = 'feijoada-dayse-game-sound-v1';
    const state = {
        active: true,
        running: false,
        paused: false,
        over: false,
        score: 0,
        best: readBest(),
        width: 720,
        height: 440,
        elapsed: 0,
        lastTime: 0,
        lastBean: 0,
        lastObstacle: 0,
        lastPowerUp: 0,
        frame: 0,
        beans: [],
        obstacles: [],
        powerUps: [],
        feedback: [],
        combo: 1,
        lastCollectAt: -10,
        shield: false,
        doubleUntil: 0,
        collections: 0,
        collectedPowerUps: 0,
        startedAt: 0,
        sound: readSound(),
        player: { x: 56, y: 194, width: 52, height: 42 }
    };

    function readBest() {
        try {
            return Math.max(0, Number(localStorage.getItem(storageKey)) || 0);
        } catch {
            return 0;
        }
    }

    function saveBest() {
        try {
            localStorage.setItem(storageKey, String(state.best));
        } catch {
            // O jogo continua mesmo quando o armazenamento está bloqueado.
        }
    }

    function readSound() {
        try { return localStorage.getItem(soundStorageKey) !== 'off'; } catch { return true; }
    }

    function updateHud() {
        if (comboElement) comboElement.textContent = `Combo ×${state.combo}${state.doubleUntil > state.elapsed ? ' · Farofa ×2' : ''}`;
        if (powerElement) powerElement.textContent = state.shield ? 'Panela protegida' : state.doubleUntil > state.elapsed ? 'Farofa Dourada' : 'Sem power-up';
        if (soundButton) {
            soundButton.textContent = state.sound ? 'Som ligado' : 'Som desligado';
            soundButton.setAttribute('aria-pressed', String(state.sound));
        }
    }

    function sound(frequency = 440, duration = 0.06) {
        if (!state.sound) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audio = sound.context || (sound.context = new AudioContext());
            const oscillator = audio.createOscillator(); const gain = audio.createGain();
            oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
            oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
        } catch { /* áudio é um reforço opcional */ }
    }

    function setScore(value) {
        state.score = value;
        scoreElement.textContent = String(value);
        if (value > state.best) {
            state.best = value;
            bestElement.textContent = String(value);
            saveBest();
        }
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        state.width = Math.max(300, rect.width || 720);
        state.height = Math.max(220, rect.height || 440);
        canvas.width = Math.round(state.width * ratio);
        canvas.height = Math.round(state.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        state.player.x = Math.min(state.player.x, state.width - state.player.width - 8);
        state.player.y = Math.min(state.player.y, state.height - state.player.height - 8);
        draw();
    }

    function reset() {
        state.elapsed = 0;
        state.lastBean = 0;
        state.lastObstacle = 0;
        state.lastPowerUp = 0;
        state.beans = [];
        state.obstacles = [];
        state.powerUps = [];
        state.feedback = [];
        state.combo = 1;
        state.lastCollectAt = -10;
        state.shield = false;
        state.doubleUntil = 0;
        state.collections = 0;
        state.collectedPowerUps = 0;
        state.startedAt = performance.now();
        state.player.x = Math.max(24, state.width * 0.1);
        state.player.y = Math.max(24, (state.height - state.player.height) / 2);
        state.over = false;
        setScore(0);
        updateHud();
    }

    function start() {
        reset();
        onStart();
        state.running = true;
        state.paused = false;
        state.lastTime = performance.now();
        startCard.hidden = true;
        pauseButton.textContent = 'Pausar';
        announcement.textContent = 'Partida iniciada.';
        cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(loop);
    }

    function resume() {
        if (!state.active || state.over) return;
        state.running = true;
        state.paused = false;
        state.lastTime = performance.now();
        startCard.hidden = true;
        pauseButton.textContent = 'Pausar';
        announcement.textContent = 'Partida retomada.';
        cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(loop);
    }

    function pause({ quiet = false } = {}) {
        if (!state.running || state.over) return;
        state.running = false;
        state.paused = true;
        cancelAnimationFrame(state.frame);
        stateTitle.textContent = 'Pausa rápida';
        stateText.textContent = 'A panela fica aqui. Continue quando quiser.';
        startButton.textContent = 'Continuar';
        startCard.hidden = false;
        pauseButton.textContent = 'Continuar';
        if (!quiet) announcement.textContent = 'Jogo pausado.';
    }

    function gameOver() {
        state.running = false;
        state.over = true;
        cancelAnimationFrame(state.frame);
        stateTitle.textContent = 'A panela esbarrou!';
        stateText.textContent = `Você fez ${state.score} pontos. Bora tentar de novo?`;
        startButton.textContent = 'Jogar novamente';
        startCard.hidden = false;
        pauseButton.textContent = 'Pausar';
        announcement.textContent = `Fim de jogo. Pontuação ${state.score}.`;
        sound(120, 0.22);
        onGameOver({ score: state.score, durationMs: Math.round(performance.now() - state.startedAt), collections: state.collections, powerUps: state.collectedPowerUps });
    }

    function spawnBean() {
        const size = 23 + Math.random() * 7;
        state.beans.push({
            x: state.width + size,
            y: 16 + Math.random() * Math.max(20, state.height - size - 32),
            width: size,
            height: size * 0.72,
            rotation: Math.random() * Math.PI,
            drift: (Math.random() - 0.5) * 18,
            golden: Math.random() < 0.08
        });
    }

    function spawnPowerUp() {
        const type = Math.random() < 0.55 ? 'farofa' : 'shield';
        state.powerUps.push({ x: state.width + 40, y: 24 + Math.random() * Math.max(20, state.height - 70), width: 34, height: 34, type, rotation: 0 });
    }

    function spawnObstacle() {
        const size = 38 + Math.random() * 14;
        state.obstacles.push({
            x: state.width + size,
            y: 10 + Math.random() * Math.max(20, state.height - size - 20),
            width: size,
            height: size,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() > 0.5 ? 1 : -1) * 1.5
        });
    }

    function update(delta) {
        state.elapsed += delta;
        const playerSpeed = 245;
        const diagonal = (input.up || input.down) && (input.left || input.right) ? Math.SQRT1_2 : 1;
        const movement = playerSpeed * delta * diagonal;
        if (input.up) state.player.y -= movement;
        if (input.down) state.player.y += movement;
        if (input.left) state.player.x -= movement;
        if (input.right) state.player.x += movement;
        state.player.x = Math.max(8, Math.min(state.width - state.player.width - 8, state.player.x));
        state.player.y = Math.max(8, Math.min(state.height - state.player.height - 8, state.player.y));

        const worldSpeed = Math.min(360, 155 + state.elapsed * 5.5);
        const beanInterval = Math.max(390, 850 - state.elapsed * 9);
        const obstacleInterval = Math.max(520, 1280 - state.elapsed * 10);
        const powerInterval = 9000;
        const elapsedMs = state.elapsed * 1000;

        if (elapsedMs - state.lastBean >= beanInterval) {
            state.lastBean = elapsedMs;
            spawnBean();
        }
        if (elapsedMs - state.lastObstacle >= obstacleInterval) {
            state.lastObstacle = elapsedMs;
            spawnObstacle();
        }
        if (state.elapsed > 6 && elapsedMs - state.lastPowerUp >= powerInterval) {
            state.lastPowerUp = elapsedMs;
            spawnPowerUp();
        }

        state.beans.forEach((bean) => {
            bean.x -= worldSpeed * delta;
            bean.y += bean.drift * delta;
        });
        state.obstacles.forEach((obstacle) => {
            obstacle.x -= (worldSpeed + 22) * delta;
            obstacle.rotation += obstacle.spin * delta;
        });
        state.powerUps.forEach((power) => { power.x -= worldSpeed * 0.86 * delta; power.rotation += delta * 2; });
        state.feedback.forEach((item) => {
            item.y -= 32 * delta;
            item.life -= delta;
        });

        state.beans = state.beans.filter((bean) => {
            if (intersects(state.player, bean, 6)) {
                state.combo = state.elapsed - state.lastCollectAt < 2.2 ? Math.min(4, state.combo + 1) : 1;
                state.lastCollectAt = state.elapsed;
                const base = bean.golden ? 50 : 10;
                const multiplier = state.combo * (state.doubleUntil > state.elapsed ? 2 : 1);
                const gained = base * multiplier;
                state.collections += 1;
                setScore(state.score + gained);
                state.feedback.push({ x: bean.x, y: bean.y, life: 0.9, label: `+${gained}` });
                announcement.textContent = `${gained} pontos. Combo vezes ${state.combo}.`;
                sound(bean.golden ? 880 : 540 + state.combo * 70);
                updateHud();
                return false;
            }
            return bean.x + bean.width > -5 && bean.y > -30 && bean.y < state.height + 30;
        });

        state.feedback = state.feedback.filter((item) => item.life > 0);
        state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -5);

        state.powerUps = state.powerUps.filter((power) => {
            if (intersects(state.player, power, 4)) {
                state.collectedPowerUps += 1;
                if (power.type === 'shield') state.shield = true;
                else state.doubleUntil = state.elapsed + 8;
                state.feedback.push({ x: power.x, y: power.y, life: 1.2, label: power.type === 'shield' ? 'ESCUDO!' : 'FAROFA ×2!' });
                announcement.textContent = power.type === 'shield' ? 'Panela protegida.' : 'Farofa Dourada: pontos em dobro por oito segundos.';
                sound(980, 0.12); updateHud(); return false;
            }
            return power.x + power.width > -5;
        });

        if (state.obstacles.some((obstacle) => intersects(state.player, obstacle, 7))) {
            if (state.shield) {
                state.shield = false;
                state.obstacles = state.obstacles.filter((obstacle) => !intersects(state.player, obstacle, 7));
                state.feedback.push({ x: state.player.x, y: state.player.y, life: 1, label: 'PROTEGIDA!' });
                announcement.textContent = 'O escudo da panela absorveu a batida.'; sound(240, 0.12); updateHud();
            } else gameOver();
        }
        if (state.elapsed - state.lastCollectAt > 2.2 && state.combo !== 1) { state.combo = 1; updateHud(); }
        if (state.doubleUntil && state.doubleUntil <= state.elapsed) { state.doubleUntil = 0; updateHud(); }
    }

    function drawBackground() {
        context.fillStyle = '#2e1013';
        context.fillRect(0, 0, state.width, state.height);

        context.strokeStyle = 'rgba(245, 189, 73, 0.09)';
        context.lineWidth = 1;
        const offset = (state.elapsed * 45) % 42;
        for (let x = -offset; x < state.width + 42; x += 42) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, state.height);
            context.stroke();
        }
        for (let y = 0; y < state.height; y += 42) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(state.width, y);
            context.stroke();
        }
    }

    function drawPlayer() {
        const { x, y, width, height } = state.player;
        context.save();
        context.translate(x, y);
        context.fillStyle = '#f5bd49';
        context.beginPath();
        context.roundRect(3, 10, width - 6, height - 12, 7);
        context.fill();
        context.fillStyle = '#b4342f';
        context.fillRect(0, 8, width, 8);
        context.fillStyle = '#fff4de';
        context.beginPath();
        context.ellipse(width / 2, 9, width * 0.36, 5.5, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#f5bd49';
        context.lineWidth = 5;
        context.beginPath();
        context.arc(width - 1, 24, 11, -Math.PI / 2, Math.PI / 2);
        context.stroke();
        context.fillStyle = '#2e1013';
        context.beginPath();
        context.arc(width * 0.38, 25, 2.5, 0, Math.PI * 2);
        context.arc(width * 0.62, 25, 2.5, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#2e1013';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(width / 2, 28, 7, 0.15, Math.PI - 0.15);
        context.stroke();
        context.restore();
    }

    function drawBean(bean) {
        context.save();
        context.translate(bean.x + bean.width / 2, bean.y + bean.height / 2);
        context.rotate(bean.rotation);
        context.fillStyle = bean.golden ? '#ffe071' : '#e9a837';
        if (bean.golden) { context.shadowColor = '#ffe071'; context.shadowBlur = 16; }
        context.beginPath();
        context.ellipse(0, 0, bean.width / 2, bean.height / 2, 0.5, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#7b2825';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(-1, 0, bean.width * 0.24, -1.1, 1.65);
        context.stroke();
        context.restore();
    }

    function drawPowerUp(power) {
        context.save(); context.translate(power.x + 17, power.y + 17); context.rotate(power.rotation);
        context.fillStyle = power.type === 'shield' ? '#74c5d6' : '#f2cf69'; context.strokeStyle = '#fff4de'; context.lineWidth = 3;
        if (power.type === 'shield') { context.beginPath(); context.moveTo(0, -15); context.lineTo(14, -7); context.lineTo(10, 11); context.lineTo(0, 17); context.lineTo(-10, 11); context.lineTo(-14, -7); context.closePath(); context.fill(); context.stroke(); }
        else { context.beginPath(); context.roundRect(-15, -11, 30, 22, 6); context.fill(); context.stroke(); context.fillStyle = '#7b2825'; context.font = '900 12px sans-serif'; context.textAlign = 'center'; context.fillText('×2', 0, 4); }
        context.restore();
    }

    function drawObstacle(obstacle) {
        context.save();
        context.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
        context.rotate(obstacle.rotation);
        context.fillStyle = '#b4342f';
        context.beginPath();
        context.arc(0, 0, obstacle.width / 2, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#f1d3a5';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, obstacle.width * 0.33, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#f5bd49';
        context.fillRect(-4, -obstacle.height * 0.68, 8, obstacle.height * 0.3);
        context.restore();
    }

    function draw() {
        drawBackground();
        state.beans.forEach(drawBean);
        state.obstacles.forEach(drawObstacle);
        state.powerUps.forEach(drawPowerUp);
        drawPlayer();
        state.feedback.forEach((item) => {
            context.save();
            context.globalAlpha = Math.min(1, item.life * 2);
            context.fillStyle = '#f5bd49';
            context.font = '900 18px "Nunito Sans", sans-serif';
            context.fillText(item.label || '+10', item.x, item.y);
            context.restore();
        });
    }

    function loop(time) {
        if (!state.running || !state.active) return;
        const delta = Math.min(0.033, Math.max(0, (time - state.lastTime) / 1000));
        state.lastTime = time;
        update(delta);
        draw();
        if (state.running) state.frame = requestAnimationFrame(loop);
    }

    const keyMap = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right'
    };

    function onKey(event, pressed) {
        const direction = keyMap[event.key];
        if (!direction || !state.active) return;
        event.preventDefault();
        input[direction] = pressed;
    }

    const keyDown = (event) => onKey(event, true);
    const keyUp = (event) => onKey(event, false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    controlButtons.forEach((button) => {
        const direction = button.dataset.direction;
        const press = (event) => {
            event.preventDefault();
            input[direction] = true;
            button.classList.add('is-pressed');
        };
        const release = (event) => {
            event.preventDefault();
            input[direction] = false;
            button.classList.remove('is-pressed');
        };
        button.addEventListener('pointerdown', press);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('pointerleave', release);
    });

    startButton.addEventListener('click', () => {
        if (state.paused && !state.over) resume();
        else start();
    });
    pauseButton.addEventListener('click', () => {
        if (state.paused) resume();
        else pause();
    });
    soundButton?.addEventListener('click', () => {
        state.sound = !state.sound;
        try { localStorage.setItem(soundStorageKey, state.sound ? 'on' : 'off'); } catch { /* preferência opcional */ }
        if (state.sound) sound(620);
        updateHud();
    });

    const visibilityHandler = () => {
        if (document.hidden) pause({ quiet: true });
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', resize);

    bestElement.textContent = String(state.best);
    updateHud();
    resize();

    return {
        start,
        pause,
        resize,
        setActive(active) {
            state.active = Boolean(active);
            Object.keys(input).forEach((direction) => { input[direction] = false; });
            if (!state.active) pause({ quiet: true });
            else resize();
        },
        destroy() {
            cancelAnimationFrame(state.frame);
            window.removeEventListener('keydown', keyDown);
            window.removeEventListener('keyup', keyUp);
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', visibilityHandler);
            resizeObserver?.disconnect();
        },
        getState() {
            return { ...state, beans: [...state.beans], obstacles: [...state.obstacles] };
        }
    };
}
