import { _decorator, Animation, AnimationClip, AnimationState, Component, instantiate, Node, Prefab, Sprite, SpriteFrame, UIOpacity, UITransform, Vec4 } from 'cc';
import { CircleBody2D } from './CircleBody2D';
import { EnemyController } from './EnemyController';
import { BossController } from './BossController';
import { HeroHealth } from './HeroHealth';
import { HeroVisual } from './HeroVisual';
import { CoinSystem } from './CoinSystem';
import { MagicLampSystem } from './MagicLampSystem';
import { SoundEffects } from './SoundEffects';
import { playSpriteClip } from './SpriteTransition';

const { ccclass, property, requireComponent } = _decorator;

@ccclass('HeroController')
@requireComponent(CircleBody2D)
export class HeroController extends Component {
    @property({ type: AnimationClip, tooltip: '把 HeroWalk 动画文件拖到这里；待机使用 Animation 的 Default Clip' })
    walkClip: AnimationClip | null = null;

    @property({ tooltip: '待机与移动共用游泳循环，攻击在循环末帧接入' })
    swimActions = false;

    @property({ type: AnimationClip, tooltip: '把 HeroAttack 动画文件拖到这里；攻击片段使用 Normal，播放一次' })
    attackClip: AnimationClip | null = null;

    @property({ type: AnimationClip, tooltip: '挥砍白色剑弧：HeroSlash.anim，与人物攻击动画分开播放' })
    slashClip: AnimationClip | null = null;

    @property({ type: Prefab, tooltip: '可在编辑器中修改的挥砍特效模板' })
    slashPrefab: Prefab | null = null;

    @property(SpriteFrame) themeSlashFrame: SpriteFrame | null = null;
    @property(Vec4) themeSlashBounds = new Vec4(0, 0, 1, 1);
    @property({ tooltip: '剑弧显示倍率，独立于伤害判定范围' }) themeSlashScale = 1.35;

    @property({ tooltip: '攻击矩形的宽度；原示例 200 按当前角色显示比例换算为 100' })
    attackRange = 100;

    @property({ tooltip: '攻击矩形的高度；原示例 200 按当前角色显示比例换算为 100' })
    attackHeight = 100;

    @property({ tooltip: '攻击区域中心向人物正面的偏移，左右翻转时自动镜像' })
    attackOffsetX = 40.287;

    @property({ tooltip: '攻击区域中心相对人物图片中心的上下偏移' })
    attackOffsetY = -2.1935;

    @property({ tooltip: '松开摇杆时朝最近敌人转向的距离；原示例 300 换算为 150' })
    autoTargetRange = 150;

    @property({ tooltip: '一次挥剑最多伤害的敌人数量；与原示例一致为 100' })
    attackMaxTargets = 100;

    @property({ tooltip: '每次命中扣除的血量' })
    attackDamage = 1;

    @property({ tooltip: '两次攻击开始之间至少间隔的秒数' })
    attackInterval = 1;

    @property
    attackSound = 'player-attack-1';

    @property
    attackSoundDelay = 0;

    @property
    attackSoundVolume = 1;

    @property({ tooltip: '挥剑开始后判定伤害的时间；原示例第一形态在第 11 张附近命中，约 0.333 秒' })
    hitTime = 1 / 3;

    @property({ type: Node, tooltip: '包含 Ground 和 Hero 的 World 节点，位置 0、缩放 1、旋转 0' })
    world: Node | null = null;

    @property({ type: Node, tooltip: 'World 下的 Ground 节点；根据它的尺寸限制移动' })
    ground: Node | null = null;

    @property({ tooltip: '限制人物出地图时使用的固定宽度，不改变图片显示大小' })
    bodyWidth = 144;

    @property({ tooltip: '限制人物出地图时使用的固定高度，不改变图片显示大小' })
    bodyHeight = 112;

    private animation: Animation | null = null;
    private currentClip: AnimationClip | null = null;
    private visual: HeroVisual | null = null;
    private body: CircleBody2D | null = null;
    private movementRequested = false;
    private attacking = false;
    private attackElapsed = 0;
    private attackDuration = 0;
    private attackCooldown = 0;
    private hitApplied = false;
    private attackSoundPlayed = false;
    private slashNode: Node | null = null;
    private slashAnimation: Animation | null = null;
    private health: HeroHealth | null = null;
    private slashOffsetX = 44.5875;
    private slashOffsetY = .915;
    private slashScaleX = 1.5;
    private slashScaleY = -1.5;

    applyEvolution(idle: AnimationClip | null, walk: AnimationClip | null, attack: AnimationClip | null,
        settings: { damage: number; width: number; height: number; x: number; y: number; hitProgress: number;
            bodyWidth: number; bodyHeight: number; slash: number[] }, slash: AnimationClip | null): void {
        this.animation?.stop();
        this.attacking = false;
        this.currentClip = null;
        this.attackCooldown = 0;
        this.hideSlash();
        if (this.animation && idle) {
            for (const clip of [idle, walk, attack]) if (clip && !this.animation.getState(clip.name)) this.animation.addClip(clip);
            this.animation.defaultClip = idle;
        }
        this.walkClip = walk;
        this.attackClip = attack;
        this.slashClip = slash;
        this.attackDamage = settings.damage;
        this.attackRange = settings.width;
        this.attackHeight = settings.height;
        this.attackOffsetX = settings.x - (this.visual?.idleOffsetX ?? 0);
        this.attackOffsetY = settings.y;
        const duration = this.visual?.usesSpine ? this.visual.spineAttackDuration : (attack?.duration ?? 0) / Math.max(.0001, attack?.speed ?? 1);
        this.hitTime = duration * settings.hitProgress;
        this.bodyWidth = settings.bodyWidth;
        this.bodyHeight = settings.bodyHeight;
        [this.slashOffsetX, this.slashOffsetY, this.slashScaleX, this.slashScaleY] = settings.slash;
        this.playMovementAnimation(this.movementRequested);
    }

    onLoad(): void {
        this.visual = this.getComponent(HeroVisual) ?? this.addComponent(HeroVisual);
        this.visual.onLoad(); // 已保存的 Visual 也可在组件初始化顺序较早时安全绑定。
        this.animation = this.visual.animationComponent;
        // 已有场景无需重挂控制器；运行时为尚未添加碰撞组件的角色补上。
        this.body = this.getComponent(CircleBody2D) ?? this.addComponent(CircleBody2D);
        this.health = this.getComponent(HeroHealth) ?? this.addComponent(HeroHealth);
        this.node.on(HeroHealth.DIED, this.onDied, this);
    }

    start(): void {
        // 新场景已保存系统组件；这里兼容旧 Main.scene，缺少时才补齐。
        this.world ??= this.node.parent;
        this.ground ??= this.world?.getChildByName('Ground') ?? null;
        if (!this.world || !this.ground) return;
        const coins = this.world.getComponent(CoinSystem) ?? this.world.addComponent(CoinSystem);
        coins.hero ??= this.node;
        this.world.getComponent(MagicLampSystem) ?? this.world.addComponent(MagicLampSystem);
    }

    // 摇杆每帧调用这里；direction 是方向，distance 是本帧应移动的距离。
    move(directionX: number, directionY: number, distance: number): void {
        if (!this.health?.isAlive) return;
        this.movementRequested = Math.hypot(directionX, directionY) > 0.001;
        // 攻击期间仍允许移动；下方动画切换会保留当前挥击，收招后恢复奔跑。
        const position = this.node.position;
        let x = position.x + directionX * Math.max(0, distance);
        let y = position.y + directionY * Math.max(0, distance);
        const bounds = this.getMovementBounds();
        if (bounds) {
            x = this.clamp(x, bounds.left, bounds.right);
            y = this.clamp(y, bounds.bottom, bounds.top);
        }
        // 先限制地图边界，再在这段移动路径上检查骷髅。
        if (this.body) this.body.moveTo(x, y);
        else this.node.setPosition(x, y, position.z);

        // 围绕身体轴翻转显示层，Hero 的坐标与缩放保持不变。
        // 只沿上下移动时，保留最近一次的左右朝向。
        this.faceDirection(directionX);

        // 走路动画代表移动意图：被挡住时仍走路，松开摇杆才待机。
        this.playMovementAnimation(this.movementRequested);
    }

    stopMoving(): void {
        this.movementRequested = false;
        if (!this.health?.isAlive) return;
        this.playMovementAnimation(false);
    }

    update(deltaTime: number): void {
        if (!this.health?.isAlive) return;
        const elapsed = Math.max(0, deltaTime);
        this.attackCooldown = Math.max(0, this.attackCooldown - elapsed);
        // 有摇杆输入时，朝向由 move 决定；上下移动保留左右朝向。
        // 松开时才自动朝最近敌人转向，攻击期间也遵守这项优先级。
        if (!this.attacking && !this.movementRequested) {
            const target = this.findAutoTarget();
            if (target) this.faceDirection(target.node.position.x - this.node.position.x);
        }
        if (this.attacking) {
            this.attackElapsed += elapsed;
            this.playAttackSound();
            this.syncSlash();
            // 只在命中时刻扫描当前正面的区域，一剑可伤害多个敌人。
            if (!this.hitApplied && this.attackElapsed >= Math.min(Math.max(0, this.hitTime), this.attackDuration)) {
                this.hitApplied = true;
                const limit = Math.max(0, Math.floor(this.attackMaxTargets));
                for (const enemy of this.getAttackTargets().slice(0, limit)) enemy.takeDamage(this.attackDamage);
            }
            if (this.attackElapsed >= this.attackDuration) this.finishAttack();
            return;
        }

        if (this.attackCooldown > 0 || (!this.visual?.usesSpine && (!this.attackClip || !this.animation?.enabledInHierarchy))) return;
        if (this.attackMaxTargets >= 1 && this.getAttackTargets().length > 0) this.startAttack();
    }

    onDisable(): void {
        if (this.attacking && this.attackClip) this.animation?.getState(this.attackClip.name)?.stop();
        this.attacking = false;
        this.currentClip = null;
        this.movementRequested = false;
        this.attackCooldown = 0;
        this.hideSlash();
    }

    onDestroy(): void {
        this.node.off(HeroHealth.DIED, this.onDied, this);
        this.slashAnimation?.off(Animation.EventType.FINISHED, this.onSlashFinished, this);
        if (this.slashNode?.isValid) this.slashNode.destroy();
    }

    lateUpdate(): void {
        this.keepInsideMap();
        const bounds = this.getMapBounds();
        const viewport = this.world?.parent?.getComponent(UITransform);
        if (!this.world || !bounds || !viewport) return;

        // 地图中间跟随 Hero；接近边缘时限制视野中心，停止滚动。
        // Canvas 尺寸会随屏幕适配变化，因此每帧重新计算视野大小。
        const halfViewWidth = viewport.width / (2 * Math.max(0.0001, Math.abs(this.world.scale.x)));
        const halfViewHeight = viewport.height / (2 * Math.max(0.0001, Math.abs(this.world.scale.y)));
        const position = this.node.position;
        const viewX = this.clamp(position.x, bounds.left + halfViewWidth, bounds.right - halfViewWidth);
        const viewY = this.clamp(position.y, bounds.bottom + halfViewHeight, bounds.top - halfViewHeight);
        this.world.setPosition(
            -viewX * this.world.scale.x,
            -viewY * this.world.scale.y,
            this.world.position.z,
        );
    }

    private playMovementAnimation(moving: boolean): void {
        if (!this.health?.isAlive) return;
        // 摇杆每帧都会调用移动，攻击期间不能让它覆盖挥剑动画。
        if (this.attacking) return;
        if (this.visual?.usesSpine) { this.visual.align(moving ? 'walk' : 'idle'); return; }
        if (!this.animation || !this.animation.enabledInHierarchy) return;
        const idleClip = this.animation.defaultClip;
        const clip = moving ? this.walkClip ?? idleClip : idleClip;
        if (!clip) return;

        const state = this.animation.getState(clip.name);
        // 不能每一帧都 play，否则动画会不断被重置到第一帧。
        if (this.currentClip === clip && state?.isPlaying) return;
        if (!state) this.animation.addClip(clip);
        this.visual?.align(moving && this.walkClip ? 'walk' : 'idle');
        playSpriteClip(this.animation, clip);
        this.currentClip = clip;
    }

    private onDied(): void {
        this.attacking = false;
        this.movementRequested = false;
        this.currentClip = null;
        this.animation?.stop();
        this.visual?.stopAnimation();
        this.hideSlash();
    }

    private findAutoTarget(): EnemyController | BossController | null {
        let target: EnemyController | BossController | null = null;
        let nearestDistance = Math.max(0, this.autoTargetRange);
        for (const node of this.node.parent?.children ?? []) {
            const enemy = node.getComponent(EnemyController) ?? node.getComponent(BossController);
            if (!enemy?.isAlive) continue;
            const distance = Math.hypot(node.position.x - this.node.position.x, node.position.y - this.node.position.y);
            if (distance <= nearestDistance) {
                target = enemy;
                nearestDistance = distance;
            }
        }
        return target;
    }

    private getAttackTargets(): (EnemyController | BossController)[] {
        if (this.attackRange <= 0 || this.attackHeight <= 0) return [];
        const facing = this.visual?.facing ?? 1;
        const scaleX = Math.abs(this.node.scale.x);
        const scaleY = Math.abs(this.node.scale.y);
        // 已保存的攻击偏移以旧待机图片中心为原点，换算到身体轴。
        const centerX = this.node.position.x + facing * (this.attackOffsetX + (this.visual?.idleOffsetX ?? 0)) * scaleX;
        const centerY = this.node.position.y + this.attackOffsetY * scaleY;
        const halfWidth = this.attackRange * scaleX / 2;
        const halfHeight = this.attackHeight * scaleY / 2;
        const targets: (EnemyController | BossController)[] = [];
        for (const node of this.node.parent?.children ?? []) {
            const enemy = node.getComponent(EnemyController) ?? node.getComponent(BossController);
            if (!enemy?.isAlive) continue;
            const hurt = enemy.getHurtBounds();
            if (hurt.right >= centerX - halfWidth && hurt.left <= centerX + halfWidth
                && hurt.top >= centerY - halfHeight && hurt.bottom <= centerY + halfHeight) targets.push(enemy);
        }
        targets.sort((a, b) => this.distanceSquared(a.node) - this.distanceSquared(b.node));
        return targets;
    }

    private distanceSquared(node: Node): number {
        const dx = node.position.x - this.node.position.x;
        const dy = node.position.y - this.node.position.y;
        return dx * dx + dy * dy;
    }

    private faceDirection(dx: number): void {
        if (Math.abs(dx) <= 0.001) return;
        this.visual?.setFacing(dx > 0 ? 1 : -1);
    }

    private startAttack(): void {
        const clip = this.attackClip;
        if (!this.visual?.usesSpine && (!clip || !this.animation)) return;
        if (this.swimActions && this.animation && !this.visual?.usesSpine) {
            const swim = this.animation.defaultClip;
            const state = swim ? this.animation.getState(swim.name) : null;
            if (state?.isPlaying && swim && swim.duration > 0) {
                // 立即取游泳末帧作为过渡起点，避免等待整段循环造成出刀延迟。
                state.time = Math.max(0, swim.duration - 1 / Math.max(1, swim.sample));
                state.sample();
            }
        }
        this.attacking = true;
        this.attackElapsed = 0;
        this.hitApplied = false;
        this.attackSoundPlayed = false;
        // clip.speed 会影响播放速度，结束计时也要使用相同速度。
        this.attackDuration = this.visual?.usesSpine ? this.visual.spineAttackDuration : clip!.duration / Math.max(0.0001, clip!.speed);
        // 游泳出刀的收刀时间已包含在动画中，不再追加旧的一秒攻击间隔。
        this.attackCooldown = this.swimActions
            ? this.attackDuration
            : Math.max(this.attackDuration, Math.max(0, this.attackInterval));
        if (clip && this.animation && !this.visual?.usesSpine) {
            if (!this.animation.getState(clip.name)) this.animation.addClip(clip);
            this.visual?.align('attack');
            playSpriteClip(this.animation, clip);
        }
        if (this.visual?.usesSpine) this.visual.align('attack');
        this.currentClip = clip;
        this.playSlash();
        this.playAttackSound();
    }

    private playAttackSound(): void {
        if (this.attackSoundPlayed || this.attackElapsed < Math.max(0, this.attackSoundDelay)) return;
        this.attackSoundPlayed = true;
        SoundEffects.play(this.attackSound, this.attackSoundVolume);
    }

    private finishAttack(): void {
        this.attacking = false;
        this.visual?.finishSpineAttack();
        this.hideSlash();
        // 挥剑结束立即恢复正确的移动状态，不在最后一张图片上停留。
        this.currentClip = null;
        this.playMovementAnimation(this.movementRequested);
    }

    private playSlash(): void {
        const clip = this.slashClip;
        if (!this.themeSlashFrame && (!clip || clip.duration <= 0)) return;
        if (!this.slashNode) {
            // 特效和角色放在同一世界层，保持在敌人上方显示，不重置人物动画。
            const node = this.slashPrefab ? instantiate(this.slashPrefab) : new Node('SlashEffect');
            node.active = false;
            node.layer = this.node.layer;
            this.node.parent?.addChild(node);
            node.getComponent(UITransform) ?? node.addComponent(UITransform);
            const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.RAW;
            sprite.trim = false;
            // 原示例特效 (89.175,86.217)、缩放 (3,-3)，按当前图片中心和比例换算。
            this.slashNode = node;
            this.slashAnimation = node.getComponent(Animation) ?? node.addComponent(Animation);
            this.slashAnimation.on(Animation.EventType.FINISHED, this.onSlashFinished, this);
        }
        const animation = this.slashAnimation!;
        if (this.themeSlashFrame) {
            animation.stop();
            const sprite = this.slashNode.getComponent(Sprite)!;
            sprite.spriteFrame = this.themeSlashFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            this.slashNode.active = true;
            this.syncSlash();
            return;
        }
        this.slashNode.getComponent(Sprite)!.spriteFrame = null;
        this.slashNode.active = true;
        this.syncSlash();
        if (!animation.getState(clip.name)) animation.addClip(clip);
        const state = animation.getState(clip.name)!;
        state.wrapMode = AnimationClip.WrapMode.Normal;
        // 挥砍特效随完整攻击时长伸缩，放慢角色动作时避免特效提前结束。
        state.speed = clip.duration / Math.max(0.0001, this.attackDuration);
        animation.play(clip.name);
    }

    private onSlashFinished(_type: string, state: AnimationState): void {
        if (state.name === this.slashClip?.name) this.hideSlash();
    }

    private hideSlash(): void {
        this.slashAnimation?.stop();
        if (this.slashNode) this.slashNode.active = false;
    }

    private syncSlash(): void {
        const node = this.slashNode;
        if (!node?.isValid || !node.active || !this.node.parent) return;
        if (node.parent !== this.node.parent) node.setParent(this.node.parent);
        const position = this.node.position;
        const scale = this.node.scale;
        const facing = this.visual?.facing ?? 1;
        if (this.themeSlashFrame) {
            const size = this.themeSlashFrame.originalSize, bounds = this.themeSlashBounds;
            const ui = node.getComponent(UITransform)!;
            ui.setAnchorPoint((bounds.x + bounds.z / 2) / size.width,
                1 - (bounds.y + bounds.w / 2) / size.height);
            ui.setContentSize(this.attackRange * Math.max(.1, this.themeSlashScale) * size.width / Math.max(1, bounds.z),
                this.attackHeight * Math.max(.1, this.themeSlashScale) * size.height / Math.max(1, bounds.w));
            const phase = this.attackElapsed / Math.max(.001, this.attackDuration);
            const pulse = phase <= .2 || phase >= .8 ? 0 : Math.sin((phase - .2) / .6 * Math.PI);
            node.setPosition(position.x + facing * (this.attackOffsetX + (this.visual?.idleOffsetX ?? 0)) * Math.abs(scale.x),
                position.y + this.attackOffsetY * Math.abs(scale.y), position.z);
            node.setScale(facing * Math.abs(scale.x) * (.75 + .25 * pulse), Math.abs(scale.y) * (.75 + .25 * pulse), 1);
            (node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity)).opacity = Math.round(255 * pulse);
            node.setSiblingIndex(node.parent!.children.length - 1);
            return;
        }
        node.setPosition(position.x + facing * this.slashOffsetX * scale.x,
            position.y + this.slashOffsetY * scale.y, position.z);
        node.setScale(this.slashScaleX * facing * scale.x, this.slashScaleY * scale.y, 1);
        node.setSiblingIndex(node.parent!.children.length - 1);
    }

    private keepInsideMap(): void {
        const bounds = this.getMovementBounds();
        if (!bounds) return;

        const position = this.node.position;
        this.node.setPosition(
            this.clamp(position.x, bounds.left, bounds.right),
            this.clamp(position.y, bounds.bottom, bounds.top),
            position.z,
        );
    }

    private getMovementBounds(): { left: number; right: number; bottom: number; top: number } | null {
        const bounds = this.getMapBounds();
        if (!bounds) return null;
        // RAW 模式切换动画时会改变 UITransform 尺寸。
        // 移动边界使用固定身体尺寸，避免待机/走路反复改变可移动范围。
        const radius = this.body?.worldRadius ?? 0;
        const imageOffsetX = Math.max(Math.abs(this.visual?.idleOffsetX ?? 0), Math.abs(this.visual?.walkOffsetX ?? 0));
        const imageOffsetY = Math.abs(this.visual?.walkOffsetY ?? 0);
        const heroHalfWidth = Math.max(radius, (Math.max(0, this.bodyWidth) / 2 + imageOffsetX) * Math.abs(this.node.scale.x));
        const heroHalfHeight = Math.max(radius, (Math.max(0, this.bodyHeight) / 2 + imageOffsetY) * Math.abs(this.node.scale.y));

        // 人物可以走到地图边缘，但整个图片仍需留在地图内。
        // 当前 Hero 的锚点为 (0.5, 0.5)。人物边界不再依赖视野大小。
        return {
            left: bounds.left + heroHalfWidth,
            right: bounds.right - heroHalfWidth,
            bottom: bounds.bottom + heroHalfHeight,
            top: bounds.top - heroHalfHeight,
        };
    }

    private getMapBounds(): { left: number; right: number; bottom: number; top: number } | null {
        if (!this.world || !this.ground || this.node.parent !== this.world || this.ground.parent !== this.world) return null;
        const transform = this.ground.getComponent(UITransform);
        if (!transform) return null;

        // 当前学习场景各节点不旋转，World/Ground 缩放为正数。
        // 地图边界、主角坐标都使用 World 的本地坐标。
        const width = transform.width * Math.abs(this.ground.scale.x);
        const height = transform.height * Math.abs(this.ground.scale.y);
        const left = this.ground.position.x - width * transform.anchorX;
        const bottom = this.ground.position.y - height * transform.anchorY;
        return { left, right: left + width, bottom, top: bottom + height };
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        // 地图比视野还小时只能居中，不能同时保证整个屏幕都被地图覆盖。
        if (minimum > maximum) return (minimum + maximum) / 2;
        return Math.max(minimum, Math.min(maximum, value));
    }
}
