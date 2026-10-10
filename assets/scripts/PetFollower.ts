import { _decorator, Animation, Component, Node, sp, UITransform, Vec2 } from 'cc';
import { HeroHealth } from './HeroHealth';
import { CircleBody2D } from './CircleBody2D';
import { CharacterAnimation } from './CharacterAnimation';

const { ccclass, property, requireComponent } = _decorator;

@ccclass('PetFollower')
@requireComponent(CircleBody2D)
export class PetFollower extends Component {
    @property(sp.SkeletonData) petSkeleton: sp.SkeletonData | null = null;
    @property skeletonScale = .8;
    @property skeletonOffsetX = -6;
    @property skeletonOffsetY = -8;
    @property skeletonCardSize = 167;
    @property skeletonCardOffsetX = -10;
    @property skeletonCardOffsetY = 7;
    private attackRemaining = 0;
    @property(Node)
    target: Node | null = null;

    @property(Node)
    ground: Node | null = null;

    @property
    moveSpeed = 300;

    @property({ tooltip: '距英雄多近时停止跟随；超过此范围再向英雄靠拢' })
    idleRange = 100;

    @property({ tooltip: '原示例每 0.1 秒检查一次跟随状态' })
    checkInterval = 0.1;

    @property({ tooltip: '身体位置到脚底的偏移，用于前后遮挡排序' })
    footOffsetY = -30.5;

    private skeleton: sp.Skeleton | null = null;
    private visual: Node | null = null;
    private following = false;
    private timer = 0;
    private animationName = '';
    private body: CircleBody2D | null = null;
    private avoidanceSide = 1;

    onLoad(): void {
        this.visual = this.node.getChildByName('Visual');
        this.body = this.getComponent(CircleBody2D);
        if (this.body) { this.body.collisionGroup = 2; this.body.collisionMask = 2; }
        this.skeleton = this.visual?.getChildByName('Spine')?.getComponent(sp.Skeleton) ?? null;
        if (this.petSkeleton && this.visual) {
            const legacy = this.getComponent(CharacterAnimation);
            if (legacy) legacy.enabled = false;
            const picture = this.visual.getChildByName('Sprite');
            picture?.getComponent(Animation)?.stop();
            if (picture) picture.active = false;
            let spine = this.visual.getChildByName('Spine');
            if (!spine) { spine = new Node('Spine'); spine.layer = this.node.layer; this.visual.addChild(spine); spine.addComponent(UITransform); }
            spine.setPosition(this.skeletonOffsetX, this.skeletonOffsetY, 0);
            spine.setScale(this.skeletonScale, this.skeletonScale, 1);
            this.skeleton = spine.getComponent(sp.Skeleton) ?? spine.addComponent(sp.Skeleton);
            this.skeleton.premultipliedAlpha = false;
            this.skeleton.skeletonData = this.petSkeleton;
            this.skeleton.setMix('Idle', 'Move', .08); this.skeleton.setMix('Move', 'Idle', .08);
            this.playAnimation(false);
        }
        // 原贴图是普通 Alpha；透明像素的 RGB 非零，不能按预乘 Alpha 混合。
        if (this.skeleton) this.skeleton.premultipliedAlpha = false;
        this.keepInsideMap();
    }

    update(deltaTime: number): void {
        this.attackRemaining = Math.max(0, this.attackRemaining - Math.max(0, deltaTime));
        const target = this.target;
        if (!target?.isValid || !target.activeInHierarchy || target.parent !== this.node.parent) return;
        const health = target.getComponent(HeroHealth);
        if (health && !health.isAlive) { this.playAnimation(false); return; }
        if (this.attackRemaining > 0 || (this.getComponent(CharacterAnimation)?.enabled && this.getComponent(CharacterAnimation)?.isAttacking)) return;
        const dx = target.position.x - this.node.position.x;
        const dy = target.position.y - this.node.position.y;
        const distance = Math.hypot(dx, dy);
        const closest = this.clampToMap(target.position.x, target.position.y);
        const mapLimit = Math.hypot(target.position.x - closest.x, target.position.y - closest.y);
        const stopDistance = Math.max(0, this.idleRange, mapLimit);
        const elapsed = Math.max(0, deltaTime);
        this.timer += elapsed;
        if (this.timer >= Math.max(.01, this.checkInterval)) {
            this.timer %= Math.max(.01, this.checkInterval);
            this.following = distance > stopDistance + .01;
        }
        let moved = false;
        if (this.following && distance > stopDistance + .01) {
            const step = Math.min(Math.max(0, this.moveSpeed) * elapsed, distance - stopDistance);
            const before = this.node.position.clone();
            const next = this.clampToMap(before.x + dx / distance * step, before.y + dy / distance * step);
            // 只与其他宠物接触；每个终点先限制在地图内，保持自然跟随。
            this.body?.moveTo(next.x, next.y);
            const actualDistance = Math.hypot(this.node.position.x - before.x, this.node.position.y - before.y);
            if (this.body && actualDistance < step * .05 && distance - stopDistance > 5) {
                const remaining = Math.max(0, step - actualDistance), sideStart = this.node.position.clone();
                const side = this.clampToMap(sideStart.x - dy / distance * remaining * this.avoidanceSide,
                    sideStart.y + dx / distance * remaining * this.avoidanceSide);
                this.body.moveTo(side.x, side.y);
                if (this.node.position.equals(sideStart)) {
                    this.avoidanceSide *= -1;
                    const other = this.clampToMap(sideStart.x - dy / distance * remaining * this.avoidanceSide,
                        sideStart.y + dx / distance * remaining * this.avoidanceSide);
                    this.body.moveTo(other.x, other.y);
                }
            }
            this.keepInsideMap();
            moved = !this.node.position.equals(before);
            if (this.visual && Math.abs(dx) > .01) this.visual.setScale(dx < 0 ? -1 : 1, 1, 1);
        } else this.following = false;
        this.playAnimation(moved);
    }

    private playAnimation(moving: boolean): void {
        const pictureAnimation = this.getComponent(CharacterAnimation);
        if (pictureAnimation?.enabled) { pictureAnimation.setMoving(moving); return; }
        const skeleton = this.skeleton;
        if (!skeleton?.skeletonData) return;
        // 蓝龙原资源只有 Idle；其他三只保留原 Move 动画。
        const animations = (skeleton.skeletonData.skeletonJson as { animations?: Record<string, unknown> } | null)?.animations;
        const name = moving && animations?.Move ? 'Move' : 'Idle';
        if (name === this.animationName) return;
        skeleton.setAnimation(0, name, true);
        this.animationName = name;
    }

    playAttack(): number {
        if (!this.petSkeleton || !this.skeleton) return 0;
        this.attackRemaining = this.skeleton.findAnimation('Attack')?.duration ?? .68;
        this.skeleton.setAnimation(0, 'Attack', false);
        this.animationName = 'Attack';
        return this.attackRemaining;
    }

    private keepInsideMap(): void {
        const next = this.clampToMap(this.node.position.x, this.node.position.y);
        this.node.setPosition(next.x, next.y, this.node.position.z);
    }

    clampToMap(x: number, y: number): Vec2 {
        const ground = this.ground, body = this.getComponent(UITransform);
        const map = ground?.getComponent(UITransform);
        if (!ground || !map || !body) return new Vec2(x, y);
        const left = ground.position.x - map.width * map.anchorX * Math.abs(ground.scale.x);
        const bottom = ground.position.y - map.height * map.anchorY * Math.abs(ground.scale.y);
        const minX = left + body.width * body.anchorX;
        const maxX = left + map.width * Math.abs(ground.scale.x) - body.width * (1 - body.anchorX);
        const minY = bottom + body.height * body.anchorY;
        const maxY = bottom + map.height * Math.abs(ground.scale.y) - body.height * (1 - body.anchorY);
        return new Vec2(Math.min(maxX, Math.max(minX, x)), Math.min(maxY, Math.max(minY, y)));
    }
}
