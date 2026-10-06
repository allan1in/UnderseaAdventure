import { _decorator, Animation, AnimationClip, AnimationState, Color, Component, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { CircleBody2D } from './CircleBody2D';
import { HeroHealth } from './HeroHealth';
import { CoinSystem } from './CoinSystem';
import { SoundEffects } from './SoundEffects';
import { playSpriteClip } from './SpriteTransition';

const { ccclass, property, requireComponent } = _decorator;

@ccclass('EnemyController')
@requireComponent(Animation)
@requireComponent(CircleBody2D)
export class EnemyController extends Component {
    @property({ type: Node, tooltip: '预制体中可留空，生成器自动关联 Hero；手动放进场景的 Enemy 需要拖入同一 World 下的 Hero' })
    target: Node | null = null;

    @property({ type: AnimationClip, tooltip: '把 SkeletonWalk 动画文件拖到这里' })
    walkClip: AnimationClip | null = null;

    @property(AnimationClip)
    idleClip: AnimationClip | null = null;

    @property({ tooltip: '海底动画使用统一画布，攻击时保持显示尺寸' })
    preserveAttackSize = false;

    @property
    deathVisualSize = 0;

    @property({ type: AnimationClip, tooltip: '把 SkeletonDeath 动画文件拖到这里；死亡时播放一次，结束后移除' })
    deathClip: AnimationClip | null = null;

    @property({ type: AnimationClip, tooltip: '把 SkeletonAttack.anim 拖到这里；近身攻击时播放一次' })
    attackClip: AnimationClip | null = null;

    @property({ tooltip: '攻击图片的显示倍率；原示例攻击缩放 2.6 / 走路缩放 2 = 1.3，不改变碰撞范围' })
    attackVisualScale = 1.3;

    @property({ tooltip: '近身攻击矩形宽度；原示例 100 按学习工程比例换算为 50' })
    attackWidth = 50;

    @property({ tooltip: '近身攻击矩形高度' })
    attackHeight = 50;

    @property({ tooltip: '攻击区域中心向骷髅正面偏移，左右朝向自动镜像' })
    attackOffsetX = 6.952;

    @property({ tooltip: '攻击区域中心的上下偏移' })
    attackOffsetY = -5.1245;

    @property({ tooltip: '每次命中英雄扣除的血量；原示例普通骷髅为 1' })
    attackDamage = 1;

    @property({ tooltip: '两次攻击开始之间至少间隔的秒数' })
    attackInterval = 1;

    @property({ tooltip: '攻击开始后进行命中检查的时间；对应原示例约 60% 动画进度' })
    hitTime = 0.4;

    @property({ tooltip: '敌人每秒移动的距离，先设为 100，比主角慢一些' })
    moveSpeed = 100;

    @property({ tooltip: '与主角中心的距离小于此值时停下，避免完全重叠' })
    stopDistance = 50;

    @property({ tooltip: '敌人初始血量；当前 Enemy.prefab 使用 1，血量归零后播放死亡动画' })
    maxHealth = 3;

    @property({ tooltip: '受伤矩形宽度；原示例 100 按当前图片比例换算为 50，与移动碰撞半径分开' })
    hurtWidth = 50;

    @property({ tooltip: '受伤矩形高度；原示例 130 按当前图片比例换算为 65' })
    hurtHeight = 65;

    @property({ tooltip: '受击范围相对身体轴的高度偏移' })
    hurtOffsetY = 0;

    private animation: Animation | null = null;
    private sprite: Sprite | null = null;
    private idleFrame: SpriteFrame | null = null;
    private facingScale = 1;
    private moving = false;
    private body: CircleBody2D | null = null;
    private avoidanceSide = 1;
    private health = 0;
    private dead = false;
    private deathFinished = false;
    private damageFlashTimer = 0;
    private originalColor = new Color(255, 255, 255, 255);
    private attacking = false;
    private attackElapsed = 0;
    private attackDuration = 0;
    private attackCooldown = 0;
    private hitApplied = false;
    private attackTarget: HeroHealth | null = null;
    private savedSpriteSizeMode: Sprite['sizeMode'] | null = null;
    private savedSpriteTrim = false;
    private savedContentWidth = 0;
    private savedContentHeight = 0;

    get currentHealth(): number {
        return this.health;
    }

    get isAlive(): boolean {
        return this.health > 0 && this.enabledInHierarchy;
    }

    get isDead(): boolean {
        return this.dead;
    }

    get isReadyToRemove(): boolean {
        return this.dead && this.deathFinished;
    }

    getHurtBounds(): { left: number; right: number; bottom: number; top: number } {
        // 学习工程以图片中心为节点原点，受伤范围固定，不跟随动画画布大小变化。
        const halfWidth = Math.max(0, this.hurtWidth) * Math.abs(this.node.scale.x) / 2;
        const halfHeight = Math.max(0, this.hurtHeight) * Math.abs(this.node.scale.y) / 2;
        const position = this.node.position;
        const centerY = position.y + this.hurtOffsetY * Math.abs(this.node.scale.y);
        return { left: position.x - halfWidth, right: position.x + halfWidth,
            bottom: centerY - halfHeight, top: centerY + halfHeight };
    }

    onLoad(): void {
        const picture = this.node.getChildByName('Visual')?.getChildByName('Sprite') ?? this.node;
        this.animation = picture.getComponent(Animation);
        this.sprite = picture.getComponent(Sprite);
        this.idleFrame = this.sprite?.spriteFrame ?? null;
        this.facingScale = Math.abs(this.node.scale.x);
        this.body = this.getComponent(CircleBody2D) ?? this.addComponent(CircleBody2D);
        this.health = Math.max(1, this.maxHealth);
        this.dead = false;
        this.deathFinished = false;
        this.animation?.on(Animation.EventType.FINISHED, this.onAnimationFinished, this);
        if (this.sprite) this.originalColor = this.sprite.color.clone();
        this.setMoving(false);
    }

    update(deltaTime: number): void {
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer = Math.max(0, this.damageFlashTimer - Math.max(0, deltaTime));
            if (this.damageFlashTimer === 0 && this.sprite) this.sprite.color = this.originalColor;
        }
        if (!this.isAlive) return;
        const elapsed = Math.max(0, deltaTime);
        this.attackCooldown = Math.max(0, this.attackCooldown - elapsed);
        if (this.attacking) {
            this.attackElapsed += elapsed;
            const hitAt = Math.min(Math.max(0, this.hitTime) / Math.max(0.0001, this.attackClip?.speed ?? 1), this.attackDuration);
            if (!this.hitApplied && this.attackElapsed >= hitAt) {
                this.hitApplied = true;
                // 挥击途中英雄可以离开范围；一轮动画只判定一次，不每帧扣血。
                if (this.attackTarget?.isAlive && this.attackTarget.node === this.target
                    && this.isTargetInAttackArea(this.attackTarget)) this.attackTarget.takeDamage(this.attackDamage);
            }
            if (this.attackElapsed >= this.attackDuration) this.cancelAttack();
            return;
        }
        if (!this.target?.isValid || !this.target.activeInHierarchy || this.target.parent !== this.node.parent) {
            this.setMoving(false);
            return;
        }
        const targetHealth = this.target.getComponent(HeroHealth);
        if (targetHealth && !targetHealth.isAlive) {
            this.setMoving(false);
            return;
        }

        // 两者都在 World 下，可以直接用本地坐标相减。
        const position = this.node.position;
        const dx = this.target.position.x - position.x;
        const dy = this.target.position.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.001) {
            const scale = this.node.scale;
            this.node.setScale(dx > 0 ? this.facingScale : -this.facingScale, scale.y, scale.z);
        }
        if (this.attackCooldown <= 0 && targetHealth?.isAlive && this.isTargetInAttackArea(targetHealth)
            && this.attackClip && this.attackClip.duration > 0 && this.attackClip.speed > 0 && this.animation?.enabledInHierarchy) {
            this.startAttack(targetHealth);
            return;
        }
        const targetBody = this.target.getComponent(CircleBody2D);
        const contactDistance = this.body && targetBody ? this.body.contactDistanceAlong(targetBody, dx, dy) : 0;
        const remaining = distance - Math.max(0, this.stopDistance, contactDistance);
        const step = Math.min(Math.max(0, this.moveSpeed) * Math.max(0, deltaTime), remaining);
        if (distance < 0.0001 || step < 0.0001) {
            this.setMoving(false);
            return;
        }

        // 除以 distance 得到长度为 1 的方向，再乘以本帧移动距离。
        // step 不超过剩余距离，避免越过停止位置后反复前后移动。
        const startX = position.x;
        const startY = position.y;
        const x = startX + dx / distance * step;
        const y = startY + dy / distance * step;
        if (this.body) this.body.moveTo(x, y, true);
        else this.node.setPosition(x, y, position.z);

        const actualDistance = Math.hypot(this.node.position.x - startX, this.node.position.y - startY);
        if (this.body && actualDistance < step * 0.05 && remaining > 5) {
            // 正面撞上另一只骷髅时，纯滑动没有侧向分量，主动尝试绕到一侧。
            // 优先保持同一侧，避免每帧左右摇摆；这一侧完全堵住才换侧。
            const sideStep = Math.max(0, step - actualDistance);
            const sideStartX = this.node.position.x;
            const sideStartY = this.node.position.y;
            this.body.moveTo(sideStartX - dy / distance * sideStep * this.avoidanceSide,
                sideStartY + dx / distance * sideStep * this.avoidanceSide, true);
            if (Math.hypot(this.node.position.x - sideStartX, this.node.position.y - sideStartY) < 0.0001) {
                this.avoidanceSide *= -1;
                this.body.moveTo(sideStartX - dy / distance * sideStep * this.avoidanceSide,
                    sideStartY + dx / distance * sideStep * this.avoidanceSide, true);
            }
        }
        if (Math.abs(dx / distance) > 0.001) {
            const scale = this.node.scale;
            this.node.setScale(dx > 0 ? this.facingScale : -this.facingScale, scale.y, scale.z);
        }
        // 仍在追踪就保持走路；只有进入停止距离、失去目标或死亡才待机。
        this.setMoving(true);
    }

    onDisable(): void {
        this.cancelAttack();
        this.setMoving(false);
        if (this.dead) {
            this.animation?.stop();
            this.deathFinished = true;
        }
        this.damageFlashTimer = 0;
        if (this.sprite) this.sprite.color = this.originalColor;
    }

    onDestroy(): void {
        this.animation?.off(Animation.EventType.FINISHED, this.onAnimationFinished, this);
    }

    takeDamage(damage: number): void {
        if (!this.isAlive || !Number.isFinite(damage) || damage <= 0) return;
        this.health = Math.max(0, this.health - damage);
        if (this.health === 0) {
            SoundEffects.play('enemy-death');
            this.dead = true;
            this.cancelAttack();
            this.setMoving(false);
            this.damageFlashTimer = 0;
            if (this.sprite) this.sprite.color = this.originalColor;
            // 死亡后立即退出阻挡和攻击目标，但保留画面直到死亡动画结束。
            if (this.body) this.body.enabled = false;
            if (this.animation?.enabledInHierarchy && this.deathClip && this.deathClip.duration > 0 && this.deathClip.speed > 0) {
                if (this.deathVisualSize > 0) this.sprite?.getComponent(UITransform)?.setContentSize(this.deathVisualSize, this.deathVisualSize);
                if (!this.animation.getState(this.deathClip.name)) this.animation.addClip(this.deathClip);
                const state = this.animation.getState(this.deathClip.name)!;
                state.wrapMode = AnimationClip.WrapMode.Normal;
                this.animation.play(this.deathClip.name);
            } else {
                this.finishDeath();
            }
            return;
        }
        this.damageFlashTimer = 0.12;
        if (this.sprite) this.sprite.color = new Color(255, 100, 100, this.originalColor.a);
    }

    private onAnimationFinished(_type: string, state: AnimationState): void {
        if (this.dead && state.name === this.deathClip?.name) this.finishDeath();
    }

    private finishDeath(): void {
        if (this.deathFinished) return;
        this.deathFinished = true;
        // 在死亡动作结束后掉一枚金币；固定脚底位置不随死亡帧画布改变。
        this.node.parent?.getComponent(CoinSystem)?.dropCoin(this.node.position.x,
            this.node.position.y - 54.5 * Math.abs(this.node.scale.y));
        this.node.active = false;
    }

    private isTargetInAttackArea(target: HeroHealth): boolean {
        if (!target.node.isValid || !target.node.activeInHierarchy || target.node.parent !== this.node.parent
            || this.attackWidth <= 0 || this.attackHeight <= 0) return false;
        const scaleX = Math.abs(this.node.scale.x);
        const scaleY = Math.abs(this.node.scale.y);
        const facing = this.node.scale.x < 0 ? -1 : 1;
        const centerX = this.node.position.x + facing * this.attackOffsetX * scaleX;
        const centerY = this.node.position.y + this.attackOffsetY * scaleY;
        const halfWidth = this.attackWidth * scaleX / 2;
        const halfHeight = this.attackHeight * scaleY / 2;
        const hurt = target.getHurtBounds();
        return hurt.right >= centerX - halfWidth && hurt.left <= centerX + halfWidth
            && hurt.top >= centerY - halfHeight && hurt.bottom <= centerY + halfHeight;
    }

    private startAttack(target: HeroHealth): void {
        const clip = this.attackClip!;
        this.setMoving(false);
        this.attacking = true;
        this.attackTarget = target;
        this.attackElapsed = 0;
        this.hitApplied = false;
        this.attackDuration = clip.duration / clip.speed;
        this.attackCooldown = Math.max(this.attackDuration, Math.max(0, this.attackInterval));
        if (!this.animation!.getState(clip.name)) this.animation!.addClip(clip);
        const state = this.animation!.getState(clip.name)!;
        state.wrapMode = AnimationClip.WrapMode.Normal;
        const transform = this.sprite?.getComponent(UITransform);
        if (this.sprite && transform) {
            this.savedSpriteSizeMode = this.sprite.sizeMode;
            this.savedSpriteTrim = this.sprite.trim;
            this.savedContentWidth = transform.width;
            this.savedContentHeight = transform.height;
            // 只调整精灵的显示尺寸，节点 Scale 保持不变，碰撞和受伤范围也不变。
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.sprite.trim = false;
        }
        playSpriteClip(this.animation!, clip);
        // 立即采样攻击首帧，按它的原始画布大小放大；其余攻击帧画布尺寸一致。
        state.sample();
        const frameSize = this.sprite?.spriteFrame?.originalSize;
        if (this.sprite && transform && frameSize && !this.preserveAttackSize) {
            const visualScale = Math.max(0.01, this.attackVisualScale);
            transform.setContentSize(frameSize.width * visualScale, frameSize.height * visualScale);
        }
    }

    private cancelAttack(): void {
        if (!this.attacking) return;
        if (this.attackClip) this.animation?.getState(this.attackClip.name)?.stop();
        this.attacking = false;
        this.attackTarget = null;
        if (this.sprite && this.savedSpriteSizeMode !== null) {
            this.sprite.trim = this.savedSpriteTrim;
            this.sprite.sizeMode = this.savedSpriteSizeMode;
            if (this.savedSpriteSizeMode === Sprite.SizeMode.CUSTOM) {
                this.sprite.getComponent(UITransform)?.setContentSize(this.savedContentWidth, this.savedContentHeight);
            }
            this.savedSpriteSizeMode = null;
        }
        // 先恢复待机图，下一帧根据距离恢复追踪或开始下一次攻击。
        if (this.sprite) this.sprite.spriteFrame = this.idleFrame;
        if (!this.dead) this.setMoving(false);
    }

    private setMoving(moving: boolean): void {
        if (this.attacking) return;
        if (this.idleClip && !this.dead) {
            const clip = moving ? this.walkClip : this.idleClip;
            if (clip && this.animation?.enabledInHierarchy) {
                const state = this.animation.getState(clip.name);
                if (this.moving !== moving || !state?.isPlaying) {
                    if (!state) this.animation.addClip(clip);
                    playSpriteClip(this.animation, clip);
                }
            }
            this.moving = moving;
            return;
        }
        if (moving) {
            if (this.animation?.enabledInHierarchy && this.walkClip) {
                const state = this.animation.getState(this.walkClip.name);
                // 动画正在播放时继续播放，不要每帧重置到第一张图片。
                if (!this.moving || !state?.isPlaying) {
                    if (!state) this.animation.addClip(this.walkClip);
                    playSpriteClip(this.animation, this.walkClip);
                }
            }
        } else if (this.moving) {
            this.animation?.stop();
            // 待机暂用静态图，走路、攻击、死亡使用各自片段。
            if (this.sprite) this.sprite.spriteFrame = this.idleFrame;
        }
        this.moving = moving;
    }
}
