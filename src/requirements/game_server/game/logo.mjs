import { TextureLoader, PlaneGeometry, Mesh, MeshBasicMaterial } from "./node_modules/three/build/three.module.js";

export default class Logo extends Mesh {
    constructor(scene, texturePath = '/game_server/png/logoScreen.png', width = 160, height = 100, position = {x: 0, y: 0, z: 0}, rotation = {x: -1.56, y: 0, z: 0}) {
        const textureLoader = new TextureLoader();
        const texture = textureLoader.load(texturePath);

        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1
        });

        const geometry = new PlaneGeometry(width, height);

        super(geometry, material);

        this.position.set(position.x, position.y, position.z);

        this.rotation.set(rotation.x, rotation.y, rotation.z);

        scene.add(this);
    }
}