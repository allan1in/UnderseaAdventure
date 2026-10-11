import { _decorator, AudioSource, Component, input, Input, Node } from 'cc';
const { ccclass, property, executionOrder } = _decorator;

/** 首次游戏触摸启动音乐；音乐启动与摇杆开始战斗相互独立。 */
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
    onEnable(): void {
        MusicDirector.current = this;
        // 全局输入覆盖按钮等会阻止节点事件冒泡的区域，鼠标也会转换为触摸事件。
        input.on(Input.EventType.TOUCH_START, this.onGesture, this);
        // 抬手时重试浏览器尚未解锁的播放，不重置已经播放的音乐。
        input.on(Input.EventType.TOUCH_END, this.onGesture, this);
    }
    onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onGesture, this);
        input.off(Input.EventType.TOUCH_END, this.onGesture, this);
        if (MusicDirector.current === this) MusicDirector.current = null;
        for (const source of this.sources()) source.stop();
        this.started = false;
    }

    private onGesture(): void { MusicDirector.startFromGesture(this.hero); }

    static startFromGesture(hero: Node | null): void {
        const music = MusicDirector.current;
        if (!music || !hero || music.hero !== hero) return;
        // 场景可能在加载页消失前已创建，不把加载期间的触摸当成游戏输入。
        if (typeof document !== 'undefined') {
            const splash = document.getElementById('splash');
            if (splash && getComputedStyle(splash).display !== 'none') return;
        }
        if (!music.started) {
            for (const source of music.sources()) {
                source.stop();
                source.currentTime = 0;
            }
            music.started = true;
        }
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
