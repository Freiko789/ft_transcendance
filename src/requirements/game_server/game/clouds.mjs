import { TextureLoader, PlaneGeometry, Mesh, MeshBasicMaterial } from "./node_modules/three/build/three.module.js";

export default class Clouds extends Mesh {
    constructor(scene, texturePath = '/game_server/png/clouds.png', width = window.innerWidth / 2, height = window.innerHeight / 2, position = {x: 0, y: 60, z: 0}, rotation = {x: -1.56, y: 0, z: 0}) {
        const textureLoader = new TextureLoader();
        const texture = textureLoader.load(texturePath);

        const planeGeo = new PlaneGeometry(width, height);

        const nuagesMaterial = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1
        });

        super(planeGeo, nuagesMaterial);

        this.position.set(position.x, position.y, position.z);

        this.rotation.set(rotation.x, rotation.y, rotation.z);

        scene.add(this);
    }
}