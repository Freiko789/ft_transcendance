import { PerspectiveCamera } from "/game_server/node_modules/three/build/three.module.js";

export default class Camera extends PerspectiveCamera {
    constructor() {
        super(50, window.innerWidth/window.innerHeight)
        this.position.set(0, 200, 50);
    }

    animCam(targetX, targetY, targetZ, steps = 50, interval = 20) {
        let currentStep = 0;
        const startX = this.position.x;
        const startY = this.position.y;
        const startZ = this.position.z;

        const deltaX = (targetX - startX) / steps;
        const deltaY = (targetY - startY) / steps;
        const deltaZ = (targetZ - startZ) / steps;

        const countdownInterval = setInterval(() => {
            if (currentStep >= steps) {
                this.position.x = targetX;
                this.position.y = targetY;
                this.position.z = targetZ;
                this.lookAt(0,3,0);
                clearInterval(countdownInterval);
                return;
            }
            this.lookAt(0,3,0);
            this.position.x += deltaX;
            this.position.y += deltaY;
            this.position.z += deltaZ;

            currentStep++;
        }, interval);
    }

}