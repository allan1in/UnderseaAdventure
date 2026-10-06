import { _decorator, Component, Node } from 'cc';
import { EnemyController } from './EnemyController';
import { HeroController } from './HeroController';
import { PetFollower } from './PetFollower';
import { BossController } from './BossController';

const { ccclass, executionOrder, property } = _decorator;

@ccclass('WorldDepthSort')
@executionOrder(100)
export class WorldDepthSort extends Component {
    @property({ tooltip: '英雄图片中心到脚底的固定偏移；负数表示脚底在节点下方' })
    heroFootOffset = -56;

    @property({ tooltip: '骷髅图片中心到脚底的固定偏移；不随动画图片尺寸变化' })
    enemyFootOffset = -54.5;

    lateUpdate(): void {
        const backgrounds: Node[] = [];
        const effects: Node[] = [];
        const actors: { node: Node; footY: number; originalIndex: number }[] = [];
        for (const [index, node] of this.node.children.entries()) {
            if (node.getComponent(HeroController)) {
                actors.push({ node, footY: node.position.y + this.heroFootOffset * Math.abs(node.scale.y), originalIndex: index });
            } else if (node.getComponent(BossController)) {
                actors.push({ node, footY: node.position.y, originalIndex: index });
            } else if (node.getComponent(EnemyController)) {
                actors.push({ node, footY: node.position.y + this.enemyFootOffset * Math.abs(node.scale.y), originalIndex: index });
            } else if (node.name === 'MagicLamp') {
                actors.push({ node, footY: node.position.y + 7.3, originalIndex: index });
            } else if (node.getComponent(PetFollower)) {
                actors.push({ node, footY: node.position.y + node.getComponent(PetFollower)!.footOffsetY, originalIndex: index });
            } else if (node.name === 'SlashEffect' || node.name === 'LampPaymentCoin' || node.name === 'PetHitEffect' || node.name === 'BossTentacleStrike') {
                effects.push(node);
            } else {
                backgrounds.push(node);
            }
        }
        // 屏幕上方先绘制，下方后绘制；同一高度保持原顺序，避免闪烁。
        actors.sort((a, b) => b.footY - a.footY || a.originalIndex - b.originalIndex);
        const order = [...backgrounds, ...actors.map(actor => actor.node), ...effects];
        for (const [index, node] of order.entries()) {
            if (node.getSiblingIndex() !== index) node.setSiblingIndex(index);
        }
    }
}
