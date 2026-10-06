import { _decorator, AudioSource, Component, Node } from 'cc';
const { ccclass, property, executionOrder } = _decorator;

/** 背景音乐与气泡独立播放；首次摇杆输入主动启动，避免只依赖自动播放。 */
@ccclass('MusicDirector')
@executionOrder(-90)
export class MusicDirector extends Component {
    @property(Node) hero: Node | null = null;
    @property(AudioSource) backgroundMusic: AudioSource | null = null;
    @property(AudioSource) bossMusic: AudioSource | null = null;
    @property(AudioSource) ambience: AudioSource | null = null;
    private static current: MusicDirector | null = null;
    private started = false;
    private bossPhase = false;

    onLoad(): void {
        this.hero ??= this.node.getChildByName('World')?.getChildByName('Hero') ?? null;
        for (const source of this.sources()) {
            source.playOnAwake = false;
            source.loop = true;
            source.stop();
        }
    }
    onEnable(): void { MusicDirector.current = this; }
    onDisable(): void {
        if (MusicDirector.current === this) MusicDirector.current = null;
        for (const source of this.sources()) source.stop();
    }

    static startFromGesture(hero: Node | null): void {
        const music = MusicDirector.current;
        if (!music || !hero || music.hero !== hero) return;
        music.started = true;
        music.ensurePlaying(music.bossPhase ? music.bossMusic : music.backgroundMusic);
        music.ensurePlaying(music.ambience);
    }
    static useBossMusic(): void { MusicDirector.current?.switchMusic(true); }
    static restoreBackground(): void { MusicDirector.current?.switchMusic(false); }

    private switchMusic(bossPhase: boolean): void {
        if (this.bossPhase === bossPhase) return;
        this.bossPhase = bossPhase;
        (bossPhase ? this.backgroundMusic : this.bossMusic)?.stop();
        if (this.started) this.ensurePlaying(bossPhase ? this.bossMusic : this.backgroundMusic);
        // 环境音不停止、不重启，贯穿战斗及音乐切换。
    }
    private ensurePlaying(source: AudioSource | null): void {
        if (source?.clip && !source.playing) source.play();
    }
    private sources(): AudioSource[] {
        return [this.backgroundMusic, this.bossMusic, this.ambience].filter((source): source is AudioSource => !!source);
    }
}
