import { _decorator, Animation, Color, Component, director, JsonAsset, Node, Rect, Size, sp, Sprite, SpriteFrame, Texture2D, UITransform, Vec2 } from 'cc';
import { CharacterAnimation } from './CharacterAnimation';
const { ccclass, property } = _decorator;
export type BossAction = 'idle' | 'move' | 'attack' | 'cast' | 'death';
type FrameIndex = { frames: { name: string; rect: number[]; original: number[]; offset: number[]; rotated: boolean }[] };

@ccclass('BossVisual')
export class BossVisual extends Component {
    @property(Sprite) picture: Sprite | null = null;
    @property(Node) visual: Node | null = null;
    @property(sp.SkeletonData) bossSkeleton: sp.SkeletonData | null = null;
    private skeleton: sp.Skeleton | null = null;
    @property(Texture2D) movementTexture: Texture2D | null = null;
    @property(JsonAsset) movementIndex: JsonAsset | null = null;
    @property(Texture2D) combatTexture: Texture2D | null = null;
    @property(JsonAsset) combatIndex: JsonAsset | null = null;
    @property({ tooltip: '原 Boss 三倍图片显示比例，按学习工程一半比例换算' }) visualScale = 1.5;
    @property frameInterval = 1 / 30;
    @property({ type: SpriteFrame, tooltip: '海底 Boss 静态外观；使用原动作时长进行攻击和死亡计时' })
    themeFrame: SpriteFrame | null = null;
    private actionFrameCounts = new Map<BossAction, number>();
    private initialized = false;
    private sequences = new Map<BossAction, SpriteFrame[]>();
    private action: BossAction = 'idle';
    private elapsed = 0;
    private frame = -1;
    private facing = 1;
    private flash = 0;

    get isComplete(): boolean { return this.elapsed >= this.duration(this.action); }
    get direction(): number { return this.facing; }
    duration(action: BossAction): number {
        if (this.skeleton) return this.skeleton.findAnimation(this.spineAction(action))?.duration ?? 0;
        const legacy = action === 'cast' ? 'attack' : action;
        return this.getComponent(CharacterAnimation)?.duration(legacy)
            || (this.actionFrameCounts.get(action) ?? 0) * Math.max(.001, this.frameInterval);
    }

    onLoad(): void {
        if (this.initialized) return;
        this.initialized = true;
        if (this.bossSkeleton) {
            const old = this.getComponent(CharacterAnimation);
            old?.animation?.stop();
            if (old) old.enabled = false;
            this.picture?.getComponent(Animation)?.stop();
            const node = new Node('BossSpine');
            node.layer = this.node.layer;
            node.addComponent(UITransform).setContentSize(320, 320);
            node.setPosition(this.picture?.node.position ?? this.node.position.clone().set(0, 0, 0));
            node.setScale(this.picture?.node.scale ?? this.node.scale.clone().set(this.visualScale, this.visualScale, 1));
            (this.visual ?? this.node).addChild(node);
            this.skeleton = node.addComponent(sp.Skeleton);
            this.skeleton.premultipliedAlpha = false;
            this.skeleton.skeletonData = this.bossSkeleton;
            this.skeleton.setMix('Idle', 'Move', .08);
            this.skeleton.setMix('Move', 'Idle', .08);
            if (this.picture) this.picture.node.active = false;
            this.show('idle', true);
            return;
        }
        const pictureAnimation = this.getComponent(CharacterAnimation);
        if (pictureAnimation) pictureAnimation.blendActions = false;
        for (const [texture, index] of [[this.movementTexture, this.movementIndex], [this.combatTexture, this.combatIndex]] as const) {
            if (!texture || !index) continue;
            for (const action of ['idle', 'move', 'attack', 'death'] as BossAction[]) {
                const entries = (index.json as FrameIndex).frames.filter(f => new RegExp('^' + action + '\\d+$').test(f.name))
                    .sort((a, b) => Number(a.name.slice(action.length)) - Number(b.name.slice(action.length)));
                if (!entries.length) continue;
                this.actionFrameCounts.set(action, entries.length);
                if (this.themeFrame || this.getComponent(CharacterAnimation)) continue;
                this.sequences.set(action, entries.map(source => {
                    const frame = new SpriteFrame(); frame.name = source.name;
                    frame.reset({ texture, rect: new Rect(...source.rect as [number, number, number, number]),
                        originalSize: new Size(source.original[0], source.original[1]),
                        offset: new Vec2(source.offset[0], source.offset[1]), isRotate: source.rotated });
                    return frame;
                }));
            }
        }
        this.show('idle', true);
    }

    setFacing(dx: number): void {
        if (Math.abs(dx) < .001) return;
        this.facing = dx > 0 ? 1 : -1;
        this.visual?.setScale(this.facing, 1, 1);
    }

    show(action: BossAction, restart = false): void {
        if (this.action === action && !restart) return;
        this.action = action; this.elapsed = 0; this.frame = -1;
        if (this.skeleton) {
            this.skeleton.setAnimation(0, this.spineAction(action), action === 'idle' || action === 'move');
            return;
        }
        if (action === 'cast') action = 'attack';
        const pictureAnimation = this.getComponent(CharacterAnimation);
        if (pictureAnimation) { pictureAnimation.show(action, restart); return; }
        // 海底图片的尺寸和脚底位置由 Prefab 校准，动作切换不再使用黑龙偏移。
        if (this.themeFrame) {
            if (this.picture) this.picture.spriteFrame = this.themeFrame;
            return;
        }
        // 固定轴使用原 Role 的 X=0，而非偏在身体左侧的原物理圆中心。
        // 各动作画布只在这条轴下校准；仅翻转 Visual，血条和根节点不翻转。
        const offsets = { idle: [-1.91625, 89.39775], move: [2.94225, 125.9205],
            attack: [131.4765, 100.8615], death: [-22.0125, 121.4535] };
        this.picture?.node.setPosition(offsets[action][0], offsets[action][1], 0);
        this.picture?.node.setScale(this.visualScale, this.visualScale, 1);
        this.sample();
    }

    private spineAction(action: BossAction): string {
        return { idle: 'Idle', move: 'Move', attack: 'Attack', cast: 'Cast', death: 'Death' }[action];
    }

    flashHit(): void {
        this.flash = .12;
        if (this.skeleton) this.skeleton.color = new Color(255, 130, 130, 255);
        else if (this.picture) this.picture.color = new Color(255, 130, 130, 255);
    }

    update(deltaTime: number): void {
        if (director.isPaused()) return;
        this.elapsed += Math.max(0, deltaTime);
        if (this.flash > 0) {
            this.flash = Math.max(0, this.flash - deltaTime);
            if (!this.flash) {
                if (this.skeleton) this.skeleton.color = Color.WHITE;
                else if (this.picture) this.picture.color = Color.WHITE;
            }
        }
        this.sample();
    }

    private sample(): void {
        if (this.skeleton) return;
        if (this.getComponent(CharacterAnimation)) return;
        if (this.themeFrame) return;
        const frames = this.sequences.get(this.action);
        if (!frames?.length || !this.picture) return;
        const timeIndex = Math.floor(this.elapsed / Math.max(.001, this.frameInterval));
        const index = this.action === 'idle' || this.action === 'move' ? timeIndex % frames.length : Math.min(frames.length - 1, timeIndex);
        if (index === this.frame) return;
        this.frame = index;
        this.picture.spriteFrame = frames[index];
        const size = frames[index].originalSize;
        this.picture.getComponent(UITransform)?.setContentSize(size.width, size.height);
    }

    onDestroy(): void {
        this.skeleton = null;
        if (this.picture?.isValid) this.picture.spriteFrame = null;
        for (const frames of this.sequences.values()) for (const frame of frames) frame.destroy();
        this.sequences.clear();
    }
}
