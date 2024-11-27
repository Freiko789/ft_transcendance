import { AudioListener, Audio, AudioLoader } from '/game_server/node_modules/three/build/three.module.js';


export default class Sound {
    constructor(camera) {
        this.listener = new AudioListener();
        camera.add(this.listener);
        
        this.sounds = {};
        this.soundsInGame = {};

		this.loadSound('woosh', '/game_server/sound/woosh.wav', 1, false);
        this.loadSound('pong', '/game_server/sound/pong.wav', 0.2, false);
        this.loadSound('ambient', '/game_server/sound/ambient.wav', 0.2, true);
        this.loadSound('lobby', '/game_server/sound/lobby.wav', 0.1, true);
        this.loadSound('inGame', '/game_server/sound/inGame.mp3', 0.1, true, true);
        this.loadSound('song1', '/game_server/sound/song1.wav', 0.2, true, true);
        this.loadSound('song2', '/game_server/sound/song2.mp3', 0.2, true, true);
        this.loadSound('song3', '/game_server/sound/song3.wav', 0.2, true, true);
        this.loadSound('song4', '/game_server/sound/song4.wav', 0.2, true, true);
        this.loadSound('song5', '/game_server/sound/song5.wav', 0.2, true, true);
		this.loadSound('win', '/game_server/sound/win.mp3', 0.1, false);
		this.loadSound('loose', '/game_server/sound/loose.mp3', 0.1, false);
        this.loadSound('Goal', '/game_server/sound/Goal.mp3', 0.3, false);
        this.loadSound('endTournament', '/game_server/sound/Fin-tournois.mp3', 0.3, false);
    }

    loadSound(name, url, volume = 1, loop = false, inGame = false) {
        const sound = new Audio(this.listener);
        const audioLoader = new AudioLoader();

        audioLoader.load(url, (buffer) => {
            sound.setBuffer(buffer);
            sound.setVolume(volume);
            sound.setLoop(loop);
            if (!inGame)
                this.sounds[name] = sound;
            else
                this.soundsInGame[name] = sound;
			if (name.startsWith('song')) {
				sound.onEnded = () => this.onSongEnd();
			}
        });
    }

    play(name, inGame = false) {
        let sound;
        if (!inGame)
            sound = this.sounds[name];
        else
            sound = this.soundsInGame[name];
        if (sound) {
            sound.play();
        } else {
            console.error(`Sound ${name} not found!`);
        }
    }

    stop(name, inGame = false) {
        let sound;
        if (!inGame)
            sound = this.sounds[name];
        else
            sound = this.soundsInGame[name];
        if (sound) {
            sound.stop();
        } else {
            console.error(`Sound ${name} not found!`);
        }
    }

	playMusic() {
        const songKeys = ['song1', 'song2', 'song3', 'song4', 'song5'];

        this.activeSongs = this.shuffleArray(songKeys);
        this.currentSongIndex = 0;

        this.playNextSong();
    }

    playNextSong() {
        if (this.currentSong && this.currentSong.isPlaying) {
            this.currentSong.stop();
        }
        
        const nextSongName = this.activeSongs[this.currentSongIndex];
        const nextSong = this.soundsInGame[nextSongName];
        
        if (nextSong) {
            this.currentSong = nextSong;
            nextSong.play();
        }
    }

    onSongEnd() {
        this.currentSongIndex++;
        if (this.currentSongIndex >= this.activeSongs.length) {
            this.currentSongIndex = 0;
        }
        this.playNextSong();
    }

    stopMusic() {
        if (this.currentSong && this.currentSong.isPlaying) {
            this.currentSong.stop();
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}