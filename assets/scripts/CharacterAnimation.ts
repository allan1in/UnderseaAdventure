import { _decorator, Animation, AnimationClip, Component } from 'cc';
import { playSpriteClip } from './SpriteTransition';

const { ccclass, property } = _decorator;
type Action = 'idle' | 'move' | 'attack' | 'death';

/** 图片动画只作用于 Sprite，身体、血条和跟随坐标保持独立。 */
@ccclass('CharacterAnimation')
export class CharacterAnimation extends Component {
    @property(Animation) animation: Animation | null = null;
    @property(AnimationClip) idleClip: AnimationClip | null = null;
    @property(AnimationClip) moveClip: AnimationClip | null = null;
    @property(AnimationClip) attackClip: AnimationClip | null = null;
    @property({ tooltip: '动作切换时交接旧帧；Boss 关闭，避免出现第二张身体图片' })
    blendActions = true;
    private current: AnimationClip | null = null;
    private moving = false;
    private attackRemaining = 0;
    private dead = false;

    get isAttacking(): boolean { return !this.dead && this.attackRemaining > 0; }

    start(): void { if (!this.current && !this.dead) this.setMoving(false); }

    duration(action: Action): number {
        const clip = this.clip(action);
        return clip ? clip.duration / Math.max(.0001, clip.speed) : 0;
    }

    setMoving(moving: boolean): void {
        this.moving = moving;
        if (!this.dead && this.attackRemaining <= 0) this.play(moving ? 'move' : 'idle');
    }

    show(action: Action, restart = false): void {
        if (action === 'death') {
            this.dead = true;
            this.attackRemaining = 0;
            this.animation?.stop();
            return;
        }
        this.dead = false;
        if (action === 'attack') this.attackRemaining = this.duration(action);
        else { this.attackRemaining = 0; this.moving = action === 'move'; }
        this.play(action, restart);
    }

    update(dt: number): void {
        if (this.dead || this.attackRemaining <= 0) return;
        this.attackRemaining = Math.max(0, this.attackRemaining - Math.max(0, dt));
        if (!this.attackRemaining) this.play(this.moving ? 'move' : 'idle');
    }

    private clip(action: Action): AnimationClip | null {
        return action === 'idle' ? this.idleClip : action === 'move' ? this.moveClip
            : action === 'attack' ? this.attackClip : null;
    }

    private play(action: Action, restart = false): void {
        const clip = this.clip(action), animation = this.animation;
        if (!clip || !animation?.enabledInHierarchy) return;
        const state = animation.getState(clip.name);
        if (!restart && this.current === clip && state?.isPlaying) return;
        if (!state) animation.addClip(clip);
        this.current = clip;
        playSpriteClip(animation, clip, this.blendActions);
    }

    onDisable(): void {
        this.animation?.stop();
        this.current = null;
        this.attackRemaining = 0;
    }
}
