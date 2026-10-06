import { _decorator, Animation, AnimationClip, Component, Node, Sprite, UIOpacity, UITransform } from 'cc';

const { ccclass } = _decorator;

/** 仅在动作切换时交接两张图片，普通动画帧保持清晰，不逐帧重启。 */
@ccclass('SpriteTransition')
export class SpriteTransition extends Component {
    private ghost: Node | null = null;
    private elapsed = 0;
    private blending = false;
    private readonly duration = .075;

    play(animation: Animation, clip: AnimationClip): void {
        const sprite = this.getComponent(Sprite);
        const transform = this.getComponent(UITransform);
        if (!sprite || !transform || !this.node.parent) { animation.play(clip.name); return; }
        if (!this.ghost) {
            this.ghost = new Node('ActionTransition');
            this.ghost.layer = this.node.layer;
            this.node.parent.addChild(this.ghost);
            this.ghost.addComponent(UITransform);
            this.ghost.addComponent(Sprite);
            this.ghost.addComponent(UIOpacity);
        }
        const ghost = this.ghost;
        ghost.setPosition(this.node.position);
        ghost.setScale(this.node.scale);
        ghost.setRotation(this.node.rotation);
        ghost.setSiblingIndex(this.node.getSiblingIndex() + 1);
        const old = ghost.getComponent(Sprite)!;
        old.sizeMode = Sprite.SizeMode.CUSTOM;
        old.trim = false;
        old.spriteFrame = sprite.spriteFrame;
        old.color = sprite.color;
        ghost.getComponent(UITransform)!.setContentSize(transform.contentSize);
        ghost.getComponent(UIOpacity)!.opacity = 255;
        ghost.active = !!sprite.spriteFrame;
        this.elapsed = 0;
        this.blending = ghost.active;
        (this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity)).opacity = this.blending ? 0 : 255;
        animation.play(clip.name);
        // 同一帧应用新动作的画布、缩放和位置，避免沿用上一动作的末帧变换。
        animation.getState(clip.name)?.sample();
    }

    update(dt: number): void {
        if (!this.blending) return;
        this.elapsed += Math.max(0, dt);
        const t = Math.min(1, this.elapsed / this.duration);
        this.getComponent(UIOpacity)!.opacity = Math.round(t * 255);
        if (this.ghost) this.ghost.getComponent(UIOpacity)!.opacity = Math.round((1 - t) * 255);
        if (t >= 1) { this.blending = false; if (this.ghost) this.ghost.active = false; }
    }

    stopBlend(): void {
        this.blending = false;
        if (this.ghost) this.ghost.active = false;
        const opacity = this.getComponent(UIOpacity);
        if (opacity) opacity.opacity = 255;
    }

    onDisable(): void { this.stopBlend(); }

    onDestroy(): void { if (this.ghost?.isValid) this.ghost.destroy(); }
}

export function playSpriteClip(animation: Animation, clip: AnimationClip, blend = true): void {
    if (!blend) {
        animation.getComponent(SpriteTransition)?.stopBlend();
        animation.play(clip.name);
        animation.getState(clip.name)?.sample();
        return;
    }
    const transition = animation.getComponent(SpriteTransition) ?? animation.addComponent(SpriteTransition);
    transition.play(animation, clip);
}
