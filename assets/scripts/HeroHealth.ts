import { _decorator, Animation, Color, Component, Graphics, Label, Node, Sprite, UITransform } from 'cc';
import { HeroVisual } from './HeroVisual';
import { FlatShape } from './FlatShape';

const { ccclass, executionOrder, property } = _decorator;

@ccclass('HeroHealth')
@executionOrder(10)
export class HeroHealth extends Component {
    static readonly DIED = 'hero-died';

    @property({ tooltip: '英雄初始血量；原示例第一形态为 100' })
    maxHealth = 100;

    @property({ tooltip: '受伤范围的固定宽度，不随待机、走路、攻击图片尺寸变化' })
    hurtWidth = 88;

    @property({ tooltip: '受伤范围的固定高度' })
    hurtHeight = 120;

    @property({ tooltip: '受击身体中心相对脚底轴的高度，不随动作帧变化' })
    hurtOffsetY = 8;

    @property({ tooltip: '显示简单血条，便于观察骷髅攻击后的血量变化' })
    showHealthBar = true;

    @property({ tooltip: '血条相对 Hero 节点的固定左右偏移，不随左右转身改变' })
    healthBarOffsetX = 0;

    @property({ tooltip: '血条相对英雄图片中心的高度；原示例第一形态换算约为 64.69' })
    healthBarOffsetY = 104;

    private health = 0;
    private sprite: Sprite | null = null;
    private originalColor = new Color();
    private flashTimer = 0;
    private healthBar: Node | null = null;

    get currentHealth(): number { return this.health; }
    get isAlive(): boolean { return this.health > 0 && this.enabledInHierarchy; }

    upgrade(maxHealth: number, barHeight: number): void {
        this.maxHealth = Math.max(1, maxHealth);
        this.health = this.maxHealth; // 原示例进化后 EntityData.onEnable 重置为满血。
        this.healthBarOffsetY = barHeight;
        this.flashTimer = 0;
        this.getComponent(HeroVisual)?.setTint(this.originalColor);
        this.refreshHealthBar();
    }

    onLoad(): void {
        this.healthBar = this.node.getChildByName('HealthBar');
        this.health = Math.max(1, this.maxHealth);
        this.sprite = this.getComponent(HeroVisual)?.displaySprite ?? this.getComponent(Sprite);
        if (this.sprite) this.originalColor = this.sprite.color.clone();
        this.refreshHealthBar();
    }

    update(deltaTime: number): void {
        if (this.flashTimer <= 0) return;
        this.flashTimer = Math.max(0, this.flashTimer - Math.max(0, deltaTime));
        if (this.flashTimer === 0) this.getComponent(HeroVisual)?.setTint(this.originalColor);
    }

    lateUpdate(): void {
        this.keepHealthBarFacingRight();
    }

    getHurtBounds(): { left: number; right: number; bottom: number; top: number } {
        const halfWidth = Math.max(0, this.hurtWidth) * Math.abs(this.node.scale.x) / 2;
        const halfHeight = Math.max(0, this.hurtHeight) * Math.abs(this.node.scale.y) / 2;
        const p = this.node.position;
        const centerY = p.y + this.hurtOffsetY * Math.abs(this.node.scale.y);
        return { left: p.x - halfWidth, right: p.x + halfWidth, bottom: centerY - halfHeight, top: centerY + halfHeight };
    }

    takeDamage(damage: number): void {
        if (!this.isAlive || !Number.isFinite(damage) || damage <= 0) return;
        this.health = Math.max(0, this.health - damage);
        this.refreshHealthBar();
        if (this.health === 0) {
            this.flashTimer = 0;
            const visual = this.getComponent(HeroVisual);
            if (visual) visual.stopAnimation();
            else this.getComponent(Animation)?.stop();
            visual?.setTint(new Color(145, 145, 145, this.originalColor.a));
            // 控制器结束挥剑和移动，结算系统监听死亡事件显示失败界面。
            this.node.emit(HeroHealth.DIED);
        } else {
            this.flashTimer = 0.12;
            this.getComponent(HeroVisual)?.setTint(new Color(255, 100, 100, this.originalColor.a));
        }
    }

    onDisable(): void {
        this.flashTimer = 0;
        if (this.health > 0) this.getComponent(HeroVisual)?.setTint(this.originalColor);
    }

    private refreshHealthBar(): void {
        if (!this.showHealthBar) {
            if (this.healthBar) this.healthBar.active = false;
            return;
        }
        if (!this.healthBar) {
            const node = new Node('HealthBar');
            node.layer = this.node.layer;
            this.node.addChild(node);
            node.addComponent(UITransform).setContentSize(96, 10);
            node.addComponent(Graphics);
            this.healthBar = node;
        }
        this.keepHealthBarFacingRight();
        const fill = this.healthBar.getChildByName('Fill');
        if (fill) {
            const ratio = Math.max(0, Math.min(1, this.health / Math.max(1, this.maxHealth)));
            const sprite = fill.getComponent(Sprite);
            if (sprite?.type === Sprite.Type.FILLED) sprite.fillRange = ratio;
            else {
                const transform = fill.getComponent(UITransform)!;
                transform.setContentSize(92 * ratio, transform.height);
                fill.getComponent(FlatShape)?.redraw();
            }
            const amount = this.healthBar.getChildByName('Amount')?.getComponent(Label);
            if (amount) amount.string = `${Math.ceil(this.health)}/${Math.ceil(this.maxHealth)}`;
            this.healthBar.active = true;
            return;
        }
        const graphics = this.healthBar.getComponent(Graphics)!;
        graphics.clear();
        graphics.fillColor = new Color(35, 55, 45, 230);
        graphics.rect(-48, -5, 96, 10);
        graphics.fill();
        const ratio = Math.max(0, Math.min(1, this.health / Math.max(1, this.maxHealth)));
        graphics.fillColor = new Color(104, 237, 101, 255);
        graphics.rect(-46, -3, 92 * ratio, 6);
        graphics.fill();
    }

    private keepHealthBarFacingRight(): void {
        if (!this.healthBar) return;
        // Hero 不再翻转；血条直接固定在身体轴上方，无需反向补偿。
        const localX = this.healthBarOffsetX;
        if (this.healthBar.position.x !== localX || this.healthBar.position.y !== this.healthBarOffsetY) {
            this.healthBar.setPosition(localX, this.healthBarOffsetY, 0);
        }
        // 始终从屏幕右侧扣血。
        if (this.healthBar.scale.x !== 1) this.healthBar.setScale(1, 1, 1);
    }
}
