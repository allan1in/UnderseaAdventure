import { _decorator, AudioClip, AudioSource, Component, CCString } from 'cc';

const { ccclass, property, executionOrder } = _decorator;
const SETTINGS: Record<string, { volume: number; interval: number }> = {
    'coin-map': { volume: 1, interval: .5 },
    'coin-shopping': { volume: 1, interval: .1 },
    'enemy-death': { volume: .5, interval: .5 },
    'boss-attack': { volume: .6, interval: .5 },
    'shop-buy': { volume: .6, interval: 0 },
};

/** 统一播放示例音效；同种连续音效合并，选卡和结算暂停时仍可播放。 */
@ccclass('SoundEffects')
@executionOrder(-100)
export class SoundEffects extends Component {
    @property({ type: [AudioClip] }) clips: AudioClip[] = [];
    @property({ type: [CCString], tooltip: '与 Clips 一一对应的示例音效名称' }) clipNames: string[] = [];

    private static current: SoundEffects | null = null;
    private source: AudioSource | null = null;
    private byName = new Map<string, AudioClip>();
    private lastPlayed = new Map<AudioClip, number>();

    onLoad(): void {
        this.source = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);
        this.source.playOnAwake = false;
        this.source.loop = false;
        this.clips.forEach((clip, i) => { if (clip) this.byName.set(this.clipNames[i] || clip.name, clip); });
    }

    onEnable(): void { SoundEffects.current = this; }
    onDisable(): void { if (SoundEffects.current === this) SoundEffects.current = null; }

    static play(name: string, volume?: number): boolean {
        const system = SoundEffects.current;
        const clip = system?.byName.get(name);
        if (!system || !clip) return false;
        const settings = SETTINGS[name];
        return system.playAudio(clip, volume ?? settings?.volume ?? 1, settings?.interval ?? 0);
    }

    static playClip(clip: AudioClip, interval = 1): boolean {
        return SoundEffects.current?.playAudio(clip, 1, interval) ?? false;
    }

    private playAudio(clip: AudioClip, volume: number, interval: number): boolean {
        if (!this.source || !this.enabledInHierarchy) return false;
        const now = Date.now() / 1000;
        if (now - (this.lastPlayed.get(clip) ?? -Infinity) < Math.max(0, interval)) return false;
        this.lastPlayed.set(clip, now);
        this.source.playOneShot(clip, Math.max(0, Math.min(1, volume)));
        return true;
    }
}
