import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CircleBody2D')
export class CircleBody2D extends Component {
    @property({ tooltip: '身体阻挡的水平半径；人物和装置按素材体型单独设置' })
    radius = 25;

    @property({ tooltip: '椭圆垂直半径；0 时与水平半径相同，保持圆形' })
    verticalRadius = 0;

    @property({ tooltip: '碰撞圆心相对节点的水平偏移' })
    offsetX = 0;

    @property({ tooltip: '碰撞圆心相对节点的垂直偏移' })
    offsetY = 0;

    @property({ tooltip: '身体组：1 为英雄/敌人，2 为宠物' })
    collisionGroup = 1;

    @property({ tooltip: '允许阻挡的组位掩码：1 只挡角色，2 只挡宠物' })
    collisionMask = 1;

    collidesWith(other: CircleBody2D): boolean {
        return (this.collisionMask & other.collisionGroup) !== 0
            && (other.collisionMask & this.collisionGroup) !== 0;
    }

    get worldRadius(): number {
        // 这里返回共同父节点 World 坐标中的半径；左右翻转不改变大小。
        return Math.max(0, this.radius) * Math.max(Math.abs(this.node.scale.x), Math.abs(this.node.scale.y));
    }

    get centerX(): number { return this.node.position.x + this.offsetX * this.node.scale.x; }
    get centerY(): number { return this.node.position.y + this.offsetY * this.node.scale.y; }

    get worldRadiusY(): number {
        return this.verticalRadius > 0 ? this.verticalRadius * Math.abs(this.node.scale.y) : this.worldRadius;
    }

    overlapsAt(x: number, y: number, other: CircleBody2D, padding = 0): boolean {
        const rx = this.worldRadius + other.worldRadius + padding;
        const ry = this.worldRadiusY + other.worldRadiusY + padding;
        if (rx <= 0 || ry <= 0) return false;
        const dx = (x + this.offsetX * this.node.scale.x - other.centerX) / rx;
        const dy = (y + this.offsetY * this.node.scale.y - other.centerY) / ry;
        return dx * dx + dy * dy < 1;
    }

    contactDistanceAlong(other: CircleBody2D, dx: number, dy: number): number {
        const length = Math.hypot(dx, dy);
        const rx = this.worldRadius + other.worldRadius, ry = this.worldRadiusY + other.worldRadiusY;
        if (length <= .0001 || rx <= 0 || ry <= 0) return 0;
        return length / Math.hypot(dx / rx, dy / ry);
    }

    /** 出生点检查使用相同的身体范围，避免创建时就相互穿插。 */
    canOccupy(x: number, y: number): boolean {
        for (const sibling of this.node.parent?.children ?? []) {
            if (sibling === this.node || !sibling.activeInHierarchy) continue;
            const other = sibling.getComponent(CircleBody2D);
            if (!other?.enabledInHierarchy || !this.collidesWith(other)) continue;
            if (this.overlapsAt(x, y, other, .01)) return false;
        }
        return true;
    }

    moveTo(x: number, y: number, slide = false): void {
        const position = this.node.position;
        let currentX = position.x;
        let currentY = position.y;
        let dx = x - currentX;
        let dy = y - currentY;
        const z = position.z;

        // 每次接触后可保留沿障碍边缘的移动，最多处理四次接触。
        // Hero 使用默认的停止方式；Enemy 开启 slide 来改善追踪转向。
        for (let iteration = 0; iteration < (slide ? 4 : 1); iteration++) {
            if (dx * dx + dy * dy < 0.00000001) break;
            const hit = this.findFirstContact(currentX, currentY, dx, dy);
            currentX += dx * hit.fraction;
            currentY += dy * hit.fraction;
            if (!slide || hit.fraction >= 1) break;

            dx *= 1 - hit.fraction;
            dy *= 1 - hit.fraction;
            const inward = dx * hit.normalX + dy * hit.normalY;
            if (inward >= 0) break;
            // 去掉朝障碍内部的分量，留下沿接触面的分量。
            dx -= hit.normalX * inward;
            dy -= hit.normalY * inward;
        }

        this.node.setPosition(currentX, currentY, z);
    }

    private findFirstContact(x: number, y: number, dx: number, dy: number): {
        fraction: number; normalX: number; normalY: number;
    } {
        const hit = { fraction: 1, normalX: 0, normalY: 0 };
        if (!this.enabledInHierarchy) return hit;
        // 当前场景角色都直接放在 World 下，碰撞也在这套本地坐标中计算。
        for (const sibling of this.node.parent?.children ?? []) {
            if (sibling === this.node || !sibling.activeInHierarchy) continue;
            const other = sibling.getComponent(CircleBody2D);
            if (!other?.enabledInHierarchy || !this.collidesWith(other)) continue;
            const radiusX = this.worldRadius + other.worldRadius;
            const radiusY = this.worldRadiusY + other.worldRadiusY;
            if (radiusX <= 0 || radiusY <= 0) continue;
            const offsetX = x + this.offsetX * this.node.scale.x - other.centerX;
            const offsetY = y + this.offsetY * this.node.scale.y - other.centerY;
            // 将椭圆映射到单位圆，沿整段移动路径求首次接触。
            const approach = offsetX * dx / (radiusX * radiusX) + offsetY * dy / (radiusY * radiusY);
            // 远离或沿边缘移动时允许走开；容差避免切向计算误差反复判碰撞。
            if (approach >= -0.0000001) continue;

            const gap = offsetX * offsetX / (radiusX * radiusX) + offsetY * offsetY / (radiusY * radiusY) - 1;
            const distanceSquared = dx * dx / (radiusX * radiusX) + dy * dy / (radiusY * radiusY);
            let fraction = 0;
            if (gap > 0) {
                // 检查整个移动路径，避免一步跨过骷髅。
                const discriminant = approach * approach - distanceSquared * gap;
                if (discriminant < 0) continue;
                fraction = (-approach - Math.sqrt(discriminant)) / distanceSquared;
            }
            if (fraction < 0 || fraction > hit.fraction) continue;
            const normalX = (offsetX + dx * fraction) / (radiusX * radiusX);
            const normalY = (offsetY + dy * fraction) / (radiusY * radiusY);
            const length = Math.hypot(normalX, normalY);
            if (length < 0.0001) continue;
            hit.fraction = fraction;
            hit.normalX = normalX / length;
            hit.normalY = normalY / length;
        }
        return hit;
    }
}
