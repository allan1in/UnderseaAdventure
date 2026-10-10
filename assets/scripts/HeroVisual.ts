import { _decorator, Animation, Color, Component, Node, sp, Sprite, UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HeroVisual')
export class HeroVisual extends Component {
    @property({ tooltip: '待机图片中心到身体轴的校准：原示例 Idle.x / 2' })
    idleOffsetX = 23.33;

    @property({ tooltip: '走路图片中心到身体轴的校准：原示例 Move.x / 2' })
    walkOffsetX = 25.7585;

    @property({ tooltip: '走路图片相对待机图片的高度差' })
    walkOffsetY = 9.41;

    @property({ tooltip: '攻击图片中心到身体轴的校准：原示例 Attack.x / 2' })
    attackOffsetX = 23.33;

    @property({ tooltip: '攻击图片相对待机图片的高度差' })
    attackOffsetY = 8.831;

    private idleOffsetY = 0;
    private pictureScale = 1;
    private skeleton: sp.Skeleton | null = null;
    private spineAction = '';

    private pivot: Node | null = null;
    private picture: Node | null = null;
    private renderer: Sprite | null = null;
    private animator: Animation | null = null;
    private direction = 1;
    private frameAction = '';
    private usesFrameTransforms = false;
    private singleSpineTrack = false;

    get facing(): number { return this.direction; }
    get displaySprite(): Sprite | null { return this.renderer; }
    get animationComponent(): Animation | null { return this.animator; }
    get usesSpine(): boolean { return !!this.skeleton?.node.active; }
    get spineAttackDuration(): number { return this.skeleton?.findAnimation('Attack')?.duration ?? 0; }

    configureFrame(offsets: number[][], scale: number, usesFrameTransforms = false): void {
        [this.idleOffsetX, this.idleOffsetY] = offsets[0];
        [this.walkOffsetX, this.walkOffsetY] = offsets[1];
        [this.attackOffsetX, this.attackOffsetY] = offsets[2];
        this.pictureScale = scale;
        this.usesFrameTransforms = usesFrameTransforms;
        if (this.skeleton) { this.skeleton.clearTracks(); this.skeleton.node.active = false; }
        if (this.picture) this.picture.active = true;
        this.spineAction = '';
        this.frameAction = '';
        this.picture?.setPosition(this.idleOffsetX, this.idleOffsetY, 0);
        this.picture?.setScale(scale, scale, 1);
        this.align('idle');
    }

    configureSpine(data: sp.SkeletonData, settings?: { x: number; y: number; scale: number; singleTrack?: boolean }): void {
        this.skeleton = this.pivot?.getChildByName('Spine')?.getComponent(sp.Skeleton) ?? null;
        if (!this.skeleton || !this.picture) return;
        this.animator?.stop();
        this.picture.active = false;
        this.idleOffsetX = this.walkOffsetX = this.walkOffsetY = 0;
        this.skeleton.skeletonData = data;
        this.singleSpineTrack = !!settings?.singleTrack;
        if (settings) {
            this.skeleton.node.setPosition(settings.x, settings.y, 0);
            this.skeleton.node.setScale(settings.scale, settings.scale, 1);
            for (const from of ['Idle', 'Move', 'Attack']) for (const to of ['Idle', 'Move', 'Attack']) {
                if (from !== to) this.skeleton.setMix(from, to, to === 'Attack' ? .035 : .09);
            }
        }
        this.skeleton.premultipliedAlpha = false;
        this.skeleton.paused = false;
        this.skeleton.node.active = true;
        this.spineAction = '';
        this.align('idle');
    }

    finishSpineAttack(): void { if (!this.singleSpineTrack) this.skeleton?.clearTrack(1); }

    setTint(color: Color): void {
        if (this.renderer) this.renderer.color = color;
        if (this.skeleton) this.skeleton.color = color;
    }

    onLoad(): void {
        if (this.pivot?.isValid) return;
        const existing = this.node.getChildByName('Visual');
        const authoredPicture = existing?.getChildByName('Sprite');
        if (existing && authoredPicture?.getComponent(Sprite) && authoredPicture.getComponent(Animation)) {
            this.pivot = existing;
            this.picture = authoredPicture;
            this.renderer = authoredPicture.getComponent(Sprite);
            this.animator = authoredPicture.getComponent(Animation);
            this.direction = existing.scale.x < 0 ? -1 : 1;
            this.node.setScale(Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
            this.setFacing(this.direction);
            this.align('idle');
            return;
        }
        const sourceSprite = this.getComponent(Sprite);
        const sourceAnimation = this.getComponent(Animation);
        this.direction = this.node.scale.x < 0 ? -1 : 1;
        // Hero 是身体中心和物理坐标，始终保持正缩放。
        this.node.setScale(Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        const pivot = new Node('Visual');
        pivot.active = false;
        pivot.layer = this.node.layer;
        this.node.addChild(pivot);
        pivot.addComponent(UITransform);
        const picture = new Node('Sprite');
        picture.layer = this.node.layer;
        pivot.addChild(picture);
        picture.addComponent(UITransform);
        const sprite = picture.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.RAW;
        sprite.trim = false;
        if (sourceSprite) {
            sprite.spriteFrame = sourceSprite.spriteFrame;
            sprite.color = sourceSprite.color.clone();
            sprite.customMaterial = sourceSprite.customMaterial;
            sourceSprite.enabled = false;
        }
        const animation = picture.addComponent(Animation);
        if (sourceAnimation) {
            animation.clips = sourceAnimation.clips;
            animation.defaultClip = sourceAnimation.defaultClip;
            animation.playOnLoad = sourceAnimation.playOnLoad;
            sourceAnimation.stop();
            sourceAnimation.enabled = false;
        }
        this.pivot = pivot;
        this.picture = picture;
        this.renderer = sprite;
        this.animator = animation;
        this.setFacing(this.direction);
        this.align('idle');
        pivot.active = true;
    }

    setFacing(direction: number): void {
        this.direction = direction < 0 ? -1 : 1;
        this.pivot?.setScale(this.direction, 1, 1);
    }

    align(state: 'idle' | 'walk' | 'attack'): void {
        if (this.usesSpine) {
            if (state === this.spineAction) return;
            this.spineAction = state;
            const name = state === 'walk' ? 'Move' : state === 'attack' ? 'Attack' : 'Idle';
            // 原最终形态：Idle/Move 在轨道 0，Attack 在轨道 1 叠加。
            this.skeleton!.setAnimation(state === 'attack' && !this.singleSpineTrack ? 1 : 0, name, state !== 'attack');
            return;
        }
        if (!this.picture) return;
        // 图片动画包含逐帧位置校准，不能在移动更新中反复覆盖动画的变换。
        if (this.frameAction === state) return;
        this.frameAction = state;
        if (this.usesFrameTransforms) return;
        const x = state === 'walk' ? this.walkOffsetX : state === 'attack' ? this.attackOffsetX : this.idleOffsetX;
        const y = state === 'walk' ? this.walkOffsetY : state === 'attack' ? this.attackOffsetY : this.idleOffsetY;
        this.picture.setPosition(x, y, 0);
        this.picture.setScale(this.pictureScale, this.pictureScale, 1);
    }

    stopAnimation(): void {
        this.animator?.stop();
        if (this.skeleton) { this.skeleton.clearTracks(); this.skeleton.paused = true; }
    }
}
