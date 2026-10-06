import { _decorator, Component, director, Label, Node, Sprite, UITransform } from 'cc';
import { BossVisual } from './BossVisual';
import { CircleBody2D } from './CircleBody2D';
import { SoundEffects } from './SoundEffects';
import { HeroHealth } from './HeroHealth';
import { FlatShape } from './FlatShape';
import { BossRangedAttack } from './BossRangedAttack';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('BossController')
@requireComponent(BossVisual)
export class BossController extends Component {
    static readonly DEFEATED = 'boss-defeated';
    @property(Node) target: Node | null = null;
    @property maxHealth = 200;
    @property({ tooltip: 'BOSS 移速 200，介于普通敌人 100 与英雄 300 之间' }) moveSpeed = 200;
    @property attackDamage = 5;
    @property attackInterval = 1;
    @property({ tooltip: '远程触手技能冷却；近距离优先使用原攻击' }) rangedInterval = 3;
    @property({ tooltip: '远程触手施法最大距离' }) rangedRange = 700;
    @property({ tooltip: '原 16 帧攻击约 60% 处命中' }) hitTime = .3;
    @property attackWidth = 450;
    @property attackHeight = 112.5;
    @property attackOffsetX = 0;
    @property attackOffsetY = 45;
    @property({ tooltip: '启用时使用旧版扩大锁定范围；海底攻击按触手范围复查命中' }) lockTarget = false;
    @property viewRange = 562.5;
    @property({ tooltip: 'Boss 身体的受击宽度，与攻击范围分开' }) hurtWidth = 330;
    @property hurtHeight = 300;
    @property hurtOffsetX = 0;
    @property hurtOffsetY = -5;
    @property(Node) ground: Node | null = null;
    @property(Node) healthFill: Node | null = null;
    @property({ tooltip: '相对于 Boss 身体中心轴的固定横向位置' }) healthBarOffsetX = 0;
    @property({ tooltip: '血条固定高度，不随动作图片尺寸变化' }) healthBarOffsetY = 390;
    private healthBar: Node | null = null;
    private health = 0;
    private visual: BossVisual | null = null;
    private cooldown = 0;
    private attacking = false;
    private elapsed = 0;
    private appliedHit = false;
    private defeated = false;
    private rangedAttack: BossRangedAttack | null = null;
    private rangedCooldown = 0;

    get currentHealth(): number { return this.health; }
    get isAlive(): boolean { return this.health > 0 && this.enabledInHierarchy; }
    get isDead(): boolean { return this.health <= 0; }

    onLoad(): void {
        this.visual = this.getComponent(BossVisual); this.visual?.onLoad();
        this.rangedAttack = this.getComponent(BossRangedAttack) ?? this.addComponent(BossRangedAttack);
        // 兼容编辑器缓存的旧 Prefab：Boss 不参与身体阻挡。
        const oldBody = this.getComponent(CircleBody2D);
        if (oldBody) { oldBody.enabled = false; oldBody.destroy(); }
        this.healthBar = this.healthFill?.parent ?? this.node.getChildByName('HealthBar');
        this.health = Math.max(1, this.maxHealth); this.refreshHealth();
    }

    lateUpdate(): void { this.centerHealthBar(); }

    private centerHealthBar(): void {
        if (!this.healthBar) return;
        // 与 Hero 相同：血条直接固定在身体根节点下，不跟随动画或左右翻转。
        this.healthBar.setPosition(this.healthBarOffsetX, this.healthBarOffsetY, 0);
        this.healthBar.setScale(1, 1, 1);
    }

    getHurtBounds(): { left: number; right: number; bottom: number; top: number } {
        const facing = this.visual?.direction ?? 1, p = this.node.position;
        const scaleX = Math.abs(this.node.scale.x), scaleY = Math.abs(this.node.scale.y);
        const x = p.x + facing * this.hurtOffsetX * scaleX, y = p.y + this.hurtOffsetY * scaleY;
        const halfWidth = Math.max(0, this.hurtWidth) * scaleX / 2;
        const halfHeight = Math.max(0, this.hurtHeight) * scaleY / 2;
        return { left: x - halfWidth, right: x + halfWidth, bottom: y - halfHeight, top: y + halfHeight };
    }

    takeDamage(damage: number): void {
        if (!this.isAlive || !Number.isFinite(damage) || damage <= 0) return;
        this.health = Math.max(0, this.health - damage); this.refreshHealth();
        if (this.health > 0) this.visual?.flashHit();
        else {
            this.rangedAttack?.stop();
            this.attacking = false;
            this.visual?.show('death', true);
        }
    }

    update(deltaTime: number): void {
        if (director.isPaused()) return;
        if (this.isDead) {
            if (!this.defeated && (!this.visual || this.visual.isComplete)) {
                this.defeated = true; this.node.emit(BossController.DEFEATED); this.node.active = false;
            }
            return;
        }
        const hero = this.target?.getComponent(HeroHealth);
        if (!hero?.isAlive || this.target?.parent !== this.node.parent) { this.visual?.show('idle'); this.attacking = false; this.rangedAttack?.stop(); return; }
        const dt = Math.max(0, deltaTime);
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.rangedCooldown = Math.max(0, this.rangedCooldown - dt);
        if (this.rangedAttack?.isRunning) {
            this.rangedAttack.advance(dt, hero);
            if (!this.rangedAttack.isRunning) this.visual?.show('idle');
            return;
        }
        if (this.attacking) {
            this.elapsed += dt;
            if (!this.appliedHit && this.elapsed >= this.hitTime) {
                this.appliedHit = true;
                if (this.inRange(hero, this.lockTarget ? this.viewRange : this.attackWidth,
                    this.lockTarget ? this.viewRange : this.attackHeight)) {
                    hero.takeDamage(this.attackDamage);
                }
            }
            if (this.elapsed >= (this.visual?.duration('attack') ?? .533333)) {
                this.attacking = false; this.visual?.show('idle');
            }
            return;
        }
        const dx = hero.node.position.x - this.node.position.x, dy = hero.node.position.y - this.node.position.y;
        this.visual?.setFacing(dx);
        if (this.cooldown <= 0 && this.inRange(hero, this.attackWidth, this.attackHeight)) {
            SoundEffects.play('boss-attack');
            this.attacking = true; this.elapsed = 0; this.appliedHit = false;
            this.cooldown = Math.max(this.visual?.duration('attack') ?? .533333, this.attackInterval);
            this.visual?.show('attack', true);
            return;
        }
        const distance = Math.hypot(dx, dy);
        if (this.cooldown <= 0 && this.rangedCooldown <= 0 && distance <= this.rangedRange
            && !this.inRange(hero, this.attackWidth, this.attackHeight)) {
            this.rangedAttack?.begin(hero);
            this.rangedCooldown = Math.max(0, this.rangedInterval);
            this.cooldown = Math.max(this.attackInterval, this.rangedAttack!.warningTime + this.rangedAttack!.eruptionDuration);
            this.visual?.show('attack', true);
            return;
        }
        const step = Math.min(this.moveSpeed * dt, distance);
        if (distance > .001 && step > .001) {
            const before = this.node.position.clone();
            const next = this.clampToMap(before.x + dx / distance * step, before.y + dy / distance * step);
            this.node.setPosition(next.x, next.y, before.z);
            this.visual?.show(this.node.position.equals(before) ? 'idle' : 'move');
        } else this.visual?.show('idle');
    }

    onDisable(): void { this.rangedAttack?.stop(); }

    clampToMap(x: number, y: number): { x: number; y: number } {
        const map = this.ground?.getComponent(UITransform);
        if (!map || !this.ground) return { x, y };
        const display = this.getComponent(UITransform);
        // 地图留边使用所有动作的固定包围范围，避免逐帧校准缩放改变移动边界。
        const halfWidth = (display?.width ?? 385) / 2;
        const halfHeight = (display?.height ?? 385) / 2;
        const left = this.ground.position.x - map.width * map.anchorX, bottom = this.ground.position.y - map.height * map.anchorY;
        return { x: Math.max(left + halfWidth, Math.min(left + map.width - halfWidth, x)),
            y: Math.max(bottom + halfHeight, Math.min(bottom + map.height - halfHeight, y)) };
    }

    private inRange(hero: HeroHealth, width: number, height: number): boolean {
        const p = this.node.position, facing = this.visual?.direction ?? 1;
        const centerX = p.x + (this.lockTarget && width === this.viewRange ? 0 : facing * this.attackOffsetX);
        const centerY = p.y + this.attackOffsetY, b = hero.getHurtBounds();
        return b.right >= centerX - width / 2 && b.left <= centerX + width / 2
            && b.top >= centerY - height / 2 && b.bottom <= centerY + height / 2;
    }

    private refreshHealth(): void {
        if (this.healthFill) {
            const ratio = Math.max(0, Math.min(1, this.health / Math.max(1, this.maxHealth)));
            const sprite = this.healthFill.getComponent(Sprite);
            if (sprite?.type === Sprite.Type.FILLED) sprite.fillRange = ratio;
            else {
                const ui = this.healthFill.getComponent(UITransform);
                const fullWidth = (this.healthBar?.getComponent(UITransform)?.width ?? 96) - 4;
                if (ui) ui.setContentSize(Math.max(0, fullWidth) * ratio, ui.height);
                this.healthFill.getComponent(FlatShape)?.redraw();
            }
            const amount = this.healthBar?.getChildByName('Amount')?.getComponent(Label);
            if (amount) amount.string = `${Math.ceil(this.health)}/${Math.ceil(this.maxHealth)}`;
        }
        this.centerHealthBar();
    }
}
