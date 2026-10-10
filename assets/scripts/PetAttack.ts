import { _decorator, Component, director, instantiate, Node, Prefab } from 'cc';
import { EnemyController } from './EnemyController';
import { HeroHealth } from './HeroHealth';
import { PetFollower } from './PetFollower';
import { BossController } from './BossController';
import { CharacterAnimation } from './CharacterAnimation';

const { ccclass, property, executionOrder } = _decorator;

@ccclass('PetAttack')
@executionOrder(10)
export class PetAttack extends Component {
    @property({ tooltip: '单次对每只敌人造成的伤害；原示例为 10' })
    damage = 10;

    @property({ tooltip: '两轮攻击之间的秒数；原示例为 3，第一轮无需等待' })
    attackInterval = 3;

    @property({ tooltip: '远程范围技能的宽度，独立于宠物身体素材' })
    attackWidth = 350;

    @property
    attackHeight = 350;

    @property({ tooltip: '攻击框相对身体轴的垂直偏移' })
    attackOffsetY = 50;

    @property({ tooltip: '单轮最多命中的敌人数；原示例为 100' })
    maxTargets = 100;

    @property({ type: Prefab, tooltip: '该宠物自己的原版命中特效，已自动关联' })
    hitEffectPrefab: Prefab | null = null;

    private cooldown = 0;
    private follower: PetFollower | null = null;
    private effects: Node[] = [];

    onLoad(): void { this.follower = this.getComponent(PetFollower); }
    onEnable(): void { this.cooldown = 0; }

    update(deltaTime: number): void {
        if (director.isPaused()) return;
        const hero = this.follower?.target;
        const world = this.node.parent;
        if (!world || !hero?.isValid || !hero.activeInHierarchy || hero.parent !== world
            || hero.getComponent(HeroHealth)?.isAlive === false) return;
        this.cooldown = Math.max(0, this.cooldown - Math.max(0, deltaTime));
        if (this.cooldown > 0 || this.damage <= 0 || this.attackWidth <= 0 || this.attackHeight <= 0) return;
        const limit = Math.max(0, Math.floor(this.maxTargets));
        if (!limit) return;
        const position = this.node.position;
        const targets = this.getTargets();
        targets.sort((a, b) => Math.hypot(a.node.position.x - position.x, a.node.position.y - position.y)
            - Math.hypot(b.node.position.x - position.x, b.node.position.y - position.y));
        if (!targets.length) return;
        const animation = this.getComponent(CharacterAnimation);
        const duration = this.follower?.playAttack() ?? 0;
        this.cooldown = Math.max(.01, this.attackInterval, duration, animation?.enabled ? animation.duration('attack') : 0);
        if (animation?.enabled) animation.show('attack', true);
        if (Math.hypot(hero.position.x - position.x, hero.position.y - position.y) <= this.follower!.idleRange + .01) {
            const visual = this.node.getChildByName('Visual'), dx = targets[0].node.position.x - position.x;
            if (visual && Math.abs(dx) > .01) visual.setScale(dx < 0 ? -1 : 1, 1, 1);
        }
        for (const enemy of targets.slice(0, limit)) {
            if (!enemy.isAlive) continue;
            const hit = enemy.node.position.clone();
            enemy.takeDamage(this.damage);
            this.showEffect(hit.x, hit.y);
        }
    }

    private getTargets(): (EnemyController | BossController)[] {
        const position = this.node.position;
        const sx = Math.abs(this.node.scale.x), sy = Math.abs(this.node.scale.y);
        const centerX = position.x;
        const centerY = position.y + this.attackOffsetY * sy;
        const halfWidth = this.attackWidth * sx / 2, halfHeight = this.attackHeight * sy / 2;
        return (this.node.parent?.children ?? []).map(node => node.getComponent(EnemyController) ?? node.getComponent(BossController))
            .filter((enemy): enemy is EnemyController | BossController => {
                if (!enemy?.isAlive) return false;
                const bounds = enemy.getHurtBounds();
                return bounds.right >= centerX - halfWidth && bounds.left <= centerX + halfWidth
                    && bounds.top >= centerY - halfHeight && bounds.bottom <= centerY + halfHeight;
            });
    }

    private showEffect(x: number, y: number): void {
        if (!this.hitEffectPrefab || !this.node.parent) return;
        let node = this.effects.find(effect => effect.isValid && !effect.active);
        if (!node) {
            node = instantiate(this.hitEffectPrefab);
            node.active = false;
            node.name = 'PetHitEffect';
            node.layer = this.node.layer;
            this.node.parent.addChild(node);
            this.effects.push(node);
        }
        node.setPosition(x, y, this.node.position.z);
        node.active = true;
    }

    onDisable(): void {
        this.cooldown = 0;
        for (const effect of this.effects) if (effect.isValid) effect.active = false;
    }

    onDestroy(): void {
        for (const effect of this.effects) if (effect.isValid) effect.destroy();
        this.effects = [];
    }
}
