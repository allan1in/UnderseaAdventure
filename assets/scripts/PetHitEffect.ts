import { _decorator, AudioClip, Component, director, JsonAsset, Rect, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2 } from 'cc';
import { SoundEffects } from './SoundEffects';

const { ccclass, property } = _decorator;
type FrameIndex = { frames: { name: string; rect: number[]; original: number[]; offset: number[]; rotated: boolean }[] };

/** 原图集按索引播放，不重新裁切 PNG；同一套特效共享 SpriteFrame。 */
@ccclass('PetHitEffect')
export class PetHitEffect extends Component {
    @property([SpriteFrame]) themeFrames: SpriteFrame[] = [];
    @property({ tooltip: '海洋技能帧画布的显示宽度，命中点居中播放' }) displayWidth = 200;
    @property(Texture2D)
    texture: Texture2D | null = null;

    @property(JsonAsset)
    frameData: JsonAsset | null = null;

    @property(Sprite)
    picture: Sprite | null = null;

    @property({ tooltip: '每张技能图片的播放时间；蓝龙约 1/30 秒，其余 0.05 秒' })
    frameInterval = .05;

    @property(AudioClip)
    sound: AudioClip | null = null;

    @property({ tooltip: '播放对应的示例伙伴技能音效' })
    playSound = true;

    @property({ tooltip: '同种音效短时间只播放一次，避免群体命中时叠加几十份声音' })
    soundInterval = 1;

    private static frames = new WeakMap<Texture2D, Map<JsonAsset, SpriteFrame[]>>();
    private sequence: SpriteFrame[] = [];
    private elapsed = 0;
    private frameIndex = -1;

    get playbackTime(): number { return this.elapsed; }

    onLoad(): void {
        if (this.themeFrames.length) {
            this.sequence = this.themeFrames;
            return;
        }
        if (!this.texture || !this.frameData) return;
        let byData = PetHitEffect.frames.get(this.texture);
        if (!byData) { byData = new Map(); PetHitEffect.frames.set(this.texture, byData); }
        let frames = byData.get(this.frameData);
        if (!frames) {
            const data = this.frameData.json as FrameIndex;
            frames = (data.frames ?? []).map(source => {
                const frame = new SpriteFrame();
                frame.name = source.name;
                frame.reset({ texture: this.texture!, rect: new Rect(...source.rect as [number, number, number, number]),
                    originalSize: new Size(source.original[0], source.original[1]),
                    offset: new Vec2(source.offset[0], source.offset[1]), isRotate: source.rotated });
                return frame;
            });
            byData.set(this.frameData, frames);
        }
        this.sequence = frames;
    }

    onEnable(): void {
        this.elapsed = 0;
        this.frameIndex = -1;
        if (!this.sequence.length || !this.picture) { this.node.active = false; return; }
        this.showFrame(0);
        if (this.playSound && this.sound) SoundEffects.playClip(this.sound, this.soundInterval);
    }

    update(deltaTime: number): void {
        if (director.isPaused()) return;
        this.elapsed += Math.max(0, deltaTime);
        const index = Math.floor(this.elapsed / Math.max(.001, this.frameInterval));
        if (index >= this.sequence.length) { this.node.active = false; return; }
        this.showFrame(index);
    }

    private showFrame(index: number): void {
        if (index === this.frameIndex || !this.picture) return;
        this.frameIndex = index;
        this.picture.spriteFrame = this.sequence[index];
        const size = this.sequence[index].originalSize;
        if (this.themeFrames.length) {
            this.picture.sizeMode = Sprite.SizeMode.CUSTOM;
            this.picture.trim = false;
            this.picture.getComponent(UITransform)?.setContentSize(this.displayWidth, this.displayWidth * size.height / size.width);
        } else this.picture.getComponent(UITransform)?.setContentSize(size.width, size.height);
    }
}
