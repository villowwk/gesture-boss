// ============================================
// MODEL
// ============================================

const MODEL_URL =
    "./model/";


// ============================================
// IMAGES
// ============================================

const BOSS_NORMAL_IMAGE =
    "assets/boss/boss.png";

const BOSS_HIT_IMAGE =
    "assets/boss/boss-hit.png";

const PERFECT_IMAGE =
    "assets/feedback/perfect.png";

const MISS_IMAGE =
    "assets/feedback/miss.png";


// ============================================
// GESTURES
// ============================================

const NEUTRAL_CLASS =
    "Neutral";


const GESTURES = [

    {
        className: "Fire",

        colorIcon:
            "assets/elements/fire-color.png",

        whiteIcon:
            "assets/elements/fire-white.png"
    },

    {
        className: "Water",

        colorIcon:
            "assets/elements/water-color.png",

        whiteIcon:
            "assets/elements/water-white.png"
    },

    {
        className: "Wind",

        colorIcon:
            "assets/elements/wind-color.png",

        whiteIcon:
            "assets/elements/wind-white.png"
    }

];


// ============================================
// GAME SETTINGS
// ============================================

const MAX_BOSS_HP =
    100;

const ROW_DAMAGE =
    20;

const SEQUENCE_LENGTH =
    5;

const ROUND_TIME =
    45;

const CONFIDENCE_THRESHOLD =
    0.85;

const REQUIRED_STABLE_FRAMES =
    4;


// ============================================
// VARIABLES
// ============================================

let model =
    null;

let webcam =
    null;

let gameStarted =
    false;

let gameOver =
    false;

let bossHP =
    MAX_BOSS_HP;

let currentSequence =
    [];

let currentGestureIndex =
    0;


// Теперь combo = правильные отдельные жесты подряд.

let comboCount =
    0;


let timeLeft =
    ROUND_TIME;

let timerInterval =
    null;

let waitingForNeutral =
    false;

let lastDetectedClass =
    null;

let stableFrames =
    0;

let judgementTimer =
    null;


// ============================================
// HTML ELEMENTS
// ============================================

const startButton =
    document.getElementById(
        "start-button"
    );

const resetButton =
    document.getElementById(
        "reset-button"
    );

const tutorialButton =
    document.getElementById(
        "tutorial-button"
    );


const webcamContainer =
    document.getElementById(
        "webcam-container"
    );

const gestureStatus =
    document.getElementById(
        "gesture-status"
    );

const battleText =
    document.getElementById(
        "battle-text"
    );

const rhythmLine =
    document.getElementById(
        "rhythm-line"
    );

const comboCounter =
    document.getElementById(
        "combo-counter"
    );

const timerText =
    document.getElementById(
        "timer"
    );

const boss =
    document.getElementById(
        "boss"
    );

const bossHealth =
    document.getElementById(
        "boss-health"
    );

const hpText =
    document.getElementById(
        "hp-text"
    );

const judgementImage =
    document.getElementById(
        "judgement-image"
    );


// ============================================
// TIMEOUT
// ============================================

const timeoutOverlay =
    document.getElementById(
        "timeout-overlay"
    );

const timeoutClose =
    document.getElementById(
        "timeout-close"
    );

const retryButton =
    document.getElementById(
        "retry-button"
    );

const timeoutResult =
    document.getElementById(
        "timeout-result"
    );


// ============================================
// VICTORY
// ============================================

const victoryOverlay =
    document.getElementById(
        "victory-overlay"
    );

const victoryClose =
    document.getElementById(
        "victory-close"
    );

const victoryRetry =
    document.getElementById(
        "victory-retry"
    );

const victoryResult =
    document.getElementById(
        "victory-result"
    );


// ============================================
// START GAME
// ============================================

async function startGame() {

    if (gameStarted) {
        return;
    }


    startButton.disabled =
        true;


    battleText.textContent =
        "Загружаю модель...";


    try {

        const modelURL =
            MODEL_URL
            + "model.json";

        const metadataURL =
            MODEL_URL
            + "metadata.json";


        model =
            await tmImage.load(
                modelURL,
                metadataURL
            );

    }

    catch (error) {

        console.error(
            "MODEL ERROR:",
            error
        );


        battleText.textContent =
            "Ошибка загрузки модели: "
            + error.message;


        startButton.disabled =
            false;


        return;
    }


    try {

        webcam =
            new tmImage.Webcam(
                300,
                300,
                true
            );


        await webcam.setup({
            facingMode: "user"
        });


        await webcam.play();


        webcamContainer.innerHTML =
            "";


        webcamContainer.appendChild(
            webcam.canvas
        );

    }

    catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        battleText.textContent =
            "Ошибка камеры: "
            + error.message;


        startButton.disabled =
            false;


        return;
    }


    gameStarted =
        true;


    resetGame();


    window.requestAnimationFrame(
        loop
    );
}


// ============================================
// LOOP
// ============================================

async function loop() {

    if (!gameStarted) {
        return;
    }


    webcam.update();


    await predict();


    window.requestAnimationFrame(
        loop
    );
}


// ============================================
// PREDICTION
// ============================================

async function predict() {

    if (
        !model
        ||
        !webcam
        ||
        gameOver
    ) {

        return;
    }


    const predictions =
        await model.predict(
            webcam.canvas
        );


    let bestPrediction =
        predictions[0];


    for (
        let i = 1;
        i < predictions.length;
        i++
    ) {

        if (
            predictions[i].probability
            >
            bestPrediction.probability
        ) {

            bestPrediction =
                predictions[i];

        }

    }


    const className =
        bestPrediction.className;


    const probability =
        bestPrediction.probability;


    if (
        probability
        <
        CONFIDENCE_THRESHOLD
    ) {

        gestureStatus.textContent =
            "Не распознано";


        stableFrames =
            0;


        lastDetectedClass =
            null;


        return;
    }


    gestureStatus.textContent =
        className
        + " — "
        + Math.round(
            probability * 100
        )
        + "%";


    // ========================================
    // NEUTRAL
    // ========================================

    if (
        className ===
        NEUTRAL_CLASS
    ) {

        stableFrames =
            0;


        lastDetectedClass =
            null;


        if (
            waitingForNeutral
        ) {

            waitingForNeutral =
                false;


            battleText.textContent =
                "Готово. Следующий жест.";

        }


        return;
    }


    if (
        waitingForNeutral
    ) {

        return;
    }


    // ========================================
    // STABLE GESTURE
    // ========================================

    if (
        className ===
        lastDetectedClass
    ) {

        stableFrames++;

    }

    else {

        lastDetectedClass =
            className;


        stableFrames =
            1;

    }


    if (
        stableFrames
        <
        REQUIRED_STABLE_FRAMES
    ) {

        return;
    }


    stableFrames =
        0;


    lastDetectedClass =
        null;


    checkGesture(
        className
    );
}


// ============================================
// CHECK GESTURE
// ============================================

function checkGesture(
    detectedClass
) {

    if (
        gameOver
        ||
        currentGestureIndex
        >=
        currentSequence.length
    ) {

        return;
    }


    const requiredGesture =
        currentSequence[
            currentGestureIndex
        ];


    // ========================================
    // PERFECT
    // ========================================

    if (
        detectedClass
        ===
        requiredGesture.className
    ) {

        // Один правильный жест = +1 COMBO.

        comboCount++;


        updateCombo();


        showJudgement(
            "perfect"
        );


        currentGestureIndex++;


        waitingForNeutral =
            true;


        battleText.textContent =
            "PERFECT! "
            + detectedClass;


        renderSequence();


        // Закончили весь ряд.

        if (
            currentGestureIndex
            >=
            currentSequence.length
        ) {

            completeRow();

        }

    }


    // ========================================
    // MISS
    // ========================================

    else {

        // Ошибка полностью сбрасывает streak.

        comboCount =
            0;


        updateCombo();


        showJudgement(
            "miss"
        );


        battleText.textContent =
            "MISS! Нужен "
            + requiredGesture.className
            + ".";


        // Элемент НЕ переключается.
        // После Neutral игрок снова
        // пробует тот же жест.

        waitingForNeutral =
            true;

    }

}


// ============================================
// COMBO
// ============================================

function updateCombo() {

    comboCounter.textContent =
        "COMBO "
        + comboCount;

}


// ============================================
// PERFECT / MISS IMAGE
// ============================================

function showJudgement(
    type
) {

    clearTimeout(
        judgementTimer
    );


    if (
        type === "perfect"
    ) {

        judgementImage.src =
            PERFECT_IMAGE;


        judgementImage.alt =
            "Perfect";

    }

    else {

        judgementImage.src =
            MISS_IMAGE;


        judgementImage.alt =
            "Miss";

    }


    judgementImage.classList.add(
        "show"
    );


    judgementTimer =
        setTimeout(
            function () {

                judgementImage.classList.remove(
                    "show"
                );

            },
            450
        );

}


// ============================================
// CREATE SEQUENCE
// ============================================

function createNewSequence() {

    currentSequence =
        [];


    currentGestureIndex =
        0;


    stableFrames =
        0;


    lastDetectedClass =
        null;


    for (
        let i = 0;
        i < SEQUENCE_LENGTH;
        i++
    ) {

        const randomIndex =
            Math.floor(
                Math.random()
                *
                GESTURES.length
            );


        currentSequence.push(
            GESTURES[
                randomIndex
            ]
        );

    }


    renderSequence();
}


// ============================================
// RENDER SEQUENCE
// ============================================

function renderSequence() {

    rhythmLine.innerHTML =
        "";


    currentSequence.forEach(
        function (
            gesture,
            index
        ) {

            const element =
                document.createElement(
                    "div"
                );


            element.classList.add(
                "rhythm-symbol"
            );


            const image =
                document.createElement(
                    "img"
                );


            image.alt =
                gesture.className;


            if (
                index
                <
                currentGestureIndex
            ) {

                element.classList.add(
                    "done"
                );


                image.src =
                    gesture.whiteIcon;

            }


            else if (
                index
                ===
                currentGestureIndex
            ) {

                element.classList.add(
                    "current"
                );


                image.src =
                    gesture.colorIcon;

            }


            else {

                element.classList.add(
                    "future"
                );


                image.src =
                    gesture.whiteIcon;

            }


            element.appendChild(
                image
            );


            rhythmLine.appendChild(
                element
            );

        }
    );

}


// ============================================
// COMPLETE FULL ROW
// ============================================

function completeRow() {

    damageBoss(
        ROW_DAMAGE
    );


    if (!gameOver) {

        battleText.textContent =
            "Ряд завершён! "
            + ROW_DAMAGE
            + " урона.";


        setTimeout(
            function () {

                if (!gameOver) {

                    createNewSequence();


                    battleText.textContent =
                        "Новая последовательность!";

                }

            },
            700
        );

    }

}


// ============================================
// DAMAGE BOSS
// ============================================

function damageBoss(
    damage
) {

    bossHP -=
        damage;


    if (
        bossHP < 0
    ) {

        bossHP =
            0;

    }


    updateBoss();


    boss.src =
        BOSS_HIT_IMAGE;


    boss.classList.add(
        "hit"
    );


    setTimeout(
        function () {

            boss.src =
                BOSS_NORMAL_IMAGE;


            boss.classList.remove(
                "hit"
            );

        },
        180
    );


    if (
        bossHP <= 0
    ) {

        winGame();

    }

}


// ============================================
// UPDATE BOSS
// ============================================

function updateBoss() {

    const hpPercent =
        bossHP
        /
        MAX_BOSS_HP
        *
        100;


    bossHealth.style.width =
        hpPercent
        + "%";


    hpText.textContent =
        bossHP
        + " / "
        + MAX_BOSS_HP
        + " HP";

}


// ============================================
// TIMER
// ============================================

function startTimer() {

    clearInterval(
        timerInterval
    );


    timerInterval =
        setInterval(
            function () {

                if (
                    !gameStarted
                    ||
                    gameOver
                ) {

                    return;
                }


                timeLeft--;


                updateTimer();


                if (
                    timeLeft <= 0
                ) {

                    timeOut();

                }

            },
            1000
        );

}


function resetTimer() {

    timeLeft =
        ROUND_TIME;


    updateTimer();
}


function updateTimer() {

    timerText.textContent =
        timeLeft;

}


// ============================================
// TIME OUT
// ============================================

function timeOut() {

    timeLeft =
        0;


    updateTimer();


    gameOver =
        true;


    clearInterval(
        timerInterval
    );


    gestureStatus.textContent =
        "ВРЕМЯ ВЫШЛО";


    battleText.textContent =
        "Время вышло.";


    timeoutResult.textContent =
        "У босса осталось "
        + bossHP
        + " HP.";


    timeoutOverlay.classList.remove(
        "hidden"
    );

}


// ============================================
// WIN
// ============================================

function winGame() {

    gameOver =
        true;


    clearInterval(
        timerInterval
    );


    boss.classList.add(
        "dead"
    );


    gestureStatus.textContent =
        "ПОБЕДА";


    battleText.textContent =
        "Босс побеждён!";


    victoryResult.textContent =
        "Осталось времени: "
        + timeLeft
        + " сек. COMBO: "
        + comboCount
        + ".";


    setTimeout(
        function () {

            victoryOverlay.classList.remove(
                "hidden"
            );

        },
        250
    );

}


// ============================================
// RESET GAME
// ============================================

function resetGame() {

    timeoutOverlay.classList.add(
        "hidden"
    );


    victoryOverlay.classList.add(
        "hidden"
    );


    bossHP =
        MAX_BOSS_HP;


    comboCount =
        0;


    currentGestureIndex =
        0;


    gameOver =
        false;


    waitingForNeutral =
        false;


    stableFrames =
        0;


    lastDetectedClass =
        null;


    boss.src =
        BOSS_NORMAL_IMAGE;


    boss.classList.remove(
        "dead"
    );


    boss.classList.remove(
        "hit"
    );


    judgementImage.classList.remove(
        "show"
    );


    updateCombo();

    updateBoss();

    createNewSequence();

    resetTimer();


    gestureStatus.textContent =
        "Покажи жест";


    if (
        gameStarted
    ) {

        startTimer();


        battleText.textContent =
            "Повтори последовательность жестов.";

    }

}


// ============================================
// RESULT BUTTONS
// ============================================

retryButton.addEventListener(
    "click",
    resetGame
);


victoryRetry.addEventListener(
    "click",
    resetGame
);


timeoutClose.addEventListener(
    "click",
    function () {

        timeoutOverlay.classList.add(
            "hidden"
        );

    }
);


victoryClose.addEventListener(
    "click",
    function () {

        victoryOverlay.classList.add(
            "hidden"
        );

    }
);


// ============================================
// TUTORIAL
// ============================================

const tutorialOverlay =
    document.getElementById(
        "tutorial-overlay"
    );

const tutorialPages =
    document.querySelectorAll(
        ".tutorial-page"
    );

const tutorialNext =
    document.getElementById(
        "tutorial-next"
    );

const tutorialBack =
    document.getElementById(
        "tutorial-back"
    );

const tutorialSkip =
    document.getElementById(
        "tutorial-skip"
    );


let tutorialStep =
    0;


function showTutorialPage() {

    tutorialPages.forEach(
        function (page) {

            page.classList.remove(
                "active"
            );

        }
    );


    tutorialPages[
        tutorialStep
    ].classList.add(
        "active"
    );


    tutorialBack.style.visibility =
        tutorialStep === 0
        ? "hidden"
        : "visible";


    tutorialNext.textContent =
        tutorialStep
        ===
        tutorialPages.length - 1
        ? "START GAME"
        : "NEXT →";

}


function openTutorial() {

    tutorialStep =
        0;


    tutorialOverlay.classList.remove(
        "hidden"
    );


    showTutorialPage();

}


function closeTutorial() {

    tutorialOverlay.classList.add(
        "hidden"
    );

}


tutorialNext.addEventListener(
    "click",
    function () {

        if (
            tutorialStep
            <
            tutorialPages.length - 1
        ) {

            tutorialStep++;


            showTutorialPage();

        }

        else {

            closeTutorial();

        }

    }
);


tutorialBack.addEventListener(
    "click",
    function () {

        if (
            tutorialStep > 0
        ) {

            tutorialStep--;


            showTutorialPage();

        }

    }
);


tutorialSkip.addEventListener(
    "click",
    closeTutorial
);


tutorialButton.addEventListener(
    "click",
    openTutorial
);


// ============================================
// MAIN BUTTONS
// ============================================

startButton.addEventListener(
    "click",
    startGame
);


resetButton.addEventListener(
    "click",
    resetGame
);


// ============================================
// INITIAL
// ============================================

updateBoss();

updateCombo();

updateTimer();

showTutorialPage();