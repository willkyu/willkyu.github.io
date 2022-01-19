function clickEffect() {
    undefined

    let balls = [];

    let longPressed = false;

    let longPress;

    let multiplier = 0;

    let width, height;

    let origin;

    let normal;

    let ctx;

    const colours = ["#FFF0F5", "#E6E6FA", "#F0FFF0", "#F0F8FF", "#FFF8DC"];

    const canvas = document.createElement("canvas");

    document.body.appendChild(canvas);

    canvas.setAttribute("style", "width: 100%; height: 100%; top: 0; left: 0; z-index: 99999; position: fixed; pointer-events: none;");

    const pointer = document.createElement("span");

    pointer.classList.add("pointer");

    document.body.appendChild(pointer);

    if (canvas.getContext && window.addEventListener) {
        undefined

        ctx = canvas.getContext("2d");

        updateSize();

        window.addEventListener('resize', updateSize, false);

        loop();

        window.addEventListener("mousedown", function (e) {
            undefined

            pushBalls(randBetween(10, 20), e.clientX, e.clientY);//数量

            document.body.classList.add("is-pressed");

            longPress = setTimeout(function () {
                undefined

                document.body.classList.add("is-longpress");

                longPressed = true;

            }, 500);

        }, false);

        window.addEventListener("mouseup", function (e) {
            undefined

            clearInterval(longPress);

            if (longPressed == true) {
                undefined

                document.body.classList.remove("is-longpress");

                pushBalls(randBetween(50 + Math.ceil(multiplier), 100 + Math.ceil(multiplier)), e.clientX, e.clientY);

                longPressed = false;

            }

            document.body.classList.remove("is-pressed");

        }, false);

        window.addEventListener("mousemove", function (e) {
            undefined

            let x = e.clientX;

            let y = e.clientY;

            pointer.style.top = y + "px";

            pointer.style.left = x + "px";

        }, false);

    } else {
        undefined

        console.log("canvas or addEventListener is unsupported!");

    }

    function updateSize() {
        undefined

        canvas.width = window.innerWidth * 2;

        canvas.height = window.innerHeight * 2;

        canvas.style.width = window.innerWidth + 'px';

        canvas.style.height = window.innerHeight + 'px';

        ctx.scale(2, 2);

        width = (canvas.width = window.innerWidth);

        height = (canvas.height = window.innerHeight);

        origin = { x: width / 2, y: height / 2 };

        normal = { x: width / 2, y: height / 2 };

    }

    class Ball {
        undefined

        constructor(x = origin.x, y = origin.y) {
            undefined

            this.x = x;

            this.y = y;

            this.angle = Math.PI * 2 * Math.random(); //大小

            if (longPressed == true) {
                undefined

                this.multiplier = randBetween(9 + multiplier, 10 + multiplier);

            } else {
                undefined

                this.multiplier = randBetween(3, 6);//距离

            }

            this.vx = (this.multiplier + Math.random() * 0.5) * Math.cos(this.angle);

            this.vy = (this.multiplier + Math.random() * 0.5) * Math.sin(this.angle);

            this.r = randBetween(8, 12) + 3 * Math.random();

            this.color = colours[Math.floor(Math.random() * colours.length)];

        }

        update() {
            undefined

            this.x += this.vx - normal.x;

            this.y += this.vy - normal.y;

            normal.x = -2 / window.innerWidth * Math.sin(this.angle);

            normal.y = -2 / window.innerHeight * Math.cos(this.angle);

            this.r -= 0.3;

            this.vx *= 0.9;

            this.vy *= 0.9;

        }

    }

    function pushBalls(count = 1, x = origin.x, y = origin.y) {
        undefined

        for (let i = 0; i < count; i++) {
            undefined

            balls.push(new Ball(x, y));

        }

    }

    function randBetween(min, max) {
        undefined

        return Math.floor(Math.random() * max) + min;

    }

    function loop() {
        undefined

        ctx.fillStyle = "rgba(255, 255, 255, 0)";

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < balls.length; i++) {
            undefined

            let b = balls[i];

            if (b.r < 0) continue;

            ctx.fillStyle = b.color;

            ctx.beginPath();

            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2, false);

            ctx.fill();

            b.update();

        }

        if (longPressed == true) {
            undefined

            multiplier += 0.2;

        } else if (!longPressed && multiplier >= 0) {
            undefined

            multiplier -= 0.4;

        }

        removeBall();

        requestAnimationFrame(loop);

    }

    function removeBall() {
        undefined

        for (let i = 0; i < balls.length; i++) {
            undefined

            let b = balls[i];

            if (b.x + b.r < 0 || b.x - b.r > width || b.y + b.r < 0 || b.y - b.r > height || b.r < 0) {
                undefined

                balls.splice(i, 1);

            }

        }

    }

}

clickEffect();