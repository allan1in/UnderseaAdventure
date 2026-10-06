import { _decorator, Color, Component, instantiate, Node, Prefab, Sprite, SpriteFrame, UITransform } from 'cc';

const { ccclass, property } = _decorator;

/** 原示例 GuideLine 的直线箭头排列；不负责寻路和避开敌人。 */
@ccclass('LampGuide')
export class LampGuide extends Component {
    @property(Node)
    hero: Node | null = null;

    @property(Node)
    target: Node | null = null;

    @property(SpriteFrame)
    arrowFrame: SpriteFrame | null = null;

    @property(Prefab)
    arrowPrefab: Prefab | null = null;

    @property({ tooltip: '原示例箭头宽 82；学习工程以一半尺寸显示' })
    spacing = 41;

    private arrows: Node[] = [];

    lateUpdate(): void {
        const hero = this.hero;
        const target = this.target;
        if (!hero?.isValid || !target?.isValid || !hero.activeInHierarchy || !target.activeInHierarchy
            || !this.arrowFrame || hero.parent !== this.node.parent || target.parent !== hero.parent) {
            for (const arrow of this.arrows) arrow.active = false;
            return;
        }
        const dx = target.position.x - hero.position.x;
        const dy = target.position.y - hero.position.y;
        const spacing = Math.max(1, this.spacing);
        const count = Math.floor(Math.hypot(dx, dy) / spacing);
        this.node.setPosition(hero.position);
        this.node.angle = Math.atan2(dy, dx) * 180 / Math.PI - 90;
        for (let i = 0; i < count; i++) {
            let arrow = this.arrows[i];
            if (!arrow) {
                arrow = this.arrowPrefab ? instantiate(this.arrowPrefab) : new Node('Arrow');
                arrow.layer = this.node.layer;
                this.node.addChild(arrow);
                const transform = arrow.getComponent(UITransform) ?? arrow.addComponent(UITransform);
                const sprite = arrow.getComponent(Sprite) ?? arrow.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.trim = true;
                sprite.spriteFrame ??= this.arrowFrame;
                if (!this.arrowPrefab) sprite.color = new Color(255, 255, 0, 255);
                const size = sprite.spriteFrame.rect;
                transform.setContentSize(spacing, spacing * size.height / size.width);
                this.arrows.push(arrow);
            }
            arrow.setPosition(0, i * spacing, 0);
            arrow.active = true;
        }
        // 复用已创建的箭头，靠近神灯时收起多余部分。
        for (let i = count; i < this.arrows.length; i++) this.arrows[i].active = false;
    }
}
